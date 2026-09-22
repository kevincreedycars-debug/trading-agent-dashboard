# Gold combination-registry-010 revision 2

Decision: changes requested. Manual review explicitly requested on 2026-09-22.
Submission hash: 0ef022d594d0baa08b10a22c593c0dc8de96aadf8043be783f67282e256f3908.
Worker clean at e8b9a89; five-file diff against 50d3276 inspected. Frozen registry
SHA-256 remains 7e2bcff68a6054e7f7635225e06ed80a1557e6525f8a068dfa926ccf142759a2.

Independently ran combination and renderer tests: 22/22 pass. Inspected full-suite
log: 428/432, four disclosed secret-scanner failures; full suite not rerun here.
The requested endpoint, computed-n, no-context and provenance-field corrections
are present. Additional synthetic probes reproduce three execution-blocking gaps:

- Record threshold override: evaluate one synthetic row under a copied registry
  with min_n=1; validation against original min_n=20 returns true for reported n=1.
- Duplicate anchors: twenty copies of one synthetic row yield reported n=20 and
  pass validation. There is only one unique observation.
- Unverified writer identity: omit every source input path and supply a one-candidate
  in-memory registry with a recomputed list hash alongside the unchanged frozen
  2,548-candidate file. Writer construction succeeds and reports that file's hash
  for the different registry. No records were appended and no real outcomes read.

Ignored evidence in worker tmp/: coordinator-010-r2-probes.js,
coordinator-010-r2-probes.json and coordinator-010-r2-tests.log.

The four revision-1 correction paths are implemented and coordinator focused tests pass 22/22, but three independently reproduced gaps still block real execution. (1) Freeze eligibility to registry.accepted_timing_rules.min_n: a record produced under min_n=1 with n=1 currently validates against the frozen min_n=20 registry as reported. Require both eligibility and year-support thresholds to equal the frozen value and derive status from that value. (2) Reject missing or duplicate anchor identities before aggregation. Twenty copies of one synthetic anchor currently produce n=20, reported, and a valid ledger record. Add exact-duplicate and conflicting-duplicate regressions; never silently deduplicate or count repeated anchors. (3) Bind the writer to actual verified inputs and the registry file. createLedgerWriter currently succeeds with all four input paths omitted and a one-candidate in-memory registry while hashing the unchanged 2,548-candidate file. Require every input path and successful hash checks, and require the in-memory registry to match the parsed frozen file before opening output. Add missing-input and object/file-mismatch regressions. Keep corrections within evaluator/writer, synthetic tests and documentation; preserve the frozen registry byte-for-byte. No real outcome aggregation, ranking, holdout use or production change. Submit a unique revision 3 and pause. The library code hash is acceptable for this scaffolding; a future execution manifest must also bind the runner/adapter and all transformation dependencies. Per-endpoint exclusion partitions are deferred; retain the current explicit primary-reason partition. See docs/orchestration/reviews/20260922-gold-combination-registry-010-r2.md.

Automation: six automatic reviews per UTC day remains unchanged. This explicit
manual review does not reset receipts or bypass the automated limit. Worker bridge
can deliver corrections independently of the coordinator review cap.
