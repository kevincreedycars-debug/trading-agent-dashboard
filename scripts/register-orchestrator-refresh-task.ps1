#Requires -Version 5.1
<#
.SYNOPSIS
  Registers (or removes) the Windows scheduled task that fires the daily orchestrator refresh on the host.

.DESCRIPTION
  scripts/trigger-orchestrator-refresh.ps1 is the daily slot: it calls the webhook the dashboard's Refresh button
  calls, waits for the run the flow records in data/workflow-status.json, and calls again when that run failed. This
  script is what puts it on the clock.

  It exists because the first version of that slot was an unversioned one-line POST at
  C:\live-trading\logs\trigger-refresh-0600.ps1 - a file in a log folder, outside the repository, with no read-back
  and no retry. On 2026-11-04 at 06:00 UTC it posted into a run that failed at the "USD Collector" step with a 502,
  and the day's Layer 1 direction stayed stale until a person pressed Refresh at 07:44:34Z. A daily run of the whole
  Layer 1 chain should not live in a log folder.

  The task runs as SYSTEM, not as the trading account, because it needs no desktop: it is an HTTP POST and a file
  read. A host that is up with nobody signed on still gets its morning run. StartWhenAvailable covers a host that
  was off, asleep or rebooting at 06:00, and IgnoreNew prevents a second copy while one slot is still polling.

  -Show writes nothing and prints the definition that would be registered. -Test runs the trigger with -WhatIf, so
  its decision is visible without calling the webhook and without spending a real orchestrator run. -Remove takes
  the task off the host and leaves the log in place.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-orchestrator-refresh-task.ps1 -Show
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-orchestrator-refresh-task.ps1 -Test
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-orchestrator-refresh-task.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-orchestrator-refresh-task.ps1 -Remove
#>
param(
  [string] $TaskName = "LiveTradingRefresh0600",
  [string] $At = "06:00",
  [string] $Trigger = "C:\live-trading\runtime\scripts\trigger-orchestrator-refresh.ps1",
  [string] $ControlPath = "C:\live-trading\runtime\data\workflow-control.json",
  [string] $Log = "C:\live-trading\logs\refresh-0600.log",
  [int] $MaxAttempts = 3,
  [int] $RetryDelaySeconds = 120,
  [int] $TimeoutSeconds = 900,
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

if (-not (Test-Path -LiteralPath $Trigger)) { throw "Not found: $Trigger" }

if ($Test) {
  Write-Output "trigger_path   = $Trigger"
  Write-Output "control_path   = $ControlPath"
  Write-Output "--- one pass with -WhatIf (posts nothing, waits on nothing)"
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Trigger -ControlPath $ControlPath -WhatIf
  return

$arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Trigger`"" +
  " -ControlPath `"$ControlPath`" -Log `"$Log`"" +
  " -MaxAttempts $MaxAttempts -RetryDelaySeconds $RetryDelaySeconds -TimeoutSeconds $TimeoutSeconds"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments
# SYSTEM: the slot is an HTTP POST and a file read, so it must not depend on a session being signed on.
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
# $At is in the host's clock, and the host is set to UTC (VPS_BUILD_RUNBOOK.md, step 5), so this is 06:00 UTC and
# needs no daylight-saving maintenance of its own.
$daily = New-ScheduledTaskTrigger -Daily -At $At
# The wait per attempt plus the pause between attempts, with room to spare: three attempts of 900 s and 120 s come
# to about 51 minutes, and a task killed at the limit would be a slot that never recorded an outcome.
$limitMinutes = [int](($MaxAttempts * ($TimeoutSeconds + $RetryDelaySeconds)) / 60) + 10
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes $limitMinutes)
$description = "Daily orchestrator refresh: at $At (host clock, UTC), POST data/workflow-control.json's webhook, " +
  "wait for data/workflow-status.json to record the run, and retry up to $MaxAttempts times when it reports " +
  "failed. Holds no token or key, touches no order, position or credential, and appends one JSON line per attempt " +
  "to $Log."

if ($Show) {
  Write-Output "task_name      = $TaskName"
  Write-Output "trigger        = $Trigger"
  Write-Output "control        = $ControlPath"
  Write-Output "principal      = SYSTEM / ServiceAccount / Highest"
  Write-Output "when           = daily at $At (host clock; UTC on this host)"
  Write-Output "attempts       = $MaxAttempts, $RetryDelaySeconds s apart, $TimeoutSeconds s wait each"
  Write-Output "settings       = StartWhenAvailable, IgnoreNew, $limitMinutes minute limit"
  Write-Output "log            = $Log"
  Write-Output "state          = $((Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue).State)"
  return
}

# Replace any earlier registration cleanly: -Force over a task whose run is in flight leaves the scheduler
# reporting it as running and refusing every repetition, which reads as a slot that stopped.
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
  if ($existing.State -eq "Running") { Stop-ScheduledTask -TaskName $TaskName }
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $daily `
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

}
