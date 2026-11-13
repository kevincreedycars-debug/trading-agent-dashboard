# The deviation sequence, both deployed traders, and the reclaim branch

The owner's sentence of 2026-11-13, in his own terms: at a fixed level of 100, `102 -> 99 -> 98 -> 101` must
leave one buy limit at 100, and `99 -> 98 -> 101` with no earlier evidence of price above 100 in that session must
leave no order at all; the bearish case is the mirror; several closes may finish beyond the level before the
reclaim; a wick, a close on the line, a return across a different level and a replay of the same confirming candle
must each leave nothing.

This note records what the two **deployed** loops decide on those cases, what the account's own record says about
lane 1's 40 repeat placements, what the reclaim fix that already existed in `origin/main` passes, and what the
review branch adds. It is read-only evidence plus one unmerged branch. Nothing was placed, changed, cancelled or
deployed on either machine.

## 1. What was audited, and how the bytes were proved

Read over ssh on the host, read-only, at `2026-11-13T18:45:58Z`. No fetch, no task touched, no file written.

| Lane | Checkout | HEAD | Trader on disk | Strategy module | Heartbeat |
| --- | --- | --- | --- | --- | --- |
| ftmo-1 (`***614`) | `C:\live-trading\runtime` | `c5abd0ac` | blob `f43ac5ea` (`41028adc`'s file, **not** HEAD's `164eb0d4`), sha256 `B6422A72…` | blob `338bb2f6`, sha256 `52C3FBC9…`, no `crossedSince` | `18:41:30Z`, `armed: true`, `nothing_to_place` |
| ftmo-2 (`***841`) | `C:\ftmo2` | `f14f2ac7` | blob `7c3538e0`, sha256 `36FDD6FE…` - the same file `origin/main` carries | blob `e0e64c2b`, sha256 `416DBB58…` - the same file `origin/main` carries | `18:41:32Z`, `armed: true`, `nothing_to_place` |

The two lanes' command lines, as their scheduled tasks run them:

- lane 1: `--once --align --settle-seconds 90 --confirm-live --lane ftmo-1 --max-per-day 4` and nothing about the
  candles on a put-back;
- lane 2: `--once --confirm-live --lane ftmo-2 --grid half --r-multiple 3 --reentry-crossing --magic 20261005
  --expect-identity … --max-per-day 4`.

Evidence: `tmp/host/lane1/` and `tmp/host/lane2/` are two checkout-shaped trees, each built from its lane's own
commit (`scripts/`, `lib/`, `config/`) with the four deployed files overwritten by the blobs the host reports.
`tmp/extract-deployed.js` re-hashes each of the four with CRLF line endings - the way the host checks the file out -
and prints the host's own value beside it: all four match. The harness then `require`s the deployed trader, which
loads the deployed module beside it, so what is run is the deployed decision path and not a re-implementation.

**A deployment-integrity finding, separate from the rule.** Lane 1's checkout is not at the revision it says it is:
`git status` reports `M scripts/run-live-trading-trader.js` and the working file is `41028adc`'s (a commit on the
lane-2 branch that added grid/multiple/pause support to the trader), while `HEAD` is `c5abd0ac`. It also reports
`M data/live-trading.json` and two untracked scripts
(`scripts/register-orchestrator-refresh-task.ps1`, `scripts/trigger-orchestrator-refresh.ps1`). So lane 1 runs a
newer trader than its pin, with an older module that has no `crossedSince` at all - which is why the put-back
arithmetic lane 2 fixes on 2026-11-11 could not have reached lane 1 by configuration alone.

## 2. The cases, run through each deployed loop

`tools/audit/l2l_deviation_audit.js` states the ladder, the closes, the call and the clock, and runs
`trader.runOnce` with the lane's own flags and a stubbed order tool; the recorded fact is the ticket the loop
passed to the tool (side, entry, stop, target) or its refusal. Each case is run twice: once as a fresh entry (no
state), and once with a standing trade at 100 that was stopped out inside the same run of closes, which is the
post-exit re-entry path.

Before, as deployed - `ftmo-1` **12 of 18** cases as the owner states them, `ftmo-2` **14 of 18**:

