# Restore the live entry lane and re-accept the shortlist input binding

Assignment: `gold-coverage-021`. Published 2026-09-25.
Worker: `gold-research`. Worktree: `D:/trading-agent-dashboard-codex/.local/worktrees/gold-research`.
Branch: `workers/gold-research-policy-20260920`. Starting commit: `35ad4bb5` (020 delivered, blocker upheld).
Predecessor: `gold-coverage-020`, reviewed with changes requested in
`docs/orchestration/reviews/20260925-gold-coverage-020-r1.md`. Its verified items 1-5 stand; this
assignment completes the acceptance, so do not repeat them.

User authority: on 2026-09-25 the user authorised (a) an urgent bounded repair of the live capture
lane's entry eligibility through a versioned v2 activation path, with every accepted v1 file preserved
byte-identical, the installed task action repointed only after verification, and the v1 wrapper restored
if verification fails, and (b) resolving the stale shortlist input binding by re-accepting it against
the revised inventory digest recorded in LF-normalised form with the historical CRLF value retained.

## 0. First rule: the live lane keeps running

`GoldQualificationWindowTick018` is the only capture path and must keep ticking every ten minutes. Keep
its name, trigger, cadence, `MultipleInstances` `IgnoreNew`, `StartWhenAvailable` true and the cleared
battery restrictions exactly as accepted, keep exactly one task, and keep every sealed envelope and
blocked attempt under `backtester/tmp/gold-qualification-window-018/` byte-identical. No hand capture,
hand sealing, backfill, reschedule or re-attempt of any identity, and no provider request for any
observation at or after a closed lane. Report the observed task state in your preflight line.

## 1. Item A (urgent, first): entry eligibility in a versioned v2 path

Proven defect, coordinator-reproduced: `backtester/lib/gold_qualification_activation.js`
`requestWindowForItem` builds the entry request as `[anchor_utc, anchor_utc + 1h]`, while
`captureInterval` opens that role's lane at the anchor. The first tick after every anchor therefore asks
OANDA for a range ending up to an hour in the future, the provider refuses any future-dated range with
HTTP 400 (`Invalid value specified for 'from'. Time is in the future`), and `sealBlockedAttempt`
consumes the identity permanently. `2026-09-25T14:00:00.000Z|gold|entry` was lost exactly this way at
`14:06:03.033Z` and its lane closed at `16:00:00Z`, so it cannot be recovered. Every remaining anchor is
exposed; the first is `2026-09-28T14:00:00.000Z`.

Required: add the missing eligibility guard through a new versioned v2 activation path. The accepted 017
semantics stay identical; only the following behaviour is added:

1. never call the provider with a request interval containing any time later than the observed clock
   minus the declared one-hour OANDA availability lag; for the entry role the identity is therefore
   attemptable only inside the still-open lane, from `anchor + 1h` until the lane closes at
   `anchor + 2h`;
2. a request that would be future-dated is refused before any provider call and must not seal, consume
   or otherwise terminate the identity: the tick reports it not yet eligible and the next tick
   re-evaluates it inside the lane;
3. the accepted lane boundaries, the `blocked_no_reschedule` missing rule, the validation rules (entry
   candle at or after the anchor; an endpoint candle exactly at the target), the credential scope, the
   declared source set and the single-task rule are unchanged;
4. every accepted v1 file stays byte-identical, and the v2 path re-verifies the accepted digests before
   it acts, so a drifted v1 file fails closed instead of being captured against;
5. no retry of a sealed identity, no reschedule, no backfill, no new source, no new credential, no
   second task, no second writer;
6. when a lane closes without a successful capture, the accepted `blocked_no_reschedule` reason code is
   sealed exactly as v1 does.

Acceptance criteria, all shown in your submission:

- focused tests: a future-dated request is refused before any provider call and leaves the identity
  unconsumed; the entry identity is captured inside `[anchor + 1h, anchor + 2h]` against an injected
  fake provider; a lane that closes without a capture still seals `blocked_no_reschedule`; a sealed
  identity is never retried; a drifted v1 file fails closed; the v1 files are byte-identical;
- a dry verification through the v2 wrapper that consumes no identity, reporting the observed set of
  open identities, which must be empty when you run it;
- the installed task action repointed to the v2 wrapper only after those pass, with the task otherwise
  identical, followed by one real tick that completes with task result `0`, appends metadata-only to
  `tick.log` and consumes no identity;
- if any step cannot be verified, restore the v1 wrapper as the task action and report the blocker with
  the exact failure instead of leaving the lane unprotected.

