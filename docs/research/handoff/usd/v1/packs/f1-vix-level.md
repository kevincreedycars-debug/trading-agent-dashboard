# F1 VIX level and risk regime - baseline audit pack (live.f1-vix-level)

- Task: USD-BASELINE-AUDIT-01
- Pack version 2.0.0, context version usd-session-context-20261014.1, extracted 2026-10-15 on branch `research/usd-session-20261013` at `d07af11166ea1d39e5f4184e85a993e03bcb7137`.
- The card's `family` field must be `risk_conditions`; the pack groups this factor under `risk_conditions`.
- Catalogue status: research ready, review pending, backtest not_tested. Deployed baseline: no research card has been run on it and it is not a candidate.

## 1. What is asked

Forecast the direction of the US dollar over one session: the sign of the change in the label instrument from 05:00 Europe/London to 05:00 Europe/London on the next local date.

You are writing for one reader who trades the US dollar and needs to know what is actually true, not what sounds plausible.

Prohibitions:

Do not invent a backtest, a performance figure, an accuracy rate or a sample size. If you have not
measured it, say it is unmeasured. Numbers you remember are not evidence.
Do not use hindsight: never state what a past period would have predicted using information that was not
available at that time, and do not present a later revision as a first print.
Cite only sources you actually fetched in this session, with the link and the passage you relied on.
Where you are uncertain, say so and give the reason; an unresolved question is a valid return.
State effects that are already in the price at the cutoff rather than counting them again as predictive.
Treat the deployed weights, thresholds and signs as a baseline to audit, never as evidence for your claim.
Name the instrument a claim is really about. Never present another instrument as DXY.
No production, workflow, dashboard, feed, dispatcher, database or configuration change is authorised by
this pack, and none may be proposed as part of the deliverable.

## 2. The session

- Start: 05:00 Europe/London. End: 05:00 Europe/London on the next local date. Both ends are London
  wall-clock times one local date apart, so no US or EU changeover date can move the window and a fixed
  hour count is never used to build it.
- Eligible starts are Monday to Friday local dates only. The London spring transition (01:00Z, last Sunday
  of March) and autumn transition (01:00Z, last Sunday of October) fall inside the session that starts on
  the preceding Saturday, so that start measures 23 hours in spring and 25 in autumn and is not a session.
  Every eligible session is therefore exactly 24 hours.
- The Friday session contains Friday's US close and ends on Saturday morning. That is intended.
- A session whose endpoint print is missing is dropped and counted as coverage. Nothing is filled,
  forward-carried, interpolated or silently extended to Monday.
- The flat band, the tie policy and the missing-quote policy are still undecided; they must be frozen
  before any candidate is scored and may not be borrowed from the closed 24-hour study.

- The label instrument and its quote source are UNDECIDED. No intraday DXY print exists in this repository or in the live collector, so the label instrument and the quote source are unverified at both ends. If a claim is really about EUR/USD, a custom basket or any other instrument, name that instrument and say so; never present another instrument as DXY. The live collector prices the dollar with FRED DTWEXBGS, which is a feature and cannot be the session label: H.10 publishes on Mondays at 16:15 ET for the previous business week, so at a 05:00 London cutoff that value is 2 to 6 business days old (median 4).

## 3. The deployed baseline for this factor

The VIX level at the cutoff read as the risk regime the dollar is trading in; the deployed code reads the level only, while the rulebook also describes 1-day and 5-day modifiers that do not execute.

