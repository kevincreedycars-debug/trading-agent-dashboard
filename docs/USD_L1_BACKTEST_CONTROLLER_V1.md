# USD Layer 1 backtest controller v1 - one seam for every Layer 1 book

Research only. The controller replays a committed morning panel. It reads no provider, writes no warehouse row,
places no order and publishes no dashboard call. A green run is evidence that the stored decisions reproduce; it is
not evidence of live deployment, causal feature timing or trading edge.

## Why the seam exists

The engine and the shadow workflow already answer "what would the frozen book say this morning?". A controller is a
different job: decide which mornings exist, validate each one once, hand its saved values to a named Layer 1 adapter,
score the returned call against the stored outcome, and aggregate the result. That order is model-agnostic, so it
belongs in one library rather than in a second copy for every challenger.

| layer | owns | does not own |
| --- | --- | --- |
| `data/usd-layer1-backtester/run-v1.json` | the 725 stored mornings, their saved inputs and their outcomes | any decision |
| `backtester/lib/usd_layer1_backtester/backtest_controller.js` | date selection, validation, adapter call, contrarian scoring, summary, parity and comparison | model arithmetic |
| `backtester/scripts/run_usd_l1_backtest_controller.js` | a JSON-only command line over that library | a second scoring path |
| n8n `USD Layer 1 - decision` child | one morning: guard the call, invoke the CLI, return the decision record | aggregation, scoring, model choice |
| n8n `USD Layer 1 - backtest controller` | list dates, fan out one child call per date, summarise, branch on blocks | a second summary implementation |

The child is the adapter between an orchestrator and the library. The outer controller never re-scores a child
result; it only counts the records the library already produced.

## Adapter contract

A Layer 1 adapter is any object with this shape. `resolveLayer1` accepts the object directly, so a caller does not
need a built-in model id.

```js
{
  id: "my_book",                  // stable, lowercase
  label: "My book",               // human label
  version: "1.0.0",               // printed in every decision
  source: "path/to/implementation.js",
  minimumInputs: 6,               // descriptive only
  inputKeys: ["input_a", "input_b"], // what the adapter reads; used by the receipted gate
  evaluate({ date, values }) {
    return { direction: "BULLISH", conviction: 3, raw_score: 12 /* ... */ };
  }
}
```

A malformed adapter fails before a morning is read. The error names the missing fields, for example
`missing label, version, evaluate(), inputKeys[]`. The controller deep-clones `values` before calling the adapter,
so a model cannot mutate the snapshot or leak state into the next morning.

The three frozen built-ins are `current`, `challenger` and `challenger_v1`. Their `id` is the only model switch in
the CLI and the n8n configuration; the scoring code is shared.

## Validation is a gate, not a vibe

| mode | accepts a morning when | committed panel |
| --- | --- | --- |
| `structural` (default) | the date is a session in the dataset, the cutoff equals the contract cutoff, values are consistent, and no stamped print sits after the cutoff | 725 / 725 accepted |
| `receipted` | additionally, every input the selected adapter actually consumed carries a full timestamp before the cutoff | 0 / 725 accepted |

The committed artefact stores most macro prints as a date only, so `receipted` refuses every morning while
`structural` accepts every morning. Both counts are kept in `summary.validation` and in each decision
(`validation.structural_accepted` beside `validation.accepted`) so a reader cannot mistake presence for provenance.
A malformed or absent morning is `status: "blocked"` with a reason code (`not_in_dataset`, `date_not_session`,
`cutoff_mismatch`, `empty_values`, `print_after_cutoff`, `receipted_incomplete`). A blocked morning is reported, not
dropped: `selectSessions` preserves an explicitly requested unknown date so the run cannot silently get shorter.

## Scoring is contrarian and explicit about silence

`BULLISH` predicts a stronger dollar, so it is a hit when the stored outcome is `DOWN`; `BEARISH` is a hit when the
outcome is `UP`. A `FLAT` session is excluded from the denominator. A missing outcome is `no_outcome`; a blocked
morning or `NO_CALL` is `no_call`. Accuracy is `hit / (hit + miss)`, and every tally also carries a
Wilson 95 per cent lower bound so a thin sample cannot look precise.

