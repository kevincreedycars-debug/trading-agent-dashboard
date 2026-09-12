# SILVER Layer 1 Agent (DRAFT)

## Purpose

Produce an independent, sealed 24H (plus 3d, current week, next week and current month)
classification for SILVER/XAGUSD. Built to the same standard as the live Gold Layer 1 agent, with a
silver-specific weighted engine. Inactive and not deployed by this worktree.

## Trigger

`Execute Sub-workflow Trigger` with `active: false` and no schedule. The Master Orchestrator calls it
as `Silver Layer 1 Agent`.

## Inputs

Only the newest `market_snapshots` row and the logic document `logic/agent_silver_direction.md`. The
agent does not read `agent_outputs`, Layer 2 results, dashboard state, other asset verdicts or
backtesting output.

The silver fields are read as `raw_payload.silver[key] ?? row[key]`, because live `market_snapshots`
has no silver columns. Typed columns win when they exist, so the agent upgrades by itself once
`supabase/migrations/20260912_silver_market_snapshot_columns.sql` is applied.

The logic document is inlined in the `Get SILVER Logic Document` code node rather than fetched from
GitHub: the production repo does not yet carry `logic/agent_silver_direction.md`, and the node keeps
the documented file name so it can be switched back to the GitHub-node pattern after integration.

## Outputs

A row written to `agent_outputs` with:

- `agent_name: SILVER`, `layer: 1`, `logic_document: agent_silver_direction.md`,
  `logic_document_version: 1.0_weighted_engine`
- `direction_24h`/`conviction_24h`/`reason_24h` plus the `3_day`, `current_week`, `next_week` and
  `current_month` equivalents
- the Layer 2 compatibility aliases `call_24h_direction`, `call_24h_conviction`, `call_24h_reason`
  (and the same for the other horizons)
- `factor_breakdown` (F1–F10 with weight, signal, evidence, reason), `weighted_score`,
  `conviction_model`, `timeframe_models`, `score_bullish`/`score_bearish`/`score_neutral`
- `full_output` and `raw_agent_output` (required by the live Layer 2 extractor)
- `reasoning_summary`

The `Calculate SILVER Conviction` gate recomputes direction and conviction deterministically from the
factor signals. Model output is used only as a factor-extraction aid and its confidence is never
trusted as a score.

## Supabase tables touched

- Read `market_snapshots`.
- Write `agent_outputs`.

## Key nodes

1. `When Executed by Another Workflow`
2. `Supabase Get Many`
3. `Build SILVER Input Pack`
4. `Get SILVER Logic Document`
5. `Combine md & market snapshot`
6. `Message a model`
7. `Parse SILVER Agent Output`
8. `Calculate SILVER Conviction`
9. `Create a row`

## Known issues

Weights are provisional hypotheses pending replay/backtesting. The industrial-demand inputs are
monthly series. `silver_supply_event` is always neutral because no verified supply feed exists.
Live n8n import, credential binding, replay parity and activation remain outstanding.

## Last verified status

2026-09-12: full Gold-standard rewrite built. Local tests execute the real gate code and prove the
result is consumable by the live Layer 2 builder. No deployment, activation or live execution has
occurred, and no predictive edge is claimed.
