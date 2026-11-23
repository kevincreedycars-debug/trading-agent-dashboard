# Layer 1 historical morning run — 2024-03-26

Schema `layer1-morning-run.v1`, research only, built on 2026-11-17 from the committed artefacts. Session: 2024-03-26T05:00:00.000Z to 2024-03-27T05:00:00.000Z (24 hours).

> Strict evidence: **not ready**. No morning in the archive carries a verified 05:00 receipt for every required input. The current adapter's allowed outcome is a narrow presence/freshness replay, not strict evidence; H1 is blocked by its nine-input contract.

## 1. Decisions

| Model | Outcome | Direction | Conviction | Trade | Gate / evidence grade |
| --- | --- | --- | --- | --- | --- |
| Current USD model (`usd_control_v1` agent_usd_direction.md (production baseline, replayed by backtester/replay/usd/usd_replay_core.js)) | allowed | BEARISH | 3 | yes | data_present_and_fresh (narrow_presence_and_freshness_only) |
| Legacy 25-row book (`usd_candidate_25f_v1` usd-l1-factor-rulebook-v1.0.0 / usd-l1-decision-rules-v1.0.0) | allowed | BEARISH | 3 | yes | book_checks |
| USD-L1-25F-H1-v0.1.0 (`usd_l1_25f_h1` USD-L1-25F-H1-v0.1.0) | blocked | NO_CALL | — | no | h1_historical_evidence_blocked |

The current adapter is allowed under its declared narrow gate, but that gate does not prove a 05:00 receipt. H1 is blocked, so its direction is `NO_CALL`, conviction is null and trade is `no`.

## 2. Current-model inputs

| Field | Value | Source | Availability | Freshness | Applied rule | Contribution |
| --- | ---: | --- | --- | --- | --- | --- |
| `vix_level` | 13.19 | fred VIXCLS | 2024-03-26 (date only); published —; received — | fresh (lag 1 business days) | live.f1-vix-level, live.f9-dollar-smile | live.f1-vix-level BEARISH -10; live.f9-dollar-smile BEARISH -1 |
| `vix_d5_chg` | -1.14 | fred VIXCLS | 2024-03-26 (date only); published —; received — | fresh (lag 1 business days) | live.f1-vix-level, live.f9-dollar-smile | live.f1-vix-level BEARISH -10; live.f9-dollar-smile BEARISH -1 |
| `us_2y_d5_bps` | -19 | fred DGS2 | 2024-03-26 (date only); published —; received — | fresh (lag 1 business days) | live.f2-us-2y-delta | live.f2-us-2y-delta BEARISH -14 |
| `us_10y_real_d5_bps` | -11 | fred DFII10 | 2024-03-26 (date only); published —; received — | fresh (lag 1 business days) | live.f4-real-yield-delta | live.f4-real-yield-delta BEARISH -10 |
| `broad_dollar_d5_pct` | 0.6511 | fred DTWEXBGS | 2024-03-26 (date only); published —; received — | fresh (lag 1 business days) | live.f5-dxy-delta | live.f5-dxy-delta BULLISH +14 |
| `gold_d5_pct` | 0.7103 | cached one-hour provider series XAU/USD H1 | 2024-03-26T05:00:00.000Z (timestamp); published —; received — | fresh (lag 2 business days) | live.f6-gold-delta | live.f6-gold-delta BEARISH -4 |
| `nasdaq100_d5_pct` | 2.01 | cached one-hour provider series NAS100 H1 | 2024-03-26T05:00:00.000Z (timestamp); published —; received — | fresh (lag 3 business days) | live.f10-equity-versus-usd | live.f10-equity-versus-usd BEARISH -1 |
| `eurusd_d5_pct` | -0.6521 | fred DEXUSEU; fred DEXJPUS; cached one-hour provider series EUR/USD H1 | 2024-03-26 (date only); published —; received — | fresh (lag 1 business days) | — | no published current factor reads it |
| `usdjpy_d5_pct` | 1.4818 | fred DEXUSEU; fred DEXJPUS; cached one-hour provider series EUR/USD H1 | 2024-03-26 (date only); published —; received — | fresh (lag 1 business days) | — | no published current factor reads it |
| `gold_price` | 2172.995 | cached one-hour provider series XAU/USD H1 | 2024-03-26T05:00:00.000Z (timestamp); published —; received — | fresh (lag 2 business days) | live.f6-gold-delta | live.f6-gold-delta BEARISH -4 |
| `nasdaq100_price` | 18346.5 | cached one-hour provider series NAS100 H1 | 2024-03-26T05:00:00.000Z (timestamp); published —; received — | fresh (lag 3 business days) | live.f10-equity-versus-usd | live.f10-equity-versus-usd BEARISH -1 |
| `eurusd` | 1.0817 | fred DEXUSEU; fred DEXJPUS; cached one-hour provider series EUR/USD H1 | 2024-03-26 (date only); published —; received — | fresh (lag 1 business days) | — | no published current factor reads it |

