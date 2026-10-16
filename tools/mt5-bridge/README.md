# MT5 bridge (live-trading lane)

One read-only producer, one artifact, and one order tool kept deliberately apart from both.

| File | Role |
| --- | --- |
| `live-trading-snapshot.py` | Reads the running FTMO MT5 terminal and writes the dashboard's snapshot: quotes, account facts, M5/H1/H4 candles, and the read-back of what was executed. |
| `live-trading-order.py` | Places, cancels or closes one trade at a time, by hand, behind `--confirm-live`. The only file in this lane that names an order call. |
| `../../data/live-trading.json` | The snapshot the dashboard's **Live Trading** section renders |
| `../../scripts/validate_live_trading_feed.js` | Validates the artifact before it is trusted or published |
| `../../tests/live_trading_feed.test.js` | Contract tests, including the read-only function allowlist |
| `../../tests/live_trading_order_tool.test.js` | Contract tests for the order tool and for the boundary that keeps it the only sender |

## Run it

Requires Windows, Python 3.13 with `pip install MetaTrader5`, and an already-running, already-logged-in
MT5 terminal in the same Windows session (the package attaches to the terminal; it cannot log in).

```powershell
python tools/mt5-bridge/live-trading-snapshot.py
python tools/mt5-bridge/live-trading-snapshot.py --path "C:\Program Files\FTMO Global Markets MT5 Terminal"
python tools/mt5-bridge/live-trading-snapshot.py --out data/live-trading.json --candles 576 --h1-candles 336 --h4-candles 240 --stale-seconds 900
node scripts/validate_live_trading_feed.js data/live-trading.json
```

`--path` accepts `terminal64.exe` or the folder containing it. `--candles`, `--h1-candles` and
`--h4-candles` set the bar count of each published timeframe. Every run prints the account, the open position and
order counts, then one line per open position and one per trade closed inside the window, and then, for each
instrument, its quote and one line per timeframe, ending with `READ-ONLY snapshot complete`. The block below is one
real run - the `2026-10-03T14:25:25Z` read of
the user's own logged-in terminal, trimmed to one of the four instruments and with the H1/H4 lines from
the later run that added them. It is not generic sample output, and it is not what the committed
artifact holds:

```
       EURUSD bid 1.12504 ask 1.1251 spread 6 points
          M5 current 120 bars, newest 299s old after 1 request(s)
          H1 current 168 bars, newest 3299s old after 1 request(s)
          H4 current 120 bars, newest 14099s old after 1 request(s)
```

`../../data/live-trading.json` is a later run, `2026-10-03T15:08:27Z`; its own quotes are EURUSD
`1.12504/1.1251`, XAUUSD `4137.44/4137.87`, `US100.cash` `30786.94/30788.47` and BTCUSD
`84785.55/84786.55`, on the same four spreads. Every value in the block changes from run to run, so
quote a run and its timestamp together.

## Bar freshness, per timeframe

MT5 answers `copy_rates_from_pos` from the terminal's local history cache and pulls anything missing
from the broker in the background. A run made before that sync lands gets a series that stops earlier
than the instrument's own live tick - on 2026-09-30 three of the four symbols came back 4h45m behind
after the terminal re-synced. The producer re-asks until the newest bar reaches the present (six
attempts, 2s apart), so a run can take a few seconds longer rather than shipping an old series.

Every block therefore carries `bar_age_seconds` (the newest bar's open against that instrument's own
tick), `refresh_attempts`, and `stale`, plus a `note` when it is still behind. The tolerance is the
block's own, because two bar widths is 660s on M5, 7200s on H1 and 28800s on H4: an H1 bar that opened
fifty minutes ago is the forming H1 bar, while the same age on M5 would be a stale series. If a run
reports `STALE`, wait for the terminal's history to finish downloading and run it again; the validator
will not pass a feed that claims current bars it does not have, and the dashboard prints `STALE` in the
symbol row and states the newest bar's age for the timeframe on screen.

## The server clock

MT5 returns the broker's wall clock, not UTC, so every timestamp is written twice: `time_server` and the
corrected `time_utc`. The offset is measured from the tick of the freshest instrument, because a tick's
epoch minus the real clock is the true offset minus that tick's own staleness - so a shut instrument
under-reports it, and reading the first instrument listed was wrong on 2026-10-03 (a Saturday), when
EURUSD's Friday close measured `-52200s` and shifted every `time_utc` by 17.5 hours while BTCUSD's live
tick measured the true `+10800s`. A measurement still outside the band a real UTC offset can take (less
than -12h or more than +14h) is refused rather than applied, and the FTMO server's documented `UTC+3` is
used, with `server_offset_source_symbol` saying the measurement fell back. FTMO's trading-day boundary
stays CE(S)T midnight, which is neither of these clocks.

