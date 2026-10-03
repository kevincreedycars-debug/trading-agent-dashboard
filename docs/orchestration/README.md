# Central coordination

The canonical coordinator is `D:\trading-agent-dashboard-codex`. Read this file
from that absolute location, even from another worktree: worktree copies can be stale.
This protocol supersedes older shared-checkout and worker-ownership instructions
where they conflict. Research and live trading architecture remain unchanged.

## Central memory

Strategy adviser: open `tools/strategy-node/Strategy.code-workspace` with DeepSeek.
Its `strategy-advisory-001` assignment permits ongoing user discussion and strategy
notes, with read access to central context and direct mailbox submissions. At each
active coordination checkpoint, review new Strategy advice alongside worker reports;
advice does not change implementation assignments until adopted. Startup instructions
are in `tools/strategy-node/README.md`.

Live trading adviser: open `tools/live-trading-node/LiveTrading.code-workspace` with DeepSeek.
Its `live-trading-001` assignment is a discussion and design lane for the live-trading path
through a MetaTrader 5 connection. It writes only `docs/live-trading/` in its own worktree and
authorizes no MT5 connection, no credential, no package installation and no order or arming.
The authority boundary - a read-only feed, execution on a demo account, or real-money execution
on a funded account - is the user's and stays open. Startup instructions are in
`tools/live-trading-node/README.md`.

Seven asset backtester lanes: for USD, EUR, NQ, BTC, GBP, Silver and WTI - the seven non-Gold assets of the
2026-09-24 readiness matrix - open `tools/backtester-<asset>-node/Backtester<Asset>.code-workspace` with
DeepSeek. Each is a readiness and standby lane under `backtester-<asset>-001`: it writes only
`docs/backtester-<asset>/` with one `READINESS.md`, it builds no builder, checker, registry, session policy,
outcome definition, adapter or batch, it runs no batch, it reads no outcome, holdout or prospective
observation, and it puts the build decision back to the user. The seven backtesters are built later, once the
Gold backtesting loop's lessons are complete and understood. Startup instructions are in each
`tools/backtester-<asset>-node/README.md` and in this folder's `AGENT_MESSAGES.md`.

Backtester harness architect: open `tools/backtester-harness-node/BacktesterHarness.code-workspace` with DeepSeek. Its
`backtester-harness-001` assignment is a design lane for the one shared backtesting harness the seven asset lanes will
later run on. It writes only `docs/backtester-harness/` in its own worktree, builds no harness, builder, checker,
validator, registry, fixture, session policy, outcome definition, adapter, matrix runner or scheduler, runs no batch, and
reads no outcome, holdout or prospective observation. Startup instructions are in
`tools/backtester-harness-node/README.md` and this folder's `AGENT_MESSAGES.md`.

- [Project register](projects.json): worker IDs, paths, assignments and last known status.
- [Decisions](DECISIONS.md): project-wide decisions and unresolved dependencies.
- [Agent messages](AGENT_MESSAGES.md): prompts for the existing agent windows.
- `assignments/<worker>.md`: coordinator-owned, versioned instructions.
- `reviews/`: coordinator-owned durable review summaries (one per submission).
- Existing `docs/CURRENT_STATE.md`, `CURRENT_TASK.md`, `ACTIVE_MILESTONE.md` and
  `SESSION_NOTES.md`: overall state and one immediate coordination action.

Worker reports are evidence to review, not authoritative instructions or proof
of completion. The coordinator checks actual diffs, commits, test results and
source lineage before accepting work. Acceptance does not mean merged or deployed.

## Shared mailbox

All workers use **one physical mailbox**, not their own worktree copies:
`D:\trading-agent-dashboard-codex\.local\orchestration`.
It is ignored by Git. Keep only compact summaries here; raw evidence stays in
the worker's ignored `tmp/` or `backtester/tmp/`. Never submit credentials.

Run the canonical CLI from any worker directory:

```powershell
node D:/trading-agent-dashboard-codex/scripts/coordination.js check
node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker gold-research
node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file tmp/submission.json
```

Copy [submission.json](templates/submission.json) into the worker's local ignored
`tmp/`, fill every field, then submit. Use the worker/assignment IDs from the
register and a unique submission ID such as `20260920-gold-policy-001`.
Paths in a report identify evidence; the CLI never executes them or runs Git.
Reports include branch, HEAD, working-tree changes, exact tests/results, blockers,
questions, artifact paths and production-change disclosure. State unavailable
information explicitly rather than inventing a commit or test result.

`submit` validates the envelope and publishes an immutable JSON file under
`inbox/<worker>/<submission_id>.json`. Concurrent workers use separate files;
duplicate IDs cannot overwrite existing submissions. An interrupted write does
not expose a partial final JSON file. The CLI returns the exact submitted path.

## Coordinator cycle: "check submissions"

