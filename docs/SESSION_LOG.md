# Session Log

## 2026-06-19

### Session Goal

Start building the AI-assisted development environment for the trading-agent platform.

### Completed

- User confirmed GitHub repository: `kevincreedycars-debug/trading-agent-dashboard`.
- GitHub access confirmed with admin and push permissions.
- Created `docs/CURRENT_STATE.md`.
- Created `docs/CURRENT_TASK.md`.
- Created `docs/NEXT_STEPS.md`.
- Created `docs/ARCHITECTURE.md`.
- Created `docs/CHANGELOG.md`.

### Important Note

An n8n API key was supplied in chat. It must not be committed to GitHub or placed in documentation.

The n8n workspace base URL is still required before API integration can be tested.

### Next

- Add `docs/DECISIONS.md`.
- Add `issues/active_bugs.md`.
- Add `issues/fixed_bugs.md`.
- Add n8n integration plan once workspace URL is known.

## 2026-06-20

### Session Goal

Add a live dashboard control for running the full n8n Master Orchestrator and showing workflow errors.

### Completed

- Confirmed n8n API access using runtime-only environment variables.
- Listed live n8n workflows.
- Exported expected workflow JSON snapshots into `exports/`.
- Added a dashboard Master Orchestrator control panel.
- Added `data/workflow-control.json` as non-secret webhook configuration.
- Added `data/workflow-status.json` as the dashboard-readable run status contract.
- Added dashboard status polling and error report rendering.
- Verified `script.js` with `node --check`.

### Important Note

The n8n API key was exposed in chat again. It should be revoked after this proof-of-access and replaced with a fresh key stored only in a secure runtime.

### Next

- Add a Webhook Trigger to the live Master Orchestrator.
- Update `data/workflow-control.json` with the production webhook URL.
- Add final status writing in Master Orchestrator so it updates `data/workflow-status.json`.

### Follow-up Completed

- Added a production Webhook Trigger to the live Master Orchestrator.
- Configured all referenced child workflows as active/published so the Master Orchestrator can publish.
- Added a final status builder and GitHub file writer to the Master Orchestrator.
- Updated `data/workflow-control.json` with the production webhook URL.
- Refreshed workflow JSON exports after live n8n changes.

## 2026-06-20 - Backtest Accuracy Visual Shell

### Session Goal

Add the visual dashboard shell for Backtest / Accuracy without building the database, Supabase schema, or backtest engine.

### Completed

- Added a top-level Backtest / Accuracy dashboard tab.
- Added Agent Direction Accuracy and Variable Correlation Analysis sub-tabs.
- Added placeholder metric cards, asset/timeframe accuracy blocks, recent completed calls table, factor leaderboards, correlation table, empty states, and next-phase roadmap card.
- Added `data/backtest.json` with mock placeholder values only.

### Constraints Preserved

- No Layer 1 logic changed.
- No Layer 2 logic changed.
- No Dashboard Writer workflow changed.
- No Supabase schema or backtest calculation engine added.

## 2026-10-03

### Session Goal

Make the top bar and the side rail the same on every published page, so the gold pages match the dashboard homepage, and settle Task 0's stale navigation mirror.

### Completed

- Added `backtester/partials/shared_nav.html` as the one canonical source for the top bar and the side rail, in two named variants, with the nav's own CSS inside a `<style id="shared-nav-css">` block.
- Added `backtester/scripts/build_shared_nav.js` (`--write` / `--check` / `--print`), which renders the partial into all nine pages between the `SHARED-NAV` markers in each page's own line endings; `--check` reports `9 pages, 17 rail entries, 0 change(s)`.
- Wrote that block into `index.html`, `gold.html`, `dashboard-northstar.html`, `standing-dashboard.html`, `backtest-flow.html`, `gold-direction-scorecard.html`, `gold-backtest-outcomes.html`, `gold-backtesting.html` and `gold-factor-wip.html`, and removed the hand-written bar and rail from `index.html` plus the one-line related-pages headers from the three gold research pages.
- Added `tabFromHash` / `setupHashTabs` to `script.js` so a rail entry that names a dashboard view opens that view on load and on `hashchange`, with an unknown hash falling back to the dashboard's own default view.
- Added `backtester/tests/site_nav_consistency.browser.test.js` (five tests, all green in about 12s) guarding byte equality with the partial, the bar and rail fingerprint, every link's landing place including from inside `gold.html`'s frames, the draft page's one-request budget and the block's layout cost at 1440, 1180, 860, 768, 721 and 390px.
- Re-ran the existing page guards from this worktree with their files and data artifacts copied in for the run: `backtest_flow_page` 2/2, `gold_research_page`, `gold_direction_scorecard_page` 2/2 and `gold_backtest_outcomes_page` all pass against the new block.
- Recorded in `docs/SITE_NAV_CONSISTENCY_20261003.md` that the checkout on `orchestration/control-plane-20260920` mirrors a six-entry bar, so the three gold hop guards that live there pass against a bar production no longer serves, while `origin/main` already carries the published four-entry bar.

