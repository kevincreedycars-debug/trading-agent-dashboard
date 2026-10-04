# Make the historical Gold path able to speak for the four dark factors

Assignment: `gold-dark-factor-repair-027`. Published 2026-10-04 by the central coordinator, superseding
`gold-declared-band-measurement-026` (its work order is preserved at
`docs/orchestration/assignments/gold-declared-band-measurement-026-archive.md`).
Worker: `gold-research`. Worktree: `D:/trading-agent-dashboard-codex/.local/worktrees/gold-research`.
Branch: `workers/gold-research-policy-20260920`. Starting commit: `65e8b3a4` (clean; the accepted 025 verdict page).
Predecessor: `gold-coverage-025`, accepted 2026-09-25.

## 0. User authority and why this window exists

On 2026-10-03 the user directed, recorded verbatim in the accepted strategy filing
`20261003-strategy-gold-view-and-fault-first-042`: *"Yes this thread was interrupted we want to see and analyse all the
gold data as per above."* On 2026-10-04 the user answered five questions and delegated the one that remained:

- the weights are to be left alone, and work continues until a genuine statistical edge better than the 60 percent
  drift is found;
- **all data must be present** - this is the authority for this job;
- the bounded availability-lag rebuild is approved;
- the event-day study on data already held is approved;
- the sealed prospective window is not on the critical path;
- the choice of who takes the five defect fixes and the three missing producers, whether `026` is superseded and in
  what order the work runs, was delegated to the coordinator with the words *"let the coordinator decide best course of
  action"*. That delegation is recorded in `20261004-strategy-coordinator-to-choose-the-factor-fix-lane-060`, reviewed
  and accepted by the forty-eighth coordination cycle, which took the third route and published this assignment.

## 1. First duty: the carried 022 item A envelope

Unchanged in this window and older than everything else here. The carried 022 item A anchor observation envelope for
the `2026-09-28T14:00:00Z|gold|entry` identity is still due; its window closed at `2026-09-28T16:00:00Z` and it has
not been filed. File it as exactly one `ready_for_review` envelope from your own ignored `tmp/` through the canonical
CLI, or file a `blocked` report that states plainly what stopped it. Either answer is useful; silence is not. Do that
first, then continue with this assignment.

## 2. The bounded job

Make the **historical** Gold path able to speak for the four factors that are currently dark, so that the archive
carries the values the live path already carries or the Layer 1 document declares. Everything below is downstream
research code and local data already on disk. One writer, your own worktree, code and tests and docs only.

1. **F3 Fed bias.** `backtester/builders/gold/build_gold_historical_snapshots.js` writes `fed_bias: null` (around line
   285) while the live snapshot store carries the column on 145 of 147 rows. Emit the real value from data already on
   disk instead of `null`, using the live path's own vocabulary.
2. **F10 liquidity/growth vocabulary.** The builder emits `global_growth_regime` as `"contracting"` and `"expanding"`
   (around lines 290-292) while the engine matcher in `backtester/replay/gold/gold_replay_core.js` tests
   `includes("contraction")`, `includes("expansion")`, `includes("weakening")` and `includes("supportive")` (around
   lines 198 and 201). Reconcile the two so the archive can score the factor, choosing whichever side keeps the live
   path's behaviour unchanged, and say in your envelope which side you changed and why. The filing records that this
   factor's **implemented sign also disagrees with `logic/agent_gold_direction.md`**: do not change any sign in the
   replay engine. Record the disagreement, with the lines, for the coordinator instead.
3. **F8 inflation signal.** The engine returns a hardcoded `NEUTRAL` for it (`gold_replay_core.js:178-183`) because no
   top-level `inflation_signal` column exists on either path. Build it as a **declared offline producer** over data
   already on disk - the 5,115-row local event archive's actual-versus-consensus for CPI/PCE/PPI is the route the
   accepted filing prices - with its declaration (source, state rule, cutoff, availability) written down before any
   value is produced. No live collector, no acquisition, no new data.
4. **F9 safe haven.** `risk_headline_context` is null on all 147 live snapshots and the builder writes
   `geopolitical_risk_flag: null` (around line 294). Build a **declared offline producer** for
   `risk_headline_context` over the already-approved route - a declared name classifier plus VIX - again with its
   declaration written down first, and again with no live change.
