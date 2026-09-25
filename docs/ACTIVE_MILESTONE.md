# Active milestone

Current milestone: verify the repaired live Gold entry lane at its first reachable anchor and close the
two deferred coverage-test gaps (`gold-coverage-022`), while the accepted window keeps capturing
unattended.

Status at 2026-09-25: `017`, `018`, `019` and now `021` are accepted; `020` is closed changes-requested
with its blocker resolved by 021 item B. `021` is accepted at clean `a9bb3654` (reply `adcaaf91...`,
review `docs/orchestration/reviews/20260925-gold-coverage-021-r1.md`): the v2 entry-eligibility path is
verified by focused tests (7/7, 7/7, 8/8), the installed task action was repointed to the v2 wrapper with
every other setting identical and exactly one Gold task, the real tick returned `0`, and the normalised
shortlist binding reproduces the frozen selection. `022` is published and awaiting pickup, register
status `instructions_published_awaiting_worker`, baseline `a9bb3654`. `GoldQualificationWindowTick018`
keeps ticking every ten minutes as the only capture path (`Ready`, result `0`, zero missed runs), and
its tick log holds 71 metadata-only blocks (68 v1 plus three v2). Opening a fresh exploratory
combination stage over the 28 measured variables remains an open user decision and is not authorized.

Next immediate action on resume: confirm Gold picked up `022` from its own activity record, then review
the two coverage-test closures and, at or after the 2026-09-28 anchor, the observed live entry-lane
evidence. The capture task continues on its own and must not be disturbed.
