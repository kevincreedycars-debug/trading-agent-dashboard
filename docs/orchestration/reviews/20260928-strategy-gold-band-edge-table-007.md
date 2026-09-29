# Strategy submission 20260928-strategy-gold-band-edge-table-007: accepted (advisory only)

Reviewed by the background Central Orchestrator on 2026-09-29 in the controller-locked run that holds
`run.lock`. Submission `20260928-strategy-gold-band-edge-table-007`, worker `strategy`, assignment
`strategy-advisory-001`, envelope status `ready_for_review`, mailbox SHA-256
`835fb83eda81b8282d44a7e9ffb1f8c18e7094ce98dfce4773d67003d2b59fda`, reproduced twice - from the run
brief and by `coordination.js check` over the immutable inbox file. Reply published at
`.local/orchestration/replies/strategy/20260928-strategy-gold-band-edge-table-007.json`
(sha256 `dc79147a87b148f44b8d57397a54e97bf20eaf5fdb292fb908689145c8cbba60`), decision
`accepted`. `check --worker strategy` then reported 7 `pending_review` with `errors: []` and
`stale_assignment: false` for this report. This is a review of evidence only: acceptance is of the
advisory, and it authorises no research, no live-system action and no integration.

## What the submission reported

- A specification-only advisory, no code and no state change: `docs/strategy/GOLD_BAND_FIX_AND_EDGE_TABLE_SPEC_20260928.md`
  (454 lines, 11 sections) plus a 156-line session record in `docs/strategy/CONVERSATION_NOTES.md`
  (1245 lines at that head).
- A declared contract gap with evidence on both sides: `logic/agent_gold_direction.md` v2.0 declares
  absolute bands (VIX >25 / <16) and magnitude thresholds (5 bps, 0.30%), while the accepted
  measurement vocabulary measures level variables as a median split of their own distribution and
  change variables as a bare sign.
- The cost of that gap, counted from the accepted scorecard, and the observation that the single row
  above 60% is the F9 `interpreted` row, not the strongest evidence in the table.
- Three corrections to the worker's own earlier notes, each measured, including the fact that the
  accepted 019 report cannot be re-cut into the document's bands and needs a new measurement run.
- A proposed two-lane assignment pair, a v3 registry design, boundary semantics, a new edge-table
  artifact and page design, and fifteen open decisions D1-D15 with conservative defaults.

## Independent checks (read-only)

- Hash and lifecycle: `check` reproduces `835fb83e...` from the immutable inbox file with `errors: []`
  and `stale_assignment: false`; the reply is bound to that hash and the state moved to `accepted`.
- Provenance is exact: `.local/worktrees/strategy` is clean on `workers/strategy-advisory-20260920`,
  the reported base `4fc61096` is the **direct parent** of the single head commit `9d4403ec`
  (`git rev-list --count 4fc61096..9d4403ec` is 1), and the commit is exactly +610 lines across two
  files, both inside the worker's owned `docs/strategy/` scope: `CONVERSATION_NOTES.md` +156 and
  `GOLD_BAND_FIX_AND_EDGE_TABLE_SPEC_20260928.md` +454. At that head the files are 1245 and 454 lines,
  as reported. (The working tree has since advanced to later submissions, which is why the live file
  hashes differ from the submitted ones; the submitted hashes were verified against the commit.)
- Dependency impact nil: neither path is named by any test, registry, gate, manifest or workflow file,
  and no test enumerates `docs/`.
