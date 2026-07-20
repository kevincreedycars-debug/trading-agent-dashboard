[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Name,
  [string]$ManifestPath,
  [string]$StorePath,
  [string]$HistoryDir,
  [string]$AuditPath,
  [securestring]$SecretValueSecureString,
  [string]$PlainTextValue,
  [string]$SourceFile,
  [switch]$SkipBackup
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "credential-common.ps1")

$paths = Get-CredentialPaths -ManifestPath $ManifestPath -StorePath $StorePath -HistoryDir $HistoryDir -AuditPath $AuditPath
Ensure-CredentialDirectories -Paths $paths
$manifestEntries = Get-CredentialManifest -ManifestPath $paths.ManifestPath
Assert-ApprovedCredentialName -Name $Name -ManifestEntries $manifestEntries
$store = Import-CredentialStore -StorePath $paths.StorePath

$value = if ($SecretValueSecureString) {
  $SecretValueSecureString
} elseif ($PSBoundParameters.ContainsKey("PlainTextValue")) {
  ConvertTo-SecureString -String $PlainTextValue -AsPlainText -Force
} else {
  Read-Host -AsSecureString -Prompt "Enter value for $Name"
}

$backupPath = $null
if (-not $SkipBackup) {
  $backupPath = Backup-CredentialStore -StorePath $paths.StorePath -HistoryDir $paths.HistoryDir -Prefix "credentials"
}

Set-CredentialEntry -Store $store -Name $Name -Value $value
Export-CredentialStore -Store $store -StorePath $paths.StorePath

if ($SourceFile) {
  Update-MigrationAudit -AuditPath $paths.AuditPath -VariableName $Name -SourceFile $SourceFile
}

[pscustomobject]@{
  name = $Name
  status = "stored"
  backup_file = if ($backupPath) { Split-Path -Leaf $backupPath } else { $null }
  source_file = if ($SourceFile) { Split-Path -Leaf $SourceFile } else { $null }
} | ConvertTo-Json -Depth 4
