# Lane 3, Live L2L Blind, on the dashboard - 2026-11-15

The blind lane is now a lane the published dashboard reads like the other two: its own corner strip, its own card
and its own tab in the live panel, a published snapshot at `data/live-trading.blind.json`, and one closed trade on
the account that is labelled a connection test and kept out of the strategy's figures. The strategy is not armed.

## What the page shows

- Three strips under the nav: `Live L2L Directional · Active`, `Live 0.5L2L Directional · Active`,
  `Live L2L Blind · Connected`. `Connected` is the blind lane's normal word: the broker feed is fresh and the
  strategy has no heartbeat, so `.connected` (teal) is deliberately not the `Active` tone.
- The live panel's lane selector has three tabs. Lane 3 opens on the blind rule card (either direction, full L2L
  grid, 5R, 0.01 lot, no daily entry cap) and its own status panel:
  `Connected · strategy unarmed - Last broker update 2026-11-15 14:00:20 UTC · no strategy heartbeat has ever been
  published, so the strategy is parked · Open positions: 0 · Working orders: 0`.
- `FTMO 3 PERFORMANCE` states that no blind strategy trade has closed inside the 14-day window, then states the
  connection test separately: `1 connection test (0.32 USD) closed on this account inside the window: its net is in
  the balance and in the closed-trades table, and it is excluded from the Blind win rate, trade count and expectancy
  above`.
- `CLOSED TRADES` carries the one row, with `Kind` reading `Connection test` and the comment `tech-conn-test-ftmo3`:
  opened `2026-11-14 21:47Z`, closed `21:50Z`, BTCUSD buy 0.01, 64493.98 -> 64568.15, held 2m 31s, profit +0.74,
  commission -0.42, net +0.32, position #200523930.
- Account `***584 / FTMO-Server3`, equity and balance 10000.32 USD - the +0.32 is in the balance, which is what
  makes it a connection proof rather than a strategy result.

The rule behind the last two points lives in `lib/live_trading_performance.js`: a trade whose comment matches the
connection-test pattern is counted in the account's own totals and in `connectionTests`, and left out of the
weekday, asset, strategy and win-rate slices unless the caller passes `includeConnectionTests: true`.

## The host: why the lane's cadence wrote nothing for four hours

The feed task was registered without a principal, so Task Scheduler stored it at `Limited`. An unelevated
Administrator token carries `BUILTIN\Administrators` as deny-only, `C:\ftmo3` grants `BUILTIN\Users` read-only, and
so every scheduled run died on its own log file:

```
Error: EPERM: operation not permitted, open 'C:\ftmo3\tmp\live-trading-feed.log'
    at appendLog (C:\ftmo3\scripts\run-live-trading-feed.js:276:6)
```

The same command over ssh succeeded, which is what hid the fault: the artifact on disk was always the last one an
interactive run had written, and the lane's log stopped at `13:35:20Z`. This is the fault recorded for lane 1 in
`VPS_DEPLOYMENT_STATUS_20261024.md` section 14.2, met again because the lane-3 registration had no principal.

`scripts/register-live-trading-feed-task.ps1` now takes `-RunLevel` (default `Highest`) and `-RunAs`, registers with
an explicit `Interactive`/`Highest` principal, prints the run level the scheduler actually stored (`task_run_level`),
and resolves the account from the token - translated to a SID - before any earlier task is removed. The first
attempt took the account from `USERDOMAIN`/`USERNAME`, which are empty over ssh; the registration then removed the
lane-3 task and refused the replacement with `No mapping between account names and security IDs was done`, so the
translation now happens first and the old task survives a bad account.

Lane 3 after the fix, read back on the host: `task_run_as = Administrator`, `task_run_level = Highest`,
`LastTaskResult = 0`, and the run aligned to the bar close as designed:
`{"at_utc":"2026-11-15T14:00:20.013Z","status":"ok","generated_at_utc":"2026-11-15T14:00:20.631658+00:00",
"account":"***584 FTMO-Server3","positions_open":0,"closed_trades":1,"m5_current":4,"live_ticks":1}`.
`C:\ftmo3` was also granted explicit modify rights for the task account, which changes nothing while the task runs
elevated and keeps a fallback from failing the same way.

