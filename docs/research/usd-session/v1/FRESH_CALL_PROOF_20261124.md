# Fresh-call proof: the Cloud child computes the call (2026-11-24)

## The question

`run-v1.json` keeps a morning's cutoff inputs and the call that came out of them on the same row, so a
child that repeated the row would agree with it. The question is narrower: given only what the parent
sends - one morning's inputs, a model name, a validation label - does the deployed child *derive* the
direction, the conviction, the eligibility and the seven per-market results itself?

## What the rehearsal sends

`scripts/prove_usd_l1_fresh_call.js` executes the committed parent nodes and the child wrapper in this
checkout, with the HTTP fetch replaced by a local read of `run-v1.json`; the child receives the payload
the select and bind nodes build from a dataset document (`rehearsal.child_inputs_are_production_shaped`
is `true`). Every case is stripped of `models` and `results` before it is sent. Eight cases: both
published mornings for both challenger builds, once as `call_only` and once with that session's outcomes
attached so the scoring can be recomputed as well.

| Morning | Published call | Cases |
| --- | --- | --- |
| 2024-01-10 | BULLISH, conviction 2 | challenger and challenger_v1, `call_only` and scored |
| 2024-03-26 | BEARISH, conviction 2 | challenger and challenger_v1, `call_only` and scored |

The keys the child actually received are recorded rather than described, for the two 2024-01-10 `call_only`
payloads (one per model): `batch`, `batch_total`, `dataset_meta`, `dataset_window`, `date`, `model`,
`registry_fingerprint`, `registry_version`, `requested_models`, `session`, `session_found`, `tests`,
`validation` - and `session` carries `inputs`, `saved_inputs`, `input_meta`, `cutoff_at_utc`,
`endpoint_at_utc`, `window_hours`. No direction, no conviction and no status appears anywhere in those keys:
`prediction_fields_present` is empty on both inspections, and it is also recorded on all eight cases, so the
scored ones are covered too. The two payloads are scanned with their `outcomes` block excluded, and that
exclusion is written down (`payload_inspection[].not_scanned: ["outcomes"]`) rather than glossed.

## What it returns

| Claim | Result |
| --- | --- |
| Calls identical to the published row | 8 of 8 |
| Scored outcomes identical, where the session has outcomes | 4 of 4 |
| Single-input probes | 110 |
| Probes that moved direction, conviction or status | 27 |
| Inputs that can move a call | 8: `broad_dollar_d5_pct`, `eurusd_d5_pct`, `gold_d5_pct`, `nasdaq100_d5_pct`, `us_10y_real_d5_bps`, `us_2y_d5_bps`, `usdjpy_d5_pct`, `vix_d5_chg` |

`verdict.status` is `recomputed_from_cutoff_inputs`, with `blocking` empty. The probes negate one saved
input at a time and re-run the same child; that a quarter of them move the call is what separates
recomputation from a lookup, since a lookup would be unmoved by all 110.

## The captured Cloud execution, 7260

The rehearsal runs in the checkout, so one real execution is kept beside it rather than a claim that one
exists. `scripts/capture_usd_l1_fresh_call.js --date 2024-01-10` read the parent's active state (`false`),
activated it for exactly this call, posted the request, pulled the execution and deactivated it again -
`activated_for_capture` and `deactivated_after_capture` are both `true` in the record.

