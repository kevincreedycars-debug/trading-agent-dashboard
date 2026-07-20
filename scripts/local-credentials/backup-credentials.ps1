[CmdletBinding()]
param(
  [string]$StorePath,
  [string]$HistoryDir
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "credential-common.ps1")

$paths = Get-CredentialPaths -StorePath $StorePath -HistoryDir $HistoryDir
Ensure-CredentialDirectories -Paths $paths
$store = Import-CredentialStore -StorePath $paths.StorePath
Assert-ValidCredentialStore -Store $store

$backupPath = Backup-CredentialStore -StorePath $paths.StorePath -HistoryDir $paths.HistoryDir -Prefix "credentials"
if (-not $backupPath) {
  throw "Active credential store not found: $($paths.StorePath)"
}

[pscustomobject]@{
  status = "backup_created"
  backup_file = Split-Path -Leaf $backupPath
} | ConvertTo-Json -Depth 4
