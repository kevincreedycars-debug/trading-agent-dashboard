# USD factor register (baseline audit, 2026-10-15)

Ten factors that the deployed node computes today, extracted from USD Layer 1 Agent, workflow OCt1tB9yVMUgFTha, v154, active, code nodes byte-identical to exports/usd_layer1_agent.json (scoped export 2026-10-11T18:59:54.307Z) and logic/agent_usd_direction.md v2.1, which the live workflow fetches from GitHub on every run; the two vectors and the disagreements between them are catalogued in docs/research/usd-session/v1/weight_vector_discrepancy.md. Each row is a baseline audit: the question is whether the deployed sign, weight, threshold and lookback are justified. The authoritative catalogue of the same factors is `data/research-library/catalog.json`.

## Weights

| Timeframe | F1 | F2 | F3 | F4 | F5 | F6 | F7 | F8 | F9 | F10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| coded 24h | 10 | 14 | 10 | 10 | 14 | 4 | 24 | 12 | 1 | 1 |
| coded 3d | 8 | 16 | 16 | 16 | 14 | 8 | 8 | 10 | 3 | 1 |
| coded current_week | 5 | 14 | 18 | 18 | 15 | 7 | 5 | 12 | 5 | 1 |
| coded next_week | 4 | 12 | 20 | 18 | 6 | 5 | 6 | 18 | 10 | 1 |
| coded current_month | 3 | 12 | 18 | 20 | 8 | 5 | 5 | 18 | 10 | 1 |
| rulebook | 10 | 14 | 16 | 14 | 6 | 5 | 3 | 18 | 12 | 2 |

conviction = round(winning side weight / active weight * 100), where active weight is the sum of the bullish and bearish weights only.

## Factors

| # | Task | Factor | Role | Pack family | Card family | Research | Review | Backtest | Weight 24h coded / rulebook |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | USD-BASELINE-AUDIT-01 | F1 VIX level and risk regime | regime context | risk_conditions | risk_conditions | ready | pending | not_tested | 10 / 10 |
| 2 | USD-BASELINE-AUDIT-02 | F2 US 2Y yield delta | direction | rates_and_policy_expectations | rates_and_policy_expectations | ready | pending | not_tested | 14 / 14 |
| 3 | USD-BASELINE-AUDIT-03 | F3 US-DE 2Y spread delta | direction | relative_rates | rates_and_policy_expectations | ready | pending | not_tested | 10 / 16 |
| 4 | USD-BASELINE-AUDIT-04 | F4 US 10Y real yield delta | direction | rates_inflation | rates_and_policy_expectations | ready | pending | not_tested | 10 / 14 |
| 5 | USD-BASELINE-AUDIT-05 | F5 DXY delta | direction | price_confirmation | usd_price_behaviour | ready | pending | not_tested | 14 / 6 |
| 6 | USD-BASELINE-AUDIT-06 | F6 Gold delta | direction | safe_haven_overlap | cross_assets | ready | pending | not_tested | 4 / 5 |
| 7 | USD-BASELINE-AUDIT-07 | F7 US economic surprise | direction | event_surprises | macroeconomic_releases | blocked | pending | not_tested | 24 / 3 |
| 8 | USD-BASELINE-AUDIT-08 | F8 Fed bias | direction | policy_stance | rates_and_policy_expectations | blocked | pending | not_tested | 12 / 18 |
| 9 | USD-BASELINE-AUDIT-09 | F9 Dollar Smile regime | regime context | risk_regime | risk_conditions | ready | pending | not_tested | 1 / 12 |
| 10 | USD-BASELINE-AUDIT-10 | F10 Equity versus USD | regime context | cross_asset_appetite | cross_assets | ready | pending | not_tested | 1 / 2 |

### F1 VIX level and risk regime (live.f1-vix-level)

