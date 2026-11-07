# The second FTMO account: the 0.5 L2L lane

Built offline on `live-trading/lane2-half-l2l-20261107`, cut from `origin/main` at `4faf3f35`. Nothing here has
touched the VPS, the running lane, its terminal, its scheduled tasks, the publisher or any armed task. Every test
below runs on this machine against fixtures and a stubbed order bridge; the only real terminal data is lane 1's own
published snapshot, read as a fixture.

## 1. What the lane is

The same rule as lane 1, on a half grid at three to one:

| | lane 1 (`ftmo-1`) | lane 2 (`ftmo-2`) |
| --- | --- | --- |
| ladder | the marked levels | the marked levels **plus one midpoint between every adjacent pair** |
| target | the next line past the entry | the next line past the entry (original **or** midpoint) |
| stop | one fifth of entry-to-target (`--r-multiple 5`) | **one third** of entry-to-target (`--r-multiple 3`) |
| entry | limit back at the line the M5 candle closed beyond | identical |
| magic | `20261004` | `20261005` |
| identity | none | `--expect-identity`, checked before every send |
| default state | enabled | `enabled: false` until the account exists and the wording is answered |

`lib/l2l_strategy.js` gained one pure function, `halfGrid(levels)`, and one selector, `gridLevels(levels, grid)`.
The arithmetic did not change: `ticketGeometry` still takes the next line and divides that distance by the multiple.
Every original level and every midpoint is a line for both an entry and a target, in both directions, which is what
`tests/l2l_half_grid.test.js` states four times over (long and short, from a mark and from a midpoint).

## 2. Lane 1 did not move

Four checks, all offline, all in the suite:

1. **The rule's readings** - `tests/fixtures/lane1/readings.golden.json`, captured from the real artifacts before
   the first line changed, compared field for field including every sentence.
2. **One whole run of the loop** - `tests/fixtures/lane1/run.golden.json`: every row, decision, ticket, placement
   and the exact argument list the tool is spawned with. Regenerate only on purpose (`LANE1_GOLDEN=write`).
3. **The argument list** - lane 1 passes no `--magic`, no `--expect-identity`, no `--grid`, no `--r-multiple`:
   those flags are written only when a lane asks for them, so lane 1's task XML and journal stay byte-identical.
4. **The surface** - `rMultiple === 5`, magic `20261004`, `grid === "full"`, `pauseEntries === false` on a default
   `parseArgs`, asserted in `tests/live_trading_lane2.test.js`.

The order tool also gained one refusal on the close path (a ticket of another magic), which is the same ownership
rule `modify` and `cancel` already applied. Lane 1's own tickets carry its magic and close as before.

## 3. Account isolation

- **One terminal, one checkout, one set of files per lane.** `config/live-trading-lanes.json` names lane 2's root
  (`../ftmo2`), its published snapshot (`data/live-trading.account2.json`), its heartbeat, its terminal
  (`...MT5 Terminal 2`), its magic, its rule (`half`, `3`) and its identity file. The publisher carries `magic` and
  `strategy` into the lanes document, so the page draws the grid the loop trades.
- **The identity gate.** `--expect-identity <path>` names a private JSON file
  (`{"login": <int>, "server": "<name>", "terminal_path": "<terminal64.exe>"}`). The order tool compares the
  attached terminal's login, server, `connected` flag and path, and refuses by name otherwise: `identity_missing`,
  `identity_unreadable`, `identity_disconnected`, `identity_mismatch`. It checks once at attach **and again
  immediately before every `order_send`, each filling mode and each retry**, so an account that changes between the
  read and the send sends nothing.
- **A magic is not an identity.** `--magic 20261005` requires `--expect-identity`; the trader refuses to start
  without it, so a second-account command line cannot be half-configured.
- **Ownership on every ticket action**: `close` now refuses a ticket whose magic is not this lane's, as `modify`
  and `cancel` already did.
