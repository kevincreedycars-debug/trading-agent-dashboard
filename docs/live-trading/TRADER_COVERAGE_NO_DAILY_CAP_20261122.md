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

- **The dashboard chip.** The heartbeat now carries the coverage block the 21 November record asked for, but no page
  renders it yet: the lane card states the caps and the rule, not the floor. That is page work, and it is the one piece
  of the original plan still open.
- **Lane 1 must be re-registered with `-Elevated`.** Its `tmp` journal and state files admit Administrators and SYSTEM
  only, so a plain registration leaves it unable to write them; the deploy found this the hard way.
- **Lane 3's registration must still pass `-Published C:\live-trading\publisher`**, as the 21 November record says; its
  current wrapper does.
- **Lane 2 now runs a revision it did not run before**, so it also carries the session-expiry rule for a deviation
  (`43c48316`) and the blind lane's ordered legs. Both were reviewed on lane 3's line and both are covered by tests; they
  are rule changes on a live account and are recorded here as such rather than presented as part of the coverage work.
- **`C:\live-trading\runtime\data\l2l-levels.json`, `C:\ftmo2\…`, `C:\ftmo3\…` are still unread copies.** Nothing reads
  them; they can be deleted whenever someone is next in those checkouts.

