$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$exe = Join-Path $projectRoot '.local/project-monitor/ProjectMonitor.exe'
if (!(Test-Path -LiteralPath $exe)) { & (Join-Path $PSScriptRoot 'build.ps1') }
$node = (Get-Command node.exe -ErrorAction Stop).Source
# This is the explicitly requested interactive panel, not a background helper.
Start-Process -FilePath $exe -ArgumentList @('"' + $projectRoot + '"', '"' + $node + '"') -WindowStyle Normal
