# Blind lane: the stop ending deployed to FTMO 3 (2026-11-19)

Follows [BLIND_LANE_STOP_OUT_20261119.md](BLIND_LANE_STOP_OUT_20261119.md), which diagnosed the zombie trade
and wrote the fix and its tests. This page is the deployment record: what the host was running, what was
replaced, what the first two ticks on the new build did, and what is still unproved. The ruleset the lane
obeys is [LIVE_L2L_BLIND_RULESET.md](LIVE_L2L_BLIND_RULESET.md) §7.4.

## 1. What the host was running, read at 16:48Z

| Reading | Value |
| --- | --- |
| checkout | `C:\ftmo3`, branch `live-trading/l2l-blind-20261114`, HEAD `d434fabe` |
| trader file | 206,860 B, mtime `2026-11-14T19:02:52Z`, blob `e3bc8fe8`, sha256 `A4789872...0249EF1` |
| heartbeat `code` block | sha256 `a4789872...`, blob `e3bc8fe8`, `checkout_head d434fabe` - the file and the record agreed |
| account / terminal | `***584` on `FTMO-Server3`, `positions_open 0`, `orders_open 0`, `ours 0` |
| tasks | `LiveTradingTraderTick-ftmo3` Ready, every 5 min, `MultipleInstances=IgnoreNew`; `LiveTradingLane-ftmo3` (feed) likewise |
| dirty tree | one file, `data/live-trading.json` - the lane's own feed output |

The 16:56:30Z record is the defect in the lane's own words, on the account, minutes before the deploy:

| Pair | the record's trade row | the pair's lines |
| --- | --- | --- |
| EURUSD | ticket `200695485`, `ended=false`, `ended_by=null`, `resting=false`, exit `2026-11-16T09:35:59Z` | 1.09782 / 1.10203 |
| XAUUSD | ticket `201323839`, `ended=false`, `ended_by=null`, `resting=false`, exit `2026-11-18T00:12:27Z` | 3640.15 / 3711.63 |
| US100.cash | ticket `200695492`, `ended=false`, `ended_by=null`, `resting=false`, exit `2026-11-16T09:06:14Z` | 27751.59 above, none below |

All three rows were `decision=skip` with "has not been crossed afresh since <the stop>", i.e. three finished
trades were still standing on levels the market had left. Nothing was open at the broker: the account was
flat with no working orders.

## 2. The deploy

1. `5630be69` and `441c308f` were pushed as a fast-forward of the lane's own branch
   (`d434fabe..441c308f`); the host was not edited by hand.
2. A gate held until a gap with no lane-3 trader process, no lock and a record at least 10 s old: found
   after 126 s (a tick's process lives about 2 m 15 s before it writes, so the window is real but short).
3. Rollback copy taken **before** the fetch: `C:\ftmo3\tmp\rollback\run-live-trading-trader.js.20261119T165435Z`
   plus a `.txt` with the HEAD, blob and sha256 it was taken from (sha256 `A4789872...0249EF1`, 206,860 B).
4. `git fetch origin live-trading/l2l-blind-20261114` then `git merge --ff-only FETCH_HEAD`: fast-forward,
   five files (the trader, its new test, three documents), `merge_exit 0`.
5. Verification on the host: HEAD `441c308f`, file sha256 `46020D67...A4F306A`, blob `3c6e2d34`, 213,670 B,
   `node --check` exit 0, `git status` still only ` M data/live-trading.json`. The local and host hashes are
   equal, so what runs is what was tested.

The lane's keys and identity, the feed task, the publisher, the watchdog, lanes 1 and 2 and every other
host file were not touched. No task was re-registered, so nothing had to be re-armed. This page itself was
committed afterwards as `02d051a2` on the same branch, documents only, so the host now sits one docs-only
commit behind the branch tip and will pick it up on its next pull without the trader file changing.

## 3. First tick on the new build, 17:01:30Z

Heartbeat: `code.sha256 46020d67...`, `code.checkout_head 441c308f`, `armed true`, `duration_seconds 2.81`.
The three finished trades read as finished:

| Pair | `ended` / `ended_by` | where the row now sits |
| --- | --- | --- |
| EURUSD | `true` / `stop-fill` | watching 1.09782 and 1.10203, no side set |
| XAUUSD | `true` / `stop-fill` | watching 3640.15 and 3711.63, no side set |
| US100.cash | `true` / `stop-fill` | watching 27751.59, no side set |

`placements (none)`, `entries_today 0`, `open_tickets 0`. Nothing was put back at an old level, and the
window each row is measured from is the account's own exit (`last_exit_utc` unchanged: 16 Nov 09:35:59,
18 Nov 00:12:27, 16 Nov 09:06:14) - the ending re-arms the pair, it does not replay the deviation that the
zombie had swallowed.

