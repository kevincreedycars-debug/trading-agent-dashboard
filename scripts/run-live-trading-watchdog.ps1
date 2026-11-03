#Requires -Version 5.1
<#
.SYNOPSIS
  Keeps the Live Trading lane alive on the host with nobody at the keyboard.

.DESCRIPTION
  run-live-trading-watchdog.ps1 is the host's own answer to one question: is the MT5 terminal still there?
  Everything else on the host - the feed cadence, the trader loop and the lanes publisher - is a Windows
  scheduled task that runs as Administrator with the Interactive logon type, because the terminal they all
  read is a GUI application and a GUI needs a desktop session. That works unattended only for as long as a
  session exists:

    * a disconnected Remote Desktop window keeps its session, so the lane keeps running (this host inherited
      MaxDisconnectionTime 0 and MaxIdleTime 0 from the default RDP-Tcp settings, so a disconnected session
      never expires);
    * signing out ends the session, and with it the terminal and every Interactive task in it.

  AutoAdminLogon is on, so a reboot brings the console session back by itself and the logon trigger starts the
  terminal again. This watchdog is what turns that from something the operator has to notice into something
  the host does on its own: a lane with no terminal looks exactly like a quiet market from the dashboard.

  It takes exactly three actions, and never a fourth:

    1. terminal missing, somebody signed on  -> start LiveTradingTerminalStartup and give it 45 seconds
    2. terminal missing, nobody signed on    -> reboot the host, so auto-logon restores the session
    3. auto-logon hardening, if it was applied, and a boot after it produced no session -> put the plaintext
       auto-logon password back from the rollback copy and reboot, so the next boot logs in the old way

  Action 3 is the net under scripts\harden-live-trading-autologon.ps1. That script moves the password out of the
  registry and into the LSA secret Winlogon reads, and leaves a rollback copy under state\ because the only proof
  the secret works is a boot that comes after it. One boot that produces a console session is that proof, and
  this task deletes the rollback copy when it sees one. A boot that produces none is the failure the copy exists
  for: restoring it costs one extra reboot and needs nobody at the keyboard, which is the only kind of recovery
  this host has. With no rollback copy present, action 3 never runs and this task behaves exactly as before.

  It never touches the account: no order, no position, no terminal config, no credential. It is a liveness
  check on one process, and it writes one line per run to logs\live-trading-watchdog.log whichever way it
  goes, including the runs where it decided to do nothing.

  A reboot is attempted at most once every 30 minutes, recorded in logs\live-trading-watchdog-last-reboot.txt,
  so a machine whose auto-logon is broken cannot be pushed into a tight reboot loop by this script.

  It also logs a warning when the terminal is running but the feed snapshot has not moved for 30 minutes. That
  is a report, not an intervention: the feed's own stale guards and the trader's own guards already refuse to
  act on a stale snapshot, and starting a second producer would be a worse answer than a line in a log.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-live-trading-watchdog.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-live-trading-watchdog.ps1 -WhatIfAction
#>
param(
  # The terminal the lane reads. Its presence is the whole liveness question.
  [string] $TerminalProcess = "terminal64",
  [string] $StartupTask = "LiveTradingTerminalStartup",
  # The snapshot whose age is reported. -SnapshotMinutes 0 disables the report and changes nothing else.
  [string] $Snapshot = "C:\live-trading\runtime\data\live-trading.json",
  [int] $SnapshotMinutes = 30,
  [string] $Log = "C:\live-trading\logs\live-trading-watchdog.log",
  [string] $RebootMarker = "C:\live-trading\logs\live-trading-watchdog-last-reboot.txt",
  # How long the startup task is given to bring the terminal back before the log says it did not.
  [int] $StartupGraceSeconds = 45,
  [int] $RebootCooldownMinutes = 30,
  # The rollback copy the auto-logon hardening leaves behind, and the script that can put the plaintext back.
  [string] $RollbackFile = "C:\live-trading\state\autologon-rollback.json",
  [string] $HardenScript = "",
  # Say what this run would do without starting a task or rebooting the host.
  [switch] $WhatIfAction
)

$ErrorActionPreference = "Stop"
$now = (Get-Date).ToUniversalTime()

function Write-Line {
  param([string] $Text)
  $line = $now.ToString("o") + " " + $Text
  $dir = Split-Path -Parent $Log
  if ($dir -and -not (Test-Path -LiteralPath $dir)) { $null = New-Item -ItemType Directory -Path $dir -Force }
  Add-Content -LiteralPath $Log -Value $line
  Write-Output $line
}

# One signed-on session answers two questions: can another terminal be started in it, and did auto-logon work at
# the last boot. It is read once, here, so both answers come from the same look at the host.
$signedOn = @(quser 2>$null | Select-Object -Skip 1 | Where-Object { $_.Trim().Length -gt 0 })

if (-not $HardenScript) { $HardenScript = Join-Path $PSScriptRoot "harden-live-trading-autologon.ps1" }

