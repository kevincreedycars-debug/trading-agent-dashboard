# L2L level marking tool (live-trading lane)

Two writers, one artifact, no order path.

This tool serves the repository on loopback, accepts a click from the mirrored chart and writes
`data/l2l-levels.json` directly on this machine. The published page keeps the same marks in the
reader's browser and publishes that file to the reader's own GitHub account, so a marked level reaches
the published view either way. Both writers go through `lib/l2l_levels_store.js` - the one module that
owns the schema, the edits and the ladder arithmetic - so neither can drift from the checker.

**Where this came from (2026-10-03).** The user asked for the marking to be on the live dashboard rather
than a loopback-only tool - *"the marking tool needs to be on the live dashboard I dont want to be messing
around with local only functions"* - and the requirement was filed with the coordinator as mailbox
submission `20261003-live-trading-live-marking-and-ladder-r1`. It was then built the way that needs no
service, no key and no hosted store: the published page holds the marks in the reader's own browser, draws
them, and commits `data/l2l-levels.json` to the reader's own repository with a token the reader pastes and
the browser keeps - in this tab's session, or on this device only if the reader asks. This tool is
unchanged in what it is, a loopback writer and the `--check` guard, and now requires the shared module the
page loads instead of carrying its own copy of the rules. `docs/live-trading/STRATEGY_LIVE.md` section 20
records the build.

| File | Role |
| --- | --- |
| `l2l-levels-tool.js` | The marking server and the guard for the artifact it writes; it requires the shared store module instead of carrying its own copy of the rules |
| `../lib/l2l_levels_store.js` | The one implementation of the document: schema, edit rules, ladder arithmetic, checker, browser draft and publish settings, and the GitHub read and commit calls. Loaded as a plain script by `index.html` and required by the tool and the tests |
| `../data/l2l-levels.json` | The committed artifact: the four instruments and the prices marked so far |
| `../script.js` | `applyLiveTradingLevels`, `liveTradingChartLevelsFor`, `liveTradingLevelsCanMark`, `probeLiveTradingLevelsTool`, `markLiveTradingLevel`, `duplicateLiveTradingLevels`, `removeLiveTradingLevel`, `clearLiveTradingLevels`, `liveTradingLadderAlert`, `extendLiveTradingLadder` - reads the file, draws the lines, raises the out-bounds alert, and posts a click or a duplication when the tool answers. Where this browser is the store instead: `liveTradingReadDraft`, `liveTradingWriteDraft`, `liveTradingLoadPublishSettings`, `liveTradingPublishTarget`, `liveTradingDisconnectPublish` and `liveTradingPublishPanel`, which read and commit the file |
| `../lib/l2l_ladder.js` | The ladder arithmetic both sides read: the bounds, the one-step alert band and the extension plan. Loaded as a plain script by `index.html` and required by the tests |
| `../styles.css` | `.live-trading-chart-mark*`, `.live-trading-chart-ladder*`, `.live-trading-chart-level*` and `.live-trading-chart-ladder-alert*` - the marking buttons, the step counts, the status line, the level lines and the out-bounds notice - and `.live-trading-chart-publish*` for the repository, branch and token rows and the publish actions |
| `../tests/l2l_levels.test.js` | Contract tests: validation rules, edit semantics, the ladder arithmetic, the browser draft and publish settings, the publish helpers and the live GET/POST round trip |

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
  This writes the levels file on this machine; the published dashboard writes it through GitHub.
  Nothing here touches the broker, the terminal, or any order path.
