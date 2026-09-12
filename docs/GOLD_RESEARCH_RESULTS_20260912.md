# Gold research results — September 12, 2026

## Result

The offline research pipeline is implemented and has run on newly acquired data. A reliable greater-than-60% Gold forecasting formula is **not established**. No live Layer 1 or Layer 2 formula has been changed.

| Evidence path | Training | Validation / descriptive result | Interpretation |
| --- | --- | --- | --- |
| 164 actual stored Gold calls, minute endpoints | Existing pilot period | 46 correct / 86 non-flat directional calls = 53.49%; 16 flat, 2 no-call, 60 not evaluable | Stored-time proxy, repeated calls, no untouched test |
| Earliest-day/nonoverlapping subset of stored calls | 8/14 = 57.14% | 4/8 = 50% | Very small, descriptive sample |
| Training-selected macro pair, reconstructed fixed schedule | 44/58 = 75.86% | 15/28 = 53.57% | Training strength did not reproduce above 60% |

The selected macro candidate is bullish when VIX one-observation percent change is at/below the training median (-0.5579665220%) and VIX five-observation percent change is above its training median (-0.1602564103%). It was selected by training accuracy only among candidates with at least 50 directional training observations. The 50-observation floor is a reporting rule, not proof of adequate power. It matched 33 of 143 evaluable validation decisions, including five flats; its accuracy including flats was 45.45%. This is a selective cohort, not a daily formula qualified at every decision.

The constant bullish baseline over all 121 non-flat validation observations was 61/121 = 50.41%. Looking across 800 candidates after their validation results are exposed does not create a new untouched holdout. Failed candidates remain in the full report.

## Acquired data and lineage

- Stored calls: 164 outputs over 83 storage dates, 154 linked snapshots and nine repeated-snapshot groups.
- Matching minute-price archive: 82,703 completed OANDA M1 candles in 43 requests.
- Broader price archive: 15,977 completed OANDA H1 candles in 11 requests, January 2024–September 2026. Raw mid/bid/ask responses are retained; research uses midpoint endpoints.
- Macro archive: FRED real-time vintage rows for DFII10, DGS2, DGS10, DTWEXBGS and VIXCLS. DTWEXBGS has 1,217 rows, including historical revisions; each other series has 704 rows. Original response bytes and request parameters are hashed.
- Macro dataset: 681 weekday observations at 14:00 UTC from February 1, 2024 to September 10, 2026. One observation has unavailable/stale required macro inputs. Outcome evaluation leaves 390 training and 143 validation observations, with 148 source exclusions reconciled.
- Event archive: 841 US high-impact records in 33 monthly requests from the already connected calendar provider. This is a current historical archive, not an authenticated original-release archive.

Macro selection uses the newest eligible vintage for each observation date. Availability is conservatively modelled as vintage date plus 36 hours; this does not establish exact historical intraday publication. Derived 1/5/20 changes use valid observations, not elapsed calendar days. Withdrawn values do not resurrect an older vintage of the same observation.

DTWEXBGS is the [Federal Reserve nominal broad dollar index](https://fred.stlouisfed.org/series/DTWEXBGS), not ICE DXY. [FRED real-time periods](https://fred.stlouisfed.org/docs/api/fred/realtime_period.html) and [observation vintage parameters](https://fred.stlouisfed.org/docs/api/fred/series_observations.html) support historical versions; their date resolution must remain explicit.

## Event evidence wall

The existing warehouse contains only 96 historical events from January 2024, with null revision status. The legacy Forex Factory API returns HTTP 403, “You are not subscribed to this API.” The already connected economic-calendar API successfully supplied the broader archive, so a subscription change was not needed for current historical records.

However, its `lastUpdated` timestamps place most current versions after the historical decision. Across 681 scheduled decisions:

- 10 have at least one recent event version with update time no later than the decision;
- 477 have recent releases but only later/unknown versions;
- 194 have no release in the declared 72-hour recent-event window.

Simultaneous event families retain separate surprise states. Actual and consensus levels are never pooled across incompatible event units. Pre-release consensus vintages are not verified even for the ten eligible proxy observations. No event-conditioned candidate can be trained under the current pre-2026 partition because eligible event features are absent there. Missing or revised data is not replaced with a neutral signal.

To qualify event-conditioned combinations, an original-release and pre-release-consensus archive is needed. The connected API's current snapshots cannot supply that evidence merely by relabelling release timestamps. A new untouched final evaluation period and actual timestamped Layer 2 output evidence also remain necessary.

## Path and model limits

Strict continuous coverage rejects all stored-call windows; 104 have interior gaps, with other rows missing entry/end boundaries or the entire window. OANDA [publishes restricted Gold trading hours](https://www.oanda.com/au-en/trading/hours-of-operation/), but current region-specific hours are not proof of the historical account calendar. No gaps are silently filled or reclassified as validated closures. Endpoint diagnostics still measure exact 24-hour boundary prices where available.

Reconstructed macro observations use NO_CLEAR_BIAS as a placeholder to evaluate market outcomes independently of a production prediction. They are explicitly labelled as research observations, not fabricated historical agent calls. Directional accuracy remains separate from executable trade win rate and net expectancy.

## Reproduction

The offline bundle command reuses authenticated acquisition manifests and checks source hashes:

```powershell
node backtester/scripts/run_gold_research_bundle.js backtester/tmp/gold-fred-vintages-20260912 backtester/tmp/gold-hourly-history-20260912 backtester/tmp/gold-calendar-archive-20260912-c backtester/tmp/NEW_GOLD_RESEARCH_BUNDLE
```

The new directory contains dataset.json, snapshots.json, event-dataset.json, experiments.json and REPORT.md. Existing destinations are refused. All source and generated data stay ignored. Completed run: `backtester/tmp/gold-research-bundle-20260912/`.

Regression tests cover revised values, withdrawn observations, future event updates, simultaneous event families, validation-price isolation from training, and source selection before outcome filtering. Local suite excludes warehouse-writing integration tests.

Final validation: `npm.cmd test` passed 324/324 with zero failures, skipped tests or cancellations. The real-data offline bundle ran successfully using checked acquisition hashes. Test success establishes software behavior, not predictive qualification.
