# Current task

Updated 2026-09-17.

Active objective: build a source-auditable Gold 24-hour variable dataset, then assess individual variables, event-conditioned combinations and independent Layer 1/Layer 2 qualification against the user's greater-than-60% target. Follow `GOLD_RESEARCH_DELIVERY_CONTRACT.md`. Source acquisition and framework work are authorized; no further design input is required. The target is not a promised empirical result.

The September 17 live interruption is resolved: USD's first FRED GET returned HTTP 502 despite the prior single-run fix. Added bounded retries to that node; fresh Master 3992 and every child succeeded, and public Pages reports success at 21:16:17 UTC. See `USD_GATEWAY_INCIDENT_20260917.md`. Existing partial history/calendar inputs remain disclosed. The Gold objective resumes after this operational repair.

See `BTC_RATE_LIMIT_INCIDENT_20260909.md`. Authenticated n8n/provider access is available through the encrypted credential runner documented in `CREDENTIAL_CONTINUITY.md`; empty shell environment variables are intentional. Preserve secrets and raw evidence locally.

Latest user direction: push ahead with coverage and variable mapping. September 17 expanded the archive to 3,829 HIGH/MEDIUM events, 62 retrospective families and 44,367 candidates. One event-age condition meets the training floor but its 59.26% validation matches a constant-direction baseline; selected macro validation remains 53.57%. The mapping audit finds some values for 25/28 variables, rejects ten fixture events, and leaves inflation/headline/prior-vintage gaps explicit. Next: check aligned pre-2024 event/price/macro coverage before extending the schedule. Original-release/consensus timing remains a qualification requirement, not a blocker to exploration. See `GOLD_COVERAGE_EXPANSION_20260917.md`. The Gold history repair remains unapplied and requires isolated runtime validation. Layer 1 remains independent and backtesting downstream-only.
