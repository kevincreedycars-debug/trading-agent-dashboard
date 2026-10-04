# The Layer 1 call map on the rail - one outbound entry, no view touched

Date: 2026-10-04. Branch: `release/layer1-call-flow-rail-20261004`, cut from `origin/main` at `4a99258` and re-cut
on `ae9a1f0` after another lane published the tenth page, `what-moves-gold.html`, while this branch waited.
Order: the user's words - "I need to see the document live on the dashboard, add it to the architecture tab
and when I click it it leads to a page where I can then print it out if needs be".

## What changed

Both rail variants in `backtester/partials/shared_nav.html` now end with the same **outbound** entry, directly
under `Architecture` in the `System` group:

```html
<a class="side-rail-link" href="layer1-call-flow.html" target="_top">Layer 1 Calls</a>
```

The block is the only source, so the entry landed on all ten published pages in one write: `index.html` gains
12 lines (a two-line comment plus the link, then the CSS), the other nine gain 10 lines each (the link and the
same CSS) - `what-moves-gold.html` included, since the write refreshed the page that arrived on `main` mid-branch.
`node backtester/scripts/build_shared_nav.js --write` then `--check` reports
`10 pages, 17 rail entries, 1 outbound, 0 change(s)`.

Facts that make this entry different from the seventeen above it:

- The rail still holds the same **seventeen** dashboard views, in the same four groups, and every one of them is
  still the `data-tab` button `script.js` drives on the dashboard and the `index.html#<view>` link elsewhere.
- The new entry is an anchor with **no `data-tab`**, written identically in both variants, so the dashboard's tab
  binder never sees it and no page's view table changes.
- It keeps a tab's shape so the rail still reads as one column, and shows two things a tab does not: the marker
  bar in the link blue (`rgba(94,161,255,.8)`) instead of the active tab's gold, and a `&#8599;` arrow at the
  right edge, inside the added right padding.
- At 900px and below the dock folds it in as one more chip, on the same row and at the same height as the tabs,
  with the marker bar moved to the chip's underline and the arrow hidden - the same treatment the tabs get.

`backtester/scripts/build_shared_nav.js` learned the word *outbound*: an `OUTBOUND` regex over the rail parts,
`outboundOf` / `withoutOutbound` helpers, an assertion that both rail variants carry the same outbound lines,
and a presence assertion, so an outbound entry added to only one variant, or removed altogether, fails the
builder rather than one page's guard.

## The guards that were re-pointed

- `backtester/tests/site_nav_consistency.browser.test.js` - 5/5. `RAIL_OUTBOUND_HREFS` / `RAIL_OUTBOUND_LABELS`
  pin the entry in the partial, the `--check` report line now expects `1 outbound`, the static and live-DOM
  blocks assert the entry's label, `href`, `target="_top"` and its file's existence, and the click-through test
  makes the hop from `index.html` and from inside `gold.html`'s gold-direction frame.
- `tests/layer1_call_flow.browser.test.js` - 4/4. Its fourth test was written against the hand-written rail the
  page never published; it now asserts the map is reached as the shared rail's outbound link: the label and
  `target="_top"`, no `data-tab` on it, and a click that lands on the map.

## Verified this session, all local

- `node backtester/scripts/build_shared_nav.js --check` - 10 pages, 17 rail entries, 1 outbound, 0 changes.
- `node --test backtester/tests/site_nav_consistency.browser.test.js` - 5/5.
- `node --test tests/layer1_call_flow.browser.test.js` - 4/4.
- `node --test backtester/tests/gold_view_tidy.browser.test.js` - 7/7 - and
  `node --test tests/backtesting_development_release.browser.test.js` - 1/1.
- `node --test tests/l2l_levels.test.js` - 48/48, re-run because `main` moved onto this tree.
- `node --test tests/live_trading_dashboard.browser.test.js tests/dashboard_writer_selection.test.js
  tests/refresh_progress.browser.test.js tests/validate_architecture_map.test.js` - 43/43.
- Screenshots in the ignored `.local/scratch/` folder (`rail-shot.js`, `shots-dash/`, `shots/`): the entry
  renders below `Architecture` with the blue bar and the arrow at 1440px on `index.html` and on
  `gold-backtesting.html`, and folds into the horizontal dock at 390px.

## What this change does not do

- Nothing else about the navigation moves: the bar, the seventeen views, the four groups and the `ADM` /
  `Control Room` head and `Published dashboard` foot are as they were.
- The map itself is unchanged and still carries no navigation of its own, so it still prints as a single sheet;
  it is still outside the builder's ten pages.
- No Layer 1 or Layer 2 agent, workflow, credential, dataset or backend code is touched, and no dashboard view
  reads anything new.
- Publication is a separate operation: the re-cut branch sits directly on `origin/main` at `ae9a1f0` and is pushed
  there as its own step.

## The re-cut of 2026-10-04

Another lane published `ae9a1f0` (the tenth page, `what-moves-gold.html`, with its own bar entry) while this branch
was being prepared, so the rail entry was replayed on that tip by rebasing rather than pushed over it. The two
changes are additive and land on different parts of the block, so the bar hunks and the rail hunks merged as they
were and only one line conflicted: the navigation guard's `--check` report assertion, which was re-cut to
`10 pages, 17 rail entries, 1 outbound, 0 change(s)`. `--write` refreshed `what-moves-gold.html`, the one page the
merge left stale, and the three navigation comments that still read "nine pages" were brought up to ten
(`backtester/partials/shared_nav.html`, `backtester/scripts/build_shared_nav.js`,
`tests/layer1_call_flow.browser.test.js`).
