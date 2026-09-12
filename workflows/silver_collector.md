# SILVER Collector (DRAFT)

## Purpose

Collect a SILVER/XAGUSD Layer 1 snapshot into the shared `market_snapshots` table. Built to the same
standard as the live Gold collector. Not deployed or activated by this worktree.

## Trigger

`Execute Sub-workflow Trigger` (`active: false`); no schedule is included. The Master Orchestrator
calls it as `Silver Collector`.

## Why this collector republishes the full superset

`market_snapshots` is a single shared table with no asset column. Every collector writes the same
superset of fields and every Layer 1 agent reads the newest row. The SILVER collector therefore
publishes **every field the Gold collector already publishes** plus the silver-specific fields, so
it can run in any position in the collector sequence without starving USD, EUR, GOLD, NQ or BTC.

The orchestrator places it **last among the collectors**, immediately before `USD Layer 1 Agent`.
That is deliberate: the newest row then carries both `silver_price` and every shared field, so
every agent — including SILVER itself — reads a complete row.

## Inputs

| Node | Provider | Notes |
| --- | --- | --- |
| `HTTP Request | Silver - Coinbase` | `https://api.coinbase.com/v2/prices/XAG-USD/spot` | Same verified pattern as the live Gold `XAU-USD` request. |
| `HTTP Request | Gold - Coinbase` | `XAU-USD/spot` | Required for the gold/silver ratio. |
| `HTTP Request | Copper - FRED Api` | FRED `PCOPPUSDM` | Monthly global copper price. |
| `HTTP Request | US Industrial Production - FRED Api` | FRED `INDPRO` | Monthly industrial production index. |
| FRED macro nodes | `DFII10`, `DGS2`, `DGS10`, `DTWEXBGS`, `VIXCLS`, `DCOILWTICO`, `DCOILBRENTEU`, `DEXUSEU`, `IRLTLT01*` | Inherited from the Gold collector; required for the shared superset. |
| `HTTP Request | Eco Calendar Recent/Upcoming - Finnhub` | Finnhub economic calendar | Inherited; feeds `fed_bias` and `latest_us_event`. |
| `Supabase | Get Previous Market Snapshots` | `market_snapshots` (limit 25) | History for own-price and ratio deltas. |

All credentials are environment references (`$env.FRED_API_KEY`, `$env.FINNHUB_API_KEY`,
`$env.ALPHA_VANTAGE_API_KEY`). No literal key is present in this export.

## Outputs

One normalized row written to `market_snapshots` after the normalisation gate, carrying the shared
superset plus the silver fields **inside `raw_payload.silver`**:

`silver_price`, `silver_d1_pct`, `silver_d5_pct`, `silver_d20_pct`,
`gold_silver_ratio`, `gold_silver_ratio_d5_pct`, `gold_silver_ratio_d20_pct`,
`copper_price`, `copper_3m_pct`, `industrial_production_index`, `industrial_production_3m_pct`,
`industrial_demand_regime`, `silver_supply_event`.

Why `raw_payload`: live `market_snapshots` has no silver columns and the service-role key cannot
`ALTER TABLE`, while PostgREST rejects an insert that names an unknown column. Carrying the fields in
the existing jsonb column needs no schema change. History lookups read prior rows'
`raw_payload.silver` and fall back to the typed column, so applying
`supabase/migrations/20260912_silver_market_snapshot_columns.sql` and then promoting the row fields is
a clean upgrade with no consumer change.

`collector_version` is `silver_v1_economic_events_weighted_inputs`. `data_quality.missing` lists every
input that failed to resolve. `silver_supply_event` is always `null` because no verified physical
supply feed exists.

## Supabase tables touched

- Read `market_snapshots` history and `economic_events`.
- Write `market_snapshots`.

## Key nodes

1. `When Executed by Another Workflow`
2. `HTTP Request | Silver - Coinbase`
3. `HTTP Request | Copper - FRED Api`
4. `HTTP Request | US Industrial Production - FRED Api`
5. `Normalise Market Snapshot`
6. `Create a row`

## Known issues

Provider identity is now evidence-backed (Coinbase XAG/USD verified to return
`{"data":{"amount":...,"base":"XAG","currency":"USD"}}`), but live runtime credential binding,
n8n import/execution and `market_snapshots` schema confirmation remain outstanding. Industrial demand
uses monthly series, so it updates slowly by design and never overrides the fast macro factors.

## Last verified status

2026-09-12: full Gold-standard rewrite built and covered by 25 passing local contract tests. No
deployment, activation or live execution has occurred.
