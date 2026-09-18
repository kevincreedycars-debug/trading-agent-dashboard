# Gold extended research results - September 18, 2026

## What we can say

We extended Gold research to January 2023, increased usable training observations by 57%, and completed both retrospective and timing-filtered runs. A specific event hypothesis now clears the existing sample floor: lower-than-consensus Initial Jobless Claims followed by a bullish Gold direction. Selected on training alone, it achieved 43/58 directional training outcomes and 12/16 directional validation outcomes. This is a research lead, not a qualified trading signal.

The macro-only winner remains weak in validation at 15/28 (53.57%). Expanding the history changed the eligible event research materially without manufacturing a stronger macro result.

## Delivered

- A precommitted schedule and selection plan, commit a172346, before the expanded search.
- Fresh five-series FRED vintage acquisition, 21,871 hourly Gold candles, and 5,115 calendar records including the December 2022 boundary buffer.
- A hash-verified merger of adjacent nonoverlapping calendar archives, preserving versions and source manifests.
- Both full research bundles, training-selected class winners, 20 macro feature scorecards, annual breakdowns, unique-release counts and reproducible month-block sensitivity diagnostics.
- Old research artifacts and production formulas preserved.

## Coverage comparison

| Measurement | September 17 | Extended run |
| --- | ---: | ---: |
| Scheduled weekday decisions | 681 | 964 |
| Usable training observations | 390 | 613 |
| Usable validation observations | 143 | 143 |
| Excluded decisions | 148 | 208 |
| Retrospective event-bearing usable decisions | 426 | 599 |
| Retrospective event families | 62 | 69 |
| Attempted single/pair conditions | 44,367 | 53,751 |
| Event candidates with at least 50 directional training observations | 1 | 23 |

Twenty-one of those 23 event candidates are pairs; they overlap and are not 23 independent discoveries. The timing-filtered run attempted 1,566 candidates, with 780 eligible and zero eligible event candidates. It retains 35 usable event-bearing decisions. There are five underlying macro series and 20 level/change features, not 20 independent raw inputs or coverage of all 28 target variables.

All 964 decisions reconcile: 613 training + 143 validation + 208 excluded. Exclusions are 196 missing exact horizon candles, seven missing entry candles, four windows without candles and one incomplete macro input. All 756 endpoint-evaluable windows fail strict continuity. No closure, flat band, timestamp or sample-floor rule was relaxed.

## Training-selected findings

| Rule | Training correct/directional | Validation correct/directional | Validation flats | Correct including flats |
| --- | ---: | ---: | ---: | ---: |
| Initial Jobless Claims below consensus; bullish | 43/58 (74.14%) | 12/16 (75.00%) | 5 | 12/21 (57.14%) |
| VIX one-observation change <= -0.5373%, five-observation change > -0.4304%; bullish | 61/83 (73.49%) | 15/28 (53.57%) | 5 | 15/33 (45.45%) |
| Best macro single: VIX one-observation change <= -0.5373%; bullish | 143/221 (64.71%) | 31/64 (48.44%) | 10 | 31/74 (41.89%) |

The claims rule matches 21 of 143 usable validation days (14.69%), or 21 of 180 scheduled validation-period weekdays (11.67%, including excluded days). Its 21 matched validation observations refer to 21 unique releases. Training has 93 matched observations from 89 unique releases, so repeated releases remain a dependence concern. No actual production calls are represented.

Among all 35 validation days with usable claims data, always-bullish scored 16/27 directional outcomes (59.26%). The below-consensus subset scored 12/16; its complement scored 4/11 (36.36%). These are different subsets. Always-bullish on exactly the 21 selected days equals the candidate by construction; the potential benefit is event-conditioned selection, not outperforming a constant direction on identical selected days.

| Year | Claims-rule correct/directional | Flats | Role |
| --- | ---: | ---: | --- |
| 2023 | 13/20 (65.00%) | 15 | Training |
| 2024 | 14/17 (82.35%) | 14 | Training |
| 2025 | 16/21 (76.19%) | 6 | Training |
| 2026 | 12/16 (75.00%) | 5 | Consumed exploratory validation |

