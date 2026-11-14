# The Live L2L Blind ruleset

Proposed ruleset for a third FTMO trader, **"Live L2L Blind"**, on EURUSD, XAUUSD, US100.cash and BTCUSD.

Status: **approved by the owner on 2026-11-14, and built on branch `live-trading/l2l-blind-20261114` against
`origin/main`. Not deployed, not registered, not funded, and no order has been sent.** The review settled the platform
(a third MT5 login, section 2), the watched levels (one fixed pair around the price rather than the whole ladder,
sections 1 and 4), the deviation (all three legs, section 4), the ticket (a limit at the armed rung, the next original
L2L in the trade's direction as its target, stop a fifth of that distance, section 5), the unfilled limit (no timed
expiry at all, section 7) and the daily count (none: the owner removed the strategy-imposed limit on all three
accounts the same day, section 8). Section 10 lists what the build changed and section 11 records what the approval
closed.
The rule text is read off four places and nothing else: the reclaim commit `b70584eb` ("a reclaim needs the
level held and left, on one symbol, in one session", branch `live-trading/deviation-audit-20261113`, cherry-picked
onto this branch), the deployed-lane audit [L2L_DEVIATION_AUDIT_20261113.md](L2L_DEVIATION_AUDIT_20261113.md), the
runner on `origin/main` for the position management, the caps and the rounding, and the third account's own robot,
already committed there at `ctrader/Ftmo3L2L` (2026-11-13, `c390dcd1`, "the independent full-grid cTrader robot",
orders disabled by default). Companions: [STRATEGY_LIVE.md](STRATEGY_LIVE.md),
[SECOND_LANE_HALF_L2L.md](SECOND_LANE_HALF_L2L.md), [FTMO_SETUP_GUIDE.md](FTMO_SETUP_GUIDE.md),
[BLIND_LANE_BUILD.md](BLIND_LANE_BUILD.md).

## 1. What "blind" adds and what it removes

Both lanes trading today ask Layer 1 which way an asset is going and take only the reclaim of a marked L2L line
*in that direction*: `buildPlan` returns `no-call` and states no ticket when the day's call is missing or flat.
The side of every ticket on those lanes is the call's side.

Blind removes that vote and nothing else. Neither Layer 1 nor Layer 2 is read. Instead the lane watches **two rungs
per instrument** — the nearest original full L2L above the price and the nearest one below — selects that pair at
startup and again after every exit at a target or a stop, after every confirmed cancellation of an unfilled order and
whenever one of the two leaves the marked set, and holds those two prices fixed in between. Only those two lines can
arm. The side of a ticket comes from the closes themselves: a close back above the lower rung that had been held above
and left below is one buy limit, a close back below the upper rung that had been held below and left above is one sell
limit, and the first of the two to complete its three legs sets the direction. A complete reclaim at any third marked
line produces no order. No macro series, no Layer 1 call and no other lane's reading enters the decision — which is also
why a blind ticket can sit opposite a lane 1 ticket on the same instrument on the same day.

What it keeps, unchanged: the ladder, the M5-close discipline, the limit *at* the line rather than a breakout
order, the target one original rung away in the trade's direction — which for a reclaim of the nearer watched line is
the other watched line, and for the far line is the next original line past it — the stop at one fifth of that
distance, the 2R breakeven and 3R trail, the minimum lot, one working ticket per instrument, and the Prague day the
entry count is reported on. The daily limit itself is gone (section 8).

One thing on the repository already answers half of the platform question, and it belongs before the rule rather
than after it: `ctrader/Ftmo3L2L` on `origin/main` is a third-account robot, on the full grid, with no vote and
both sides watched — the same idea, and already written. Its reading is not this page's reading. It asks only
whether the previous close was on the far side of a line and the newest one a tick back across it
(`previous <= level && newest >= level + tick`), which keeps neither the held leg nor the depth of the excursion;
it places an absolute stop and an absolute target and never amends either; and it counts nothing per day. So
"blind" here means **no vote, two watched lines, the full three legs, and the same management as lane 1** — the cBot
as it stands is a wider rule than this page's, and that gap is why the third lane is not built on it (section 2).

What the experiment can show, and what it cannot: on the days Layer 1 happens to agree with the closes, blind and
lane 1 take the same trade on the same line, so blind adds nothing there. The difference is exactly the days the
call is absent, flat or opposite — blind trades them, lane 1 does not. Turned round, blind is also the honest
control for the other two lanes: the same ladder, the same arithmetic, no vote, so a comparison after a few weeks
says something about the vote rather than about the rule. It does not say anything about edge before it has run,
and nothing in this page is evidence of one.

## 2. The lane's own identity

A lane is one account, one terminal, one checkout, one snapshot artifact and one set of numbers written in
`config/live-trading-lanes.json`. The row below is the third one, as the build writes it; the two that exist on
`origin/main` are `ftmo-1` (`Live L2L Directional`, magic `20261004`, grid `full`, R 5) and `ftmo-2`
(`Live 0.5L2L Directional`, magic `20261005`, grid `half`, R 3).

