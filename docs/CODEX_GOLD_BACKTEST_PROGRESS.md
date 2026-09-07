# Codex Gold backtester progress

## Ownership

Codex owns the backtesting workstream under `docs/PARALLEL_AGENT_HANDOFF.md`. DeepSeek/Cline owns additional Layer 1 drafts and its separate progress file.

## 2026-09-06: stored-call pilot and confirmed collection defect

Paused at the user's request: "save here". All work is saved locally and remains uncommitted; no deployment was performed. Resume with isolated n8n validation of `backtester/drafts/gold_collector_history_query_patch.json`. Review this handoff and `docs/PARALLEL_AGENT_HANDOFF.md` first, preserving the shared checkout and DeepSeek-owned files. Latest focused validation: 87 tests passed.

Read-only Supabase/OANDA access succeeded using the existing encrypted local credentials, loaded into the child process only. No warehouse or workflow writes.

- Exported 154 stored GOLD Layer 1 outputs spanning 2026-06-07 through 2026-09-06 (77 distinct storage dates), with all ten factor signals and valid links to snapshots stored before each output. Seven snapshot groups repeat.
- Preserved the allowlisted export and SHA-256 under ignored `backtester/tmp/gold-stored-20260906/`. Storage timestamps are explicitly proxies, not verified dashboard publication times; feature source release vintages remain unverified.
- Recorded an explicit next-minute-after-storage / 24 elapsed-hour / 0.3 percentage-point flat-band research protocol before downloading the matching prices. This is not an untouched holdout or a production execution rule.
- Downloaded 76,143 unique completed OANDA XAU_USD M1 candles, with raw bid/ask/mid responses retained under ignored `backtester/tmp/gold-oanda-20260906/`. Forty GET requests; per-response hashes and acquisition manifest retained. Coinbase legacy prices were not replaced.
- Added stored-call preparation and a separate local-only acquisition command. Added opt-in delayed entry and endpoint-only coverage to the timestamped evaluator; default contiguous coverage remains strict. Endpoint checks cannot validate the intervening trade path.
- Final focused validation: 87 passed, including the Gold page at 1440px/390px and the existing Backtesting Development browser integration. Both layouts visually reviewed.

Most important finding: production Gold's history node requests 25 unordered snapshots. A read-only reproduction returned June 6-9 rows, leaving June 9's price 4266.066004573223 as its newest reference. 143 of 147 linked snapshots imply this same reference from June 10 through September 6. All 154 stored calls replay exactly from those inputs, so parity does not establish input quality.

Prepared `backtester/drafts/gold_collector_history_query_patch.json` (NOT applied). Its bounded, ordered, paginated database query returned 543 rows across 49 dates, newest September 5. Isolated n8n import/execution remains unvalidated; no local n8n or Docker executable was available. Read-only inspection confirmed the normal Master calls the affected Gold collector; a separate active TEST orchestrator calls the active TEST Gold collector. Collectors have subworkflow triggers, with no schedule trigger observed. TEST ownership/use still needs operator review.

Real pilot results: 97 endpoint-evaluable calls (45 correct, 37 wrong, 13 flat, 2 no-call), 57 rejected endpoints, and zero strict continuous paths. Accuracy excludes flats/no-calls: 54.88% overall, 68.0% earlier and 34.38% later. Earliest-per-snapshot accuracy is 53.16%, equal to the always-bullish baseline on that subset. All ten factors and 45 pairs have chronological coverage and correlation diagnostics. These results do not validate weights or a trading edge.

A separate as-of counterfactual repairs only the daily Gold input using prior-date stored history: 97 F5 signals and 19 final direction labels change. No outcome-improvement experiment, live weight edit, or historical rewrite was performed.

Also fixed two demonstrated as-of builder defects (earlier explicit cutoffs were advanced; upstream rejections were cleared), rejected mixed feeds/incomplete candles, and indexed batch windows without changing direct-evaluation rejection behavior.

