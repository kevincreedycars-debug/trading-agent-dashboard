# USD factor sets: the book that is deployed, the programme that is registered, the challenger that was measured

2026-11-15 · public summary used by the Architecture map's USD inspector · research-only

The Architecture map shows one USD lane, but three different factor sets are named in the same lane. They are not
interchangeable, and the weight numbers on the map belong to only one of them. This page keeps them apart so a
visitor can tell which model a number comes from before reading it as evidence of anything.

| Set | Size | Where it lives | What a weight means |
| --- | --- | --- | --- |
| Deployed Layer 1 book | 10 factors, F1-F10 | `exports/usd_layer1_agent.json`, `logic/agent_usd_direction.md` | An integer weight per factor per timeframe; the rulebook states a second vector |
| Research programme | 25 factor chains | `data/research-library/catalog.json` | No weight at all: each chain carries a prompt, a review and an upload slot |
| Historical challenger | 9 mechanisms over 7 families | `data/usd-layer1-backtester/run-v1.json` → `challenger_v1` | One unit of say per shared-source family, split evenly inside the family; no fitted weight |

## Set A · the deployed book computes ten factors

The ten factors, their rules and their status words are transcribed from the baseline audit in
`docs/research/handoff/usd/v1/USD_FACTOR_REGISTER.md`. The weight column below quotes two of the register's own rows:
the 24h entry in the coded table (what the executing node applies at the 24h timeframe) and the rulebook row (what
`logic/agent_usd_direction.md` states).

| Factor | Rule | Coded 24h | Rulebook |
| --- | --- | --- | --- |
| F1 VIX level and risk regime | VIX above 25 BULLISH, 16 to 25 NEUTRAL, below 16 BEARISH | 10 | 10 |
| F2 US 2Y yield delta | at or above +5 bps BULLISH, at or below -5 bps BEARISH | 14 | 14 |
| F3 US-DE 2Y spread delta | the same +/- 5 bps band on one fixed five-day window | 10 | 16 |
| F4 US 10Y real yield delta | the same +/- 5 bps band on the timeframe's lookback | 10 | 14 |
| F5 DXY delta | +/- 0.15 per cent on 24h, +/- 0.30 per cent on every other timeframe | 14 | 6 |
| F6 Gold delta | below -0.1 per cent BULLISH, above +0.1 per cent BEARISH | 4 | 5 |
| F7 US economic surprise | the stored event string is read unexamined | 24 | 3 |
| F8 Fed bias | a hawkish string BULLISH, a dovish string BEARISH | 12 | 18 |
| F9 Dollar Smile regime | VIX above 25 BULLISH, VIX below 16 without a hawkish bias BEARISH | 1 | 12 |
| F10 Equity versus USD | VIX and NQ jointly decide the regime read | 1 | 2 |

The two vectors disagree for nine of the ten factors (F1 and F2 agree), and every disagreement is catalogued in
`docs/research/usd-session/v1/weight_vector_discrepancy.md`. Neither vector is a validated weight: every register row
reads research ready or research blocked, review pending, backtest not tested.


## Set B · the programme registers twenty-five factors, none of them replayed

`data/research-library/catalog.json` holds twenty-five factor chains over six topic labels (VIX and risk regime,
front-end rates, the dollar index, gold and equities, economic surprise and Fed bias, FX session structure, calendar
and data quality). Each chain is a research unit with three stages - a research prompt, a red-team review and an
adjudication prompt - generated at `research-prompt-v3.2.0` under the contract
`docs/research-library/USD_North_Star_Model_Contract_v2.md`.

Ten of the twenty-five chains carry the deployed factor ids (`live.f1-vix-level` to `live.f10-equity-versus-usd`).
The other fifteen are research-named factors: `risk.*`, `rates.*`, `macro.*`, `fx.*`, `calendar.*` and `data.*`. The
programme therefore registers more than the engine computes, and no replay uses all twenty-five. The map says that in
one sentence in the replay chamber and links the catalogue; the catalogue itself is the register.

