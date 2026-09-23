$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$credentialRunner = Join-Path $env:USERPROFILE '.trading-agent-dashboard\scripts\run-with-credentials.ps1'
$nodePath = (Get-Command node.exe).Source
$scriptPath = Join-Path $projectRoot 'scripts/coordinator-dispatch.js'

& $credentialRunner -Scope deepseek-coordinator -Command $nodePath -Arguments @($scriptPath, 'serve') -Quiet
exit $LASTEXITCODE
