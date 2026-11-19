# USD Layer 1 backtests as versioned n8n Cloud workflows

Research only. No workflow described here places a trade, sizes a position, writes a runtime table or is
scheduled. Nothing in this lane touches live trading.

## Why this exists

n8n Cloud does not offer the `Execute Command` node, so the two existing host-command wrappers
(`automation/n8n/usd-l1-backtest-controller.workflow.json` and
`automation/n8n/usd-l1-layer1-decision.workflow.json`) can never run there. This lane builds the same
backtest as Cloud-native workflows: the controller library is bundled into a Code node, the model is a
pinned child workflow, and a parent workflow swaps children by workflow id. That makes the two model
versions independently versioned, importable, and swappable without editing the morning, the gate or the
scoring rules.

## Artifacts

| Artifact | Path | What it is |
| --- | --- | --- |
| Build manifest | `automation/n8n/usd-l1-cloud-workflows.manifest.json` | Schema `usd-l1-cloud-workflows-v1`; pins every bundled source file by sha256, the source-set hash (`bundle_sha256`) and the bundle byte size, and the two child workflow ids. |
| Runtime bundle | `automation/n8n/usd-l1-cloud-runtime.js` | Deterministic concatenation of the controller, contracts, both challengers, `lib/usd_l1_votes.js` and the session engine interface. No host filesystem, no `process`, no network client. |
| Child v0 | `automation/n8n/usd-l1-challenger-v0.cloud.workflow.json` | One model (`challenger`, identity `usd-layer1-challenger-v0`), triggered only by `executeWorkflow`. |
| Child v1 | `automation/n8n/usd-l1-challenger-v1.cloud.workflow.json` | One model (`challenger_v1`, identity `usd-layer1-challenger-v1`), triggered only by `executeWorkflow`. |
| Parent | `automation/n8n/usd-l1-paired-controller.cloud.workflow.json` | Manual trigger plus header-authenticated webhook, two `executeWorkflow` calls bound to the child ids, then one combine node. No schedule, no provider node, no Supabase node. |
| Templates | `automation/n8n/templates/` | `usd-l1-parent-select.js`, `usd-l1-parent-config.js`, `usd-l1-child-wrapper.js`, `usd-l1-parent-combine.js`, `usd-l1-cloud-runtime.tmpl`. The builder owns the workflow JSON; the templates own the node code. |
| Builders | `scripts/build_usd_l1_n8n_cloud_workflows.js`, `scripts/build_usd_l1_n8n_evidence.js` | The first regenerates the three workflow JSONs and the bundle from the manifest; the second assembles the evidence file from captured artifacts only and never calls n8n. |
| Evidence | `data/usd-layer1-backtester/n8n-execution-evidence-v1.json` | What ran, where, and what it returned. |
| Raw transcripts | `data/usd-layer1-backtester/n8n/execution-*.json`, `executions-index-20261119.json` | The stored n8n executions the evidence is assembled from. |
| Map | `lib/backtesting_n8n_map.js`, `backtesting.html#n8nmap` | Model-swap map, the tab's default view, rendered from the evidence file. It exists in this checkout; the published site is checked separately and is stated below. |

`backtester/lib/usd_layer1_backtester/current_model.js` is listed in the manifest as a stub and is
deliberately **not** bundled: the production-control adapter's replay core reads local files and Supabase
helpers. The local controller still runs that adapter; the Cloud pair does not.

## The swap

Both children receive the same payload (date, dataset row, validation mode) and return a decision. Each
child embeds the bundle and pins exactly one model, and refuses a request that names the other model. The
parent selects a child by workflow id, so a model version is swapped by pointing the parent at the other
child (or at a new child built from a new model version); the morning, the dataset, the validation mode
and the scoring rules stay identical. Nothing in the parent branches on model behaviour.

H1 (`USD-L1-25F-H1-v0.1.0`) is not one of these children and has no workflow here. It is a separate,
unscored identity and is never substituted for a challenger; the map draws it as `not_invoked`.

## What actually ran on 2026-11-19

