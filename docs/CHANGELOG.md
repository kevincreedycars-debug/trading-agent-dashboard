# Changelog

## 2026-10-08

### Added

- Added `usd-layer1-call-flow.html`, the printable one-page map of how the USD Layer 1 call is made - eight workflow steps, the ten weighted factors with their fifty per-horizon weights, the deterministic score behind the worked 2024-01-09 call, and four honesty limits - together with the five-test guard that travels with it (`tests/usd_layer1_call_flow.browser.test.js`).
- Added `docs/USD_CALL_FLOW_PUBLICATION_20261008.md` as the handoff note for this release.

### Changed

- Added a seventh bar entry, `USD Call Map`, and a second outbound rail entry of the same label to both variants in `backtester/partials/shared_nav.html`, so the USD sheet is one click from the bar and from the rail on all twelve published pages; the rail keeps its seventeen `data-tab` entries, because the rail drives dashboard views and these two entries leave the dashboard set.
- Registered the sheet as the twelfth page in `backtester/scripts/build_shared_nav.js` and wrote the block into it with `--write`: the new page placed, the other eleven refreshed, `--check` reading `12 pages, 17 rail entries, 2 outbound, 0 change(s)`.
- Left the USD sheet's own print block to take the bar and the rail off the sheet and to return `main` to the sheet's left edge, so what a reader prints is still the map alone on one A4 landscape page; its guard holds that alongside the sheet's one-page fit, which is unchanged.
- Extended `backtester/tests/site_nav_consistency.browser.test.js` with the seventh bar label, its href and `target`, the two outbound label pairs, the updated `--check` report pin, a USD hop from inside `gold.html`'s gold-direction frame, and whole-label filters in the two places that read `Call Map` - which `USD Call Map` now contains as a substring; the guard is 5/5.
- Extended `tests/usd_layer1_call_flow.browser.test.js` with two tests - the hop from the bar and from the rail into the sheet, and the block on screen with the fixed rail beside the map and the bar and rail `display:none` in print - so the sheet has the same navigation guard the call map has; the guard is 5/5.
- Published the release and read it back live: `usd-layer1-call-flow.html` returns HTTP 200 with 29,932 bytes and sha256 `7478e426...`, byte-identical to the committed blob, and the live `index.html` (27,380 bytes, `b5e70387...`) carries both new entries; a headless reader on the live dashboard makes the bar hop and the rail hop into the sheet.
- Re-ran the neighbouring guards on the same tree with no npm runner - the call map 5/5, live-trading dashboard 2/2, levels visibility 2/2, readback 2/2, rule panel 2/2, refresh progress 26/26, backtesting development release 1/1, gold view tidy 7/7, architecture-map validation 7/7, dashboard writer selection 8/8 - all green; `tests/live_trading_chart_pan.browser.test.js` and `tests/live_trading_chart_zoom.browser.test.js` fail identically on this change and on production `0539f1d` (`expected: 120, actual: 576`), so they are pre-existing and untouched here.

- Given the white printable version the call map has carried since 2026-10-04: `usd-layer1-call-flow.html` now has a `Paper sheet · print preview` switcher (`#sheetToggle`, `aria-pressed`, hidden until its own script runs) that writes `data-theme="paper"` on `<html>` and swaps the dark palette for the same ink-on-paper palette the printed sheet uses, remembers the choice under the page's own `usd-call-map-sheet` key, forces the paper view for the length of a print job with `beforeprint` / `afterprint`, and is `display:none` on the sheet - so a reader who never touches the switcher still prints ink on white rather than the dark palette's pale blue step numbers, mint and amber pills and grey notes on white paper.
- Held the printed sheet to the paper palette itself: the print block now asks for `color-scheme:light` and re-points `--text`, `--muted`, `--dim`, `--amber`, `--blue`, `--teal`, `--good` and `--bad` at the call map's own paper inks, so the two sheets read alike, and only its two card washes and its two pill borders still needed overriding.
- Extended `tests/usd_layer1_call_flow.browser.test.js` with the white-printable-version guard: the switcher and its two states, every colour the reader reads words in above 4.5:1 on the paper palette with the heading above 7:1, no card outgrowing its box at 1440px or 390px, and the printed sheet read from the dark view landing on `rgb(15, 23, 32)` ink over `rgb(255, 255, 255)` paper with the switcher gone and every printed line above 4.5:1 against whatever it sits on - so the sheet's guard is 6/6.

## 2026-10-04

### Added

