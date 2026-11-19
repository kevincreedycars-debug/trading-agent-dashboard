# The published read behind the Live cTrader Copier tab: one broker read, one document, one data commit.
#
# Three steps, each of which can refuse without taking the others down:
#   1. snapshot   a read-only pass over the cTrader account through the relay's adapter
#   2. build      the dashboard document from that snapshot plus the copier's health and mapping store
#   3. publish    the same publisher engine the live feed uses, with this document's own validator
#
# The publisher holds its own lock and checkout, resets that checkout to the remote branch, refuses a document
# older than the served copy and enforces its own cadence; a refused publish leaves the previous page in place.
$ErrorActionPreference = 'Continue'
$root = 'C:\ProgramData\ctrader-relay\copier'
$tools = 'C:\ctrader-relay\copier-tools'
$outFile = Join-Path $root 'dashboard.out.txt'
$stamp = (Get-Date).ToUniversalTime().ToString('o')
$lines = @("== dashboard $stamp")

function Step([string] $name, [string[]] $nodeArgs) {
  $output = & 'C:\Program Files\nodejs\node.exe' @nodeArgs 2>&1
  $code = $LASTEXITCODE
  $script:lines += ("-- {0} exit={1}" -f $name, $code)
  $script:lines += ($output | ForEach-Object { "   $_" })
  return $code
}

$snapshotCode = Step 'snapshot' @(
  'C:\ctrader-relay\copier-snapshot.js',
  '--vault', 'C:\ProgramData\ctrader-relay\secrets\ctrader.vault.json',
  '--login', '7348195',
  '--confirm-account', '42585819',
  '--symbols', "$root\symbols.json",
  '--out', "$root\snapshot.json",
  '--days', '30'
)

if ($snapshotCode -eq 0) {
  $buildCode = Step 'build' @(
    "$tools\scripts\build-live-ctrader-copier.js",
    '--snapshot', "$root\snapshot.json",
    '--health', "$root\health.json",
    '--state', "$root\mappings.json",
    '--symbol-map', "$root\symbols.json",
    '--out', "$root\dashboard.json",
    '--lane', 'ftmo-1',
    '--lane-label', 'FTMO account 1',
    '--account-login-masked', '***614',
    '--account-server', 'FTMO-Server',
    '--login', '7348195',
    '--probe', 'C:\ctrader-relay\live-trading-positions-probe.py',
    '--window-days', '30',
    '--stale-seconds', '1800',
    '--heartbeat-stale-seconds', '1500',
    '--schedule-cadence-seconds', '60',
    '--json'
  )
  if ($buildCode -eq 0) {
    $publishCode = Step 'publish' @(
      "$tools\scripts\publish-ctrader-copier.js",
      '--feed', "$root\dashboard.json",
      '--checkout', 'C:\live-trading\ctrader-publish',
      '--state', "$root\publish-state.json",
      '--min-interval-seconds', '1200'
    )
    $lines += ("== publish exit {0}" -f $publishCode)
  }
}
Set-Content -LiteralPath $outFile -Value ($lines -join "`n") -Encoding UTF8
