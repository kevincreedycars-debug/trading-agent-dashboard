# The trader's own coverage floor, the freshness rule, and the daily cap that is gone

2026-11-22. This is the trader half of the coverage work whose publisher half shipped on 21 November
(`L2L_COVERAGE_PUBLISH_20261121.md`). It closes three of that record's open items on the live accounts, and it
resolves the one number that was still wrong on two of the three lanes.

The 21 November record left the lanes reading a ladder the publisher had already extended, and said plainly what it had
not done: *"the trader's in-memory plan and its heartbeat `coverage` block"*, *"the freshness refusal"* and *"the
dashboard's lane coverage chip"* were not deployed, because the branch that carried them had drifted behind `main` and
porting it would have changed trading code on three live accounts. It also records that *"a re-registration of lane 3
must pass `-Published C:\live-trading\publisher`"*.

That is what this session changed, and the reason the branches were reconciled first is the same reason: the trader
code the three accounts run is not `main`'s trader code.

## 1. One revision for three accounts

The three checkouts were on three different revisions, and none of them was `main`:

| lane | checkout | revision it ran | what that revision was |
| --- | --- | --- | --- |
| ftmo-1 | `C:\live-trading\runtime` | `c5abd0ac` | 2026-11-03, plus a hand-applied 227-line patch (code identity, the two stop rungs, `--published`) that was never committed in that checkout |
| ftmo-2 | `C:\ftmo2` | `f14f2ac7` | the half-grid lane with the two-newest-closes gate |
| ftmo-3 | `C:\ftmo3` | `441c308f` | the blind lane, plus an uncommitted 21-line fix to `lib/l2l_strategy.js` |

Two things had to be true before any code could move: the blind lane's line and the ordered three-leg fix had to be in
the revision, and `main` had to be the place the publisher, the page and the trader all read from.

**The blind line into main.** `441c308f` is not an ancestor of `main` (`main` had dropped the blind-lane work in an
earlier history rewrite), but it is a descendant of both `c5abd0ac` and `f14f2ac7`, so it is a superset of what lanes 1
and 2 run. Merging it into `main` (commit `981b81cf`) brought, in one tree: the blind rule (`--blind`,
`blindWatchPairs`, `blindReadings`, `blindPlan`), the ordered three-leg reclaim checks, `--magic` and
`--expect-identity`, and the daily-cap removal with `NO_CAP_WORDS`. The two big files merged without a conflict: the
runner came in at 3,606 lines (+471 against `main`) and `lib/l2l_strategy.js` at 1,522 (+547). Five conflicts were
resolved by keeping the newer side where `main` had moved on:

| file | resolution |
| --- | --- |
| `config/live-trading-lanes.json` | `main`'s: lane 3 enabled, with the masked identity and server the host reports (`***584`, `FTMO-Server3`) |
| `tests/live_trading_lanes_publish.test.js` | `main`'s: three accounts enabled, the same masked identity, and the status paths |
| `docs/CURRENT_STATE.md`, `docs/SESSION_NOTES.md` | `main`'s, with this session's entries added on top |
| `scripts/publish-live-trading-lanes.js` | `main`'s: the published row carries `blind: true` only when it is true, rather than a `false` on every lane |
| `script.js` | the lane line's: the third note reads "two watched lines, no call, five to one", because "unarmed" stopped describing that account on 2026-11-15 |

**The ordered three-leg fix lane 3 was already running.** `lib/l2l_strategy.js` on the host had a 21-line change that
makes the deviation's legs ordered - the level is held, *then* left, and the newest close is the reclaim - so a
`99 -> 101 -> 101` block cannot be read as a reclaim by pairing the newest close above the line with an approach that
preceded it. That change exists as `6b408c2f` on `live-trading/blind-stop-fix-20261119`, one commit above `441c308f`;
merging it (commit `e75757f4`) put it in the deployed revision. Without that merge the deploy would have silently
reverted a rule change account 3 has been trading since 19 November.

