# Neutral context pack - what a VIX report may assume

Generated 2026-10-15 on branch `research/usd-session-20261013` at `d07af11166ea1d39e5f4184e85a993e03bcb7137`. Deep-research tier 1.0.0, context version usd-session-context-20261014.1. Facts only, read from `docs/research/usd-session/v1/session_contract_v1.json`, `data/research-library/catalog.json` and the extracted register.

## 0. Why this pack exists and what it deliberately leaves out

The report of step 1 is written without our own earlier thinking in front of it. Anchoring is the failure mode here: a reader handed our questions will answer our questions, and a reader handed a hypothesis will test that hypothesis rather than find the right one.

So this pack carries five things and nothing else:

1. the session definition (section 1);
2. the factors that exist in this system (section 2);
3. the rules that execute today, as code facts (section 3);
4. the data that exists and its staleness at the cutoff (section 4);
5. the decisions still open (section 5).

It deliberately excludes, and no sentence in it is derived from:

- every prior research conclusion in this repository about VIX, about the dollar and about this session;
- every proposed hypothesis, hypothesis seed, falsification prompt and rejection test for any factor;
- every card verdict, ranking, score, weight of importance or recommendation, and the assembled synthesis of the earlier session research;
- the register's and the briefs' own research prompts, open questions, counterarguments, timing notes, overlap notes, data asks and gap statements - the fields written to steer a card answer rather than to state a fact about the system;
- the returned card of pilot 1 and the source note with it, which are recorded elsewhere as preliminary and unreviewed.

Those texts are kept out on purpose, and the omission is checkable rather than promised: the pack is generated without those fields, and the guards fail if any of them appears in it. If a claim in the report matters, it must come from a source the report itself fetched, not from this file.

A row in this pack is a fact about what is deployed or what is reachable. It is not a finding, not an endorsement, and not an ordering by expected value: the factor order below is the committed catalogue's order.

## 1. The session

- Contract: `docs/research/usd-session/v1/session_contract_v1.json`, horizon_id `london-0500-to-london-0500-next-day`, status `RESEARCH_DECLARED_NOT_WIRED`, corrected 2026-10-14, production_enabled false, trade_eligible false.
- Start: 05:00 Europe/London. End: 05:00 Europe/London on the next local date. Nominal length 24 hours; one directional call per local date is the design's intent.
- Weekday rule: A session starts at 05:00 London on a Monday-to-Friday local date only; Saturday and Sunday starts are never sessions. The London spring transition (01:00Z on the last Sunday of March) and the autumn transition (01:00Z on the last Sunday of October) both fall inside the session that starts on the preceding Saturday, so that start measures 23 hours in spring and 25 in autumn and is excluded; every eligible session is therefore exactly 24 hours, held by test over every Monday-to-Friday start from 2023 to 2027.
- Zone rule: 05:00Z while London is on GMT, 04:00Z while London is on BST; the London transitions carried by the contract are 2026-03-29T01:00:00Z and 2026-10-25T01:00:00Z.
- As-of rule for every input: every input value must carry an observation instant at or before the cutoff instant; later revisions are not permitted
- The deployed engine's own window, for contrast: 09:30 America/New_York to 16:00 America/New_York close of the next valid trading session, a measured median of 30.5 elapsed hours.
- How the deployed engine's own calls relate to this window: the deployed engine's stored calls score on the new label only as a diagnostic arm and every table says so; the deployed engine was never asked this question (09:30 ET to the next 16:00 ET close, 30.5 hours at the median) and was never asked to forecast from 05:00 London
- What the closed study behind it measured: Measured on the closed study's own 583 evaluable rows, resolved with this contract's engine interface: the study's interval overlaps the corrected session for 14.5 hours on 528 rows and 15.5 hours on 55 rows (the weeks when New York has changed and London has not); the session's first 9.5 hours (8.5 in those weeks), New York time 00:00 to 09:30, are not covered by the study at all; and the study's interval runs a median 16 hours past the session's endpoint (min 15, max 88 on the 24 delayed-endpoint rows).
- Families declared over the whole USD programme: foreign rates and policy expectations, macroeconomic releases, risk conditions, USD price behaviour, cross-assets, calendar context.

## 2. The factors that exist (25: 10 deployed, 15 session-research)