| Deviation | ftmo-1 | ftmo-2 |
| --- | --- | --- |
| `99, 98, 101` (first approach from below) leaves a buy limit at 100 | yes, both paths | yes, both paths |
| `101, 102, 99` (the mirror) leaves a sell limit at 100 | yes, both paths | yes, both paths |
| a close exactly on 100 leaves a put-back at 100 after an exit | yes | no |
| the same confirming bar, run twice, leaves a second ticket | yes | no |

Everything else already passes on both: the reclaim is one limit, several closes beyond it are still one crossing,
a wick leaves nothing, a close on the line leaves nothing on the fresh path, and a close across 110 puts the ticket
at 110 and never at 100.

The four misses are one rule and one guard. The rule: neither loop asks whether the level had been left before the
close came back across it, so a first approach is read as a reclaim. The guard: lane 1's put-back path reads no
candle at all, so on that path even a close exactly on the line, or the confirming bar that has already left a
ticket, authorises another.


## 3. The reclaim fix that already existed, reviewed before writing another

`origin/main` already carries the correction lane 2 was given on 2026-11-11 and tightened on 2026-11-12:

- `strategy.crossedSince` (`126f1674`, hardened by `f14f2ac7`): the newest two completed M5 candles must straddle
  the level, the newest must finish at least one point beyond it, and it must *close* after the window opens - the
  window being the later of the exit that ended the previous attempt and the seal of the call now published;
- the trader's own guard that a confirming bar authorises one ticket per pair, so a re-entry writes its bar down as
  spent and the next run cannot place the same bar again;
- the fresh path's half of the ruling: on a lane that asks for the gate, a confirming candle that closed before the
  call's seal is the previous call's crossing and waits.

Run against the owner's cases, that fix already answers fourteen of the eighteen per lane. It refuses the wick, the
close on the line, the replay of the same bar and a return across 110 at 100; it states a reclaim once and only
once across several closes beyond; and its refusals name the two closes they were read from. The four it does not
answer are the first-approach pairs, because it asks only whether the newest pair straddles the level, never
whether the level had been left before.

So the fix is reused whole: `crossedSince` and the two-close gate are untouched by this branch, and lane 1 gains
them by naming `--reentry-crossing` on a command line whose code already supports it (in `origin/main`; lane 1's
deployed trader predates it).

## 4. What the review branch adds

`live-trading/deviation-audit-20261113`, cut from `origin/main` `e53d1888`. One rule, in one helper, used by both
paths:

| File | Change |
| --- | --- |
| `lib/l2l_strategy.js` | `levelWasLeft({ side, level, bars, beforeIndex, point, minBreakPoints })`: the last close strictly beyond the level, at the same one-point margin the crossing needs, among the candles before the one being judged. `buildPlan` and `crossedSince` each consult it when `requireDeviation` is set, and refuse with their own sentence when the level was never left. Threaded through `strategyReadings`. |
| `scripts/run-live-trading-trader.js` | `--require-deviation`, off unless named, passed to the fresh readings and to the put-back gate; the heartbeat states `strategy.require_deviation` beside `strategy.reentry`. |
| `tests/live_trading_deviation_sequence.test.js` | 39 tests: the owner's eight cases and the replay, each on both lanes and both paths, through `runOnce` and the stubbed tool; the two flags-off cases that state the deployed behaviour; and the helper's own boundary cases (wick, close on the line, the mirror, `beforeIndex`). |
| `tools/audit/l2l_deviation_audit.js` | The harness that produced both columns below. `--repo` runs this checkout's trader and module with the branch's flags; with no argument it runs the bytes on the host. |

Why a flag rather than a new default: the rule narrows a live rule on two funded accounts, and the owner's review is
the gate on deploying it. With neither lane naming `--require-deviation`, every deployed behaviour above is
unchanged - the 106 existing trader, lane-2 and baseline tests pass untouched - and the difference is one command
line per lane, which is what a reviewer needs to see.


## 5. Before and after, both accounts

"Before" is the deployed tree for each lane; "after" is this checkout's `scripts/` and `lib/` with lane 1 naming
`--reentry-crossing --require-deviation` and lane 2 naming `--require-deviation`. `not@100` means the owner's
sentence is about the level: the ticket placed before sat at 110, which is a different line and satisfies it, and
after the change nothing is placed at all.

