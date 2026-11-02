# Phase 2: North Star v2 prompt revision

Date: 2026-11-02. Status: locally validated, unpublished; awaiting user approval before publication. Branch: `research/north-star-v320-20261102`, based on `2be1226`.

## Scope and result

Astra audited the v3.1.0 generator and all 25 factor scopes against the supplied North Star v2.0 contract. All 78 prompts required shared contract corrections: 75 factor stages and three final stages are regenerated as `research-prompt-v3.2.0`. Factor, chain and topic IDs, stage order, parent relationships, prompt paths and document associations remain unchanged. Historical prompt identities and hashes are recorded in `PROMPT_V310_BASELINE.json`; original prompt bytes remain in Git history. The exact supplied contract is included with a SHA256 pin and a scoped Git byte-preservation rule.

The detailed findings and factor-specific improvements are in `ASTRA_PROMPT_AUDIT_V320.md`. Improvements cover independently resolved 05:00 Europe/London endpoints and daylight saving time; primary-source and contradictory-evidence verification; publication, dissemination, ingestion and vintage timestamps; named macro regimes and economic releases; immutable forecasts and separate reforecast cohorts; falsifiable hypotheses, baselines, ablations and downstream out-of-sample tests; and distinct research, red-team and adjudication duties. Existing n8n event ingestion must be reused. Missing evidence and unresolved design parameters must remain explicit rather than produce invented conclusions.

## Verification

- `npm.cmd run test:unit`: 650 tests passed, zero failures, skips or cancellations.
- `node scripts/build_research_library.js catalog --check`: passed after regeneration.
- `node scripts/build_research_library.js chains --check`: passed after regeneration.
- `node scripts/build_research_library.js verify`: catalogue, registry, repository hashes, chain prompts and final-chain checks passed.
- `git diff --check`: passed.
- New regression checks compare all 78 identities and associations to the v3.1 baseline, verify every new prompt byte count and SHA256, verify the exact governing contract, and verify the document registry remains byte-identical.
- All 75 factor prompts were retrieved through the existing pipeline's real envelope/preview path with exact text and hash agreement. Clearly marked synthetic parent documents were registered only in isolated operating-system temporary test stores to exercise stages 2 and 3. No dispatcher queue was created and no research was executed. The final three prompts passed catalogue/file/hash verification, not dispatcher retrieval.

## Remaining boundaries

The dispatcher currently enumerates only the 75 factor stages; final-stage dispatcher support remains absent. Its immediate-parent envelopes also need a complete original-research plus review package for rigorous unattended adjudication. These are pre-existing execution gaps, not prompt validation failures, and were not implemented in this prompt-only phase. Instrument/source choices and point-in-time data availability still require evidence before research can establish operational readiness.

No production dashboard, trading code, forecast, n8n workflow, hosted research document or document registry was changed. No research or paid external API call was initiated. No branch was pushed or published. Local checks do not establish live delivery of v3.2.0, research quality of future outputs, subscription capacity or trading edge.

Next action: user review and publication approval for this prompt revision. Research remains separately stopped; resolve execution gaps before claiming fully automatic 78-stage dispatch.
