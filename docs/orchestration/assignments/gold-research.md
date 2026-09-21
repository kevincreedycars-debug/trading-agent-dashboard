# Gold prior-return coverage and expanded individual-variable analysis

Assignment ID: gold-coverage-006. Worker: gold-research.
Published 2026-09-21 under the user's instruction to advance the analysis.
Worktree: D:/trading-agent-dashboard-codex/.local/worktrees/gold-research
Branch: workers/gold-research-policy-20260920. Starting HEAD: ffa380c.
Read this assignment from the canonical checkout, plus central README/DECISIONS
and reviews/20260921-gold-findings-summary-005-r3.md.

This authorizes implementation and execution now; the earlier Phase 1 user-approval
hold is superseded. Do not stop at a proposal or request the same authorization.

## Deliver this batch

1. Add gold_d1_pct, gold_d5_pct and gold_d20_pct from the existing hashed hourly
   archive. Before measuring outcomes, commit the declared feature definitions:
   100 * (latest eligible session close / N-session-prior close - 1), N=1/5/20,
   using N+1 consecutive boundary closes. All inputs must be completed and strictly
   available before each anchor under the accepted policy. Reuse its session rules;
   never silently replace missing expected closes, interpolate, or fit exceptions
   to outcomes. Keep archive-inferred calendar and verified-continuity blocker.
   Reconcile gold_d5_pct with the accepted prior-five-session context on matched
   anchors, explaining any legitimate difference rather than silently diverging.
2. Integrate all three variables into the existing individual-variable reporter.
   Freeze states/bins before outcomes, following existing declared conventions;
   no whole-sample outcome tuning. Keep all 28 variables visible, with actual
   measured/unavailable counts and exclusion reasons. Report warm-up losses,
   incomplete windows and prior timestamps by cohort, variable and year.
3. Execute a new immutable report and compact findings digest. Preserve accepted
   005 artifacts. Include individual direction AND return magnitude, all existing
   horizons, separate exact/delayed/session-close groups, matched denominators and
   baselines, per-year breakdowns and existing one-variable context conditioning.
   Between-year agreement requires two supported years. Explain sample overlap.
   Show before/after coverage and verify existing 16-variable results are unchanged
   on identical cohorts, or identify and justify every change. Do not claim that
   exploratory associations establish predictive accuracy or live eligibility.
4. Add meaningful boundary regressions: hand-calculated N+1 closes, strict anchor
   timing, incomplete candles, missing boundary/intermediate closes, insufficient
   history, session transitions and five-session equivalence. Run focused policy,
   coverage/report tests as applicable and npm test (local suite only). Disclose
   exact failures and distinguish pre-existing issues with evidence.
5. Deliver a concrete remaining-coverage and qualification plan alongside results:
   inventory the remaining variables, recommend a documented DXY route without
   relabelling the broad index, identify calendar/vintage evidence gaps, and specify
   the next bounded batch. List already-consumed dates/splits so none is later
   presented as untouched. Describe how later chronological, leakage-controlled
   evaluation will compare a frozen candidate with relevant baselines and current
   stored Layer 1 calls where available, reporting uncertainty and call coverage.
   This plan does not authorize a combination search or final-test consumption.

## Owned scope

Worker-local gold_session_policy library/registry/tests/method doc; individual-
variable report library/registry/CLI/tests/method doc and synthetic fixtures;
gold_variable_coverage library/CLI/tests/doc and its existing registry only where
needed to reflect the new implemented transformations; worker Gold research
progress and findings/coverage documents. Add a focused prior-return helper/test
if useful. Other shared helpers are read-only. Raw evidence remains in ignored
worker tmp/ or backtester/tmp/. Do not edit canonical originals or other workers.

No acquisition, live workflow/warehouse changes, credentials, production calls,
integration or deployment in this batch. Layer 1 agents stay independent and
backtesting downstream-only. No formula fitting or systematic combinations yet.
Provider evidence blockers do not prevent completing the authorized exploratory
batch; report them explicitly instead of treating them as a new permission gate.

Commit scoped work, publish exact commands/results, source/code/policy/registry
hashes and a new immutable submission under gold-coverage-006. Update actual
activity at start/checkpoints and pause after submission for coordinator review.
Coordinator will review and issue the next bounded research batch under the user's
standing direction; only material unresolved choices need user input.

## Coordinator follow-up: finish and submit the current batch

2026-09-21: checkpoint 2 received through the activity monitor. Continue
under gold-coverage-006; no additional permission is needed. Finish digest
regeneration and documentation, run npm test and disclose exact results,
commit the scoped changes, then submit the complete evidence package through
the canonical mailbox. Include the existing-variable invariance check,
five-session/context equivalence and concrete remaining-coverage plan.
The checkpoint is progress evidence, not an accepted delivery. After submission,
pause for coordinator review; the next research batch follows that review.