- Added the rail's first outbound entry, `Layer 1 Calls`, to both rail variants in `backtester/partials/shared_nav.html` - an anchor with no `data-tab`, directly under `Architecture` in the `System` group, keeping a tab's shape with a blue marker bar and a `&#8599;` arrow - and wrote it into all ten published pages (`index.html` +12, the other nine +10), so the printable call map is one click from the rail as well as from the bar.
- Added `docs/LAYER1_CALL_FLOW_RAIL_ENTRY_20261004.md` as the handoff note for this change.
- Framed the published `what-moves-gold.html` as the gold page's first tab: `gold.html` gained `#tab-whatmoves` / `#panel-whatmoves` (labelled `What moves gold`, `aria-selected="true"`) and the lazy frame `#frame-whatmoves`, the strip's order became the six views, and a reader arriving with no hash or a stale one now lands on that tab rather than on Start here (`#start` still opens Start here); +1,887 bytes.
- Added `docs/GOLD_WHATMOVES_TAB_20261004.md` as the handoff note for this change.
- Added the call map to the shared navigation's own pages: `layer1-call-flow.html` now carries the block itself - the bar, the rail and their CSS - so a reader navigates from it like any other page, and its own print block takes the bar, the rail and the sheet switcher off the printed sheet, leaving the map alone on one page; the block's render is unchanged, so no other page's bytes moved and `--check` reads `11 pages, 17 rail entries, 1 outbound, 0 change(s)`.
- Added a screen paper theme to `layer1-call-flow.html`: a `Paper sheet · print preview` button (`#sheetToggle`, `aria-pressed`, hidden until its own script runs) writes `data-theme="paper"` on `<html>` and swaps the dark palette for the ink-on-paper palette the print block already used, so the white sheet a printer lays down can be read on screen and printed from the view being read; `beforeprint` forces the paper attribute for the length of a print job and `afterprint` puts the reader's own choice back.
- Added `docs/CALL_MAP_NAV_AND_SHEET_20261004.md` as the handoff note for this change.

### Changed

- Taught `backtester/scripts/build_shared_nav.js` the word *outbound*: an `OUTBOUND` regex over the rail parts, `outboundOf` / `withoutOutbound` helpers, an assertion that both rail variants carry the same outbound lines and an assertion that they carry one at all; the summary now reads `10 pages, 17 rail entries, 1 outbound, 0 change(s)`.
- Extended `backtester/tests/site_nav_consistency.browser.test.js` with `RAIL_OUTBOUND_HREFS` / `RAIL_OUTBOUND_LABELS`, the updated `--check` report line, outbound assertions in the static and live-DOM blocks, the entry's file-existence check and a click-through from `index.html` and from inside `gold.html`'s gold-direction frame; the guard is 5/5.
- Re-pointed the fourth test of `tests/layer1_call_flow.browser.test.js` from the hand-written rail the page never published to the shared rail's outbound link - label, `target="_top"`, no `data-tab`, and a click that lands on the map; the guard is 4/4.
- Recorded in `docs/LAYER1_CALL_FLOW_PUBLICATION_20261003.md` that its note about the rail entry being written against a hand-written rail is now superseded by this change.
- Re-cut this change on `ae9a1f0` after another lane published the tenth page, `what-moves-gold.html`, mid-branch: the bar and rail hunks merged as they were, the only conflict was the navigation guard's `--check` report line, `--write` refreshed `what-moves-gold.html`, and the three navigation comments that still said nine pages were brought up to ten.

- Re-pointed the two guards that pin `gold.html`'s strip at its six views and at the view a reader now lands on: `backtester/tests/gold_view_tidy.browser.test.js` (six views and labels, the five framed pages in document order, `what-moves-gold.html`'s three declared lines, the landing view beside `#start`'s own check, and a load check for the frame a reader now lands on; +1,334 bytes, 7/7) and `backtester/tests/site_nav_consistency.browser.test.js` (the strip's six ids, the five framed pages, and the bar's no-hash gold entry waiting on `#tab-whatmoves` rather than on Start here; +141 bytes, 5/5).
- Moved the gold page's default view onto its first tab, What moves gold, and made the strip's fallback for a hash it does not name read `order[0]` rather than the literal `start`; `#start`, `#direction` and the two census aliases keep meaning exactly what they meant, and the page's own head comment states the new landing view so nothing is implicit.
- Re-ran the neighbouring guards on the same tree with no npm runner - live trading dashboard, backtesting development release, architecture-map validation, dashboard writer selection and refresh progress - all green.

