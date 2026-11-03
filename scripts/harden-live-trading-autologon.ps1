#Requires -Version 5.1
<#
.SYNOPSIS
  Moves the host's auto-logon password out of the registry and into the LSA secret Winlogon reads in its place.

.DESCRIPTION
  The host logs itself in after a reboot, which is what restarts the MT5 terminal with nobody at the keyboard.
  Windows does that from four values under Winlogon, and the fourth one - DefaultPassword - is stored in plain
  text. Microsoft's own article on the feature says so and adds the part that matters here: the key "can be
  remotely read by the Authenticated Users group". On a host whose whole job is to keep trading unattended, that
  is the wrong place for it.

  Winlogon also accepts the same password as an LSA secret named DefaultPassword, if the registry value is not
  present. That is what Sysinternals Autologon writes, and what this script writes: the credential stays in the
  place Winlogon has always read it, but a reader now needs local administrator rights on this machine rather
  than any authenticated account that can reach the Remote Registry service. It is not encryption that stops an
  administrator; nothing here would, because the terminal already holds the same broker password.

  The order of operations is the whole safety argument:

    1. read the plaintext, and prove it by logging the account on with it - a wrong value is refused here,
       before anything has moved;
    2. write the LSA secret, and read it back through the LSA to prove it took;
    3. write a rollback copy under state\, so a failure at the next boot can be undone with nobody present;
    4. only then delete the registry value, and re-read the registry to prove it is gone.

  A reboot is not part of this and is never started by it: the running session, the terminal and the lane are
  untouched. What changes is the next boot. Proof that the secret works is a boot that comes after this run and
  still produces a console session, which run-live-trading-watchdog.ps1 checks on its own timer: it deletes the
  rollback copy when that boot happens, and, if a boot after the hardening produces no session, it puts the
  plaintext value back and reboots, so the following boot logs in the old way instead of waiting for a human.

  Run it as SYSTEM - a scheduled task, as this host's other privileged steps are - because the SECURITY hive and
  the LSA policy are SYSTEM's. As Administrator it refuses rather than half-working.

.PARAMETER VerifyOnly
  Report where the credential is and what the registry says, and change nothing.

.PARAMETER Restore
  Put the plaintext DefaultPassword back from the rollback copy. This is the watchdog's recovery path and the
  manual undo: it leaves the LSA secret in place, because an unused secret is not a credential leak and deleting
  one is the one operation here with no upside if it is wrong.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\harden-live-trading-autologon.ps1 -VerifyOnly
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\harden-live-trading-autologon.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\harden-live-trading-autologon.ps1 -Restore
#>
param(
  [string] $WinlogonKey = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon",
  [string] $StateDir = "C:\live-trading\state",
  [string] $Log = "C:\live-trading\logs\live-trading-autologon.log",
  [switch] $VerifyOnly,
  [switch] $Restore
)

$ErrorActionPreference = "Stop"
$now = (Get-Date).ToUniversalTime()
$rollbackFile = Join-Path $StateDir "autologon-rollback.json"

function Write-Line {
  param([string] $Text)
  $line = $now.ToString("o") + " " + $Text
  $dir = Split-Path -Parent $Log
  if ($dir -and -not (Test-Path -LiteralPath $dir)) { $null = New-Item -ItemType Directory -Path $dir -Force }
  Add-Content -LiteralPath $Log -Value $line
  Write-Output $line
}

# The LSA is reached through a handful of advapi32 calls, so the type carries the marshalling and the script keeps
# the decisions. Nothing here is called with a password that has not already been proved against the account.
$lsaSource = @'
using System;
using System.Runtime.InteropServices;

public static class LsaSecret
{
    [StructLayout(LayoutKind.Sequential)]
    public struct LSA_UNICODE_STRING
    {
        public ushort Length;
        public ushort MaximumLength;
        public IntPtr Buffer;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct LSA_OBJECT_ATTRIBUTES
    {
        public uint Length;
        public IntPtr RootDirectory;
        public IntPtr ObjectName;
        public uint Attributes;
        public IntPtr SecurityDescriptor;
        public IntPtr SecurityQualityOfService;
    }

    [DllImport("advapi32.dll")]
    static extern uint LsaOpenPolicy(IntPtr SystemName, ref LSA_OBJECT_ATTRIBUTES ObjectAttributes, uint AccessMask, out IntPtr PolicyHandle);

    [DllImport("advapi32.dll")]
    static extern uint LsaStorePrivateData(IntPtr PolicyHandle, ref LSA_UNICODE_STRING KeyName, ref LSA_UNICODE_STRING PrivateData);