Review `gold-backtesting.html` and `backtester/docs/gold_stored_call_pilot_20260906.md`. Durable results are `data/gold-stored-call-pilot-20260906.json`, `data/gold-snapshot-lineage-audit-20260906.json`, `data/gold-history-query-audit-20260906.json`, and `data/gold-history-repair-impact-20260906.json`. Raw evidence remains in ignored `backtester/tmp/`; all work remains local and uncommitted.

Next priority: validate the prepared history query patch in isolated n8n, then review production deployment authorization. Establish a fresh input-quality baseline before further calibration. Authenticated publication/release times, contemporaneous L2L levels and MT5-aligned execution evidence remain outstanding.

The updated development tracker passed its follow-up browser check. Scoped secret scanning found no likely private credentials. Legacy checker data and raw acquisition hashes were verified unchanged; the counterfactual report reproduced byte-for-byte after the microsecond-ordering regression check.

Final focused command (87 tests, 0 failures):

```powershell
$goldTests = @(rg --files backtester/tests | Where-Object { $_ -match 'gold_.*\.test\.js$' })
$goldTests += @('backtester/tests/outcome_evaluation.test.js', 'backtester/tests/factor_edge_lab.test.js', 'backtester/tests/confidence_calibration.test.js', 'tests/backtesting_development.browser.test.js')
node --test @goldTests
```

Run log: `backtester/tmp/gold-validation-20260906.txt`. The development-tracker test was rerun successfully after its final content update. No linked-warehouse mutation/integration suite was run.

The worktree's task/milestone/session pointers now refer to this September research checkpoint; July production history remains in the existing state/changelog documents. Preserve unrelated shared changes and DeepSeek ownership.

## Session paused — 2026-09-05

User requested "save here for today". Work is saved locally and remains uncommitted; no deployment was performed.

Resume by reading this handoff and `docs/PARALLEL_AGENT_HANDOFF.md`, checking Git changes and DeepSeek's latest progress without editing its owned files. Open `gold-backtesting.html` to review the completed evidence page. The latest validation totals 59 passing tests across the focused suite and existing tracker browser test.

Next priority: establish the source and availability of authentic Gold call/feature timestamps and matching intraday candles against `backtester/docs/gold_timestamped_backtesting.md`. Do not reinterpret the preserved daily snapshots as timestamp-qualified data. Once real inputs are available, run the as-of builder, timestamped evaluator, and chronological factor analysis. Execution rules and MT5-aligned evidence remain outstanding for trade-level validation.

## 2026-09-05: outcome evaluation integrity

Completed the first local engine correction in `backtester/lib/outcome_evaluation.js` with regressions in `backtester/tests/outcome_evaluation.test.js`.

- Missing prices previously produced `NOT_EVALUABLE` while leaving `evaluable: true` for a valid session. The flag now reflects the scored result as well as session eligibility. Gold's outcome publishing script consumes this flag for its evaluation payload and calibration notes.
- Price validation now rejects booleans, arrays, objects, blank strings, non-positive values, and non-finite values. Previously JavaScript coercion could treat `true` or `[2000]` as a valid price.
- The exported percentage-change helper uses the same price validation and returns null for a non-finite calculated return. Evaluation records `market_return_invalid` for overflow, preserving session-error precedence.
- Numeric price strings remain supported. Regression coverage confirms valid Gold bullish, bearish, flat, and no-call outcomes.

Validation: the initial regression run failed in three tests before the fix. After the fix, all 23 tests passed with:

```powershell
node --test backtester/tests/outcome_evaluation.test.js backtester/tests/factor_edge_lab.test.js backtester/tests/confidence_calibration.test.js
```

This is a shared Phase 1 evaluator correction, including Gold; it is not a Gold weighting change. No historical artifacts were regenerated, no warehouse/live workflow writes were performed, and no claim is made that historical metrics improved. The linked-warehouse evaluation integration suite was not run.

## 2026-09-05: autonomous build continuation

Built and verified:

