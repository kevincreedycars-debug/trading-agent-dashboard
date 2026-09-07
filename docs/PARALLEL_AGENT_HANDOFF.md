# Parallel development handoff

Updated 2026-09-07 after consolidation. This document supersedes the earlier instruction to park all additional Layer 1 development while reviewing backtesting.

## Authorized workstreams

- **Codex:** backtesting correctness, timestamped data contracts, historical replay, evaluation and research diagnostics. The current review is the Gold timestamped directional-evaluation contract.
- **DeepSeek through Cline:** build additional independent Layer 1 asset agents and collectors using the established workflow/logic/contract-test structure. Detailed assignment instructions are in [DEEPSEEK_BUILD_BRIEF.md](DEEPSEEK_BUILD_BRIEF.md).
- **Assigned assets: GBP, Silver and WTI**, each in a separate VS Code window, worktree and branch. These are Layer 1 asset agents, while Codex owns the backtesting engine.

Codex uses `D:\trading-agent-dashboard-codex`. DeepSeek uses the asset worktrees listed below. The old research checkout has been retired. At this update the main-folder checkout is on `review/gold-timestamped-contract`; inspect status rather than assuming it is still on `main`.

## EUR pair-coverage workstream

The user additionally authorized a fourth DeepSeek worker for EUR-related pair coverage. See [DEEPSEEK_EUR_PAIRS_BRIEF.md](DEEPSEEK_EUR_PAIRS_BRIEF.md). It owns `pair-coverage/eur/**`, `tests/pair-coverage/eur/**` and `docs/DEEPSEEK_EUR_PAIRS_PROGRESS.md`; existing agents, shared pair logic and backtester integration remain with their existing owners.

## Ownership

| Work | Writer | Boundary |
| --- | --- | --- |
| `backtester/**`, research `data/**`, backtesting UI/tests | Codex | DeepSeek reads contracts and proposes adapter changes in its handoff. |
| One assigned asset's logic, collector/agent drafts, workflow docs, tests and progress | Assigned DeepSeek builder | Each builder owns a different asset and exact file list. |
| `index.html`, `script.js`, `styles.css`, package/lockfiles, shared test helpers, existing production exports, orchestration and published data | Codex integration owner | Builders record integration requests instead of editing these files concurrently. |
| Current task/milestone/session documents and this coordination file | Codex coordinator | Builders maintain their asset-specific progress files. |

Existing GBP ownership remains in `docs/DEEPSEEK_LAYER1_PROGRESS.md`. New asset builders use `docs/DEEPSEEK_<ASSET>_PROGRESS.md` and `tests/layer1-onboarding/<asset>/` so they do not race on GBP's files or a shared progress document. Read any asset-specific instructions before editing.

## Separate-worktree discipline

| Builder | Folder | Branch |
| --- | --- | --- |
| GBP | `D:\trading-agent-dashboard-codex.worktrees\agent-gbp` | `agents/gbp-layer1-20260907` |
| Silver | `D:\trading-agent-dashboard-codex.worktrees\agent-silver` | `agents/silver-layer1-20260907` |
| WTI | `D:\trading-agent-dashboard-codex.worktrees\agent-wti` | `agents/wti-layer1-20260907` |
| EUR pairs | `D:\trading-agent-dashboard-codex.worktrees\agent-eur-pairs` | `agents/eur-pair-coverage-20260907` |

The user explicitly requested these three isolated VS Code instances on 2026-09-07. They are bounded asset-building worktrees, not a return to one indefinitely dirty research checkout. Open `docs/AGENT_ASSIGNMENT.md` in each worker folder; its local task files identify the assigned asset.

Workers may make scoped local implementation commits on their own branch. Do not switch or reset the main-folder checkout, merge/push production, commit outside the assigned asset, or edit another worker's directory. Each worker starts with a setup-only documentation commit; do not merge that setup commit back into the canonical project. Deliver subsequent implementation commit IDs plus the contract mapping to Codex. Codex reviews and integrates asset-only changes, then retires the completed worktree after preserving any remaining local evidence.

Git worktrees share commit history but have separate files and indexes. Changes do not automatically appear in the other windows. Each worker maintains its local asset progress document; the coordinator reads it from the listed worktree when reviewing a handoff. No worker can assume it has the other agents' chat history.

These are local draft builds. Workflow activation, live database/schema changes, credential changes and production publication are separate integration steps. Layer 1 agents consume their own raw inputs and logic; they do not consume another agent's verdict or backtesting outputs.

## Delivery and integration

Each builder delivers the asset-specific files, exact local test command/results, input availability and missing-data matrix, unresolved provider/schema questions, and a mapping from snapshot fields to factor inputs and output fields. Keep an explicit provisional/untested label on weights and scoring assumptions.

Codex reviews this contract for replay/backtester compatibility while continuing the Gold review. Draft completion does not imply validated directional edge, complete execution evidence, or permission to deploy. Macro provisioning and model optimization remain parked.

No DeepSeek process is started by writing this handoff. The operator must start the assignments in the DeepSeek/Cline sessions; workers coordinate through the files, not an assumed shared conversation.