    [DllImport("advapi32.dll")]
    static extern uint LsaRetrievePrivateData(IntPtr PolicyHandle, ref LSA_UNICODE_STRING KeyName, out IntPtr PrivateData);

    [DllImport("advapi32.dll")]
    static extern uint LsaClose(IntPtr ObjectHandle);

    [DllImport("advapi32.dll")]
    static extern uint LsaFreeMemory(IntPtr Buffer);

    [DllImport("advapi32.dll")]
    static extern uint LsaNtStatusToWinError(uint Status);

    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool LogonUser(string UserName, string Domain, string Password, int LogonType, int LogonProvider, out IntPtr Token);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool CloseHandle(IntPtr Handle);

    // POLICY_CREATE_SECRET | POLICY_GET_PRIVATE_INFORMATION: the two rights this needs and no others.
    const uint Access = 0x00000020 | 0x00000004;

    static int Open(out IntPtr handle)
    {
        LSA_OBJECT_ATTRIBUTES attributes = new LSA_OBJECT_ATTRIBUTES();
        attributes.Length = (uint)Marshal.SizeOf(typeof(LSA_OBJECT_ATTRIBUTES));
        return (int)LsaNtStatusToWinError(LsaOpenPolicy(IntPtr.Zero, ref attributes, Access, out handle));
    }

    static LSA_UNICODE_STRING Build(string value, out IntPtr buffer)
    {
        buffer = Marshal.StringToHGlobalUni(value);
        LSA_UNICODE_STRING text = new LSA_UNICODE_STRING();
        text.Buffer = buffer;
        text.Length = (ushort)(value.Length * 2);
        text.MaximumLength = (ushort)(value.Length * 2 + 2);
        return text;
    }

    public static int Store(string name, string value, out int ntStatus)
    {
        IntPtr handle;
        int error = Open(out handle);
        ntStatus = error == 0 ? 0 : -1;
        if (error != 0) return error;
        try
        {
            IntPtr nameBuffer;
            IntPtr valueBuffer;
            LSA_UNICODE_STRING key = Build(name, out nameBuffer);
            LSA_UNICODE_STRING data = Build(value, out valueBuffer);
            try
            {
                uint status = LsaStorePrivateData(handle, ref key, ref data);
                ntStatus = (int)status;
                return (int)LsaNtStatusToWinError(status);
            }
            finally
            {
                Marshal.FreeHGlobal(nameBuffer);
                Marshal.FreeHGlobal(valueBuffer);
            }
        }
        finally
        {
            LsaClose(handle);
        }
    }

    public static string Retrieve(string name, out int ntStatus)
    {
        IntPtr handle;
        int error = Open(out handle);
        ntStatus = error == 0 ? 0 : -1;
        if (error != 0) return null;
        try
        {
            IntPtr nameBuffer;
            LSA_UNICODE_STRING key = Build(name, out nameBuffer);
            try
            {
                IntPtr data;
                uint status = LsaRetrievePrivateData(handle, ref key, out data);
                ntStatus = (int)status;
                if (status != 0 || data == IntPtr.Zero) return null;
                try
                {
                    LSA_UNICODE_STRING text = (LSA_UNICODE_STRING)Marshal.PtrToStructure(data, typeof(LSA_UNICODE_STRING));
                    return Marshal.PtrToStringUni(text.Buffer, text.Length / 2);
                }
                finally
                {
                    LsaFreeMemory(data);
                }
            }
            finally
            {
                Marshal.FreeHGlobal(nameBuffer);
            }
        }
        finally
        {
            LsaClose(handle);
        }
    }

