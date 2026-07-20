[CmdletBinding()]
param(
  [string]$LocalHome = (Join-Path $env:USERPROFILE ".trading-agent-dashboard")
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot

& (Join-Path $PSScriptRoot "create-local-secret-home.ps1") `
  -LocalHome $LocalHome `
  -RepoRoot $repoRoot `
  -InitializeEmptyStoreIfMissing
