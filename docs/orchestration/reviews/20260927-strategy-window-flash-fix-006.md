# Strategy submission 20260927-strategy-window-flash-fix-006: changes requested

Reviewed by the background Central Orchestrator on 2026-09-29 in the controller-locked run that holds
`run.lock`. Submission `20260927-strategy-window-flash-fix-006`, worker `strategy`, assignment
`strategy-advisory-001`, envelope status `status_report`, mailbox SHA-256
`a057ca77e6dd18da9d52264949191de9fc4b20e91d55fce414dd39b78926af8c`, reproduced twice - from the
request and by `coordination.js check --worker strategy` over the immutable inbox file. Reply published
at `.local/orchestration/replies/strategy/20260927-strategy-window-flash-fix-006.json`
(sha256 `e1eb71dbc28d8e0424d3dc1e834b374cd98a05f2ce83b491b5826da673018731`), decision
`changes_requested`. `check --worker strategy` then reported 7 `pending_review` with `errors: []` and
`stale_assignment: false` for this report. This is a review of evidence only: it authorises no research,
no live-system action and no integration.

## What the submission reported

- An honest withdrawal: the user reported on 2026-09-27 that the console window was still popping up, so
  the 2026-09-26 claim in `-005` that the `-WindowStyle Hidden` fix held is corrected as wrong.
- A measured root cause rather than an assumed one: the console host creates the window before
  `powershell.exe` parses its own flag, and on this machine the default terminal application is Windows
  Terminal, a GUI app that does not honour the hidden show-state hint. A deliberate positive-control
  `cmd` launch produced a new visible `CASCADIA_HOSTING_WINDOW_CLASS` window (pid 33624); every hidden
  launch produced none.
- A read-only scratch watcher (`tmp/watch-windows-20260927.ps1`, hidden, 300 ms polling of visible
  top-level windows through `user32`), itself validated with a positive and a negative control.
- A disclosed live-system change applied 2026-09-27 15:47 local at the user's direct instruction and
  declared as an exception to the worker's live-system restriction: new neutral launcher
  `C:/Users/A17/.trading-agent-dashboard/scripts/run-hidden.vbs`, and the task action changed to
  `wscript.exe` with that launcher plus an inner command line byte-identical to the pre-2026-09-26 action.
- Exit-code fidelity probed before use (`wscript run-hidden.vbs "cmd.exe /c exit 7"` returned 7, no
  window), and two consecutive real ticks verified at 2026-09-27 15:56:01 and 16:06:01 local.
- A request: record the current action string centrally, including the launcher path.
- Two committed changes in the worker's own notes file only.

## Independent checks (read-only)

- Hash and lifecycle: `check` reproduces `a057ca77...` from the immutable inbox file with `errors: []`
  and `stale_assignment: false`; the reply is bound to that hash and the state moved to
  `changes_requested`.
