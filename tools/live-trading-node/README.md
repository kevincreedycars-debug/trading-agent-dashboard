# Live trading agent window

Open [LiveTrading.code-workspace](LiveTrading.code-workspace) in its own VS Code window, select
**DeepSeek** in your existing agent extension, and run **Mailbox: Connect This Cline Worker** once.
The register marks worker `live-trading` `mailbox_auto_connect`, so the mailbox connection is
restored automatically after a reload. Explicit Disconnect persists and overrides that.

This is the window for the live-trading path through a MetaTrader 5 connection. It is a discussion
and design lane: it reads the project and the dashboard, it writes only `docs/live-trading/` in its
own checkout, and it does not connect to a broker, hold MT5 credentials or place orders until you
decide otherwise.

The first workspace folder is the worker's own checkout
(`D:/trading-agent-dashboard-codex/.local/worktrees/live-trading`) because the bridge binds to the
first workspace folder's registered path. The second folder is the canonical project for reference -
the dashboard root files (`index.html`, `script.js`, `styles.css`, `data/`), the logic documents and
the orchestration notes are all inside it.

Open it as the first folder only; the second is read-only by convention, not by an OS mount.

## One-time message

Paste this into a new Cline task after connecting the mailbox:

> You are the live trading agent. Select DeepSeek in your existing agent extension. Read
> D:/trading-agent-dashboard-codex/docs/orchestration/assignments/live-trading.md and follow it.
> Your writable checkout is D:/trading-agent-dashboard-codex/.local/worktrees/live-trading. Read
> D:/trading-agent-dashboard-codex/CODEX_STARTUP.md, docs/orchestration/README.md, the register,
> DECISIONS.md and the current state next, then read the existing MT5 material:
> docs/MT5_MIRRORED_EXECUTION_CHART_REFERENCE.md, data/research-proof-map.json,
> docs/BACKTESTING_REVIEW_PLAN.md and docs/CREDENTIAL_CONTINUITY.md. Write only docs/live-trading/ in
> your worktree plus ignored scratch. Do not connect to any MT5 terminal or account, do not install
> packages, do not ask me for a login, password or server, and do not place or arm an order. Discuss
> the live-trading design with me, write docs/live-trading/STRATEGY_LIVE.md and
> CONVERSATION_NOTES.md, and put the authority decision back to me. Publish through the shared
> mailbox with node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <file>,
> report real activity with monitor-state.js, then pause.

## Monitor

The `Live Trading Agent` row appears in `npm run monitor` automatically from
`docs/orchestration/projects.json`; no monitor code or setting changes. Keep this window's Cline task
open while you want the mailbox bridge to deliver replies, and disconnect before switching tasks.
