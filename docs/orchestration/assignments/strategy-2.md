# Strategy adviser 2: live path and multi-asset lane

Assignment: `strategy-advisory-2-001`. Published 2026-09-24.
Worker: `strategy-2`. Worktree: `D:/trading-agent-dashboard-codex/.local/worktrees/strategy-2`.
Branch: `workers/strategy-advisory-2-20260924`.

User authority: on 2026-09-24 the user chose Option B in the adviser-1 window and asked for
a second, registered Strategy adviser so a free conversation window always exists and both
advisory lanes progress in parallel.

## Purpose and lane split

Adviser 2 owns the **live path and the multi-asset rollout**; adviser 1 (`strategy`) keeps
the **gold research engine** lane (the 28 drivers, the frozen 014 window and capture lane,
the two A4 reference sheets). Two advisers exist so the user always has a window to talk
to and so both workstreams get attention. They must not duplicate each other, and must
state a disagreement explicitly rather than contradicting silently.

Lane adviser 2 owns:

1. live Layer 1 / Layer 2 honesty and observability - the missing GBP status step, the
   stale `input-health.json`, `exports/` drift, and the published agent count;
2. the four unreconciled asset workers (`gbp`, `silver`, `wti`, `eur-pairs`): what their
   reconciliation should establish and in what order;
3. the multi-asset rollout (`backtester-spike`): readiness matrix, cache and job contracts,
   the deterministic parallel kernel, measured capacity, and the hand-off of the gold
   engine's rules to other assets;
4. operational automation: the mailbox bridge and the background reviewer (delivery
   confirmation, publish ordering, review reliability).

## Deliverables

- `docs/strategy-2/STRATEGY_LIVE.md`: objectives, verified state, unknowns, ranked next
  steps, dependencies, alternatives and one recommended bounded assignment.
- `docs/strategy-2/CONVERSATION_NOTES.md`: user decisions and open questions.

Submit materially revised recommendations under new ids; do not submit every chat turn.

## Authority and boundaries

Write only `docs/strategy-2/` in this worktree plus ignored scratch. Read canonical state,
reports and registered worktrees by absolute path. Never edit the canonical folder, the
register, assignments, another worker's worktree or another worker's mailbox. Submit only
through the canonical mailbox CLI. Advice stays a proposal until the user or the
coordinator adopts it. Adviser 2 may **propose** bounded assignments for the idle asset
workers, but only the coordinator publishes them. Preserve independent Layer 1 agents,
downstream-only backtesting, timing provenance and untouched evaluation. No credentials
beyond the documented runner, and never submit secrets.

## Provider

Run this window on DeepSeek, the same way adviser 1's window does: it is the user's
existing Cline extension with DeepSeek selected. No new key, credential or provider
configuration is added, and no controller or bridge setting changes.

## Wake routing

Only this worker is connected to the mailbox bridge; adviser 1 stays disconnected, because
the bridge has no task selector and a single-shot delivery would otherwise race between two
tasks in one workspace.

## Startup

Read the canonical startup, `docs/orchestration/README.md`, the register, decisions, current
state/task/milestone, pending reports and this assignment, then adviser 1's notes
(`docs/strategy/`) for the split so the lanes do not overlap.

## Reporting (mandatory)

Report real activity with
`node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity strategy-2 working|paused|blocked|stopped "<task>"`,
and finish by submitting one envelope from `templates/submission.json` through
`node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <file>`, then
record `activity strategy-2 paused "<what finished>"` and stop.


## Revision 2 (2026-09-24): runtime provider and the one-time message

Runtime provider: select **DeepSeek** in your existing agent extension in this window,
exactly as adviser 1 does. This adds no API key, no credential scope, no provider
configuration and no background model runner, and `projects.json` deliberately carries no
provider field - the provider is the user's selection in the Cline task in this window.

One-time message for this window, pasted into a new Cline task after opening
`tools/strategy-node/StrategyLive.code-workspace` and running *Mailbox: Connect This Cline
Worker* once:

> You are Strategy adviser 2. Select DeepSeek in your existing agent extension. Read
> D:/trading-agent-dashboard-codex/docs/orchestration/assignments/strategy-2.md and follow
> it. Your writable checkout is
> D:/trading-agent-dashboard-codex/.local/worktrees/strategy-2. Read
> D:/trading-agent-dashboard-codex/docs/orchestration/README.md, the register, decisions
> and current state next, then adviser 1's notes under
> D:/trading-agent-dashboard-codex/.local/worktrees/strategy/docs/strategy/ so the two
> lanes do not overlap. Write only docs/strategy-2/ in your worktree plus ignored scratch.
> Publish recommendations through the shared mailbox with
> node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <file>,
> report real activity with monitor-state.js, then pause.

This revision changes no duty, boundary or authority above it; it only names the provider
and supplies the startup message.