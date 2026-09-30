# Architecture — AI Trading Platform

Last updated: 2026-09-29

## High-Level System

```text
Market Collectors
        ↓
Supabase market_snapshots
        ↓
Independent Layer 1 Agents
        ↓
Supabase agent_outputs
        ↓
Dashboard Writer
        ↓
GitHub Pages Dashboard
```

## Platform Components

### GitHub

GitHub is the single source of truth for:

- project state
- architecture
- decisions
- bugs
- logic documents
- workflow documentation
- workflow JSON exports
- dashboard code

### n8n

n8n is the execution engine.

It runs:

- Eco Events Collector
- USD Collector
- EUR Collector
- Gold Collector
- NQ Collector
- BTC Collector
- USD Layer 1 Agent
- EUR Layer 1 Agent
- Gold Layer 1 Agent
- NQ Layer 1 Agent
- BTC Layer 1 Agent
- Dashboard Writer
- Master Orchestrator

### Supabase

Supabase is the canonical data layer.

Key tables:

- `market_snapshots`
- `agent_outputs`
- `economic_events`

### GitHub Pages

GitHub Pages hosts the Layered Directional Command Dashboard.

The dashboard displays Layer 1 raw calls and, later, Layer 2 adjusted calls separately.

### Published data snapshots

`data/layer1.json` and `data/layer2.json` are published artefacts, not a live feed. The live pipeline (Dashboard
Writer, trade selection agent) commits a refreshed copy straight to `main` - commit messages `Update layer1
dashboard data from agent outputs` and `Update layer2 dashboard data from trade selection agent` - and GitHub
Pages serves `main`, so the dashboard is current wherever it is opened.

A checkout only holds the snapshot that was on its branch when the branch was cut. Observed on 2026-09-29: the
lane branches forked from `125d871` (2026-09-07 07:15) and nothing had merged `main` since, so their copies were
the 2026-09-07 refresh - `layer1.json` with 5 of the 8 `required_agents` and `layer2.json` with no
`trade_opportunities` - while `main` and the published site carried the 2026-09-29 08:06Z refresh with 8 agents
and one live WTI/USD SELL opportunity (confidence 75, rank 1).

Read live values with `git fetch origin` then `git show origin/main:data/layer2.json` (or the published
`data/layer2.json` on the GitHub Pages URL). Never quote the checkout copy as today's dashboard, and never treat
its empty `trade_opportunities` as "no trades".

## Layer 1 Rules

Layer 1 agents are sealed raw directional agents.

They must not read:

- other Layer 1 agents
- dashboard output
- Layer 2 output
- pair synthesis from another agent

They may read only:

- their own logic document
- latest usable market snapshot

## Master Orchestrator

The Master Orchestrator should run every platform component sequentially.

Current intended order:

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

## AI Development Environment

Target model:

```text
ChatGPT / Codex
        │
        ├── GitHub
        ├── n8n API / MCP
        ├── Supabase
        └── Netlify
```

The active dashboard host in this model is GitHub Pages, not Netlify.

ChatGPT is used for:

- architecture
- reasoning
- debugging
- documentation
- review

Codex is used for:

- implementation
- edits
- commits
- workflow JSON changes
- structured refactoring

## n8n Integration Strategy

Use the n8n API first because it is stable and production-oriented.

Use n8n MCP second if it improves AI workflow browsing and node-level editing.

Sensitive credentials must never be committed to GitHub.
