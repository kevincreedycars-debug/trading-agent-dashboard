# Active Milestone

## Current Feature

USD 24H live-to-replay alignment and deterministic checker validation

## Current Milestone

Create one-snapshot USD 24H live-vs-replay parity harness before scope expansion

## Status

Testing

## Completed Work

- Deterministic USD Backtester Checker was added in commit `e161994`.
- Current checker scope is USD 24H for January 2024.
- Latest checker result is 22 checked / 22 pass / 0 fail / 0 missing.
- Backtest Checker workspace UI, navigation, and compact summary grid were added to the dashboard.
- Live-vs-replay audit confirmed the live USD workflow is the current production source of truth.
- Live-vs-replay audit confirmed the current checker proves replay-vs-replay reproducibility, not live-vs-replay parity.
- Eco Events duplicate insert handling was fixed on 2026-06-21.
- Latest `data/workflow-status.json` runtime evidence shows a successful Master Orchestrator run on 2026-06-28.

## Remaining Work

- Create a one-snapshot USD 24H parity fixture/harness that compares replay output against frozen live USD 24H output.
- Align replay/checker-side 24H behavior to reproduce live USD 24H exactly, without touching the live workflow export.
- Resolve the first 24H mismatch targets: live weights, F5 DXY threshold, F6 Gold input/threshold, F7 `latest_us_event.usd_signal`, F9/F10 live rule simplification, live bull/bear/net edge formula, live conviction/strength formula, and live missing-input behavior.
- Keep the checker independent while proving replay parity against live.
- Do not expand the checker to full-year 2024 until one-snapshot 24H live-vs-replay parity passes.

## Current Files Being Modified

- `docs/CURRENT_TASK.md`
- `docs/ACTIVE_MILESTONE.md`
- `docs/SESSION_NOTES.md`
- `docs/DECISIONS.md`

## Blockers

No repository-side blocker.

The current blocker is methodological: the January 2024 checker is valid for replay-vs-replay reproducibility, but it is not yet proof that replay reproduces the live USD 24H workflow.

## Next Immediate Action

Create one frozen USD 24H live output fixture and compare replay 24H output against it on the same snapshot.

## Last Updated

2026-06-29 00:00 Europe/London
