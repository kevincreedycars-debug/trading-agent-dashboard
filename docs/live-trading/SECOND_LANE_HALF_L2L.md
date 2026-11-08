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
| `tests/live_trading_lane_selector.browser.test.js` | the selector: four charts + tables + chips move together, parked/missing/stale, Close by lane, and the picture-level switch (levels, midpoints, entry band, position size) | 6/6 |
| `tests/live_trading_lane_isolation.test.js` | seven misconfigurations through the real runner and the real registration script's `-Show`, each refused with no send and no terminal read; lane 1's command line unchanged | 12/12 |
| `tests/live_trading_levels_visibility.browser.test.js` | the marked lines on the real page: ladder shape through the store, four frozen-fixture symbols two lines each side, and a one-sided ladder stated on the edge | 3/3 |
| browser suites (`dashboard`, `accounts`, `close_control`, `readback`, `rule_panel`, `status`, `chart_zoom`, `chart_pan`) | lane 1's page, unchanged | 19/19 |
| full local suite (`node scripts/test-local.js`) | everything, run twice on this branch head | 828 tests, 822 pass, 4 skipped, 2 fail |

One test fixture was repaired rather than the code: `tests/live_trading_rule_panel.browser.test.js` crafts a
crossing on BTCUSD from the committed snapshot, which now carries a live BTCUSD position, so the pair read
`blocked`. The case is about the crossing, not the account, so the position is taken out of that fixture.