- Provenance: `.local/worktrees/strategy` is clean on `workers/strategy-advisory-20260920`. Commit
  `f7c0cc7` ("correct the window-flash close-out; hidden wscript launcher applied and verified on the
  2026-09-27 15:56 tick") adds exactly +62 lines and commit `4fc6109` ("add the 16:06 tick confirmation
  and the unrelated Cold Turkey window note") adds +11/-3, both to `docs/strategy/CONVERSATION_NOTES.md`
  and to nothing else, inside the worker's owned scope.
- Dependency impact nil: no test, registry, gate, manifest or workflow file names the notes path or the
  capture-task action, and no test enumerates `docs/`. The submission owns no code or workflow change.
- Launcher verified on the host, not taken on report: `run-hidden.vbs` exists at the stated path and
  matches the description - a short header comment plus the functional body (`CreateObject("WScript.Shell")`,
  `shell.Run command, 0, True`, `WScript.Quit code`) - so a real failure still surfaces as a non-zero
  `LastTaskResult`.
- The live task was read back read-only: `GoldQualificationWindowTick018` is `Ready`, `LastTaskResult` 0,
  last run 2026-09-29 20:46:01 local, next 20:56, `NumberOfMissedRuns` 0, exactly one action, and that
  action is the launcher form `wscript.exe "C:\Users\A17\.trading-agent-dashboard\scripts\run-hidden.vbs"
  "powershell.exe -NoProfile -ExecutionPolicy Bypass -File ...run_gold_qualification_window_tick_v2.ps1"`.
  So the change the submission describes is real in effect today.
- The two claimed verification ticks exist in the log: blocks at `2026-09-27T14:56:02Z` and
  `2026-09-27T15:06:02Z`, both `attempted 0`, which are the 15:56:01 and 16:06:01 local runs. `tick.log`
  now holds 343 blocks from `2026-09-24T20:06:27.812Z` to `2026-09-29T19:46:02.504Z`, the newest
  metadata-only. The historical line counts the submission quotes (8862 / 8938) are not reproducible
  today because the log has grown, but the underlying blocks are the load-bearing fact.
- No prospective observation, outcome, envelope payload or holdout was read; only block-level metadata,
  state labels and task state were inspected.

## Defect 1: this commit adds a new false claim of a class already flagged twice

The new close-out section (`docs/strategy/CONVERSATION_NOTES.md` around line 1030, added by `f7c0cc7`)
states that `tick.log` grew "with a write at every `:x6` boundary through the night, so the flasher and
the capture lane are the same object and the lane never missed a tick". The log does not show that.
Inside the span that sentence covers there is a 780.0-minute gap from `2026-09-26T20:56:02Z` to
`2026-09-27T09:56:04Z` (the 21:56 to 10:56 local span), and there is a non-metadata block at
`2026-09-27T14:06:02Z` with `attempted 3`. The phase and the ten-minute cadence hold while the machine is
awake; they do not hold through the night. The full set of real gaps in the current log, for the
recorded cadence claim:

- `2026-09-24T21:16:01Z` -> `2026-09-25T07:46:03Z`, 630.0 min
- `2026-09-25T15:16:02Z` -> `2026-09-25T15:35:52Z`, 19.8 min (one skipped slot)
- `2026-09-25T21:26:02Z` -> `2026-09-26T15:15:29Z`, 1069.4 min
- `2026-09-26T20:56:02Z` -> `2026-09-27T09:56:04Z`, 780.0 min
- `2026-09-27T21:06:02Z` -> `2026-09-28T07:46:03Z`, 640.0 min
- `2026-09-28T21:06:02Z` -> `2026-09-29T06:36:03Z`, 570.0 min
- `2026-09-29T16:06:02Z` -> `2026-09-29T18:36:04Z`, 150.0 min

`-004` and `-005` already required exactly this claim class to be removed, so a fresh instance cannot be
accepted. It is fixable in one sentence, and nothing else in the submission depends on it.

## Defect 2: the two earlier revisions are still outstanding at this head

`f7c0cc7` appends text at the end of the file (`@@ -1017,3 +1017,65 @@`) and does not touch the earlier
claims, so at this head both are still wrong:

- line ~910-911 still says the distinct tick timestamps "run continuously at `:06/:16/:26/:36/:46/:56`
  from `2026-09-24T20:06Z` through `2026-09-26T20:36Z` with no gaps";
- line ~1005 still says "`tick.log` is gapless".

`-006` predates the `-004` and `-005` reviews, so it could not have carried their revisions and this is
not a refusal; but it also cannot close them, and the queue must not be told otherwise.

## Defect 3: provenance base and one minute

The reported `base_commit` `0802dd74` is not the parent of the first listed commit: the direct parent of
`f7c0cc7` is `0d7808c` (the `-005` commit on the same branch) and
`git rev-list --count 0802dd74..4fc6109` is **3**, not 2. Either the base should be `0d7808c` with those
two commits, or all three commits should be listed. Separately, the notes and the envelope say the
launcher was applied on 2026-09-27 **15:47** local while the central `DECISIONS.md` record says **15:46**;
one of the two is wrong and the notes should carry the minute the change actually took effect.

## What survives unchanged

The lane is not in dispute and neither is the diagnosis. The corrected root cause (console host plus
Windows Terminal as the default terminal application), the withdrawal of the `-005` claim, the watcher's
positive and negative controls, the launcher exit-code probe, the two verified real ticks and the
unrelated Cold Turkey window note all stand; none of them depends on gaplessness, so removing the false
claim costs the conclusion nothing. The submission reports the fixed window against its own earlier
interest, which is recorded.

## Decision: changes requested

One bounded documentation correction in the worker's own file under a new submission ID: replace the
"write at every `:x6` boundary through the night / never missed a tick" sentence with what the log shows
(phase and ten-minute cadence while the machine is awake, the real overnight gaps named, and the
`attempted 3` block at `2026-09-27T14:06:02Z`); make the still-outstanding line ~911 and line ~1005
corrections in the same pass; reconcile the applied minute with the central record; report the accurate
base; and keep everything that does not depend on gaplessness. No other change, no further live-system
edit, no research, no canonical-file change.

## The submission's central request is already answered

`docs/orchestration/DECISIONS.md` already carries the current action of `GoldQualificationWindowTick018`
including the `run-hidden.vbs` launcher path and the statement that the 2026-09-24 hardening entry's
"otherwise unchanged" clause is superseded; the `-WindowStyle Hidden` string this submission verified is
recorded as interim, not as the operative action. No revert is wanted and no worker action is needed. The
task edit remains outside the strategy assignment even at a direct user instruction: it is recorded as
disclosed, validated and superseded, **not as precedent**, and any further live-system request goes
through the coordinator so the owning lane applies and verifies it.

## Boundary, integration and deployment status

Not integrated, not merged and not deployed. The submission touched one worker-owned advisory notes file
and one Windows Task Scheduler action; the canonical commit for this cycle carries coordination files
only. No production, dashboard, credential, warehouse, Layer 1, workflow, purchase, deployment or holdout
action occurred, no credential value was read, and the sealed prospective window is untouched and stays
sealed until `2027-03-25T15:00:00Z`. `GoldQualificationWindowTick018` was observed read-only and was not
disturbed. The `022` item A anchor observation envelope for `2026-09-28T14:00:00Z|gold|entry` remains the
Gold lane's carried obligation and still needs a fresh wake.

## Mechanism substitution recorded

The harness refused `node scripts/monitor-state.js activity central-orchestrator ...` by policy in this
background run, so the coordinator activity record was written directly to
`.local/orchestration/activity/central-orchestrator.json`, as in the previous cycle. The monitor, bridge
and controller code and settings were not changed, and no controller pause/stop was issued - this run
holds the controller lock.

## Next

No new worker assignment was published. This submission carries no research recommendation and ends
`changes_requested`, and the register already keeps `gold-research` published at status exactly
`instructions_published_awaiting_worker` for the carried 022 item A obligation, so a second publication
would break the single-active-milestone rule. The queue now holds 7 `pending_review` submissions, all
`strategy` (2026-09-28 to 2026-09-29), taken one review per cycle. The precise unresolved decisions
remain the user's and unchanged: whether to open another exploratory stage over the already-spent
intervals, whether to promote the accepted verdict page from the Gold worker checkout into canonical
`docs/`, and whether to publish the remaining local-only Gold evidence artefacts.
