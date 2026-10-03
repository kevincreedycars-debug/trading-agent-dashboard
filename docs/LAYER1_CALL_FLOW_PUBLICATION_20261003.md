# The printable Layer 1 call map, published with one new bar entry

Date: 2026-10-03. Branch: `release/layer1-call-flow-20261003`, based on `origin/main` at `a94fb55`.
The user asked for the map to be reachable from the live site and for the release to be cut;
`docs/SESSION_NOTES.md` line 1891 in the checkout on `workers/analysis-engine-20261003` records the work
that produced the page.

## What is published

| File | Change |
| --- | --- |
| `layer1-call-flow.html` | new: the printable one-page map, carried over byte for byte from `e919dbc` |
| `docs/LAYER1_OPENAI_CREDITS_INCIDENT_20261001.md` | new to `main`: the outage note the page's footer cites as a source, carried over from `67cf411` |
| `tests/layer1_call_flow.browser.test.js` | new to `main`: the page's four-test guard, whose nav test now makes its hop from the shared bar |
| `backtester/partials/shared_nav.html` | one bar entry, `Layer 1 Calls`, added to both bar variants after `Backtest Flow` |
| the nine published pages | the builder's one-line render of that entry, written by `node backtester/scripts/build_shared_nav.js --write`, nothing else moved |
| `backtester/tests/site_nav_consistency.browser.test.js` | the fifth bar label, its href and its landing place pinned |

## Why the entry is in the bar and not in the rail

The rail is pinned at seventeen entries and the builder refuses any `href` inside the dashboard's
`rail-dashboard` variant, while the standalone rail must mirror the dashboard rail entry for entry
(`selfChecks` in `backtester/scripts/build_shared_nav.js`). The map is a page a reader opens and prints, not
a dashboard view, so it has no `data-tab` and no view for the standalone rail to name. A rail entry for it
is therefore a change to the navigation contract itself: an outbound entry in a rail that owns none, an
eighteenth entry in both variants, and matching updates to the builder's checks. This release does not make
that change; it adds the bar entry, which is the route the navigation already has for a page outside the
dashboard's own views.

The checkout on `workers/analysis-engine-20261003` does carry a rail entry of its own - an
`a.side-rail-link` in `index.html` with `.side-rail-link` rules in `styles.css`, pinned by that checkout's
copy of the guard - but it was written against the hand-written rail that `a94fb55` replaced, so none of it
is portable as it stands and none of it is in this release. That copy's fourth test still asserts the old
bar and its rail entry, and needs re-pointing when that checkout moves onto the published navigation.

## Verified before publication

- `node backtester/scripts/build_shared_nav.js --check`: `9 pages, 17 rail entries, 0 change(s)`.
- `node --test backtester/tests/site_nav_consistency.browser.test.js`: 5/5 green in about 29s, including the
  new hop - the bar's `Layer 1 Calls` entry opens the map from `index.html` - and the byte equality of every
  page's block with the partial.
- `node --test tests/layer1_call_flow.browser.test.js`: 4/4 green, the map's own guard, whose first three
  tests hold the offline render, the single A4 landscape sheet and the honesty flags.
- `git diff --stat` reads `1 +` for each of the nine pages: the bar entry is the only change any of them
  takes.

## What this does not do

- No Layer 1 or Layer 2 logic, workflow, credential, schema or data change: the map describes the chain, it
  is not part of it, and no figure on it is a new claim or a restamped one.
- The map carries no bar and no rail of its own, so its single-sheet print stays intact and it stays outside
  the builder's nine nav pages. It is reached from the bar on every published page.
- Nothing about the rail changes, so the seven rail entries that name a dashboard view and the two gold hop
  guards are untouched.
