# Gold timestamped directional-evaluation contract

Review version: `gold-direction-contract-review-v1`, 2026-09-07. Audited implementation baseline: `6c43cbb`; runtime report version remains `gold-timestamped-direction-v1`. This document specifies the existing measurement and identifies gaps; it does not change engine behavior or qualify market evidence.

## Question and evidence status

Compare a recorded XAUUSD direction with the percentage move from an explicitly selected candle open to an explicitly selected horizon close. This measures price direction on one basis, without spreads, fills, stops, targets or P&L. Every output remains research-only and `executable_trade_validated: false`.

For a causal forecast claim, decision time, publication time, feature availability and source vintages must be independently defensible. Supplied timestamps alone establish consistency, not authenticity. The September pilot instead uses database storage time as a proxy. Its stored factor signals do not prove raw-feature availability or that the dashboard published the call at that time.

The pilot is already inspected, with repeated snapshots and overlapping horizons. None of its 154 calls has a strict continuous path. The June 9 reference defect affects 143 of 147 linked snapshots. The older 2025-10-01 through 2026-04-30 final-test period is consumed. Neither period becomes an untouched holdout through this review. GBP onboarding and macro work remain parked; Layer 1 stays independent and backtesting downstream-only.

## Measurement rules

| Field / concern | Contract and current implementation |
| --- | --- |
| Identity | Nonempty string prediction ID, exact `XAUUSD`, and one of BULLISH, BEARISH, BULLISH_LEAN, BEARISH_LEAN, NO_CLEAR_BIAS. Batch evaluation rejects every occurrence of a duplicate ID; repeated snapshot IDs are retained as dependent calls. |
| Decision and publication | Generic `call_time` is the supplied decision cutoff; there is no separately enforced publication field. Stored-call preparation substitutes normalized `created_at`, retaining original storage timestamp and `run_time_et`. Do not infer a timezone or publication time from `run_time_et`. |
| Precision | Generic timestamps require a real calendar date, seconds, an explicit Z/offset and at most three fractional digits. Storage parsing accepts up to nine digits, compares snapshot/output order using integer nanoseconds, then rounds availability upward to milliseconds. See G2 for the entry consequence. |
| Feature cutoff | Nonempty, uniquely named scalar features; each `available_at <= inputs_available_at <= call_time`. Nonempty or malformed upstream rejection lists prevent evaluation. Direct evaluation does not enforce feature source, observation age, F1-F10 completeness, or derivation of direction from features. Those are adapter/lineage responsibilities. |
| Versioned source selection | As-of selection uses the explicit input cutoff, defaulting to decision time. Select greatest `observed_at` available by that cutoff, then greatest `available_at` for that observation. Equal winning observation/availability pairs are ambiguous even if values agree. Maximum age is decision minus observation time; equality is accepted. Required missing/stale records and all ambiguous records reject the call; optional missing/stale records remain absent. Invalid source records abort the build. |
| Selected lineage | As-of features retain name, value, observed/available times and source, but not arbitrary source-record identifiers. It records `feature_selection_cutoff`, sets aggregate availability to the latest selected availability, and preserves upstream rejections. It selects features, not predictions. |
| At-call entry | Default entry is exactly `call_time`; no interpolation from a containing candle. |
| Delayed entry | Requires explicit `entry_time`, `next_interval_open_after_call`, and positive integer maximum delay. Entry equals `(floor(call_time / interval) + 1) * interval`, anchored to UTC epoch. An exact boundary therefore advances one interval. Features remain cut off at the decision, not entry. |
| Horizon | Generic evaluator accepts an explicit end after call and entry; it does not enforce 24 hours. Stored adapter uses next normalized minute entry plus protocol `horizon_ms`, a positive whole-minute duration. September protocol is 24 elapsed hours from entry, not decision, next weekday or session close. |
| Prices | Positive finite OHLC, including numeric strings; consistent OHLC bounds, exact interval duration, one nonempty source string and one explicit bid/ask/mid basis. Source strings are labels, not feed authentication. OANDA adapter requires XAU_USD M1, selects a basis, and emits completed rows only. Completion enforcement differs for direct datasets: G1. |
| Coverage | Default `contiguous` requires exact entry-open and horizon-close and no interior gap, duplicate or overlap. `exact_endpoints` permits interior gaps but still validates supplied overlapping-window candles and both boundaries; it reports missing duration and gap count. It is descriptive only. |
| Sessions and DST | No holiday/session calendar, gap interpolation or closure exemption exists. UTC elapsed time governs duration across offset/DST changes. Weekend/maintenance gaps reject strict coverage and remain unclassified in endpoint mode. Synthetic weekend candles test policy, not actual opening hours. |
| Outside-window data | Prices/basis/completion outside the window are ignored. Invalid market or timestamp metadata anywhere in the supplied archive rejects calls, including via the indexed fallback. This is existing archive-validation precedence, not a guarantee that all outside-window corruption is ignored. |
| Outcome | `100 * (close - open) / open`, using JavaScript numeric arithmetic. Above positive threshold is BULLISH; below negative threshold is BEARISH; equality and the interior band are FLAT. Threshold is explicitly supplied in percentage points. No tolerance/rounding rule is added here. |
| Scoring | Lean directions normalize to their sign. Valid NO_CLEAR_BIAS yields NO_CALL even on a flat move. Otherwise flat yields FLAT, matching direction CORRECT, opposing direction WRONG. All input/path checks precede no-call scoring: an invalid no-call is NOT_EVALUABLE. |

