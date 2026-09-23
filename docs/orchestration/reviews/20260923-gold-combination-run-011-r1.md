# Gold combination-run-011 revision 1

Decision: changes requested. Review resumed by the user on 2026-09-23.
Submission hash: fd81a72e607f14cce57546eb74e4c97b55e39d7753ddb640ed46e75aa7af969f.
Worker clean at 27fa8e9; execution occurred at 181d1c2. Frozen registry SHA-256
remains 7e2bcff68a6054e7f7635225e06ed80a1557e6525f8a068dfa926ccf142759a2.

The execution envelope is substantially sound. Independent verification passed
all 57 focused tests and the current full local suite, 441/441. Manifest verification
re-hashed the approved registry, four accepted inputs, 28 source artifacts and
14-module closure. An independent ledger traversal validated every record against
the ledger schema and registry, reproduced 2,548 unique candidates in registry
order, all 81 row-reconstruction checks, the ledger SHA-256 f564bfaa..., and all
submitted status, direction, endpoint and exclusion totals. The two preparation
failures precede aggregation; the second has a retained exception. The first has
only its manifest and start log, but its incorrect import is independently visible
at commit 2d855d1 and the fix is isolated at 7f91632.

One assignment requirement is not met. Every ledger record calls the accepted
cohort-wide n=964 / median=0.09419669826312704 row a "matched baseline". Assignment
011 instead requires matching the baseline to the candidate's declared cohort,
horizon, endpoint and feature/context availability. An independent traversal of
the reconstructed 965 rows shows:

- 2,481 of 2,548 candidates have an availability-matched baseline denominator
  different from 964; candidate baseline denominators range from 941 to 964.
- The availability-matched median differs from the recorded median for the same
  2,481 candidates.
- Nineteen candidate-median-minus-baseline comparisons change sign.

Therefore the reported baseline-difference distribution (including 695 above and
550 below) is not accepted. The candidate counts, statuses, computed outcomes,
direction totals, endpoint partitions, year summaries and exclusion totals do
reconcile, but the submission remains unaccepted as a whole until the baseline
records and dependent report are corrected.

Required revision:

1. For each candidate, derive its baseline from computed outcomes in the same
   cohort/horizon/endpoint after requiring every declared atom variable to be
   available and, only when a context option is declared, that context field to be
   available. Do not condition the baseline on matching the candidate's atom or
   context states. Record and validate the per-candidate baseline denominator and
   median; do not accept a caller-supplied universal baseline as matched.
2. Add synthetic regressions for atom availability, context/no-context availability,
   denominator/median validation and a case where the corrected comparison sign
   differs from the cohort-wide comparison.
3. Commit the correction before execution, retain all three existing run directories,
   prepare a new immutable manifest/run ID and rerun the complete frozen 2,548-row
   batch once. Do not selectively patch the r3 ledger or alter the frozen registry,
   accepted inputs, thresholds, timing or candidate cell.
4. Regenerate the descriptive analysis and results document from the corrected
   ledger. Commit the analysis generator or otherwise make its code and input/output
   hashes durable. Correct the report's conflicting claim that endpoint groups are
   "never merged" while it reports the pooled all_computed sum, and describe only
   the h24 endpoint actually executed. Update the execution-contract document so
   its historical pre-execution prohibition is not presented as the current state.
5. Describe the first failed preparation accurately: its manifest/start log and
   source-level reproduction survive, but no contemporaneous exception record was
   written. Do not backdate or imply one exists.

Keep all work inside assignment 011. No alternative cell, event-cohort search,
ranking, winner selection, formula, threshold, holdout, integration or production
action is authorized. Submit a unique revision 2 and pause.

Coordinator evidence is ignored under tmp/verify_gold_run_011.js. No production,
warehouse, dashboard, Layer 1 or credential change occurred.

