# Strategy submission 20260926-strategy-window-flash-fix-004: changes requested

Reviewed by the background Central Orchestrator on 2026-09-29 in the controller-locked run that
held `run.lock` on pid 34192 (`controller/status.json` `reviewing`,
detail `20260926-strategy-window-flash-fix-004`). Submission
`20260926-strategy-window-flash-fix-004`, worker `strategy`, assignment `strategy-advisory-001`,
mailbox SHA-256 `e3615716262e795ee1cefda70e4ab103a93e8b9a1c12ab93ef49654ebdc6ce68`, reproduced
from the immutable inbox file by `coordination.js check`. Envelope status `status_report`.
Reply published at `.local/orchestration/replies/strategy/20260926-strategy-window-flash-fix-004.json`
(sha256 `dcd739d64f98c005403a6c2346c397146df8ea26cf650684524c6e62e5cd879d`), decision
`changes_requested`. This is a review of evidence only: it authorises no research, no live-system
action and no integration.

## What the submission reported

- A read-only diagnosis of the black console window that flashes on the desktop: it is not the
  background reviewer, which has no window, but the Gold capture task
  `\GoldQualificationWindowTick018`, whose action ran `powershell` under an interactive principal.
- A disclosed live-system change applied at the user's direct instruction, twice repeated: the task
  action was given `-WindowStyle Hidden`, with a before/after definition read-back and a promised
  behavioural check at the next real tick (2026-09-26T20:56:00Z).
- One committed documentation change in the worker's own scope and a request that the coordinator
  update the central record, because the 2026-09-24 hardening entry states the task action is
  unchanged.

## Independent checks (read-only)

- Lifecycle and hash: `check` reproduces `e3615716...`; before this cycle the submission was
  `pending_review`, after it `changes_requested`, with `errors: []` and `stale_assignment: false`.
