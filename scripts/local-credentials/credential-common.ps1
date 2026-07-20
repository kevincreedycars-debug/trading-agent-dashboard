[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

function Get-CredentialPaths {
  param(
    [string]$BaseDir = (Split-Path -Parent $PSScriptRoot),
    [string]$ManifestPath,
    [string]$StorePath,
    [string]$HistoryDir,
    [string]$AuditPath
  )

  $homeDir = $BaseDir
  $resolvedManifestPath = if ($ManifestPath) {
    $ManifestPath
  } else {
    Join-Path $homeDir "config\credential-manifest.json"
  }
  $resolvedStorePath = if ($StorePath) {
    $StorePath
  } else {
    Join-Path $homeDir "secrets\credentials.clixml"
  }
  $resolvedHistoryDir = if ($HistoryDir) {
    $HistoryDir
  } else {
    Join-Path $homeDir "secrets\history-backups"
  }
  $resolvedAuditPath = if ($AuditPath) {
    $AuditPath
  } else {
    Join-Path $homeDir "secrets\migration-audit.json"
  }

  [pscustomobject]@{
    HomeDir = $homeDir
    ManifestPath = $resolvedManifestPath
    StorePath = $resolvedStorePath
    HistoryDir = $resolvedHistoryDir
    AuditPath = $resolvedAuditPath
    StdoutLogPath = Join-Path $homeDir "secrets\clean-child.stdout.log"
    StderrLogPath = Join-Path $homeDir "secrets\clean-child.stderr.log"
  }
}

function Ensure-CredentialDirectories {
  param([psobject]$Paths)

  $directories = @(
    $Paths.HomeDir,
    (Split-Path -Parent $Paths.ManifestPath),
    (Split-Path -Parent $Paths.StorePath),
    $Paths.HistoryDir
  ) | Where-Object { $_ }

  foreach ($directory in $directories | Select-Object -Unique) {
    if (-not (Test-Path -LiteralPath $directory)) {
      New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }
  }
}

function Get-CredentialManifest {
  param([string]$ManifestPath)

  if (-not (Test-Path -LiteralPath $ManifestPath)) {
    throw "Credential manifest not found: $ManifestPath"
  }

  $manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
  $entries = @($manifest.entries)
  if ($entries.Count -eq 0) {
    throw "Credential manifest does not contain any entries."
  }

  return $entries
}

function Get-ApprovedCredentialNames {
  param([object[]]$ManifestEntries)

  @($ManifestEntries | ForEach-Object { $_.name } | Sort-Object -Unique)
}

function Assert-ApprovedCredentialName {
  param(
    [string]$Name,
    [object[]]$ManifestEntries
  )

  if ([string]::IsNullOrWhiteSpace($Name)) {
    throw "Credential name is required."
  }

  $approved = Get-ApprovedCredentialNames -ManifestEntries $ManifestEntries
  if ($approved -notcontains $Name) {
    throw "Unknown credential name '$Name'."
  }
}

function New-EmptyCredentialStore {
  [pscustomobject]@{
    version = "1.0"
    updatedAt = (Get-Date).ToString("o")
    variables = New-Object System.Collections.ArrayList
  }
}

function Assert-ValidCredentialStore {
  param([psobject]$Store)

  if ($null -eq $Store) {
    throw "Credential store is null."
  }
  foreach ($requiredProperty in @("version", "updatedAt", "variables")) {
    if (-not ($Store.PSObject.Properties.Name -contains $requiredProperty)) {
      throw "Credential store is missing property '$requiredProperty'."
    }
  }
  if (-not ($Store.variables -is [System.Collections.IList])) {
    throw "Credential store variables collection must be a list."
  }

  foreach ($entry in @($Store.variables)) {
    foreach ($requiredProperty in @("name", "value", "updatedAt")) {
      if (-not ($entry.PSObject.Properties.Name -contains $requiredProperty)) {
        throw "Credential entry is missing property '$requiredProperty'."
      }
    }
    if (-not ($entry.value -is [securestring])) {
      throw "Credential entry '$($entry.name)' does not contain a SecureString value."
    }
  }
}

function Import-CredentialStore {
  param([string]$StorePath)

  if (-not (Test-Path -LiteralPath $StorePath)) {
    return New-EmptyCredentialStore
  }

  $store = Import-Clixml -LiteralPath $StorePath
  Assert-ValidCredentialStore -Store $store
  return $store
}

function Export-CredentialStore {
  param(
    [psobject]$Store,
    [string]$StorePath
  )

  Assert-ValidCredentialStore -Store $Store
  $Store.updatedAt = (Get-Date).ToString("o")
  $tempPath = "$StorePath.tmp"
  $Store | Export-Clixml -LiteralPath $tempPath -Force
  Move-Item -LiteralPath $tempPath -Destination $StorePath -Force
}

function New-CredentialBackupName {
  param([string]$Prefix = "credentials")

  "{0}-{1}.clixml" -f $Prefix, (Get-Date -Format "yyyyMMdd-HHmmss")
}

function Backup-CredentialStore {
  param(
    [string]$StorePath,
    [string]$HistoryDir,
    [string]$Prefix = "credentials"
  )

  if (-not (Test-Path -LiteralPath $StorePath)) {
    return $null
  }

  if (-not (Test-Path -LiteralPath $HistoryDir)) {
    New-Item -ItemType Directory -Path $HistoryDir -Force | Out-Null
  }

  $backupName = New-CredentialBackupName -Prefix $Prefix
  $destination = Join-Path $HistoryDir $backupName
  Copy-Item -LiteralPath $StorePath -Destination $destination -Force
  return $destination
}

function Get-CredentialEntry {
  param(
    [psobject]$Store,
    [string]$Name
  )

  @($Store.variables | Where-Object { $_.name -eq $Name } | Select-Object -First 1)[0]
}

function Set-CredentialEntry {
  param(
    [psobject]$Store,
    [string]$Name,
    [securestring]$Value
  )

  $entry = Get-CredentialEntry -Store $Store -Name $Name
  if ($null -eq $entry) {
    $entry = [pscustomobject]@{
      name = $Name
      value = $Value
      updatedAt = (Get-Date).ToString("o")
    }
    [void]$Store.variables.Add($entry)
    return
  }

  $entry.value = $Value
  $entry.updatedAt = (Get-Date).ToString("o")
}

function Remove-CredentialEntry {
  param(
    [psobject]$Store,
    [string]$Name
  )

  $entry = Get-CredentialEntry -Store $Store -Name $Name
  if ($null -ne $entry) {
    [void]$Store.variables.Remove($entry)
  }
}

function ConvertFrom-SecureStringPlainText {
  param([securestring]$SecureValue)

  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    if ($bstr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
  }
}

function Resolve-CredentialSelection {
  param(
    [object[]]$ManifestEntries,
    [string[]]$Scope,
    [string[]]$Name
  )

  if ($Name -and $Name.Count -gt 0) {
    foreach ($itemName in $Name) {
      Assert-ApprovedCredentialName -Name $itemName -ManifestEntries $ManifestEntries
    }
    return @($ManifestEntries | Where-Object { $Name -contains $_.name } | Sort-Object name -Unique)
  }

  $requestedScopes = if ($Scope -and $Scope.Count -gt 0) {
    @($Scope | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Sort-Object -Unique)
  } else {
    @("all")
  }

  foreach ($itemScope in $requestedScopes) {
    if ($itemScope -notin @("n8n", "backtester", "market-importers", "all")) {
      throw "Unsupported scope '$itemScope'."
    }
  }

  if ($requestedScopes -contains "all") {
    return @($ManifestEntries | Sort-Object name -Unique)
  }

  @(
    $ManifestEntries |
      Where-Object { @($_.required_for | Where-Object { $requestedScopes -contains $_ }).Count -gt 0 } |
      Sort-Object name -Unique
  )
}

function Get-AvailabilityLabel {
  param([object]$ManifestEntry)

  if ($ManifestEntry.PSObject.Properties.Name -contains "availability" -and $ManifestEntry.availability) {
    return [string]$ManifestEntry.availability
  }

  if ($ManifestEntry.required) {
    return "required"
  }

  return "optional"
}

function Test-RequiredCredentialMissing {
  param([object]$ManifestEntry)

  (Get-AvailabilityLabel -ManifestEntry $ManifestEntry) -eq "required"
}

function Write-ChildRunLogs {
  param(
    [psobject]$Paths,
    [object[]]$Statuses,
    [string]$Command,
    [int]$ExitCode,
    [bool]$Success
  )

  $stdoutLines = New-Object System.Collections.Generic.List[string]
  foreach ($status in $Statuses) {
    $stdoutLines.Add(("{0} | {1} | {2}" -f $status.name, $status.status, $status.availability))
  }
  $stdoutLines.Add(("child | {0} | {1}" -f $(if ($Success) { "success" } else { "failure" }), (Split-Path -Leaf $Command)))

  Set-Content -LiteralPath $Paths.StdoutLogPath -Value $stdoutLines -Encoding UTF8

  $stderrLines = @()
  if (-not $Success) {
    $stderrLines = @("child_exit_code=$ExitCode")
  }
  Set-Content -LiteralPath $Paths.StderrLogPath -Value $stderrLines -Encoding UTF8
}

function Update-MigrationAudit {
  param(
    [string]$AuditPath,
    [string]$VariableName,
    [string]$SourceFile
  )

  $audit = if (Test-Path -LiteralPath $AuditPath) {
    try {
      Get-Content -Raw -LiteralPath $AuditPath | ConvertFrom-Json
    } catch {
      [pscustomobject]@{}
    }
  } else {
    [pscustomobject]@{}
  }

  if (-not ($audit.PSObject.Properties.Name -contains "credentialMigrations")) {
    Add-Member -InputObject $audit -NotePropertyName credentialMigrations -NotePropertyValue @()
  }

  $migrations = New-Object System.Collections.ArrayList
  foreach ($entry in @($audit.credentialMigrations)) {
    [void]$migrations.Add($entry)
  }
  [void]$migrations.Add([pscustomobject]@{
    migratedAt = (Get-Date).ToString("o")
    variableName = $VariableName
    sourceFile = $SourceFile
  })
  $audit.credentialMigrations = @($migrations)

  $audit | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $AuditPath -Encoding UTF8
}
