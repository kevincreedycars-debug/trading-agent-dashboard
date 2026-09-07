# Current task

Updated 2026-09-07.

Reassess the backtesting engines from the consolidated baseline. The first bounded task is to specify the Gold timestamped directional-evaluation contract and audit its implementation against that contract.

Read [BACKTESTING_REVIEW_PLAN.md](BACKTESTING_REVIEW_PLAN.md). Start with decision/publication time, feature availability, entry time, horizon, price source and gap handling. Record demonstrated defects before proposing code changes.

The Gold history-input repair is a prerequisite for fresh-data calibration. Its existing patch remains unapplied; isolated n8n validation and any live deployment are separate milestones. GBP onboarding and the macro prototype remain parked while this review is active.

Use the main folder. Commit each coherent milestone, keep raw evidence ignored, and update the active milestone and session notes. Do not reuse the consumed final-test period as an untouched holdout.
