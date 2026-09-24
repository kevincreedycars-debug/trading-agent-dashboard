# Gold qualification window activation

Assignment: `gold-qualification-window-activation-018`. Published 2026-09-24.
Worker: `gold-research`. Worktree: `D:/trading-agent-dashboard-codex/.local/worktrees/gold-research`.
Branch: `workers/gold-research-policy-20260920`. Starting HEAD: `6cbbd01` (017 accepted).

User authority: on 2026-09-24, after being shown that the accepted 014 window opened at
`2026-09-24T14:00:00Z`, that anchor 1 is permanently missed and that anchor 2's
pre-anchor feature interval closes at `2026-09-25T14:00:00Z`, the user explicitly
authorized activating the real qualification window: a reviewed one-time capture lane
plus a scheduler install, so anchors 2-130 are captured as their declared lanes open.
Evaluation stays sealed until `2027-03-25T15:00:00Z`.

This assignment authorizes exactly two things the 017 package was forbidden to do: real
prospective capture of frozen plan identities inside their declared intervals, and the
installation of exactly one local Windows scheduled task. It authorizes nothing else.

Accepted bindings that must be re-verified by path and digest before every action:

- manifest 014 `15cd06067a1a9fee8c6498560f4e9ab191541ee5987abc1e8f0219cff3e26f05`;
- execution contract 015 `208c584427c7540b6f1e712d9feac577de8e95200af2d9ad6f868390abe5910d`;
- collectors 016 commit `4eea9a8` and the 017 commit `6cbbd01` code digests the accepted
  gate already re-checks (activation `d826cfa3...`, provider client `20ffe34f...`, CLI
  `01975c2c...`, inert scheduler registry `6b0eaf07...`);
- the frozen 130-anchor / 780-item plan and its declared per-role intervals.

## 1. Deliverable

Turn the accepted inert 017 package into an operating capture lane without changing any
accepted artifact and without reading any outcome:

1. a lock-guarded tick driver that attempts every plan identity whose declared
   acquisition interval currently contains the operating-system clock;
2. exactly one installed Windows scheduled task that runs that driver through the
   encrypted credential runner with only `FRED_API_KEY` and `OANDA_API_TOKEN`;
3. the missed-lane rule: an identity whose interval closed with no sealed capture and no
   blocked attempt is sealed exactly once as `interval_closed_no_backfill`; a missed lane
   is never filled, retried into the same identity, shifted, backfilled or reconstructed;
4. the anchor-1 items remain blocked and sealed exactly as 017 left them; never
   re-attempt or recreate them;
5. an updated runbook with the exact install, verify, pause, resume, recovery and
   uninstall commands, the task name, the cadence and the expected health metadata.

## 2. Hard rules

- Every capture must still pass the accepted 017 gate and the accepted 016 sealer. No
  path may bypass or relax them, and no new code may write an envelope itself.
- Credentials are exactly `FRED_API_KEY` and `OANDA_API_TOKEN`, loaded only through
  `run-with-credentials.ps1`. Never print, log, persist, commit or echo a value;
  credential overbreadth stays refused.
- Operator-visible output (stdout, logs, monitor state, indexes, summaries, health) stays
  metadata only: identities, hashes, timestamps, row counts, statuses and reason codes.
- Do not read, infer or compute any outcome, return, direction, sign, qualification,
  accuracy, edge or aggregate, at any horizon, now or later.
- Do not reschedule, backfill, catch up, substitute a source or instrument, widen or
  shift an interval, or request an observation at or after a closed lane.
- Do not modify accepted 014/015/016/017 artifacts, registries, tests or evidence; keep
  them byte-identical. Additive code, tests and documentation only.
- One writer in this worktree. Do not touch the backtester-spike or any other worktree,
  the canonical checkout, Layer 1, live workflows, the warehouse, the dashboard or
  production. No purchase, no new provider, no non-Gold asset, no research-rule change.
- Exactly one scheduled task may exist. A hidden second driver, a service, a daemon or a
  login-startup entry is a failure, not a shortcut.
- Idempotence: a sealed capture or blocked attempt ends that identity. A further attempt
  is refused unless it is a distinct reviewed recovery that references the failed
  immutable attempt.

## 3. Urgent sequencing against the real clock

- Anchor 2 is `2026-09-25T14:00:00Z`. Its three FRED pre-anchor feature identities are
  open now and close at the anchor: attempt them for real as soon as the driver is
  verified, each into a new output directory.
- Its entry identity opens at `2026-09-25T14:00:00Z` and closes at `16:00:00Z`; the
  exact-endpoint lane opens at `2026-09-25T15:00:00Z` and closes at `16:00:00Z`; the
  delayed lane runs `16:00:00Z` to `2026-09-26T16:00:00Z`.
- The tick interval must be ten minutes or less: the exact lane is only one hour wide.
- The scheduler must be installed, enabled and verified before the first lane that needs
  it closes. If the install cannot be completed in time, seal the missed identities
  instead of improvising.

## 4. Evidence and validation

- Real sealed evidence goes under a new ignored worker directory, for example
  `backtester/tmp/gold-qualification-window-018/`. Never overwrite 017 evidence.
- Focused tests for the driver and the install path, including adversarial cases: clock
  or anchor override, backfill, re-attempt of a sealed identity, duplicate identity, lock
  contention, unopened and closed intervals, source or instrument substitution, a
  scheduler activation attempt from the CLI, and a metadata-leak probe.
- Prove one real capture end to end before scheduling the rest: show the sealed envelope
  hash, the plan hash and the row count, and expose no value.
- Verify the installed task: exactly one exists, its action is the accepted runner
  command, its trigger matches the declared cadence, and it is the only capture path.
- Then run the documented local suite (`npm test`) in this worktree.

## 5. Reporting (mandatory)

Finish by reporting: write one envelope from `templates/submission.json` into your own
ignored `tmp/` with the observed worktree, branch, base and HEAD, the changed files, the
exact tests and results, the sealed evidence paths with hashes, the scheduled task name
and state, blockers, questions and production disclosure; submit it with
`node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <that file>`;
record `monitor-state.js activity gold-research paused "<what finished>"`; then stop. Start
no further work until a recorded reply arrives. Report a blocker when it is found, not at
the end.

## 6. Still closed

Outcome or aggregate reading, qualification, evaluation, formula fitting, holdout
consumption, accuracy or edge claims, warehouse writes, Layer 1 inputs, live workflow
changes, dashboard publication, integration, deployment, purchase, and any second writer
on this worktree.

## 7. Progress checkpoint (coordinator, 2026-09-24)

Your last report sealed the three anchor-2 FRED feature identities and then ended the
turn with the tick driver and the scheduled task still to build. This assignment is not
complete. Continue now, in this same assignment, and do not pause again until it is
submitted or you report a concrete blocker:

1. build the lock-guarded tick driver and its focused tests, including the adversarial
   cases in section 4;
2. install exactly one scheduled task through the accepted runner and verify it (task
   name, action, trigger and single capture path);
3. prove one real capture end to end and record the envelope hash, the plan hash and the
   row count, exposing no value;
4. run the documented local suite in this worktree;
5. submit one envelope and pause.

The binding constraint is the clock: anchor 2's entry identity opens at
`2026-09-25T14:00:00Z` and its exact-endpoint lane runs only from `2026-09-25T15:00:00Z`
to `16:00:00Z`. A task installed after those lanes close cannot capture them, and they
cannot be backfilled or reconstructed. Report activity at each step as you go.

