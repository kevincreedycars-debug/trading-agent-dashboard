# Architecture map: eight assets, interactive

2026-11-15 · branch `design/architecture-map-8-assets-integration`, rebased onto `origin/main` at `f8b13a91` · released
through the normal publish path

## What changed

- The Architecture tab still opens `lib/system-map.js`, but its default view is now an interactive factory: eight
  asset lanes drawn in Three.js with the vendored bundle at `lib/vendor/three.min.js`. Each lane runs from its
  incoming feed through a research desk, a replay chamber and an independent Layer 1 core to the single Layer 2
  junction, then to the VPS terminal, the two live FTMO lanes and the conditional payout. No lane meets another
  before the junction.
- The flat board is unchanged and stays mounted. It is the alternative view, and it is what a browser without
  WebGL gets automatically: the mode switch disables its factory button and the board is shown with a note.
  `?map=flat` pins the board.
- Every station answers the same five questions in a side inspector, with links to the committed document,
  workflow export, table or source file, and an explicit "what is undocumented" block when the repository does
  not record something.
- Two journeys run end to end: the USD research journey (inputs → research → red team → adjudication → the ten-row
  factor register → one documented factor → four separate replay tests → the core → the validation gate) and the
  EUR/USD execution journey (two independent cores → the junction → the pair output → the VPS → both FTMO lanes →
  the conditional payout).
- The scene supports orbit, wheel and pinch zoom, reset, pause, keyboard selection, reduced motion (a still frame,
  no packets, no camera tween) and a phone layout where the panel sits under the scene.
- Nothing on the page reads live data. The HUD labels the flow as illustrative, the packet motion is decoration,
  and the payout step is dotted because it is conditional and not automated.

## Factor sets: which model a number belongs to

The USD lane names three factor sets, and the panel now separates them instead of implying one:

- **Set A, the deployed book** - the ten factors F1-F10 that `Calculate USD Conviction` computes. Its weights are the
  two vectors in the register: the coded 24h row and the rulebook row. F5 reads `14 coded / 6 rulebook`, and both
  numbers belong to this set. Nine of the ten differ between the vectors; the discrepancy is catalogued.
- **Set B, the research programme** - twenty-five chains in `data/research-library/catalog.json` over six topic
  labels, ten of them carrying the deployed factor ids and fifteen research-named. The programme assigns no weight,
  and no replay uses all twenty-five. The register panel and the USD research desk link the catalogue, so a visitor
  has a route to it from inside the map.
- **Set C, the historical challenger** - `usd-layer1-challenger-v1`, frozen 2026-11-10, `RESEARCH_FROZEN_NOT_VALIDATED`
  and `CONFIG_BLOCKED`. Nine mechanisms over seven shared-source families, one unit of say each: six of the deployed
  ten (F1, F2, F4, F5, F6, F10) plus one research factor, `fx.usd-session-momentum`. It uses neither the 14 nor the 6:
  its F5 family holds one unit of seven, read from a five-day move of a broad dollar index at 0.15 per cent, with
  FRED `DTWEXBGS` declared as the stand-in for ICE DXY.

Each register row now carries a `Challenger book` line, and the replay chamber no longer calls the comparison book
equal-weight by count: it is family-weighted, with the reason stated. The public summary is
`docs/dashboard-design/usd-factor-sets.md`, linked from the research desk, the register panel and every factor detail.

## Evidence links and the published scope

GitHub Pages serves the whole repository tree from `main`, with `.nojekyll` so files are served as written: a probe of
`docs/ARCHITECTURE.md`, `docs/research/handoff/usd/v1/USD_FACTOR_REGISTER.md` and `data/research-library/catalog.json`
returns 200 with `text/markdown` or `application/json`. So "publishing the dashboard" already publishes `docs/`;
nothing here needs a second publication mechanism, and no evidence link has to fall back to a private copy.

What the release does need is public safety, because a localhost 200 says nothing about what a link exposes. The
inspector therefore withholds two groups of committed files:

- **Operator material** - `docs/live-trading/VPS_ACCESS_HANDOFF.md` (host address, order reference, login numbers),
  `VPS_SPEC.md`, `LANE2_VPS_RUNBOOK.md`, `FTMO_SETUP_GUIDE.md`, `SECOND_LANE_HALF_L2L.md` and its review, and
  `STRATEGY_LIVE.md`. The inspector says they are committed for the operator and not linked, rather than dropping the
  subject: the feed, VPS, lane, gate and payout stations each state it in their own rule list.
- **Collector exports** - `exports/*_collector.json` embed provider endpoints and a literal provider key. The feed
  stations name the export in their rule list and link the historical builder, the inventory and the logic document
  instead. Agent exports stay linked: they are the engine code the register cites, and they carry credential
  references only (id and name), no value.

Two public summaries replace what was withheld: `docs/dashboard-design/usd-factor-sets.md` and
`docs/dashboard-design/execution-path-summary.md`. The second describes the junction, the shared bridge, the two lane
geometries and the conditional payout without naming a host, an address or an account.



