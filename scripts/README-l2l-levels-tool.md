# L2L level marking tool (live-trading lane)

One writer, one artifact, no order path.

The published dashboard is static and read-only, so a level cannot be marked on the published page.
This tool serves the repository on loopback, accepts a click from the mirrored chart and writes
`data/l2l-levels.json`. The published page only ever reads that file, so a marked level becomes part
of the published view when the file is committed.

| File | Role |
| --- | --- |
| `l2l-levels-tool.js` | The marking server and the guard for the artifact it writes |
| `../data/l2l-levels.json` | The committed artifact: the four instruments and the prices marked so far |
| `../script.js` | `applyLiveTradingLevels`, `liveTradingChartLevelsFor`, `probeLiveTradingLevelsTool`, `markLiveTradingLevel` - reads the file, draws the lines, posts a click when the tool answers |
| `../styles.css` | `.live-trading-chart-mark*` and `.live-trading-chart-level*` - the marking button, status line and level lines |
| `../tests/l2l_levels.test.js` | Contract tests: validation rules, edit semantics, and the live GET/POST round trip |

## Run it

```powershell
node scripts/l2l-levels-tool.js
node scripts/l2l-levels-tool.js --port 8788 --state data/l2l-levels.json
node scripts/l2l-levels-tool.js --check
node scripts/l2l-levels-tool.js --check data/l2l-levels.json
```

Starting it prints the URL to open:

```
L2L level marking tool (loopback only)
  dashboard  http://127.0.0.1:8788/
  levels     data/l2l-levels.json
  Open the dashboard from that URL, pick a symbol, switch on Mark levels, then click the price.
  This tool is the only writer of the levels file; the published dashboard only reads it.
  Nothing here touches the broker, the terminal, or any order path.
```

Open the dashboard from **that** URL, go to **Live Trading**, pick a symbol in the chart's symbol row,
press **Mark level** and click a price on the chart. Because the page is served by this tool, the
dashboard's probe of `/api/l2l-levels` answers and the marking controls appear; on the published host
or from a `file://` open the probe fails and the section stays read-only. `--port 0` lets the OS pick a
port, which is how the tests avoid colliding with a running tool.

`--check` validates the artifact and exits non-zero on failure, so it can gate a commit or CI step.
Empty level lists pass: an instrument nobody has marked yet is a state, not an error. A real run
against the committed file:

```json
{
  "status": "PASS",
  "file": "data/l2l-levels.json",
  "schema_version": "l2l-levels-v1",
  "generated_at_utc": "2026-10-01T00:00:00Z",
  "marked_by": "local marking tool (scripts/l2l-levels-tool.js)",
  "instruments": [
    { "symbol": "EURUSD", "levels": 0 },
    { "symbol": "XAUUSD", "levels": 0 },
    { "symbol": "US100.cash", "levels": 0 },
    { "symbol": "BTCUSD", "levels": 0 }
  ]
}
```

## What a click does

1. The pointer position is mapped back through the chart's fixed viewBox into a price on the candle
   price scale, clamped to the visible range.
2. The price snaps to the instrument's own point grid, so a marked level is a price that could be
   typed into MT5 rather than a pixel value.
3. `POST /api/l2l-levels` with `{ action: "add", symbol, price, kind: "l2l", direction: "both", timeframe: "M5" }`.
4. The tool writes the file and returns the new state; the dashboard redraws the line and the level
   badge from the response and reminds you to commit `data/l2l-levels.json` to publish it.

Marking the same price twice **replaces** that level instead of stacking a duplicate (tolerance
`1e-9`), so a mis-click costs one more click. `action: "remove"` at a price that is not marked returns
404 and changes nothing. Every write rebuilds all four instruments in dashboard order, so the file
never loses a symbol, and each symbol's levels are sorted by descending price. Levels carry
`kind` (`l2l`, `half-l2l`, `level`), `direction` (`long`, `short`, `both`), `timeframe`, `label`,
`marked_at_utc` and `marked_by`.

## The endpoint

| Request | Answer |
| --- | --- |
| `GET /api/l2l-levels` | `200` with `{ ok, tool: "l2l-levels-tool", state_path, state }` |
| `POST /api/l2l-levels` | `200` with the saved state, or `400` bad JSON or a bad field, `404` removing a price that is not marked, `422` refusing to write a file its own checker would reject, `500` on a read or write failure |
| Something else on `/api/l2l-levels` | `405` |
| Static files | `GET`/`HEAD` only, `403` for a path outside the served root, `404` when missing, `405` for any other method |

Every JSON answer carries `X-L2L-Levels-Tool: 1` and `Cache-Control: no-store`. The server binds
`127.0.0.1` only and is never exposed, so the write endpoint is not reachable from another machine.

## What it will not do

It has no order path: no send, modify, close or cancel call, no order function, and no broker or
terminal connection, so it cannot trade even if it wanted to. It carries no credential and reads no
account data. It is not a signal, a level detector or an edge: every price in the artifact was marked
by hand, and the tool checks shape, provenance and duplicates only - whether a level is the *right*
level is a judgement the user makes on the chart. Nothing here notifies, publishes, pushes or deploys,
and the published dashboard cannot write.

## Tests

```powershell
node --test tests/l2l_levels.test.js
node --test tests/l2l_levels.test.js tests/live_trading_feed.test.js
```

`tests/l2l_levels.test.js` is 26 tests covering the validation rules, the normalise/add/remove/sort
semantics, the price filter, duplicate protection, serialisation stability, the live GET/POST/remove
round trip with its 404 and 422 refusals, the read-only static server with its traversal guard, and
assumptions about the dashboard wiring. Together with the 23 in `tests/live_trading_feed.test.js`
that is 49 of 49. The tool is a local dev utility: it is not scheduled, and running it touches no MT5
terminal, warehouse, workflow or publication.
