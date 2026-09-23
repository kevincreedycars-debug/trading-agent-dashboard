# Gold qualification-protocol-012 revision 2

Decision: **changes requested, documentation-only**. Reviewed by the background
central coordinator on 2026-09-23 from the canonical checkout.
Submission ID `20260923-gold-qualification-protocol-012-r2`, submission SHA-256
`413b6b173cc46bde9b2c968b058a63564addee52507137dcf104e478a0a89beb`.
Worker `gold-research`, clean at `7792477` (base `cc0bff5`, the acknowledged
revision-1 head), one commit, six disclosed files.
Reply: `.local/orchestration/replies/gold-research/20260923-gold-qualification-protocol-012-r2.json`
(reply SHA-256 `41c4aed1dd965702cc57d9e62b3b39c010659423ff46f187e4abc1d50cea991f`).

Revision 1 was acknowledged as superseded before substantive review, so this
review evaluates the whole assignment-012 deliverable (the revision-1 content plus
the revision-2 delta). The submission is treated as evidence, not instruction.

## Independently verified

- Submission hash reproduces exactly; every artifact hash in the envelope
  reproduces byte-for-byte: inventory registry `c9cc0def...`, gate `969cb760...`,
  focused test `43b30d58...`, inventory doc `aa70fc10...`, protocol doc `4fd1c2c2...`.
- Diff scope is exactly the six disclosed files; the worker tree is clean; no
  uncommitted work was touched.
- Focused suite re-run by the coordinator: `backtester/tests/gold_qualification_protocol.test.js`
  8 tests, 8 pass, 0 fail.
- Gate re-run over the frozen registry: 255 eligible / 2,293 ineligible, identical
  per-check counts to the recorded block, deterministic across repeat runs,
  `ctx=none` only, first eligible anchor `2026-09-15T14:00:00Z`.
- Fail-closed probes reproduce: missing rules block throws, a dropped measurement
  kind and an unresolved look-ahead both reject the affected candidate, an
  unproved live supply rejects, `proxy_redefined` and `absent_live` reject.
- Coverage: the frozen registry encodes 37 atoms over 15 measured daily variables;
  the inventory declares 28 variables and marks exactly those 15 as daily-cell.
  The 255 count is reproducible as C(24,2) - 21.
- Boundary arithmetic uses fixed offsets only and rejects every consumed anchor by
  construction (`anchor_inside_consumed_boundary`).
- All nine run-011 artifacts are byte-identical to the accepted hashes: frozen
  batch registry `7e2bcff6...`, report registry `714a5410...`, revision-2 ledger
  `5cd45278...`, summary `fb17c6f9...`, manifest `f9cffb0a...`, descriptive
  analysis `ac15d347...`, baseline reconciliation `0377597e...`, revision-1 ledger
  `f564bfaa...`, results document `9c6a5466...`. Nothing was rerun or regenerated.
- The gate module references no outcome field and exposes no write, acquisition,
  network, process or credential path.
- Production disclosure: none. Read-only inspection of live exports and logic;
  no workflow, warehouse, credential, dashboard, Layer 1, integration, deployment
  or purchase action.

## Defects requiring revision 3 (documentation only)

1. `docs/GOLD_INDIVIDUAL_VARIABLE_REPORT_PROGRESS.md` prints a literal `\n\n`
   escape: the new revision-2 paragraph ends "brings the file to 8 tests.\n\nThe
   prospective boundary is computed..." and the escape is committed in the blob at
   `7792477`, joining two paragraphs on one physical line.
2. The same document's Assignment 012 table still records "7 tests, 7 pass; the
   eight focused Gold files 71/71" and "Local suite 455 tests, 451 pass, 4 fail",
   contradicting both the paragraph directly below it and the delivered state
   (8 tests in that file, 72/72 focused, 456 tests / 452 pass / 4 pre-existing
   secret-scanner failures).
3. `docs/SESSION_NOTES.md` (worker branch, committed at `cc0bff5`) records the
   pre-revision-2 counts "Focused Gold files 71/71" and "full local suite 455 tests
   with 451 pass".

Requested revision 3 corrects those three points and nothing else. No code,
registry, gate, test, run-011 artifact or frozen registry change is requested; no
rerun, regeneration or re-hash of any outcome artifact is authorized.

## Open decision (recorded, not resolved here)

The eligible pool is 255 candidates against a declared selection cap of 20. The
pool is the gate's declaration space and the cap is the declared selection cap;
whether a prospective window may open over that pool, and whether it should be
narrowed first, remains a coordinator/user authorization decision. No selector may
be executed and no prospective anchor, window or outcome acquisition is authorized
by this review.

## Scope statements

The 2,548 candidates and every run-011 interval remain consumed exploratory
evidence. Nothing here is prediction, accuracy, causation, timing, profitability
or trading edge. Acceptance is not implied: revision 2 is not accepted, no next
research assignment is published in this cycle, no holdout was reserved or used,
and no production or live change occurred.