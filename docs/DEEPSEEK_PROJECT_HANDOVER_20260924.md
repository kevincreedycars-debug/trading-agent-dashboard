# DeepSeek project handover - Gold and multi-asset backtesting

Date: 2026-09-24  
Canonical repository: `D:\trading-agent-dashboard-codex`  
Canonical branch at handover: `orchestration/control-plane-20260920`  
Canonical HEAD at handover: `c7e6d36` (`Authorize Gold provider activation package`)  

This document supersedes `docs/DEEPSEEK_GOLD_RESEARCH_HANDOFF.md` as the setup
prompt for new work. That older document is historical provenance for the original
September 19 coverage milestone and must not be executed again.

## 1. What the user wants

There are two connected objectives:

1. Continue the Gold research safely from its current prospective-qualification
   checkpoint.
2. Prepare the backtesting engine to run the other main assets concurrently and
   finish a complete batch within one day.

The user wants to use DeepSeek for routine implementation and coordination to reduce
ChatGPT/Codex cost. Use deterministic programs for data processing and candidate
evaluation. Do not use model calls to inspect individual rows or evaluate individual
candidates.

## 2. Mandatory startup and repository rules

Read, in order:

1. `AGENTS.md`
2. `CODEX_STARTUP.md`
3. `docs/orchestration/README.md`
4. `docs/orchestration/projects.json`
5. `docs/orchestration/DECISIONS.md`
6. `docs/CURRENT_STATE.md`
7. `docs/CURRENT_TASK.md`
8. `docs/ACTIVE_MILESTONE.md`
9. `docs/SESSION_NOTES.md`
10. This document
11. `docs/orchestration/assignments/gold-research.md` before touching Gold

Then inspect the actual branch, HEAD and status. Current documents and actual files
win over old handovers. Preserve every unrelated or unexplained change.

Important boundaries:

- Backtesting is downstream-only and must not affect independent Layer 1 agents.
- A local result, replay pass or parity result is not proof of deployment, causal
  timing, accuracy, profitability or trading edge.
- Do not change production workflows, publish the dashboard, mutate the linked
  warehouse, install a scheduler or capture a real prospective Gold anchor unless a
  later explicit assignment authorizes that exact action.
- Use scoped encrypted credentials as documented in
  `docs/CREDENTIAL_CONTINUITY.md`; never print or commit secret values.
- Raw data and generated evidence belong only in ignored `backtester/tmp/`, `tmp/`
  or `.local/` locations.
- One writer per worktree. Never allow two agents to edit the same checkout.
- Do not reset, stash, discard, move or claim pre-existing changes.
- Do not use `git add .`.

## 3. Current Git and coordination state

The canonical checkout contains unrelated work that must remain untouched:

- modified `tools/strategy-node/Strategy.code-workspace`
- untracked `backtester/docs/gold_session_horizon_policy.md`
- untracked `backtester/lib/gold_session_policy.js`
- untracked `backtester/registries/gold_session_horizon_policy.v1.json`
- untracked `backtester/scripts/audit_gold_session_policy.js`
- untracked `backtester/tests/gold_session_policy.test.js`

The registered Gold worktree is:

- path: `D:\trading-agent-dashboard-codex\.local\worktrees\gold-research`
- branch: `workers/gold-research-policy-20260920`
- committed HEAD: `4eea9a8` (`Add offline Gold qualification collectors`)
- current assignment: `gold-qualification-activation-package-017`

At handover, the Gold worktree has six untracked 017 paths:

- `backtester/lib/gold_qualification_activation.js`
- `backtester/lib/gold_qualification_provider_client.js`
- `backtester/registries/gold_qualification_scheduler_package.v1.json`
- `backtester/scripts/run_gold_qualification_activation.js`
- `backtester/tests/gold_qualification_activation.test.js`
- `docs/GOLD_QUALIFICATION_ACTIVATION_RUNBOOK.md`

There is no 017 mailbox submission and no 017 commit. During concurrent activity,
`gold_qualification_provider_client.js` appeared after another worker had recorded a
clean preflight and was not recognized as its own file. Work stopped rather than
overwrite it. Treat all six files as untrusted, unfinished shared-worktree state
until their provenance and coherence are reconciled. Do not delete, overwrite or
commit them merely because they match the assignment names.

