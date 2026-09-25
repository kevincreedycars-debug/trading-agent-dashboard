# Gold coverage-021 revision 1: accepted

Reviewed on 2026-09-25 by the background Central Orchestrator (a controller-locked run,
a session separate from authorship). Submission `20260925-gold-coverage-021-r1`, mailbox
SHA-256 `8a2edb6ad7016fe797ab13d68a2c8daf4aa7379c98e19c679ed735f5d6c292b1`, reproduced
independently and matching the requested hash. Reply published at
`.local/orchestration/replies/gold-research/20260925-gold-coverage-021-r1.json` (SHA-256
`adcaaf917b6555c725702d86bf8335b911e2b706f16cfc54064845745b8fc740`). This review is a
separate session from authorship; acceptance is a checkpoint, not integration, merge,
deployment or a trading result.

## Scope checked

Worker `gold-research`, worktree `.local/worktrees/gold-research`, branch
`workers/gold-research-policy-20260920`, base `35ad4bb5` (accepted 020 delivery), HEAD
`a9bb3654`, working tree clean, exactly one commit between base and HEAD (the base is an
ancestor). Nine changed files, exactly the disclosed set: four new v2 files, four amended
files and one progress-document section. No accepted or frozen artifact is modified - no
005/006/008 report or registry, no 014/015/016/017/018/019/020 artifact, no frozen window
manifest, no sealed capture and no immutable blocked attempt.

## Independent verification

- Coordinates as delivered. New v2 files reproduce their raw and LF digests:
  `gold_qualification_activation_v2.js` `6d30b258`/`e1aaf5d4`,
  `run_gold_qualification_window_tick_v2.js` `6b68485e`/`45fbe4d5`,
  `run_gold_qualification_window_tick_v2.ps1` `96de5859`/`afe27f2b`,
  `gold_qualification_activation_v2.test.js` `f5626ef9`/`c875a395`. Amended files reproduce
  their new raw digests, and their prior LF digests at base `35ad4bb5` are the disclosed
  `was blob` values: selector `771e844e` (was `6de0dbfd`), shortlist selection `a1aae5b8`
  (was `25ecb4cf`), window test `9bba56fa` (was `f7b1f394`), shortlist doc `a650d27c`
  (was `dcc420e8`).
- Preserved v1 files and the scheduler package carry their accepted LF digests:
  `gold_qualification_activation.js` `5fdd9105`, `run_gold_qualification_activation.js`
  `57bc6e09`, `run_gold_qualification_window_tick.js` `a32b81fe`,
  `run_gold_qualification_window_tick.ps1` `27668813`,
  `gold_qualification_scheduler_package.v1.json` `6b0eaf07` (byte-identical).
- Frozen artifacts reproduce byte-identical: 013 shortlist `ffa69b30`, 013 audit
  `e7c57773`, 014 window manifest `15cd0606`, the three sealed anchor-2 envelopes
  `302e4a26`/`58ece552`/`c51ad9b9`, and the one immutable blocked attempt.
- Focused tests re-run by the coordinator: `gold_qualification_activation_v2.test.js` 7/7;
  `gold_qualification_shortlist.test.js` 7/7; `gold_qualification_window.test.js` 8/8.
- Item A code inspected: `requestWindowForItemV2` clamps the OANDA request end to the
  observed clock minus the declared one-hour availability lag and reports `future_dated`
  as `clampedTo <= from`; `eligibilityForItem` returns `not_yet_eligible` inside the open
  lane before any provider call; the v2 tick returns that state without sealing, creating a
  directory or incrementing the attempt bound, so the identity stays unconsumed and is
  re-evaluated by the next tick. The accepted lane boundaries, gate, sealer and credential
  scope are reused by reference, and the v2 path re-verifies the pinned v1 files in
  LF-normalised form and fails closed on a drifted copy.
- Outcome-identity reproduced independently against the amended default: the selection was
  re-run into `tmp/coordinator-verify-shortlist-021-20260925` and returned shortlist
  `36111cb6`, audit `9ac72c0f`, the identical four ids at frozen positions 1, 2, 4 and 5,
  pool 2548 declared / 255 eligible, 4 selected, 255 audit entries byte-identical,
  `reconciliation_ok` true and identical `used_variables`. The only differing keys are
  `provenance` and `inputs`: the embedded inventory digest, now `b7687622` normalised with
  the raw `863c4e02` recorded beside it.
- Item A live swap read back from the host: `GoldQualificationWindowTick018` now runs the
  v2 wrapper with the same `powershell -NoProfile -ExecutionPolicy Bypass -File` execute,
  no working directory, one One-Time-Only `PT10M` trigger, `MultipleInstancesPolicy`
  `IgnoreNew`, `StartWhenAvailable` true, both battery flags false, exactly one Gold task,
  last run `18:56:01` local with `Last Result 0`. `tick.log` holds 71 metadata-only blocks
  (68 v1 plus three v2: dry `17:38:12Z`, real `17:46:02Z`, next scheduled `17:56:02Z`) with
  no value words.

## Environment case (not a defect)

This coordinator session exports `DEEPSEEK_API_KEY`, which the credential-scope guard
correctly refuses as overbreadth (`Credential overbreadth refused: DEEPSEEK_API_KEY is not
authorized for gold-qualification-activation-package-017`). With that unrelated variable
cleared the v2 suite is 7/7, so the worker's 7/7 reproduces and the guard is working as
designed. Recorded for the worker: the v2 capture test inherits the ambient process env, so
any extra credential variable in a non-scoped shell fails it closed - correct fail-closed
behaviour, but worth knowing when running in an IDE or coordinator shell.

## Decision

Accepted. Items A and B are delivered and verified. Answers to the three questions:
(1) the amendment-aware frozen-manifest comparison is accepted as delivered - substituting
the amended selector digest in exactly the two code-provenance fields, while asserting the
frozen artifact still records `8f3a3896` and pinning it to its own 014 run-record digest, is
the only resolution available under the hard rules and does not weaken any check;
(2) keep the v2 wrapper as the installed action and the v1 wrapper as the documented
rollback, and do not retire v1 until a real anchor entry capture is proven;
(3) the `blocked_no_reschedule` -> `interval_closed_no_backfill` mapping is accepted as
recorded and the sealer vocabulary is not extended now, because that would change an
accepted file.

## Unresolved limitations and integration status

The v2 path is proven by focused tests against an injected provider and by a live task read
back; it is not yet proven by a real anchor entry capture. The first reachable anchor is
`2026-09-28T14:00:00Z`, whose entry lane runs `15:00-16:00Z`. Anchor 1 stays permanently
missed, and a Friday anchor's 24-hour target falls on a closed-market Saturday, so its exact
and delayed endpoint identities remain expected misses rather than gaps. No outcome,
holdout, exploration, production, warehouse, Layer 1, live-workflow or credential action
occurred in this review, and evaluation stays sealed until `2027-03-25T15:00:00Z`. Next
bounded assignment `gold-coverage-022` is published, with the register at
`instructions_published_awaiting_worker`.
