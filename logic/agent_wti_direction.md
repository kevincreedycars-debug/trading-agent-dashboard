# WTI Layer 1 Direction Agent

Version: 0.2_research_conviction_engine
Status: Research onboarding only. Do not use for live calls until historical replay, provider review, checker validation and n8n runtime review pass.

## Scope

The agent analyses WTI crude oil as an independent Layer 1 asset. It emits a raw WTI directional classification for the next 24 hours. It must not produce WTI/USD pair calls, trade recommendations, execution instructions, or use another agent's output.

## 24H Factor Contract

| Factor | Weight | Input | WTI interpretation |
| --- | ---: | --- | --- |
| F1 WTI own-price impulse | 20 | `wti_d1_pct` | A move of at least 1.0% confirms the matching direction; otherwise neutral. |
| F2 five-day WTI trend | 14 | `wti_d5_pct` | A move of at least 2.0% supports the matching direction; otherwise neutral. |
| F3 US dollar pressure | 14 | `dxy_d1_pct` | A weaker broad dollar supports WTI; a stronger dollar pressures WTI. |
| F4 risk appetite | 10 | `vix_level` | VIX below 16 supports bullish WTI; above 25 supports bearish WTI. |
| F5 US growth proxy | 10 | `sp500_d1_pct` | A move of at least 0.5% confirms the matching risk direction; otherwise neutral. |
| F6 US 2Y rate impulse | 8 | `us_2y_d5_bps` | Rising at least 5 bps is bearish; falling at least 5 bps is bullish. |
| F7 WTI price-vs-dollar confirmation | 8 | `wti_d1_pct`, `dxy_d1_pct` | WTI rising while dollar falls is bullish; WTI falling while dollar rises is bearish. |
| F8 WTI market regime | 6 | `wti_regime` | `CONTANGO` is bearish and `BACKWARDATION` bullish; unknown is neutral. |
| F9 inventory balance | 5 | `eia_crude_inventory_surprise` | A verified draw is bullish; a verified build is bearish. Unavailable in this draft. |
| F10 supply-policy shock | 5 | `opec_supply_bias` | A verified supply cut is bullish; a verified increase is bearish. Unavailable in this draft. |

Weights are provisional hypotheses and sum to 100. Missing inputs are neutral and reduce maximum attainable conviction. The agent must never infer unavailable inventory, OPEC, or curve data.

## Input and Output Contract

Required identity fields are `asset: "WTI"`, `snapshot_date`, `run_time_et`, and `wti_price`. Price is the FRED `DCOILWTICO` daily Cushing spot series, in USD per barrel. Context series use FRED `DTWEXBGS` as a broad-dollar proxy, `VIXCLS` for VIX, `SP500` for equity context, and `DGS2` for the US 2Y yield. Delta fields are percent changes or basis-point changes versus valid prior observations.

The live workflow reads those series inside the sealed agent immediately before scoring, because the shared `market_snapshots` table has no WTI columns. The resulting input values are recorded in the agent's own `full_output` so the call remains reproducible. An offline collector draft exists in `workflows/wti_collector.md` and stays unimported until the market_snapshots schema carries WTI columns; if that column set is added, the collector becomes the snapshot source and the agent should read the snapshot instead.


The 24H output contains `asset`, `agent_name: "WTI"`, `layer: 1`, `logic_document`, `logic_document_version`, `direction_24h`, `conviction_24h`, `call_24h_direction`, `call_24h_conviction`, `call_24h_reason`, `factor_breakdown`, `weighted_score`, `conviction_model`, `timeframe_models`, `score_bullish`, `score_bearish`, `score_neutral`, `non_neutral_count`, `missing_inputs`, `warnings`, `risk_flags`, `reasoning_summary`, `full_output` and `raw_agent_output`. No usable snapshot means no output row.

This field set matches the shared Layer 1 contract used by the other live asset agents so the Layer 2 trade selection agent and the Dashboard Writer can consume a WTI row without WTI-specific code.

## Deterministic Conviction Contract

The model returns factor signals only and must never calculate conviction; the deterministic gate is the single conviction source.

- Weights are provisional hypotheses and sum to 100.
- Unknown, malformed or missing signals are scored `NEUTRAL`. Unavailable inputs are named in `missing_inputs` and `warnings`; they are never inferred.
- `weighted_score` reports `bullish_weight`, `bearish_weight`, `neutral_weight`, `active_weight` and `weight_margin`.
- `conviction_model` reports bull/bear argument percentages, directional participation, net edge, `final_conviction`, `verdict_strength` (`VERY_STRONG`/`STRONG`/`MODERATE`/`WEAK`) and `winning_side`.
- Direction is `BULLISH` or `BEARISH` only when active weight is at least 50, the weight margin at least 15 and the net edge at least 20; otherwise the direction is a `_LEAN`. A tie or zero active weight is `NO_CLEAR_BIAS` with conviction 0.
- Conviction is the winning argument percentage scaled by `min(active weight, 80)`.
- Only the 24H timeframe is emitted. WTI does not publish 3-day, current-week, next-week or current-month calls.
- Because F9 (EIA crude inventory surprise) and F10 (OPEC supply bias) are unavailable in this draft, active weight cannot exceed 90 and conviction cannot exceed 80. Anyone reading a WTI conviction must treat that ceiling as an artefact of missing inputs, not as model strength.


## Missing, Freshness, and Session Rules

- A missing or invalid core WTI price, identity timestamp, or asset identity blocks the snapshot and prevents an agent output.
- A snapshot is stale when `run_time_et` is more than 26 hours old and its `snapshot_date` precedes the latest expected WTI trading weekday.
- WTI futures trade nearly continuously from Sunday evening through Friday evening US Eastern time, with a daily maintenance break. This draft does not claim minute-level session enforcement; the collector records `session_status: "DAILY_SERIES"` and the presentation layer must suppress calls during the Saturday closure and outside any approved runtime session.
- Missing optional factors are explicitly listed and scored neutral. The unavailable EIA inventory and OPEC policy factors remain null until authoritative providers and release timing are approved.

## Isolation and Validation

The agent reads only this logic document and its own WTI inputs. It must not read Layer 1 outputs, Layer 2 outputs, dashboards, pair engines, or backtester verdicts. The live workflow is active and writes only `agent_outputs` rows for WTI; the collector draft in `workflows/wti_collector.md` is inactive and not imported. Contract tests validate synthetic shape, insert safety and deterministic behaviour only; they do not validate historical replay, predictive edge, provider release timing or trading readiness. Weights remain provisional hypotheses.
