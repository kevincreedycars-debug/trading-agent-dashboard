# Project monitor (Windows)

Native Windows tray app, no new packages or paid services. Requires Windows .NET
Framework and the existing Node installation. Launch from the canonical project:

The compact green panel has a custom draggable title bar, rounded corners and
no Windows title strip. Drag the lower-right corner to resize; Pin keeps it above
other windows. Default size is 354 x 548 logical pixels, with all five workers
visible and usage beneath them.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/project-monitor/start.ps1
```

The launcher builds on first use. Rebuild after source changes with `build.ps1`
(exit the tray app first). Binary and user preferences live in ignored
`.local/project-monitor/`. No startup-at-login entry or desktop shortcut is installed.

- Pin toggles always-on-top (default on); Alerts toggles tray balloon notifications.
- Closing the window hides it to the tray. Double-click the tray icon to reopen;
  use its Exit menu to stop. Minimize also hides it to the tray.
- Select a worker and click Details (or double-click) for the full task/report;
  Open file opens the known coordination document, not arbitrary commands.
- The app scans every five seconds without AI calls. New submissions, replies
  and reported blockers produce notifications; existing history is baselined on
  first launch. Seen event IDs persist across restarts. Windows notification
  settings/Focus Assist can suppress balloons; the panel remains authoritative.
- Activity is self-reported, not inferred from open windows or edits. A working
  heartbeat older than five minutes reads No recent update. No heartbeat means
  No agent update. Review status never means an agent is running or deployed.
- Controller is explicitly Not configured. This monitor neither launches agents
  nor performs AI reviews. Scan failures retain the last display and show an error.

Active workers can report progress using the canonical command (start, milestones,
at least once per minute during long work, and stop/block):

```powershell
node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity gold-research working "Checking session-close timing"
node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity gold-research stopped "Submitted for review"
```

Reports are local JSON in `.local/orchestration/activity/`. Do not use activity as
a substitute for an immutable submission. Closed agents cannot send heartbeats.

Validation: `node --test tests/monitor_state.test.js`; build with the installed
compiler. `ProjectMonitor.exe ROOT NODE --smoke OUTPUT` renders a self-check PNG
and JSON after a real scan, then exits without tray notifications or preferences.

## Semi-live token usage

The footer shows **today's locally recorded processed tokens across all projects**
(Europe/London day), including cached input. Click it for project/provider totals,
input/output/cached counts, coverage status and the latest usage timestamp.
Refresh is approximately 30 seconds; tools may only flush counters after requests
finish. The five-second project-status scan is independent.

Read-only sources: Codex `$CODEX_HOME/sessions` and `archived_sessions` (default
`~/.codex`), Cline's VS Code `globalStorage/saoudrizwan.claude-dev/tasks` request
usage, and `~/.claude/projects` Claude Code usage. The collector reads token
metadata from those files, never credentials. It performs no provider API calls.
The known Codex transcript locations are documented in
[official troubleshooting](https://learn.chatgpt.com/docs/reference/troubleshooting).
Usage schemas are local adapters verified against the installed logs; they are
not assumed to be permanent public APIs.

Codex cumulative counters are differenced and duplicate events are discarded;
cached input and reasoning subtotals are not added again. Cline and Claude cache
read/write inputs are added to their uncached-input fields; repeated request or
message updates are deduplicated. Per-source conventions remain disclosed in the
breakdown. Missing sources/no records today are labelled, not interpreted as zero
account consumption. Cline tasks without workspace metadata remain unmapped.

This is not remaining allowance, provider balance, cost or a complete account-wide
bill. Other tools/devices, deleted logs and unrecorded calls are outside coverage.
Logs over 256 MB are explicitly skipped with a coverage warning. Only files updated
within 48 hours are candidates for today's counters. Derived counter caches are
ignored at `.local/project-monitor/token-cache.json`; prompt text is never saved
there. Tests: `npm run test:monitor`.
