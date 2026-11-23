# The market x test matrix, and what is actually ready

Research only. This file records the configuration the engine now reads, the readiness of every
market-by-test combination, the level-provenance resolution, the session-horizon verification and the
dependencies that remain. It separates three things that are easy to confuse: what the software does, what
data exists, and whether the calls predict anything.

Last measured: 2026-11-23, on `backtesting/usd-l1-session-horizon-20261123`.

## 1. The matrix is configuration, not code

The engine no longer names four markets. It reads `backtester/config/usd_layer1_market_matrix.json`:

- exactly one **primary market** - the instrument the USD call is priced on (`DXY`);
- any number of **additional markets**, each with its own series file, quote convention and
  `usd_bullish_predicts` sign;
- three tests every selected market receives: **directional accuracy**, **original L2L 5R**, **0.5 L2L 3R**.

`market_matrix.js` validates the document (one primary, no duplicate key, no unknown test, a sign that is
`UP` or `DOWN`), builds the combination ledger, fingerprints the selection for experiment identity, and
evaluates readiness per combination. Another asset set is another JSON document: `loadMatrix({ file })` and
`buildArtefact({ matrixPath })` take it without a code change. A duplicate primary is refused, not scored
twice.

The initial authorised configuration is one primary market plus the seven markets the project's own
asset order declares (`lib/research_library.js`: USD, EUR, GOLD, SILVER, NQ, BTC, WTI, GBP):

| Market | Role | Asset | Sign if USD is bullish | Cached one-hour series |
| --- | --- | --- | --- | --- |
| DXY | primary | USD | UP | `backtester/tmp/ftmo_dxy_cash_h1.csv` |
| EURUSD | additional | EUR | DOWN | `oanda_eur_usd_h1.csv` |
| XAUUSD | additional | GOLD | DOWN | `oanda_xau_usd_h1.csv` |
| XAGUSD | additional | SILVER | DOWN | none |
| NAS100 | additional | NQ | DOWN | `oanda_nas100_usd_h1.csv` |
| BTCUSD | additional | BTC | DOWN | `binance_btcusdt_1h.csv` |
| WTIUSD | additional | WTI | DOWN | none |
| GBPUSD | additional | GBP | DOWN | none |

That is 8 markets x 3 tests = **24 combinations per strategy**. The artefact carries them as
`market_matrix.combinations` and the readiness block as one row per market per test. The North Star sentence
stays the programme's original question and is unchanged; the matrix is the measurement arrangement behind it.

## 2. Readiness: 24 combinations, 5 scored, 19 blocked with a reason

The counts below are the run's own (`run-v1.json -> market_matrix.readiness.run_counts`): `scored` 4,
`proxy_scored` 1, `blocked` 19. A blocked combination is not a zero; it names the missing dataset.

| Market | Directional accuracy | Original L2L 5R | 0.5 L2L 3R |
| --- | --- | --- | --- |
| DXY | **proxy_scored, 205 sessions** (broker DXY.cash, not ICE) | blocked: no 5-minute tape, no level ladder for the index | blocked: same |
| EURUSD | **scored, 314 sessions** | blocked: mid-price M5 only (no bid/ask), no pre-session ladder for those dates | blocked: same |
| XAUUSD | **scored, 340 sessions** | blocked: mid-price M5 only, no pre-session ladder | blocked: same |
| XAGUSD | blocked: no cached one-hour series (`oanda_xag_usd_h1.csv`) | blocked: no tape, no ladder | blocked: same |
| NAS100 | **scored, 327 sessions** | blocked: mid-price M5 only, no pre-session ladder | blocked: same |
| BTCUSD | **scored, 386 sessions** | blocked: mid-price M5 only, no pre-session ladder | blocked: same |
| WTIUSD | blocked: no cached one-hour series (`oanda_wti_usd_h1.csv`) | blocked: no tape, no ladder | blocked: same |
| GBPUSD | blocked: no cached one-hour series (`oanda_gbp_usd_h1.csv`) | blocked: no tape, no ladder | blocked: same |

Three different blockers are being kept apart on purpose:

1. **No session-outcome series** - XAGUSD, WTIUSD, GBPUSD. The direction test cannot price either 05:00
   endpoint, so it is blocked. Adding the file releases the combination with no code change.
2. **No actionable tape** - the four markets with an M5 sample hold *mid-price* bars and a spread column,
   never separate bid and ask, so no fill cost can be reconstructed. They are blocked even though a tape
   exists, and the reason says so.
