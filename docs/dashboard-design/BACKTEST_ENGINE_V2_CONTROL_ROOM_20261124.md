# Backtest Engine v2 - control room restyle: what changed, what was measured, what is pending

From the design lane (`dashboard-design`, worktree `.local/worktrees/dashboard-design`, detached at the
live tip of `origin/main`). Written 2026-11-24. Not published: this is the prepared change, held for the
user's go-ahead.

## 1. Scope

One page: `backtest-engine-v2.html` and its two assets. The restyle is layout, spacing, type scale, colour
tokens, component states, responsive behaviour, contrast, accessibility, focus and icon choice. No measured
number, table cell, banner, as-of line, count, threshold, verdict, route, anchor or label meaning changed.
The top bar and side rail are untouched - the shared navigation block in the page was not edited at all.

## 2. What changed

| File | Before | After | Change |
| --- | --- | --- | --- |
| `backtester/assets/backtest-engine-v2.css` | 26,262 bytes, `1D25F8AF724610B5...` | 33,267 bytes, `919C52850D3DDC1C...` | rewritten: tokens, bands, cards, states, inspector, matrix, sheet, breakpoints |
| `backtester/assets/backtest-engine-v2.js` | 36,317 bytes, `3121E9534B6ABB12...` | 36,365 bytes, `0197EA2568D61FF6...` | one line: `button.dataset.kind = node.kind \|\| "step"`, the hook the plug-in accent reads |
| `backtest-engine-v2.html` | 21,650 bytes, `309E971DC85CD278...` | 21,650 bytes, `EAC0B7C849C4DBF8...` | two query strings: the stylesheet and the script now ask for `?v=20261124-cr-v2-3`, so a returning reader is not shown the old stylesheet. Markup, labels and numbers untouched. |
| `backtester/assets/backtest-engine-v2.manifest.json` | 49,076 bytes | unchanged | node ids, spans, bands and status paths untouched |

Originals are kept for comparison at `tmp/backtest-engine-v2.before.{html,css,js,json}` (scratch, not for
commit).

## 3. The visual contract the stylesheet now sets

- Tokens: `--cr-bg`, `--cr-deep`, `--cr-panel`, `--cr-panel-2`, `--cr-line`, `--cr-ink` / `-mid` / `-muted` /
  `-faint`, `--cr-gold`, `--cr-blue`, the plug purple, the core cyan and the compare pink, plus the six state
  colours (complete, pending, blocked, stale, unknown, inactive). Two type sizes below the headings: a 12px
  label and a 13px line of body. Nothing on the page is drawn smaller than 12px.
- Bands: one accent each - inputs blue, decision cyan, measurement pink, proof gold - carrying the heading dot,
  the hairline after the name, the card edges and the card's number. The band surface is deliberately
  translucent so a wire leaving one group for the next stays visible.
- Cards: six-column grid driven by the manifest's `--cr-span` (6 / 3 / 2), number and name, role underneath,
  state chip and kind at the foot, the four readiness pips last, chevron at the top right, ports on the top and
  bottom edge. `data-kind="replaceable"` takes the plug accent at the edges while the band keeps its frame.
- States are word first and colour second: the chip carries the word, the pip carries the colour, so the page
  survives greyscale and colour blindness.
- Inspector: sticky beside the flow above 1180px, a fixed sheet with a backdrop below it, opened by choosing a
  step and put away by the close button, the backdrop or Escape.
- Focus: one gold ring, drawn 2px inside the control, because the stage scrolls and the sheet clips.
- Motion: the wires carry a slow dash; under `prefers-reduced-motion` the dash stops but the direction still
  reads from the ports and the order.

## 4. Measurements (preview, Chromium, full page)

| Viewport | Page height | Document overflow | Stage overflow | First card width |
| --- | --- | --- | --- | --- |
| 1440 | 2,818 px | 0 | 0 | 706 px |
| 1180 | 2,720 px | 0 | 0 | 858 px |
| 860 | 2,837 px | 0 | 0 | 770 px |
| 390 | 4,018 px | 0 | 0 | 330 px |

Zero console errors and zero page errors at all four widths. Bands render in manifest order:
inputs, decision, measurement, proof; 12 cards. The inspector is `sticky` at 1440 and `fixed` (sheet) at
1180, 900 and 390; the backdrop only ever paints in the sheet layout.

## 5. Checks run

- `node --test backtester/tests/backtest_engine_v2.browser.test.js` - 11 of 11 pass, including the 12px floor,
  the focus ring drawn inside the control, the sheet opening and Escape putting both away, zoom keeping every
  wire on its port, and the fresh-call and readiness reads.
- `node scripts/test-local.js browser` - 149 of 155 pass; the six failures are in other lanes' pages
  (`backtesting_h1`, `dashboard_globe_landmasses` twice, `live_trading_chart_zoom`, `refresh_progress`,
  `research_library`). They are data- and timing-dependent, they differ between two consecutive runs (9 then
  6), and none of them loads this page or this stylesheet.
- Nothing outside this checkout was read for the change, and nothing outside it was written.

## 6. Preview

`node scripts/research-library-server.js --serve-repo --port 8799 --root <temp folder>` - the library root was
moved to a temp folder so the service token is not written into the checkout. Page:
`http://127.0.0.1:8799/backtest-engine-v2.html` answers 200; the stylesheet is served at 33,267 bytes.

The state report named in the brief (`scripts/monitor-state.js`) is not present in this checkout, and the
monitor is off-limits to this lane, so no state line was written there; this note is the record instead.

## 7. Pending

1. Publish: `git fetch origin`, rebase onto the live tip, re-run the page's browser test in the same change,
   fetch again, `git push origin HEAD:main`. Needs the user's go-ahead; the push makes the site live.
2. After publishing: record the served page's size and digest, and add a browser assertion that fails if the
   page drifts back to the old stylesheet (the 12px floor and the inside focus ring are already asserted).
3. Status contract: which fields read as verified rather than "Not verified" is still the coordinator's call
   (`BACKTEST_ENGINE_V2_STATUS_CONTRACT.md`). The restyle shows whatever the manifest and the artefacts say
   today and does not invent a state.

## 8. Risk to flag

An earlier `git reset --hard origin/main` in this worktree may have discarded uncommitted work by other lanes.
`git status` here now shows only the two files above, the new note, and three untracked documents
(`ASTRA_BRIEFING_20261107.md`, `README.md`, `mobile-scope.md`) that were already untracked and that this lane
will not stage.

