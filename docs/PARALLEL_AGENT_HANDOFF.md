# Parallel development handoff

## Consolidation addendum — 2026-09-07

The user authorized preservation and consolidation of all workstreams into the main project folder. Use `D:\trading-agent-dashboard-codex` and the current task documents after cutover. The old research checkout and blanket no-commit instruction below describe the pre-consolidation shared session. GBP draft contents/progress remain preserved; GBP implementation and macro development are parked during the backtesting review. New simultaneous editing requires a fresh ownership checkpoint.


Established 2026-09-05 from the user's instruction: DeepSeek through Cline builds the other Layer 1 agents while Codex continues improving the backtesting engine.

## Ownership

- **Cline / DeepSeek:** additional independent Layer 1 agent logic, asset-specific collector and agent workflow drafts, documentation, and isolated contract tests.
- **Codex:** the backtesting engine, historical replay, dataset construction, research evaluation, and backtesting UI.
- Each agent must read this file at session start. This is coordination through files; neither agent automatically receives the other's conversation.

## DeepSeek: first task

1. Read `README.md`, `logic/README.md`, relevant `logic/agent_*_direction.md`, `workflows/eur_layer1_agent.md`, and existing collector/agent exports. Read relevant handoff notes and inspect `git status` and diffs. Historical notes and the workflow inventory can be stale; verify claims against code. Local exports do not prove current live deployment.
2. Audit the additional-asset backlog. Local exports already exist for USD, EUR, Gold, NQ, and BTC. GBP has `logic/agent_gbp_direction.md` and `backtester/replay/gbp/`, but no root GBP collector/agent exports were found. Start by assessing and extending this existing GBP draft; do not rebuild those five existing agents.
3. Treat Silver and WTI as candidates mentioned in earlier project notes, not a confirmed ordered backlog. Identify evidence for any further asset scope and record uncertainties before implementing additional assets.
4. Record your intended file list in `docs/DEEPSEEK_LAYER1_PROGRESS.md` before editing. Build a reviewable GBP collector/Layer 1 draft compatible with the existing input/output contracts. Document actual data requirements and any unavailable provider inputs. Do not invent data, calibrated weights, workflow IDs, or credentials.
5. Add isolated tests for meaningful contract behavior: missing/stale input handling, independent asset output, and schema compatibility. Use local fixtures; report what was and was not validated. New weights remain hypotheses until backtested.
6. Finish with changed files, test commands/results, unresolved questions, and an integration checklist in your progress file. Do not claim historical validation or production readiness from contract tests.

## File boundaries

DeepSeek may create or extend asset-specific files for the additional agents:

- `logic/agent_gbp_direction.md` and logic documents for confirmed additional assets.
- New asset-specific drafts in `exports/` and documentation in `workflows/`.
- New isolated tests/fixtures under `tests/layer1-onboarding/`.
- `docs/DEEPSEEK_LAYER1_PROGRESS.md` for its status and integration requests.

Codex owns `backtester/**`, research outputs in `data/`, and backtesting-related tests and UI changes. DeepSeek may read these to understand compatibility, including the GBP replay implementation, but should record requested changes rather than edit them.

Shared integration files have one editor at a time. DeepSeek should propose required changes in its handoff instead of modifying `index.html`, `script.js`, `styles.css`, `package.json`, lockfiles, `data/layer1.json`, `data/layer2.json`, existing production exports, `exports/master_orchestrator.json`, or `exports/dashboard_writer.json`. Codex coordinates their integration. This does not block DeepSeek from completing isolated agent drafts.

## Working rules

- Preserve all pre-existing modified and untracked files. This checkout contains substantial uncommitted work.
- Do not switch branches, reset, clean, stash, or broadly stage/commit the shared checkout. Limit any explicitly requested commit to owned changes.
- Re-read owned files before editing; if another agent changed them, coordinate rather than overwrite.
- Keep Layer 1 outputs independent: use the asset's own logic and permitted raw market inputs, never another agent's verdict or Layer 2 adjustments. Follow the established publishing contract; do not overwrite other assets' results.
- Build and test locally. Deploying/activating workflows, changing credentials, or triggering production orchestration is outside this development handoff.
- Record integration needs with exact input/output examples so Codex can connect new agents to the backtesting engine without guessing.

## Codex workstream

Continue improving backtesting correctness and evidence quality. The existing development tracker names XAU/USD factor assessment and timestamped L2L contracts, with executable validation dependent on real market timing, spread, and adverse-path evidence. Treat this as a repository baseline to verify, not proof of current completion or a new replacement research mandate. Keep new agent development independent of engine changes until their contracts can be reviewed and integrated.
