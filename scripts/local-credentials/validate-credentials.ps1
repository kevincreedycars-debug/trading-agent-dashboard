[CmdletBinding()]
param(
  [string[]]$Scope = @("all"),
  [string[]]$Name,
  [string]$ManifestPath,
  [string]$StorePath,
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "credential-common.ps1")

$paths = Get-CredentialPaths -ManifestPath $ManifestPath -StorePath $StorePath
$manifestEntries = Get-CredentialManifest -ManifestPath $paths.ManifestPath
$selectedEntries = Resolve-CredentialSelection -ManifestEntries $manifestEntries -Scope $Scope -Name $Name
$store = Import-CredentialStore -StorePath $paths.StorePath

$statuses = foreach ($entry in $selectedEntries) {
  $storedEntry = Get-CredentialEntry -Store $store -Name $entry.name
  [pscustomobject]@{
    name = $entry.name
    availability = Get-AvailabilityLabel -ManifestEntry $entry
    present = [bool]$storedEntry
    required_for = @($entry.required_for)
    status = if ($storedEntry) { "present" } else { "missing" }
  }
}

if (-not $Quiet) {
  $statuses | ConvertTo-Json -Depth 6
}

$missingRequired = @(
  $statuses |
    Where-Object {
      $_.status -eq "missing" -and
      ((Get-AvailabilityLabel -ManifestEntry ($selectedEntries | Where-Object { $_.name -eq $_.name } | Select-Object -First 1)) -eq "required")
    }
)

if (($statuses | Where-Object { $_.status -eq "missing" -and $_.availability -eq "required" }).Count -gt 0) {
  exit 1
}

exit 0
