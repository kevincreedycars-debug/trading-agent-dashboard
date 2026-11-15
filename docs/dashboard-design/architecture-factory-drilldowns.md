# Architecture factory: the two second levels, and a corrected execution floor

2026-11-15 · branch `design/architecture-factory-drilldowns`, cut from `origin/main` `fb059c17` · not published

This is the lane record for the extension of the published eight-asset factory. It starts from the deployed map
(`lib/system-factory.js`, released at `a08e5654` / `4b6423b0`) and adds two drill-downs inside the Architecture tab,
corrects the execution floor to three traders plus a separate cTrader component, and keeps every claim on committed
evidence.

## What a visitor can now do

- **Explore a replay chamber's test library.** A replay chamber carries an *Explore test library* control. Opening it
  drops the camera below the floor (target below `y = 0`, polar angle past 90 degrees) so the shelf is read from
  underneath while the chamber keeps its label above; every other station label is cleared for the moment. Five
  plaques stand in investigation order - research and adjudication, model and decision rules, historical inputs,
  replay and validation checks, results - and the side panel lists each group's documents with its title, the model or
  test it belongs to, the question it answers, its link and a tag that separates **used by the replay** from
  **related research**. Picking a plaque in the scene and picking the same group in the panel land on the same state.
- **Read the USD chamber test by test.** The four tests are separate: T1 USD direction on DXY (blocked on the official
  cash series; a named broker CFD lane is scored), T2 the call applied to four markets (scored), T3 the original
  ladder at 5R (blocked for all four markets), T4 the half grid at 3R (blocked for the same reasons). Each states its
  market, its logic, the data it needs and the artefact it writes - `data/usd-layer1-backtester/run-v1.json`.
- **Inspect the n8n flow behind a Layer 1 core.** Every core carries *Inspect n8n flow*. The panel draws the checked-in
  export's own nodes and connections in walk order, above a band that separates the **direct invocation** (Master
  Orchestrator → Execute Workflow, no market data) from the **storage hand-off** (collector row → `market_snapshots`),
  and below a **storage write** sink (`agent_outputs` → Dashboard Writer). Clicking a node reveals its purpose, what it
  receives, what it passes on and its evidence. USD is labelled *verified* because the logic dossier walks it; the
  other five are *documented workflow*; WTI and GBP have no export, so their panel says that instead of drawing an
  empty diagram.
- **Walk the corrected floor.** A third journey, *VPS floor journey*, runs VPS → FTMO 1 (5R, original levels) → FTMO 2
  (3R, half levels) → the blind trader's own M5 feed → its M5 deviation rule → FTMO 3 → the cTrader component.
- **Keep both drill-downs in the flat fallback.** The board's readout carries the same two controls as plain HTML with
  real buttons, the same groups, documents, tests and nodes, and the same evidence links.

## The floor, as the repository records it

| Trader | Strategy | Ladder | Geometry | Directional input |
| --- | --- | --- | --- | --- |
| FTMO 1 | Live L2L Directional | original | 5R | the Layer 2 pair output |
| FTMO 2 | Live 0.5L2L Directional | half grid | 3R | the Layer 2 pair output |
| FTMO 3 | Live L2L Blind | original | 5R | none - its own M5 deviation rule |

FTMO 3 is drawn with its own feed and rule and no edge from the junction; it is *connected but unarmed*, one closed
trade is labelled a connection test and excluded from the lane's figures, and no payout route is drawn from it.

## The cTrader component: what is and is not evidenced

The repository commits **one** cTrader artefact: the independent line-to-line robot at `ctrader/Ftmo3L2L`. It is
drawn as its own object after the lanes - violet, ringed, distinct from the three MT5 traders - and its four states
are written out in the inspector:

- **Installation** - source and build project committed; installation on the VPS not evidenced.
- **Account connection** - one instance per mapped symbol on the third account; verification still needs the target
  cTrader environment.
- **Trading authorisation** - **pending**: orders default to disabled until a simulated fill verifies entry, stop and
  target.
- **Active copying** - **none documented**.

**There is no order-copying relay in this checkout.** A repository-wide search for `cTrader`, `relay`, `copier` and
copy-trading language finds only the FTMO 3 robot and one question in the external-review brief about FTMO's own
terms. The brief this lane worked from described a relay that mirrors a source lane's accepted orders into cTrader,
with authorisation possibly pending. That component does not exist in the repository, so the map does not draw it:
the station states the absence in its own words rather than inventing a fifth component or reusing the blind robot as
if it were the relay. If the relay is documented later, it becomes a station of its own and the four labels above are
the shape it should take.

The two dotted grey links from the VPS to FTMO 3 and to the cTrader component mean only *hosted on the same host*.
They are a third link style, they are never counted as data flow, and the state API reports them separately
(`hosting: 2`). The payout links remain the only conditional ones (`conditional: 3`).

## Isolation and the public-safety rules

- `lib/factory-flows.js` is generated. The builder copies only node names, node types, type versions, edges and
  written purposes, and refuses to write if any of those contains a URL, an API key, a token, a secret, a password, a
  webhook, a credential reference, an email address, a provider endpoint, a 32-character hex run or a UUID. Node
  parameters, table identifiers and credential references never leave the export.
- The browser never loads a raw n8n export. Flow evidence links point at `docs/dashboard-design/n8n-agent-flows.md`
  and, for USD, the logic dossier; no `exports/*` path is linked from the flow panel.
- The library links only committed documents; the test withholds `docs/live-trading/VPS_*`, `LANE2_VPS*`,
  `FTMO_SETUP_GUIDE`, `SECOND_LANE_HALF_L2L*`, `STRATEGY_LIVE` and `exports/*_collector.json` and asserts none of them
  is reachable from either drill-down.
- One browser test aborts every non-local request and then walks both drill-downs: no page error, and no request to
  n8n, Supabase, the VPS or a broker.

## Files

- `lib/factory-library.js` (new) · `lib/factory-flows.js` (generated) · `scripts/build_factory_flows.js` (new)
- `lib/system-factory.js` · `lib/system-map.js` · `system-map.css` · `index.html` · `script.js`
- `docs/dashboard-design/replay-libraries.md` (new) · `docs/dashboard-design/execution-floor.md` (new) ·
  `docs/dashboard-design/n8n-agent-flows.md` (generated)
- `tests/factory_library.test.js` (new) · `tests/factory_flows.test.js` (new) ·
  `tests/system_factory.browser.test.js` · `tests/system_map.browser.test.js`

## Verification

- `node scripts/build_factory_flows.js --check` - current.
- `node --test tests/factory_library.test.js tests/factory_flows.test.js` - 12/12.
- `node --test tests/system_factory.browser.test.js` - 11/11; `tests/system_map.browser.test.js` - 2/2.
- `node scripts/test-local.js unit` - 807 tests, 803 pass, 4 skipped, 0 fail.
- `node scripts/test-local.js browser` - 129 tests, 122 pass, 7 fail; the same 7 fail at `origin/main` in a clean
  worktree (header/nav partial 2, XAU/USD development board, two M5 pan/zoom, research library, and one
  clock-dependent blind-lane freshness assertion).
- Local preview: `node scripts/research-library-server.js --serve-repo --port 8815`, then
  `http://127.0.0.1:8815/index.html#architecture`. Overview → Architecture and the direct hash both render one canvas
  and 50 stations.
- Screenshots (ignored, local): `tmp/shots/journey-1-usd-library.png`, `journey-2-usd-flow.png`,
  `journey-3-floor-relay.png`, `phone-library.png`.
