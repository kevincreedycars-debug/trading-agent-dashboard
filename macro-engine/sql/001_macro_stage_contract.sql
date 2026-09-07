-- Contract only. Do not apply to the live Inputs Database project.
-- Apply only after a separate staged Supabase project and least-privilege role exist.

create schema if not exists macro_stage;

create table if not exists macro_stage.event_records (
  event_id text primary key,
  event_type text not null,
  scheduled boolean not null,
  source text not null,
  source_reliability text not null,
  published_at timestamptz not null,
  received_at timestamptz not null,
  processed_at timestamptz not null,
  jurisdictions jsonb not null default '[]'::jsonb,
  affected_assets jsonb not null default '[]'::jsonb,
  consensus jsonb,
  actual jsonb,
  policy_delta jsonb,
  surprise_score numeric,
  raw_reference text not null,
  dedupe_key text not null,
  revision_of_event_id text references macro_stage.event_records(event_id),
  data_status text not null,
  created_at timestamptz not null default now(),
  check (received_at >= published_at),
  check (processed_at >= received_at)
);

create unique index if not exists event_records_source_reference_unique
  on macro_stage.event_records (source, raw_reference);
create index if not exists event_records_dedupe_published
  on macro_stage.event_records (dedupe_key, published_at desc);

create table if not exists macro_stage.market_observations (
  observation_id uuid primary key default gen_random_uuid(),
  instrument text not null,
  interval text not null,
  observed_at timestamptz not null,
  received_at timestamptz not null,
  source text not null,
  source_reference text not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric not null,
  volume numeric,
  freshness_status text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (received_at >= observed_at)
);

create unique index if not exists market_observations_source_unique
  on macro_stage.market_observations (instrument, interval, observed_at, source, source_reference);

create table if not exists macro_stage.shock_candidates (
  shock_id uuid primary key default gen_random_uuid(),
  detected_at timestamptz not null,
  instrument text not null,
  observation_id uuid references macro_stage.market_observations(observation_id),
  cause_status text not null,
  linked_event_id text references macro_stage.event_records(event_id),
  score numeric not null,
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists macro_stage.call_versions (
  call_id text primary key,
  baseline_call_id text not null,
  supersedes_call_id text references macro_stage.call_versions(call_id),
  call_kind text not null,
  asset text not null,
  direction text not null,
  action_status text not null,
  call_status text not null,
  evidence_strength numeric not null,
  persistence_class text not null,
  generated_at timestamptz not null,
  sealed_at timestamptz not null,
  next_review_at timestamptz not null,
  expected_valid_until timestamptz,
  hard_expires_at timestamptz not null,
  invalidated_at timestamptz,
  mechanism text,
  invalidation_rules jsonb not null default '[]'::jsonb,
  data_freshness text not null,
  source_run_id text not null,
  created_at timestamptz not null default now(),
  check (next_review_at <= hard_expires_at),
  check (expected_valid_until is null or expected_valid_until <= hard_expires_at),
  check ((call_kind = 'BASELINE' and baseline_call_id = call_id) or call_kind = 'EVENT_OVERLAY')
);

create index if not exists call_versions_asset_time
  on macro_stage.call_versions (asset, sealed_at desc);
create index if not exists call_versions_baseline_time
  on macro_stage.call_versions (baseline_call_id, sealed_at desc);

create table if not exists macro_stage.call_event_links (
  call_id text not null references macro_stage.call_versions(call_id),
  event_id text not null references macro_stage.event_records(event_id),
  primary key (call_id, event_id)
);

create table if not exists macro_stage.call_state_transitions (
  transition_id uuid primary key default gen_random_uuid(),
  call_id text not null references macro_stage.call_versions(call_id),
  from_status text not null,
  to_status text not null,
  transitioned_at timestamptz not null,
  reason text not null,
  source_run_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists macro_stage.layer2_candidate_versions (
  candidate_id text primary key,
  left_call_id text not null references macro_stage.call_versions(call_id),
  right_call_id text not null references macro_stage.call_versions(call_id),
  pair_code text not null,
  action_status text not null,
  compatibility_status text not null,
  generated_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists macro_stage.notification_records (
  notification_id uuid primary key default gen_random_uuid(),
  call_id text references macro_stage.call_versions(call_id),
  severity text not null,
  dedupe_key text not null,
  channel text not null,
  created_at timestamptz not null,
  sent_at timestamptz,
  delivery_status text not null,
  resolution_status text not null default 'OPEN',
  payload jsonb not null default '{}'::jsonb
);

create index if not exists notification_records_dedupe_created
  on macro_stage.notification_records (dedupe_key, created_at desc);