**Lane 1's hand patch was superseded, not lost.** The 227-line diff in `C:\live-trading\runtime` was `main`-side work
that checkout never received (code identity, the two stop-rung constants, `stopReview`, `--published`). Every one of its
identifiers exists in the merged revision - `manualEnds` 4 references on both sides, `hand-close` 3/3, `closedByHand`
2/2, `--max-open` 7/7 - so the revision is a superset. The one deliberate difference is `DEFAULT_MAX_PER_DAY`: `4` in
the host's patch, `null` in the revision.

## 2. The coverage floor, on the lane's own tick

The publisher extends the ladder before it publishes; a lane still read whatever the last publish committed, which is
one cadence behind the price that lane is quoting. `scripts/run-live-trading-trader.js` now plans the same extension in
memory, before it evaluates a single entry:

- **Same arithmetic, same answer.** It calls `scripts/ensure-l2l-coverage.js`'s `planCoverage` - the function the
  publisher itself calls - over the ladder it read from `--published` and this lane's own snapshot. The plan is
  deterministic, so every lane and every retry arrives at the same prices, and additive, so no existing line moves: a
  working order, a position or a recorded signal keeps the level it was placed from.
- **Nothing is written.** The tick writes no levels; the publisher remains the one writer. The check is a reading of the
  file, not an edit to it, and `tests/live_trading_trader.test.js` compares the fixture's bytes before and after the run.
- **The record and the heartbeat carry it.** `coverage: { status, checked_at_utc, extended, levels_available_at_utc,
  min_per_side, rows, failures, entries_withheld }`, with one row per instrument holding its anchors, spacing, price,
  the full lines each side, the next line each way and what was added.
- **A short asset takes no entry; the account is still managed.** If an instrument cannot be brought to the floor - a
  measurement the file does not support, the sixty-step cap - its entries are withheld for that run and it is named in
  `entries_withheld`. Everything already working is still reviewed, exited and moved in the same run: a coverage
  problem must never be a reason to stop protecting an account.
- **An unmarked instrument is not a short ladder.** "No line is marked" is the reading's own answer and is already
  stated per pair, so it is not reported as a coverage failure. The plan's status is computed over the failures that
  have lines behind them.

## 3. The freshness rule

A generated line records `available_at_utc`. `lib/l2l_strategy.js` now reads that stamp (and `marked_at_utc` as the
same fact for older lines) and refuses a crossing whose confirming candle closed before the line existed:

```
stage: "waiting", retrospective: true,
reason: "The newest M5 candle at ... closed above 84500, but that line only became available at 17:00:00Z:
         a crossing that happened before the line existed states no ticket, and the rule waits for a close made
         while it was there."
```

A line with no stamp cannot be proved newer than a candle, so it is read as always having been there: the hand-marked
ladder the lanes have traded since the beginning is unaffected. Every reading also states `ladderCoverage` - the full
lines above and below the newest close, the floor and the next line each way - counted on full lines only, so FTMO 2's
midpoint grid is judged on the same minimum as the other two accounts. Its anchors, spacing and level identities are
untouched: the plan only ever appends beyond the outermost line on a side that is short.

## 4. The daily cap

The owner removed the strategy-imposed daily entry limit on FTMO 1, 2 and 3 on 2026-11-14. The change was written on
the blind lane's branch (`1653b693`) and never reached `main`, so `main`'s runner still defaulted to four and its
registration script still wrote `--max-per-day 4`. On the host that showed up exactly where it was looked for: lane 3's
task carried `--max-per-day unlimited`, and lanes 1 and 2 carried `--max-per-day 4`.

Merged into `main`, the removal is one rule for all three lanes:

- `DEFAULT_MAX_PER_DAY = null`; `--max-per-day` accepts `unlimited`, `none`, `off`, `no-cap`, `nocap` and `0` for no
  cap, and a positive number for a hand cap someone asks for deliberately.
