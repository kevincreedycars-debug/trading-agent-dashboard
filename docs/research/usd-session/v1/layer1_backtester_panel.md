# USD Layer 1 backtester: current model versus the 25-factor challenger

Created 2026-11-08 on branch `research/usd-session-20261013`, continuing the programme documented in
`feasibility_audit_usd_vs_25factor_20261107.md` (§13) and the isolation rules in `isolation.md`.

## North Star

> Does one independent USD call at 05:00 London, built from the 25-factor research, improve on our current
> model? We measure four things: ① DXY directional accuracy, ② how often EUR/USD, gold, BTC/USD and NAS100
> move opposite the USD call, ③ full-level L2L trading results at 5R, and ④ half-level L2L trading results at
> 3R. Both trade simulations start at £100,000 and risk 1% of the account balance per filled trade.

The wording is frozen in two places and compared by test: `backtester/lib/usd_layer1_backtester/contracts.js`
(`NORTH_STAR_TEXT`) and the panel's permanent markup in `index.html`. The run artefact repeats it, so a saved
result and the page can never disagree about the question.

## What was built in this pass

| Piece | Path | What it does |
| --- | --- | --- |
| Contracts | `backtester/lib/usd_layer1_backtester/contracts.js` | The four tests, the four markets, the flat-band rule, the conviction scale, the account rule, the official-DXY refusal and every honesty label |
| Snapshots | `.../snapshots.js` | One 05:00 snapshot per session from the as-of frame plus the cached one-hour gold and NAS100 prices, with provenance and staleness on every input |
| Current model | `.../current_model.js` | Shapes the snapshot into the row `backtester/replay/usd/usd_replay_core.js` already scores, then bands the model's own 0-100 conviction to 1-5. No rule, weight or score is changed |
| Challenger v0 | `.../challenger.js` | Nine equal-weight mechanisms, a minimum-data rule, an agreement deadband and declared conviction bands, frozen before any date was scored |
| Outcomes | `.../outcomes.js` | 05:00-to-05:00 session moves for the four markets, with the development-only flat band |
| Tests | `.../tests.js` | Test 1 and test 2 arithmetic, the corrected/spoiled comparison, and the honest blocked record for tests 3 and 4 |
| Accounts | `.../accounts.js` | Four independent £100,000 accounts, 1% of each running balance, lot-step rounding, drawdown |
| Execution demo | `.../demo.js` | Reads the two replay ledgers and the M5 feed, re-sizes the demo for the four accounts and draws nothing new |
| Run | `backtester/lib/usd_layer1_backtester/run.js` | Assembles the artefact: progress, coverage, tests, session rows, demo, benchmark, provenance |
| CLI | `backtester/scripts/run_usd_layer1_backtest.js` | Writes the research copy, or with `--publish` copies the verified artefact to `data/usd-layer1-backtester/run-v1.json` |
| Panel | `index.html`, `script.js`, `styles.css` | The new **USD L1 Backtester** tab: North Star, progress, coverage, four tabs, daily drill-down |
| Replay | `lib/usd_l1_replay.js`, `lib/vendor/three.min.js` | Three.js candle replay with a 2D fallback; steps qualifying close, order, fill, stop, target, exit |

Reused rather than rebuilt: the session contract (`usd_session_engine_interface.resolveSession`), the current
model's scoring (`usd_replay_core.buildReplayOutput`), the 05:00 macro as-of frame, the one-hour outcome caches,
the two L2L replay ledgers reported at `5d488ef5`, and the research path guard.

## The daily call record

Every eligible session gets one row with, for each model: direction, the model's own raw score, the 1-5
conviction band, the inputs actually used, the inputs missing, and a written reason whenever no call is made.
"Eligible" means a weekday 05:00 Europe/London start whose snapshot could be built; both endpoints are resolved
from declared DST transitions, never from a fixed hour count.

