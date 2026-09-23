# Gold combination run 011 revision 3 accepted

Reviewed 2026-09-23 at clean worker HEAD `cccbf47`, submission SHA-256
`d6463ea26b19c393b461fb9a70a6b44c1b1a878f1b888f4d6eadebfd52012ca3`.
The diff is documentation-only: one results document and one narrow regression
test. The Outcome row now describes only executed `h24_post_event`, including
`exact_offset_elapsed` and `delayed_offset_endpoint`; all three contradictory
never-merged/never-pooled statements now describe `all_computed` as the explicit
sum of separately visible endpoint groups and disclaim it as an independent
sample/statistic; the trailing blank line is removed.

Coordinator focused tests pass 26/26 across the document, ledger, run and analysis
suites. The worker is clean. No registry, input, code path, run manifest, ledger,
summary, analysis or reconciliation artifact changed or was regenerated. Revision
3 therefore closes the only remaining documentation defects from the accepted
revision-2 implementation and immutable run.

Accepted for exploratory hypothesis generation only. The 2,548 candidates are
dependent descriptions on consumed data and establish no prediction, accuracy,
causation, timing, profitability or trading edge. No live or production change is
authorized. A separate bounded assignment, `gold-qualification-protocol-012`, is
published to map research inputs to live availability and predeclare a prospective
qualification/selection protocol without ranking candidates or reading new
outcomes.
