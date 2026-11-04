#Requires -Version 5.1
<#
.SYNOPSIS
  Calls the orchestrator webhook the dashboard's Refresh button calls, waits for the run the flow records, and calls
  it again if that run came back failed.

.DESCRIPTION
  This is the daily slot. Until 2026-11-04 the slot was a one-line POST of the webhook, and on 2026-11-04 at 06:00
  UTC that POST produced a run that failed at the "USD Collector" step with "Bad gateway - the service failed to
  handle your request". Nothing read the outcome, so the day's Layer 1 direction was whatever the failed run left
  behind, and it stayed that way until a person pressed Refresh by hand at 07:44:34Z. One transient 502 cost the
  morning.

  A slot that does not read back what its call produced is not a scheduler, it is a hope. This script is the three
  steps that make it one:

    1. read data/workflow-control.json - the switch and the webhook the page itself obeys - and refuse to call when
       the switch is off, loudly, rather than posting into a flow nobody wants started;
    2. remember data/workflow-status.json's last_run_started_at, POST the webhook exactly as the page does, and poll
       that file until the stamp moves, so "the call answered 202" is never confused with "a run happened";
    3. read the status and the failed_step the flow wrote. Success ends the slot. Anything else - a failed run, a run
       that never reported back, a non-2xx answer to the POST - is tried again, up to -MaxAttempts, because the
       failure this exists for is a transient one.

  It holds no token and no key: the webhook is public (the published page calls it) and the status file is read from
  raw.githubusercontent.com. It touches no order, position, account or credential.

  One line per attempt goes to -Log and to stdout, as a JSON object, so a later read can count attempts and name the
  failed step. The exit code is 0 only when a run reported success, so the scheduled task's LastTaskResult is the
  answer to "did today's Layer 1 run happen".

  -WhatIf reads the control file, prints what it would do, and touches nothing: no POST, no poll, no log line. That
  is how this script is exercised without spending a real orchestrator run.

.PARAMETER StatusUrl
  Where the flow's record is read from. Overridable so a test can point it at a local listener.

.PARAMETER ControlPath
  Defaults to data/workflow-control.json beside this script's parent folder.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/trigger-orchestrator-refresh.ps1 -WhatIf

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/trigger-orchestrator-refresh.ps1 `
    -Log C:\live-trading\logs\refresh-0600.log
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string] $RepoRoot = "",
  [string] $ControlPath = "",
  [string] $StatusUrl = "https://raw.githubusercontent.com/kevincreedycars-debug/trading-agent-dashboard/main/data/workflow-status.json",
  [string] $WebhookUrl = "",
  [string] $Source = "host:trigger-orchestrator-refresh",
  [int] $MaxAttempts = 3,
  [int] $RetryDelaySeconds = 120,
  [int] $TimeoutSeconds = 900,
  [int] $PollSeconds = 15,
  [string] $Log = ""
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
# Windows PowerShell 5.1 offers protocols by default that the raw file host no longer accepts.
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

$script:LogPath = $Log
if (-not $RepoRoot) { $RepoRoot = Split-Path -Parent $PSScriptRoot }

function Write-SlotLine {
  param([hashtable] $Record)
  $line = (@{ utc = (Get-Date).ToUniversalTime().ToString("o") } + $Record | ConvertTo-Json -Compress)
  Write-Output $line
  if ($script:LogPath) {
    $folder = Split-Path -Parent $script:LogPath
    if ($folder -and -not (Test-Path -LiteralPath $folder)) { New-Item -ItemType Directory -Path $folder -Force | Out-Null }
    Add-Content -LiteralPath $script:LogPath -Value $line -Encoding ASCII
  }
}

function Get-StatusSnapshot {
  param([string] $Url)
  # A query string the cache cannot satisfy is the only way to read a file this fresh from a CDN.
  $separator = if ($Url.Contains("?")) { "&" } else { "?" }
  $uri = $Url + $separator + "slot=" + [DateTime]::UtcNow.Ticks
  Invoke-RestMethod -Uri $uri -Method Get -UseBasicParsing -TimeoutSec 30 -Headers @{ "Cache-Control" = "no-cache" }
}

function Invoke-Webhook {
  param([string] $Url, [string] $Json)
  try {
    $response = Invoke-WebRequest -Uri $Url -Method Post -ContentType "application/json" -Body $Json `
      -UseBasicParsing -TimeoutSec 120
    return [string]$response.StatusCode
  } catch {
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) { return [string][int]$_.Exception.Response.StatusCode }
    return "no-response"
  }
}