    // LOGON32_LOGON_INTERACTIVE against the local account: it proves the password is the account's and creates no
    // session, so validating here cannot disturb the console session the terminal is running in.
    public static bool ValidateCredentials(string userName, string domain, string password, out int error)
    {
        IntPtr token;
        bool ok = LogonUser(userName, domain, password, 2, 0, out token);
        error = ok ? 0 : Marshal.GetLastWin32Error();
        if (ok) CloseHandle(token);
        return ok;
    }
}
'@

if (-not ("LsaSecret" -as [type])) {
  Add-Type -TypeDefinition $lsaSource -Language CSharp
}

$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$isSystem = $identity.User.Value -eq "S-1-5-18"

$winlogon = Get-ItemProperty -Path $WinlogonKey
$registryPassword = $winlogon.DefaultPassword
$hasRegistryPassword = [bool]$registryPassword
$secretStatus = 0
$secret = $null
try { $secret = [LsaSecret]::Retrieve("DefaultPassword", [ref]$secretStatus) } catch { $secret = $null }
$hasSecret = [bool]$secret
$secretLength = if ($secret) { $secret.Length } else { 0 }

if ($VerifyOnly) {
  Write-Line ("verify: identity=" + $identity.Name + " (SYSTEM=" + $isSystem + ")")
  Write-Line ("verify: AutoAdminLogon=" + $winlogon.AutoAdminLogon + " user=" + $winlogon.DefaultUserName + " domain=" + $winlogon.DefaultDomainName + " autoLogonCount=" + $(if ($null -eq $winlogon.AutoLogonCount) { "not set" } else { $winlogon.AutoLogonCount }))
  Write-Line ("verify: registry DefaultPassword present=" + $hasRegistryPassword + $(if ($hasRegistryPassword) { " (" + ([string]$registryPassword).Length + " characters, plaintext)" } else { "" }))
  if ($secretStatus -eq 0) {
    Write-Line ("verify: LSA secret DefaultPassword present=" + $hasSecret + " (" + $secretLength + " characters)")
  } else {
    Write-Line ("verify: the LSA secret could not be read (ntstatus " + $secretStatus + "). Only SYSTEM can read it, so this run is not evidence about the secret either way - check the state line below as the registry half only.")
  }
  Write-Line ("verify: rollback copy present=" + (Test-Path -LiteralPath $rollbackFile) + " at " + $rollbackFile)
  $state = if ($secretStatus -ne 0 -and -not $hasRegistryPassword) {
    "unknown - the registry half is hardened and the secret cannot be read without SYSTEM"
  } elseif ($hasRegistryPassword -and $hasSecret) {
    "both - a restore has run, or a hardening stopped before the registry value was removed"
  } elseif ($hasSecret) {
    "hardened - the secret is the only copy"
  } elseif ($hasRegistryPassword) {
    "plaintext only - not hardened"
  } else {
    "no stored credential at all, which would leave the next boot at the logon screen"
  }
  Write-Line ("verify: state = " + $state)
  exit 0
}

if ($Restore) {
  if (-not (Test-Path -LiteralPath $rollbackFile)) {
    Write-Line ("restore refused: there is no rollback copy at " + $rollbackFile + ", so there is nothing this script could put back")
    exit 1
  }
  $copy = Get-Content -LiteralPath $rollbackFile -Raw | ConvertFrom-Json
  if (-not $copy.password) {
    Write-Line "restore refused: the rollback copy carries no password"
    exit 1
  }
  Set-ItemProperty -Path $WinlogonKey -Name DefaultPassword -Value ([string]$copy.password)
  Set-ItemProperty -Path $WinlogonKey -Name AutoAdminLogon -Value "1"
  if ($copy.user) { Set-ItemProperty -Path $WinlogonKey -Name DefaultUserName -Value ([string]$copy.user) }
  if ($copy.domain) { Set-ItemProperty -Path $WinlogonKey -Name DefaultDomainName -Value ([string]$copy.domain) }
  Remove-ItemProperty -Path $WinlogonKey -Name AutoLogonCount -ErrorAction SilentlyContinue
  $back = (Get-ItemProperty -Path $WinlogonKey).DefaultPassword
  Write-Line ("restored: plaintext DefaultPassword is back in the registry for " + $copy.user + " (" + ([string]$back).Length + " characters), AutoAdminLogon=1. The LSA secret is left in place; a boot now logs in the way it did before the hardening.")
  exit 0
}

if (-not $isSystem) {
  Write-Line ("refused: this needs SYSTEM, and it is running as " + $identity.Name + ". The SECURITY hive and the LSA policy are SYSTEM's, so as anybody else this would half-work; run it as a SYSTEM scheduled task, as the host's other privileged steps are.")
  exit 1
}

if (-not $hasRegistryPassword) {
  if ($hasSecret) {
    Write-Line ("already hardened: there is no registry DefaultPassword and the LSA secret reads back (" + $secretLength + " characters). Nothing changed.")
    exit 0
  }
  Write-Line "refused: there is no registry DefaultPassword and no LSA secret, so there is no credential here to move. Set the auto-logon credential first - docs/live-trading/VPS_ACCESS_HANDOFF.md section 6 - and run this again."
  exit 1
}

# 1. The password is proved before anything moves, so a wrong registry value cannot cost the next boot.
$logonError = 0
$validated = $false
try {
  $validated = [LsaSecret]::ValidateCredentials([string]$winlogon.DefaultUserName, [string]$winlogon.DefaultDomainName, [string]$registryPassword, [ref]$logonError)
} catch {
  Write-Line ("refused: the account could not be logged on with the registry password: " + $_.Exception.Message)
  exit 1
}
if (-not $validated) {
  Write-Line ("refused: the registry password does not log on " + $winlogon.DefaultDomainName + "\" + $winlogon.DefaultUserName + " (win32 error " + $logonError + "). Nothing was changed; a boot after a hardening that stored a wrong password would have nobody to log in.")
  exit 1
}
Write-Line ("validated: the registry password logs on " + $winlogon.DefaultDomainName + "\" + $winlogon.DefaultUserName + " (" + ([string]$registryPassword).Length + " characters)")

# 2. The secret is written and read back through the LSA before the registry value is touched.
$storeStatus = 0
$storeError = 0
$readBack = $null
try {
  $storeError = [LsaSecret]::Store("DefaultPassword", [string]$registryPassword, [ref]$storeStatus)
  if ($storeError -eq 0) { $readBack = [LsaSecret]::Retrieve("DefaultPassword", [ref]$secretStatus) }
} catch {
  $storeError = -1
  $storeStatus = -1
}
if ($storeError -ne 0) {
  Write-Line ("refused: LsaStorePrivateData failed (win32 " + $storeError + ", ntstatus 0x" + $storeStatus.ToString("x8") + "). The registry value is untouched, so the host still logs itself in the way it does today.")
  exit 1
}
if ($readBack -ne [string]$registryPassword) {
  Write-Line "refused: the secret did not read back as the value that was stored. The registry value is untouched; treat the secret as unusable and re-run this script."
  exit 1
}
Write-Line ("stored: the LSA secret DefaultPassword reads back the value that was stored (" + $readBack.Length + " characters)")

# 3. The rollback copy exists before the plaintext is removed, so there is no moment when the credential lives
#    nowhere. It is readable by SYSTEM and by local administrators - the same reach the secret itself has - and
#    the watchdog deletes it once a boot proves the secret works.
if (-not (Test-Path -LiteralPath $StateDir)) { $null = New-Item -ItemType Directory -Path $StateDir -Force }
$payload = [ordered]@{
  schema = "live-trading-autologon-rollback-v1"
  user = [string]$winlogon.DefaultUserName
  domain = [string]$winlogon.DefaultDomainName
  password = [string]$registryPassword
  hardened_at_utc = $now.ToString("o")
  written_by = "scripts/harden-live-trading-autologon.ps1"
  note = "The plaintext auto-logon password, kept only until a boot that comes after hardened_at_utc produces a console session. run-live-trading-watchdog.ps1 restores it if such a boot produces no session, and deletes it when one does."
}
[System.IO.File]::WriteAllText($rollbackFile, ($payload | ConvertTo-Json), (New-Object System.Text.UTF8Encoding($false)))
$acl = New-Object System.Security.AccessControl.FileSecurity
$acl.SetAccessRuleProtection($true, $false)
$acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule("SYSTEM", "FullControl", "Allow")))
$acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule("BUILTIN\Administrators", "Read", "Allow")))
Set-Acl -LiteralPath $rollbackFile -AclObject $acl
Write-Line ("rollback: wrote " + $rollbackFile + " (SYSTEM full control, local Administrators read)")