- **Proof with zero sends**: `tests/live_trading_identity_gate.test.js` runs the real tool against a fake bridge
  (`tests/fixtures/fake-mt5/MetaTrader5.py`) whose `order_send` appends to a file. Missing file, wrong login, wrong
  server, wrong terminal path, disconnected terminal, an account that changes between read and send, and a foreign
  ticket: every one exits 3 with **no line** in that file. A matching identity sends exactly one order carrying the
  lane's magic, and the journal holds `***321` rather than the login.
- **Every internal filter follows the lane.** `tradeCycles`, `reviewPendings`, `reviewPositions`, `stopReview` and
  `liveFromStatus` all took the module constant `ORDER_MAGIC`; each now takes the run's own magic (defaulting to
  lane 1's), otherwise lane 2's own positions would never be reviewed or exited.
- **Pause.** `--pause-entries` turns the two `place` decisions into stated skips and leaves the review of working
  tickets, the exits and the 2R/3R stop rungs running. The heartbeat carries `entries_paused`, the page repeats it,
  and the Working entries table says the thing a paused table invites a reader to get wrong: a resting limit is held
  by the broker and can still fill.
- **Daily cap.** `--max-per-day` (default 4) counts *placements* in the Europe/Prague day; a put-back at a level a
  trade was already triggered on is the same trade and is not counted. `tests/live_trading_lane2.test.js` proves
  the cap, and that an afternoon can take a fresh crossing after a morning take-profit while a replay of the
  morning's own bar is refused as already taken.

## 4. The dashboard

One selector above the four charts, `FTMO 1 · L2L` and `FTMO 2 · 0.5 L2L`, defaulting to FTMO 1. The choice moves
the charts, their overlays, the rule panel, the account chips, the heartbeat caption, the Working entries / Open
positions / Closed trades tables and the Close control together, because every one of them reads one view
(`liveTradingLaneView`).

- **Lane 2's charts are lane 2's.** Its snapshot supplies the bars, quotes and tickets; the marked ladder it does
  not carry is joined from the page's own published ladder, by symbol - the same join the loop makes.
- **The half grid is drawn, not described.** Original lines solid, midpoints dashed with a legend, on the four
  cards and on the full chart, computed by the same `L2LStrategy.gridLevels` the loop calls.
- **A lane that cannot be drawn says so.** Parked (`enabled: false`), missing (no snapshot on the page) and stale
  (outside its own window) each get a notice in place of the charts, and the page **never** falls back to lane 1's
  numbers under lane 2's name.
- **No action on an unverified account.** A second lane's Close control is offered only when its snapshot is inside
  its window; otherwise the cell reads `unverified`. Lane 1's own behaviour is unchanged.
- **Screenshots**: `node scripts/capture-lane2-dashboard-screenshots.js --out <dir>` renders the three views from
  one page (default `<canonical root>/.local/evidence/lane2`).


## 5. Test evidence

| suite | what it holds | result |
| --- | --- | --- |
| `tests/live_trading_lane1_baseline.test.js` | lane 1 readings + one run + argument list, against goldens | 2/2 |
| `tests/l2l_strategy.test.js` | the rule as lane 1 reads it | 27/27 |
| `tests/l2l_half_grid.test.js` | the half grid: four cases, the stop at a third, the midpoint rules | 12/12 |
| `tests/live_trading_trader.test.js` | lane 1's loop, untouched by any of this | 73/73 |
| `tests/live_trading_lane2.test.js` | lane 2 end to end: ticket, flags, identity requirement, pause, 2R under pause, post-TP re-entry, cap | 6/6 |
| `tests/live_trading_identity_gate.test.js` | wrong account/server/terminal/disconnected/missing/changed account, foreign ticket: zero sends | 10/10 |
| `tests/live_trading_order_tool.test.js` | the tool's contract and the one-file boundary | 11/11 |
| `tests/live_trading_lanes_publish.test.js` | the publisher, with the lane's magic and rule in the document | 25/25 |
| `tests/live_trading_lane_selector.browser.test.js` | the selector: four charts + tables + chips move together, parked/missing/stale, Close by lane | 5/5 |
| browser suites (`dashboard`, `accounts`, `close_control`, `readback`, `rule_panel`, `levels`, `status`, `chart_zoom`, `chart_pan`) | lane 1's page, unchanged | 19/19 |