- Rule in code: VIX > 25 reads BULLISH, 16 to 25 NEUTRAL, below 16 BEARISH. Level only. Threshold 25 / 16. Coded weight 10, rulebook weight 10, deployed in signals.F1.
- Input: vix_level from FRED VIXCLS, stored by the USD collector (index; level, no transformation; lookback none; cutoff 1 to 2 business days old at 05:00 London; this family's publication time carries a declared assumption, not a verified schedule)
- Weights: coded by timeframe {"24h":10,"3d":8,"current_week":5,"next_week":4,"current_month":3}; rulebook 10. logic/agent_usd_direction.md v2.1, which the live workflow fetches from GitHub on every run; the two vectors and the disagreements between them are catalogued in docs/research/usd-session/v1/weight_vector_discrepancy.md.
- Missing or stale input: A missing level scores F1 NEUTRAL and names the missing input; the null-to-zero defect was repaired live on 2026-10-11 and no archived call moved.
- Where this comes from in the code:
  - exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F1 (thresholds 25 and 16, weight 10)
  - exports/usd_layer1_agent.json -> Build USD Input Pack (vix_level, vix_d1, vix_d5 exposed to the model)
- Where the rulebook states it:
  - logic/agent_usd_direction.md section 5, 'Factor 1 - VIX Level and Risk Regime'
  - logic/agent_usd_direction.md section 15 rule 4 ('VIX > 25 activates safe-haven USD logic')
- Rulebook passage the card must engage with: "VIX > 25 activates safe-haven USD logic and supports USD; VIX below 16 reads as risk-on and pressures USD; 16 to 25 is neutral because domestic drivers dominate." (logic/agent_usd_direction.md, section 5, Factor 1)

## 4. What data exists

- No intraday dollar-index print exists in this repository or in the live collector. The label instrument
  and its quote source are UNVERIFIED at both ends.
- The live collector takes one snapshot per day at the 09:30 ET pipeline time and prices the dollar with
  FRED DTWEXBGS: the Federal Reserve publishes H.10 on Mondays at 16:15 ET for the previous business week,
  so at a 05:00 London cutoff that value is 2 to 6 business days old (median 4).
- H.15 interest-rate series (DGS2, DGS3MO, DGS10, DFII5, DFII10, T5YIE, T10YIE) are 1 to 2 business days
  old; market-close series (VIXCLS, SP500, NASDAQ100, SOFR, BAMLH0A0HYM2) 1 to 2; WTI spot 1 to 4.
  The publication time was verified on the provider's own page only for the H.10 family; the other
  families carry a declared one-business-day assumption.
- Hourly OANDA caches exist for EUR/USD, XAU/USD and NAS100 only, and only to 2026-04-30.
- Coinbase spot (gold, BTC and several pairs) is genuine intraday information; the NQ field is an Alpha
  Vantage GLOBAL_QUOTE on QQQ, an ETF, not the index.
- The paid calendar feed stores the release and its scheduled time, no consensus snapshot and no
  first-print vintage; ALFRED vintage CSVs need a key.
- Daily macro series are the previous close at 05:00 London, correctly lagged, never the same morning.

- Historical availability for this factor: FRED VIXCLS daily, cached from 2023-04-03 in the closed study's cache and in the 22-series macro frame from 2024-01-02; latest published values only, no vintage.
- Live availability at the cutoff: Collected once per day at the 09:30 ET pipeline time, with no as-of check against the 05:00 London cutoff and no per-field age.
- This factor needs: nothing beyond the label instrument decision

## 5. The engine around the baseline

- The published call is produced by the deterministic node Calculate USD Conviction in the live workflow
  USD Layer 1 Agent (OCt1tB9yVMUgFTha v154). The model writes the per-factor verdict strings; the code
  computes every published number, and where they disagree the code wins.
- Coded 24h weights: F1 10, F2 14, F3 10, F4 10, F5 14, F6 4, F7 24, F8 12, F9 1, F10 1 (sum 100).
  The rulebook logic/agent_usd_direction.md v2.1, which the workflow fetches from GitHub on every run,
  publishes F1 10, F2 14, F3 16, F4 14, F5 6, F6 5, F7 3, F8 18, F9 12, F10 2. Both are live and nothing
  reconciles them.
- conviction = round(winning weight / active weight * 100): a share of active evidence, not a probability.
  It can read 100% while half the weight is missing, because a missing input moves to the neutral pile
  instead of into active. Direction carries the suffix _LEAN when |netEdge| < 20; NO_CLEAR_BIAS needs an
  exact tie and is unreachable with the deployed weights. The dashboard publishes a second, separately
  derived strength bucket, so two strength labels can disagree on the same row.
- F7 (coded 24 points) copies a pre-computed usd_signal with no consensus, no first print and no age.
  F8 (12 points) reads a categorical bias string with no vintage. Together 36 of the 100 coded points
  cannot be reproduced from reachable data.
- A missing input scores the factor NEUTRAL and names the missing input; the substitution ladder (d1 to d5
  to d20, gold 5d to 1d, NQ 1d to 5d) records only a warning string and is invisible in the numeric
  payload; snapshot selection has no cutoff bound, no per-field age and no revision exclusion.

- Aggregation: conviction = round(winning side weight / active weight * 100), where active weight is the sum of the bullish and bearish weights only. A missing input cannot lower conviction: its weight leaves active weight, so conviction is a share of the evidence that arrived and can read 100 while half the weight is absent. neutral_pct is a sum of weight points printed with a per-cent sign in the reason string, not a percentage of anything. NO_CLEAR_BIAS requires an exact tie of the two weight sums, so abstention is an arithmetic accident rather than a designed gate.
- Modifiers: logic/agent_usd_direction.md sections 8.2 to 8.5 describe a participation cap, a missing-input penalty, a conflict penalty and an agreement boost. The conviction node implements none of them and returns the rulebook's own names as fixed values, so no published call can have been moved by any of the four.

## 6. What is already open

- A level rule on a lagged daily index may describe the past week rather than the next 24 hours.
- The dollar is not unconditionally a safe haven: in funding stress the euro or yen can outperform, and three deployed factors share this input.
- Overlap and double counting: F9 (Dollar Smile) reads the same VIX level with the bias string and F10 gates on the same 25 / 16 thresholds, so one input informs three factors.
- Timing: VIXCLS is a market-close series: at 05:00 London the available value reflects the previous US close, and this family's publication time was not verified on its own page.
- Unresolved data gap: No verified publication time for VIXCLS; no vintage; no intraday VIX at the cutoff.

## 7. What to return

Return one JSON document for this factor, and nothing else in the JSON file.
Use the field list in section 7 of this pack exactly; a required field left empty is not an accepted card.
At most two programmable hypotheses. If you cannot state a hypothesis a program could evaluate session by
session without judgement, return one, or return none and say why.
Every parameter must carry the values you allow, a default and the rule for choosing it on training rows
only, declared before validation.
Every claim in the verdict must be traceable to an entry in evidence, or be labelled as a judgement.
Return the file plus a short note listing the sources you fetched and the questions you could not resolve.

The card's fields, in order, are: `card_id`, `schema_version`, `created_at`, `author`, `status`, `title`, `asset`, `factor_id`, `task_id`, `card_version`, `model`, `family`, `assignment_id`, `session_horizon`, `calendar_and_quote_handling`, `verdict`, `mechanism`, `direction_claim`, `session_role`, `observable_by_cutoff`, `reaction_vs_predictive`, `historical_data_requirements`, `live_data_requirements`, `missing_or_stale_handling`, `dependencies_and_overlap`, `hypotheses`, `rejection_test`, `falsification_tests`, `evidence`, `limitations`, `open_questions`.
The schema is docs/research/handoff/usd/v1/research_card.schema.json (usd-session-research-card-v3); it extends docs/research/usd-session/v1/research-card.schema.json and the field list is the same one the template carries.

## 8. What to answer

- On a 24-hour London-to-London window, is the level of VIX or the change in VIX the informative quantity, and does the 25 / 16 split survive an honest test?
- Is the safe-haven bid that VIX > 25 is meant to signal already in the price at 05:00 London, given that the cutoff follows the US session that produced that print?
- What does the 1-to-2-business-day staleness do to the mechanism, and does the sign depend on what caused the volatility (growth, policy, funding)?

- Hypothesis: State whether the sign of the relation between the VIX regime and the next 24-hour dollar change is stable, or flips, and name the flag that separates the two regimes.
- Falsification: Name a regime split and a metric, computed on training sessions only, on which the deployed 25 / 16 level rule would be shown worse than the flat base rate.
