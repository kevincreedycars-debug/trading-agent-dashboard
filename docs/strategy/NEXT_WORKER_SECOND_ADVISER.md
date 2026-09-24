# Proposed: register a second Strategy adviser worker (`strategy-2`)

Advisory recommendation to the coordinator, requested by the user on 2026-09-24 (Option B). Purpose:
give the user a second adviser window to talk to while the first is occupied, and split the advisory
load so the two big workstreams both get attention. Adviser 1 (`strategy`) keeps the gold research
engine lane; adviser 2 owns the live path and multi-asset lane.

## What the coordinator must create

1. **Worktree and branch** (canonical folder, coordinator only):
   `git worktree add .local/worktrees/strategy-2 -b workers/strategy-advisory-2-20260924 <accepted canonical HEAD>`
2. **Register entry** in `docs/orchestration/projects.json`, `workers` array:

```json
{
  "id": "strategy-2",
  "mailbox_auto_connect": true,
  "path": "D:/trading-agent-dashboard-codex/.local/worktrees/strategy-2",
  "branch": "workers/strategy-advisory-2-20260924",
  "assignment_id": "strategy-advisory-2-001",
  "assignment": "docs/orchestration/assignments/strategy-2.md",
  "status": "instructions_published_awaiting_worker",
  "last_verified": "2026-09-24",
  "baseline": "<accepted canonical HEAD at publish time>",
  "next": "Adviser 2: open the live-path and multi-asset lane, publish STRATEGY_LIVE.md and notes, submit through the shared mailbox.",
  "display_name": "Strategy Agent 2"
}
```

The status spelling must be exactly `instructions_published_awaiting_worker` so the bridge generates a
wake. The wake will be delivered when the user opens and connects that workspace; connecting is what
releases unhandled events.

3. **Assignment file** `docs/orchestration/assignments/strategy-2.md` using the text in the next
   section of this brief.
4. **Workspace file** `tools/strategy-node/StrategyLive.code-workspace`, plus a short README, so the
   second window opens the same way this one does (first folder = the writable worktree, second folder
   = the central checkout for reference):

```json
{
  "folders": [
    { "name": "Strategy 2 - own notes", "path": "../../.local/worktrees/strategy-2" },
    { "name": "Central project - reference", "path": "../.." }
  ],
  "settings": {
    "window.title": "Strategy Agent 2 | DeepSeek | ${activeEditorShort}${separator}${appName}",
    "git.autoRepositoryDetection": false,
    "workbench.colorCustomizations": {
      "titleBar.activeBackground": "#553C2C",
      "titleBar.inactiveBackground": "#40302D",
      "activityBar.background": "#463327",
      "statusBar.background": "#553C2C",
      "activityBarBadge.background": "#B08F4F",
      "focusBorder": "#B08F4F"
    }
  }
}
```

(A copper tint, so the two adviser windows are visually distinct.)

## Proposed assignment text for `strategy-2.md`

Title: Strategy adviser 2 - live path and multi-asset lane. Assignment id `strategy-advisory-2-001`.
Worker `strategy-2`. Worktree `D:/trading-agent-dashboard-codex/.local/worktrees/strategy-2`.
Branch `workers/strategy-advisory-2-20260924`.

Purpose: discuss project strategy with the user and advise on the **live path and the multi-asset
rollout**, while adviser 1 (`strategy`) keeps the **gold research engine** lane (the 28 drivers, the
frozen qualification window and capture lane, the two A4 reference sheets). Two advisers exist so the
user always has a free conversation window and so both workstreams get equal attention. They must not
duplicate each other and must not disagree silently.

Lane this adviser owns:

1. Live Layer 1 / Layer 2 honesty and observability (the missing GBP status step, the stale
   `input-health.json`, `exports/` drift, and the published agent count).
2. The four unreconciled asset workers (`gbp`, `silver`, `wti`, `eur-pairs`): what their reconciliation
   should establish and in what order.
3. The multi-asset rollout (`backtester-spike`): readiness matrix, cache and job contracts, the
   deterministic parallel kernel, measured capacity and the hand-off of the gold engine's rules to
   other assets.
4. Operational automation: the mailbox bridge and the background reviewer (delivery confirmation,
   publish ordering, review reliability).

Deliverables: `docs/strategy-2/STRATEGY_LIVE.md` (objectives, verified state, unknowns, ranked next
steps, dependencies, alternatives, one recommended bounded assignment) and
`docs/strategy-2/CONVERSATION_NOTES.md` (user decisions and open questions). Submit materially revised
recommendations under new ids; do not submit every chat turn.

Authority and boundaries: identical to adviser 1 - write only `docs/strategy-2/` in this worktree and
ignored scratch; read canonical state, reports and registered worktrees by absolute path; never edit
the central folder, the register, other workers or assignments; submit only through the canonical
mailbox CLI; advice stays a proposal until the user or coordinator adopts it; preserve independent
Layer 1 agents, downstream-only backtesting, timing provenance and untouched evaluation; no credentials
beyond the documented runner and never submit secrets. Report real activity with
`monitor-state.js activity strategy-2 working|paused|blocked|stopped "task"`.

Startup: read the canonical startup, `docs/orchestration/README.md`, the register, decisions, current
state/task/milestone, pending reports and this assignment; then read `docs/orchestration/assignments/strategy.md`
and adviser 1's notes for the split, so the two lanes do not overlap.

## User steps once the coordinator has published it

1. Open `D:\trading-agent-dashboard-codex\tools\strategy-node\StrategyLive.code-workspace` in a new
   VS Code window (this is already the setup for adviser 1's window).
2. In that window run the command palette entry **Mailbox: Connect This Cline Worker** once; the
   register already marks it `mailbox_auto_connect`, so after that it reconnects by itself on reload.
   Keep this window (adviser 1) disconnected, so a wake can never be split between two tasks.
3. Start a Cline task with DeepSeek and paste the one-time message from the new README (same shape as
   `tools/strategy-node/README.md`, with the assignment path changed to
   `docs/orchestration/assignments/strategy-2.md` and the checkout to `.local/worktrees/strategy-2`).
4. It appears in the monitor as its own card ("Strategy Agent 2").

## Risks and decisions to record

- **Wake routing.** Only one Strategy window should be connected to the mailbox bridge. Recommended:
  `mailbox_auto_connect: true` on `strategy-2`, and adviser 1 left disconnected as it is today. Two
  connected windows on the same worker would race for the same single-shot delivery.
- **Two lanes, not two opinions.** The scope split above is the guard: adviser 2 does not publish gold
  engine advice, and adviser 1 does not publish live-path advice. If they ever disagree on something
  shared, each says so plainly in its own submission and the coordinator decides.
- **Cost.** One more DeepSeek session and one more review lane for the coordinator.
- **No shared chat memory.** Each adviser keeps its own notes; neither can read the other's chat. The
  coordinator reads both note files by absolute path.
- **If the user changes their mind**, nothing here is destructive: the worker can be left unconnected,
  and Option A (a second window on the existing workspace, chat-only) remains available without any
  register change.

## Acceptance check for the coordinator

Register parses and `coordination.js check` reports `strategy-2` with assignment
`strategy-advisory-2-001`; the worktree exists on its branch and is clean; the assignment file is
published with the exact status spelling; the workspace file opens with the new worktree as its first
folder; adviser 1's assignment, status and notes are untouched.
