$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$outputDirectory = Join-Path $projectRoot '.local/project-monitor'
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (!(Test-Path -LiteralPath $compiler)) { throw 'The Windows .NET Framework C# compiler is unavailable.' }
& $compiler /nologo /codepage:65001 /target:winexe /optimize+ "/out:$outputDirectory/ProjectMonitor.exe" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll (Join-Path $PSScriptRoot 'ProjectMonitor.cs')
if ($LASTEXITCODE -ne 0) { throw 'Project monitor build failed.' }
Write-Output (Join-Path $outputDirectory 'ProjectMonitor.exe')
