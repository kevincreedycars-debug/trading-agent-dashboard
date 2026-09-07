# GBP Layer 1 Agent (DRAFT)

## Purpose

Generate the independent raw GBP Layer 1 directional classification using only:

- the GBP logic document (`logic/agent_gbp_direction.md`)
- the latest usable GBP market snapshot (`market_snapshots`)

This is a reviewable DRAFT (see `exports/gbp_layer1_agent.json`); it is not deployed or activated.

## Layer 1 Rule

This workflow must not read other agent outputs, dashboard output, or Layer 2. It may read shared `market_snapshots` context rows only.

## Trigger

- `Execute Sub-workflow Trigger` ("When Executed by Another Workflow").
- Draft status: no schedule, `active: false`.

## Inputs

- `market_snapshots` rows (latest usable GBP snapshot selection)
- `logic/agent_gbp_direction.md` from GitHub (same owner/repo the EUR agent reads)

## Outputs

A single `agent_outputs` row when a usable snapshot exists (`agent_name = "GBP"`, `layer = 1`):

- `snapshot_id`, `run_time_et`, `snapshot_date`, `market_inputs`, `snapshot_selection`
- 24H call: `call_24h_direction`, `call_24h_conviction`, `call_24h_reason`, `direction_24h`, `conviction_24h`
- `factor_breakdown`, `weighted_score`, `conviction_model`, `reasoning_summary`, `risk_flags`/`warnings`
- `missing_inputs`, `full_output`, `raw_agent_output`
- `logic_document`, `logic_document_version`

The deterministic 24H gate overrides the LLM 24H fields using the logic-document weights. Multi-timeframe fields are intentionally absent until a multi-timeframe review is approved.

## Supabase tables touched

- `market_snapshots` (read only)
- `agent_outputs` (insert only)

## Key nodes

1. `When Executed by Another Workflow`
2. `Supabase Get Many` (market_snapshots)
3. `Code | Build GBP Input Pack` (usable/fresh snapshot selection + available_inputs)
4. `Get GBP Logic Document` (GitHub, `logic/agent_gbp_direction.md`)
5. `Code | Combine GBP logic & market snapshot`
6. `Message a model` (OpenAI, JSON object output mode, GBP isolation system prompt)
7. `Code | Parse GBP Agent Output` (object|string tolerant parser)
8. `Code | Deterministic GBP 24H Verdict Gate` (logic-document weights/thresholds)
9. `Create a row` (agent_outputs)

## Data requirements and availability

- The input pack requires at least GBP/USD spot price plus fresh `run_time_et`/`snapshot_date`. Unavailable fundamentals stay null and are scored NEUTRAL by the model; the deterministic gate reports them as missing inputs.
- Availability matrix and open provider questions: `docs/DEEPSEEK_LAYER1_PROGRESS.md`.

## Known issues / gaps

- Draft only; the LLM output parser supports both string and object OpenAI output (object|string safe pattern required by the repo).
- Weights are research hypotheses (see logic document status). Contract tests do not claim historical validation or production readiness.
- Deterministic 24H gate must be kept in sync with `backtester/replay/gbp/gbp_replay_core.js` (Codex-owned) when either side changes.

## Last verified status

- 2026-09-05: draft JSON shape validated by `tests/layer1-onboarding/gbp_workflow_drafts.test.js`. Not deployed, not executed in n8n.
