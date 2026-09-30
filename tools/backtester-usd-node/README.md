# USD backtester agent window

Open [BacktesterUsd.code-workspace](BacktesterUsd.code-workspace) in its own VS Code window and select **DeepSeek** in your existing agent extension. The
register marks worker `backtester-usd` `mailbox_auto_connect`, so this window connects to the mailbox on open and reconnects
after a reload with no command; until a session log shows the agent has picked the assignment up, the monitor
and the status bar read `Wake sent / pickup unconfirmed`. Run **Mailbox: Connect This Cline Worker** once only
if the status bar does not read "Sent; awaiting pickup". Explicit Disconnect persists and overrides that.

This is the window for the USD backtesting lane. It is a readiness and standby lane: it reads the project and
the Gold evidence, it writes only `docs/backtester-usd/` in its own checkout, and it builds no builder,
checker, registry, session policy, outcome definition, adapter or batch. The seven asset backtesters are
built later, once the Gold backtesting loop's lessons are complete and understood and the user authorises the
build.

The first workspace folder is the worker's own checkout
(`D:/trading-agent-dashboard-codex/.local/worktrees/backtester-usd`) because the bridge binds to the first
workspace folder's registered path. The second folder is the canonical project for reference - the dashboard
root files (`index.html`, `script.js`, `styles.css`, `data/`), the logic documents and the orchestration notes
are all inside it.

Open it as the first folder only; the second is read-only by convention, not by an OS mount.

## One-time message

Paste this into a new Cline task after connecting the mailbox:

> You are the USD backtester agent. Select DeepSeek in your existing agent extension. Read
> D:/trading-agent-dashboard-codex/docs/orchestration/assignments/backtester-usd.md and follow it exactly as
> its stage A is written. Your writable checkout is
> D:/trading-agent-dashboard-codex/.local/worktrees/backtester-usd. Read
> D:/trading-agent-dashboard-codex/CODEX_STARTUP.md, docs/orchestration/README.md, the register,
> DECISIONS.md and the current state next, then the Gold evidence this lane inherits:
> docs/BACKTESTING_REVIEW_PLAN.md, docs/backtester_master_logic.md, docs/CORE_RESEARCH_PHILOSOPHY.md,
> docs/GOLD_TIMESTAMPED_EVALUATION_CONTRACT.md, docs/GOLD_RESEARCH_DELIVERY_CONTRACT.md and
> docs/orchestration/reviews/20260924-multi-asset-readiness-spike-001-r1.md. Write only
> docs/backtester-usd/ in your worktree plus ignored scratch. Build nothing: no builder, checker, registry,
> session policy, outcome definition, adapter or batch, no data acquisition, no warehouse, no Layer 1,
> dashboard or production change, and do not read any outcome, holdout or prospective observation. Produce
> docs/backtester-usd/READINESS.md with the sections the assignment lists, publish one status_report through
> the shared mailbox with node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <file>,
> report real activity with monitor-state.js, then pause.

## Monitor

The `USD Backtester` row appears in `npm run monitor` automatically from
`docs/orchestration/projects.json`; no monitor code or setting changes. Keep this window's Cline task open
while you want the mailbox bridge to deliver replies, and disconnect before switching tasks.
