$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$nodePath = (Get-Command node.exe).Source
$scriptPath = Join-Path $projectRoot 'scripts/coordinator-dispatch.js'
$credentialValidator = Join-Path $env:USERPROFILE '.trading-agent-dashboard\scripts\validate-credentials.ps1'
$daemonRunner = Join-Path $PSScriptRoot 'run-coordinator.ps1'
if (-not (Test-Path -LiteralPath $credentialValidator)) { throw "Credential validator not found: $credentialValidator" }
if (-not (Test-Path -LiteralPath $daemonRunner)) { throw "Coordinator runner not found: $daemonRunner" }
& $credentialValidator -Scope deepseek-coordinator -Quiet
if ($LASTEXITCODE -ne 0) { throw 'DEEPSEEK_API_KEY is missing; coordinator remains disabled.' }
& $nodePath $scriptPath enable
if ($LASTEXITCODE -ne 0) { throw 'Could not enable coordinator dispatcher.' }
Start-Process -FilePath 'powershell.exe' -ArgumentList @(
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $daemonRunner + '"')
) -WorkingDirectory $projectRoot -WindowStyle Hidden
