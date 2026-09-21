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

The current Codex IDE chat has no verified injection interface. A separate
Codex App Server coordinator is a possible second adapter but is not configured
by this extension. Until that adapter is chosen and implemented, coordinator
review still requires a user turn. Do not describe this as a complete automatic
round trip.

Build: `python tools/agent-mailbox-bridge/package-vsix.py`.
Test: `node --test tests/agent_mailbox_bridge.test.js`.
Install the generated VSIX using the VS Code CLI or Install from VSIX.