| # | Factor id | Label | Group | Role | Rule in force | Research | Review | Backtest | Covered by |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `live.f1-vix-level` | F1 VIX level and risk regime | live_engine | regime context | deployed, 24h weight 10 coded / 10 rulebook | ready | pending | not_tested | `USD-BASELINE-AUDIT-01` |
| 2 | `live.f2-us-2y-delta` | F2 US 2Y yield delta | live_engine | direction | deployed, 24h weight 14 coded / 14 rulebook | ready | pending | not_tested | `USD-BASELINE-AUDIT-02` |
| 3 | `live.f3-us-de-2y-spread-delta` | F3 US-DE 2Y spread delta | live_engine | direction | deployed, 24h weight 10 coded / 16 rulebook | ready | pending | not_tested | `USD-BASELINE-AUDIT-03` |
| 4 | `live.f4-real-yield-delta` | F4 US 10Y real yield delta | live_engine | direction | deployed, 24h weight 10 coded / 14 rulebook | ready | pending | not_tested | `USD-BASELINE-AUDIT-04` |
| 5 | `live.f5-dxy-delta` | F5 DXY delta | live_engine | direction | deployed, 24h weight 14 coded / 6 rulebook | ready | pending | not_tested | `USD-BASELINE-AUDIT-05` |
| 6 | `live.f6-gold-delta` | F6 Gold delta | live_engine | direction | deployed, 24h weight 4 coded / 5 rulebook | ready | pending | not_tested | `USD-BASELINE-AUDIT-06` |
| 7 | `live.f7-economic-surprise` | F7 US economic surprise | live_engine | direction | deployed, 24h weight 24 coded / 3 rulebook | blocked | pending | not_tested | `USD-BASELINE-AUDIT-07` |
| 8 | `live.f8-fed-bias` | F8 Fed bias | live_engine | direction | deployed, 24h weight 12 coded / 18 rulebook | blocked | pending | not_tested | `USD-BASELINE-AUDIT-08` |
| 9 | `live.f9-dollar-smile` | F9 Dollar Smile regime | live_engine | regime context | deployed, 24h weight 1 coded / 12 rulebook | ready | pending | not_tested | `USD-BASELINE-AUDIT-09` |
| 10 | `live.f10-equity-versus-usd` | F10 Equity versus USD | live_engine | regime context | deployed, 24h weight 1 coded / 2 rulebook | ready | pending | not_tested | `USD-BASELINE-AUDIT-10` |
| 11 | `fx.usd-session-momentum` | USD session momentum | research_session_v1 | direction | none in force | ready | pending | not_tested | `USD-SESSION-A1` |
| 12 | `fx.usd-overnight-range-position` | USD overnight range position | research_session_v1 | direction | none in force | ready | pending | not_tested | `USD-SESSION-A1` |
| 13 | `fx.usd-session-volatility-regime` | USD session volatility regime | research_session_v1 | abstention gate | none in force | ready | pending | not_tested | `USD-SESSION-A1` |
| 14 | `risk.vix-level-and-change-at-cutoff` | VIX level and change at the cutoff | research_session_v1 | regime | none in force | ready | pending | not_tested | `USD-SESSION-A1` |
| 15 | `risk.risk-on-off-cross-asset-state` | Risk-on and risk-off cross-asset state | research_session_v1 | regime | none in force | ready | pending | not_tested | `USD-SESSION-A1` |
| 16 | `risk.usd-safe-haven-demand` | USD safe-haven demand | research_session_v1 | direction | none in force | ready | pending | not_tested | `USD-SESSION-A1` |
| 17 | `data.quality-gate-for-abstention` | Data quality gate for abstention | research_session_v1 | quality gate | none in force | ready | pending | not_tested | `USD-SESSION-A1` |
| 18 | `rates.us-front-end-delta` | US front-end delta | research_session_v1 | direction | none in force | ready | pending | not_tested | `USD-SESSION-A2` |
| 19 | `rates.relative-front-end-delta` | Relative front-end delta | research_session_v1 | direction | none in force | ready | pending | not_tested | `USD-SESSION-A2` |
| 20 | `rates.real-yield-delta` | Real yield delta | research_session_v1 | direction | none in force | ready | pending | not_tested | `USD-SESSION-A2` |
| 21 | `rates.term-premium-and-curve` | Term premium and curve | research_session_v1 | regime | none in force | ready | pending | not_tested | `USD-SESSION-A2` |
| 22 | `rates.credit-spread-delta` | Credit spread delta | research_session_v1 | regime | none in force | ready | pending | not_tested | `USD-SESSION-A2` |
| 23 | `calendar.known-releases-between-cutoff-and-endpoint` | Known releases inside the window | research_session_v1 | quality gate | none in force | ready | pending | not_tested | `USD-SESSION-A2` |
| 24 | `calendar.days-since-and-until-high-impact-events` | Distance from high-impact events | research_session_v1 | regime | none in force | ready | pending | not_tested | `USD-SESSION-A2` |
| 25 | `macro.release-surprise-at-first-print` | Release surprise at first print | research_session_v1 | direction | none in force | blocked | pending | not_tested | `USD-SESSION-A2` |

A factor's own brief is not part of this pack: the 25 packs are assignments one level up in `packs`, and they carry the research prompts this pack deliberately omits.

## 3. The rules that execute today

These are code facts, taken from the register beside `data/research-library/catalog.json`, from exports/usd_layer1_agent.json and from logic/agent_usd_direction.md v2.1. They are the object of the audit. They are never evidence for a claim about VIX, about the dollar or about the session.

### 3.1 The path that produces the published call

