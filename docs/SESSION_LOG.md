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

## 2026-10-04

### Session Goal

Put the printable Layer 1 call map on the rail, under the architecture entry the user looks at, so the dashboard reaches it in one click and the map still prints as one sheet.

### Completed

- Added the shared rail's first outbound entry, `Layer 1 Calls`, to both rail variants in `backtester/partials/shared_nav.html` - an anchor with no `data-tab`, directly under `Architecture` in the `System` group, keeping a tab's shape with a blue marker bar and a `&#8599;` arrow - and wrote it into all ten published pages (`index.html` +12, the other nine +10); `--check` reads `10 pages, 17 rail entries, 1 outbound, 0 change(s)`.
- Taught `backtester/scripts/build_shared_nav.js` the word outbound (`OUTBOUND` regex, `outboundOf` / `withoutOutbound`, a both-variants parity check and a presence check), so an outbound entry added to one variant or removed altogether now fails the builder.
- Extended `backtester/tests/site_nav_consistency.browser.test.js` with the outbound fingerprint, the new report line, the file check and a click-through from `index.html` and from inside `gold.html`'s gold-direction frame (5/5), and re-pointed the fourth test of `tests/layer1_call_flow.browser.test.js` from the hand-written rail the page never published at the shared rail's outbound link (4/4).
- Re-ran the neighbouring guards on this tree with no npm runner: gold view tidy, backtesting development release, live trading dashboard, dashboard writer selection, refresh progress and architecture-map validation, all green (the last four 43/43).
- Captured the rail at 1440px and 390px for `index.html` and `gold-backtesting.html` in the ignored `.local/scratch/` folder: the entry sits under `Architecture` with the blue bar and the arrow, and folds into the horizontal dock below 900px.
- Re-cut the change on `ae9a1f0` after another lane published the tenth page, `what-moves-gold.html`, while this branch waited: the bar and rail hunks merged as they were, the only conflict was the navigation guard's `--check` report line, `--write` refreshed `what-moves-gold.html`, and the three navigation comments that still said nine pages were brought up to ten.

### Important Note

The rail still holds the same seventeen dashboard views and the map still carries no navigation of its own, so the print path is unchanged. This branch is fast-forwardable onto `origin/main` at `4a99258`; publication is a single fast-forward push, and the local workflow export is not proof of live deployment.

### Next

- Fast-forward `origin/main` to `release/layer1-call-flow-rail-20261004` and re-read the live dashboard's rail.
- Re-point the `workers/analysis-engine-20261003` checkout's own rail entry and its fourth test at the published navigation, dropping the `.side-rail-link` CSS it duplicates.


## 2026-10-04 - What moves gold as the gold page's first tab

### Session Goal

Open the gold page on the page published earlier the same day: put `what-moves-gold.html` on `gold.html`'s strip as
its first tab, at the user's word, and re-point the two browser guards that pin that strip.

### Completed

- Added the first tab `#tab-whatmoves` (`What moves gold`) and the first panel `#panel-whatmoves` to `gold.html`, holding one short note and the lazy frame `#frame-whatmoves` onto the published `what-moves-gold.html`; `#tab-start` keeps its id, label and panel and only gives up `aria-selected="true"`. The page grew 34,423 -> 36,310 bytes (+1,887, CRLF kept), and `what-moves-gold.html` was not touched at all (26,395 bytes, unchanged sha256).
- Moved the landing view: the strip's order is now `['whatmoves', 'start', 'direction', 'movement', 'factor', 'archive']` and its fallback for a hash it does not name now reads `order[0]` rather than the literal `start`, so a reader arriving with no hash, or with a stale one, lands on What moves gold; `#start`, `#direction`, the rail's gold entry and the two census aliases keep meaning exactly what they meant.
- Re-pointed `backtester/tests/gold_view_tidy.browser.test.js` (13,357 -> 14,691 bytes, +1,334) at the six views and the five framed pages in document order, added `what-moves-gold.html` to the framed-page honesty markers, and added a check that the frame a reader now lands on loads; 7/7 green.
- Re-pointed `backtester/tests/site_nav_consistency.browser.test.js` (27,340 -> 27,481 bytes, +141) at the strip's six ids and the five framed pages, and moved the bar's no-hash gold landing assertion from Start here to What moves gold; 5/5 green. This was the one pin the first pass of the edit script missed, and the guard failed on it with a 30-second `waitForFunction` timeout before the fix.
- Proved the edit script reproduces the change rather than trusting it: re-run against a pristine `0a64ec5` worktree, it rewrote all three files to byte-identical sha256 values, with a byte delta printed per file and every anchor required to match exactly once.
- Re-ran the neighbouring guards on the same tree with no npm runner - live trading dashboard, backtesting development release, architecture-map validation, dashboard writer selection and refresh progress - all exit 0.
- Wrote `docs/GOLD_WHATMOVES_TAB_20261004.md` as the handoff note, naming the bytes, the hashes, the guard results and what was deliberately left alone.

