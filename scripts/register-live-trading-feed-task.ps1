<#
.SYNOPSIS
  Registers (or removes) the one Windows scheduled task that keeps the read-only Live Trading feed current.

.DESCRIPTION
  The runner in scripts/run-live-trading-feed.js is one process that attaches to the running, already-logged-in
  MT5 terminal, writes data/live-trading.json, validates it and appends one line to tmp/live-trading-feed.log.
  This script only puts that run on a five-minute clock, aligned to the M5 bar close, and hides its window.

  It schedules nothing but that run. There is no order path and no credential. By default it publishes nothing
  either: the artifact stays local and uncommitted until somebody decides to publish it. -Publish is that
  decision, and it is a separate, deliberate act rather than a default - it puts the artifact on the branch
  GitHub Pages serves, through scripts/publish-live-trading-feed.js, on the same five-minute clock. That
  publisher is the only step in this lane that writes to production, and it refuses rather than warns: an invalid
  or stale artifact, a copy that is not strictly newer than the one on the branch, or a publish inside the
  minimum interval all end the run with a failure the scheduler reports.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-live-trading-feed-task.ps1 -Show
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-live-trading-feed-task.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-live-trading-feed-task.ps1 -Publish
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-live-trading-feed-task.ps1 -Remove
#>
param(
  [string] $TaskName = "LiveTradingFeedTick019",
  [int] $IntervalMinutes = 5,
  [string] $RepoRoot = (Split-Path -Parent $PSScriptRoot),
  [string] $Terminal = "C:\Program Files\FTMO Global Markets MT5 Terminal",
  [string] $Node = $null,
  [string] $Python = $null,
  [string] $HiddenRunner = "C:\Users\A17\.trading-agent-dashboard\scripts\run-hidden.vbs",
  # The minimum seconds between two publishes, enforced by the publisher itself. 600 is six Pages builds an hour,
  # inside GitHub's documented soft limit of ten; the exact floor is 360, so this leaves deliberate headroom.
  [int] $PublishMinIntervalSeconds = 600,
  [switch] $Publish,
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
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Output "Removed scheduled task $TaskName. The snapshot on disk keeps the last run it wrote."
  return
}

$runner = Join-Path $RepoRoot "scripts\run-live-trading-feed.js"
$producer = Join-Path $RepoRoot "tools\mt5-bridge\live-trading-snapshot.py"
foreach ($required in @($runner, $producer)) {
  if (-not (Test-Path -LiteralPath $required)) { throw "Not found: $required" }
}

if (-not $Node) {
  $resolved = Get-Command node -ErrorAction SilentlyContinue
  if (-not $resolved) { throw "node is not on PATH; pass -Node <path>." }
  $Node = $resolved.Source
}
if (-not $Python) {
  $resolved = Get-Command python -ErrorAction SilentlyContinue
  if (-not $resolved) { throw "python is not on PATH; pass -Python <path>." }
  $Python = $resolved.Source
}

$outPath = Join-Path $RepoRoot "data\live-trading.json"
$logPath = Join-Path $RepoRoot "tmp\live-trading-feed.log"
$lockPath = Join-Path $RepoRoot "tmp\live-trading-feed.lock"
$wrapperPath = Join-Path $RepoRoot "tmp\live-trading-feed-run.cmd"
$terminalArgument = ""
if ($Terminal -and (Test-Path -LiteralPath $Terminal)) {
  $terminalArgument = " --terminal `"$Terminal`""
} else {
  Write-Output "Terminal path '$Terminal' is absent; the producer's own discovery will be used."
}

# The one flag that turns this cadence into a publisher, written only when it was asked for. The runner reads it
# as `--publish`; the interval is passed through so the cadence in the task and the cadence in the artifact's log
# cannot disagree.
$publishArgument = ""
if ($Publish) {
  $publishArgument = " --publish --publish-min-interval-seconds $PublishMinIntervalSeconds"
}

# The hidden launcher takes the command to run as one argument, and Task Scheduler doubles every quote inside an
# argument it stores. A command line carrying its own quotes therefore reaches run-hidden.vbs mangled: on
# 2026-10-04 the task's instance stayed alive four minutes, attached to no terminal and wrote nothing while every
# file in the repository looked correct. So the command the task passes is quote-free - `cmd.exe /c <wrapper>` -
# and every quote lives inside the wrapper, where cmd.exe's own rules apply.
function Write-Wrapper($path, $lines) {
  $directory = Split-Path -Parent $path
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  Set-Content -LiteralPath $path -Value $lines -Encoding ascii
  return $path
}

function Get-WrapperLines($extraFlags) {
  $command = "`"$Node`" `"$runner`" --once $extraFlags --quiet --python `"$Python`" " +
    "--out `"$outPath`" --log `"$logPath`" --lock `"$lockPath`"$terminalArgument"
  return @(
    "@echo off",
    "rem Generated by scripts/register-live-trading-feed-task.ps1. Machine specific; rewritten at each registration.",
    "rem The quotes belong here on purpose: the command line the task passes must not contain any.",
    "cd /d `"$RepoRoot`"",
    $command,
    "exit /b %ERRORLEVEL%"
  )
}