- The published call is produced by the deterministic node Calculate USD Conviction in the live workflow USD Layer 1 Agent (OCt1tB9yVMUgFTha). USD Layer 1 Agent, workflow OCt1tB9yVMUgFTha: executing version v155 (version id 0fb553c2-b1f1-4afa-bfdc-1166b60a6a79, versionCounter 155, published 2026-10-12T19:52:13.451Z by the supervised live apply of the null-conversion guard, nodes_sha256 b2583215ca256a96dd0d7693635a66681fff42595805cdb254d48ae52960b974); the audited baseline is the repository export exports/usd_layer1_agent.json, measured against v154 on 2026-10-11 (scoped export 2026-10-11T18:59:54.307Z), whose Calculate USD Conviction jsCode sha256 is 580f0aa34bc1dd5d210e0dc3391dd653414ac1f68fbc0594133dc597a29254d4, the same bytes the executing version runs.
- The model writes the per-factor verdict strings; the code computes every published number, and where they disagree the code wins. Collector: Data Collector - USD, export exports/usd_collector.json (repository snapshot; the live collector id was not in the scoped identity file); runtime: n8n Cloud, workspace https://silver17.app.n8n.cloud (project ISQG9XU7TGTT6Fcu).
- logic/agent_usd_direction.md sections 8.2 to 8.5 describe a participation cap, a missing-input penalty, a conflict penalty and an agreement boost. The conviction node implements none of them and returns the rulebook's own names as fixed values, so no published call can have been moved by any of the four.
- conviction = round(winning side weight / active weight * 100), where active weight is the sum of the bullish and bearish weights only. The published strength label and the dashboard's separately derived bucket can disagree on the same row; the full arithmetic is stated in `docs/research/handoff/usd/v1/USD_SYSTEM_CONTEXT.md` and in `docs/research/handoff/usd/v1/USD_FACTOR_REGISTER.md`.

### 3.2 The two weight vectors, by timeframe

| Vector | F1 | F2 | F3 | F4 | F5 | F6 | F7 | F8 | F9 | F10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| coded 24h | 10 | 14 | 10 | 10 | 14 | 4 | 24 | 12 | 1 | 1 |
| coded 3d | 8 | 16 | 16 | 16 | 14 | 8 | 8 | 10 | 3 | 1 |
| coded current_week | 5 | 14 | 18 | 18 | 15 | 7 | 5 | 12 | 5 | 1 |
| coded next_week | 4 | 12 | 20 | 18 | 6 | 5 | 6 | 18 | 10 | 1 |
| coded current_month | 3 | 12 | 18 | 20 | 8 | 5 | 5 | 18 | 10 | 1 |
| rulebook v2.1 | 10 | 14 | 16 | 14 | 6 | 5 | 3 | 18 | 12 | 2 |

Aggregation: conviction = round(winning side weight / active weight * 100), where active weight is the sum of the bullish and bearish weights only.

### 3.3 Each deployed factor's rule, as the code reads it

- **F1 F1 VIX level and risk regime** (`live.f1-vix-level`, task `USD-BASELINE-AUDIT-01`) - VIX > 25 reads BULLISH, 16 to 25 NEUTRAL, below 16 BEARISH. Level only. Threshold 25 / 16. Coded weight 10, rulebook weight 10, deployed in signals.F1.
  - input `vix_level` from FRED VIXCLS, stored by the USD collector; units index; transform level, no transformation; lookback none; at the cutoff 1 to 2 business days old at 05:00 London; this family's publication time carries a declared assumption, not a verified schedule
  - missing or stale: A missing level scores F1 NEUTRAL and names the missing input. The null-versus-unavailable guard was repaired in the repository on 2026-10-11 and applied to the live workflow on 2026-10-12, which published v155; with every input present the repaired engine returns the recorded verdicts unchanged, so no recorded call with a complete input set moved.
  - code: exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F1 (thresholds 25 and 16, weight 10) | exports/usd_layer1_agent.json -> Build USD Input Pack (vix_level, vix_d1, vix_d5 exposed to the model)
- **F2 F2 US 2Y yield delta** (`live.f2-us-2y-delta`, task `USD-BASELINE-AUDIT-02`) - At or above +5 bps reads BULLISH, at or below -5 bps BEARISH, otherwise NEUTRAL. Threshold +/- 5 bps. Coded weight 14, rulebook weight 14.
  - input `us_2y_d5_bps, us_2y_d20_bps` from FRED DGS2, stored by the USD collector; units basis points; transform difference of the level over the lookback; lookback 5 days on 24h, 20 days on longer timeframes; at the cutoff 1 to 2 business days old; a daily series, so the cutoff value is the previous close
  - missing or stale: A missing delta scores NEUTRAL and names the missing input; the 20d-to-5d substitution on longer timeframes is only a warning string.
  - code: exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F2 via signalFromDelta(us2yDelta, 5, -5, ...) | exports/usd_layer1_agent.json -> Build USD Input Pack (us_2y_d5_bps, us_2y_d20_bps)
- **F3 F3 US-DE 2Y spread delta** (`live.f3-us-de-2y-spread-delta`, task `USD-BASELINE-AUDIT-03`) - At or above +5 bps reads BULLISH, at or below -5 bps BEARISH, otherwise NEUTRAL, on one fixed five-day window. Threshold +/- 5 bps. Coded weight 10, rulebook weight 16.
  - input `us_de_2y_spread_d5_bps` from computed in the collector from FRED DGS2 (node 'HTTP Request | US 2Y Treasury Yield - FRED API') and a Bundesbank CSV German 2Y node ('HTTP Request | Germany 2Y Yield'), stored by the USD collector; units basis points; transform five-day difference of the spread level; lookback 5 days at every timeframe; at the cutoff inherits the older leg; the German CSV and the US close are 1 to 2 business days old at 05:00 London
  - missing or stale: A missing spread delta scores NEUTRAL and names the missing input; the input pack also lists `de_2y_yield`, `us_de_2y_spread` and `us_de_2y_spread_d5_bps` as must-be-neutral if unavailable. The spread's 1-day and 20-day deltas are exposed to the model and never read by the code, and the collector stores no 20-day German 2Y delta at all.
  - code: exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F3 = signalFromDelta(inputs.us_de_2y_spread_d5_bps, 5, -5, ...) at every timeframe | exports/usd_collector.json -> Normalise Market Snapshot: us_de_2y_spread = spread(us2y.latest, de2y.latest), us_de_2y_spread_d5_bps = spreadD5(us2y, de2y); de2y parsed by bundesbankCsv | exports/usd_layer1_agent.json -> Build USD Input Pack (us_de_2y_spread, us_de_2y_spread_d1_bps, us_de_2y_spread_d5_bps, us_de_2y_spread_d20_bps)