- Rule: VIX > 25 reads BULLISH, 16 to 25 NEUTRAL, below 16 BEARISH. Level only. Threshold 25 / 16. Coded weight 10, rulebook weight 10, deployed in signals.F1.
- Missing or stale: A missing level scores F1 NEUTRAL and names the missing input; the null-to-zero defect was repaired live on 2026-10-11 and no archived call moved.
- Overlap: F9 (Dollar Smile) reads the same VIX level with the bias string and F10 gates on the same 25 / 16 thresholds, so one input informs three factors.
- History: FRED VIXCLS daily, cached from 2023-04-03 in the closed study's cache and in the 22-series macro frame from 2024-01-02; latest published values only, no vintage.
- Live: Collected once per day at the 09:30 ET pipeline time, with no as-of check against the 05:00 London cutoff and no per-field age.
- Status: research ready, review pending, backtest not_tested. Deployed baseline: no research card has been run on it and it is not a candidate.
- Open questions: 3 (see docs/research/handoff/usd/v1/packs/f1-vix-level.md)
- Code: exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F1 (thresholds 25 and 16, weight 10) | exports/usd_layer1_agent.json -> Build USD Input Pack (vix_level, vix_d1, vix_d5 exposed to the model)

### F2 US 2Y yield delta (live.f2-us-2y-delta)

- Rule: At or above +5 bps reads BULLISH, at or below -5 bps BEARISH, otherwise NEUTRAL. Threshold +/- 5 bps. Coded weight 14, rulebook weight 14.
- Missing or stale: A missing delta scores NEUTRAL and names the missing input; the 20d-to-5d substitution on longer timeframes is only a warning string.
- Overlap: F3 contains the US leg, so a move in DGS2 enters twice when both are active; F4 moves with nominal yields through the inflation-expectation leg.
- History: FRED DGS2 daily in the closed study's cache from 2023-04-03 and in the macro frame from 2024-01-02; latest published values only.
- Live: Collected daily; the H.15 family is 1 to 2 business days old at the cutoff and its exact publication time was not verified in this cycle.
- Status: research ready, review pending, backtest not_tested. Deployed baseline.
- Open questions: 3 (see docs/research/handoff/usd/v1/packs/f2-us-2y-delta.md)
- Code: exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F2 via signalFromDelta(us2yDelta, 5, -5, ...) | exports/usd_layer1_agent.json -> Build USD Input Pack (us_2y_d5_bps, us_2y_d20_bps)

### F3 US-DE 2Y spread delta (live.f3-us-de-2y-spread-delta)

- Rule: At or above +5 bps reads BULLISH, at or below -5 bps BEARISH, otherwise NEUTRAL, on one fixed five-day window. Threshold +/- 5 bps. Coded weight 10, rulebook weight 16.
- Missing or stale: A missing spread delta scores NEUTRAL and names the missing input; the input pack also lists `de_2y_yield`, `us_de_2y_spread` and `us_de_2y_spread_d5_bps` as must-be-neutral if unavailable. The spread's 1-day and 20-day deltas are exposed to the model and never read by the code, and the collector stores no 20-day German 2Y delta at all.
- Overlap: Shares its US leg with F2, so a US 2Y move is weighted twice when both factors are active; the German leg arrives from a different vendor and calendar from the US leg it is subtracted from.
- History: The US leg is in the closed study's cache from 2023-04-03 and in the 22-series macro frame from 2024-01-02; the Bundesbank German 2Y series was not traced in either cached frame in this cycle.
- Live: One row per day at the 09:30 ET pipeline time, no vintage, and the German CSV's as-of date is not asserted in the row.
- Status: research ready, review pending, backtest not_tested. Deployed baseline.
- Open questions: 3 (see docs/research/handoff/usd/v1/packs/f3-us-de-2y-spread-delta.md)
- Code: exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F3 = signalFromDelta(inputs.us_de_2y_spread_d5_bps, 5, -5, ...) at every timeframe | exports/usd_collector.json -> Normalise Market Snapshot: us_de_2y_spread = spread(us2y.latest, de2y.latest), us_de_2y_spread_d5_bps = spreadD5(us2y, de2y); de2y parsed by bundesbankCsv | exports/usd_layer1_agent.json -> Build USD Input Pack (us_de_2y_spread, us_de_2y_spread_d1_bps, us_de_2y_spread_d5_bps, us_de_2y_spread_d20_bps)

### F4 US 10Y real yield delta (live.f4-real-yield-delta)