## Files

- `lib/system-factory.js` (new) · `lib/system-map.js` · `system-map.css` · `index.html` · `script.js`
- `tests/system_factory.browser.test.js` (new) · `tests/system_map.browser.test.js`
- `docs/dashboard-design/usd-factor-sets.md` (new) · `docs/dashboard-design/execution-path-summary.md` (new)
- The factory is loaded from `lib/system-map.js` only when the Architecture tab is opened, only after the WebGL
  probe passes, and only from this origin: `lib/vendor/three.min.js` then `lib/system-factory.js?v=20261115-factory-3d`.

## Verification

- `node scripts/test-local.js` on the final rebased commit: 894 tests, 884 pass, 6 fail, 4 skipped, 0 cancelled. The nine
  map tests all pass (`ok 859`-`ok 867` in the suite).
- The same suite on a detached worktree at `origin/main` 35bc8b03: 885 tests, 875 pass, 6 fail, 4 skipped, 0 cancelled.
  The six are: the two shared-navigation contract tests (`#76`, `#78`), the XAU/USD development-board browser test
  (`#105`), the two M5 pan/zoom tests (`#267`, `#268`) and the research-library browser file. The final rebased commit
  shows exactly those six and no others; the four commits `origin/main` gained during the run touch data files and lane
  documents only, so they add no test and move no result. Earlier intermediate rebases, under the same load, also threw
  occasional timing flakes in the shared-navigation and refresh-progress browser files (`#79`, `#712`, `#718`, `#723`);
  each passes when its file runs alone, and none is map code. No map test fails in any run.
- The 4 skipped tests are identical on both trees: the confidence-calibration artifact tests, skipped because the
  checker corpora are fetched into `.local/checker-corpus` rather than published. They are neither passes nor
  failures and are not counted as a regression.
- The new guard checks: the scene mounts at Overview → Architecture with one canvas and 46 stations; a station
  selected through the index, through the scene (a raycast click on the projected mesh) and through the keyboard
  (arrow keys plus Enter) opens the same five questions; both journeys produce their documented step titles; the four
  replay tests and the ten register rows are individually selectable; the pair route lights both lanes; the payout
  step reports what is undocumented; a context that reports no WebGL lands on the flat board with the factory switch
  disabled; reduced motion holds the packet and camera still; the phone layout keeps the scene, the panel and all 46
  index buttons usable and adds no horizontal overflow.
- `every evidence link the factory can show resolves and stays inside the published scope` walks all 46 stations plus
  both journey panels, collects every `data-evidence-path`, and asserts three things: each target is a file (not a
  folder) that exists in the checkout and returns 200 from the preview root; none matches the withheld operator or
  collector patterns; and the 25-factor catalogue and both public summaries are reachable. It also asserts that the
  withheld files still exist, so "withheld" cannot silently become "deleted".
- GitHub Pages was probed directly, not only through the preview server: `docs/ARCHITECTURE.md`,
  `docs/research/handoff/usd/v1/USD_FACTOR_REGISTER.md` and `data/research-library/catalog.json` answer 200 with
  `text/markdown` / `application/json` from `https://kevincreedycars-debug.github.io/trading-agent-dashboard/`.
- After the publish, the live page was opened from that origin, not from the preview: `index.html` followed by
  `Open architecture map`, and a cold `index.html#architecture`, both land on the factory with one canvas, 46
  stations, `data-scene-state="ready"` and no page error; the USD core inspector's four links and the research desk's
  seven all return 200 from the public origin; the EUR/USD journey lights EUR alone at its first step and both EUR,
  USD and both lanes at the pair step; a phone context keeps a 344 by 439 stage, the inspector under it and no
  horizontal overflow. A separate audit fetched the 69 paths the factory names and found every one served.
- Local captures (ignored by git, in `tmp/preview/`): `shot-1-whole-factory.png`, `shot-2-usd-factor.png`,
  `shot-3-eurusd-lanes.png`, and `journey-eurusd.webm`, a recording of the execution journey.
- Preview: `node scripts/research-library-server.js --serve-repo`, then open `index.html` and follow
  `Open architecture map`.

## Out of scope / open

- The factory adds no data: every fact in the inspector is transcribed from a committed document, export or source
  file. Where the repository is silent - WTI and GBP have only a logic document, no pair has a replay result, the
  payout route has no workflow - the inspector says exactly that.
- No local preview of a station, no animation of a specific replay, and no comparison chart: the four tests are
  described, not graphed, because no replay result is committed to graph.
- The 25-factor register is reached through the catalogue and the summary, not drawn as twenty-five rows in the
  scene. Drawing them would imply a chain has a state in the deployed book, which it does not.
- Reading the folder also turned up an exposure this lane does not fix: `exports/*_collector.json` commit a literal
  Alpha Vantage key, and those exports are already served by GitHub Pages because the site publishes `main`. The map
  no longer links them, but the key needs rotating and the exports need scrubbing in a separate, operator-owned
  change. Rotation is not a presentation action and is not done here.