## The publish

The lanes publisher runs every ten minutes on the host and reads three lanes from `config/live-trading-lanes.json`
plus the machine-local override that points at the three lane roots. Its run at `14:01:00Z` carried all three:

| lane | artifact | identity | status |
| --- | --- | --- | --- |
| ftmo-1 | `data/live-trading.json` | `***614` FTMO-Server | published |
| ftmo-2 | `data/live-trading.account2.json` | `***841` FTMO-Server3 | published |
| ftmo-3 | `data/live-trading.blind.json` | `***584` FTMO-Server3 | published |

Commit `27967f28`, `ca5d75c0..27967f28 HEAD -> main`, `publish_count` 866, `validate_error_count` 0. The lane-3 row
in `data/live-trading-lanes.json` states `trader_status: null` with the reason - `no heartbeat at
C:\ftmo3\tmp\live-trading-trader-status.json: the trader has not run in this checkout yet` - which is the honest
description of a lane whose loop is registered and disabled.

`35bc8b03` then carried the lane's `blind: true` into the published row: the lanes loader normalised `strategy` to
`grid` and `r_multiple` and dropped the flag, so the document whose label says "Blind" could not say why.

## Read back on the published page

`https://kevincreedycars-debug.github.io/trading-agent-dashboard/`, Live Trading tab, the three lanes walked
`ftmo-3 -> ftmo-2 -> ftmo-1` and back, at 14:2xZ on 2026-11-15:

- strips `Active`, `Active`, `Connected`; the selector badges the same words; the blind strip's class
  `live-trader-status connected`.
- lane tabs render 5 rows for ftmo-3, 47 for ftmo-2 and 78 for ftmo-1, each on its own account and with no other
  lane's login anywhere on the card.
- the ftmo-3 panel carries the connection-test note, the `Connection test` kind and the BTC row above; the snapshot
  it reads is `2026-11-15T14:00:20.631989+00:00`.
- `data/live-trading.blind.json` (2,382,075 bytes) and `lib/ftmo3_status_widget.js` are both served; no page error.

Screenshots and the raw read-back JSON live in the ignored `tmp/shots/` and `tmp/capture-facts.json` of the lane
checkout, not in a commit.

## Expected 404s

- `data/live-trading-trader.ftmo-3.json` - the strip probes for a heartbeat that has never been written. A missing
  heartbeat is the lane's normal state and the strip says so; the probe is what makes the day one appears visible.
- `data/half-l2l-reach-research.json` and `/api/l2l-levels` - absent before this change too (the second is the local
  level service, which GitHub Pages does not host).

## Still unarmed, and how it would be armed

`LiveTradingTraderTick-ftmo3` is `Disabled` on the host and no order was sent by any of this. Arming is the
procedure the second lane's runbook records for a lane whose feed is fresh and whose identity gate passes: run the
trader once in dry-run to read what it would place, then register its task. Nothing here touches that path, the
rule, the grid or the sizes.

## Tests

- `tests/live_trading_feed_cadence.test.js` 25/25, including the new principal assertions.
- `tests/live_trading_lanes_publish.test.js` + `tests/live_trading_lane_isolation.test.js` +
  `tests/live_trading_lane_status.browser.test.js` 43/43.
- `tests/live_trading_performance.test.js` + `tests/live_trading_lanes_publish.test.js` + `tests/l2l_strategy.test.js`
  77/77.
- Full browser suite at `35bc8b03`: 5 failures, the same 5 that fail at `8a3361e6` (the snapshot commit before this
  work) in a clean worktree with the same `node_modules` - `site_nav_consistency` 2,
  `backtesting_development_release` 1, `live_trading_chart_pan` 1, `live_trading_chart_zoom` 1. They are this
  machine's state, not this change.
