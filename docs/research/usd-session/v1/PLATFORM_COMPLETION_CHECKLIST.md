# Reusable USD Layer 1 n8n backtester — completion checklist

Research only. No workflow is scheduled, no webhook is left authenticated, and no order, stop, size, feed or
runtime table is read or written by anything in this lane. This file is the durable checklist: it is the
place to look to answer "what works, what is evidenced, and what is next" without reading the code.

Last measured: 2026-11-21, after the configurable-model, durable-execution, identity, claim-separation and
725-morning sweep work. Supersedes the 2026-11-20 edition (that edition described a two-model, nine-record
ledger; the differences are recorded in section 6).

## 1. Model selection is configuration, not code

| Criterion | Status | Evidence |
| --- | --- | --- |
| One registry owns the model list | **works** | `backtester/lib/usd_layer1_backtester/model_registry.js`; entries carry key, identity, label, role (`control`/`challenger`/`fixture`), kind, version, source, score field and the model-owned input contract |
| Controller accepts any registered set | **works** | `MODEL_IDS` = `current, challenger, challenger_v1, fixture_constant`; `resolveLayer1` delegates to the registry; a caller-supplied adapter is still accepted (`backtester/tests/usd_l1_backtest_controller.test.js`) |
| Output schema, ledger, comparisons and map accept any set | **works** | record schema `usd-l1-n8n-cloud-execution-v2` carries `selection` and per-model role; `lib/backtesting_n8n_run_ledger.js` keys on the record's own selection; `lib/backtesting_n8n_map.js` derives its options from the evidence; `scripts/build_usd_l1_model_comparison.js` iterates the registry |
| A third model added by registration | **works** | `fixture_constant` registered, bundled, generated, imported (`kaWqy2iYIz8UzPRS`) and run (parent execution `5557`) with no edit to the controller, schema, ledger, comparison or map |
| A fixture is labelled a fixture, not a research model | **works** | registry `kind: "fixture"`; record `models.fixture_constant.fixture: true`; ledger cell `· FIXTURE`; map option `· FIXTURE (not a research model)`; comparison row `(excluded from research)` |
| Selection is validated at the edge | **works** | the Cloud config node refuses an unknown key, refuses `current` (registered but not bundled) with its reason, de-duplicates, caps at 4, and defaults to the two frozen research challengers |

## 2. Durable execution and recovery

| Criterion | Status | Evidence |
| --- | --- | --- |
| Execution capture is automated | **works** | `scripts/run_usd_l1_n8n_sweep.js` posts, parses, persists and reports; no manual response copying |
| Validation and atomic persistence | **works** | every response is merged through `lib/backtesting_n8n_run_ledger.js` (local replay + outcome arithmetic) and written with a temp-file rename |
| Resume from stored progress | **works** | the plan is recomputed from the ledger before every request; an identical retry of a complete configuration sends **0** requests |
| Failed attempts retained | **works** | `ledger.attempts` holds 43 attempts, 4 failed; the four are the deployment defects described in section 5 |
| Concurrent duplicate writes prevented | **works** | `data/usd-layer1-backtester/n8n/.sweep.lock` (exclusive create, pid + time); a second sweep refuses instead of writing |
| Authenticated execution restored | **works** | `scripts/bootstrap_usd_l1_webhook_credential.ps1` creates the n8n header credential (`1qsqdki9dxqbm4Zx`, header `X-USD-L1-Token`), stores the token only in the encrypted local CLIXML store, and reports only the id |
| No secret in the repository or the dashboard | **works** | the token is never printed or written under the repo; `scripts/secrets/` and `**/credentials-*.clixml` are now ignored; the dashboard shows the credential id, never the value |

## 3. Experiment identity

| Criterion | Status | Evidence |
| --- | --- | --- |
| Identity includes model and code versions | **works** | `identity.models[*]` (identity, version, role, kind, source, input-contract version) and `identity.code` (bundle version + `bundle_sha256`, controller version) |
| Identity includes the input snapshot | **works** | `identity.input` (dataset path, run version, per-morning date) plus `input_snapshot_digest`, a hash of the replayed values and outcomes for that morning |
| Identity includes cutoff, validation policy and test configuration | **works** | `identity.cutoff`, `identity.validation_policy`, `identity.test_configuration` |
| Identical retries deduplicate | **works** | re-requesting the three-model configuration for 2024-01-10 sent 0 requests; the earlier retry of the 2-model batch added 0 and skipped 3 duplicates |
| Changed configurations coexist | **works** | 2024-01-10 holds `structural\|2024-01-10` (3 models) and `structural\|2024-01-10#7314df5a` (2 models), both consistency-verified, the second marked `coexistence: true` |

## 4. Validation claims are separate

| Claim | Status | Basis |
| --- | --- | --- |
| Replay consistency | **established** for 729 of 729 rows | each stored call reproduces in the local controller and its hit/miss/flat arithmetic recomputes from the committed outcomes |
| Historical input availability | **not established** | the children replay the committed panel; no retrieval receipt or source archive exists, so availability at the cutoff is not demonstrated |
| Model logic correctness | **not established** | parity compares the frozen rules with themselves; there is no independent adjudication |
| Panel equals a live morning | **not established** | the panel is a research artefact |

Each model also declares its own input contract (`input_contract.retrieval: "saved_panel_replay"`,
`missing_input_policy`, and the key list with its factor and rule), so the "it replays, it does not
retrieve" statement travels with the model instead of living in a caption. The dashboard renders the four
claims as four rows and never as one badge.


