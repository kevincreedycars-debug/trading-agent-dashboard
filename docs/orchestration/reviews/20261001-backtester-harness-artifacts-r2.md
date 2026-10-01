# Backtester harness artifacts r2: the disclosure owed, and two design-only documents - accepted

Reviewed on 2026-10-01 from the canonical checkout `D:\trading-agent-dashboard-codex` by the coordinator lane.
Submission `20261001-backtester-harness-artifacts-r2`, mailbox SHA-256
`042525b150863129c41ffce088692c193dcff3bc035a9e83f5a25bc1ffc5db29`, reproduced independently from the immutable
inbox file (10,394 bytes) and equal to the requested hash. Reply published at
`.local/orchestration/replies/backtester-harness/20261001-backtester-harness-artifacts-r2.json` (3,957 bytes, SHA-256
`54aab231209aa5dd25d8b245d5115e0b7c6aec67a6d5a9567d1d8adf80675473`), decision `accepted`.

Acceptance closes the disclosure gap the accepted stage-A reply required and accepts the two documents as design-only
records. It authorises no stage B, no build, no registry or fixture, no pruning or rewriting of any existing artefact,
no integration and no live action, and it answers none of the six questions the envelope files, which are the user's.

## What the submission is

The disclosure the `20261001-backtester-harness-stage-a-r1` reply demanded, with the byte counts and digests of the two
commits that followed the reviewed head `aea87e4`, plus the two documents themselves:
`docs/backtester-harness/ASSET_ENGINE_CYCLE_TIME_PLAN.md` (how the per-asset engine build cycle could be compressed
against the measured Gold timeline) and `docs/backtester-harness/DATA_ANALYSIS_STRATEGY.md` (whether the same volume of
data can be analysed more cheaply). Both are design-only, answer questions the user asked in that window, and begin no
build.

## Independent verification (reproduced, not trusted)

- **The disclosure reproduces exactly.** HEAD is `40d2546`, the worktree is clean, and the branch has no upstream, so
  nothing was pushed. `git ls-tree -r HEAD -- docs/backtester-harness/` returns
  `b0b5061a53e26b8e9c1db8fde49fa09205fd029e` (`ASSET_ENGINE_CYCLE_TIME_PLAN.md`),
  `fb204d49161600b0600d622e3e100998edfd52ff` (`DATA_ANALYSIS_STRATEGY.md`),
  `3548290a56d29e4d1ddb9c2a3e1a0c64f93d52ca` (`HARNESS_ARCHITECTURE.md`) and
  `c0f962c4f44f2b634f716cd065f4d590814624ec` (`CONVERSATION_NOTES.md`) - every blob id as reported.
- **Both new documents reproduce byte-exactly.** `ASSET_ENGINE_CYCLE_TIME_PLAN.md` 11,878 bytes, 139 CRLF, 140 lines,
  raw-byte SHA-256 `bfc73213749c8f7a0e8a8e818d94284787c65296ffccd1bb1ac6513ba012860b`;
  `DATA_ANALYSIS_STRATEGY.md` 13,198 bytes, 170 CRLF, 171 lines, raw-byte SHA-256
  `e6e9d2fa319b82527071d0453da46534e19472c0613d4f6d4e4f71c9aa981a51`. The two already-accepted documents are
  unchanged at this head (`HARNESS_ARCHITECTURE.md` 46,554 bytes / 598 CRLF / SHA-256 `34160779...`;
  `CONVERSATION_NOTES.md` 8,929 bytes / 137 CRLF / SHA-256 `8fc7af3a...`), so the accepted stage-A record still
  describes the files on disk.
- **One measured figure is confirmed, the rest are recorded as the lane's own readings.** The accepted rev-3
  combination ledger is present in the Gold worktree at 23,948,174 bytes, as the accepted gold-coverage-024 rev 2
  review recorded. The other readings - 43.1 s on that ledger, 13 of 19 working days between 2026-09-07 and 2026-09-25,
  17 of 41 submissions being revision rounds, 78 to 94 per cent duplication across 438,743 bytes of per-asset code and
  fixtures, and the artefact volumes - come from the lane's own probes in its ignored `tmp/`
  (`duplication-probe.js` 5,520 bytes, `volumes-probe.js` 3,528, `volumes-probe2.js` 872, ignored and not on the
  branch, as the envelope states). They were not re-derived here and are recorded as descriptive readings, with the
  reproducing commands stated in the documents.
- **Scope:** the changed set at `40d2546` is `docs/backtester-harness/` only; nothing in `backtester/`, `data/`,
  `logic/`, another worktree, the register, the assignments or another mailbox was modified. The sealed qualification
  window manifest was observed as a path and a byte size only and was never opened. No acquisition, import, n8n,
  scheduler or deployment action was taken.

## Decision

`accepted`, closing the stage-A disclosure gap and accepting both documents as design-only records. The six questions
are put to the user as one block together with the seven from the stage-A report; nothing is opened around them. The
702 MB of repeated report copies, the 201,540,447-byte XLSX and its 166,615,850-byte zip are not pruned or rewritten on
this reply - that is a user decision about existing artefacts, and no existing file may be deleted or rewritten before
the user rules.