| Item | Value |
| --- | --- |
| Instance | `https://silver17.app.n8n.cloud` |
| Parent | `89uk5JnPbWPL5lGD`, "USD Layer 1 - paired controller (Cloud)" |
| Execution | [7260](https://silver17.app.n8n.cloud/execution/7260) |
| Children | [7261](https://silver17.app.n8n.cloud/execution/7261) challenger `giGJKNQw5WLh1xbX`, [7262](https://silver17.app.n8n.cloud/execution/7262) challenger_v1 `42sxXHScRvE3qSTX` |
| Request | `dates: ["2024-01-10"]`, `models: ["challenger", "challenger_v1"]`, `validation: "structural"`, dataset from the published `run-v1.json` URL |
| Returned | BULLISH, conviction 2, `allowed`; EURUSD miss, XAUUSD miss, XAGUSD no_outcome, NAS100 miss, BTCUSD flat, WTIUSD no_outcome, GBPUSD no_outcome |
| Capture | `data/usd-layer1-backtester/n8n/execution-7260-fresh-call.json`, sha256 `5b7147180f912e4055128c496cbcec403baef8ac221c97c2e968cbfec13e89e1` |
| Agreement | `verdict.live_call_agrees_with_recomputation` and `live_call.agrees_with_recomputation` are both `true`, captured `2026-11-24T06:43:03Z` |

The captured call and the seven outcomes are the recomputation's, for both models. A mismatch would be a
blocking reason in `verdict.blocking`, not a footnote, and the record would then say so.

## The identity the record pins

| Field | Value |
| --- | --- |
| Bundle | `usd-l1-cloud-runtime-v3`, 124,084 bytes, sha256 `9c722a0efc8554212f5b5eae98fcd539b16c33c6b91b6f3c1e5b37092b6ad7e1` |
| Sources | the 16 files in `deployed_identity.source_files`, from `contracts.js` to the child wrapper |
| Parent id | `deployed_identity.parent_workflow_id: 89uk5JnPbWPL5lGD`, with `parent_workflow_id_source: "the captured execution 7260"` - the committed parent workflow file carries no `id`, so the record names where the id came from instead of leaving it unattributed |
| Children | challenger `giGJKNQw5WLh1xbX`, challenger_v1 `42sxXHScRvE3qSTX`, fixture `kaWqy2iYIz8UzPRS` (registered, not a research model) |

## What this does not claim

- no accuracy, hit rate, edge or predictive advantage;
- one captured execution is one morning, kept because it is inspectable, not a survey;
- the rehearsal does not exercise the parent's HTTP node - that dataset was read from the checkout;
- saved inputs are not shown to be known before the cutoff; that is the receipted validation mode's
  question, and this record answers the structural one.

## Reproduce

```bash
node scripts/capture_usd_l1_fresh_call.js --date 2024-01-10   # spend one Cloud execution and keep it
node scripts/prove_usd_l1_fresh_call.js --write               # recompute and write this record
node scripts/prove_usd_l1_fresh_call.js --check               # prove the committed record follows from run-v1.json, the bundle and the capture
node --test tests/usd_l1_fresh_call.test.js                   # the same claims as assertions
```

`npm run capture:usd-l1-fresh-call`, `npm run prove:usd-l1-fresh-call` and
`npm run check:usd-l1-fresh-call` are the same three steps. `npm run test:usd-l1-n8n` runs the proof
beside the Cloud workflow, map, ledger and sweep suites: 41 tests, 7 of them in
`tests/usd_l1_fresh_call.test.js`, including "the committed proof is what this checkout recomputes",
"a row stripped of its stored call still carries the cutoff inputs", "the identity the record pins is the
bundle the manifest pins" and "the captured Cloud call is the same call, from the same workflow, on the
same morning".

## Files

| File | Role |
| --- | --- |
| `data/usd-layer1-backtester/n8n/fresh-call-v1.json` | the record: cases, probes, payload inspection, capture, verdict |
| `data/usd-layer1-backtester/n8n/fresh-call-live-v1.json` | the capture's own record, written by the capture step and read by the proof |
| `data/usd-layer1-backtester/n8n/execution-7260-fresh-call.json` | the captured execution, hashed in the record |
| `scripts/prove_usd_l1_fresh_call.js` | rehearsal, recomputation, `--write` / `--check` |
| `scripts/capture_usd_l1_fresh_call.js` | activate, post, capture, deactivate |
| `tests/usd_l1_fresh_call.test.js` | the record's claims as assertions |
| `automation/n8n/usd-l1-cloud-workflows.manifest.json` | the bundle identity the record must match |