The controller does not turn an abstention into a call to keep the denominator large, and it does not turn a
missing outcome into a miss. `summary.participation` is `allowed / (allowed + abstained)` and is reported beside
accuracy.

## Parity and comparison evidence

The parity proof replays all three adapters over all 725 mornings and compares the fresh decision and all four
stored market results against the committed record.

```
npm run check:usd-l1-controller:parity   # exit 0 only when every decision and result reproduces
npm run compare:usd-l1-controller        # same mornings, deltas against the first model
```

Recorded evidence (generated by the CLI, not by hand):

- `data/usd-layer1-backtester/parity-v1.json` - 2,175 / 2,175 model decisions and 8,700 / 8,700 stored market
  results reproduced, 0 mismatches in each of the three models.
- `data/usd-layer1-backtester/compare-v1.json` - the three reports share one window; deltas are candidate accuracy
  minus the first model's accuracy over the same mornings. A negative delta is a worse model, not a broken run.

The CLI exits non-zero if `--parity` finds a mismatch, so a stale artefact cannot be published as green.

## Command line

Every output is one JSON document on stdout. Diagnostics go to stderr. A bad argument exits non-zero.

| flag | meaning |
| --- | --- |
| `--dataset <path>` | run artefact, default `data/usd-layer1-backtester/run-v1.json` |
| `--model <id>` | `current`, `challenger` or `challenger_v1`, default `current` |
| `--date <YYYY-MM-DD>` | repeatable; an absent date becomes a blocked decision |
| `--dates <a,b>` | comma-separated date list |
| `--from` / `--to` | inclusive range over the dataset's sessions |
| `--validation <mode>` | `structural` (default) or `receipted` |
| `--compare <a,b>` | run several models over exactly the same mornings |
| `--decisions` | include the per-morning decision records |
| `--parity` | replay all models against the committed record |
| `--list-dates` | print only the selected session dates |
| `--out <path>` | also write the JSON document to a file |
| `--help` | print the usage document and exit 0 |

Examples:

```
node backtester/scripts/run_usd_l1_backtest_controller.js --list-dates --from 2024-01-02 --to 2024-01-05
node backtester/scripts/run_usd_l1_backtest_controller.js --model challenger --date 2024-01-03 --decisions
node backtester/scripts/run_usd_l1_backtest_controller.js --model current --validation receipted --decisions
node backtester/scripts/run_usd_l1_backtest_controller.js --parity --out data/usd-layer1-backtester/parity-v1.json
```

`--list-dates` is how an orchestrator asks which mornings exist. A weekend is never requested because it is not a
session in the dataset; an empty range fails before any adapter is called.


## n8n boundary: controller and child

Both artefacts live in `automation/n8n/` with `"active": false`.

- `usd-l1-layer1-decision.workflow.json` - the child. Trigger input is one object:
  `{ date, model, dataset, validation }`. It refuses a missing or malformed date, a path outside the repository
  (including `..`), an invalid adapter id and an unknown validation label before it builds a shell command. It then
  runs the CLI with `--date` and `--decisions`, parses stdout, and returns the single decision record.
- `usd-l1-backtest-controller.workflow.json` - the outer controller. It defaults to the challenger over January
  2024, asks the CLI for `--list-dates`, emits one item per date, calls the child once per item, and summarises the
  returned records with the same tally as the library.

The child is called with `mode: "each"` and `waitForSubWorkflow: true`. It never decides which mornings exist and
never aggregates. The outer workflow never calls an adapter directly and never re-scores a child record.

### Child input and output

| input | required | default | rule |
| --- | --- | --- | --- |
| `date` | yes | none | `YYYY-MM-DD`; a non-session date returns a blocked decision |
| `model` | no | `current` | `current`, `challenger`, `challenger_v1`; rejected by the CLI otherwise |
| `dataset` | no | `data/usd-layer1-backtester/run-v1.json` | repository-relative; no `..`, no URL |
| `validation` | no | `structural` | `structural` or `receipted` only |

The child returns one item with the decision's `date`, `model`, `model_version`, `status`, `call`, `validation`,
`results`, `outcomes`, plus `controller_version`, `validation_mode`, `dataset` and the one-session `summary`. A
`blocked` decision is a normal output; a refused call (bad date, unknown model, non-JSON stdout) raises an n8n error
so the morning cannot look like an empty but successful run.