The annual figures use the final training-selected rule; they are not independent walk-forward tests. A 2,000-draw paired calendar-month block diagnostic over nine validation months gives a descriptive 95% percentile range of 47.83%-100% for the claims rule's directional accuracy. Its lower endpoint is well below 60%. The matched-minus-feature-usable accuracy difference spans +4.51 to +34.48 percentage points in that conditional diagnostic, but it does not adjust for hypothesis search, historical-vintage uncertainty or repeated validation use. It is not a significance claim. The VIX-pair accuracy range is 33.33%-75.00%; its corresponding difference spans -12.35 to +19.58 points.

## All macro single-variable scorecards

Each feature's condition and direction are selected using training only. Rows are alphabetical, not sorted by validation performance. Changes refer to prior available observations, not guaranteed elapsed calendar days. Broad USD is the trade-weighted FRED index, not ICE DXY.

| Feature | Training-selected condition | Direction | Training accuracy | Validation correct/directional | Validation flats |
| --- | --- | --- | ---: | ---: | ---: |
| broad_usd_index | gt 121.5147 | BULLISH | 61.64% | 0/0 (n/a) | 0 |
| broad_usd_index_change_1_pct | lte -0.0321 | BULLISH | 61.69% | 31/66 (46.97%) | 12 |
| broad_usd_index_change_20_pct | gt -0.1228 | BULLISH | 61.06% | 22/54 (40.74%) | 12 |
| broad_usd_index_change_5_pct | lte -0.0233 | BULLISH | 60.19% | 34/65 (52.31%) | 12 |
| us_10y_real_yield | gt 1.9100 | BULLISH | 60.39% | 44/85 (51.76%) | 16 |
| us_10y_real_yield_change_1_bps | gt 0.0000 | BULLISH | 59.61% | 30/60 (50.00%) | 8 |
| us_10y_real_yield_change_20_bps | lte 1.0000 | BULLISH | 61.19% | 25/47 (53.19%) | 10 |
| us_10y_real_yield_change_5_bps | lte 0.0000 | BULLISH | 60.96% | 34/62 (54.84%) | 10 |
| us_10y_yield | gt 4.2000 | BULLISH | 60.85% | 50/97 (51.55%) | 18 |
| us_10y_yield_change_1_bps | gt 0.0000 | BULLISH | 59.50% | 32/64 (50.00%) | 7 |
| us_10y_yield_change_20_bps | lte 0.0000 | BULLISH | 60.19% | 12/36 (33.33%) | 4 |
| us_10y_yield_change_5_bps | lte 1.0000 | BULLISH | 60.99% | 29/54 (53.70%) | 10 |
| us_2y_yield | gt 4.2400 | BULLISH | 60.29% | 9/16 (56.25%) | 1 |
| us_2y_yield_change_1_bps | gt 0.0000 | BULLISH | 61.03% | 30/58 (51.72%) | 9 |
| us_2y_yield_change_20_bps | lte -3.0000 | BULLISH | 60.55% | 11/26 (42.31%) | 4 |
| us_2y_yield_change_5_bps | lte 1.0000 | BULLISH | 60.83% | 33/56 (58.93%) | 7 |
| vix_level | lte 16.3700 | BULLISH | 60.87% | 25/39 (64.10%) | 6 |
| vix_level_change_1_pct | lte -0.5373 | BULLISH | 64.71% | 31/64 (48.44%) | 10 |
| vix_level_change_20_pct | gt -1.5798 | BULLISH | 60.29% | 34/68 (50.00%) | 11 |
| vix_level_change_5_pct | gt -0.4304 | BULLISH | 62.26% | 33/64 (51.56%) | 12 |

The VIX-level row exceeds 60% as a point estimate, but it was not the best training-selected macro single. It must not replace that winner based on validation inspection. The selected broad-USD-level condition never matches validation, exposing a regime/coverage limitation rather than a zero-accuracy result.

## All eligible event candidates

Ordered by training accuracy, then training sample size and candidate ID. Full failed and ineligible hypotheses remain in experiments.json; this table is not the full search denominator.

