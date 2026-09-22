# Gold reporting-009 review, revision 3

Decision: changes requested. Reviewed 2026-09-22.
Submission `20260922-gold-reporting-009-r3`, SHA-256
`268d80fff47fa721735ea93423fa42da06f1ba84304b7e8ad590c1f533564fa9`.
The registered worker checkout is clean at `a4676ab` on
`workers/gold-research-policy-20260920`, based on accepted `de775b5`. Revision 3
changes six files relative to revision 2 and stays within the renderer, universe
generator/tests and reporting/protocol documentation. No measurement, candidate
execution, holdout use, live, warehouse, Layer 1, dashboard, credential, purchase
or deployment change was found.

The candidate correction is supportable. Candidate identity now includes one
operator per batch, both atoms must come from different variables, and context is
exactly one declared state or none. Independent generation reproduces the declared
daily 37 atoms, 29 excluded same-variable pairs, 637 cross-variable pairs and
2,548 candidates, and the event 183 eligible atoms, 9,218 excluded pairs, 7,435
cross-variable pairs and 29,740 candidates. The cap selects 5,000 event candidates
across 156 declared strata. The endpoint wording no longer contradicts the pooled
`all_computed` row. Coordinator focused runs passed 12/12 and 26/26. The accepted
digest independently remains
`4a7cfef43b7510bb73341f36ed26bd3ae4c9d218f1af005f3b2e2f5449bcd7a2`,
and the submitted companion independently remains
`fa6ff8eb2631208a48e8043a3d7f7a854f1d6b3ac36ba060da57ebff786a983b`.
The submitted full-suite log was inspected and records 418/422 with only the four
known secret-scanner console-width failures. The submission cites an ignored
`run.json`, but that file is absent and was not relied on.

Acceptance is still withheld because the provenance check is not actually
claim-local or fail-closed. It splits on a finite separator list, removes the
freshness phrase, and accepts any remaining negation anywhere in that residual
clause. Against the committed manifest, both of these returned zero violations:

- `The 2025-10-01 to 2026-04-30 interval is not reserved therefore remains fresh.`
- `The 2025-10-01 to 2026-04-30 interval remains fresh despite not being reserved.`

The negations apply to reservation, not to `fresh`; adding more conjunctions would
leave the same structural bypass. The narrow correction is to recognize only an
explicit negative construction that syntactically applies to the freshness phrase.
A fail-closed allowlist matching the renderer's standardized negative forms is
preferable to an open-ended separator list. Add the two exact regressions, preserve
the accepted artifacts, path-safety fix, candidate grammar/counts and endpoint
wording, and correct the absent-artifact claim. No combination execution, outcome
inspection, holdout use, formula work or next research assignment is authorized.
