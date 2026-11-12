# Lane 2, 11 Nov: the put-back priced at the lane's own multiple

The first day left one code finding. `scripts/run-live-trading-trader.js` priced every ticket put back at a
standing trade's level with `strategy.reentryPlan({ symbol, side, entry: trigger, levels, point })` - no
`rMultiple`, no `grid` - so the module's defaults answered for it: five to one on the *marked* ladder. Lane 2
trades the half grid at three to one. The seven fresh tickets of the day carried the lane's rule; the three
bitcoin put-backs carried `REWARD_R_MULTIPLE = 5` on the full ladder, which is the stop 73,511.518 the market
then hit twice.

This release passes the run's own two numbers through that path and changes nothing else.

## 1. What changed

| File | Change |
| --- | --- |
| `scripts/run-live-trading-trader.js` | `tradeCycles` and `tradeCycle` take `grid` and `rMultiple` (defaulting to `DEFAULT_GRID` / `DEFAULT_R_MULTIPLE`, which is what lane 1 passes by passing nothing) and hand them to `strategy.reentryPlan`. The level a trade was triggered on is now read off `strategy.gridLevels(instrument.levels, grid)`, so the target stated beside a standing trade is a line the lane would actually send. The run passes `options.grid` and `options.rMultiple`. |
| `lib/live_trading_performance.js` | `ticketKinds(trades, { rMultiple })` - which close opened on a fresh crossing and which put a standing trade back at its level, plus the multiple each ticket was built with, so a 5R ticket on a 3R lane is labelled rather than quietly counted. |
| `script.js` | The Closed trades table carries a **Kind** column (`fresh`, `put-back`, `put-back · 5R`) and states what the label and the measured multiple mean; the performance panel counts the same labels; both explain the balance-versus-sum difference; and the rule panel's heading and caption read the grid and multiple off the lane on screen (`Target (3R)` on FTMO 2) instead of typing five to one. |
| `styles.css`, `index.html` | The badge, and the cache-busting key moved to `20261111-lane2-ticket-kinds`. |
| `tests/live_trading_lane2.test.js` | Six new tests: a lane-2 put-back (long and short) priced on the half grid at three to one, the same two for lane 1 unchanged at five to one, the broker-rounded geometry against the real bitcoin ladder, and the spent-signal question. |
| `tests/live_trading_performance.test.js` | Five new tests, including the seven closes of the day frozen as a fixture and the committed lane-2 snapshot. |

Nothing about lane 1 changes: it passes neither `--grid` nor `--r-multiple`, the defaults are the numbers its
task has always run with, and the new tests assert the lane-1 put-back at `110` / `98` for a long and `100` / `112`
for a short.


## 2. The regression tests, and that they fail without the fix

`node --test tests/live_trading_lane2.test.js` - 12 of 12 pass. Reverting only
`scripts/run-live-trading-trader.js` and running it again leaves exactly the two lane-2 put-back tests red
("a lane-2 put-back is priced on the half grid at three to one..." and "a short put-back on lane 2..."), which is
the proof that they hold the path rather than the defaults.

They drive the actual runner (`trader.runOnce` with the stubbed order tool the file already uses), so what is
asserted is the command line the tool is handed: `--entry-price 100 --take-profit 105 --stop-loss 98.333333`
for a long put-back on the fixture ladder, `--entry-price 110 --take-profit 105 --stop-loss 111.666667` for a
short, with `reentry: true` and `r_multiple: 3` recorded on the row and in the state file.

## 3. The geometry, confirmed on the live ladder

The two marked bitcoin lines either side of the day's entry are 72,929.57 and 74,384.44; the half grid inserts
73,657.005 between them, which is the level all three put-backs went back to. `point` 0.01, `digits` 2 - the
symbol's own.