| Field | Value | Why it is that |
| --- | --- | --- |
| `id` | `ftmo-3` | one id per account, and the id is what a run is checked against |
| `label` | `Live L2L Blind` | the strip name is data-driven from this line |
| `enabled` | **`false`** until the account exists | an enabled lane with no snapshot refuses the whole publish; a parked lane is reported and skipped, so it cannot stop the other two publishing |
| `magic` | **20261006** | 20261004 and 20261005 are taken, and the number continues the same date series; a ticket carries its lane's number and every filter reads it. The only other `20261006` in the repository is a page cache-buster, a different namespace entirely |
| `strategy` | `{ "grid": "full", "r_multiple": 5, "blind": true }` | the same geometry as lane 1, so the only difference is the missing vote |
| `blind` | **`true`** | read by `checkLaneCommandLine`, by the registration and by the lanes publisher: a `--blind` run whose row does not carry it is a refusal, and so is a called run on this row |
| `root` | `../ftmo3` | its own checkout, so its state file, log, lock and journal cannot collide with another lane's |
| `published` | `data/live-trading.blind.json` | one artifact per lane; the publisher reads them all and commits once |
| `status_published` | `data/live-trading-trader.ftmo-3.json` | same rule for the trader status |
| `expect_identity` | `C:\live-trading\state\lane-ftmo3-identity.json` | a magic that is not lane 1's *requires* `--expect-identity`; the private file names the login and server the terminal has to match |
| `tasks` | `LiveTradingLane-ftmo3`, `LiveTradingTraderTick-ftmo3`, `LiveTradingTerminalStartup-ftmo3` | one cadence, one trader tick and one startup per lane |
| `terminal` | its own MT5 installation folder | two terminals cannot share one log-in, and lane 1's is `/portable` |

The row names **a third MT5 login**, which the owner settled on 2026-11-14, and every number in it follows from that
choice: the four symbol names in this ruleset are MT5 names, `US100.cash` included; the whole order path is the MT5
bridge the two existing lanes use; and `--lane ftmo-3` is held to this row's magic, grid and multiple by
`checkLaneCommandLine` before any artifact is read or any call is made — so the row *is* the configuration rather
than a comment about it.

The FTMO cTrader Challenge account stays where it is, for the FTMO 1 copy project, and is not this lane's home. The
robot already committed there (`ctrader/Ftmo3L2L`) is not this ruleset: it takes the marked prices as one
comma-separated parameter, checks the account number and the cTrader symbol name before it acts, labels its tickets
`FTMO3-L2L-5R`, brackets the bid with the nearest marked line above and below, and places nothing until
`Enable orders` is set — but its reading is two closes across a line, it never amends a stop, it watches the whole
ladder rather than a pair, and it counts nothing per day. Keeping it as the copy robot while this lane runs on MT5 is
the arrangement that leaves each of them doing what it already does.

## 3. Instruments, the ladder, and the size

The four instruments, as FTMO serves them and as `data/live-trading.json` records them — exact names, no suffixes:

| Symbol | Digits | Point | Contract size | Min lot / step | `stops_level` | Ladder step now published | Risk at min lot (stop) | Target at min lot |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `EURUSD` | 5 | 0.00001 | 100,000 | 0.01 / 0.01 | 0 | 0.00421 (421 points) | $0.84 | $4.21 |
| `XAUUSD` | 2 | 0.01 | 100 | 0.01 / 0.01 | 0 | 71.48 (7,148 points) | $14.30 | $71.48 |
| `US100.cash` | 2 | 0.01 | 1 | 0.01 / 0.01 | 0 | 274.82 (27,482 points) | $0.55 | $2.75 |
| `BTCUSD` | 2 | 0.01 | 1 | 0.01 / 0.01 | 0 | 1,454.87 (145,487 points) | $2.91 | $14.55 |

The ladder is the owner's own marking, not something the loop derives. Two seed prices are marked by hand on the
chart, one step apart, and the distance between them is repeated ten times below the lower seed and ten times above
the upper one. That makes **22 uniform rungs** per instrument, and `data/l2l-levels.json` carries all of them — the
two seeds at positions 11 and 12 of 22, with `role: "derived"` on the rest: EURUSD from 1.08098 to 1.16939 (seeds
1.12308 and 1.12729), XAUUSD 3425.71 to 4926.79, US100.cash 27751.59 to 33522.81, BTCUSD 68564.96 to 99117.23. The
file was last marked on 2026-10-04, so the rungs are illustrative of *shape* only until the owner re-marks them; a
lane reads whatever the published artifact holds and never invents a line.

Blind uses the **full grid only**, and "original" throughout this page means exactly those published rungs — the
twenty-two hand-anchored lines per instrument. The 0.5 midpoints belong to lane 2's model and to no other lane: a
midpoint is not a marked price, and a reclaim, a watched level or a target measured against one would be a line the
owner never drew.

