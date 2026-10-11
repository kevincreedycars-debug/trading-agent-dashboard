# Master USD 24h Ruleset v1.0
Date: 11 October 2026
Status: proposed implementation specification, shadow use first
Owner: central project coordinator
Scope: USD Layer 1, with a shared output/data contract for eight Layer 1 engines

## 1. Decision and information boundary

Answer: “Using only information available at cutoff t, what directional bias is supported for the chosen USD target from t to t+24 hours?”

Use DXY spot/index as the proposed USD target because it is already in the existing input contract. The coordinator must verify the project's actual outcome series and provider before adopting this target. Preserve the current run schedule during the repair; do not invent a new cutoff. A forecast must carry exact UTC cutoff and endpoint. Daily means one designated evaluation cutoff per trading day; additional intraday runs are separately labelled.

Return directional evidence and data quality. Return a success probability only when a versioned out-of-sample calibration model supports it. No entries, stops, sizing, pair calls or trading instructions belong in this Layer 1.

Permitted: this versioned specification, the as-of snapshot, raw foreign rates and relevant raw cross-asset observations, and explicitly supplied as-of news evidence. Forbidden: other engines' verdicts/confidence, Layer 2 results, downstream trade decisions and information arriving after cutoff. Shared raw data does not break isolation; copying other agents' conclusions does.

24h means 24 elapsed hours, not the next daily close. Do not replace a closed-market endpoint with Monday or the next close silently. For this candidate, skip forecast issuance when the calendar says an executable target quote is unavailable at the start or planned endpoint. Record SKIPPED_MARKET_CLOSED. If the project needs Friday-to-Monday forecasts, create a separate horizon/profile and evaluate it separately. Session maintenance breaks also need the actual instrument calendar.

## 2. Three profiles, with separate results

| Profile | Purpose | Behaviour |
| --- | --- | --- |
| legacy_frozen | Preserve the observed system | Exact current implementation, including its existing scores; mark legacy semantics. |
| repair_v1 | Isolate engineering corrections | Canonical semantics, freshness/validation, no-lookback substitution, safe coverage gates, event age enforcement and structured Fed change. Preserve remaining legacy factor mappings for comparison. |
| candidate_v1 | Test conditional economic rules | Use the conditional rules below, retire duplicate VIX votes, and keep unvalidated event persistence as context. |

Do not rewrite legacy rows or fixtures to make the repaired engine appear historically identical. Store old and new predictions with profile/version/snapshot identifiers. Both new profiles remain shadow until source verification, consumer migration and validation are complete. This is a deployment staging choice, not a claim that the legacy system is safe.

Changes to non-24h horizons are outside this ruleset. Preserve them under a labelled legacy implementation until each horizon receives its own target, rules and evaluation.

## 3. Single executable authority

Use one pure scoring module for runtime and replay, with parameters in one versioned registry. Render the human rulebook from that registry where feasible. The LLM may not silently replace arithmetic or thresholds.

Every run records:
- snapshot_id, content_hash, cutoff_at_utc, forecast_end_at_utc;
- target_id, provider, instrument/series, starting quote and timestamp;
- ruleset_version, profile_id, parameter_version, engine_commit;
- prompt_version and model_id when used;
- factor results, quality states, grouped evidence, typed risk flags;
- calibration_version or null.

Use a local snapshot copy/reference for reproduction. Avoid scattering different scoring implementations in n8n, browser JS and replay. Export the actual live workflow and hash it; a repository export is not proof of deployment identity.

## 4. Observation and snapshot contract

An observation is:
```json
{
  "field_id": "us_2y_d5_bps",
  "value": 6.0,
  "unit": "bps",
  "source_id": "provider-series-id",
  "observed_at_utc": "2026-10-08T20:00:00Z",
  "published_at_utc": "2026-10-08T20:01:00Z",
  "ingested_at_utc": "2026-10-08T20:02:00Z",
  "lookback": "5_trading_days",
  "revision_id": "initial",
  "quality": "VALID",
  "availability_basis": "recorded_ingestion"
}
```
This is a format example, not current market evidence.

