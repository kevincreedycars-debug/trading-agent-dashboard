# USD input and decision inventory (WP1, extracted 2026-10-13)

Everything below is **extracted from the repository**, not researched and not tested for predictive value.
Sources: `exports/usd_layer1_agent.json` (live deployment identity measured for code nodes on 2026-10-11
against workflow `OCt1tB9yVMUgFTha` v154), `exports/usd_collector.json`, `logic/agent_usd_direction.md`
(fetched live by the workflow from GitHub on every run), `docs/review/usd-24h-ruleset-v1/discovery_report.md`
(C1–C12), `docs/review/usd-24h-ruleset-v1/live_export_and_harness_report.md`.

## 1. The path from inputs to the published call

```
Data Collector - USD (29 nodes)
  -> Supabase table `market_snapshots`, one row appended per run (one row per day in practice)
USD Layer 1 Agent (9 nodes)
  Supabase Get Many (getAll, no filter, whole table)
  -> Build USD Input Pack        (selects the snapshot, builds available_inputs, warnings)
  -> Get USD Logic Document      (GitHub, logic/agent_usd_direction.md, oAuth2, live fetch)
  -> Combine md & market snapshot
  -> Message a model             (gpt-4.1-mini, returns valid JSON only)
  -> Parse USD Agent Output      (parses factor verdicts, no arithmetic)
  -> Calculate USD Conviction    (deterministic weighted scoring; strips raw inputs)
  -> Create a row                (Supabase `agent_outputs`)
  -> read back by the dashboard / Build Layer 1 JSON
```

The LLM writes **verdict strings per factor**; the JavaScript node computes every number that is published.
Where the LLM and the code disagree, the published number is the code's.

## 2. Inputs: source, units, timing, availability

| Key in the input pack | Collector node and source | Units | Transformation exposed to the engine | Availability at 09:30 ET run |
| --- | --- | --- | --- | --- |
| `dxy_level`, `dxy_d1`, `dxy_d5`, `dxy_d20` | FRED `DTWEXBGS` | index | level and percentage changes over 1/5/20 days | daily, 1–2 business-day publication lag, no as-of check |
| `vix_level`, `vix_d1`, `vix_d5` | FRED `VIXCLS` | index | level and changes | daily, 1-business-day lag |
| `us_2y_yield`, `us_2y_d5_bps`, `us_2y_d20_bps` | FRED `DGS2` | percent / bps | level, 5d and 20d change | daily |
| `de_2y_yield`, `de_2y_d5_bps`, `de_2y_d20_bps` | Bundesbank `BBSSY D.REN.EUR.A610...` CSV | percent / bps | level, changes | daily |
| `us_de_2y_spread*` | **derived in the collector** from US 2Y minus DE 2Y | bps | level, 1/5/20d change | derived, inherits both lags |
| `us_10y_yield`, `us_10y_d5_bps`, `us_10y_d20_bps` | FRED `DGS10` | percent / bps | level, changes | daily |
| `us_10y_real_yield*` | FRED `DFII10` | percent / bps | level, 5d and 20d change | daily |
| `gold_price`, `gold_d1_pct`, `gold_d5_pct`, `gold_d20_pct` | Coinbase `XAU-USD` spot | USD | spot and percentage changes | **intraday spot**, so genuine same-day information |
| `nq_price`, `nq_d1_pct`, `nq_d5_pct`, `nq_d20_pct` | Alpha Vantage `GLOBAL_QUOTE` on `QQQ` | USD | spot (QQQ, not NQ futures) and percentage changes | intraday quote, but the instrument is an ETF, not the index |
| `btc_price`, `btc_d1_pct`, `btc_d5_pct`, `btc_d20_pct` | Coinbase `BTC-USD` spot | USD | spot and changes | intraday; **not used by any 24h factor** |
| `latest_us_event`, `upcoming_events`, `fed_bias` | Finnhub economic calendar (paid key) past and next 7 days, then two derived code nodes | strings / categorical | a pre-computed `usd_signal` per event, a bias string | paid feed, no vintage or consensus archive kept |
| `equities_regime` | collector-derived | string | not read by the deterministic node | — |
| GBP/USD, USD/JPY, USD/CAD, AUD/USD, WTI, Brent, EUR/USD (`DEXUSEU`), UK/JP/DE 10Y proxies | Coinbase spot and FRED monthly/quarterly series | mixed | collected but **not offered to the USD engine** | several are monthly, so stale by construction |

