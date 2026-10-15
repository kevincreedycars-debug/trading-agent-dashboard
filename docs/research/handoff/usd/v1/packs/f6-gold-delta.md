# F6 Gold delta - baseline audit pack (live.f6-gold-delta)

- Task: USD-BASELINE-AUDIT-06
- Pack version 2.0.0, context version usd-session-context-20261014.1, extracted 2026-10-15 on branch `research/usd-session-20261013` at `d07af11166ea1d39e5f4184e85a993e03bcb7137`.
- The card's `family` field must be `cross_assets`; the pack groups this factor under `safe_haven_overlap`.
- Catalogue status: research ready, review pending, backtest not_tested. Deployed baseline.

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

The change in the spot gold price, read as the anti-dollar leg: gold weakness is scored as dollar support and gold strength as dollar pressure; the deployed code inverts the sign against a 0.1 per cent band, and the rulebook states the same inversion without a numeric band.

- Rule in code: Gold below -0.1 per cent reads BULLISH, gold above +0.1 per cent BEARISH, inside +/- 0.1 per cent NEUTRAL, on the selected lookback. Coded weight 4 on 24h, rulebook weight 5.
- Input: gold_d1_pct, gold_d5_pct, gold_d20_pct from Coinbase spot quote collected by the node 'HTTP Request | Gold - Coinbase'; the percentage changes are computed by the collector's historyPct against its own previously stored snapshot rows ('Supabase | Get Previous Market Snapshots'), so the window is counted in stored pipeline rows rather than in calendar days or exchange sessions (per cent change; percentage change against the row 1, 5 or 20 positions back in the collector's own history, with a fallback to the 1-day column when the 5-day column is missing; lookback 5 stored rows on 24h, 3d and current_week; 20 stored rows on next_week and current_month when gold_d20_pct is present, otherwise the 5-row arm; cutoff spot quote read at the 09:30 ET pipeline time, so the observed price is not a 05:00 London print and no as-of check is applied)
- Weights: coded by timeframe {"24h":4,"3d":8,"current_week":7,"next_week":5,"current_month":5}; rulebook 5. logic/agent_usd_direction.md v2.1, which the live workflow fetches from GitHub on every run; the two vectors and the disagreements between them are catalogued in docs/research/usd-session/v1/weight_vector_discrepancy.md.
- Missing or stale input: A missing gold delta scores NEUTRAL and names the missing input; the input pack silently substitutes `gold_d1_pct` for a missing `gold_d5_pct` and records only a warning string, so a one-row move can be labelled and scored as a five-day move, and the row counts themselves depend on how often the collector ran.
- Where this comes from in the code:
  - exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F6: gold below -0.1 per cent BULLISH, above +0.1 per cent BEARISH, with goldDelta = gold_d20_pct on next_week and current_month, else gold_d5_pct
  - exports/usd_layer1_agent.json -> Build USD Input Pack: goldD5 = gold_d5_pct if present else gold_d1_pct, with the warning 'gold_d5_pct missing; using gold_d1_pct fallback'
  - exports/usd_collector.json -> Normalise Market Snapshot: const goldPrice = coinbasePrice(goldRaw); goldD1Pct = historyPct(goldPrice, 'gold_price', 0), goldD5Pct = historyPct(goldPrice, 'gold_price', 4), goldD20Pct = historyPct(goldPrice, 'gold_price', 19)
- Where the rulebook states it:
  - logic/agent_usd_direction.md section 5, 'Factor 6 - Gold 5-Day Delta' (weight 5; gold falling over 5 days BULLISH, rising over 5 days BEARISH, gold flat NEUTRAL, plus the instruction to flag a possible safe-haven conflict when gold rises while the dollar strengthens)
- Rulebook passage the card must engage with: "Gold is a clean anti-USD signal in normal regimes. If gold is rising while USD is also strengthening, flag a possible safe-haven conflict." (logic/agent_usd_direction.md, section 5, Factor 6)

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

- Historical availability for this factor: A Coinbase spot price is retrievable historically, but the closed study's cache and the macro frame record no gold series traced in this cycle, so the row-based window has no obvious historical equivalent.
- Live availability at the cutoff: One quote per collector run, no vintage, no benchmark time, and the deltas are only as regular as the pipeline's run history.
- This factor needs: A gold price series with a fixed daily benchmark time, and a window counted in calendar or session time rather than in pipeline rows.

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

- A Coinbase spot quote carries no official close, so the price and the row-counted window are pipeline artefacts rather than market benchmarks.
- The code's 0.1 per cent band appears nowhere in the rulebook, which states no threshold at all, and the rulebook's safe-haven conflict flag has no code behind it.
- Gold, real yields and the dollar are three readings of one complex, and with a coded weight of 4 the factor's only content is its sign.
- Overlap and double counting: F4 already reads the real-rate complex from the other side, and F1, F9 and F10 read the same risk appetite through VIX and equities; when gold and the dollar rise together the rulebook tells the model to flag a safe-haven conflict, while the code carries a conflict penalty that is hard-coded to zero.
- Timing: The price is read at the pipeline's run time rather than at the cutoff, and the row-based window can begin and end at places no trading calendar recognises.
- Unresolved data gap: No benchmark time for the collected gold price; no gold series traced in the historical frame; the conflict flag exists only in the rulebook.

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

- Does a spot gold quote have a benchmark time that can be read at 05:00 London, or is the factor measuring whichever intraday print the pipeline happened to see?
- Is the inverse gold-dollar relation a stable mechanism or a regime artefact, and what does the factor add beyond the real-yield factor that reads the same complex?
- How should the five-day window be counted - calendar sessions, business days, or the stored collector rows the code actually uses - and does the choice change the factor's history?

- Hypothesis: State at most two program-evaluable claims for an inverse gold-dollar relation over the next 24 hours, each with a stated benchmark time and window, and say which one the deployed spot-and-row-count rule most resembles.
- Falsification: Name the split and the metric on which the deployed +/- 0.1 per cent gold band would be rejected on training sessions only, and say what the result would be if the sign were simply carried from the real-yield factor of the same complex.
