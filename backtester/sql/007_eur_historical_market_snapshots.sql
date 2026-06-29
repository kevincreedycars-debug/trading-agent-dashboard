create table if not exists historical_eur_market_snapshots (
  id uuid primary key default gen_random_uuid(),

  asset_code text not null default 'EUR',
  observation_time timestamptz not null,
  snapshot_date date not null,
  snapshot_timezone text not null default 'UTC',
  snapshot_mode text not null default 'historical_reconstruction',

  raw_us_2y_yield numeric,
  raw_us_10y_yield numeric,
  raw_us_10y_real_yield numeric,
  raw_de_2y_yield numeric,
  raw_de_10y_yield numeric,
  raw_it_10y_yield numeric,
  raw_vix_level numeric,
  raw_dxy_level numeric,
  raw_gold_price numeric,
  raw_nq_price numeric,
  raw_eurusd_price numeric,

  vix_level numeric,
  vix_d1 numeric,
  vix_d5 numeric,

  dxy_level numeric,
  dxy_d1 numeric,
  dxy_d5 numeric,
  dxy_d20 numeric,

  us_2y_yield numeric,
  us_2y_d5_bps numeric,
  us_2y_d20_bps numeric,

  us_10y_yield numeric,
  us_10y_d5_bps numeric,
  us_10y_d20_bps numeric,

  us_10y_real_yield numeric,
  us_10y_real_yield_d5_bps numeric,
  us_10y_real_yield_d20_bps numeric,

  de_2y_yield numeric,
  de_2y_d5_bps numeric,
  de_2y_d20_bps numeric,

  de_10y_yield numeric,
  de_10y_d5_bps numeric,
  de_10y_d20_bps numeric,

  it_10y_yield numeric,
  it_10y_d5_bps numeric,
  it_10y_d20_bps numeric,

  us_de_2y_spread numeric,
  us_de_2y_spread_d5_bps numeric,
  us_de_2y_spread_d20_bps numeric,

  us_de_10y_spread numeric,
  us_de_10y_spread_d5_bps numeric,
  us_de_10y_spread_d20_bps numeric,

  it_de_10y_spread numeric,
  it_de_10y_spread_d5_bps numeric,
  it_de_10y_spread_d20_bps numeric,

  eurusd_price numeric,
  eurusd_d1_pct numeric,
  eurusd_d5_pct numeric,
  eurusd_d20_pct numeric,

  gold_price numeric,
  gold_d1_pct numeric,
  gold_d5_pct numeric,
  gold_d20_pct numeric,

  nq_price numeric,
  nq_d1_pct numeric,
  nq_d5_pct numeric,
  nq_d20_pct numeric,

  latest_ez_event jsonb,
  latest_ez_event_event text,
  latest_ez_event_time timestamptz,
  latest_ez_event_actual numeric,
  latest_ez_event_forecast numeric,
  latest_ez_event_previous numeric,
  latest_ez_event_surprise text,
  latest_ez_event_eur_signal text,
  latest_ez_event_impact text,
  latest_ez_event_source text,
  latest_ez_event_age_hours numeric,

  ecb_bias text,
  ecb_bias_score integer,
  ecb_bias_reasons jsonb not null default '[]'::jsonb,

  ez_composite_pmi numeric,
  ez_composite_pmi_direction text,
  latest_ez_pmi_event jsonb,

  equities_regime text,
  global_growth_regime text,
  china_growth_signal text,
  ez_stress_flag text,

  collector_version text not null,
  snapshot_schema_version text not null,
  reconstruction_logic_version text not null,
  logic_document text not null default 'agent_eur_direction.md',
  logic_document_version text not null,
  source_bundle_version text,
  source_vendor_manifest jsonb not null default '{}'::jsonb,
  reconstructed_at timestamptz not null default now(),
  reconstruction_notes text,

  source_status text not null,
  event_coverage_status text,
  market_data_coverage_status text,
  pmi_coverage_status text,
  missing_inputs jsonb not null default '[]'::jsonb,
  missing_raw_series jsonb not null default '[]'::jsonb,
  history_rows_used jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  quality_notes jsonb not null default '[]'::jsonb,
  is_reconstructable_following_24hrs boolean not null default false,

  raw_event_payload jsonb not null default '{}'::jsonb,
  raw_market_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint historical_eur_market_snapshots_asset_code_check
    check (asset_code = 'EUR'),

  constraint historical_eur_market_snapshots_snapshot_mode_check
    check (snapshot_mode in ('historical_reconstruction', 'forward')),

  constraint historical_eur_market_snapshots_ecb_bias_check
    check (ecb_bias is null or ecb_bias in ('hawkish', 'dovish', 'neutral', 'unknown')),

  constraint historical_eur_market_snapshots_equities_regime_check
    check (equities_regime is null or equities_regime in ('risk_on', 'risk_off', 'neutral')),

  constraint historical_eur_market_snapshots_source_status_check
    check (source_status in ('collected', 'partial', 'missing', 'reconstructed')),

  constraint historical_eur_market_snapshots_latest_ez_event_age_hours_check
    check (latest_ez_event_age_hours is null or latest_ez_event_age_hours >= 0),

  constraint historical_eur_market_snapshots_observation_unique
    unique (asset_code, observation_time)
);

create index if not exists idx_historical_eur_market_snapshots_observation_time
  on historical_eur_market_snapshots (observation_time desc);

create index if not exists idx_historical_eur_market_snapshots_snapshot_date
  on historical_eur_market_snapshots (snapshot_date desc);

create index if not exists idx_historical_eur_market_snapshots_reconstructable
  on historical_eur_market_snapshots (is_reconstructable_following_24hrs, snapshot_date desc);

create index if not exists idx_historical_eur_market_snapshots_logic_version
  on historical_eur_market_snapshots (logic_document_version, reconstruction_logic_version);