Quality states: VALID, MISSING, STALE, INVALID, FUTURE, INAPPLICABLE. Factor results separately carry direction -1, 0 or +1. VALID and direction 0 means valid neutral evidence. MISSING and direction 0 means unavailable evidence. INAPPLICABLE is an explicitly satisfied regime condition in which the feature should not vote, not a synonym for missing data.

Reject non-finite numbers, unparseable timestamps, unexpected units, future observations, inconsistent spread identities, unexpected revision semantics and contradictory provider identifiers. Never coerce null/empty text to numerical zero. Accept genuine negative yields and genuine zero changes.

For live replay, all used values must be known by cutoff, including ingestion time where available. For historical reconstruction lacking ingestion logs, use documented publication availability plus a conservative latency rule; label the replay reconstructed rather than fully live-faithful.

Choose the latest run snapshot at/before cutoff, then assess its fields. Do not fall back to an arbitrarily older complete row. Allow backward as-of joining of individual series only under their declared freshness rules and record their ages. Exclude any observation that arrived later, even if its economic reference date is earlier.

### Freshness policies

Every field must have a source-specific policy: continuous quote, scheduled daily publication, event release, weekly report or slow context. Unknown freshness policy means the field is unavailable for a directional vote.

Initial operational ceilings for continuous providers, subject to provider verification:
- Target quote: 5 minutes while open.
- VIX/Nasdaq/gold live quotes: 15 minutes while their source markets are open.
- Live yields/OIS/path estimates: 60 minutes while expected updates are available.
- Direct economic-event vote in repair_v1: maximum 72 elapsed hours, measured from release time, including exact boundary.
- Fed communication classification: source evidence no older than 24h, and a supplied comparable pre-change baseline.
These are provisional operational settings, not research-proven forecast decay constants.

Scheduled daily/weekly sources are valid only when they are the latest release available by cutoff and within their expected publishing cycle. Record observation age as well as release age. A Tuesday COT reference date does not make the data available before its actual publication. Closed-source observations must be explicitly tagged with session state; never reset their clock by copying them into a new snapshot.

A macro event remains archived context after its voting TTL expires. Slow context has a declared release-cycle policy; never give it a universal live-quote TTL.

No 1d value may populate a 5d field. No 5d value may populate a 20d field. If a substitute feature is permitted, give it a different feature ID and parameter profile.

## 5. Input priorities and transformations

| Family | Minimum observations | Transformations |
| --- | --- | --- |
| Target/momentum | DXY level, 1d/5d returns, quote timestamps | Percent return = 100*(P_t/P_previous-1); bars fully complete by cutoff. |
| Nominal rates | US 2Y, German 2Y, matched 5d changes | Spread bps = 100*(US percent yield - German percent yield); match quote timing and tenor. |
| Real yields | Defined US 10Y real-yield series, 5d change | Separate real-yield source/instrument; do not mix a TIPS yield with an undisclosed proxy. |
| Policy repricing | US and comparable foreign OIS/path estimates at t and prior comparison time | Change in expected policy rate/path, in bps; keep horizon/tenor fixed. |
| Events | Array of release records, components/revisions, pre-release consensus | Signed surprises using a series-specific interpretation; standardise only with historical training data. |
| Risk | VIX level/change, credit spreads if supplied, as-of shock evidence | Regime classification; VIX is uncertainty information, not a universal USD sign. |
| Growth context | US and foreign growth/inflation/surprise trends, release dates | Relative context with uncertainty and explicit source-cycle freshness. |
| Cross-assets | Gold/Nasdaq returns with exact lookbacks | Conditional confirmation only under a registered sign rule. |
| Calendar | As-of events scheduled in (t, t+24h], target/source market calendars | Known catalyst times; unknown future actual values stay null. |
| Optional | Options, COT, funding/basis, hedging/flow evidence | Each gets instrument definitions and availability policy before use. |

Current input names are mapped in the earlier review. New canonical names should be introduced through an adapter, not silently substituted into existing fields.

## 6. Economic-event contract and rules

Event record:
- event_id, release_id, series_id, currency/country;
- released_at, actual_published_at, consensus_captured_at, ingestion time;
- actual, pre-release consensus, prior initial reading, newly released revision;
- unit, importance, signed_surprise, standardisation_version;
- components and evidence_refs;
- optional upstream usd_signal, retained for audit only.

