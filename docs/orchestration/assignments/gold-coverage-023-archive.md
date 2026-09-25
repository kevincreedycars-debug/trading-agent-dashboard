# Finish the 28 measured factors: execute the declared exploratory combination stage

Assignment: `gold-coverage-023`. Published 2026-09-25.
Worker: `gold-research`. Worktree: `D:/trading-agent-dashboard-codex/.local/worktrees/gold-research`.
Branch: `workers/gold-research-policy-20260920`. Starting commit: `134e8148` (022 accepted).
Predecessor: `gold-coverage-022`, item B accepted with item A still open at its anchor; review at
`docs/orchestration/reviews/20260925-gold-coverage-022-r1.md`.

User authority: on 2026-09-25 the user directed that Gold finish the 28-factor work rather than idle
until the next anchor. That is the explicit decision the 019 and 022 reviews had left open: open one
fresh exploratory combination stage over the 28 measured variables on the already-consumed historical
period, under the accepted next-stage protocol `docs/GOLD_NEXT_STAGE_PROTOCOL.md` and its preconditions.
This is exploratory association work over spent intervals. It is not a qualification, a holdout, a
prospective read, an accuracy claim or a trading edge.

## 0. First rule: the live lane and the standing anchor obligation

`GoldQualificationWindowTick018` (the v2 wrapper, `PT10M`) is the only capture path and must keep
ticking untouched. Do not stop, pause, reconfigure, duplicate, test-replace or hand-trigger it, and do
not read, seal or re-attempt any capture identity. The 022 item A obligation continues: at or after the
`2026-09-28T16:00:00Z` lane close for the `2026-09-28T14:00:00Z|gold|entry` identity, deliver the one
observation envelope the 022 assignment describes (the pre-`15:00Z` `not_yet_eligible` rows with no
provider call and no directory, the in-lane outcome, the post-close `already_settled` state, the block
count and task settings, and the byte-identity of the four preserved artifacts). If this stage's run is
still going at that point, deliver that envelope first and continue afterwards, and never let the batch
interfere with a capture tick.

## 1. Declare first: the 28-variable cell, its universe and its cap

One batch declares one cell and one operator. Reuse the accepted cell shape and the declared context
field exactly as the frozen v1 registry declares them so the two stages are comparable: cohort
`daily_snapshot_anchors`, horizon `h24_post_event`, endpoint group `all_computed`, operator `and`,
context field `prior_5session_return_sign` with `none` plus its three usable states.

New file, never an edit: `backtester/registries/gold_combination_batch_daily_h24_and.v2.json`. It
declares the atom definition and restriction, cross-variable-only eligibility, at most one context atom,
refusal of arithmetic/weighted/three-atom rules, complete enumeration, no ranking, no truncation, the
ledger schema version, the required denominators and the consumed / no-holdout claims, exactly as the
accepted v1 registry does, plus:

- its inputs with hashes: the accepted 019 report artifact under
  `backtester/tmp/ivr-coverage-019-20260925-r2/` (the 28-of-28 run), the accepted report registry
  revision 8 (`backtester/registries/gold_individual_variable_report.v2.json`, `2be6701c...`), the
  coverage registry, the accepted consumed-data manifest and the accepted timing rules;
- `atoms_declared`, `atoms_eligible`, `cross_variable_pairs`, `context_options`, `declared_universe`, the
  `cap`, `selection: complete_enumeration` and the hash of the enumerated candidate list;
- a per-variable table naming every measured variable that contributes atoms and every measured variable
  that contributes none, with the reason, so nothing is silently dropped.

Compute the counts with the accepted counter and declare `cap` so that `declared_universe <= cap` holds,
with `cap` at most 20000:

```powershell
node backtester/scripts/count_gold_next_stage_universe.js --report backtester/tmp/ivr-coverage-019-20260925-r2/<the 019 report>.json --registry backtester/registries/gold_individual_variable_report.v2.json --context-field prior_5session_return_sign --horizon h24_post_event --cap <declared cap>
```

If the declared universe exceeds 20000, or if the counter would return `balanced_selection`, stop and
report the exact counts and the cell that produced them instead of truncating, ranking, or letting a
selection rule choose candidates. Commit the declaration, with the registry hash and the counts, BEFORE
any candidate is evaluated, and state the declaration commit in the envelope.

## 2. Execute the stage on the accepted harness