- Rule: At or above +5 bps reads BULLISH, at or below -5 bps BEARISH, otherwise NEUTRAL, on whichever lookback the timeframe selects. Threshold +/- 5 bps. Coded weight 10, rulebook weight 14.
- Missing or stale: A missing delta scores NEUTRAL and names the missing input; the 20d-to-5d substitution on the two long timeframes is only a warning string, and because the 20-day field is optional in the snapshot a null there silently changes the lookback the factor is scored on.
- Overlap: Moves with F2 whenever breakevens are flat, because the nominal 10-year and real 10-year series share the same policy-path news; it is also the rate-side twin of F6, which reads gold as the other side of the same real-rate complex.
- History: FRED DFII10 in the closed study's cache from 2023-04-03 and in the 22-series macro frame from 2024-01-02; latest published values only, no vintage.
- Live: Collected daily at the 09:30 ET pipeline time with no as-of check against the 05:00 London cutoff and no per-field age; revisions of the H.15 series are not detectable because no vintage is stored.
- Status: research ready, review pending, backtest not_tested. Deployed baseline.
- Open questions: 3 (see docs/research/handoff/usd/v1/packs/f4-real-yield-delta.md)
- Code: exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F4 = signalFromDelta(realYieldDelta, 5, -5, ...), where realYieldDelta takes us_10y_real_yield_d20_bps on next_week and current_month, else us_10y_real_yield_d5_bps | exports/usd_layer1_agent.json -> Build USD Input Pack (us_10y_real_yield, us_10y_real_yield_d5_bps, us_10y_real_yield_d20_bps)

### F5 DXY delta (live.f5-dxy-delta)

- Rule: On 24h: at or above +0.15 per cent BULLISH, at or below -0.15 per cent BEARISH, otherwise NEUTRAL. On every other timeframe: +/- 0.30 per cent. Coded weight 14 on 24h, rulebook weight 6.
- Missing or stale: A missing delta scores NEUTRAL and names the missing input. The substitutions are silent and one of them changes the test: on 24h a null `dxy_d1` moves the factor to `dxy_d5` while the threshold stays at the 1-day 0.15 per cent, so a five-day move is judged on the tighter band, and on the two long timeframes a null `dxy_d20` moves it to `dxy_d5`. Neither substitution reaches the numeric payload.
- Overlap: The collected series is a broad dollar index, so whenever the session label is built from the same index family the factor contains part of the target; it also restates F2, F3 and F4 as a price rather than as a yield, and the rulebook makes it the primary tiebreaker, a role the code never grants it.
- History: FRED DTWEXBGS is a daily series available well before the closed study's cache (2023-04-03) and the macro frame (2024-01-02); latest published values only, no vintage, so revisions are invisible.
- Live: One collector row per day at the 09:30 ET pipeline time and no per-field age, so the newest observation is already several business days old at the 05:00 London cutoff.
- Status: research ready, review pending, backtest not_tested. Deployed baseline; coded and rulebook weights differ most here in rank terms, 14 against 6.
- Open questions: 3 (see docs/research/handoff/usd/v1/packs/f5-dxy-delta.md)
- Code: exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F5 = signalFromDelta(dxyDelta, tf === '24h' ? 0.15 : 0.3, tf === '24h' ? -0.15 : -0.3, ...) with dxyDelta = dxy_d20 on next_week and current_month, else dxy_d1 on 24h, else dxy_d5 | exports/usd_collector.json -> Normalise Market Snapshot: const dxy = fredPct(dxyRaw); dxy_level = dxy.latest, dxy_d1 = dxy.d1, dxy_d5 = dxy.d5, dxy_d20 = dxy.d20

### F6 Gold delta (live.f6-gold-delta)

