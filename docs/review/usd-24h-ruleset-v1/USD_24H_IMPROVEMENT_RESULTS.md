# USD 24-hour improvement project — results

Scope: the USD Layer 1 24-hour call only. The live null-conversion repair is already applied to
`OCt1tB9yVMUgFTha`; this document is the economic work that follows it. All numbers come from the
scripts named at the end, reading `data/usd-24h-research-dataset.json` and its companions. Nothing
here touches a live workflow, dispatcher, dashboard or database.

## 1. Baseline, as measured

| Item | Measured value |
| --- | --- |
| Outcome instrument | FRED `DTWEXBGS`, the nominal broad US dollar index — byte-equal to the archive's own prices on all 584 shared dates (2024-01-02 open 119.2686 against the archive's 119.2686) |
| Prediction cutoff | US morning snapshot. The archived USD contract uses 09:30 ET; this dataset declares 09:30 ET on every row and records the UTC instant actually used |
| 24-hour endpoint | The repository's own `following 24hrs` window: the **16:00 ET close of the next valid trading session**. That is a nominal 24-hour horizon, not 24 elapsed hours: measured elapsed time is 30.5 hours at the median and 102.5 at the maximum (a Friday call closing on Monday) |
| Flat band | 0.1 percentage points on the dollar index (`getFlatThreshold("DXY")`) |
| Rows | 584 trading days from 2024-01-02; 583 evaluable; 209 bullish, 192 bearish, 182 flat |

Baseline arms over identical rows and periods (ex-flat accuracy, Wilson 95% interval in brackets):

| Arm | Development | Validation | Holdout |
| --- | --- | --- | --- |
| Deployed engine, stored calls (measured live behaviour) | 55.00 | 44.21 | **52.78** [41.40, 63.87], 72 decided |
| Engine replayed on this dataset's as-of observations | 52.22 | 50.55 | 48.57 [36.80, 60.51] |
| Always bullish (majority direction) | 54.84 | 48.08 | 50.00 [39.30, 60.70] |
| Five-day momentum | 53.92 | 43.27 | 43.75 |
| Five-day contrarian (fade the trailing move) | 46.08 | 56.73 | **56.25** [45.34, 66.59] |
| Twenty-day momentum | 47.00 | 47.12 | 51.25 |

Two facts about the engine arm matter: the repaired and pre-repair engines are indistinguishable on
this archive (all 6,040 stored factor entries equal the replay implementation's, so the null-conversion
repair cannot move an archived call), and the deployed engine is not better than a constant direction
on any period.

## 2. Research: the seven families

Full detail in `USD_24H_RESEARCH_CARDS.md` and `data/usd-24h-research-cards.json`. Each family has at
most four declared candidate rules, evidence measured on the same forward window, and the same
measurement against the window that has just closed, which is what separates explanation from
prediction.

| Family | Verdict at this stage |
| --- | --- |
| Dollar momentum | weak; the sign of the forward relation flips between development and validation for the one-, five- and twenty-day forms |
| VIX and risk | weak; level and percentile forms carry no forward relation that survives the periods |
| Relative rates | weak; the US 2Y five-day change is the only rule that stays positive in all three periods, at small size |
| Real yields | contradictory; the ten-year real-yield change is the strongest single rule on development (57.53) and 57.14 on holdout with only 10 decided calls |
| Fed repricing | contradictory; only yield-based proxies exist, because no free source publishes a meeting-by-meeting implied path |
| Economic surprises | **not evaluable**: actual-versus-consensus vintages sit behind paid feeds, ALFRED vintage CSV is 404 without a key, and the Fed-bias field is derived from the same paid calendar |
| Cross-asset | contradictory; gold and the previous session's equity move disagree between periods, and EURUSD is a component of the index rather than independent evidence |

## 3. Dataset and reproducibility

`data/usd-24h-dataset-manifest.json` lists every input with its provider, request URL, cached byte
count, sha256 and declared availability lag. `data/usd-24h-research-dataset.json` holds one row per
cutoff with as-of features, per-input provenance dates, missing-input flags and the future outcome in
its own object. Raw series caches stay in ignored `backtester/tmp/usd-24h-research-cache/`.

Recorded honestly: 24 outcomes use a delayed endpoint (up to three calendar days) and one is
unavailable; values are latest-published revisions rather than vintages, so the declared business-day
lag is a reconstruction; the dollar index is a trade-weighted index, not the ICE futures contract; and
gold comes from a previously acquired local vendor file rather than a fresh download.

