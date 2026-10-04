# The call map carries the shared navigation, and prints without it

Date: 2026-10-04. Branch `release/analysis-call-map-20261004`, cut from `origin/main` at `89ebfd3` on top of
`15e0c26` (the Layer 2 map), and re-cut onto `6f4e91b` after two data-only live-trading snapshot commits landed
mid-branch. The user asked for the map's navigation to be visible while the page is read and left off the sheet,
and for a white view to print from, because a dark background does not print.

## What changed

| File | Change |
| --- | --- |
| `layer1-call-flow.html` | the page carries the shared block - bar, rail and their CSS - as the builder's eleventh page; the title block gained a `Paper sheet · print preview` button (`#sheetToggle`) that writes `data-theme="paper"` on `<html>` and shows the printed palette on screen; the print block now takes the bar, the rail and the switcher off the sheet and gives the map its own left edge back; the chain's run is measured against the map's own column (`main{container-type:inline-size}`, 1216px) because the rail takes a fixed 232px off it |
| `backtester/scripts/build_shared_nav.js` | the call map registered as the eleventh page, under `<body>` like the other standalone pages; comments and the summary brought to eleven, so `--check` and `--write` read `11 pages, 17 rail entries, 1 outbound, N change(s)` |
| `backtester/partials/shared_nav.html` | header comment only: it now records that the map carries the block and that a page meant to print must take the block off the sheet itself. The rendered block is unchanged, which is why no other page's bytes moved |
| `backtester/tests/site_nav_consistency.browser.test.js` | the page count brought to eleven in the report pin, the test name and the comments that still called the map a page with no navigation of its own |
| `tests/layer1_call_flow.browser.test.js` | a fifth test: bar, rail and switcher on screen, the 232px the rail holds, the paper palette held to a measured contrast floor, no card starved in the paper view at 1440px or 390px, and in print the bar, the rail and the switcher gone, `main` at the sheet's own left edge and paper ink from either view. The wide-screen chain assertions now read the map's own column |
| `docs/CALL_MAP_NAV_AND_SHEET_20261004.md` | this note |

## The switcher, in plain words

- The page is one page with two palettes. `data-theme="paper"` on `<html>` swaps the dark screen palette for the
  ink-on-paper palette the print block already used, so the reader sees what the printer will lay down and can
  print from the view being read. The button reports its own state with `aria-pressed`, and it is `hidden` in the
  markup until the script has run, so a reader without script is never offered a control that does nothing.
- Printing does not need the button: the print block sets the same palette, and `beforeprint` forces the paper
  attribute for the length of a print job while `afterprint` puts the reader's own choice back. Printing from the
  dark view therefore lands on ink and paper rather than pale text on a white sheet.
- The choice is remembered in `localStorage` under `call-map-sheet`; a storage that refuses to be read - Chrome
  blocks it on some origins - costs the reader only the memory of the choice.

## Contrast, measured rather than asserted by eye

Ratios against the paper sheet's white background, read from the loaded page in the paper view. The guard reads
the same six selectors and holds them to the same floor, so a palette edit that dimmed one of them would fail:

| Element | Colour | Measured |
| --- | --- | --- |
| `h1` | `--text` `#0f1720` | 18.05:1 |
| `.lede`, body copy | `--muted` `#3c4a58` | 9.08:1 |
| `.eyebrow` | `--amber` `#845c00` | 5.98:1 |
| footer links | `--blue` `#0f4f88` | 8.42:1 |
| chain arrows | `--dim` `#5b6a78` | 5.56:1 |
| node taglines | `--dim` `#5b6a78` | 5.56:1 |

The guard holds the heading above 7:1 and the other five above 4.5:1. For the record, the dark view's own dim
arrow (`#5c7690` on `#080e16`) measures 4.1:1 and is untouched by this work; it is a decorative, `aria-hidden`
arrow, and it improves to 5.56:1 in the paper view.

## One sheet, still

