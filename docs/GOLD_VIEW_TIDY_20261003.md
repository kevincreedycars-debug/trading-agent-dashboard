# Gold view tidy - five views, the three reads always together, the censuses at the end

Date: 2026-10-03. Branch: `gold/view-tidy-20261003`, based on `origin/main` at `a94fb55`, which is the published
navigation change. Order: `codex-045-GOLD_VIEW_TIDY_AND_FAULT_FIRST_ORDER_20261003.md`, revision 3, with section 4
as the brief. The user confirmed all five points that filing put to him the same day, including that the two archive
census tabs stay "for now" and that the shared header and menu are built now rather than later.

## What changed

`gold.html` was one strip over four frames - Direction, Backtest evidence, 28-factor outcomes and Factor tables
(draft). Two archive censuses led the page, and no tab showed the direction read beside the two movement ranges the
user named on 2026-09-28. It is now five views, in this order:

| View | Holds | How |
| --- | --- | --- |
| Start here | what the page is; its dates; the three sizes in plain words; where the numbers come from; what the page is not; the collector fault as outstanding | written into the page |
| Direction | the caller's own record on the 570 sessions, then the direction scorecard | table written into the page, then `gold-direction-scorecard.html` framed |
| Movement - L2L and half L2L | how far gold moved at 0.3618% and at 0.7236%, on the 570 sessions | written into the page |
| Factor tables (draft) | the work-in-progress factor page, with its banner, answered count, as-of line and "what this page is not" intact | `gold-factor-wip.html` framed |
| Archive census | the evidence audit and the 28-factor outcomes census, plainly labelled as being about the archive | `gold-backtesting.html` and `gold-backtest-outcomes.html` framed |

Nothing was deleted and no address broke. The four framed pages are the pages they always were, at their own
addresses; a link or bookmark that named one of the two censuses (`gold.html#backtesting`, `gold.html#outcomes`)
opens the Archive census view and scrolls to the page it names, and the rail's gold entry still opens
`gold.html#direction`. The bar's gold entry opens `gold.html` with no hash, so it lands on the page's own first
view - Start here - which is what the guard now asserts.

## The rule the user set, and how the page holds it

The user's standing instruction is that he wants "direction, l2l and 0.5l2l data always"; the order states it as a
rule - wherever a rate is printed, the direction read, the full-L2L movement share and the half-L2L movement share
are printed together, each with its own sample count and its own one-line plain explanation. The page holds it
three ways:

1. Start here, Direction and Movement each open with the same three-reads block: direction (gold closed up on
   56.84% of the 570 days; the call right at the close on 46.32%), half L2L (97.89% of days, 558 of 570), full L2L
   (75.26% of days, 429 of 570). A reader cannot reach a rate on this page without those three beside it.
2. Every table row carries its figure, its sample and its plain-words line, and no figure appears without them; the
   tidied page's guard checks each one by name.
3. The two sets that are not the 570 sessions - the per-side split and the scorecard's per-year up-day baseline -
   say so in their own headings, with their own counts, so two different row sets are never mixed inside one claim.

## The numbers, their dates and their sources

No number on the page is new to the site and none was re-derived, re-cut or re-rendered for it. Every figure is
quoted from what is already published here:

