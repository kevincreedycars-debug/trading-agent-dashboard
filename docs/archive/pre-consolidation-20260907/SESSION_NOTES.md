# Session Notes

Last updated: 2026-09-06

Session paused at the user's request: "save here". Work is saved locally, uncommitted and undeployed. Resume at the isolated n8n validation step below.

User authorized autonomous progress while working on other projects. Continued the September Gold backtesting workstream; preserved DeepSeek-owned GBP files and the shared dirty checkout.

## Completed

Read-only Supabase/OANDA access supplied 154 stored Gold calls and 76,143 M1 candles. Confirmed a production input defect: Gold's history read requests 25 unordered rows, currently June 6-9. The June 9 price anchors 143/147 linked snapshots. All 154 calls replay from those inputs; parity does not validate input quality.

Prepared an unapplied query patch and verified its database query returns 543 rows/49 dates through September 5. A counterfactual input-only repair changes 97 F5 signals and 19 directions. No historical outputs were rewritten and no outcome improvement was tested.

Pilot: 97 exact-endpoint calls, 45 correct/37 wrong/13 flat/2 no-call; zero continuous 24-hour paths. Earlier/later accuracy is 68.0%/34.4%, with explicit source, dependency and timing limitations. Built cohort baselines/correlation, fixed as-of cutoff/rejection bugs, indexed candle lookup and updated the evidence page. 87 focused tests pass; desktop/narrow layouts visually reviewed.

## Resume

Read `docs/PARALLEL_AGENT_HANDOFF.md`, `docs/CODEX_GOLD_BACKTEST_PROGRESS.md`, and `backtester/docs/gold_stored_call_pilot_20260906.md`. Open `gold-backtesting.html`.

Next: isolated n8n validation of `backtester/drafts/gold_collector_history_query_patch.json`, then production deployment review. No local n8n/Docker executable was available. The normal Master calls the affected collector; an active TEST orchestrator calls the active TEST Gold collector. All collectors have subworkflow triggers, with no schedule trigger observed. TEST ownership/use remains unconfirmed.

All changes remain local and uncommitted. No workflow activation, database writes, production publication, credential changes or live weight changes occurred. Raw exports/candles and hashes are under ignored `backtester/tmp/gold-stored-20260906/` and `backtester/tmp/gold-oanda-20260906/`.
