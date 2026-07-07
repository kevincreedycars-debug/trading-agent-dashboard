# Active Milestone

## Current Feature

Phase 2 Shadow Backtest

## Current Milestone

Phase 2A - build the first research-only shadow logic artifact and dashboard tab from checked-in Factor Edge evidence

## Status

Testing

## Completed Work

- Added `backtester/lib/phase2_shadow_backtest.js` for conservative shadow reweighting, shadow decision gating, and comparison helpers.
- Added `backtester/scripts/build_phase2_shadow_backtest.js` to build the checked-in `data/phase-2-shadow-backtest.json` artifact.
- Added `backtester/tests/phase2_shadow_backtest.test.js` covering weight adjustments, conservative no-call gating, summary reconciliation, and support-map aggregation.
- Built the checked-in shadow artifact for `USD`, `EUR`, `Gold`, `NQ`, and `BTC` at `24H`.
- Added a new top-level `Shadow Logic Backtest` dashboard tab.
- Wired the dashboard to read only `data/phase-2-shadow-backtest.json` for this view.
- Added research-only rendering for original-vs-shadow comparisons, factor weight change tables, changed-row previews, and explicit sample warnings.
- Extended the dashboard smoke script to cover the new shadow tab and verify local table-scroll containment with no page-level horizontal overflow.
- `node --check backtester/lib/phase2_shadow_backtest.js`, `node --check backtester/scripts/build_phase2_shadow_backtest.js`, `node --test backtester/tests/phase2_shadow_backtest.test.js`, `node --check script.js`, `node --check playwright-dashboard-smoke.js`, and `node playwright-dashboard-smoke.js` all pass locally.

## Remaining Work

- Review the first conservative shadow formula outputs and decide whether any thresholds need research-only tuning.
- Decide whether the first shadow tab is ready to commit as its own milestone.
- Keep any future production weighting discussion separate from this research surface.

## Current Files Being Modified

- `backtester/lib/phase2_shadow_backtest.js`
- `backtester/scripts/build_phase2_shadow_backtest.js`
- `backtester/tests/phase2_shadow_backtest.test.js`
- `data/phase-2-shadow-backtest.json`
- `index.html`
- `script.js`
- `styles.css`
- `playwright-dashboard-smoke.js`
- `docs/CURRENT_STATE.md`
- `docs/CURRENT_TASK.md`
- `docs/ACTIVE_MILESTONE.md`
- `docs/SESSION_NOTES.md`
- `docs/CHANGELOG.md`

## Blockers

No repository-side blocker.

Intentional research limitation:

- current shadow comparison is limited to Layer 1 `24H` because that is the checked-in like-for-like checker scope available locally

## Next Immediate Action

Review the Phase 2 shadow backtest outputs and commit the first research-only shadow milestone if the conservative formula is acceptable.

## Last Updated

2026-07-07 12:25:00 Europe/London
