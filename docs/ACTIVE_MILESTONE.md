# Active Milestone

## Current Feature

Factor Edge Lab

## Current Milestone

Phase 2B - expose the checked-in Factor Edge Lab artifact in a dedicated research-only dashboard tab

## Status

Testing

## Completed Work

- Phase 2A builder validation completed and was committed in `f9e7062` with commit message `Add Factor Edge Lab research artifact builder`.
- The checked-in artifact was rebuilt and verified to include Layer 1 entities `USD`, `EUR`, `Gold`, `NQ`, and `BTC`.
- The checked-in artifact was rebuilt and verified to include Layer 2 entities `EUR/USD`, `XAU/USD`, `NQ/USD`, and `BTC/USD`.
- The artifact was verified to keep factor-level ADR/L2L metrics explicitly unavailable with blocker text instead of fabricated values.
- A new top-level `Factor Edge Lab` dashboard tab was added.
- The dashboard now reads `data/factor-edge-lab.json` directly for this view.
- The new UI renders research-only methodology guardrails plus Layer 1 and Layer 2 factor evidence sections.
- The dashboard smoke script now covers the `Factor Edge Lab` tab and verifies the explicit ADR/L2L unavailable contract.
- `node --check script.js`, `node --check playwright-dashboard-smoke.js`, and `node playwright-dashboard-smoke.js` all pass locally.

## Remaining Work

- Review the local Factor Edge Lab layout and copy for any final UI refinements before committing Phase 2B.
- Decide whether to commit the new dashboard tab as its own milestone commit.
- Keep any future weighting discussion separate from the dashboard implementation itself.

## Current Files Being Modified

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

- factor-level ADR/L2L opportunity joins remain unavailable because no full per-prediction factor-joinable export is staged locally

## Next Immediate Action

Review the local Factor Edge Lab dashboard render and commit the Phase 2B UI milestone if no further refinements are needed.

## Last Updated

2026-07-06 16:48:39 Europe/London