- Scorecard figures re-derived from `data/gold-direction-scorecard-20260927.json` and all exact:
  parameters `min_n` 100, `min_year_n` 20, `edge_pp` 5, `threshold_pct` 60; baselines session 55.81%
  n 964 and week 58.23% n 960; coverage 28/28 variables, 965 anchors of which 964 carry an outcome,
  5115 event rows, 25 scored, 20 unscored, 6 neutral, 7 factors scored; unscored by reason
  `level_band_not_declared` 8 / `change_rule_absent` 6 / `threshold_is_absolute_band` 2 /
  `regime_label_not_reproduced` 4; the two `threshold_is_absolute_band` rows are exactly
  `vix_level:above_own_median` (session n 481) and `vix_level:at_or_below_own_median` (session n 483);
  the six neutral states are the four `exact_zero` change states plus `inflation_signal:exact_zero`
  and `risk_headline_context:at_or_below_own_median`; summary 25/25 session `no_information`, 24 week
  `no_information` plus one `unstable_across_years`, and exactly one row at or above 60% per horizon.
- The one clearing row is exactly as described: F9 `risk_headline_context:above_own_median`, provenance
  `interpreted` with caveat `interpreted_regime_mapping`, session 60.51% n 471 (+4.70pp), week 63.69%
  n 471 (+5.46pp), `years_same_edge_sign` false on both horizons, per-year session edges -1.54 / -0.18
  / +6.52 / +15.84 pp.
- The bar quoted in section 7 is verbatim at `backtester/scripts/report_gold_factor_direction_check.js`
  line 204 (`hit_rate_pct !== null && n >= parameters.min_n && hit_rate_pct >= parameters.threshold_pct`)
  and line 387 carries the same form with `resolved >= parameters.min_n`.
- The registry and code claims are character-for-character correct:
  `gold_individual_variable_report.v2.json` declares `vix_level` as
  `{"kind":"fred_level","series_id":"VIXCLS","strata":"median_split"}`, the
  `variable_state_strata.median_split_revision_8` text is verbatim as quoted, and
  `.local/worktrees/gold-research/backtester/lib/gold_individual_variable_report.js` lines 1042, 1060,
  1064 and 1104 match the quoted text including the forced
  `stratification: levelVariable ? 'median_split_of_own_distribution' : variable.measurement.strata`,
  so the declared `strata` field is genuinely ignored for level variables.
- The report claim holds: `.local/worktrees/gold-research/backtester/tmp/ivr-coverage-019-20260925-r2/individual-variable-report.json`
  is exactly 95,842,994 bytes, version `gold-individual-variable-report-v1`, generated
  `2026-09-25T14:44:33.370Z`, with **zero** occurrences of the quoted `"values"` token. The re-cut is
  therefore impossible from the accepted report, as claimed.
- All three self-corrections are confirmed: the 019 series directory is in the gold-research worktree
  (10 files, 2,778,424 bytes) and not in canonical; `backtester/tmp/gold-hourly-extended-20260918`
  (17 files, 12,099,758 bytes) and `backtester/tmp/gold-calendar-extended-20260918` (2 files,
  3,456,639 bytes) are canonical and present; and the report library, its builder and the v2 registry
  exist only in the gold-research worktree (`Test-Path` false for all three canonical paths).
- The VIX sizing check reproduces exactly from `VIXCLS.json`: 954 Monday-Friday observations in range,
  41 above 25, 400 below 16, 513 between 16 and 25 (41/954 = 4.3%, 400/954 = 41.9%, 513/954 = 53.8%).
- The citation of `backtester/registries/gold_factor_direction_expectations.v1.json` lines 51-77 is
  accurate: the F1-F10 weights (22/18/14/8/8/10/6/6/6/2) and the verbatim rule text are at those lines.
- The line references for the page pattern are right where checked: `gold-backtest-outcomes.html`
  line 164 carries `id="outcomes-data"`, and the Related-pages nav blocks sit at lines 47-51 and
  line 60 as cited.

## Two minor citation slips, recorded as notes

Neither changes a number or a conclusion, so neither is a required change:

- Section 3.7 labels the VIX window "2023-01-03 to 2026-09-21", but the file's last in-range
  observation is **2026-09-11** (first is 2023-01-03, and the count 954 and all three band counts are
  exact). Section 3.6 already states the correct end date, so this is an internal label inconsistency.
