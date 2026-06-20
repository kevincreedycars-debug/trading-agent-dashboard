# Decision Log

Each new decision should include the date, decision, reasoning, and alternatives considered.

## 2026-06-19 — GitHub as Source of Truth

Decision: GitHub is the canonical source of truth for project memory, architecture, logic documents, workflow exports, and development state.

Reason: The platform is too large to rely on chat history. Future ChatGPT/Codex sessions need durable state.

## 2026-06-19 — n8n as Execution Engine

Decision: n8n remains the execution engine for collectors, agents, orchestration, and dashboard writing.

Reason: Existing workflows are already operational and should not be replaced unless required.

## 2026-06-19 — n8n API First, MCP Second

Decision: Use the n8n API first for direct workflow inspection/editing/execution. Add MCP later if it improves AI workflow navigation.

Reason: The API is the cleaner production interface. MCP may be valuable for AI-native browsing but should not be the first dependency.

## 2026-06-19 — Preserve Layer 1 Isolation

Decision: Layer 1 agents must remain independent raw directional agents.

Reason: Layer 1 must provide uncontaminated raw calls before Layer 2 economic-event adjustment or cross-asset synthesis.

## 2026-06-20 — Dashboard Trigger Uses Webhook And Status File

Decision: The public dashboard triggers the Master Orchestrator through an n8n webhook and reads run state from `data/workflow-status.json`.

Reason: The static dashboard must never expose the n8n API key. A webhook plus GitHub-published status file keeps credentials out of browser code while still allowing the dashboard to show success and failure reports.

## 2026-06-20 - Codex Startup Uses Permanent Working Memory

Decision: Codex must read `CODEX_STARTUP.md` first, then the project memory and architecture documents, before editing files.

Reason: Project context must survive between sessions without relying on chat history. A fixed startup sequence makes the repository memory authoritative and reduces accidental work from stale context.

Alternatives considered: relying on chat history, keeping memory only in `CODEX.md`, or duplicating memory files at the repository root. These were rejected because they are easier to miss, less explicit as a session procedure, or create duplicate sources of truth.

## 2026-06-20 - Canonical Memory Documents Live Under `docs/`

Decision: Keep project memory documents under `docs/`, with only `CODEX_STARTUP.md` at the repository root as the first-read entry point.

Reason: Existing memory files already live in `docs/`, and preserving that structure avoids duplicate root-level files with the same purpose.

Alternatives considered: moving all memory files to the repository root or creating root-level duplicates. Both were rejected because they would churn existing documentation and risk conflicting sources of truth.
