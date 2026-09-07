# Session notes

2026-09-07: initial Gold timestamped contract audit complete.

Canonical folder: `D:\trading-agent-dashboard-codex`. Review began from clean local `main` at `6c43cbb`, eight commits ahead of recorded `origin/main`. Work is on local `review/gold-timestamped-contract`; no production push or deployment occurred. Consolidation/recovery details remain in `CONSOLIDATION_20260907.md`.

Read `GOLD_TIMESTAMPED_EVALUATION_CONTRACT.md` for the versioned measurement contract, alternative stored-call/as-of paths, source-to-report trace, denominator rules and prioritized findings:

- G1: direct evaluator accepts missing/non-boolean completion metadata; OANDA normalization already emits only completed candles.
- G2: rounding storage just below a minute upward can advance entry and horizon an additional minute relative to the raw next boundary. This follows existing normalization order but needs explicit protocol semantics; pilot incidence is unmeasured.
- G3: as-of builder drops the supplied protocol envelope before reporting.

No evaluator behavior or frozen research artifact changed. Six new offline review tests include independent outcomes/DST/weekend/reconciliation checks and explicitly labelled characterizations of the three gaps. Characterization success is not a repair claim.

Validation: `node --test backtester/tests/gold_contract_review.test.js` passed 6/6; `npm test` passed 286/286 with no failures, skips or cancellations. Full local log: ignored `tmp/gold-contract-review-tests-20260907.log`. Linked-warehouse mutation suites remain excluded. No acquisition or live workflow execution was run.

Next immediate action: address G1 with explicit completion validation and a versioned compatibility decision for direct datasets/fixtures. Keep the same active Gold review milestone; then resolve entry precision semantics and protocol propagation. Isolated n8n validation of the unapplied Gold history patch remains a separate operational gate.

Storage/publication proxies, unverified feature vintages, repeated snapshots, no complete strict pilot paths, the June 9 input defect and consumed holdouts remain limitations. GBP onboarding, macro provisioning and model optimization remain parked.

Concurrent unrelated edits appeared during this review in `docs/PARALLEL_AGENT_HANDOFF.md`, `docs/README.md`, and new `docs/DEEPSEEK_BUILD_BRIEF.md`. They were left untouched and are excluded from the review commit.
