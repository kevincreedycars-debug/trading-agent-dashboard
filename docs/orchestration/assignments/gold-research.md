# Gold qualification collector implementation

Assignment: gold-qualification-collector-016. Published 2026-09-24.
Worker: gold-research. Worktree: D:/trading-agent-dashboard-codex/.local/worktrees/gold-research
Branch: workers/gold-research-policy-20260920. Starting HEAD: b5f2e27.
Standing user authority to advance Gold research applies.

Assignment 015 is accepted at `b5f2e27`. Its execution contract SHA-256 is
`208c584427c7540b6f1e712d9feac577de8e95200af2d9ad6f868390abe5910d` and it
binds accepted manifest 014 SHA-256 `15cd0606...`. This assignment implements and
tests deterministic collector adapters and sealed capture envelopes before any
real prospective collection is permitted. It uses synthetic or accepted pre-window
fixtures only and does not open or execute the real window.

1. Bind all collector code to the exact 015 execution contract and 014 manifest
   paths/digests. Refuse aliases, drift, missing sources, changed source order,
   changed anchor schedule or any path outside the registered worker root.
2. Implement offline parser/adapters for exactly the declared sources: FRED
   `DFII10`, `DGS2`, `VIXCLS`, and archived OANDA `XAU_USD` H1. Preserve raw bytes
   and source timestamps. Do not add substitutes, inferred vintages or live fields.
3. Freeze a sealed capture-envelope schema carrying source id, request identity,
   raw SHA-256, retrieval time, observation time, availability time, coverage bounds,
   source version/provenance and parser version. Values may exist only inside the
   sealed raw payload; logs, indexes, readiness reports and run summaries must remain
   metadata-only and must never expose feature values, prices, returns or directions.
4. Implement a deterministic offline capture planner for all 130 anchors. It must
   declare the exact pre-anchor feature captures and post-anchor Gold endpoint
   captures, retain exact and delayed endpoints separately, never reschedule a
   missing anchor and never compute a candidate state or outcome.
5. Implement new-directory-only sealing and verification. A sealed envelope is
   immutable, hash-reconciled and either complete or explicitly blocked; partial
   writes, duplicate source/anchor identities, overwrite, path aliasing and recovery
   that changes bytes must fail closed. Recovery may only create a new attempt that
   references the failed attempt without replacing it.
6. Keep real-window activation impossible. Network clients, credentials, schedulers,
   daemons and real 014-window timestamps must be rejected by the assignment CLI.
   Tests may use synthetic fixtures or accepted data ending strictly before
   `2026-09-24T14:00:00Z`; synthetic timestamps must not overlap the real window.
7. Add adversarial tests for parser/source confusion, timestamp and availability
   drift, duplicate identities, raw-hash mismatch, value leakage into metadata,
   overwrite/recovery, schedule completeness and attempts to enable network or real
   timestamps. Demonstrate a byte-identical synthetic dry run, run focused tests and
   `npm.cmd test`, submit one unique 016 envelope, and pause for review.

Owned scope: offline adapters/parsers, sealed-envelope and capture-plan code,
synthetic/pre-window fixtures, focused tests and scoped runbook updates. Preserve
015, the accepted 014 artifact, 012/013 artifacts, frozen registry and run-011
evidence byte-for-byte. Do not acquire or inspect any real observation at or after
`2026-09-24T14:00:00Z`; do not open, execute or simulate the real window; do not
expose an interim result, reserve/consume a holdout, fit a formula or alter ids,
signs, schedule or rules. No network, credential, scheduler, daemon, live workflow,
warehouse, Layer 1, dashboard, integration, deployment, purchase, weight or
production change. Stop and submit a blocker if sealing cannot remain outcome-blind.