## Source-to-report trace

There are two alternative input paths, not a single stored-export-to-as-of pipeline:

1. `export_gold_stored_calls.js` reads GOLD outputs in ordered 500-row pages with a captured creation-time ceiling, then linked snapshots in ID batches. It does not claim transactional or immutable export consistency. `prepareGoldStoredCalls` checks Layer 1, exactly one linked snapshot, nanosecond storage ordering and F1-F10 stored signals. Each output remains a call, carrying input issues; export audit counts repeated snapshot groups. Bundle bytes are hashed into the audit and prepared dataset.
2. `build_gold_asof_dataset.js` reads a supplied versioned feature history and calls. Its library selects sources under the rules above. It neither authenticates release times nor replays the direction. CLI hashes the input bytes; selected records retain limited provenance. The protocol envelope is lost at this transition (G3).
3. `download_gold_timestamped_candles.js` takes a minute-mid dataset, caps acquisition at the last complete minute as of download start, and requests bounded windows. Raw response files and their hashes stay in the ignored acquisition directory. Identical page-boundary candles are deduplicated; conflicting revisions abort. Incomplete candles are excluded and counted. The manifest hashes the input and resulting dataset; missing future horizons remain missing.
4. `buildGoldTimestampedReport` returns one row per supplied call, in input order, with one primary rejection reason. Duplicate-ID rejection overrides other row reasons. `evaluate_gold_timestamped.js` adds the exact dataset byte hash. Report rows omit features and original snapshot/storage lineage, so the hashed dataset must accompany the report. CLI hashes establish captured bytes, not timestamp truth.
5. `build_gold_stored_call_pilot.js` separately evaluates strict and endpoint coverage and hashes the dataset and analysis protocol. Its factor and cohort diagnostics use endpoint results. Earliest-per-snapshot selection precedes outcome filtering; rejected selections are not replaced. The top-level summary uses string timestamp ordering/input-order ties, while diagnostics use parsed time/ID ties: equality of these subsets is not guaranteed for tied or non-normalized generic inputs. Stored adapter timestamps are normalized.
6. `gold_chronological_factors.js` partitions evaluable rows: horizon end at/before split is training; decision at/after split plus embargo is validation; crossings and invalid outcomes are excluded. F1-F10 neutral/missing votes have separate coverage; each of 45 pairs reports descriptive agreement/correlation. Factor samples may include overall NO_CALLs because factor directions are a different question. Within-partition dependence remains.

## Denominators and preservation

For a completed evaluator batch, input calls = rows = sum(result counts) = sum(primary reason counts). Evaluable calls = CORRECT + WRONG + FLAT + NO_CALL. Rejections = NOT_EVALUABLE. Primary reasons are not all underlying input issues; retain adapter issue lists and audit counts. A malformed dataset/feature record can abort before a report exists and must be logged as a build failure, not silently counted as zero calls.