The size is the smallest position the instrument accepts — 0.01 lot on all four, `min_lot` and `lot_step` in
`data/live-trading.json` and the MT5 `volume_min` the bridge falls back to. That is not a risk setting: the trader
passes no `--lots` at all, so the tool's default is that minimum, and the money figures in the table follow from the
ladder step and the contract, not from a per-trade risk budget. A wider re-marked ladder
widens the stop and the money with it, in step: at the published steps the four simultaneous stops total about
**$18.60** against FTMO's $500 daily and $1,000 total limits on a $10,000 account, but that headroom is a property of
today's steps and the minimum lot, not of the rule.

## 4. The watch, and the entry rule

### The two lines the lane watches

One reclaim is one limit, and a reclaim only counts at a **watched** line. The lane watches exactly two rungs per
instrument — the nearest original full L2L above the price and the nearest one below — and holds those two prices
fixed while it waits:

| Event | What the lane does with the pair |
| --- | --- |
| startup: the first run of the trading day | select — nearest original rung above the price, nearest below |
| a position exits at its **target** | select again, around the price at that moment |
| a position exits at its **stop** | select again, around the price at that moment |
| a working limit is **confirmed cancelled** (section 7) | select again, around the price at that moment |
| a watched rung is **gone from the published ladder** | select again — the line it was watching does not exist any more |
| anything else | nothing. The two prices stand, however far the market runs in between |

Two consequences are worth stating rather than leaving to be discovered. A side with no rung at all — a price above
the top of the ladder or below the bottom — is simply not watched, and an entry there would have no target and so no
ticket (section 5). And because the pair is fixed, a market that runs through both watched lines without arming either
of them leaves the lane watching them from behind for the rest of the day. That is the price of a predictable watch,
and it is a frequency fact, not a risk one.

The pair is state, not memory: the trader tick is a series of separate runs, so the two prices are written down in the
state file beside the placements, and each of the events above is what overwrites them. A restart inside the trading
day reads the pair back rather than moving it — the tick is a new process every five minutes, so "restart" cannot be
distinguished from "next tick" and must not re-select — and the first run of a new Prague day selects again, which is
the startup the owner named. A limit that is already working keeps working through either, because only section 7's
cancellation reasons — the target touched, the rung removed — end a working limit.

### The three legs

A reclaim has three legs, and every leg is a **closed M5 candle's close**, on **one symbol**, at **one watched
line**, inside **one trading session**:

1. **Held.** A close at least one point on the trade's own side of the line — the level was held there.
2. **Left.** A close at least one point beyond the line on the far side — the excursion. Several closes beyond it
   before the close back are still the one excursion.
3. **Reclaimed.** The newest closed candle finishes back on the trade's own side, at least one point past the line.

The session is the **Europe/Prague calendar day** — `SESSION_TIMEZONE` in the reclaim branch's module and
`TRADE_DAY_TIMEZONE` in the runner, which agree — and it is the same day FTMO's own daily loss and trade-count
limits roll on. `origin/main`'s module has no session logic at all yet, so this page describes the branch's rule and
the branch is the thing to merge. A leg from before the session opened is another day's evidence and is not this
reading's, and a block of bars that names a symbol has to name the same one for every leg or the reading is refused
rather than stitched from two pairs.

What is not a reclaim, by the owner's own sentences and by the module that implements them:

| Reading | Result |
| --- | --- |
| A wick beyond the line with the close back inside | nothing — a wick is not a close anywhere in this rule |
| A close exactly on the line | establishes nothing; it is neither the excursion nor the reclaim. An exact-line close *between* the legs is allowed and changes nothing: 101 → 99 → 100 → 101 is a reclaim |
| `99 → 98 → 101` at a line of 100 | nothing. The line was only ever approached from the far side, so it was never held: a first crossing, not a reclaim |
| `102 → 100 → 101` | nothing. Holding is not enough; the level also has to have been left, and a close on the line left nothing behind |
| `102 → 99 → 101` | a reclaim — held, left, reclaimed |
| Closes spanning the Prague midnight | nothing. Two closes in two sessions are not one crossing |

**The side comes from the closes, and the pair bounds it.** A bullish reclaim can only be stated at the lower watched
rung — the line the market held above, left below and came back above — and a bearish one only at the upper rung: a
**buy limit at the lower line**, a **sell limit at the upper line**. That is what the pair buys for the rule: the
direction is decided by which of the two lines completes its three legs first, and nothing is read from Layer 1 — not
the direction, not its absence. A reclaim at any third rung is not a candidate at all, and section 10 carries the test
that proves it.

Two readings of the pair are settled here rather than left to the build:

- **One side arms, the other waits.** A refusal is not an arming. If the first leg set produces no sendable ticket —
  the target already behind the market, the line gone from the ladder, a stop under one point — the pair stays and the
  next close may arm either side.