- Worker provenance: `.local/worktrees/strategy` is on `workers/strategy-advisory-20260920` and is
  clean; base `703daf8a` is an ancestor of head `0802dd74`; the single commit `0802dd7`
  ("docs(strategy): record console-window diagnosis, the applied -WindowStyle Hidden fix on the Gold
  capture task, and the user's short-answer preference") adds exactly +97 lines to
  `docs/strategy/CONVERSATION_NOTES.md` and touches nothing else. Later commits on that branch (up to
  `92aa6ab`) belong to other briefs and are not part of this submission.
- Dependency impact nil: no test, registry, gate, manifest, workflow or production file names the
  notes path or the capture-task action (`start-coordinator.ps1` is the only other `-WindowStyle`
  consumer and is unrelated), no test enumerates `docs/`, and the changed path is a worker-owned
  advisory notes file that exists only in the worker checkout.
- Capture task, read-only: `GoldQualificationWindowTick018` is `Ready`, `LastTaskResult` 0,
  `LastRunTime` 2026-09-29 20:36:01 local, `NextRunTime` 20:46, `NumberOfMissedRuns` 0. Its action
  is `wscript.exe "C:\Users\A17\.trading-agent-dashboard\scripts\run-hidden.vbs"
  "powershell.exe -NoProfile -ExecutionPolicy Bypass -File
  ..\backtester\scripts\run_gold_qualification_window_tick_v2.ps1"`. The wrapper still only sets
  `$ErrorActionPreference`, appends metadata to `tick.log` through `Out-File` and exits with
  `$LASTEXITCODE`, so the host window style cannot change its behaviour, logging or exit code.
- The capture lane is alive and undisturbed: `tick.log` holds 342 blocks from
  2026-09-24T20:06:27Z to 2026-09-29T19:36:02Z, the newest metadata-only with `attempted 0`,
  `open_identities []` and `missed_anchor_rule blocked_no_reschedule`. The acceptance tick the
  submission promised ran: a real block at 2026-09-26T20:56:02Z with `attempted 0`, immediately
  after the reported change. No prospective observation, outcome, envelope payload or holdout was
  read; only block metadata and state labels were inspected.
- Reviewer daemon: the submission's statement that it was not running and that `status.json` held a
  stale pid was accurate when it was written; it is no longer the current state, because unattended
  review was restored on 2026-09-29 (pid 34192) with `config.json` `enabled true`. The mechanism
  claim still holds: `start-coordinator.ps1` launches the daemon with `-WindowStyle Hidden`, so it
  has no window. Bridge connections match the report today: `strategy` `disconnected`,
  `gold-research` `watching`, both on extension 0.2.1.

## The evidence defect

The submission's corroboration and the same sentence in the committed notes are not what the log
shows. They state that the distinct tick timestamps "run continuously ... with no gaps" from
2026-09-24T20:06Z through 2026-09-26T20:36Z and that every block in that range is metadata-only.

Inside exactly that window the log holds 121 blocks with two long overnight gaps and one skipped
slot, and three blocks that are not metadata-only:

- 2026-09-24T21:16:01Z -> 2026-09-25T07:46:03Z, a 630.0-minute gap.
- 2026-09-25T15:16:02Z -> 2026-09-25T15:35:52Z, a 19.8-minute gap (one skipped slot).
- 2026-09-25T21:26:02Z -> 2026-09-26T15:15:29Z, a 1069.4-minute gap.
- `attempted 1` blocks at 2026-09-25T14:06:02Z, 2026-09-26T15:15:29Z and 2026-09-26T16:06:02Z.

The gaps are consistent with the machine being asleep or off overnight and ticks resuming on wake;
the attempted blocks match the Gold lane's own `CURRENT_STATE` entry for 2026-09-26 18:45, which
records the same failed-closed attempts. So this is a documentation error in the worker's own notes,
not a dispute about the lane and not an undisclosed change.

The flasher identification itself survives: it rests on the console-action mechanism (an interactive
principal plus a console action necessarily creates a real window, and `Settings.Hidden` only hides
the task inside the Task Scheduler list), on the phase-regular `:06/:16/:26/:36/:46/:56` cadence the
log does show while the machine is awake - which is what a user sees as flashing every few minutes -
and on the explicit statements in `DECISIONS.md` that the lane must not be disturbed.

## Decision: changes requested

Changes requested rather than accepted, for one bounded documentation correction in the worker's own
file: replace the "no gaps" / "every block metadata-only" sentence with what the log shows, keeping
the flasher conclusion. The required revision is documentation only, in `docs/strategy/`, and must be
submitted under a new submission ID.

## Central record corrected instead, not in the worker's file

The submission's request to record the new task action centrally is answered with the current truth
rather than the interim flag it described. The `-WindowStyle Hidden` argument was applied on
2026-09-26 and then superseded on 2026-09-27 15:46 local, when the action became the windowless
`wscript.exe` launcher `run-hidden.vbs` - the worker's own named residual fallback - whose header
records that `-WindowStyle Hidden` still let the console host window appear. Recording the interim
string as the operative action would have enshrined a fact that was already stale, so
`docs/orchestration/DECISIONS.md` now carries the current action string and states that the
2026-09-24 hardening entry's "action unchanged" clause is superseded. No revert is wanted.

## Boundary

The task edit was outside the worker's assignment, which says "do not edit canonical files, other
workers, live systems, assignments or review decisions". It was user-instructed, minimal, disclosed
in the envelope and in the durable notes, validated by a real tick, and is now superseded. It is
recorded as disclosed and superseded, not as precedent: the reply instructs the worker to route any
further live-system request through the coordinator so the owning lane applies and verifies it. No
other boundary moved: no credential, warehouse, Layer 1, live workflow, dashboard, production,
purchase, deployment or holdout action occurred, and the sealed prospective window stays sealed
until 2027-03-25T15:00:00Z.

## Integration and deployment status

Not integrated, not merged and not deployed. The submission touched one worker-owned advisory notes
file and one Windows Task Scheduler action; the canonical commit for this cycle carries coordination
files only. The task change is a live-host fact, not a repository change.

## Next

No new worker assignment was published. The submission contains no research recommendation, and the
register already keeps `gold-research` published at status exactly
`instructions_published_awaiting_worker` for the carried 022 item A obligation, so a new publication
would break the single-active-milestone rule. The nine measured facts of this cycle: the queue still
holds nine `pending_review` submissions, all `strategy`, 2026-09-26 to 2026-09-29, so the next cycle
reviews one more of them. The precise unresolved decisions remain the user's and unchanged: whether
to open another exploratory stage over the already-spent intervals, whether to promote the accepted
verdict page from the Gold worker checkout into canonical `docs/`, and whether to publish the
remaining local-only Gold evidence artefacts.

One observation was made and deliberately not chased, because it is outside this submission and
would need the Gold driver source to interpret: the newest metadata-only block's `results` list
prints future-dated identities (2026-09-30T14:00:00.000Z) as `already_settled` while
`not_yet_eligible` is 0. It is flagged for the next cycle as unverified, not as a finding.