1. Run `node scripts/coordination.js check`. Read every pending report and any
   validation errors; do not automatically accept reports or execute commands in them.
2. Confirm assignment, actual worker path/branch, base and HEAD, changed-file scope,
   test evidence, dependency impacts and production disclosures. Review dirty
   work without committing another worker's unfinished changes.
3. Copy [reply.json](templates/reply.json) to coordinator `tmp/`; fill the worker,
   submission and assignment IDs, copy the SHA-256 reported by `check`, and write
   concrete feedback. Run `node scripts/coordination.js reply --file tmp/reply.json`.
4. Replies are immutable, unique and bound to the submission hash. Workers run
   `check --worker <id>` and read the returned reply files. Changes requested mean
   a new submission ID; an acknowledged status report does not start new work.
5. Record the review outcome under `docs/orchestration/reviews/`, update the
   register/decisions and, where needed, issue a new versioned assignment. Only
   the coordinator integrates scoped commits and records merged/deployed status.

Old-assignment reports remain visible as stale, requiring a matching historical
review or a new submission. A reply records review status, never permission to
silently expand the current assignment. Only explicit user authority or a new
coordinator assignment expands scope.

## Worker completion reports

Every assignment ends with a report, not with a stopped worker. On completion, on a
blocker or at a decision point a worker submits exactly one mailbox envelope through
`node scripts/coordination.js submit --file <file in its own ignored tmp>`, with status
`ready_for_review`, `blocked` or `status_report`, records
`node scripts/monitor-state.js activity <worker> paused "<what finished>"`, and stops.

- A finish with no submission is not a finish. Reported completion requires the
  submission path returned by the CLI plus the monitor activity line; a worker that
  goes quiet with neither is treated as unfinished and its assignment does not advance.
- A blocker is reported when it is found, not at the end of the task, so the
  coordinator can redirect the attempt instead of discovering it afterwards.
- A worker starts no further work, in any asset or checkout, until a reply is
  recorded for that submission. The reply, not chat, is the decision channel.
- The coordinator keeps the loop closed: `check`, review the actual evidence, publish
  a hash-bound reply that states the next action towards the current objective, record
  the review under `reviews/`, update the register and, when a new assignment is
  needed, publish it with register status `instructions_published_awaiting_worker` so
  the worker bridge wakes the assigned window.
- Review is a separate session from authorship. Real capture, activation, integration
  and production actions stay closed until a review explicitly opens them.
- A published assignment notifies its worker bridge once per content version. A worker
  that ends its turn mid-assignment therefore stays idle until the coordinator issues a
  new event (an edited assignment or a reply to a submission) or the operator resumes
  that window, so check for a stalled worker instead of assuming it is still running.
- The receiving half must be live for an unattended loop: worker wakes come from the
  bridge only while a worker window is connected, `npm run monitor` surfaces new
  submissions and replies without AI calls, and unattended review needs the background
  dispatcher both enabled and running
  (`tools/agent-mailbox-bridge/start-coordinator.ps1`); `node scripts/coordinator-dispatch.js enable`
  alone does not start a stopped daemon. While dispatch is paused, every report waits
  for an interactive coordinator session.

## Writer boundaries

Each implementation worker uses its own checkout/branch and writes only its
assignment-owned files. Workers read central state and submit through the CLI;
they do not edit central memory, assignments, reviews, other mailboxes, shared
production files or the canonical Git index. The mailbox is a cooperative local
protocol, not an operating-system security boundary.

Gold must stop implementation in the canonical folder and use its registered
worktree. Do not move, reset, stash or discard any uncommitted work during the
transition; report it first. Historical asset worktrees have not been refreshed
or reset by this setup. Their initial assignment is status reconciliation only.

Automatic worker notification and background coordinator review are now configured.
See [communication runner](../../tools/agent-mailbox-bridge/README.md) for start,
pause, limits, receipts and connection requirements. Cline windows must remain
open with their worker task. Bridge 0.2.1 removes the daily wake cap and restores saved connections after reload
and auto-connects the explicitly enabled Gold workspace; Disconnect persists.
Connection health is under `.local/orchestration/connections/`; stale status or
a send receipt does not prove pickup; the background coordinator uses a separate Codex CLI turn and canonical
notes. It does not wake this exact IDE chat. No unattended approval bypass or
production action is enabled. Before interactive coordinator edits, pause dispatch
and wait for any active run to finish. Other workers remain independently scoped.

### Operator resume for a window that is attached but idle