## Set C · the challenger measured nine inputs at one unit of say per source

The challenger is `usd-layer1-challenger-v1`, "Shared-source weighting experiment", frozen on 2026-11-10 with
`usd-layer1-challenger-v0` kept frozen as its benchmark. Its own status is `RESEARCH_FROZEN_NOT_VALIDATED` and
`CONFIG_BLOCKED`: the adjudication that produced it validates no sign, weight or threshold, so it is not a candidate
for a live engine.

| Family (1 unit each) | Factor | Mechanism | Input | Weight |
| --- | --- | --- | --- | --- |
| Risk regime | `live.f1-vix-level` | VIX level | `vix_level` | 0.5 |
| Risk regime | `live.f1-vix-level` | VIX five-day change | `vix_d5_chg` | 0.5 |
| US front end | `live.f2-us-2y-delta` | 2Y five-day change | `us_2y_d5_bps` | 1 |
| US real yield | `live.f4-real-yield-delta` | 10Y real yield five-day change | `us_10y_real_d5_bps` | 1 |
| Broad dollar | `live.f5-dxy-delta` | Dollar five-day move | `broad_dollar_d5_pct` | 1 |
| Gold | `live.f6-gold-delta` | Gold five-day move | `gold_d5_pct` | 1 |
| Equities | `live.f10-equity-versus-usd` | NAS100 five-day move | `nasdaq100_d5_pct` | 1 |
| FX mirrors | `fx.usd-session-momentum` | EUR/USD mirror | `eurusd_d5_pct` | 0.5 |
| FX mirrors | `fx.usd-session-momentum` | USD/JPY mirror | `usdjpy_d5_pct` | 0.5 |

So the challenger scores six of the deployed ten factors - F1, F2, F4, F5, F6 and F10 - plus one research factor,
`fx.usd-session-momentum`. Four deployed factors are absent: F3, because the German leg of the spread is missing data
and the pairs are accounted under the FX-session factor that the 2026-11-04 adjudication labels F11; F7 and F8,
because their research is blocked; and F9, because the USD/JPY mirror was attributed to FX session momentum instead.
The two FX mirrors are declared proxies for a research factor, not a deployed one. Version 0 scored the same nine
inputs at plain equal weight, so the two versions stay comparable; version 1 only splits one unit of say inside a
shared-source family.

## Which model the F5 weights belong to

The map's F5 row shows `14 coded / 6 rulebook`. Both numbers belong to Set A, the deployed book: 14 is the coded
24-hour weight in `Calculate USD Conviction` inside `exports/usd_layer1_agent.json`, and 6 is the weight the rulebook
states for the same factor. The challenger uses neither number: F5 is its `dollar_path` family and holds one unit of
seven, read from a five-day move of a broad dollar index at a 0.15 per cent band, with FRED `DTWEXBGS` declared as the
stand-in for ICE DXY. The programme registers F5 as one of its twenty-five chains and assigns it no weight.

## Where to check each claim

- `docs/research/handoff/usd/v1/USD_FACTOR_REGISTER.md` - the ten rows, the two weight vectors, the status words.
- `docs/research/usd-session/v1/weight_vector_discrepancy.md` - every place the coded and rulebook vectors disagree.
- `data/research-library/catalog.json` - the twenty-five chains, their topics and their prompt hashes.
- `data/usd-layer1-backtester/run-v1.json` - `challenger_v1`: families, mechanisms, rules and status block.
- `backtester/replay/usd/usd_replay_core.js` - the replay that scores both books on the same sessions.

## What this page does not claim

It does not claim a directional edge, a validated weight, a calibrated confidence or extra call coverage for any of
the three sets. It does not claim the deployed engine and the challenger were scored on identical samples: the
challenger's own status block records that the target of its first test, official ICE cash DXY, is not priceable in
this checkout. And it does not claim any of the twenty-five registered factors has been through a replay.
