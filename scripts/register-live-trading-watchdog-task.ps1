#Requires -Version 5.1
<#
.SYNOPSIS
  Registers (or removes) the Windows scheduled task that keeps the Live Trading lane alive on the host.

.DESCRIPTION
  scripts/run-live-trading-watchdog.ps1 is a ten-minute liveness check on one process, the MT5 terminal that
  every other task on this host reads. This script is what puts it on that clock, and it runs it as SYSTEM
  rather than as the trading account, because its whole purpose is the case where the trading account is not
  signed on: a machine that has just rebooted and is waiting for auto-logon, or one where the remote session
  was signed out instead of disconnected.

  What it does not do: it registers no order path, holds no credential, and reads no artifact beyond the age
  of the feed snapshot. The task it registers starts a task or reboots a host, and writes one line per run.

  -Show writes nothing at all and prints the definition that would be registered. -Test runs the watchdog
  itself with -WhatIfAction, so its verdict is visible without starting a task or rebooting anything. -Remove
  takes the task off the host and leaves the log in place.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-live-trading-watchdog-task.ps1 -Show
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-live-trading-watchdog-task.ps1 -Test
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-live-trading-watchdog-task.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-live-trading-watchdog-task.ps1 -Remove
#>
param(
  [string] $TaskName = "LiveTradingWatchdog",
  [int] $IntervalMinutes = 10,
  [string] $Watchdog = "C:\live-trading\logs\run-live-trading-watchdog.ps1",
  [string] $Log = "C:\live-trading\logs\live-trading-watchdog.log",
  [switch] $NoStart,
  [switch] $Remove,
  [switch] $Show,
  [switch] $Test
)

$ErrorActionPreference = "Stop"

if ($Remove) {
  $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if (-not $existing) {
    Write-Output "No task named $TaskName; nothing to remove."
    return
  }
  if ($existing.State -eq "Running") { Stop-ScheduledTask -TaskName $TaskName }
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Output "Removed scheduled task $TaskName. $Log keeps every line it wrote."
  return
}

if (-not (Test-Path -LiteralPath $Watchdog)) { throw "Not found: $Watchdog" }

if ($Test) {
  Write-Output "watchdog_path = $Watchdog"
  Write-Output "--- one pass with -WhatIfAction (starts nothing, reboots nothing)"
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Watchdog -WhatIfAction
  return
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument ("-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"" + $Watchdog + "`"")
# SYSTEM, not the trading account: the case this exists for is a host with nobody signed on at all.
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
# Both shapes are wanted. AtStartup covers the boot itself; the repeating trigger covers a terminal that dies
# while the host stays up. An interval with no duration is an indefinite repetition on this engine, the same
# shape the feed and trader cadences use, and a bounded duration would quietly stop the checks when it expired.
$atStartup = New-ScheduledTaskTrigger -AtStartup
$repeating = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) `
  -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
$description = "Live Trading watchdog: every $IntervalMinutes minutes, is the MT5 terminal still running? " +
  "If a session exists it starts LiveTradingTerminalStartup; if none does it reboots the host so auto-logon " +
  "restores the desktop. Runs as SYSTEM, touches no order, position or credential, and logs one line per run " +
  "to $Log."

if ($Show) {
  Write-Output "task_name      = $TaskName"
  Write-Output "watchdog       = $Watchdog"
  Write-Output "principal      = SYSTEM / ServiceAccount / Highest"
  Write-Output "triggers       = at startup, and every $IntervalMinutes minutes indefinitely"
  Write-Output "settings       = StartWhenAvailable, IgnoreNew, 5 minute limit"
  Write-Output "log            = $Log"
  Write-Output "state          = $((Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue).State)"
  return
}

# Replace any earlier registration cleanly: -Force over a task whose run is in flight leaves the scheduler
# reporting it as running and quietly refusing every repetition, which reads as a watchdog that stopped.
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
  if ($existing.State -eq "Running") { Stop-ScheduledTask -TaskName $TaskName }
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger @($atStartup, $repeating) `
  -Principal $principal -Settings $settings -Description $description | Out-Null

$task = Get-ScheduledTask -TaskName $TaskName
Write-Output "task_name      = $TaskName"
Write-Output "task_state     = $($task.State)"
Write-Output "registered_at  = $((Get-Date).ToUniversalTime().ToString("o"))"

if (-not $NoStart) {
  Start-ScheduledTask -TaskName $TaskName
  Start-Sleep -Seconds 10
  $info = Get-ScheduledTaskInfo -TaskName $TaskName
  Write-Output "last_run_time  = $($info.LastRunTime.ToUniversalTime().ToString("o"))"
  Write-Output "next_run_time  = $($info.NextRunTime.ToUniversalTime().ToString("o"))"
  Write-Output "last_result    = $($info.LastTaskResult)"
  if (Test-Path -LiteralPath $Log) {
    Write-Output "last_log_line  = $((Get-Content -LiteralPath $Log -Tail 1))"
  }
}