- Section 8 refers to the scorecard's embedded JSON as line 214; it is line **211** in both the built
  page and `backtester/templates/gold-direction-scorecard.html`.

## Decision: accepted, with no lane opened

The advisory is accurate, honest, in scope and measurably useful: it pins a declared contract gap to
code lines and counts rather than to inference, corrects the worker's own earlier provenance in the
same pass, and states the limits of its own recommendation. Acceptance is of that analysis and of the
record; it deliberately does **not** open `gold-declared-band-measurement-026` or
`dashboard-gold-factor-edge-page-001`, for three reasons established in this review:

1. **The delivered document has already been superseded in place by the worker's own later, still-queued
   submissions.** `-008` (head `1576e89`) and `-009` (head `73e64852`) both rewrite
   `docs/strategy/GOLD_BAND_FIX_AND_EDGE_TABLE_SPEC_20260928.md` and add
   `GOLD_VIX_BOTH_AND_FACTOR_TABLE_PLAN_20260928.md`, and `-010` (head `45b7864a`) revises the plan
   again. Publishing an implementation assignment from the `-007` text would issue a plan its own
   revision already replaced while that revision sits unreviewed behind the one-review-per-cycle rule.
2. **The material forks are open in the submission's own section 9.** D6 (replace the `interpreted` F9
   mapping with a declared safe-haven rule built the way the live field is built), D8 (standalone page
   versus a research sub-tab inside `index.html`/`script.js`), D4 (leave the six VIX change states
   unscored) and D15 (two sequenced writers versus one) each change the deliverable, and the spec
   itself files for review rather than applied.
3. **The page lane has no owner.** `docs/orchestration/projects.json` has a `dashboard` coordinator
   workstream (status `latest_change_deployed`, policy "Only user-requested UI changes") but no
   dashboard worker, worktree or assignment convention, so `dashboard-gold-factor-edge-page-001` cannot
   be published to anyone today.

## No new assignment published

No new worker assignment is published this cycle, and no register status changed. The register keeps
`gold-research` at status exactly `instructions_published_awaiting_worker` for the carried 022 item A
observation envelope, and publishing a second assignment to that lane would break the single-active-
milestone rule. The queue now holds 7 `pending_review` submissions, all `strategy` (2026-09-28 to
2026-09-29), taken one review per cycle; `-007` is the earliest of them and the remaining six are
unreviewed.

## Unresolved decisions (the user's, unchanged)

1. Whether to open any further exploratory stage over the already-spent intervals at all - the declared-
   band fix is one candidate and it needs the D1-D15 forks answered, or the conservative defaults
   explicitly adopted, including D6's replacement of the best-looking row.
2. If opened, which writer model: two sequenced lanes, or one writer in the gold-research worktree doing
   measurement first and the page second (D15).
3. Whether the page lane may run at all while it has no registered worker, given the dashboard
   workstream's standing "user-requested UI changes only" policy.

Recorded separately and unchanged: whether to promote the accepted Gold verdict page from the worker
checkout into canonical `docs/`, and whether to publish the remaining local-only Gold evidence artefacts.

## Boundary, integration and deployment status

Not integrated, not merged and not deployed. The submission touched two advisory notes files inside the
worker's own scope; the canonical commit for this cycle carries coordination files only. No production,
dashboard, credential, warehouse, Layer 1, workflow, purchase, deployment or holdout action occurred, no
credential value was read, and the sealed prospective window is untouched and stays sealed until
`2027-03-25T15:00:00Z`. `GoldQualificationWindowTick018` was observed read-only and was not disturbed.
This review is a separate session from the authorship of the submission and no self-review occurred.

## Mechanism note

`node scripts/monitor-state.js activity central-orchestrator ...` was accepted by the harness in this
run and used directly for the working and paused records, so no manual activity-file substitution was
needed this cycle. The monitor, bridge and controller code and settings were not changed, no controller
pause/stop was issued (this run holds the controller lock), and no subagent was spawned.