Input-level contribution lists are references to the factor rows; they are not additive. The factor table in §4 is the additive view.

## 3. H1 inputs

| Input | Required source / instrument | Archived value | Availability | Freshness | Applied rule | Contribution | First blocker |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| VIX close | Cboe / VIX spot close | 13.19 | 2024-03-26 (date only); published —; received — | not_demonstrated (max 96h) | not applied (gate closed) | not applied | unclocked |
| DGS2 5d | Federal Reserve H.15 / DGS2 | -19 | 2024-03-26 (date only); published —; received — | not_demonstrated (max 96h) | not applied (gate closed) | not applied | derived_only |
| US-DE 2Y spread 5d | H.15 + Bundesbank BBSIS / DGS2 minus DE sovereign Svensson 2.0-year zero-coupon spot | -9 | missing; no clock | not_demonstrated (max 96h) | not applied (gate closed) | not applied | derived_only |
| DFII10 5d | U.S. Department of the Treasury / DFII10 | -11 | 2024-03-26 (date only); published —; received — | not_demonstrated (max 96h) | not applied (gate closed) | not applied | derived_only |
| DTWEXBGS 5d | Federal Reserve H.10 / DTWEXBGS | 0.6511 | 2024-03-26 (date only); published —; received — | not_demonstrated (max 192h) | not applied (gate closed) | not applied | derived_only |
| DXY.cash 05:00 return | FTMO Global Markets Ltd / DXY.cash (spot CFD on the dollar index basket) | — | missing; no clock | not_demonstrated (max 0h) | not applied (gate closed) | not applied | missing_value |
| LBMA gold PM 5d | LBMA / LBMA Gold Price PM USD | 0.7103 | 2024-03-26T05:00:00.000Z (timestamp); published —; received — | not_demonstrated (max 96h) | not applied (gate closed) | not applied | identity_mismatch |
| QQQ close 5d | Nasdaq / QQQ official close | 2.01 | 2024-03-26T05:00:00.000Z (timestamp); published —; received — | not_demonstrated (max 96h) | not applied (gate closed) | not applied | identity_mismatch |
| Release calendar | BLS + BEA + Federal Reserve / CPI, Employment Situation, advance GDP, Personal Income and Outlays, FOMC policy decisions | 0 | missing; no clock | not_demonstrated (max 24h) | not applied (gate closed) | not applied | incomplete_calendar |

H1 arithmetic is not run on a closed gate. A blocked row therefore has no contribution, no direction and no trade, and no legacy value is relabelled as H1 evidence.

## 4. Current-model factor contributions

| Factor | Signal | Weight | Signed contribution |
| --- | --- | ---: | ---: |
| live.f1-vix-level | BEARISH | 10 | -10 |
| live.f2-us-2y-delta | BEARISH | 14 | -14 |
| live.f3-us-de-2y-spread-delta | NEUTRAL | 10 | 0 |
| live.f4-real-yield-delta | BEARISH | 10 | -10 |
| live.f5-dxy-delta | BULLISH | 14 | +14 |
| live.f6-gold-delta | BEARISH | 4 | -4 |
| live.f7-economic-surprise | NEUTRAL | 24 | 0 |
| live.f8-fed-bias | NEUTRAL | 12 | 0 |
| live.f9-dollar-smile | BEARISH | 1 | -1 |
| live.f10-equity-versus-usd | BEARISH | 1 | -1 |