| lane | path | case | owner says | before (deployed) | after (branch + flags) | before | after |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ftmo-1 | fresh entry | bull reclaim: 102, 99, 98, 101 | long@100 | long@100 | long@100 | ok | ok |
| ftmo-1 | post-exit re-entry | bull reclaim: 102, 99, 98, 101 | long@100 | long@100 | long@100 | ok | ok |
| ftmo-1 | fresh entry | bull reclaim, several closes beyond: 102, 103, 99, 98, 101 | long@100 | long@100 | long@100 | ok | ok |
| ftmo-1 | post-exit re-entry | bull reclaim, several closes beyond: 102, 103, 99, 98, 101 | long@100 | long@100 | long@100 | ok | ok |
| ftmo-1 | fresh entry | bull, first approach from below: 99, 98, 101 | none | long@100 | no order | MISS | ok |
| ftmo-1 | post-exit re-entry | bull, first approach from below: 99, 98, 101 | none | long@100 | no order | MISS | ok |
| ftmo-1 | fresh entry | bear reclaim: 98, 101, 102, 99 | short@100 | short@100 | short@100 | ok | ok |
| ftmo-1 | post-exit re-entry | bear reclaim: 98, 101, 102, 99 | short@100 | short@100 | short@100 | ok | ok |
| ftmo-1 | fresh entry | bear, first approach from above: 101, 102, 99 | none | short@100 | no order | MISS | ok |
| ftmo-1 | post-exit re-entry | bear, first approach from above: 101, 102, 99 | none | short@100 | no order | MISS | ok |
| ftmo-1 | fresh entry | wick only: 102, 99, 98, high 101.5 closing 99.4 | none | no order | no order | ok | ok |
| ftmo-1 | post-exit re-entry | wick only: 102, 99, 98, high 101.5 closing 99.4 | none | no order | no order | ok | ok |
| ftmo-1 | fresh entry | close on the line: 102, 99, 98, 100 | none | no order | no order | ok | ok |
| ftmo-1 | post-exit re-entry | close on the line: 102, 99, 98, 100 | none | long@100 | no order | MISS | ok |
| ftmo-1 | fresh entry | return across a different level: 102, 99, 98, 111 | not@100 | long@110 | no order | ok | ok |
| ftmo-1 | post-exit re-entry | return across a different level: 102, 99, 98, 111 | not@100 | long@110 | no order | ok | ok |
| ftmo-1 | fresh entry | replay of the confirming candle: 102, 99, 98, 101, then the same bar | long@100 | long@100 | long@100 | ok | ok |
| ftmo-1 | replay of the same bar | replay of the confirming candle: 102, 99, 98, 101, then the same bar | none | long@100 | no order | MISS | ok |

The tests hold the path rather than describing it: with `lib/l2l_strategy.js` reverted to `origin/main` and nothing
| ftmo-2 | fresh entry | bull reclaim: 102, 99, 98, 101 | long@100 | long@100 | long@100 | ok | ok |
| ftmo-2 | post-exit re-entry | bull reclaim: 102, 99, 98, 101 | long@100 | long@100 | long@100 | ok | ok |
| ftmo-2 | fresh entry | bull reclaim, several closes beyond: 102, 103, 99, 98, 101 | long@100 | long@100 | long@100 | ok | ok |
| ftmo-2 | post-exit re-entry | bull reclaim, several closes beyond: 102, 103, 99, 98, 101 | long@100 | long@100 | long@100 | ok | ok |
| ftmo-2 | fresh entry | bull, first approach from below: 99, 98, 101 | none | long@100 | no order | MISS | ok |
| ftmo-2 | post-exit re-entry | bull, first approach from below: 99, 98, 101 | none | long@100 | no order | MISS | ok |
| ftmo-2 | fresh entry | bear reclaim: 98, 101, 102, 99 | short@100 | short@100 | short@100 | ok | ok |
| ftmo-2 | post-exit re-entry | bear reclaim: 98, 101, 102, 99 | short@100 | short@100 | short@100 | ok | ok |
| ftmo-2 | fresh entry | bear, first approach from above: 101, 102, 99 | none | short@100 | no order | MISS | ok |
| ftmo-2 | post-exit re-entry | bear, first approach from above: 101, 102, 99 | none | short@100 | no order | MISS | ok |
| ftmo-2 | fresh entry | wick only: 102, 99, 98, high 101.5 closing 99.4 | none | no order | no order | ok | ok |
| ftmo-2 | post-exit re-entry | wick only: 102, 99, 98, high 101.5 closing 99.4 | none | no order | no order | ok | ok |
| ftmo-2 | fresh entry | close on the line: 102, 99, 98, 100 | none | no order | no order | ok | ok |
| ftmo-2 | post-exit re-entry | close on the line: 102, 99, 98, 100 | none | no order | no order | ok | ok |
| ftmo-2 | fresh entry | return across a different level: 102, 99, 98, 111 | not@100 | long@110 | no order | ok | ok |
| ftmo-2 | post-exit re-entry | return across a different level: 102, 99, 98, 111 | not@100 | long@110 | no order | ok | ok |
| ftmo-2 | fresh entry | replay of the confirming candle: 102, 99, 98, 101, then the same bar | long@100 | long@100 | long@100 | ok | ok |
| ftmo-2 | replay of the same bar | replay of the confirming candle: 102, 99, 98, 101, then the same bar | none | no order | no order | ok | ok |

