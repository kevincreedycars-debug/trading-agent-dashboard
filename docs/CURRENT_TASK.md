# Current Task

Last updated: 2026-07-20

## Task

Architecture Mirror.

## Objective

Design and build a read-only Architecture Mirror inside the dashboard that visually explains the production platform and downstream research platform end to end without changing production or research logic.

This task must:

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

Credential continuity is complete and documented. The current production baseline is already deployed and validated with:

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

## Next Immediate Steps

1. Define the `data/architecture-map.json` manifest shape.
2. Build the top-level Architecture tab shell and overview map renderer.
3. Add expandable module maps for production and research flows without altering existing dashboard logic.

## Current Blocker

No repository-side blocker.

## Target Outcome

The near-term outcome is:

> a read-only Architecture Mirror that explains the production and research platform clearly inside the dashboard

The next planned phase is:

> iterate on the Architecture Mirror after the first in-dashboard release if additional map depth is needed
