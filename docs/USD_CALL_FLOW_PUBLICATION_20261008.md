# The printable USD Layer 1 call map published, reachable from the bar and the rail

Date: 2026-10-08. Branch: `release/usd-call-flow-20261008`, cut from `origin/main` at `0539f1d`. Order: the user's
words - "I need to see it live on the dashboard and give me the link once done".

## What changed

`usd-layer1-call-flow.html` is the USD-only twin of the printable call map: eight workflow steps, the ten factors
with their fifty per-horizon weights, the deterministic score behind the worked 2024-01-09 call, and four honesty
limits, on one A4 landscape sheet. It is published with the guard that travels with it, and with one entry on each
of the navigation's two surfaces:

```html
<a class="topbar-link" href="usd-layer1-call-flow.html" target="_top">USD Call Map</a>
<a class="side-rail-link" href="usd-layer1-call-flow.html" target="_top">USD Call Map</a>
```

The block is the only source, so both entries landed on all twelve published pages in one write:
`node backtester/scripts/build_shared_nav.js --write` placed the block into the new page and refreshed the other
eleven, and `--check` then reads `12 pages, 17 rail entries, 2 outbound, 0 change(s)`.

## Facts that make these entries different from the seventeen tabs

- Both entries are links with **no `data-tab`**, written identically in both rail variants, so the dashboard's tab
  binder never sees them and no page's view table changes.
- The rail still holds the same **seventeen** dashboard views in the same four groups; the outbound entries sit
  under them, after `Architecture`, and there are now **two** of them: `Call Map` and `USD Call Map`.
- The label is `USD Call Map`, not `Call Map`: `Call Map` is a substring of it, so the two site-nav filters that used
  to read `Call Map` now match the whole label, or the guard would click whichever of the two came first.
- The sheet carries the block itself, like the call map since 2026-10-04, and its own `@media print` block takes the
  bar and the rail off the sheet and returns `main` to the sheet's left edge, so what a reader prints is still one
  A4 landscape page with the map alone on it.

## The guards

- `backtester/tests/site_nav_consistency.browser.test.js` - 5/5. `BAR_LABELS` / `BAR_HREFS` gained the seventh
  entry, `RAIL_OUTBOUND_HREFS` / `RAIL_OUTBOUND_LABELS` the second outbound pair, the `--check` report pin reads
  `12 pages, 17 rail entries, 2 outbound`, and the click-through test makes the USD hop from `index.html` and from
  inside `gold.html`'s gold-direction frame.
- `tests/usd_layer1_call_flow.browser.test.js` - 5/5. The sheet's own guard, plus two tests added here: the hop from
  the bar and from the rail into the sheet (eight chain steps, the USD heading), and the block on screen with the
  fixed rail's 232px beside the map and the bar and rail `display:none` in print.
- `tests/layer1_call_flow.browser.test.js` - 5/5. Its page is untouched; only its head comment, which counted the
  pages the block is rendered into, moved from eleven to twelve.
- The builder's `selfChecks` and the guard's byte check hold both new entries in the partial rather than in the
  pages, and every page's copy is compared with the render byte for byte in that page's own line endings.

## What was run, and what it does not prove

Green on this tree, with no npm runner on `origin/main`: the navigation guard 5/5, the USD sheet's guard 5/5, the
call map's guard 5/5, the live-trading dashboard 2/2, levels visibility 2/2, readback 2/2, rule panel 2/2, refresh
progress 26/26, backtesting development release 1/1, gold view tidy 7/7, architecture-map validation 7/7, dashboard
writer selection 8/8. `tests/live_trading_chart_pan.browser.test.js` and `tests/live_trading_chart_zoom.browser.test.js`
fail on this tree (`expected: 120, actual: 576`) and fail identically on production `0539f1d` in a detached worktree, so they are pre-existing and this change does not touch them.

A published page is a map of how the call is made, not evidence of edge: this release ran no workflow, wrote no data
file and changed no live logic. The lane checkout that authored the sheet (`workers/analysis-engine-20261003`) holds
the page without the shared block, exactly as it holds the call map; the block is added to the published copy here by
the builder.