The printed grid is unchanged by any of this: with the web font blocked for both versions the pre-change and
current pages measure the same grid rows and the same content bottom, **709.94px of 733px**, smallest printed
type **7.6px**. The guard holds the sheet under 733px and the type above the 7.5px floor in whatever font the
machine has, and it passes with the block on the page.

What the rail cost, and where it was paid for: the chain runs left to right only while the map's own column can
hold seven cards without breaking a word (1216px of content). At a 1440px window the rail's fixed 232px leaves
about 1145px, so the map stacks the chain rather than starving a card. The old window-wide 1180px breakpoint
would have kept the run going at that width and `market_snapshots` would have broken mid-word - the failure the
shared layout-safety rules call out. The print block puts the run back on one line, because the sheet has no rail
and is measured in millimetres.

## Verified this session, all local

- `node --test tests/layer1_call_flow.browser.test.js` - 5/5.
- `node --test backtester/tests/site_nav_consistency.browser.test.js` - 5/5, including the eleven-page byte
  equality, the per-page fingerprint and layout check at six widths, and both click-throughs.
- `node backtester/scripts/build_shared_nav.js --check` - `11 pages, 17 rail entries, 1 outbound, 0 change(s)`.
- `node --test tests/backtesting_development_release.browser.test.js tests/live_trading_dashboard.browser.test.js
  tests/refresh_progress.browser.test.js tests/dashboard_writer_selection.test.js tests/l2l_levels.test.js
  tests/validate_architecture_map.test.js backtester/tests/gold_view_tidy.browser.test.js` - 101/101.
- The measured figures come from the lane's ignored scratch harness, `tmp/sheet-probe.cjs`, `tmp/print-probe2.cjs`
  and `tmp/live-check.cjs` in this checkout.

## Verified live, after the push

`e571106` was pushed onto `origin/main` as a fast-forward over `6f4e91b`, and both delivery paths were read back:

- `raw.githubusercontent.com/.../main/layer1-call-flow.html` - 38,446 bytes, carrying the `SHARED-NAV` block and
  `#sheetToggle` and the print rule that takes the block off the sheet.
- `https://kevincreedycars-debug.github.io/trading-agent-dashboard/layer1-call-flow.html` - 38,446 bytes, the
  same file, after the Pages build finished at 15:22:41Z.
- A headless Chromium opening the Pages URL sees the bar and the rail on screen (`main` at 232px), the switcher
  labelled `Paper sheet · print preview`, seven chain steps and five panels, no script errors; clicking it turns
  the page white behind dark ink, and under `print` media the bar, the rail and the switcher all read
  `display:none` with `main` at the sheet's own left edge.

## Decisions, as asked

Both were put to the reader after the live check, and both stand as shipped:

- The bar and the rail keep their dark chrome in the paper view. Only the map body is printed, and the print
  block takes the whole block off the sheet, so a white bar on screen would buy the reader nothing while making
  the block a two-palette shared file that eleven pages would have to agree on.
- The rail's fixed 232px, and the chain stacking beneath it in a 1440px window, are accepted as they are: the
  run comes back onto one line as soon as the window can pay for seven cards beside the rail, and the printed
  sheet never sees the rail at all.

## What this does not do

- The navigation keeps its own dark chrome in the paper view, by decision above: the switcher changes the sheet's
  palette, not the bar's and the rail's, and the block is one shared file that eleven pages wear. Either way a
  reader printing gets the map alone.
- No other page's bytes move: the block's render is identical to what the eleven pages already carried, so
  `--write` touched only `layer1-call-flow.html`.
- Nothing about the other seventeen rail entries or the other five bar entries moves.
- No Layer 1 or Layer 2 agent, workflow, credential, dataset, Supabase row or backend file is touched, and no
  figure on the map is a new claim or a restamped one.
- Publication is a separate operation: this branch sits on `origin/main` and is pushed as its own step. A
  rendered local page is not proof of live deployment, and a one-page printed grid is not a claim about the
  pipeline it draws.