Totals: ftmo-1 12/18 before and 18/18 after; ftmo-2 14/18 before and 18/18 after. The raw rows are in
`tmp/deviation-audit.json` and `tmp/deviation-audit-after.json` (ignored), both written by the committed harness.

else changed, **24 of 39 pass and 15 fail**; with the branch restored, **39 of 39 pass**.


## 6. Lane 1's 40 repeat placements, reconciled against the account

Method, all read-only: the loop's own state (`C:\live-trading\runtime\tmp\live-trading-trader-state.json`, pulled
as base64 and analysed locally) against the account's own record, which is the published snapshot's
`closed_trades` - one row per position paired out of `history_deals_get` over a 14-day window
(`2026-10-30T18:20Z` to `2026-11-13T18:20Z`, 58 closed positions) plus the working `orders` and `positions` blocks.
A pending order that fills becomes a position carrying the order's own ticket, so a placement whose `order_ticket`
is a `position_id` in that record filled and then exited; one in neither record never filled.

State as pulled: 79 placement rows, 68 of them placed tickets and 11 refused attempts; 43 carry the re-entry flag
and **40** of those went out - the count the owner named. By symbol: EURUSD 16, US100.cash 11, BTCUSD 9, XAUUSD 4.

| What the history says about the ticket the repeat replaced | Count |
| --- | --- |
| the previous ticket filled and its position closed, so the repeat is new exposure after an exit | 38 |
| the previous ticket was a limit withdrawn unfilled, so the repeat is a replacement of it | 1 |
| the history cannot say what became of the previous ticket | 1 |

- **The withdrawn limit.** EURUSD 1.11045: ticket `307022408` was cancelled at `2026-11-12T06:06:33Z` with the
  tool's `TRADE_RETCODE_DONE` because the call it was left for had ended ("Layer 1 now reads no direction for
  EUR"), no deal exists for it, and `307216030` went out at `06:11:33Z` on the same level five minutes later. That
  is the pair named on 2026-11-12, and it is a replacement rather than exposure.
- **The case the history cannot resolve.** XAUUSD 4069.03: ticket `306701928` went out at
  `2026-11-10T13:36:34Z` (the tool answered done), no deal exists for it, no cancellation row exists for it in the
  state or in the order tool's journal, and it is neither working nor open now. Five minutes later the loop put
  `306705634` at the same price - a second sell limit at the level, which was itself cancelled later. The account's
  record cannot say whether the first ticket was cancelled by the terminal, expired, or was working beside the
  second one for a while; that is a gap in the evidence, not a reading of it.
- **The bar every one of the 40 re-used.** Each repeat row carries the *same* `signal_time_utc` as the placement it
  replaced: the put-back path copies the trade's own signal bar rather than reading a candle, so from the state's
  point of view one confirming bar authorised forty further tickets. The owner's "a replay of the same confirming
  candle must not trigger an order" is therefore not a hypothetical on lane 1: it is the shape of all 40.

Script: `tmp/reconcile-lane1.js`; rows in `tmp/reconcile-lane1.json` (both ignored).

## 7. One disputed signal, read end to end

EURUSD, 2026-11-13, the level `1.10624` on the marked ladder (next line down `1.10203`), call **BEARISH** sealed
`06:04:51Z`. The two tickets at that level are the day's disputed pair.