- `-MaxPerDay` defaults to `0`, and the registration writes `--max-per-day unlimited` **explicitly**, so a restart or a
  re-registration cannot bring four a day back; a negative value is refused.
- The heartbeat carries `max_per_day: null`, `capped: false` and `entries_today`, so the page prints a count beside "no
  cap" rather than turning `null` into zero.
- The walkthrough's gate copy no longer says "Four a day by default". It reads: *"No daily entry cap of the strategy's
  own: one entry per market, and a trade put back at the level it was triggered on is not a new trade and does not
  count. The loop still counts and prints the day's entries, because that is reporting rather than a gate."*
- The lane-status panel prints an entries count only when the heartbeat stated one. `Number(null)` is `0`, and the
  merged page was printing "4 a day - null entries today" over a fixture with no count; the panel's own test caught it.


## 5. Tests

The fixture ladders now carry the provenance a published file carries (`anchor_high`, `anchor_low`,
`spacing_price`) and each instrument quotes at its own newest close rather than all four quoting BTC's, so a fixture
can be measured and extended the way a real ladder is. The lane-1 golden records exactly one changed row: US100's short
side now has a next line to aim at (26927.13, 6331 points away) instead of "no marked line is left in that direction" -
the audit's own complaint.

- `tests/l2l_strategy.test.js`: coverage counted on full lines only (a midpoint never makes a side look covered, a line
  at price counts for neither side), a generated line refused as retrospective while the same line stamped earlier
  confirms, and a hand-marked line never refused.
- `tests/live_trading_trader.test.js`: the tick extends the ladder in memory before reading an entry, states the floor
  in the heartbeat and writes no levels; an asset that cannot be measured is withheld while the account is still read;
  the fixture quote and provenance corrections above.
- `tests/live_trading_task_registration.test.js` (new, 5 cases): a registration that names no cap writes
  `--max-per-day unlimited` and never `--max-per-day 4`; a hand cap is written only when it is asked for; lane 3's plan
  keeps `--blind`, its magic, its identity file and `--published`; a called lane refuses `-Blind`; `-Show` writes
  nothing.
- `tests/live_trade_logic_tab.browser.test.js`: the walkthrough is held to the loop's own no-cap state rather than to a
  number it no longer states.

Results on the deployed tree: the live-trading and L2L suites 627 tests, 626 pass, the one failure
`the M5 pane zooms, and two marked levels each side survive every step` - a browser case that fails identically on
`origin/main`. The full local suite: 1,283 tests, 16 failures, every one of them present in `origin/main`'s own run
(17 there). No new failure.


## 6. Deployment record

**Revision.** `e3406286` (`e34062868b62ad039497532c5dbfa4f0d63789dd`), pushed to `origin/main` on 2026-11-22 at about
18:11Z. It carries `981b81cf` (the blind line's merge with the coverage work) and `e75757f4` (the ordered three-leg
merge), then merges of the publisher's own snapshot commits.

**Checkouts moved, each backed up first.** All three now run the same revision, detached, with clean trees; the runner
is `74b0cd18…` and `lib/l2l_strategy.js` is `db164d85…` on every lane, and `lib/l2l_coverage.js` is present.

| lane | before | after | backup |
| --- | --- | --- | --- |
| `C:\live-trading\runtime` | `c5abd0ac` + 4 dirty paths | `e3406286` | `tmp\deploy-backup-coverage-20261122` (the hand-patched runner, the snapshot, two untracked scripts) |
| `C:\ftmo2` | `f14f2ac7` | `e3406286` | `tmp\deploy-backup-coverage-20261122` (the snapshot) |
| `C:\ftmo3` | `441c308f` on its branch, 2 dirty paths | `e3406286` | `tmp\deploy-backup-coverage-20261122` (the snapshot, the uncommitted `lib/l2l_strategy.js`) |

**The command lines.** Lane 1 and lane 2 were re-registered from their own checkouts; lane 3 was not re-registered,
because its wrapper already carried every flag this change is about:

