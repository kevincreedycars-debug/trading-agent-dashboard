[CmdletBinding()]
param(
  [ValidateSet("full", "staged")]
  [string]$Mode = "full",
  [string[]]$Path,
  [string]$AllowlistPath,
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"
$script:ScannerRoot = if ($PSScriptRoot) {
  $PSScriptRoot
} elseif ($PSCommandPath) {
  Split-Path -Parent $PSCommandPath
} else {
  (Get-Location).Path
}

if ([string]::IsNullOrWhiteSpace($AllowlistPath)) {
  $AllowlistPath = Join-Path $script:ScannerRoot "..\config\secret-scan-allowlist.json"
}

function Get-RepoRoot {
  (Resolve-Path (Join-Path $script:ScannerRoot "..")).Path
}

function Invoke-GitText {
  param(
    [string]$RepoRoot,
    [string[]]$Arguments
  )

  $output = & git -c core.excludesfile=NUL -C $RepoRoot @Arguments 2>$null
  if ($LASTEXITCODE -ne 0) {
    return $null
  }

  if ($null -eq $output) {
    return ""
  }

  return [string]::Join("`n", @($output))
}

function Get-AllowlistRules {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return @()
  }

  $raw = Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
  if ($null -eq $raw -or $null -eq $raw.rules) {
    return @()
  }

  return @($raw.rules)
}

function Get-Patterns {
  @(
    @{
      Id = "private-key-header"
      Description = "Private key header"
      Regex = '-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'
    },
    @{
      Id = "github-pat"
      Description = "GitHub personal access token"
      Regex = '(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}'
    },
    @{
      Id = "assignment-known-secret"
      Description = "Assignment to a secret-like variable name"
      Regex = '(?i)\b(?:N8N_API_KEY|SUPABASE_SERVICE_ROLE_KEY|FRED_API_KEY|RAPIDAPI_KEY|ALPHA_VANTAGE_API_KEY|OANDA_API_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY|API_KEY|SECRET|TOKEN|PASSWORD)\b\s*[:=]\s*[''"]?[A-Za-z0-9_./+\-=]{12,}'
    },
    @{
      Id = "service-role-assignment"
      Description = "Supabase service-role assignment"
      Regex = '(?i)\bservice[_-]?role\b.{0,40}[:=].{0,200}'
    },
    @{
      Id = "bearer-literal"
      Description = "Bearer token literal"
      Regex = '(?i)Bearer\s+[A-Za-z0-9\-_.=]{20,}'
    },
    @{
      Id = "env-file-secret"
      Description = "Secret-bearing .env assignment"
      Regex = '(?i)^(?:export\s+)?[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*\s*=\s*.+$'
    }
  )
}

function Test-Allowlisted {
  param(
    [string]$RelativePath,
    [string]$LineText,
    [object[]]$Rules
  )

  foreach ($rule in $Rules) {
    $pathMatch = $true
    $lineMatch = $true

    if ($rule.PSObject.Properties.Name -contains "path_regex" -and $rule.path_regex) {
      $pathMatch = $RelativePath -match $rule.path_regex
    }

    if ($rule.PSObject.Properties.Name -contains "line_regex" -and $rule.line_regex) {
      $lineMatch = $LineText -match $rule.line_regex
    }

    if ($pathMatch -and $lineMatch) {
      return $true
    }
  }

  return $false
}

function Get-StagedPaths {
  param([string]$RepoRoot)

  $output = Invoke-GitText -RepoRoot $RepoRoot -Arguments @("diff", "--cached", "--name-only", "--diff-filter=ACMR")
  if ([string]::IsNullOrEmpty($output)) {
    return @()
  }

  @($output -split "`r?`n" | Where-Object { $_ })
}

function Get-TrackedPaths {
  param([string]$RepoRoot)

  $output = Invoke-GitText -RepoRoot $RepoRoot -Arguments @("ls-files")
  if ([string]::IsNullOrEmpty($output)) {
    return @()
  }

  @($output -split "`r?`n" | Where-Object { $_ })
}

