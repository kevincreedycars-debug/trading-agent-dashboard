# F10 Equity versus USD - baseline audit pack (live.f10-equity-versus-usd)

- Task: USD-BASELINE-AUDIT-10
- Pack version 2.0.0, context version usd-session-context-20261014.1, extracted 2026-10-15 on branch `research/usd-session-20261013` at `d07af11166ea1d39e5f4184e85a993e03bcb7137`.
- The card's `family` field must be `cross_assets`; the pack groups this factor under `cross_asset_appetite`.
- Catalogue status: research ready, review pending, backtest not_tested. Deployed baseline; a one-point weight on every timeframe, on an ETF quote rather than the index.

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
- A session whose start or endpoint print is missing is never filled, forward-carried, interpolated or
  silently extended to Monday. The one proposed missing-quote policy - to be frozen, together with the flat
  band and the study's own tie policy, before any candidate is scored, and recorded in the session contract
  where the entry still reads UNDECIDED - is that such a session is a data exclusion: it leaves the scored
  sample and is reported as coverage rather than as an abstention.
- A data exclusion and a model abstention are different objects and are counted and scored separately. An
  abstention is the model declining to give a direction on a session whose two ends both exist; that
  session stays in the scored sample and is scored as a no-call, and it is never reported as coverage lost.
- The label's flat band and the study's own tie policy for scoring are still undecided; they must be frozen
  with the missing-quote policy before any candidate is scored and may not be borrowed from the closed
  24-hour study.

- The label instrument and its quote source are UNDECIDED. No intraday DXY print exists in this repository or in the live collector, so the label instrument and the quote source are unverified at both ends. If a claim is really about EUR/USD, a custom basket or any other instrument, name that instrument and say so; never present another instrument as DXY. The live collector prices the dollar with FRED DTWEXBGS, which is a feature and cannot be the session label: H.10 publishes on Mondays at 16:15 ET for the previous business week, so at a 05:00 London cutoff that value is 2 to 6 business days old (median 4).

## 3. The deployed baseline for this factor

The cross-asset read of equities against the dollar, gated by the same VIX regime: in calm markets a rising equity market is read as dollar-negative and a falling one as dollar-positive, and in stressed markets a falling equity market is read as dollar-positive. The rulebook's neutral-regime row, equities moving inside 16 to 25, is unhandled in code and falls into the same NEUTRAL branch as a missing input.