### Outer controller input and output

The `Run configuration` code node accepts `{ dataset, model, from, to, validation }`. Defaults are the challenger,
`2024-01-02` to `2024-01-31`, structural validation. `from > to` fails before the CLI is called.

The `Summarise decisions` code node returns the same shape as `controller.summarise`, wrapped with
`controller_version`, `source: "n8n:usd-l1-backtest-controller"`, `dataset.path`, `validation_mode`,
`layer1.id`, the date `window`, and the child `decisions`. A test evaluates that code against
`controller.summarise` on real allowed and blocked decisions, so a second implementation cannot drift silently.
The `Any blocked mornings?` IF node branches on `summary.statuses.blocked > 0`; both no-op branches receive the
same summary so the run record is not lost.

### Import and wiring

1. Import the child first in the n8n UI.
2. Copy the imported child id into the `Evaluate Layer 1 for each date` node, replacing
   `REPLACE_WITH_LAYER1_SUBWORKFLOW_ID`. The placeholder deliberately fails instead of calling a similarly named
   workflow.
3. Import the outer controller and leave it inactive. There is no schedule and no webhook.
4. Run the outer workflow manually. A run over January 2024 should report `sessions: 22` (or the number of sessions
   in the recorded window) and `statuses.blocked: 0`.

Both command nodes assume the repository is checked out at `/opt/trading-agent-dashboard-codex`, matching the
existing shadow workflow. They use the repository's Node runtime and no n8n credential.

The Cloud-native replacement for this lane is separate: `automation/n8n/usd-l1-paired-controller.cloud.workflow.json`
and its two pinned children contain no `Execute Command` node and have recorded executions on 2026-11-19
(`docs/USD_L1_N8N_CLOUD_WORKFLOWS.md`, `data/usd-layer1-backtester/n8n-execution-evidence-v1.json`). These two
host-command wrappers stay un-imported, so their map nodes keep reading `partially verified`.

## Architecture map entry

`data/architecture-map.json` (version `2026-11-19-architecture-mirror-v2`) describes this stack as the
`usd-l1-controller` view for the manifest-driven Architecture Mirror. The public Architecture tab on this
branch still draws the static eight-asset illustration, so the view is validated as data rather than claimed
as a rendered page section. The view carries six nodes and six edges:

| node | verification | why |
| --- | --- | --- |
| `usd_l1_backtester_panel` | verified | `run-v1.json` is the frozen 725-session panel replayed by parity |
| `usd_l1_backtest_controller` | verified | 17 tests plus full parity |
| `usd_l1_controller_cli` | verified | every CLI mode is exercised by the tests |
| `usd_l1_layer1_decision_workflow` | partially verified | local child workflow, never imported or run in n8n |
| `usd_l1_backtest_controller_workflow` | partially verified | local parent, child id still a placeholder |
| `usd_l1_controller_evidence` | verified | `parity-v1.json` and `compare-v1.json` regenerated locally |

The two n8n nodes keep `partially_verified` until the child is imported, its real id replaces
`REPLACE_WITH_LAYER1_SUBWORKFLOW_ID`, and a manual run is recorded. `tests/architecture_map_usd_l1_controller.test.js`
fails if a node references a missing file, if the parity or comparison numbers quoted in the map drift from
the committed artifacts, or if a wrapper node starts claiming a live run.

## What this milestone does not claim

- It does not make the committed panel receipted. The strict gate refuses all 725 mornings; that is recorded as a
  finding, not hidden.
- It does not put the controller on a schedule or connect it to the dashboard writer.
- It does not compare against a live feed, a broker, a transaction-cost model or an execution path.
- It does not add a second model implementation. A new book supplies an adapter object; the controller and the
  child stay unchanged.

## Reproduce

```
npm run test:usd-l1-controller        # library, CLI, workflow graph, n8n summary parity
npm run check:usd-l1-controller:parity
npm run compare:usd-l1-controller
npm run test:usd-layer1-engine        # the frozen book and engine, unchanged
node scripts/validate_architecture_map.js
node --test tests/architecture_map_usd_l1_controller.test.js
```