### Important Note

The gold page shows one more framed view and no new figure: nothing on `what-moves-gold.html` was copied, rewritten or re-measured, no rail or bar entry changed, and the frame is lazy so the page pays for it only when a reader opens or reaches it. The one behaviour that did change for a reader is the landing view, which the page's own head comment now states. Publication is a single fast-forward push onto `origin/main`, and a local export is not proof of live deployment.

### Next

- Fast-forward `origin/main` onto `release/gold-whatmoves-tab-20261004` and re-read the live gold page's strip.
- Read the live page as a reader would at 390px and 1440px and confirm the landed frame renders the published page.


## 2026-10-04 - the call map carries the navigation, and prints without it

### Session Goal

Put the shared bar and rail on the printable call map, keep both off the printed sheet, and give the page a
white palette a reader can check on screen before printing, because a dark sheet does not print.

### Completed

- Registered `layer1-call-flow.html` as the builder's eleventh nav page and wrote the block into it with
  `node backtester/scripts/build_shared_nav.js --write` (that one page reported `placed`); `--check` now reads
  `11 pages, 17 rail entries, 1 outbound, 0 change(s)`. The block's render is unchanged, so no other page's bytes
  moved and the partial's edit is its own header comment.
- Added the sheet switcher to the page's title block: a `Paper sheet · print preview` button (`#sheetToggle`) that
  writes `data-theme="paper"` on `<html>`, a paper palette that reuses the print block's own ink colours, a button
  that stays `hidden` until its script has run and reports its state with `aria-pressed`, and `beforeprint` /
  `afterprint` so a print job started from the dark view still lands on ink and paper.
- Made the page's print block the block's own off-switch: `body > header.site-nav.topbar` and
  `body > aside.site-nav.side-rail` are `display:none` on paper, `body > aside.site-nav.side-rail ~ main` gets its
  left edge and full width back, and the switcher is hidden. The bar rule names both of its classes because the
  block's own `.site-nav.topbar` carries two, and a first cut that named one left a 63px bar above the sheet and
  pushed the map to 780px of 733px.
- Replaced the chain's window-wide `@media (max-width:1180px)` stacking rule with `main{container-type:inline-size}`
  and `@container (max-width:1216px)`: the rail's fixed 232px leaves a 1440px window about 1145px of column, where
  the old rule kept the run going and `market_snapshots` broke mid-word. The print block still puts the run back on
  one line.
- Extended `tests/layer1_call_flow.browser.test.js` with a fifth test - the bar, the rail and the switcher on
  screen, the 232px the fixed rail holds, six measured contrast ratios on the paper sheet, no card starved in the
  paper view at 1440px or 390px, and the printed sheet carrying none of the three - and re-pointed its wide-screen
  chain assertions at the map's own column; 5/5.
- Re-pointed `backtester/tests/site_nav_consistency.browser.test.js` at eleven served pages (the report pin, the
  test name and two comments that still called the map a page carrying no navigation of its own); 5/5, with the map
  now inside the per-page fingerprint and the six-width layout pass.
- Re-ran the neighbouring guards on the same tree with no npm runner - backtesting development release, live
  trading dashboard, refresh progress, dashboard writer selection, L2L levels, architecture-map validation and gold
  view tidy - 101/101.
- Wrote `docs/CALL_MAP_NAV_AND_SHEET_20261004.md` as the handoff note, and recorded in
  `docs/CALL_MAP_LAYER2_20261004.md` that its "no bar and no rail of its own" line is superseded.
- Re-cut the change on `6f4e91b` after another lane published two live-trading snapshots (`data/live-trading.json`
  only) mid-branch; no file here overlapped them and the rebase was clean.
- Pushed `e571106` onto `origin/main` as a fast-forward over `6f4e91b` and read both delivery paths back:
  `raw.githubusercontent.com` and GitHub Pages both serve 38,446 bytes of the map carrying the block and the
  switcher, and a headless reader on the live Pages URL sees the bar and the rail on screen with the map clear of
  the rail, the paper view white behind dark ink, and in print the bar, the rail and the switcher all
  `display:none` with `main` at the sheet's own left edge and no script errors.
- The reader then took the two open questions, and both stand as shipped: the bar and the rail keep their dark
  chrome in the paper view, because only the map body is printed, and the rail's fixed 232px with the chain
  stacking in a 1440px window is accepted. The note records both as decisions rather than as gaps.

### Important Note

The switcher changes the sheet's palette, not the navigation's: the bar and the rail keep the dark chrome they wear
on all eleven pages, and they are off the sheet in print either way. The printed grid itself is unchanged - 709.94px
of 733px with the smallest type at 7.6px, measured with the web font blocked for both versions. Publication is a
push onto `origin/main`, and a rendered local page is not proof of live deployment.

### Next

- Push the branch onto `origin/main` and re-read the live map: the bar and rail on screen, the paper sheet, and the
  one-page print preview.

