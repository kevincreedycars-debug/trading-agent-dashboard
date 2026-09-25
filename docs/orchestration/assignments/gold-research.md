# Write the plain-English verdict for the 28-factor Gold backtest

Assignment: `gold-coverage-025`. Published 2026-09-25.
Worker: `gold-research`. Worktree: `D:/trading-agent-dashboard-codex/.local/worktrees/gold-research`.
Branch: `workers/gold-research-policy-20260920`. Starting commit: `cdd350af` (024 revision 2 accepted).
Predecessor: `gold-coverage-024`, accepted at revision 2 with the review at
`docs/orchestration/reviews/20260925-gold-coverage-024-r2.md`; the 28-factor exploratory circuit is closed as
exploratory and this assignment adds no measurement to it.

User authority: on 2026-09-25 the user directed that, once the circuit is closed, Gold writes one page of plain
English stating what the backtest does and does not establish.

## 0. First rule: nothing new is measured

No new run, candidate, measurement, source, credential, rule, threshold, band or formula. Every number in the
verdict must be traceable to an accepted artifact named in this assignment. No ranking, winner, signal, formula,
accuracy, win-rate, timing, profitability or edge claim; no prospective observation; no holdout; no interval
described as fresh. The live v2 capture lane must not be disturbed. The carried 022 item A obligation stands:
deliver the anchor observation envelope at or after `2026-09-28T16:00:00Z` and then stop.

## 1. The deliverable

`docs/GOLD_BACKTEST_VERDICT_20260925.md`, one page (roughly 500 to 700 words), plain English, short sentences, no
undefined jargon, in this order:

1. **What was asked and what was run.** The 28 measured variables; the declared cell (cohort
   `daily_snapshot_anchors`, horizon `h24_post_event`, endpoint group `all_computed`, operator `and`, context
   field `prior_5session_return_sign`); 4,956 candidates declared before anything was evaluated (declaration
   commit `5fe48767`, registry `c19315e6`, candidate list `db96c728`, cap 20,000, complete enumeration, no
   ranking, no truncation); run `gold-combination-run-024-20260926-rev3`, exit 0, ledger `f02a88cb`;
   965 anchors with 964 computed outcomes; 4,782,540 attempts over 441,781 matched anchors; 441,319
   observations; denominators `350,283 + 91,036 + 0 = 441,319`.
2. **What the numbers say, in plain terms.** 2,745 of the 4,956 candidates reached a reportable sample at
   `min_n` 20; 704 fell below it; 1,507 matched no anchor at all where both atoms and the context state
   coexisted; 0 were unavailable; candidate-n median 74 with a third of candidates at zero (q1 0, q3 156);
   4,673 candidates had at least one unavailable anchor (median 8, maximum 51); 462 matched outcomes were not
   computed. Say plainly what that means: the 2023-2026 archive can *describe* this space but cannot support
   *choosing* from it.
3. **What cannot be concluded, and why.** No accuracy, prediction, timing or edge conclusion; every interval is
   already spent; the attempts are dependent because every candidate shares anchors; the session, holiday and
   early-close rules are archive-derived and unverified; five of the 28 variables (`fed_bias`,
   `inflation_signal`, `risk_headline_context`, `equities_regime`, `growth_regime`) are declared research
   definitions rather than live Layer 1 fields; and the ledger carries per-candidate anchor counts, not anchor
   instants, so the pre-boundary claim rests on the accepted engine and the declared prospective boundary rather
   than a per-anchor audit.
4. **What a real verdict would need.** Either the sealed prospective window, whose evaluation stays sealed until
   `2027-03-25T15:00:00Z`, or a new licensed dataset with declared vintages, each under a new bounded
   assignment. State that neither is authorized by this assignment.
5. **Where to check it.** One short closing line naming the declaration commit, the run, the ledger, the analysis
   at `docs/GOLD_COMBINATION_ANALYSIS_023.md` and the durable reviews under `docs/orchestration/reviews/`.

Do not restate or re-render the 28 individual-variable blocks: `docs/GOLD_VARIABLE_FINDINGS_AND_COVERAGE.md`
stays byte-identical and the verdict links to it instead.

## 2. Boundaries

Documentation only. No new measurement or run; no edit to any registry, harness, ledger, analysis, test or other
accepted artifact; no repository-level `.gitattributes` change; no acquisition, network call or credential; no
production, warehouse, Layer 1, live workflow, dashboard or deployment action; one writer in this worktree; stop
at the review boundary.

## 3. Reporting (mandatory)

Check that every number in the page matches the accepted artifacts before submitting, then write one envelope from
`templates/submission.json` into your own ignored `tmp/` with status `ready_for_review`, the page path and its
sha256, the source artifact for each number, production disclosure and questions; submit it with
`node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <that file>`; record
`node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity gold-research paused "<what finished>"`;
then stop and wait for a recorded reply. The anchor envelope for `2026-09-28T14:00:00Z|gold|entry` remains due at
or after `2026-09-28T16:00:00Z`.
