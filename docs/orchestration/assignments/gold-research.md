# Verify the repaired live entry lane at its first reachable anchor, and close two deferred coverage-test gaps

Assignment: `gold-coverage-022`. Published 2026-09-25. Worker: `gold-research`. Worktree:
`D:/trading-agent-dashboard-codex/.local/worktrees/gold-research`. Branch:
`workers/gold-research-policy-20260920`. Starting commit: `a9bb3654` (021 accepted).
Predecessor: `gold-coverage-021`, accepted in
`docs/orchestration/reviews/20260925-gold-coverage-021-r1.md`. Its item A and item B stand; do not
repeat them. The v2 wrapper is now the installed task action and the v1 wrapper is the documented
rollback, preserved byte-identical; neither is to be changed here.

User standing direction: keep the Layer 1 agents independent and backtesting downstream-only, keep
exploratory results distinct from accuracy qualification, and continue bounded verification of the
accepted live window. This assignment only observes the accepted lane and tightens two test
expectations the coordinator already recorded. It opens no exploration, adds no source and changes no
threshold. Opening a fresh exploratory combination stage over the 28 measured variables remains an
open user decision and is NOT authorised.

## 0. The live lane keeps running

`GoldQualificationWindowTick018` is the only capture path and must keep ticking every ten minutes
through the v2 wrapper. Keep its name, trigger, cadence, `MultipleInstances` `IgnoreNew`,
`StartWhenAvailable` true, the cleared battery restrictions, the principal and the single-task rule
exactly as accepted. No hand capture, hand sealing, backfill, reschedule, re-attempt or reconstruction
of any identity, and no provider request for any observation at or after a closed lane. Report the
observed task state in your preflight line.

## 1. Item B first (immediately actionable): close the two deferred coverage-test gaps

The 020 review recorded two honest weaknesses "for the next touch", and they remain open:

1. the `unavailable_no_local_source ?? 0` fallback would also pass if the key were absent - make the
   expectation assert the key explicitly, so an absent key fails rather than defaulting;
2. the `series_not_found_in_supplied_source` expectation is fixture-correct but should sit beside an
   explicit key assertion.

Tighten both in the coverage test line, disclose the exact before/after expectation, and keep every
accepted report and registry byte-identical. These are test-only changes: do not change a measurement,
a source, a rule, a threshold or an accepted artifact.

## 2. Item A: verify the repaired entry lane at its first reachable anchor (observe, never trigger)

The first reachable anchor is `2026-09-28T14:00:00.000Z`; its entry-role lane runs `15:00-16:00Z` and
its endpoint roles follow the accepted intervals. Observe the scheduled ticks in
`backtester/tmp/gold-qualification-window-018/tick.log` and the sealed evidence; do not trigger,
schedule, force or hand-seal anything.

Report, from the observed evidence only:

1. before `15:00Z` the entry identity `2026-09-28T14:00:00.000Z|gold|entry` is reported
   `not_yet_eligible` with no provider call and no directory created, and the identity stays in the
   frozen plan, so nothing consumed it;
2. inside `[15:00Z, 16:00Z)` the v2 path attempts it and the observed outcome is either one sealed
   capture, with an H1 entry candle at or after the anchor and a request end never later than the
   observed clock minus the declared one-hour OANDA availability lag, or, if the provider legitimately
   refuses, one sealed blocked attempt with `rescheduled` false and no same-identity retry; state which
   and the exact reason code;
3. after the lane closes, at most one sealed artifact exists for that identity and later ticks report
   it `already_settled`;
4. the three sealed anchor-2 captures, the one immutable blocked attempt, the frozen 014 manifest and
   the frozen 013 shortlist and audit are byte-identical before and after;
5. the total `tick.log` block count, the observed task settings and the `LastTaskResult` values.

If the anchor's entry identity is captured, that is the first live proof of the repaired lane; report
it as such, and note that it is the live path exercising the same logic the focused tests proved
against an injected provider. Do not open the outcome, return, direction, sign, aggregate,
qualification, accuracy or edge value of any captured envelope.

Timing: if the `2026-09-28T16:00:00Z` lane close has not yet been reached when you pick this up, do
item B, report the lane's state so far, and state explicitly that item A's live proof is pending the
anchor rather than implying it was observed. A coordinator reply will reopen item A at the anchor.

## 3. Hard rules

No outcome, return, direction, sign, aggregate, qualification, accuracy or edge value may be read or
computed, and evaluation stays sealed until `2027-03-25T15:00:00Z`. No research-rule, threshold, band,
tercile, horizon or formula change; no new source, credential or provider; no candidate space opened;
no selector execution; no exploratory combination stage. Do not retire the v1 wrapper, do not fix the
CRLF materialisation defect globally, do not add a repository-level `.gitattributes` entry and do not
renormalise accepted files: that remains the assigned `backtester-spike` change request. Preserve every
accepted 005/006/008 report and registry and every 014/015/016/017/018/019/020/021 artifact
byte-identical, including the frozen window manifest, the sealed window evidence and the immutable
blocked attempt.

## 4. Evidence and validation

Focused tests first, then the documented local suite with exact counts and every failure disclosed.
Disclose the known CRLF and console-width environment cases as environment, not as new work. Also
record the environment case the 021 review found: the v2 capture test inherits the ambient process
environment, so any extra credential variable makes the credential-scope guard fail closed (this is
correct behaviour - note whether you saw it and in which shell). Record the exact before/after digests
of every file you change and of every preserved artifact you re-verify. Raw evidence stays in your
ignored `backtester/tmp/`.

## 5. Boundaries

No production, live workflow, warehouse, Layer 1, dashboard, credential, purchase or deployment
action, and no scheduler action at all: the installed task keeps running on its own. One writer in
this worktree. Stop at the review boundary.

## 6. Reporting (mandatory)

Report activity first and after each step. On completion, on a blocker or at a decision point, write
one envelope from `templates/submission.json` into your own ignored `tmp/` with the observed
worktree/branch/base/HEAD, changed files, exact test commands and results, artifact hashes, the
observed live evidence, blockers, questions and production disclosure; submit it with
`node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <that file>`; record
`node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity gold-research paused "<what finished>"`;
then stop and wait for a recorded reply.
