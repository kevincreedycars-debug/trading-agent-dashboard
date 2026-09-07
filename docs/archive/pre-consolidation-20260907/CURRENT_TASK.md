# Current Task

Last updated: 2026-09-06 (research worktree)

## Task

Continue Gold backtesting correctness and evidence quality under `docs/PARALLEL_AGENT_HANDOFF.md`.

## Current checkpoint

The stored-call pilot and source audit are complete locally. The active Gold collector reads 25 unordered historical snapshots, leaving the June 9 price as the daily reference in 143 of 147 audited snapshots. A replacement history-query patch is prepared and its database query verified read-only; production is unchanged.

The pilot covers 154 stored calls and 76,143 OANDA M1 candles. Ninety-seven calls have exact endpoints; none has a continuous 24-hour path. Earlier/later directional accuracy is 68.0%/34.4%. Source defects, storage-time proxies and dependent samples prevent a calibration or trading-edge claim.

## Next immediate task

Validate `backtester/drafts/gold_collector_history_query_patch.json` in an isolated n8n runtime before reviewing production deployment.

## Ownership and constraints

- Codex: backtester, research artifacts and evidence UI.
- DeepSeek/Cline: GBP Layer 1 drafts; preserve its owned files.
- Shared checkout contains substantial uncommitted work. Do not broadly stage, reset, stash or clean it.
- Local development and read-only inspection are authorized. Production deployment/activation is outside the current workstream handoff.

## Resume sources

Read `docs/CODEX_GOLD_BACKTEST_PROGRESS.md` and `backtester/docs/gold_stored_call_pilot_20260906.md`; open `gold-backtesting.html`. The older Architecture Mirror production checkpoint is retained in `docs/CURRENT_STATE.md` and `docs/CHANGELOG.md` and was not revalidated this session.
