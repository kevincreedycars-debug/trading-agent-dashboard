# Current State - AI Trading Platform

Last updated: 2026-07-20

## Platform Status

The Layer 1 trading-agent platform remains operational, and the latest runtime evidence in `data/workflow-status.json` shows a successful manual refresh on 2026-07-06 with every listed step marked successful, including `Layer 2 Trade Selection Agent`.

The full Layer 1 historical replay rollout is now validated across USD, EUR, Gold, NQ, and BTC. The active repository work has shifted from replay rollout itself into downstream research presentation and breakdown views built on top of the canonical checker artifacts.

The current deployed production baseline includes the UK/ET live header clock, explicit Layer 1 `24H` expiry display on Overview cards, the Layer 1 Directional Viability spacing fix, and removal of the redundant Overview weighted-verdict prose. The deployed production commit is `a15100d62f9a8a4c6ad6d8390f97f7de25ca1cdd`.

Current platform state is stable and validated. The production dashboard exposes the live Layer 1 and Layer 2 surfaces plus the read-only historical research tabs, and the current active implementation task is a small production enhancement on top of the already deployed Layer 1 Overview expiry presentation.

## Current Architecture

```text
Market Collectors
        ->
Market Snapshot (Supabase)
        ->
Independent Layer 1 Agents
        ->
agent_outputs
        ->
Dashboard Writer
        ->
GitHub Pages Dashboard
```

Layer 2 economic-event adjustment will be built later.

## Layer 1 Assets

- USD
- EUR
- Gold / XAU
- NQ
- BTC

## Layer 1 Isolation Rule

Each Layer 1 agent must remain sealed and independent.

No Layer 1 agent may:

- read another agent output
- read dashboard output
- read Layer 2 output
- synthesise pair relationships using other agents
- contaminate its own raw call with another asset's call

Each Layer 1 agent receives only:

- its own logic document
- the latest usable market snapshot

Each Layer 1 agent answers:

> Based on confirmed value-driving factors available at execution time, what is the likely direction of this asset?

## Master Orchestrator

A Master Orchestrator workflow has been created in n8n.

Purpose: one manual button press runs the whole platform sequentially.

Current intended execution order:

```text
Manual Trigger
        ->
Eco Events Collector
        ->
USD Collector
        ->
EUR Collector
        ->
Gold Collector
        ->
NQ Collector
        ->
BTC Collector
        ->
USD Layer 1 Agent
        ->
EUR Layer 1 Agent
        ->
Gold Layer 1 Agent
        ->
NQ Layer 1 Agent
        ->
BTC Layer 1 Agent
        ->
Dashboard Writer
```

Every workflow has been converted to use `Execute Sub-workflow Trigger`, allowing the master workflow to call workflows sequentially.

Runtime evidence in `data/workflow-status.json` shows a successful run on 2026-07-06, with every listed step marked successful and no reported error.

## Known Current Issues

### 1. Eco Events duplicate insert

This issue was fixed on 2026-06-21.

The live `Eco Events Collector` was updated to dedupe incoming events, update existing rows, and create only unmatched rows. The previous duplicate-key failure is no longer an active known issue.

### 2. EUR Agent JSON parsing

The EUR Layer 1 Agent can fail when the OpenAI node output is returned as an object instead of a string.

Original parser assumed:

```js
JSON.parse(text)
```

After enabling OpenAI `Output Format: JSON Object`, the parser must support both:

- string output
- object output

This remains a known issue unless confirmed fixed in the live workflow.

### 3. Master workflow final status summary

The latest runtime artifact in `data/workflow-status.json` now provides a useful success payload, including a top-level message, per-step statuses, and no reported error for the latest run.

Any further refinement should be driven by observed runtime gaps rather than by the older missing-summary assumption.

## Current Deployment State

The repository currently documents and exposes GitHub Pages as the active static host:

```text
https://kevincreedycars-debug.github.io/trading-agent-dashboard/
```

Older architecture notes that refer to Netlify are historical context and should not be treated as the current host model.

## Current Strategic Shift