- **One close arming both sides at once** cannot happen under the three legs. A long reclaim needs the candle before
  the newest to have closed at or below the line, a short needs it at or above one, and one close cannot be both. What
  can happen is a close that clears **both rungs in one direction** — 1.125, then 1.095, then 1.130 against rungs at
  1.10 and 1.12 — and the build takes the nearer rung, the last one price came back through, which is the tie-break the
  two live lanes already read. The alternative — "place nothing and wait for the next close" — was the page's first
  proposal and is recorded, with the arithmetic that makes it unnecessary, in section 11.

Two boundaries that follow from the arithmetic rather than from a choice:

- **One ticket at a time per instrument.** A pair that already carries a ticket or a position states no second one: a
  reclaim at the other watched line waits until the first is gone and the pair has been selected again. One confirming
  bar still authorises one ticket, so the same close cannot leave two.
- **The ladder's edge states no ticket.** A rung with no marked line beyond it in the trade's direction has no
  target, so no stop and no ticket; a rung whose one-fifth distance is under one point is refused rather than
  widened, because a stop the instrument's grid cannot express is not a stop.

## 5. The ticket

| Field | Rule |
| --- | --- |
| Type | a **limit** at the line the candle deviated — the rule buys the retrace to the line, not the breakout candle. The tool refuses a buy limit at or above the market and a sell limit at or below it, because that is a market order wearing a limit's name |
| Entry | the watched rung the reclaim completed, exactly as marked (the module rounds it to six decimals; the terminal rounds to the symbol's digits) |
| Target | the next original L2L in the trade's direction, one full ladder step away — for a reclaim of the nearer watched rung that is the other watched rung, and for a reclaim of the far rung it is the original line past it, so the ladder prices the ticket and not the pair alone. It may therefore sit outside the two watched lines: the watch decides what may *arm*, not what may be *aimed at* |
| Stop | entry ∓ (target distance ÷ 5), so the target is worth five times the risk. The stop is *derived from* the target, not the other way round |
| Risk | the distance entry→stop, kept in the placement row, because the 2R and 3R rungs are measured from it later, not from wherever an amended stop then stands |
| Magic | `20261006` |
| Comment | `l2l-rule-…`, the same prefix lane 1 uses, so the terminal's own history separates rule trades from plumbing proof |
| Size | the symbol's minimum lot — 0.01 on all four (its `volume_min`) |

At the published EURUSD step a ticket reads: **buy limit 1.11887, stop 1.11803, target 1.12308** — 421 points of
target over 84.2 points of risk, and the stop rounded to the pair's fifth digit at the terminal (the module states
1.118028). On a 0.01 lot that is $0.84 at risk for $4.21 at target.

## 6. Managing an open position

The two amendments are inherited from `origin/main` unchanged — they are the owner's own instructions
(`STRATEGY_LIVE.md` §54, 2026-10-15, and its §59, 2026-11-04, which is on `origin/main` and not yet in this
checkout), and neither has anything to do with which way a call points:

- **At 2R**, where R is the risk the ticket was placed with, the stop goes to the entry it was placed with —
  breakeven, one move.
- **From 3R** the stop follows the market instead, keeping **3R behind the most favourable price the trade has
  reached** since the bar its ticket was placed in: 3R up holds the entry, 4R up holds entry + 1R, and every further
  R of price carries the stop with it. Never behind where the stop already stands, never at or past the target.
- **One amendment per position per run**, so a trade that reaches both rungs between two ticks is taken to
  breakeven by this run and onto the trail by the next. Neither rung is ever asked for twice.
- **The target is never moved.** It is the rung the ticket was placed for, and it is carried through every stop
  amendment unchanged.
- A position whose placement row is gone, or whose row states no risk, is left alone rather than moved against a
  number the loop does not have; a position this same run is already exiting is left to its own exit.

**What blind does not do:** lane 1 exits a position when the day's call turns against it, and blind has no call to
turn. A blind position therefore leaves only on its own stop or its own target. That is the whole of the difference
in management, and it is deliberate: inventing a substitute exit trigger would reintroduce a vote by the back door.

The platform is the MT5 route (section 2), so both amendments are the runner's existing behaviour rather than new code:
`BREAKEVEN_R_MULTIPLE` and `TRAIL_FROM_R_MULTIPLE` in `scripts/run-live-trading-trader.js` already implement them, and
the pair changes neither. The cBot on `origin/main` places an absolute stop and an absolute target and never touches
either again, which is one more reason it is not the vehicle for this lane.

## 7. When an unfilled entry comes out

Lane 1's answer today has two parts. A working limit carries **no expiry of its own** — the runner's own note is
"the entry carries no expiry at all", and `--expire-minutes` defaults to `null` and stays a hand cap — and the level
stands until its reason is gone, which is either (a) the market reaches the ticket's own take-profit without the
limit having filled, or (b) the day's call turns. Part (b) cannot exist on blind.

Blind keeps (a), drops (b), and settles the rest of this list. None of it is a proposal:

1. **No timed expiry, at all.** Not a default and not a hand cap either. A timeout would delete exactly the trades the
   rule was left for, because the retrace to a rung can be hours away, and blind has no call to end the wait instead.
   `--expire-minutes` stays `null` on this lane's registration, and section 10 pins it there.
2. **The take-profit touch cancels it.** A market that has reached the ticket's target without the limit filling
   has made the move the entry existed for; the deviation is behind the market now, and the limit is taken back
   out. This is the same reading lane 1 uses and it is measured from the bar the ticket was placed in, so a touch
   before the placement is not this question.
3. **A removed rung cancels it.** A limit sitting at a line that is no longer in the published artifact is taken
   out rather than left at a price nobody has marked any more.
4. **The session boundary does not cancel it.** The Prague day decides what evidence may *arm* a line, not how long
   a working order may stand. A level that has just carried a stopped trade re-arms only on a fresh three-leg reclaim
   completed after that exit, and that is the whole of the gate: the build re-uses lane 2's `crossedSince` window with
   `requireDeviation` on, and the window opens on the exit itself because there is no call to seal. `--reentry-crossing`
   is not asked for and is refused beside `--blind`: it would put a second, weaker two-candle test on top of the three
   legs. A ticket put back without a new reclaim is a second ticket the rule did not ask for.
5. **Every cancellation re-selects the pair** (section 4), so the lane does not keep sitting on a level it has just
   given up: the next pair is the market's own neighbourhood again rather than the abandoned line.

What the pair does *not* change is the lifetime itself. A limit whose line stops being watched — because the pair was
re-selected around a moved market while the order was already working — goes on working until one of the reasons above
ends it. The watch governs what may *arm* a new ticket; it is not a cancellation trigger of its own.

The cBot on `origin/main` reads its pending orders the same way and says so in its own README: a pending order
"remains working until filled or cancelled", a cancelled one re-brackets the bid only on the next completed candle,
and a restart requires a fresh completed candle before it will act. Same answer, less detail — and it confirms that
"no expiry" is the repository's reading and not an invention of this page.

## 8. Caps, concurrency and risk across the four assets

The runner holds three of these caps itself; the fourth was the proposal, and the owner's answer of 2026-11-14 is that
there is none: *"There is no strategy-imposed daily entry limit on FTMO 1, FTMO 2 or FTMO 3."*

| Cap | Value | Where it comes from |
| --- | --- | --- |
| Working tickets per instrument | **1** | the owner, 2026-10-06: *"each asset can have only one pending order running at a time."* A second reclaim on the same instrument waits until the working order or the position is gone — and section 4 adds that only a watched line can arm one |
| Positions across instruments | **4** — one per instrument | one rung set per instrument and one working ticket each, so four is the arithmetic maximum, not a policy |
| Placements per Prague day | **no cap** | the owner, 2026-11-14. The day is still counted and still printed — `caps.entries_today` in the heartbeat, `taken_today` in the run record — because how many entries a day carried is reporting rather than a gate |
| `--max-open` | counts **positions**, not orders | the runner's own note: a working limit is invisible to it, so it is not the cap that limits this lane |

### What the count still says

The counter is the runner's own (`placementsToday`), and it does not count every ticket: it counts the rows written
today that carry no `reentry` flag. The ledger keeps three kinds of row, and the distinction is still worth reading even
with no cap, because it is the difference between a new trade and the same one put back:

| Row in the ledger | When the runner writes it | Counts as |
| --- | --- | --- |
| a fresh placement | a three-leg reclaim that is not the pair's standing trade being put back — including a reclaim of a line whose trade has already finished | one entry |
| `re-entry-after-exit` | the pair's trade still stands and its own level is put back because the position was stopped out; the fresh reclaim of section 7 is what lets it back | a put-back, stated as its own event |
| `replacement-of-unfilled-limit` | the pair's trade still stands and its own level is put back because a working limit was cancelled without filling and without reaching its target | a replacement, stated as its own event |

What ends the pair's trade — and so turns the next reclaim of that level into a fresh placement — is the target being
filled or merely touched, or a hand close. On blind there is no call to turn (section 6), so the whole accounting
reduces to one distinction, and one that is easy to get wrong: the free put-back is the **same side at the same
level**. A reclaim of that level in the *other* direction is a different trade, and the standing one has to be finished
first.

| The trade on that instrument ended by | The same level, same side, reclaimed later in the day | Row |
| --- | --- | --- |
| its **target** | a new trade: the set-up finished where it was aimed | fresh placement |
| its **stop** | the same trade re-entered; the fresh reclaim of section 7 is what lets it back | `re-entry-after-exit` |
| a **cancel** that neither filled nor reached the target | the same trade, re-stated at its own level | `replacement-of-unfilled-limit` |

Worked example, EURUSD alone, one Prague day, with nothing to spend and therefore nothing to run out of — it is here
because it is the row an operator reads to tell a fresh entry from a put-back. Rungs 1.11887, 1.12308, 1.12729 and
1.13150; one step is 421 points and the risk is a fifth of it, 84.2 points:

| Time (Prague) | What happens | Watch after it |
| --- | --- | --- |
| 09:00 | startup; price 1.11950 | 1.11887 / 1.12308 |
| 09:20 | bullish reclaim at 1.11887 → **buy limit 1.11887**, stop 1.11803, target 1.12308. Fresh | unchanged |
| 11:05 | fills, and the target at 1.12308 is taken: the trade ends where it was aimed | — |
| 11:05 | re-selected at price 1.12350 | 1.12308 / 1.12729 |
| 12:30 | bearish reclaim at 1.12729 → **sell limit 1.12729**, stop 1.12813, target 1.12308. Fresh: a new trade on a new level | unchanged |
| 14:10 | fills, and the stop at 1.12813 is hit: the trade survives its stop, and its level waits | — |
| 14:10 | re-selected at price 1.12813 | 1.12729 / 1.13150 |
| 15:35 | the market closes back below 1.12729, swings above it once more and closes below again — a fresh bearish reclaim after the 14:10 exit, with the three legs satisfied — → **sell limit 1.12729** put back at the trade's own level. Not a fresh trade | unchanged |
| 16:20 | fills, and the stop at 1.12813 is hit a second time | — |
| 18:30 | the target at 1.12308 is reached at last: the trade ends where it was aimed | — |
| 18:30 | re-selected at price 1.12320 | 1.11887 / 1.12308 |
| 19:40 | bearish reclaim at 1.12308 — now the upper line of the pair — → **sell limit 1.12308**, target 1.11887. Fresh, because the trade that used this level finished at its target | unchanged |

The 15:35 row is the one to look at. Under a count that charged only fresh placements, that put-back would have been
free, and a level that keeps stopping out could be sold and stopped all day; under a count that charged every ticket it
would have been the fourth of four. Neither question exists any more, because the owner removed the limit: the row is
still labelled so that the day's record says *what* happened, and the pair's re-selection on the 14:10 exit is what
bounds the repetition. The only per-instrument bound left is the fresh reclaim of section 7 — a stopped-out level
re-arms on a new three-leg reclaim and not before — and the only cross-instrument bound is the four instruments.

So the worst case a blind day can hold is four minimum-lot positions, and if all four stops are hit that is about
**$18.60** — around 3.7% of the $500 daily limit on a $10,000 account and under 2% of the $1,000 total. The real risk
is the instrument that moves furthest beyond its own rung, which no lot ladder can bound; the holds bound how *many*
of those can be open at once, not how far one can run. With no daily count, the number of trades a day is bounded by
the market and by the fresh-reclaim gate, and the four-position figure is the worst case of the positions rather than
of the day's turnover.

Two things the caps cannot do, and they belong in this page rather than in a footnote:

- **No cross-lane offsetting.** Lane 3's positions are its own; if lane 1 or 2 holds the same instrument on the same
  day, the operator's exposure on that instrument is doubled, not hedged. That is the same statement
  [SECOND_LANE_HALF_L2L.md](SECOND_LANE_HALF_L2L.md) makes for lane 2, and it is more likely here, because blind
  has no direction filter to keep it out of lane 1's trades.
- **FTMO's own limits are per trader, not per lane.** The house publishes 200 working orders at a time, 2,000
  positions a day and a $400,000 aggregate allocation per trader per strategy; a third lane on a third account is
  another slice of the same ceiling. And the wording prepared for account 2 — *the same strategy, the same signals,
  the same sizing rules* — describes a **copy**, which blind is not: it is a different entry rule, so it needs its
  own answer from FTMO before it runs on a funded account. `VPS_DEPLOYMENT_STATUS_20261024.md` §4 holds that letter.

## 9. Three worked examples

All are on EURUSD at the published rungs, 2026-11-20 (a Friday, central European winter time, so Prague 10:05 is
09:05 UTC). M5 closes, one instrument, one session throughout. "Points" are the pair's fifth decimal. Each example
states the pair it runs under, because under section 4 a line that is not being watched cannot produce a ticket.

### A buy limit at 1.11887 — watch: 1.11887 below, 1.12308 above

| M5 close (UTC) | Close | Reading |
| --- | --- | --- |
| 09:05 | 1.11950 | 63 points above the line — the level is **held** on the long side |
| 09:10 | 1.11920 | still above; adds nothing |
| 09:15 | 1.11850 | 37 points **below** the line — the excursion |
| 09:20 | 1.11905 | 18 points back **above** — the newest close is the **reclaim**, so a ticket is stated |

Ticket on the 09:20 close: buy limit **1.11887**, target the next rung **1.12308** (421 points), risk a fifth of
that = **84.2 points**, stop **1.11803**. Then, in order:

