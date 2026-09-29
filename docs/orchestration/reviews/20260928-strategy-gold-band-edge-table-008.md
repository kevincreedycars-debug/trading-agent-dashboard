# Strategy submission 20260928-strategy-gold-band-edge-table-008: accepted (advisory only)

Reviewed by the background Central Orchestrator on 2026-09-29 in the controller-locked run that holds
`run.lock`. Submission `20260928-strategy-gold-band-edge-table-008`, worker `strategy`, assignment
`strategy-advisory-001`, envelope status `ready_for_review`, mailbox SHA-256
`a4156f0a1ba05b37928658cf9637f7e103d7a24b7b87b9c24847a3b902aa8a11`, reproduced twice - from the run
brief and by `coordination.js check` over the immutable inbox file. Reply published at
`.local/orchestration/replies/strategy/20260928-strategy-gold-band-edge-table-008.json` (sha256
`08b208b5ab4f90dd3234d8f97ccb0fa70ba4d7d1ccf3da6ada175e081e82742d`), decision `accepted`.
`check --worker strategy` then reported 5 `pending_review` with `errors: []` and
`stale_assignment: false` for this report. This is a review of evidence only: acceptance is of the
advisory, and it authorises no research, no live-system action and no integration.

## What the submission reported

- A docs-only revision of `-007` answering the user's follow-up ("simplify this" and "keep both VIX
  streams"), with no code and no state change. A new readable plan
  `docs/strategy/GOLD_VIX_BOTH_AND_FACTOR_TABLE_PLAN_20260928.md` supersedes the long spec **for
  reading**; the spec is retitled in place as its mechanical appendix and its section 9 (D1-D15) is
  marked superseded. The decision list drops from fifteen to four (D1 both VIX streams incl. a declared
  1/2/5 and 2/5/10 sweep with `looks_counted`; D2 full page versus minimum version; D3 rebuild F9; D4
  keep `>= 60` and `n >= 100`).
- Two findings: the live document's F6 lists both VIX streams but writes a rule for the level only, and
  only one VIX series exists, so "both" means two uses of one series; and the change states' raw numbers
  already exist in the accepted scorecard's `unscored` blocks, so most of the question costs no new run.
- The honest negative: no VIX state clears 60% on the session, and the one cell touching the bar
  (`vix_d1` positive, week) is a post-hoc read of twelve looks on spent data with a below-drift session
  number.

## Independent checks (read-only)

- Hash and lifecycle: `check` reproduces `a4156f0a...` from the immutable inbox file with `errors: []`
  and `stale_assignment: false`; the reply is bound to that hash and the state moved to `accepted`.
- Provenance exact: `.local/worktrees/strategy` is clean on `workers/strategy-advisory-20260920`, the
  reported base `9d4403ec` is the **direct parent** of the single head commit `1576e898`
  (`git rev-list --count 9d4403ec..1576e898` is 1), and the commit is exactly **+250 / -0** lines across
  the three reported files, all inside the worker's owned `docs/strategy/` scope:
  `GOLD_VIX_BOTH_AND_FACTOR_TABLE_PLAN_20260928.md` new at 211 lines (+211),
  `GOLD_BAND_FIX_AND_EDGE_TABLE_SPEC_20260928.md` +7, `CONVERSATION_NOTES.md` +32. (The working tree has
  since advanced to the later queued submissions, so live file hashes differ; the submitted hashes were
  verified against the commit.)
- Artifact byte hashes reproduce exactly, including line-ending materialisation: the new plan's CRLF
  bytes hash to `A2B680BD4F0ED17EBD26F9BAF0768716605896B3E689E9E0151EF5E461B3451D` and it is 211 lines as
  reported; the retitled spec hashes to
  `F5747BC524BBD23B58162999B39E7AD35AF408D418B940804F702764FF7D24E2`; `CONVERSATION_NOTES.md` hashes to
  `C392CEA8B8458AFF6C06665C2095BC25EC27081D1D68716476BD5F540A665BF5`. The retitle header and the
  section 9 supersede note are present verbatim in the diff.
- Dependency impact nil: no test, registry, gate, manifest or workflow file names either path; only
  review, changelog and decisions markdown mention them.
