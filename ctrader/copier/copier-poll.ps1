# One scheduled poll of the copier, as the task runs it: the same command line the hand-run copier-once.ps1 used,
# now with a symbols file so the index is mapped rather than guessed, and with every line it prints kept in a file
# because a scheduled process's stdout is otherwise swallowed.
#
# The copier takes its own lock and exits when another run holds it, and the task is registered with IgnoreNew, so
# two polls cannot overlap. A lock left by a dead process is taken over on the next run: the mapping store, not
# the lock, is the dedupe key.
$ErrorActionPreference = 'Continue'
$root = 'C:\ProgramData\ctrader-relay\copier'
if (-not (Test-Path -LiteralPath $root)) { New-Item -ItemType Directory -Path $root -Force | Out-Null }
$outFile = Join-Path $root 'poll.out.txt'
$logFile = Join-Path $root 'poll.log'
$copierArgs = @(
  'C:\ctrader-relay\CTRADER_COPIER_20261119.js',
  '--vault', 'C:\ProgramData\ctrader-relay\secrets\ctrader.vault.json',
  '--login', '7348195',
  '--confirm-account', '42585819',
  '--state', "$root\mappings.json",
  '--health', "$root\health.json",
  '--lock', "$root\copier.lock",
  '--kill-switch', "$root\STOP",
  '--source-terminal', 'C:\Program Files\FTMO Global Markets MT5 Terminal',
  '--probe', 'C:\ctrader-relay\live-trading-positions-probe.py',
  '--python', 'python',
  '--symbols', "$root\symbols.json",
  '--max-lots', '0.5',
  '--max-open', '4',
  '--interval-seconds', '60',
  '--once'
)
$started = (Get-Date).ToUniversalTime()
$out = & 'C:\Program Files\nodejs\node.exe' @copierArgs 2>&1
$code = $LASTEXITCODE
$stamp = $started.ToString('o')
Set-Content -LiteralPath $outFile -Value (@("== poll $stamp", ($out -join "`n"), "== exit $code") -join "`n") -Encoding UTF8
$summary = ($out | Select-Object -Last 1)
Add-Content -LiteralPath $logFile -Value ("{0} exit={1} {2}" -f $stamp, $code, $summary) -Encoding UTF8
# Keep the append-only log bounded: the health file is the state, this is only the last few hundred runs.
$lines = @(Get-Content -LiteralPath $logFile -ErrorAction SilentlyContinue)
if ($lines.Count -gt 2000) { Set-Content -LiteralPath $logFile -Value ($lines[($lines.Count - 2000)..($lines.Count - 1)]) -Encoding UTF8 }