```
ftmo-1: --once --align --settle-seconds 90 --confirm-live --quiet ... --lane "ftmo-1" --max-per-day unlimited
        --terminal "C:\Program Files\FTMO Global Markets MT5 Terminal" --published "C:\live-trading\publisher"
ftmo-2: (feed --once --align --interval-seconds 300 --settle-seconds 90, then) --once --confirm-live --quiet ...
        --lane "ftmo-2" --grid half --r-multiple 3 --magic 20261005
        --expect-identity "C:\live-trading\state\lane-ftmo2-identity.json" --reentry-crossing
        --max-per-day unlimited --terminal "...MT5 Terminal 2" --published "C:\live-trading\publisher"
ftmo-3: --once --align --settle-seconds 90 --confirm-live --quiet ... --lane "ftmo-3" --magic 20261006
        --expect-identity "C:\live-trading\state\lane-ftmo3-identity.json" --blind --max-per-day unlimited
        --terminal "...MT5 Terminal 3" --published "C:\live-trading\publisher"
```

**One regression the deploy caught, and fixed in the same hour.** Lane 1 was first re-registered without `-Elevated`,
which put its task on the filtered token (`Interactive / Limited`). That token can use only the `Users` grant on the
lane's `tmp` files, and the order tool's journal is ACL'd to `Administrators` and `SYSTEM`, so the tool could not append
to `C:\live-trading\runtime\tmp\live-trading-orders.log`: the ticks at 18:16:30Z and 18:21:30Z refused with
`the terminal could not be read ... PermissionError: [Errno 13] Permission denied`, placing nothing and writing no
heartbeat. Re-registered with `-Elevated` (`Interactive / Highest`), lane 1 wrote a normal heartbeat at 18:26:30Z. Lane 3
is already `Highest` for the same class of reason (its identity file admits only Administrators and SYSTEM); lane 2 runs
Limited and its journal is writable, because that file carries an inherited grant for the user itself.


**The first ticks on the new revision.** Published at 18:40:20Z in commit `65d95d58`, from each lane's own 18:36:3xZ
heartbeat:

| lane | tick (UTC) | armed | status | `max_per_day` | `capped` | entries today | coverage | working order or position | lot |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ftmo-1 | 18:36:30 | true | send_failed (a removal did not land) | null | false | 1 | covered | XAUUSD sell limit 3568.67, sl 3582.97, tp 3497.19, #309523915 | 0.01 |
| ftmo-2 | 18:36:31 | true | send_failed (an exit did not land) | null | false | 2 | covered | XAUUSD position from 3533.14, tp 3497.19, #202473489 | 0.01 |
| ftmo-3 | 18:36:30 | true | nothing_to_place | null | false | 4 | covered | EURUSD sell limit 1.09782, sl 1.09866, tp 1.09361, #202452908 | 0.01 |

The `send_failed` on lanes 1 and 2 is the same condition recorded before this change: the 18:11:30Z and 18:11:31Z
heartbeats, on the old revisions, carry the same sentences ("1 removal did not land", "1 exit did not land"), the order
tool's own journal holds the terminal's answers, and no ticket was placed by either run.

**The floor, at each lane's own price** (from `coverage.rows` on the 18:26:30Z ticks; the three lanes agree because
each lane's own snapshot quoted the same levels):

| asset | price used | anchors (high/low) | spacing | lines | above / below | next above / next below |
| --- | --- | --- | --- | --- | --- | --- |
| EURUSD | 1.09655 | 1.12729 / 1.12308 | 0.00421 | 28 | 18 / 10 | 1.09782 / 1.09361 |
| XAUUSD | 3532.87 | 4211.99 / 4140.51 | 71.48 | 30 | 20 / 10 | 3568.67 / 3497.19 |
| US100.cash | 25263.51 | 30774.61 / 30499.79 | 274.82 | 40 | 30 / 10 | 25278.21 / 25003.39 |
| BTCUSD | 60659.54 | 84568.53 / 83113.66 | 1454.87 | 36 | 26 / 11 | 61290.61 / 59835.74 |

