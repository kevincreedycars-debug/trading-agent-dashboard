# Active milestone

## Current Feature
Backtesting engine review.

## Current Milestone
Define and audit the Gold timestamped directional-evaluation contract.

## Status
Initial contract audit complete; demonstrated repairs pending.

## Completed Work
Versioned contract and source-to-report trace documented in `GOLD_TIMESTAMPED_EVALUATION_CONTRACT.md`. Six offline review tests cover hand-calculated outcomes, DST/weekend boundaries, denominator reconciliation and three reproduced gaps. Engine behavior and frozen research artifacts are unchanged.

## Remaining Work
Repair explicit candle-completion validation, resolve/version raw versus normalized storage entry semantics, and preserve as-of protocol metadata. Replace gap characterization assertions with repaired expectations. Review shared snapshot selection/provenance. Keep isolated history-query validation separate.

## Current Files Being Modified
Contract/review documentation and `backtester/tests/gold_contract_review.test.js`; no engine implementation changes.

## Blockers
Gold input history defect remains unrepaired in production. Authentic availability/publication timestamps, complete paths and MT5 execution evidence are not yet established. These block qualification, not code review.

## Next Immediate Action
Implement explicit candle-completion validation with a versioned compatibility decision for direct datasets and synthetic fixtures (contract gap G1).

## Last Updated
2026-09-07.