- **F4 F4 US 10Y real yield delta** (`live.f4-real-yield-delta`, task `USD-BASELINE-AUDIT-04`) - At or above +5 bps reads BULLISH, at or below -5 bps BEARISH, otherwise NEUTRAL, on whichever lookback the timeframe selects. Threshold +/- 5 bps. Coded weight 10, rulebook weight 14.
  - input `us_10y_real_yield_d5_bps, us_10y_real_yield_d20_bps` from FRED DFII10 (node 'HTTP Request | TIPS 10Y Real Yield - FRED Api'), stored by the USD collector; units basis points; transform difference of the level over the lookback; lookback 5 days on 24h, 3d and current_week; 20 days on next_week and current_month when the optional field is present; at the cutoff Federal Reserve H.15 family, 1 to 2 business days old at 05:00 London, median 1
  - missing or stale: A missing delta scores NEUTRAL and names the missing input; the 20d-to-5d substitution on the two long timeframes is only a warning string, and because the 20-day field is optional in the snapshot a null there silently changes the lookback the factor is scored on.
  - code: exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F4 = signalFromDelta(realYieldDelta, 5, -5, ...), where realYieldDelta takes us_10y_real_yield_d20_bps on next_week and current_month, else us_10y_real_yield_d5_bps | exports/usd_layer1_agent.json -> Build USD Input Pack (us_10y_real_yield, us_10y_real_yield_d5_bps, us_10y_real_yield_d20_bps)
- **F5 F5 DXY delta** (`live.f5-dxy-delta`, task `USD-BASELINE-AUDIT-05`) - On 24h: at or above +0.15 per cent BULLISH, at or below -0.15 per cent BEARISH, otherwise NEUTRAL. On every other timeframe: +/- 0.30 per cent. Coded weight 14 on 24h, rulebook weight 6.
  - input `dxy_d1, dxy_d5, dxy_d20` from collected by the USD collector node 'HTTP Request | DXY - FRED Dollar Index - FRED API' and turned into percentage changes by fredPct (offsets of 1, 5 and 20 observations of the returned series); target_source_assessment.md records the stored series as FRED DTWEXBGS, the Federal Reserve H.10 nominal broad U.S. dollar index, not the ICE DXY basket, and the source page states that all values are subject to revision; units per cent change of the index level; transform percentage change over 1, 5 or 20 observations of the series; lookback 1 day on 24h; 5 days on 3d and current_week; 20 days on next_week and current_month when dxy_d20 is present; at the cutoff 2 to 6 business days old at 05:00 London, median 4, because the H.10 family is released on Mondays at 16:15 ET for the previous business week
  - missing or stale: A missing delta scores NEUTRAL and names the missing input. The substitutions are silent and one of them changes the test: on 24h a null `dxy_d1` moves the factor to `dxy_d5` while the threshold stays at the 1-day 0.15 per cent, so a five-day move is judged on the tighter band, and on the two long timeframes a null `dxy_d20` moves it to `dxy_d5`. Neither substitution reaches the numeric payload.
  - code: exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F5 = signalFromDelta(dxyDelta, tf === '24h' ? 0.15 : 0.3, tf === '24h' ? -0.15 : -0.3, ...) with dxyDelta = dxy_d20 on next_week and current_month, else dxy_d1 on 24h, else dxy_d5 | exports/usd_collector.json -> Normalise Market Snapshot: const dxy = fredPct(dxyRaw); dxy_level = dxy.latest, dxy_d1 = dxy.d1, dxy_d5 = dxy.d5, dxy_d20 = dxy.d20
- **F6 F6 Gold delta** (`live.f6-gold-delta`, task `USD-BASELINE-AUDIT-06`) - Gold below -0.1 per cent reads BULLISH, gold above +0.1 per cent BEARISH, inside +/- 0.1 per cent NEUTRAL, on the selected lookback. Coded weight 4 on 24h, rulebook weight 5.
  - input `gold_d1_pct, gold_d5_pct, gold_d20_pct` from Coinbase spot quote collected by the node 'HTTP Request | Gold - Coinbase'; the percentage changes are computed by the collector's historyPct against its own previously stored snapshot rows ('Supabase | Get Previous Market Snapshots'), so the window is counted in stored pipeline rows rather than in calendar days or exchange sessions; units per cent change; transform percentage change against the row 1, 5 or 20 positions back in the collector's own history, with a fallback to the 1-day column when the 5-day column is missing; lookback 5 stored rows on 24h, 3d and current_week; 20 stored rows on next_week and current_month when gold_d20_pct is present, otherwise the 5-row arm; at the cutoff spot quote read at the 09:30 ET pipeline time, so the observed price is not a 05:00 London print and no as-of check is applied
  - missing or stale: A missing gold delta scores NEUTRAL and names the missing input; the input pack silently substitutes `gold_d1_pct` for a missing `gold_d5_pct` and records only a warning string, so a one-row move can be labelled and scored as a five-day move, and the row counts themselves depend on how often the collector ran.
  - code: exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F6: gold below -0.1 per cent BULLISH, above +0.1 per cent BEARISH, with goldDelta = gold_d20_pct on next_week and current_month, else gold_d5_pct | exports/usd_layer1_agent.json -> Build USD Input Pack: goldD5 = gold_d5_pct if present else gold_d1_pct, with the warning 'gold_d5_pct missing; using gold_d1_pct fallback' | exports/usd_collector.json -> Normalise Market Snapshot: const goldPrice = coinbasePrice(goldRaw); goldD1Pct = historyPct(goldPrice, 'gold_price', 0), goldD5Pct = historyPct(goldPrice, 'gold_price', 4), goldD20Pct = historyPct(goldPrice, 'gold_price', 19)