No line was added (`extended: false`, `added_above: 0`, `added_below: 0`) because the published ladder already covered
every price; `short` and `entries_withheld` are empty on every lane, and `failures` is empty. The working orders and
positions were placed from the same levels before the deploy and are untouched by it - the plan never rewrites an
existing line, and the tickets above are the ones the 21 November record left, at the same prices.

**Sizes.** Every working order and position on all three accounts is `0.01` lots: lane 1's XAUUSD sell limit, lane 2's
XAUUSD position and lane 3's EURUSD sell limit, read back through each lane's own `live-trading-order.py status`.

**The page.** `data/l2l-levels.json` on the hosted tree is still the 21 November file (`generated_at_utc
2026-11-22T02:40:55.736Z`, `marked_by: "automatic L2L coverage"`), and its generated lines carry `available_at_utc`.
The three hosted heartbeats (`data/live-trading-trader.ftmo-{1,2,3}.json`) are the 18:36:3xZ runs on `e3406286`, each
`armed: true`, `max_per_day: null`, `capped: false`, `coverage.status: "covered"`, `min_per_side: 10`, `short: []`.
Lane 3's names its own rule (`"rule": "blind"`, `"call_read": "none"`) and `identity_checked: true`.

## 7. Open items

- **The dashboard chip is closed** (section 8): the lane card and the status panel both carry a `Ladder coverage` row
  from `script.js?v=20261123-ladder-coverage-row`, published on `main` as `f30deafa` and read back headless.
- **Lane 1 must be re-registered with `-Elevated`.** Its `tmp` journal and state files admit Administrators and SYSTEM
  only, so a plain registration leaves it unable to write them; the deploy found this the hard way.
- **Lane 3's registration must still pass `-Published C:\live-trading\publisher`**, as the 21 November record says; its
  current wrapper does.
- **Lane 2 runs one revision a week old and it carries code it does not run.** Its trader and strategy library are
  byte-identical to `main`'s (`74b0cd18…` and `db164d85…`), so the session-expiry rule for a deviation (`43c48316`) and
  the blind lane's ordered three-leg reading (`e75757f4`) ship to it - but both sit behind `requireDeviation`, and lane
  2's wrapper passes `--reentry-crossing` and no `--require-deviation`, so on lane 2 they are dormant. Section 9 states
  what lane 2 does run, and the one case in the recorded history that would have been refused by a rule it does not have.
- **`C:\live-trading\runtime\data\l2l-levels.json`, `C:\ftmo2\…`, `C:\ftmo3\…` are still unread copies.** Nothing reads
  them; they can be deleted whenever someone is next in those checkouts.

## 8. The Ladder coverage row, published

The page work the 21 November record asked for is done and live. One row, stated the same way on the lane card and in
the status panel, read from the heartbeat's own `coverage` block rather than from the lanes file, so a lane whose run
did not state a floor says so instead of borrowing its neighbour's number.

- **Committed and published.** `f30deafa`, "live-trading: the lane card and the status panel state the ladder's
  coverage floor", pushed to `main` (`origin/main` pointed at that commit when read on the evening of 23 November; two
  data-only publish commits have landed on top since). `index.html` carries
  `script.js?v=20261123-ladder-coverage-row`.
- **The published bytes are the committed bytes.**
  `https://kevincreedycars-debug.github.io/trading-agent-dashboard/script.js?v=20261123-ladder-coverage-row` answers
  HTTP 200, 1,215,467 bytes, sha256
  `35BA4E6E8BEA39E1110E406A7316814C9A7B10C5C1DC2FD9FEA839A9AA4452E6` - the same hash as the worktree's `script.js`
  after line-ending normalisation, and the same bytes as `raw.githubusercontent.com/…/main/script.js`. The buster is
  live: the hosted `index.html` (37,299 bytes) serves that query string.
