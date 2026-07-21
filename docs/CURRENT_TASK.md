# Current Task

Last updated: 2026-07-21

## Task

Architecture Mirror review and closeout.

## Objective

Confirm the deployed read-only Architecture Mirror is complete, documented, and ready for follow-up review without changing production or research logic.

The completed Architecture Mirror now:

- cover Layer 1, Layer 2, historical replay/backtesters, Factor Edge Lab, Phase 2 Shadow Backtest, Phase 3 validation modules, ADR/L2L research, n8n execution, data sources, artifacts, GitHub publication, and dashboard rendering
- clearly separate production versus research-only boundaries
- show failure and status-reporting paths
- use a top-level `Architecture` tab
- use a checked-in `data/architecture-map.json` manifest as the source of truth
- render the diagrams with a custom HTML/CSS/SVG renderer
- expose one overview map plus expandable module maps
- remain read-only and documentation-only
- avoid changing production logic, research logic, workflow execution, or artifact-generation semantics

## Current Status

Architecture Mirror is deployed and validated at implementation commit `67379533005d9c163b849016dc773ab498551004`.

Current deployed scope:

- 36 nodes
- 59 edges
- 5 boundaries
- 13 views

Credential continuity remains complete and documented. The current production baseline is already deployed and validated with:

- explicit Layer 1 `24H` expiry visible on Overview cards
- UK/ET live header clock
- Layer 1 Directional Viability spacing fix
- redundant Overview weighted-verdict prose removed
- UK-time hover/focus tooltips deployed on every Layer 1 `24H` expiry section while keeping the visible ET expiry unchanged

## Completed

- Completed the CLIXML-based local credential continuity system under `%USERPROFILE%\.trading-agent-dashboard\`.
- Verified eight continuity variables present in the encrypted local store.
- Confirmed `OANDA_ACCOUNT_ID` is conditional, currently absent, and not a blocker for ordinary OANDA candle downloads.
- Validated read-only connectivity for `n8n`, Supabase, FRED, OANDA, and Alpha Vantage.
- Confirmed RapidAPI credential loading while leaving external endpoint verification marked inconclusive because the harmless validation endpoint timed out.
- Validated isolated CLIXML backup and restore behavior.
- The visible ET expiry block on each Layer 1 Overview card is deployed.
- The UK/ET live header clock is deployed and validated.
- The Layer 1 Directional Viability spacing fix is deployed and validated.
- The redundant Overview weighted-verdict summary prose is removed.
- The UK-time hover/focus tooltip is deployed on every available Layer 1 `24H` expiry section.
- The tooltip converts the same expiry timestamp to UK time with automatic GMT/BST handling.

## Remaining Explicit Unverified Areas

- whether Dashboard Writer publishes artifacts beyond `data/layer1.json`
- the exact publication responsibility split for `data/layer2.json`
- which non-BTC collectors directly consume economic events
- exact GitHub commit sequencing during an orchestrator run
- complete column-level Supabase lineage
- node-level failure fan-out inside every exported workflow

## Next Immediate Steps

1. Review the deployed Architecture Mirror with the current repository baseline.
2. Decide whether any follow-up Architecture depth is required.
3. Leave the next milestone unset until review approves a documented successor task.

## Current Blocker

No repository-side blocker.

## Target Outcome

The achieved outcome is:

> a read-only Architecture Mirror that explains the production and research platform clearly inside the dashboard

The next planned phase is:

> awaiting review; no new implementation phase is active yet
