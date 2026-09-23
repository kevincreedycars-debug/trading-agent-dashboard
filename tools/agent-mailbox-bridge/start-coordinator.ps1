$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$nodePath = (Get-Command node.exe).Source
$scriptPath = Join-Path $projectRoot 'scripts/coordinator-dispatch.js'
$credentialRunner = Join-Path $env:USERPROFILE '.trading-agent-dashboard\scripts\run-with-credentials.ps1'
$credentialValidator = Join-Path $env:USERPROFILE '.trading-agent-dashboard\scripts\validate-credentials.ps1'
if (-not (Test-Path -LiteralPath $credentialRunner)) { throw "Credential runner not found: $credentialRunner" }
if (-not (Test-Path -LiteralPath $credentialValidator)) { throw "Credential validator not found: $credentialValidator" }
& $credentialValidator -Scope deepseek-coordinator -Quiet
if ($LASTEXITCODE -ne 0) { throw 'DEEPSEEK_API_KEY is missing; coordinator remains disabled.' }
& $nodePath $scriptPath enable
if ($LASTEXITCODE -ne 0) { throw 'Could not enable coordinator dispatcher.' }
$launchArgs = @(
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $credentialRunner + '"'),
  '-Scope', 'deepseek-coordinator', '-Command', ('"' + $nodePath + '"'),
  '-Arguments', ('"' + $scriptPath + '"'), 'serve', '-Quiet'
)
Start-Process -FilePath 'powershell.exe' -ArgumentList $launchArgs -WorkingDirectory $projectRoot -WindowStyle Hidden