### Important Note

The change was committed on `site/nav-consistency-20261003` and then published in a separate step at the user's word: `f8bc80f..a94fb55 site/nav-consistency-20261003 -> main`, the remote `main` ref verified at `a94fb55`, and the live pages re-read afterwards (`index.html` 18,775 to 24,821 bytes, `gold.html` 5,733 to 14,388 bytes, both carrying the shared block and the rail's `gold.html#direction` entry).

### Next

- Run the GOLD view tidy and fault-first order per `codex-045-GOLD_VIEW_TIDY_AND_FAULT_FIRST_ORDER_20261003.md`.
- Re-point the three gold hop guards in the checkout that holds them at the published bar: three bar links and one Gold entry.

## 2026-10-03 - the printable Layer 1 call map published, one new bar entry

### Session Goal

Make the Layer 1 call-flow one-pager reachable from the live site and publish it, on the user's instruction.

### Completed

- Published `layer1-call-flow.html`, the printable one-page map of how the eight Layer 1 calls are made, carried over byte for byte from `e919dbc`.
- Added the fifth bar entry, `Layer 1 Calls`, to both bar variants in `backtester/partials/shared_nav.html` and wrote it into the nine published pages with `node backtester/scripts/build_shared_nav.js --write`: one added line per page, `--check` reading `9 pages, 17 rail entries, 0 change(s)`.
- Added the two files the page promises: `docs/LAYER1_OPENAI_CREDITS_INCIDENT_20261001.md`, which its footer cites as a source, and `tests/layer1_call_flow.browser.test.js`, which its footer names as its guard - with the fourth test re-pointed at the shared bar, since it was written against the hand-written bar `a94fb55` replaced.
- Pinned the fifth bar label, its href, its `target="_top"` and its landing place in `backtester/tests/site_nav_consistency.browser.test.js`; 5/5 green in about 29s, including the hop from `index.html` to the map.
- Ran the map's own guard 4/4 against the published copy: offline render at five widths, one A4 landscape sheet, the honesty flags, the shared bar hop.

### Important Note

The rail stays at seventeen entries. The builder refuses an `href` inside the dashboard's `rail-dashboard` variant and the standalone rail must mirror it entry for entry, so a rail entry for a printable page is a change to the navigation contract rather than a port. The checkout's own rail entry therefore stays on `workers/analysis-engine-20261003`, unmerged.

### Next

- Decide whether the map should also be a rail entry, which needs `backtester/scripts/build_shared_nav.js` and its guard widened to eighteen entries with one outbound entry allowed.
- Re-point the fourth test in that checkout's copy of `tests/layer1_call_flow.browser.test.js` when it moves onto the published navigation.

## 2026-10-03 (live trading port publish)

### Session Goal

Put the 1h and 4h chart views and the L2L levels marking on the live dashboard, which is the port the user's own words asked for and then put above every other queued item.

### Completed

