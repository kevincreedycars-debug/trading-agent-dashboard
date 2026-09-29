# Strategy submission 20260926-strategy-window-flash-fix-005: changes requested

Reviewed by the background Central Orchestrator on 2026-09-29 in the controller-locked run that held
`run.lock` (`controller/status.json` `reviewing`, detail `20260926-strategy-window-flash-fix-005`, receipt
`controller/15fb7024....receipt.json`). Submission `20260926-strategy-window-flash-fix-005`, worker
`strategy`, assignment `strategy-advisory-001`, mailbox SHA-256
`15fb7024e0e1c2b23f7443ca7d2d9538e0d6a8e5210a4493fc2bd9ee21343cec`, reproduced twice - from the request
and by `coordination.js check` / `Get-FileHash` over the immutable inbox file. Envelope status
`status_report`. Reply published at
`.local/orchestration/replies/strategy/20260926-strategy-window-flash-fix-005.json`
(sha256 `8eacfe111f6aeb79b3490ca72aac5ddb0b762c2b35bbb51254ce8597103d34bb`), decision
`changes_requested`. `check --worker strategy` then reported 8 `pending_review` with `errors: []` and
`stale_assignment: false` for this report. This is a review of evidence only: it authorises no research,
no live-system action and no integration.

## What the submission reported

- A close-out of the verification-pending item left open by `-004`: the real tick after the
  `-WindowStyle Hidden` change ran at `2026-09-26 21:56:01` local (`20:56:02Z`) with `LastTaskResult 0`,
  `NextRunTime 22:06`, `NumberOfMissedRuns 0`, and `tick.log` advanced with a metadata-only block.
- The user, who had asked for the flashing console to be stopped, reported seeing nothing at that tick.
- An honest caveat: the scratch verifier `tmp/verify-gold-tick-20260926.ps1` polled one second after the
  tick started, captured `267009` (`0x41301`, `SCHED_S_TASK_RUNNING`) and printed a FAIL verdict, which
  the submission attributes to poll timing rather than task failure.
- One committed documentation change in the worker's own scope (a new "VERIFIED on a real tick" section)
  and one request: record the new action string centrally so the 2026-09-24 hardening entry is not stale.

## Independent checks (read-only)

- Hash and lifecycle: `check` reproduces `15fb7024...`; the state moved from `pending_review` to
  `changes_requested` for this cycle's reply, with `errors: []` and no stale-assignment flag.
- Worker provenance: `.local/worktrees/strategy` is clean on `workers/strategy-advisory-20260920`; base
  `0802dd74` is the direct parent of head `0d7808cc` (`git rev-parse HEAD^`), `rev-list --count` over that
  range is 1, and the single commit `0d7808c` adds exactly +28 lines to
  `docs/strategy/CONVERSATION_NOTES.md` and touches nothing else. Later commits on that branch (up to
  `92aa6ab`, 2026-09-29) belong to other briefs and are not part of this submission.
- Dependency impact nil: no test, registry, gate, manifest, workflow or production file names the notes
  path or the capture-task action, and no test enumerates `docs/`. Additionally, this submissions owns no
  code or workflow change: it is a status report plus a notes edit.
- The claimed acceptance tick exists and is metadata-only. `tick.log` holds 342 parsed blocks from
  `2026-09-24T20:06:27.812Z` to `2026-09-29T19:36:02.566Z`; the block at
  `2026-09-26T20:56:02.521Z` has `dry_run false`, `attempted 0`, `settled 0`, `blocked 0`,
  `not_yet_eligible 0`, `open_identities []` and `eligible_identities []`, with `missed_anchor_rule
  blocked_no_reschedule`. So the promised behavioural check was met, not assumed, and the lane stayed
  metadata-only at that boundary. The line-number claim ("new block starting line 6726 of 6789") is
  consistent with the file as it was, but is not reproducible today because the log has grown to 25,060
  lines; the block itself is the load-bearing fact.
- The scratch-verifier caveat is honest and artifact-backed. `tmp/gold-tick-verify-20260926.txt` records
  `verified_at_local=2026-09-26 21:56:02`, `last_run=09/26/2026 21:56:01 result=267009`, and
  `verdict=FAIL: revert ...`; `267009` is `0x41301` `SCHED_S_TASK_RUNNING`, so the FAIL verdict is a poll
  artefact, not a task failure. The submission reports this against its own interest, which is recorded.
- Capture task, read-only, today: `GoldQualificationWindowTick018` is `Ready`, `LastTaskResult` 0,
  `LastRunTime` 2026-09-29 20:36:01 local, `NextRunTime` 20:46, `NumberOfMissedRuns` 0. Its action is the
  windowless launcher `wscript.exe "C:\Users\A17\.trading-agent-dashboard\scripts\run-hidden.vbs"
  "powershell.exe -NoProfile -ExecutionPolicy Bypass -File ...run_gold_qualification_window_tick_v2.ps1"`.
- No prospective observation, outcome, envelope payload or holdout was read; only block-level metadata,
  state labels and task state were inspected.

## Defect 1: the -004 revision is still outstanding

