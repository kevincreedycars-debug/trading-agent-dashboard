# Gold pre-2024 coverage — September 18, 2026

The 2023 overlap check supports extending retrospective research. No hypotheses were selected or accuracy measured; prior results remain unchanged.

Read-only acquisition captured 1,197 US HIGH/MEDIUM events, 5,895 complete OANDA XAU_USD H1 candles and all five FRED vintage series. Macro history starts November 2022 for lookbacks; prices span January 2023 through January 2, 2024. The audit schedules 260 weekdays at 14:00 UTC, January 2–December 29, with exactly 24 elapsed hours.

| Coverage | Decisions |
| --- | ---: |
| All five macro levels under conservative timing proxy | 260 |
| Exact endpoints evaluable | 205 |
| Missing entry / missing horizon / no candles | 2 / 52 / 1 |
| Retrospective events before price exclusions | 217 |
| Retrospective events and usable endpoints | 163 |
| Events eligible under historical lastUpdated proxy | 0 |
| Strict contiguous price paths | 0 |

All 205 usable endpoint windows contain unclassified interior gaps. All 217 decisions with numeric recent events fail the historical version cutoff; 27 have recent releases missing measurements and 16 have no recent release. Daily decisions are not independent releases. January's first decisions lack a preceding December event buffer. This is exploratory coverage, not original-consensus authentication or live qualification.

## Reproduction

Use the documented credential runner with explicit -Name RAPIDAPI_KEY, FRED_API_KEY or OANDA_API_TOKEN. The backtester scope alone loads Supabase, not these provider keys.

```powershell
node backtester/scripts/acquire_gold_event_archive.js NEW_EVENT_DIR 2023-01-01 2023-12-31 HIGH,MEDIUM
node backtester/scripts/acquire_gold_fred_vintages.js 2022-11-01 2023-12-31 NEW_FRED_DIR
node backtester/scripts/acquire_gold_hourly_history.js 2023-01-01 2024-01-02 NEW_PRICE_DIR
node backtester/scripts/audit_gold_source_overlap.js backtester/tmp/gold-fred-pre2024-20260918 backtester/tmp/gold-hourly-pre2024-20260918 backtester/tmp/gold-calendar-pre2024-retry-20260918 2023-01-02 2023-12-29 NEW_REPORT.json
```

Ignored evidence: the three source directories above and `backtester/tmp/gold-pre2024-overlap-20260918.json`, which records all seven source hashes. The initial calendar attempt in `backtester/tmp/gold-calendar-pre2024-20260918/` failed on a February vendor connection error and remains incomplete; a fresh full retry succeeded. No partial evidence was used.

The audit CLI checks complete manifests and hashes, refuses overwrite, preserves strict and endpoint exclusions, and uses existing evaluators. No live workflow or formula changed.

Next: predeclare an extended exploratory schedule/split, acquire the December 2022 event buffer, and build a versioned 2023–2026 bundle in both evidence modes. Preserve old artifacts and consumed-validation labels; adding history does not create an untouched final test. Original event vintages, session classification and separate Layer 2 qualification remain outstanding.

Validation: real-source audit completed; full `npm test` passed 333/333. Log: ignored `tmp/gold-pre2024-tests-20260918.log`.
