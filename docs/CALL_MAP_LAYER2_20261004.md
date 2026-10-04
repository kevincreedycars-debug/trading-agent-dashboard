# The call map now explains both layers, and its entry is named for what it holds

Date: 2026-10-04. Branch `release/analysis-call-map-20261004`, cut from `origin/main` at `89ebfd3`.
The user asked for the printable one-pager that explains how the current Layer 1 **and** Layer 2 analysis
engines actually work, and for it to stay reachable from the live dashboard.

## What changed

| File | Change |
| --- | --- |
| `layer1-call-flow.html` | the one-pager now covers Layer 2 as well as Layer 1: title and `h1` move from "How the Layer 1 calls are made" to "How the calls are made", the eyebrow names both layers, and a fifth panel `panel-layer2` states the pair rules - the stored read, the seven live pairs, the average, the threshold, the two filters, the BUY/SELL reading, the ranking and the file. The chain band, the nine-node panel, the eight-asset table, the guarantees and the limits were tightened so the sheet still prints as one A4 landscape page |
| `tests/layer1_call_flow.browser.test.js` | the page's guard follows the page: five Layer 2 steps pinned, the five-panel print placement, the pair facts, the new labels |
| `backtester/partials/shared_nav.html` | the two bar variants and the two rail variants label this page `Call Map` instead of `Layer 1 Calls`, because the page is no longer Layer 1 only |
| the ten published pages | rebuilt by `node backtester/scripts/build_shared_nav.js --write`: one label line each, nothing else moved (`--check` then reads `10 pages, 17 rail entries, 1 outbound, 0 change(s)`) |
| `backtester/tests/site_nav_consistency.browser.test.js` | the fifth bar label, the rail outbound label and the two click-through headings re-pinned |
| `docs/CALL_MAP_LAYER2_20261004.md` | this note |

## The Layer 2 rules the page states, and where each came from

- **The read.** `exports/layer2_trade_selection_agent.json`, node *Get Layer 1 Agent Outputs*: table
  `agent_outputs`, `getAll`, limit 1000, no filters; its Code node keeps the newest row per agent that
  carries a 24-hour direction (lines 52-68 of the code node).
- **The pairs.** The exported code names five assets and four pairs (lines 2-8). The live
  `data/layer2.json`, last written 2026-10-02T07:29:25Z, names **seven**: EUR/USD, XAU/USD, XAG/USD,
  BTC/USD, NQ/USD, WTI/USD, GBP/USD - and its `avoid_today` reasons carry the export's exact wording
  ("Mixed or low conviction 24H signals.", "Both assets point in the same 24H direction, so there is no
  clear relative edge."). So the live workflow is the exported rule set over more pairs, and the export
  in this repo is a mirror: the page says so, in the limits panel it already had for the eight-asset
  wiring.
- **The rules.** Combined confidence `clamp(round((base + USD) / 2))` (line 111); `LOW_CONVICTION_THRESHOLD =
  60` (line 9); a pair is dropped when either leg has no conviction, reads no clear bias, sits under 60, or
  points the same way as USD (lines 113-137); a disagreeing pair reads BUY when the base is bullish and USD
  bearish and SELL when reversed; survivors are ranked 1..n by that number (140-144) and written as
  `dashboard_meta` + `trade_opportunities` + `avoid_today` to `data/layer2.json` by the GitHub node.
- **Two honesty notes the page now carries.** The pair number is the *mean of two Layer 1 convictions*, on
  a different scale from either leg and not a probability; and `assetCall` prefers a model-authored
  `full_output.today_call.direction/confidence` over the deterministic row fields (lines 56-62, 88-90) -
  dormant on the board read, where `today_call` is null for all eight agents, but stated rather than left
  out.

## One sheet, still

Measured in headless Chrome under `print` media in the A4 landscape box (1062x733px, i.e. 297x210mm less
the 8mm margin):

- before this change: content bottom 722.25px of 733px, smallest printed type 7.6px;
- after: content bottom **709.94px** of 733px, smallest printed type **7.6px**, three columns, five panels
  placed `steps | assets over Layer 2 | guarantees over limits`.

What paid for the new panel: the chain band's bodies shortened to one line with one-line taglines, the nine
agent nodes trimmed to two lines each, the asset table's status moved onto the rulebook line as the "Market"
column became the Layer 2 panel's pair list, and the long limits bullets tightened to two lines each. No
printed type went below the guard's 7.5px floor.

## Verified this session, all local

- `node --test tests/layer1_call_flow.browser.test.js` - 4/4.
- `node --test backtester/tests/site_nav_consistency.browser.test.js` - 5/5, including both click-throughs
  from the new `Call Map` label and the byte equality of all ten pages with the partial.
- `node backtester/scripts/build_shared_nav.js --check` - `10 pages, 17 rail entries, 1 outbound, 0 change(s)`.
- `node --test tests/backtesting_development_release.browser.test.js tests/live_trading_dashboard.browser.test.js
  tests/refresh_progress.browser.test.js tests/dashboard_writer_selection.test.js tests/l2l_levels.test.js
  tests/validate_architecture_map.test.js backtester/tests/gold_view_tidy.browser.test.js` - 99/99 in about 89s.
- The print and type figures come from the lane's ignored scratch harness, `tmp/layer1-call-flow/l2-print-probe.cjs`
  in the analysis-engine checkout.

## What this does not do

- No Layer 1 or Layer 2 agent, workflow, credential, dataset, Supabase row or backend file is touched: the
  map describes the chain, it is not part of it, and no figure on it is a new claim or a restamped one.
- The page still carries no bar and no rail of its own, so it stays outside the builder's ten nav pages and
  still prints as one sheet; only its two labels changed.
- Nothing about the other seventeen rail entries or the other five bar entries moves.
- Publication is a separate operation: this branch sits directly on `origin/main` at `89ebfd3` and is pushed
  there as its own step.