Sum of signed weights: **-26**. Published conviction: **3**. The signed weights sum to the published net weight. Weights are model weights, not measured edge.

## 5. Sample reconciliation before scoring

| Model | Scheduled | Blocked | Valid abstentions | Allowed | Directional calls | Allowed NO_CALL | Trades | Performance |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Current model (narrow gate) | 725 | 108 | 0 | 617 | 609 | 8 | 194 | UNSCORED (0/0) |
| Legacy 25-row book | 725 | 541 | 143 | 41 | 41 | 0 | 41 | UNSCORED (0/0) |
| H1 candidate | 725 | 725 | 0 | 0 | 0 | 0 | 0 | NO_DENOMINATOR (0/0) |

blocked = evidence failed at a blocking check; abstained = every blocking check passed and the model declined; directional = allowed with BULLISH or BEARISH; no_call_allowed = allowed with NO_CALL. Performance is not scored until a directional denominator survives the gate.

The legacy engine-v1 artefact's own flags are preserved separately: 196 direction flags (87 BULLISH, 109 BEARISH) and 62 trade flags. The shared engine withholds direction and trade on blocked mornings, so 75 of those directions and 21 of those trade flags sit on blocked mornings and remain audit findings, not trades. The gated candidate row above therefore shows 41 allowed directional calls and 41 trades. Source: `data/usd-layer1-backtester/engine-v1.json morning_states[]`.

## 6. Legacy input-clock audit and reach benchmark

**0 of 725** — legacy run-v1 input-clock gate: present 618, fresh 617, clocked 0, identified 0 of 725. It belongs to `data/usd-layer1-backtester/run-v1.json validity_gate.ladder` and docs/research/usd-session/v1/layer1_backtest_report.md §5. Readiness; it is not H1 coverage.

**97% — half-distance reach, not accuracy.** Layer 1: 2418 of 2493 (97%, 95% CI 96.25–97.59). Layer 2: 1549 of 1592 (97.3%, 95% CI 96.38–97.99). Half distance is ADR20 × 0.25. There is no entry, stop, sequence or adverse boundary, so this is not a win rate or directional accuracy. Source: data/half-l2l-reach-summary.json.

## 7. H1 missing evidence

| Input | Code | Failed rungs | Reason |
| --- | --- | --- | --- |
| VIX close | `unclocked` | original, fresh, clocked, identity | VIX close: FRED VIXCLS is an alias for the Cboe VIX close, but the archive stores neither the Cboe record nor a receipt clock. The 05:00 availability is unproven. |
| DGS2 5d | `derived_only` | original, lookback, fresh, clocked, identity | DGS2 5d: Only the five-interval change is stored. The five DGS2 observations, their vintages and clocks are absent, so the change cannot be reconciled to H1's declared transform. |
| US-DE 2Y spread 5d | `derived_only` | original, lookback, fresh, clocked, identity | US-DE 2Y spread 5d: No DGS2-minus-Bundesbank spread is present in the H1 input fields. The archive cannot construct the declared five common-interval change or its clocks. |
| DFII10 5d | `derived_only` | original, lookback, fresh, clocked, identity | DFII10 5d: The archive stores only the five-interval change. The five DFII10 observations and their vintages were absent until the 2026-11-20 acquisition read the Treasury's Daily Treasury Real Yield Curve history directly. |
| DTWEXBGS 5d | `derived_only` | original, lookback, fresh, clocked, identity | DTWEXBGS 5d: Only the five-interval return is stored. The five DTWEXBGS observations and their vintages are absent, so the return and its clocks cannot be verified. |
| DXY.cash 05:00 return | `missing_value` | present, original, lookback, fresh, clocked, identity | DXY.cash 05:00 return: no value in the archive; The archive holds the completed-hour DXY.cash tape from 2024-12-10 (10052 bars). The 05:00 London value is the bar that closes at the cutoff, so it needs no lookahead; but the broker prints no bar on a weekend or holiday boundary, and the export carries no publication receipt. A morning without its own 05:00 bar is blocked, never filled from a neighbouring hour. |
| LBMA gold PM 5d | `identity_mismatch` | original, lookback, fresh, clocked, identity | LBMA gold PM 5d: The legacy gold return is derived from an OANDA XAU/USD quote, not the LBMA Gold Price PM USD auction. The instrument identity fails before the missing five fixings are considered. |
| QQQ close 5d | `identity_mismatch` | original, lookback, fresh, clocked, identity | QQQ close 5d: The legacy return is the Nasdaq-100 index, not the QQQ ETF's official close. The instrument identity fails, and the five closes and split adjustment are absent. |
| Release calendar | `incomplete_calendar` | original, lookback, fresh, clocked, identity, schedule_complete | Release calendar: Only the FOMC statement archive is staged. CPI, Employment Situation, advance GDP, Personal Income and Outlays schedules are absent, so the event window cannot be answered for the complete declared calendar. |

