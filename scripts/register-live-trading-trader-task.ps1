<#
.SYNOPSIS
  Registers (or removes) the one Windows scheduled task that runs the Live Trading trader loop.

.DESCRIPTION
  scripts/run-live-trading-trader.js is the loop that asks the L2L rule for every pair the feed publishes and
  places the ticket a confirmed row states, through tools/mt5-bridge/live-trading-order.py - the one file in
  this repository that can send. This script puts that loop on the same five-minute clock as the feed, later
  in the bar than the feed's own run, and hides its window.

  Nothing is placed unless -Arm is passed. The loop gates every send behind --confirm-live, the same word the
  order tool itself gates on, so an unarmed registration is a cadence that reads the artifacts, reads the
  terminal and writes down the ticket it would have left, and sends nothing whatever.

  The loop reads its own artifacts by path and resolves the published checkout the same way the feed
  publisher does, so no path here has to name them: the calls and the ladder come from the published tree,
  the bars from this machine's own snapshot.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-live-trading-trader-task.ps1 -Show
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-live-trading-trader-task.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-live-trading-trader-task.ps1 -Arm
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-live-trading-trader-task.ps1 -Remove
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-live-trading-trader-task.ps1 -Arm -Test
#>
param(
  [string] $TaskName = "LiveTradingTraderTick019",
  [int] $IntervalMinutes = 5,
  [string] $RepoRoot = (Split-Path -Parent $PSScriptRoot),
  [string] $Terminal = "C:\Program Files\FTMO Global Markets MT5 Terminal",
  [string] $Node = $null,
  [string] $Python = $null,
  [string] $HiddenRunner = "C:\Users\A17\.trading-agent-dashboard\scripts\run-hidden.vbs",
  # How long a placed limit stays working, and the two caps the loop keeps on itself. They are written into the
  # task so the cadence in the scheduler and the numbers in the loop's own log cannot disagree.
  #
  # 0 is the rule's own answer and the default: the L2L entry carries no expiry, because the user ruled it on
  # 2026-10-05 - the levels are permanent and deactivate only on their take-profit being taken or the day's call
  # changing direction, and the loop removes the resting limit on those two readings. A positive number is this
  # lane's own hand cap, added deliberately.
  [int] $ExpireMinutes = 0,
  # 0 is the rule's own answer and the default, for the same reason the expiry is: the user restated the hold on
  # 2026-10-06 as "each asset can have only one pending order running at a time", so how many pairs may be working
  # at once is the rule's own one-ticket-per-pair and this loop adds no cap of its own across pairs. A positive
  # number is this lane's own hand cap, added deliberately, and it is written into the task only when it is asked
  # for - the way --expire-minutes is - so the cadence in the scheduler and the loop's own log cannot disagree.
  [int] $MaxOpen = 0,
  [int] $MaxPerDay = 4,
  # One task per lane, running the snapshot producer and then this loop inside the same scheduled run. That is
  # what removes the ordering assumption the two separate tasks carried: the loop can never start before the
  # snapshot that carries the bar it reads, because the producer's own run has to finish first, and a producer
  # that fails stops the run instead of handing the loop an older snapshot. The 90-second settle the rule states
  # belongs to the producer's --align in this shape, so the loop is not asked to align again on top of it.
  [switch] $ChainFeed,
  [int] $FeedSettleSeconds = 90,
  [int] $FeedIntervalSeconds = 300,
  # The lane this checkout trades, exactly as config/live-trading-lanes.json names it. An ask from the page now
  # names the account it was asked on, and a loop without a lane cannot claim one, so the task has to carry the
  # id. Empty means "work it out from the lanes file's root for this checkout", which is one lane by construction
  # and refuses rather than guessing when it is not.
  [string] $Lane = "",
  [switch] $Arm,
  [switch] $NoStart,
  [switch] $Remove,
  [switch] $Show,
  [switch] $Test
)

$ErrorActionPreference = "Stop"

if ($ExpireMinutes -lt 0) {
  throw "-ExpireMinutes must be 0 (the rule's own answer: no expiry) or a positive number of minutes."
}

if ($MaxOpen -lt 0) {
  throw "-MaxOpen must be 0 (the rule's own answer: one ticket per pair, no cap across pairs) or a positive number."
}

