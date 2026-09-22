# Gold combination-registry-010 review, revision 1

Decision: changes requested. Reviewed 2026-09-22.
Submission `20260922-gold-combination-registry-010-r1`, SHA-256
`ba0e58043503b090ebbbf69f3cd2b63b31329676299ab4f79a421d7fe71f5d23`.
The registered worker checkout is clean at `50d3276` on
`workers/gold-research-policy-20260920`, based on accepted `7cb773a`. The commit
adds the seven reported registry, builder, evaluator/ledger, fixture, test and
documentation files. No real combination ledger, ranking, holdout use, live,
warehouse, Layer 1, dashboard, credential, purchase, integration or deployment
change was found.

The pre-outcome registry is supportable. Independent hashing reproduces registry
SHA-256 `7e2bcff68a6054e7f7635225e06ed80a1557e6525f8a068dfa926ccf142759a2`,
2,548 candidates and candidate-list SHA-256
`23d83641284758259c70b87cd1d7a698816e16946a28cb97990a02669ffe2e83`.
It freezes the required daily `h24_post_event` / `all_computed` / `and` cell,
complete enumeration below the 5,000 cap, accepted input hashes, consumed-period
status and no-holdout/no-edge claims. The worker is clean; the cited ignored
evidence exists; coordinator focused tests pass 9/9; and the submitted full-suite
log records 427/431 with only the four previously disclosed secret-scanner
console-width failures.

Acceptance is withheld because the evaluator and ledger do not yet implement the
accepted execution contract:

1. `endpoint_denominators` counts every supplied batch row, including unmatched
   and outcome-missing rows, rather than the candidate's computed observations.
   The committed fixture therefore produces candidate `n = 21` but pooled endpoint
   `n = 30`. Candidate exact, delayed and session-close denominators must count
   computed matched outcomes and sum to the candidate `n`; attempts and exclusions
   must remain separately reconciled.
2. Eligibility uses `matched_anchors` rather than computed observation `n`.
   An independent synthetic probe with 22 matched anchors and 17 finite outcomes is
   incorrectly `reported` and `eligible` at `min_n = 20`. Status, reason and record
   validation must use `n`, and validation must reject a status/minimum mismatch.
3. A no-context candidate still treats a missing context value as unavailable.
   An independent one-row probe matches both atoms with a finite outcome but is
   labelled `unavailable`; context availability may constrain only a candidate
   that actually declares a context state.
4. The accepted protocol requires each immutable attempt to carry a run ID and
   the registry, policy, code and manifest hashes. `LEDGER_FIELDS` contains none of
   those provenance fields. Add and validate them, and make the mutually exclusive
   outcome/exclusion partition explicit enough to reconcile every attempted anchor
   (`entry_unresolved`, `endpoint_unresolved`, `blocking_absence_in_window`,
   `outcome_computed`) without collapsing outcome absence into a generic count.

Revision scope is limited to the evaluator/ledger schema and implementation,
synthetic regressions, and corresponding documentation. Preserve the frozen
candidate registry byte-for-byte unless a correction proves that impossible; do
not read or aggregate real outcomes. No execution assignment is published while
these pre-execution defects remain unresolved.
