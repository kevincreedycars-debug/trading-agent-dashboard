# Multi-asset one-day readiness spike

Assignment: `multi-asset-readiness-spike-001`. Published 2026-09-24.
Worker: `backtester-spike`.
Worktree: `D:/trading-agent-dashboard-codex/.local/worktrees/backtester-spike`.
Branch: `spike/multi-asset-readiness-20260924`. Starting commit: `6cbbd01`.
Standing user authority: `docs/DEEPSEEK_PROJECT_HANDOVER_20260924.md` section 9 and
section 11 item 7.

This is a platform, rehearsal and measurement milestone. It is not a production
deployment and it changes no research rule.

## Scope

1. Publish a readiness matrix for Gold, USD, EUR, NQ, BTC, GBP, Silver and WTI with
   source availability, immutable input, session policy, outcomes, adapter status,
   replay support and blockers, each backed by measured repository evidence.
2. Freeze a generic asset/job manifest schema in which a job is reusable only when
   every binding matches.
3. Freeze a shared immutable cache contract with a content-addressed key and hash
   validator. Do not reacquire paid, live or provider sources in this spike.
4. Implement a deterministic local orchestrator that launches isolated asset
   processes under a configurable concurrency cap, writes attempt-unique immutable
   shards into unique output directories and reports resumable statuses.
5. Record stage metrics: wall time, CPU time, peak RSS, bytes read and written, rows,
   API calls (expected zero), cache hits, retries and artifact hashes.
6. Prove single-worker and parallel execution produce identical ordered logical
   records and aggregates, apart from explicitly variable run metadata.
7. Later bounded steps only: a two-asset concurrency rehearsal, then a four-asset
   consumed-data rehearsal for USD/EUR/NQ/BTC if their contracts pass readiness.
8. Publish a concise runbook and a one-day capacity estimate based on measurements.

## Owned scope

Readiness matrix, job and cache contracts, batch kernel and shard worker, spike CLI,
focused tests, this document, the runbook section of
`docs/MULTI_ASSET_READINESS_SPIKE.md`, and ignored benchmark evidence under
`backtester/tmp/runs/`. Preserve every accepted Gold artifact and every other
worktree.

## Boundaries

No acquisition of paid or live sources, no provider credentials, no warehouse or n8n
write, no scheduler install/enable/start, no real Gold anchor capture, no outcome or
evaluation read, no research-rule change, no Layer 1, dashboard, integration,
deployment, purchase, weight or production change. One writer per worktree. Stop at
the review boundary: single worker, coherent commit, one mailbox submission.

## Acceptance gates (from the handover)

Gold single-process equivalence; microbenchmark 100 candidates x 100 anchors at 1, 2,
4 and 8 workers; full Gold benchmark at 1, 2, 4 and 8 workers; chosen worker count is
the lowest within 10% of best throughput; the two heaviest prepared asset fixtures run
together; all ready assets rehearse from immutable consumed data only. Peak RSS stays
below 75% of available memory, free disk stays at least twice the estimated output,
and the full rehearsal stays inside six hours with two hours reserved for
verification.