- **The block it reads.** The three hosted heartbeats state exactly the fields the page asks for: `status`,
  `checked_at_utc`, `extended`, `levels_available_at_utc`, `min_per_side`, `short[]`, `failures[]`, `entries_withheld[]`.
  The earlier "schema not confirmed against the publisher" risk is closed: the publisher's own output was read at
  20:56Z, `{"status":"covered","checked_at_utc":"2026-11-23T20:56:30.019Z","extended":false,
  "levels_available_at_utc":null,"min_per_side":10,"short":[],"failures":[],"entries_withheld":[]}` on all three lanes,
  beside `armed: true`, `caps.max_per_day: null`, `capped: false` and `entries_today` 3 / 9 / 24.
- **Read from the hosted page, headless.** The probe opens the Live Trading tab and the status panel at
  2026-11-23T20:56:30Z, reads each lane's `Ladder coverage` `dd`, records the row order and any page error, and prints
  JSON (`.local/wt/coverage-cap-20261122/tmp/live-coverage-row-check.js`, deliberately read-only - it clicks tabs and
  lane selectors and never sends, closes or publishes). Result: three cards, each reading `held at 10 full lines each
  side`; status-panel rows in order `ACCOUNT`, `LAST BROKER UPDATE`, `LAST STRATEGY TICK (UK)`, `STRATEGY`,
  `TICK OUTCOME`, `TRADING PERMISSION`, `LOADED RULES`, `LADDER COVERAGE`, `EFFECTIVE CAP`, `IDENTITY CHECK` on all
  three lanes; `errors: []`; diagnostics 3 cards and 40 lane rows.
- **What it will not say.** A heartbeat with no coverage block reads `not stated by this heartbeat`; a lane with no
  heartbeat reads `no heartbeat published`; a short side is named with its above/below counts and the instruments whose
  entries were withheld; a missing count is never rendered as `0`. The tooltip carries the reassurance that everything
  already working on the account was still reviewed, moved and exited.
- **Tests.** `node --check script.js` clean; `tests/live_trading_accounts.browser.test.js` and
  `tests/live_trading_lane_status.browser.test.js` 15 of 15; the ten trader/lane/L2L suites (`live_trading_trader`,
  `live_trading_lane2`, `live_trading_blind_lane`, `live_trading_deviation_sequence`, `live_trading_lanes_publish`,
  `live_trading_task_registration`, `l2l_strategy`, `l2l_coverage`, `l2l_half_grid`, `l2l_levels`) 330 of 330; the eleven
  remaining live-trading browser suites 36 of 37, the one failure being `the M5 pane zooms, and two marked levels each
  side survive every step`, which fails identically in a clean worktree at `d9018198` (the commit before this one) and is
  the `origin/main` chart-zoom failure the 21 November record already names.

## 9. FTMO 2 audit: the ordered legs, the session expiry, the Blind reset

The question was whether lane 2 runs the ordered M5 reading, the session-expiry rule and a market-closure reset
inherited from the blind model. It runs none of the three, and the reason is one flag.

- **What the three checkouts hold.** All three lanes run the same two files:
  `scripts/run-live-trading-trader.js` sha256
  `74b0cd18b06578cc456ada35f0900587b2b95dfc6b128637b207c00d55eb8ee0` and `lib/l2l_strategy.js` sha256
  `db164d858e42c1c9ae03076e2cc9474cbc888de0b647d79bfd17755f30ce59ec`, byte-identical to `main`'s copies after
  line-ending normalisation, on checkouts that report `checkout_head: e3406286`; neither file changed between
  `e3406286` and `f30deafa`. The scheduled tasks are `LiveTradingTraderTick019` (lane 1, root
  `C:\live-trading\runtime`), `LiveTradingTraderTick-ftmo2` and `LiveTradingTraderTick-ftmo3`.