## 8. Recoverable gaps and what to acquire

| Input | Archived value | What is recoverable | Acquisition |
| --- | ---: | --- | --- |
| VIX close | 13.19 | Cboe daily close history and release calendar can reconstruct the publication timestamp; recipient receipt cannot be reconstructed. | Acquire the Cboe VIX official close history and the collector receipt at 05:00 London. Retain the exact close used and its observed/published/received clocks for every session. |
| DGS2 5d | -19 | FRED ALFRED vintages reconstruct the publication series; recipient receipt at 05:00 London cannot be reconstructed from the archive. | Acquire the H.15 DGS2 daily series with ALFRED vintages and the five raw observations behind each change. Record publication and collector receipt clocks. |
| US-DE 2Y spread 5d | -9 | Both publication series are public and can reconstruct the spread and publication times; no receipt clock is archived. | Acquire H.15 DGS2 and Bundesbank BBSIS 2.0-year Svensson zero-coupon spot histories. Compute the spread only on common observation dates and retain all five operands, publication times and collector receipts. |
| DFII10 5d | -11 | The published value and a publication time no earlier than the publisher's stated release time are reconstructable. A recipient receipt at 05:00 London cannot be reconstructed from a historical archive. | Read the Daily Treasury Real Yield Curve 10-year column for every business day in the run window and retain the five completed intervals behind each change. A receipt is required only for sealed live replay. |
| DTWEXBGS 5d | 0.6511 | FRED ALFRED vintages reconstruct the publication series; recipient receipt at 05:00 London cannot be reconstructed. | Acquire the H.10 DTWEXBGS daily series with ALFRED vintages and the five raw observations behind each return. Record publication and receipt clocks. |
| DXY.cash 05:00 return | — | Publication at the cutoff is proven by the completed bar itself. A recipient receipt cannot be reconstructed from a retrospective export, so sealed live replay stays blocked for this input. | Collect the DXY.cash 05:00 bar close live at the cutoff and record a genuine receipt, so this input can also enter the sealed lane. No ICE licence is required and none is requested. |
| LBMA gold PM 5d | 0.7103 | LBMA auction records reconstruct the PM publication time; the archive contains neither the auction records nor a receipt. | Acquire the LBMA Gold Price PM USD auction history (do not substitute OANDA XAU/USD). Retain five completed fixings, publication timestamps and collector receipts. Access is licensed: the LBMA prices page read on 2026-11-20 states an IBA licence is required to obtain and use historical benchmark data, so this is a paid-access decision, not a free download. |
| QQQ close 5d | 2.01 | Nasdaq official close history reconstructs the publication time; the archive contains neither the official closes nor a receipt. | Acquire Nasdaq official QQQ closing prices (not the Nasdaq-100 index) and five completed closes, split-adjusted as known at each cutoff. Record publication and receipt clocks. |
| Release calendar | 0 | Official schedules and release timestamps reconstruct the published release times; collector receipt times are not archived. | Acquire complete archived BLS, BEA and Federal Reserve schedules for CPI, Employment Situation, advance GDP, Personal Income and Outlays and FOMC decisions. Record each release timestamp and collector receipt. |

