# Backtest Engine v2 - status-update contract

Written 2026-11-24 by the coordinator lane, for the design lane that owns `backtest-engine-v2.html`.
This is the agreement the page already implements: where every status, pending item, link and
verification timestamp comes from, and how a new coordinator build refreshes the published map
without anyone editing UI text.

## 1. One page, one manifest, ten artefacts

`backtest-engine-v2.html` loads `backtester/assets/backtest-engine-v2.manifest.json` and then the
ten artefacts the manifest's `sources` block names. Nothing on the page is typed in by hand. A step's
chip is the worst of its dimensions, and the dimensions are declared in the manifest's `dimensions`
block: `software`, `deployed`, `data` and `research`, in that order. Each dimension is decided by the
first rule in the manifest that matches, in the order the manifest writes them. A rule is `exists`,
`eq`, `gt`, `eqPath`, or `olderThanPath`, and a path may index an array (`children[0].url`) or select a
record by one of its fields (`child_executions[model=challenger].execution_id`). A step that does not
write a dimension takes the manifest's `defaults.readiness` entry for it; the released manifest gives
`deployed` the default `inactive` with the note that the step runs in the checkout rather than as a
deployed Cloud workflow, so no step can borrow a deployment it does not have.

The artefact addresses are declared once, in `sources`:

| Key | Artefact | Verification stamp |
| --- | --- | --- |
| `evidence` | `data/usd-layer1-backtester/n8n-execution-evidence-v1.json` | `generated_at` |
| `retrieval` | `data/usd-layer1-backtester/input-retrieval-v1.json` | `generated_at` |
| `coverage` | `data/usd-layer1-backtester/coverage-v1.json` | `generated_at` |
| `spec` | `data/usd-layer1-backtester/spec-check-v1.json` | `generated_at` |
| `rules` | `data/usd-layer1-backtester/decision-rules-v1.json` | `frozen_on` |
| `parity` | `data/usd-layer1-backtester/parity-v1.json` | none published (`verified_at: null`) |
| `m5` | `data/usd-layer1-backtester/m5-archive-status.json` | `generated_at` |
| `matrix` | `backtester/config/usd_layer1_market_matrix.json` | `created_at` |
| `freshcall` | `data/usd-layer1-backtester/n8n/fresh-call-v1.json` | `created_at` |
| `readiness` | `data/usd-layer1-backtester/market-readiness-v1.json` | `generated_at` |

The page prints a "Sources, each stamped by its own artefact" panel. It reads the named field
**inside that artefact** and prints `verified <time>`; where the field is absent it prints
`read - no timestamp published`; where the fetch failed it prints `unavailable - the page could not
read it`. A missing artefact is therefore visible and its steps read `unknown`; nothing is blanked or
guessed.

## 2. The status mappings this release added

| Claim | Rule in the manifest | State |
| --- | --- | --- |
| The child recomputes the call | `freshcall.verdict.status eq recomputed_from_cutoff_inputs` | `complete` (software) |
| The proof has cases behind it | `freshcall.totals.cases gt 0` | `complete` (data) |
| The model logic behind it | `evidence.claims.model_logic.status eq not_established` | `pending` (research) |
| Published readiness has blocked cells | `readiness.published.counts.blocked gt 0` | `pending` (data) |
| Live parity | `parity.ok eq true` / `parity.decision_mismatches gt 0` | unchanged |
| The parent that ran is the one deployed | `freshcall.deployed_identity.parent_workflow_id exists` | `complete` (deployed) |
| The pinned bundle answered | `freshcall.live_call.execution.id exists` | `complete` (deployed) |
| Challenger v0 answered in Cloud | `freshcall.live_call.child_executions[model=challenger].execution_id exists` | `complete` (deployed) |
| Challenger v1 answered in Cloud | `freshcall.live_call.child_executions[model=challenger_v1].execution_id exists` | `complete` (deployed) |
| The fixture is deployed and active | `evidence.workflows.children.2.active eq true` | `complete` (deployed) |

Deployment is the dimension this release separated out. Before it, the controller's `software` note
said "the parent is deployed" and the fresh-call `software` note said "the captured execution agrees
with the rehearsal": both statements are about a deployment, and neither was visible as its own state.
Now `software` is what exists and is checked in this checkout, `deployed` is what the captured
execution proves ran in Cloud (parent `89uk5JnPbWPL5lGD`, bundle `usd-l1-cloud-runtime-v3`, parent
execution 7260, children 7261 and 7262), and the seven steps that are not Cloud workflows take the
`defaults.readiness.deployed` entry, which reads `inactive` and says why. The chip remains the worst
of the four, so adding a complete deployment can never lift a step whose data or research is not done.