```

Open the dashboard from **that** URL, go to **Live Trading**, pick a symbol in the chart's symbol row,
choose the timeframe with the **M5 / H1 / H4** buttons (H1 and H4 are the zoomed-out views a ladder is
read on), press **Mark level** and click a price on the chart. Because the page is served by this tool,
the dashboard's probe of `/api/l2l-levels` answers, so the page writes through this tool and shows no
publish panel. On the published host or from a `file://` open the probe fails, and the page falls back to
the browser draft plus the GitHub publish panel, which needs a token the reader supplies. `--port 0` lets
the OS pick a port, which is how the tests avoid colliding with a running tool.

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
    { "symbol": "EURUSD", "levels": 0, "seeds": 0, "derived": 0 },
    { "symbol": "XAUUSD", "levels": 0, "seeds": 0, "derived": 0 },
    { "symbol": "US100.cash", "levels": 0, "seeds": 0, "derived": 0 },
    { "symbol": "BTCUSD", "levels": 0, "seeds": 0, "derived": 0 }
  ]
}
```

## On the published page, with no tool running

The published dashboard marks as well, with no server and with nobody else's key: press **Mark level**,
click a price, and the page validates the edit through `lib/l2l_levels_store.js`, keeps the marks for this
browser under `localStorage["l2l-levels-draft-v1"]` and draws them the same way the committed file is drawn.

Publishing is the reader's own commit. The box under the chart takes the repository and the branch, filled
in with `kevincreedycars-debug/trading-agent-dashboard` and `main`; the path is fixed at
`data/l2l-levels.json`, the same file this tool writes. It needs one GitHub fine-grained personal access
token for that repository with **Contents: read and write**. **Connect** keeps the token for this tab's
session; ticking **Remember on this device** keeps it across visits instead. The token is a password field,
is never rendered anywhere else, is never written into the artifact, and **Disconnect** removes it from both
stores. **Publish levels** commits the file through the GitHub contents API, **Reload from GitHub** pulls the
committed copy back, and **Save a copy** downloads the file for a commit made by hand.

Two refusals protect the published file: a state the checker rejects is not committed at all, and a file that
changed on GitHub since the page read it is not overwritten unless **Publish anyway** is pressed - the status
line names the fresh sha when that happens. A refused commit leaves the draft as it was, and the draft is only
cleared after a commit succeeds.

`config/secret-scan-allowlist.json` carries one entry for `script.js`: `token: liveTradingPublish.token` is
the credential passed by reference to the store, which the repository guard reads as an assignment to a
secret-like name and reports on shape alone. The entry is scoped to that one line, and that line cannot hold
a literal. Everything else the page writes about the token is a name, never a value.

## What a click does

1. The pointer position is mapped back through the chart's fixed viewBox into a price on the candle
   price scale, clamped to the visible range.
2. The price snaps to the instrument's own point grid, so a marked level is a price that could be
   typed into MT5 rather than a pixel value.
3. `POST /api/l2l-levels` with `{ action: "add", symbol, price, kind: "l2l", direction: "both", role: "seed", timeframe }`,
   where `timeframe` is the label of the view the click was made on (`M5`, `H1` or `H4`).
4. The tool writes the file and returns the new state; the dashboard redraws the line and the level
   badge from the response and reminds you to commit `data/l2l-levels.json` to publish it.

Marking the same price twice **replaces** that level instead of stacking a duplicate (tolerance
`1e-9`), so a mis-click costs one more click. `action: "remove"` at a price that is not marked returns
404 and changes nothing. Every write rebuilds all four instruments in dashboard order, so the file
never loses a symbol, and each symbol's levels are sorted by descending price. Levels carry
`kind` (`l2l`, `half-l2l`, `level`), `direction` (`long`, `short`, `both`), `role` (`seed`, `derived`),
`timeframe`, `label`, `marked_at_utc` and `marked_by`.

## Mark two seeds, then duplicate the distance

The two prices you mark by hand are the **seeds**: the measurement. Everything else is derived from
them, so a level is never invented by the tool.

1. Mark the top L2L level and the bottom L2L level on the H1 or H4 view. Those two clicks are the only
   prices you type into the file; they carry `role: "seed"`.
2. Set how many levels the ladder should generate beyond each seed (ten each way by default, `0` to
   `60`) in the two small boxes beside **Duplicate levels**.
3. Press **Duplicate levels**. The tool takes the highest and lowest seed level for that symbol,
   measures the distance between them exactly, and repeats it above the top seed and below the bottom
   seed. Each generated price is snapped onto the instrument's point grid, and each line carries the
   measurement that produced it: `spacing_price`, `spacing_points` (when the request supplies the
   instrument's `point`), `anchor_high`, `anchor_low` and a note naming its step.
4. The status line reports the spacing and the count, for example `Generated 20 levels 175.00 apart
   (17500 points) around the seeds 3962.5 to 4137.5`.

Ten each way is a ladder twenty lines wide: wide enough to read a week of 1h bars against, narrow enough
that the ladder does not become the chart. The dashboard's own price scale stops at the bars unless
**Fit levels** is pressed, and it counts the lines outside the window rather than hiding them.

`POST /api/l2l-levels` with `{ action: "duplicate", symbol, above, below, timeframe, point }`. Asking
for fewer than two seed levels is a 404 (`duplicating needs the two seed levels marked first`), a pair
at the same price is refused (`there is no distance to repeat`), and a request that generates nothing
new is refused rather than written. Running it again **replaces** the derived levels instead of adding
a second ladder, so moving a seed and duplicating again is the intended way to iterate. `action:
"clear"` at a symbol removes every one of its levels (404 when it has none) when you want to start
over.

## The out-bounds alert, and extending the ladder

A ladder that only ever covers the range it was drawn on is a ladder that runs out. The published page
therefore reads the live mid against the outermost derived line and says so when price reaches it - a
reading, not a rule, and the dashboard is the only place it appears:

* **One step is the band.** The alert fires when price is within one ladder step of the outermost line
  (the same `spacing_price` between the seeds), so the rule needs no points or percent configured and
  reads the same way on EURUSD and on BTCUSD. Two states are named: `approaching` inside that band, and
  `beyond` once price is past the line.
* **It is drawn on the page:** a notice under the chart (`role="status"`), an `AT BOUND` badge on the
  symbol's own button so a pair in trouble is visible without opening it, and the bound line drawn in
  the alert colour.
* **`Add 10 more above` / `below`** appears beside **Duplicate levels** while the alert is active, and
  wherever the page has a store to write to - the local tool on this machine, or the browser draft and the
  reader's own GitHub commit on the published page. It repeats the same measurement for ten more steps on
  the side that ran out, asking for what the file already holds plus ten (`above`/`below` in the same
  `duplicate` request), so pressing it twice cannot ask for less. The cap is `60` a side.
* **Nothing is pushed and nothing is placed.** The alert is read when the page is open; there is no
  background watcher, no notification path and no order path. Extending is a write to
  `data/l2l-levels.json`, which still has to be committed to be published.

The ladder arithmetic itself lives in `lib/l2l_ladder.js`, one module loaded by the page and required
by the tests, so the bounds, the band and the extension plan cannot drift between the writer, the page
and the checker.

## The endpoint

| Request | Answer |
| --- | --- |
| `GET /api/l2l-levels` | `200` with `{ ok, tool: "l2l-levels-tool", state_path, state }` |
| `POST /api/l2l-levels` | `200` with `{ ok, saved_at_utc, state_path, generated, state }` - `generated` carries the spacing and the count a duplication produced, or the symbol a clear emptied, and is `null` for a single add or remove. `400` bad JSON or a bad field, `404` removing a price that is not marked, duplicating without two seed levels, or clearing a symbol with no levels, `422` refusing to write a file its own checker would reject, `500` on a read or write failure |
| Something else on `/api/l2l-levels` | `405` |
| Static files | `GET`/`HEAD` only, `403` for a path outside the served root, `404` when missing, `405` for any other method |

Every JSON answer carries `X-L2L-Levels-Tool: 1` and `Cache-Control: no-store`. The server binds
`127.0.0.1` only and is never exposed, so the write endpoint is not reachable from another machine.

## What it will not do

It has no order path: no send, modify, close or cancel call, no order function, and no broker or
terminal connection, so it cannot trade even if it wanted to. It carries no credential and reads no
account data. It is not a signal, a level detector or an edge: every price in the artifact was marked
by hand or is arithmetic on two hand-marked prices, and the tool checks shape, provenance and
duplicates only - whether a level is the *right* level is a judgement the user makes on the chart.
Nothing here notifies, publishes, pushes or deploys. This tool can write nothing outside this machine, and
the published page can write only this browser's draft and the one path in its publish panel, in the
reader's own repository.

## Tests

```powershell
node --test tests/l2l_levels.test.js
node --test tests/l2l_levels.test.js tests/live_trading_feed.test.js
```

`tests/l2l_levels.test.js` is 48 tests covering the validation rules, the normalise/add/remove/sort
semantics, the price filter, duplicate protection, the seed-and-ladder arithmetic with its refusals,
the role and spacing rules, the clear action, serialisation stability, the live GET/POST/remove,
duplicate and clear round trips with their 404 and 422 refusals, the read-only static server with its
traversal guard, the shared ladder module's bounds, alert states and extension plan, the page's script
load order, the browser draft, the publish settings and their scopes, the publish-target normalisation,
the GitHub request builders, the remote read, the commit's refusals and its creation path, and
assumptions about the dashboard wiring. Together with the 34 in `tests/live_trading_feed.test.js` that
is 82 of 82.
The tool is a local dev utility: it is not scheduled, and running it touches no MT5 terminal,
warehouse, workflow or publication.

## Adding an instrument

The file carries the four pairs the live feed publishes, in dashboard order, and a symbol nobody has
marked is an empty list rather than a missing entry. A pair that starts publishing later is one line in
`KNOWN_INSTRUMENTS` in `lib/l2l_levels_store.js` plus the feed's own change; the validator, the
dashboard and the tests all read that list, so nothing else has to be edited twice. A symbol the list
does not carry is refused (`unknown symbol`).