# The auto-logon hardening lifecycle, described in scripts\harden-live-trading-autologon.ps1: that script leaves a
# rollback copy behind, because the only proof the LSA secret works is a boot that comes after the hardening. One
# boot that produces a console session is that proof, and it retires the copy. One that produces none means the
# secret did not log the account in, and the plaintext goes back before the next reboot, which then logs in the
# old way. With no copy present - the state before any hardening, and after it is proven - none of this runs.
if (Test-Path -LiteralPath $RollbackFile) {
  $hardenedAt = $null
  $bootTime = $null
  try {
    $copy = Get-Content -LiteralPath $RollbackFile -Raw | ConvertFrom-Json
    $parsed = [datetime]::MinValue
    if ([datetime]::TryParse([string]$copy.hardened_at_utc, [System.Globalization.CultureInfo]::InvariantCulture,
        [System.Globalization.DateTimeStyles]::RoundtripKind, [ref]$parsed)) {
      $hardenedAt = $parsed.ToUniversalTime()
    }
  } catch {
    $hardenedAt = $null
  }
  try {
    $bootTime = (Get-CimInstance Win32_OperatingSystem -ErrorAction Stop).LastBootUpTime.ToUniversalTime()
  } catch {
    $bootTime = $null
  }

  if (-not $hardenedAt -or -not $bootTime) {
    Write-Line ("auto-logon: a rollback copy is present but " + $(if ($hardenedAt) { "the boot time" } else { "the hardening time" }) +
      " could not be read; leaving it alone, and rebooting nothing on its account")
  } elseif ($bootTime -le $hardenedAt) {
    Write-Line ("auto-logon: hardened at " + $hardenedAt.ToString("o") + ", no boot since; the rollback copy stays until one comes and proves the secret")
  } elseif ($signedOn.Count -gt 0) {
    Write-Line ("auto-logon: the boot at " + $bootTime.ToString("o") + " came after the hardening and produced a console session, so the LSA secret logs this host in; retiring the rollback copy")
    if (-not $WhatIfAction) { Remove-Item -LiteralPath $RollbackFile -Force }
  } else {
    Write-Line ("auto-logon: the boot at " + $bootTime.ToString("o") + " came after the hardening and produced no session, so the LSA secret did not log the account in; restoring the plaintext password and rebooting")
    if (-not $WhatIfAction) {
      if (-not (Test-Path -LiteralPath $HardenScript)) {
        Write-Line ("auto-logon: cannot restore - " + $HardenScript + " is not there. Not rebooting, because a reboot with no session would only repeat this; the rollback copy is intact for a manual restore")
        exit 1
      }
      $restoreOutput = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $HardenScript -Restore 2>&1
      Write-Line ("auto-logon: restore said: " + (@($restoreOutput) | Select-Object -Last 1))
      if (-not (Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon").DefaultPassword) {
        Write-Line "auto-logon: the registry still carries no DefaultPassword after the restore attempt, so a reboot would not log in either. Not rebooting; this one needs the operator"
        exit 1
      }
      Remove-Item -LiteralPath $RollbackFile -Force
      Write-Line "auto-logon: plaintext restored and the rollback copy retired; the next boot logs in the way it did before the hardening"
    }
  }
}

$terminal = @(Get-Process -Name $TerminalProcess -ErrorAction SilentlyContinue)
if ($terminal.Count -gt 0) {
  $where = ($terminal | ForEach-Object { "pid=" + $_.Id + " session=" + $_.SessionId }) -join " "
  Write-Line ("ok terminal running " + $where)
  if ($SnapshotMinutes -gt 0 -and (Test-Path -LiteralPath $Snapshot)) {
    $age = [int]($now - (Get-Item -LiteralPath $Snapshot).LastWriteTimeUtc).TotalMinutes
    if ($age -ge $SnapshotMinutes) {
      Write-Line ("warn terminal running but the snapshot has not moved for " + $age + " minutes: " + $Snapshot)
    }
  }
  exit 0
}

# The terminal is gone. The session read at the top is the answer to whether another could be started.
if ($signedOn.Count -gt 0) {
  Write-Line ("missing terminal, " + $signedOn.Count + " signed-on session(s); starting " + $StartupTask)
  if (-not $WhatIfAction) {
    $null = & schtasks.exe /run /tn $StartupTask 2>&1
    $waited = 0
    while ($waited -lt $StartupGraceSeconds) {
      Start-Sleep -Seconds 5
      $waited += 5
      if (@(Get-Process -Name $TerminalProcess -ErrorAction SilentlyContinue).Count -gt 0) {
        Write-Line ("recovered: terminal came back after " + $waited + " seconds")
        exit 0
      }
    }
    Write-Line ("startup task ran but no terminal appeared within " + $StartupGraceSeconds + " seconds")
  }
}

$lastReboot = $null
if (Test-Path -LiteralPath $RebootMarker) {
  $text = (Get-Content -LiteralPath $RebootMarker -Raw)
  if ($text) { $text = $text.Trim() }
  if ($text) {
    $parsed = [datetime]::MinValue
    if ([datetime]::TryParse($text, [System.Globalization.CultureInfo]::InvariantCulture,
        [System.Globalization.DateTimeStyles]::RoundtripKind, [ref]$parsed)) {
      $lastReboot = $parsed.ToUniversalTime()
    }
  }
}
if ($lastReboot -and ($now - $lastReboot).TotalMinutes -lt $RebootCooldownMinutes) {
  Write-Line ("missing terminal, nobody signed on; last watchdog reboot was " +
    [int]($now - $lastReboot).TotalMinutes + " minutes ago, holding until the cooldown passes")
  exit 0
}

Write-Line ("missing terminal and no signed-on session; rebooting so auto-logon restores the desktop and " +
  $StartupTask + " starts the terminal")
if ($WhatIfAction) { exit 0 }
Set-Content -LiteralPath $RebootMarker -Value $now.ToString("o")
& shutdown.exe /r /t 30 /f
exit 0