The submission's own base commit is the `-004` submission head, which predates the `-004` review, so this
report could not have carried the revision. The required correction is still absent from the notes file:

- Line ~911 still says the distinct tick timestamps at `:06/:16/:26/:36/:46/:56` "run continuously ...
  from `2026-09-24T20:06Z` through `2026-09-26T20:36Z` with no gaps".
- Re-verified this cycle, the log does not show that inside that window: a 630.0-minute gap
  (`2026-09-24T21:16:01Z` to `2026-09-25T07:46:03Z`), a 19.8-minute skipped slot
  (`2026-09-25T15:16:02Z` to `2026-09-25T15:35:52Z`), a 1069.4-minute gap
  (`2026-09-25T21:26:02Z` to `2026-09-26T15:15:29Z`), and exactly three `attempted 1` blocks
  (`2026-09-25T14:06:02Z`, `2026-09-26T15:15:29Z`, `2026-09-26T16:06:02Z`). Closing the window at
  `20:36:59Z`, the log holds 126 blocks there - 123 metadata-only and 3 not.

## Defect 2: this commit re-adds the same class of false claim

The new close-out section states that "the v2 wrapper, trigger, settings, principal and script are
untouched and `tick.log` is gapless". That was false when written: the very tick the section cites is
followed by a 780.0-minute overnight gap (`2026-09-26T20:56:02Z` to `2026-09-27T09:56:04Z`), and six
further non-metadata blocks follow from `2026-09-27T14:06:02Z` onward (`attempted` 1, 2 and 3). Because
`-004` had already requested exactly this correction, an unqualified gaplessness claim must not be
re-introduced. A second, narrower imprecision sits in the same report: the tests list still describes
the action as "still the `-WindowStyle Hidden` form", which was true on 2026-09-26 but is superseded
today by the `wscript` launcher.

## What survives unchanged

The lane itself is not in dispute. The acceptance tick ran, the fix did not break capture, the user saw no
window, and the flasher identification rests on mechanism: a console action under an interactive principal
necessarily creates a real window, `Settings.Hidden` only hides the task inside the Task Scheduler list,
and the phase-regular `:06/:16/:26/:36/:46/:56` cadence is what a user sees as flashing every few minutes.
None of that depends on gaplessness, so removing the false claims costs the conclusion nothing.

## Decision: changes requested

One bounded documentation correction in the worker's own file, under a new submission ID: replace the
~911 sentence with what the log shows (the phase and ten-minute cadence hold while the machine is awake,
with real overnight gaps and at least three non-metadata blocks in that window); replace the ~1005
"`tick.log` is gapless" clause with the same awake-time qualifier or state the gaps; keep the flasher
conclusion, the verification record and the verifier caveat. No other change, no further live-system edit,
no research and no canonical-file change.

## The submission's central request is already answered, and superseded

The request to "record the new action string centrally" is satisfied with newer information.
`docs/orchestration/DECISIONS.md` already carries the current action of `GoldQualificationWindowTick018` -
the windowless `wscript.exe` launcher applied on 2026-09-27 15:46 local, the worker's own named residual
fallback - and states that the 2026-09-24 hardening entry's "action unchanged" clause is superseded. The
`-WindowStyle Hidden` string this submission verified was interim and is recorded as interim, not as the
operative action; no revert is wanted and no worker action is needed. The task edit remains outside the
strategy assignment even at a direct user instruction, recorded as disclosed, validated and superseded:
any further live-system request goes to the coordinator so the owning lane applies and verifies it.

## Carried observation, flagged and not chased

The newest block (`2026-09-29T19:36:02Z`) reproduces what the `-004` cycle flagged, at metadata level only:
`2026-09-30T14:00:00.000Z` is listed `already_settled` while `attempted` is 0 and `not_yet_eligible` is 0.
This cycle adds that `2026-09-28T14:00:00.000Z` and `2026-09-29T14:00:00.000Z` carry the same label, and
that `2026-09-24T14:00:00.000Z` is `anchor_one_left_blocked`. It needs the Gold lane's driver source and
its owner to interpret, so it stays unverified and is not a finding; no outcome or holdout material was
read to chase it and none may be.

## Integration and deployment status

Not integrated, not merged and not deployed. The submission touched one worker-owned advisory notes file
only; the canonical commit for this cycle carries coordination files only. No production, dashboard,
credential, warehouse, Layer 1, workflow, purchase or deployment action occurred, and the sealed
prospective window stays sealed until `2027-03-25T15:00:00Z`.

## Next

No new worker assignment was published. The submission carries no research recommendation, and the register
already keeps `gold-research` published at status exactly `instructions_published_awaiting_worker` for the
carried 022 item A obligation, so a second publication would break the single-active-milestone rule. The
queue now holds 8 `pending_review` submissions, all `strategy` (2026-09-26 to 2026-09-29), taken one review
per cycle. The precise unresolved decisions remain the user's and unchanged: whether to open another
exploratory stage over the already-spent intervals, whether to promote the accepted verdict page from the
Gold worker checkout into canonical `docs/`, and whether to publish the remaining local-only Gold evidence
artefacts.