- Registered the printable call map as the eleventh page in `backtester/scripts/build_shared_nav.js` (under `<body>`, like the other standalone pages) and brought its comments and the `--check`/`--write` summary up to eleven; the partial's own header comment now records that the map carries the block and that a page meant to print must take the block off its sheet itself.
- Extended `tests/layer1_call_flow.browser.test.js` with a fifth test - the bar, the rail and the switcher on screen, the 232px the fixed rail holds, the paper palette's six colours held to a measured contrast floor (heading above 7:1, the other five above 4.5:1), no card starved in the paper view at 1440px or 390px, and in print the bar, the rail and the switcher gone, `main` at the sheet's own left edge and paper ink from either view - and re-pointed the wide-screen chain assertions at the map's own column, because the rail now takes a fixed 232px off it; the guard is 5/5.
- Re-pointed `backtester/tests/site_nav_consistency.browser.test.js` at eleven served pages - the report pin, the test name and the two comments that still called the map a page carrying no navigation of its own; the guard is 5/5 and now loads the map in its per-page fingerprint and layout pass at six widths.
- Changed the call map's chain from a window-wide breakpoint to a container query on the map's own column (`main{container-type:inline-size}`, 1216px), so the seven cards stack where the rail has taken their room rather than breaking a word, while the print block keeps the run on one line.
- Recorded in `docs/CALL_MAP_LAYER2_20261004.md` that its note about the page carrying no bar and no rail of its own is superseded by this change.
- Re-cut this change on `6f4e91b` after another lane published two live-trading snapshots (`data/live-trading.json` only) mid-branch: no file here overlapped them and the rebase was clean.

## 2026-10-03

### Added

- Added `backtester/partials/shared_nav.html`, the one canonical source for the dashboard's top bar and side rail, with the rail in two named variants and the nav's CSS subset inside `<style id="shared-nav-css">`, so no page needs a new stylesheet link.
- Added `backtester/scripts/build_shared_nav.js` (`--write`, `--check`, `--print`) to render that partial into all nine published pages between the `SHARED-NAV` markers, in each page's own line endings.
- Added `backtester/tests/site_nav_consistency.browser.test.js`, a five-test guard over byte equality with the partial, the bar and rail fingerprint, every link's landing place (including from inside `gold.html`'s frames and from a stale hash), the draft page's one-request budget, and the block's layout cost at six widths.
- Added `docs/SITE_NAV_CONSISTENCY_20261003.md` as the handoff note for this change.
- Added `layer1-call-flow.html`, the printable one-page map of how the eight Layer 1 calls are made, with the four-test guard that holds it (`tests/layer1_call_flow.browser.test.js`) and the incident note its footer cites as a source (`docs/LAYER1_OPENAI_CREDITS_INCIDENT_20261001.md`).
- Added `docs/LAYER1_CALL_FLOW_PUBLICATION_20261003.md` as the handoff note for this release.
- Added `lib/l2l_ladder.js` and `lib/l2l_levels_store.js`, loaded by `index.html` ahead of `script.js`, so the Live Trading section draws the 1h and 4h views, the L2L ladder and the levels marking the user asked for.
- Added `docs/LIVE_TRADING_PORT_20261003.md` as the handoff note for that publish.
- Added `backtester/tests/gold_view_tidy.browser.test.js`, a seven-test guard for the tidied gold page: the five views and their order, the four pages still framed with their own honesty lines, every printed rate carrying its sample count and plain words, the direction-and-two-ranges block on each view written into the page, the landing view's dates and disclaimers, the hash and keyboard behaviour including the old census hashes, and the layout at six widths.
- Added `docs/GOLD_VIEW_TIDY_20261003.md` as the handoff note for the gold view tidy.

### Changed

- Gave `index.html`, `gold.html`, `dashboard-northstar.html`, `standing-dashboard.html`, `backtest-flow.html`, `gold-direction-scorecard.html`, `gold-backtest-outcomes.html`, `gold-backtesting.html` and `gold-factor-wip.html` the same bar - four entries, one `Gold` entry into `gold.html` - and the same seventeen-entry, four-group rail with the `ADM` / `Control Room` head and the `Published dashboard` foot.
- Replaced the hand-written bar and rail on `index.html` and the one-line related-pages headers on the three gold research pages with that block, keeping each page's own content and tabs.
- Added `tabFromHash` / `setupHashTabs` to `script.js` so a rail entry that names a dashboard view (`index.html#<view>`) opens that view on load and on `hashchange`, with an unknown hash falling back to the dashboard's default view.
- Recorded that the three gold hop guards pass only because the checkout on `orchestration/control-plane-20260920` mirrors a six-entry bar (`Gold Backtest`, `Gold Direction`, `Gold Factor (draft)`) that production no longer serves: `origin/main` already carries the published four-entry bar, and re-pointing those three assertions at the published route belongs in the checkout that holds them, per `codex-045` section 4.

