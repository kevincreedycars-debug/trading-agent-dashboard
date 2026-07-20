# Changelog

## 2026-07-20

### Added

- Added a CLIXML-based local credential continuity system under `%USERPROFILE%\.trading-agent-dashboard\` with local templates for setting, validating, loading, running with, backing up, and restoring encrypted credentials.
- Added repository-safe bootstrap and validation wrappers for the local credential system in `scripts/bootstrap-local-secrets.ps1` and `scripts/check-required-secrets.ps1`.
- Added `config/credential-manifest.json` and `config/credential-manifest.schema.json` to define the supported credential inventory, scopes, and availability policy.
- Added `docs/CREDENTIAL_CONTINUITY.md` to document the supported local continuity workflow for future Codex sessions.
- Added `backtester/tests/credential_redaction.test.js` for importer URL-redaction behavior.
- Added `backtester/tests/secret_scanner.test.js` and repository-local `.githooks/pre-commit` secret-scanner enforcement.
- Added UK-time hover/focus tooltips to every available Layer 1 `24H` expiry section while preserving the visible ET expiry value on the Overview cards.

### Changed

- Updated `scripts/create-local-secret-home.ps1` so local bootstrap preserves an existing credential home by default and only force-syncs templates when explicitly requested.
- Validated local credential continuity with successful read-only probes for `n8n`, Supabase, FRED, OANDA, and Alpha Vantage, while recording RapidAPI endpoint verification as inconclusive due to timeout.
- Corrected project-memory runtime references so the latest successful workflow evidence now reflects the 2026-07-20 `data/workflow-status.json` artifact.
- Kept the expiry source contract unchanged by continuing to use `forecast_window_end` with `expires_at` as fallback only, then converting that same timestamp to `Europe/London` in the tooltip with automatic GMT/BST handling.
- Extended `playwright-dashboard-smoke.js` to verify the Layer 1 expiry tooltip contract, hover/focus accessibility, ET display preservation, and no-overflow behavior.
- Updated startup and active-state project memory so routine summaries ignore unrelated `.claude/launch.json` local state and the active task now points to the upcoming Architecture Mirror phase.

## 2026-07-07

### Added

- Added `backtester/lib/phase2_shadow_backtest.js` for conservative research-only shadow reweighting, shadow decision gating, and original-vs-shadow comparison helpers.
- Added `backtester/scripts/build_phase2_shadow_backtest.js` to build the checked-in `data/phase-2-shadow-backtest.json` artifact from the existing checker artifacts plus checked-in Factor Edge evidence.
- Added `backtester/tests/phase2_shadow_backtest.test.js` covering increase/reduce decisions, low-sample no-change handling, conservative no-call gating, and summary reconciliation.
- Added a new top-level `Shadow Logic Backtest` dashboard tab that reads only from `data/phase-2-shadow-backtest.json`.

### Changed

- Built and checked in the first `data/phase-2-shadow-backtest.json` artifact for `USD`, `EUR`, `Gold`, `NQ`, and `BTC` at `24H`.
- Kept the Phase 2 shadow path fully downstream-only by reusing stored checker factor signals and stored evaluation inputs instead of touching live Layer 1 logic, live Layer 2 logic, replay source-of-truth files, checker outputs, or existing Factor Edge evidence calculations.
- Extended `playwright-dashboard-smoke.js` so the browser smoke now verifies the `Shadow Logic Backtest` tab and confirms the new research tables keep horizontal overflow contained locally.

## 2026-07-06

### Added

- Added `backtester/lib/factor_edge_lab.js` for research-only factor reliability, alignment, and weight-mismatch helpers driven from checked-in checker artifacts.
- Added `backtester/scripts/build_factor_edge_lab.js` to build the checked-in `data/factor-edge-lab.json` artifact for Layer 1 and Layer 2 factor evidence review.
- Added `backtester/tests/factor_edge_lab.test.js` covering ex-flat directional scoring, alignment splits, and Layer 2 USD-side inversion semantics.
- Added a new top-level `Factor Edge Lab` dashboard tab that reads only from `data/factor-edge-lab.json`.

### Changed

- Built and committed the first Factor Edge Lab artifact in `data/factor-edge-lab.json` with Layer 1 coverage for `USD`, `EUR`, `Gold`, `NQ`, and `BTC`, plus Layer 2 coverage for `EUR/USD`, `XAU/USD`, `NQ/USD`, and `BTC/USD`.
- Kept factor-level ADR/L2L opportunity metrics explicitly unavailable in the artifact and dashboard because no full per-prediction factor-joinable export is staged locally.
- Extended `playwright-dashboard-smoke.js` so the browser smoke now verifies the `Factor Edge Lab` tab and its research-only ADR/L2L unavailable contract.

## 2026-07-05

### Added

- Added `backtester/lib/adr_reach_research.js` for shared daily-ADR + `1H` sequence research helpers.
- Added `backtester/tests/adr_reach_research.test.js` with synthetic `1H` sequence cases covering bullish/bearish order dependence and missing-candle handling.
- Added `backtester/importers/oanda/download_oanda_candles.js` for reproducible OANDA daily + `1H` candle downloads.
- Added `backtester/importers/binance/download_binance_candles.js` for reproducible Binance daily + `1H` candle downloads.

### Changed

- Replaced the old daily OHLC range-availability path with `L2L 1H Sequence Research`.
- Rebuilt `data/adr-reach-research.json` so required move is `50% ADR20` from daily candles while win/miss evaluation is sequence-aware using `1H` candles.
- Added supportable downstream research coverage for `Gold` and `XAU/USD` using OANDA `XAU_USD`, and switched `NQ` research onto OANDA `NAS100_USD`.
- Updated the dashboard wording, summaries, diagnostics tables, and smoke coverage to use the new `L2L 1H Sequence Research` terminology consistently.

## 2026-07-03

### Added

- Added a new `ADR Reach Research` Backtest / Accuracy sub-tab driven by a checked-in downstream artifact in `data/adr-reach-research.json`.
- Added `backtester/scripts/validate_adr_reach_research.js` to audit supportable OHLC coverage, build the ADR reach artifact, and validate ADR20 windowing, no-lookahead behavior, threshold calculation, weekday reconciliation, and checker invariants.
- Added `backtester/importers/eurusd/download_eurusd_daily_ohlc_alpha_vantage.js` to download deterministic repo-local `EUR/USD` daily OHLC coverage from Alpha Vantage `FX_DAILY`.
- Added `backtester/importers/btc/download_btcusd_daily_ohlc_coinbase.js` to download deterministic repo-local `BTC/USD` daily OHLC coverage from Coinbase Exchange candles.

### Changed

- Kept the new ADR module fully downstream of replay, checker, confidence, and Pair Trade Research logic.
- Implemented ADR reach using the existing repo-local `QQQ` OHLC proxy file for `NQ`, with evaluation-day `Open` as the reference price and previous-close fallback logic preserved for future supportable OHLC feeds.
- Expanded ADR reach support onto `EUR`, `BTC`, `EUR/USD`, and `BTC/USD` using the new repo-local OHLC sources, while keeping `Gold`, `XAU/USD`, and `USD` unavailable until supportable true `XAU/USD` and `DXY` OHLC sources exist.
- Tightened ADR validation so non-BTC assets cannot silently pick up weekend OHLC rows and BTC must preserve weekend calendar handling.
- Expanded the local dashboard smoke script so the new ADR Reach Research tab verifies summary tables, confidence tables, day totals, weekday tables, and console-clean rendering.

## 2026-07-02

### Added

- Added a `Weekday Breakdown` Backtest / Accuracy tab that shows day-of-week performance by displayed headline confidence bucket for USD, EUR, Gold, NQ, and BTC without changing the existing matrices or checker views.
- Added `backtester/scripts/validate_weekday_breakdown.js` to reconcile weekday totals and confidence-bucket totals back to each canonical checker artifact, while enforcing weekday coverage rules for BTC vs non-BTC assets.
- Added flat-aware weekday cells that show ex-flat directional win rate plus `W / L / F / T` counts, including `Flat only` handling when a bucket or weekday has no directional rows.
- Added a `Day Totals` row/table above each asset's confidence-bucket weekday table so users can scan weekday performance before drilling into confidence buckets.
- Added a new `Pair Trade Research` Backtest / Accuracy sub-tab for EUR/USD, XAU/USD, NQ/USD, and BTC/USD using same-date target + USD checker rows.
- Added `backtester/scripts/validate_layer2_pairing_analysis.js` to validate pair-trade coverage, accuracy, combined-confidence buckets, day totals, weekday breakdowns, and conflict/no-trade summaries.

### Changed

- Derived the weekday breakdown directly from the existing deterministic checker artifacts so the dashboard uses stored displayed headline confidence and stored evaluation outcomes instead of recalculating confidence or altering replay/checker semantics.
- Expanded the local Playwright dashboard smoke script to cover the new weekday breakdown tab, verify weekday columns by asset, and keep the Backtest / Accuracy panel free of console errors during the smoke path.
- Updated the weekday breakdown so flats are separated from directional wins and losses the same way the main accuracy matrices treat flat outcomes.
- Extended the weekday validator to verify bucket-to-weekday reconciliation, flat-rate calculations, ex-flat win-rate calculations, and the new day-level totals.
- Added pair-trade research coverage, accuracy, confidence-bucket, day-total, weekday, and conflict/no-trade views without changing Layer 1 replay outputs, checker semantics, flat bands, or headline confidence logic.
- Used combined pair confidence as `min(target headline confidence, USD headline confidence)` and treated same-direction or missing-USD setups as non-trade research outcomes rather than live Layer 2 logic.
- Refined the Pair Trade Research UI so the per-pair KPI cards use the same responsive dashboard grid language as the rest of the dashboard and the confidence-bucket table spacing no longer crushes right-hand percentage columns.
- Replaced the original wide Layer 2 top-summary table with a compact comparison layout, then clarified its terminology so `Trade Days %` and `Strong+ Trade Days %` are defined against matched historical days instead of the broader paired-row count.
- Re-ran lightweight syntax checks, the pair-trade validator, and browser smoke at session close to confirm the current research platform remains stable after the Pair Trade Research UI refinements.

## 2026-06-29

### Added

- Added EUR replay core, historical snapshot builder, historical replay runner, parity fixture, parity script, EURUSD importer, EUR evaluation script, EUR checker builder, and EUR checker artifact.
- Added dashboard support for the EUR 24H matrix and EUR checker alongside the existing USD research views.
- Added linked-warehouse test locking so the Node smoke tests no longer race each other against shared Supabase-backed tables.

### Changed

- Reproduced the live EUR 24H deterministic workflow exactly in replay using the current `exports/eur_layer1_agent.json` node semantics rather than the generic markdown weight table where they differ.
- Generated EUR historical replay coverage for `2024-01-02` through `2026-04-30` where warehouse data allows.
- Unblocked EUR outcome evaluation by importing historical EURUSD series and evaluating EUR primarily against direct EUR/USD movement instead of any USD-style DXY benchmark.
- Set the provisional EUR-only 24H flat band to `0.15` for EUR evaluation and checker generation without changing shared USD evaluation defaults.
- Generated a passing EUR checker artifact with result `602 / 0 / 0 / 0`.
- Updated the linked-warehouse tests to validate stable research invariants instead of brittle global row-count assumptions.

## 2026-06-22

### Added

- Added `docs/CORE_RESEARCH_PHILOSOPHY.md` as the authoritative guiding document for research/backtesting principles.
- Added `docs/PHASE3_HISTORICAL_EXPANSION_REPORT.md` to record the first USD historical expansion attempt and its evidence summary.
- Added `docs/PHASE3_HISTORICAL_WEAKNESSES.md` to capture warehouse and evaluator issues discovered during Phase 3 evidence collection.
- Added `docs/HISTORICAL_DATA_INVENTORY.md` as the warehouse-completeness source of truth for USD replay inputs through end-2024.

### Changed

- Updated backtester and project-memory documentation to reference the new core research philosophy and reinforce that measurement comes before optimization.
- Corrected stale hosting references where documentation still conflicted with the current GitHub Pages deployment model.
- Corrected the historical evaluator so missing or zero close prices are now treated as `NOT_EVALUABLE` instead of false `-100%` benchmark wins.
- Attempted expansion of the USD replay window to `2024-05-31`, confirmed the frozen research framework still runs end-to-end, and documented that the warehouse currently only supports the continuous January 2024 USD window.
- Shifted Phase 3A focus onto historical warehouse completion planning instead of replay or metric changes.

## 2026-06-21

### Changed

- Updated the live `Eco Events Collector` workflow to remove the duplicate-insert failure against `economic_events`.
- Replaced the previous direct Supabase write with idempotent routing: dedupe incoming events, look up existing rows for the run date, update matching rows, and create only unmatched rows.
- Validated the live collector with two immediate reruns; executions `1081` and `1082` both succeeded with no `economic_events_event_date_currency_event_name_event_time_t_key` error.
- Re-exported the updated live workflow into `exports/eco_events_collector.json`.

## 2026-06-19

### Added

- Confirmed GitHub repository access for `kevincreedycars-debug/trading-agent-dashboard`.
- Added project memory documentation scaffold.
- Added `docs/CURRENT_STATE.md`.
- Added `docs/CURRENT_TASK.md`.
- Added `docs/NEXT_STEPS.md`.
- Added `docs/ARCHITECTURE.md`.
- Added `docs/N8N_INTEGRATION.md`.
- Added `CODEX.md`.
- Added read-only n8n MCP server scaffold in `mcp-n8n/`.
- Added MCP tools for listing workflows, fetching workflows, listing executions, and fetching executions.

### Current Focus

- Build AI-assisted development environment.
- Connect ChatGPT/Codex to GitHub and n8n.
- Reduce manual copy/paste of workflow JSON and node code.
- Keep first n8n MCP version read-only until exports exist.

### Known Issues

- Eco Events Collector duplicate insert failure.
- EUR Agent parser must support OpenAI JSON Object output.
- Master Orchestrator needs final execution summary.

## 2026-06-20

### Added

- Exported live n8n workflow JSON snapshots into `exports/`.
- Added dashboard Master Orchestrator control panel.
- Added `data/workflow-control.json` for non-secret dashboard trigger configuration.
- Added `data/workflow-status.json` for published run status and error reporting.
- Added dashboard rendering for workflow status, step reports, and error reports.
- Added `CODEX_STARTUP.md` as the permanent Codex working-memory startup guide.
- Added `docs/SESSION_NOTES.md` for latest-session handoff notes.
- Added `docs/PROJECT_HISTORY.md` for concise high-level project milestones.

### Pending

- Verify an end-to-end dashboard-triggered run.
- Refine status reporting if n8n child workflow error payloads need richer parsing.

### Changed

- Added a production Webhook Trigger to the live Master Orchestrator.
- Published the Master Orchestrator and referenced child workflows.
- Configured `data/workflow-control.json` with the production webhook URL.
- Added Master Orchestrator status publishing to `data/workflow-status.json`.
- Added visual-only Backtest / Accuracy dashboard tab using placeholder mock data.
- Added static `data/backtest.json` placeholder for agent accuracy and variable correlation UI scaffolding.
- Updated `CODEX.md` and project memory docs to require Codex to read memory first, summarise state, and update only changed memory documents at session end.
- Expanded the permanent memory process with startup summaries, milestone updates, session close notes, commit/push expectations, and canonical memory file locations.
- Updated `CODEX_STARTUP.md` to require continuous documentation updates, logical milestone commits, and startup recovery from repository memory.
- Added `docs/ACTIVE_MILESTONE.md` as the live checkpoint for the current feature and updated startup rules to read it after `docs/CURRENT_TASK.md`.
- Refined `CODEX_STARTUP.md` to use smart staged startup, concise startup summaries, runtime validation against repository evidence, documentation-drift handling, and stricter session close rules.
- Updated supporting documentation to point startup behavior at `CODEX_STARTUP.md` and use `docs/SESSION_NOTES.md` for current session memory.
- Reworked the dashboard to display a derived confidence score as the headline call metric while preserving Bull Case, Bear Case, Net Edge, and Participation as separate diagnostics.
- Added a compact Overview definitions legend beneath the Layer 1 calls.
- Replaced the shared dashboard card top strip gradient with a single navy strip.
- Added shared Layer 1 dashboard normalization so confidence and a 7-day direction outlook are derived reliably from the latest loaded timeframe calls.
- Added an Overview 7-day direction outlook section and updated the current `data/layer1.json` snapshot to carry `confidence` and `seven_day_outlook`.
- Confirmed the public static host is GitHub Pages and that the earlier local confidence commit had not yet been pushed when deployment was checked.