| Reading | Value |
| --- | --- |
| The next half-grid level past the entry (the target the broker is asked for) | **74,384.44** - a marked line, already on the broker's two digits |
| Reward to that target | 727.435 |
| One third of it (the lane's risk) | 242.4783 |
| The stop, at the broker's digits | **73,414.53** (73,414.526667 before rounding) |
| The stop the deployed build actually sent | 73,511.52 (73,511.518 - one fifth) |

`tests/live_trading_lane2.test.js` ("the broker-rounded target is the next half-grid level and the stop a third
of the reward distance") asserts the first four lines off `strategy.reentryPlan` and the last one off the same
call with no options, so the arithmetic of the fix and the arithmetic of the bug are both pinned.

**A precision note, not a change.** A midpoint can carry more decimals than the instrument quotes: 73,657.005 is
three decimals on a two-digit symbol, so the terminal rounds the *entry* by half a tick when it stores it (the
fills were 73,653.88, 73,655.21 and 73,653.00 - all below the level and inside the spread). The target and the
stop here are already expressible, which is why the geometry above is exact. Where a midpoint is not, the loop
still sends it and the broker rounds it; that is a property of a half grid on a graded ladder rather than of
this fix, and it is left alone until the owner states a policy.

## 4. The three bitcoin put-backs, audited against the candles

Bars: the M5 block of the published lane-2 snapshot (`data/live-trading.account2.json`, 576 bars,
07:30Z 9 Nov to 07:45Z 11 Nov). The run reads the newest bar that has *closed* at its start (bar close plus
90 s), so "qualifying" below is the newest bar closed at or before the placement and "previous" is the bar
before it. Re-run with `node tmp/audit-btc-putbacks.js` (local raw, not committed).

| Put-back | Placed (UTC) | Previous closed M5 (close) | Qualifying closed M5 (close) | Level | Crossing at the qualifying bar | Fresh crossing after the exit, before the placement |
| --- | --- | --- | --- | --- | --- | --- |
| 199472143 | 01:31 | 01:20 (73,485.26) | 01:25 (73,752.29) | 73,657.005 | yes, up | yes - 01:25, the first close above the level after the 01:02:21 stop |
| 199488169 | 02:46 | 02:35 (73,483.39) | 02:40 (73,713.12) | 73,657.005 | yes, up | yes - 02:40, the first close above it after the 02:06:19 stop |
| 199500177 | 04:31 | 04:20 (73,524.53) | 04:25 (73,650.31) | 73,657.005 | **no** - 73,650.31 is 6.7 under the level | **no** at the qualifying bar; the 04:30 bar closed 73,804.55 at 04:35Z, after the limit was already resting. That limit filled at 04:57:20 |

**The active call.** None of the three can have been placed against a call that had gone: the loop's own review
cancels a working limit and closes an open position on the first tick that reads a call which is not the trade's
own side, and the third trade was closed by that same review at 06:11:35Z on `BEARISH_LEAN`. So the bitcoin call
stood bullish from the first ticket (22:27Z on 10 Nov) until 06:11Z, and the state file's rows for the three
placements are the record of the call each was made under.

**The signal each put-back carries.** All three are priced from the *first* bitcoin ticket's own level
(73,657.005) with its own target (74,384.44), which is what makes them that one trade rather than three. Their
`signal_time_utc` - the M5 bar that opened that trade - lives in the state file's own row
(`placements[].signal_time_utc` in `C:\ftmo2\tmp\live-trading-trader-state.json` on the host) and is **not**
carried in the published snapshot, so it is reported as the original signal of the first ticket rather than
restated from a guess. Two of the three placements also had a fresh crossing of the level immediately before
them, so they would have been valid entries on the fresh path too; the third had none, which is exactly the case
the put-back path exists for.

**Was a spent signal reused? No, and the path that could have is guarded.** A put-back is deliberately not
stopped by the `symbol|signal_time_utc` spent-bar guard, because it is the same trade put back at its own level:
that exception is by design (section 46 of `STRATEGY_LIVE.md`) and is what let the pair be put back three times
on a day whose `--max-per-day 4` was already spent. What the audit confirms is the other half of the rule - a
trade that has *ended* is never put back at all, so a spent bar cannot become a second trade:

- `ended_by` is read before the ticket is priced (`tradeCycle`), and `decide` returns the plain reading for an
  ended cycle, so a finished trade offers no put-back.
- `tests/live_trading_lane2.test.js` ("a put-back is not blocked by the spent-signal guard, and an ended trade is
  never put back") holds both halves: the standing trade's own (spent) bar is put back while the trade stands and
  its `confirmation_time_utc` stays the original signal, and the same state with the account's record of the
  position closing at its take-profit yields `ended_by: "target-fill"` and no put-back row at all.

No lane-2 path was changed for this, because nothing was reused that the rule forbids.

## 5. Breakeven, recalculated from the trade's original geometry

The 2R rung is read off the risk the ticket was *placed* with (`placementRisk` reads the state row's own
`risk`), and the stop is then moved to the entry. Ticket 199472143 was placed with risk 145.487 (the 5R
arithmetic of the deployed build), so its 2R sat at 73,657.005 + 290.974 = **73,947.979** - which is the level the
01:56Z and 02:01Z reviews read and the reason they asked for the stop at the entry, 73,657.005. With the fix the
same ticket carries risk 242.478, so its 2R is 73,657.005 + 484.956 = **74,141.961**, and the trail's first step
(from 3R, 74,384.44 - the target itself) is not reached earlier than the target.

The movement credited towards 2R was the M5 high of 73,999.42, printed after the 01:55:07 fill: far enough for
the ticket's own (wrong) 2R, not far enough for the risk the lane had actually taken. Both readings are
consistent; the fault is the geometry the ticket was placed with, not the rung's arithmetic.


## 6. Tickets that carry the wrong geometry, reported separately

Every ticket below is **closed**: it is a record, not an order, so nothing was corrected and nothing could be.

| Ticket | State | Geometry | Note |
| --- | --- | --- | --- |
| 199472143 | closed -1.90 at its stop | stop 73,511.52, i.e. 5R | placed by the put-back path; recorded |
| 199488169 | closed -1.94 at its stop | stop 73,511.52, i.e. 5R | placed by the put-back path; recorded |
| 199500177 | closed +1.21 by the loop on the call change | stop 73,511.52, i.e. 5R | placed by the put-back path; recorded |
| 199453044 (EURUSD, open at 07:46Z; closed +2.05 at 08:16Z) | stop at breakeven 1.11677 | original risk 0.0007033, one third of its 0.00211 reward | correct - placed by the fresh path |
| 199521328 (US100.cash, working at 07:46Z; filled 08:03Z, stopped 08:34Z for -0.45) | sell limit 28,163.82, stop 28,209.62, target 28,026.41 | 137.41 / 45.80 = 3.00 | correct - placed by the fresh path |

No open position and no working order came through the put-back path, so there was nothing live to correct.
The dashboard now labels the three closed ones `put-back · 5R` on its Closed trades table, so the record says
what it was rather than being silently averaged into the lane's three-to-one rule.

## 7. The seven closes, reconciled to MT5, and the three cents

| Position | Pair | Opened | Closed | Profit | Commission | Swap | Net | Deals |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 199441238 | US100.cash | 20:56:36 | 00:46:07 | +1.39 | 0.00 | -0.07 | +1.32 | 2 |
| 199440753 | BTCUSD | 22:27:48 | 01:02:21 | -2.27 | -0.48 | 0.00 | -2.75 | 2 |
| 199442155 | XAUUSD | 23:05:00 | 01:34:15 | -10.74 | -0.06 | 0.00 | -10.80 | 2 |
| 199461331 | US100.cash | 00:51:35 | 01:40:55 | +1.37 | 0.00 | 0.00 | +1.37 | 2 |
| 199472143 | BTCUSD | 01:55:07 | 02:06:19 | -1.42 | -0.48 | 0.00 | -1.90 | 2 |
| 199488169 | BTCUSD | 02:51:28 | 04:19:18 | -1.46 | -0.48 | 0.00 | -1.94 | 2 |
| 199500177 | BTCUSD | 04:57:20 | 06:11:35 | +1.69 | -0.48 | 0.00 | +1.21 | 2 |

The seven are matched to the terminal's own history, not inferred from a balance move: each row is one position
paired from its `entry_deal` and `exit_deal` (`deal_count: 2`), read from `history_deals_get` over the snapshot's
14-day window. The net column adds to **-13.49**; the balance went 10,000.00 -> 9,986.48, a move of **-13.52**.
The three cents are rounding inside the rows - `profit`, `commission` and `swap` are each stated to two decimals,
so three of them cannot always add to a fourth, and the residue accumulates across seven positions. It is not a
missing trade: every close has both of its deals and every deal is inside the window. The dashboard's Closed
trades caption now states the same thing beside the balance it is reading.

**As the lane went on.** These seven are the closes the snapshot of 07:46Z carried. By 08:46Z the account had
closed two more under the same rule - the EURUSD short at 08:16Z for +2.05 after its breakeven stop, and the
US100.cash sell limit that filled at 08:03Z and stopped out at 08:34Z for -0.45 - so the snapshot the page now
draws reads nine closes and -11.89 USD. Nothing in the audit above changes with them: they are both fresh
tickets, and the three labelled put-backs are the same three.

## 8. Deploying it, lane 2 only

The release is a commit on `main`. The host runs lane 2 from `C:\ftmo2` and lane 1 from
`C:\trading-agent-dashboard-codex`, so only one checkout moves.

```powershell
# on the host, elevated
cd C:\ftmo2
git fetch origin --prune
git checkout --detach <release sha>
git status --short --untracked-files=no    # must be empty
# nothing to restart: the scheduled task runs `node scripts/run-live-trading-trader.js --once ...`
# every five minutes and reads the file on each tick
```

Checks after the first tick, in this order:

1. `C:\ftmo2\tmp\live-trading-trader-status.json` - `status` is a normal outcome (`nothing_to_place`,
   `placed`, ...), not `error`, and `code.checkout_head` names the new sha.
2. The published `data/live-trading-trader.ftmo-2.json` heartbeat carries the same `checkout_head`, so the
   hosted page is showing the build that ran.
3. The first put-back after the deploy: its row in `tmp/live-trading-trader.log` states `r_multiple: 3`, and the
   stop it sends is one third of the entry-to-target distance.

Lane 1 is not touched: its task, checkout, state file, magic and heartbeat stay where they are, and its own
`checkout_head` (`c5abd0ac` at the time of writing) must not change. Rollback is the same three commands with the
previous sha (`4d93757d`).

**Done later the same day, lane 2 only.** With the key at `.local\vps-access\id_ed25519` on the project workstation,
the three steps above were run against `C:\ftmo2` at 09:33Z-09:36Z, and the first tick on the new revision is in §10.
Lane 1's checkout (`C:\live-trading\runtime`) was read and not touched.

## 9. What is still the owner's

- Whether the 4-a-day cap and the 0.01 sizing stay as they are.
- Whether the 2R touch-and-return gap gets closed (a trade that touches 2R and comes back before the next tick
  stays on its original stop).
- Whether a midpoint that is not expressible at the broker's digits should be refused rather than rounded by the
  terminal.
- Whether the dashboard's heartbeat URL should carry a cache-busting key, since a published heartbeat can sit
  behind a cached copy for a few minutes.

**Answered on 2026-11-11 (see §11).** Lane 2's re-entry is called *a re-entry order at the same fixed level* in the
dashboard and in the notes it prints; lane 1 keeps its own rules, put-back and all; both ladders - the marked lines
and the half grid's midpoints - stay exactly as they are fixed. The four items above are still open.

## 10. The deploy, and the put-back it exposed

The release went on to the host at 09:33Z-09:36Z on 2026-11-11, lane 2 only. `C:\ftmo2` was fetched and detached at
`3a2e6566`, `git status --short --untracked-files=no` was empty afterwards, and the deployed
`scripts/run-live-trading-trader.js` is the commit's own blob - `git hash-object` reads `136fa60f…` in the worktree and
`git rev-parse HEAD:scripts/run-live-trading-trader.js` reads the same, sha256 `36540ed4…`. The one tracked file the
checkout had to give up was `data/live-trading.json`, this lane's regenerated feed snapshot: the producer rewrites it
at the head of every tick. A copy of it, of the state file, of the status file and of the run command was kept in
`C:\ftmo2\tmp\predeploy-20261111` first.

Nothing about the lane was moved: the run command, the magic `20261005`, the state path, the 0.01 sizing and
`--max-per-day 4` are the lines they were, and the terminal keeps whatever it holds. The lane had nothing open at the
switch (0 positions, 0 orders, 0 of ours).

The first tick on the new revision is what proves the switch: `2026-11-11T09:36:32.261Z`, `status: nothing_to_place`,
`armed: true`, `code.checkout_head: 3a2e6566`, `code.git_blob: 136fa60f…`, `strategy: {grid: half, r_multiple: 3,
magic: 20261005, identity_checked: true}`, `terminal: {positions_open: 0, orders_open: 0, ours: 0}`. Lane 1 was read
and not touched: `C:\live-trading\runtime` is still `c5abd0ac`, and its published heartbeat still reads
`nothing_to_place`, `armed: true`.

### The 04:31Z bitcoin put-back, answered against the broker

The owner asked one question about the third of the three flagged tickets: did it replace an unfilled order, or did
it open another position after an exit? It opened another position.

- The position before it, ticket `199488169`, filled at `02:51:28Z` at 73,655.21 from the limit placed at
  `02:46:34.145Z`, and **closed at its stop at `04:19:18Z`** at 73,509.51, `-1.46` (`-1.94` net).
- The new order, ticket `199500177`, was a buy limit at the level 73,657.005 **placed at `04:31:34.841Z`** - twelve
  minutes and seventeen seconds after that close - with the stop at 73,511.518, the target at 74,384.44 and
  `r_multiple: 5`; `TRADE_RETCODE_DONE`. It **filled at `04:57:20Z`** at 73,653.00 and closed at `06:11:35Z` at
  73,821.59, `+1.69` (`+1.21` net), on the call turning.
- The signal it was placed on is `signal_time_utc: 2026-11-10T20:45:00+00:00`: the bar that opened the trade eight
  hours earlier, carried on the ticket, not a new crossing.
- And no candle had re-crossed the level: the closed M5 candles after the stop-out closed at 73,477.59 (04:15),
  73,524.53 (04:20) and 73,650.31 (04:25), all under 73,657.005, and the 04:30 candle was 21 seconds old when the
  tick read it (73,650.32 to 73,660.37, still forming). The limit could rest only because the price was a few points
  above the level at that moment; nothing had *finished* beyond it.

So the ticket was not a replacement of something unfilled: the previous attempt had filled and been stopped out, and
what went back on was new exposure on a spent signal with no fresh crossing. That it made `+1.69` does not make it
right - the rule that put it there would have put it there whatever the candles did.

### What was wrong, and the correction

`scripts/run-live-trading-trader.js` said, in its own comment, that a put-back "is not read for a fresh crossing at
all", and `strategy.reentryPlan` was written to price a level without being handed a candle. That is half of the
permanence ruling. The other half is in the same comment four lines above it: the levels are "still active after a
stop is hit and **re-armed when a 5m candle deviates at them again**". The re-arming half was never implemented, so a
stopped-out level put a ticket back on the next tick regardless.

The correction, on lane 2 only, is a flag rather than a rewrite:

- `strategy.crossedSince({ side, level, bars, sinceMs, point, nowMs })` in `lib/l2l_strategy.js` - the same event the
  fresh path reads (a closed M5 candle finishing beyond the level by at least a point of the instrument's own grid),
  with the window moved to the instant the previous attempt ended. It names the candle it read, or says why it read
  none. A `null` instant is not the epoch: an unstated window reads nothing.
- `--reentry-crossing` in the runner, passed down to `tradeCycle`, which finds that instant from the account's own
  record - the close of the position the newest ticket produced - and asks the module before it states a ticket. With
  no crossing the row is a stated `skip` naming the wait, so the log says why rather than going quiet.
- The heartbeat's `strategy` block now carries `reentry: "crossed" | "level"`, so the page and the log can tell which
  rule ran without reading the task's command line.
- `scripts/register-live-trading-trader-task.ps1 -ReentryCrossing` writes the flag, so a re-registration cannot drop it
  silently. Lane 1 passes nothing and is unchanged: its put-back still goes back at the level whatever the candles are
  doing.
- Six tests. `tests/l2l_strategy.test.js`: a crossing only counts when the candle closed after the instant asked for;
  the margin is a point of the grid and a forming candle is not read; a short mirrors it and an unstated window reads
  nothing. `tests/live_trading_lane2.test.js`: the 04:31Z case as a rule (stopped-out position, no candle beyond the
  level, no ticket, a stated wait, `reentry: "crossed"` in the heartbeat); the same bars with a crossing, which puts
  the ticket back at three to one on the half grid; and the same stopped-out account with no flag, which puts it back
  with `reentry: "level"` - the difference between the two runs being the whole change.

The flag was then added to `C:\ftmo2\tmp\live-trading-trader-run.cmd` and the revision carrying this code deployed the
same way as §8, so the next tick states `reentry: "crossed"` in its heartbeat.

- The revision is `126f1674`. `git status --short --untracked-files=no` was empty at the switch, and
  `scripts/run-live-trading-trader.js` is the commit's own blob `cd5797fa…` - `git rev-parse
  HEAD:scripts/run-live-trading-trader.js`, `git hash-object` in the checkout and `git hash-object` on this
  workstation all read it, sha256 `de3902fc…`. The only tracked modification the checkout carries afterwards is
  `data/live-trading.json`, which the producer rewrites at the head of every tick.
- The command line the task runs now reads `--lane "ftmo-2" --grid half --r-multiple 3 --reentry-crossing --magic
  20261005 --expect-identity … --max-per-day 4 --terminal … --published …`: the same line as before plus the flag,
  with the previous copy of the file kept at `C:\ftmo2\tmp\predeploy-20261111\live-trading-trader-run.cmd.before-reentry-crossing`.
  The task is not restarted - it runs `cmd /c` on that file at every tick - and `-ReentryCrossing` writes the same
  flag if the task is ever registered again.
- The first tick on it is `2026-11-11T10:36:31.930Z`: `status: nothing_to_place`, `armed: true`, `checkout_head:
  126f1674`, `code.git_blob: cd5797fa…`, `strategy: {grid: half, r_multiple: 3, magic: 20261005,
  entries_paused: false, identity_checked: true, reentry: "crossed"}`, `terminal: {0 positions, 0 orders, 0 of ours}`,
  `caps: {max_per_day: 4, trade_day: 2026-11-11, …}`, and no placement, cancellation, close or stop move. The state
  file is byte-identical to the copy taken before the first deploy (sha256 `c4fcea62…`), which is the plainest
  statement that nothing about the lane's own record moved.
- Lane 1 again: `c5abd0ac`, published heartbeat `nothing_to_place`, `armed: true`, and no `reentry` field - it runs the
  build it was on and was not asked to read any of this.
- The lanes publisher carried it to the hosted page on its next cycle: `data/live-trading-trader.ftmo-2.json` at
  `10:46:32.108Z` reads `checkout_head: 126f1674`, `git_blob: cd5797fa…`, `sha256: de3902fc…`, `status:
  nothing_to_place`, `armed: true` and `strategy.reentry: "crossed"`, while `data/live-trading-trader.ftmo-1.json` at
  `10:46:30.018Z` still reads `c5abd0ac`, one position and one order of its own. The hosted page was read from
  `kevincreedycars-debug.github.io`, not from the checkout, so what the page shows is what was published.

A healthy `nothing_to_place` tick is all this proves, and it is all it needed to prove: the revision that ran, the rule
it ran under, the account it left alone. The first put-back under the new rule will state `r_multiple: 3` and, if no
candle has re-crossed the level since the exit, will not be a ticket at all - that row will read as a skip naming the
wait, and `trade.crossing` in the log line will carry the candle it read or the instant the window opened.

## 11. The owner's wording, and the lane he leaves alone

Two rulings came back on 2026-11-11 after the deploy. Neither changes a rule; one changes a word, and the other
confirms a lane is left as it is.

- **Lane 1 keeps its own rules.** No crossing gate, no wording change to its rule, nothing re-registered. Its
  checkout (`c5abd0ac`), task, state file, magic and heartbeat stay where they are.
- **Lane 2's ticket is called a re-entry order at the same fixed level** in the dashboard and in the notes the page
  prints. The word "put-back" leaves lane 2's page; it stays on lane 1's, because that lane's rule is unchanged.
  The three historical bitcoin tickets keep the label they were read under (`put-back · 5R`), which is the owner's
  earlier call and is now pinned by a test.
- **Both ladders stay fixed.** The original L2L lines are the same prices they were, and the midpoints are the same
  half-grid values: a re-entry goes back on the level the trade was triggered at, which does not move, and the
  target is still the next marked line (never a midpoint) at the lane's own 3 to 1.
- **The four facts to check on the next natural re-entry**: the previous exit time, the fresh M5 crossing time, the
  fixed entry level, and the entry, stop and target the order was actually sent with.

### What the page says now

`lib/live_trading_performance.js` takes the word from its caller - `ticketKinds(trades, { rMultiple, reentryLabel })`
- so the module holds no lane's vocabulary. `script.js` states it in one place,
`liveTradingReentryWording(view)`: lane 2 reads `re-entry · fixed level` in the Kind column and *re-entry orders at
the same fixed level* in the table caption and the performance note; lane 1 keeps `put-back` and *put a standing
trade back at the level it was triggered on*. `kind` stays `put-back` as the stable key a style or a test reads, and
a five-to-one ticket on a three-to-one lane keeps `put-back · 5R` whatever the lane calls its own re-entry.

### What the next natural re-entry will show

One row in `tmp/live-trading-trader.log` carries all four facts, because the loop writes them beside the decision:

| Fact | Where it is written |
| --- | --- |
| Previous exit (the instant the crossing window opens) | `rule.rows[].trade.last_exit_utc`, ISO to the millisecond |
| Fresh M5 crossing | `rule.rows[].trade.crossing.bar_time_utc` with `close`, `beyond_points` and `since_utc` beside it |
| Fixed entry level | `rule.rows[].trade.trigger_level`, and `placements[].level`, `placements[].entry` |
| Sent prices | `placements[].stop`, `placements[].target`, `placements[].r_multiple`, `placements[].order_ticket`, `placements[].placed_at_utc` |

`last_exit_utc` is new here: until now the instant travelled only inside `crossing.since_utc`, which is null on a
lane that does not ask for a crossing - so the row could state the crossing but not the exit it was measured from.
A trade whose newest ticket never filled states `last_exit_utc: null` rather than an invented instant, and asks the
candles nothing (`crossing: null`).

Three tests hold it: the label test in `tests/live_trading_performance.test.js` (lane 2's word, lane 1's word, and
the three `put-back · 5R` rows staying as they are), and two in `tests/live_trading_lane2.test.js` - one that reads
the four facts off a re-entry that was sent, and one that states `null` where there is no exit yet. `npm test` runs
869 tests with 4 failures, all of them the same pre-existing browser/DOM ones as before (the disabled-lane parked
tone test fails on the previous revision with these changes stashed).



### The deploy, and the re-entry it can now be checked against

The revision went on to `C:\ftmo2` at 20:55Z the same evening, lane 2 only, the same way as §8 and §10: fetched,
detached at `1858d675`, `git status --short --untracked-files=no` empty, and `scripts/run-live-trading-trader.js` is
the commit's own blob `b462c531…` - `git rev-parse HEAD:scripts/run-live-trading-trader.js` and `git hash-object` in
the checkout both read it, sha256 `fbcc0ca8…`. The state file is byte-identical before and after the switch
(`45ce889d…`): nothing about the lane's own record moved. The state, the status and the run command were copied to
`C:\ftmo2\tmp\predeploy-20261111\*.before-wording` first, and the run command is the line it was - `--grid half
--r-multiple 3 --reentry-crossing --max-per-day 4`, no flag added or removed, since this change needs none.

The first tick on it is `2026-11-11T20:56:32.273Z`: `nothing_to_place`, `armed: true`, `checkout_head: 1858d675`,
`strategy.reentry: "crossed"`, terminal 0 positions / 0 orders / 0 of ours, and every trade row now states
`last_exit_utc` - EURUSD `08:16:17Z`, XAUUSD `17:51:30Z`, US100 `09:29:35Z`, BTCUSD `06:11:35Z`. Lane 1 was read and
not touched: `c5abd0ac`, one position and two orders of its own, no `reentry` field on its heartbeat.

Two live rows are worth stating, because between them they are the check the owner asked for:

- **The 14:01Z XAUUSD re-entry, already sent under the fixed build.** Ticket `199640256`, placed at
  `14:01:35.317Z`: the previous exit was `01:34:15Z`, the candle that re-armed the level was the one closing
  `13:50:00Z` (4032.52, 77 points beyond the 4033.29 line), the fixed level is 4033.29, and the order as sent was
  entry 4033.29, stop 4045.203333, target 3997.55 - 11.913333 of risk for 35.74 of reward, exactly 3 to 1, with the
  signal it carried still the `2026-11-10T20:55:00Z` bar. That log line predates `last_exit_utc`, so its exit time was
  read from `crossing.since_utc`, which is the same instant.
- **US100 is waiting on the same machinery now.** Level 28163.82 (short, placed `09:16:35.240Z`, ticket `199558825`,
  exited at `09:29:35Z` at 28374.48), and the candle closing `14:50Z` read 28149.03, 1,479 points beyond the line, so
  the crossing it needs is already behind it. It is still a skip, and honestly so: the level sits on the far side of
  the market (28,373.03) for a short, where a sell limit would be a sell now, so the lane waits for price to trade
  back to 28,163.82. The four facts will be on that row the moment it does.

Two readers were left on this workstation for the next one, both of which read the log and place nothing:
`tmp/host/reentry-report.ps1` prints the newest re-entry's four facts (falling back to `crossing.since_utc` with a
note where the line predates `last_exit_utc`), and `tmp/host/verify-after-wording.ps1` prints the last tick's trade
rows with their decisions.


### The served page

The published `script.js` at `kevincreedycars-debug.github.io/trading-agent-dashboard` was read at 21:12Z and is
byte-for-byte `origin/main:script.js`: `git hash-object` on the downloaded file and `git rev-parse
origin/main:script.js` both read `50c2079f…`, 1,106,985 bytes. It carries `liveTradingReentryWording` and both lanes'
sentences - lane 2's `re-entry · fixed level` and *are re-entry orders at the same fixed level*, lane 1's *put a
standing trade back at the level it was triggered on* - so what a reader's browser runs is the ruling. The build that
served it was still the previous one when the commits went in at 20:53Z, so a page read inside that first hour after a
push can still show the old words; the reader is the served file, not the checkout.


## 12. The next morning: the same ticket going back, and the facts on the placement

The lane sent two more re-entries while nobody was watching. `2026-11-12T06:11:32.462Z`, one log line, status
`placed`: EURUSD short at 1.108345 (ticket `199851757`, stop 1.109047, target 1.10624, 2.9986 to one) and XAUUSD
short at 3997.55 (ticket `199851758`, stop 4009.463333, target 3961.81, exactly three to one). Both rows read
`trade.last_exit_utc: null` and `trade.crossing: null`, and those nulls are the truth rather than a gap: neither
level had been left. The trade at each level was still the pair's own, its ticket had come off the account without a
position ever closing, and the rule put the same level back. That is this lane's second kind of re-entry, and it is
not the 14:01Z XAUUSD one: there an exit came first and a candle re-armed the level, here nothing exited and nothing
had to be re-armed.

The line exposed where the four facts lived. They were only on `rule.rows[].trade`, so a reader who opened the
placement row - the row that actually sends the order - found the level and the three prices but had to look sideways
for the exit and the crossing. From `71680af8` the trader writes both on the placement itself, copied from the same
cycle and written as `null` rather than left out when the level never left. A placement row now states all four:
`last_exit_utc`, `crossing` (`bar_time_utc`, `close`, `beyond_points`, `since_utc`, `crossed`), `level` and `entry`,
and `stop`, `target`, `r_multiple`, `order_ticket`, `placed_at_utc`.

Lane 1 is untouched by it: the two fields are written only when `reentry` is set, and `tests/fixtures/lane1/run.golden.json`
still matches byte for byte. Two assertions hold the change - the lane-2 crossing test now reads the exit and the
candle off the placement, and the trader's put-back test states the two nulls - and `npm test` runs 869 tests with
859 passing and 6 failing. The 6 are stated rather than waved through: the 4 pre-existing ones (the disabled-lane
tone test, `research_library.browser.test.js`, and the two overview freshness tests) plus 2 in
`backtester/tests/site_nav_consistency.browser.test.js` that name `usd-layer1-backtester.html` as the page that no
longer matches the partial's render - run on its own, that file fails those same 2 of 5, and the page was changed by
`4c5222e8`, a research commit about DXY.cash that touches no part of this lane.

It went on to `C:\ftmo2` at 10:59Z, the same way as §8, §10 and §11: fetched, detached at `71680af8`,
`scripts/run-live-trading-trader.js` the commit's own blob (`7ebf3348…` from both `rev-parse` and `hash-object`, sha256
`025f5157…`), state byte-identical before and after (`b491cffc…`), the state, status and run command copied to
`C:\ftmo2\tmp\predeploy-20261112\*.before-placement-facts` first, and the run command the line it already was. The
first tick on it is `2026-11-12T11:01:31.775Z`: `nothing_to_place`, armed, `checkout_head: 71680af8`,
`strategy.reentry: "crossed"`, terminal 0 positions / 0 orders / 0 of ours. Lane 1 read and not touched: `c5abd0ac`,
no `reentry` field on its heartbeat.

What that leaves open is one row, and it is the lane's own:

- **BTCUSD 73,657.005 long** is the live re-entry candidate: exited `06:55:37Z`, its ticket off the account, market
  73,420.77 - the far side of the level for a long - so it is skipped until price trades back and a candle closes
  beyond the line. The four facts will be on that placement row the moment it does, exit and crossing included.
- **US100 28,163.82 is no longer waiting on price.** Price did come back under the line (28,139.83), but the call it
  was left for ended at `06:11:34Z`, and a level whose call has gone is not re-entered - so that trade's turn is over
  rather than deferred, and the §11 note about it waiting for 28,163.82 is superseded here.

`tmp/host/reentry-report.ps1` was updated to match: it reads the exit and the crossing off the placement first, falls
back to the trade row for lines written before this run, and prints *none: the trade at this level never left it* in
words where the fields are null, so a printed report cannot be mistaken for missing data. Read against the 06:11Z
line it prints exactly that for both symbols and then the level and the prices as sent. It has also grown past what
the workstation's base64 command channel will carry, so it now goes over with `scp` and runs with
`powershell -File C:\ftmo2\tmp\reentry-report.ps1` rather than as an `-EncodedCommand`.

