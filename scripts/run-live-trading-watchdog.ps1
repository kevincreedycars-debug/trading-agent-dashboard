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

  It takes exactly two actions, and never a third:

    1. terminal missing, somebody signed on  -> start LiveTradingTerminalStartup and give it 45 seconds
    2. terminal missing, nobody signed on    -> reboot the host, so auto-logon restores the session

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

# The terminal is gone. Is there a session that could host another one?
$signedOn = @(quser 2>$null | Select-Object -Skip 1 | Where-Object { $_.Trim().Length -gt 0 })

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