Instance `https://silver17.app.n8n.cloud`, project `ISQG9XU7TGTT6Fcu`. Parent workflow
`USD Layer 1 - paired controller (Cloud)` is `89uk5JnPbWPL5lGD`; children are `giGJKNQw5WLh1xbX`
(v0) and `42sxXHScRvE3qSTX` (v1). The parent is manual/webhook only and its webhook was deactivated
after the evidence was captured; both children are active but can only be started by `executeWorkflow`.

| Recorded morning | Validation | Parent | v0 child | v1 child | Result |
| --- | --- | --- | --- | --- | --- |
| `2024-01-10` | structural | 5471 success | 5472 `allowed`, BULLISH, conviction 2 | 5473 `allowed`, BULLISH, conviction 2 | both call |
| `2024-01-10` | receipted | 5474 success | 5475 `blocked`, BULLISH, conviction 2 | 5476 `blocked`, BULLISH, conviction 2 | receipted gate refuses on date-only prints |
| `2024-01-06` | structural | 5477 success | 5478 `blocked`, NO_CALL | 5479 `blocked`, NO_CALL | date absent from the panel |
| `2024-01-02` | structural | 5480 success | 5481 `abstained`, NO_CALL | 5482 `abstained`, NO_CALL | declared inputs missing |

Every parent execution returned `success`, and every child answer carries its own workflow id, execution
id, identity, `model_version`, direction and conviction. Both children returned the same validation
verdicts on all four mornings: the gate is shared, the decision is not.

## What this proves, and what it does not

Proves:

- The controller library runs unmodified in an n8n Cloud Code node: the generated bundle reproduced the
  Node controller for both challengers over all 725 stored mornings, 1,450 decisions, 0 mismatches.
- The local controller parity stands at 2,175 of 2,175 decision matches and 8,700 of 8,700 result
  matches against `run-v1.json`.
- Validation is a real gate in the Cloud path: a receipted request is refused, a missing date is refused,
  and missing declared inputs produce an abstention rather than a filled value.
- The model can be swapped without touching the morning, the dataset, the gate or the scoring.
- The checked-in workflow JSON is a deterministic build of the pinned sources: `npm run build:usd-l1-n8n`
  rewrites the same bytes and keeps the imported child ids and webhook credential already recorded in the
  manifest and parent file.

Does not prove:

- Any edge. The pooled structural accuracies (current 51.93% on 1,887 scored calls, challenger 49.74% on
  1,367) are gross replays of a frozen panel and are not edge claims.
- Receipted validity on history: 0 of 725 committed mornings carry a full before-cutoff timestamp for
  every consumed input, so the receipted gate refuses all of them. The 57 mornings with missing declared
  inputs are the only missing-input sample.
- Late-print rejection on history: no committed morning has a stamped print after the 05:00 cutoff, so a
  late-print refusal is untested and must never be inferred from these runs.
- A full n8n batch. The evidence covers four controlled dates; the 725-morning batch path is still the
  local controller (`npm run backtest:usd-l1-controller`).
- Any live-trading behaviour. No order, stop, size, feed or runtime table was read or written.

## Rebuild and re-verify

```
npm run build:usd-l1-n8n        # rewrite the Cloud workflows and the bundle from the manifest
npm run test:usd-l1-n8n         # Cloud bundle, child pinning, controller wiring, evidence, map
npm run test:usd-l1-controller  # 17 controller tests, including parity
npm run check:usd-l1-controller:parity
```

`scripts/build_usd_l1_n8n_evidence.js` reads only captured artifacts; it is the only script in this lane
that names the n8n instance, and it holds no credentials and makes no API call.

## Boundaries

- Publication state, measured 2026-11-19: the published `backtesting.html` is 58,292 bytes and carries no
  `n8nmap` markup, and `data/usd-layer1-backtester/n8n-execution-evidence-v1.json` returns 404 on `main`.
  The 76,091-byte page and the evidence file exist in this checkout only, so the map and the Cloud pair
  are built, imported and executed but not yet published. A reader of the live site cannot see them.
- Research only: no workflow is scheduled, no webhook is left authenticated for unattended use, and no
  node writes to Supabase or to a runtime table.
- The checked-in JSON is the source of truth for what the workflows contain; the instance copy is
  deployment state, not repository state.
- H1 stays a separate identity with its own evidence contract; a challenger answer is never reported as
  H1 and H1 is never reported as a challenger.