The fresh-call step is labelled `Fresh-call proof`, shows the eight cases, the 8/8 call agreement,
the 4/4 scored-case agreement, 27/110 probes and executions **7260** (parent), **7261** and **7262**
(children). Its `limitations` list says, in the page's own words, that one execution is one morning
and that the proof **does not establish contemporaneous availability**. Historical availability
remains a separate claim read from `evidence.claims.historical_availability` (`not_established`).

The `outcomes` step reads the published matrix:

- scored **4**
- proxy-scored **1**
- measured by tick replay **8**
- blocked **11**

from `market-readiness-v1.json`, which copies those numbers from
`backtesting-screen-v1.json`'s own `market_matrix.counts` and refuses to build when they do not add
up to 24 cells. The scratch run that read **7 / 1 / 8 / 8** is carried under
`unpublished_research` with `published: false` and a sentence saying it is not live readiness; no
published count includes it.

XAG/WTI/GBP direction cells read `pending_data_distribution` and name the acquired rows
(17,149 / 17,139 / 18,026) that wait on the distribution decision. Their two L2L cells name both
missing datasets: a bid/ask 5-minute tape and a pre-session level ladder. `advantage.status` is
`not_established` and the page repeats it.


## 3. Pending items and links

- Pending items are manifest paths: `evidence.next_actions`, `m5.missing`,
  `freshcall.not_claimed`, and the literal `limitations` sentences on `outcomes` and `freshcall`.
  A list item may be a sentence or a record; both print as the sentence they carry.
- Links are either an explicit `href` or `{ "source": "freshcall" }`. A source link takes its
  address and label from that one `sources` entry, so changing an artefact's path is a one-line change
  in the manifest, not a search through UI copy.
- Every link opens the artefact, page, execution or document it names; the guard checks each
  source's `href` against the manifest entry.

## 4. How a new coordinator build refreshes the published map

The page is not regenerated. The coordinator rebuilds the artefacts and commits them; the page reads
them when it opens. For readiness the chain is:

```
node scripts/build_backtesting_screen.js --write      # the published matrix and its counts
npm run build:usd-l1-market-readiness                 # the small artefact the page reads
npm run check:usd-l1-market-readiness                 # fails if the committed artefact is stale
```

For the call-generation claim:

```
npm run prove:usd-l1-fresh-call                       # rewrite fresh-call-v1.json from run-v1.json
npm run check:usd-l1-fresh-call                       # fails if the record is stale
```

`tests/usd_l1_market_readiness.test.js` pins the readiness artefact to the screen, holds the published
counts at 4/1/8/11 and the scratch counts out of them, and checks that the manifest still binds the
fresh-call and readiness sources. `backtester/tests/backtest_engine_v2.browser.test.js` holds the
page itself to the manifest: bands, steps, states, wires, the source stamps, and the fresh-call and
readiness text.

No UI text has to change for a rebuild. The only edits that are design work are the manifest's
sentences and rules - and those are checked against the artefacts, not against a memory of them.

## 5. State report: the missing script, and what replaces it

The design lane's brief named `monitor-state.js`. That file is **not in this repository** - not in
`scripts/`, not in the canonical checkout, not in the design worktree - and no script mentions
`monitor-state`. The lane correctly refused to invent it.

The reporting mechanism this repository actually carries is the local coordination store:

- `scripts/coordination.js` - `submit`, `reply`, `check` against a mailbox registry at
  `docs/orchestration/projects.json`. That registry is **not on `main`**, so the tool cannot run from
  the canonical checkout; it is the supported channel only where the registry exists (a lane
  worktree that carries it).
- `.local/orchestration/activity/<worker>.json` - the one-line monitor record every lane writes
  (`worker_id`, `assignment_id`, `state`, `task`, `updated_at`).
- `docs/dashboard-design/CONVERSATION_NOTES.md` - the durable lane record, and, for this release,
  `BACKTEST_ENGINE_V2_HANDOFF_20261124.md` as the submission to the coordinator.

`scripts/report_design_state.js` is the runnable replacement for `monitor-state.js`. It writes the
same activity record, atomically, and refuses a state it does not recognise:

```
node scripts/report_design_state.js --state working --task "integrating the v2 control room"
node scripts/report_design_state.js --check        # print the current record
```

It touches only `.local/orchestration/activity/dashboard-design.json` (gitignored local state). It
never edits the page, an artefact, a workflow or a trading path.

## 6. What this contract deliberately does not do

- It does not establish contemporaneous input availability across the 725 mornings.
- It does not publish a direction score for XAG/WTI/GBP; that waits on the data-distribution route.
- It does not claim predictive advantage from any cell.
- It does not activate, edit or execute a trading workflow.