Additional series in `data/usd-24h-dataset-manifest.json` (US 3M, 5Y TIPS, 10Y breakeven, EFFR, SOFR,
high-yield spreads, S&P 500) come from FRED and are **research-only**: no live collector path exists.


## 3. Decision rules actually in the code (24-hour timeframe as deployed)

Weights in `Calculate USD Conviction` for `24h`: `F1 10, F2 14, F3 10, F4 10, F5 14, F6 4, F7 24, F8 12,
F9 1, F10 1` (sum 100). The committed rulebook's own table reads `10, 14, 16, 14, 6, 5, 3, 18, 12, 2`
— a different allocation of the same total. The code is what computes the published call; the rulebook is
also live input to the LLM. This divergence is a finding: two authorities disagree.

| Factor | Signal rule (24h as coded) | Lookback used | Threshold |
| --- | --- | --- | --- |
| F1 VIX level and risk regime | >25 BULLISH, 16–25 NEUTRAL, <16 BEARISH | level only; the rulebook's 1d/5d "modifier" is **not implemented** | 25 / 16 |
| F2 US 2Y yield delta | ≥+5 bps BULLISH, ≤−5 BEARISH | 5d (20d on longer timeframes) | ±5 bps |
| F3 US–DE 2Y spread delta | ≥+5 BULLISH, ≤−5 BEARISH | 5d for 24h | ±5 bps |
| F4 US 10Y real yield delta | ≥+5 BULLISH, ≤−5 BEARISH | 5d (20d on longer timeframes) | ±5 bps |
| F5 DXY delta | ≥+0.15 % BULLISH, ≤−0.15 % BEARISH | **1 day** on 24h (5d/20d elsewhere) | ±0.15 % |
| F6 Gold delta | −0.1 % or lower BULLISH, above +0.1 % BEARISH | 5d, or 1d fallback | ±0.1 % |
| F7 US economic surprise | `latest_us_event.usd_signal` copied straight through | whatever the collector stored | none; unverifiable upstream |
| F8 Fed bias | string contains "hawkish"/"dovish" | current string only, no change measured | none; the rulebook's "delta" is not implemented |
| F9 Dollar Smile regime | VIX>25 BULLISH; VIX<16 and not hawkish BEARISH | level only | 25 / 16 |
| F10 Equity versus USD | VIX<16 with NQ up BEARISH; VIX<16 with NQ down BULLISH; VIX>25 with NQ down BULLISH | NQ 1d on 24h | 16 / 25 |

Aggregation: weights of BULLISH and BEARISH factors become `bullish`/`bearish`; `active = bullish + bearish`;
`bullishArgument = round(bullish/active*100)`; `netEdge = bullishArgument − bearishArgument`; direction is the
larger side, suffixed `_LEAN` when `|netEdge| < 20`, `NO_CLEAR_BIAS` on an exact tie; `conviction` is the
winning argument percentage; strength bands are 40/25/15. Conviction is therefore a **share of active
evidence**, not a probability, and it can read 100 % while half the weight is missing.

## 4. Missing, stale and fallback behaviour

- Missing factor input → that factor scores NEUTRAL (its weight moves to the neutral pile) and the reason
  string names the missing input. `fed_bias` "unknown" is treated as missing.
- `gold_d5_pct` falls back to `gold_d1_pct`; `nq_d5_pct` falls back to `nq_d1_pct`; both record only a
  human-readable warning string, invisible in the numeric payload (C11).

