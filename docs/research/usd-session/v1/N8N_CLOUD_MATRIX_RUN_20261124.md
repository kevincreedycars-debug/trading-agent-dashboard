# The market x test matrix through n8n Cloud, 2026-11-24

Research only. No workflow in this note places a trade, sizes a position, writes a runtime table or is
scheduled. The parent runs from a header-authenticated webhook that was activated for the two runs below
and deactivated immediately afterwards.

## What was wrong with the deployed pair

The parent fetched the published artefact, selected one morning's row and passed that row to the children.
The controller reads the market selection from the dataset's `market_matrix`, and the row alone does not
carry it — so every Cloud execution fell back to the four markets hard-coded in `contracts.MARKETS` and
scored them, whatever the artefact declared. The bundle identity had a second gap: it hashed the ten bundled
modules but not the six templates that shape the runtime and the workflow glue, so `evaluateOne` could change
without the hash changing.

## What was deployed

| item | value |
| --- | --- |
| instance | `https://silver17.app.n8n.cloud`, project `ISQG9XU7TGTT6Fcu` |
| parent | `USD Layer 1 - paired controller (Cloud)` — `89uk5JnPbWPL5lGD` |
| children | `giGJKNQw5WLh1xbX` (v0), `42sxXHScRvE3qSTX` (v1), `kaWqy2iYIz8UzPRS` (fixture) |
| bundle | `usd-l1-cloud-runtime-v3`, 124,084 bytes, source-set hash `9c722a0efc8554212f5b5eae98fcd539b16c33c6b91b6f3c1e5b37092b6ad7e1` |
| identity covers | 10 modules + 6 templates (`usd-l1-cloud-runtime.tmpl`, parent config/select/bind/combine, child wrapper) |
| deployed at | 2026-11-24T05:23Z, every node and every code blob verified equal to the committed files after the write |

The fix is glue, not engine: the parent copies `dataset_meta.market_matrix` and `dataset_meta.markets` from
the artefact it fetched, `evaluateOne` builds the controller's dataset with them, and the combine node reports
the matrix back in `identity.test_configuration.market_matrix` so the execution states which selection it ran.

## The two executions

Both used the same workflow, the same children and the same engine. Only the dataset differed.

| configuration | parent | children | selection | combinations | result |
| --- | --- | --- | --- | --- | --- |
| published artefact | [7212](https://silver17.app.n8n.cloud/execution/7212) | 7213, 7214 (v0) · 7215, 7216 (v1) | DXY + EURUSD, XAUUSD, XAGUSD, NAS100, BTCUSD, WTIUSD, GBPUSD | 24 | 2024-01-10 `allowed` BULLISH, 2024-03-26 `allowed` BEARISH, both models |
| four-market cut | [7218](https://silver17.app.n8n.cloud/execution/7218) | 7219, 7220 (v0) · 7221, 7222 (v1) | DXY + EURUSD, XAUUSD, GBPUSD | 12 | same two mornings, same calls, `scored_markets` reduced to the three additional markets |

The four-market cut is `data/usd-layer1-backtester/n8n/datasets/run-4market-3test-v1.json` (48,855 bytes),
built by `scripts/build_usd_l1_matrix_config_dataset.js` from `run-v1.json` (sha256 `90800e10…3ebf39`): the
two session rows are copied byte for byte, only `run.markets` and `market_matrix` are replaced, and the
subset records the source file and its hash. The parent fetched it over https from `main` and the controller
scored the markets the document names — no code change, no second engine.

## Persistence and inspection

- Captures: `data/usd-layer1-backtester/n8n/batch-matrix-24-20261124T0525Z.json` and
  `batch-config-4market-20261124T0530Z.json`.
- Ledger: 733 records over 726 unique mornings, 1,467 model calls, 45 runs; the two captures add two
  configurations (`031be71c…`, `52dbe87b…`). Every row re-verifies: `npm run check:usd-l1-ledger` →
  `ledger reproduces`, 0 verification failures.
- Evidence: `data/usd-layer1-backtester/n8n-execution-evidence-v1.json` (bundle `9c722a0e…`), claims
  `consistency: established`, `historical_availability / model_logic / coverage: not_established`.
- Dashboard: `backtesting.html#n8nmap` draws the recorded mornings from the evidence file; the Tests tab
  shows the configured matrix with `measured_tick_replay` / `blocked` cells from the run artefact.

## Two verification corrections this required

1. The ledger replayed a record against `run-v1.json` whatever dataset the run had fetched, so a faithful
   three-market run reported "test selection does not reproduce". `verifyRecord` now rebuilds the recorded
   matrix from the committed definitions of the markets the record names, and fails the check if a named
   market is unknown to the checkout.
2. `check_usd_l1_n8n_ledger.js` pinned every capture to the preserved v1 dataset. It now lets each capture
   pick its own dataset by the `generated_at` it recorded, so old evidence is not re-dated and new runs are
   not failed.

## What this establishes, and what it does not

- Establishes: the deployed workflows are the committed ones; a Cloud execution scores the markets its
  dataset declares and reports the matrix it executed; a second configuration runs through the same pair.
- Does not establish: any accuracy, edge or predictive advantage. n8n replays stored calls; it does not
  create a call, and the outcome arithmetic is recomputed at ingest against the committed panel.
- Fixtures: `fixture_constant` is registered and deployable but was not selected in either run, and the
  agreement figure counts research models only.
- Live trading: untouched. The parent is manual/webhook only, has no schedule, and is deactivated.
