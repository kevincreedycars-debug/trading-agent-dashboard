# Active Milestone

## Current Feature

Backtest / Accuracy Pair Trade Research from canonical Layer 1 checker artifacts

## Current Milestone

Release pair-trade research summaries and breakdowns for target asset + USD setups

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

## Remaining Work

- Confirm the public GitHub Pages dashboard renders the Pair Trade Research tab cleanly.
- Decide the next analytical breakdown or research milestone.

## Current Files Being Modified

- `index.html`
- `script.js`
- `styles.css`
- `playwright-dashboard-smoke.js`
- `backtester/scripts/validate_weekday_breakdown.js`
- `backtester/scripts/validate_layer2_pairing_analysis.js`
- `docs/CURRENT_TASK.md`
- `docs/ACTIVE_MILESTONE.md`
- `docs/SESSION_NOTES.md`
- `docs/CHANGELOG.md`

## Blockers

No repository-side blocker.

## Next Immediate Action

Verify the public GitHub Pages dashboard renders the Pair Trade Research tab cleanly, then choose the next research breakdown.

## Last Updated

2026-07-02 13:55 Europe/London
