# USD North Star: Model Contract v2.0

Status: proposed governing specification for all research and engineering agents. This file has **not** yet been committed to the live dashboard repository.

## Mission
Develop the strongest scientifically defensible, source-verifiable understanding of the economic, monetary, financial and market forces that influence USD direction over the next defined session. Translate only evidence-supported, non-redundant findings into a point-in-time correct Layer 1 forecasting system. Demonstrate incremental, out-of-sample directional value, while preserving honest uncertainty and the ability to abstain.

## Forecast contract
- Primary evaluation interval: 05:00 Europe/London to 05:00 Europe/London on the following **local calendar date**. Resolve each endpoint separately with the IANA time zone; handle DST and Friday-to-Saturday endpoints. Never silently substitute Monday for Saturday.
- Explicitly define the dollar instrument and source before evaluation. DXY, broad trade-weighted USD and bilateral pairs are not interchangeable.
- At the cutoff, only consume data that had actually been published and obtainable by that time, with revision/vintage and dissemination timing respected.
- Original 05:00 predictions are immutable. Store issue time, target end time, input snapshot/version, model and prompt versions, evidence, direction/abstention and confidence.
- Keep forecasts for alternative horizons and post-release reforecasts separate from the original primary forecast.

## Research programme
- 25 USD factor chains x 3 stages = 75 documents, plus final USD asset-level research, red-team and adjudication = 78 stage prompts/documents.
- Stage 1: comprehensive primary-source research, mechanisms, measurement, conditional regimes, strongest supporting and opposing evidence, pre-cutoff availability and falsifiable hypotheses.
- Stage 2: independent red-team review, primary-source verification, omitted evidence, alternative explanations, leakage, multiple testing and instrument/horizon mismatch.
- Stage 3: adjudication with traceable decisions: retained conditional hypotheses, exclusions, regime-only findings, insufficient evidence, or no incremental value. Do not manufacture a positive result.
- Final asset-level stages: assess overlaps, dependence, causal pathways, macro regime coverage, economic-event coverage, interacting factors and portfolio-wide consistency. Do not double-count correlated signals.
- Do not alter production factor weights or rules merely because a report is completed. Backtest with walk-forward/out-of-sample splits and compare against baselines first.

## Macro regimes and economic-event research
- Explicitly cover inflation, growth, labour, monetary-policy expectations, relative international policy, liquidity/funding stress, risk appetite and crisis regimes; do not assume each deserves a new factor.
- Cover scheduled high-impact events (e.g. CPI, PCE, NFP, FOMC, GDP, retail sales, ISM, ECB decisions), consensus, actual, prior/revisions, expected/realised surprises, event timing, market positioning and conditional effects.
- Cover unscheduled shocks as a separate uncertainty class. No guarantee that all shocks can be predicted.
- Audit all 78 canonical prompts for these topics before deciding whether new chains are required. Preserve existing prompt lineage and hashes; changes must be versioned and reviewed.

## Existing live infrastructure and event-triggered evaluation
- Existing n8n workflows/APIs already collect macroeconomic events. Inventory and reuse them; do **not** build a duplicate calendar pipeline by default.
- Current reported limitation: new event data does not automatically re-run the directional calls; a manual re-run is required. Confirm the exact event-to-snapshot-to-model chain in code.
- Proposed event-driven path: existing n8n ingestion -> validated event payload and as-of timestamp -> updated snapshot -> deduplicated trigger -> independent post-release forecast -> dashboard display with new issue/expiry times -> separately scored evaluation.
- Event triggers should be selective and evidence-based, not 're-run for every calendar entry'. Require complete source data, revisions/consensus integrity, rate limits, cooldowns, idempotency, market-hours policy, stale-input protection and fail-closed handling.
- Reforecasting after an event is **not** equivalent to changing the original 05:00 call. Do not overwrite historical calls, blend outcomes or retroactively improve performance figures.
- Do not enable automatic live order placement, reversal or risk changes from event triggers without a separate, explicit design, backtest, safety review and approval.

## Research automation build
1. Inventory current prompt catalogue, 78 prompt files, research documents, dashboard storage, dispatcher, n8n connections and subscription-authenticated Codex configuration.
2. Astra audits the governing contract and existing prompts; makes justified, versioned edits; validates 78/78 completeness and dashboard readback. No research generation in this phase.
3. Build a low-reasoning coordinator that uses deterministic code for state, dependencies, checksums, uploads, retries and logs. Reserve Astra for substantive research/red-team/adjudication.
4. Verify official ChatGPT subscription-backed Codex sign-in and model availability, noninteractive execution support, usage/allowance observability and permitted background operation. API billing is separate; never assume subscription access covers API requests.
5. Implement a single-stage pilot: next eligible VIX red-team prompt, with source verification, full document capture, content validation, SHA-256, upload/download round trip, manifest and allowance reconciliation. Do not run until authorised.
6. On pilot success, allow one stage at a time, dependency-ordered, with pause/resume, strict allowance headroom, no duplicate submissions, no paid overages, durable checkpointing and audit logs.
7. Separately prototype event-triggered reassessments in shadow mode, with independent performance scoring and no production trading changes.

## Universal agent constraints
- Read this contract and only the authorised task inputs; respect Layer 1 agent isolation in live forecasting.
- Do not invent sources, evidence, model access, current allowances, deployment status or successful uploads.
- Treat unsupported findings as unsupported. Report missing data and uncertainty plainly.
- Preserve original research, prompt lineage, snapshots, predictions and provenance.
- Do not spend paid API credits, enable overages, deploy production trading changes or modify order execution without explicit approval.

## Acceptance criteria
- 78/78 canonical prompts audited, hashed, versioned and retrievable on dashboard.
- All research stages pass evidence and completeness gates; no false 'complete' state for truncated documents.
- Subscription-backed execution proven with a small authorised pilot and observable limits before unattended operation.
- Event feeds reused, timestamps and vintage verified, original forecasts immutable, shadow reassessments evaluated separately.
- Directional and L2L performance tested out of sample; no performance claim based only on in-sample fitting.
