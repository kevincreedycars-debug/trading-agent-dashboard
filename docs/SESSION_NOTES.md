# Session Notes

Last updated: 2026-07-03

## Work Completed

- Confirmed the full Layer 1 historical replay rollout is already validated across USD, EUR, Gold, NQ, and BTC.
- Added a new `Weekday Breakdown` Backtest / Accuracy sub-tab so the main research area stays compact.
- Derived the weekday-by-confidence breakdown directly from the existing deterministic checker artifacts instead of generating new replay outputs or recalculating confidence.
- Used stored displayed headline confidence to bucket rows into Weak `0-49`, Moderate `50-64`, Strong `65-79`, and Very Strong `80-100`.
- Included all checker rows in the weekday totals, including `NO_CALL` and `NOT_EVALUABLE`, so per-asset weekday totals reconcile exactly back to the checker artifact row counts.
- Added `backtester/scripts/validate_weekday_breakdown.js` and confirmed reconciliation passes for USD `604`, EUR `602`, Gold `608`, NQ `604`, and BTC `850`.
- Expanded the local Playwright smoke script to verify the existing matrices, existing checker views, and the new weekday breakdown tab with correct weekday columns by asset.
- Re-ran validation successfully: syntax checks, five checker validators, weekday reconciliation validator, and browser smoke all pass.
- Updated Weekday Breakdown cells so flats are separated from directional wins/losses and the displayed rate is ex-flat only.
- Added a `Day Totals` table above each asset's confidence-bucket table, with ex-flat rate, `W / L / F / T`, and flat rate for each weekday plus the all-days total.
- Extended the weekday validator to prove day totals equal the sum of bucket rows for each weekday and still reconcile back to the checker row counts.
- Committed and pushed the flat-aware weekday breakdown follow-ups to `origin/main`.
- Added a new `Pair Trade Research` Backtest / Accuracy sub-tab for EUR/USD, XAU/USD, NQ/USD, and BTC/USD.
- Built pair-trade research entirely from same-date target + USD checker rows using stored displayed headline confidence only, with combined confidence defined as `min(target, USD)`.
- Added pair-trade coverage summary, accuracy summary, combined-confidence bucket table, day totals, weekday breakdown, and conflict/no-trade summary.
- Added `backtester/scripts/validate_layer2_pairing_analysis.js` and confirmed it passes alongside the existing five checker validators.
- Expanded the local browser smoke test to verify the new Pair Trade Research tab renders without console errors.
- Committed and pushed the Pair Trade Research implementation to `origin/main`.
- Refined the Pair Trade Research UI without changing any pairing or Layer 1 calculations.
- Reworked the top `Layer 2 Pair Summary` into a compact comparison layout, improved detailed-table spacing safety, and updated terminology so the summary now uses `Trade Days %` against matched historical days.
- Re-ran lightweight validation and browser smoke after the UI refinements; current platform state is stable and validated.
- Rebuilt the old daily-range ADR path into `L2L 1H Sequence Research` as a separate downstream module.
- Updated `backtester/scripts/validate_adr_reach_research.js` so daily candles provide `ADR20` and sequence-aware `1H` candles determine wins/misses.
- Added repo-local OANDA daily + `1H` coverage for `EUR_USD`, `XAU_USD`, and `NAS100_USD`, plus Binance daily + `1H` coverage for `BTCUSDT`.
- Added `backtester/importers/oanda/download_oanda_candles.js` and `backtester/importers/binance/download_binance_candles.js` to make those repo-local candle files reproducible.
- Extended `backtester/scripts/validate_adr_reach_research.js` so `EUR`, `Gold`, `NQ`, and `BTC` Layer 1 plus `EUR/USD`, `XAU/USD`, `NQ/USD`, and `BTC/USD` Layer 2 now build real sequence-aware L2L results from supportable daily + `1H` sources.
- Tightened the OANDA session-date normalization so non-BTC sources do not silently pick up weekend session labels while BTC preserves weekend handling.
- Updated the local dashboard smoke test so `L2L 1H Sequence Research` now verifies summary tables, confidence tables, day totals, weekday tables, diagnostics tables, and console-clean rendering.
- Re-ran syntax checks, the new ADR validator, all existing Layer 1 checker validators, the existing Layer 2 pairing validator, and browser smoke successfully.
- Confirmed `USD` remains unavailable because no repo-local `DXY` daily + `1H` source exists.

## Unfinished Work

- Source supportable `DXY` or other accepted USD benchmark daily + `1H` history only if a real non-estimated source can be staged repo-locally.

## Blockers

- No repository-side blocker.
- No current release blocker.
- Any n8n API key previously exposed in chat should still be treated as compromised and replaced if it has not already been rotated.

## Assumptions

- Canonical memory documents live in `docs/`, with `CODEX_STARTUP.md` kept at the repository root.
- `docs/ACTIVE_MILESTONE.md` is the current checkpoint only; completed milestone history belongs in `docs/CHANGELOG.md`.
- GitHub remains the source of truth, n8n remains execution, Supabase remains data, and GitHub Pages remains the active dashboard host.
- Historical research work remains downstream-only and must not change production runtime behavior.
- Replay outputs, checker semantics, flat bands, and headline confidence logic remain frozen unless a later task explicitly changes them.

## Exact Next Task

Finish commit-ready cleanup for the shipped `L2L 1H Sequence Research` module.

Design intent for the handover:

- The sequence-aware `1H` rewrite is now live locally and validated.
- Current supportable repo-local scope is `EUR`, `Gold`, `NQ`, and `BTC` for Layer 1, plus `EUR/USD`, `XAU/USD`, `NQ/USD`, and `BTC/USD` for Layer 2.
- Required move for the current research path is `50% ADR20`, with fixed legacy L2L values retained as diagnostics only.
- The next step is not to weaken the blocker rules; it is to confirm cleanup, then source verified `DXY` daily + `1H` coverage if standalone `USD` research is still required.