if ($Remove) {
  $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if (-not $existing) {
    Write-Output "No task named $TaskName; nothing to remove."
    return
  }
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Output "Removed scheduled task $TaskName. Any ticket it already left stays with the broker."
  return
}

$runner = Join-Path $RepoRoot "scripts\run-live-trading-trader.js"
$orderTool = Join-Path $RepoRoot "tools\mt5-bridge\live-trading-order.py"
$feedRunner = Join-Path $RepoRoot "scripts\run-live-trading-feed.js"
$producer = Join-Path $RepoRoot "tools\mt5-bridge\live-trading-snapshot.py"
$required = @($runner, $orderTool)
if ($ChainFeed) { $required += @($feedRunner, $producer) }
foreach ($requiredPath in $required) {
  if (-not (Test-Path -LiteralPath $requiredPath)) { throw "Not found: $requiredPath" }
}
if ($FeedSettleSeconds -lt 0 -or $FeedSettleSeconds -ge $FeedIntervalSeconds) {
  throw "-FeedSettleSeconds must be 0 or more and smaller than -FeedIntervalSeconds, or the chained cadence chases itself."
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

$logPath = Join-Path $RepoRoot "tmp\live-trading-trader.log"
$lockPath = Join-Path $RepoRoot "tmp\live-trading-trader.lock"
$statePath = Join-Path $RepoRoot "tmp\live-trading-trader-state.json"
$journalPath = Join-Path $RepoRoot "tmp\live-trading-orders.log"
# The producer's own paths, used only when -ChainFeed asks for it. They stay the artifact's own defaults so the
# snapshot this loop reads is the same file the feed cadence writes and the dashboard publishes.
$feedOutPath = Join-Path $RepoRoot "data\live-trading.json"
$feedLogPath = Join-Path $RepoRoot "tmp\live-trading-feed.log"
$feedLockPath = Join-Path $RepoRoot "tmp\live-trading-feed.lock"
$wrapperPath = Join-Path $RepoRoot "tmp\live-trading-trader-run.cmd"
$terminalArgument = ""
if ($Terminal -and (Test-Path -LiteralPath $Terminal)) {
  $terminalArgument = " --terminal `"$Terminal`""
} else {
  Write-Output "Terminal path '$Terminal' is absent; the order tool's own discovery will be used."
}

# The one flag that turns a reading into a placing, written only when it was asked for. Without it the loop
# still reads everything and writes down the ticket it would have left - and sends nothing.
$armArgument = ""
if ($Arm) { $armArgument = " --confirm-live" }

# The lane the task carries. A loop that was not told its lane cannot claim a close request, because every ask
# now names the account it was asked on; so the id is resolved here, from the lanes file's own root for this
# checkout, and a registration that cannot resolve exactly one lane stops rather than registering a loop that
# would refuse every ask.
$laneId = $Lane.Trim()
if (-not $laneId) {
  $lanesConfig = Join-Path $RepoRoot "config\live-trading-lanes.json"
  if (-not (Test-Path -LiteralPath $lanesConfig)) {
    throw "Not found: $lanesConfig. Pass -Lane <id> if this checkout has no lanes file."
  }
  try {
    $lanes = (Get-Content -LiteralPath $lanesConfig -Raw | ConvertFrom-Json).lanes
  } catch {
    throw "The lanes file $lanesConfig could not be read: $($_.Exception.Message)"
  }
  $resolvedRoot = (Resolve-Path -LiteralPath $RepoRoot).Path.TrimEnd('\')
  $matches = @($lanes | Where-Object {
    $candidate = Join-Path $RepoRoot ($_.root)
    $resolved = Resolve-Path -LiteralPath $candidate -ErrorAction SilentlyContinue
    $resolved -and $resolved.Path.TrimEnd('\') -eq $resolvedRoot
  })
  if ($matches.Count -eq 1) {
    $laneId = [string]$matches[0].id
  } elseif ($matches.Count -eq 0) {
    throw "No lane in $lanesConfig has this checkout ($resolvedRoot) as its root. Pass -Lane <id> explicitly."
  } else {
    throw ("More than one lane in $lanesConfig has this checkout as its root (" +
      (($matches | ForEach-Object { $_.id }) -join ", ") + "). Pass -Lane <id> explicitly.")
  }
}
if (-not $laneId) { throw "The lane id resolved to nothing; pass -Lane <id>." }
$laneArgument = " --lane `"$laneId`" "


# The hidden launcher takes the command to run as one argument, and Task Scheduler doubles every quote inside
# an argument it stores, so the command the task passes is quote-free - `cmd.exe /c <wrapper>` - and every
# quote lives inside the wrapper, where cmd.exe's own rules apply.
function Write-Wrapper($path, $lines) {
  $directory = Split-Path -Parent $path
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  Set-Content -LiteralPath $path -Value $lines -Encoding ascii
  return $path
}

function Get-WrapperLines($extraFlags) {
  # The rule's entry carries no expiry, and the hold that decides how many pairs may be working at once is the
  # rule's own one ticket per pair, so both flags are written into the task only when a registration asked for one
  # deliberately: 0 means the rule's own answer in each case, and the loop removes a limit whose reason has gone
  # instead of letting one run out or holding a second pair's ticket back.
  $expireArgument = ""
  if ($ExpireMinutes -gt 0) { $expireArgument = "--expire-minutes $ExpireMinutes " }
  $maxOpenArgument = ""
  if ($MaxOpen -gt 0) { $maxOpenArgument = "--max-open $MaxOpen " }
  $command = "`"$Node`" `"$runner`" --once $extraFlags --quiet --python `"$Python`" " +
    "--state `"$statePath`" --log `"$logPath`" --lock `"$lockPath`" --journal `"$journalPath`" " +
    "${laneArgument}${expireArgument}${maxOpenArgument}--max-per-day $MaxPerDay$terminalArgument"
  $lines = @(
    "@echo off",
    "rem Generated by scripts/register-live-trading-trader-task.ps1. Machine specific; rewritten at each registration.",
    "rem The quotes belong here on purpose: the command line the task passes must not contain any.",
    "cd /d `"$RepoRoot`""
  )
  if ($ChainFeed) {
    # The snapshot first, in this same process tree, and the loop only if it succeeded: a producer that could not
    # write a fresh snapshot leaves the loop reading an older one, so the run stops and the scheduler reports it
    # rather than trading on what the last good run saw. `--align` sits here, so the run starts at the bar close
    # plus -FeedSettleSeconds, the 90 seconds the rule states.
    $lines += "`"$Node`" `"$feedRunner`" --once --align --interval-seconds $FeedIntervalSeconds --settle-seconds $FeedSettleSeconds --quiet --python `"$Python`" " +
      "--out `"$feedOutPath`" --log `"$feedLogPath`" --lock `"$feedLockPath`"$terminalArgument"
    $lines += "if errorlevel 1 exit /b %ERRORLEVEL%"
  }
  $lines += $command
  $lines += "exit /b %ERRORLEVEL%"
  return $lines
}

# The one place the hidden-launcher hop is spelled out, so the task and the self test cannot drift apart.
function Get-LauncherPair($wrapper) {
  if (Test-Path -LiteralPath $HiddenRunner) {
    return "wscript.exe", "`"$HiddenRunner`" `"cmd.exe /c $wrapper`""
  }
  Write-Output "Hidden runner '$HiddenRunner' is absent; cmd.exe will be started directly and its window may flash."
  return "cmd.exe", "/c $wrapper"
}

# --align is the point of the task, and the settle window is later here than the feed's own twenty seconds:
# the producer samples the bar close first, publishes it, and this loop then reads what it wrote. In the chained
# shape the producer does that aligning itself at -FeedSettleSeconds, so the loop starts the moment the snapshot
# has been written and is not asked to wait for the following bar.
$alignArgument = if ($ChainFeed) { $armArgument } else { "--align --settle-seconds 90$armArgument" }
Write-Wrapper $wrapperPath (Get-WrapperLines $alignArgument) | Out-Null
if ($wrapperPath -match " ") {
  throw "The wrapper path '$wrapperPath' contains a space, which the hidden launcher cannot be handed without " +
    "quoting it and reintroducing the doubled-quote fault. Move the repository to a path without spaces."
}
$launcher, $launcherArguments = Get-LauncherPair $wrapperPath
$innerCommand = "cmd.exe /c $wrapperPath"

$terminalLabel = "<terminal discovery>"
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
  lane               = $laneId
  log                = $logPath
  lock               = $lockPath
  state              = $statePath
  journal            = $journalPath
  node               = $Node
  python             = $Python
  terminal           = $terminalLabel
  launcher           = $launcher
  inner_command      = $innerCommand
  wrapper            = $wrapperPath
  order_path         = "tools/mt5-bridge/live-trading-order.py, one pending limit per confirmed row"
  armed              = [bool]$Arm
  chain_feed         = [bool]$ChainFeed
  feed_snapshot      = $(if ($ChainFeed) { $feedOutPath } else { "separate task (not chained)" })
  feed_log           = $(if ($ChainFeed) { $feedLogPath } else { "separate task (not chained)" })
  feed_settle_seconds = $(if ($ChainFeed) { $FeedSettleSeconds } else { "separate task (not chained)" })
  expire_minutes     = $(if ($ExpireMinutes -gt 0) { $ExpireMinutes } else { "none (the entry stands until its reason is gone)" })
  max_open           = $(if ($MaxOpen -gt 0) { $MaxOpen } else { "none (the rule's own one ticket per pair)" })
  max_per_day        = $MaxPerDay
}

