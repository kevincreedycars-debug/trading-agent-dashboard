# Current task

Updated 2026-09-09.

Continue the backtesting correctness review from the completed Gold v2 measurement-contract repairs. See `GOLD_TIMESTAMPED_EVALUATION_CONTRACT.md` for completion validation, normalized storage-entry compatibility, protocol/source lineage and shared snapshot selection.

Next objective: execute the isolated runtime validation described in `GOLD_HISTORY_PATCH_VALIDATION.md` when an authenticated n8n connection is available. The generator and exact capture/reference checker are now built; no runtime connection is exposed in the current session. The offline package now passes six checks against the exact exported normalizer using 600 synthetic rows; it does not exercise n8n pagination. Keep production application and fresh-data calibration as separate gates. Authentic publication/availability timing and complete market paths remain unestablished.

Read `BACKTESTING_REVIEW_PLAN.md`. Preserve frozen research reports and consumed holdouts. Layer 1 remains independent and backtesting downstream-only. Separate asset builders retain their authorized ownership; macro provisioning and model optimization remain parked.

Use the canonical folder, commit coherent changes and keep raw evidence ignored. Do not run linked-warehouse mutation suites or publish production as incidental validation.