The current model's reconstruction is honest about what it cannot see. Three of its ten factors have no history
in this checkout — F3 needs the German 2-year series (warehouse only), F7 needs a US event history that reaches
the cutoff, F8 needs historical Fed-bias snapshots — so those factors score NEUTRAL with the input named. F5's
DXY leg reads FRED DTWEXBGS, labelled as a substitution everywhere it appears. Because of that the
reconstructed current model cannot reach its own top conviction band: on this window it produced 301 / 212 /
116 / 68 / 0 calls at conviction 1-5. That is a property of the reconstruction, and it is stated rather than
smoothed.

## The challenger, version 0

The 25-factor programme has delivered the VIX chain's research and nothing else: twenty-four chains have no
adjudication, so no combined 25-factor adjudication exists to implement. Version 0 is the null hypothesis an
adjudication has to beat — every mechanism whose USD direction is stated by the published rules, each weighted
exactly 1, with no parameter fitted to any outcome:

| Mechanism | Input | Rule | Direction |
| --- | --- | --- | --- |
| VIX regime | `vix_level` | above 25 / below 16 | USD bid / offered |
| VIX momentum | `vix_d5_chg` | ±1 index point | rising bids USD |
| US 2-year | `us_2y_d5_bps` | ±5 bp | higher supports USD |
| US 10-year real | `us_10y_real_d5_bps` | ±5 bp | higher supports USD |
| Broad dollar momentum | `broad_dollar_d5_pct` | ±0.15% | continuation |
| Gold | `gold_d5_pct` | ±0.5% | gold up reads against USD |
| NAS100 | `nasdaq100_d5_pct` | ±0.5% | equities up reads against USD |
| EUR/USD mirror | `eurusd_d5_pct` | ±0.15% | EUR strength reads as USD weakness |
| USD/JPY mirror | `usdjpy_d5_pct` | ±0.15% | USD/JPY up reads as USD strength |

Frozen rules: at least 6 of 9 mechanisms must have a value or the day is a recorded no-call; a net agreement
below 20% of the live mechanisms is also a no-call; conviction bands run 5 (≥75% agreement, ≥90%
participation) down to 1; the provisional trade threshold is conviction 3, and every call below it is still
recorded and scored so the threshold can be reviewed rather than nudged.

Seventeen inputs are excluded by name with a reason each, mostly because they sit inside another input
(`usdgbp`, `usdcad`, `usdchf`, `usdsek`, `afe_dollar` inside the broad dollar index; `us_3m_yield` and
`us_5y_real_yield` against their longer legs; `sp500_level` against NAS100) and the rest because their USD sign
needs the adjudication (`credit_spread_hy`, `wti_spot`, `us_10y_breakeven`) or does not exist in this checkout
(`fed_bias`, `us_de_2y_spread`, `latest_us_event`).

## Measured coverage, 2026-11-08

725 eligible sessions from 2024-01-02 to 2026-10-12.

| | Calls reconstructed | Coverage | No-call sessions | Conviction 1/2/3/4/5 |
| --- | ---: | ---: | ---: | --- |
| Current model | 697 | 96.14% | 28 | 301 / 212 / 116 / 68 / 0 |
| Challenger v0 | 490 | 67.59% | 235 | 90 / 213 / 79 / 73 / 35 |

The challenger's 235 no-calls are its minimum-data and deadband rules working, not missing data: 525 of 725
sessions had all nine mechanisms live, 143 had seven, and the rest fell short on gold or NAS100 prices.



## Test results

**① DXY direction: unscored, 0 sessions.** No licensed ICE cash DXY history exists in this checkout. The
collector stores FRED DTWEXBGS under `dxy_level`; that is a lagged broad trade-weighted index, so a
05:00-to-05:00 move read from it is neither the ICE basket nor knowable at 05:00. Substituting it would answer a
different question and would flatter whichever model happened to agree with the lagged print, so the lane
reports the blocker, keeps the by-conviction table, and counts the 697 current and 490 challenger calls that are
already waiting for prices. Owner: the ICE sample and fee letter.

**② Four markets: scored.** Accuracy on every scored call, sample size beside each percentage, with the
DXY-confirmed column blocked for the same reason as test ①:

