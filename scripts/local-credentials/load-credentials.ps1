[CmdletBinding()]
param(
  [string[]]$Scope = @("all"),
  [string[]]$Name,
  [string]$ManifestPath,
  [string]$StorePath,
  [string]$Command,
  [string[]]$Arguments,
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "credential-common.ps1")
$processScope = [System.EnvironmentVariableTarget]::Process

$paths = Get-CredentialPaths -ManifestPath $ManifestPath -StorePath $StorePath
$manifestEntries = Get-CredentialManifest -ManifestPath $paths.ManifestPath
$selectedEntries = Resolve-CredentialSelection -ManifestEntries $manifestEntries -Scope $Scope -Name $Name
$store = Import-CredentialStore -StorePath $paths.StorePath

$statuses = New-Object System.Collections.Generic.List[object]
$originalValues = @{}

foreach ($entry in $selectedEntries) {
  $storedEntry = Get-CredentialEntry -Store $store -Name $entry.name
  $availability = Get-AvailabilityLabel -ManifestEntry $entry
  if ($null -eq $storedEntry) {
    $statuses.Add([pscustomobject]@{
      name = $entry.name
      availability = $availability
      status = "missing"
    })
    continue
  }

  $originalValues[$entry.name] = [Environment]::GetEnvironmentVariable($entry.name, $processScope)
  $plainText = ConvertFrom-SecureStringPlainText -SecureValue $storedEntry.value
  [Environment]::SetEnvironmentVariable($entry.name, $plainText, $processScope)
  $statuses.Add([pscustomobject]@{
    name = $entry.name
    availability = $availability
    status = "loaded"
  })
}

$missingRequired = @($statuses | Where-Object { $_.status -eq "missing" -and $_.availability -eq "required" })
if ($missingRequired.Count -gt 0) {
  foreach ($entry in $selectedEntries) {
    if ($originalValues.ContainsKey($entry.name)) {
      [Environment]::SetEnvironmentVariable($entry.name, [string]$originalValues[$entry.name], $processScope)
    }
  }

  if (-not $Quiet) {
    $statuses | ConvertTo-Json -Depth 6
  }
  exit 1
}

$childExitCode = 0
$childSucceeded = $true

try {
  if ($Command) {
    & $Command @($Arguments)
    $childExitCode = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
    if ($childExitCode -ne 0) {
      $childSucceeded = $false
    }
  }
} finally {
  $statusSnapshot = @($statuses.ToArray())
  foreach ($entry in $selectedEntries) {
    if ($originalValues.ContainsKey($entry.name)) {
      [Environment]::SetEnvironmentVariable($entry.name, [string]$originalValues[$entry.name], $processScope)
    } else {
      [Environment]::SetEnvironmentVariable($entry.name, ([string]$null), $processScope)
    }
  }

  Write-ChildRunLogs -Paths $paths -Statuses $statusSnapshot -Command $(if ($Command) { $Command } else { "none" }) -ExitCode $childExitCode -Success $childSucceeded
}

if (-not $Quiet) {
  [pscustomobject]@{
    statuses = @($statuses.ToArray())
    command = $Command
    child_exit_code = $childExitCode
  } | ConvertTo-Json -Depth 6
}

exit $childExitCode
