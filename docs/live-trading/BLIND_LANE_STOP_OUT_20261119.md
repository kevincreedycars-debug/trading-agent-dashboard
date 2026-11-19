# A stop ends a blind trade

Written on 2026-11-19 in the `live-trading/blind-stop-fix-20261119` worktree, from the lane-3 log, state file and
feed pulled off the FTMO-3 VPS for 2026-11-16 to 2026-11-19. The fix is committed here and **not deployed**: the lane
keeps running the arming build until the owner says the change goes out (section 6).

## 1. What the lane did

Three of the lane's trades were closed by the account at their own stop, and every run afterwards went on treating
each of them as the pair's standing trade:

| Ticket | Symbol | Placed at | Stopped at | First run that read it as standing |
| --- | --- | --- | --- | --- |
| 200695485 | EURUSD | 1.10557 | 1.10115 | 2026-11-16 |
| 200695492 | US100.cash | 27860.13 | 27697.63 | 2026-11-16 |
| 201323839 | XAUUSD | 3854.59 | 3840.21 (stop 3840.29) | 2026-11-18 |

For XAUUSD the sequence is on the record end to end. The buy at 3854.59 filled, the account closed it at 3840.21,
`blindWatchPairs` re-selected the pair (the newest close at 3779 selects 3711.63 below and 3783.11 above), the pulled
feed's three newest closes - 3778, 3789, 3779 - are a bearish deviation at 3783.11, and `blindPlan` states the sell
limit there with its stop and its target at 3711.63. No ticket was ever sent. Every run instead:

1. read the stopped buy as `ended: false`, so the pair's trade was still the old one on 3854.59, long;
2. stated that level and that side back as the trade, with its old target at 3926.07;
3. refused the put-back, correctly, because a buy limit at 3854.59 is a buy at a market of 3685.55 - `resting: false`,
   "the retrace it waits for has already happened";
4. and therefore also refused the deviation on 3783.11, because the pair already had a trade in `decide`'s eyes.

That is the cycling: a finished trade standing for a pair that had already moved to two new lines, run after run,
until the finished trade's old target happened to print.

## 2. Why it happened

The blind lane's endings were the target filled, the target touched before a fill, and a hand close. A stop was
deliberately not an ending - the ruleset's own reading was that "the level is re-armed by the next three-leg
deviation", so a stopped trade went on standing at its own level and waited for that level to be reclaimed. Two things
were wrong with carrying that into the loop:

- **The trade row was never ended, and `decide` reads the trade before it reads the deviation.** A cycle that is not
  ended supplies the level and the side for the row, so the deviation on the pair's new line was never the subject.
- **The level that was supposed to re-arm could never re-arm on a market that had left it.** The put-back gate asks
  for the newest completed candle to straddle the old level and close after the exit; with the market 160 points below
  3854.59, no candle straddles it, so the re-entry the design assumed was unreachable in the case that actually
  happens - a stopped trade whose pair has moved on.

A stop is the market answering the level, which is the same kind of fact as the target being taken. It ends the trade.

## 3. The change, in `scripts/run-live-trading-trader.js`

- `tradeCycle` scans the closed trades for an entry on this symbol opened at or after the row's `placed_at_utc` that
  closed at its own **stop** (`exitEnding(entry) === "stop"`), and takes the latest one as `stopExit`.
- `tradeCycle` also takes the account's own read of its working orders and positions (`ours`, threaded from `runOnce`
  as `live.positions + live.orders`, every magic). A row whose placed ticket is absent from both, whose level the
  market has left (`resting === false`), and which is not a position, is `entryGone` - the same ending for a stop
  older than the feed's closed-trade window.
- On the blind lane alone (`blind` is true) those two become `endedBy: "stop-fill"` and `endedBy: "entry-gone"`, and
  their close instant (or, for `entry-gone`, the run that found the ticket gone) becomes the exit the crossing window
  and `last_exit_utc` are measured from.
