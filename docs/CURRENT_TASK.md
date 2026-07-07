# Current Task

Last updated: 2026-07-07

## Task

Phase 2 Shadow Backtest / Evidence-Reweighted Logic.

## Objective

Build a separate research-only dashboard surface that compares current production logic against a shadow reweighted logic model derived from the checked-in Factor Edge Lab evidence.

This phase must:

- read only from separate checked-in research artifacts
- stay downstream-only and research-only
- avoid changes to live Layer 1 logic
- avoid changes to live Layer 2 logic
- avoid changes to replay source-of-truth files
- avoid changes to checker behavior and outputs
- avoid changes to existing Backtest / Accuracy behavior
- avoid changes to existing Factor Edge Lab evidence calculations

## Current Status

The new shadow research path is now implemented locally:

- `backtester/lib/phase2_shadow_backtest.js` contains the conservative shadow reweighting and shadow decision gate helpers
- `backtester/scripts/build_phase2_shadow_backtest.js` builds the checked-in `data/phase-2-shadow-backtest.json` artifact
- `backtester/tests/phase2_shadow_backtest.test.js` covers the initial reweighting rules and summary logic
- the dashboard has a new top-level `Shadow Logic Backtest` tab that reads only from `data/phase-2-shadow-backtest.json`

## Completed

- Preserved `.claude/launch.json` as unrelated untracked local state.
- Reused the checked-in checker artifacts and checked-in Factor Edge Lab artifact instead of touching replay or live logic.
- Added a conservative shadow weight formula based on:
  - factor agreement ex-flat performance versus asset baseline
  - contradiction performance
  - combined factor reliability
  - flat behavior
  - same-asset combination support
  - pair-side support as a small auxiliary signal only
- Kept the shadow decision engine conservative by allowing shadow no-calls when directional weight or dominance is weak.
- Built the checked-in `data/phase-2-shadow-backtest.json` artifact for USD, EUR, Gold, NQ, and BTC at 24H.
- Added a readable research-only dashboard tab with:
  - Original Logic vs Shadow Logic comparison
  - pass / warn / fail comparison state
  - factor weight change tables
  - sample warnings
  - contained table scrolling
- Extended `playwright-dashboard-smoke.js` to verify the new shadow tab and confirm no page-level horizontal overflow.

## Next Immediate Steps

1. Review the new shadow backtest outputs and decide whether the first conservative formula needs threshold tuning.
2. Keep all findings explicitly research-only until any later production proposal is separately approved.
3. If the shadow model remains useful, expand later to deeper evidence views or broader horizon coverage without touching production logic.

## Current Blocker

No repository-side blocker.

Current intentional limitation:

- the first shadow artifact compares Layer 1 24H only because that is the checked-in checker scope available for like-for-like comparison

## Target Outcome

The near-term outcome is:

> a separate research-only Phase 2 shadow backtest surface that compares existing production outcomes against conservative evidence-reweighted shadow logic without changing production behavior

The later decision point is:

> decide whether the reviewed shadow evidence justifies any future production proposal, and only then consider separate live-logic work