The `US100.cash` browser failure recorded in the previous session is **closed**: it was the artifact, not the page,
and §10 states the fix and the page's real behaviour on a one-sided ladder. The two remaining failures in the wider
run are dated here rather than smoothed over. `research_library.browser.test.js` fails on the hosted-library page,
which no live-trading file here touches. `refresh_progress.browser.test.js` (the Overview tab's freshness verdict)
failed on this machine on the day of the run and failed **differently on each of three runs** - one, then a sibling
test, then three of its cases - always at the same stage, a panel read before its fixtures landed. None of the files
it exercises is changed on this branch: `git diff --stat` against the base commit lists the trader, the registration
script, two live-trading browser tests and two documents, and none of them is read by that file. It is an
environment/timing fault on this machine, not a lane-2 regression, and it should be re-run on the host rather than
argued from here.


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
7. **FTMO wording.** Not an approval, and never was: the sentence this checklist used to quote as "the approval
   text" in `VPS_DEPLOYMENT_STATUS_20261024.md` §4 is **our own draft question**, written on 2026-10-24 and never
   sent. Section 8 below traces it, and carries the message that has not been sent. A half grid at three to one is a
   different rule, not a geometry setting, so the wording has to be answered in writing before this lane is armed.
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


## 8. The FTMO wording: it is our draft, not their answer

Traced on 2026-11-07, file by file, because the difference decides whether this lane may be armed.

| Where the sentence lives | What it actually is |
| --- | --- |
| `VPS_DEPLOYMENT_STATUS_20261024.md` §4, the block quote beginning "I run one automated strategy..." | A question **written here on 2026-10-24**, in the repository, by us. It is phrased in the first person as something to send, it is followed by "Until the answer is in writing, account #2 stays **unarmed**", and nothing in the file records a send. |
| `docs/live-trading/FTMO_SETUP_GUIDE.md`, "Still to verify with FTMO before the first automated order" (read from FTMO's terms on 2026-09-30) | Says a first-party statement that automated trading is permitted **was not found in the affirmative** and is to be asked in writing; item 4 records that the question was asked, not answered, and that lane 1 was armed anyway on the user's instruction. |
| `docs/live-trading/CONVERSATION_NOTES.md` | Carries the same item as **"still open"**: "the FTMO support reply on automated trading and news trading during a Swing evaluation" has not arrived. |
| `docs/live-trading/SECOND_LANE_HALF_L2L_REVIEW.md` | "**FTMO permission is not yet in writing.**" |
| anywhere in the repository | No quoted reply, no ticket number, no email, no support name. There is no written FTMO response of any kind in this repository, about this setup or any other. |

So the "geometry and per-account caps" phrasing this document used to cite as an allowance was **our paraphrase of
our own draft**, and it is corrected above. Nothing about different grids, different targets, repeat entries after a
take-profit, or two terminals on one VPS is covered by anything FTMO has said, because nothing has been said.

What that changes: the closed question "may I run the same strategy on both accounts" does **not** cover the half
grid, the 3R targets or the same-day re-entry, which are the three things that make lane 2 a different rule rather
than a smaller one. The message below asks about those three by name, along with the isolation facts, so one reply
settles this lane instead of starting a second exchange.

### 8.1 The message that has not been sent (for the user to send)

> Subject: two FTMO accounts, one VPS, the same strategy with different grids
>
> Hello,
>
> I run one automated strategy of my own - no EA, no signal service, my own Python through the MetaTrader 5 package -
> and I would like to run it on two of my FTMO accounts at the same time. The facts of the setup:
>
> - **Two separate MT5 terminals on one VPS**, one logged into each account, one process per terminal, no EA on either.
> - **The same directional calls on both**, same instruments, same day, same direction, sized at the instrument's
>   minimum lot. The two accounts are never on opposite sides of the same instrument.
> - **Different grids and different targets.** Account A trades every marked level at five to one. Account B trades
>   the half grid - a midpoint inserted between each pair of marked levels - at three to one, so its entry, stop and
>   target are at different prices and it may trade a level account A never uses.
> - **Repeat entries.** Account B may enter the same instrument again later the same day once a take-profit has been
>   filled, capped at four entries a day. Account A holds one ticket per instrument.
>
> Could you confirm in writing: (1) that running the same strategy on two accounts at the same time from one VPS, with
> separate terminals and separate logins, is permitted for the account types I hold; (2) whether any part of this is
> treated as copying, group trading, or opposite-account hedging; (3) whether there is an aggregate allocation or
> maximum-lot limit across my accounts that I must respect, and how it is measured; and (4) whether running the
> terminals unattended on a VPS is permitted for these account types.
>
> If any part of it is restricted, I would rather be told which part so I can leave that account off than guess.
>
> Thank you.

Until a reply exists, this lane stays unarmed and its row stays `enabled: false`. Sending it, and keeping the reply,
are the user's own acts; nothing in this branch sends mail, and no reply is invented here.


## 9. Account isolation: what refuses, proved through the runner

The question this closes: what happens if `ftmo-2` is selected but `--magic` or `--expect-identity` is omitted, or
lane 1's magic is supplied. Before this branch the answer was "the run keeps lane 1's defaults": the wrapper writes a
flag only when a registration asks for one, and the loop only required an identity file when the magic was not lane
1's - so `--lane ftmo-2` alone, or with `20261004`, was a run that would have reviewed, cancelled, closed and moved
tickets carrying **lane 1's** number on **account 2's** terminal.

What closes it, in two places, because a task can be registered by hand and a runner can be started by hand:

- `scripts/run-live-trading-trader.js` reads the lane's own row from `config/live-trading-lanes.json` whenever
  `--lane` is passed, and refuses before the lock, the artifacts and the terminal: the magic must be the lane's, an
  identity file must be passed when the row declares one, and the grid and the multiple must be the lane's. A lane id
  the file does not carry is refused rather than guessed.
- `scripts/register-live-trading-trader-task.ps1` computes the numbers the wrapper it would write actually carries
  and refuses to register a task that disagrees with the lane's row - so `-Lane ftmo-2` without `-Magic`,
  `-Lane ftmo-2 -Magic 20261004`, `-Lane ftmo-2` without `-ExpectIdentity`, `-Grid full` on the half lane,
  `-RMultiple 5` on the three-to-one lane and `-Lane ftmo-1 -Magic 20261005` are all refusals, each naming the flag
  and the lane's own value. `-Show` now prints the command line it would write (`loop_command`), which is the
  read-only way to check what a task will carry without registering it.
- A status the order tool **refused** is now a loud refusal of the run rather than a quiet "nothing to place": an
  identity gate that stopped the attach, or a terminal that would not answer, leaves the account unproved, and a run
  that reports a setup-free lane against an account it never proved is the reading this closes.


`tests/live_trading_lane_isolation.test.js` (12 tests, all passing on the branch head) drives the **real runner**
against the fake bridge in `tests/fixtures/fake-mt5`, and the **real registration script** with `-Show`:

| Command line | Result | Proof that nothing was sent |
| --- | --- | --- |
| `--lane ftmo-1` (control, and armed) | reached a cancel, a close and a stop move | the fake bridge records TRADE_ACTION_REMOVE 8, DEAL 1 and SLTP 6, so the fixture really does ask for all three |
| `--lane ftmo-2` | exit 2, "carries magic 20261005" | no send file, no bridge call counter (the terminal was never read), no journal, no log, state unchanged |
| `--lane ftmo-2 --magic 20261004` | exit 2, the same refusal | as above |
| `--lane ftmo-2 --magic 20261005` (no identity) | exit 2, "declares an identity file ... --expect-identity" | as above |
| `--lane ftmo-2 ... --grid full` / `--r-multiple 5` | exit 2, "trades the half grid" / "trades 3 to one" | as above |
| `--lane ftmo-1 --magic 20261005 --expect-identity ...` | exit 2, "`--lane ftmo-1` carries magic 20261004" | as above |
| `--lane ftmo-3` | exit 2, "not one of the lanes" | as above |
| correct lane-2 flags, attached to lane 1's terminal | exit 1, `status: refused`, `identity_mismatch` in the journal | no send, no order answered |

The wrapper half of that file registers nothing: it runs `-Show`, and asserts the live wrapper file is byte-identical
before and after all six refusals. Lane 1's generated command line is asserted unchanged - no `--magic`, no `--grid`,
no `--r-multiple`, no `--expect-identity` - so a flag that is only written when a lane asks for it stays that way.


## 10. Chart visibility, and what the page does when every level is off the scale

Two questions were open: the browser failure on `US100.cash`, and what a reader sees when the whole ladder is outside
the bars. Both are now answered by fixtures rather than by the published artifacts, because the artifact drifts and a
test that follows it fails for reasons that are not about the page.

- **Why `live_trading_levels_visibility.browser.test.js` failed on this branch.** Its per-symbol test read the
  committed ladder and the committed feed and required two drawn lines each side of every symbol's bars. On
  2026-11-07 the committed `US100.cash` ladder ran 27751.59 to 33522.81 while the live bid was 26990.44: every line
  was above the price, so "two below" could not be satisfied by any page, correct or not. The test was measuring the
  artifact, not the chart.
- **The fix, and what it now proves.** The per-symbol test uses a frozen fixture built inside the test: forty
  synthetic M5 bars around a fixed price for each of EURUSD, XAUUSD, US100.cash and BTCUSD, and a 22-line ladder built
  through `lib/l2l_levels_store.js` from two seeds 2% either side of that price. All four symbols draw at least two
  marked lines above their bars and two below, on the first paint, with no Fit levels press (3/3 green).
- **The account switch, on the picture.** `tests/live_trading_lane_selector.browser.test.js` also asserts, on the
  same symbol drawn twice: none of lane 1's level labels survives the switch; the half grid's card draws dashed
  midpoints *in addition to* the marked lines, and each midpoint sits between a marked line above it and one below
  it; the open position's band is drawn at the selected lane's own entry; and the closed trade's position-size tool
  states that lane's own lot (0.05 on lane 2, gone after switching back).
- **When every real level is outside the visible range** (the test
  `a ladder entirely outside the visible range is stated on the edge, not drawn where it is not`, with the frozen
  27751.59-33522.81 ladder back in place): the page widens its price scale to hold the **two nearest lines on the side
  that has them** and draws those two. Nothing is clamped onto the candles, because a clamped line would read as a
  level at a price it does not have. The remaining lines are counted on **one edge tab** naming the side, the count
  and the nearest price (`▲ 20 levels above · nearest 28301.23 · click to fit`), the caption reads
  `2/22 lines in view (20 above, 0 below)` with the ladder's bounds, the newest close stays tagged on the scale, and
  the candles keep drawing, compressed by however far those two nearest lines are. One click on the tab is Fit levels
  and draws all 22. A one-sided ladder is therefore never invisible, and never drawn at a price it does not have.

