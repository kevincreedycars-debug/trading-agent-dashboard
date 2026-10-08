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
