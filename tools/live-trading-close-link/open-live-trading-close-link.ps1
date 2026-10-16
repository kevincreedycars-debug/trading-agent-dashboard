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
# Every press is written to `tmp/live-trading-close-link.log` beside the runner - what was handed over, what the
# handler did with it and, when the loop ran, the loop's own status and exit code. The refusals are logged too:
# a press that leaves no trace is indistinguishable from a press that never arrived.
#
# `-Yes` skips the box and exists for a hand test of this chain, never for the browser: the registered command
# passes only the URL and the runner, so a page cannot add a switch.
param(
  [Parameter(Mandatory = $true)][string]$Url,
  [Parameter(Mandatory = $true)][string]$Runner,
  [switch]$Yes
)

$ErrorActionPreference = "Stop"

# Every press leaves a line here, including the presses this file refuses and the presses answered No in the
# confirmation box. A press that leaves no trace cannot be diagnosed from either side: the reader sees a window
# come and go and the account is untouched, which is what the first real press of this link looked like. The file
# sits beside the generated runner, and a log that cannot be written is never a reason to fail the press.
$logPath = Join-Path (Split-Path -Parent $Runner) "live-trading-close-link.log"
function Write-CloseLinkEntry([hashtable]$fields) {
  $entry = [ordered]@{ at_utc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ") }
  foreach ($key in $fields.Keys) { $entry[$key] = $fields[$key] }
  try {
    Add-Content -LiteralPath $logPath -Value ($entry | ConvertTo-Json -Compress) -Encoding UTF8
  } catch {
    # Said rather than swallowed: a log that cannot be written is a fact about this press, not a reason to
    # pretend the press was recorded.
    Write-Warning "The close link could not write its log: $($_.Exception.Message)"
  }
}

# An unexpected failure is logged and said, never swallowed: this handler runs in a hidden window launched by a
# browser, so an error it does not report is an error nobody will ever see.
trap {
  Write-CloseLinkEntry ([ordered]@{ event = "failed"; url = $Url; error = $_.Exception.Message })
  Write-Output "Close link: the handler failed before the loop could answer ($($_.Exception.Message))."
  exit 4
}

$runnerPresent = Test-Path -LiteralPath $Runner
Write-CloseLinkEntry ([ordered]@{
  event = "pressed"
  url = $Url
  runner = $Runner
  runner_present = $runnerPresent
  confirmation_box = (-not $Yes)
})

# The one thing the page controls: the ticket. Anything that is not one whole positive number is refused here,
# before the terminal, the loop or the account is reached at all.
$ticketText = ($Url -replace '^[^:]*:', '') -replace '^/{1,2}', ''
$ticketText = $ticketText.Trim().TrimEnd('/')
$ticket = 0
if (-not [int]::TryParse($ticketText, [ref]$ticket) -or $ticket -le 0) {
  Write-CloseLinkEntry ([ordered]@{ event = "refused"; url = $Url; ticket_text = $ticketText; why = "the URL does not name one whole ticket number" })
  $message = "Close link: '$Url' does not name one whole ticket number, so nothing was sent to the terminal."
  if (-not $Yes) {
    Add-Type -AssemblyName System.Windows.Forms
    [void][System.Windows.Forms.MessageBox]::Show($message, "Live trading close link", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning)
  }
  Write-Output $message
  exit 2
}

if (-not $runnerPresent) {
  Write-CloseLinkEntry ([ordered]@{ event = "refused"; url = $Url; ticket = $ticket; why = "the generated runner is missing" })
  $message = "Close link: the generated runner is not there ($Runner). Re-run scripts/register-live-trading-close-link.ps1."
  if (-not $Yes) {
    Add-Type -AssemblyName System.Windows.Forms
    [void][System.Windows.Forms.MessageBox]::Show($message, "Live trading close link", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
  }
  Write-Output $message
  exit 3
}

if (-not $Yes) {
  Add-Type -AssemblyName System.Windows.Forms
  $question = "Close ticket $ticket on this PC now?`n`nYes runs the live loop's own hand-close for this ticket, immediately and for real.`nNo sends nothing."
  # The default button is named for its position, not for its label: MessageBoxDefaultButton offers only Button1,
  # Button2 and Button3, and Button2 is the No of a Yes/No box. Writing "No" here is a cast that throws before the
  # box is ever drawn - which is how the first real press of this link died inside its hidden window, leaving a
  # window that came and went and a trade that was never touched. Every argument below is therefore the enum it is.
  $answer = [System.Windows.Forms.MessageBox]::Show(
    $question,
    "Live trading close link",
    [System.Windows.Forms.MessageBoxButtons]::YesNo,
    [System.Windows.Forms.MessageBoxIcon]::Question,
    [System.Windows.Forms.MessageBoxDefaultButton]::Button2
  )
  if ($answer -ne "Yes") {
    Write-CloseLinkEntry ([ordered]@{ event = "refused"; ticket = $ticket; why = "the confirmation box was not answered Yes" })
    Write-Output "Close link: ticket $ticket was not confirmed, so nothing was sent."
    exit 0
  }
  Write-CloseLinkEntry ([ordered]@{ event = "confirmed"; ticket = $ticket })
}

# The loop's own words are the answer: it prints one JSON record as its last line, so the status and the reason
# shown here are the loop's, not this handler's summary of them. The native call is wrapped so that a line the
# loop writes to stderr is read as the loop speaking rather than as this script failing: with the preference set
# to Stop, a redirected stderr stream is otherwise a terminating error, which would end the handler after the
# confirmation and before the answer - a press that runs the loop and then shows nothing.
$previousPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$output = & cmd.exe /c "`"$Runner`" $ticket" 2>&1 | Out-String
$loopExit = $LASTEXITCODE
$ErrorActionPreference = $previousPreference
$record = $null
foreach ($line in ($output -split "`r?`n" | Where-Object { $_.Trim().StartsWith("{") })) {
  try {
    $record = $line.Trim() | ConvertFrom-Json
  } catch {
    # Not this line; the record is the last one that parses.
  }
}

Write-CloseLinkEntry ([ordered]@{
  event = "answered"
  ticket = $ticket
  confirmed = $true
  loop_exit = $loopExit
  status = $record.status
  reason = $record.reason
  action = $record.hand.action
  done = $record.hand.done
})

$status = if ($record) { [string]$record.status } else { "unreadable" }
$detail = if ($record) { [string]$record.reason } else { ($output.Trim() | Select-Object -First 1) }
if ($detail.Length -gt 600) { $detail = $detail.Substring(0, 600) }
$summary = "Ticket ${ticket}: ${status}`n`n$detail"

if (-not $Yes) {
  [void][System.Windows.Forms.MessageBox]::Show($summary, "Live trading close link", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
}
Write-Output $summary
exit 0