## 4. Second tick, 17:06:30Z: the pair took its first fresh setup

This is the behaviour the fix was for. `status: placed`, `duration_seconds 3.84`, one placement:

| Field | Value |
| --- | --- |
| pair and side | EURUSD short, `event: fresh-entry` |
| line | 1.09782 - the pair's current lower line, not the zombie's 1.10203 |
| stop / target / risk | 1.098662 (one fifth of the distance) / 1.09361 (the next marked line) / 0.000842 |
| ticket | `202041840`, `TRADE_RETCODE_DONE`, placed `2026-11-19T17:06:33.841Z` |
| the reason | "EURUSD closed below 1.09782 on the newest M5 candle" - today's candle, not a stored one |

XAUUSD and US100.cash stayed `waiting` on their current lines and BTCUSD stayed `waiting`; no second ticket
was placed for any of them. The entry is a limit at the line, so the fill and the rungs are the ordinary
management path, which this change does not touch. By 17:46:30Z that ticket had filled: the record reads
`positions_open 1`, `orders_open 0`, `ours 1` (`202041840`, EURUSD), `open_tickets 1`, `taken_today 1`, and
the EURUSD row carries the live attempt (`short`, level 1.09782, target 1.09361, `ended=false`) with
`stage=blocked` for the put-back path - "EURUSD waits rather than putting a ticket back at 1.09782" - so no
duplicate limit is placed on a line that already has a position. The other three pairs kept watching the
lines the stop ending re-armed, and no pair replayed a stored deviation.

## 5. Duplicate runners and cadence

- Both lane-3 tasks carry `MultipleInstances=IgnoreNew`, so the scheduler cannot start a second copy while
  one runs; the trader also holds `--lock C:\ftmo3\tmp\live-trading-trader.lock`, and the lock file was
  absent at every check outside a run.
- Samples at 16:52-16:54 read `trader_procs=0` for 24 checks; the counts of 1 and then 2 that the deploy gate saw
  at 16:54:36-16:55:00 were lane 2's and then lane 3's tick starting, because that filter also matched
  `C:\ftmo2\scripts\run-live-trading-trader.js`. After the deploy the lane-3-filtered samples at 17:03:10-17:03:26
  read `lane3_trader=0`, `node_total=2` (the two feed processes of lanes 1 and 2). The duplicate check is the
  scheduler's `IgnoreNew` plus the lock, not the process count.
- The log holds one record per 5 minutes with no repeated instant: 16:31:30, 16:36:30, 16:41:30, 16:46:30,
  16:51:30, 16:56:30, 17:01:30, 17:06:30 (1,118 records in the file). The deploy cost no tick.


## 6. The test totals, itemised

The full suite was 966 tests. They split as **955 pass, 7 fail, 0 cancelled, 4 skipped, 0 todo**;
955 + 7 + 4 = 966, so nothing is unaccounted for. The four skips and the seven failures are listed here
by name because they are the part that a pass count cannot show.

**Skipped (4).** All four are the confidence-calibration checker tests in one file, skipped for one stated
reason: "the checker corpora are frozen off the published tree; `npm run checker:corpus` fetches them into
`.local/checker-corpus`". They read no live code and no lane.