## 6. Original source material

`logic/agent_usd_direction.md` is version 2.1, "Production baseline for USD Layer 1", and cites **no book,
edition or external source**. No book material for this engine exists in the repository (searched `docs/`,
`logic/`, `exports/`, `backtester/` for author/title/reference material). **Gap flagged**: the economic
provenance of the factor set is unavailable, so research cards must supply their own sources rather than
inherit a citation. Version 2.1 superseded an earlier edition whose text is not retained.

## 7. Live versus historical data availability, assessed separately

| Question the new engine asks | Live path today | Historical path today |
| --- | --- | --- |
| USD level at 05:00 London | none (collector runs once, at the 09:30 ET pipeline time) | none intraday; daily FRED `DTWEXBGS` only |
| USD level at 17:00 New York | none | none intraday |
| Foreign 2Y/10Y yields, VIX, real yields, credit spreads | FRED daily with 1–2 day lag at the moment it runs | same series, daily; ALFRED vintages unreachable without a key |
| Risk and cross-asset state at 05:00 London | Coinbase spot (gold, BTC, JPY/GBP/CAD/AUD) is intraday; NQ is a QQQ quote | hourly OANDA caches for EUR/USD, XAU/USD, NAS100 to 2026-04-30 |
| Calendar events known at 05:00 London | Finnhub calendar, no release-instant field retained | paid calendar import exists (RapidAPI ForexData) but no consensus vintage |
| Economic surprise with consensus at the time | paid feeds only | not available: ALFRED vintage CSV 404s without a key |

Consequence for the study: the 05:00→17:00 session can only be built today from (a) hourly intraday pair
and metals caches and (b) daily macro series whose 05:00 value is the **previous** close, correctly lagged.
That is a legitimate and leakage-safe design, but every card must say so, because it means most macro
factors answer "what did yesterday's close say" rather than "what happened overnight".

## 8. Working-paper gaps

1. **DXY spot source** is unverified: no free intraday DXY print is in this repository or the collector.
2. **Book identity** is unavailable (§6).
3. **Rulebook versus code weights** disagree (§3) and both are live.
4. **Calendar/consensus vintages** remain unavailable, so the highest-weight live family (F7+F8 = 36 of
   100 points as coded) stays unevaluable.
5. The collector acquires `us_10y_yield`, `btc_*` and several cross-asset series that the engine never
   reads; research cards should ask whether that omission is deliberate.

- Snapshot selection takes the newest row containing all 14 required fields, else simply the newest row,
  with `selected_by` recording which (C12). There is **no** cutoff-at-t bound, no per-field age, no
  FUTURE/STALE state and no way to exclude revised data.
- Null-versus-unavailable conversion was repaired on 2026-10-11 for USD (`scripts/repair_layer1_null_conversion.js`);
  the repair cannot move an archived call, because all 6,040 stored factor entries already matched the
  replay implementation.
- Raw inputs and selection detail are stripped before the output write (C10).

## 5. Documented rules, implemented behaviour, LLM discretion

| Class | Examples |
| --- | --- |
| Documented **and** implemented | the ten factors, their thresholds, the weighted aggregation, the `_LEAN` rule, missing inputs as neutral |
| Documented but **not** implemented | VIX 1d/5d modifiers and the "stronger message wins" conflict rule; F8 as a *delta*; the rulebook's weight table; the rulebook's participation cap, missing-input penalty, conflict penalty and agreement boost (the code hard-codes those legacy aliases to 0 or to `active`) |
| Implemented but not documented in the rulebook | the 1d DXY read on the 24h timeframe; the `d1→d5` and `5d→20d` substitution ladder; `NO_CLEAR_BIAS` only on an exact tie, which cannot occur with the deployed weights |
| LLM discretion | factor verdict wording and the reasons; nothing numeric. The model may see fields (BTC, `upcoming_events`, `equities_regime`) that the deterministic node ignores |
