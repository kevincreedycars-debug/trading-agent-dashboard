# Site navigation consistency - one canonical bar and rail on all nine pages

Date: 2026-10-03. Branch: `site/nav-consistency-20261003`, based on `origin/main` at `f8bc80f`.
Order: `codex-045-COORDINATOR_NAV_TIDY_HANDOVER_20261003.md`, revisions 2 and 3, where the user's words
("make sure the top and side bar menus of this gold page match the homepage of the dashboard") set the test.

## What changed

Every published page now carries the same top bar and the same side rail, written from one source:

| Page | Role | Own navigation removed |
| --- | --- | --- |
| `index.html` | dashboard | its old `.topbar` and `aside.side-rail`, now the block |
| `gold.html` | gold tabs | none - it had no bar and no rail |
| `dashboard-northstar.html` | north-star brief | none |
| `standing-dashboard.html` | standing dashboard | none |
| `backtest-flow.html` | backtest flow | none |
| `gold-direction-scorecard.html` | gold direction | its own one-line related-pages header |
| `gold-backtest-outcomes.html` | gold 28-factor outcomes | its own one-line related-pages header |
| `gold-backtesting.html` | gold evidence | its own one-line related-pages header |
| `gold-factor-wip.html` | draft factor page | none - it loads nothing at all |

Staged change: the pages and `script.js` are 13 files, +1581 / -55, with no whole-file rewrite. The seven pages
that had no navigation gain 93 lines each, the three that carried a one-line header lose exactly that line,
`index.html` swaps 52 lines of hand-written bar and rail for the block, and `script.js` gains 26 lines of hash
handling. With this note and the changelog entry the commit is 15 files, +1702 / -55.

## The one source

- `backtester/partials/shared_nav.html` holds the bar, the rail in two named variants (`bar-dashboard` /
  `bar-standalone`, `rail-dashboard` / `rail-standalone`) and the nav's CSS subset copied from `styles.css`.
- `backtester/scripts/build_shared_nav.js` renders that partial into each page between
  `<!-- SHARED-NAV:START -->` and `<!-- SHARED-NAV:END -->`. It reports `9 pages, 17 rail entries`, writes in
  the page's own line endings, and stops on a missing marker, a second block or a page that disagrees.
- To change the navigation, change the partial only, then run
  `node backtester/scripts/build_shared_nav.js --write` and
  `node --test backtester/tests/site_nav_consistency.browser.test.js`. `--check` is the read-only form and is
  what the guard runs; a hand-edit of one page's block fails the guard.

The two variants exist because the pages are built two ways, and that is the only structural difference:

- On the dashboard the rail is the first column of `.dashboard-frame` and every entry is the `data-tab`
  button `script.js` already drives.
- On the other eight pages the rail is a direct child of `<body>` and every entry is a plain link with
  `target="_top"`, so a reader needs nothing outside the page to move around the site, and the four pages that
  `gold.html` shows in frames send their clicks to the whole window instead of opening the dashboard inside a
  frame.

The block brings its own CSS inside `<style id="shared-nav-css">` so no page needs a new stylesheet link and
every page still renders offline from a `file://` address. No `<link>`, `<script>`, image, frame or font
request may enter the block: `gold-factor-wip.html` loads nothing but itself, and the guard proves it by
serving the page and asserting its only request is its own document.

## The fingerprint that is now guarded

`node --test backtester/tests/site_nav_consistency.browser.test.js` runs five tests, all green, in about 15s:

1. every page's marker block is the partial's render byte for byte, in the page's own line endings, with no
   lone `\n` inside a CRLF file and no page still waiting to be written.
2. the partial is the agreed navigation in both variants: brand, the four bar labels in order, the rail head
   `ADM` / `Control Room`, the four groups `Operate`, `Live`, `Evidence`, `System`, the seventeen entries in
   order, the foot `Published dashboard`.
3. the nine pages served over HTTP show one bar and one rail, the exact fingerprints above, and every link
   they offer goes somewhere: a bar link without `target="_top"`, a missing `gold.html` bar entry, a rail
   entry naming a view that does not exist, or a page fetching anything else all fail here.
4. a rail entry lands on the view its label names, from any page and from inside `gold.html`'s frames, the
   rail marks the entry it opened, the bar's `Gold` entry opens `gold.html` on its direction tab - including
   from the draft page - and `index.html#not-a-view` still opens the dashboard's own default view.
5. the block widens no page and covers no table at 1440, 1180, 860, 768, 721 and 390px: the rail must be
   visible, no table or `pre` may sit under it, and the page's sideways scroll with the block must not exceed
   what it does without the block's styling (the one recorded exception is the draft page, which already
   scrolled 59px sideways at 390px before this change).

## Task 0 - the stale mirror

`origin/main`'s `index.html` already carries the published four-entry bar (`North Star Brief`, `Standing
Dashboard`, `Gold`, `Backtest Flow`), verified with `git show origin/main:index.html`. The checkout on
`orchestration/control-plane-20260920` still mirrors **six** entries - it adds `Gold Backtest`, `Gold
Direction` and `Gold Factor (draft)` - so the three gold hop guards, which live in that checkout, pass today
against a bar nobody is served. Those three files are absent from `origin/main`
(`git ls-tree origin/main -- backtester/tests` lists 16 files, none of them gold page guards), so re-pointing
them at the published route belongs in the checkout that holds them, as `codex-045` section 4 requires. What
this branch does carry is the part that was missing here: the single `gold.html` bar entry the release left
unguarded is now asserted on all nine pages by tests 3 and 4 above.

## Existing page guards re-run against the new pages

Run from this worktree with the other checkout's guard files copied in for the run and removed again (they are
not part of this branch), all green:

- `backtest_flow_page.browser.test.js` - 2/2, including its `a.topbar-link[href="backtest-flow.html"]` hop,
  which is now the shared bar's own entry.
- `gold_research_page.browser.test.js`, `gold_direction_scorecard_page.browser.test.js` (2/2, including its
  header-and-cell starvation probe) and `gold_backtest_outcomes_page.browser.test.js` - all pass with the rail
  and bar in place. They need `data/gold-direction-scorecard-20260927.json`,
  `data/gold-28-factor-outcomes-20260925.json` and `data/gold-evidence-audit.json`, which `origin/main` does
  not carry, so those three artifacts were copied in for the run only.

## What this change does not do

- Nothing is published. The branch is committed locally; publication to Pages is a separate operation.
- The GOLD view tidy and fault-first order is a separate order
  (`codex-045-GOLD_VIEW_TIDY_AND_FAULT_FIRST_ORDER_20261003.md`) and is not part of this branch.
- The seven rail entries that name a dashboard view are links, not the dashboard's own tab buttons, so the
  dashboard script reads the hash on load: `script.js` gained `tabFromHash` / `setupHashTabs` for exactly
  that, and an unknown hash falls back to the dashboard's default view.

## Superseded on 2026-10-04

Two things this note records have moved on, both on `origin/main`, both after it was written:

- The rail is no longer seventeen `data-tab` entries and nothing else. It ends with one **outbound** entry,
  `<a class="side-rail-link" href="layer1-call-flow.html" target="_top">Layer 1 Calls</a>`, directly under
  `Architecture`, written the same way in both variants and carrying no `data-tab`. The builder now parses that
  kind of entry out of the rail before it checks the tabs, and its `--check` report reads
  `10 pages, 17 rail entries, 1 outbound, 0 change(s)`. See `docs/LAYER1_CALL_FLOW_RAIL_ENTRY_20261004.md`.
- The served set is ten pages, not nine: `what-moves-gold.html` was published with its own bar entry.
