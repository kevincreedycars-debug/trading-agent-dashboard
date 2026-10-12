# USD 24-hour research cards

Generated 2026-10-12T21:01:17.328Z from dataset `fafdab0d25ccea55` and experiment registry `9847636c4e681662`.

Every number below is measured on `data/usd-24h-research-dataset.json`, built from as-of observations at a declared 09:30 ET cutoff. `forward r` correlates an input with the return of the next window; `trailing r` correlates the same input with the window that has just closed. An input that only tracks its own window has explained the past, not predicted the future.

## Verdict rule

- Signal floor: absolute forward correlation of 0.08 in at least one period.
- Explanation ratio: a trailing correlation more than 2 times the forward correlation marks the input as explanatory.
- A sign change between development and validation, or sign flips in several quarters, is recorded as contradictory.

## Dollar index momentum (`dxy_momentum`)

Verdict: **weak_forward_relation_only**

### Candidate rules (maximum four per family)

| Rule | Feature | Bullish trigger | Bearish trigger | Weight | Status |
| --- | --- | --- | --- | --- | --- |
| `usd_mom_1d_cont` | usd_ret_1d | gte 0.15 | lte -0.15 | 6 | candidate |
| `usd_mom_5d_cont` | usd_ret_5d | gte 0.5 | lte -0.5 | 8 | candidate |
| `usd_mom_5d_fade` | usd_ret_5d | lte -0.5 | gte 0.5 | 8 | candidate |
| `usd_trend_ma20_cont` | usd_ma20_dist_pct | gte 0.5 | lte -0.5 | 6 | candidate |

Measured single-rule arms, development / validation / holdout ex-flat accuracy with validation coverage:

| Rule | Dev | Validation | Validation coverage | Holdout | Holdout decided |
| --- | --- | --- | --- | --- | --- |
| `usd_mom_1d_cont` | 50.43 | 43.33 | 57.05 | 48.72 | 39 |
| `usd_mom_5d_cont` | 62.11 | 40 | 36.91 | 38.24 | 34 |
| `usd_mom_5d_fade` | 37.89 | 60 | 36.91 | 61.76 | 34 |
| `usd_trend_ma20_cont` | 46.61 | 40.48 | 40.94 | 48.78 | 41 |

### Evidence and counterevidence

| Input | Dev forward r (n) | Validation forward r (n) | Holdout forward r (n) | Trailing r (n) | Bottom tercile up share | Top tercile up share | Quarters positive | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| one-day dollar return | 0.0252 (311) | -0.1678 (148) | -0.0872 (121) | 0.0073 (583) | 51.13% (n=133) | 49.62% (n=133) | 4/10 | forward_sign_unstable_between_periods |
| five-day dollar return | 0.1021 (311) | -0.0894 (148) | -0.0612 (121) | -0.0192 (583) | 54.14% (n=133) | 53.38% (n=133) | 4/10 | forward_sign_unstable_between_periods |
| twenty-day dollar return | -0.0062 (311) | -0.132 (148) | -0.0377 (121) | -0.0098 (583) | 56.39% (n=133) | 48.12% (n=133) | 0/10 | weak_forward_relation |
| distance from the 20-observation mean | 0.0129 (311) | -0.1085 (148) | -0.0448 (121) | -0.0093 (583) | 54.14% (n=133) | 47.37% (n=133) | 0/10 | forward_sign_unstable_between_periods |
| one-day dollar return, one-lag series | -0.0356 (311) | 0.0233 (148) | -0.0335 (121) | -0.0011 (583) | 54.89% (n=133) | 51.13% (n=133) | 3/10 | no_measurable_forward_signal |
| five-day dollar return, one-lag series | 0.0025 (311) | -0.1226 (148) | -0.0603 (121) | -0.0108 (583) | 54.14% (n=133) | 52.63% (n=133) | 2/10 | forward_sign_unstable_between_periods |

### Historical data requirements

- Daily dollar index values with a declared availability lag (FRED DTWEXBGS is used at two and one business days).
- At least 21 usable observations before the cutoff to form the 20-observation window.

### Unavailable or proxy inputs

- true intraday dollar quotes: the collector reads a daily FRED series, so no same-morning dollar print exists

## VIX and risk conditions (`vix_risk`)

Verdict: **weak_forward_relation_only**

