# Local Cline mailbox bridge

The extension polls the canonical mailbox every five seconds and calls the
installed Cline extension's exported `sendMessage` function. Both installed
Cline 4.1.19 bundles expose this interface. No extension is patched and no
keystrokes, clipboard insertion or automatic approval clicks are used.

Version 0.2.1 removes the 12-per-day wake cap and restores a saved connection on reload in the same registered,
trusted worker workspace. Gold is explicitly enabled through `mailbox_auto_connect`
in the central register under the user's September 22 repair instruction. Other
workers require **Mailbox: Connect This Cline Worker** once. Explicit Disconnect
persists and overrides automatic connection. Keep the existing worker Cline task
open and disconnect before switching tasks: Cline exposes no task-ID selector or
active-task query. The bridge never creates/replaces tasks on its own initiative and
never clicks approvals: a task is opened only for a deliberate one-shot start request
filed by the operator, described below.

Version 0.3.0 adds that one-shot start. A window with no Cline task open receives
nothing, because Cline's `sendMessage` returns without an error and without an effect;
to open a worker's first task, file a request with
`node scripts/mailbox-start-task.js arm WORKER` and read it back with `status`. The
request carries that worker's own due wake text, so the task starts on the mailbox
notification the worker would otherwise have received. The bridge consumes the request
exactly once whatever the outcome, writes
`.local/orchestration/start-task/WORKER.report.json` (`started`, `unsupported` or
`error`) and renames the request to `.consumed.json`. A failed or unreadable start is
never retried automatically and never falls back to a blind send, an unreadable request
holds dispatch instead of guessing, and a window that is not bound to that worker ignores
the request. `vscode://` task URLs are deliberately not used: VS Code routes those to
whichever window it chooses, which can open a task in an unrelated worker window.

Connection health is written to `.local/orchestration/connections/WORKER.json`
every active polling cycle. A stale timestamp does not establish a live connection.
A send return is still unconfirmed: this Cline API even returns without an error
when no task is open. Only actual worker activity establishes pickup. Ambiguous
sends remain deduplicated and are never automatically retried.

New current-assignment replies and published assignments trigger a scoped
mailbox prompt. Pending review and a reported working state suppress worker
wakes, including overdue working reports. A pause/activity update after a
reply is treated as pickup evidence. Closed windows cannot receive messages.
Malformed mailbox data holds dispatch. Existing unhandled events can be sent
when the window is connected; handled history is not replayed.

Delivery is recorded before sending under `.local/orchestration/dispatch/WORKER/`.
An API return means **sent, unconfirmed**, not agent pickup. A send that fails
or crashes is never automatically repeated. Inspect status and actual worker
activity before manually retrying. Distinct wake events are not capped by any daily
budget: each event is delivered once and a duplicate or ambiguous send is never repeated automatically. No model is polled merely to watch files.

The separate background coordinator uses the Codex CLI as the sandboxed agent
host, but inference is pinned to DeepSeek's Responses-compatible endpoint with
`deepseek-flash`, low reasoning effort, workspace-write sandbox and approval
policy never. It does not use an OpenAI model or OpenAI authentication. The
DeepSeek key is loaded only into the daemon process from the encrypted local
credential store. Each event reads canonical notes afresh; this IDE conversation
is not resumed or injected into.

Start it with `powershell -File tools/agent-mailbox-bridge/start-coordinator.ps1`.
The start wrapper launches `run-coordinator.ps1`, which keeps the daemon inside
the dedicated encrypted `deepseek-coordinator` credential scope.
Pause new reviews with `node scripts/coordinator-dispatch.js pause`; inspect
`node scripts/coordinator-dispatch.js status`. Resume with `enable` while the
dispatcher process remains running, or run the start script after Windows restart.
There is no login-startup registration. Pausing does not interrupt an active run.
Before the first start, sync the local credential home and store
`DEEPSEEK_API_KEY` as documented in `docs/CREDENTIAL_CONTINUITY.md`. Missing
credentials or provider errors pause the checker; there is no OpenAI fallback.

It checks validated submissions every five seconds, skips historical assignments,
deduplicates by submission hash before invoking Codex and holds an exclusive
daemon/run lock. Failed or interrupted attempts need inspection; they never
silently retry. No daily attempt cap: the user lifted the former six-per-UTC-day
guard on 2026-09-25 so worker progress is not bounded by model spend; forty minutes
per run, because the earlier twenty-minute cap timed out on the 020 submission.
Logs, receipts,
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
