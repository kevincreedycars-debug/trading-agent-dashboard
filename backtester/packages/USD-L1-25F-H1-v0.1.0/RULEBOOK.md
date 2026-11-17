# USD-L1-25F-H1-v0.1.0
16 November 2026 | VSC acceptance package | pre-evaluation research hypothesis

## What VSC can reproduce
Run `node verify.js` from this directory (Node 24, no dependencies). It calls `run(model, snapshot)` twice on one frozen synthetic 05:00 London session. Compare the complete outputs and factor traces with expected.json. The benchmark executes the repository’s current_model.evaluate and usd_replay_core with the benchmark’s own conviction bands. Its trade flag uses the existing backtesting threshold of band 3. The fixture supplies four benchmark inputs, leaving other fields unavailable under that adapter's own rules. This proves dispatch and deterministic decisions on that fixture. Full production input parity, collector integration, published native tab and four scoring adapters are VSC implementation work.

## Decision rule
Every modelling choice in this section and the accompanying input and row specifications is **H1, an unvalidated hypothesis**. The research verdict for each row is preserved separately in rows.json. Source identities, transforms, ages, abstention gates, trade threshold, exclusion choices and conviction bands are all design choices. The handover fixes the London session and required outcome fields. There are 25 adjudicated rows and three voting families. A non-voting row has an explicit role.

1. Check all nine declared features, including the schedule. Require original values and exact source, transform, instrument and evidence time. Reject a missing, stale, revised-only, unclocked or substituted feature. No fallback. For historical reconstruction VSC must retain original point-in-time source evidence for every operand, with nullable receipt. Live proof additionally requires a sealed receipt by cutoff. The fixture runner accepts synthetic evidence only.
2. For each signal at or above its absolute threshold, assign the sign of its change. Otherwise give zero. Invert gold and QQQ. Thresholds are 5 bp for yields/spread, 0.30% for the broad dollar, 0.15% for ICE session momentum and 1% each for gold and QQQ. These are proposed noise filters. All returns are simple percentage returns. The Germany zero-coupon comparator and LBMA PM fixing are explicit instrument choices for this version.
3. Rates = mean(relative front-end vote, real-yield vote). The standalone US 2Y trace documents the shared leg and adds no vote. USD momentum = mean(broad-dollar vote, ICE session vote). Cross-market = mean(inverse gold vote, inverse QQQ vote). Average the three family scores including neutral votes. Equal family weights prevent families with more rows from gaining votes. Signals in distinct series can still be correlated.
4. VIX at or above 30 or absolute score below 0.20 gives a valid abstention. Otherwise positive is bullish and negative bearish. Conviction 1 begins at 0.20, 2 at 0.35, 3 at 0.50, 4 at 0.65 and 5 at 0.80 inclusive. These are agreement bands, with no calibrated probability. Trade only at band 3 or higher and with a verified zero count of scheduled events in the session. A missing calendar blocks the analysis. A verified nonempty calendar suppresses trading while retaining an otherwise valid directional call.
5. The narrow event list, high-VIX abstention and omitted directional mechanisms are deliberate initial hypotheses. The registered verdicts give no measured exact-session signs for those omitted channels. F8’s absence therefore imposes no requirement on H1. This choice changes the model relative to the original intended specification. It cannot change that model’s historical audit.

## Data requirements
inputs.json is the machine-readable feature contract. Each entry supplies provider, precise instrument or schedule, transform and maximum age in elapsed hours, inclusive. Age applies to the latest observation underpinning each feature (oldest latest leg for spreads). Older lookback observations must match the exact declared observation intervals. Each earlier operand still needs a contemporaneous vintage. For market fixings at 05:00, a bar that opens at the cutoff cannot supply its later close. Percent thresholds use percentage points of return, not decimals. No interpolation. Source archives and eligibility calendars must prove whether an unchanged print was the latest available.

| Feature | Required series or schedule | Maximum age |
|---|---|---:|
| VIX | Cboe spot VIX completed close | 96 h |
| US front end | H.15 DGS2, 5 observation change | 96 h |
| Relative front end | DGS2 less Bundesbank BBSIS sovereign 2.0-year spot, 5 common observation change | 96 h |
| Real yield | H.15 DFII10, 5 observation change | 96 h |
| Broad USD | H.10 DTWEXBGS, 5 observation return | 192 h |
| Session momentum | Official ICE spot US Dollar Index, exact previous and current eligible 05:00 | Exact cutoff |
| Gold | LBMA Gold Price PM USD, 5 fixing return | 96 h |
| Equities | QQQ Nasdaq official close, 5 close return | 96 h |
| Schedule | Complete archived BLS, BEA and Federal Reserve schedules for the named US releases through the endpoint | 24 h |

The broker DXY.cash outcome and official ICE momentum input have distinct identities. VSC must resolve source-specific feed IDs, event revisions, split history, calendar version and raw operand lineage before enabling a real adapter. Fixture features are supplied precomputed. Live eligibility for exact-cutoff ICE requires receipt by 05:00. If the print arrives later, this version blocks.