| Candidate | Conditions | Training correct/directional | Validation correct/directional | Validation flats |
| --- | --- | ---: | ---: | ---: |
| candidate-197 | Initial Jobless Claims eq below_consensus | 43/58 | 12/16 | 5 |
| candidate-44791 | event_9c689bbf-af2a-4f65-81a8-c5f5e2b78d70_age_hours lte 1.5000 AND Initial Jobless Claims eq below_consensus | 39/54 | 12/16 | 5 |
| candidate-44916 | event_9c689bbf-af2a-4f65-81a8-c5f5e2b78d70_age_hours lte 1.5000 AND vix_level lte 16.3700 | 38/54 | 5/8 | 2 |
| candidate-520 | broad_usd_index gt 121.5147 AND event_9c689bbf-af2a-4f65-81a8-c5f5e2b78d70_age_hours lte 1.5000 | 37/53 | 0/0 | 0 |
| candidate-44918 | event_9c689bbf-af2a-4f65-81a8-c5f5e2b78d70_age_hours lte 1.5000 AND vix_level_change_1_pct lte -0.5373 | 38/55 | 10/16 | 5 |
| candidate-44903 | event_9c689bbf-af2a-4f65-81a8-c5f5e2b78d70_age_hours lte 1.5000 AND us_10y_yield_change_20_bps gt 0.0000 | 34/51 | 12/18 | 6 |
| candidate-194 | event_9c689bbf-af2a-4f65-81a8-c5f5e2b78d70_age_hours lte 1.5000 | 66/100 | 16/27 | 8 |
| candidate-2778 | broad_usd_index_change_5_pct lte -0.0233 AND event_9c689bbf-af2a-4f65-81a8-c5f5e2b78d70_age_hours lte 1.5000 | 36/55 | 8/15 | 5 |
| candidate-44912 | event_9c689bbf-af2a-4f65-81a8-c5f5e2b78d70_age_hours lte 1.5000 AND us_2y_yield_change_20_bps lte -3.0000 | 34/52 | 5/7 | 1 |
| candidate-44896 | event_9c689bbf-af2a-4f65-81a8-c5f5e2b78d70_age_hours lte 1.5000 AND us_10y_real_yield_change_20_bps lte 1.0000 | 35/54 | 6/10 | 3 |
| candidate-44899 | event_9c689bbf-af2a-4f65-81a8-c5f5e2b78d70_age_hours lte 1.5000 AND us_10y_yield gt 4.2000 | 35/54 | 13/21 | 6 |
| candidate-44914 | event_9c689bbf-af2a-4f65-81a8-c5f5e2b78d70_age_hours lte 1.5000 AND us_2y_yield_change_5_bps lte 1.0000 | 35/54 | 8/12 | 1 |
| candidate-1494 | broad_usd_index_change_1_pct lte -0.0321 AND event_9c689bbf-af2a-4f65-81a8-c5f5e2b78d70_age_hours lte 1.5000 | 33/51 | 8/16 | 4 |
| candidate-44898 | event_9c689bbf-af2a-4f65-81a8-c5f5e2b78d70_age_hours lte 1.5000 AND us_10y_real_yield_change_5_bps lte 0.0000 | 38/59 | 10/15 | 2 |
| candidate-44910 | event_9c689bbf-af2a-4f65-81a8-c5f5e2b78d70_age_hours lte 1.5000 AND us_2y_yield_change_1_bps lte 0.0000 | 38/60 | 9/14 | 6 |
| candidate-44908 | event_9c689bbf-af2a-4f65-81a8-c5f5e2b78d70_age_hours lte 1.5000 AND us_2y_yield lte 4.2400 | 32/51 | 14/23 | 8 |
| candidate-44891 | event_9c689bbf-af2a-4f65-81a8-c5f5e2b78d70_age_hours lte 1.5000 AND us_10y_real_yield gt 1.9100 | 32/52 | 12/19 | 6 |
| candidate-44906 | event_9c689bbf-af2a-4f65-81a8-c5f5e2b78d70_age_hours lte 1.5000 AND us_10y_yield_change_5_bps lte 1.0000 | 35/57 | 7/12 | 1 |
| candidate-44922 | event_9c689bbf-af2a-4f65-81a8-c5f5e2b78d70_age_hours lte 1.5000 AND vix_level_change_5_pct lte -0.4304 | 32/54 | 6/10 | 5 |
| candidate-44920 | event_9c689bbf-af2a-4f65-81a8-c5f5e2b78d70_age_hours lte 1.5000 AND vix_level_change_20_pct lte -1.5798 | 33/56 | 8/12 | 6 |
| candidate-2138 | broad_usd_index_change_20_pct lte -0.1228 AND event_9c689bbf-af2a-4f65-81a8-c5f5e2b78d70_age_hours lte 1.5000 | 34/59 | 10/15 | 4 |
| candidate-44894 | event_9c689bbf-af2a-4f65-81a8-c5f5e2b78d70_age_hours lte 1.5000 AND us_10y_real_yield_change_1_bps lte 0.0000 | 32/56 | 9/15 | 5 |
| candidate-44902 | event_9c689bbf-af2a-4f65-81a8-c5f5e2b78d70_age_hours lte 1.5000 AND us_10y_yield_change_1_bps lte 0.0000 | 33/59 | 8/12 | 6 |

