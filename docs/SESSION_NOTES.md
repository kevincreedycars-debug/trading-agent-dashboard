# Session Notes

Last updated: 2026-06-29

## Work Completed

- Reconciled project memory with current repository and runtime evidence.
- Confirmed the active work is now USD historical replay and deterministic backtester checker validation.
- Confirmed the latest completed milestone is the deterministic USD Backtester Checker in commit `e161994`.
- Confirmed the current checker scope is USD 24H for January 2024.
- Confirmed the current checker result is 22 checked / 22 pass / 0 fail / 0 missing.
- Added Backtest Checker dashboard workspace, navigation visibility, triage table, and compact summary grid UI.
- Audited live USD workflow logic against `backtester/replay/usd/usd_replay_core.js`.
- Confirmed the live USD workflow is the production source of truth.
- Confirmed replay/checker must be adjusted to reproduce live USD 24H behavior, not the other way around.
- Confirmed the current checker is valid for replay-vs-replay reproducibility, but not yet proof of live-vs-replay parity.
- Confirmed the Eco Events duplicate insert issue was fixed on 2026-06-21.
- Confirmed the latest Master Orchestrator status artifact reports success on 2026-06-28.

## Unfinished Work

- Create one frozen USD 24H live output fixture and parity harness.
- Align replay/checker-side 24H behavior to match live USD 24H exactly.
- Resolve the first mismatch targets:
  - live 24H weights
  - F5 DXY threshold
  - F6 Gold input/threshold
  - F7 `latest_us_event.usd_signal`
  - F9/F10 live rule simplification
  - live bull/bear/net edge formula
  - live conviction/strength formula
  - live missing-input behavior
- Keep full-year 2024 checker expansion blocked until one-snapshot 24H live-vs-replay parity passes.

## Blockers

- No repository-side blocker.
- No immediate runtime blocker is preventing parity harness work.
- Methodological blocker: replay-vs-replay checker success should not be treated as live-vs-replay parity.
- Any n8n API key previously exposed in chat should still be treated as compromised and replaced if it has not already been rotated.

## Assumptions

- Canonical memory documents live in `docs/`, with `CODEX_STARTUP.md` kept at the repository root.
- `docs/ACTIVE_MILESTONE.md` is the current checkpoint only; completed milestone history belongs in `docs/CHANGELOG.md`.
- GitHub remains the source of truth, n8n remains execution, Supabase remains data, and GitHub Pages remains the active dashboard host.
- Historical research work remains downstream-only and must not change production runtime behavior.
- `exports/usd_layer1_agent.json` remains unchanged during the replay-alignment step.
- Only replay/checker/test files should change during the first 24H alignment pass.

## Exact Next Task

Create a one-snapshot USD 24H parity fixture/harness that compares replay output against frozen live USD 24H output before changing replay logic or expanding checker scope.
