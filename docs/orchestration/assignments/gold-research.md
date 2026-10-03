# Measure the Gold movement ranges by declared state (full L2L and half L2L)

Assignment: `gold-declared-band-measurement-026`. Published 2026-10-03 by the central coordinator.
Worker: `gold-research`. Worktree: `D:/trading-agent-dashboard-codex/.local/worktrees/gold-research`.
Branch: `workers/gold-research-policy-20260920`. Starting commit: `65e8b3a4` (clean; the accepted 025 verdict page).
Predecessor: `gold-coverage-025`, accepted 2026-09-25; its work order is archived at
`docs/orchestration/assignments/gold-coverage-025-archive.md`, and this assignment carries its one outstanding
obligation forward rather than dropping it.

User authority. On 2026-10-03 the user directed, recorded verbatim in the accepted strategy filing
`20261003-strategy-gold-view-and-fault-first-042`: *"Yes this thread was interrupted we want to see and analyse all the
gold data as per above."*, and earlier *"Yes start here, make it very visually easy to find where this data is and how
to interpret it. Remeber we want to see direction, l2l and 0.5l2l data always"*. Both answers authorise this
measurement and set its presentation rule. The strategy lane cannot register a lane; the coordinator registers it here.

## 0. First duty: the carried 022 item A envelope

The carried 022 item A anchor observation envelope for the `2026-09-28T14:00:00Z|gold|entry` identity is still due;
its window closed at `2026-09-28T16:00:00Z` and it has not been filed. File it as exactly one `ready_for_review`
envelope from your own ignored `tmp/` through the canonical CLI, or file a `blocked` report that states plainly what
stopped it. Either answer is useful; silence is not. Do that first, then continue.

## 1. First rule: exploratory and downstream-only

Descriptive measurement only. No accuracy, win-rate, edge, prediction, timing, profitability or qualification claim
appears anywhere, and nothing here is a test of a rule. Every interval in scope is already spent. Read no outcome,
holdout or prospective observation; the sealed prospective window stays sealed until `2027-03-25T15:00:00Z`. Do not
re-run gold-combination-run-024 revision 1, 2 or 3 - they are spent and immutable. Do not disturb the installed
`GoldQualificationWindowTick018` task. Layer 1 stays independent and backtesting stays downstream-only.

## 2. The measurement

For the factor states that are **already accepted**, measure the share of sessions that clear **full L2L** and the
share that clear **half L2L**, on the accepted **1/2/3/5-session ladder**, with the direction read beside each row and
every row carrying its own day count.

- Derive every number **only** from already-accepted artifacts: the accepted individual-variable report of
  2026-09-25 (the `ivr-coverage-019` revision 2 artifact, 95,842,994 bytes) and its stored per-state, per-horizon
  `median`, `q1`, `q3` and `exact_zero` fields (147,465 each of median/q1/q3; 148,920 `exact_zero`), plus the lane's
  own accepted scan scripts. Confirm and record the exact field names you find rather than trusting this list.
- **Declare nothing new.** No new band, threshold, operator, state, candidate, stratum or rule. Use the state
  definitions already accepted in the scorecard (`data/gold-direction-scorecard-20260927.json`, 25 states over 7
  factors) and in the accepted v2 registry `c19315e6`; if a state or horizon is not already declared and accepted,
  print it as unavailable with the reason and put the choice back to the coordinator instead of inventing it.
- Reuse the accepted half-L2L and full-L2L definitions and the accepted ladder exactly as the accepted artifacts word
  them. If those definitions differ from this summary, the accepted artifacts win and you say so.
- Where an accepted artifact cannot supply a cell, say so plainly. A gap reported is worth more than a number
  invented.

## 3. Deliverables

1. A machine-readable table artifact in your own worktree with a declared schema name (for example
   `gold-movement-by-state-v1`): one row per state and horizon, carrying the two movement shares, the direction read,
   the day count and the source artifact for each row.
2. One plain-English page in your own worktree under `docs/`, in the style the lane already uses, applying the user's
   rule: wherever a rate is printed, the direction read, the full-L2L share and the half-L2L share appear together,
   each with its own sample count and its own one-line plain explanation. State plainly what the page is not.
3. A short covering note naming the exact accepted artifact, path and hash, behind every number.

The coordinator's dashboard lane owns the page build that will consume this table; you build no page, edit no
published file and touch no production surface.

## 4. Boundaries

One writer, documentation and local read-only analysis only, inside your own worktree. No new data, source, candidate,
credential or acquisition; no edit to any accepted artifact - the 019 report, the v2 registry, the 024 ledger,
manifest, summary and row reconciliation, the frozen 014 manifest, the scorecard, the sealed captures and every
accepted 019-025 artifact stay byte-identical; no production, warehouse, Layer 1, live workflow, dashboard,
publication, deployment or refresh action. New raw evidence and any scratch output belong only in your ignored `tmp/`
or `backtester/tmp/`. Stop at the review boundary.

## 5. Reporting (mandatory)

Check every number against the accepted artifacts before submitting, then write one envelope from
`templates/submission.json` into your own ignored `tmp/` with status `ready_for_review`, the artifact paths and their
sha256, the exact accepted artifact behind each number, production disclosure and questions; submit it with
`node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <that file>`; record
`node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity gold-research paused "<what finished>"`;
then stop and wait for a recorded reply.

## 6. What is not asked of you

You are not asked to apply the collector patch, to publish or edit any page, to declare a band or a rule, to qualify
anything, or to decide which tab the numbers appear on. Those are the coordinator's or the user's, and any of them
that is production work is outside this assignment entirely.