## Live read-back, after the push

Pushed `a8490c7` onto `origin/main`, a fast-forward over `675140c` - the 07:15 live-trading snapshot that landed
while this branch waited - and read both delivery paths back rather than assuming them:

- `https://kevincreedycars-debug.github.io/trading-agent-dashboard/usd-layer1-call-flow.html` returns HTTP 200 with
  29,932 bytes and sha256 `7478e426...`, byte-identical to the committed blob; the same bytes come back from
  `raw.githubusercontent.com`.
- The live `index.html` returns HTTP 200 with 27,380 bytes and sha256 `b5e70387...` and carries both new entries.
- A headless reader on the live dashboard finds exactly one bar entry and one rail entry for the sheet, clicks each,
  and lands on it with the heading `How the USD Layer 1 call is made`, all eight chain steps and the ten factor rows,
  with no script error. The live call map still returns its own 38,675 bytes and sha256 `47012a69...`.

Evidence: `tmp/usd-verify-live.cjs` and `tmp/usd-live-verify.log` in the ignored folder, with a full-page screenshot.

## The white printable version, added the same day

The follow-up - "again this needs to be made with a white printable version" - is the version the call map has
carried since 2026-10-04, and the page now carries it:

- On screen, a `Paper sheet · print preview` switcher (`#sheetToggle`, `aria-pressed`, hidden until its script
  runs) writes `data-theme="paper"` on `<html>`, remembers the choice under the page's own `usd-call-map-sheet`
  key and swaps the dark palette for the ink-on-paper one; `beforeprint` forces the paper view, so a reader who
  prints from the dark view still gets ink on paper, and `afterprint` puts their own choice back.
- On paper, the print block asks for `color-scheme:light` and sets the same palette, so the sheet is white under
  dark ink whether or not the switcher was ever touched; the switcher, the bar and the rail are off the sheet and
  the map stays on one A4 landscape page.
- The inks are the call map's own paper inks (`--text:#0f1720`, `--muted:#3c4a58`, `--dim:#5b6a78`,
  `--amber:#845c00`, `--blue:#0f4f88`, `--teal:#0c6a61`, `--good:#14682f`, `--bad:#a02a1e`), so the two sheets
  read alike; the USD page needed only its two pill borders (`border-color:currentColor`) and its two card washes
  overridden, because every other colour on it reads `var()`.

Measured rather than asserted: with the dark view on screen and print media emulated, body ink is
`rgb(15, 23, 32)` over `rgb(255, 255, 255)`, no visible element fills darker than a pale tint, the smallest
contrast of any printed line against what it sits on is above 4.5:1, and in the paper screen view the same list of
colour-bearing selectors clears 4.5:1 with the heading above 7:1. `tests/usd_layer1_call_flow.browser.test.js`
holds all of it and is 6/6 in the release worktree; the lane checkout, whose page carries no shared-navigation
block, is 4/4.

## Live read-back, after the push

Pushed `e2df9f6` onto `origin/main`, a fast-forward over `0c9ccd9` - the 07:45 live-trading snapshot that landed
while this branch waited - and read both delivery paths back rather than assuming them:

- `https://kevincreedycars-debug.github.io/trading-agent-dashboard/usd-layer1-call-flow.html` returns HTTP 200 with
  34,068 bytes and sha256 `97c9233f...`, byte-identical to the committed blob; `raw.githubusercontent.com` serves
  the same bytes.
- The live `index.html` (27,380 bytes, `b5e70387...`) and the live call map (38,675 bytes, `47012a69...`) are
  unchanged, so this release moved one page and no navigation.
- A headless reader on the live dashboard still makes the bar hop and the rail hop into the sheet, and on the live
  page the switcher is one visible control that opens dark (`aria-pressed="false"`), turns the page white
  (`rgb(255, 255, 255)` under `rgb(15, 23, 32)` ink) when clicked, and goes back to the dark sheet when clicked
  again, with no script error.

Evidence: `tmp/usd-verify-live.cjs` and `tmp/usd-live-verify-paper.log` in the ignored folder, with full-page
screenshots of the live sheet in both views.