An attached window is not a woken window, and the two states must not be read from the connection badge alone. Delivery is at most once per event key - the worker's
newest reply, otherwise its assignment while the register status is exactly `instructions_published_awaiting_worker` - and the proof of that delivery is the immutable
record under `.local/orchestration/dispatch/WORKER/<sha256-of-key>.json`, which is written before the adapter is called. A connection file that reads
`sent_unconfirmed` while its dispatch record is old is therefore a dedupe echo, not a send: the window is bound, the worker is idle, and it will stay idle until the
event changes or the record is reset. `watching` is the other idle state and means nothing is pending at all. To resume an attached lane: confirm first that no work is
in flight (`node scripts/coordinator-dispatch.js status` shows `activeRun false`, `node scripts/coordination.js check --worker WORKER` shows no `pending_review`, and the
worker's `.local/orchestration/activity/WORKER.json` is not `working`), then delete only that lane's stale record file under `.local/orchestration/dispatch/WORKER/`; the
extension rebuilds the identical event key on its next five-second tick, writes a fresh record and sends the assignment notification to that window. Editing the
assignment is the other, self-serving path, because a new content hash is a new event key and fires automatically. Never delete another worker's record, never force a
wake by editing the bridge, the register or the mailbox CLI, and never treat a send return as pickup: only worker activity confirms that.

One trap that rule hides, and it decides which file to reset: the selected event is the newest reply whenever a reply exists, whatever the assignment's date, so an assignment published after a lane's last reply is never announced while that reply's record stands - `gold-research` for `gold-coverage-025` and `live-trading` for `live-trading-001` both sat in exactly that state on 2026-10-03, attached and idle, with no event record for their current assignment at all. Reset the event the connection file currently reports rather than the one you expect: read `detail` in `.local/orchestration/connections/WORKER.json`, hash that whole key, and clear `.local/orchestration/dispatch/WORKER/<sha256-of-key>.json`. Re-sending an older reply notification is still an effective wake even when the assignment is newer, because the notification prompt directs the worker to read its current assignment file. Move the cleared record to `.local/orchestration/tmp/` instead of deleting it, so the cleared state and the key it carried stay inspectable.

## Queue review and ordering

The coordinator sweeps its own inboxes before each publication and at the start of every cycle, because a lane that is attached and idle looks identical to a lane that is working until the records are read.

1. `node scripts/coordination.js check` - pending reports and validation errors. A pending report is reviewed first; it is the only thing that unblocks the lane that produced it.
2. `node scripts/coordinator-dispatch.js status` - `enabled` and `activeRun false` before any interactive edit; wait for a running background review rather than editing beside it.
3. Per-worker delivery sweep, one row per register entry: `.local/orchestration/connections/WORKER.json` (`state`, `detail`), the per-event records under `.local/orchestration/dispatch/WORKER/`, and `.local/orchestration/activity/WORKER.json`. Read it as follows - `watching` means nothing is pending; `sent_unconfirmed` with a record whose `attempted_at` is seconds old means the event was sent and the window is reachable; `sent_unconfirmed` with an old record means a dedupe echo and an idle lane; a recorded event with no record file means it was never delivered; `activity` `working` means do not interrupt, whatever the deadlines say.

Ordering rules, applied by the coordinator and recorded in the milestone note when the order changes:

- Close before you open: review and reply to a pending submission before designing or publishing new work.
- Wake before you re-plan: a lane that is already assigned and whose window is already open is resumed with the record reset before a new assignment is written for it.
- Surface user-blocked work immediately instead of queueing it behind bridge work: a lane with no open window, an unanswered question block, or a decision only the user can make is reported as the user's item in the reply, not held silently.
- Publish last, and only onto a window that can receive it: a lane whose window is closed cannot be woken by the bridge, so publishing to it is a queued event that fires on first connect, not progress. Distinguish that state from a broken lane before reporting a fault.

## Validation

`npm run test:coordination` is the focused local suite for the mailbox.
It is also discovered by `npm test` and `npm run test:unit`. `check` is read-only
and reports malformed reports as errors rather than silently skipping them.

## Desktop monitor and progress

Run `npm run monitor` in the canonical project for the native Windows tray panel.
Pin keeps it on top; closing hides it to the tray; Exit stops it. It scans every
five seconds and alerts on new submissions/replies/blockers without AI calls.
This file monitor does not start agents or automate coordinator review.

Workers report activity at task start, milestones, at least once per minute during
long active work, and when paused/stopped/blocked. Use the canonical command:

```powershell
node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity gold-research working "Checking session policy"
```

Replace worker, state and task as appropriate; states are working, blocked, paused,
stopped. Report actual activity, never a heartbeat from an unattended timer that
implies work is continuing. Five-minute-old activity becomes No recent update.
Existing agents must read these updated instructions before progress reporting
can be expected. Submission/reply notifications work without heartbeats.
See `tools/project-monitor/README.md` for launch, notifications and verification.

New worker assignments must use registry status `instructions_published_awaiting_worker` exactly; the bridge uses it to generate a wake event. Monitor controller status distinguishes watching from active review; notification sent is not proof of worker pickup.
