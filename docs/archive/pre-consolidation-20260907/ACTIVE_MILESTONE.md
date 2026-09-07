# Active Milestone

## Current Feature

Gold backtesting correctness and input-quality evidence.

## Current Milestone

Validate the confirmed Gold collector history repair before fresh calibration.

## Status

In Progress

## Completed Work

- Read-only acquisition of 154 stored calls and 76,143 completed OANDA minute candles.
- Confirmed stale June 9 reference in 143 of 147 linked snapshots; all recorded signals/directions replay exactly from their inputs.
- Prepared a local query patch; replacement GET returns 543 rows across 49 dates.
- Built endpoint/chronological/cohort diagnostics and a counterfactual input-impact audit (97 F5 signal changes, 19 direction changes).
- Fixed cutoff/rejection handling; indexed candle windows; updated the offline evidence page.
- 87 focused tests passed, including desktop/narrow browser checks. No live workflow or warehouse writes.

## Remaining Work

- Isolated n8n validation of the query patch and ownership review of active TEST collector variants.
- Production deployment authorization after review; fresh collection-quality baseline.
- Authenticated publication/raw-input availability times, contemporaneous L2L levels and MT5 execution evidence.

## Current Files Being Modified

Backtester Gold libraries/scripts/tests, four dated research JSON reports, the Gold evidence template/page, and research handoff/tracker documentation. See `docs/CODEX_GOLD_BACKTEST_PROGRESS.md`.

## Blockers

No local n8n or Docker executable was available for isolated workflow execution. Endpoint outcomes do not validate gaps, stops, targets or fills. The production collector repair remains unapplied.

## Next Immediate Action

Validate the prepared Gold history-query patch in an isolated n8n runtime.

Session paused on 2026-09-06 at the user's request. Local work is saved; no commit or deployment was performed. Latest focused validation: 87 tests passed.

## Last Updated

2026-09-06, research/half-l2l-reach-20260809 worktree.
