# Active Milestone

## Current Feature

Backtest / Accuracy L2L 1H Sequence Research

## Current Milestone

Replace the daily OHLC range proxy with sequence-aware 1H L2L research without weakening the downstream-only rule

## Status

In Progress

## Completed Work

- Deterministic USD Backtester Checker was added in commit `e161994`.
- Current checker scope is USD 24H for January 2024.
- Latest checker result is 22 checked / 22 pass / 0 fail / 0 missing.
- Backtest Checker workspace UI, navigation, and compact summary grid were added to the dashboard.
- Live-vs-replay audit confirmed the live USD workflow is the current production source of truth.
- Live-vs-replay audit confirmed the current checker proves replay-vs-replay reproducibility, not live-vs-replay parity.
- Eco Events duplicate insert handling was fixed on 2026-06-21.
- Latest `data/workflow-status.json` runtime evidence shows a successful Master Orchestrator run on 2026-06-28.
- EUR live 24H parity target was confirmed against the deterministic node in `exports/eur_layer1_agent.json`.
- EUR one-snapshot live-vs-replay parity fixture now passes against frozen live output.
- EUR historical replay was generated for `2024-01-02` through `2026-04-30`.
- EUR/USD historical outcome evaluation was unblocked with imported EURUSD price history.
- EUR-specific provisional 24H flat band was set to `0.15` without changing shared USD evaluation defaults.
- EUR checker artifact now passes `602 / 0 / 0 / 0`.
- Dashboard support was added for the EUR 24H matrix and EUR checker.
- Full Layer 1 historical replay rollout is now validated across USD, EUR, Gold, NQ, and BTC.
- A new `Weekday Breakdown` tab was added under Backtest / Accuracy without removing or disrupting the existing matrices or checker views.
- The weekday view uses stored displayed headline confidence and stored evaluation results from the canonical checker artifacts rather than recalculating confidence.
- Weekday reconciliation validation now passes for USD `604`, EUR `602`, Gold `608`, NQ `604`, and BTC `850`.
- Browser smoke now passes for accuracy tables, checker views, and the weekday breakdown tab.
- Weekday Breakdown cells now separate flat outcomes from directional wins/losses and show ex-flat directional win rate plus `W / L / F / T`.
- Each asset now includes a `Day Totals` table above the bucket table, aggregating performance across all confidence buckets for each weekday.
- The weekday validator now confirms day-level totals reconcile back to bucket rows and checker totals.
- A new `Pair Trade Research` tab now renders EUR/USD, XAU/USD, NQ/USD, and BTC/USD same-date target + USD studies from the checker artifacts.
- Pair trade research now includes coverage summary, accuracy summary, combined-confidence bucket table, day totals, weekday breakdown, and conflict/no-trade summary.
- Combined pair confidence is computed as the lower of target and USD stored headline confidence, keeping pair confidence downstream-only and consistent with Layer 1 display semantics.
- A dedicated pair-trade validator now passes, and browser smoke now passes with the Pair Trade Research tab included.
- Pair Trade Research UI has been refined and validated, including top-summary comparison layout improvements, confidence-table spacing fixes, and clearer matched-day terminology in the summary layer.
- `L2L 1H Sequence Research` now replaces the old daily-range-only ADR wording in the dashboard.
- The research module now uses a `50% ADR20 required move` from daily candles and confirms wins/misses with sequence-aware `1H` candles rather than daily high-low alone.
- Repo-local OANDA daily + `1H` coverage is now staged for `EUR_USD`, `XAU_USD`, and `NAS100_USD`.
- Repo-local Binance daily + `1H` coverage is now staged for `BTCUSDT`.
- The rebuilt research path now supports `EUR`, `Gold`, `NQ`, and `BTC` for Layer 1 plus `EUR/USD`, `XAU/USD`, `NQ/USD`, and `BTC/USD` for Layer 2.
- `USD` remains explicitly unavailable because repo evidence still does not include supportable `DXY` daily + `1H` history.
- `backtester/scripts/validate_adr_reach_research.js` now builds and validates the sequence-aware artifact, and browser smoke now passes with the rebuilt tab included.

## Remaining Work

- Confirm the commit-ready cleanup for renamed candle importers and the rebuilt `L2L 1H Sequence Research` wording.
- Source supportable `DXY` daily + `1H` history only if a real non-estimated source can be staged repo-locally.
- Keep the new daily + `1H` import paths reproducible without changing replay, checker, confidence, or Pair Trade Research semantics.

## Current Files Being Modified

- `backtester/importers/oanda/download_oanda_candles.js`
- `backtester/importers/binance/download_binance_candles.js`
- `backtester/scripts/validate_adr_reach_research.js`
- `backtester/lib/adr_reach_research.js`
- `backtester/tests/adr_reach_research.test.js`
- `backtester/tmp/oanda_eur_usd_daily.csv`
- `backtester/tmp/oanda_eur_usd_h1.csv`
- `backtester/tmp/oanda_xau_usd_daily.csv`
- `backtester/tmp/oanda_xau_usd_h1.csv`
- `backtester/tmp/oanda_nas100_usd_daily.csv`
- `backtester/tmp/oanda_nas100_usd_h1.csv`
- `backtester/tmp/binance_btcusdt_daily.csv`
- `backtester/tmp/binance_btcusdt_1h.csv`
- `data/adr-reach-research.json`
- `docs/CURRENT_STATE.md`
- `docs/CURRENT_TASK.md`
- `docs/ACTIVE_MILESTONE.md`
- `docs/SESSION_NOTES.md`
- `docs/CHANGELOG.md`

## Blockers

No repository-side blocker for the rebuilt `L2L 1H Sequence Research` release.

Current blocker for broader coverage:

- repo evidence does not yet include supportable `DXY` daily + `1H` history

## Next Immediate Action

Review the rebuilt `L2L 1H Sequence Research` outputs, then decide whether to document and commit the downstream-only research rewrite.

## Last Updated

2026-07-05 11:35 Europe/London