Deadline: working and verified before `2026-09-28T14:00:00Z`, the first anchor whose entry lane is still
open. Report activity at each step as you go.

## 2. Item B: re-accept the shortlist input binding, in normalised form

The accepted 013 binding `c9cc0def...` is the CRLF materialisation of the pre-revision inventory (its
git-blob LF digest is `c1a5c305...`); the revised inventory is `863c4e02...` raw and `b7687622...`
normalised. The coordinator has already established outcome-identity, and you must reproduce it as your own evidence: the accepted selection was re-run against the revised inventory into
`tmp/coordinator-verify-shortlist-020-20260925` (run record `selection-run.json`, invoked with
`--expected-inventory 863c4e02...`) and returned the identical four candidate ids in identical order,
pool 2548 declared / 255 eligible, counts 255 entries / 4 selected / 251 skipped, an `entries` array
byte-identical to the frozen audit, `reconciliation_ok` true, and the frozen artifact unchanged at
`ffa69b30...`. Only the embedded provenance expected-digest differs, which is why the re-run file hash
differs while every selection field is identical. Prove outcome-identity yourself before you re-bind anything:

1. run the accepted selection into a NEW output directory (the accepted script refuses to overwrite) and
   compare the four frozen candidate ids in frozen order, `declared_candidates` 2548,
   `eligible_candidates` 255, `selected_count` 4, the 255 audit entries, `reconciliation_ok` true, and
   the frozen artifacts `ffa69b30...`/`e7c57773...` unchanged;
2. only if every one of those is identical: set `ACCEPTED_DIGESTS.inventory` to `b7687622...`, make the
   inventory role compare the LF-normalised digest with the raw value retained beside it, record the
   historical `c9cc0def...`/`c1a5c305...` pair as disclosed history, leave every other role, the drift
   refusal and the selection logic exactly as accepted, add the amendment note to
   `docs/GOLD_PROSPECTIVE_SHORTLIST_20260923.md`, and drive
   `backtester/tests/gold_qualification_shortlist.test.js` to 7/7 and
   `gold_qualification_window.test.js` to 8/8;
3. if any value differs, stop and report the exact difference; do not accept, relabel, amend or re-run a
   changed selection and do not touch the frozen artifacts.

## 3. Hard rules

No outcome, return, direction, sign, aggregate, qualification, accuracy or edge value may be read or
computed, and evaluation stays sealed until `2027-03-25T15:00:00Z`. No research-rule, threshold, band,
tercile, horizon or formula change; no new source, credential or provider; no candidate space may be
opened; no selector execution beyond the outcome-identity proof in item B. Do not fix the CRLF
materialisation defect globally, do not add a repository-level `.gitattributes` entry and do not
renormalise accepted files: that remains the assigned `backtester-spike` change request. Preserve every
accepted 005/006/008 report and registry and every 014/015/016/017/018/019/020 artifact byte-identical,
including the sealed window evidence, the immutable blocked attempt and the two registries you revised
in 020.

## 4. Evidence and validation

Focused tests first, then the documented local suite with exact counts and every failure disclosed;
disclose the known CRLF and console-width environment cases as environment, not as new work. Raw
evidence stays in your ignored `backtester/tmp/`. Record the exact before/after digests of every file
you change and of every preserved artifact you re-verify.

## 5. Boundaries

No production, live workflow, warehouse, Layer 1, dashboard, credential, purchase or deployment action,
and no scheduler action beyond repointing the existing task action to the v2 wrapper exactly as
authorised above. No change to the prospective window manifest, its anchors, its lanes, its sealed
evidence or its evaluation boundary. One writer in this worktree. Stop at the review boundary.

## 6. Reporting (mandatory)

Report activity first, and report after each step: the v2 path and its focused tests, the dry
verification, the task action swap with the real verification tick, then item B. On completion, on a
blocker or at a decision point, write one envelope from `templates/submission.json` into your own
ignored `tmp/` with status `ready_for_review`, `blocked` or `status_report`, the observed
worktree/branch/base/HEAD, changed files, exact test commands and results, artifact hashes, the observed
task settings before and after the swap, blockers, questions and production disclosure; submit it with
`node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <that file>`; record
`node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity gold-research paused "<what finished>"`;
then stop and wait for a recorded reply. Also record, as an observation only and without working around
it, that a Friday anchor's 24-hour target falls on a closed-market Saturday, so its exact and delayed
endpoint identities are expected misses.