3. **No pre-session ladder** - the archived ladder covers 2026-10-05 to 2026-10-12; the M5 sample covers
   2026-11-04 to 2026-11-06. No single session has both, so the L2L read is blocked by absence of a shared
   session, not by a rule that was relaxed.

The DXY direction figure is `proxy_scored`: it is the broker's spot CFD on the dollar-index basket, labelled
with its own name. Official ICE cash DXY is a licence question (section 6), not a software one.
## 3. Where the configuration travels

| Surface | What carries it | Evidence |
| --- | --- | --- |
| Engine scoring | `outcomes.js`, `tests.js` and `run.js` take the configured market list; nothing names a market | `tests/usd_l1_market_matrix.test.js`, `backtester/tests/usd_l1_market_matrix.test.js` |
| Run artefact | `market_matrix` (selection, fingerprint, 24 combinations, readiness), `run.markets`, per-test market rows | `data/usd-layer1-backtester/run-v1.json` |
| Experiment identity | `run.market_matrix_id` / `market_matrix_fingerprint`; the n8n controller records `test_configuration.market_matrix` from the dataset it fetched | `backtester/lib/usd_layer1_backtester/backtest_controller.js`, `automation/n8n/usd-l1-backtest-controller.workflow.json` |
| Persistence | the ledger's per-record `configuration` digest covers the dataset snapshot, so a different matrix is a different experiment | `data/usd-layer1-backtester/n8n/run-ledger-v1.json` (reproduces) |
| Comparisons | per-market current-vs-challenger rows for every configured market | `tests.four_markets.comparisons.markets` |
| Dashboard | the Tests tab renders the matrix table, status and the missing-dataset tooltip per cell | `data/usd-layer1-backtester/backtesting-screen-v1.json -> market_matrix`, `backtesting.html` |
| n8n Cloud | the bundle's controller scores the dataset's markets; the parent's summariser derives the market list from the declared configuration or the decisions themselves | `automation/n8n/*.cloud.workflow.json`, rebuilt 2026-11-23 |

## 4. Level provenance: resolved without back-dating

The committed v1 artefact prices six sessions (2026-10-05 to 2026-10-12) from a 22-level ladder stamped
`2026-10-04T16:14:19Z`. Three independent facts place that ladder before the first session:

| Fact | Value |
| --- | --- |
| Ladder stamp | `2026-10-04T16:14:19Z` |
| Latest hand mark | `2026-10-04T15:28:46.601Z` |
| Git commit that published it | `5262f8d2`, `2026-10-04T20:02:52+01:00` = `19:02:52Z` |
| First priced session start | `2026-10-05T04:00:00Z` |
| Ladder sha256 | `a5dc10a32e0ccb50a0eb816b649d1e6cb0dd35a647c04c1e6f03dfb4b4793704` |
| Hash recorded by the published tick sweep | the same `a5dc10a3...`, six sessions |

The snapshot is now committed at `data/usd-layer1-backtester/level-snapshots/l2l-levels-2026-10-04T16-14-19Z.json`
with an index that records the hash, the git commit and the timing above. `level_provenance.js` resolves each
session against **the latest archived snapshot that precedes it**, so:

- the six sessions are priced by the archived snapshot (6 per lane);
- the live `data/l2l-levels.json`, re-marked automatically on 2026-11-23 at `16:20:57Z`, prices **0** of them;
- an edited snapshot is refused: the loader verifies the indexed sha256 and reports a problem instead of using it.

That is the whole rule, and it is why owner approval cannot make an unavailable historical level
contemporaneous: eligibility is a comparison of two timestamps, not a judgement about intent. The earlier
result is not withdrawn; it is bound to the snapshot that actually produced it. The v1 build is preserved
byte for byte at `data/usd-layer1-backtester/run-v1-superseded-20261114.json` (sha256 `0fea0347...61f3`) and
the supersession record is `data/usd-layer1-backtester/run-v1-supersession.json`.

What the six sessions still are not: a measured L2L result. Six sessions on a hand-marked grid, priced from
a tick sweep, are evidence that the rule can be replayed. They are not a sample from which a 5R or 3R
edge can be claimed.
## 5. Session horizon: verified at the endpoint, for pricing and for both simulations

The contract is 05:00 `Europe/London` to 05:00 `Europe/London` on the next local date. Three code paths read
that window, and each now has a test that fails if it drifts:

