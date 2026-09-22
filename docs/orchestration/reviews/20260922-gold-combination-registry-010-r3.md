# Gold combination-registry-010 revision 3 accepted

Reviewed 2026-09-22 on explicit user request. Clean worker a185086, five-file
revision diff inspected. Submission SHA-256:
c104639574b5620f2b4adc6dcbeae07bcd340e92f007e9e30fc25413b2c9d68c.
Worker activity text cites a different hash; the authoritative immutable mailbox
bytes were checked and this reply binds to those bytes, not the activity text.

Coordinator focused tests pass 50/50. Independent synthetic probes verify rejection
of lowered min_n, exact/conflicting duplicate anchors, missing identities, missing
input paths, registry object/file mismatch and wrong approved digest. Twenty
unique synthetic anchors aggregate correctly; approved pinned writer verifies
2,548 candidates without creating a ledger or aggregating real outcomes.
Evidence: worker tmp/coordinator-010-r3-tests.log and coordinator-010-r3-probes.js.
Frozen registry remains SHA-256
7e2bcff68a6054e7f7635225e06ed80a1557e6525f8a068dfa926ccf142759a2.
Inspected full-suite log: 430/434 with four disclosed scanner failures; not rerun.

Accepted as bounded machinery checkpoint, not trading qualification. New separate
assignment gold-combination-run-011 permits one frozen exploratory batch on already
consumed data after runner/adapter tests and pre-execution manifest/commit. It must
pin the approved registry and bind runner, adapter, statistics/state/session/timing
transformation dependencies and raw source artifacts, not merely the ledger file.
No source expansion, holdout, formula selection, integration or production change.