function Wait-ForRunRecord {
  param([string] $Url, [string] $Before, [int] $Timeout, [int] $Poll)
  $deadline = (Get-Date).AddSeconds($Timeout)
  while ((Get-Date) -lt $deadline) {
    try {
      $snapshot = Get-StatusSnapshot -Url $Url
      $started = [string]$snapshot.last_run_started_at
      if ($started -and $started -ne $Before) { return $snapshot }
    } catch { }
    Start-Sleep -Seconds $Poll
  }
  return $null
}


if (-not $ControlPath) { $ControlPath = Join-Path $RepoRoot "data\workflow-control.json" }
if (-not (Test-Path -LiteralPath $ControlPath)) { throw "Not found: $ControlPath" }
$control = Get-Content -LiteralPath $ControlPath -Raw | ConvertFrom-Json
if (-not $WebhookUrl) { $WebhookUrl = [string]$control.webhook_url }
if (-not $WebhookUrl) { throw "data/workflow-control.json names no webhook_url" }

if ($control.enabled -ne $true) {
  Write-SlotLine @{ action = "refused"; reason = "data/workflow-control.json carries enabled=$($control.enabled)"; webhook = $WebhookUrl }
  Write-Output "The control file has the webhook switched off, so nothing was called."
  exit 1
}

$localDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd")
$payload = (@{ triggered_by = "schedule"; source = $Source; local_date = $localDate } | ConvertTo-Json -Compress)

if (-not $PSCmdlet.ShouldProcess($WebhookUrl, "POST the orchestrator refresh up to $MaxAttempts time(s) and verify each run")) {
  Write-Output "repo_root     = $RepoRoot"
  Write-Output "control       = $ControlPath (enabled=$($control.enabled))"
  Write-Output "webhook       = $WebhookUrl"
  Write-Output "status_url    = $StatusUrl"
  Write-Output "payload       = $payload"
  Write-Output "attempts      = at most $MaxAttempts, $RetryDelaySeconds s apart, $TimeoutSeconds s waiting on each run"
  Write-Output "log           = $(if ($script:LogPath) { $script:LogPath } else { 'stdout only' })"
  return
}

# The stamp before this slot calls, so the run it starts is the only thing that can move it.
$before = ""
try { $before = [string](Get-StatusSnapshot -Url $StatusUrl).last_run_started_at } catch { }

for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
  $http = Invoke-Webhook -Url $WebhookUrl -Json $payload
  if ($http -notmatch '^2\d\d$') {
    Write-SlotLine @{ attempt = $attempt; http = $http; action = $(if ($attempt -lt $MaxAttempts) { "retry" } else { "gave_up" }); reason = "the webhook did not accept the call" }
    if ($attempt -lt $MaxAttempts) { Start-Sleep -Seconds $RetryDelaySeconds }
    continue
  }

  $record = Wait-ForRunRecord -Url $StatusUrl -Before $before -Timeout $TimeoutSeconds -Poll $PollSeconds
  if (-not $record) {
    Write-SlotLine @{ attempt = $attempt; http = $http; action = $(if ($attempt -lt $MaxAttempts) { "retry" } else { "gave_up" }); waited_seconds = $TimeoutSeconds; reason = "no run was recorded inside the wait" }
    if ($attempt -lt $MaxAttempts) { Start-Sleep -Seconds $RetryDelaySeconds }
    continue
  }

  $before = [string]$record.last_run_started_at
  $status = [string]$record.status
  if ($status -eq "success") {
    Write-SlotLine @{ attempt = $attempt; http = $http; action = "success"; run_started_at = $before; run_finished_at = [string]$record.last_run_finished_at }
    exit 0
  }

  Write-SlotLine @{
    attempt = $attempt
    http = $http
    action = $(if ($attempt -lt $MaxAttempts) { "retry" } else { "gave_up" })
    run_started_at = $before
    status = $status
    failed_step = [string]$record.failed_step
    message = [string]$record.message
    reason = ([string]$record.error.reason)
  }
  if ($attempt -lt $MaxAttempts) { Start-Sleep -Seconds $RetryDelaySeconds }
}

Write-Output "No attempt ended in a successful run inside $MaxAttempts attempts; the day is left to the next slot."
exit 1
