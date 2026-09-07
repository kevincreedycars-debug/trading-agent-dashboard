# Active milestone

## Current Feature
Backtesting engine review.

## Current Milestone
Define and audit the Gold timestamped directional-evaluation contract.

## Status
Planning

## Completed Work
Repository preservation, consolidation and original-folder cutover completed. All 280 local tests pass in the main folder; engine inventory and review sequence are documented. See the consolidation record for recovery and validation evidence.

## Remaining Work
Write the explicit contract, trace the evaluator and adapters against it, and prioritize demonstrated correctness gaps. Establish a separate repair-validation path for the Gold collection defect.

## Current Files Being Modified
No engine implementation changes are active. Review starts in `docs/BACKTESTING_REVIEW_PLAN.md` and the referenced Gold modules.

## Blockers
Gold input history defect remains unrepaired in production. Authentic availability/publication timestamps, complete paths and MT5 execution evidence are not yet established. These block qualification, not code review.

## Next Immediate Action
Write the Gold timestamped directional-evaluation contract from the existing implementation and documented evidence limitations.

## Last Updated
2026-09-07.
