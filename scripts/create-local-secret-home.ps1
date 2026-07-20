[CmdletBinding()]
param(
  [string]$LocalHome = (Join-Path $env:USERPROFILE ".trading-agent-dashboard"),
  [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot),
  [switch]$InitializeEmptyStoreIfMissing,
  [switch]$ForceSync
)

$ErrorActionPreference = "Stop"

$templateRoot = Join-Path $PSScriptRoot "local-credentials"
$localConfig = Join-Path $LocalHome "config"
$localScripts = Join-Path $LocalHome "scripts"
$localSecrets = Join-Path $LocalHome "secrets"
$historyBackups = Join-Path $localSecrets "history-backups"
$storePath = Join-Path $localSecrets "credentials.clixml"
$existingHome = Test-Path -LiteralPath $LocalHome

foreach ($directory in @($LocalHome, $localConfig, $localScripts, $localSecrets, $historyBackups)) {
  if (-not (Test-Path -LiteralPath $directory)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
  }
}

$syncedFiles = New-Object System.Collections.Generic.List[string]
$preservedFiles = New-Object System.Collections.Generic.List[string]

function Sync-LocalFile {
  param(
    [string]$SourcePath,
    [string]$DestinationPath,
    [string]$Label
  )

  if ((Test-Path -LiteralPath $DestinationPath) -and -not $ForceSync) {
    $preservedFiles.Add($Label)
    return
  }

  Copy-Item -LiteralPath $SourcePath -Destination $DestinationPath -Force
  $syncedFiles.Add($Label)
}

Sync-LocalFile -SourcePath (Join-Path $RepoRoot "config\credential-manifest.json") -DestinationPath (Join-Path $localConfig "credential-manifest.json") -Label "config\\credential-manifest.json"
Sync-LocalFile -SourcePath (Join-Path $RepoRoot "config\credential-manifest.schema.json") -DestinationPath (Join-Path $localConfig "credential-manifest.schema.json") -Label "config\\credential-manifest.schema.json"

Get-ChildItem -LiteralPath $templateRoot -File | ForEach-Object {
  if ($_.Name -eq "README-local.md") {
    Sync-LocalFile -SourcePath $_.FullName -DestinationPath (Join-Path $LocalHome "README-local.md") -Label "README-local.md"
  } else {
    Sync-LocalFile -SourcePath $_.FullName -DestinationPath (Join-Path $localScripts $_.Name) -Label ("scripts\" + $_.Name)
  }
}

if ($InitializeEmptyStoreIfMissing -and -not (Test-Path -LiteralPath $storePath)) {
  [pscustomobject]@{
    version = "1.0"
    updatedAt = (Get-Date).ToString("o")
    variables = New-Object System.Collections.ArrayList
  } | Export-Clixml -LiteralPath $storePath -Force
}

[pscustomobject]@{
  local_home = $LocalHome
  existing_home = $existingHome
  store_exists = [bool](Test-Path -LiteralPath $storePath)
  force_sync = [bool]$ForceSync
  synced_files = @($syncedFiles)
  preserved_existing_files = @($preservedFiles)
} | ConvertTo-Json -Depth 4