# 4. Only now is the plaintext removed, and the registry is re-read to prove it is gone. AutoAdminLogon is set
#    again afterwards because Windows clears it when it believes there is no stored password.
Remove-ItemProperty -Path $WinlogonKey -Name DefaultPassword -Force
$stillThere = Get-ItemProperty -Path $WinlogonKey -Name DefaultPassword -ErrorAction SilentlyContinue
if ($stillThere) {
  Write-Line "failed: the registry value is still readable after removal. The rollback copy and the secret are both in place, so run -Restore and treat this as unfinished rather than as done."
  exit 1
}
Set-ItemProperty -Path $WinlogonKey -Name AutoAdminLogon -Value "1"
Remove-ItemProperty -Path $WinlogonKey -Name AutoLogonCount -ErrorAction SilentlyContinue
$finalSecret = [LsaSecret]::Retrieve("DefaultPassword", [ref]$secretStatus)
$finalAuto = (Get-ItemProperty -Path $WinlogonKey).AutoAdminLogon
Write-Line ("hardened: registry DefaultPassword removed, LSA secret reads back " + $(if ($finalSecret) { $finalSecret.Length } else { 0 }) + " characters, AutoAdminLogon=" + $finalAuto + ". Nothing has rebooted and nothing in the running session changed; the next boot is the proof.")
if (-not $finalSecret) {
  Write-Line "warning: the secret did not read back on the final check, though it did after the store. Run -Restore before the host reboots."
  exit 1
}
exit 0