| # | test |
| --- | --- |
| 21 | confidence calibration artifact uses the exact ten-point buckets for pooled Layer 1 and Layer 2 |
| 22 | confidence calibration artifact preserves verified production definitions |
| 23 | confidence calibration artifact exposes monotonic and reliability diagnostics |
| 24 | confidence calibration artifact exposes explicit lean-direction mapping |

**Failed (7), none of them this change.**

| # | test | why it fails |
| --- | --- | --- |
| 76 | every page carries the partial's render byte for byte, in the page's own line endings (`backtester/tests/site_nav_consistency.browser.test.js:122`) | `--check must find all thirteen pages current`: the served pages on this tree predate the nav partial |
| 78 | all thirteen served pages show one bar and one rail, and every link it offers goes somewhere | same page set, same cause |
| 255 | the walkthrough states the rule's own numbers, and the module, the loop and the script still hold them (`tests/live_trade_logic_tab.browser.test.js:205`) | the test reads `const DEFAULT_MAX_PER_DAY = (\\d+);`; the unlimited-cap change made that constant `null`, so the regex finds nothing |
| 286 | the M5 pane is dragged by the hand, and a pan never also marks a level | dashboard pane behaviour, browser fixture |
| 287 | the M5 pane zooms, and two marked levels each side survive every step | same pane fixture |
| 556 | the button follows the selector, and its panel states the facts behind the word | dashboard control |
| file | `tests/research_library.browser.test.js` | the file-level failure behind the browser cases above |

255 is the only one that greps the trader loop, and it fails on the daily-cap constant rather than on
anything this fix touches: the string counts for `max-per-day` / `entries_today` are identical in
`d434fabe` and `5630be69` (10 each), so the failure is the same before and after. 76, 78, 286, 287, 556 and
the browser file are page work and never read `traderCycle`.

**This change's own suite, re-run on the deployed commit:** `node --test tests/live_trading_blind_stop_out.test.js`
-> `# tests 5, # pass 5, # fail 0, # skipped 0`. The focused lane suites (blind lane, lane 2, trader,
l2l_strategy, blind_stop_out) were 147/147 in the same tree.

## 7. Rollback

The old file is at `C:\ftmo3\tmp\rollback\run-live-trading-trader.js.20261119T165435Z` (sha256
`A4789872...0249EF1`) with a `.txt` naming the HEAD it came from. To go back:

```powershell
Copy-Item -LiteralPath 'C:\ftmo3\tmp\rollback\run-live-trading-trader.js.20261119T165435Z' `
  -Destination 'C:\ftmo3\scripts\run-live-trading-trader.js' -Force