Pilot directional accuracy is CORRECT / (CORRECT + WRONG); flats, no-calls and rejected rows are excluded. Constant-direction baselines use that same scored subset. Chronological source calls = training + validation + excluded. Snapshot/nonoverlap subsets require their own denominators and do not establish independent trials.

The preserved pilot reconciles 154 = 97 endpoint evaluable + 57 rejected; 97 = 45 correct + 37 wrong + 13 flat + 2 no-call. Strict coverage has 0 evaluable and 154 rejected. These are existing descriptive observations, not fresh validation results.

Preserve raw acquisitions under ignored `backtester/tmp/` or `tmp/`, and retain source hashes when producing a new report. Frozen artifacts must not be regenerated in place. The generic evaluation/as-of CLIs guard against overwriting their source path but allow replacement of an existing report; use a new output path. Stored acquisition/pilot commands require new destinations.

## Demonstrated gaps and repair order

| ID / priority | Reproduction and impact | Bounded next repair |
| --- | --- | --- |
| G1 / first | Direct candles with missing `complete`, null, zero or string `false` all score; only literal false rejects. Unknown completion can therefore be called a complete observed path. OANDA normalization already requires a boolean and emits only true, so this does not demonstrate a September OANDA result error. | Define/version explicit completion requirements for direct datasets and update synthetic fixtures; reject unknown completion before scoring. |
| G2 / second | Raw storage `13:59:59.999999Z` becomes call `14:00:00.000Z`, then entry `14:01:00Z`; the next boundary after raw storage is `14:00:00Z`. Horizon shifts too. This follows the documented normalization order but differs from the unqualified protocol label `next_minute_after_storage`. | Choose and version the intended raw versus normalized entry semantics, with boundary/delay assertions. Do not silently retime the frozen pilot. Actual pilot incidence has not been measured in this review. |
| G3 / third | An input protocol passed through `buildGoldAsOfDataset` becomes absent; the resulting evaluator report emits `protocol: null`. Input-byte hashing permits recovery but the report loses its supplied protocol identity. | Preserve the protocol envelope through as-of selection with a source-to-report regression. Stored-call path bypasses this builder. |

The six tests in `backtester/tests/gold_contract_review.test.js` include three explicitly labelled characterizations of these gaps. Passing characterizations demonstrate current behavior, not repaired correctness. Replace their expectations when implementing repairs. Additional reporting follow-up: unify earliest-snapshot selection and carry stable selected IDs/provenance through reports. No claim is made here that the pilot's two earliest-snapshot summaries disagree.

## Independent examples and validation

Hand-calculated synthetic examples use open 100: close 101 is +1%, close 99 is -1%, and closes 100.5/99.5 sit exactly on a 0.5% inclusive flat band. Bullish/bearish, wrong, flat and no-call labels are asserted. The spring DST jump from 01:00 -05:00 to 03:00 -04:00 is one elapsed hour. A separate weekend example contains a 48-hour missing interior path and must distinguish strict rejection from endpoint disclosure.

The review tests also reconcile a four-call batch with duplicate IDs and a rejected no-call. Existing Gold suites cover late/missing features, revisions, stale/ambiguous records, inherited rejections, microsecond snapshot ordering, mixed feeds, candle gaps/overlaps, and indexed/direct agreement. Together these establish supplied-input behavior, not causal timing or edge.

Reproduce offline from the repository root:

```powershell
node --test backtester/tests/gold_contract_review.test.js
npm test
```

Review tests: 6 passed. Full-suite result and local log are recorded in the current session notes. No acquisition, warehouse mutation or live workflow execution is needed for these checks.

## Separate history-repair gate

`backtester/drafts/gold_collector_history_query_patch.json` remains unapplied. Isolated n8n validation must verify descending ordering, pagination beyond a page, strict prior-date cutoff/no future rows, duplicate-date handling, and output shape compatibility with the Gold agent. It needs an isolated trigger/destination and recorded export/version evidence; active TEST orchestration is not automatically an isolated sandbox. Deployment and a fresh source-quality collection baseline follow as separate milestones. Passing local replay cannot satisfy this gate or repair authentic publication/release timing, complete paths, or MT5 execution evidence.
