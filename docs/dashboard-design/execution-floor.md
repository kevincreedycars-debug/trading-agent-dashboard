# Execution floor: three traders, one host, one separate cTrader component

2026-11-15 · public summary for the Architecture map's execution stations · presentation only

This page describes what the repository records about the live execution floor. It names geometry, rules and
evidence, and it deliberately leaves out everything that would describe a machine, an account or a deployment.

## Three traders on the VPS

| Trader | Strategy | Ladder | Geometry | Directional input |
| --- | --- | --- | --- | --- |
| FTMO 1 | Live L2L Directional | original levels | 5R (`REWARD_R_MULTIPLE = 5`) | the Layer 2 pair output |
| FTMO 2 | Live 0.5L2L Directional | half levels, one midpoint between originals | 3R (`HALF_LANE_R_MULTIPLE = 3`) | the Layer 2 pair output |
| FTMO 3 | Live L2L Blind | original levels | 5R | none: its own M5 rule |

The first two read the same pair output and hold their own tickets: one shared bridge, two independent accounts, each
with its own identifier, neither reading the other's position. Position size is a percentage of the running balance
at fill time, not of the starting balance (`lib/l2l_sizing.js`).

## The blind trader's own path

FTMO 3 is drawn with its own market-data feed and its own M5 deviation rule, because it is the one trader that can
open a position no junction produced:

- Its feed is the broker's M5 chart for the mapped symbol, not the snapshot store, and no Layer 1 agent reads it.
- The rule brackets the current bid with the nearest original level above and below. A completed M5 candle that
  crosses one boundary by a tick from the other side confirms the direction; an unfinished candle never does.
- Entry is a limit back at the crossed boundary, the target is the next original level, and the stop is one fifth of
  that distance, rounded to the tradable tick. Size is the minimum tradable volume in units.
- A cancelled pending order resets the bracket, and on restart the instance checks broker orders and positions before
  acting. Each symbol is independent.

The lane is **connected but unarmed**: the repository records no strategy heartbeat for it and its trader task is
disabled. One closed trade on the account is labelled a connection test and is excluded from the lane's win rate,
trade count and expectancy by `lib/live_trading_performance.js`. The map draws no payout route from this lane.

## The cTrader component

The repository commits one cTrader component: an independent line-to-line robot at `ctrader/Ftmo3L2L`, built from
its own source. It is drawn as a separate object after the lanes, not as a fourth lane, and its state is written out
in four labelled rows:

- **Installation** - documented in source: the robot and its build project are committed. Not evidenced: that it is
  installed on the VPS.
- **Account connection** - documented: one instance per mapped symbol on its M5 chart, pointed at the third FTMO
  account, with the expected account and symbol set from the account and the chart. Not evidenced: a verified
  connection, because account verification still needs the target cTrader environment.
- **Trading authorisation** - **pending**: orders default to disabled and stay disabled until a simulated fill
  verifies the accepted entry, the absolute stop and the target. The robot refuses off-tick marks, and a preview run
  logs its signals without publishing any dashboard heartbeat.
- **Relay design intent** - **FTMO 1**, named as the intended source in the sanitised strategy brief. This is design
  intent, not a configured source.
- **Configured source** - **not evidenced**: no relay configuration or bound source is recorded in this checkout.
- **Observed copying** - **not evidenced**: no dated copy record or copied-order count is committed. The map does not
  claim "inactive" or "zero copied orders".

## What the map does not claim

No report figure is shown for any of the three traders, and the map never reads an account, a balance or an order.
The dotted grey links on the floor mean only that a component runs on the same host: they are not data paths. Two
trailing statements on the execution terminal say the same thing in place: this page is not connected to the VPS, and
no relay implementation, configuration, source binding, copy log or copied-order count is committed.

## Sources

- `lib/l2l_strategy.js`, `lib/l2l_sizing.js`, `lib/l2l_ladder.js`, `lib/l2l_levels_store.js` - the geometry and sizing
  both directional lanes share.
- `ctrader/Ftmo3L2L/Ftmo3L2L.cs` and `ctrader/Ftmo3L2L/README.md` - the independent robot, its rule and its
  verification steps.
- `lib/live_trading_performance.js` - the connection-test exclusion.
- `docs/dashboard-design/execution-path-summary.md` - the junction, the shared bridge and the conditional payout.
