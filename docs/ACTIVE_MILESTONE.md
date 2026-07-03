# Active Milestone

## Current Feature

Backtest / Accuracy ADR Reach Research

## Current Milestone

Ship the first ADR reach research release and document the remaining OHLC blockers

## Status

Complete

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
- A new `ADR Reach Research` sub-tab now renders as a separate downstream Backtest / Accuracy module.
- The ADR module uses rolling previous-20-session ADR20 with a `50%` threshold and checks intraday target reach rather than close-to-close accuracy.
- The current repo evidence supports real OHLC-based ADR evaluation for `NQ` Layer 1 via the repo-local `QQQ` OHLC proxy file.
- The current repo evidence supports real OHLC-based ADR evaluation for `NQ/USD` Layer 2 by reusing existing Pair Trade Research tradable-signal selection and the same `QQQ` OHLC source.
- `EUR`, `Gold`, `BTC`, `USD`, `EUR/USD`, `XAU/USD`, and `BTC/USD` are now explicitly marked unavailable in the ADR module because repo evidence does not yet include supportable High/Low history for them.
- `backtester/scripts/validate_adr_reach_research.js` now builds and validates the ADR artifact, and browser smoke now passes with the ADR tab included.

## Remaining Work

- Source supportable OHLC history for `EUR`, `Gold`, `BTC`, and `USD`.
- Extend the ADR module onto the blocked assets and pairs only after verified High/Low coverage exists.
- Decide whether the current accepted Gold and BTC historical lineages should be upgraded to true OHLC feeds or remain ADR-unavailable.

## Current Files Being Modified

- `index.html`
- `script.js`
- `playwright-dashboard-smoke.js`
- `backtester/scripts/validate_adr_reach_research.js`
- `data/adr-reach-research.json`
- `docs/CURRENT_STATE.md`
- `docs/CURRENT_TASK.md`
- `docs/ACTIVE_MILESTONE.md`
- `docs/SESSION_NOTES.md`
- `docs/CHANGELOG.md`

## Blockers

No repository-side blocker for the shipped `NQ` / `NQ/USD` ADR release.

Current blocker for broader ADR coverage:

- repo evidence does not yet include supportable High/Low history for `EUR`, `Gold`, `BTC`, or `USD`

## Next Immediate Action

Source verified OHLC coverage for the blocked ADR assets without altering the existing Layer 1 replay/checker stack or the Pair Trade Research module.

## Last Updated

2026-07-03 11:40 Europe/London
