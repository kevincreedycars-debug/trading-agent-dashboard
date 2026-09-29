# Active milestone

Current milestone: the 28-factor Gold stage is complete and its plain-English verdict page is accepted; hold
until the one carried observation envelope at the lane close, then stop.

Status at 2026-09-25 20:52 local: `gold-coverage-024` revision 2 is accepted at clean `cdd350af` from base
`6fd501a7` (reply `40eaccc4...`, review `docs/orchestration/reviews/20260925-gold-coverage-024-r2.md`,
acceptance commit `41210c1`) and the 28-factor circuit is **closed as exploratory**. `gold-coverage-025` is
also accepted (mailbox `a1543786...` reproduced, reply `bd4804c1...`, review
`docs/orchestration/reviews/20260925-gold-coverage-025.md`): the verdict page
`docs/GOLD_BACKTEST_VERDICT_20260925.md` is delivered at clean `65e8b3a4` from base `cdd350af` as one additive
file of 59 lines and 518 words (sha256 `7198e24e...`), every number in it re-checked against the accepted
artifacts, the five distribution figures the worker disclosed it had not re-derived independently confirmed by
the coordinator from `descriptive-analysis.json`, dependency impact nil (the new path is outside the frozen 014
manifest's eight bound paths and no test enumerates `docs/`), and the live capture lane observed read-only and
undisturbed. The page lives only in the worker checkout, not in this canonical folder; promoting it is a
central decision, not an accepted fact.

Honest reading, unchanged: the declaration is `5fe48767` (v2 registry `c19315e6`), the executed stage is
`gold-combination-run-024-20260926-rev3` (exit 0, ledger `f02a88cb`, 4,956 of 4,956 candidates - 2,745 reported
/ 704 ineligible / 1,507 empty / 0 unavailable - denominators `350,283 + 91,036 + 0 = 441,319`, manifest
`1ec2a382`, summary `d594646d`, row reconciliation `a23f65d1`), and nothing in it is accuracy, ranking, timing
or edge evidence, nor can it be from spent intervals. No successor assignment was published; the register keeps
`gold-coverage-025` at status exactly `instructions_published_awaiting_worker` so the delivery trigger path
stays intact for the carried 022 item A envelope.

Next immediate action on resume: work the strategy review queue one cycle at a time. The 2026-09-29 background
cycle reviewed `20260926-strategy-window-flash-fix-004` and requested changes (reply `dcd739d6...`, 
review `docs/orchestration/reviews/20260926-strategy-window-flash-fix-004.md`), and then reviewed
`20260926-strategy-window-flash-fix-005` (mailbox `15fb7024...`, reply `8eacfe11...`, review
`docs/orchestration/reviews/20260926-strategy-window-flash-fix-005.md`), also with changes requested - the acceptance
tick is confirmed and the verifier FAIL confirmed as a poll artefact, but the -004 correction is still owed and a
second unqualified gaplessness claim was added - leaving eight `pending_review` `strategy`
submissions dated 2026-09-26 to 2026-09-29. In parallel, hold on Gold: the accepted verdict page still lives only
in the worker checkout and promoting it is a central decision, the 022 item A anchor observation envelope for
`2026-09-28T14:00:00Z|gold|entry` was due at or after the `2026-09-28T16:00:00Z` lane close and still needs a fresh
wake - an operator resume of the Gold window or a later coordinator event - before Gold stops, and the three
precise unresolved decisions (another exploratory stage over the already-spent intervals, promoting the verdict
page, publishing the remaining local-only Gold evidence artefacts) stay the user's. Do not re-run the batch, do not
disturb `GoldQualificationWindowTick018` - whose action is now the windowless `wscript.exe run-hidden.vbs` launcher
recorded in `DECISIONS.md` - and keep evaluation sealed until `2027-03-25T15:00:00Z`.