# Active milestone

Current milestone: complete the 28-factor work by executing the declared exploratory combination stage over
the 28 measured variables (`gold-coverage-023`/`gold-coverage-024`), while the repaired live lane keeps
capturing unattended.

Status at 2026-09-25 late evening: `gold-coverage-023` delivered its declaration at `5fe48767` and an
additive harness repair at `6fd501a7`, and was reviewed as blocked-with-blocker-upheld. The declaration is
accepted and verified (raw = LF `c19315e6`, 4956 candidates, list `db96c728`, cap 20000, complete
enumeration, no ranking, no truncation, the undeclared event cell correctly reported at 40324 with
`balanced_selection` instead of declared). The stage did not execute: both run directories are spent and
retained with no ledger. The coordinator-verified root cause is that the adapter never sets
`parts.seriesRules` and omits the `prospectiveBoundary` argument, so the declared availability rule fell
back to the module default and the reconstruction guard correctly refused. `gold-coverage-024` was therefore
published with the register at exactly `instructions_published_awaiting_worker` and baseline `6fd501a7`.
Every accepted artifact remains byte-identical, the frozen 014 manifest `15cd0606` still binds only the
unchanged v1 registry among the combination paths, and the live v2 capture lane is untouched (`Ready`,
`LastTaskResult` 0, zero missed runs, evidence root four directories).

Next immediate action on resume: confirm `gold-coverage-024` pickup from Gold own activity record, then
review the adapter repair and its focused tests, the new run id and ledger, the denominators reconciliation
and `docs/GOLD_COMBINATION_ANALYSIS_023.md` - and separately the carried 022 item A envelope after the
`2026-09-28T16:00:00Z` lane close.
