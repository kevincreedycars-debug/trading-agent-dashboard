# Current task

Finish the 28-factor work by executing the declared exploratory combination stage: make the batch adapter
assemble the accepted measurement engine exactly as the accepted 019 builder does, then run the accepted
harness and publish the analysis - while the accepted prospective window keeps capturing unattended.

`gold-coverage-023` was reviewed on 2026-09-25 and its declaration is accepted at clean `6fd501a7`:
`backtester/registries/gold_combination_batch_daily_h24_and.v2.json` (raw = LF `c19315e6`), 4956 candidates,
list `db96c728`, 51 eligible atoms over 22 contributing variables, 36 same-variable exclusions, 1239
cross-variable pairs, 4 context options, cap 20000, complete enumeration with no ranking and no truncation.
The stage could not execute and the blocker is upheld: `buildAcceptedParts` never sets `parts.seriesRules`,
so the declared availability rule fell back to the module default and every `risk_headline_context` state
became `observation_stale_beyond_declared_age`, which the reconciliation guard correctly refused. The
continuation is published as `gold-coverage-024`, which must set `parts.seriesRules`, pass
`prospectiveBoundary(registry)` as the fourth argument of `loadMacroHistories`, add no parallel
provider-file loader, and cover the repair with focused tests including the 28-variable rebuilt-count
reconciliation.

The live window needs no action: exactly one scheduled task, `GoldQualificationWindowTick018`, captures the
declared lanes every ten minutes through the v2 wrapper and must not be disturbed. Its observed state is
unchanged (`Ready`, action the v2 wrapper, one `PT10M` trigger, `IgnoreNew`, `StartWhenAvailable` true,
battery flags false, `LastTaskResult` 0, zero missed runs); the evidence root holds exactly four directories;
the sealed anchor-2 captures `302e4a26`/`58ece552`/`c51ad9b9` and the blocked attempt `e7c197f0` reproduce;
and no directory exists for `2026-09-28T14:00:00.000Z|gold|entry`. No prospective observation or outcome may
be read before `2027-03-25T15:00:00Z`.

Next: review `gold-coverage-024` when Gold reports - the repair, its focused tests, the new run id and
ledger, the denominators reconciliation, and `docs/GOLD_COMBINATION_ANALYSIS_023.md` - and, separately, the
still-open 022 item A envelope at or after the `2026-09-28T16:00:00Z` lane close. The register keeps status
exactly `instructions_published_awaiting_worker`. The CRLF materialisation and the accepted-inputs raw/LF
digest asymmetry stay owned by the `backtester-spike` change request and are not to be repaired here.
