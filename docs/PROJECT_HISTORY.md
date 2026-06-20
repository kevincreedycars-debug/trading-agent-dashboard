# Project History

## Milestones

### Initial Trading Dashboard Created

The repository contains the Layered Directional Command Dashboard for displaying trading-agent output.

### Layer 1 Agent Platform Built

Layer 1 directional agents exist for USD, EUR, Gold/XAU, NQ, and BTC. Layer 1 remains isolated so raw asset calls are not contaminated by other agents, dashboard output, or future Layer 2 logic.

### n8n Workflow Architecture Established

n8n is the execution engine for market collectors, economic-event collection, Layer 1 agents, Dashboard Writer, and the Master Orchestrator.

### GitHub Project Memory Started

GitHub was chosen as the source of truth for architecture, current state, tasks, decisions, workflow exports, and development history.

### n8n Integration Work Started

Direct n8n API integration and workflow JSON exports were added so Codex can inspect and eventually edit live workflows with repository-backed auditability.

### Master Orchestrator Dashboard Control Added

The dashboard gained a Master Orchestrator control panel using a non-secret webhook configuration file and a dashboard-readable workflow status file.

### Backtest Accuracy Visual Shell Added

A visual Backtest / Accuracy dashboard section was added with placeholder data only. No database schema, calculation engine, Layer 1 logic, or Layer 2 logic was changed.

### Permanent Codex Working Memory Added

`CODEX_STARTUP.md` and the project memory documents define how future Codex sessions start, update memory, close sessions, commit documentation, and resume from repository state.
