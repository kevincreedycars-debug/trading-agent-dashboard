# The tick sweep and the session horizon, 2026-11-23

## The question

The session was corrected on 2026-11-23 from "17:00 New York" to "the next 05:00 London". The published
L2L tick sweep (`l2l-tick-sweep-v1.json`) was produced on 2026-11-12, before that change, from the same
ladder snapshot. The same ladder hash does **not** establish the same execution outcomes, so the sweep was
re-examined rather than assumed unaffected.

## What the stored sweep actually did

v1 walked one continuous tape across the six sessions:

- a limit that was not touched kept working into the next session and beyond — 4 of its 157 fills were
  stamped **after** the session they belonged to had ended, one of them three days later;
- a position was carried until a stop, a target or the end of the tape — 24 of 157 fills had an exit at or
  after the following 05:00 London, and 4 were still open when the tape ran out (`working-at-end-of-tape`).

So the sweep priced trades the corrected horizon forbids: it was affected, and the earlier note that said
otherwise is superseded.

## What was re-run

`scripts/rebuild_l2l_tick_sweep_session_bounded.js` re-prices v1's **own decisions** inside their own
session and writes `l2l-tick-sweep-v2.json`:

1. v1 is reproduced first, from its own trade audit, with no horizon at all. The reproduction must match
   v1's totals, its 16 account blocks and its 16 model summaries to the recorded precision, or the script
   refuses to write. It does match.
2. A fill stamped outside its own session window is **cancelled** at that window's endpoint and reported
   as `cancelled_at_session_end`. It is not counted as a trade.
3. A position with no exit inside its window is **closed at the last M5 bar inside the window**, on the
   side of the book that would have paid it (long → bid, short → ask), and its exit reason becomes
   `session_end`.
4. Everything else keeps the price, instant and R the sweep recorded.

The window itself is resolved twice and must agree: the tape carries the window the Python streamer wrote,
and `backtester/lib/usd_session_engine_interface.js#resolveSession` resolves it again from the declared
London transitions. All 24 tapes agree, all are 24 hours, and every tape's last bar is strictly before its
endpoint.

## What moved

| | v1 | v2 |
| --- | --- | --- |
| closed trades | 153 | 153 |
| targets | 33 | 24 |
| stops | 120 | 109 |
| session-end closes | — | 20 |
| working at tape end | 4 | 0 |
| fills cancelled at session end | — | 4 |
| fills (audit rows) | 157 | 157 |
| R, full 5R rule | −11 | −5.1936 |
| R, half 3R rule | +4 | +2.7508 |

The 4 working trades became session-end closes, and 4 fills that landed in a later session were cancelled,
so the closed count is unchanged at 153 by coincidence rather than by construction. What changed is *when*
each trade stopped: 9 targets and 11 stops printed after the endpoint and are no longer counted, replaced
by endpoint closes at whatever the last bar inside the session paid.

Ten of the sixteen accounts changed balance. Each account block in v2 carries its own
`session_end_closes` and `cancelled_at_session_end` counts.

| symbol | account | v1 | v2 | delta |
| --- | --- | --- | --- | --- |
| EURUSD | current-full | 105,748.96 | 109,439.75 | +3,690.79 |
| EURUSD | current-half | 104,654.30 | 105,144.28 | +489.98 |
| XAUUSD | current-full | 95,138.00 | 99,443.34 | +4,305.34 |
| XAUUSD | current-half | 100,869.43 | 104,052.74 | +3,183.31 |
| XAUUSD | challenger-full | 98,026.60 | 99,829.60 | +1,803.00 |
| NAS100 | current-full | 95,921.41 | 95,827.80 | −93.61 |
| NAS100 | current-half | 104,780.60 | 103,132.35 | −1,648.25 |
| BTCUSD | current-full | 93,074.92 | 90,862.58 | −2,212.34 |
| BTCUSD | current-half | 99,633.87 | 96,591.84 | −3,042.03 |
| BTCUSD | challenger-full | 103,948.46 | 102,773.03 | −1,175.43 |

The direction of the move is not a verdict: a carried position that eventually reached its target after
05:00 now closes at the endpoint, and an endpoint close can be worth more or less than the target or the
stop it replaced. Six accounts did not move at all, because all of their exits were already inside their
session.

## What this does and does not establish

- It establishes that the earlier sweep's exits were not all inside the session, and what the same
  decisions produce when they are. That is historical validity of a measurement, not performance.
- It does **not** re-derive the decisions: a limit that never filled is not re-placed, and a slot freed by
  an earlier 05:00 close is not re-filled. The sweep recorded only the orders it filled, so the bounded
  replay cannot know what a freed slot would have taken. That limitation is printed in the artefact's
  `limits`.
- It does **not** make the tape reproducible from the repository: the tapes are local evidence. Each one's
  sha256, window, bar count and endpoint close travel in `l2l-tick-sweep-v2.json`, so the endpoint prices
  can be audited; re-streaming the tape needs broker access to the same history.
- It does **not** claim predictive advantage for either rule, either model or any market.

## Reproduction

```
node scripts/rebuild_l2l_tick_sweep_session_bounded.js          # write v2 + the supersession record
node scripts/rebuild_l2l_tick_sweep_session_bounded.js --check   # prove both follow from v1 + the tapes
node --test backtester/tests/usd_l1_tick_sweep_bounds.test.js    # 8 cases, no tapes required
```

The CLI needs the local tapes (`.local/tmp/l2l-ticks-sweep`); the test suite does not, because it pins the
committed artefacts, the session contract and the bounding rules with synthetic fixtures.

## Where the correction is carried

- `data/usd-layer1-backtester/l2l-tick-sweep-v2.json` — the bounded sweep, with `horizon.rule`,
  `horizon.sessions`, `horizon.tapes` (hash + endpoint close per session) and `horizon.moved`.
- `data/usd-layer1-backtester/l2l-tick-sweep-v1-supersession.json` — what replaced what, why, and what moved.
- `data/usd-layer1-backtester/run-v1.json` → `results.lead_numbers[2]` and `l2l_tick_sweep_lineage`.
- `data/usd-layer1-backtester/backtesting-screen-v1.json` → the Tests tab's replay row.
- v1 is preserved byte for byte at `data/usd-layer1-backtester/l2l-tick-sweep-v1.json`.