The automatic coordinator dispatcher was intentionally paused while this handover
was written. Check its actual state before using the mailbox. Never run a manual
review while `activeRun` is true.

## 4. Gold: accepted position

Gold has progressed well beyond the historical coverage report open in the editor.
The important accepted chain is:

- `gold-qualification-shortlist-013`, accepted at `0d82157`
  - Frozen selection from the accepted 255 eligible candidates.
  - Four hypotheses remained after the one-per-pair and one-per-variable rules.
- `gold-qualification-window-freeze-014`, accepted at `715c982`
  - Manifest SHA-256:
    `15cd06067a1a9fee8c6498560f4e9ab191541ee5987abc1e8f0219cff3e26f05`.
  - 130 weekday anchors from `2026-09-24T14:00:00Z` through
    `2027-03-24T14:00:00Z`.
  - No backfill; window explicitly remained closed.
- `gold-qualification-execution-scaffold-015`, accepted at `b5f2e27`
  - Execution contract SHA-256:
    `208c584427c7540b6f1e712d9feac577de8e95200af2d9ad6f868390abe5910d`.
  - Outcome-blind metadata gate and sealed-bundle schema.
  - Evaluation deliberately unavailable before `2027-03-25T15:00:00Z`.
- `gold-qualification-collector-016`, accepted at `4eea9a8`
  - Offline parsers for FRED `DFII10`, `DGS2`, `VIXCLS` and OANDA
    `XAU_USD` H1.
  - Exact 130-anchor / 780-item capture plan.
  - Metadata-only envelopes and fail-closed tamper checks.
  - Accepted focused validation: 10/10.

None of those acceptances means Gold is qualified or has trading edge. No real
prospective outcome has been evaluated.

## 5. Gold assignment 017: exact current scope

The user authorized bounded preparation using read-only provider/network access and
only these credential names:

- `FRED_API_KEY`
- `OANDA_API_TOKEN`

Assignment 017 may:

- implement the real-provider client for the four accepted feeds;
- implement a clock-bound activation gate;
- perform small provider smokes whose requested interval ends strictly before the
  first real anchor, `2026-09-24T14:00:00Z`;
- create an inert scheduler package and operator runbook;
- add adversarial tests for source confusion, overbroad credentials, leakage,
  clock/anchor overrides, backfill, output reuse and scheduler activation attempts.

Assignment 017 may not:

- capture any real 014 anchor;
- request or inspect observations at or after the first real anchor;
- install, enable or start a scheduler or background process;
- read outcomes or calculate qualification results;
- write to the warehouse or change Layer 1, live workflows or production.

An interrupted worker reported, but did not submit, these provisional checks:

- activation tests: 10/10;
- FRED smoke rows: DFII10 1, DGS2 1, VIXCLS 2;
- OANDA XAU/USD H1 smoke rows: 23;
- requested smoke interval: 2025-01-02 through 2025-01-03;
- evidence stored in ignored local storage;
- no real anchor capture, scheduler activation or production change.

These are leads for independent verification, not accepted evidence. Reconcile the
six untracked files first, review their diffs and provenance, rerun tests, inspect
ignored evidence without exposing values, and only then decide whether to finish a
single coherent 017 commit and mailbox submission.

## 6. Multi-asset scaling finding

The main conclusion is that arithmetic is not the multi-day bottleneck.

Measured on the current Ryzen 7 3700X machine (8 physical cores, 16 logical cores,
about 64 GB RAM):

- a cached Gold experiment covering 53,751 candidates and 964 records completed its
  experiment build in about 4.1 seconds, with about 169 MB RSS;
- the accepted Gold combination run processed 2,548 candidates across 965 anchors in
  about 14.6 seconds, including ledger work;
- pretty JSON serialization alone added about 1.1 seconds and produced a roughly
  155 MB report in one larger experiment.

The time has been spent on source/provenance contracts, asset-specific adaptation,
calendar and timing rules, serial provider/database traffic, iterative review and
duplicated implementations.

Repository readiness:

- USD: builder, replay and checker foundation exists.
- EUR: builder, replay and checker foundation exists.
- NQ: builder, replay and checker foundation exists.
- BTC: builder, replay and checker foundation exists.
- Gold: most mature research implementation.
- GBP: replay core exists, but builder/source onboarding remains incomplete.
- Silver and WTI: no corresponding backtester paths or source contracts currently
  exist in the canonical backtester.