Require consensus known before release, actual known by cutoff and compatible units. Reject an upstream usd_signal as sole authoritative evidence. Compute surprise deterministically from actual-consensus. Apply an explicit series-specific sign convention: higher payrolls and higher unemployment cannot share a blanket “higher is bullish” rule.

Do not sum unrelated raw surprises in incompatible units. Aggregate using a registered weighting/normalisation policy or mark CONFLICTING_EVENTS and keep context. Avoid counting payroll headline, wages and unemployment as three independent releases without their shared release_id.

repair_v1:
- Only source-verified events within 72h can vote.
- Use a versioned interpretation rule, not a raw categorical payload.
- If no validated event is present because none was released, the event factor is VALID neutral.
- If a release was expected but the collector did not retrieve it, the factor is MISSING, not neutral.
- If multiple releases conflict, score neutral unless the registry resolves the aggregation.

candidate_v1:
- A released surprise is context by default.
- It receives a separate directional vote only if an active rule has evidence of additional returns after the forecast cutoff for its event type, age and regime.
- Market reaction measured before cutoff may support rates or momentum factors, but does not prove further continuation.
- No unreleased event actual is predicted or imputed.

This distinction is deliberate. Fast event-driven adjustment and a forward 24h edge are different claims [R2].

## 7. Policy and shock classification

Policy state and policy change are separate:
- policy_state: hawkish/dovish/neutral/unknown, descriptive context.
- policy_change: more_hawkish/more_dovish/unchanged/unknown, derived from comparable observations.
- market_path_change_bps: measured repricing at a fixed horizon.
- relative_path_change_bps: US repricing minus comparable foreign repricing.

A static hawkish label never supplies a fresh bullish vote. Preferred F8 evidence is comparable market-path repricing. A source-linked communication change may be used in repair_v1 only when a prior comparable baseline is supplied and the structured interpretation is reproducible. candidate_v1 communication-only direction requires an active tested rule.

Use states GLOBAL_RISK_AVERSION, US_SPECIFIC_STRESS, US_RELATIVE_GROWTH_STRENGTH, BROAD_RISK_ON, MIXED, UNKNOWN. Each state requires explicit evidence IDs and an active definition. The LLM cannot manufacture a regime because a category sounds plausible.

A critical regime conflict occurs when registered core policy, relative rates or real-yield evidence opposes another registered core driver, or verified US-specific stress contradicts an automatic dollar-safe-haven interpretation. Record both sides. Candidate rules may neutralise a affected factor; do not overwrite contradictory evidence into agreement.

## 8. Conditional factor rules for candidate_v1

Original 24h allocations are retained as provisional budgets to isolate rule changes: F1=10, F2=14, F3=10, F4=10, F5=14, F6=4, F7=24, F8=12, F9=1, F10=1; sum 100. They are inherited engineering comparison parameters, not optimal research-derived weights. Disabled/context slots retain their budget in the fixed denominator; do not redistribute it merely because data is missing.

| Factor | Candidate rule | Uncertainty / exception |
| --- | --- | --- |
| F1 risk, 10 | Global stress can support bullish USD; use VIX plus independent shock/risk evidence under a registered regime rule. | VIX>25 alone does not qualify. US-specific stress does not automatically score bullish; low VIX alone does not score bearish. |
| F2 US 2Y, 14 | A material increase/decrease in comparable 5d yields supports +/- direction when a registered policy/growth mechanism fits. Initial magnitude band remains +/-5 bps. | Nominal yield increases due to fiscal/liquidity stress need separate interpretation; unknown mechanism => neutral/context. |
| F3 US-DE spread, 10 | Widening/narrowing >=5 bps supports +/- direction, using synchronised 5d observations. | A relative expected-policy measure is a separate registered feature, not a silent replacement. US stress may invalidate a simple positive mapping. |
| F4 real yield, 10 | +/-5 bps real-yield change can support +/- direction under a registered regime rule. | Real-yield measure/liquidity ambiguity => unavailable; test incremental value beyond F2/F3. |
| F5 DXY momentum, 14 | 1d return >=+0.15% or <=-0.15% supports +/- direction as a tested baseline hypothesis. | Fixed cutoffs are inherited. Momentum is past price information, not independent proof of macro causation. |
| F6 gold, 4 | A registered conditional relation may use gold 5d return below -0.10% for USD bullish or above +0.10% for bearish. | Until such a relation is registered, keep as context; USD and gold can rise together. No 1d fallback. |
| F7 event, 24 | Only active post-cutoff persistence rules may supply direct votes. | Default context; freshness is necessary but not proof of predictive value. |
| F8 policy repricing, 12 | Direction from change in relative expected policy path beyond a configured materiality threshold. | Threshold must be configured from training/measurement resolution; null means context only. Unchanged hawkish state => neutral. |
| F9 Dollar Smile, 1 | Regime selector/context, zero additive vote in candidate_v1. | Do not repeat F1. Growth evidence informs other factor applicability without an extra identical vote. |
| F10 equities, 1 | Registered risk-regime relation can supply conditional confirmation. | Nasdaq up alone does not imply USD down. Until tested and registered, context only. |

