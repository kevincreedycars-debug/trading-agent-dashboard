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

## 2026-06-20 - Continuous Project Memory Maintenance

Decision: Meaningful completed work must update the relevant project memory documents immediately and be committed as a logical milestone before continuing.

Reason: Long Codex sessions can end unexpectedly. Updating memory and committing at each milestone keeps GitHub recoverable as the project source of truth without relying on chat history.

Alternatives considered: updating documentation only at session end or making very large combined commits. These were rejected because they increase the amount of project state that can be lost or become hard to review.

## 2026-06-20 - Active Milestone Checkpoint

Decision: Add `docs/ACTIVE_MILESTONE.md` as the live checkpoint for the current feature, read it during startup immediately after `docs/CURRENT_TASK.md`, and keep it current whenever work pauses or the active task changes.

Reason: `docs/CHANGELOG.md` records completed history, but new Codex sessions need one concise file that states what is being worked on right now and the exact next action.

Alternatives considered: using only `docs/SESSION_NOTES.md` or adding milestone history to `docs/CHANGELOG.md`. These were rejected because session notes can be broader handoff text, and changelog should remain completed-work history rather than a live checkpoint.

## 2026-06-20 - Smart Startup Uses Staged Context Loading

Decision: `CODEX_STARTUP.md` remains the single startup entry point, but startup should always load only the core memory files first and load additional documentation only when it is relevant to the current task.

Reason: Reading every memory document on every session adds unnecessary context load and makes startup less efficient. A staged startup keeps the repository as the source of truth while still allowing Codex to recover task-relevant state safely.

Alternatives considered: always reading the full memory set on every session or relying on ad hoc file selection with no fixed core set. These were rejected because they either waste context or make startup recovery inconsistent.

## 2026-06-22 - Research Measures Production Before Optimization

Decision: The historical research platform exists first to measure the current production Layer 1 agents exactly as they are. `/logic` remains the production source of truth, research remains downstream-only, and no live Layer 1 changes should be made without historical justification and explicit human approval.

Reason: Optimization before measurement creates an untrustworthy feedback loop. The platform needs a defensible baseline before any Layer 1 Version 2 work can be evaluated or approved.

Alternatives considered: optimizing live Layer 1 logic early, replaying a research-only variant instead of production logic, or allowing research outputs to influence production automatically. These were rejected because they contaminate the benchmark and weaken production/research separation.

## 2026-06-29 - Live USD Workflow Is The Production Source Of Truth

Decision: The live USD workflow remains the production source of truth. Replay and checker code must be adjusted to reproduce live USD 24H behavior, and the live workflow should not be changed during the first alignment pass.

Reason: The current production benchmark is the live USD workflow behavior already used by the platform. Aligning replay to live preserves production truth while allowing historical research and determinism checks to measure the same logic safely downstream.

Alternatives considered: making `usd_replay_core.js` the canonical source immediately and changing live USD to match it, or treating replay-vs-replay checker success as sufficient proof of parity. These were rejected because they would either alter production behavior prematurely or overstate what the current checker has actually validated.

## 2026-06-29 - Checker Validates Determinism After Replay Alignment

Decision: The current January 2024 USD checker result should be treated as proof of replay-vs-replay reproducibility only. Live-vs-replay parity must be proven separately with a one-snapshot USD 24H fixture before expanding checker coverage to the full 2024 dataset.

Reason: The checker currently re-runs replay logic against stored replay outputs. That is useful for determinism, but it does not prove replay already matches the live USD production workflow. A one-snapshot live-vs-replay fixture is the smallest reliable gate before widening scope.

Alternatives considered: expanding directly to full-year 2024 before live-vs-replay parity or changing live workflow and replay together in one step. These were rejected because they would blur the source of truth and make validation harder to trust.
