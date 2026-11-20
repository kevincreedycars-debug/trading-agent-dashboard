# Reusable USD Layer 1 n8n backtester — completion checklist

Research only. No workflow is scheduled, no webhook is left authenticated, and no order, stop, size, feed or
runtime table is read or written by anything in this lane. This file is the durable checklist: it is the
place to look to answer "what works, what is evidenced, and what is next" without reading the code.

Last measured: 2026-11-20, on the batch/restart milestone.

## 1. Milestone: two models, one controller, small range, validated, persisted, scored, inspected

| Criterion | Status | Evidence |
| --- | --- | --- |
| Two interchangeable models through the same n8n controller | **works** | parent `89uk5JnPbWPL5lGD` binds `giGJKNQw5WLh1xbX` (`usd-layer1-challenger-v0`) and `42sxXHScRvE3qSTX` (`usd-layer1-challenger-v1`); four recorded cases 5471–5482 in `data/usd-layer1-backtester/n8n-execution-evidence-v1.json` |
| A small date range, not one hand-picked date | **works** | execution `5505` (2024-01-02…04, 3 paired records) and `5512` (2024-01-02…09, 6 paired records); captures `data/usd-layer1-backtester/n8n/batch-20261120-*.json` |
| Independently validated calls | **works** | `lib/backtesting_n8n_run_ledger.js` replays each recorded call through the local controller and recomputes the four outcome columns from the panel; 9 of 9 ledger rows verify, 0 mismatches; a tampering test flips a direction and is caught |
| Saved before scoring | **works** | the ledger row stores `calls` (what the child returned) and `verification` (local replay + outcome arithmetic) separately; a failed check keeps the row with `verified: false` |
| Persisted results | **works** | `data/usd-layer1-backtester/n8n/run-ledger-v1.json` (9 rows, 4 runs, every row linked to its n8n execution) |
| Outcome scoring | **works** | four comparison markets per allowed row, recomputed independently; blocked and abstained rows carry no result |
| Dashboard inspection | **works** | `backtesting.html#n8nmap` → "Batch runs, restart recovery and independent checks" (persisted mornings, verified rows, duplicates prevented, run history, direct execution links) |
| Invalid-input rejection | **works** | `5525` receipted gate blocks 2024-01-10 and 2024-01-11; `5530` absent date 2024-01-06 blocks `not_in_dataset`; `5534` impossible date `2024-13-01` is refused at "Run configuration" with `date is not a real calendar day` |
| Restart recovery without duplicate results | **works** | `5505` (3 mornings) then `5512` (same 3 + 3 new): 3 records added, 3 duplicates prevented; re-ingesting `5512` again adds 0 and leaves the ledger file byte-identical (`--check` reproduces, 12 duplicates skipped, 4 runs) |
| Synthetic fixtures labelled and excluded | **works** | no synthetic fixture is in the ledger; the only fixtures in this lane remain the H1 package fixtures, labelled and unscored, and they never enter a paired record |


## 2. The five platform requirements

| # | Requirement | Status | Where it lives |
| --- | --- | --- | --- |
| 1 | Replaceable Layer 1 sub-workflows owning their data requirements, retrieval and analysis; versioned call, conviction, trade/no-trade, input evidence and calculation trace; no future-outcome access | **works** (two versions; a third is a new child built from a new model file, not an edit to the parent) | child workflows `giGJKNQw5WLh1xbX`, `42sxXHScRvE3qSTX`; bundle `automation/n8n/usd-l1-cloud-runtime.js`; contract `backtester/lib/usd_layer1_backtester/backtest_controller.js` |
| 2 | Reusable controller: model/date/market/test selection, 05:00 London session and DST, progress and evidence, retries and restart without duplicates | **works** for models, dates, validation modes, progress and restart; **partial** for "select tests" (tests are published metadata, not a controller input) | `backtester/lib/usd_layer1_backtester/backtest_controller.js`; `backtester/lib/usd_session_engine_interface.js`; `scripts/persist_usd_l1_n8n_runs.js` |
| 3 | Independent validation: availability, sources, inputs, freshness, transformations, rule calculations; save calls before scoring; separate invalid inputs, abstentions, technical failures and missing outcomes | **works**: gate (`structural`, `receipted`), dataset join, local replay, outcome arithmetic; technical failures get their own schema `usd-l1-n8n-technical-failure-v1` and are rejected by the ledger; missing outcomes are `no_outcome`, never zero | `backtest_controller.js` `validateSnapshot`; `lib/backtesting_n8n_run_ledger.js` `verifyRecord`; parent node "Compare the two decisions" |
| 4 | Four test modules: DXY directional accuracy; EUR/USD, gold, Nasdaq and BTC with explicit mappings; original L2L 5R; half-L2L 3R; costs, ambiguity, coverage, shared dates, uncertainty, equity and drawdown at $100,000 and 1% risk | **partial**: test 1 (`dxy_direction_broker_cfd`) is scored as a broker proxy; test 2 (`four_markets`) is scored without costs; tests 3 and 4 are `blocked` on 0 usable sessions (no contemporaneous level grid, no actionable M5 tape); no equity/drawdown curve yet | `data/usd-layer1-backtester/backtesting-screen-v1.json` `tests`; `lib/layer1_backtesting/` |
| 5 | Live dashboard retaining the shared heading/sidebar; model/date selection; interactive 3D map of the real n8n architecture and recorded runs; inputs, checks, calculations, calls and outcomes; direct n8n links and plain-English explanations | **works** for the map, model/case selection, recorded runs and links; the batch ledger is now inspectable inside the same view; a true 3D canvas is still the 2D board | `backtesting.html#n8nmap`; `lib/backtesting_n8n_map.js`; `data/usd-layer1-backtester/n8n/run-ledger-v1.json` |

