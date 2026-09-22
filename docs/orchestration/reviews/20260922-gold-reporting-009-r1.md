# Gold reporting-009 review, revision 1

Decision: changes requested. Reviewed 2026-09-22.
Submission `20260922-gold-reporting-009-r1`, SHA-256
`7a096810eea2d831760db866b3c52ae3c9f0de9979dc6a0f0bbb0ee678076054`.
The registered worker checkout is clean at `360f48d` on
`workers/gold-research-policy-20260920`, based on accepted `de775b5`. The
nine-file diff is confined to the durable renderer, synthetic fixtures and
tests, reporting documentation and an unexecuted next-stage protocol. No live,
warehouse, Layer 1, dashboard, credential, purchase or deployment change was
found, and no holdout, new measurement or combination search was consumed.

The substantive reproduction is supportable. The committed renderer passed its
7/7 focused tests and the individual-variable report suite passed 26/26 in the
coordinator review. A fresh render from the accepted coverage-008 report,
registry, manifest and coverage-006 predecessor reproduced the exhaustive
companion byte-for-byte at SHA-256
`fa6ff8eb2631208a48e8043a3d7f7a854f1d6b3ac36ba060da57ebff786a983b`.
The digest retained 21 measured and 7 unmeasured variables and reproduced the
submitted state totals: pooled 418 with year buckets 318/9/91, exact 395 and
delayed 313. The only numeric-looking table differences from the accepted digest
were the submission label and companion path. The submitted full-suite log ends
at 417 tests, 413 passed and the four disclosed secret-scanner console-width
failures; that log was inspected, not rerun as an independent full-suite result.
Diff whitespace checking found only a trailing blank line at the end of
`docs/GOLD_NEXT_STAGE_PROTOCOL.md`.

Acceptance is withheld for three bounded corrections.

1. The provenance guard is not fail-closed as documented. It ignores an entire
   sentence if any negation token appears anywhere in it. Against the committed
   manifest, `The 2025-10-01 to 2026-04-30 interval is not reserved; it remains
   fresh.` returned zero violations. Test affirmative and negated clauses
   independently so no unrelated `not`, `never`, `ineligible` or similar word can
   mask a fresh/untouched/unused claim about a manifested consumed interval.
2. Output safety has a destructive alias. Supplying the same new path to
   `--output` and `--full` succeeds; the companion write then replaces the digest,
   while the summary reports both outputs at that one path. The assignment also
   required new ignored outputs and never overwriting evidence, but the renderer
   exposes `--overwrite`. Reject output/output and input/output aliasing and remove
   the overwrite mode so every destination must be new. Add regressions for both
   path classes and update the command/docs.
3. The protocol's candidate cap is not yet decision-ready. The declared grammar
   can exceed 5,000 candidates, but deterministic sorted enumeration followed by
   stopping at the cap leaves an arbitrary sort-order prefix. Before outcomes,
   either tighten the grammar so the complete declared universe is at most 5,000,
   or declare a deterministic, balanced selection rule and the full-universe and
   selected counts. Also correct the endpoint wording: the accepted
   `all_computed` pooled summary deliberately contains endpoint groups, so say it
   may be reported only alongside the separate exact, delayed and session-close
   denominators rather than claiming those observations are never pooled at all.

Preserve the accepted report, digest and companion and all numerical results.
Submit a unique `gold-reporting-009` revision limited to these renderer tests/code
and protocol/docs corrections. Do not rerun measurement, enumerate candidates,
search combinations, fit a formula, acquire data, reserve/read a holdout or change
live systems. No next research execution assignment is published until the
revision is accepted.
