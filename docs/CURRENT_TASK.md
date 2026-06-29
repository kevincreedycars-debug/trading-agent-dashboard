# Current Task

Last updated: 2026-06-29

## Task

Complete the EUR historical replay, checker, and dashboard release path using the parity-validated live EUR 24H logic as the reference.

## Objective

Measure how the current live EUR Layer 1 agent would have performed historically by reproducing its 24H behavior exactly, evaluating outcomes directly against EUR/USD, and exposing the resulting checker and matrix outputs in the dashboard.

## Current Status

Completed and validated for release.

## Completed

- GitHub repository confirmed: `kevincreedycars-debug/trading-agent-dashboard`
- GitHub connector has admin/push access
- Project memory documentation scaffold created
- `docs/CURRENT_STATE.md` created
- `docs/CURRENT_TASK.md` created
- `docs/ACTIVE_MILESTONE.md` created
- `docs/NEXT_STEPS.md` created
- `docs/ARCHITECTURE.md` created
- `docs/CHANGELOG.md` created
- `docs/SESSION_LOG.md` created
- `docs/DECISIONS.md` created
- `issues/active_bugs.md` created
- `issues/fixed_bugs.md` created
- `logic/README.md` created
- `workflows/README.md` created
- `exports/README.md` created
- `docs/N8N_INTEGRATION.md` created
- `workflows/WORKFLOW_INVENTORY.md` created
- `CODEX_STARTUP.md` created to define mandatory startup and end-of-session memory behaviour
- `CODEX.md` updated to read `CODEX_STARTUP.md` first
- `docs/SESSION_NOTES.md` created for latest-session handoff notes
- `docs/PROJECT_HISTORY.md` created for concise high-level milestones
- Initial workflow documents added for Master Orchestrator, EUR Layer 1 Agent, and Eco Events Collector
- Live n8n workflow JSON snapshots exported into `exports/`
- Dashboard Master Orchestrator control panel added
- Dashboard workflow status and error report rendering added
- `data/workflow-control.json` added for non-secret webhook configuration
- `data/workflow-status.json` added for run status published by n8n
- Live Master Orchestrator configured with a production Webhook Trigger
- Referenced child workflows published so the Master Orchestrator webhook can run
- Master Orchestrator configured to publish run status to `data/workflow-status.json`
- Dashboard overview updated to display confidence as the headline call-quality metric instead of reusing raw conviction as-is
- Overview definitions legend added under the Layer 1 calls
- Shared dashboard card top strips changed from the orange/green/blue gradient to a single navy strip
- Shared Layer 1 dashboard normalization now derives explicit `confidence` values and generates a 7-day direction outlook from the latest timeframe calls
- `data/layer1.json` now carries `confidence` and `seven_day_outlook` in the current repository snapshot
- Deployment verification confirmed the active public host is GitHub Pages, not Netlify, and that earlier local changes had not yet been pushed
- Eco Events duplicate insert handling fixed in the live workflow on 2026-06-21
- Master Orchestrator latest published status is successful as of 2026-06-28
- Deterministic USD Backtester Checker added
- Current checker scope verified for USD 24H January 2024
- Latest checker result recorded as 22 checked / 22 pass / 0 fail / 0 missing
- Backtest Checker workspace UI added under the Backtest / Accuracy dashboard area
- Live-vs-replay audit completed for USD and confirmed that live USD remains the production source of truth
- Audit confirmed the current checker result proves replay-vs-replay reproducibility, not live-vs-replay parity
- EUR 24H live-vs-replay one-snapshot parity fixture added and now passes against the frozen live export target
- EUR historical replay generated for `2024-01-02` through `2026-04-30` where warehouse data allows
- EUR/USD historical outcome evaluation is now working end-to-end without using DXY benchmark logic
- EUR/USD provisional 24H flat band set to `0.15` in the EUR-specific evaluation/checker path
- EUR deterministic checker artifact generated with result `602 / 0 / 0 / 0`
- Dashboard support added for the EUR 24H matrix and EUR checker alongside the existing USD views

## n8n Workspace

Base URL:

```text
https://silver17.app.n8n.cloud
```

Project UI:

```text
https://silver17.app.n8n.cloud/projects/ISQG9XU7TGTT6Fcu/workflows
```

## Next Immediate Steps

1. Monitor the live dashboard push and confirm the public Backtest / Accuracy panel renders both USD and EUR research views correctly.
2. Decide whether the next EUR research milestone is richer macro reconstruction through historical EUR event/PMI backfill or broader replay-window expansion.
3. Keep EUR replay semantics frozen until a deliberate optimization phase begins.

## Current Blocker

No current repository-side blocker.

Known research limitation: EUR macro reconstruction is still lighter than the full live environment because historical EUR event and PMI inputs are incomplete, but this no longer blocks direct EUR/USD outcome evaluation or checker generation.

The n8n API key was supplied in chat and must not be committed to GitHub.

Recommended after setup is proven:

1. Revoke the exposed key.
2. Generate a fresh key.
3. Store it only in the secure execution environment used by Codex/automation.

## Target Outcome

A future session should be able to begin with:

> Continue.

and then read:

- `CODEX_STARTUP.md`
- `docs/CURRENT_TASK.md`
- `docs/CURRENT_STATE.md`
- `docs/ACTIVE_MILESTONE.md`
- `docs/NEXT_STEPS.md`
- `docs/CHANGELOG.md`
- `docs/DECISIONS.md`
- `docs/SESSION_NOTES.md`
- `docs/PROJECT_HISTORY.md`
- `docs/N8N_INTEGRATION.md`
- `workflows/WORKFLOW_INVENTORY.md`
- `issues/active_bugs.md`

before making any changes.

The immediate working outcome for the current task is:

> ship parity-validated EUR historical replay, EUR/USD outcome evaluation, EUR checker coverage, and dashboard support without changing live EUR semantics
