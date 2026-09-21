# Local Cline mailbox bridge

The extension polls the canonical mailbox every five seconds and calls the
installed Cline extension's exported `sendMessage` function. Both installed
Cline 4.1.19 bundles expose this interface. No extension is patched and no
keystrokes, clipboard insertion or automatic approval clicks are used.

In the registered worker window, keep that worker's Cline conversation open,
then run **Mailbox: Connect This Cline Worker** once from the Command Palette.
Binding expires on reload. Disconnect before switching Cline tasks: this Cline
API addresses the currently open task and exposes no task-ID selector or receipt.
Opening this extension does not create or replace tasks or enable auto-approval.

New current-assignment replies and published assignments trigger a scoped
mailbox prompt. Pending review and a reported working state suppress worker
wakes, including overdue working reports. A pause/activity update after a
reply is treated as pickup evidence. Closed windows cannot receive messages.
Malformed mailbox data holds dispatch. Existing unhandled events can be sent
when the window is connected; handled history is not replayed.

Delivery is recorded before sending under `.local/orchestration/dispatch/WORKER/`.
An API return means **sent, unconfirmed**, not agent pickup. A send that fails
or crashes is never automatically repeated. Inspect status and actual worker
activity before manually retrying. Attempts are capped at 12 per worker per UTC
day. No model is polled merely to watch files.

The separate background coordinator now uses `codex exec` with gpt-5.6-sol,
workspace-write sandbox and approval policy never. It uses the existing Codex
login and reads canonical notes afresh for each event; this IDE conversation is
not resumed or injected into. A live read-only connection check returned
COORDINATOR_READY. A full research-review round trip still needs a new submission.

Start it with `powershell -File tools/agent-mailbox-bridge/start-coordinator.ps1`.
Pause new reviews with `node scripts/coordinator-dispatch.js pause`; inspect
`node scripts/coordinator-dispatch.js status`. Resume with `enable` while the
dispatcher process remains running, or run the start script after Windows restart.
There is no login-startup registration. Pausing does not interrupt an active run.

It checks validated submissions every five seconds, skips historical assignments,
deduplicates by submission hash before invoking Codex and holds an exclusive
daemon/run lock. Failed or interrupted attempts need inspection; they never
silently retry. Six attempts per UTC day, twenty minutes per run. Logs, receipts,
last responses and status are in `.local/orchestration/controller/`.
Unknown failures pause automatic reviews. The sandbox is retained; no approval
bypass, production change or expanded trading authority is granted.

Before interactive coordinator edits: pause the dispatcher, check status and wait
until activeRun is false. The dispatcher also defers while the coordinator activity
record says working. This is cooperative coordination, not an OS write lock against
other applications. After finishing interactive changes, report paused and enable.

Build: `python tools/agent-mailbox-bridge/package-vsix.py`.
Test: `node --test tests/agent_mailbox_bridge.test.js`.
Install the generated VSIX using the VS Code CLI or Install from VSIX.
