[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupPath,
  [string]$StorePath,
  [string]$HistoryDir,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "credential-common.ps1")

$paths = Get-CredentialPaths -StorePath $StorePath -HistoryDir $HistoryDir
Ensure-CredentialDirectories -Paths $paths

if (-not (Test-Path -LiteralPath $BackupPath)) {
  throw "Backup not found: $BackupPath"
}

$backupStore = Import-Clixml -LiteralPath $BackupPath
Assert-ValidCredentialStore -Store $backupStore

if ((Test-Path -LiteralPath $paths.StorePath) -and -not $Force) {
  $confirmation = Read-Host "Overwrite the active credential store from backup? Type YES to continue"
  if ($confirmation -ne "YES") {
    throw "Restore cancelled."
  }
}

$preRestoreBackup = Backup-CredentialStore -StorePath $paths.StorePath -HistoryDir $paths.HistoryDir -Prefix "pre-restore"
Copy-Item -LiteralPath $BackupPath -Destination $paths.StorePath -Force

[pscustomobject]@{
  status = "restore_complete"
  restored_from = Split-Path -Leaf $BackupPath
  pre_restore_backup = if ($preRestoreBackup) { Split-Path -Leaf $preRestoreBackup } else { $null }
  entry_count = @($backupStore.variables).Count
} | ConvertTo-Json -Depth 4