| Step | Price | What the loop does |
| --- | --- | --- |
| Fill | ask trades 1.11887 | position open, placement row holds entry 1.11887, stop 1.11803, target 1.12308, risk 0.000842 |
| 2R | 1.11887 + 2 × 84.2 = 1.12055 | one amendment: stop to **1.11887** (breakeven). The target is not touched |
| 3R | 1.12140 | the trail begins: the stop holds 3R behind the furthest price, which at 3R is still the entry |
| 4R | 1.12224 | 3R behind 1.12224 is 1.11971, a step forward, so the stop goes to **1.11971** |
| Target | 1.12308 | the position closes on its own target: **+421 points, $4.21 on 0.01 lot** |

### A sell limit at 1.12729 — watch: 1.12308 below, 1.12729 above, selected when the buy took its target

| M5 close (UTC) | Close | Reading |
| --- | --- | --- |
| 10:05 | 1.12700 | 29 points below the line — the level is **held** on the short side |
| 10:10 | 1.12760 | 31 points **above** — the excursion |
| 10:15 | 1.12690 | 39 points back **below** — the reclaim |

Ticket on the 10:15 close: sell limit **1.12729**, target **1.12308** (421 points below), risk **84.2 points**, stop
**1.12813** (the module states 1.128132). Fill at the bid. 2R is 1.12561, where the stop goes to 1.12729; 3R is
1.12476, where the trail takes over; 4R is 1.12392, where the stop sits 3R back at 1.12645; the target at 1.12308
pays the same 421 points.

### A reclaim at a line nobody is watching

The third example keeps the watch where it was. The buy of the first example is still only a working limit, so no
target, no stop and no cancellation has happened since 09:00, the pair is still 1.11887 / 1.12308, and that buy limit
is still standing at its line.

| M5 close (UTC) | Close | Reading |
| --- | --- | --- |
| 10:00 | 1.12650 | below 1.12729 — held on the short side |
| 10:05 | 1.12800 | 71 points above it — the excursion |
| 10:10 | 1.12640 | back below — a complete bearish reclaim at a marked line |

That is the identical reading that produced a sell limit in the second example, and here it produces **nothing**:
1.12729 is a marked rung, but it is not in this pair. The reading is stated in the log and refused, the buy limit at
1.11887 stands until section 7 ends it, and the lane waits for one of section 4's re-selection events. This is the whole
difference between watching two lines and watching the ladder, and section 10 carries it as a test of its own.

What none of the three examples contains is a Layer 1 direction. If the day's call on EURUSD had been long, lane 1
would have taken the buy at 1.11887 and never the sell at 1.12729; blind takes whichever of its two watched lines
completes its three legs first, and refuses the other until the pair has been selected again.

## 10. What the approval authorised, and what the build did

The owner's approval of 2026-11-14 authorised **the ruleset and the build, and nothing else**: no registration, no task,
no terminal start, no order, no publication, no funding. The build is on branch `live-trading/l2l-blind-20261114`,
branched from `origin/main` with the reclaim commits cherry-picked, and this is what it changed — six pieces, and only
the second is new rule code:

1. **The side without a vote.** `buildPlan` stays the one place a reading is priced, and the vote never enters it any
   more: `blindPlan` asks it for both sides of each watched line and keeps whichever confirms. The opening `direction`
   gate is not reached, because the caller hands a direction it read from the closes rather than from Layer 1; every
   refusal below the gate — a wrong symbol, mixed-session bars, a first crossing, an excursion that never happened, the
   ladder's last line, a stop under one point — is the rule and still fires.
2. **The watch.** `watchPair` picks the nearest original rung below a price and the nearest above, filtering out the half
   grid's midpoints even if a caller hands them in. It is called at startup and at each of §4's re-selection events by
   `blindWatchPairs`, and its result is written into the lane's state file (`state.blind`) with the instant and the
   reason, so a restart reads the same pair rather than re-selecting around a new price. The four probes are restricted
   with a `watch` list, so only those two lines can arm; a completed three-leg reclaim at any other marked line states
   no ticket and the row names the pair in force.
3. **The lane's row** in `config/live-trading-lanes.json` (§2): `"blind": true`, magic `20261006`, the identity-file
   path, its own checkout root, snapshot and heartbeat paths, and `"enabled": false` until the account exists — an
   enabled lane with no snapshot refuses the whole publish, which is not a failure this row may cause while the
   account is unbought. `BLIND_MAGIC` is exported from `lib/l2l_strategy.js`, and `checkLaneCommandLine` holds a
   command line to the row: `--blind` on a called lane, or its absence on this one, is a refusal before the terminal is
   read.
4. **The flags.** `--blind` through `scripts/run-live-trading-trader.js` and `-Blind` through
   `scripts/register-live-trading-trader-task.ps1`, so the rule is set by the registration rather than by an operator
   remembering it. `--blind` implies `--require-deviation` rather than relying on it: with the three legs off the module
   reads the two newest closes alone, and a blind lane that did that would be *any two-close crossing* rather than *no
   vote but the full three legs*. It also refuses `--expire-minutes` and `--reentry-crossing`: the lane carries no timed
   expiry (§7) and re-arms through its own deviation after every exit, not through lane 2's two-candle gate.
