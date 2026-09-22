# Gold reporting-009 review, revision 2

Decision: changes requested. Reviewed 2026-09-22.
Submission `20260922-gold-reporting-009-r2`, SHA-256
`e9f0444f5f36a84decfe47b6aa4d51b2e70b5a3a56a44987687e042695cf0c5b`.
The registered worker checkout is clean at `abcc83e` on
`workers/gold-research-policy-20260920`, based on accepted `de775b5`. Revision 2
changes seven files relative to revision 1 and remains within the renderer,
synthetic registry/test, reporting documentation and unexecuted protocol scope.
No measurement, candidate execution, holdout use, live, warehouse, Layer 1,
dashboard, credential, purchase or deployment change was found.

The output-safety correction is supportable. `--overwrite` is removed, resolved
output/output and input/output aliases are rejected before any write, and the
focused regression covers the previously destructive shared digest/companion
path. Coordinator runs passed the renderer/counter tests 11/11 and the
individual-variable report tests 26/26. The submitted companion independently
hashes to the accepted
`fa6ff8eb2631208a48e8043a3d7f7a854f1d6b3ac36ba060da57ebff786a983b`; the
accepted digest remains
`4a7cfef43b7510bb73341f36ed26bd3ae4c9d218f1af005f3b2e2f5449bcd7a2`.
The worker's full-suite result was inspected, not promoted to a clean pass: it
reports 416/421 with four known secret-scanner console-width failures and one
out-of-scope freshness-browser failure.

Acceptance is still withheld for two substantive corrections and one wording
cleanup.

1. The provenance check remains bypassable because any negation before a
   freshness token inside the regex-defined clause is treated as negating that
   claim. Against the committed manifest, each of these returned zero violations:
   `The 2025-10-01 to 2026-04-30 interval is not reserved and remains fresh.`,
   `... is not a holdout, although it remains untouched.`, and `... was never
   excluded and is still unread.` The implementation's clause splitter does not
   split `and`, commas or `although`, and word order alone does not establish that
   the negation applies to the freshness claim. Make the check claim-local and
   fail closed; add these exact adversarial regressions as well as accepted
   negative wording.
2. The declared universe count does not implement the declared candidate grammar.
   The protocol allows conjunctions and disjunctions, but the counter counts each
   atom pair once (`choose(37,2) = 666`) and never represents the operator. It also
   includes pairs of two states from the same variable: 29 of 666 daily pairs and
   9,218 of 16,653 event pairs after family-scoped states are excluded. If the two
   operators are distinct candidates, the submitted daily count becomes 5,328
   with those pairs or 5,096 when restricted to different variables, so the stated
   2,664 complete universe does not support the below-5,000 conclusion. Define
   whether atoms must come from different variables, define the exact allowed
   boolean operator(s) and context composition, and derive counts from the same
   candidate-identity generator/list that a later batch would use. Then either
   enumerate the complete declared universe under 5,000 or apply the predeclared
   balanced selection rule to the corrected count. This remains declaration-only;
   do not read outcomes or execute combinations.
3. Remove the remaining contradictory limit in
   `backtester/docs/gold_individual_variable_report.md`, which still says exact,
   delayed and session outcomes are "never pooled into one statistic" although
   the corrected text properly records the accepted pooled `all_computed` row.

Preserve accepted artifacts and all numbers. Submit a unique reporting-009
revision limited to these renderer tests/code and protocol/docs corrections. No
remeasurement, outcome inspection, candidate search, formula work, acquisition,
holdout reservation/use, integration or production change. No next research
execution assignment is published until the revision is accepted.