One test fixture was repaired rather than the code: `tests/live_trading_rule_panel.browser.test.js` crafts a
crossing on BTCUSD from the committed snapshot, which now carries a live BTCUSD position, so the pair read
`blocked`. The case is about the crossing, not the account, so the position is taken out of that fixture.

Two failures in the wider browser run are not this branch's and are recorded rather than smoothed over:
`live_trading_levels_visibility.browser.test.js` expects two marked lines below each symbol's bars, and today's
committed ladder has every US100.cash line above the live bid (levels 27751.59-33522.81 against a bid of 26990.44),
so no code path could draw them; and `research_library.browser.test.js` fails on the hosted-library page, which no
live-trading file here touches.

## 6. Go-live checklist (not done, and not to be done by this branch alone)

1. **Runtime pin.** Deploy lane 2 from a checkout of this branch's head commit, not from a moving head.
2. **Terminal.** A second terminal at `C:\Program Files\FTMO Global Markets MT5 Terminal 2`, its own
   `startup.ini`, logged into the second FTMO account, Market Watch subscribed to EURUSD, XAUUSD, US100.cash and
   BTCUSD (a cold terminal serves only what it holds or has been told to subscribe - §14.5 fault 2).
3. **Identity file.** `C:\live-trading\state\lane-ftmo2-identity.json`, ACL'd to Administrators and SYSTEM only,
   never committed, never in a published file, never on a command line as a number.
4. **Registration.** `register-live-trading-trader-task.ps1 -TaskName LiveTradingTraderTick-ftmo2 -Lane ftmo-2
   -Grid half -RMultiple 3 -Magic 20261005 -ExpectIdentity <path> -RepoRoot <lane 2 checkout> -ChainFeed`, plus
   `LiveTradingLane-ftmo2`, `LiveTradingTerminalStartup-ftmo2` and the lane-2 publish entry. Lane 1's task is not
   re-registered.
5. **Watchdog.** `run-live-trading-watchdog.ps1` asks only "is `terminal64` running", which cannot tell two
   terminals apart. Lane 2 needs its own instance judged by its own evidence: its snapshot's freshness, its
   heartbeat's age and its own reboot marker, with the shared `-RollbackFile` left alone and **no reboot of the
   host** from the lane-2 watchdog while lane 1 is trading.
6. **Publisher.** `enabled: true` for `ftmo-2` once its snapshot exists; until then the page draws it as parked,
   which is the honest state.
7. **FTMO wording.** The approval text in `VPS_DEPLOYMENT_STATUS_20261024.md` §4 allows "geometry and per-account
   caps" as differences. A half grid at three to one is a different rule, not a geometry setting, so the wording has
   to be answered in writing before this lane is armed.
8. **Open decisions** (from the review that preceded this branch): whether lane 2 reads both the original and the
   midpoint lines or inserted midpoints only (this branch implements both, as asked), and whether "0.5 L2L" means
   three to one on the half grid (implemented, stop = `g/6`) or lane 1's stop rule at the half target (2.5R today).

## 7. What is still unverified

- The exact commit in `C:\live-trading\runtime` on the host today, and whether a `...MT5 Terminal 2` exists there.
- Whether the host-only `config/live-trading-lanes.local.json` already names lane 2.
- Whether lane 2's account can trade all four instruments at the same `volume_min` as lane 1.
- Whether the second account's `login`/`server` are what the identity file will say; that file has never been made.
- The login masked in `VPS_DEPLOYMENT_STATUS_20261024.md` §14.5 was published in full until 2026-11-07 and is in
  this repository's history: the account's password, not its number, is what protects it, and re-checking that
  password is on the pre-arm list.

