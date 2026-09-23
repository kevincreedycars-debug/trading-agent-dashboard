# Gold first frozen exploratory combination run

Assignment: gold-combination-run-011. Published 2026-09-22.
Worker: gold-research. Worktree: D:/trading-agent-dashboard-codex/.local/worktrees/gold-research
Branch: workers/gold-research-policy-20260920. Starting HEAD: a185086.
Standing user authority to advance research and set next instructions applies.

Approved scope: exactly one complete enumeration of the frozen 2,548 daily
h24_post_event / all_computed / AND candidates. Registry SHA-256:
7e2bcff68a6054e7f7635225e06ed80a1557e6525f8a068dfa926ccf142759a2.
No alternative cells, event-cohort search, threshold changes, ranking or winner
selection. Existing data are consumed exploratory data, never a fresh final test.
This assignment supersedes the protocol's prior no-execution gate only for this batch.

1. Implement a deterministic offline runner and row adapter using the accepted
   observation/state/context/outcome functions and existing hashed archives.
   Reuse accepted timing, min_n=20, unique daily anchor identities, availability,
   missing-state and session policies. Do not reverse-engineer anchor rows from
   aggregate tables. Keep all scheduled anchors, primary exclusion reasons and
   unavailable states. Fail before candidate execution if row reconstruction or
   original daily baselines/exclusions cannot reconcile with the accepted report.
2. Before real combination aggregation, commit the runner/adapter, synthetic
   boundary tests and execution contract. Write a new immutable pre-run manifest
   with run ID, exact command, frozen registry digest, accepted input/source hashes,
   Git commit, runtime, and hashes of runner, adapter, ledger, statistics and all
   transitively used state/context/session/timing transformation modules. Verify
   files against those hashes at execution. Pass expectedRegistrySha256 to the
   writer. Do not alter the frozen registry or accepted artifacts. Any code fix
   after a failed attempt needs a new manifest/run ID with the failure retained.
3. Run synthetic checks covering identity/timing, missing outcomes, reconstructed
   denominators, provenance refusal and complete ledger enumeration. Then execute
   this one batch on existing archives into a new ignored output directory.
   Record every candidate once in registry order, including empty, unavailable
   and ineligible attempts; validate all records and require complete=true and
   exactly 2,548 unique candidate IDs. Retain logs and exceptions; no selective reruns.
4. Produce docs/GOLD_FIRST_COMBINATION_RESULTS.md with artifact/manifest hashes,
   exact command, all-attempt status totals, direction and return-magnitude
   summaries, year support/consistency, exclusions and dependence limitations.
   Attach an exhaustive machine-readable ledger. Show exact/delayed endpoint
   counts separately; retain pooled summaries without implying independence.
   Use baselines matched to the declared cohort/horizon/endpoint and feature/context
   availability, state their denominators explicitly, and do not infer incremental
   predictive edge from pooled signs. No sorted leaderboard, best-candidate choice,
   p-value claims, executable P&L, accuracy claim or fitted formula. Keep the seven
   missing variables and the macro redefinitions visible.
5. Run focused tests and npm test, commit scoped implementation/reporting, submit
   unique 011 envelope with manifest, all attempt counts, invariance, tests and
   source/code/output hashes. Report activity throughout and pause for review.

Owned scope: new runner/adapter, their synthetic tests and execution-contract docs,
new ignored manifests/rows/ledgers/logs, results and concise progress notes. Extend
existing modules only to expose unchanged logic; prove unchanged prior outputs.
No acquisition, calendar/timing redefinition, source proxy, holdout reservation or
use, warehouse/live workflow/Layer 1/dashboard mutation, integration, deployment or
purchase. If a required accepted input is unavailable or reconciliation fails,
submit a concrete blocker rather than fill gaps or change policies.

## Revision 2 request after review of run-011 r1

Revision 1 at clean worker HEAD 27fa8e9 is not accepted. Preserve the frozen
registry and all three existing run directories. Correct only the baseline and
reporting issues below, then submit a unique revision 2 and pause.

1. Derive each candidate's baseline from computed outcomes in the same declared
   cohort, horizon and endpoint after requiring all of that candidate's atom
   variables to be available and, only for a declared context option, the context
   field to be available. Do not condition the baseline on matching the candidate's
   states. Record and validate the resulting per-candidate n and median rather than
   passing the universal n=964 baseline to every record.
2. Add fail-closed synthetic tests for atom availability, context/no-context
   availability, baseline denominator and median validation, and a comparison-sign
   change relative to the cohort-wide baseline.
3. Commit code and tests before outcomes, prepare a new immutable manifest/run ID,
   and rerun all 2,548 frozen candidates once. Retain r3 unchanged; no selective
   ledger rewrite. Reconcile all prior non-baseline totals and report all changed
   baseline summaries.
4. Commit the descriptive-analysis generator or equivalently bind its code plus
   input/output hashes. Correct the results wording: pooled all_computed explicitly
   sums separately reported endpoint groups, and this batch executed h24 only.
   Update the machinery document's historical no-execution wording. State that the
   first failed preparation retained a manifest/start log and source-level cause,
   but no contemporaneous exception record.

Independent review evidence: manifest and all 2,548 ledger records verified; 81/81
reconciliation checks, focused 57/57 and full local 441/441 passed. The correction
is required because 2,481 candidate availability-matched baseline denominators and
medians differ from the universal record, and 19 comparison signs change. Do not
change the registry, inputs, timing, min_n, cell, holdout status or production.
