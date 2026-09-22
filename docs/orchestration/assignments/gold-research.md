# Gold first combination batch: implementation and pre-outcome freeze

Assignment: gold-combination-registry-010. Worker: gold-research. Published 2026-09-22.
Worktree: D:/trading-agent-dashboard-codex/.local/worktrees/gold-research
Branch: workers/gold-research-policy-20260920. Starting HEAD: 7cb773a.

Reporting-009 revision 5 is accepted for exploratory reporting. The next-stage
protocol is accepted as a design boundary, not as evidence of predictive accuracy
or permission to run combinations. Proceed under this bounded assignment without
asking again.

## Objective

Implement and freeze the concrete registry and deterministic machinery for the
first exploratory combination batch, then stop for coordinator review before any
real combination outcome is aggregated.

The batch is exactly:

- cohort: `daily_snapshot_anchors`;
- horizon: `h24_post_event`;
- endpoint group: `all_computed`, with the required exact-elapsed and
  delayed-endpoint denominator fields in the eventual ledger/report schema;
- operator: `and`;
- context field: `prior_5session_return_sign`, including its three declared
  states plus the no-context option;
- universe: all 2,548 cross-variable candidates under the accepted grammar;
- selection: complete enumeration, cap 5,000, no ranking or truncation.

## Required work

1. Add a versioned immutable batch registry that records the accepted atom rules,
   excluded same-variable pairs, all 2,548 candidate IDs, candidate-list SHA-256,
   registry/report/policy/manifest inputs and hashes, cap, enumeration rule and the
   fact that every manifested interval is already consumed. The registry must say
   explicitly that no holdout is reserved and no accuracy or edge is claimed.
2. Add deterministic evaluator and JSONL-ledger scaffolding capable of processing
   that registry later. Define and validate the complete ledger schema from the
   accepted protocol, including unavailable/ineligible attempts, matched baseline,
   year support, pooled and between-year diagnostics, endpoint sub-denominators
   and dependency disclosures. Fail closed on registry/hash mismatch, duplicate or
   omitted candidate IDs, undeclared variables/states/context, changed accepted
   timing rules, output overwrite and input/output aliasing.
3. Use only small synthetic fixtures to exercise candidate evaluation, ledger
   completeness, stable order/hash, unavailable handling, exact/delayed
   reconciliation, matched baselines, year classification and refusal cases.
4. Commit the registry and implementation before any real batch execution. Submit
   the clean commit, exact hashes, candidate counts and focused/local test results
   through the canonical mailbox, then pause.

## Hard stop

Do not point the evaluator at the accepted real report or price/event sources and
do not produce a real candidate ledger, aggregate candidate outcomes, rank or name
promising candidates, choose a winner, fit a formula, tune a threshold, reserve or
read a holdout, acquire data, change any Layer 1 input, or modify live, warehouse,
dashboard, integration or production systems. Reading the accepted report only
through the existing declaration-only universe counter to reproduce the 2,548
candidate IDs is permitted; no outcome field may be traversed.

The coordinator must review and approve the frozen registry, implementation and
tests before a separate assignment can authorize execution on consumed data.

Owned files: one new versioned combination registry, new combination evaluator/
ledger modules or scripts, focused synthetic fixtures/tests, and concise Gold
research documentation. Preserve all accepted reports, digests, companions,
manifests and reporting-009 evidence unchanged. Raw evidence stays in ignored
worker-local folders. Report actual activity at start and checkpoints.
