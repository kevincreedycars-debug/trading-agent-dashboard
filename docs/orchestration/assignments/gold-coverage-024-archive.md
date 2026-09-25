# Finish the 28 measured factors: assemble the accepted engine exactly, then execute the declared stage

Assignment: `gold-coverage-024`. Published 2026-09-25. Continuation of the blocked `gold-coverage-023`.
Worker: `gold-research`. Worktree: `D:/trading-agent-dashboard-codex/.local/worktrees/gold-research`.
Branch: `workers/gold-research-policy-20260920`. Starting commit: `6fd501a7` (023 declaration plus its
additive harness changes, verified in review `20260925-gold-coverage-023-r1`).
Predecessor: `gold-coverage-023`, submission `20260925-gold-coverage-023-r1` (mailbox
`fae926bb...`), reviewed as `blocked`-with-blocker-upheld. The 023 assignment text is archived at
`docs/orchestration/assignments/gold-coverage-023-archive.md`; the 023 declaration and its two spent run
directories stay exactly as they are.

User authority: the standing direction to finish the 28-factor work rather than idle until the next anchor.
This assignment does not widen it: it completes the stage 023 declared. Nothing here is a qualification, a
holdout, a prospective read, an accuracy claim or a trading edge.

## 0. First rule: the live lane and the standing anchor obligation

`GoldQualificationWindowTick018` (the v2 wrapper, `PT10M`) is the only capture path and must keep ticking
untouched. Do not stop, pause, reconfigure, duplicate, test-replace or hand-trigger it, and do not read,
seal or re-attempt any capture identity. The 022 item A obligation continues: at or after the
`2026-09-28T16:00:00Z` lane close for the `2026-09-28T14:00:00Z|gold|entry` identity, deliver the one
observation envelope the 022 assignment describes. If this stage's run is still going at that point,
deliver that envelope first and continue afterwards, and never let the batch interfere with a capture tick.

## 1. The one bounded fix: assemble the accepted parts exactly as the accepted builder does

Your blocker is upheld and the coordinator has verified its mechanism, so this is a bounded repair, not a
diagnosis exercise. Both divergences below are in how the adapter assembles the accepted measurement
engine, not in the declared cell, the rules, the sources or the cap.

1. `buildAcceptedParts` in `backtester/lib/gold_combination_rows.js` never sets `parts.seriesRules`. The
   accepted builder sets it (`gold_individual_variable_report.js:813`) and `buildContext` copies
   `parts.seriesRules` into every context (`:634`), which is what `seriesLevelAt`, `seriesChangeAt` and
   `policyStepDirectionAt` read to apply each series' declared availability rule. With it `undefined` those
   functions fall back to `MAX_AGE_DAYS[seriesId] ?? DEFAULT_MAX_AGE_DAYS` (7 days) and
   `DEFAULT_AVAILABILITY_LAG_HOURS` (36 hours). The declared rules differ for the coverage-019 provider
   series - `SF_FED_DNSI` 168 h / 14 d, `PHILLY_FED_ADS` 36 h / 14 d - so every DNSI state came back
   `observation_stale_beyond_declared_age`. Coordinator evidence, read-only, from the adapter's own
   `buildBatchRows`: `parts.seriesRules` is `undefined`, `contexts[0].seriesRules` is `undefined`,
   `risk_headline_context` has 0 available states of 965 with that single reason, `levelMedian` is `null`,
   and the rebuilt rows are 965 with 964 computed outcomes - which is exactly why the guard refused with
   `atom_n:risk_headline_context:above_own_median is 0, not 471`. The guard behaved correctly; the adapter
   was assembling a different engine than the accepted one.
2. The adapter calls `loadMacroHistories(fredDirectory, rules, extraSeriesIds)` with three arguments. The
   accepted builder passes a fourth, `prospectiveBoundary(registry)` (`:805`), and that argument is what
   makes `vintageSeries` refuse a source row dated at or after the declared prospective boundary. Pass the
   same four arguments with the same values.

Do this by calling the accepted loader and builder path, so the declared availability, vintage, staleness
and boundary rules have exactly one implementation. Do not add a second, parallel provider-file loader and
do not re-derive a rule locally; a private reimplementation is what produced this failure. Keep the change
additive and inside this assignment's allowance: the v1 defaults stay bit-for-bit, the v2 declaration stays
byte-identical, and the repair is covered by focused tests and disclosed.

## 2. Declared starting point, unchanged

The declaration delivered under 023 is accepted as delivered and is the stage this assignment executes:
`backtester/registries/gold_combination_batch_daily_h24_and.v2.json`, raw and LF
`c19315e6...`, 4956 candidates, candidate list `db96c728...`, cell
`daily_snapshot_anchors` / `h24_post_event` / `all_computed` / operator `and` / context
`prior_5session_return_sign`, 51 eligible atoms over 22 contributing variables, 36 excluded same-variable
pairs, 1239 cross-variable pairs, 4 context options, declared universe 4956 inside the declared cap 20000,
complete enumeration with no ranking and no truncation. Do not re-declare it, re-rank it, refit it or change
its counts. It stays byte-identical at `c19315e6...`.

The undeclared `event_releases` cell (197 eligible atoms, 10081 pairs, 40324 at the same cap) stays
undeclared: it returned `balanced_selection` and must keep returning that, and its counts are reported as
context only. Never truncate, rank or let a selection rule choose candidates.

## 3. Focused tests, then execute into a new run id