```powershell
node backtester/scripts/run_gold_combination_batch.js prepare --run-id gold-combination-run-023-20260926-rev1 --output-dir backtester/tmp/combination-run-023-20260926-rev1
node backtester/scripts/run_gold_combination_batch.js verify --manifest <that run's manifest>
node backtester/scripts/run_gold_combination_batch.js execute --manifest <that run's manifest>
node backtester/scripts/analyze_gold_combination_ledger.js --run-dir backtester/tmp/combination-run-023-20260926-rev1
```

Reuse the accepted harness unchanged. If an additive change is unavoidable, keep the v1 defaults
bit-for-bit, cover the change with focused tests and disclose it. These rules must hold exactly as
accepted: the session, horizon, endpoint, availability and exclusion rules; `min_n` equal to the frozen
`accepted_timing_rules.min_n` (20); one anchor identity per row with no repeated anchor ever
deduplicated or double counted; the endpoint denominators reconciling
(`exact_offset_elapsed + delayed_offset_endpoint + session_close_endpoint = all_computed`) for every
cohort and horizon; no new binning, threshold, band, tercile or per-year rule; a ledger row without an
anchor identity refused. Every anchor used must lie inside the accepted consumed intervals and strictly
before the frozen `2026-09-24T14:00:00Z` boundary: prove it and report the refusal when a candidate or
anchor would fall at or after it. Record the exact inputs with hashes, row counts, every exclusion reason
with counts, and the run duration.

## 3. Report the stage honestly

Committed summary: `docs/GOLD_COMBINATION_ANALYSIS_023.md`. It states the declared cell and universe, the
counts actually evaluated, the denominators reconciliation, the dependence statement (the attempts are
dependent and every interval in scope is already consumed), every exclusion and every known limitation,
and the accepted fact that several of the 28 measured variables are declared research definitions rather
than live fields (`fed_bias`, `inflation_signal`, `risk_headline_context`, `equities_regime`,
`growth_regime`), so no result may be described as validating, replacing or contradicting a live Layer 1
field. No accuracy, win-rate, profitability, timing or edge claim, no candidate described as a winner,
recommendation, signal or formula, and no ranking published. Preserve the existing individual-variable
digest `docs/GOLD_VARIABLE_FINDINGS_AND_COVERAGE.md` and its 28 blocks byte-identical; the new analysis
is a separate document.

## 4. Evidence and validation

Focused tests covering: the new registry's declared counts reproduce from the counter; a
cross-variable pair is required and a same-variable pair refused; more than one context atom, an
arithmetic or weighted rule, a third atom, and an unavailable or non-comparable state are refused; a
`balanced_selection` outcome is refused as undeclared; no anchor at or after the frozen boundary is
accepted; the denominators reconcile; the preserved artifacts are byte-identical. Then the documented
local suite with exact counts and every failure disclosed, with the known CRLF and console-width cases
disclosed as environment rather than as new work. Raw run evidence stays in your ignored
`backtester/tmp/`.

## 5. Boundaries

No acquisition, network call or credential: every input is already archived locally, the four keyless
sources stay keyless, and this stage needs no provider at all. No new or redefined source or variable.
No research-rule, threshold, binning, horizon or formula change. No prospective observation, no holdout
reservation or use, and no interval described as fresh. Do not modify
`gold_combination_batch_daily_h24_and.v1.json` (`7e2bcff6...`), the accepted run-011 ledger
(`5cd45278...`), the frozen 014 manifest (`15cd0606...`), the 013 shortlist and audit, the report
registry revision 8 (`2be6701c...`), the revised inventory (`863c4e02...`), audit v2, the coverage
declaration, the 015/016/017 activation artifacts, the v2 lane files or any sealed window evidence: all
stay byte-identical. No repository-level `.gitattributes` change and no renormalisation of accepted
files - that remains the `backtester-spike` change request. No production, live workflow, warehouse,
Layer 1, dashboard or deployment action. One writer in this worktree. Stop at the review boundary.

## 6. Reporting (mandatory)

Report activity first, then after the declaration commit, after the run, after the analysis and after the
022 item A envelope. On completion, on a blocker or at a decision point, write one envelope from
`templates/submission.json` into your own ignored `tmp/` with status `ready_for_review`, `blocked` or
`status_report`, the observed worktree/branch/base/HEAD, changed files, the declaration commit, exact
test commands and results, artifact hashes and row counts, blockers, questions and production
disclosure; submit it with
`node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <that file>`; record
`node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity gold-research paused "<what finished>"`;
then stop and wait for a recorded reply. If the run cannot complete, report the partial state and the
exact failure rather than leaving the tree uncommitted.

