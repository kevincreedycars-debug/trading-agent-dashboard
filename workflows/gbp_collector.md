# GBP Collector (DRAFT)

## Purpose

Collect GBP Layer 1 market inputs into `market_snapshots` so the GBP Layer 1 agent can produce an independent raw 24H directional classification. This is a reviewable DRAFT (see `exports/gbp_collector.json`); it is not deployed or activated.

## Trigger

- `Execute Sub-workflow Trigger` ("When Executed by Another Workflow") for Master Orchestrator invocation.
- Draft status: no schedule, `active: false`.

## Inputs

- FRED series (query-string `api_key` is a placeholder in the draft - see Known Issues):
  - `DGS2` (US 2Y Treasury yield) - latest 25 observations
  - `VIXCLS` (VIX)
  - `DTWEXBGS` (broad-dollar index; the repo's "DXY" proxy, same series the EUR collector uses)
  - `IRLTLT01GBM156N` (UK 10Y benchmark yield; context only)
- Coinbase spot `https://api.coinbase.com/v2/prices/GBP-USD/spot`
- Previous `market_snapshots` rows (history for percent deltas)

## Outputs

A single new `market_snapshots` row (insert skipped when the minimum market data is missing):

- identity/audit: `snapshot_date`, `run_time_et`, `source_status`, `collector_version`
- market context: `vix_level`, `vix_d1/vix_d5`, `dxy_level`, `dxy_d1/d5/d20`, `us_2y_yield`, `us_2y_d5_bps`, `us_2y_d20_bps`, `uk_10y_yield`, `uk_10y_d5_bps`, `uk_10y_d20_bps`
- GBP price: `gbpusd_price`, `gbpusd_d1_pct`, `gbpusd_d5_pct`, `gbpusd_d20_pct`
- GBP fundamentals (absent until providers are approved, see Data requirements): `uk_2y_yield`, `uk_2y_d5_bps`, `us_uk_2y_spread_d5_bps`, `boe_bias`, `latest_uk_event`, `uk_composite_pmi`, `uk_composite_pmi_direction`, `uk_stress_flag`
- derived: `equities_regime`, `global_growth_regime` (when shared NQ history exists)
- `data_quality` with `missing` list and notes; `raw_payload` for audit

## Supabase tables touched

- `market_snapshots` (read previous rows, insert new row)

## Key nodes

1. `When Executed by Another Workflow`
2. `HTTP Request | US 2Y Treasury Yield - FRED API`
3. `HTTP Request | VIX - FRED Api` (resilience flags per BTC collector pattern)
4. `HTTP Request | DXY - FRED Dollar Index - FRED API`
5. `HTTP Request | UK 10Y Benchmark Yield - FRED api`
6. `HTTP Request | GBP/USD - Coinbase`
7. `Supabase | Get Previous Market Snapshots`
8. `Code | Build GBP Snapshot Row`
9. `Code | Evaluate GBP Snapshot Usability` (returns no items when unusable)
10. `Create a row`

## Data requirements and availability

See the availability matrix in `docs/DEEPSEEK_LAYER1_PROGRESS.md`. Summary: price/rates data is grounded in repo-verified providers; UK 2Y, UK events/PMI, BoE bias and a UK stress proxy have no verified provider yet and are written as null with `data_quality.missing` entries rather than guessed.

## Known issues / gaps

- `market_snapshots` live table schema has no repo migration; GBP columns must be confirmed/added before activation.
- `api_key` query parameters in the FRED nodes use a placeholder; do not commit a real key.
- Column naming (`dxy_d1` vs `dxy_d1_pct`) needs reconciliation with the research replay contract.

## Last verified status

- 2026-09-05: draft JSON shape validated by `tests/layer1-onboarding/gbp_workflow_drafts.test.js`. Not deployed, not executed in n8n.
