# Session Notes

Last updated: 2026-07-20

## Work Completed

- Confirmed the current production baseline is the deployed dashboard at commit `a15100d62f9a8a4c6ad6d8390f97f7de25ca1cdd`.
- Confirmed the visible Layer 1 `24H` ET expiry blocks, UK/ET header clock, Directional Viability spacing fix, and Overview prose removal are already deployed and validated.
- Identified `CODEX_STARTUP.md` as the instruction source causing routine `.claude/launch.json` prompts and prepared the minimum startup-rule correction.
- Identified that the current active-state project memory pointers were still aimed at the earlier shadow-backtest task and needed correction before the next startup.

## Unfinished Work

- Add UK-time hover/focus tooltips to the Layer 1 `24H` expiry sections while keeping the visible ET display unchanged.
- Update smoke coverage to verify the tooltip contract, accessibility behavior, and no-overflow guardrails.
- Produce a planning-only architecture-mirror proposal after the tooltip work.

## Blockers

- No repository-side blocker.

## Assumptions

- The visible Layer 1 expiry continues to use `forecast_window_end` with `expires_at` as fallback only.
- UK conversion must use `Europe/London` via browser-native `Intl.DateTimeFormat`.
- The next planned phase after this tooltip task is the architecture mirror of the dashboard and research platform.

## Exact Next Task

Add UK-time hover/focus tooltips to the existing Layer 1 `24H` expiry sections, then plan the architecture mirror without implementing it yet.