## Integrity and limits

The schedule is weekdays 14:00 UTC, January 2, 2023 to September 10, 2026. Split stays January 1, 2026 with a 24-hour embargo; the 0.3% flat band and minimum 50 directional training samples are unchanged. Additional observations include January 2024 as well as 2023. The 2026 validation interval was already inspected and remains consumed.

A semantic comparison of the 533 observations shared with the September 17 bundle found unchanged returns and unchanged validation feature values. Two early training rows gain previously missing 20-observation lookbacks because source history now starts earlier. Fresh provider acquisitions are versioned separately.

Current archive actual/consensus values are not authenticated as originally available. FRED uses the existing conservative vintage-date-plus-36-hour proxy. Session gaps are unclassified. There is no fill/cost/P&L model, untouched final test or timestamped Layer 2 qualification. The larger search increases selection risk. Greater-than-60% reliability remains unestablished.

## Reproduction

Plan: backtester/registries/gold_macro_exploration_plan.v2.json (committed before search).

Ignored source directories: gold-fred-extended-20260918, gold-hourly-extended-20260918 and gold-calendar-extended-20260918 under backtester/tmp. The event merger links the buffer, 2023 and September 17 archives in its manifest.

Run each command with a new output destination:

```powershell
node backtester/scripts/run_gold_research_bundle.js backtester/tmp/gold-fred-extended-20260918 backtester/tmp/gold-hourly-extended-20260918 backtester/tmp/gold-calendar-extended-20260918 NEW_DIRECTORY retrospective backtester/registries/gold_macro_exploration_plan.v2.json
node backtester/scripts/run_gold_research_bundle.js backtester/tmp/gold-fred-extended-20260918 backtester/tmp/gold-hourly-extended-20260918 backtester/tmp/gold-calendar-extended-20260918 NEW_DIRECTORY as_of_proxy backtester/registries/gold_macro_exploration_plan.v2.json
node backtester/scripts/summarize_gold_research.js BUNDLE/experiments.json BUNDLE/event-dataset.json NEW_DIAGNOSTICS.json
```

Completed bundles: backtester/tmp/gold-extended-retrospective-20260918 and backtester/tmp/gold-extended-as_of_proxy-20260918. Each includes REPORT.md, dataset, snapshots, event-dataset, experiments and diagnostics. Diagnostics validate their experiment/dataset hash relationship.

Retrospective event-dataset SHA-256: 262d632dcae9ed6e35bdf72312b16f70f57a3060de37e2ce44017ec5b647c526.
As-of event-dataset SHA-256: 5a272dcc4b9e1b4daed1362828870a54401de8ccb821c9bde96af149bb223251.
Plan SHA-256: 6d73575acb05a73146bcc118fd9e9d682d4078d7c2acf27d4efc21aee5e64137.

## Next decision

Prioritize validating the claims hypothesis's original release/consensus evidence and freezing a prospective shadow-evaluation contract. Do not tune the rule against this consumed validation sample or deploy it as a daily Gold forecast. Keep the Gold operational history repair and live deployment as separate tasks.

Validation: three focused extension/diagnostic tests and full local `npm test` passed, 336/336 total. The source comparison is retained at ignored `backtester/tmp/gold-extended-comparison-20260918.json`; test log is `tmp/gold-extended-tests-20260918.log`.

Independent source check: directly matched the 21 selected validation decisions to the archived claims actual/consensus values and raw OANDA entry/endpoint candles, without the research evaluator. Reproduced 12 correct, four wrong and five flat outcomes. Evidence: ignored backtester/tmp/gold-claims-independent-check-20260918.json.