- The 570 archived gold call sessions (4 January 2024 to 30 April 2026) and the 21,871 complete hourly XAU/USD
  bars (2 January 2023 to 11 September 2026) are the sets named in the accepted read
  (`docs/strategy/GOLD_DATA_USEFULNESS_READ_20261003.md` in the strategy lane's worktree).
- The movement counts, the shares and the direction reads were re-read on 3 October 2026 and are carried with that
  date in the page's own words.
- The four day-size figures (day range 1.4472%, full L2L 0.7236%, half L2L 0.3618%, median close-to-close 0.6701%)
  and the per-side split (300 bearish calls 40.00%, 270 bullish 53.33%) are the 2026-09-28 measurement of the same
  570 sessions, and the page marks them as that measurement rather than as re-measured. Per revision 2 of the order
  they stay marked until the same run that prints the movement counts re-prints them; that print needs the movement
  measurement lane, which is not open.
- The per-year rows (2023 51.54% of 260 anchors, 2024 59.16% of 262, 2025 60.15% of 261, 2026 50.83% of 181, and
  55.81% of 964 in all) are read from the direction scorecard's own embedded data, published already at
  `gold-direction-scorecard.html`, and are labelled as that page's own set.
- The archive verdict quoted on the census view - the archive "can describe this space, but it cannot support
  choosing from it" - is that page's own published sentence.
- The collector fault is stated as `docs/GOLD_HISTORY_PATCH_VALIDATION.md` and `docs/CURRENT_STATE.md` state it:
  the live Gold collector still reads an unordered 25-row history window and the fix remains outstanding.

Two honest omissions, recorded rather than papered over. The calls' own split by year is not printed: the accepted
read this page quotes does not carry its per-year counts, so the page says so instead of guessing. And the
five-session half-range read (99.82%) is carried as a sentence, not a table row, because the read does not carry
that row's day count.

## What was not touched

- The four framed pages, their generators, their templates and their data artifacts: `gold-direction-scorecard.html`
  (152,265 bytes), `gold-backtesting.html` (301,106), `gold-backtest-outcomes.html` (28,168) and
  `gold-factor-wip.html` (33,435) are byte-identical to what `origin/main` served before this branch.
- Their iframe titles, so a guard elsewhere that selects a frame by title still finds it, and the draft page's
  banner, answered count, as-of line and "what this page is not" section.
- The shared navigation block: `node backtester/scripts/build_shared_nav.js --check` still reports
  `9 pages, 17 rail entries, 0 change(s)` on this branch, so the tidy did not hand-edit the block.
- No other page, stylesheet, script, generator, guard, data artifact, register entry or workflow.

The tidied page's only file is `gold.html`, plus the two guard files described below and this note.

## What this tidy is not

It is not a new measurement and not a new claim. It adds no data, re-cuts nothing, re-renders nothing and prints no
figure that was not already published on this site or in the accepted read behind it. It asserts no edge, no
accuracy, no prediction, no timing and no trading result, and it does not touch the sealed prospective window. The
four framed pages remain the only places their numbers live: this page presents them, and where the tidied views
lead with figures, every one carries its own sample and date.

## The fault-first item, and where it stands

The order puts the collector fault ahead of the display work: apply the validated Gold history patch and close the
25-row unordered read, because every later observation inherits the defect. That is a production change to the live
n8n workflow `Data Collector - GOLD` (`0z71FpOfKdL72hgW`, node `Supabase | Get Previous Market Snapshots`), and
`docs/GOLD_HISTORY_PATCH_VALIDATION.md` sets the gate it must pass first: an isolated, manual-only validation
workflow (generator `backtester/scripts/build_gold_history_isolation.js`, checker
`backtester/scripts/verify_gold_history_capture.js`) executed against the installed n8n runtime, with the capture
reconciled against an independent reference, and only then production application. The patch file is unchanged since
2026-09-09 and its own status line still reads `LOCAL_REVIEW_ONLY_NOT_APPLIED`.

So this branch does what a page change can do and no more: it names the fault as outstanding on the view a reader
lands on, and it leaves the patch unapplied. Applying it needs the live n8n credentials and a production decision,
which is a separate operation from this tidy and is not run here.

## The guard

`backtester/tests/gold_view_tidy.browser.test.js` is new (13,357 bytes, 236 lines) and holds seven tests:

1. the strip carries the five views in order, each labelled as confirmed, each pointing at its own panel, one for one.
2. the four pages are still framed, in the tidied order, and each still carries its own honesty line.
3. every rate printed on the tidied page carries its own sample count and a plain-words line (15 figures checked by
   name, plus the four day sizes).
4. the three-reads block appears on each view written into this page, with exactly three cards, and the direction
   read and both range figures are present in it.
5. the landing view states what the page is not, with its dates, and the archive's own verdict and the collector
   fault are on the page.
6. the views open by hash, by click and by arrow key; the old census hashes open the Archive census view and scroll to
   the page they name; a hash naming no view lands on the default.
7. no view scrolls sideways at 1440, 1180, 860, 768, 721 or 390px, and every frame loads when its view opens.

`backtester/tests/site_nav_consistency.browser.test.js`, the navigation guard, changed only where the tidied page
changed the answer it asserts (+28 / -8): gold.html carries five views rather than four, still frames the same four
pages, the rail's gold entry must name a view that exists, the bar's gold entry (no hash) lands on the page's first
view, and the frame hop opens the Direction view and scrolls to the frame the way a reader would.

## Evidence, measured 2026-10-03 in this worktree

| Check | Command | Result |
| --- | --- | --- |
| The tidied page's own guard | `node --test backtester/tests/gold_view_tidy.browser.test.js` | 7 tests, 7 pass, 0 fail, about 4.2s |
| The navigation guard | `node --test backtester/tests/site_nav_consistency.browser.test.js` | 5 tests, 5 pass, 0 fail, about 23s |
| The navigation block is untouched | `node backtester/scripts/build_shared_nav.js --check` | `9 pages, 17 rail entries, 0 change(s)` |
| The page's size | `gold.html` on disk | 32,567 bytes, 410 CRLF lines, one line ending from top to bottom; the page's own diff is +238 / -27 |
| The framed pages | their bytes | 152,265 / 301,106 / 28,168 / 33,435, identical to `origin/main` |
| Tag balance | `<section>`, `<div>`, `<table>` counts | 5/5, 32/32, 4/4 |
| The three gold hop guards, run here from the release bundle | copies of the three `gold_*_dashboard_link.browser.test.js` files placed in `backtester/tests`, run, then removed | the draft page's guard 2/2 pass; the direction guard fails one assertion (it expects a hash-less `gold.html` to open Direction, which now opens Start here) and the outcomes guard fails one (it clicks `#tab-outcomes`, now part of the Archive census view). Both are the stale-gold-hop item below, not a fault in the tidied page |

Both failures are in the guards' landing assumptions and nowhere else: the direction guard's probe of the framed
scorecard (`#c-scored` 25, 25 rows, its own dashboard link) and the outcomes guard's probe of the census
(`#c-evaluated` 4,956, the archive verdict) both still hold once the view that holds the page is opened.

## Still outstanding, and who it belongs to

1. **The collector fault fix** (`codex-045` section 5.1, first in the user's order): apply the validated patch
   `backtester/drafts/gold_collector_history_query_patch.json` to the live `Data Collector - GOLD` node, after the
   isolated n8n runtime acceptance `docs/GOLD_HISTORY_PATCH_VALIDATION.md` requires. Production work with
   credentials: not run here, and the patch is still unapplied.
2. **Two stale gold hop guards** in the checkout that holds them (the release bundle's and the root checkout's
   `gold_direction_dashboard_link.browser.test.js` and `gold_outcomes_dashboard_link.browser.test.js`): one line each
   - open the view the guard means, or assert the landing view, and for the outcomes guard click the Archive census
   view and probe `#frame-outcomes` instead of `#tab-outcomes` and `#panel-outcomes`. These guards are not tracked on
   `origin/main`; they live in the checkout that holds them, the same rule the navigation change recorded for the
   stale six-entry bar.
3. **The movement measurement lane** (`gold-declared-band-measurement-026`): only a coordinator register edit can
   open it, and it is what turns the Movement view's promised per-factor columns into rows with their own day counts.
   Until then the page carries the base rates and says so in plain words.
4. **The four day-size figures' re-print** by the same run that prints the movement counts (`codex-045` revision 2),
   which waits on item 3.