Therefore USD, EUR, NQ and BTC are plausible one-day batch assets after
standardization. GBP needs an onboarding lane. Silver and WTI cannot honestly be
called one-day ready until their data and timing contracts exist.

## 7. Why many DeepSeek agents are not the compute solution

DeepSeek agents should build and review asset adapters, source mappings, tests and
compact result interpretations. They should not download the same inputs or perform
per-row/per-candidate reasoning.

The deterministic data plane should perform the calculations:

1. Acquire each source once with provider-specific rate limiting.
2. Normalize it once into a hash-verified immutable cache.
3. Construct each asset's anchor table once.
4. Evaluate assets concurrently in ordinary Node processes.
5. If profiling requires it, shard a large asset by deterministic candidate-index
   ranges and use child processes or worker threads.
6. Write unique immutable shard files and merge in registry order.
7. Validate hashes, counts and independent reconstruction samples.

Start with four concurrent asset processes. If profiling supports it, use up to
four to six processes or two worker threads per asset. Leave CPU and memory for the
coordinator, filesystem and verification. Do not launch dozens of agents against
the same credentials, worktree, output directory or database keys.

## 8. Efficiency work that matters

### Shared immutable cache

Fetch shared FRED, yield, volatility and calendar sources once. Cache entries should
be content-addressed and record provider, requested interval, schema/version, row
count and SHA-256. Asset worktrees may read the cache but must not mutate it.

### Generic batch kernel

Extract the common Gold runner/adapter/ledger pattern instead of copying Gold's
large bespoke implementation into every asset. The kernel should own:

- candidate enumeration;
- split and embargo handling;
- matched baselines;
- minimum-sample and flat rules;
- deterministic ordering and identifiers;
- evidence manifests and validation;
- compact report writing.

Each asset adapter should own only:

- normalized anchors and factor states;
- asset price source and timing contract;
- session/calendar policy;
- horizon endpoint construction;
- benchmark and realized-return definition.

### Remove row-by-row warehouse traffic

Existing historical replay runners iterate snapshots serially and can issue many
dependent REST calls per snapshot. Multi-timeframe paths can approach eleven calls
per snapshot. Generate and validate local artifacts first. If warehouse publication
is later authorized, bulk-fetch existing keys and bulk-upsert tables in bounded
chunks. Never let concurrent workers write overlapping asset/date keys.

### Compact artifacts

Avoid large pretty-printed JSON ledgers. Prefer compact NDJSON initially, or benchmark
SQLite, DuckDB, Arrow or Parquet only if parsing, memory or storage is shown to be a
material bottleneck. Keep complete hashes and aggregate reconciliation for every
candidate; retain full membership IDs only where audit requirements need them.

### Resumable job manifests

Every work item should bind:

- run ID and asset;
- registry and input-manifest hashes;
- code-closure hash;
- candidate range;
- attempt number and output path.

A shard is reusable only when all bindings match. Never resume by appending to an
unverified partial ledger.

## 9. Recommended next milestone

After Gold 017 is safely reconciled or explicitly parked, implement a bounded
**multi-asset one-day readiness spike**. This is a platform/rehearsal milestone, not
a production deployment or permission to change research rules.

Deliverables:

1. A readiness matrix for Gold, USD, EUR, NQ, BTC, GBP, Silver and WTI covering
   source availability, immutable input, session policy, outcomes, adapter status,
   replay support and blockers.
2. A generic asset/job manifest schema.
3. A deterministic local orchestrator that launches isolated asset processes with a
   configurable concurrency cap, unique output directories and resumable statuses.
4. A shared-cache contract and hash validator. Do not reacquire paid/live sources in
   this spike unless separately authorized.
5. Stage metrics: wall time, CPU time, peak RSS, bytes read/written, rows, API calls,
   cache hits, retries and artifact hashes.
6. Gold equivalence proof showing single-worker and parallel execution produce the
   same ordered logical records and aggregates, apart from explicitly variable run
   metadata.
7. A two-asset concurrency rehearsal, followed by a four-asset consumed-data
   rehearsal for USD/EUR/NQ/BTC if their contracts pass readiness.
