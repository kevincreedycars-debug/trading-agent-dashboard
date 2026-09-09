# Active milestone

## Current Feature
Backtesting engine review.

## Current Milestone
Validate the Gold history-input repair in an isolated runtime.

## Status
Local isolation tooling complete; installed n8n execution unavailable in this session.

## Completed Work
Gold v2 measurement/reporting repairs and the offline normalization harness are preserved. Added a credential-free manual/read/capture workflow generator with source/patch drift guards, plus a capture checker for exact row content/order, timestamp bounds, graph isolation and execution identity. A local candidate is saved under ignored `tmp/gold-history-isolation-20260909/`.

## Remaining Work
Acquire a fresh source export, bind the isolated read credential in the available runtime, execute the inactive manual-only candidate, and compare captured rows with an independent reference. Verify actual pagination requests, runtime version and production-clock/midnight behavior. Production application and fresh-data collection remain separate gates.

## Current Files Being Modified
Isolation library, generation/comparison commands, tests and `GOLD_HISTORY_PATCH_VALIDATION.md`; no production workflow files.

## Blockers
This session exposes no n8n/Docker executable, n8n API environment variables, n8n connector or connected browser. Local tests cannot substitute for installed-runtime execution. Authentic source timing and complete market paths remain separate qualification limitations.

## Next Immediate Action
Acquire the fresh Gold workflow export and establish the inactive manual-only runtime target when authenticated n8n access is available.

## Last Updated
2026-09-09.