Every conditional rule has rule_id, evidence basis, hypothesis_version, applicability predicate, sign mapping and activation status. Research hypotheses can be activated explicitly in a shadow parameter set; production activation requires the evaluation and migration steps below. No registered rule means neutral/context. No input evidence means MISSING. These must be distinguishable in diagnostics.

## 9. Evidence dependency handling

Family IDs: MONETARY_MACRO(F2,F3,F4,F7,F8); RISK(F1,F9,F10); MOMENTUM(F5); CROSS_ASSET(F6).

Assign dependency IDs only from verified source-event links or explicitly recorded observations, not because signals share a sign. Price/rates correlations are not proof of causation. Unknown lineage carries a DEPENDENCY_UNRESOLVED flag.

For repair_v1, report family contributions and shared release/observation lineage while preserving factor addition. A high raw score remains a heuristic with explicit overlap risk.

For candidate_v1:
- F9 never repeats VIX as an additive vote.
- F7 direct persistence is off unless enabled by a registered rule.
- For factors in the same family and verified dependency cluster, count one cluster:
  cluster_score = sum(w_i*s_i) / sum(w_i)
  cluster_budget = max(w_i)
  signed contribution = cluster_budget*cluster_score.
- For unlinked singleton factors, signed contribution = w_i*s_i.
- Cluster effective directional budget = cluster_budget * sum(w_i*abs(s_i))/sum(w_i).
- Emit unused overlap budget separately; keep the overall denominator 100.
- Same-event evidence spanning different families is flagged; it is not treated as independently confirming without a registered rule. Such an unresolved cross-family dependency blocks a full call in this candidate.

This cluster method is a proposed dependency-control experiment, not a statistically proven covariance estimator. Evaluate it against simple addition and learned regularised models. Missing evidence stays zero and does not expand the remaining budget.

## 10. Deterministic scores and direction

Let W=100 fixed allocated weight. In repair_v1 use factor contributions. In candidate_v1 use cluster contributions from section 9.

For each contribution c and effective directional budget a:
- B += (a+c)/2
- D += (a-c)/2
For singleton factors c=w*s and a=w*abs(s). For neutral factors c=a=0. Cluster definitions above guarantee |c|<=a.

Define:
- signed_score_points = B-D, range [-100,100].
- directional_participation_pct = 100*(B+D)/W.
- bullish_evidence_share_pct = null if B+D=0, else 100*B/(B+D).
- bearish_evidence_share_pct = complement.
- valid_data_coverage_pct = 100*sum(valid factor data weights)/W.
- overlap_removed_budget_points = sum(original clustered budgets minus effective cluster budgets).
A factor's data counts as valid when all inputs needed to assess its registered rule are valid; it may be neutral or explicitly inapplicable. Missing/stale/FUTURE inputs do not count. Context-only F9 cannot manufacture coverage without its required context. Keep unrounded arithmetic for every decision; round only display fields.