- Rule: Gold below -0.1 per cent reads BULLISH, gold above +0.1 per cent BEARISH, inside +/- 0.1 per cent NEUTRAL, on the selected lookback. Coded weight 4 on 24h, rulebook weight 5.
- Missing or stale: A missing gold delta scores NEUTRAL and names the missing input; the input pack silently substitutes `gold_d1_pct` for a missing `gold_d5_pct` and records only a warning string, so a one-row move can be labelled and scored as a five-day move, and the row counts themselves depend on how often the collector ran.
- Overlap: F4 already reads the real-rate complex from the other side, and F1, F9 and F10 read the same risk appetite through VIX and equities; when gold and the dollar rise together the rulebook tells the model to flag a safe-haven conflict, while the code carries a conflict penalty that is hard-coded to zero.
- History: A Coinbase spot price is retrievable historically, but the closed study's cache and the macro frame record no gold series traced in this cycle, so the row-based window has no obvious historical equivalent.
- Live: One quote per collector run, no vintage, no benchmark time, and the deltas are only as regular as the pipeline's run history.
- Status: research ready, review pending, backtest not_tested. Deployed baseline.
- Open questions: 3 (see docs/research/handoff/usd/v1/packs/f6-gold-delta.md)
- Code: exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F6: gold below -0.1 per cent BULLISH, above +0.1 per cent BEARISH, with goldDelta = gold_d20_pct on next_week and current_month, else gold_d5_pct | exports/usd_layer1_agent.json -> Build USD Input Pack: goldD5 = gold_d5_pct if present else gold_d1_pct, with the warning 'gold_d5_pct missing; using gold_d1_pct fallback' | exports/usd_collector.json -> Normalise Market Snapshot: const goldPrice = coinbasePrice(goldRaw); goldD1Pct = historyPct(goldPrice, 'gold_price', 0), goldD5Pct = historyPct(goldPrice, 'gold_price', 4), goldD20Pct = historyPct(goldPrice, 'gold_price', 19)

### F7 US economic surprise (live.f7-economic-surprise)

- Rule: BULLISH reads BULLISH (positive US surprise supports USD), BEARISH reads BEARISH, any other string or a missing event reads NEUTRAL. No threshold, no surprise magnitude. Coded weight 24 on 24h, 8 on 3d, 5 on current_week, 6 on next_week, 5 on current_month; rulebook weight 3 inside a 72-hour window.
- Missing or stale: A null `latest_us_event` scores NEUTRAL with the evidence string 'No recent US event'. The collector also appends latest_us_event to the snapshot's missing array and marks source_status partial, but the agent end sees only the null, so a partial row and a healthy row produce the same factor reading. A stale event is indistinguishable from a fresh one: nothing holds the rulebook's 72-hour window, and neither a consensus revision nor a first print is detectable.
- Overlap: A release moves the same rates and price inputs that F2, F4 and F5 read, so one surprise can enter the score three or four times; F8 is derived from the same stored event rows and F9 reads the same regime.
- History: No consensus or first-print archive is committed. The calendar in the closed study's data records release times without consensus values and an ALFRED vintage file needs a key, so a historical surprise series cannot be rebuilt from this repository.
- Live: One row per day, with an event date and time stored but never tested for age, and no vintage of either the consensus or the stored string.
- Status: research blocked, review pending, backtest not_tested. Highest coded weight on the 24h timeframe at 24 points, against a rulebook weight of 3.
- Blockers: No consensus or first-print vintage source is reachable from this repository.
- Open questions: 3 (see docs/research/handoff/usd/v1/packs/f7-economic-surprise.md)
- Code: exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F7: BULLISH if ev.usd_signal === 'BULLISH', BEARISH if 'BEARISH', else NEUTRAL (weight 24 on 24h) | exports/usd_layer1_agent.json -> Build USD Input Pack (latest_us_event exposed to the model and listed among the must-be-neutral inputs when absent) | exports/usd_collector.json -> Normalise Market Snapshot: latestUsEvent = ecoDataRaw?.latest_us_event || null, followed by checkMissing('latest_us_event', latestUsEvent). The helper latestUsEventFromEcoData, which would recompute usd_signal from actual against forecast and invert the sign for Unemployment Rate and Initial Jobless Claims, and the helper upcomingEventsFromEcoData are both defined and never called, so the stored string is read unexamined

### F8 Fed bias (live.f8-fed-bias)