- Reviewed the `live-trading` worker's filed candidate `20261003-live-trading-live-port-candidate-r1` on its own bytes: `a6ae075` on `workers/live-trading-port-tip-a94fb550`, parent `a94fb550`, eight files and +2,892/-324 reproduced exactly, zero conflict markers, `node --check` clean on the four code files, `tests/l2l_levels.test.js` 48 of 48 and the two neighbouring node suites 15 of 15.
- Cut a release worktree `.local/live-trading-port-release` on the candidate and made the two companion changes the publish owes: `tests/live_trading_dashboard.browser.test.js` widened from "the read-only section must carry no form control" to "every control must be one the section binds with its own live data attribute", which takes that guard from 1 of 2 to 2 of 2, and one cache-buster token bumped in `index.html` so a returning reader is not served the pre-port `script.js` from cache.
- Re-cut the port on the tip that moved under it: another lane published the printable Layer 1 call map as `3350a89` at 21:24:59 while this publish was being prepared, so the candidate was replayed on it by the same hunk recipe and the eight files came across with the same +2,892/-324 and no conflict.
- Ran the release's own local suite: 225 of 230 pass and the same five fail as on a separate worktree checked out at the pristine tip `a94fb55` - four recorded `secret_scanner` cases and `confidence_band_delivery`'s SILVER delivery row - so the port adds no failure.
- Fast-forwarded `origin/main` from `3350a89` to the release commit and verified the live page afterwards.

### Important Note

The port is code only. The published snapshot still carries `quote` and `m5` with no `h1` or `h4` block, so the two new view buttons draw disabled until the producer refreshes `data/live-trading.json` and the coordinator republishes it; the levels file still carries four instruments at zero levels because nothing has been marked yet; and marking publishes to the repository with the reader's own token, sent only to `api.github.com`.

### Next

- The lane's producer run that emits the `h1` and `h4` blocks, filed for republish, so the zoom-out works on the live page.
- The seed levels marked on the 1h and 4h charts with the ladder read against them, then the entry rule from the 5m close-beyond-level trigger, in the order the user set out.

## 2026-10-03 - Gold view tidy

### Session Goal

Tidy the gold page so the direction read and the two movement ranges are always shown together, carry the two archive
censuses to the end of the strip, and record the collector fault as the first outstanding item instead of working
around it.

### Completed

- Tidied `gold.html` into five views: Start here, Direction, Movement - L2L and half L2L, Factor tables (draft) and Archive census. Every rate on the page carries its own sample count and plain-words line, and the direction read sits beside the half-L2L and full-L2L shares on every view written into the page.
- Wrote the caller's own record (the 570 archived sessions), the per-side split and the scorecard's per-year up-day baseline into the Direction view, and the movement base rates into the Movement view, quoting only figures this site or the accepted read already publishes, with the 2026-09-28 figures marked as that measurement.
- Kept every old address working, including `gold.html#backtesting` and `gold.html#outcomes`, which open the Archive census view and scroll to the page they name, and left the four framed pages byte-identical.
- Added `backtester/tests/gold_view_tidy.browser.test.js` (seven tests, 7/7 in about 4.2s) and re-pointed the navigation guard's gold assertions (+28 / -8, 5/5 in about 23s), leaving the shared navigation block untouched at `9 pages, 17 rail entries, 0 change(s)`.
- Recorded in `docs/GOLD_VIEW_TIDY_20261003.md` that the collector fault fix remains unapplied production work, that two old gold hop guards in the checkout that holds them need one line each, and that the movement measurement lane is the only route to the per-factor columns.
- Re-cut the tidy on the tip that moved under it and published it in the same session the live-trading port was published: `gold/view-tidy-20261003` fast-forwarded onto `main` over the port, with the gold page's guard and the navigation guard re-run on the re-cut tree and the live `gold.html` re-read afterwards.

### Important Note

The page change is published; the fault fix the user asked for first is a live n8n change that needs credentials and an isolated runtime acceptance, so it is recorded here and not run.

### Next

- Apply the validated Gold history patch to the live `Data Collector - GOLD` node, after the isolated runtime acceptance `docs/GOLD_HISTORY_PATCH_VALIDATION.md` requires.
- Re-point the two stale gold hop guards in the checkout that holds them, plus the three stale bar-hop assertions recorded from the navigation change.
- Open the movement measurement lane (`gold-declared-band-measurement-026`) so the Movement view's per-factor columns and the four day-size figures' re-print can land.