### Candidate rules (maximum four per family)

| Rule | Feature | Bullish trigger | Bearish trigger | Weight | Status |
| --- | --- | --- | --- | --- | --- |
| `risk_vix_level_haven` | vix_level | gte 25 | lte 16 | 8 | candidate |
| `risk_vix_chg_5d` | vix_ret_5d | gte 10 | lte -10 | 6 | candidate |
| `risk_vix_pctile` | vix_pctile_252 | gte 80 | lte 20 | 4 | candidate |
| `risk_credit_spread_chg` | credit_spread_chg_5d_bps | gte 25 | lte -25 | 5 | candidate |

Measured single-rule arms, development / validation / holdout ex-flat accuracy with validation coverage:

| Rule | Dev | Validation | Validation coverage | Holdout | Holdout decided |
| --- | --- | --- | --- | --- | --- |
| `risk_vix_level_haven` | 43.94 | 33.33 | 34.9 | 53.85 | 26 |
| `risk_vix_chg_5d` | 48.91 | 59.09 | 39.6 | 57.58 | 33 |
| `risk_vix_pctile` | 51.43 | 35.9 | 36.24 | 52.63 | 38 |
| `risk_credit_spread_chg` | 27.27 | 45 | 18.79 | 20 | 5 |

### Evidence and counterevidence

| Input | Dev forward r (n) | Validation forward r (n) | Holdout forward r (n) | Trailing r (n) | Bottom tercile up share | Top tercile up share | Quarters positive | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| VIX level | -0.0787 (311) | -0.1993 (148) | -0.0133 (121) | -0.0489 (583) | 53.38% (n=133) | 48.87% (n=133) | 2/10 | weak_forward_relation |
| one-day VIX change | -0.1333 (311) | 0.2051 (148) | -0.0214 (121) | 0.1803 (583) | 55.64% (n=133) | 49.62% (n=133) | 4/10 | forward_sign_unstable_between_periods |
| five-day VIX change | -0.0858 (311) | -0.1541 (148) | 0.0625 (121) | 0.0681 (583) | 48.12% (n=133) | 50.38% (n=133) | 3/10 | forward_sign_unstable_across_quarters |
| VIX percentile over 252 observations | -0.0399 (311) | -0.1267 (148) | 0.0419 (121) | -0.0117 (583) | 50.38% (n=133) | 51.13% (n=133) | 5/10 | forward_sign_unstable_across_quarters |
| five-day high-yield spread change | -0.0584 (311) | -0.1942 (148) | 0.1336 (121) | -0.0155 (583) | 57.14% (n=133) | 47.37% (n=133) | 3/10 | forward_sign_unstable_across_quarters |

### Historical data requirements

- VIXCLS and BAMLH0A0HYM2 daily closes with a one-business-day lag.
- A 252-observation history before each cutoff for the percentile form.

### Unavailable or proxy inputs

- no option-implied dollar skew and no intraday volatility term structure

## Relative interest rates (`relative_rates`)

Verdict: **weak_forward_relation_only**

### Candidate rules (maximum four per family)

| Rule | Feature | Bullish trigger | Bearish trigger | Weight | Status |
| --- | --- | --- | --- | --- | --- |
| `rel_us_2y_chg5d` | us_2y_chg_5d_bps | gte 10 | lte -10 | 8 | candidate |
| `rel_us_de_2y_spread_chg5d` | us_de_2y_spread_chg_5d_bps | gte 10 | lte -10 | 10 | candidate |
| `rel_de_2y_chg5d` | de_2y_chg_5d_bps | lte -10 | gte 10 | 6 | candidate |
| `rel_us_10y_chg5d` | us_10y_chg_5d_bps | gte 10 | lte -10 | 5 | candidate |

Measured single-rule arms, development / validation / holdout ex-flat accuracy with validation coverage:

| Rule | Dev | Validation | Validation coverage | Holdout | Holdout decided |
| --- | --- | --- | --- | --- | --- |
| `rel_us_2y_chg5d` | 54.44 | 58.62 | 32.89 | 52.63 | 19 |
| `rel_us_de_2y_spread_chg5d` | 53.85 | 52 | 25.5 | 50 | 14 |
| `rel_de_2y_chg5d` | 47.5 | 47.37 | 14.77 | 42.11 | 19 |
| `rel_us_10y_chg5d` | 54.74 | 53.33 | 33.56 | 40 | 15 |

