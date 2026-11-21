[CmdletBinding()]
param(
  [string]$Name = "USD L1 paired controller webhook",
  [string]$HeaderName = "X-USD-L1-Token",
  [switch]$Rotate
)

# Restores the authenticated webhook credential for the USD Layer 1 paired controller.
#
# The secret is generated here, stored only in the encrypted local CLIXML credential store, and sent to
# n8n's credential API. The token is never printed, never written to the repository and never placed in a
# dashboard artefact; only the n8n credential id is reported, and that id is safe to commit.
#
# Research tooling only: this creates a header-auth credential and nothing else. It does not activate a
# workflow, place an order or touch a live trading path.

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "local-credentials\credential-common.ps1")

$root = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $root "config\credential-manifest.json"
$storePath = Join-Path $HOME ".trading-agent-dashboard\secrets\credentials.clixml"
$historyDir = Join-Path $HOME ".trading-agent-dashboard\secrets\history-backups"
$paths = Get-CredentialPaths -ManifestPath $manifestPath -StorePath $storePath -HistoryDir $historyDir
Ensure-CredentialDirectories -Paths $paths
$manifestEntries = Get-CredentialManifest -ManifestPath $paths.ManifestPath
Assert-ApprovedCredentialName -Name "USD_L1_WEBHOOK_TOKEN" -ManifestEntries $manifestEntries

$store = Import-CredentialStore -StorePath $paths.StorePath
$existing = Get-CredentialEntry -Store $store -Name "USD_L1_WEBHOOK_TOKEN"
if ($null -ne $existing -and -not $Rotate) {
  Write-Output ([pscustomobject]@{
      ok = $true
      action = "unchanged"
      reason = "a webhook token is already stored; pass -Rotate to replace it and create a new n8n credential"
    } | ConvertTo-Json -Depth 5)
  exit 0
}

# 48 random bytes, base64url, so the header value is not guessable and survives JSON transport.
$bytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$token = [Convert]::ToBase64String($bytes).Replace("+", "-").Replace("/", "_").Replace("=", "")

$body = [pscustomobject]@{
  name = $Name
  type = "httpHeaderAuth"
  data = [pscustomobject]@{
    name = $HeaderName
    value = $token
  }
}
$bodyFile = Join-Path ([System.IO.Path]::GetTempPath()) ("usd-l1-credential-" + [guid]::NewGuid().ToString("N") + ".json")
try {
  $body | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $bodyFile -Encoding UTF8
  $responseText = & (Join-Path $PSScriptRoot "n8n_api_call.ps1") -Action CreateCredential -BodyFile $bodyFile -Full
  $response = $responseText | ConvertFrom-Json
} finally {
  if (Test-Path -LiteralPath $bodyFile) { Remove-Item -LiteralPath $bodyFile -Force }
}

if (-not $response.id) {
  throw "n8n did not return a credential id: $responseText"
}

$backupPath = Backup-CredentialStore -StorePath $paths.StorePath -HistoryDir $paths.HistoryDir -Prefix "credentials"
Set-CredentialEntry -Store $store -Name "USD_L1_WEBHOOK_TOKEN" -Value (ConvertTo-SecureString -String $token -AsPlainText -Force)
Export-CredentialStore -Store $store -StorePath $paths.StorePath

Write-Output ([pscustomobject]@{
    ok = $true
    action = if ($existing) { "rotated" } else { "created" }
    credential_id = $response.id
    credential_name = $response.name
    header_name = $HeaderName
    stored_as = "USD_L1_WEBHOOK_TOKEN"
    store = $paths.StorePath
    backup = $backupPath
    next = "rebuild with USD_L1_WEBHOOK_CREDENTIAL_ID=$($response.id) and import the parent workflow"
  } | ConvertTo-Json -Depth 5)