# The one place the hidden-launcher hop is spelled out, so the task and the self test cannot drift apart.
function Get-LauncherPair($wrapper) {
  if (Test-Path -LiteralPath $HiddenRunner) {
    # One quoted argument with no quotes inside it, which is the shape the Gold capture window's task has used for
    # weeks: Task Scheduler doubles embedded quotes, so a command line carrying its own arrives mangled.
    return "wscript.exe", "`"$HiddenRunner`" `"cmd.exe /c $wrapper`""
  }
  Write-Output "Hidden runner '$HiddenRunner' is absent; cmd.exe will be started directly and its window may flash."
  return "cmd.exe", "/c $wrapper"
}

# --align is the point of the task: each run sleeps to the next M5 close plus the settle window, so the grid the
# scheduler drifts on does not become the grid the candles are read on.
Write-Wrapper $wrapperPath (Get-WrapperLines "--align$publishArgument") | Out-Null
# The wrapper path must survive being handed to the hidden launcher unquoted, so it may not contain a space. The
# path is checked rather than the whole inner command, which legitimately contains the spaces in `cmd.exe /c`.
if ($wrapperPath -match " ") {
  throw "The wrapper path '$wrapperPath' contains a space, which the hidden launcher cannot be handed without " +
    "quoting it and reintroducing the doubled-quote fault. Move the repository to a path without spaces."
}
$launcher, $launcherArguments = Get-LauncherPair $wrapperPath
$innerCommand = "cmd.exe /c $wrapperPath"

$terminalLabel = "<producer discovery>"
if ($terminalArgument) { $terminalLabel = $Terminal }

# One line per fact, as text: a reader pastes this output into the handoff, and an object dump is not a fact.
function Write-Plan($dictionary) {
  foreach ($key in $dictionary.Keys) {
    $value = $dictionary[$key]
    if ($value -is [bool]) { $value = ([string]$value).ToLower() }
    Write-Output ("{0,-18} = {1}" -f $key, ([string]$value))
  }
}

$plan = [ordered]@{
  task_name          = $TaskName
  interval_minutes   = $IntervalMinutes
  repo_root          = $RepoRoot
  snapshot           = $outPath
  log                = $logPath
  lock               = $lockPath
  node               = $Node
  python             = $Python
  terminal           = $terminalLabel
  launcher           = $launcher
  inner_command      = $innerCommand
  wrapper            = $wrapperPath
  order_path         = "none"
  publishes_anything = [bool]$Publish
  publish_interval   = if ($Publish) { "$PublishMinIntervalSeconds seconds" } else { "none" }
}

if ($Show) {
  Write-Plan $plan
  return
}