| Path | What the test proves | Where |
| --- | --- | --- |
| Outcome pricing | the close is read at the following 05:00 London bar, and a bar from the next session (a 500 vs 90 print in the fixture) is never read as this session’s close | `tests/l2l_session_horizon.test.js` |
| L2L full 5R | a tape is cut to `[cutoff, endpoint)` before the path is walked; a candle stamped exactly at the endpoint that would reach the target is dropped and counted, and the position is closed at the last in-session close (`closed_at_session_end: true`) | `lib/layer1_backtesting/l2l_simulation.js#sessionTape`, `#simulateSessionPath` |
| L2L half 3R | the same bound and the same close-at-session-end behaviour on the midpoint grid | same |

The clock-change cases are explicit: 2026-03-27/30, 2026-10-23/26 and 2027-03-26/29 each measure exactly 24
hours with both ends at 05:00 London (GMT before the change, BST after). The Saturday starts that contain the
London transition measure 23 hours (2026-03-28) and 25 (2026-10-24) and `isSessionStart()` refuses both. All
261 Monday-to-Friday starts in 2026 measure 24 hours.

**Which existing results needed recomputation.** None of the 725 calls, the direction outcomes, the flat bands
or the lead numbers moved: they were already built on the contract’s 05:00-to-05:00 day. What was recomputed
is what the matrix and the provenance rule change: the run artefact itself (now v2), and the artefacts derived
from it — the layer 1 report and its markdown, the backtesting screen, the morning run and its markdown, the
model comparison, the four platform artefacts. All are rebuilt and their checks reproduce. The published
tick sweep was **not** re-run: its ladder hash and its six sessions are unchanged, and re-running it would
create a second artefact from the same evidence.

## 6. What remains, separated by kind

| Dependency | Kind | State | What would close it |
| --- | --- | --- | --- |
| XAGUSD, WTIUSD, GBPUSD one-hour series | data availability | blocked, named per market | cache the three series; no code change |
| Actionable bid/ask M5 tape per market | data availability | blocked (mid-price only, 0 bid/ask series) | broker bid/ask history |
| Pre-session level ladders for those tape dates | data availability | blocked (0 pre-session ladders; the archived ladder covers different dates) | snapshot the marking tool at 04:55 London per session |
| Official ICE cash DXY | licence / source decision | blocked; broker `DXY.cash` proxy is labelled and scored beside it | ICE sample or licence with 05:00 and next-05:00 prints |
| Contemporaneous 05:00 input captures | data availability | 0 receipts; every value is a reconstruction | archive one capture per morning |
| H1 eligibility 0 of 725 | **a measured result**, not a decision | measured | it moves only if the two pending rule/source decisions are settled: the gold identity/licence and the calendar vintage (D5, D6 in `H1_RULE_RESOLUTIONS_20261120.md`) |
| Broker cost schedule | data availability | accounting runs on a labelled fixture | commit the broker’s dated commission and spread schedule |
| Predictive advantage | research | not established, and not claimed | pre-registered tests on unseen mornings |

The first two columns are not interchangeable. Software completion is high: the matrix, the snapshot-bound
provenance, the bounded simulations and the accounting all exist and are tested. Data availability is low:
three markets have no series, no market has an actionable tape, and no morning has a contemporaneous capture.
Predictive advantage is unknown: nothing in this lane measures it yet, and six sessions cannot.
## 7. Reproduce

```
node backtester/scripts/run_usd_layer1_backtest.js --generated-at 2026-11-14T00:00:00.000Z --publish
npm run build:usd-l1-platform      # four platform artefacts from the published run
npm run check:usd-l1-platform      # recompute and compare, no writes
npm run test:usd-l1-platform       # modules, retrieval, spec check, accounting, traces, matrix, snapshots
npm run test:l2l-simulation        # frozen path engine + session-bound simulations + horizon cases
npm run report:layer1 && npm run report:layer1:check
npm run screen:backtesting && npm run screen:backtesting:check
npm run report:morning && npm run report:morning:check
npm run check:usd-l1-ledger        # re-merges the captures against the preserved v1 dataset
```

The published build is deterministic for a fixed `--generated-at`: the artefact published on 2026-11-23 is
sha256 `adad65fdc7976cd4b70ccfa56c2955e861fa398f06e66f6fa8d2bce275543dc7`, 7,056,949 bytes.