Provisional operational gates, not evidence of optimal predictive cutoffs:
1. No target/start quote, cutoff, horizon definition, or market-calendar validity => status INSUFFICIENT_DATA; direction NO_CLEAR_BIAS.
2. Coverage <50% => INSUFFICIENT_DATA; direction NO_CLEAR_BIAS.
3. Score zero, with adequate data => NO_CLEAR_BIAS, not fabricated tiebreaking.
4. Otherwise sign(score) determines direction.
5. Full BULLISH/BEARISH requires coverage >=70%, participation >=50%, |score|>=15 points, at least two distinct evidence families contributing in the winning direction, and no unresolved critical conflict/dependency.
6. If direction exists but any full-call gate fails => BULLISH_LEAN/BEARISH_LEAN.
7. Missing catalyst calendar prevents full-call eligibility; output a lean with CALENDAR_UNAVAILABLE if directional evidence otherwise qualifies.
8. Upcoming events are typed flags/scenarios; do not predict their actuals or deduct arbitrary “probability points”.

Status and direction are separate. With coverage >=50%, use VALID when all configured factor data are valid or explicitly inapplicable, and PARTIAL when some factor data are missing/stale/invalid. A PARTIAL row can qualify for a full direction only if every full-call gate passes. Critical target/horizon failure takes precedence over coverage and yields INSUFFICIENT_DATA; an unavailable start/endpoint due to the instrument calendar yields SKIPPED_MARKET_CLOSED. This preserves the existing five direction strings for adapters while distinguishing insufficient data from balanced evidence.

A full candidate direction is still not a trade recommendation. During shadow mode, trade_eligible=false. After promotion, Layer 2 must explicitly inspect status, profile and comparable output semantics; an exact string alone is insufficient.

## 11. Confidence and output contract

There is no percentage called “probability” without a calibration model. p_up_24h=null until qualified. Evidence share can be 100 with little data and must be displayed beside participation/coverage.

Do not invent a replacement 0-100 confidence formula to imply correctness. Retain legacy heuristic score only under legacy_heuristic_strength_score and legacy_score_model_id. The candidate's numeric strength inputs are score, participation and coverage; use FULL/LEAN/BALANCED/INSUFFICIENT for presentation.

Canonical output example, with illustrative nulls rather than a market forecast:
```json
{
  "schema_version": "layer1-output-v2",
  "asset_id": "USD",
  "profile_id": "candidate_v1",
  "ruleset_version": "usd-24h-v1.0",
  "mode": "SHADOW",
  "snapshot_id": "example-only",
  "cutoff_at_utc": null,
  "forecast_end_at_utc": null,
  "target_id": "DXY_PROVIDER_TO_VERIFY",
  "status": "INSUFFICIENT_DATA",
  "direction_24h": "NO_CLEAR_BIAS",
  "signed_score_points": null,
  "bullish_evidence_share_pct": null,
  "bearish_evidence_share_pct": null,
  "directional_participation_pct": null,
  "valid_data_coverage_pct": null,
  "p_up_24h": null,
  "calibration_version": null,
  "trade_eligible": false,
  "factor_results": [],
  "risk_flags": ["TARGET_CONFIGURATION_UNVERIFIED"],
  "explanation": "Configuration example only."
}
```
Actual outputs require timestamps and provenance; this example is not a valid issued forecast.

Risk flags are typed enum/code records with severity and evidence IDs. Do not calculate strength from warning-string matching. Store factor counts under factor_counts; weights under evidence_weights. Never name both score_bullish.

If backward-compatible conviction_24h is necessary, preserve the old documented legacy quantity and mark it deprecated. Do not silently reuse the field for probability or a different headline. Update consumers to canonical fields before changing legacy behavior. A new numerical field with a new meaning needs a schema/profile version.

## 12. Daily LLM instructions

The LLM receives an immutable data pack, active rule IDs, permitted evidence excerpts and this compact contract. It returns JSON only:
- snapshot_id and cutoff echo;
- regime classification with evidence_refs or UNKNOWN;
- structured policy communication delta with baseline_refs or UNKNOWN;
- interpretation for active conditional factors, including factor_id, rule_id, sign and evidence_refs;
- conflicts, missing context and catalyst scenarios;
- concise explanation;
- no computed weights, conviction or success probabilities.

The deterministic validator verifies schema, evidence existence, timestamps, rule activation and allowed sign. It calculates features and scores once. Store both LLM interpretation and final engine factor result. When they differ, record an explicit validation/override reason. No silently discarded authoritative-looking model verdict.