## 4. Experiments

93 configurations were attempted against one cached dataset, in parallel, in about a third of a
second, with no download and no model call inside any experiment: 24 single-rule arms, 7 family arms,
declared, engine-aligned and development-tuned composites, threshold and lookback variants,
counter-hypothesis reversals, four conditioning variants, an availability-lag sensitivity for the
momentum family, two gate-sensitivity composites and four regularised logistic challengers.
`data/usd-24h-experiment-registry.json` records every one, including the losers.

| Configuration | Development | Validation | Holdout |
| --- | --- | --- | --- |
| L2 logistic challenger (lambda 0.03, fitted on development only) | 61.75 | 55.77 | 46.25 |
| L2 logistic challenger (lambda 0.1) | 61.29 | 53.85 | 47.50 |
| Engine-aligned composite, reduced gates | 55.32 | 42.68 | 49.25 |
| Equal-weight composite | 52.54 | 54.05 | 56.25 (32 decided) |
| Relative-rates rule gated on low dollar volatility | 54.44 | 65.22 | 52.63 (19 decided) |
| Fade of the five-day move read from the one-lag series | 48.39 | 60.47 | 57.89 (57 decided) |

The challenger is the only arm with full coverage that beats the engine on development and
validation. It then loses on the untouched holdout, where the deployed engine scores 52.78 against its
46.25 and the five-day contrarian benchmark scores 56.25.

## 5. Selection

Selection was declared before the holdout was read: full filters (validation coverage ≥ 60%,
decided ≥ 100, Wilson lower bound ≥ 48%, stable-quarter accuracy ≥ 40%, development-to-validation gap
≤ 12 points), then a reduced tier (coverage ≥ 40%, decided ≥ 60, lower bound ≥ 45%, gap ≤ 20), then
report-only. No configuration passed the full filters, two passed the reduced tier, and the ranking
key is the validation Wilson lower bound with decided count as the tie-break. The winner is the L2
logistic challenger at lambda 0.03. The selection tier is recorded as `tier_2_reduced_filters` so the
weaker evidence stays visible in the artefacts.

## 6. Verdict

**Improvement is not demonstrated.** The frozen candidate's holdout lower bound (35.75) sits below the
deployed engine's holdout point estimate (52.78), and the 60% target is not met by any arm with
adequate sample size. `config/usd_24h_ruleset_v2.json` is therefore published as
`CANDIDATE_SHADOW_ONLY`, with `production_enabled: false`, `trade_eligible: false`,
`engine_strength_label: NOT_DEMONSTRATED` and `headline_strength_label: NOT_SUPPORTED`. No probability
is published, because the Platt-calibrated validation Brier score does not beat the constant base rate.

What the work does establish, and what the other engines should inherit:

- the deployed USD engine's 24-hour call is not better than a constant direction over 2024–2026;
- the single most robust direction in the sample is the fade of the trailing five-day dollar move,
  which needs no research to compute and still only reaches a lower bound of 45.34;
- economic surprises, the highest-weight live family, cannot be evaluated at all from
  repository-available data, so 24 of the engine's 100 live points rest on an unverifiable input;
- one improvement is available and independent of this study: the endpoint definition itself, which is
  currently a session close labelled as 24 hours.

## 7. Shadow behaviour and deployment

`data/usd-24h-shadow-comparison.json` runs the frozen candidate alongside the deployed engine's stored
calls over the untouched 2025-11-03 to 2026-04-30 window: 123 rows, 84 disagreements, 24 days the
candidate alone called correctly and 26 days the engine alone did. The dispatcher remains paused, no
workflow or dashboard changed, and the candidate has never run in n8n.
`USD_24H_SHADOW_AND_DEPLOYMENT_DIFF.md` records the exact change that would be required if the user
authorises one.

## 8. Reproduction

```powershell
node backtester/scripts/acquire_usd_24h_research_inputs.js
node backtester/scripts/build_usd_24h_research_dataset.js
node backtester/scripts/run_usd_24h_experiments.js --workers=4
node backtester/scripts/build_usd_24h_baseline_comparison.js
node backtester/scripts/build_usd_24h_research_cards.js
node backtester/scripts/select_usd_24h_ruleset.js
node backtester/scripts/run_usd_24h_shadow_comparison.js
node --test backtester/tests/usd_24h_research.test.js
```

The first command is the only one that uses the network; everything else reads the cache and the
committed dataset.
