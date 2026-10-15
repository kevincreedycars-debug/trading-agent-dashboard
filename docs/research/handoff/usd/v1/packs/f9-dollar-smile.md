# F9 Dollar Smile regime - baseline audit pack (live.f9-dollar-smile)

- Task: USD-BASELINE-AUDIT-09
- Pack version 2.0.0, context version usd-session-context-20261014.1, extracted 2026-10-15 on branch `research/usd-session-20261013` at `d07af11166ea1d39e5f4184e85a993e03bcb7137`.
- The card's `family` field must be `risk_conditions`; the pack groups this factor under `risk_regime`.
- Catalogue status: research ready, review pending, backtest not_tested. Deployed baseline; the coded weight of 1 on the 24h timeframe makes the smile's separate content nearly invisible in the published number.

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

The Dollar Smile read of the regime: the dollar is expected to be bid at the two extremes of the smile and offered in the middle, so the deployed rule looks for a high-volatility regime or for a calm regime whose bias string is not hawkish. The rulebook's bullish left side, US growth outperforming global growth with a hawkish Fed, has no input in the code.

- Rule in code: VIX above 25 reads BULLISH; VIX below 16 while the bias string does not contain 'hawkish' reads BEARISH; every other case NEUTRAL. Coded weight 1 on 24h, 3 on 3d, 5 on current_week, 10 on next_week, 10 on current_month; rulebook weight 12.
- Input: vix_level, fed_bias from FRED VIXCLS through the collector's vix_level field and the collector-derived fed_bias string (index level and categorical string; level comparisons at 25 and 16 plus a substring test for hawkish; lookback levels only; no change in VIX and no change in bias is read, although the rulebook lists vix_d1 and vix_d5; cutoff inherits both inputs: VIXCLS is a market-close series and the bias string is recomputed once per collector run)
- Weights: coded by timeframe {"24h":1,"3d":3,"current_week":5,"next_week":10,"current_month":10}; rulebook 12. logic/agent_usd_direction.md v2.1, which the live workflow fetches from GitHub on every run; the two vectors and the disagreements between them are catalogued in docs/research/usd-session/v1/weight_vector_discrepancy.md.
- Missing or stale input: A missing VIX level returns NEUTRAL with the evidence string 'No clear Dollar Smile edge', which is the same answer the factor gives whenever VIX sits between 16 and 25 or the bias string is unknown, so a missing input and an uninformative regime are indistinguishable in the payload. The rulebook's permission to score NEUTRAL to avoid double-counting F1 is not implemented as a test.
- Where this comes from in the code:
  - exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F9: BULLISH when vix_level > 25, BEARISH when vix_level < 16 and the bias string does not include 'hawkish', else NEUTRAL (weight 1 on 24h)
  - exports/usd_layer1_agent.json -> Build USD Input Pack (vix_level, vix_d1, vix_d5 and fed_bias exposed to the model)
  - exports/usd_collector.json -> Normalise Market Snapshot: equities_regime is stored from the same 16 and 25 thresholds but no conviction factor reads it
- Where the rulebook states it:
  - logic/agent_usd_direction.md section 5, 'Factor 9 - Dollar Smile Regime' (weight 12; BULLISH on VIX above 25 or an active crisis, BULLISH on US growth outperforming global growth with a hawkish Fed, BEARISH on moderate US growth with decent global growth; the section instructs 'Avoid double-counting Factor 1' and permits NEUTRAL when Factor 1 already carries the whole risk signal)
- Rulebook passage the card must engage with: "VIX > 25 or active crisis BULLISH; US growth outperforming global growth with hawkish Fed BULLISH; US growth moderate and global growth decent BEARISH; insufficient regime evidence NEUTRAL. Avoid double-counting Factor 1." (logic/agent_usd_direction.md, section 5, Factor 9)

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

- Historical availability for this factor: VIXCLS is reachable from 2023-04-03 in the closed study's cache and from 2024-01-02 in the 22-series macro frame, but the second condition needs a bias history that is not committed and the left side needs a growth series the collector never stores, so at most the high-volatility arm can be reconstructed.
- Live availability at the cutoff: Both inputs are read once per collector run with no per-field age and no stored regime label.
- This factor needs: A verified publication time for VIXCLS, a retained vintage of the bias string, and a growth measure for the smile's left side.

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

- The implemented BEARISH arm, calm VIX and a bias string that is not hawkish, is not the middle of the smile the rulebook describes, so the deployed factor is a different rule wearing the smile's name.
- With F1 reading the same thresholds at weight 10 and this factor at weight 1 on the 24h timeframe, the factor's marginal contribution to the published number is a rounding step.
- The left side of the smile, US exceptionalism, has no input at all, so the rulebook's second bullish arm cannot be implemented from the collector as it stands.
- Overlap and double counting: F1 applies the same 25 and 16 thresholds to the same VIX level, F10 gates on them again, and F8 reads the same bias string, so this factor adds only the 'not hawkish' test on top of F1 on the timeframe where both are scored.
- Timing: The regime is read from a market-close VIX level and a string recomputed once per collector run, so the label can describe the previous US close rather than the London morning being traded.
- Unresolved data gap: No growth measure for the smile's left side, no bias vintage, no published calibration for the 25 and 16 thresholds.

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

- Does the smile hold as a regime description on a 24-hour window, and which of its three arms is actually testable with data this repository can reach?
- If the smile's middle is defined by moderate US growth against decent global growth, which growth measures should represent the two sides, and how do they avoid becoming a second reading of F1?
- Should F9 abstain whenever F1 already carries the risk signal, as the rulebook permits, and does that abstention change the published direction or only the strength label?

- Hypothesis: State at most two program-evaluable claims about the dollar's behaviour at the extremes of the smile versus its middle, each naming the regime proxy, the window and how double-counting with F1 is removed.
- Falsification: Name the split and the metric on which the deployed calm-VIX-and-not-hawkish arm would be rejected on training sessions only, and state what the same test shows for a factor that abstains whenever F1 is active.