Focused tests must cover, at minimum: the adapter's rebuilt per-variable state and atom counts reconcile
with the accepted report's declared counts for all 28 measured variables, including the three
coverage-019 provider series; a series whose declared rule differs from the module default is measured
under its declared rule (so the default-fallback defect fails the test if it returns); the four-argument
`loadMacroHistories` call is the one used, boundary included; the preserved artifacts are byte-identical;
the declared counts and candidate-list hash still reproduce. Then run the accepted harness unchanged into a
new run id, because `combination-run-023-20260926-rev1` and `-rev2` are spent and each refuses re-entry:

```powershell
node backtester/scripts/run_gold_combination_batch.js prepare --run-id gold-combination-run-024-20260926-rev1 --output-dir backtester/tmp/combination-run-024-20260926-rev1 --registry backtester/registries/gold_combination_batch_daily_h24_and.v2.json
node backtester/scripts/run_gold_combination_batch.js verify --manifest <that run's manifest>
node backtester/scripts/run_gold_combination_batch.js execute --manifest <that run's manifest>
node backtester/scripts/analyze_gold_combination_ledger.js --run-dir backtester/tmp/combination-run-024-20260926-rev1
```

These rules must hold exactly as accepted: the session, horizon, endpoint, availability and exclusion
rules; `min_n` equal to the frozen `accepted_timing_rules.min_n` (20); one anchor identity per row with no
repeated anchor ever deduplicated or double counted; the endpoint denominators reconciling
(`exact_offset_elapsed + delayed_offset_endpoint + session_close_endpoint = all_computed`) for every cohort
and horizon; no new binning, threshold, band, tercile or per-year rule; a ledger row without an anchor
identity refused. Every anchor used must lie inside the accepted consumed intervals and strictly before the
frozen `2026-09-24T14:00:00Z` boundary: prove it and report the refusal when a candidate or anchor would
fall at or after it. Record the exact inputs with hashes, row counts, every exclusion reason with counts,
and the run duration. If the run still cannot complete, report the partial state and the exact failure
rather than leaving the tree uncommitted or forcing a ledger.

## 4. Report the stage honestly

Committed summary: `docs/GOLD_COMBINATION_ANALYSIS_023.md` (the document name 023 declared for this stage).
It states the declared cell and universe, the counts actually evaluated, the denominators reconciliation,
the dependence statement (the attempts are dependent and every interval in scope is already consumed),
every exclusion and every known limitation, and the accepted fact that several of the 28 measured variables
are declared research definitions rather than live fields (`fed_bias`, `inflation_signal`,
`risk_headline_context`, `equities_regime`, `growth_regime`), so no result may be described as validating,
replacing or contradicting a live Layer 1 field. No accuracy, win-rate, profitability, timing or edge
claim, no candidate described as a winner, recommendation, signal or formula, and no ranking published.
Preserve the existing individual-variable digest `docs/GOLD_VARIABLE_FINDINGS_AND_COVERAGE.md` and its 28
blocks byte-identical; the new analysis is a separate document. Then run the documented local suite with
exact counts and every failure disclosed, with the known CRLF and console-width cases disclosed as
environment rather than as new work.

## 5. Boundaries

No acquisition, network call or credential: every input is already archived locally, the four keyless
sources stay keyless, and this stage needs no provider at all. No new or redefined source or variable. No
research-rule, threshold, binning, horizon or formula change. No prospective observation, no holdout
reservation or use, and no interval described as fresh. Do not modify
`gold_combination_batch_daily_h24_and.v1.json` (`7e2bcff6...`), the accepted run-011 ledger
(`5cd45278...`), the frozen 014 manifest (`15cd0606...`), the 013 shortlist and audit, the report registry
revision 8 (`2be6701c...`), the revised inventory (`863c4e02...`), audit v2, the coverage declaration, the
015/016/017 activation artifacts, the v2 lane files or any sealed window evidence: all stay byte-identical.
The 023 declaration and both of its spent run directories stay byte-identical too.

Two known environment conditions are recorded and are not yours to fix here: the CRLF materialisation of
the hash-bound revision-7 report registry (raw `48161ff9...` on disk against the pinned LF `714a5410...`),
which is the pre-existing five-failure case the `backtester-spike` change request owns, and the same
asymmetry between the LF digest a manifest records and the raw digest `verifyManifest` compares for
`accepted_inputs`. Disclose them if they appear; do not add a repository-level `.gitattributes` entry, do
not renormalise an accepted file and do not rebuild a frozen artifact. No production, live workflow,
warehouse, Layer 1, dashboard or deployment action. One writer in this worktree. Stop at the review
boundary.

## 6. Reporting (mandatory)

Report activity first, then after the repair, after the run, after the analysis and after the 022 item A
envelope. On completion, on a blocker or at a decision point, write one envelope from
`templates/submission.json` into your own ignored `tmp/` with status `ready_for_review`, `blocked` or
`status_report`, the observed worktree/branch/base/HEAD, changed files, the new run id and manifest hash,
exact test commands and results, artifact hashes and row counts, blockers, questions and production
disclosure; submit it with
`node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <that file>`; record
`node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity gold-research paused "<what finished>"`;
then stop and wait for a recorded reply.

Answers carried from the 023 review, so they do not need re-asking: the repair belongs inside this
assignment's allowance rather than a separate rule change; yes, call the same loader the accepted 019
report builder uses, with the boundary argument, and add the reconciliation test over all 28 measured
variables; and if the continuation and the 022 anchor obligation fall on the same wake, deliver the 022
item A envelope first and then continue.