- **F7 F7 US economic surprise** (`live.f7-economic-surprise`, task `USD-BASELINE-AUDIT-07`) - BULLISH reads BULLISH (positive US surprise supports USD), BEARISH reads BEARISH, any other string or a missing event reads NEUTRAL. No threshold, no surprise magnitude. Coded weight 24 on 24h, 8 on 3d, 5 on current_week, 6 on next_week, 5 on current_month; rulebook weight 3 inside a 72-hour window.
  - input `latest_us_event.usd_signal` from the event row the collector stores ('Supabase | Get Today USD Economic Events'), passed through 'Code | Derive USD Eco Inputs' to 'Normalise Market Snapshot'; the string is one of BULLISH, BEARISH or NEUTRAL and its producer is not reachable in the collector export, because every node that would compute it from a calendar ('HTTP Request | Eco Calendar Recent - Finnhub', 'HTTP Request | Eco Calendar Upcoming - Finnhub', 'Code | Process Eco Data', 'Code | Derive Fed Bias') is an entry point with no consumer in this workflow; units categorical string; transform none; the string is scored as it is stored; lookback the single latest completed event the row carries, whatever its age; at the cutoff no as-of check; the stored event also carries date and time fields that the signal rule never reads
  - missing or stale: A null `latest_us_event` scores NEUTRAL with the evidence string 'No recent US event'. The collector also appends latest_us_event to the snapshot's missing array and marks source_status partial, but the agent end sees only the null, so a partial row and a healthy row produce the same factor reading. A stale event is indistinguishable from a fresh one: nothing holds the rulebook's 72-hour window, and neither a consensus revision nor a first print is detectable.
  - code: exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F7: BULLISH if ev.usd_signal === 'BULLISH', BEARISH if 'BEARISH', else NEUTRAL (weight 24 on 24h) | exports/usd_layer1_agent.json -> Build USD Input Pack (latest_us_event exposed to the model and listed among the must-be-neutral inputs when absent) | exports/usd_collector.json -> Normalise Market Snapshot: latestUsEvent = ecoDataRaw?.latest_us_event || null, followed by checkMissing('latest_us_event', latestUsEvent). The helper latestUsEventFromEcoData, which would recompute usd_signal from actual against forecast and invert the sign for Unemployment Rate and Initial Jobless Claims, and the helper upcomingEventsFromEcoData are both defined and never called, so the stored string is read unexamined
- **F8 F8 Fed bias** (`live.f8-fed-bias`, task `USD-BASELINE-AUDIT-08`) - A string containing 'hawkish' reads BULLISH, one containing 'dovish' BEARISH, neutral NEUTRAL, 'unknown' is treated as a missing input and scores NEUTRAL. No threshold, no comparison against a prior reading. Coded weight 12 on 24h, 10 on 3d, 12 on current_week, 18 on next_week, 18 on current_month; rulebook weight 18, described there as the highest-weight factor and explicitly a delta.
  - input `fed_bias` from computed inside the collector by 'Code | Derive USD Eco Inputs' from the last eight completed events of the stored calendar: plus one for a BULLISH usd_signal and minus one for a BEARISH one, doubled when the event's impact rank is three, summed and labelled hawkish at two or more, dovish at minus two or less, neutral otherwise. A second implementation in the same export, 'Code | Derive Fed Bias', would score the same events plus or minus one; that node has no consumer and never runs; units categorical string (hawkish | neutral | dovish | unknown); transform substring test for hawkish and for dovish; lookback the current string only; at the cutoff no as-of check; the string is recomputed once per collector run from whichever completed events the stored calendar holds
  - missing or stale: An absent or 'unknown' string scores NEUTRAL and names the missing input. The two-point cutoff behind the string is a coded constant with no stated calibration, the eight-event window is undocumented, and because only the current string survives, no amount of stored data can show whether the bias changed since the previous session.
  - code: exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F8: BULLISH when the lowercased string includes 'hawkish', BEARISH when it includes 'dovish', NEUTRAL otherwise or when the string is empty or 'unknown' (weight 12 on 24h) | exports/usd_layer1_agent.json -> Build USD Input Pack (fed_bias exposed to the model and listed among the must-be-neutral inputs when unknown) | exports/usd_collector.json -> Normalise Market Snapshot: fedBiasRaw = getNode('Code | Derive USD Eco Inputs'), fedBias = fedBiasRaw?.fed_bias || 'unknown', checkMissing('fed_bias', ...) | exports/usd_collector.json -> Code | Derive Fed Bias (a second, unconnected implementation of the same idea that no node consumes)