The project has already established the AI-assisted development environment baseline and completed the Layer 1 historical replay rollout. The current repository priority is downstream analytical visibility and validation on top of those frozen checker artifacts.

The current repository priority is:

> keep the production dashboard baseline clean and explicit while preparing for a later architecture mirror of production and research flows

The current immediate implementation task is:

> add UK-time hover/focus tooltips to the existing Layer 1 `24H` expiry sections while preserving the visible ET expiry display

The next planned phase after this production polish task is:

> architecture mirror of the dashboard and research platform

The `L2L 1H Sequence Research` module is not another close-to-close accuracy table. It answers whether price moved at least the required `50% ADR20` distance in the direction of a Layer 1 or Layer 2 call after the relevant intraday swing, using sequence-aware `1H` candles and daily candles only for ADR20.

Current repository evidence supports real sequence-aware L2L measurement for:

- `EUR` Layer 1 using repo-local OANDA `EUR_USD` daily + `1H` candles
- `Gold` Layer 1 using repo-local OANDA `XAU_USD` daily + `1H` candles
- `NQ` Layer 1 using repo-local OANDA `NAS100_USD` daily + `1H` candles
- `BTC` Layer 1 using repo-local Binance `BTCUSDT` daily + `1H` candles
- `EUR/USD` Layer 2 using the existing Pair Trade Research tradable-signal logic plus the same `EUR_USD` candle source
- `XAU/USD` Layer 2 using the existing Pair Trade Research tradable-signal logic plus the same `XAU_USD` candle source
- `NQ/USD` Layer 2 using the existing Pair Trade Research tradable-signal logic plus the same `NAS100_USD` candle source
- `BTC/USD` Layer 2 using the existing Pair Trade Research tradable-signal logic plus the same `BTCUSDT` candle source

Current repository evidence does not yet support real sequence-aware L2L measurement for:

- `USD`

That unsupported path is now rendered as unavailable in the `L2L 1H Sequence Research` module rather than estimated from close-only data.

GitHub is the source of truth. n8n remains the execution engine. Supabase remains the data layer. GitHub Pages is the active presentation host.

## Target Development Model

```text
ChatGPT / Codex
        |
        |-- GitHub repository
        |-- n8n workflows
        |-- Supabase data layer
        `-- GitHub Pages dashboard
```

ChatGPT should handle architecture, debugging, reasoning, planning, and documentation.

Codex should handle file edits, workflow JSON edits, code changes, commits, and implementation.

Both should eventually be able to inspect GitHub and n8n without manual copy/paste from the user.

## Permanent Working Memory

Codex startup is now governed by `CODEX_STARTUP.md`.

Every Codex session must use `CODEX_STARTUP.md` as the single startup entry point, always read the core memory files first, selectively load additional documents only when relevant, then inspect repository and runtime state before editing.

The memory documents are authoritative between sessions and should be updated only when their contents actually change.

The canonical project memory set is:

- `CODEX_STARTUP.md`
- `docs/CURRENT_STATE.md`
- `docs/CURRENT_TASK.md`
- `docs/ACTIVE_MILESTONE.md`
- `docs/NEXT_STEPS.md`
- `docs/CHANGELOG.md`
- `docs/DECISIONS.md`
- `docs/SESSION_NOTES.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ARCHITECTURE.md`
- `docs/N8N_INTEGRATION.md`
- `workflows/WORKFLOW_INVENTORY.md`

## Historical Research Platform

The historical research platform is downstream-only and must not modify production behavior.

Authoritative principles live in:

- `docs/CORE_RESEARCH_PHILOSOPHY.md`

Current implemented state:

- Historical replay and deterministic checker coverage are validated for USD, EUR, Gold, NQ, and BTC.
- Current checker totals are USD `604`, EUR `602`, Gold `608`, NQ `604`, and BTC `850`, all passing with zero fail / zero missing / zero tolerance pass.
- The Backtest / Accuracy dashboard exposes the existing matrices and checker workspaces plus weekday confidence breakdowns, Pair Trade Research, and the first `L2L 1H Sequence Research` release.
- 24H remains the primary short-horizon benchmark focus.
- Historical research presentation remains downstream-only and must not modify live runtime behavior.
