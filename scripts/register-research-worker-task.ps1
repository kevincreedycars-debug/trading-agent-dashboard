<#
.SYNOPSIS
  Registers (or removes) the one Windows scheduled task that runs one unattended research pass.

.DESCRIPTION
  scripts/research-worker.js is one bounded pass: recover, read the provider reading, read the allowance, run the
  next runnable stage, verify the answer against the run's own record, deliver it through the hosted store, write a
  receipt, stop. This script puts that pass on a clock, with no overlap, and hides its window.

  It is deliberately separate from the live-trading tasks. It writes nothing the trader reads, calls no order
  tool, and cannot change a signal, a weight or a configuration: a research report is evidence for a later
  decision, never an instruction to the live system. The task name, the wrapper, the log and the state root are
  this lane's own, so pausing or deleting it cannot touch the trader.

  Two refusals come before anything is registered, because both would otherwise spend the owner's ChatGPT
  allowance for nothing:
    - the hosted store must report itself configured (RESEARCH_WORKER_EMAIL and RESEARCH_WORKER_PASSWORD present),
      or a pass would run the carrier and then have nowhere to deliver the answer;
    - a pass must be dispatchable at all: node scripts/research-pipeline.js status has to answer.

  -Show and -Test are read-only with respect to production. -Show writes nothing. -Test registers a temporary task
  that runs the wrapper with --dry-run against an isolated state root, so it spends no allowance, imports no
  reading, takes no claim and stores nothing; it then checks that the production wrapper and task definition are
  byte-for-byte what they were before it started.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-research-worker-task.ps1 -Show
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-research-worker-task.ps1 -Test
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-research-worker-task.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-research-worker-task.ps1 -Pause
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-research-worker-task.ps1 -Resume
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-research-worker-task.ps1 -Remove
#>
param(
  [string] $TaskName = "AstraResearchPassUSD",
  [int] $IntervalMinutes = 30,
  [string] $RepoRoot = (Split-Path -Parent $PSScriptRoot),
  [string] $Node = $null,
  [string] $HiddenRunner = "$env:USERPROFILE\.trading-agent-dashboard\scripts\run-hidden.vbs",
  # One stage per pass is the pilot shape. A larger bound only lets one pass walk further down the same chain;
  # it does not make a stage independent of its parent, which the supervisor still enforces.
  [int] $MaxStages = 1,
  [string] $Asset = "USD",
  [string] $Stage = "",
  [string] $Topic = "",
  # The carrier is a local `codex exec` process reading its own sign-in. Empty means "whatever is on PATH".
  [string] $Carrier = "",
  [string] $CodexHome = "",
  # A pass is bounded so a stuck carrier cannot hold the task past its own limit. The execution limit is this plus
  # five minutes, so the scheduler's kill is always the second thing that happens.
  [int] $TimeoutMinutes = 40,
  # The account the task runs as. Empty keeps the current registration shape: the interactive account that owns
  # the Codex sign-in. -S4U asks for a principal that runs without a logged-on desktop session, which is what a
  # host that reboots unattended wants; it has to be proved with -Test on that host before it is relied on.
  [string] $RunAs = "",
  [switch] $S4U,
  # Registering a task that can only refuse is noise; this is the deliberate exception, and the pass it produces
  # stops at the same hosted-store refusal this script reports here.
  [switch] $AllowUnconfiguredStore,
  [switch] $NoStart,
  [switch] $Remove,
  [switch] $Show,
  [switch] $Pause,
  [switch] $Resume,
  [switch] $Test
)

$ErrorActionPreference = "Stop"

$runner = Join-Path $RepoRoot "scripts\research-worker.js"
$supervisor = Join-Path $RepoRoot "lib\research_pipeline.js"
$wrapperPath = Join-Path $RepoRoot "tmp\research-worker-run.cmd"
$logPath = Join-Path $RepoRoot "tmp\research-worker.log"
$plan = [ordered]@{}
$plan["task_name"] = $TaskName
$plan["repo_root"] = $RepoRoot
$plan["wrapper"] = $wrapperPath
$plan["log"] = $logPath