- Rule in code: VIX below 16 with NQ up reads BEARISH; VIX below 16 with NQ down BULLISH; VIX above 25 with NQ down BULLISH; every other combination NEUTRAL. No percentage threshold; only the sign of the change is read. Coded weight 1 at every timeframe; rulebook weight 2.
- Input: nq_d1_pct on 24h, else nq_d5_pct, and vix_level from Alpha Vantage GLOBAL_QUOTE on QQQ for the price; the one-day change is the vendor's own change-percent field and the five-day change is computed by historyPct against the collector's stored rows; VIXCLS for the gate (per cent change and index level; sign of the equity change inside a VIX regime; the 24h arm prefers nq_d1_pct and falls back to nq_d5_pct when absent; lookback one day on 24h; five stored rows on every other timeframe; cutoff the quote is read at the pipeline run time and the daily change is the vendor's figure, not a change measured between the cutoff and the session end)
- Weights: coded by timeframe {"24h":1,"3d":1,"current_week":1,"next_week":1,"current_month":1}; rulebook 2. logic/agent_usd_direction.md v2.1, which the live workflow fetches from GitHub on every run; the two vectors and the disagreements between them are catalogued in docs/research/usd-session/v1/weight_vector_discrepancy.md.
- Missing or stale input: A missing NQ change or a missing VIX level returns NEUTRAL with the evidence string 'Missing NQ/VIX'. The unhandled combinations, VIX above 25 with NQ up and the whole 16-to-25 band, also read NEUTRAL, and the payload does not distinguish an unhandled regime from absent data.
- Where this comes from in the code:
  - exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F10: BEARISH when vix_level < 16 and the NQ change is positive, BULLISH when vix_level < 16 and it is negative, BULLISH when vix_level > 25 and it is negative, else NEUTRAL (weight 1 at every timeframe)
  - exports/usd_layer1_agent.json -> Calculate USD Conviction, nqDelta = nq_d1_pct on 24h when present, else nq_d5_pct
  - exports/usd_collector.json -> Normalise Market Snapshot: nq = alphaQuote(getNode('HTTP Request | NQ - Alpha Vantage')), nqD5Pct = historyPct(nq.price, 'nq_price', 4), nqD20Pct = historyPct(nq.price, 'nq_price', 19); equities_regime is stored from the VIX thresholds and read by no factor
- Where the rulebook states it:
  - logic/agent_usd_direction.md section 5, 'Factor 10 - Equity Direction vs USD Correlation Regime' (weight 2; risk-on with VIX below 16 and equities rising BEARISH, falling BULLISH, risk-off with VIX above 25 and equities falling BULLISH, neutral regime NEUTRAL, input missing NEUTRAL with a missing-input note; 'The USD/equity relationship changes by regime' and 'Do not force this factor unless the regime is clear')
- Rulebook passage the card must engage with: "The USD/equity relationship changes by regime. Do not force this factor unless the regime is clear." (logic/agent_usd_direction.md, section 5, Factor 10)

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

- Historical availability for this factor: FRED NASDAQ100 is in the 22-series macro frame from 2024-01-02, but the live factor prices QQQ through Alpha Vantage, so the reconstructable series is not the collected one, and the vendor's change-percent field cannot be reproduced from a cached frame.
- Live availability at the cutoff: One row per collector run: the five-day arm counts stored rows and the one-day arm is the vendor's figure, with no age attached to either and no regime label stored alongside the call.
- This factor needs: An equity series whose change is measured against the cutoff rather than supplied by a vendor, and a decision on whether the factor should use the index or the ETF.

## 5. The engine around the baseline

- The published call is produced by the deterministic node Calculate USD Conviction in the live workflow
  USD Layer 1 Agent (OCt1tB9yVMUgFTha). Two versions matter and they are not the same fact. The executing
  version is v155, published 2026-10-12T19:52:13.451Z by the supervised live apply of the null-conversion
  guard (version id 0fb553c2-b1f1-4afa-bfdc-1166b60a6a79, versionCounter 155, nodes_sha256 b2583215ca25
  6a96dd0d7693635a66681fff42595805cdb254d48ae52960b974). The audited baseline is the repository export
  exports/usd_layer1_agent.json, measured against v154 on 2026-10-11 (scoped export
  2026-10-11T18:59:54.307Z); its Calculate USD Conviction jsCode
  (580f0aa34bc1dd5d210e0dc3391dd653414ac1f68fbc0594133dc597a29254d4) is the same bytes the executing
  version runs, so the arithmetic audited here is the arithmetic in force. The model writes the per-factor
  verdict strings; the code computes every published number, and where they disagree the code wins.
- Coded 24h weights: F1 10, F2 14, F3 10, F4 10, F5 14, F6 4, F7 24, F8 12, F9 1, F10 1 (sum 100).
  The rulebook logic/agent_usd_direction.md v2.1, which the workflow fetches from GitHub on every run,
  publishes F1 10, F2 14, F3 16, F4 14, F5 6, F6 5, F7 3, F8 18, F9 12, F10 2. Both are live and nothing
  reconciles them.
- conviction = round(winning weight / active weight * 100): a share of active evidence, not a probability.
  It can read 100% while half the weight is missing, because a missing input moves to the neutral pile
  instead of into active. Direction carries the suffix _LEAN when |netEdge| < 20; NO_CLEAR_BIAS requires an
  exact tie of the two weight sums, and the deployed 24h vector can produce one (F2 + F3 + F4 + F6 + F8 = 50
  against F1 + F5 + F7 + F9 + F10 = 50), so abstention is reachable arithmetic rather than a designed gate.
  The dashboard publishes a second, separately derived strength bucket, so two strength labels can disagree
  on the same row.
- F7 (coded 24 points) copies a pre-computed usd_signal with no consensus, no first print and no age.
  F8 (12 points) reads a categorical bias string with no vintage. Together 36 of the 100 coded points
  cannot be reproduced from reachable data.
- A missing input scores the factor NEUTRAL and names the missing input; the substitution ladder (d1 to d5
  to d20, gold 5d to 1d, NQ 1d to 5d) records only a warning string and is invisible in the numeric
  payload; snapshot selection has no cutoff bound, no per-field age and no revision exclusion.

- Aggregation: conviction = round(winning side weight / active weight * 100), where active weight is the sum of the bullish and bearish weights only. A missing input cannot lower conviction: its weight leaves active weight, so conviction is a share of the evidence that arrived and can read 100 while half the weight is absent. neutral_pct is a sum of weight points printed with a per-cent sign in the reason string, not a percentage of anything. NO_CLEAR_BIAS requires an exact tie of the two weight sums, so abstention is an arithmetic accident rather than a designed gate.
- Modifiers: logic/agent_usd_direction.md sections 8.2 to 8.5 describe a participation cap, a missing-input penalty, a conflict penalty and an agreement boost. The conviction node implements none of them and returns the rulebook's own names as fixed values, so no published call can have been moved by any of the four.

## 6. What is already open

- Counting stored collector rows for the five-day window makes the factor's history depend on the pipeline's own run history rather than on a trading calendar.
- The risk-appetite signal is already carried by F1 and F9 through the same thresholds, so within calm markets the factor mostly restates F1 with the opposite sign convention.
- The QQQ proxy is an ETF with its own tracking, hours and dividend effects, described in the rulebook as NQ, the index it is not.
- Overlap and double counting: F1 and F9 apply the same 25 and 16 thresholds, F6 reads the same risk appetite through gold, and the factor is the risk-appetite leg of the story F9's smile is built on.
- Timing: The vendor quote is read at the pipeline run time and its one-day change is the vendor's own field, so the factor can describe a move that ended before the cutoff and can restate it again during the session.
- Unresolved data gap: No index-level equity series traced in the live input, no cutoff-to-cutoff change measure, no decision on the neutral band.

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

- Which equity instrument belongs in this factor, the index or the liquid ETF the collector actually prices, and does the choice change the sign inside the calm regime?
- Does a same-day equity change say anything about the next 24 hours once the dollar move that accompanied it is already in the cutoff prices, and how would that be separated without hindsight?
- What should the factor return in the 16-to-25 band and when equities are up while VIX is above 25, given that the rulebook's neutral row and the code's default agree only by accident?

- Hypothesis: State at most two program-evaluable claims about the sign of the equity-dollar relation by regime, each naming the instrument, the cutoff-to-cutoff change measure and the regime proxy, and say which the deployed sign-only rule most resembles.
- Falsification: Name the split and the metric on which the deployed sign-only rule inside the calm regime would be rejected on training sessions only, and state the result for a rule that abstains in the 16-to-25 band.