## 5. The 725-morning sweep

| Figure | Value | Where |
| --- | --- | --- |
| Panel sessions | 725 (2024-01-02 → 2026-10-12) | `data/usd-layer1-backtester/run-v1.json` |
| Requested mornings | 725, in 43 controlled webhook requests (20 per request, except the last) | `data/usd-layer1-backtester/n8n/sweep-0NN-*.json` |
| Unique recorded mornings | 726 (725 panel mornings plus the absent-date refusal 2024-01-06) | ledger `records[].date` |
| Records | 729 (725 structural two-model + 2 receipted + 1 three-model config + 1 two-model coexisting config) | ledger `records[].key` |
| Model calls | 1,459 | ledger `calls` |
| Consistency verified | 729 / 729 | ledger `verification.verified` |
| Failed attempts retained | 4 (all during deployment; see below) | ledger `attempts` |
| Compatible records reused | 8 mornings were already complete and were never re-requested | `resumePlan` |

Requested dates, unique dates, records and model calls are reported separately on purpose: a record can
outnumber a morning when two configurations ran on it, and a model call outnumbers a record when several
models ran on it.

The sweep also found two real defects, both now guarded:

1. The webhook's default `lastNode` response returned **only the first item**. A 20-morning request
   produced 20 records in the execution but one record in the response (`sweep-007`, execution `5574`).
   Fixed with a Respond node (`respondWith: allIncomingItems`), and the runner now records a partial
   response as a failed attempt so the uncovered mornings are re-requested instead of silently lost.
2. Service workers aside, the first version of the chained parent stopped at an unselected model: a bind
   node that returned zero items ended the chain and the webhook answered `No item to return was found`.
   Fixed with a one-item skip marker that the child returns immediately (no decision spent), which keeps
   the chain reachable without executing an unselected model.

The four retained failures are the two defects above: one combine-node syntax error caught by n8n at run
time (now caught earlier by the parse guard in `tests/usd_l1_n8n_cloud_workflows.test.js`) and three
"No item to return" responses.

## 6. Product requirements

| Requirement | Status | Evidence |
| --- | --- | --- |
| Selectable test modules | **works** | the Tests tab carries a module selector over the four committed definitions; a run's selection is recorded in `identity.test_configuration`, so two test configurations are two experiments |
| Aggregate model comparisons | **works** | `data/usd-layer1-backtester/model-comparison-v1.json` (all registered models, fixture excluded from research figures) rendered in `backtesting.html#n8nmap` → "Aggregate model comparison"; agreement pair `challenger/challenger_v1` = 481 of 481 common directional mornings |
| Execution-test data integration | **works** | `evidence.execution_index` links each recorded morning to its configuration, verification and both child executions; the map inspector opens the execution evidence from the node |
| Evidence-linked visual map | **works** | `backtesting.html#n8nmap` → "Execution map - every recorded morning": a Three.js canvas with one node per recorded morning and one per model call, click-through to the parent and child executions and the capture file; material sharing keeps 2,188 nodes usable |
| Tests 3/4: simulation vs data | **separated** | `lib/layer1_backtesting/l2l_simulation.js` implements the frozen 5R and midpoint/3R paths and is unit-tested on synthetic tapes (`tests/l2l_simulation.test.js`, 7 cases); the test definitions carry `simulation.status: implemented_and_tested` and `blocked_on: history`, and the dashboard prints both facts |

## 7. Reproduce

```
npm run build:usd-l1-n8n            # regenerate bundle + three children + parent from the registry
npm run test:usd-l1-n8n             # bundle, children, parent wiring, map, ledger, sweep planner
npm run test:l2l-simulation         # the frozen path rule engine + the aggregate comparison
npm run screen:backtesting:check    # the screen payload, including the test-module status
npm run compare:usd-l1-models       # rewrite the aggregate comparison artefact
node scripts/run_usd_l1_n8n_sweep.js --plan          # the remaining plan from the ledger; no network
node scripts/run_usd_l1_n8n_sweep.js --report        # requested / unique / records / model calls
npm run persist:usd-l1-n8n -- --capture ... --check  # the ledger is the merge of the committed captures
```

The runner reads `N8N_BASE_URL` and `USD_L1_WEBHOOK_TOKEN` from the environment or from the encrypted
local store (`scripts/local-credentials/get-secret.ps1`). It refuses to start if another sweep holds the
lock. On 2026-11-21 `--check` reported `ledger reproduces`, 0 added, 0 verification failures.

## 8. What remains

| Item | Why it is not done | Next step |
| --- | --- | --- |
| H1 eligibility | 0 of 725; gold (identity/licence) and calendar (no vintage-stamped schedule) remain the only movable inputs | owner decisions D5 and D6 in `H1_RULE_RESOLUTIONS_20261120.md` |
| Tests 3 and 4 on history | the simulator exists and is tested; no contemporaneous level ladder and no actionable bid/ask M5 tape | acquire the ladder and tape; do not relax the readiness rule |
| Historical input availability | the children replay the committed panel and no retrieval receipt exists | archive a 05:00 receipt set for the inputs each model declares |
| Costs, equity and drawdown | tests 1 and 2 are gross directional replays | add cost and sizing as a labelled module, then publish the curve |
| Official ICE DXY | series absent from the checkout | ICE sample/licence; the broker proxy stays labelled |

H1 gold/calendar blockers and the pending H1-A02 amendment are tracked in the H1 checklist, not here. They
are not prerequisites for the platform work above.