## The mirrored chart

Each of the three blocks carries two views of the same bars. `bars` is the full OHLC series -
`time_server`, `time_utc`, `open`, `high`, `low`, `close`, `tick_volume`, `spread_points` - and is
what the dashboard's chart draws, one candle per bar with the newest bar still forming, the way MT5
draws it. `close_series` is the compact close-and-direction view the four cards use. The defaults are
`--candles 576` (two days of M5, the trigger's timeframe), `--h1-candles 336` (two weeks of hourly bars)
and `--h4-candles 240` (forty days of four-hour bars), which is what an L2L ladder is read against.

The chart lives at the top of the **Live Trading** section with a symbol row above it, an M5/H1/H4
timeframe row, a candles/line toggle, ladder-stepped price and time scales with grid lines down through
both panes, a volume pane under the price, the last price tagged on the price gutter, a crosshair that
repaints the legend to the bar under the pointer, and the same M5 series drawn small on the four cards.
It is a picture of the feed, not a signal. If a snapshot predates a field the chart falls back to a
close line - no candles and no volume pane, with the legend saying so - and the cards to an area line,
so a published artifact is never blank while it waits for the next producer run.

Marked L2L levels are a separate artifact written by a separate local tool,
[`scripts/README-l2l-levels-tool.md`](../../scripts/README-l2l-levels-tool.md). The bridge neither
reads nor writes `data/l2l-levels.json`: the levels are hand-marked prices (and, for a ladder, exact
arithmetic on two of them), and the chart draws them beside these bars.

## What it will not do

No order function is imported or called in the producer, and `tests/live_trading_feed.test.js` fails the suite if a
call outside the read-only allowlist is ever added to it. That is the boundary as it now stands, and it has two halves:

- **The producer cannot send anything.** Reading history is still reading: the allowlist grew on 2026-10-04 by
  `history_deals_get`, `history_orders_get` and the eight deal/position enum constants, and by nothing that can
  place, change or close a trade. The second of the two reads is what finds a closed position's stop and target,
  because MT5 books both levels on the order rather than on the deal.
- **The order tool is the only sender, and it is a separate file and a separate process.** `live-trading-order.py`
  shares no code with the producer or the runner, is never called by the cadence, and is run by hand from the terminal
  session. `tests/live_trading_order_tool.test.js` asserts that exactly one file in `scripts/` and `tools/mt5-bridge/`
  matches an order call and that it is this one, so a second sender appearing anywhere in the lane is a failing test
  rather than something a reviewer has to notice.

## The read-back

Since `live-trading-feed-v3` the snapshot also says what has already been executed, so a trade can be seen to have
happened instead of taken on trust; since `live-trading-feed-v4` the working pending orders are published beside
them, because a ticket left as a limit is neither a position nor a closed trade:

| Block | What it holds |
| --- | --- |
| `orders` | One record per working pending order: ticket, symbol, the order's own type name, side, volume, the level it sits at, the stop and the target it carries, magic, comment, and the moment it was placed as both server and UTC stamps (with `expiration` null when the order has no expiry of its own). This is the block that says which level a live L2L trade is actually working at. |
| `positions` | One record per open position: ticket, symbol, side, volume, entry, current, stop, target, floating profit and swap, the signed move in percent, magic, comment, and the position's own open and last-update times as both server and UTC stamps. |
| `closed_trades` | One record per completed position, newest first, paired out of the terminal's deal history: this is where a `positions_get` entry deal and its exit deal become one trade with a result rather than two ledger lines. It carries the stop and the target the position was opened with as well, read from its own order history. |
| `history` | The window the pairing covered: `window_days` (14), `from_utc`/`to_utc`, how many deals were read, and how many positions that completed. |
| `execution_note` | Plain words on the artifact itself: this snapshot places nothing, and a trade comes from the order tool run deliberately or from a hand in the terminal. |

MT5 reports history as deals, not as trades: a position that opened and closed is an entry deal (`DEAL_ENTRY_IN`) and
one or more exit deals (`DEAL_ENTRY_OUT`, or `DEAL_ENTRY_OUT_BY` when one position closed another) sharing a
`position_id`, with the commission and the swap booked on the deals rather than on the position. `build_closed_trades`
pairs them, sums the profit, commission and swap across the pair, and derives the net, the volume-weighted exit price,
and the seconds held. A position whose exit deal is outside the window is left out whole rather than shown as half a
trade: it is either still open, in which case `positions` carries it, or it closed before the window opened. That is
why `history` is published beside the list and why the dashboard prints it - "no closed trades" and "a window that
holds none" are different facts, and the page can now tell them apart.

`scripts/validate_live_trading_feed.js` refuses the shapes that would render as a broken row: a position with no side,
size, price or clock; a net figure that is not its own profit plus commission plus swap; a trade that closed before it
opened; a trade not paired out of at least two deals; an `account.positions_open` that disagrees with the rows beside
it; and a `history.closed_positions` that disagrees with the list.

The stop and the target on a `closed_trades` row are the levels the position's own orders carried, read with
`history_orders_get(position=...)` and applied oldest first, so the last level actually set is the one reported. A run
that cannot read the order history writes null for both, which is a different fact from a trade opened with nothing
attached; a snapshot written before these two fields existed carries neither, and the validator accepts an absent key
as that older shape rather than as an error. The dashboard draws its position tool - the risk band, the reward band,
and what each was worth at the size the trade was taken in - only from a row that carries both levels.

## The order tool

```powershell
python tools/mt5-bridge/live-trading-order.py status
python tools/mt5-bridge/live-trading-order.py open --symbol BTCUSD --side buy --confirm-live
python tools/mt5-bridge/live-trading-order.py close --ticket 297645550 --confirm-live
python tools/mt5-bridge/live-trading-order.py cancel --ticket 297645551 --confirm-live
```

It is a plumbing tool, written on 2026-10-04 to prove the loop end to end: it places one market order at a time with
no entry rule, no exit rule, no stop and no target unless one is passed explicitly, and it can take one of its own
working pending entries back out of the market again. The guards are the point of its shape, and each of them
refuses rather than warns:

| Guard | Behaviour |
| --- | --- |
| `--confirm-live` | Without it nothing is imported, attached to or sent: the run prints the plan and exits 3. |
| Symbol allowlist | Only the four instruments the dashboard publishes; anything else exits 3 untouched. |
| Size | Defaults to the symbol's own `volume_min` - the smallest position the instrument accepts - and the cap for a run is that same minimum unless `--max-lots` raises it, so a larger trade takes two explicit arguments. |
| Close | Capped at the position's own volume, because a position that cannot be capped cannot be closed either. |
| Stop and target | Refused before sending if either is on the wrong side of the entry. |
| Ticket | A close refuses a ticket that is not exactly one open position on this account, and a cancel refuses a ticket that is not exactly one working pending order on it. |
| Cancel | Removes one working pending entry with `TRADE_ACTION_REMOVE` and nothing else, refusing a ticket carrying another path's `magic`. One attempt only: a removal carries no price, so there is nothing to requote. |

A pending entry carries no expiry unless a caller asks for one, because the rule states no lifetime for it: the L2L
levels are permanent, activated by the 5m deviation that confirmed the call and deactivated only by their
take-profit being taken or by the day's call changing direction, and
`../../scripts/run-live-trading-trader.js` is what removes the resting limit on those two readings, through
`cancel`. `--expire-minutes` is therefore this tool's own hand-run cap rather than the rule's, and the loop passes
none. Closing a position stays `close`.

Every invocation appends one JSON line to `tmp/live-trading-orders.log` (ignored): the plan, the request as sent, the
terminal's raw answer, and the outcome. Every trade it places carries `magic 20261004` and the comment
`live-trading-loop-proof`, so the read-back can say which trades came from this path. The one real round trip so far is
recorded in `../../docs/live-trading/STRATEGY_LIVE.md` section 29: BTCUSD 0.01 lot, entry `85230.34`, exit `85248.89`,
85 seconds held, `profit 0.19` against `commission -0.56`, net `-0.37`.

## Running it on a schedule

**Decided 2026-09-30: this runs on the PC.** The user turned down the always-on VPS for now, so the
producer is run on the machine holding the terminal, when that machine is on. Nothing is scheduled on
the PC and nothing is deployed: run the command above (or via Task Scheduler, if that is ever wanted)
and the snapshot refreshes; when the PC is off the last snapshot simply ages and the dashboard says
`STALE` with the reason, which is the intended behaviour of this route rather than a fault.

The always-on host alternative - sizing, autostart, publish and acceptance tests - is written up and
**parked** in [`docs/live-trading/VPS_SPEC.md`](../../docs/live-trading/VPS_SPEC.md). It is the only route
that keeps the feed fresh with the PC off, and it has not been bought or built.