- Rule: A string containing 'hawkish' reads BULLISH, one containing 'dovish' BEARISH, neutral NEUTRAL, 'unknown' is treated as a missing input and scores NEUTRAL. No threshold, no comparison against a prior reading. Coded weight 12 on 24h, 10 on 3d, 12 on current_week, 18 on next_week, 18 on current_month; rulebook weight 18, described there as the highest-weight factor and explicitly a delta.
- Missing or stale: An absent or 'unknown' string scores NEUTRAL and names the missing input. The two-point cutoff behind the string is a coded constant with no stated calibration, the eight-event window is undocumented, and because only the current string survives, no amount of stored data can show whether the bias changed since the previous session.
- Overlap: F7 is built from the same stored event rows and contributes to the same score, F2 and F4 read the same policy path through yields, and F9 uses this string as a gate, so one policy story can carry five factors.
- History: No fed_bias series appears in the closed study's data or in the 22-series macro frame, and the events behind the score are not archived with consensus values, so the factor has no history to test as specified.
- Live: One string per collector run, no vintage, no stored score as evidence, and no age attached to the events inside it.
- Status: research blocked, review pending, backtest not_tested. Coded weight 12 on the 24h timeframe while the rulebook calls it the highest-weight factor at 18; the implemented rule contradicts the rulebook's stated mechanism.
- Blockers: No vintage of the bias string is retained, so no change can be measured.
- Open questions: 3 (see docs/research/handoff/usd/v1/packs/f8-fed-bias.md)
- Code: exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F8: BULLISH when the lowercased string includes 'hawkish', BEARISH when it includes 'dovish', NEUTRAL otherwise or when the string is empty or 'unknown' (weight 12 on 24h) | exports/usd_layer1_agent.json -> Build USD Input Pack (fed_bias exposed to the model and listed among the must-be-neutral inputs when unknown) | exports/usd_collector.json -> Normalise Market Snapshot: fedBiasRaw = getNode('Code | Derive USD Eco Inputs'), fedBias = fedBiasRaw?.fed_bias || 'unknown', checkMissing('fed_bias', ...) | exports/usd_collector.json -> Code | Derive Fed Bias (a second, unconnected implementation of the same idea that no node consumes)

### F9 Dollar Smile regime (live.f9-dollar-smile)

- Rule: VIX above 25 reads BULLISH; VIX below 16 while the bias string does not contain 'hawkish' reads BEARISH; every other case NEUTRAL. Coded weight 1 on 24h, 3 on 3d, 5 on current_week, 10 on next_week, 10 on current_month; rulebook weight 12.
- Missing or stale: A missing VIX level returns NEUTRAL with the evidence string 'No clear Dollar Smile edge', which is the same answer the factor gives whenever VIX sits between 16 and 25 or the bias string is unknown, so a missing input and an uninformative regime are indistinguishable in the payload. The rulebook's permission to score NEUTRAL to avoid double-counting F1 is not implemented as a test.
- Overlap: F1 applies the same 25 and 16 thresholds to the same VIX level, F10 gates on them again, and F8 reads the same bias string, so this factor adds only the 'not hawkish' test on top of F1 on the timeframe where both are scored.
- History: VIXCLS is reachable from 2023-04-03 in the closed study's cache and from 2024-01-02 in the 22-series macro frame, but the second condition needs a bias history that is not committed and the left side needs a growth series the collector never stores, so at most the high-volatility arm can be reconstructed.
- Live: Both inputs are read once per collector run with no per-field age and no stored regime label.
- Status: research ready, review pending, backtest not_tested. Deployed baseline; the coded weight of 1 on the 24h timeframe makes the smile's separate content nearly invisible in the published number.
- Open questions: 3 (see docs/research/handoff/usd/v1/packs/f9-dollar-smile.md)
- Code: exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F9: BULLISH when vix_level > 25, BEARISH when vix_level < 16 and the bias string does not include 'hawkish', else NEUTRAL (weight 1 on 24h) | exports/usd_layer1_agent.json -> Build USD Input Pack (vix_level, vix_d1, vix_d5 and fed_bias exposed to the model) | exports/usd_collector.json -> Normalise Market Snapshot: equities_regime is stored from the same 16 and 25 thresholds but no conviction factor reads it

### F10 Equity versus USD (live.f10-equity-versus-usd)

