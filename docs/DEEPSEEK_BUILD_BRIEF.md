# DeepSeek asset-agent build brief

Updated 2026-09-07. Read `AGENTS.md`, `CODEX_STARTUP.md` and `docs/PARALLEL_AGENT_HANDOFF.md` first. This assignment is the additional Layer 1 workstream; Codex continues the backtesting review independently.

## Assignment queue

- Existing reference asset: **GBP**. Its collector, Layer 1 draft, documentation, replay implementation and contract tests already exist. Audit unresolved questions before extending them; do not recreate them.
- **Three parallel assignments: GBP, Silver and WTI.** Each has its own worktree and VS Code window; see `PARALLEL_AGENT_HANDOFF.md`.
- GBP audits and completes its existing draft. Silver and WTI audit any existing asset files and build their own draft packages. Read the local `docs/AGENT_ASSIGNMENT.md` for exact ownership.

## Existing template

Read these files together:

- `logic/agent_gbp_direction.md`: 24H draft logic, factors, independence and missing-input rules.
- `exports/gbp_collector.json`, `exports/gbp_layer1_agent.json`: inactive draft workflow structure.
- `workflows/gbp_collector.md`, `workflows/gbp_layer1_agent.md`: workflow descriptions.
- `tests/layer1-onboarding/gbp_snapshot_contract.test.js`, `gbp_workflow_drafts.test.js`, `helpers/gbpSnapshotContract.js` and `fixtures/`: existing isolated contract examples.
- `docs/DEEPSEEK_LAYER1_PROGRESS.md`: completed GBP work and unresolved integration questions.
- EUR collector/agent exports and `workflows/README.md`: established production-shaped interfaces and documentation sections.
- `docs/LOCAL_WORKFLOW_EXPORTS.md`: exported credential references still require runtime-specific binding review.

Reuse structure, not asset assumptions. GBP factor weights, UK rate/event inputs, provider choices and market-session rules are not automatically suitable for Silver, WTI or another asset. Existing exports can contain implementation defects; do not copy the known Gold unordered-history pattern into a new collector.

## Builder procedure

1. Confirm the assigned asset and record the exact owned file list in its progress file before editing. Inspect Git status and preserve other workers' changes.
2. Audit any existing files for that asset before creating replacements. Identify reusable shape versus asset-specific behavior.
3. Define the input/output contract before implementing nodes: instrument/feed identity, units, observation time, actual availability time where known, snapshot selection, freshness thresholds, missing-data behavior, 24H horizon and version fields. Mark unknown timing honestly.
4. Establish provider availability from authoritative evidence. Record unsupported inputs as unavailable with explicit behavior; never invent series, releases, API fields or historical coverage. Core missing/stale inputs must prevent a falsely usable call.
5. Draft the collector and independent agent. Keep workflows inactive, avoid live IDs/credentials invented for the new asset, and preserve factor evidence and deterministic final direction/conviction rules where the template requires them. Treat weights as hypotheses pending backtesting.
6. Add isolated synthetic fixtures and tests for complete, empty, missing-core, stale and wrong-asset inputs; relevant session rules; direction/conviction shape; parser variants; graph connections; and credential hygiene. Separate timestamps in the fixtures so timing errors can be detected.
7. Validate the actual code embedded in the workflow as well as helpers wherever feasible. Do not claim a helper-only test validates n8n import, live providers or the workflow runtime.
8. Deliver a contract mapping to Codex: source field -> normalized snapshot field -> factor -> output field, including units, null policy, availability timestamp and version. Record replay/adapter requests without editing `backtester/**`.

## Paths for each new assigned asset

Use its established repository asset code; do not guess commodity instrument/provider mapping.

- `logic/agent_<asset>_direction.md`
- `exports/<asset>_collector.json`, `exports/<asset>_layer1_agent.json`
- `workflows/<asset>_collector.md`, `workflows/<asset>_layer1_agent.md`
- `tests/layer1-onboarding/<asset>/**` for private tests/helpers/fixtures
- `docs/DEEPSEEK_<ASSET>_PROGRESS.md` for one builder's status

GBP's existing paths stay in place. The coordinator owns shared helpers, package files and global progress documents. Keep common-helper refactor proposals in the handoff until integration.

## Completion criteria

A complete draft package includes the logic document, inactive workflow exports, workflow documentation, meaningful passing local contract tests, a source/availability matrix, and the backtester integration mapping. Its progress file must distinguish:

- implemented and locally tested;
- missing provider/schema evidence;
- n8n runtime validation still required;
- historical/backtesting validation still required;
- activation/integration not performed.

Use `node --test` with the exact owned test paths and record the result. No live orchestration or linked-warehouse writes are required to complete this draft assignment.

## Prompt for a DeepSeek/Cline session

> Work in your assigned `agent-gbp`, `agent-silver` or `agent-wti` worktree. Read `docs/AGENT_ASSIGNMENT.md`. Read the startup files, `docs/PARALLEL_AGENT_HANDOFF.md` and this build brief. Your assignment is the asset explicitly assigned by the user/coordinator. If none is assigned, audit the existing GBP template and document unresolved contract/provider gaps only. Own only that asset's declared files. Follow the existing collector/agent/test structure, use asset-appropriate inputs, and deliver an inactive draft package with tests and a backtester contract mapping. Codex owns backtesting and shared integration. Do not switch branches, edit another worker's files, deploy, or claim predictive validation from contract tests.