if ($Remove) {
  $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if (-not $existing) {
    Write-Output "No task named $TaskName; nothing to remove."
    return
  }
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Output "Removed scheduled task $TaskName. Nothing it wrote is deleted: delivered reports stay in the hosted store and the receipts stay in .local\research-pipeline."
  return
}

# A pause that keeps the evidence. Disabling the task stops new passes and leaves every delivered report, every
# receipt and the queue exactly as they are, so re-enabling continues from the registry rather than from memory.
if ($Pause) {
  $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if (-not $existing) { throw "No task named $TaskName; there is nothing to pause." }
  Disable-ScheduledTask -TaskName $TaskName | Out-Null
  Write-Output "Disabled scheduled task ${TaskName}: no new pass will start. Delivered reports and receipts are untouched."
  return
}

if ($Resume) {
  $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if (-not $existing) { throw "No task named $TaskName; register it before resuming it." }
  Enable-ScheduledTask -TaskName $TaskName | Out-Null
  Write-Output "Enabled scheduled task $TaskName. The next pass re-reads the registry and the allowance before it dispatches anything."
  return
}

foreach ($requiredPath in @($runner, $supervisor)) {
  if (-not (Test-Path -LiteralPath $requiredPath)) { throw "Not found: $requiredPath" }
}

if (-not $Node) {
  $resolved = Get-Command node -ErrorAction SilentlyContinue
  if (-not $resolved) { throw "node is not on PATH; pass -Node <path>." }
  $Node = $resolved.Source
}
$plan["node"] = $Node
$plan["node_version"] = (& $Node --version)

$nodeMajor = 0
if ($plan["node_version"] -match "^v(\d+)\.") { $nodeMajor = [int]$Matches[1] }
# The suite and the pipeline both use the global fetch and node:test that arrived with 18; below that the
# checkout is not the thing this script was written for.
if ($nodeMajor -lt 18) { throw "node $($plan['node_version']) is too old; this checkout needs node 18 or newer (22 LTS is what the host builds use)." }

# The hidden launcher is handed the wrapper path unquoted, so a space in it silently splits the command line.
if ($wrapperPath -match " ") {
  throw "The wrapper path '$wrapperPath' contains a space, which the hidden launcher cannot be handed unquoted. Move the checkout to a path without spaces."
}

function Get-TextSha256($text) {
  if ($null -eq $text) { return $null }
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes([string]$text)
    return ([System.BitConverter]::ToString($sha.ComputeHash($bytes)) -replace "-", "").ToLower()
  } finally {
    $sha.Dispose()
  }
}

function Get-FileSha256($path) {
  if (-not (Test-Path -LiteralPath $path)) { return $null }
  return (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLower()
}

# The two things a read-only run must leave alone: the wrapper the scheduler runs, and the task definition the
# scheduler holds. Read, never written; -Test compares them before and after so "nothing changed" is checked.
function Get-ProductionFingerprint {
  $taskXml = $null
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    $taskXml = Export-ScheduledTask -TaskName $TaskName
  }
  return @{
    wrapper_sha256 = Get-FileSha256 $wrapperPath
    task_sha256 = Get-TextSha256 $taskXml
  }
}

