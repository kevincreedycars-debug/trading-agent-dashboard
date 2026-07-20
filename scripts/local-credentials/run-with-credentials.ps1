[CmdletBinding()]
param(
  [string[]]$Scope = @("all"),
  [string[]]$Name,
  [Parameter(Mandatory = $true)]
  [string]$Command,
  [string[]]$Arguments,
  [string]$ManifestPath,
  [string]$StorePath,
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"

$invokeArgs = @{
  Command = $Command
  Quiet = $Quiet
}

if ($Scope -and $Scope.Count -gt 0) {
  $invokeArgs.Scope = $Scope
}
if ($Name -and $Name.Count -gt 0) {
  $invokeArgs.Name = $Name
}
if ($PSBoundParameters.ContainsKey("ManifestPath")) {
  $invokeArgs.ManifestPath = $ManifestPath
}
if ($PSBoundParameters.ContainsKey("StorePath")) {
  $invokeArgs.StorePath = $StorePath
}
if ($PSBoundParameters.ContainsKey("Arguments")) {
  $invokeArgs.Arguments = $Arguments
}

& (Join-Path $PSScriptRoot "load-credentials.ps1") @invokeArgs

exit $LASTEXITCODE
