# Current Task

Last updated: 2026-07-06

## Task

Factor Edge Lab - Phase 2B dashboard UI.

## Objective

Expose the checked-in `data/factor-edge-lab.json` artifact in a dedicated research-only dashboard tab so factor-level historical evidence can be reviewed before any production weighting changes are considered.

This phase must:

- read only from `data/factor-edge-lab.json`
- stay downstream-only and research-only
- avoid changes to live Layer 1 logic
- avoid changes to live Layer 2 logic
- avoid changes to replay methodology
- avoid changes to Directional Trust calculations
- avoid changes to L2L/ADR methodology
- avoid changes to Overview badge logic

## Current Status

Phase 2A is complete and committed. The Factor Edge Lab artifact builder, tests, and checked-in artifact were validated and committed in `f9e7062`.

Phase 2B is now implemented locally: the dashboard has a new top-level `Factor Edge Lab` tab that reads only from `data/factor-edge-lab.json`, renders Layer 1 and Layer 2 factor evidence, and preserves explicit ADR/L2L unavailability instead of fabricating those metrics.

## Completed

- Verified the current working tree and preserved `.claude/launch.json` as unrelated local state that must remain untracked.
- Inspected only the requested Phase 2A files before validation.
- Re-ran:
  - `node --check backtester/lib/factor_edge_lab.js`
  - `node --check backtester/scripts/build_factor_edge_lab.js`
  - `node --test backtester/tests/factor_edge_lab.test.js`
  - `node backtester/scripts/build_factor_edge_lab.js`
- Confirmed the generated artifact contains Layer 1 entities `USD`, `EUR`, `Gold`, `NQ`, and `BTC`.
- Confirmed the generated artifact contains Layer 2 entities `EUR/USD`, `XAU/USD`, `NQ/USD`, and `BTC/USD`.
- Confirmed factor-level ADR/L2L metrics are explicitly marked unavailable with blocker text and are not fabricated.
- Reviewed the generated JSON for obvious schema issues and found none.
- Committed only:
  - `backtester/lib/factor_edge_lab.js`
  - `backtester/scripts/build_factor_edge_lab.js`
  - `backtester/tests/factor_edge_lab.test.js`
  - `data/factor-edge-lab.json`
- Added a new top-level `Factor Edge Lab` dashboard tab.
- Wired the dashboard to load only `data/factor-edge-lab.json` for this view.
- Added research-only rendering for Layer 1 and Layer 2 factor evidence plus methodology guardrails.
- Extended `playwright-dashboard-smoke.js` to cover the new `Factor Edge Lab` tab and the explicit ADR/L2L unavailable contract.
- Re-ran syntax checks and the dashboard smoke successfully.

## Next Immediate Steps

1. Review the local `Factor Edge Lab` UI and decide whether to refine layout, copy, or evidence density before committing Phase 2B.
2. Keep the factor review surface research-only until the weighting review is complete.
3. If later approved, derive any production weighting changes from reviewed evidence rather than from the dashboard layer itself.

## Current Blocker

No repository-side blocker.

Factor-level ADR/L2L opportunity metrics remain intentionally unavailable because `data/adr-reach-research.json` does not expose a full per-prediction factor-joinable export. That is a guardrail, not a bug.

## Target Outcome

The near-term outcome is:

> a stable research-only Factor Edge Lab dashboard that exposes factor evidence without changing production logic

The later decision point is:

> use the reviewed evidence to decide whether any weighting changes are justified, and only then consider separate production work