8. A concise runbook and one-day capacity estimate based on measurements rather than
   assumptions.

Suggested paths, subject to repository inspection:

- `backtester/orchestration/assets.v1.json`
- `backtester/orchestration/job-schema.v1.json`
- `backtester/lib/asset_batch_runner.js`
- `backtester/scripts/run_asset_matrix.js`
- `backtester/tests/asset_batch_runner.test.js`
- ignored outputs under `backtester/tmp/runs/<run-id>/<asset>/`

Do not begin by rewriting every asset. First benchmark the existing Gold kernel and
identify the smallest shared interface. Preserve asset-specific calendar and timing
rules rather than generalizing Gold assumptions blindly.

## 10. Benchmark and acceptance gates

Run these gates in order:

1. Gold single-process equivalence.
2. Microbenchmark 100 candidates x 100 anchors at 1, 2, 4 and 8 workers.
3. Full Gold benchmark at 1, 2, 4 and 8 workers.
4. Choose the lowest worker count within 10% of best throughput.
5. Run the two heaviest prepared asset fixtures together.
6. Rehearse all ready assets from immutable consumed data without live workflows or
   prospective inputs.

Acceptance requires:

- one-worker and N-worker logical outputs are identical and deterministically
  ordered;
- no missing or duplicate candidate/anchor IDs;
- partitions and aggregates reconcile;
- input or code drift fails before evaluation;
- killed/failed shards retry without overwrite or double counting;
- peak memory remains below 75% of available RAM;
- free disk remains at least twice the estimated output size;
- full rehearsal completes in no more than six hours, leaving two hours for
  independent verification and reruns;
- no Layer 1, live workflow, linked-warehouse or production mutation occurs.

Use focused tests while iterating, then the documented local suite. `npm test` uses
`node --test --test-concurrency=4` and excludes linked-warehouse mutation suites.

## 11. First actions for the new DeepSeek instance

1. Read the mandatory documents and report the actual branch, HEAD and all dirty
   files before editing.
2. Confirm only one writer owns each worktree.
3. Inspect the six untracked Gold 017 files without changing them. Establish which
   files form one coherent implementation, identify the unexplained provider-client
   provenance, and compare everything against assignment 017.
4. Check ignored 017 smoke evidence and rerun the focused tests without printing
   provider values or credentials.
5. Produce a concise reconciliation report. If the implementation is coherent and
   within scope, finish one clean 017 commit and submit through the mailbox. If not,
   preserve it and report the exact conflict; do not improvise a merge.
6. Stop at the 017 review boundary. Real capture and scheduler installation remain
   unauthorized.
7. In a new isolated branch/worktree, begin only the readiness audit and benchmark
   portion of the multi-asset spike. Freeze the common interface before assigning
   parallel asset adapters.

## 12. Paste this into DeepSeek

```text
You are taking over coordination and implementation in
D:\trading-agent-dashboard-codex. Start by reading AGENTS.md, CODEX_STARTUP.md and
docs/DEEPSEEK_PROJECT_HANDOVER_20260924.md, then follow that handover's complete
mandatory read order.

Your first priority is to reconcile the unfinished Gold assignment 017 safely. The
registered Gold worktree is at
D:\trading-agent-dashboard-codex\.local\worktrees\gold-research and is committed at
4eea9a8 with six untracked 017 files. One provider-client file appeared during
overlapping activity and has unexplained provenance. Inspect and preserve all files;
do not overwrite, delete, reset, stash or claim them. Verify the exact assignment,
file coherence, focused tests and ignored pre-window smoke evidence without printing
credentials or provider values. If coherent, produce one scoped commit and mailbox
submission. Otherwise report the exact conflict and stop. Do not capture a real
prospective anchor, request post-boundary data, install a scheduler, evaluate an
outcome, write to the warehouse or change production.

After 017 is submitted or explicitly parked, prepare the bounded multi-asset
one-day-readiness spike described in the handover. Use deterministic Node processes
for computation and DeepSeek only for implementation/review. Begin with the
readiness matrix, common manifest/cache contract and measured Gold benchmark. Do not
copy Gold wholesale, launch many agents into one checkout, reacquire sources or
change asset research rules. Keep each writer in an isolated worktree and stop at
the review boundary with exact files, commands, timings, hashes, tests and blockers.
```

