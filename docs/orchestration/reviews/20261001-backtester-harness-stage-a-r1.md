# Backtester harness stage A r1: the shared-harness architecture - accepted as a design record only

Reviewed on 2026-10-01 from the canonical checkout `D:\trading-agent-dashboard-codex` by the coordinator lane.
Submission `20261001-backtester-harness-stage-a-r1`, mailbox SHA-256
`95119dd15abf9b2b85e0dd8c6c32cf40ec259c747704d057606a87312df85965`, reproduced independently from the immutable
inbox file (8,308 bytes) and equal to the requested hash. Reply published at
`.local/orchestration/replies/backtester-harness/20261001-backtester-harness-stage-a-r1.json` (3,738 bytes, SHA-256
`9a139f210e9551475dbbd2fe4e07ed7a722a65034291347954c726d4608fbb14`), decision `accepted`.

The decision is a design record for stage A only. It authorises no stage B, no build, no registry edit, no
integration and no live action, and it answers none of the seven questions the envelope files, which are the user's.
No acquisition, import, warehouse, n8n, Layer 1, Layer 2, dashboard, credential, workflow or deployment action was
taken by the worker or by this review.

## What the submission is

The one `status_report` the stage-A assignment owed: `docs/backtester-harness/HARNESS_ARCHITECTURE.md`, nine sections,
written from files re-verified by exact path in the worker's session - five builders, five runners plus six replay
cores, fifteen checker/validator/parity scripts, the eight registry files, the six fixtures, ten SQL migrations, the
test-discovery rule in `scripts/test-local.js` and the carried contracts. Nine ranked blockers and seven user-only
questions are in sections 7 and 8. No build work was started and the envelope does not treat stage A as
authorisation for stage B.

## Independent verification (reproduced, not trusted)

Worker `backtester-harness`, worktree `.local/worktrees/backtester-harness`, branch
`workers/backtester-harness-20260930`.

- **The deliverable reproduces byte-exactly.** `docs/backtester-harness/HARNESS_ARCHITECTURE.md` is 46,554 bytes,
  598 CRLF, 599 lines, raw-byte SHA-256
  `3416077955bddcf968d6b765cd24a40b431bd8a26a1001c0222f7ce4fb10a0f7`, equal to the reported hash, and its headings
  are the nine sections the assignment lists with seven numbered user-only questions in section 8.
  `docs/backtester-harness/CONVERSATION_NOTES.md` is 8,929 bytes, 137 CRLF, SHA-256
  `8fc7af3ae112876b99474f98ebad23c0b9f2aa61267303a652e9e792d4ce9f16`, also equal to the reported figure.
- **Scope and hygiene.** The changed set at the reported head `aea87e4` is `docs/backtester-harness/` only, the
  worktree is clean, and the branch has no upstream and no remote ref, so nothing was pushed - confirmed, not
  assumed. The canonical checkout and every other worktree were read only.
- **The two cautioned facts reproduce.** `core.autocrlf=true` with no `.gitattributes` and zero bare LF in the
  sampled registries and fixtures means the document's digests are this-checkout materialisations and not
  materialisation-independent gate digests, so no harness gate can bind until the `eol=lf` entry, the
  renormalisation and the regression test exist. And the register/assignment disagreement reproduces: the assignment
  at `docs/orchestration/assignments/backtester-harness.md` says starting commit `ab21177` while
  `docs/orchestration/projects.json` records baseline `c673ea7` for this worker - the register is newer than the
  assignment, so both are recorded rather than silently reconciled.
- **One disclosure gap, the only item in this cycle not as filed.** The branch tip has moved past the reported
  `head_commit`: HEAD is `40d2546`, not `aea87e4`. `79c7370` added
  `docs/backtester-harness/ASSET_ENGINE_CYCLE_TIME_PLAN.md` (139 lines) and `40d2546` added
  `docs/backtester-harness/DATA_ANALYSIS_STRATEGY.md` (170 lines), both after this `status_report` was filed and
  neither disclosed to the coordinator. Both must be disclosed with byte counts and digests in the next status
  report; neither is reviewed here and nothing in either is accepted by this reply. The architecture document itself
  is unchanged and still reproduces.

## Standing limits, unchanged by this acceptance

The two accepted Gold gate registries (`gold_qualification_window_manifest.v1.json` 14,058 bytes and
`gold_combination_batch_daily_h24_and.v2.json` 768,146 bytes) remain absent from the canonical checkout; the spike's
ten shared-platform files remain unmerged under `changes_requested_awaiting_revision` at
`.local/worktrees/backtester-spike` `927f799`; and no asset lane has filed a readiness document. Stage B stays closed
until the user rules on the layout, ownership and "where the harness lives" questions in section 8; the coordinator
will put those to the user as one block rather than open work around them.