## 9. Remaining work towards the four backtests

| Test | State | Input still needed | Blocker |
| --- | --- | --- | --- |
| Official dollar index direction | unscored | an official dollar index 05:00 London fix to score test 1 against; the H1 `ice` input no longer waits for one, because amendment H1-A01 takes the archived DXY.cash tape as its source | no official index series is held, so 0 of 725 mornings are scored in this lane; the 49.65% figure is the labelled DXY.cash broker control and is not this test |
| Four-market confirmation | legacy_proxy_only | matched-date 05:00-to-05:00 endpoints for EUR/USD, XAU/USD, BTC/USD and NAS100, separately, plus H1 decisions | the legacy 439-536 scored rows per market use reconstructed calls and are not H1 decisions |
| Original L2L 5R geometry | blocked | a trade-qualified call, contemporaneous pre-setup levels, and actionable bid/ask M5 sequencing with costs and sizing | 0 usable sessions: the archive has no pre-05:00 ladder or full M5 tape |
| Original plus midpoint 3R geometry | blocked | the same M5 tape, levels and frozen 3R management, with full and midpoint geometry kept separate | 0 usable sessions: same two missing inputs as the 5R test |

## 10. External state verified where access allowed

- Supabase (eaolqbrlywczinfordvg): historical warehouse / snapshot builder / replay engine / outcome evaluation / research SQL all Complete; 604 snapshot rows; 2,416 predictions; 12,080 evaluation rows; first 2024-01-02, last 2026-04-30. Newest primary snapshot 2026-04-30. the publishable key can read the public views only; runtime view definitions, grants and the 0-row anonymous base-table reads need a database/service-role connection.
- n8n (silver17.app.n8n.cloud): health HTTP 200; HTTP 401 Unauthorized for /rest/executions and /rest/workflows. no n8n API key, session cookie or login is present; run history and schedule state remain unverified.
- `usd-24h-research-dataset.json`: 584 rows, 583 evaluable, 2024-01-02 to 2026-04-30, call 09:30:00 ET, outcome DXY. absent from canonical and strategy HEAD; the recovered population is a 09:30 ET DXY study, not a 05:00 London H1 input.

## 11. Provenance

Report digest: `89a6a82b02905532d84aa198ecba5f8a2bc585a223e6ee556905251ae313c0d1`

| Input | Bytes | sha256 |
| --- | ---: | --- |
| `data/usd-layer1-backtester/run-v1.json` | 6583957 | `0fea034745c343610c441ffa3a0e35304222a73ea8034f9c78055ea9e1e861f3` |
| `data/usd-layer1-backtester/engine-v1.json` | 927740 | `f4290bae4ff91a41727f717f0f7138dffedbf8b3e2a3dc824dcdceeb7aeab6c8` |
| `data/usd-layer1-backtester/event-calendar-v1.json` | 13606 | `339579f057382c119aace8360a3c19ac13420b3747b07a974c6baae833117bd8` |
| `backtester/packages/USD-L1-25F-H1-v0.1.0/inputs.json` | 1144 | `144ae500af5c9d4d1f37a7be2b34b5074f8a85c89269ff699895155f2db4a77f` |
| `backtester/packages/USD-L1-25F-H1-v0.1.0/rows.json` | 9442 | `47aa93fc97769e45999e2420738ae1b847b62bcc62c022c1358d0a0c3a6d0215` |
| `data/half-l2l-reach-summary.json` | 1155705 | `5d32f4ff4e9287121a75cd746549115f39e0b01afd4bdb078d03668f8c5e40fa` |

The digest is over the body before this block. The report builder reruns the same committed artefacts and must reproduce it.