(Get-FileHash -Algorithm SHA256 'C:\ftmo3\scripts\run-live-trading-trader.js').Hash   # must read A4789872...0249EF1
```

Or `git -C C:\ftmo3 checkout d434fabe -- scripts/run-live-trading-trader.js`, which restores the same
bytes and leaves the checkout one commit ahead of its file. Neither touches the account, the state file,
the journal or any task. Reverting restores the zombie behaviour for any trade that stops out.

## 8. What is still unproved

- **A stop on the new build.** The three endings observed at 17:01:30Z are historical stops read from the
  account's closed-trade window (`stop-fill`); the `entry-gone` path - a ticket the account no longer
  carries and a market beyond its level - has not yet fired on this lane, because the window still held the
  exits. The first live stop after 2026-11-19 is the moment to re-read one `ended_by: "stop-fill"` row.
- **Ticket `202041840`.** Placed at 17:06:33Z and filled by 17:46:30Z; its rungs and its own ending are
  ordinary management and will be read on the next ticks, not claimed here.
- **The dashboard.** No strip or page was changed by this deploy.


## 9. The relay, read in the same pass and kept apart

Separate from everything above: no FTMO-3 file, task, credential or process was involved in this read, and
the relay's own execution was not changed - nothing was started, stopped, registered or sent.

**The two accounts.**

| Side | What it is | Read at 17:05Z |
| --- | --- | --- |
| source (MT5) | FTMO-1, `***614` on `FTMO-Server`, FTMO Global Markets Ltd, USD, leverage 30, terminal build 6296 | balance 10,408.94, equity 10,447.80, 2 positions open, 0 pending |
| target (cTrader) | login `7348195` -> account `42585819` on "FTMO Platform", demo (`isLive=false`) | balance 23,654.16, 0 positions, 0 pending, 4 deals in the trailing day |

FTMO-1 is the account the copy project was scoped to (`CTRADER_COPY_FROM_MT5_20261113.md`,
`CTRADER_RELAY_LANE_OPEN_20261114.md`: "continuous copying off, ftmo-1 read-only"), and this read kept it
read-only: the snapshot was read, the terminal was not touched.

**Its running state: nothing copies.**

| Check | Result |
| --- | --- |
| relay install `C:\ctrader-relay` | 20 files, all adapter/consent/journal/oauth/transport/run modules and their tests, no `package.json`, no git |
| any file named copy / loop / sync / mirror / follow | none, in the install or in `C:\ProgramData\ctrader-relay` |
| an EA on any terminal | none beyond MT5's stock examples and Free Robots, in all three data folders |
| copy-like code in the three lane checkouts | none (the only `ctrader` hit is `C:\ftmo3\ctrader\Ftmo3L2L`, the tracked cBot for lane 3's own strategy) |
| node processes | two: the lane-1 and lane-2 feed writers. No relay process |
| listener `127.0.0.1:8765` | none |
| scheduled tasks matching relay/ctrader | two, both one-shot: `ctrader-relay-consent` (last 18 Nov 21:25:52) and `ctrader-relay-test` (last 18 Nov 21:29:49), neither with a next run |

The last state change in the relay is the 18 Nov test: `C:\ProgramData\ctrader-relay\btcusd-test-journal.json`
holds two 0.01 BTCUSD buys that the harness closed itself (`62201529`, `closed_stop_unconfirmed`, 1.7 s;
`62201543`, `closed_at_deadline`, 120.2 s), and the cTrader deals in the trailing day are exactly those four
legs. There is no other cTrader order in the window.

**The accepted orders that were not copied.** FTMO-1's own placement record
(`C:\live-trading\runtime\tmp\live-trading-trader-state.json`) holds ten accepted tickets since 18 Nov 00:00Z;
the relay's token was sealed at `2026-11-18T21:26:10Z`, so four of them came after the relay could have been
reading anything:

| Accepted on FTMO-1 | Ticket | cTrader outcome |
| --- | --- | --- |
| 2026-11-19T03:01:34Z | `308941664` XAUUSD short | none - no position, no order, no deal |
| 2026-11-19T14:16:33Z | `309101669` XAUUSD short | none (still open on MT5, 0.01 at 3711.92) |
| 2026-11-19T15:21:33Z | `309144559` EURUSD short | none |
| 2026-11-19T16:26:33Z | `309180633` EURUSD short | none |

Every one of them is a missing copy, and the first evidenced cause is the same for all four: **nothing reads
the MT5 side.** The installed relay is a one-shot order harness - consent, one protected send, one close,
journal - and it has no reader for MT5 orders, no loop, no task that repeats and no process that stays up.
The first missing copy is therefore not a rejected send and not a mapping failure: it is the
`2026-11-19T03:01:34Z` XAUUSD short, which never left the MT5 terminal because no component was watching for
it. Lane 2 placed twelve accepted tickets in the same window; none was copied either, for the same reason.

That matches what `CTRADER_RELAY_LIVE_20261118.md` §9 already recorded as not done: "Continuous copying,
symbol mapping, sizing and duplicate prevention for an FTMO-1 -> cTrader copy lane: not started". Nothing in
this pass contradicts it, and nothing in this pass moved it forward.
