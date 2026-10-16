# The close link's own handler: what Windows runs when a reader presses "Close now on this PC" in the live
# dashboard's Open positions table.
#
# The page hands over one thing - a URL of the form `l2lclose:<ticket>` - and everything else is here. Three
# rules make that hand-over safe to offer from a page anyone can load:
#
#   1. the ticket is read out of the URL and nothing else is: a URL that is not one whole ticket number sends
#      nothing and says so;
#   2. the ticket is shown in a confirmation box naming it, and No is the default: no box, no send;
#   3. the send is the trading loop's own hand-close (`--close-ticket <n> --once --confirm-live`), so the
#      ticket still has to carry this lane's own magic. A ticket belonging to another path, or to nothing at
#      all, is answered `nothing_to_close` by the loop and the account is untouched.
#
# `-Yes` skips the box and exists for a hand test of this chain, never for the browser: the registered command
# passes only the URL and the runner, so a page cannot add a switch.
param(
  [Parameter(Mandatory = $true)][string]$Url,
  [Parameter(Mandatory = $true)][string]$Runner,
  [switch]$Yes
)

$ErrorActionPreference = "Stop"

# The one thing the page controls: the ticket. Anything that is not one whole positive number is refused here,
# before the terminal, the loop or the account is reached at all.
$ticketText = ($Url -replace '^[^:]*:', '') -replace '^/{1,2}', ''
$ticketText = $ticketText.Trim().TrimEnd('/')
$ticket = 0
if (-not [int]::TryParse($ticketText, [ref]$ticket) -or $ticket -le 0) {
  $message = "Close link: '$Url' does not name one whole ticket number, so nothing was sent to the terminal."
  if (-not $Yes) {
    Add-Type -AssemblyName System.Windows.Forms
    [void][System.Windows.Forms.MessageBox]::Show($message, "Live trading close link", "OK", "Warning")
  }
  Write-Output $message
  exit 2
}

if (-not (Test-Path -LiteralPath $Runner)) {
  $message = "Close link: the generated runner is not there ($Runner). Re-run scripts/register-live-trading-close-link.ps1."
  if (-not $Yes) {
    Add-Type -AssemblyName System.Windows.Forms
    [void][System.Windows.Forms.MessageBox]::Show($message, "Live trading close link", "OK", "Error")
  }
  Write-Output $message
  exit 3
}

if (-not $Yes) {
  Add-Type -AssemblyName System.Windows.Forms
  $question = "Close ticket $ticket on this PC now?`n`nYes runs the live loop's own hand-close for this ticket, immediately and for real.`nNo sends nothing."
  $answer = [System.Windows.Forms.MessageBox]::Show($question, "Live trading close link", "YesNo", "Question", "No")
  if ($answer -ne "Yes") {
    Write-Output "Close link: ticket $ticket was not confirmed, so nothing was sent."
    exit 0
  }
}

# The loop's own words are the answer: it prints one JSON record as its last line, so the status and the reason
# shown here are the loop's, not this handler's summary of them.
$output = & cmd.exe /c "`"$Runner`" $ticket" 2>&1 | Out-String
$record = $null
foreach ($line in ($output -split "`r?`n" | Where-Object { $_.Trim().StartsWith("{") })) {
  try {
    $record = $line.Trim() | ConvertFrom-Json
  } catch {
    # Not this line; the record is the last one that parses.
  }
}

$logPath = Join-Path (Split-Path -Parent $Runner) "live-trading-close-link.log"
$entry = [ordered]@{
  at_utc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  ticket = $ticket
  confirmed = $true
  status = $record.status
  reason = $record.reason
  action = $record.hand.action
  done = $record.hand.done
}
try {
  Add-Content -LiteralPath $logPath -Value ($entry | ConvertTo-Json -Compress) -Encoding UTF8
} catch {
  # A log that cannot be written is not a reason to hide the loop's answer from the person who pressed Close.
}

$status = if ($record) { [string]$record.status } else { "unreadable" }
$detail = if ($record) { [string]$record.reason } else { ($output.Trim() | Select-Object -First 1) }
if ($detail.Length -gt 600) { $detail = $detail.Substring(0, 600) }
$summary = "Ticket ${ticket}: ${status}`n`n$detail"

if (-not $Yes) {
  [void][System.Windows.Forms.MessageBox]::Show($summary, "Live trading close link", "OK", "Information")
}
Write-Output $summary
exit 0