- `tradeReason` gains the two endings' words, and the blind lane's standing-trade sentence now says the trade stands
  until its target, its own stop, or a hand.
- **The called lanes are untouched:** `endedBy` keeps `call` / `withdrawn` / `hand-close` / `target-fill` first for
  them, and both new branches are behind `blind`, so lane 1 and lane 2 still put a stopped level back while their call
  stands (`STRATEGY_LIVE.md` §43).

## 4. The tests

`tests/live_trading_blind_stop_out.test.js` (5 tests, added here):

1. the XAUUSD row and the account's record of the stop state `ended: true`, `ended_by: "stop-fill"`, no ticket to put
   back, and the close instant as `last_exit_utc`;
2. the same record read as a called lane still ends nothing and puts 3854.59 back;
3. the pair re-selects to 3711.63 / 3783.11, `blindReadings` confirms the short at 3783.11 (stop 3797.406, target
   3711.63), and the same inputs *without* the record and the account read reproduce the old refusal at 3854.59 -
   skip, far side of the market - so the test shows the defect and the fix in one place;
4. a stop older than the closed-trade window reads `entry-gone` from the ticket's absence, and a ticket the account
   still works is never read as gone;
5. one armed blind run on the pulled feed: a single send, `sell 3783.11`, stop 3797.406, target 3711.63, no
   `--expire-minutes`, the log stating `stop-fill` beside the finished trade, the new pair written down and the
   stopped row left in the state file untouched.

`npm test` in this worktree: 966 tests, 955 pass, 7 fail, 4 skipped. The seven failures are pre-existing page and
browser work, and none of them reads this loop: `backtester/tests/site_nav_consistency.browser.test.js` (the shared
partial is stale in `index.html`, so two of its tests fail - "thirteen pages current" and the page order),
`tests/live_trade_logic_tab.browser.test.js` ("the loop states a daily count of new trades", which reads the removed
cap - the file still fails on `DEFAULT_MAX_PER_DAY = null` as it does on `HEAD`),
`tests/live_trading_chart_pan.browser.test.js` and `tests/live_trading_chart_zoom.browser.test.js` ("draws 0 marked
lines below its own bars"), `tests/live_trading_lane_status.browser.test.js` ("4 a day, as the last run recorded it"),
and `tests/research_library.browser.test.js`, whose own file-level timeout is the oldest of them. The four focused
suites - blind lane, lane 2, trader and strategy - are 142 of 142, and the new file is 5 of 5.

## 5. What this is not

- Not proof of edge. It changes which ticket a run may send after a stop; it does not make the deviation profitable.
- Not a backtest. The three ticket numbers are the account's own, the closes are the feed's, and the re-selection and
  the short are the module's own output on those bars.
- Not a change to what counts as a deviation, to the ladder, to the sizing, to the caps, or to the management rungs.
- Not deployed, and not yet proved against the live lane: what the change has to show on the VPS is one stopped trade
  followed by one placed ticket on the pair's new line, in the lane-3 log.

## 6. Rollout

1. Owner's word that a stop ends the blind trade, and the same word from the FTMO-3 lane's owner before the file on
   that host changes.
2. Copy `scripts/run-live-trading-trader.js` to the VPS beside the running build; run the focused suites there.
3. Leave the running positions alone: the change reads them, it does not close or move them. A position the account
   carries is `heldByAccount` and is never read as gone.
4. Watch the first three stops against section 1's table: each should produce `ended_by: "stop-fill"` in the run
   record's `trades` block and one placement on the pair's then-current lines, not a put-back at the old level.
5. The ruleset's own statements are corrected with this change: `LIVE_L2L_BLIND_RULESET.md` §7.4, §8's ending table
   and its worked example, which stated that a stopped trade stood at its level. Anything else in that page that
   reads a stopped trade as still standing is a leftover to be found, not a second rule.