5. **One build guard.** Add exactly one guard that fails when the builder's vocabulary and the engine's matcher
   disagree, so this class of silent defect cannot recur unnoticed. Put it where the repository's tests already run,
   and make its failure message name both sides.
6. **Re-run and report.** Re-run the archive over the same spent intervals and report, per factor, whether it now
   carries information and at what day count. Exploratory only.

## 3. First rule: exploratory and downstream-only

Descriptive and code-repair work only. No accuracy, win-rate, edge, prediction, timing, profitability or qualification
claim appears anywhere, in any envelope or document, and nothing here is a test of a rule or a promotion of one. Every
interval in scope is already spent. Read no outcome, holdout or prospective observation; the sealed prospective window
stays sealed until `2027-03-25T15:00:00Z`. Do not re-run `gold-combination-run-024` revision 1, 2 or 3 - they are
spent and immutable. Do not disturb the installed `GoldQualificationWindowTick018` task. **Layer 1 stays independent
and backtesting stays downstream-only**: nothing you write may change a live Layer 1 input, a live call, a collector, an
n8n workflow, a published artifact or a dashboard file.

## 4. Explicitly out of scope - do not do these, and do not ask again for them

- **Which of the two 100-point weight vectors is the project's own.** Declared on 2026-10-04 by the interactive
  coordinator under the user's own delegation (*"No idea you pick which ever you think is right"*): the project's own
  vector is the logic document's `22/18/14/8/8/10/6/6/6/2` (`logic/agent_gold_direction.md` section 4, lines 103-116),
  and the `26/22/12/10/10/8/8/2/1/1` in `backtester/replay/gold/gold_replay_core.js` is the `"24h"` row of the live
  export's own `TIMEFRAME_WEIGHTS` table, an implementation and not a rival declaration. That settles the referent for
  you and changes nothing you do: do not choose or align a vector, do not reweight anything, and change no weight,
  signed rule or threshold.
- **F2's threshold and F5's threshold.** The implemented `0.15` against the document's declared `0.30`, and the
  invented plus-or-minus `0.3`, live in the replay engine the live path mirrors; repairing them is a live-engine
  reconciliation and is not yours. Record what you find, change nothing.
- **F6 re-derivation or zeroing.** A weighting change the user has excluded for now.
- **The availability-lag rebuild and the event-day walk-forward.** Both approved, both sequenced after this job, each
  its own bounded job, neither published yet. Do not start either.
- **The movement-by-state measurement** that `026` carried. Not dropped: re-pointed to run on the repaired artifacts
  as its own bounded job, before the availability-lag rebuild changes the snapshot basis. Do not start it now.

## 5. Boundaries

One writer, inside your own worktree. No new data, source, candidate, credential or acquisition; no purchase. No edit
to any accepted artifact - the 019 report, the v2 registry, the 024 ledger, manifest, summary and row reconciliation,
the frozen 014 manifest, the scorecard, the sealed captures and every accepted 019-025 artifact stay byte-identical.
Change no weight, no signed rule and no live-facing threshold. No production, warehouse, Layer 1, live workflow,
dashboard, publication, deployment or refresh action. New raw evidence and any scratch output belong only in your
ignored `tmp/` or `backtester/tmp/`. State plainly where an accepted artifact cannot supply a cell or a value; a gap
reported is worth more than a value invented. If a repair you find necessary would change what the live path computes,
stop and file it for the coordinator instead of making it. Stop at the review boundary.

## 6. Reporting (mandatory)

Check every number and every changed line against the files before submitting, then write one envelope from
`templates/submission.json` into your own ignored `tmp/` with status `ready_for_review`, the artifact paths and their
sha256, the exact file and line behind every change, the build guard's own failing and passing runs, production
disclosure (none) and questions; submit it with
`node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <that file>`; record
`node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity gold-research paused "<what finished>"`;
then stop and wait for a recorded reply.

## 7. What is not asked of you

You are not asked to decide a weight, a threshold, a sign or a band; not to touch the live engine, the collector, the
n8n flows or any published page; not to qualify anything; and not to decide what the coordinator does next with the
availability-lag rebuild or the event-day study. Those are the coordinator's or the user's, and any of them that is a
production decision is outside this assignment entirely.