- Rule: VIX below 16 with NQ up reads BEARISH; VIX below 16 with NQ down BULLISH; VIX above 25 with NQ down BULLISH; every other combination NEUTRAL. No percentage threshold; only the sign of the change is read. Coded weight 1 at every timeframe; rulebook weight 2.
- Missing or stale: A missing NQ change or a missing VIX level returns NEUTRAL with the evidence string 'Missing NQ/VIX'. The unhandled combinations, VIX above 25 with NQ up and the whole 16-to-25 band, also read NEUTRAL, and the payload does not distinguish an unhandled regime from absent data.
- Overlap: F1 and F9 apply the same 25 and 16 thresholds, F6 reads the same risk appetite through gold, and the factor is the risk-appetite leg of the story F9's smile is built on.
- History: FRED NASDAQ100 is in the 22-series macro frame from 2024-01-02, but the live factor prices QQQ through Alpha Vantage, so the reconstructable series is not the collected one, and the vendor's change-percent field cannot be reproduced from a cached frame.
- Live: One row per collector run: the five-day arm counts stored rows and the one-day arm is the vendor's figure, with no age attached to either and no regime label stored alongside the call.
- Status: research ready, review pending, backtest not_tested. Deployed baseline; a one-point weight on every timeframe, on an ETF quote rather than the index.
- Open questions: 3 (see docs/research/handoff/usd/v1/packs/f10-equity-versus-usd.md)
- Code: exports/usd_layer1_agent.json -> Calculate USD Conviction, signals.F10: BEARISH when vix_level < 16 and the NQ change is positive, BULLISH when vix_level < 16 and it is negative, BULLISH when vix_level > 25 and it is negative, else NEUTRAL (weight 1 at every timeframe) | exports/usd_layer1_agent.json -> Calculate USD Conviction, nqDelta = nq_d1_pct on 24h when present, else nq_d5_pct | exports/usd_collector.json -> Normalise Market Snapshot: nq = alphaQuote(getNode('HTTP Request | NQ - Alpha Vantage')), nqD5Pct = historyPct(nq.price, 'nq_price', 4), nqD20Pct = historyPct(nq.price, 'nq_price', 19); equities_regime is stored from the VIX thresholds and read by no factor

## Defects in the deployed path

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

## Collected but not scored

Every input below is already fetched or stored, so a card about it starts from data that exists. Nothing here is a recommendation.

- btc_price, btc_d1_pct, btc_d5_pct, btc_d20_pct - Coinbase spot, stored in every snapshot row with windows counted in stored rows. Not scored because no live factor reads them, so crypto risk appetite is the one cross-asset complex the engine collects and ignores.
- equities_regime - computed in the collector from the 16 and 25 VIX thresholds and exposed to the model. Not scored because the stored label is read by no factor, which recomputes the regime from vix_level.
- wti, brent - FRED spot series fetched and converted to per-cent changes, kept only inside raw_payload. Not scored because they are not stored as snapshot fields, so no factor can read them and no review can audit them.
- eurusd, usd_jpy, gbp_usd, usd_cad, aud_usd - FRED EUR/USD and Coinbase spot for the other four, kept only inside raw_payload. Not scored because the dollar's own crosses are collected daily and read by no factor.
- us_de_10y_spread, us_jp_10y_spread - computed in the collector inside raw_payload. Not scored because no factor reads the longer-horizon relative-rate proxies.
- vix_d1, vix_d5 - stored in every snapshot row and exposed to the model. Not scored because the rulebook reads VIX level and change together and the code reads the level only.
- us_10y_yield, us_10y_d5_bps - FRED DGS10 through the collector. Not scored because only the real 10Y is scored, so the nominal 10Y and its change are unused.
- us_2y_d20_bps, dxy_d20, gold_d20_pct, nq_d20_pct, us_10y_real_yield_d20_bps - stored in the snapshot row. Not scored because only the timeframes longer than 24 hours read them, so at this study's horizon they are collected and never used.
- us_de_2y_spread, us_de_2y_spread_d1_bps, us_de_2y_spread_d20_bps, de_2y_d5_bps - stored or exposed in the snapshot row, with the d1 and d20 spread legs never computed by the collector. Not scored because only the fixed five-day spread delta is scored.
- spx_d1_pct, btc_dominance, latest_ez_event, ecb_bias, global_growth_regime, ez_stress_flag, geopolitical_risk_flag - declared in the snapshot row and written as null every run. Not scored because every rulebook factor that needs one of them, the left side of the Dollar Smile above all, is unimplementable from the collector as it stands.
- upcoming_events - stored in every snapshot row from the same eco source. Not scored because no factor reads the forward calendar, so the collector knows what is scheduled inside the session and the engine does not.
- sofr, BAMLH0A0HYM2, SP500, NASDAQ100 - market-close FRED series reachable in the closed study's cached frame but not collected by the live pipeline. Not scored because funding and credit stress have no live factor, and the closed study's frame is where they could be tested first.
