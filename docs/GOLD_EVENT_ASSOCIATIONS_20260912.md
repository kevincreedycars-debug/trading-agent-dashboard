# Gold event association run — 12 September 2026

Used the stored FRED/OANDA evidence and the 841 historical US high-impact records already acquired from the newer economic-calendar API. No additional subscription or user input was needed. The pipeline now supports two explicit evidence modes and runs both from the same hashed source files.

| Measurement | As-of update proxy | Retrospective association |
| --- | --- | --- |
| Scheduled daily decisions | 681 | 681 |
| Decisions with usable event records before outcome filtering | 10 | 395 |
| Numeric releases with late/unknown update versions | 385 | 0 (timing is not an admission rule) |
| Recent releases lacking numeric actual/consensus or family | 92 | 92 |
| No release within 72 hours | 194 | 194 |
| Training / validation / exclusions | 390 / 143 / 148 | 390 / 143 / 148 |
| Single-variable and pair candidates | 800 | 7,678 |
| Event-conditioned candidates | 0 | 6,878 |

Retrospective results include 21 event families and 285 evaluable decisions with event features. Families and successive daily observations overlap; these counts are not independent economic releases. Candidate thresholds, directions and selection use training only. All candidates, including small samples, appear in the JSON; the Markdown report shows family exclusions and every single event-surprise state. Class selections distinguish individual variables, pairs and event conditions.

No event candidate meets the unchanged 50-directional-training-observation reporting floor. The selected macro pair remains VIX one-day change at/below the training median plus five-day change above its training median: 44/58 correct in training (75.86%) and 15/28 in validation (53.57%). Including flat outcomes, validation is 15/33 (45.45%). This does not establish greater-than-60% reliability.

Coverage is a substantive limitation. Nonfarm Payrolls has 38 source decisions with a recent release, but only five training and three validation observations; 29 decisions lack the exact horizon candle and one lacks candles in its window. A Friday-to-Monday return cannot silently substitute for 24 elapsed hours. The archive does not supply all original research variables, and the fixed daily schedule is not an immediate-release event study.

Retrospective features live in `retrospective_event_features`, outside the evaluator's timing-validated `features`. They retain the actual vendor update timestamp (including timestamps after the decision), are explicitly labelled, and cannot qualify live calls. A later `lastUpdated` is evidence of an update, not proof that the numeric actual was revised. Neither mode authenticates pre-release consensus. Previously reported 477 late/unknown decisions combined 385 version exclusions with 92 missing-measurement decisions; the audit now separates them.

Reproduce offline with a new output directory:

```powershell
node backtester/scripts/run_gold_research_bundle.js backtester/tmp/gold-fred-vintages-20260912 backtester/tmp/gold-hourly-history-20260912 backtester/tmp/gold-calendar-archive-20260912-c backtester/tmp/NEW_OUTPUT retrospective
```

Use `as_of_proxy` instead of `retrospective` for the conservative comparison. Completed artifacts are ignored locally under `backtester/tmp/gold-retrospective-audited-20260912/` and `backtester/tmp/gold-asof-audited-20260912/`; each includes REPORT.md, experiments.json, source hashes, feature lineage and exclusions. Source snapshots were also inspected: the newer embedded event schema covers only one unique release, so it cannot fill the older archive's timing gaps.

Validation: full `npm.cmd test` passed 327/327; focused event/macro/experiment tests passed 9/9 after the final family-coverage addition. Both evidence modes were executed against the stored sources; `git diff --check` passed.

Next: expand event-family sample coverage and map the remaining stored research variables. Keep original-release availability, independent final validation, session coverage and actual Layer 2 history as qualification requirements rather than reasons to stop exploratory analysis. Layer 1 remains independent; no production formula, workflow or database was modified.
