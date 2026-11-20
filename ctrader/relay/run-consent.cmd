@echo off
rem Starts the consent listener with no secret on any command line: the app credentials come from the sealed
rem vault, which put-app filled first. Output goes to a log beside the vault so any session can read the link.
rem Optional first argument is the wait in seconds; the default is 30 minutes.
setlocal
set WAIT=%~1
if "%WAIT%"=="" set WAIT=1800
"C:\Program Files\nodejs\node.exe" "C:\ctrader-relay\CTRADER_CONSENT_20261115.js" --vault "C:\ProgramData\ctrader-relay\secrets\ctrader.vault.json" --wait-seconds %WAIT% > "C:\ProgramData\ctrader-relay\consent-out.log" 2>&1
