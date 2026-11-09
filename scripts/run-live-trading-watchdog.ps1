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

  Lane identity is a path, not a process name. The terminal this task keeps alive is
  C:\Program Files\FTMO Global Markets MT5 Terminal\terminal64.exe and nothing else, because a second lane runs a
  second copy of the same terminal64.exe out of its own install folder. Counting processes by name made the two
  indistinguishable: with a second terminal up, a dead lane-1 terminal read as "ok terminal running", so the one
  thing this script exists to notice was the one thing it could no longer see. When a process carries the
  terminal's name but its executable path cannot be read - another user's process, a protected process, a race
  on exit - the script writes that down and takes no action at all: no startup task, no reboot. A missed
  recovery is a line in a log; a wrong reboot ends the session both lanes are trading in.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-live-trading-watchdog.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-live-trading-watchdog.ps1 -WhatIfAction
#>
param(
  # The terminal the lane reads. Its presence is the whole liveness question.
  [string] $TerminalProcess = "terminal64",
  # And this is the lane: the one executable that counts as alive. Two lanes run two copies of terminal64.exe, so
  # the name alone cannot answer the question; the path can. Empty means the lane's own identity is unknown, and
  # the run then reports instead of recovering.
  [string] $TerminalPath = "C:\Program Files\FTMO Global Markets MT5 Terminal\terminal64.exe",
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

# Every process carrying the terminal's name, each with the executable path when Windows will give it up. A path
# comes back $null rather than throwing when the process belongs to someone else, is protected, or exits between the
# enumeration and the read, so the caller can tell "not this lane" apart from "cannot say".
function Get-TerminalCandidate {
  param([string] $TerminalProcess)
  $found = @()
  foreach ($proc in @(Get-Process -Name $TerminalProcess -ErrorAction SilentlyContinue)) {
    $path = $null
    try { $path = $proc.Path } catch { $path = $null }
    if (-not $path) { $path = $null }
    $found += [pscustomobject]@{ Id = $proc.Id; SessionId = $proc.SessionId; Path = $path }
  }
  ,$found
}

# The liveness question, answered by path. running = one process whose executable is exactly the lane's terminal;
# unknown = none matches but a process carrying the name has a path that could not be read; missing = neither. The
# three are kept apart because the last two ask for opposite things: missing is what recovery exists for, unknown
# is the case where recovering could kill a lane that is fine.
function Resolve-TerminalLiveness {
  param([object[]] $Candidates = @(), [string] $TerminalPath)
  $wanted = ([string]$TerminalPath).Trim().TrimEnd('\')
  $matched = @()
  $others = @()
  $unreadable = @()
  foreach ($candidate in @($Candidates)) {
    if (-not $candidate) { continue }
    $path = [string]$candidate.Path
    if ($path -and $wanted -and [string]::Equals($path.TrimEnd('\'), $wanted, [System.StringComparison]::OrdinalIgnoreCase)) {
      $matched += $candidate
    } elseif (-not $path) {
      $unreadable += $candidate
    } else {
      $others += $candidate
    }
  }
  if ($matched.Count -gt 0) { $state = "running" }
  elseif ($unreadable.Count -gt 0) { $state = "unknown" }
  else { $state = "missing" }
  [pscustomobject]@{
    State = $state
    Wanted = $wanted
    Matched = @($matched)
    Others = @($others)
    Unreadable = @($unreadable)
  }
}

# What this run should do about it. Kept apart from the acting, and from the host, so all five answers can be read
# in a test: none, report-only, start-task, hold, reboot. Only the last two of those touch anything.
function Resolve-WatchdogDecision {
  param($Liveness, [int] $SignedOnCount, $LastRebootUtc, [int] $RebootCooldownMinutes, [datetime] $Now)
  if (-not $Liveness.Wanted) {
    return [pscustomobject]@{ Action = "report-only"; Reason = "no lane terminal path is configured, so there is nothing to compare the running terminals against" }
  }
  if ($Liveness.State -eq "running") {
    return [pscustomobject]@{ Action = "none"; Reason = "the lane's terminal is running" }
  }
  if ($Liveness.State -eq "unknown") {
    return [pscustomobject]@{ Action = "report-only"; Reason = "a process carrying the terminal's name is running but its executable path cannot be read, so whether the lane's terminal is alive cannot be said" }
  }
  if ($SignedOnCount -gt 0) {
    return [pscustomobject]@{ Action = "start-task"; Reason = "the lane's terminal is missing and a session is signed on to start it in" }
  }
  if ($LastRebootUtc -and (($Now - $LastRebootUtc).TotalMinutes -lt $RebootCooldownMinutes)) {
    return [pscustomobject]@{ Action = "hold"; Reason = "the lane's terminal is missing, nobody is signed on, and the reboot cooldown has not passed" }
  }
  return [pscustomobject]@{ Action = "reboot"; Reason = "the lane's terminal is missing and nobody is signed on, so only auto-logon can bring the session back" }
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

$liveness = Resolve-TerminalLiveness -Candidates @(Get-TerminalCandidate -TerminalProcess $TerminalProcess) -TerminalPath $TerminalPath
# Every line below names what else is running, because the reason this script reads paths is that two terminals exist.
# Capped, so a host full of same-named processes cannot turn one log line into a page.
$otherCount = @($liveness.Others).Count
$otherText = (@($liveness.Others) | Select-Object -First 4 | ForEach-Object { "pid=" + $_.Id + " " + $_.Path }) -join "; "
if ($otherCount -gt 4) { $otherText = $otherText + "; and " + ($otherCount - 4) + " more" }
$unreadableText = (@($liveness.Unreadable) | ForEach-Object { "pid=" + $_.Id }) -join ", "

if ($liveness.State -eq "running") {
  $here = $liveness.Matched[0]
  $elsewhere = ""
  if ($otherText) { $elsewhere = "; other terminals running: " + $otherText }
  Write-Line ("ok terminal running " + $TerminalPath + " pid=" + $here.Id + " session=" + $here.SessionId + $elsewhere)
  if ($SnapshotMinutes -gt 0 -and (Test-Path -LiteralPath $Snapshot)) {
    $age = [int]($now - (Get-Item -LiteralPath $Snapshot).LastWriteTimeUtc).TotalMinutes
    if ($age -ge $SnapshotMinutes) {
      Write-Line ("warn terminal running but the snapshot has not moved for " + $age + " minutes: " + $Snapshot)
    }
  }
  exit 0
}

# The lane's terminal is not running. What that costs depends on the session read at the top of the file, and on
# whether a process exists whose path could not be read - the one case where acting could end a lane that is fine.
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

$decision = Resolve-WatchdogDecision -Liveness $liveness -SignedOnCount $signedOn.Count -LastRebootUtc $lastReboot -RebootCooldownMinutes $RebootCooldownMinutes -Now $now

# Exactly two branches act, and neither is reachable from "unknown": the decision answers report-only there, because
# a startup task or a reboot on a wrong guess would end the session the other lane is trading in.
switch ($decision.Action) {
  "start-task" {
    Write-Line ("missing terminal, " + $signedOn.Count + " signed-on session(s); starting " + $StartupTask +
      $(if ($otherText) { "; other terminals running: " + $otherText } else { "" }))
    if (-not $WhatIfAction) {
      $null = & schtasks.exe /run /tn $StartupTask 2>&1
      $waited = 0
      while ($waited -lt $StartupGraceSeconds) {
        Start-Sleep -Seconds 5
        $waited += 5
        $back = Resolve-TerminalLiveness -Candidates @(Get-TerminalCandidate -TerminalProcess $TerminalProcess) -TerminalPath $TerminalPath
        if ($back.State -eq "running") {
          Write-Line ("recovered: terminal came back after " + $waited + " seconds")
          exit 0
        }
      }
      Write-Line ("startup task ran but no terminal at " + $TerminalPath + " appeared within " + $StartupGraceSeconds + " seconds")
    }
    exit 0
  }
  "reboot" {
    Write-Line ("missing terminal and no signed-on session; rebooting so auto-logon restores the desktop and " +
      $StartupTask + " starts the terminal")
    if ($WhatIfAction) { exit 0 }
    Set-Content -LiteralPath $RebootMarker -Value $now.ToString("o")
    & shutdown.exe /r /t 30 /f
    exit 0
  }
  "hold" {
    Write-Line ("missing terminal, nobody signed on; last watchdog reboot was " +
      [int]($now - $lastReboot).TotalMinutes + " minutes ago, holding until the cooldown passes")
    exit 0
  }
  "report-only" {
    $detail = $decision.Reason
    if ($unreadableText) { $detail = $detail + " (" + $unreadableText + " running as " + $TerminalProcess + ")" }
    if ($otherText) { $detail = $detail + " (readable terminals: " + $otherText + ")" }
    Write-Line ($detail + "; no startup task and no reboot")
    exit 0
  }
  default { exit 0 }
}

