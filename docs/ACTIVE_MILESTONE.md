# Active milestone

Current milestone: close the 28-factor exploratory circuit - accept `gold-coverage-024` once its two missing
evidence items land, then hold for the Monday anchor envelope.

Status at 2026-09-25 20:25 local: the whole stage is executed and verified. Declaration `5fe48767` committed
before any candidate was evaluated (v2 registry `c19315e6`: 51 atoms over 22 applicable variables, 1,239
cross-variable pairs, 4 context options, declared universe **4,956**, complete enumeration, no ranking, no
truncation, inside the cap; candidate list `db96c728`; the undeclared event cell correctly reported at 40,324
with `balanced_selection` and deliberately left undeclared). Run `gold-combination-run-024-20260926-rev3`
finished exit `0` in 43.1 s: ledger `f02a88cb`, 4,956 of 4,956 candidates (2,745 reported, 704 ineligible,
1,507 empty, 0 unavailable), 4,782,540 attempts over 441,781 matched anchors and 441,319 observations,
endpoint denominators reconciling `350,283 + 91,036 + 0 = 441,319`, manifest `1ec2a382`, summary
`exploratory: true` with `prediction_claimed`, `accuracy_claimed` and `trading_result_computed` false.
`docs/GOLD_COMBINATION_ANALYSIS_023.md` reports it honestly: the declared cell and universe, the per-variable
table covering all 28 (the six event-cohort variables contribute no daily atom), every exclusion with counts,
candidate-n quantiles (median 74, q1 0, q3 156), the dependence statement, the research-definition caveat and
an explicit no-accuracy/no-ranking/no-edge close. Review outcome: `024` is **changes requested** - the stage
stands and acceptance needs only the focused tests for the two repaired modules plus the documented local
suite with exact counts and every failure disclosed. The batch must not be re-run (rev1/rev2/rev3 spent and
immutable). Every accepted artifact stays byte-identical, the live v2 capture lane is untouched (`Ready`,
`LastTaskResult` 0, `PT10M`, zero missed runs), and the 022 item A anchor envelope is still due at or after
`2026-09-28T16:00:00Z`.

Next immediate action on resume: review Gold's `ready_for_review` re-submission carrying the focused repair
tests and the local suite, accept `gold-coverage-024` and declare the circuit closed as exploratory - then hold
for the `2026-09-28T16:00:00Z` anchor envelope.
