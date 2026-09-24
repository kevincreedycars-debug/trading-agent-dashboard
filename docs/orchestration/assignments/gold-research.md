# Gold qualification execution scaffold

Assignment: gold-qualification-execution-scaffold-015. Published 2026-09-24.
Worker: gold-research. Worktree: D:/trading-agent-dashboard-codex/.local/worktrees/gold-research
Branch: workers/gold-research-policy-20260920. Starting HEAD: 715c982.
Standing user authority to advance Gold research applies.

Assignment 014 is accepted. Its immutable manifest SHA-256 is
`15cd06067a1a9fee8c6498560f4e9ab191541ee5987abc1e8f0219cff3e26f05`.
It fixes four candidate ids, consumed reference signs and 130 weekday anchors from
`2026-09-24T14:00:00Z` through `2027-03-24T14:00:00Z`, with the window ending
exclusively at `2027-03-25T14:00:00Z`. This assignment builds the fail-closed,
outcome-blind execution scaffold needed before the window can be opened. It does
not acquire source data, read a prospective outcome or execute the qualification.

1. Bind every scaffold operation to the exact accepted 014 manifest and its
   accepted four ids, order, reference signs, schedule and protocol rules. Refuse
   any changed digest, path alias, duplicate/reordered/replaced candidate, changed
   anchor, changed rule or manifest outside the registered worker root.
2. Freeze a machine-readable acquisition/evidence contract for every input needed
   to reconstruct the four candidates and Gold h24 outcomes. For each source field,
   declare source artifact type, observation timestamp, availability timestamp,
   strictly-before-anchor feature cutoff, endpoint rule, staleness/missing handling,
   raw hash and provenance requirements. Preserve the accepted source semantics;
   do not substitute a live field, revise a transformation or invent unavailable
   vintages. Unresolved provenance must fail closed and remain explicit.
3. Implement an offline readiness gate and CLI that inspect only manifest and
   provenance metadata. It must not parse feature values, prices, returns, signs,
   candidate outcomes or any post-boundary result. It must report every expected
   anchor as pending/blocked from metadata alone and reconcile exactly 130 anchors.
4. Freeze the later execution bundle schema: immutable run manifest, raw-source
   hash inventory, per-anchor feature-availability ledger, separate exact/delayed
   endpoint ledger, exclusions, and final four-candidate report. Define append-only
   or new-directory-only writes and a sealed intermediate state that exposes no
   aggregate, direction, return, reference comparison or candidate result.
5. Enforce the no-interim-read boundary in code. No evaluator or report may run
   before the final anchor's 24-hour endpoint plus the accepted one-hour availability
   lag: **2027-03-25T15:00:00Z**. Refuse clock overrides, partial-window evaluation,
   early stopping, schedule shortening, anchor backfill, extension/restart for a
   candidate, and direct imports that bypass the gate. The scaffold may use only
   synthetic fixtures whose timestamps are outside the real 014 window.
6. Provide a concise execution runbook describing the future acquisition command,
   evidence sealing, failure recovery and final one-time evaluation sequence. Mark
   every command that is declared but not run. No scheduler, daemon or unattended
   job is authorized in this assignment.
7. Add adversarial focused tests for manifest drift, path aliasing, source-contract
   incompleteness, value/outcome-field access, all 130 anchor statuses, pre-boundary
   evaluation, partial evaluation, overwrite/reuse, direct-import bypass and
   deterministic byte-identical dry-run output. Run focused tests and `npm.cmd test`,
   submit one unique 015 envelope, and pause for coordinator review.

Owned scope: new offline scaffold library/CLI, a source/evidence contract registry,
synthetic-only fixtures, focused tests and scoped documentation. Preserve the
accepted 014 commit and artifact, 012/013 code/docs/artifacts, frozen registry and
all run-011 evidence byte-for-byte. Do not acquire or inspect any real observation
at or after `2026-09-24T14:00:00Z`; do not open, execute or simulate the real
window; do not expose an interim result; do not reserve/consume a separate holdout,
fit a formula or alter ids, signs, schedule or rules. No network, credential, live
workflow, warehouse, Layer 1, dashboard, integration, deployment, purchase, weight
or production change. Stop and submit a blocker if the outcome-blind contract cannot
be enforced exactly.
