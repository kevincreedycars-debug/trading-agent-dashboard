[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Name,
  [string]$ManifestPath,
  [string]$StorePath
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "credential-common.ps1")

# This helper lives in scripts/local-credentials, so the repository root is two levels up. The manifest
# and the encrypted store are both resolved explicitly: the store must never be inside the repository.
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$manifestFile = Join-Path $root "config\credential-manifest.json"
$storeFile = Join-Path $HOME ".trading-agent-dashboard\secrets\credentials.clixml"
$historyDir = Join-Path $HOME ".trading-agent-dashboard\secrets\history-backups"
$paths = Get-CredentialPaths -ManifestPath $manifestFile -StorePath $storeFile -HistoryDir $historyDir
$manifestEntries = Get-CredentialManifest -ManifestPath $paths.ManifestPath
Assert-ApprovedCredentialName -Name $Name -ManifestEntries $manifestEntries

$store = Import-CredentialStore -StorePath $paths.StorePath
$entry = Get-CredentialEntry -Store $store -Name $Name
if ($null -eq $entry) { throw "credential $Name is not present in the local store" }

# Plaintext goes to stdout only so a local tool can consume it; it is never written to a file or logged.
Write-Output (ConvertFrom-SecureStringPlainText -SecureValue $entry.value)