### Evidence and counterevidence

| Input | Dev forward r (n) | Validation forward r (n) | Holdout forward r (n) | Trailing r (n) | Bottom tercile up share | Top tercile up share | Quarters positive | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| US 2Y change, five days | 0.0506 (311) | 0.0807 (148) | -0.036 (121) | 0.0222 (583) | 45.11% (n=133) | 51.88% (n=133) | 4/10 | forward_sign_unstable_across_quarters |
| US minus German 2Y level | -0.0065 (311) | -0.0844 (148) | -0.0622 (121) | -0.0026 (583) | 51.88% (n=133) | 54.89% (n=133) | 4/10 | forward_sign_unstable_across_quarters |
| US minus German 2Y change, five days | 0.012 (311) | 0.0007 (148) | -0.1806 (121) | -0.0039 (583) | 49.62% (n=133) | 54.89% (n=133) | 5/10 | forward_sign_unstable_across_quarters |
| German 2Y change, five days | 0.0495 (311) | 0.1232 (148) | 0.1246 (121) | 0.0316 (583) | 51.13% (n=133) | 55.64% (n=133) | 8/10 | weak_forward_relation |
| US 10Y change, five days | 0.0767 (311) | -0.0263 (148) | -0.0625 (121) | -0.0052 (583) | 47.37% (n=133) | 55.64% (n=133) | 6/10 | no_measurable_forward_signal |

### Historical data requirements

- DGS2, DGS10 and the German 2Y Schatz series, each with a declared lag.
- Consistent quote conventions across the two countries.

### Unavailable or proxy inputs

- ECB and Fed meeting-date conditioning, and the option-implied policy path

## Real yields (`real_yields`)

Verdict: **contradictory_across_periods**

### Candidate rules (maximum four per family)

| Rule | Feature | Bullish trigger | Bearish trigger | Weight | Status |
| --- | --- | --- | --- | --- | --- |
| `real_10y_chg5d` | us_10y_real_chg_5d_bps | gte 10 | lte -10 | 8 | candidate |
| `real_10y_chg20d` | us_10y_real_chg_20d_bps | gte 15 | lte -15 | 6 | candidate |
| `real_5y_chg5d` | us_5y_real_chg_5d_bps | gte 10 | lte -10 | 5 | candidate |
| `real_breakeven_chg5d` | us_10y_breakeven_chg_5d_bps | lte -10 | gte 10 | 3 | candidate |

Measured single-rule arms, development / validation / holdout ex-flat accuracy with validation coverage:

| Rule | Dev | Validation | Validation coverage | Holdout | Holdout decided |
| --- | --- | --- | --- | --- | --- |
| `real_10y_chg5d` | 57.53 | 53.57 | 28.19 | 57.14 | 7 |
| `real_10y_chg20d` | 52.94 | 55.56 | 28.86 | 55.56 | 18 |
| `real_5y_chg5d` | 52.5 | 45.95 | 32.89 | 53.85 | 13 |
| `real_breakeven_chg5d` | 50 | 33.33 | 6.04 | 100 | 1 |

### Evidence and counterevidence

| Input | Dev forward r (n) | Validation forward r (n) | Holdout forward r (n) | Trailing r (n) | Bottom tercile up share | Top tercile up share | Quarters positive | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10Y TIPS real yield change, five days | 0.067 (311) | -0.0627 (148) | -0.0174 (121) | -0.0256 (583) | 46.62% (n=133) | 54.89% (n=133) | 6/10 | no_measurable_forward_signal |
| 10Y TIPS real yield change, twenty days | 0.0629 (311) | -0.0456 (148) | -0.1363 (121) | 0.0025 (583) | 51.13% (n=133) | 51.88% (n=133) | 3/10 | forward_sign_unstable_between_periods |
| 5Y TIPS real yield change, five days | 0.0593 (311) | -0.0287 (148) | -0.0326 (121) | 0.0038 (583) | 45.86% (n=133) | 51.88% (n=133) | 5/10 | no_measurable_forward_signal |
| 10Y breakeven change, five days | 0.0622 (311) | 0.0634 (148) | -0.1008 (121) | 0.0357 (583) | 47.37% (n=133) | 51.88% (n=133) | 7/10 | forward_sign_unstable_across_quarters |

