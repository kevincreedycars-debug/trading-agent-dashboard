# Project monitor (Windows)

Native Windows tray app, no new packages or paid services. Requires Windows .NET
Framework and the existing Node installation. Launch from the canonical project:

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