- **F9 F9 Dollar Smile regime** (`live.f9-dollar-smile`, task `USD-BASELINE-AUDIT-09`) - VIX above 25 reads BULLISH; VIX below 16 while the bias string does not contain 'hawkish' reads BEARISH; every other case NEUTRAL. Coded weight 1 on 24h, 3 on 3d, 5 on current_week, 10 on next_week, 10 on current_month; rulebook weight 12.
  - input `vix_level, fed_bias` from FRED VIXCLS through the collector's vix_level field and the collector-derived fed_bias string; units index level and categorical string; transform level comparisons at 25 and 16 plus a substring test for hawkish; lookback levels only; no change in VIX and no change in bias is read, although the rulebook lists vix_d1 and vix_d5; at the cutoff inherits both inputs: VIXCLS is a market-close series and the bias string is recomputed once per collector run
  - missing or stale: A missing VIX level returns NEUTRAL with the evidence string 'No clear Dollar Smile edge', which is the same answer the factor gives whenever VIX sits between 16 and 25 or the bias string is unknown, so a missing input and an uninformative regime are indistinguishable in the payload. The rulebook's permission to score NEUTRAL to avoid double-counting F1 is not implemented as a test.
  - code: exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F9: BULLISH when vix_level > 25, BEARISH when vix_level < 16 and the bias string does not include 'hawkish', else NEUTRAL (weight 1 on 24h) | exports/usd_layer1_agent.json -> Build USD Input Pack (vix_level, vix_d1, vix_d5 and fed_bias exposed to the model) | exports/usd_collector.json -> Normalise Market Snapshot: equities_regime is stored from the same 16 and 25 thresholds but no conviction factor reads it
- **F10 F10 Equity versus USD** (`live.f10-equity-versus-usd`, task `USD-BASELINE-AUDIT-10`) - VIX below 16 with NQ up reads BEARISH; VIX below 16 with NQ down BULLISH; VIX above 25 with NQ down BULLISH; every other combination NEUTRAL. No percentage threshold; only the sign of the change is read. Coded weight 1 at every timeframe; rulebook weight 2.
  - input `nq_d1_pct on 24h, else nq_d5_pct, and vix_level` from Alpha Vantage GLOBAL_QUOTE on QQQ for the price; the one-day change is the vendor's own change-percent field and the five-day change is computed by historyPct against the collector's stored rows; VIXCLS for the gate; units per cent change and index level; transform sign of the equity change inside a VIX regime; the 24h arm prefers nq_d1_pct and falls back to nq_d5_pct when absent; lookback one day on 24h; five stored rows on every other timeframe; at the cutoff the quote is read at the pipeline run time and the daily change is the vendor's figure, not a change measured between the cutoff and the session end
  - missing or stale: A missing NQ change or a missing VIX level returns NEUTRAL with the evidence string 'Missing NQ/VIX'. The unhandled combinations, VIX above 25 with NQ up and the whole 16-to-25 band, also read NEUTRAL, and the payload does not distinguish an unhandled regime from absent data.
  - code: exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F10: BEARISH when vix_level < 16 and the NQ change is positive, BULLISH when vix_level < 16 and it is negative, BULLISH when vix_level > 25 and it is negative, else NEUTRAL (weight 1 at every timeframe) | exports/usd_layer1_agent.json -> Calculate USD Conviction, nqDelta = nq_d1_pct on 24h when present, else nq_d5_pct | exports/usd_collector.json -> Normalise Market Snapshot: nq = alphaQuote(getNode('HTTP Request | NQ - Alpha Vantage')), nqD5Pct = historyPct(nq.price, 'nq_price', 4), nqD20Pct = historyPct(nq.price, 'nq_price', 19); equities_regime is stored from the VIX thresholds and read by no factor

### 3.4 Recorded defects in that path

Code facts, recorded from reading the exports. They are not findings about VIX or about the dollar, and no report is asked to accept them:

- Two weight vectors are live at once: the workflow fetches the rulebook on every run while the code uses its own constants, so the published number follows the code. F7 carries 24 coded points against a rulebook weight of 3 and F8 12 against 18, and nothing reconciles them.
- The F7 signal string is produced outside the reachable workflow, so 24 of the 100 coded points cannot be reproduced from this repository: every node in the collector export that could compute a surprise from a calendar is an entry point with no consumer.
- 'Code | Derive Fed Bias' is a second implementation of the bias score with no consumer, and the collector's own data_quality note names it as the source of the live fed_bias, which is in fact computed by 'Code | Derive USD Eco Inputs'.
- The same data_quality note says latest_us_event is selected from the Finnhub economic calendar, while the live row is read from Supabase and the Finnhub chain never reaches the snapshot.
- The helpers latestUsEventFromEcoData and upcomingEventsFromEcoData, which would recompute the event signal from actual against forecast and invert the sign for Unemployment Rate and Initial Jobless Claims, are defined and never called.
- The four modifiers of rulebook section 8 are returned as constants: participation and participation_cap equal the active weight, and conflict_penalty, missing_input_penalty and agreement_boost are all zero.
- neutral_pct is a sum of weight points reported with a per-cent sign inside the reason string.
- Snapshot selection is sortedRows.find(isUsableUsdSnapshot) || sortedRows[0]: it has no as-of bound against the 05:00 London cutoff, no per-field age and no revision exclusion, and the fallback row may be missing inputs the pack requires.
- Gold, BTC and NQ history percentages count stored collector rows, so those lookbacks follow the pipeline's run history rather than a trading calendar.
- Fields exist in the stored row and are written as null on every run: spx_d1_pct, btc_dominance, latest_ez_event, ecb_bias, global_growth_regime, ez_stress_flag and geopolitical_risk_flag.
- equities_regime is computed from the 16 and 25 VIX thresholds, stored in the row and exposed to the model, and read by no conviction factor, which recomputes the regime from vix_level.
- WTI, Brent and the five FX pairs are fetched and transformed in the collector but are not first-class fields of the stored snapshot; they survive only inside raw_payload, with the US-DE 10Y and US-JP 10Y spreads.
- The dashboard publishes a second strength label derived separately from the same call, so two strength labels can disagree on one row.
- The label instrument and its quote source are still undecided: the collector prices the dollar with FRED DTWEXBGS, a weekly broad H.10 index 2 to 6 business days old at a 05:00 London cutoff, and no intraday dollar-index print exists in the repository or the collector.

## 4. The data that exists, and what is stale at the cutoff

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

### 4.1 Availability of each deployed factor's own inputs

- F1 F1 VIX level and risk regime: history - FRED VIXCLS daily, cached from 2023-04-03 in the closed study's cache and in the 22-series macro frame from 2024-01-02; latest published values only, no vintage. Live - Collected once per day at the 09:30 ET pipeline time, with no as-of check against the 05:00 London cutoff and no per-field age.
- F2 F2 US 2Y yield delta: history - FRED DGS2 daily in the closed study's cache from 2023-04-03 and in the macro frame from 2024-01-02; latest published values only. Live - Collected daily; the H.15 family is 1 to 2 business days old at the cutoff and its exact publication time was not verified in this cycle.
- F3 F3 US-DE 2Y spread delta: history - The US leg is in the closed study's cache from 2023-04-03 and in the 22-series macro frame from 2024-01-02; the Bundesbank German 2Y series was not traced in either cached frame in this cycle. Live - One row per day at the 09:30 ET pipeline time, no vintage, and the German CSV's as-of date is not asserted in the row.
- F4 F4 US 10Y real yield delta: history - FRED DFII10 in the closed study's cache from 2023-04-03 and in the 22-series macro frame from 2024-01-02; latest published values only, no vintage. Live - Collected daily at the 09:30 ET pipeline time with no as-of check against the 05:00 London cutoff and no per-field age; revisions of the H.15 series are not detectable because no vintage is stored.
- F5 F5 DXY delta: history - FRED DTWEXBGS is a daily series available well before the closed study's cache (2023-04-03) and the macro frame (2024-01-02); latest published values only, no vintage, so revisions are invisible. Live - One collector row per day at the 09:30 ET pipeline time and no per-field age, so the newest observation is already several business days old at the 05:00 London cutoff.
- F6 F6 Gold delta: history - A Coinbase spot price is retrievable historically, but the closed study's cache and the macro frame record no gold series traced in this cycle, so the row-based window has no obvious historical equivalent. Live - One quote per collector run, no vintage, no benchmark time, and the deltas are only as regular as the pipeline's run history.
- F7 F7 US economic surprise: history - No consensus or first-print archive is committed. The calendar in the closed study's data records release times without consensus values and an ALFRED vintage file needs a key, so a historical surprise series cannot be rebuilt from this repository. Live - One row per day, with an event date and time stored but never tested for age, and no vintage of either the consensus or the stored string.
- F8 F8 Fed bias: history - No fed_bias series appears in the closed study's data or in the 22-series macro frame, and the events behind the score are not archived with consensus values, so the factor has no history to test as specified. Live - One string per collector run, no vintage, no stored score as evidence, and no age attached to the events inside it.
- F9 F9 Dollar Smile regime: history - VIXCLS is reachable from 2023-04-03 in the closed study's cache and from 2024-01-02 in the 22-series macro frame, but the second condition needs a bias history that is not committed and the left side needs a growth series the collector never stores, so at most the high-volatility arm can be reconstructed. Live - Both inputs are read once per collector run with no per-field age and no stored regime label.
- F10 F10 Equity versus USD: history - FRED NASDAQ100 is in the 22-series macro frame from 2024-01-02, but the live factor prices QQQ through Alpha Vantage, so the reconstructable series is not the collected one, and the vendor's change-percent field cannot be reproduced from a cached frame. Live - One row per collector run: the five-day arm counts stored rows and the one-day arm is the vendor's figure, with no age attached to either and no regime label stored alongside the call.

### 4.2 Sources already reviewed for the label, and why none of them is the session label yet

Recorded in `docs/research/usd-session/v1/session_contract_v1.json`. This is a factual assessment of reachability, not a conclusion about the factor: a report that needs an intraday dollar print should read it as the list of what this repository tried.