### Historical data requirements

- DFII10, DFII5 and T10YIE daily closes with a declared lag.

### Unavailable or proxy inputs

- foreign real yields, so only the US leg of a real-rate differential exists here

## Fed repricing (`fed_repricing`)

Verdict: **contradictory_across_periods**

### Candidate rules (maximum four per family)

| Rule | Feature | Bullish trigger | Bearish trigger | Weight | Status |
| --- | --- | --- | --- | --- | --- |
| `fed_dovish_repricing_5d` | policy_repricing_5d_bps | lte -10 | gte 10 | 8 | candidate |
| `fed_repricing_20d` | policy_repricing_20d_bps | lte -15 | gte 15 | 6 | candidate |
| `fed_effr_minus_3m` | effr_minus_3m_bps | lte -15 | gte 15 | 5 | candidate |
| `fed_funding_stress` | sofr_minus_effr_bps | gte 10 | lte -10 | 3 | candidate |

Measured single-rule arms, development / validation / holdout ex-flat accuracy with validation coverage:

| Rule | Dev | Validation | Validation coverage | Holdout | Holdout decided |
| --- | --- | --- | --- | --- | --- |
| `fed_dovish_repricing_5d` | 54.44 | 58.62 | 32.89 | 52.63 | 19 |
| `fed_repricing_20d` | 50.41 | 60.78 | 49.66 | 42.86 | 21 |
| `fed_effr_minus_3m` | 44.44 | 66.67 | 12.08 | 50 | 2 |
| `fed_funding_stress` | 100 | 50 | 10.74 | 72.73 | 11 |

### Evidence and counterevidence

| Input | Dev forward r (n) | Validation forward r (n) | Holdout forward r (n) | Trailing r (n) | Bottom tercile up share | Top tercile up share | Quarters positive | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| inverse US 2Y change, five days | -0.0506 (311) | -0.0807 (148) | 0.036 (121) | -0.0222 (583) | 53.38% (n=133) | 47.37% (n=133) | 6/10 | forward_sign_unstable_across_quarters |
| inverse US 2Y change, twenty days | -0.0683 (311) | -0.0475 (148) | 0.0938 (121) | -0.0508 (583) | 54.89% (n=133) | 48.87% (n=133) | 6/10 | forward_sign_unstable_across_quarters |
| effective rate minus 3M bill | 0.0393 (311) | 0.0402 (148) | -0.054 (121) | 0.0015 (583) | 51.88% (n=133) | 54.89% (n=133) | 7/10 | no_measurable_forward_signal |
| SOFR minus effective rate | 0.0072 (311) | 0.0198 (148) | 0.0439 (121) | 0.0093 (583) | 51.88% (n=133) | 54.14% (n=133) | 5/10 | no_measurable_forward_signal |
| US 3M change, five days | 0.0391 (311) | -0.0138 (148) | -0.0417 (121) | 0.0092 (583) | 51.13% (n=133) | 51.88% (n=133) | 5/10 | no_measurable_forward_signal |

### Historical data requirements

- EFFR, SOFR, DGS3MO and DGS2 with a declared lag.
- A meeting-by-meeting implied policy path to measure repricing directly rather than through yields.

### Unavailable or proxy inputs

- fed funds and SOFR futures implied paths are not available from a free source, so every rule here is a yield-based proxy
- meeting dates and statement text are absent

## Economic surprises (`economic_surprises`)

Verdict: **not_evaluable_missing_source**

### Candidate rules (maximum four per family)

| Rule | Feature | Bullish trigger | Bearish trigger | Weight | Status |
| --- | --- | --- | --- | --- | --- |
| `surprise_event_signal` | latest_us_event_surprise | eq positive | eq negative | 0 | not_evaluable |
| `surprise_event_age_gate` | latest_us_event_age_hours | lte 72 | lte 72 | 0 | not_evaluable |
| `surprise_release_day_conditioning` | is_us_macro_release_day | eq true | eq false | 0 | not_evaluable |
| `surprise_context_only_policy` | latest_us_event_surprise | eq positive | eq negative | 0 | policy |

Measured single-rule arms, development / validation / holdout ex-flat accuracy with validation coverage:

| Rule | Dev | Validation | Validation coverage | Holdout | Holdout decided |
| --- | --- | --- | --- | --- | --- |
| `surprise_context_only_policy` | - | - | - | - | - |