If the project chooses deterministic-only mode, remove redundant directional classification from the LLM stage and use it only for explanation of already computed factors.

Future event scenarios remain conditional: stronger/weaker than consensus may change policy pricing under a specified regime. They are not forecasts of the unreleased event.

## 13. Validation and release conditions

Required engineering tests:
- no null-to-zero conversions, unit mismatch or future observation acceptance;
- newer incomplete snapshot does not hide an older complete snapshot;
- missing vs valid neutral vs inapplicable remain distinct;
- exact event TTL boundaries, revised data and pre-release consensus timing;
- no 1d/5d fallback substitution;
- unchanged hawkish state produces no policy-change vote;
- one 14-point bullish factor cannot produce a full call or calibrated probability;
- duplicate VIX evidence produces no repeated candidate vote;
- cluster contribution math and unresolved dependency gates;
- typed calendar/market closure handling;
- engine/replay/serialized output parity and consumer-contract tests.

Predictive tests:
- define target and label before fitting;
- time-ordered train/validation/test and purged 24h overlaps;
- compare frozen legacy, repair, candidate, momentum-only, rates-only and a simple regularised model;
- evaluate distinct forecast days, coverage, balanced accuracy, uncertainty and regime breakdown;
- ablate F7, F8, gold, equities, duplication and cluster control;
- prospective shadow runs to check historical LLM hindsight and live collection;
- calibrate actual probabilities with held-out observations; report Brier/log loss and reliability, not hit rate alone.
Pre-register promotion criteria based on project objectives and sample adequacy; do not invent a universal minimum sample or win rate.

A deterministic parity pass proves reproduction. It does not prove edge. Shared infrastructure fixes can be released after their engineering checks; economic candidate promotion additionally needs empirical assessment and an explicit configuration change.

## 14. Evidence registry and open research

| ID | Source checked | Supported point | Not established |
| --- | --- | --- | --- |
| R1 | Federal Reserve, Monetary Policy and Exchange Rates during Global Tightening (2024) | Relative OIS/risk co-movement is relevant; endogenous prices limit causal interpretation. | This agent's 24h weights, thresholds or incremental edge. |
| R2 | Federal Reserve, High-Frequency Effects of US Macroeconomic Releases (2004) | Surprise-related FX mean adjustments are fast in the studied sample. | Universal no-continuation rule or exact event decay TTL. |
| R3 | BIS Bulletin 105 (2025) | Hedging was an important contributor to dollar weakness in April/May 2025. | A daily hedging predictor or universal risk-off sign. |
| R4 | ICE currency-index documentation | DXY's fixed six-currency structure has 57.6% euro exposure. | A broad trade-weighted USD forecast target. |
| R5 | Cboe VIX documentation | VIX measures non-directional expected 30-day SPX volatility. | A deterministic next-day USD rule. |
| R6 | CME FedWatch methodology | Meeting probabilities are derived from futures with assumptions. | USD-direction probabilities; do not equate the two. |
| R7 | CFTC release schedule | Position observations have publication lag. | A fresh daily positioning signal. |

Links:
- R1: https://www.federalreserve.gov/econres/notes/feds-notes/monetary-policy-and-exchange-rates-during-the-global-tightening-20240510.html
- R2: https://www.federalreserve.gov/pubs/ifdp/2004/823/ifdp823.htm
- R3: https://www.bis.org/publications/bulletin-105-us-dollars-slide-april-2025-role-fx-hedging
- R4: https://developer.ice.com/fixed-income-data-services/catalog/ice-data-indices-currency-indices
- R5: https://www.cboe.com/tradable-products/volatility-trading/
- R6: https://www.cmegroup.com/articles/2023/understanding-the-cme-group-fedwatch-tool-methodology.html
- R7: https://www.cftc.gov/MarketReports/CommitmentsofTraders/ReleaseSchedule/index.htm

The next research pass must determine event persistence, policy-path transformations, risk/US-stress sign exceptions, relative growth definitions, gold/equity incremental value, standardisation and dependency handling. Each result needs sample/horizon, counterevidence, availability, candidate measurable rule and validation design. This v1 is a source-grounded implementation proposal, not an exhaustive frontier research synthesis or a tested production strategy.