- FRED DTWEXBGS (live collector field dxy_level): usable for an intraday session - false. daily index the Federal Reserve publishes in H.10 on Mondays at 16:15 ET for the previous business week, so it is two to six business days old at the 05:00 London cutoff (median 4) and cannot price either 05:00 London print on the day
- Coinbase v2 prices XAU-USD/BTC-USD/JPY-USD/GBP-USD/CAD-USD/AUD-USD spot: usable for an intraday session - partial. six pairs only, no EUR, no CHF, no SEK; cannot reproduce the ICE DXY basket, and Coinbase FX is a crypto-venue quote, not an interbank DXY print
- local OANDA hourly caches (EUR_USD, XAU_USD, NAS100_USD): usable for an intraday session - partial. hourly to 2026-04-30, but EUR/USD is one DXY leg out of six and the cache is a historical file, not a live source
- Fallback if the label stays unresolved: Publish the label as the instrument that does have a source (for example EUR/USD from OANDA or a documented USD proxy built from the available pairs), name it in every artefact and never call it DXY.

### 4.3 Collected by the live pipeline but read by no factor

Every input below is already fetched or stored, so a study of it would not start from nothing:

- btc_price, btc_d1_pct, btc_d5_pct, btc_d20_pct - Coinbase spot, stored in every snapshot row with windows counted in stored rows Not scored because no live factor reads them, so crypto risk appetite is the one cross-asset complex the engine collects and ignores.
- equities_regime - computed in the collector from the 16 and 25 VIX thresholds and exposed to the model Not scored because the stored label is read by no factor, which recomputes the regime from vix_level.
- wti, brent - FRED spot series fetched and converted to per-cent changes, kept only inside raw_payload Not scored because they are not stored as snapshot fields, so no factor can read them and no review can audit them.
- eurusd, usd_jpy, gbp_usd, usd_cad, aud_usd - FRED EUR/USD and Coinbase spot for the other four, kept only inside raw_payload Not scored because the dollar's own crosses are collected daily and read by no factor.
- us_de_10y_spread, us_jp_10y_spread - computed in the collector inside raw_payload Not scored because no factor reads the longer-horizon relative-rate proxies.
- vix_d1, vix_d5 - stored in every snapshot row and exposed to the model Not scored because the rulebook reads VIX level and change together and the code reads the level only.
- us_10y_yield, us_10y_d5_bps - FRED DGS10 through the collector Not scored because only the real 10Y is scored, so the nominal 10Y and its change are unused.
- us_2y_d20_bps, dxy_d20, gold_d20_pct, nq_d20_pct, us_10y_real_yield_d20_bps - stored in the snapshot row Not scored because only the timeframes longer than 24 hours read them, so at this study's horizon they are collected and never used.
- us_de_2y_spread, us_de_2y_spread_d1_bps, us_de_2y_spread_d20_bps, de_2y_d5_bps - stored or exposed in the snapshot row, with the d1 and d20 spread legs never computed by the collector Not scored because only the fixed five-day spread delta is scored.
- spx_d1_pct, btc_dominance, latest_ez_event, ecb_bias, global_growth_regime, ez_stress_flag, geopolitical_risk_flag - declared in the snapshot row and written as null every run Not scored because every rulebook factor that needs one of them, the left side of the Dollar Smile above all, is unimplementable from the collector as it stands.
- upcoming_events - stored in every snapshot row from the same eco source Not scored because no factor reads the forward calendar, so the collector knows what is scheduled inside the session and the engine does not.
- sofr, BAMLH0A0HYM2, SP500, NASDAQ100 - market-close FRED series reachable in the closed study's cached frame but not collected by the live pipeline Not scored because funding and credit stress have no live factor, and the closed study's frame is where they could be tested first.

## 5. The decisions that are still open

Read from `docs/research/usd-session/v1/session_contract_v1.json`; a decision frozen there leaves this list by itself. An open decision is not a recommendation, and neither this pack nor the report freezes any of them.

| Decision | State | The contract's own words |
| --- | --- | --- |
| label instrument and quote source | UNVERIFIED | Which tradeable, freely readable instrument is the USD direction label, and which quote source prices it at both ends? A DXY-labelled call must be executable in the instrument the number actually comes from. |
| missing-quote policy | UNDECIDED | UNDECIDED - must be frozen with the dataset |
| flat band | UNDECIDED | The 0.1 percentage-point band of the closed 24-hour study was fitted to a daily index over a nominal day. Over this 24-hour London-to-London session the band must be re-derived and frozen before candidate comparison, and may be expressed in the instrument's own price units or in ATR fractions. |
| ties in scoring | UNDECIDED | UNDECIDED - must be frozen with the band |
| exchange holidays and the session calendar | UNDECIDED | UNDECIDED - the live engine does not model holidays; the research dataset must carry a session calendar instead of inferring one |

Scoring, where the contract has decided: primary metric - balanced accuracy on decided calls; must report - coverage, sample size, matched-day comparison against the original and repaired engines, uncertainty, stability across periods, event-day versus quiet-day split. Abstention allowed: true. Publication of a probability: forbidden unless a calibration beats the base rate.

## 6. What this pack is not

- Not a summary of our research and not a position on VIX: it holds no conclusion, no hypothesis, no ranking and no recommendation.
- Not exhaustive of the question: it describes this system. The evidence a report needs may be entirely outside it, and the brief expects that.
- Not an approval of anything: a row here records what is deployed or reachable, and a defect recorded here is a code observation rather than a verdict on a factor.
- Not authorisation for any change: no production, workflow, dashboard, feed, dispatcher, database or configuration change follows from it.
