<#
.SYNOPSIS
  Reads back every effective setting of one live-trading lane, and compares two readings.

.DESCRIPTION
  The registration script is the only thing that writes the wrapper the task runs, and what that wrapper
  carries is the production behaviour: --confirm-live is the difference between reading and placing, and
  --max-open, --expire-minutes and --settle-seconds decide what may be left and for how long. A file's
  defaults say none of that. On 2026-10-24 an inspection rewrote the wrapper and the loop went on printing a
  tidy "planned" line without the flags; nothing that read the repository could tell.

  So this reads the four places the effective answer actually lives and puts them in one document:

    - the wrapper the scheduler runs (tmp/live-trading-trader-run.cmd): the command line, parsed, not trusted;
    - the scheduled task definition (Export-ScheduledTask): action, trigger, settings, state, and a hash;
    - the lanes file (config/live-trading-lanes.json): the lane, its enabled flag and the account identity
      the publisher holds that lane to;
    - the trader's own heartbeat (tmp/live-trading-trader-status.json): what the loop last said about itself.
      It is evidence of a run, never proof of a running loop, and it is labelled as such in the document.

  -Out writes the document. -Compare reads an earlier one and prints every difference. Two kinds are told
  apart, because they demand different answers:

    behaviour  arming, caps, expiry, settle window, alignment, interval, lane, account identity. A difference
               here is a change in what the loop does and the run exits 1 unless the reader resolves it.
    location   the checkout, terminal, state, log, lock or journal path. A migration is expected to move
               these; the run still exits 1, because "the paths moved on purpose" is a claim a person makes,
               and -AllowRelocatedPaths is how they make it.

  Same-host comparison also checks the wrapper and task-definition hashes, which is how a read-only run is
  proved not to have rewritten production. Two different computers cannot share those hashes (the task XML
  and the wrapper both name host paths), so a cross-host comparison states that it skipped them instead of
  reporting a difference that is not one.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/export-live-trading-effective-config.ps1 -Out .local\live-trading-effective-before.json
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/export-live-trading-effective-config.ps1 -Out .local\live-trading-effective-host.json
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/export-live-trading-effective-config.ps1 -Compare .local\live-trading-effective-before.json
#>
param(
  [string] $TaskName = "LiveTradingTraderTick019",
  [string] $RepoRoot = (Split-Path -Parent $PSScriptRoot),
  [string] $Lane = "",
  [string] $Out,
  [string] $Compare,
  [switch] $AllowRelocatedPaths
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path.TrimEnd('\')
$lanesPath = Join-Path $RepoRoot "config\live-trading-lanes.json"
$wrapperPath = Join-Path $RepoRoot "tmp\live-trading-trader-run.cmd"
$heartbeatPath = Join-Path $RepoRoot "tmp\live-trading-trader-status.json"

function Read-JsonFile($path) {
  if (-not (Test-Path -LiteralPath $path)) { return $null }
  try {
    return (Get-Content -LiteralPath $path -Raw | ConvertFrom-Json)
  } catch {
    throw "Cannot read $path as JSON: $($_.Exception.Message)"
  }
}

function Get-FileSha256($path) {
  if (-not $path -or -not (Test-Path -LiteralPath $path)) { return $null }
  return (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLower()
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

# One flag out of a command line, with quotes stripped: `--max-open "1"` and `--max-open 1` are the same
# setting, and a setting that is absent must read as absent rather than as a default this script invented.
function Get-FlagValue($text, $name) {
  $match = [regex]::Match([string]$text, "--$([regex]::Escape($name))\s+(?:`"([^`"]*)`"|(\S+))")
  if (-not $match.Success) { return $null }
  if ($match.Groups[1].Success) { return $match.Groups[1].Value }
  return $match.Groups[2].Value
}

function Get-FlagPresent($text, $name) {
  return [bool]([regex]::IsMatch([string]$text, "(?<![\w-])--$([regex]::Escape($name))(?:\s|$)"))
}

function ConvertTo-NumberOrNull($value) {
  if ($null -eq $value -or "$value" -eq "") { return $null }
  $parsed = 0
  if ([int]::TryParse([string]$value, [ref]$parsed)) { return $parsed }
  return $null
}

# The lane this checkout trades: the file's own root match, exactly as the registration script resolves it, so
# the document describes the lane whose task is being read rather than the first lane in the list.
$lanesDocument = Read-JsonFile $lanesPath
if (-not $lanesDocument -or -not $lanesDocument.lanes) { throw "No lanes at $lanesPath." }
$laneRow = $null
if ($Lane) {
  $laneRow = @($lanesDocument.lanes | Where-Object { [string]$_.id -eq $Lane })[0]
  if (-not $laneRow) { throw "No lane $Lane in $lanesPath." }
} else {
  $laneMatches = @($lanesDocument.lanes | Where-Object {
    $candidate = Join-Path $RepoRoot ([string]$_.root)
    $resolved = Resolve-Path -LiteralPath $candidate -ErrorAction SilentlyContinue
    $resolved -and $resolved.Path.TrimEnd('\') -eq $RepoRoot
  })
  if ($laneMatches.Count -ne 1) {
    throw "Expected exactly one lane with this checkout as its root; found $($laneMatches.Count). Pass -Lane <id>."
  }
  $laneRow = $laneMatches[0]
}

$wrapperText = if (Test-Path -LiteralPath $wrapperPath) { Get-Content -LiteralPath $wrapperPath -Raw } else { "" }
$checkoutLine = [regex]::Match($wrapperText, '(?m)^cd /d\s+"([^"]+)"')
$nodeLine = [regex]::Match($wrapperText, '(?m)^"([^"]+node\.exe)"')

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
$taskXml = $null
if ($task) { $taskXml = Export-ScheduledTask -TaskName $TaskName }
$taskInfo = if ($task) { Get-ScheduledTaskInfo -TaskName $TaskName } else { $null }
$taskAction = $null
$taskSettings = $null
$taskTrigger = $null
if ($task) {
  $taskAction = @($task.Actions)[0]
  $taskSettings = $task.Settings
  $taskTrigger = @($task.Triggers)[0]
}

$heartbeat = Read-JsonFile $heartbeatPath

# What the wrapper says the loop does, in the order a person reads it. Absent means absent: no --max-open is
# the rule's own one-ticket-per-pair hold, and writing 0 here would hide the difference between "not capped"
# and "capped at zero".
$behaviour = [ordered]@{
  lane                 = Get-FlagValue $wrapperText "lane"
  armed                = Get-FlagPresent $wrapperText "confirm-live"
  max_open             = ConvertTo-NumberOrNull (Get-FlagValue $wrapperText "max-open")
  max_per_day          = ConvertTo-NumberOrNull (Get-FlagValue $wrapperText "max-per-day")
  expire_minutes       = ConvertTo-NumberOrNull (Get-FlagValue $wrapperText "expire-minutes")
  align                = Get-FlagPresent $wrapperText "align"
  settle_seconds       = ConvertTo-NumberOrNull (Get-FlagValue $wrapperText "settle-seconds")
  interval_seconds     = ConvertTo-NumberOrNull (Get-FlagValue $wrapperText "interval-seconds")
  once                 = Get-FlagPresent $wrapperText "once"
  quiet                = Get-FlagPresent $wrapperText "quiet"
  account_login_masked = if ($heartbeat) { [string]$heartbeat.account.login_masked } else { $null }
  account_server       = if ($heartbeat) { [string]$heartbeat.account.server } else { $null }
  lanes_login_masked   = [string]$laneRow.account_login_masked
  lanes_server         = [string]$laneRow.account_server
  lane_enabled         = -not ($laneRow.enabled -eq $false)
}

$location = [ordered]@{
  checkout = if ($checkoutLine.Success) { $checkoutLine.Groups[1].Value } else { $null }
  terminal = Get-FlagValue $wrapperText "terminal"
  state    = Get-FlagValue $wrapperText "state"
  log      = Get-FlagValue $wrapperText "log"
  lock     = Get-FlagValue $wrapperText "lock"
  journal  = Get-FlagValue $wrapperText "journal"
  node     = if ($nodeLine.Success) { $nodeLine.Groups[1].Value } else { $null }
  python   = Get-FlagValue $wrapperText "python"
}

function Get-FileFacts($path) {
  $resolved = $null
  if ($path) { $resolved = $path }
  return [ordered]@{
    path   = if ($resolved) { [string]$resolved } else { $null }
    sha256 = Get-FileSha256 $resolved
    bytes  = if ($resolved -and (Test-Path -LiteralPath $resolved)) { (Get-Item -LiteralPath $resolved).Length } else { $null }
  }
}

$taskBlock = [ordered]@{
  name                 = $TaskName
  present              = [bool]$task
  state                = if ($task) { [string]$task.State } else { $null }
  action_execute       = if ($taskAction) { [string]$taskAction.Execute } else { $null }
  action_arguments     = if ($taskAction) { [string]$taskAction.Arguments } else { $null }
  interval             = if ($taskTrigger -and $taskTrigger.Repetition) { [string]$taskTrigger.Repetition.Interval } else { $null }
  multiple_instances   = if ($taskSettings) { [string]$taskSettings.MultipleInstances } else { $null }
  execution_time_limit = if ($taskSettings) { "$($taskSettings.ExecutionTimeLimit)" } else { $null }
  start_when_available = if ($taskSettings) { [bool]$taskSettings.StartWhenAvailable } else { $null }
  last_run_time        = if ($taskInfo -and $taskInfo.LastRunTime -gt [datetime]::MinValue) { $taskInfo.LastRunTime.ToUniversalTime().ToString("o") } else { $null }
  last_task_result     = if ($taskInfo) { $taskInfo.LastTaskResult } else { $null }
  next_run_time        = if ($taskInfo -and $taskInfo.NextRunTime -gt [datetime]::MinValue) { $taskInfo.NextRunTime.ToUniversalTime().ToString("o") } else { $null }
  definition_sha256    = Get-TextSha256 $taskXml
}

$document = [ordered]@{
  schema_version   = "live-trading-effective-config-v1"
  generated_at_utc = (Get-Date).ToUniversalTime().ToString("o")
  host = [ordered]@{
    computer = $env:COMPUTERNAME
    user     = $env:USERNAME
    platform = "win32"
  }
  checkout_root = $RepoRoot
  repo = [ordered]@{ commit = $null; branch = $null; dirty = $null }
  lane = [ordered]@{
    id      = [string]$laneRow.id
    label   = [string]$laneRow.label
    enabled = -not ($laneRow.enabled -eq $false)
  }
  behaviour = $behaviour
  location  = $location
  task      = $taskBlock
  wrapper = [ordered]@{
    path   = $wrapperPath
    exists = (Test-Path -LiteralPath $wrapperPath)
    sha256 = Get-FileSha256 $wrapperPath
  }
  files = [ordered]@{
    state   = Get-FileFacts $location.state
    journal = Get-FileFacts $location.journal
    log     = Get-FileFacts $location.log
  }
  heartbeat = [ordered]@{
    path = $heartbeatPath
    present = [bool]$heartbeat
    # Evidence of a run, not proof of a running loop: the process that wrote it has already exited by the
    # time anyone reads it, so it says that a loop ran once at written_at_utc, and nothing about now.
    evidence_only = $true
    written_at_utc = if ($heartbeat) { [string]$heartbeat.written_at_utc } else { $null }
    armed = if ($heartbeat) { [bool]$heartbeat.armed } else { $null }
    status = if ($heartbeat) { [string]$heartbeat.status } else { $null }
    host_computer = if ($heartbeat -and $heartbeat.host) { [string]$heartbeat.host.computer } else { $null }
  }
}

# The commit this checkout is on, when git can be asked. It is reported rather than trusted: a working tree
# with local edits is a state a migration must not silently carry, so `dirty` is part of the document.
try {
  $commit = (& git -C $RepoRoot rev-parse HEAD 2>$null)
  $branch = (& git -C $RepoRoot rev-parse --abbrev-ref HEAD 2>$null)
  $porcelain = (& git -C $RepoRoot status --porcelain 2>$null)
  if ($LASTEXITCODE -eq 0) {
    $document.repo.commit = [string]$commit
    $document.repo.branch = [string]$branch
    $document.repo.dirty = [bool](@($porcelain | Where-Object { $_ }).Count -gt 0)
  }
} catch {
  # git is not required to read the settings; the fields stay null rather than failing the read.
}

$json = $document | ConvertTo-Json -Depth 8

if ($Out) {
  $outPath = if ([System.IO.Path]::IsPathRooted($Out)) { $Out } else { Join-Path $RepoRoot $Out }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outPath) | Out-Null
  [System.IO.File]::WriteAllText($outPath, $json + "`n", (New-Object System.Text.UTF8Encoding($false)))
  Write-Output "wrote           = $outPath"
  Write-Output "lane            = $($document.lane.id)"
  Write-Output "host            = $($document.host.computer)"
  Write-Output "armed           = $($document.behaviour.armed)"
  Write-Output "checkout_commit = $($document.repo.commit)"
  Write-Output "wrapper_sha256  = $($document.wrapper.sha256)"
  Write-Output "task_sha256     = $($document.task.definition_sha256)"
  if (-not $Compare) { return }
}

if (-not $Compare) {
  Write-Output $json
  return
}

# Compare. The earlier document is read from wherever it is; a relative path is resolved against this
# checkout, so a reader can keep both readings in .local and name them the same way from either host.
$comparePath = if ([System.IO.Path]::IsPathRooted($Compare)) { $Compare } else { Join-Path $RepoRoot $Compare }
if (-not (Test-Path -LiteralPath $comparePath)) { throw "Not found: $comparePath" }
$before = Read-JsonFile $comparePath
if (-not $before -or [string]$before.schema_version -ne "live-trading-effective-config-v1") {
  throw "$comparePath is not a live-trading-effective-config-v1 document."
}

$sameHost = [string]$before.host.computer -eq [string]$document.host.computer
Write-Output "compare_scope     = $(if ($sameHost) { 'same_host' } else { 'cross_host' })"
Write-Output "compare_host_from = $($before.host.computer)"
Write-Output "compare_host_now  = $($document.host.computer)"

$changed = 0
$relocated = 0
function Show-Value($value) {
  if ($null -eq $value) { return "<absent>" }
  return "$value"
}
foreach ($key in $document.behaviour.Keys) {
  $oldValue = $before.behaviour.$key
  $newValue = $document.behaviour.$key
  if ("$oldValue" -eq "$newValue") { continue }
  $changed += 1
  Write-Output ("difference_behaviour = {0}: {1} -> {2}" -f $key, (Show-Value $oldValue), (Show-Value $newValue))
}

foreach ($key in @("checkout", "terminal", "state", "log", "lock", "journal", "node", "python")) {
  $oldValue = [string]$before.location.$key
  $newValue = [string]$document.location.$key
  if ($oldValue -eq $newValue) { continue }
  # Cross-host, a path that keeps its file name is a relocated file; a path that changes its file name is a
  # different file, which is a behaviour question however it is labelled.
  $sameName = $oldValue -and $newValue -and (Split-Path -Leaf $oldValue) -eq (Split-Path -Leaf $newValue)
  if (-not $sameHost -and $sameName) {
    $relocated += 1
    Write-Output ("path_relocated      = {0}: {1} -> {2}" -f $key, $oldValue, $newValue)
  } else {
    $changed += 1
    Write-Output ("difference_location = {0}: {1} -> {2}" -f $key, $oldValue, $newValue)
  }
}

# Same host: the wrapper and the task definition must be byte-for-byte what they were. That is the check
# that proves a -Show or a -Test did not rewrite production, and it is also how a migration on one host is
# told from a re-registration that quietly dropped a flag.
if ($sameHost) {
  if ([string]$before.wrapper.sha256 -ne [string]$document.wrapper.sha256) {
    $changed += 1
    Write-Output ("difference_wrapper  = {0} -> {1}" -f (Show-Value $before.wrapper.sha256), (Show-Value $document.wrapper.sha256))
  }
  if ([string]$before.task.definition_sha256 -ne [string]$document.task.definition_sha256) {
    $changed += 1
    Write-Output ("difference_task     = {0} -> {1}" -f (Show-Value $before.task.definition_sha256), (Show-Value $document.task.definition_sha256))
  }
} else {
  Write-Output "hashes_skipped     = two hosts carry different task XML and wrapper paths by construction"
}

Write-Output "behaviour_changes = $changed"
Write-Output "relocated_paths   = $relocated"
if ($changed -gt 0) {
  Write-Output "result            = behaviour_differences"
  exit 1
}
if ($relocated -gt 0 -and -not $AllowRelocatedPaths) {
  Write-Output "result            = relocated_paths"
  Write-Output "note              = re-run with -AllowRelocatedPaths once the move is intended"
  exit 1
}
Write-Output "result            = identical"
exit 0