## 3. Recorded runs behind this checklist

| Parent execution | Dates | Validation | Records | Outcome | Capture |
| --- | --- | --- | --- | --- | --- |
| 5505 | 2024-01-02, 01-03, 01-04 | structural | 3 | all abstained (no call) | `batch-20261120-5505-structural.json` |
| 5512 | 2024-01-02 … 01-09 (6 weekdays) | structural | 6 | 1 allowed, 5 abstained; 3 rows already held | `batch-20261120-5512-restart.json` |
| 5525 | 2024-01-10, 01-11 | receipted | 2 | blocked, `receipted_incomplete` | `batch-20261120-5525-receipted.json` |
| 5530 | 2024-01-06 (absent from panel) | structural | 1 | blocked, `not_in_dataset` | `batch-20261120-5530-absent-date.json` |
| 5534 | 2024-13-01 (impossible date) | structural | 0 | refused at "Run configuration" | `batch-20261120-5534-invalid-date.json` |

Every row in the ledger carries its own parent and child execution links. The ledger is regenerated from the
captures above, never typed in by hand.

## 4. Reproduce

```
npm run build:usd-l1-n8n     # rewrite the three Cloud workflows and the bundle from the manifest
npm run test:usd-l1-n8n      # 24 tests: bundle, children, parent wiring, batch mode, map, ledger
npm run persist:usd-l1-n8n -- --capture data/usd-layer1-backtester/n8n/batch-20261120-5505-structural.json \
  --capture data/usd-layer1-backtester/n8n/batch-20261120-5512-restart.json \
  --capture data/usd-layer1-backtester/n8n/batch-20261120-5525-receipted.json \
  --capture data/usd-layer1-backtester/n8n/batch-20261120-5530-absent-date.json --check
npm run status:usd-l1-n8n -- --from 2024-01-02 --to 2024-01-09
```

`--check` exits non-zero when the committed ledger is not the merge of the committed captures. On 2026-11-20
it reported `ledger reproduces`, 0 added, 12 duplicates skipped, 4 runs.

## 5. What remains

| Item | Why it is not done | Next step |
| --- | --- | --- |
| All 725 mornings through n8n | the controller caps a run at 40 mornings so one execution stays inspectable; 725 needs chunked batches | run the ledger's `resumePlan` over the panel in chunks and ingest each capture; no code change is required |
| Tests 3 and 4 | 0 usable sessions: no contemporaneous level grid and no actionable bid/ask M5 tape | acquire the staged level grid and M5 tape; do not relax the readiness rule |
| Costs, equity and drawdown | tests 1 and 2 are gross directional replays with no execution cost or sizing curve | add cost and sizing to the outcome layer as an explicit, labelled module, then publish the curve |
| Official ICE DXY | series absent from the checkout | ICE sample/licence; the broker proxy stays labelled |
| H1 eligibility | 0 of 725; `gold` (identity/licence) and `calendar` (no vintage-stamped schedule) are the only movable inputs | owner decisions D5 and D6 in `H1_RULE_RESOLUTIONS_20261120.md` |
| A true 3D architecture view | the board is a two-column inspection map, not a 3D canvas | build the 3D map as a renderer over the same evidence and ledger, keeping the existing selection and links |

H1 gold/calendar blockers and the pending H1-A02 amendment are tracked in the H1 checklist, not here. They
are not prerequisites for the platform work above.