## 2026-10-08 - the printable USD Layer 1 call map published on the bar and the rail

### Session Goal

Put the USD agent breakdown page on the live dashboard so the user can open it and print it, on the instruction
"I need to see it live on the dashboard and give me the link once done".

### Completed

- Published `usd-layer1-call-flow.html`, the USD-only twin of the printable call map: eight chain steps, the ten
  factors with their fifty per-horizon weights, the deterministic score behind the worked 2024-01-09 call, the four
  honesty limits, and one A4 landscape sheet.
- Added a seventh bar entry, `USD Call Map`, and a second outbound rail entry of the same label to both variants in
  `backtester/partials/shared_nav.html`, then wrote the block into all twelve pages with
  `node backtester/scripts/build_shared_nav.js --write`: `--check` reads `12 pages, 17 rail entries, 2 outbound,
  0 change(s)`.
- Added the sheet as the builder's twelfth page, so it carries the bar and the rail itself, and left its print
  block to take both off the sheet and return `main` to the sheet's left edge.
- Added the sheet's guard, `tests/usd_layer1_call_flow.browser.test.js`, with two navigation tests on top of the
  three that hold the picture: the hop from the bar and from the rail, and the block on screen with the bar and the
  rail gone in print; 5/5.
- Re-pointed the navigation guard at the twelfth page and the second outbound entry: `BAR_LABELS`, `BAR_HREFS`,
  `RAIL_OUTBOUND_HREFS`, `RAIL_OUTBOUND_LABELS`, the `--check` report pin, the test name, and the two filters that
  read `Call Map` and now name the whole label, because `USD Call Map` contains it; 5/5.
- Re-ran the neighbouring guards on the same tree - the call map, the live-trading set, refresh progress, the
  backtesting development release, gold view tidy, architecture-map validation and dashboard writer selection - all
  green.
- Pushed `a8490c7` onto `origin/main` and read both delivery paths back: the live sheet returns HTTP 200 with 29,932
  bytes and sha256 `7478e426...` byte-identical to the committed blob, the live `index.html` returns 27,380 bytes
  and sha256 `b5e70387...` carrying both entries, and a headless reader on the live dashboard makes both hops with
  the USD heading, eight chain steps and no script error.

### Important Note

The rail still holds seventeen dashboard views; the two outbound entries under them are links, not tabs, and the
sheet is a page a reader prints rather than a view. Two live-trading chart guards fail on this tree and fail
identically at production `0539f1d` in a detached worktree (`expected: 120, actual: 576`), so they are
pre-existing and were not touched. Publication is a push onto `origin/main`; a rendered local page is not proof of
live deployment.

### Next

- Read the live Pages copy back after the push and record the bytes, the hash and the two hops in
  `docs/USD_CALL_FLOW_PUBLICATION_20261008.md`.
- Decide whether the two live-trading chart guards should be fixed in the checkout that owns them.
## 2026-10-08 - the USD call map gets its white printable version

### Session Goal

The user's one line - "again this needs to be made with a white printable version" - on the USD Layer 1 call
map published minutes earlier: the page was dark on screen and its printed block left the dark palette's pale
accent tints on white paper, while its twin the call map has carried a white printable version - a screen
preview plus an ink-on-paper printed sheet - since 2026-10-04.

### Completed

- Re-read the call map's own version before writing anything: the `html[data-theme="paper"]` palette, the
  `#sheetToggle` button in the title block, the `beforeprint` / `afterprint` script and the print block that sets
  the same palette, all held by `tests/layer1_call_flow.browser.test.js` (5/5).
- Gave the USD page the same version: the switcher in the title block, its styles, the screen paper theme, and a
  print block that asks for the light scheme and re-points each colour variable at a paper ink, so the printed
  sheet no longer carries the screen's pale blue step numbers, mint and amber pills or grey notes.
- Measured the printed copy instead of assuming it: every visible text run on the sheet clears 4.5:1 against
  what it sits on, the sheet is `rgb(255, 255, 255)` under `rgb(15, 23, 32)` ink, no card fills darker than a
  pale tint, and the switcher is off the sheet; screenshots of both views sit in the ignored `tmp/` folder.
- Extended the sheet's guard with that contract: 6/6 in the release worktree, 4/4 in this lane's checkout.
- Re-ran the neighbouring guards on the same tree - the navigation guard 5/5 with `--check` reading
  `12 pages, 17 rail entries, 2 outbound, 0 change(s)`, and the call map 5/5.

### Important Note

The screen view stays dark and gains only the switcher, so the page keeps the site's dark workstation look; the
white version is the reader's choice on screen and the printer's copy on paper. The lane checkout holds the page
without the shared-navigation block and without these published docs, exactly as it does for the call map.

### Next

- Publish the change on `origin/main` and read the live copy back: bytes, hash, and the switcher on the live page.
- Decide whether the call map should take the same paper inks, whose light greys are its own old choice.
