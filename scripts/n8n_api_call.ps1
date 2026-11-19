[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet(
    "ListWorkflows", "GetWorkflow", "CreateWorkflow", "UpdateWorkflow", "DeleteWorkflow",
    "ActivateWorkflow", "DeactivateWorkflow", "CreateCredential", "DeleteCredential",
    "GetCredentialSchema", "ListExecutions", "GetExecution"
  )]
  [string]$Action,
  [string]$Id,
  [string]$BodyFile,
  [string]$Query,
  [string]$OutputFile,
  [switch]$Full
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "local-credentials\\credential-common.ps1")

$manifestPath = Join-Path (Split-Path -Parent $PSScriptRoot) "config\\credential-manifest.json"
$storePath = Join-Path $HOME ".trading-agent-dashboard\\secrets\\credentials.clixml"
$paths = Get-CredentialPaths -ManifestPath $manifestPath -StorePath $storePath
$manifestEntries = Get-CredentialManifest -ManifestPath $paths.ManifestPath
$selected = Resolve-CredentialSelection -ManifestEntries $manifestEntries -Scope @("n8n") -Name $null
$store = Import-CredentialStore -StorePath $paths.StorePath

function Get-StoredPlainText([string]$Name) {
  $entry = Get-CredentialEntry -Store $store -Name $Name
  if ($null -eq $entry) { throw "credential $Name is not present in the local store" }
  return ConvertFrom-SecureStringPlainText -SecureValue $entry.value
}

$base = (Get-StoredPlainText "N8N_BASE_URL").TrimEnd("/")
$apiKey = Get-StoredPlainText "N8N_API_KEY"
$headers = @{
  "X-N8N-API-KEY" = $apiKey
  "Accept" = "application/json"
}

$segments = switch ($Action) {
  "ListWorkflows"      { @("workflows") }
  "GetWorkflow"        { @("workflows", [uri]::EscapeDataString($Id)) }
  "CreateWorkflow"     { @("workflows") }
  "UpdateWorkflow"     { @("workflows", [uri]::EscapeDataString($Id)) }
  "DeleteWorkflow"     { @("workflows", [uri]::EscapeDataString($Id)) }
  "ActivateWorkflow"   { @("workflows", [uri]::EscapeDataString($Id), "activate") }
  "DeactivateWorkflow" { @("workflows", [uri]::EscapeDataString($Id), "deactivate") }
  "CreateCredential"   { @("credentials") }
  "DeleteCredential"   { @("credentials", [uri]::EscapeDataString($Id)) }
  "GetCredentialSchema" { @("credentials", "schema", [uri]::EscapeDataString($Id)) }
  "ListExecutions"     { @("executions") }
  "GetExecution"       { @("executions", [uri]::EscapeDataString($Id)) }
}

$method = switch ($Action) {
  "CreateWorkflow"     { "POST" }
  "UpdateWorkflow"     { "PUT" }
  "DeleteWorkflow"     { "DELETE" }
  "ActivateWorkflow"   { "POST" }
  "DeactivateWorkflow" { "POST" }
  "CreateCredential"   { "POST" }
  "DeleteCredential"   { "DELETE" }
  default              { "GET" }
}

$uri = "$base/api/v1/" + ($segments -join "/")
if ($Action -eq "ListExecutions" -and -not $Query) {
  $Query = "limit=250&includeData=false"
}
if ($Query) { $uri = "$uri`?$Query" }

$invoke = @{
  Uri = $uri
  Method = $method
  Headers = $headers
  ErrorAction = "Stop"
}

if ($BodyFile) {
  if (-not (Test-Path -LiteralPath $BodyFile)) { throw "body file not found: $BodyFile" }
  $invoke.ContentType = "application/json"
  $invoke.Body = Get-Content -Raw -LiteralPath $BodyFile
} elseif ($Action -in @("ActivateWorkflow", "DeactivateWorkflow")) {
  $invoke.ContentType = "application/json"
  $invoke.Body = "{}"
}

try {
  $response = Invoke-RestMethod @invoke
} catch {
  $status = $null
  if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
  $detail = $_.ErrorDetails.Message
  if (-not $detail -and $_.Exception.Response) {
    try {
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $detail = $reader.ReadToEnd()
    } catch { }
  }
  $failure = [pscustomobject]@{
    ok = $false
    action = $Action
    status = $status
    error = $_.Exception.Message
    detail = $detail
  }
  $json = $failure | ConvertTo-Json -Depth 20
  if ($OutputFile) { Set-Content -LiteralPath $OutputFile -Value $json -Encoding UTF8 }
  Write-Output $json
  exit 1
}

$safe = $response
if (-not $Full) {
  switch ($Action) {
    "ListWorkflows" {
      $safe = [pscustomobject]@{
        data = @($response.data | ForEach-Object { [pscustomobject]@{ id = $_.id; name = $_.name; active = $_.active } })
        nextCursor = $response.nextCursor
      }
    }
    "GetWorkflow" {
      $safe = [pscustomobject]@{
        id = $response.id
        name = $response.name
        active = $response.active
        updatedAt = $response.updatedAt
        node_count = @($response.nodes).Count
        nodes = @($response.nodes | ForEach-Object { [pscustomobject]@{ name = $_.name; type = $_.type } })
      }
    }
    "CreateWorkflow" {
      $safe = [pscustomobject]@{ id = $response.id; name = $response.name; active = $response.active }
    }
    "UpdateWorkflow" {
      $safe = [pscustomobject]@{ id = $response.id; name = $response.name; active = $response.active; updatedAt = $response.updatedAt }
    }
    "CreateCredential" {
      $safe = [pscustomobject]@{ id = $response.id; name = $response.name; type = $response.type }
    }
    "ListExecutions" {
      $safe = [pscustomobject]@{
        data = @($response.data | ForEach-Object {
          [pscustomobject]@{
            id = $_.id
            workflowId = $_.workflowId
            status = $_.status
            mode = $_.mode
            startedAt = $_.startedAt
            stoppedAt = $_.stoppedAt
            finished = $_.finished
          }
        })
        nextCursor = $response.nextCursor
      }
    }
  }
}

$json = $safe | ConvertTo-Json -Depth 100
if ($OutputFile) { Set-Content -LiteralPath $OutputFile -Value $json -Encoding UTF8 }
Write-Output $json