# The worker's own flags, in the order the log is easiest to read. A self test appends its own isolation to this.
function Get-WorkerCommand([string] $ExtraFlags) {
  $parts = @("`"$Node`" `"$runner`" --max-stages $MaxStages --asset $Asset")
  if ($Stage) { $parts += "--stage $Stage" }
  if ($Topic) { $parts += "--topic `"$Topic`"" }
  if ($TimeoutMinutes -gt 0) { $parts += "--timeout-minutes $TimeoutMinutes" }
  if ($Carrier) { $parts += "--carrier `"$Carrier`"" }
  if ($CodexHome) { $parts += "--codex-home `"$CodexHome`"" }
  if ($ExtraFlags) { $parts += $ExtraFlags }
  return ($parts -join " ")
}

function Write-Wrapper([string] $path, [string] $command, [string] $logFile) {
  $directory = Split-Path -Parent $path
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  $lines = @(
    "@echo off",
    "rem Generated by scripts/register-research-worker-task.ps1. Machine specific; rewritten at each registration.",
    "rem One bounded research pass. It reads the registry, the allowance and the hosted store; it writes a report,",
    "rem a receipt and a log line. It does not touch trading configuration, orders, weights or production signals.",
    "echo [%DATE% %TIME%] pass start>> `"$logFile`"",
    "$command >> `"$logFile`" 2>&1",
    "echo [%DATE% %TIME%] pass exit=%ERRORLEVEL%>> `"$logFile`""
  )
  Set-Content -LiteralPath $path -Value $lines -Encoding ascii
  return $path
}

function Get-LauncherPair([string] $wrapper) {
  if (Test-Path -LiteralPath $HiddenRunner) {
    return "wscript.exe", "`"$HiddenRunner`" `"cmd.exe /c $wrapper`""
  }
  Write-Output "Hidden runner '$HiddenRunner' is absent; cmd.exe will be started directly and its window may flash."
  return "cmd.exe", "/c $wrapper"
}


# What a pass would find here, asked the same way the pass asks it. Both answers are read-only: the supervisor's
# status opens no socket, and the store check reads script.js plus two environment variables.
$previousLocation = Get-Location
try {
  Set-Location -LiteralPath $RepoRoot
  $statusJson = & $Node "scripts\research-pipeline.js" status 2>&1
  if ($LASTEXITCODE -ne 0) { throw "The supervisor's status command failed: $statusJson" }
  $status = $statusJson | ConvertFrom-Json
  $plan["queue"] = "stages=$($status.counts.stages) runnable=$($status.counts.runnable) delivered=$($status.counts.delivered) paused=$($status.paused)"
  $plan["next_stage"] = if ($status.next -and $status.next.Count -gt 0) { $status.next[0].job_key } else { "none in scope" }
  $plan["allowance"] = "used=$($status.allowance.used) of $($status.allowance.usable) usable, provider gate=$($status.allowance.provider.code)"

  $storeJson = & $Node -e "const h=require('./lib/research_hosted_store.js');const c=h.config();console.log(JSON.stringify({ok:c.ok,needed:c.needed}))" 2>&1
  if ($LASTEXITCODE -ne 0) { throw "The hosted store could not be asked whether it is configured: $storeJson" }
  $store = $storeJson | ConvertFrom-Json
} finally {
  Set-Location -LiteralPath $previousLocation
}

$plan["hosted_store"] = if ($store.ok) { "configured" } else { "missing: $($store.needed -join ', ')" }
if (-not $store.ok -and -not $AllowUnconfiguredStore -and -not $Show -and -not $Test) {
  throw ("The hosted research store is not configured, so every pass would refuse without spending anything: " +
    "$($store.needed -join ', '). Set those values for the account the task runs as, then register again; " +
    "-AllowUnconfiguredStore registers anyway, deliberately.")
}

if ($Show) {
  $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($existing) {
    $info = Get-ScheduledTaskInfo -TaskName $TaskName
    $plan["task_state"] = $existing.State
    $plan["task_principal"] = "$($existing.Principal.UserId) / $($existing.Principal.LogonType)"
    $plan["last_run_time"] = $info.LastRunTime.ToString("o")
    $plan["last_task_result"] = $info.LastTaskResult
    $plan["next_run_time"] = if ($info.NextRunTime) { $info.NextRunTime.ToString("o") } else { "" }
    $plan["missed_runs"] = $info.NumberOfMissedRuns
  } else {
    $plan["task_state"] = "not registered"
  }
  if (Test-Path -LiteralPath $logPath) { $plan["last_log_line"] = (Get-Content -LiteralPath $logPath -Tail 1) }
  $runLog = Get-ChildItem -LiteralPath (Join-Path $RepoRoot ".local\research-pipeline\worker\runs.jsonl") -ErrorAction SilentlyContinue
  if ($runLog) { $plan["run_log"] = "$($runLog.Length) bytes, written $($runLog.LastWriteTime.ToString('o'))" }
  $plan.GetEnumerator() | ForEach-Object { "{0,-22} = {1}" -f $_.Key, $_.Value }
  return
}


# The self test: the launcher, the wrapper and the runner, exercised against their own dry run. A dry run imports
# no provider reading, takes no claim, writes no allowance state and stores nothing, so it is the one shape of a
# real pass that is safe to run on a machine that also holds the production queue.
if ($Test) {
  $selfTestName = "$TaskName-Selftest"
  $selfTestDir = Join-Path $RepoRoot "tmp\research-worker-selftest"
  New-Item -ItemType Directory -Force -Path $selfTestDir | Out-Null
  $selfTestWrapper = Join-Path $selfTestDir "research-worker-selftest.cmd"
  $selfTestLog = Join-Path $selfTestDir "research-worker-selftest.log"
  $productionBefore = Get-ProductionFingerprint

  $isolation = "--dry-run --state-root `"$(Join-Path $selfTestDir 'state')`" --library-root `"$(Join-Path $selfTestDir 'library')`""
  Write-Wrapper $selfTestWrapper (Get-WorkerCommand $isolation) $selfTestLog | Out-Null
  $selfTestLauncher, $selfTestArguments = Get-LauncherPair $selfTestWrapper
  $selfTestAction = New-ScheduledTaskAction -Execute $selfTestLauncher -Argument $selfTestArguments
  $selfTestTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddSeconds(10)
  $selfTestSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes ($TimeoutMinutes + 5)) -Priority 8
  if (Get-ScheduledTask -TaskName $selfTestName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $selfTestName -Confirm:$false
  }
  $before = if (Test-Path -LiteralPath $selfTestLog) { @(Get-Content -LiteralPath $selfTestLog).Count } else { 0 }
  Register-ScheduledTask -TaskName $selfTestName -Action $selfTestAction -Trigger $selfTestTrigger `
    -Settings $selfTestSettings -Description "Temporary launcher self test for the unattended research pass." | Out-Null
  Start-ScheduledTask -TaskName $selfTestName

  $deadline = (Get-Date).AddSeconds(90)
  $after = $before
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 3
    $after = if (Test-Path -LiteralPath $selfTestLog) { @(Get-Content -LiteralPath $selfTestLog).Count } else { 0 }
    if ($after -gt $before) { break }
  }
  $selfTestInfo = Get-ScheduledTaskInfo -TaskName $selfTestName
  $tail = if (Test-Path -LiteralPath $selfTestLog) { Get-Content -LiteralPath $selfTestLog -Tail 6 } else { @() }
  Unregister-ScheduledTask -TaskName $selfTestName -Confirm:$false

  $tailText = ($tail -join "`n")
  $verdict = "the launcher never reached the runner"
  if ($tailText -match '"reason":\s*"dry_run"') { $verdict = "the launcher ran the pass, which planned the next stage and dispatched nothing" }
  elseif ($tailText -match '"code":\s*"hosted_not_configured"') { $verdict = "the launcher ran the pass, which refused before spending because the hosted store is not configured" }
  elseif ($tailText -match '"reason":\s*"no_runnable_stage"') { $verdict = "the launcher ran the pass, which found nothing runnable in scope" }
  elseif ($after -gt $before) { $verdict = "the launcher ran the pass, which reported: $(($tail | Select-Object -Last 1))" }

  $productionAfter = Get-ProductionFingerprint
  $wrapperUnchanged = $productionBefore.wrapper_sha256 -eq $productionAfter.wrapper_sha256
  $taskUnchanged = $productionBefore.task_sha256 -eq $productionAfter.task_sha256

  "self_test_task        = $selfTestName"
  "self_test_result      = $($selfTestInfo.LastTaskResult)"
  "self_test_log_lines   = $before before, $after after"
  "self_test_verdict     = $verdict"
  "self_test_isolation   = dry run, own state and library roots, no claim, no allowance spent"
  "self_test_production_unchanged = $($wrapperUnchanged -and $taskUnchanged)"
  $tail | ForEach-Object { "  | $_" }
  if (-not $wrapperUnchanged) { throw "The self test changed the production wrapper $wrapperPath; it must not." }
  if (-not $taskUnchanged) { throw "The self test changed the definition of task $TaskName; it must not." }
  return
}


# The production wrapper is written only here, on the path that registers the task. A copy of what it held is kept
# first, so the flags of a previous registration are readable rather than remembered.
if (Test-Path -LiteralPath $wrapperPath) {
  $backupPath = "$wrapperPath.bak-" + (Get-Date).ToString("yyyyMMddHHmmss")
  Copy-Item -LiteralPath $wrapperPath -Destination $backupPath -Force
  Write-Output "previous_wrapper   = $backupPath"
}
Write-Wrapper $wrapperPath (Get-WorkerCommand "") $logPath | Out-Null

$launcher, $launcherArguments = Get-LauncherPair $wrapperPath
$action = New-ScheduledTaskAction -Execute $launcher -Argument $launcherArguments
# An interval with no duration is an indefinite repetition. StartWhenAvailable picks the run back up after a
# reboot, IgnoreNew keeps a still-running carrier and the next repetition from both holding a claim, and the
# priority sits below the live trader's so the research pass loses a CPU argument to it.
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddSeconds(20) `
  -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes ($TimeoutMinutes + 5)) -Priority 8
$description = "Unattended research pass for asset ${Asset}: one stage per run through the Astra carrier, verified " +
  "against the run's own record, delivered to the hosted research library and registered on the dashboard. " +
  "Separate from every live-trading task: it changes no trading configuration, order, weight or production signal. " +
  $(if ($RunAs) { "Runs as $RunAs ($(if ($S4U) { 'S4U, no desktop session' } else { 'interactive' }))." } else { "Runs as the interactive account that owns the Codex sign-in." })

# Replace any earlier registration cleanly: -Force over a task whose run is still in flight leaves the scheduler
# reporting it as running and quietly refusing every repetition, which reads as a cadence that stopped.
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
  if ($existing.State -eq "Running") { Stop-ScheduledTask -TaskName $TaskName }
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

if ($RunAs) {
  $logonType = if ($S4U) { "S4U" } else { "Interactive" }
  $principal = New-ScheduledTaskPrincipal -UserId $RunAs -LogonType $logonType -RunLevel Highest
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
    -Principal $principal -Description $description | Out-Null
} else {
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
    -Description $description | Out-Null
}

$task = Get-ScheduledTask -TaskName $TaskName
$plan["task_state"] = $task.State
$plan["task_principal"] = "$($task.Principal.UserId) / $($task.Principal.LogonType)"
$plan["interval_minutes"] = $IntervalMinutes
$plan["registered_at"] = (Get-Date).ToString("o")

if (-not $NoStart) {
  Start-ScheduledTask -TaskName $TaskName
  Start-Sleep -Seconds 8
  $info = Get-ScheduledTaskInfo -TaskName $TaskName
  $plan["last_run_time"] = $info.LastRunTime.ToString("o")
  $plan["last_task_result"] = $info.LastTaskResult
  $plan["next_run_time"] = if ($info.NextRunTime) { $info.NextRunTime.ToString("o") } else { "" }
  if (Test-Path -LiteralPath $logPath) { $plan["last_log_line"] = (Get-Content -LiteralPath $logPath -Tail 1) }
}

$plan.GetEnumerator() | ForEach-Object { "{0,-22} = {1}" -f $_.Key, $_.Value }