### Historical data requirements

- Actual value at first release, the pre-release consensus and the observation's publication timestamp.
- An event-age rule applied at the cutoff, not after the fact.
- A scheduled calendar of release dates and times in the same timezone convention as the cutoff.

### Unavailable or proxy inputs

- consensus values and first-release actuals sit behind paid feeds (Finnhub calendar, RapidAPI ForexFactory) that this repository cannot read
- ALFRED vintage CSV returns HTTP 404 without an API key, so no vintage reconstruction is possible either
- the Fed-bias field is derived from the same paid calendar, so it is left null rather than proxied

## Cross-asset relationships (`cross_asset`)

Verdict: **contradictory_across_periods**

### Candidate rules (maximum four per family)

| Rule | Feature | Bullish trigger | Bearish trigger | Weight | Status |
| --- | --- | --- | --- | --- | --- |
| `xasset_gold_5d_inverse` | gold_ret_5d | lte -1.5 | gte 1.5 | 5 | candidate |
| `xasset_equity_5d_regime` | nq_ret_5d | lte -1.5 | gte 1.5 | 4 | candidate |
| `xasset_eurusd_confirm` | eurusd_ret_5d | lte -1 | gte 1 | 4 | candidate |
| `xasset_wti_5d_growth` | wti_ret_5d | gte 5 | lte -5 | 3 | candidate |

Measured single-rule arms, development / validation / holdout ex-flat accuracy with validation coverage:

| Rule | Dev | Validation | Validation coverage | Holdout | Holdout decided |
| --- | --- | --- | --- | --- | --- |
| `xasset_gold_5d_inverse` | 42.86 | 37.5 | 16.11 | 48.28 | 29 |
| `xasset_equity_5d_regime` | 48.74 | 56 | 48.32 | 48.84 | 43 |
| `xasset_eurusd_confirm` | 48.98 | 50 | 28.86 | 33.33 | 18 |
| `xasset_wti_5d_growth` | 46.15 | 60.71 | 26.17 | 43.48 | 23 |

### Evidence and counterevidence

| Input | Dev forward r (n) | Validation forward r (n) | Holdout forward r (n) | Trailing r (n) | Bottom tercile up share | Top tercile up share | Quarters positive | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gold return, previous session | 0.012 (311) | -0.0709 (148) | -0.0229 (121) | -0.2402 (583) | 51.13% (n=133) | 54.89% (n=133) | 6/10 | no_measurable_forward_signal |
| gold return, five days | 0.0547 (311) | -0.0188 (148) | 0.0626 (121) | -0.3532 (583) | 52.63% (n=133) | 53.38% (n=133) | 7/10 | no_measurable_forward_signal |
| gold realised volatility | -0.0581 (311) | -0.0313 (148) | 0.0355 (121) | 0.0624 (583) | 57.14% (n=133) | 51.88% (n=133) | 4/10 | no_measurable_forward_signal |
| Nasdaq-100 return, five days | 0.0686 (311) | 0.11 (148) | -0.0027 (121) | -0.0513 (583) | 52.63% (n=133) | 51.13% (n=133) | 7/10 | forward_sign_unstable_across_quarters |
| EURUSD return, five days | -0.0259 (311) | 0.0514 (148) | 0.0684 (121) | -0.0168 (583) | 51.13% (n=133) | 54.14% (n=133) | 8/10 | no_measurable_forward_signal |
| WTI return, five days | -0.0037 (311) | 0.1466 (148) | -0.0088 (121) | 0.0178 (583) | 48.87% (n=133) | 53.38% (n=133) | 5/10 | forward_sign_unstable_between_periods |

### Historical data requirements

- Intraday gold history that resolves the 09:30 ET cutoff (local OANDA hourly cache).
- Daily equity, FX and energy closes with a declared lag.

### Unavailable or proxy inputs

- gold comes from a local cache of a previously acquired vendor file rather than a fresh download
- the dollar index already contains EUR, so the EURUSD rule is a confirmation input, not independent evidence

## Boundaries

- Correlations and hit shares are descriptive measurements on one dataset, not significance claims.
- The dataset uses latest-published values, so every relation above is a declared reconstruction, not a vintage replay.
- No result here establishes a trading edge: spreads, costs, fills and complete paths are out of scope.