5. **Tests** — `tests/live_trading_blind_lane.test.js`, thirteen readings: the pair and the midpoint exclusion; the buy
   and sell tickets; the wick, the close on the line and the first crossing; the unwatched-line refusal; the wide close
   that clears both lines; the pair as state across a restart and a rung leaving the marked set; the re-selection after
   an exit with a working limit left where it is; the two endings and the absence of any other; the fifth entry of a day
   on all three lanes, with the first four spread across assets; the no-cap default and every word for it; the lane's
   command-line refusals; and one armed end-to-end run that places the fifth entry and writes the pair down. The lane's
   own readings are the module's, so `tests/l2l_strategy.test.js` and `tests/live_trading_deviation_sequence.test.js`
   still hold the arithmetic underneath.
6. **The dashboard row** — a third name in the page's own lane list and a `blind` flag carried through the lanes
   publisher, so the strip can draw the account and say which rule it trades once the lane's heartbeat exists. The
   cap line now reads "no daily entry cap" from a `null`, with the day's count beside it, instead of turning a null into
   zero.

A ruleset is not a validation. Nothing on this page says the lane will make money; it says what the lane will do, so
that whatever it makes or loses can be read against one fixed answer. The backtest lane, the replay suite and a shadow
run are where that claim gets tested and none of them is authorised here.

Missing after the build, and each one a separate operation: the third login's account number and its private identity
file, a `data/l2l-levels.json` marked for the day it trades, and FTMO's own answer on a third account trading a
*different* rule. `BLIND_LANE_BUILD.md` holds the deployment, purchase and connection-test steps, and the staged
no-cap change for the two running traders is in `DAILY_CAP_REMOVAL_20261114.md` — neither is done by this branch.

## 11. What the approval settled, and what is left

The owner's approval of 2026-11-14 settled the five points the review had already reached and the three this page had
left open. Every one of them is now a decision rather than a proposal:

1. **The platform** (§2): a third FTMO MT5 login on the existing VPS, a separate account and terminal; the cTrader
   Challenge stays reserved for the separate copy-trading project.
2. **One fixed pair per instrument** (§1, §4): the nearest original line above and the nearest below, held while the
   lane waits, re-selected at startup and after every exit, cancellation or removed rung.
3. **The full three legs, with no vote** (§4): either watched line may arm either side, and the first qualifying
   deviation on an instrument sets its direction.
4. **The target is the next original L2L in the trade's direction** (§5), which for a reclaim of the nearer line is the
   other watched line and for the far line is the one past it.
5. **No timed expiry at all** (§7), with a limit leaving only on a target reached before entry or on its own line
   leaving the marked set.
6. **Open 1 — one close that arms both sides — cannot arise, and the tie-break is stated anyway.** A long reclaim needs
   the candle before the newest to have closed at or below the line, a short needs it at or above one; a single close
   cannot satisfy both for the two watched lines at once, so the case the page worried about does not exist under the
   three-leg rule. What *can* happen is one close clearing **both lines in one direction** — 1.125, then 1.095, then
   1.130 against rungs at 1.10 and 1.12 — and the build settles it by taking the nearer line, the last one price came
   back through, which is the same tie-break the two live lanes read. The test "a close wide enough to clear both
   watched lines enters at the nearer one" holds it.
7. **Open 2 — what spends a slot — is moot: there are no slots.** The owner removed the strategy-imposed daily entry
   limit on all three accounts on 2026-11-14. The three kinds of ledger row are still labelled, because they answer a
   different question — was this a new trade or the same one put back — but nothing refuses a ticket on a count.
8. **Open 3 — four a day or another number — is moot for the same reason.** Four remains the structural ceiling of
   *simultaneous* positions (one per instrument), not a daily limit. The count is printed in the heartbeat and the run
   record for reporting, and a configuration that states a number still works as a hand cap.

What is left is not a rule question. The lane is built and tested on a branch, and it cannot trade until a third FTMO
account exists, its own terminal is installed and signed in, its identity file is written, its checkout and task are
registered, and the connection test in `BLIND_LANE_BUILD.md` has been run and read. Nothing in this branch registers,
starts or funds anything.

## 12. What this page does not claim

No edge, no backtest, no live result: blind has never taken a trade anywhere, and every number above is arithmetic
on the published ladder. The cBot already written for this account has never placed one either — orders are
disabled by default, and its own README says account verification still needs a simulated fill in the target
environment. The rungs are from 2026-10-04 and will be re-marked. The minimum-lot risks are small
*because* the steps are wide and the lots are the smallest the instruments accept — not because the rule is safe: a
re-marked ladder that halves a step halves the stop and does not touch the frequency, and a gapped stop is a gapped
stop on a $10,000 account as on any other. And the comparison that gives this lane its reason to exist is confounded
by lot size, timing and the operator's own reactions; the only clean reading of it is the same four symbols, the same
ladder and the same fortnight against lane 1's own record — which is a reason to keep the two lanes' journals apart,
not a reason to expect a particular answer.
