# SILVER Layer 1 Direction Agent

Version: 1.0_weighted_engine  
Status: Inactive draft. Do not activate until provider, schema, replay and checker validation pass.

## Scope

This agent analyses SILVER as the XAG/USD instrument only. It must not produce pair calls, trade
recommendations, Layer 2 decisions, or consume another agent's output.

## 24H Factor Contract

| Factor | Weight | Input | SILVER interpretation |
| --- | ---: | --- | --- |
| F1 US real-yield pressure | 24 | `us_10y_real_yield_d5_bps` | Falling real yields reduce the opportunity cost of holding Silver and score BULLISH; rising real yields score BEARISH. Threshold +/-5bps. |
| F2 Broad-dollar direction | 18 | `dxy_d1` | A weaker dollar is mechanically supportive for a USD-priced metal; threshold +/-0.15% on the 24H horizon. |
| F3 Fed bias | 10 | `fed_bias` | Dovish BULLISH, hawkish BEARISH, unknown NEUTRAL. |
| F4 Silver own-price momentum | 12 | `silver_d1_pct` | Move >= 0.5% on the 24H horizon confirms matching direction; otherwise NEUTRAL. |
| F5 Gold/silver ratio direction | 12 | `gold_silver_ratio_d5_pct` | A rising ratio means Silver is underperforming Gold and scores BEARISH; a falling ratio scores BULLISH. Threshold +/-1.0% on 24H. |
| F6 Volatility regime | 8 | `vix_level` | Signed the opposite way to Gold. VIX above 28 scores BEARISH because risk-off liquidation pressure falls disproportionately on Silver's industrial and liquidity-sensitive component; VIX below 16 scores BULLISH. |
| F7 US economic surprise | 6 | `latest_us_event` | A negative US surprise scores BULLISH; a positive US surprise scores BEARISH. |
| F8 Industrial demand regime | 5 | `industrial_demand_regime` | Expanding industrial demand BULLISH, contracting BEARISH. |
| F9 Growth/liquidity regime | 4 | `global_growth_regime` | Weak or contracting growth scores BEARISH because it reduces cyclical demand; improving or supportive growth scores BULLISH. |
| F10 Supply/event context | 1 | `silver_supply_event` | No verified physical supply or event feed is wired, so this factor is always NEUTRAL and must never be guessed. |

The 24H weights above total 100. Longer horizons shift weight from the fast macro and
price-confirmation factors into the structural F8 and F9 demand blocks:

| Factor | 24h | 3d | current_week | next_week | current_month |
| --- | ---: | ---: | ---: | ---: | ---: |
| F1 | 24 | 22 | 20 | 18 | 16 |
| F2 | 18 | 18 | 17 | 16 | 15 |
| F3 | 10 | 10 | 10 | 11 | 11 |
| F4 | 12 | 12 | 12 | 11 | 10 |
| F5 | 12 | 12 | 12 | 12 | 12 |
| F6 | 8 | 8 | 8 | 7 | 6 |
| F7 | 6 | 6 | 6 | 5 | 4 |
| F8 | 5 | 6 | 7 | 9 | 11 |
| F9 | 4 | 5 | 7 | 10 | 14 |
| F10 | 1 | 1 | 1 | 1 | 1 |
| **Total** | **100** | **100** | **100** | **100** | **100** |

Weights are hypotheses pending backtesting, not calibrated production parameters.

## Why SILVER does not reuse Gold's factors

Silver is a USD-priced industrial/precious hybrid rather than a pure monetary safe haven:

- F6 is signed inversely to Gold's equivalent risk factor. In a Gold model, high VIX is a
  safe-haven bid; for Silver, risk-off liquidation pressure usually dominates.
- F9 is signed inversely to Gold's growth factor. Gold gains from defensive demand in a
  weakening-growth regime; Silver loses cyclical fabrication demand.
- F8 carries real weight (rising to 11 at the one-month horizon) because the industrial leg
  is a genuine Silver driver and is near-zero in the Gold weighting.
- F5 (gold/silver ratio) has no Gold equivalent; it is Silver's relative-value anchor.

## Snapshot Contract

A usable snapshot row is the newest shared `market_snapshots` row carrying `snapshot_date` and
`run_time_et`. `market_snapshots` is a single shared table: every collector writes the same
superset, and every Layer 1 agent reads the newest row. Any macro or event field may be null and
then scores NEUTRAL. Missing inputs must be listed explicitly; they must never be fabricated or
silently proxied.

A stale snapshot produces no usable call. Weekend presentation suppression is applied by the
dashboard writer, not by this agent; the agent always publishes its raw classification so it
remains auditable.

## Provider and availability status

- XAG/USD spot: Coinbase `XAG-USD` spot, the same provider pattern already used for Gold's
  `XAU-USD`. The returned shape matches Gold's (`data.amount`).
- Gold spot for the ratio: Coinbase `XAU-USD`.
- US real yields, US 10Y, US 2Y, broad dollar and VIX: existing approved FRED series
  (`DFII10`, `DGS10`, `DGS2`, `DTWEXBGS`, `VIXCLS`) via `$env.FRED_API_KEY`.
- Industrial demand: FRED `PCOPPUSDM` (global copper price) and `INDPRO` (US industrial
  production), both monthly, compared on a three-period lookback. Both series must agree
  before the regime is called expanding or contracting.
- Economic events and Fed bias: the existing Finnhub calendar path already used by Gold.
- Silver supply/event context: no verified provider exists. `silver_supply_event` stays null.

## Output Contract

The workflow emits `agent_name: SILVER`, `layer: 1`, `logic_document: agent_silver_direction.md`,
per-timeframe `direction_*`/`conviction_*`/`reason_*` for 24h, 3d, current week, next week and
current month, `factor_breakdown`, `weighted_score`, `conviction_model`, `score_*`,
`reasoning_summary`, plus `full_output` and `raw_agent_output`. The deterministic gate recomputes
direction and conviction from factor signals; model confidence is never trusted as a score.
`NO_CLEAR_BIAS` and `*_LEAN` are valid outputs when evidence is balanced or thin.
