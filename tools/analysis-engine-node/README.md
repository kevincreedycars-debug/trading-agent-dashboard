# Analysis Engine window

Open [AnalysisEngine.code-workspace](AnalysisEngine.code-workspace) in its own VS Code window, select
**DeepSeek** in your existing agent extension, and run **Mailbox: Connect This Cline Worker** once.
The register marks worker `analysis-engine` `mailbox_auto_connect`, so the mailbox connection is
restored automatically after a reload. Explicit Disconnect persists and overrides that.

This is the window for one subject: **how the analysis and the daily calls are produced today, and
whether that logic can be improved.** It is a discussion and audit lane. It reads the project, the
logic documents, the exports, the published artifacts and the dashboard; it writes only
`docs/analysis-engine/` in its own checkout; and it changes no logic document, export, published
artifact, workflow, dashboard file or backtester file.

The first workspace folder is the worker's own checkout
(`D:/trading-agent-dashboard-codex/.local/worktrees/analysis-engine`) because the bridge binds to the
first workspace folder's registered path. The second folder is the canonical project for reference -
`logic/`, `exports/`, `data/`, the dashboard root files and the orchestration notes are all inside it.

Open it as the first folder only; the second is read-only by convention, not by an OS mount.

## One-time message

Paste this into a new Cline task after connecting the mailbox:

> You are the analysis engine agent. Select DeepSeek in your existing agent extension. Read
> D:/trading-agent-dashboard-codex/docs/orchestration/assignments/analysis-engine.md and follow it.
> Your writable checkout is D:/trading-agent-dashboard-codex/.local/worktrees/analysis-engine.
> Assignment ID is analysis-engine-001. Read D:/trading-agent-dashboard-codex/CODEX_STARTUP.md,
> docs/orchestration/README.md, the register, DECISIONS.md and docs/CURRENT_STATE.md next, then read
> the daily-call material in the canonical checkout: logic/README.md and every
> logic/agent_<asset>_direction.md, docs/ARCHITECTURE.md, docs/backtester_master_logic.md,
> docs/LAYER1_COMPACT_SUMMARY_20260919.md, docs/DEEPSEEK_LAYER1_PROGRESS.md, the exports under
> exports/, the published artifacts data/layer1.json, data/layer2.json, data/workflow-status.json and
> data/workflow-control.json, workflows/master_orchestrator.md and the replay cores under
> backtester/replay/. Write only docs/analysis-engine/ in your worktree plus ignored scratch. Describe
> what the logic does today with the file each step comes from, then rank bounded improvements. Change
> nothing: no logic document, export, published artifact, workflow, dashboard file or backtester file,
> no run of a batch, no holdout or prospective observation, no workflow change, no publication, no
> installs and no credential. Layer 1 stays independent and backtesting stays downstream-only, and a
> better description is not a live edge. Deliver docs/analysis-engine/DAILY_CALL_LOGIC.md,
> IMPROVEMENT_OPTIONS.md and CONVERSATION_NOTES.md, publish through the shared mailbox with
> node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <file>, report real
> activity with monitor-state.js, then pause.

## Monitor

The `Analysis Engine` row appears in `npm run monitor` automatically from
`docs/orchestration/projects.json`; no monitor code or setting changes. Keep this window's Cline task
open while you want the mailbox bridge to deliver replies, and disconnect before switching tasks.
