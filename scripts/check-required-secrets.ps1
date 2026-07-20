[CmdletBinding()]
param(
  [string[]]$Scope = @("all"),
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"

$localScript = Join-Path $env:USERPROFILE ".trading-agent-dashboard\scripts\validate-credentials.ps1"
$localManifest = Join-Path $env:USERPROFILE ".trading-agent-dashboard\config\credential-manifest.json"

if (-not (Test-Path -LiteralPath $localScript)) {
  throw "Local validator not found: $localScript"
}

& $localScript -ManifestPath $localManifest -Scope $Scope -Quiet:$Quiet
