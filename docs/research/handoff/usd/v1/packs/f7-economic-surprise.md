# F7 US economic surprise - baseline audit pack (live.f7-economic-surprise)

- Task: USD-BASELINE-AUDIT-07
- Pack version 2.0.0, context version usd-session-context-20261014.1, extracted 2026-10-15 on branch `research/usd-session-20261013` at `d07af11166ea1d39e5f4184e85a993e03bcb7137`.
- The card's `family` field must be `macroeconomic_releases`; the pack groups this factor under `event_surprises`.
- Catalogue status: research blocked, review pending, backtest not_tested. Highest coded weight on the 24h timeframe at 24 points, against a rulebook weight of 3.
- Blocked by: No consensus or first-print vintage source is reachable from this repository.

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

The dollar-side read of the most recent completed US release: the collector stores a per-event signal string and the conviction node copies that string; the magnitude of the surprise, the consensus it was measured against and the event's age are never read.

- Rule in code: BULLISH reads BULLISH (positive US surprise supports USD), BEARISH reads BEARISH, any other string or a missing event reads NEUTRAL. No threshold, no surprise magnitude. Coded weight 24 on 24h, 8 on 3d, 5 on current_week, 6 on next_week, 5 on current_month; rulebook weight 3 inside a 72-hour window.
- Input: latest_us_event.usd_signal from the event row the collector stores ('Supabase | Get Today USD Economic Events'), passed through 'Code | Derive USD Eco Inputs' to 'Normalise Market Snapshot'; the string is one of BULLISH, BEARISH or NEUTRAL and its producer is not reachable in the collector export, because every node that would compute it from a calendar ('HTTP Request | Eco Calendar Recent - Finnhub', 'HTTP Request | Eco Calendar Upcoming - Finnhub', 'Code | Process Eco Data', 'Code | Derive Fed Bias') is an entry point with no consumer in this workflow (categorical string; none; the string is scored as it is stored; lookback the single latest completed event the row carries, whatever its age; cutoff no as-of check; the stored event also carries date and time fields that the signal rule never reads)
- Weights: coded by timeframe {"24h":24,"3d":8,"current_week":5,"next_week":6,"current_month":5}; rulebook 3. logic/agent_usd_direction.md v2.1, which the live workflow fetches from GitHub on every run; the two vectors and the disagreements between them are catalogued in docs/research/usd-session/v1/weight_vector_discrepancy.md.
- Missing or stale input: A null `latest_us_event` scores NEUTRAL with the evidence string 'No recent US event'. The collector also appends latest_us_event to the snapshot's missing array and marks source_status partial, but the agent end sees only the null, so a partial row and a healthy row produce the same factor reading. A stale event is indistinguishable from a fresh one: nothing holds the rulebook's 72-hour window, and neither a consensus revision nor a first print is detectable.
- Where this comes from in the code:
  - exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F7: BULLISH if ev.usd_signal === 'BULLISH', BEARISH if 'BEARISH', else NEUTRAL (weight 24 on 24h)
  - exports/usd_layer1_agent.json -> Build USD Input Pack (latest_us_event exposed to the model and listed among the must-be-neutral inputs when absent)
  - exports/usd_collector.json -> Normalise Market Snapshot: latestUsEvent = ecoDataRaw?.latest_us_event || null, followed by checkMissing('latest_us_event', latestUsEvent). The helper latestUsEventFromEcoData, which would recompute usd_signal from actual against forecast and invert the sign for Unemployment Rate and Initial Jobless Claims, and the helper upcomingEventsFromEcoData are both defined and never called, so the stored string is read unexamined
- Where the rulebook states it:
  - logic/agent_usd_direction.md section 5, 'Factor 7 - US Economic Surprise Direction' (weight 3; the expected input structure carries an age_hours field and a 72-hour window; only confirmed actual-versus-consensus data may be counted)
- Rulebook passage the card must engage with: "Recent US data beat consensus BULLISH; missed consensus BEARISH; no significant US data in last 72 hours NEUTRAL; input missing NEUTRAL with missing input note. Only count confirmed actual-vs-consensus data. Never judge a release by absolute strength." (logic/agent_usd_direction.md, section 5, Factor 7)

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

- Historical availability for this factor: No consensus or first-print archive is committed. The calendar in the closed study's data records release times without consensus values and an ALFRED vintage file needs a key, so a historical surprise series cannot be rebuilt from this repository.
- Live availability at the cutoff: One row per day, with an event date and time stored but never tested for age, and no vintage of either the consensus or the stored string.
- This factor needs: A consensus forecast archive with a first-print vintage, so that a surprise magnitude can be formed and dated.

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

- The string that decides 24 of the 100 points is produced outside the reachable workflow, so its sign convention, its consensus and its treatment of an in-line print cannot be checked from this repository.
- A release whose effect is already in the price at 05:00 London is not a forecast, and this factor cannot distinguish the two unless the event's timestamp is read and the cutoff move is netted off.
- The rulebook's own 72-hour condition is unimplemented, so the deployed factor can score a week-old event as a fresh catalyst.
- Overlap and double counting: A release moves the same rates and price inputs that F2, F4 and F5 read, so one surprise can enter the score three or four times; F8 is derived from the same stored event rows and F9 reads the same regime.
- Timing: The event row is read once per collector run, and nothing checks whether the release preceded the cutoff or falls inside the session being forecast.
- Unresolved data gap: No consensus archive, no first-print vintage, no producer for the usd_signal string inside this repository, and no age test.

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

- Which consensus should the surprise be measured against, and where is a first-print vintage that survives revision so the surprise is not restated after the fact?
- The rulebook model input carries age_hours and a 72-hour window while the stored row carries a date and a time; what is the correct age measure at a 05:00 London cutoff, and what should happen when the latest completed release is a week old?
- Does an event surprise still carry information about the next 24 hours once the rates and dollar moves the release caused are already in the cutoff prices read by F2, F4 and F5?

- Hypothesis: State at most two program-evaluable claims linking a dated, consensus-measured surprise to the next 24-hour dollar change, each naming the release set, the age window and the sign convention, and say which the deployed stored-string rule most resembles.
- Falsification: Name the split and the metric on which the deployed 24-point weight on a stored string would be rejected on training sessions only, and say what the result looks like if the factor were replaced by the price move the release caused before the cutoff.