# -Test proves the launcher, not the cadence: it registers a throwaway task with the same action and runtime, but a
# wrapper without --align, so the run happens within seconds instead of at the next bar close. It also proves the
# one hop this script cannot see from the code - Task Scheduler's argument escaping - by asking the scheduler to
# start the chain and watching the log for a new line.
if ($Test) {
  $selfTestName = "$TaskName-Selftest"
  $selfTestWrapper = Join-Path $RepoRoot "tmp\live-trading-feed-selftest.cmd"
  Write-Wrapper $selfTestWrapper (Get-WrapperLines "") | Out-Null
  $selfTestLauncher, $selfTestArguments = Get-LauncherPair $selfTestWrapper
  $selfTestAction = New-ScheduledTaskAction -Execute $selfTestLauncher -Argument $selfTestArguments
  $selfTestTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddSeconds(10)
  $selfTestSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
  if (Get-ScheduledTask -TaskName $selfTestName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $selfTestName -Confirm:$false
  }
  $before = if (Test-Path -LiteralPath $logPath) { @(Get-Content -LiteralPath $logPath).Count } else { 0 }
  Register-ScheduledTask -TaskName $selfTestName -Action $selfTestAction -Trigger $selfTestTrigger `
    -Settings $selfTestSettings -Description "Temporary launcher self test for the Live Trading feed cadence." | Out-Null
  Start-ScheduledTask -TaskName $selfTestName

  $deadline = (Get-Date).AddSeconds(60)
  $after = $before
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 3
    $after = if (Test-Path -LiteralPath $logPath) { @(Get-Content -LiteralPath $logPath).Count } else { 0 }
    if ($after -gt $before) { break }
  }
  $selfTestInfo = Get-ScheduledTaskInfo -TaskName $selfTestName
  $lastLine = if ($after -gt $before) { Get-Content -LiteralPath $logPath -Tail 1 } else { "" }
  Unregister-ScheduledTask -TaskName $selfTestName -Confirm:$false

  $verdict = "the launcher never reached the runner"
  if ($lastLine -like '*"status":"ok"*') { $verdict = "the launcher ran the runner and the snapshot validated" }
  elseif ($after -gt $before) { $verdict = "the launcher ran the runner, which reported: $lastLine" }

  Write-Output "self_test_task      = $selfTestName"
  Write-Output "self_test_command   = cmd.exe /c $selfTestWrapper"
  Write-Output "self_test_result    = $($selfTestInfo.LastTaskResult)"
  Write-Output ("self_test_log_lines = {0} before, {1} after" -f $before, $after)
  Write-Output "self_test_verdict   = $verdict"
  return
}

$action = New-ScheduledTaskAction -Execute $launcher -Argument $launcherArguments
# An interval with no duration is an indefinite repetition on this engine, which is what a cadence wants: the same
# shape the Gold capture window has been running for weeks, and a one-minute probe task on 2026-10-04 fired twice
# as registered. `-RepetitionDuration ([TimeSpan]::MaxValue)` is refused by the task XML here, and a bounded
# duration would silently stop the cadence when it expired.
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddSeconds(20) `
  -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)
# StartWhenAvailable picks the run back up after a reboot or a sleep, and IgnoreNew keeps a still-aligning run and
# the next repetition from attaching to the terminal together. The ten-minute limit covers the align wait.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
$description = "Read-only MT5 feed cadence for the Live Trading dashboard: one producer run per M5 bar, " +
  "validated, logged to tmp/live-trading-feed.log. No order path." +
  $(if ($Publish) { " Publishes the validated artifact to the branch Pages serves, at most once every " +
      "$PublishMinIntervalSeconds seconds, through scripts/publish-live-trading-feed.js." } else { " Publishes nothing." })

# Replace any earlier registration cleanly. `Register-ScheduledTask -Force` over a task whose run is still in
# flight left the scheduler reporting the task as running and quietly refusing every repetition (observed
# 2026-10-04), which reads as a cadence that stopped. Stop it, remove it, then register the new definition.
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
  if ($existing.State -eq "Running") { Stop-ScheduledTask -TaskName $TaskName }
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
  -Description $description | Out-Null

$task = Get-ScheduledTask -TaskName $TaskName
$plan["task_state"] = $task.State
$plan["registered_at"] = (Get-Date).ToString("o")

if (-not $NoStart) {
  Start-ScheduledTask -TaskName $TaskName
  Start-Sleep -Seconds 8
  $info = Get-ScheduledTaskInfo -TaskName $TaskName
  $plan["last_run_time"] = $info.LastRunTime.ToString("o")
  $plan["last_task_result"] = $info.LastTaskResult
  $plan["next_run_time"] = $info.NextRunTime.ToString("o")
  $plan["task_result_note"] = "267009 = still aligning; 2147946720 (0x800710E0) = refused because the previous run is still aligning"
  if (Test-Path -LiteralPath $logPath) {
    $plan["last_log_line"] = (Get-Content -LiteralPath $logPath -Tail 1)
  }
}

Write-Plan $plan
