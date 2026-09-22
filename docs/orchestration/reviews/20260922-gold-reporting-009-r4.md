# Gold reporting-009 review, revision 4

Decision: changes requested. Reviewed 2026-09-22.
Submission `20260922-gold-reporting-009-r4`, SHA-256
`b1a3363e5c90602b67c4c8eee3124de57b858fb565d2d2aa8e7444b8fe31557e`.
The registered worker checkout is clean at `5d3f890` on
`workers/gold-research-policy-20260920`, based on accepted `de775b5`. Revision 4
changes four files relative to revision 3 and stays within the renderer, focused
test and reporting-documentation scope. No measurement, candidate execution,
holdout use, live, warehouse, Layer 1, dashboard, credential, purchase or
deployment change was found.

The previously absent evidence is now present. The ignored revision-4 directory
contains `run.json`, the digest, companion, line diff and full-suite log. The
companion independently hashes to accepted
`fa6ff8eb2631208a48e8043a3d7f7a854f1d6b3ac36ba060da57ebff786a983b`,
and the frozen accepted digest remains
`4a7cfef43b7510bb73341f36ed26bd3ae4c9d218f1af005f3b2e2f5449bcd7a2`.
Coordinator focused runs pass 12/12 and 26/26. The submitted full-suite log records
417/422: the four known secret-scanner console-width failures and the disclosed
out-of-scope freshness-browser failure. The accepted candidate grammar/counts,
path safety, numerical results and endpoint wording are unchanged.

Acceptance is still withheld because the claimed fail-closed allowlist has another
unrelated-negation bypass. `NEGATED_FRESHNESS_FORMS[3]` matches a freshness token,
then up to 40 arbitrary non-punctuation characters, then a later copula plus
`not permitted|allowed|available|treated|used|read`. That span can cross a
conjunction and a different subject, so the later prohibition is incorrectly
treated as negating the earlier freshness claim. Against the committed manifest,
all four of these returned zero violations:

- `The 2025-10-01 to 2026-04-30 interval remains fresh but its reuse is not permitted.`
- `The 2025-10-01 to 2026-04-30 interval stays untouched, though publication is not permitted.`
- `The 2025-10-01 to 2026-04-30 interval remains pristine while access is not allowed.`
- `The 2025-10-01 to 2026-04-30 interval remains unused because reading is not permitted.`

Narrow or remove the forward-form matcher so it recognizes only the renderer's
exact standardized negative statement, with no intervening clause, subject or verb
capable of changing what the negation applies to, and add the four exact
regressions. Preserve the accepted artifacts, new `run.json` evidence, path safety,
numbers, candidate grammar/counts and endpoint wording. Submit a unique
reporting-009 revision. No outcome inspection, combination execution, formula
work, acquisition, holdout reservation/use, integration or production change is
authorized. No next research assignment is published until this condition is
accepted.
