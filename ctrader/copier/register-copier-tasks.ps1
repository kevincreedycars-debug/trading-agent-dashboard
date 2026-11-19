# Registers the two scheduled tasks the copier runs under: the one-minute poll and the slower dashboard read.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File register-copier-tasks.ps1 [-TaskUser DOMAIN\User]
#
# The principal is copied from the relay's existing tasks rather than chosen here: those run as the account whose
# DPAPI store holds the cTrader vault, and a task under another account cannot decrypt it. The poll is registered
# with MultipleInstances = IgnoreNew, so a slow poll is superseded rather than stacked, and the copier's own lock
# is the second guard.
param(
  [string] $TaskUser = $env:USERNAME,
  # The relay's existing tasks run as Administrator with LogonType Interactive: that is the account whose DPAPI
  # store holds the vault, and the default is copied from them rather than chosen here.
  [string] $LogonType = 'Interactive'
)

$ErrorActionPreference = 'Stop'

$pollAction = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\ctrader-relay\copier\copier-poll.ps1"'
$dashboardAction = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\ctrader-relay\copier\copier-dashboard.ps1"'

function Register-One([string] $name, [string] $arguments, [int] $everyMinutes) {
  $action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument ("/c " + $arguments + " >> C:\ProgramData\ctrader-relay\copier\task.out.txt 2>&1") -WorkingDirectory 'C:\ctrader-relay\copier'
  $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $everyMinutes) -RepetitionDuration ([TimeSpan]::MaxValue)
  $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
  $principal = New-ScheduledTaskPrincipal -UserId $TaskUser -LogonType $LogonType -RunLevel Highest
  Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
  Write-Output ("registered {0}: every {1}m as {2}" -f $name, $everyMinutes, $TaskUser)
}

Register-One 'ctrader-copier-poll' $pollAction 1
Register-One 'ctrader-copier-dashboard' $dashboardAction 10
Get-ScheduledTask -TaskName 'ctrader-copier-*' | ForEach-Object {
  $info = Get-ScheduledTaskInfo -TaskName $_.TaskName
  Write-Output ("{0} state={1} next={2}" -f $_.TaskName, $_.State, $info.NextRunTime)
}