if ($Show) {
  Write-Plan $plan
  return
}

# -Test proves the launcher, not the cadence: a throwaway task with the same action and runtime, a wrapper
# without --align so the run happens within seconds, and the log watched for a new line. It is registered
# with the same -Arm decision, so a test of an unarmed registration places nothing.
if ($Test) {
  $selfTestName = "$TaskName-Selftest"
  $selfTestWrapper = Join-Path $RepoRoot "tmp\live-trading-trader-selftest.cmd"
  Write-Wrapper $selfTestWrapper (Get-WrapperLines $armArgument.Trim()) | Out-Null
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
    -Settings $selfTestSettings -Description "Temporary launcher self test for the Live Trading trader loop." | Out-Null
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

  $verdict = "the launcher never reached the loop"
  if ($lastLine -like '*"status":"placed"*') { $verdict = "the launcher ran the loop and a ticket was placed" }
  elseif ($lastLine -like '*"status":"nothing_to_place"*') { $verdict = "the launcher ran the loop, which found nothing confirmed" }
  elseif ($lastLine -like '*"status":"planned"*') { $verdict = "the launcher ran the loop unarmed, which placed nothing" }
  elseif ($after -gt $before) { $verdict = "the launcher ran the loop, which reported: $lastLine" }

  Write-Output "self_test_task      = $selfTestName"
  Write-Output "self_test_command   = cmd.exe /c $selfTestWrapper"
  Write-Output "self_test_result    = $($selfTestInfo.LastTaskResult)"
  Write-Output ("self_test_log_lines = {0} before, {1} after" -f $before, $after)
  Write-Output "self_test_verdict   = $verdict"
  return
}

$action = New-ScheduledTaskAction -Execute $launcher -Argument $launcherArguments
# An interval with no duration is an indefinite repetition on this engine, which is what a cadence wants. A
# bounded duration would silently stop the loop when it expired.
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddSeconds(20) `
  -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)
# StartWhenAvailable picks the run back up after a reboot or a sleep, and IgnoreNew keeps a still-aligning run
# and the next repetition from reading the terminal together. The ten-minute limit covers the align wait.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
$description = "Live Trading trader loop: one run per M5 bar, reading the published calls and ladder and " +
  "placing the ticket a confirmed row states through tools/mt5-bridge/live-trading-order.py at the symbol " +
  "minimum, once per signal bar and one working ticket per pair, capped at $MaxPerDay trades a day. " +
  $(if ($Arm) { "Armed: --confirm-live is passed, so a confirmed row is placed." } else { "Unarmed: it reads and records and places nothing." })

# Replace any earlier registration cleanly: -Force over a task whose run is still in flight left the scheduler
# reporting the task as running and quietly refusing every repetition, which reads as a cadence that stopped.
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