| What | Value |
| --- | --- |
| confirming bar | `06:40`, close `1.10620` - 4 points below the level, the bar before it at `1.10650` above it |
| first ticket | `307581095`, placed `07:36:32Z`, filled `07:39:41Z` at `1.10624` |
| its exit | `13:30:07Z` at `1.10629` for `-0.11` - the stop, by the account's own record |
| repeat ticket | `307675896`, placed `13:46:33Z` at `1.10624` on the same `06:40` bar, still working at `18:20Z` |

The M5 closes around the exit, from the `13:40Z` and `14:00Z` published snapshots:

| bar | close | note |
| --- | --- | --- |
| `13:25` | `1.10564` | below the level |
| `13:30` | `1.10677` | above it - the bar the position was stopped in |
| `13:35` | `1.10621` | below it by 3 points; the crossing candle, closed at `13:40:00Z`, after the exit |
| `13:40` | `1.10604` | below it by 20 points; the newest completed candle when the `13:46` run read the feed |
| `13:45` | `1.10571` | below it; closed at `13:50:00Z`, after the ticket had gone |

Three readings, all defensible, which is why it is disputed:

1. **Lane 1, as deployed, places.** Its put-back path reads no candle; the trade is the pair's own and the level is
   put back. This is the behaviour the owner's sentence rules out.
2. **Lane 2's gate refuses.** `crossedSince` asks the newest *pair* to straddle the level, and at `13:46` the newest
   two closes (`13:35` and `13:40`) were both below it. The crossing that did happen - `13:30` above, `13:35`
   below, closed at `13:40:00Z` after the exit - had been overtaken one bar later.
3. **The owner's sequence, with this branch's rule, would also refuse** - for the gate's reason rather than the
   deviation's. The level had been left (`13:15`-`13:25` below, `13:30` above), so the deviation test would pass;
   but the confirming pair is required to straddle, so the gate never reaches the deviation test.

So the branch removes the wrong put-back on this pair, but for a reason the owner may not intend: a genuine reclaim
of the level after the exit is refused because it is no longer the newest event. Whether a crossing that happened
after the exit and has since been overtaken should still count is a ruling, not a bug, and it is not made here.

## 8. The FTMO 2 mismatch, flagged separately

Lane 2 is not simply "lane 1 plus a fix". Two differences matter to this audit:

- **The newest-pair requirement** above: the `13:46` EURUSD reclaim is refused by lane 2 and was placed by lane 1.
  If the owner wants "any qualifying crossing since the exit", both lanes need a window test rather than a
  newest-pair test; if he wants "the crossing must still stand", lane 1 must gain that same test. The branch leaves
  lane 2's rule exactly as it is and applies the same rule to lane 1's put-backs through `--reentry-crossing`.
- **The half grid.** Lane 2 enters on midpoints as well as marked lines, and the deviation test is applied on the
  grid the lane trades, so a midpoint is a level in its own right. That is consistent with lane 2's own trigger,
  but it means lane 2 can refuse a midpoint reclaim that lane 1 never considers - a difference in the population of
  levels, not in the rule.

Nothing else about lane 2 changes on this branch: no config, no command line, no deployment.

## 9. What ships, and what does not

Not deployed, on purpose, pending the owner's review:

- `live-trading/deviation-audit-20261113` (branch, pushed) with the module, the trader flag and the tests above;
- the command lines that would use it - lane 1: `--reentry-crossing --require-deviation` (and the trader and module
  that support them, which lane 1 does not have on disk); lane 2: `--require-deviation` only;
- nothing touched on `C:\live-trading\runtime` or `C:\ftmo2`: no workflow, no order, no data file, no publisher.

Two things to see before either lane is changed:

1. **Lane 1's checkout is not at its pin** (`M scripts/run-live-trading-trader.js`, working file from `41028adc`,
   `HEAD` `c5abd0ac`, plus a modified `data/live-trading.json` and two untracked scripts). Any lane-1 deployment
   needs a clean, pinned checkout first, or the next `git pull` moves code under a funded loop.
2. **The 40 put-backs are the evidence, not the theory.** 38 followed an exit, one replaced a withdrawn limit, one
   cannot be resolved from the record; all 40 re-used the predecessor's confirming bar. If the branch is accepted,
   that is the population the change is measured against, and the same reconciliation can be re-run from
   `tmp/reconcile-lane1.js` after it ships.

