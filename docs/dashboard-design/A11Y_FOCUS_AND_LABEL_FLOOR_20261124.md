# Keyboard focus and the twelve-pixel floor - 2026-11-24

Two small accessibility fixes on the live line, made against the page as served rather than against the
superseded local draft (branch `design/backtest-engine-v2`, kept for history, not merged).

## What was read live

`https://kevincreedycars-debug.github.io/trading-agent-dashboard/backtest-engine-v2.html` was read over HTTPS at
1440 and 390, twice, before anything was touched:

- The served page is the control-room page: twelve steps in six bands, three readiness dots per step, a source
  stamp on every source, and the published 4/1/8/11 tally. It is the baseline; the local branch was behind it.
- No horizontal overflow at either width, and contrast was healthy across the sampled labels.
- Two real defects. Keyboard focus was invisible in the shared bar and rail: the entries take the browser's
  default outline, which is drawn outside the entry and is cut away by the rail's own clipping - the vertical
  rail hides anything past its width, the horizontal strip anything past its height. And the smallest words on
  the page (chips, pips, badges, stamps) were set at 8.5-9.5px, which is not a size to read on a phone.

## The deployment dimension: not in the live implementation

The live page shows three readiness dots per step and the live manifest carries three dimensions - software,
data, research. A "deployed" dimension exists only as an uncommitted draft in another worktree
(`.local/wt/a11y-dim`, branch `release/bev2-deployed-dim`), which adds a fourth dimension, a defaults block and
per-step rules to the manifest. Nothing of it is live, so nothing of it was merged here; this change leaves that
workstream's page open for its own author and does not touch the three-dot layout or the readiness figures.

## What changed

- Shared block (`backtester/partials/shared_nav.html`, rendered into all fifteen served pages by
  `backtester/scripts/build_shared_nav.js --write`, `--check` clean, 21 rail entries and 9 outbound entries
  unchanged): one focus rule over the bar and the rail, `:focus-visible` with a 2px ring drawn inside the entry
  (`outline-offset:-2px`), in the rail's link blue. The ring cannot be clipped and does not move the layout.
- The block's own labels rise to 12px: the clocks in the bar, the rail's mark, its heading, its group headings,
  its foot, its outbound arrow, the disclosure's chevron and the eight documentation links. Group headings lose a
  little letter-spacing and gain a slightly lighter grey so the bigger word does not read as a shout.
- The page's own stylesheet gains two tokens, `--cr-label-size: 12px` and `--cr-body-size: 13px`, and every
  declaration below them moves onto one: chips, pips, badges, kinds, index numbers, controls labels, band labels,
  stamps, citation lines, block titles and the panel foot at 12px; captions, roles, notes, metric rows, list items,
  quoted lines and links at 13px. Nothing on the page is now set below 12px, and the headings (14.5px, 19px, the
  clamped title) keep their scale.
- Pips carry a three-letter word, so they wrap rather than widen a step; chips are capped at the step's own width.
- The page's controls ring in its own gold, inside the box, because the stage scrolls, the panel scrolls and the
  mobile sheet clips: steps, the zoom/motion buttons, the source links.

Nothing else moves: no measured number, table cell, banner, as-of line, count, percentage, threshold, verdict,
label, route, anchor or hash. The bar and rail keep one of each on every page, the same ordered labels, the same
targets, the same brand string.

## Measured after the change (local preview, same checkout)

- Smallest rendered word: 12px, on both the page and the shared block, at 1440 and 390.
- No sideways scroll at either width; no step narrower than 280px; no step, foot or rail clip overflows.
- Chips widest 88px; three pips stay on one line in every step; node feet never overflow.
- Focus ring contrast: `#a8c8ff` on the rail's `#0b1220` is about 11:1, and about 8:1 over the active amber
  gradient. The gold page ring sits on `#0e1721` well past the 3:1 a non-text indicator needs.

## Guards added

- `backtester/tests/backtest_engine_v2.browser.test.js`: no word inside the page below 12px at 1440 and 390 (the
  panel is populated first, so its labels are measured too), the rail rings where the keyboard is, the ring is
  drawn inside, and a step rings the same way.
- `backtester/tests/site_nav_consistency.browser.test.js`: the same two promises for the block, on the dashboard
  and on this page, at 1440 and 390, including the opened Old documentation links and no label in the block below
  12px.

## To verify after publishing

Read the served page again over HTTPS at 1440 and 390: record its size and digest, sample the rail and the page
for 12px, tab through the rail and a step to see both rings, and check the inspector, the workflow and execution
links, the zoom and motion controls, and the published 4/1/8/11 tally still read as before.
