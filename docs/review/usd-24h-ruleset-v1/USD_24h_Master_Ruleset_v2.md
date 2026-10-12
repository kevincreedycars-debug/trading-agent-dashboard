# USD 24-hour master ruleset v2 (candidate)

Status: `CANDIDATE_SHADOW_ONLY`, `production_enabled: false`, `trade_eligible: false`. Machine-readable
form: `config/usd_24h_ruleset_v2.json`. This supersedes nothing live: the deployed USD Layer 1 workflow
still runs its own rulebook, and this document describes the candidate that has been measured.

## 1. Scope

| Item | Value |
| --- | --- |
| Asset | USD only. The other seven engines are untouched. |
| Horizon | `following 24hrs` |
| Outcome instrument | FRED `DTWEXBGS`, the series the live collector stores as `dxy_level` |
| Daily cutoff | 09:30 ET on each trading day |
| Endpoint | 16:00 ET close of the next valid trading session (a nominal 24 hours; measured elapsed time 30.5 hours at the median) |
| Flat band | 0.1 percentage points |

## 2. Inputs

Nineteen series are acquired and cached with a declared availability lag: the dollar index at two and
one business days, VIX, US 2Y/3M/10Y, 10Y and 5Y TIPS real yields, 10Y breakevens, EFFR, SOFR,
high-yield spreads, Nasdaq-100, S&P 500, USD/EUR, USD/JPY, WTI, the German 2Y Schatz yield, German 10Y
monthly context and gold from a local intraday cache. Every row records the exact observation date each
input came from.

Three inputs are declared unavailable and are never proxied into a vote:

- economic surprise (actual versus consensus at first release) and the derived Fed-bias field: the live
  collector reads a paid Finnhub calendar and the warehouse importer reads a paid RapidAPI ForexData
  calendar, and ALFRED vintage CSV returns 404 without a key;
- the fed funds and SOFR futures implied path: no free source publishes a historical meeting-by-meeting
  path, so front-end yield changes stand in as a labelled proxy.

## 3. Decision arm

The frozen candidate is the regularised logistic challenger at lambda 0.03, fitted on development rows
only (2024-01-02 to 2025-03-31, flat windows excluded), standardised with training-period means and
standard deviations. Direction is `BULLISH` when P(up) is at or above 0.5, `BEARISH` below it, and
`NO_CLEAR_BIAS` when any required feature is missing. The full coefficient vector, standardisation
statistics and threshold are in `model_execution` in the configuration file.

The rule table in the same file carries all 28 declared rules (four per family), their weights and the
gates, so a rule-based successor can be read, re-weighted and re-tested without re-deriving anything.
The rule arms are what the research cards measure; the logistic arm is what the chronological
selection chose.

## 4. Strength labels, kept apart

| Label | Value | Meaning |
| --- | --- | --- |
| `engine_strength_label` | `NOT_DEMONSTRATED` | Whether this asset's rules are evidenced better than the deployed engine. They are not: the candidate's holdout lower bound is 35.75 against the engine's holdout point estimate of 52.78. |
| `headline_strength_label` | `NOT_SUPPORTED` | How much confidence a published call may carry. With the selection tier at `tier_2_reduced_filters` and no calibration passing, no headline strength may be claimed. |

## 5. Probability

No probability is published. `p_up_24h` stays null: Platt scaling fitted on development rows produces a
validation Brier score that does not beat the constant base rate, so calibration does not support a
probability. The field is reserved, not repurposed.

## 6. Release blockers

- `PROSPECTIVE_SHADOW_RESULT_PENDING`: the offline shadow comparison exists; a live shadow run does not.
- `EVENT_AND_FED_FAMILIES_UNAVAILABLE`: 24 of the live engine's 100 points rest on unverifiable inputs.
- `OPERATIONAL_PARITY_NOT_ESTABLISHED_FOR_NEW_INPUTS`: several candidate inputs (German 2Y, credit
  spreads, the local gold cache) have no live collector feeding them today.
- `TRADING_EDGE_NOT_ASSESSED`: no spread, cost, fill or path evidence exists.

## 7. What would have to be true before this replaces anything

1. A holdout lower bound above the deployed engine's point estimate, with at least 100 decided calls.
2. Event and Fed-repricing inputs available with authentic publication and consensus evidence, or an
   explicit decision to keep those families permanently out of the directional budget.
3. A collector path for every new input, with parity evidence against the dataset rows.
4. A calibration that beats the base rate before any probability is published.

None of the four holds today. The candidate is published so the evidence can be attacked, not so it can
be deployed.
