$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$nodePath = (Get-Command node.exe).Source
$scriptPath = Join-Path $projectRoot 'scripts/coordinator-dispatch.js'
& $nodePath $scriptPath enable
if ($LASTEXITCODE -ne 0) { throw 'Could not enable coordinator dispatcher.' }
Start-Process -FilePath $nodePath -ArgumentList @('"' + $scriptPath + '"', 'serve') -WorkingDirectory $projectRoot -WindowStyle Hidden