function Resolve-TargetPath {
  param(
    [string]$RepoRoot,
    [string]$InputPath
  )

  if ([string]::IsNullOrWhiteSpace($InputPath)) {
    return $null
  }

  if ([System.IO.Path]::IsPathRooted($InputPath)) {
    if (-not (Test-Path -LiteralPath $InputPath -PathType Leaf)) {
      return $null
    }

    $resolved = (Resolve-Path -LiteralPath $InputPath).Path
    $repoPrefix = $RepoRoot.TrimEnd("\") + "\"
    if ($resolved.StartsWith($repoPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      return $resolved.Substring($repoPrefix.Length) -replace "\\", "/"
    }

    return $resolved
  }

  $combined = Join-Path $RepoRoot $InputPath
  if (Test-Path -LiteralPath $combined -PathType Leaf) {
    $resolvedCombined = (Resolve-Path -LiteralPath $combined).Path
    $repoPrefix = $RepoRoot.TrimEnd("\") + "\"
    if ($resolvedCombined.StartsWith($repoPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      return $resolvedCombined.Substring($repoPrefix.Length) -replace "\\", "/"
    }
  }

  return ($InputPath -replace "\\", "/")
}

function Get-NormalizedTargets {
  param(
    [string]$RepoRoot,
    [string[]]$RequestedPath,
    [string]$Mode
  )

  if ($RequestedPath -and $RequestedPath.Count -gt 0) {
    $resolved = foreach ($item in $RequestedPath) {
      $target = Resolve-TargetPath -RepoRoot $RepoRoot -InputPath $item
      if ($target) {
        $target
      }
    }
    return @($resolved | Select-Object -Unique)
  }

  if ($Mode -eq "staged") {
    return @(Get-StagedPaths -RepoRoot $RepoRoot)
  }

  return @(Get-TrackedPaths -RepoRoot $RepoRoot)
}

function Test-ByteArrayBinary {
  param([byte[]]$Bytes)

  if ($null -eq $Bytes -or $Bytes.Length -eq 0) {
    return $false
  }

  return $Bytes -contains 0
}

function Get-WorkingTreeText {
  param(
    [string]$RepoRoot,
    [string]$RelativePath
  )

  $fullPath = if ([System.IO.Path]::IsPathRooted($RelativePath)) {
    $RelativePath
  } else {
    Join-Path $RepoRoot ($RelativePath -replace "/", "\")
  }

  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
    return $null
  }

  $bytes = [System.IO.File]::ReadAllBytes($fullPath)
  if (Test-ByteArrayBinary -Bytes $bytes) {
    return $null
  }

  [System.Text.Encoding]::UTF8.GetString($bytes)
}

function Test-StagedBinary {
  param(
    [string]$RepoRoot,
    [string]$RelativePath
  )

  $output = Invoke-GitText -RepoRoot $RepoRoot -Arguments @("diff", "--cached", "--numstat", "--", $RelativePath)
  if ([string]::IsNullOrEmpty($output)) {
    return $false
  }

  $firstLine = ($output -split "`r?`n" | Where-Object { $_ } | Select-Object -First 1)
  if ([string]::IsNullOrEmpty($firstLine)) {
    return $false
  }

  $parts = $firstLine -split "`t"
  if ($parts.Count -lt 3) {
    return $false
  }

  return $parts[0] -eq "-" -and $parts[1] -eq "-"
}

function Get-StagedText {
  param(
    [string]$RepoRoot,
    [string]$RelativePath
  )

  if (Test-StagedBinary -RepoRoot $RepoRoot -RelativePath $RelativePath) {
    return $null
  }

  Invoke-GitText -RepoRoot $RepoRoot -Arguments @("show", "--no-textconv", ":$RelativePath")
}

function Get-FileText {
  param(
    [string]$RepoRoot,
    [string]$RelativePath,
    [string]$Mode
  )

  if ($Mode -eq "staged") {
    return Get-StagedText -RepoRoot $RepoRoot -RelativePath $RelativePath
  }

  return Get-WorkingTreeText -RepoRoot $RepoRoot -RelativePath $RelativePath
}

$repoRoot = Get-RepoRoot
$allowlistRules = Get-AllowlistRules -Path $AllowlistPath
$patterns = Get-Patterns
$targets = Get-NormalizedTargets -RepoRoot $repoRoot -RequestedPath $Path -Mode $Mode
$issues = New-Object System.Collections.Generic.List[object]

foreach ($targetPath in $targets) {
  $normalizedPath = $targetPath -replace "\\", "/"
  $text = Get-FileText -RepoRoot $repoRoot -RelativePath $targetPath -Mode $Mode
  if ($null -eq $text) {
    continue
  }

  $lines = @($text -split "`r?`n")
  for ($lineIndex = 0; $lineIndex -lt $lines.Count; $lineIndex += 1) {
    $lineText = $lines[$lineIndex]
    if (Test-Allowlisted -RelativePath $normalizedPath -LineText $lineText -Rules $allowlistRules) {
      continue
    }

    foreach ($pattern in $patterns) {
      if ($lineText -match $pattern.Regex) {
        $issues.Add([pscustomobject]@{
          Path = $normalizedPath
          Line = $lineIndex + 1
          Pattern = $pattern.Id
          Description = $pattern.Description
        })
      }
    }
  }
}

if (-not $Quiet) {
  if ($issues.Count -eq 0) {
    Write-Output "No likely private secrets detected."
  } else {
    Write-Output "Potential private secret material detected:"
    $issues |
      Sort-Object Path, Line, Pattern |
      Format-Table Path, Line, Pattern, Description -AutoSize
  }
}

if ($issues.Count -gt 0) {
  exit 1
}

exit 0
