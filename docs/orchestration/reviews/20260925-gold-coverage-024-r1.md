# Gold coverage-024 revision 1: stage verified, changes requested for the two missing evidence items

Reviewed on 2026-09-25 by the interactive Central Orchestrator (the dispatcher was paused, no automatic run
was active, so no review ran concurrently). Submission `20260925-gold-coverage-024-r1`, mailbox SHA-256
`0ca796e37530bc8e14bcf5d55fed2fd91d95566e230a3b9e2791f88da9734031`. Reply published at
`.local/orchestration/replies/gold-research/20260925-gold-coverage-024-r1.json`. A review decision is not
integration, deployment or a trading result.

## Scope checked

Worker `gold-research`, worktree `.local/worktrees/gold-research`, branch
`workers/gold-research-policy-20260920`, base `6fd501a7` (an ancestor), HEAD `2c3606dd`, working tree clean,
two commits (`151801a3` assemble the accepted measurement engine and execute the stage; `2c3606dd` report it).
Three changed files: `backtester/lib/gold_combination_rows.js`, `backtester/lib/gold_combination_ledger.js`
and the new `docs/GOLD_COMBINATION_ANALYSIS_023.md`. No accepted artifact is modified.

## Independent verification (reproduced, not trusted)

- **Run data.** `backtester/tmp/combination-run-024-20260926-rev3/combination-ledger.jsonl` is 23,948,174
  bytes with SHA-256 `f02a88cb5d03097e982c66081827a3403f34086dc2ae16c2e10279bceabc6707`, holds exactly **4,956
  records**, and its status totals are 2,745 `reported`, 704 `ineligible`, 1,507 `empty`, 0 `unavailable`,
  with 4,673 candidates carrying at least one unavailable anchor - every figure the submission states.
- **Denominators.** Summed from the ledger's own `endpoint_denominators`: `all_computed 441,319 =
  exact_offset_elapsed 350,283 + delayed_offset_endpoint 91,036 + session_close_endpoint 0`, so the required
  reconciliation holds on the artifact, not just in the report.
- **Coordinates.** Execution manifest `1ec2a382f9944cd598993444cb478a8741244b004fd199fa49c04f335dcb34d4`;
  summary `exploratory: true` with `prediction_claimed`, `accuracy_claimed` and `trading_result_computed` all
  false; 965 anchors with 964 computed outcomes; 4,782,540 attempts over 441,781 matched anchors; row
  reconciliation `a23f65d1...`; registry `c19315e6`.
- **Preserved artifacts byte-identical.** v1 batch registry `7e2bcff6`, v2 registry `c19315e6`, run-011 ledger
  `5cd45278`, frozen 014 manifest `15cd0606`, 013 shortlist `ffa69b30`, 013 audit `e7c57773`, report registry
  revision 8 `2be6701c`, revised inventory `863c4e02`, audit v2 `1a6af31d`.
- **Harness edits are additive and fail-closed.** The ledger now accepts the declared v1 and v2 registry
  versions and the two pre-execution statuses and refuses anything else *before a record is written*; the v1
  default path and its accepted status remain valid. The rows adapter passes the declared series rules
  (`SF_FED_DNSI` 168 h / 14 d, `PHILLY_FED_ADS` 36 h / 14 d) and the declared prospective boundary into the
  loader. Both changes are disclosed in the submission.
- **The analysis document is honest.** `docs/GOLD_COMBINATION_ANALYSIS_023.md` states the declared cell and
  universe, the per-variable table (all 28 named; the six event-cohort variables contribute no daily atom),
  the undeclared `event_releases` cell that would return `balanced_selection` and was therefore left
  undeclared, the counts, every exclusion with counts, candidate-n quantiles (median 74, q1 0, q3 156), the
  dependence statement, the known limitations including the research-definition caveat, and a closing section
  that claims no accuracy, win-rate, timing, ranking or edge.
- **Verification limit recorded, not hidden.** The ledger carries per-candidate attempt and anchor counts but
  no anchor instants, so the "no anchor at or after the frozen boundary" claim rests on the accepted engine
  plus the declared prospective boundary passed into the loader rather than on a per-anchor audit.

## Decision

Changes requested. The stage - declaration, run, ledger, reconciliation, analysis and preservation - is
verified and stands; only the two evidence items the worker itself disclosed as not run stand before
acceptance, per the user's strict close-out standard: the focused tests for the two repaired modules, and the
documented local suite with exact counts and every failure disclosed. Acceptance and circuit close-out follow a
`ready_for_review` re-submission carrying those two results. The batch must not be re-run: rev1, rev2 and rev3
are spent and immutable. No outcome, holdout, acquisition, credential, production, warehouse, Layer 1, live
workflow or deployment action occurred; the live v2 capture lane was untouched throughout, and the 022 item A
anchor envelope remains due at or after `2026-09-28T16:00:00Z`.