| Market | Current | Challenger | Corrected / spoiled (matched dates) |
| --- | --- | --- | --- |
| EUR/USD | 49.86% (183/367, lower bound 44.78) | 48.28% (126/261, lower bound 42.28) | +21 / −26 on 258 |
| XAU/USD | 55.24% (211/382, 50.22) | 51.79% (145/280, 45.95) | +18 / −38 on 276 |
| BTC/USD | 51.42% (236/459, 46.85) | 50.31% (164/326, 44.91) | +28 / −36 on 321 |
| NAS100 | 55.43% (204/368, 50.33) | 53.61% (141/263, 47.58) | +24 / −37 on 260 |

Read plainly: on this window the challenger does not beat the current model on any of the four markets, and it
spoils more matched dates than it corrects on all four. Every accuracy sits inside a flat band frozen from
development dates only (EUR/USD 0.10%, XAU/USD 0.15%, BTC/USD 0.55%, NAS100 0.21%), so a hit is never a session
that barely moved.

**③ Full L2L at 5R and ④ half L2L at 3R: unscored, 0 sessions each.** No 5-minute tape exists in this checkout
beyond the two-day EUR/USD demo, and no level ladder was archived for any market before a setup. Both lanes say
so per market, and both keep the geometry they will use written down. Nothing is estimated in place of a tape.

## Execution demo (not a scored result)

The two-day EUR/USD replay is labelled **Execution demo** everywhere it appears. Its call direction came from the
live fill record because no Layer 1 archive for 2026-11-05/06 exists in this checkout, so both model slots carry
the same call and the panel says so instead of implying a comparison.

| Account | Fills | Wins | Losses | Average R | Ending balance | Max drawdown |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Current / full 5R | 6 | 2 | 3 | +1.17R | £106,972.00 | £2,171.40 (1.99%) |
| Challenger / full 5R | 6 | 2 | 3 | +1.17R | £106,972.00 | £2,171.40 (1.99%) |
| Current / half 3R | 10 | 4 | 4 | +0.80R | £108,113.00 | £3,308.20 (2.97%) |
| Challenger / half 3R | 10 | 4 | 4 | +0.80R | £108,113.00 | £3,308.20 (2.97%) |

The endings differ by £2-3 from the ledgers reported at `5d488ef5` (£106,975.47 and £108,115.93) because the
accounts round to the instrument's lot step on each fill while the ledger rounds on a different basis. Gross of
spread, commission and slippage, two sessions, one pair, one call direction: this is an execution demo, and no
scored 5R or 3R figure is publishable from it.

The benchmark block carries the historical hourly ADR study under its own label (`Benchmark, not a challenger`),
with the note that it measures a 09:30 ET to 16:00 ET horizon on a lagged broad index and is therefore never
counted as one of the four tests.

## Isolation and what the panel may claim

- The engine writes only inside `backtester/tmp/usd-session-research/layer1-backtester/`; the path guard refuses
  every production tree, and a test proves the refusal.
- Publishing is a separate, explicit `--publish` step that re-reads the written file, checks it hashes to the
  research copy, and refuses an artefact missing the North Star, any of the four tests, the progress or coverage
  blocks, or the provenance list.
- Nothing in the run reads the network, the warehouse, the dispatcher, the live trader or an order-routing path.
  No workflow, credential, Layer 1/2 snapshot, weight, feed or status is touched.
- The panel states on every tab that the figures are research only, that the demo is a demo and that the ADR
  study is a benchmark. No number here is an edge claim.

## What would move each lane forward

1. A licensed ICE cash DXY history with 05:00 and next-05:00 London prints unlocks test ① and the second column
   of test ②.
2. Archived 5-minute tapes plus pre-session level ladders per market unlock tests ③ and ④, and with them a real
   four-account comparison rather than a demo.
3. The delivered 25-factor adjudication replaces challenger v0, under a new version string and a fresh freeze;
   nothing in v0 may be tuned against these results in the meantime.
4. A German 2-year series cache, a US event history that reaches the cutoff and historical Fed-bias snapshots
   would let the current model's own F3, F7 and F8 speak, and therefore let it reach its own high bands.