- `gold_evidence_audit.js` and `build_gold_evidence_audit.js`: offline audit of the preserved Gold checker artifact, duplicate/missing data checks, ten factor profiles and 45 pair diagnostics. Added `data/gold-evidence-audit.json` with source SHA-256.
- Actual local results: 608 rows recomputed, no stored result-label mismatches, 45 missing-price rows, 563 usable price outcomes. These are numerical checks under legacy assumptions, not verified historical timing.
- `gold_timestamped_evaluation.js` and its command: explicit timezone-aware call/horizon/feature availability, exact candle boundaries, consistent price basis/source metadata, OHLC validation, and rejection of gaps/overlaps/duplicates. Contract example runs are explicitly synthetic, never trade evidence.
- `gold_chronological_factors.js` and its command: training/validation separation, crossing-horizon purge and explicit embargo; coverage for all ten factors and 45 pairs. No untouched holdout or independent-trial claim.
- `gold_asof_dataset.js` and its command: selects records known at decision time, handles available revisions, requires explicit age/required-input rules, and connects directly to the evaluator. Tests confirm later records cannot alter earlier call inputs. It selects supplied features; it does not regenerate predictions from raw observations.
- Corrected Gold realised-outcome summary extraction: persisted rows store comparable direction inside `evaluation_payload`, while the summariser previously looked only at the top level and lost it.
- Added `gold-backtesting.html`, a self-contained research page generated from `backtester/templates/gold-research.html`. Tested factor/year filtering, pair expansion, and offline loading at 1440px and 390px. Visually inspected both layouts; narrow tables scroll horizontally instead of crushing headings.
- Added `backtester/docs/gold_timestamped_backtesting.md`, a complete synthetic example, local CLI integration tests, and updated the development tracker with actual audit coverage and tooling status.

Timing findings: the legacy runner labels snapshot/daily prices with assumed 09:30 entry times; the historical snapshot builder permits same-day end-of-day events. Source-price and feature availability timestamps must be established before treating this as morning-call forecasting evidence. Legacy snapshots/results were preserved, not retrospectively relabelled.

The new page can be opened directly or in VS Code Live Preview. Rebuild with:

```powershell
node backtester/scripts/build_gold_evidence_audit.js data/backtester-checker-gold-24h-2024-2026.json data/gold-evidence-audit.json gold-backtesting.html
```

Final validation: 58 focused tests passed across the seven new Gold test files plus outcome evaluation, factor-edge analysis, and confidence calibration. The existing Backtesting Development browser integration test also passed (59 tests total across these runs). Local command tests cover source preservation, source hashing, synthetic-data labelling, HTML escaping, and the as-of-to-evaluation pipeline. Browser checks cover desktop/narrow offline page rendering and the existing dashboard tracker route. Diff whitespace checks passed for tracked changes.

Focused command used:

```powershell
node --test backtester/tests/gold_asof_dataset.test.js backtester/tests/gold_evidence_audit.test.js backtester/tests/gold_timestamped_evaluation.test.js backtester/tests/gold_chronological_factors.test.js backtester/tests/gold_outcome_summary.test.js backtester/tests/gold_local_commands.test.js backtester/tests/gold_research_page.browser.test.js backtester/tests/outcome_evaluation.test.js backtester/tests/factor_edge_lab.test.js backtester/tests/confidence_calibration.test.js
node --test tests/backtesting_development.browser.test.js
```

## Remaining work after this build

1. Supply authentic Gold call/feature availability times and corresponding intraday candles to the new input contract. Daily data cannot recover exact entry prices or input availability.
2. Establish complete per-call joins for Gold factors and contemporaneous L2L levels, with explicit missing-data coverage.
3. Run the new chronological tooling on qualified real inputs, documenting an unconsumed evaluation period. Historical descriptive factor statistics and the tooling are built; research validation remains outstanding.
4. Validate executable outcomes once entry, target, stop, spread, and intrabar sequencing have real timestamped evidence. The development tracker still identifies MT5-aligned evidence as a dependency.

No production workflow, warehouse, credentials, live weights, or DeepSeek-owned files were changed. The linked-warehouse integration suite was not run. These remaining data and execution gates are not represented as complete.
