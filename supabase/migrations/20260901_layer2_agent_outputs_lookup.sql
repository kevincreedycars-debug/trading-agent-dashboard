-- Layer 2 reads the newest Layer 1 output for each agent on every refresh.
-- Keep that lookup index-backed as agent_outputs grows.
create index if not exists idx_agent_outputs_layer_agent_created_at_desc
  on public.agent_outputs (layer, agent_name, created_at desc);