## Worked fixture and failures
16 November is a synthetic date label. Rates (+1,+1) = +1. Momentum (+1,+1) = +1. Gold falls 1.3% and QQQ rises 1.1%, giving (+1,-1) = 0. Overall score = 2/3, band 4 bullish. VIX 17 and verified empty fixture schedule permit trading. The current benchmark gives bullish, band 3. Changing only VIX to 30 produces a completed abstention. Removing the calendar produces a blocked analysis with the missing feature named. The verifier also rejects a late receipt, stale observation, proxy, missing clock, revised-only or unavailable value and undefined rule. Friday 23 October 2026 05:00 London and Monday 26 October 05:00 London resolve to 04:00Z and 05:00Z respectively. The caller supplies the eligible dates in this demonstration.

## Production reuse and acceptance
Repository inspected: kevincreedycars-debug/trading-agent-dashboard, main, 16 November 2026. See reference/ for the benchmark, time resolver and prior rulebooks. The two reference config files describe the old experiment; H1's authoritative files are models.js, rows.json and inputs.json. Frozen source and fixture checksums are included.
- Reuse current_model.js and its production replay core for benchmarking. Audit its input shaper: spread, surprise and Fed bias are pinned to null, and broad USD is mapped to DXY fields. The four benchmark inputs in the fixture are not a production-complete benchmark manifest.
- Reuse the London cutoff resolver, append-only collection and hashing, level publication checks, dated snapshot framework, separate outcome functions, dashboard date navigation and existing test shells. The generic session resolver's endpoint is 17:00 in another zone. Call the cutoff resolver for both dates using the approved USD calendar. The old outcome code's next-local-date convention and tolerance-based hourly lookups need exact-endpoint checks.
- Keep the historical publication-evidence gate distinct from the live receipt gate. The repository's inactive n8n export references a 04:45 collection and a 05:05 decision. Neither establishes a sealed H1 receipt. Capture changes through the actual cutoff, run the versioned package on the sealed bytes and independently compare direction, conviction, trade flag and all 25 trace rows.
- In the native tab expose candidate/version, historical reconstructions, forward receipts/exact replays and separate scoring denominators. The existing example is 2024-02-06. It traces the prior experimental book only.

## Evidence and scoring register
The published legacy gate reports 618/725 present, 617/725 fresh, 0/725 clocked, 0/725 identified. These nested counts concern the older gate. H1 coverage is unmeasured; no earliest H1 morning has been established. Genuine H1 sealed shadow decisions supplied and replayed in this work: 0. Synthetic acceptance cases do not enter either count.

| Test | Eligibility still needed | Result |
|---|---|---|
| Broker DXY.cash | H1 and benchmark decisions and exact two named endpoints | Unscored |
| Opposite USD move on EUR/USD, XAU/USD, BTC/USD and NAS100 | Matched dates and both endpoints for each instrument separately | Unscored, four independent denominators |
| Original L2L 5R | Trade-qualified call, contemporaneous levels and actionable bid/ask M5 replay | Unscored |
| Original plus midpoint 3R | Same evidence, full plus midpoint geometry, frozen 3R management | Unscored |

Before opening holdout outcomes, VSC must register benchmark input parity, market calendar, range, flat bands, exclusion waterfall, matched-date comparison, success measures and uncertainty method. The handover target is 60% directional accuracy. Freeze the entry version (strict M5 close away and close back across the same level, exact touches and wicks excluded), expiry, exits, costs and sizing for each lane. Both simulations begin with £100,000 and risk 1% of current balance per fill. Existing demo uses live trade direction and cannot provide these candidate tests. No equity curve exists until there are eligible fills.

## Factor-by-factor register

| Adjudicated factor | H1 role | Evidence key |
|---|---|---|
| VIX level and risk regime | regime gate | vix |
| VIX level and change at the cutoff | shared F1 | vix |
| US 2Y yield, five-session change | decomposition only, DGS2 is counted inside F19 | front |
| US minus Germany 2Y spread, five-session change | shared F19 | spread |
| US 10Y real yield, five-session change | rates vote | real |
| US front-end rate change | shared F2 | front |
| US minus Germany front-end spread | rates vote | spread |
| US real yield change | shared F4 | real |
| Term premium and curve | excluded | No additional feed |
| Credit spread change | excluded | No additional feed |
| Broad dollar momentum | USD momentum vote | broad |
| Gold five-session change | cross-market vote | gold |
| Dollar smile | context only | No additional feed |
| Equity versus USD | cross-market vote | qqq |
| Economic surprise / release surprise | excluded from 05:00 score and gates | No additional feed |
| F8 Fed bias | excluded | No additional feed |
| Release surprise at first print | excluded from 05:00 score and gates | No additional feed |
| USD session momentum | USD momentum vote | ice |
| USD overnight range position | excluded | No additional feed |
| USD session volatility regime | excluded | No additional feed |
| Safe-haven demand | excluded | No additional feed |
| Risk-on / risk-off cross-asset state | shared F1 | vix |
| Known releases between cutoff and endpoint | event gate | calendar |
| Days since and until high-impact events | shared F23 | calendar |
| Data-quality gate for abstention | integrity gate | No additional feed |
