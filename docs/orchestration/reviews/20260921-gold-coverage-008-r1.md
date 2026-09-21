# Gold coverage-008 review, revision 1

Decision: changes requested. Reviewed 2026-09-21.
Submission `20260921-gold-coverage-008-r1`, SHA-256
`1a27227076026961ed9e866387d2ed5cb9ca81bd06e7f20932e082de131997b8`.
Clean worker HEAD `35e8384` from accepted baseline `3b10d73`; pre-outcome
declaration commit `f1da8ef` precedes the implementation commit. The nine-file
diff is confined to the declared report registry/library/tests, consumed-data
manifest and research documentation. No live, warehouse, Layer 1, dashboard,
deployment, purchase or credential change was found.

The core evidence is supportable. Both acquired files reproduce their ledger
hashes and counts: DFEDTARU has 1,756 usable rows; T5YIE has 1,254 rows with 1,201
usable and 53 declared missing rows. The five carried macro files are byte-identical
to the accepted archive. The submitted 84,037,259-byte report reproduces raw hash
`eefe27aa...`; its declared content hash `14447d8f...` recomputes exactly, and a
fresh independent report run produced the same content hash. The report retains
28 variables and measures 21. Daily/event primary-horizon state counts reconcile:
fed_bias 449/2,251 hawkish and 515/2,855 dovish; inflation_signal 471/2,466
positive, 469/2,491 negative and 24/149 exact-zero.

Independent structured comparison with accepted coverage-006 found identical
observation counts, matched baselines, exclusions and context strata; all 19
previously measured variable blocks are byte-identical. Existing conditioning
cells are also identical in every cohort and endpoint group. The only 1,037 added
cells belong to fed_bias or inflation_signal. Focused tests passed 70/70. The full
local suite passed 410/410; the worker's four environment-dependent scanner
failures did not recur. The implementation remains exploratory association only
and establishes no causal effect, accuracy, profitability or trading edge.

One provenance correction is required before acceptance. The regenerated digest
`docs/GOLD_VARIABLE_FINDINGS_AND_COVERAGE.md` says that no final-test split has
been "declared, reserved or consumed." That contradicts both the same commit's
consumed-data manifest and the accepted source-007 record, which identify the L2L
final-test interval 2025-10-01 through 2026-04-30 as consumed and ineligible as a
fresh final test. This is the same boundary that source-007 revision 2 corrected
and it must not be reintroduced in a downstream digest.

Correct the digest and its rendering source only. State that no holdout is
reserved for a future Gold candidate, while every interval in the manifest,
including the prior L2L final-test period, is already consumed and cannot serve as
a fresh final test. Preserve the report, source files, hashes, implementation,
manifest facts and all accepted artifacts; do not rerun measurement, acquire data,
search combinations, fit a formula, access a holdout or change live systems.
Submit a unique coverage-008 revision and pause. No next research assignment is
published until this correction is accepted.