- **What each wrapper asks for.** Lane 1: `--once --align --settle-seconds 90 --confirm-live --lane ftmo-1
  --max-per-day unlimited` (no grid or R flag, so the full ladder at five to one). Lane 2: the same plus `--grid half
  --r-multiple 3 --reentry-crossing --expect-identity …`. Lane 3: `--blind --max-per-day unlimited`. Only lane 3 asks
  for the deviation.
- **Where the gate is.** `--require-deviation` sets `requireDeviation` (`scripts/run-live-trading-trader.js:577`);
  `--blind` forces it true (`:669`) and the library's blind plan forces it again unless a caller says otherwise
  (`lib/l2l_strategy.js:1397`). Everything the audit asked about sits behind that one boolean: the market-closure
  expiry of the judged candle (`lib:584`), the ordered three-leg reading `levelWasLeft` (`lib:694`), the session legs on
  the put-back gate (`lib:1009`-`:1015`), and the `deviation` object itself (`lib:678`). On lane 2 all of them are
  skipped, so `deviation` is `null` and the heartbeat's `require_deviation` is `false`.
- **What lane 2 does run.** A fresh entry is a close beyond a cleared level with the close before it on the near side,
  read from the newest completed five-minute bars (`closedBars` against the run's own clock). A put-back is gated by
  `--reentry-crossing` alone (`crossingRequired`, `scripts/…:1198`), which calls `crossedSince` with
  `requireDeviation: false` (`:1221`-`:1230`) and so reads the crossing candle and the one before it since
  `max(exit, call seal)` - no session leg, no closure leg, and it may replay an older close, which is what the comment
  at `:1193` says the deviation flag exists to stop.
- **The inherited Blind reset.** `blindWatchPairs` re-selects a pair when the previous selection belongs to an earlier
  Prague trade day (`newDay`, `scripts/…:2396`-`:2406`) - a *selection* reset, not a market-closure reset - and it is
  called only on the blind branch (`:3149`). Lane 2 keeps no pair state at all (no `state.blind`, no watched lines), so
  there is nothing of it to inherit, and the day-boundary rule cannot be what resets lane 2 across a weekend.
- **What the deployed record shows.** Read read-only from the three state files at 2026-11-23: lane 2 has 90 placed
  tickets - 32 fresh entries and 34 put-backs among the 66 that name an event - and every put-back re-armed within 24
  hours of its exit, every crossing it cites being the newest completed candle (largest lag 1.6 minutes past that
  candle's close; 56 tickets state no crossing bar because their records predate the gate or are fresh entries). Lane 3:
  42 tickets, 36 fresh entries, 6 put-backs, same picture. No ticket on any lane was placed while its market was shut:
  of 23 weekend placements (12 / 5 / 6), every one is BTCUSD, which trades through the weekend, or is stamped after the
  22:00Z Sunday reopen (EURUSD 22:06Z and 22:11Z, XAUUSD 23:11Z and 23:16Z on 2026-11-22).
- **The one case a rule lane 2 does not have would have refused - and it is on lane 1.** EURUSD put-back placed
  2026-11-22T22:06:33.994Z from a window opened 2026-11-20T17:41:34Z: 52.4 hours across the weekend. Lane 1 has no
  crossing gate at all, so that put-back is the lane's stated rule ("puts its level back whatever the candles are
  doing") rather than a gate that failed, and the market was open again when the limit went out. It matters here because
  it shows a weekend-spanning re-arm is not hypothetical on an account that trades ordinary crossings.
- **Open risk, recorded rather than changed.** The market-closure test at `lib:584` is keyed on `requireDeviation`, not
  on "the caller stated a clock", so the two lanes that trade ordinary crossings can in principle state a limit from a
  candle that closed before the market closed; the only thing between a weekend bar and a ticket there is the Layer 1
  call's own validity (`layer1Call`, `scripts/…:729`-`:745`, which requires `expiry > now` and a status other than
  `EXPIRED`). It has not fired in the recorded history, and moving the guard out from behind the flag is a rule change
  on two live accounts, so it is put to the owner instead of being slipped in.