- Document claim exact: `logic/agent_gold_direction.md` F6 declares `document_inputs` as
  `vix_level`, `vix_d1`, `vix_d5` with rules for the level only ("VIX >25 = BULLISH", "VIX <16 =
  BEARISH", "16-25 = NEUTRAL"), so the document asks for both streams and defined one.
- Scorecard figures re-derived from `data/gold-direction-scorecard-20260927.json` and all exact: the
  `unscored` blocks carry the plan's Stream B table cell-for-cell - `vix_d1` positive session n 437
  52.86% / week n 433 60.51%; `vix_d1` negative 58.32/56.60 (n 523/523); `vix_d1` exact_zero n 4
  50.00/25.00; `vix_d5` positive 59.21/59.82 (n 456/453); `vix_d5` negative 52.86/56.92 (n 507/506);
  `vix_d5` exact_zero n 1 0.00/0.00; `vix_level` above own median 56.96/58.84 (n 481) and at-or-below
  54.66/57.62 (n 483/479). Baselines session 55.81% n 964 and week 58.23% n 960, per-year session
  51.54 / 59.16 / 60.15 / 50.83. F6 factor block `testable` false, `rows_scored` 0, `blocked_states` 8,
  `blocked_reasons` `["change_rule_absent","threshold_is_absolute_band"]`. Exactly one cell is at or
  above 60% on either horizon: the `vix_d1` positive **week** row, 60.51% n 433.
- The coincidence is checked and is not a shared count: `vix_d1` positive week is 262 of 433 (0.6051 x
  433), while the F9 `risk_headline_context:above_own_median` row is 285 of 471, provenance
  `interpreted`, session 60.51% n 471 (+4.70pp), `years_same_edge_sign` false.
- 019 claims exact: the accepted report (`ivr-coverage-019-20260925-r2/individual-variable-report.json`)
  is exactly 95,842,994 bytes with **zero** occurrences of the field `"values"`; the 019 source set
  holds exactly one VIX series, `VIXCLS.json`, 97,074 bytes.
- `logic/agent_usd_direction.md` line 154 does carry the change rule the plan cites ("VIX rising sharply
  over 1d or 5d = BULLISH modifier", magnitude unnamed), and it is the USD document, not Gold's.
- The band-sizing scratch estimate reproduces exactly: 954 weekday observations from 2023-01-03, 41
  above 25, 400 below 16, 513 inside 16-25.

## One minor citation slip, recorded as a note

Not a required change, because it alters no number or conclusion: section 4 still labels the sizing
window "2023-01-03 to 2026-09-21", but the file's last in-range observation is **2026-09-11** (the 954
count and all three band counts are exact). This is the same label slip review
`20260928-strategy-gold-band-edge-table-007` already noted on section 3.7 of the spec, carried into the
new short plan. Fix it opportunistically in a later notes pass; do not open a new submission ID for it
alone.

## Decision: accepted, with no lane opened

The revision is accurate, honest, in scope and measurably useful: it answers the user's exact follow-up,
finds that most of the VIX-change question is already answered by an accepted artifact rather than
needing a new run, and states plainly that nothing clears the bar today. Acceptance is of that analysis
and of the record; it deliberately does **not** open `gold-declared-band-measurement-026` or
`dashboard-gold-factor-edge-page-001`, for four reasons:

1. **This envelope's own artifact has already been superseded by the worker's later submissions.** The
   plan file at the worker's HEAD is now 287 lines (sha256 `A5DF999D...`), not the 211-line file filed
   here; `-009` (head `73e64852`) and `-010` (head `45b7864a`) both rewrite it, and `-011` records the
   user's batch-1 intent answers, one of which (the 0.80% / 1.00-L2L movement floor) changes D1's
   default. Publishing an implementation assignment from the `-008` text would issue a plan its own
   later revision already replaced while those revisions sit unreviewed behind the one-review-per-cycle
   rule.
2. **The material forks are open and, by the plan's own statement, the user's.** D1-D4 change the
   deliverable, and the plan itself files for review rather than applying them, offering conservative
   defaults only "if no answer arrives".
3. **The measurement lane's target is already occupied.** `gold-research` deliberately stays at register
   status exactly `instructions_published_awaiting_worker` for the carried 022 item A observation
   envelope at the lane close; publishing a second assignment to that lane would break the
   one-active-milestone rule.
4. **The page lane has no owner.** `docs/orchestration/projects.json` carries a `dashboard` coordinator
   workstream (status `latest_change_deployed`, policy "Only user-requested UI changes") but no dashboard
   worker, worktree or assignment convention, so `dashboard-gold-factor-edge-page-001` cannot be
   published to anyone today.

## No new assignment published

No new worker assignment is published this cycle, and no register status changed. The mailbox now holds
5 `pending_review` `strategy` submissions (2026-09-28 to 2026-09-29: `-009`, `-010`, `-011`, `-012`,
`-013`), taken one review per cycle, plus the carried Gold obligation above.

## Unresolved decisions (the user's, unchanged)

1. Whether to open any further exploratory stage over the already-spent 2023-2026 intervals at all - the
   declared-band fix is one candidate, and it needs D1-D4 answered or the conservative defaults
   explicitly adopted.
2. If opened, which writer model: two sequenced lanes, or one writer in the `gold-research` worktree
   doing measurement first and the page second.
3. Whether the page lane may run at all while it has no registered worker, given the dashboard
   workstream's standing "user-requested UI changes only" policy.

Recorded separately and unchanged: whether to promote the accepted Gold verdict page from the worker
checkout into canonical `docs/`, and whether to publish the remaining local-only Gold evidence artefacts.

## Boundary, integration and deployment status

Not integrated, not merged and not deployed. The submission touched three advisory notes files inside
the worker's own `docs/strategy/` scope; the canonical commit for this cycle carries coordination files
only. No production, dashboard, credential, warehouse, Layer 1, live-workflow, purchase, deployment or
holdout action occurred, no credential value was read, and the sealed prospective window is untouched
and stays sealed until `2027-03-25T15:00:00Z`. `GoldQualificationWindowTick018` was not disturbed. This
review is a separate session from the authorship of the submission and no self-review occurred.

## Mechanism note

`node scripts/monitor-state.js activity central-orchestrator ...` was accepted by the harness in this
run and used directly for the working and paused records. The reply was published through the canonical
CLI (`coordination.js reply --file` with the path passed by variable). The monitor, bridge and
controller code and settings were not changed, no controller pause/stop was issued (this run holds the
controller lock), and no subagent was spawned.