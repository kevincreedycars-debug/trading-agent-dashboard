-- SILVER Layer 1 columns for the shared market_snapshots table.
--
-- The SILVER collector currently carries its factor fields inside the existing
-- jsonb column `raw_payload.silver`, because the session that built it had no
-- DDL access. Both the collector and the SILVER Layer 1 agent read the typed
-- column first and fall back to raw_payload.silver, so applying this migration
-- and then adding the typed fields to the collector row is the promotion path.
--
-- This migration is additive and idempotent. It does not modify or backfill any
-- existing column, and it does not rewrite existing rows.
--
-- Apply with the Supabase SQL editor (a service-role key cannot ALTER TABLE).

alter table public.market_snapshots
  add column if not exists silver_price                    numeric,
  add column if not exists silver_d1_pct                    numeric,
  add column if not exists silver_d5_pct                    numeric,
  add column if not exists silver_d20_pct                   numeric,
  add column if not exists gold_silver_ratio                numeric,
  add column if not exists gold_silver_ratio_d5_pct         numeric,
  add column if not exists gold_silver_ratio_d20_pct        numeric,
  add column if not exists copper_price                     numeric,
  add column if not exists copper_3m_pct                    numeric,
  add column if not exists industrial_production_index      numeric,
  add column if not exists industrial_production_3m_pct     numeric,
  add column if not exists industrial_demand_regime         text,
  add column if not exists silver_supply_event              jsonb;

comment on column public.market_snapshots.silver_price is
  'XAG/USD spot in USD per troy ounce (Coinbase XAG-USD). Null until the SILVER collector is promoted to typed columns.';
comment on column public.market_snapshots.gold_silver_ratio is
  'gold_price / silver_price. Taken from the same shared snapshot row.';
comment on column public.market_snapshots.silver_d1_pct is
  'Silver own-price percentage change versus the previous distinct snapshot_date.';
comment on column public.market_snapshots.industrial_demand_regime is
  'expanding | neutral | contracting. Derived from FRED copper (PCOPPUSDM) and US industrial production (INDPRO); reports neutral unless both series agree.';
comment on column public.market_snapshots.silver_supply_event is
  'Reserved. No verified physical silver supply or event feed exists, so this is always null and is scored neutral, never guessed.';