- Added a fifth bar entry, `Layer 1 Calls`, to both bar variants in `backtester/partials/shared_nav.html` and wrote it into the nine published pages, so every page reaches the printable Layer 1 call map; the rail is unchanged at seventeen entries, because the rail drives dashboard views by `data-tab` and the map is a page a reader prints.
- Extended `backtester/tests/site_nav_consistency.browser.test.js` to pin the fifth bar label, its href, its `target="_top"` and its landing place, and re-pointed the fourth test of `tests/layer1_call_flow.browser.test.js` at the shared bar rather than at the hand-written entry it was written against.
- Recorded in `docs/LAYER1_CALL_FLOW_PUBLICATION_20261003.md` that the checkout on `workers/analysis-engine-20261003` carries a rail entry of its own against the hand-written rail `a94fb55` replaced, and that a rail entry for a printable page is a change to the navigation contract rather than a port of that work.
- Published the port candidate the `live-trading` worker filed as `20261003-live-trading-live-port-candidate-r1` - eight files, +2,892/-324, cut from `a94fb550` by the already-ruled hunk recipe with no merge commit, and re-cut on this tip by the same recipe once another lane had published `3350a89` - so the Live Trading section carries the M5, 1h and 4h views, the L2L ladder and the levels marking, with `data/l2l-levels.json` and `liveTradingUrl` left exactly as `main` carried them.
- Widened `tests/live_trading_dashboard.browser.test.js` from "the read-only section must carry no form control" to "every control must be one the section binds with its own live data attribute": the ruled marking panel's six fields are allowed, a form, dropdown or free-text area is not, the token field must stay a password field, the panel must say the token is only ever sent to `api.github.com`, and no control may read like an order path. The guard is 1 of 2 on the candidate before the widening and 2 of 2 after it.
- Bumped the `script.js` cache-buster token in `index.html` to `20261003-live-trading-port`, so a returning reader is not served the pre-port `script.js` from cache under the old token; the two new library tags keep the lane's own tokens.
- Tidied `gold.html` into five views - Start here, Direction, Movement - L2L and half L2L, Factor tables (draft) and Archive census - so the direction read, the full-L2L share and the half-L2L share are printed together wherever a rate appears, each with its own sample count and plain-words line, and the two archive censuses moved from the front of the strip to the last view, where they are labelled as being about the archive.
- Wrote the caller's own record, the per-side split and the scorecard's per-year up-day baseline into the gold page's Direction view, and the movement base rates into its Movement view, every figure quoted from what the site or the accepted read already publishes, with the 2026-09-28 figures marked as that measurement and the two honest omissions stated rather than filled in.
- Kept every old address working: the four framed pages are unchanged and still framed, and a link that named one of the two censuses (`gold.html#backtesting`, `gold.html#outcomes`) opens the Archive census view and scrolls to the page it names.
- Re-pointed the navigation guard's gold assertions at the tidied page (+28 / -8) - five views rather than four, the same four frames, the rail's gold entry naming a view that exists, the bar's gold entry landing on the page's first view, and the frame hop opening the Direction view before it reads the frame - and left the shared navigation block untouched (`9 pages, 17 rail entries, 0 change(s)`).
- Published the gold view tidy on the user's word: the branch `gold/view-tidy-20261003` fast-forwarded onto `main` over the live-trading port that preceded it, with the live `gold.html` re-read afterwards and every old gold address still landing.

## 2026-07-21

### Added

- Added the read-only `Architecture` dashboard tab driven by checked-in `data/architecture-map.json`.
- Added `data/architecture-map.schema.json`, `scripts/validate_architecture_map.js`, and `tests/validate_architecture_map.test.js` for schema validation, deterministic validation, and rule-level rejection coverage.

### Changed

- Added Architecture smoke coverage for lazy loading, failure isolation, selection, filtering, and responsive overflow.
- Deployed the Architecture Mirror to GitHub Pages and validated the live manifest, script, and stylesheet assets.
- Preserved the six explicitly uncertain architecture relationships as unverified rather than inferring unsupported production or research dependencies.
- Reworked the Architecture renderer so Overview now uses the exact 8-stage top-to-bottom order, focused views use deterministic vertical waterfalls, parallel nodes stay in contained responsive grids, the detail panel sits below the canvas, and geometry checks cover all 13 views.
- Removed the active horizontal graph path by using no absolute placement, no SVG bus routing, and no horizontal scrolling in the deployed Architecture renderer.
- Verified the live GitHub Pages waterfall deployment across all 13 views at `1440x900`, `1920x1080`, `1024x768`, and `390x844`.

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
