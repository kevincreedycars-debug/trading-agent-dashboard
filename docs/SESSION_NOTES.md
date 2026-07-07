# Session Notes

Last updated: 2026-07-07

## Work Completed

- Confirmed `.claude/launch.json` remains the only unrelated untracked local file and kept it untouched.
- Started the new research-only `Phase 2 Shadow Backtest / Evidence-Reweighted Logic` task without modifying production logic.
- Inspected the checked-in Factor Edge artifact, checker artifacts, and dashboard rendering patterns before implementation.
- Added `backtester/lib/phase2_shadow_backtest.js` for:
  - conservative factor reweighting
  - shadow no-call gating
  - original-vs-shadow summary reconciliation
- Added `backtester/scripts/build_phase2_shadow_backtest.js` to generate `data/phase-2-shadow-backtest.json`.
- Added `backtester/tests/phase2_shadow_backtest.test.js` for the first shadow rules.
- Built and checked in the first shadow artifact for `USD`, `EUR`, `Gold`, `NQ`, and `BTC` at `24H`.
- Added a new top-level `Shadow Logic Backtest` dashboard tab wired only to `data/phase-2-shadow-backtest.json`.
- Added research-only rendering for:
  - overall asset comparison
  - pass / warn / fail comparison state
  - shadow factor weight changes
  - small-sample warnings
  - changed-row preview
- Extended `playwright-dashboard-smoke.js` to verify the new tab and confirm there is no page-level horizontal overflow.
- Re-ran:
  - `node --check backtester/lib/phase2_shadow_backtest.js`
  - `node --check backtester/scripts/build_phase2_shadow_backtest.js`
  - `node --test backtester/tests/phase2_shadow_backtest.test.js`
  - `node backtester/scripts/build_phase2_shadow_backtest.js`
  - `node --check script.js`
  - `node --check playwright-dashboard-smoke.js`
  - `node playwright-dashboard-smoke.js`

## Unfinished Work

- Review whether the first conservative shadow formula is satisfactory or needs research-only threshold tuning.
- Decide whether to expand the shadow surface later to broader horizon coverage or deeper row-level evidence.

## Blockers

- No repository-side blocker.
- Current intentional limitation remains: the first shadow comparison is limited to Layer 1 `24H` because that is the checked-in like-for-like checker scope available locally.

## Assumptions

- The Phase 2 shadow model remains research-only and must not feed into production logic.
- Any later production weighting proposal must be handled in a separate task.
- `.claude/launch.json` must remain untracked and never be committed.

## Exact Next Task

Review the new `Shadow Logic Backtest` outputs and commit the first research-only shadow milestone if the conservative formula is acceptable.
