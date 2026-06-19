# n8n Workflow Inventory

Last updated: 2026-06-19

## Workspace

```text
https://silver17.app.n8n.cloud
```

## Project UI

```text
https://silver17.app.n8n.cloud/projects/ISQG9XU7TGTT6Fcu/workflows
```

## Expected Workflows

### Orchestration

- Master Orchestrator

### Event Collection

- Eco Events Collector

### Market Data Collectors

- USD Collector
- EUR Collector
- Gold Collector
- NQ Collector
- BTC Collector

### Layer 1 Agents

- USD Layer 1 Agent
- EUR Layer 1 Agent
- Gold Layer 1 Agent
- NQ Layer 1 Agent
- BTC Layer 1 Agent

### Publishing

- Dashboard Writer

## Required Trigger Standard

All workflows called by the Master Orchestrator should expose:

```text
Execute Sub-workflow Trigger
```

Manual-only workflows should be avoided for platform-critical execution.

## Master Orchestrator Expected Order

```text
Eco Events Collector
USD Collector
EUR Collector
Gold Collector
NQ Collector
BTC Collector
USD Layer 1 Agent
EUR Layer 1 Agent
Gold Layer 1 Agent
NQ Layer 1 Agent
BTC Layer 1 Agent
Dashboard Writer
```

## Export Status

Workflow JSON exports have not yet been pulled into GitHub.

Next action after API connection:

1. List workflows through n8n API.
2. Match workflow names to this inventory.
3. Export each workflow into `exports/`.
4. Create/update each matching `workflows/*.md` document.
