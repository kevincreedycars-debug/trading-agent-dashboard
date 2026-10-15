# Current State - AI Trading Platform

Last updated: 2026-10-15

Dispatch note, 2026-10-15 (pilot-dispatch cycle, interactive coordinator), prepended: the manual Astra pilot started from the published VIX package, and the exact dispatched version and bytes are now pinned in `docs/research/handoff/usd/v1/pilot/PILOT_DISPATCH_RECORD.md` - pilot 1 of package `1.0.0` for factor `live.f1-vix-level` (task `USD-BASELINE-AUDIT-01`), pack version `2.0.0`, context version `usd-session-context-20261014.1`, card schema `usd-session-research-card-v3`, archive `pilot/usd-vix-pilot-v1.zip` at 46,619 bytes and sha256 `1a4dfbeaa0a98987b074c376aade6a7d64c32a77292ecd788bd3d558b2e8451f`, with its four flat members pinned as well (`f1-vix-level.md` 14,724 / `808dc01ada48798e…`, `RESEARCH_OUTPUT_TEMPLATE.md` 8,582 / `cbea6e9efd5b9b3b…`, `research_card.schema.json` 17,060 / `43b549d0279817b8…`, `VIX_PILOT_START_HERE.md` 5,611 / `408962f8fe865534…`, each byte-identical to the file it came from) and the brief's registered identity recorded (`usd-brief-f1-vix-level` version 2 at `808dc01ada48798e…` / 14,724 bytes, version 1 kept immutable at `25f6207967d3c088…` / 12,974 bytes), so a returned card registers against the version it actually read. The record is hand-written precisely so the dispatch stays frozen: it is not generated, not a member of the archive and not a library document, so `node scripts/build_research_handoff.js check` still reads 36 files current and the live archive still hashes to `1a4dfbea…`; the manifest's `pilot` block and `files` row carry the same values, so a later edit makes the two disagree rather than silently re-pointing the pilot. Two owner decisions are recorded with the dispatch: the proposed missing-quote policy stays explicitly proposed until the methodology reviewer assesses it and is frozen with the flat band and the study's own tie policy before any candidate is scored, the VIX card being one input rather than the decision; and the pilot stays a bundle-only download, with no per-factor action, no new library document and no interface work. Nothing else moved: 22 factors ready and 3 blocked before and after, no deployment, workflow, feed, dashboard, dispatcher or database touched, the pilot not yet run, and a returned card evidence rather than an approval.



Publish note, 2026-10-15 (brief-correction cycle), prepended: the correction above is on `main` as commit `6eab14a4` and is live on both delivery routes. `https://kevincreedycars-debug.github.io/trading-agent-dashboard/` answers HTTP 200 with `index.html` at 28,856 bytes; the 404 recorded in the previous cycle's note does not reproduce and no Pages setting was touched. The corrected VIX brief (14,724 bytes, sha256 `808dc01ada48798e…`), the first pilot archive (46,619 bytes, `1a4dfbeaa0a98987…`), the bundle archive (596,029 bytes, `22a0bb454ec2592c…`) and `data/research-library/documents.json` (49,476 bytes, `fa23a266ff059799…`) each return HTTP 200 with the delivered bytes. The Research Library's brief actions were verified on the live dashboard itself, headless: 25 briefs in the live registry, the panel reads 25 of 25, all twenty-five factor pages offer Copy prompt and Download for their own registered brief, and on the VIX factor the copied text is 14,724 characters and the downloaded file hashes to the same sha256 as the live registry entry and the live file, so the two actions deliver one artefact.


Correction note, 2026-10-15 (brief-correction cycle, interactive coordinator), prepended: the shared text the twenty-five briefs carry was corrected at the generator rather than in one file, the briefs were regenerated, and the first pilot is packaged. Three fixes: the deployed engine's `NO_CLEAR_BIAS` is reachable arithmetic (F2 + F3 + F4 + F6 + F8 = 50 against F1 + F5 + F7 + F9 + F10 = 50) and is no longer described as unreachable; the workflow identity separates the executing version v155 (published 2026-10-12T19:52:13.451Z by the supervised live apply of the null-versus-unavailable guard; version id `0fb553c2-b1f1-4afa-bfdc-1166b60a6a79`, `versionCounter` 155, `nodes_sha256` `b2583215…`) from the audited baseline `exports/usd_layer1_agent.json`, measured against v154 on 2026-10-11, whose `Calculate USD Conviction` jsCode `580f0aa3…` is the same bytes v155 executes; and the missing-quote policy is one proposed policy - a session whose start or endpoint print is missing is a data exclusion that leaves the scored sample and is counted as coverage, never filled, forward-carried or interpolated - with data exclusions kept apart from model abstentions, which stay in the sample and are scored as no-calls. Corrected in `scripts/build_research_handoff.js`, in `docs/research/handoff/usd/v1/USD_SYSTEM_CONTEXT.md` and in the library's published implementation excerpt. `docs/research/handoff/usd/v1/` is now 36 generated files, the two new ones being the first pilot package: `pilot/usd-vix-pilot-v1.zip` (the VIX brief, the output template and the full card schema flat inside it) and `pilot/VIX_PILOT_START_HERE.md`. Guards: `npm run test:research-handoff` 14 of 14, `tests/research_library.test.js` 19 of 19, `npm run test:usd-session` 33 of 33, browser panel 1 of 1, and the 25 briefs registered an immutable version 2 in `data/research-library/documents.json`. Nothing was deployed, no factor's status moved (22 ready, 3 blocked), the pilot has not been run, and the flat band and the study's own tie policy remain unfrozen.


Delivery note, 2026-10-15 (USD session brief-delivery cycle, interactive coordinator), prepended without changing the state description below: the twenty-five self-contained USD research briefs are delivered, downloadable and published in the Research Library. `docs/research/handoff/usd/v1/` holds 34 generated files written by `scripts/build_research_handoff.js`: 25 briefs under `packs/` (10 baseline audits of the deployed factors and 15 session-research briefs, one per non-live catalogue factor, each self-contained with its own context, questions, hypothesis seed, falsification test, data asks, prohibitions, card field list and one session - 05:00 `Europe/London` to 05:00 `Europe/London` on the next local date), `BRIEF_INDEX.json`, `tracker_tasks.json` with 25 rows, `START_HERE.md` with the numbered list of all twenty-five briefs and a link to each, and `usd-research-handoff-v1.zip`, a stored archive the builder writes itself and verifies byte for byte. The same 25 files are registered as repo-backed `brief` documents, so each factor page carries a Brief block with Copy prompt and Download, the coverage line reads 25 of 25, and the copied prompt and the downloaded file are the same bytes the registry hashed. No status moved: 22 ready and 3 blocked, before and after, nothing uploaded, accepted or scored. Tasks `USD-SESSION-A3`, `A4` and `A5` cover all 25 factor ids and `verify` reports zero factors covered by no task. Guards: `npm run test:research-handoff` 12 of 12, `tests/research_library.test.js` 18 of 18, `tests/research_library.browser.test.js` 1 of 1. The Research Library's factor table is at the full width of its panel, an implementation published by the dashboard lane and re-measured here at both widths. Nothing live changed: no workflow, feed, credential, dispatcher or production file was touched.
Publish note, 2026-10-15 (same cycle): the delivery described here is on `main` as commit `f7fc4690`, pushed onto the live-feed snapshot `c3589304`, and the published bytes are identical to the delivered ones (`git hash-object` against `git rev-parse origin/main:<path>` for `START_HERE.md`, `BRIEF_INDEX.json`, `usd-research-handoff-v1.zip`, `HANDOFF_MANIFEST.json` and the packs). Downloads, verified live this cycle at HTTP 200 with the published byte lengths: `https://raw.githubusercontent.com/kevincreedycars-debug/trading-agent-dashboard/main/docs/research/handoff/usd/v1/START_HERE.md`, `.../BRIEF_INDEX.json`, `.../usd-research-handoff-v1.zip`. In a `main` checkout the guards read `test:research-handoff` 12 of 12, `tests/research_library.test.js` 16 of 18 and `tests/research_library.browser.test.js` 1 of 1; the two failures are the pre-existing registry hash mismatches on `data/usd-24h-experiment-registry.json` and `data/usd-24h-selection.json`, which fail the same way on untouched `main` and predate this cycle.



## Platform Status

The Layer 1 trading-agent platform remains operational, and the latest runtime evidence in `data/workflow-status.json` shows a successful manual refresh on 2026-07-20 with every listed step marked successful, including `Layer 2 Trade Selection Agent`.

The full Layer 1 historical replay rollout is now validated across USD, EUR, Gold, NQ, and BTC. The active repository work has shifted from replay rollout itself into downstream research presentation and breakdown views built on top of the canonical checker artifacts.

The current deployed production baseline includes the UK/ET live header clock, explicit Layer 1 `24H` expiry display on Overview cards, the Layer 1 Directional Viability spacing fix, removal of the redundant Overview weighted-verdict prose, and UK-time hover/focus tooltips on every available Layer 1 `24H` expiry section while preserving the visible ET expiry. The tooltip converts the exact same expiry timestamp into UK time using browser-native `Intl.DateTimeFormat` with automatic GMT/BST handling.

Current platform state is stable and validated. The production dashboard exposes the live Layer 1 and Layer 2 surfaces plus the read-only historical research tabs. The credential-continuity milestone is complete, and the Architecture Mirror is now implemented and deployed as a read-only top-level dashboard tab.

The deployed Architecture Mirror baseline is implementation commit `7586016d89c1e06c9f20beed3201034248d1e048`, published at deployed commit `9407893cc668b47fc9ddddf0cfa4b9e8a6f722bc`. It ships a validated checked-in manifest and custom HTML/CSS renderer with:

- 36 nodes
- 59 edges
- 5 boundaries
- 13 views

The current deployed presentation uses:

- an 8-stage grouped Overview map rendered from the browser-side renderer rather than from altered manifest facts
- deterministic vertical waterfall views for every Architecture tab
- contained responsive grids for parallel nodes within a stage
- centered vertical connectors between stages
- a below-canvas selected-node detail panel
- no absolute node placement in the active renderer
- no SVG bus routing in the active renderer
- no horizontal scrolling in the Architecture canvas
- four-viewport geometry and live review coverage across all 13 views

The Architecture Mirror remains documentation-only. It does not change production logic, research calculations, workflow execution, credentials, or existing artifact semantics.

The following architecture areas remain intentionally explicit but unverified in the deployed mirror:

- whether Dashboard Writer publishes artifacts beyond `data/layer1.json`
- the exact publication responsibility split for `data/layer2.json`
- which non-BTC collectors directly consume economic events
- exact GitHub commit sequencing during an orchestrator run
- complete column-level Supabase lineage
- node-level failure fan-out inside every exported workflow

## Credential Continuity Status

Credential continuity is now functionally complete using the existing CLIXML-based encrypted local store under:

```text
%USERPROFILE%\.trading-agent-dashboard\
```

Current validated local state:

- eight continuity variables are present in the local encrypted store
- `OANDA_ACCOUNT_ID` remains optional / conditional and is currently absent
- repository bootstrap is `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\bootstrap-local-secrets.ps1`
- repository validation is `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\check-required-secrets.ps1 -Scope all`
- isolated backup and restore validation passed
- read-only connectivity validation passed for `n8n`, Supabase, FRED, OANDA, and Alpha Vantage
- RapidAPI credential loading is confirmed, but external endpoint verification remains inconclusive because the harmless validation endpoint timed out

This continuity work did not change production logic, trading logic, or live workflows.

## Current Architecture

```text
Market Collectors
        ->
Market Snapshot (Supabase)
        ->
Independent Layer 1 Agents
        ->
agent_outputs
        ->
Dashboard Writer
        ->
GitHub Pages Dashboard
```

Layer 2 economic-event adjustment will be built later.

## Layer 1 Assets

- USD
- EUR
- Gold / XAU
- NQ
- BTC

## Layer 1 Isolation Rule

Each Layer 1 agent must remain sealed and independent.

No Layer 1 agent may:

- read another agent output
- read dashboard output
- read Layer 2 output
- synthesise pair relationships using other agents
- contaminate its own raw call with another asset's call

Each Layer 1 agent receives only:

- its own logic document
- the latest usable market snapshot

Each Layer 1 agent answers:

> Based on confirmed value-driving factors available at execution time, what is the likely direction of this asset?

## Master Orchestrator

A Master Orchestrator workflow has been created in n8n.

Purpose: one manual button press runs the whole platform sequentially.

Current intended execution order:

```text
Manual Trigger
        ->
Eco Events Collector
        ->
USD Collector
        ->
EUR Collector
        ->
Gold Collector
        ->
NQ Collector
        ->
BTC Collector
        ->
USD Layer 1 Agent
        ->
EUR Layer 1 Agent
        ->
Gold Layer 1 Agent
        ->
NQ Layer 1 Agent
        ->
BTC Layer 1 Agent
        ->
Dashboard Writer
```

Every workflow has been converted to use `Execute Sub-workflow Trigger`, allowing the master workflow to call workflows sequentially.

Runtime evidence in `data/workflow-status.json` shows a successful run on 2026-07-20, with every listed step marked successful and no reported error.

## Known Current Issues

### 1. Eco Events duplicate insert

This issue was fixed on 2026-06-21.

The live `Eco Events Collector` was updated to dedupe incoming events, update existing rows, and create only unmatched rows. The previous duplicate-key failure is no longer an active known issue.

### 2. EUR Agent JSON parsing

The EUR Layer 1 Agent can fail when the OpenAI node output is returned as an object instead of a string.

Original parser assumed:

```js
JSON.parse(text)
```

After enabling OpenAI `Output Format: JSON Object`, the parser must support both:

- string output
- object output

This remains a known issue unless confirmed fixed in the live workflow.

### 3. Master workflow final status summary

The latest runtime artifact in `data/workflow-status.json` now provides a useful success payload, including a top-level message, per-step statuses, and no reported error for the latest run.

Any further refinement should be driven by observed runtime gaps rather than by the older missing-summary assumption.

## Current Deployment State

The repository currently documents and exposes GitHub Pages as the active static host:

```text
https://kevincreedycars-debug.github.io/trading-agent-dashboard/
```

Older architecture notes that refer to Netlify are historical context and should not be treated as the current host model.

## Current Strategic Shift

The project has already established the AI-assisted development environment baseline and completed the Layer 1 historical replay rollout. The current repository priority is downstream analytical visibility and validation on top of those frozen checker artifacts.

The current repository priority is:

> keep the production dashboard baseline clean and explicit while validating and reviewing the newly deployed Architecture Mirror

The current immediate implementation task is:

> review the deployed Architecture Mirror and decide the next milestone

The next planned phase after this production polish task is:

> no new implementation phase is active yet; the next milestone awaits review unless a separately documented task is approved

The `L2L 1H Sequence Research` module is not another close-to-close accuracy table. It answers whether price moved at least the required `50% ADR20` distance in the direction of a Layer 1 or Layer 2 call after the relevant intraday swing, using sequence-aware `1H` candles and daily candles only for ADR20.

Current repository evidence supports real sequence-aware L2L measurement for:

- `EUR` Layer 1 using repo-local OANDA `EUR_USD` daily + `1H` candles
- `Gold` Layer 1 using repo-local OANDA `XAU_USD` daily + `1H` candles
- `NQ` Layer 1 using repo-local OANDA `NAS100_USD` daily + `1H` candles
- `BTC` Layer 1 using repo-local Binance `BTCUSDT` daily + `1H` candles
- `EUR/USD` Layer 2 using the existing Pair Trade Research tradable-signal logic plus the same `EUR_USD` candle source
- `XAU/USD` Layer 2 using the existing Pair Trade Research tradable-signal logic plus the same `XAU_USD` candle source
- `NQ/USD` Layer 2 using the existing Pair Trade Research tradable-signal logic plus the same `NAS100_USD` candle source
- `BTC/USD` Layer 2 using the existing Pair Trade Research tradable-signal logic plus the same `BTCUSDT` candle source

Current repository evidence does not yet support real sequence-aware L2L measurement for:

- `USD`

That unsupported path is now rendered as unavailable in the `L2L 1H Sequence Research` module rather than estimated from close-only data.

GitHub is the source of truth. n8n remains the execution engine. Supabase remains the data layer. GitHub Pages is the active presentation host.

## Target Development Model

```text
ChatGPT / Codex
        |
        |-- GitHub repository
        |-- n8n workflows
        |-- Supabase data layer
        `-- GitHub Pages dashboard
```

ChatGPT should handle architecture, debugging, reasoning, planning, and documentation.

Codex should handle file edits, workflow JSON edits, code changes, commits, and implementation.

Both should eventually be able to inspect GitHub and n8n without manual copy/paste from the user.

## Permanent Working Memory

Codex startup is now governed by `CODEX_STARTUP.md`.

Every Codex session must use `CODEX_STARTUP.md` as the single startup entry point, always read the core memory files first, selectively load additional documents only when relevant, then inspect repository and runtime state before editing.

The memory documents are authoritative between sessions and should be updated only when their contents actually change.

The canonical project memory set is:

- `CODEX_STARTUP.md`
- `docs/CURRENT_STATE.md`
- `docs/CURRENT_TASK.md`
- `docs/ACTIVE_MILESTONE.md`
- `docs/NEXT_STEPS.md`
- `docs/CHANGELOG.md`
- `docs/DECISIONS.md`
- `docs/SESSION_NOTES.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ARCHITECTURE.md`
- `docs/N8N_INTEGRATION.md`
- `workflows/WORKFLOW_INVENTORY.md`

## Historical Research Platform

The historical research platform is downstream-only and must not modify production behavior.

Authoritative principles live in:

- `docs/CORE_RESEARCH_PHILOSOPHY.md`

Current implemented state:

- Historical replay and deterministic checker coverage are validated for USD, EUR, Gold, NQ, and BTC.
- Current checker totals are USD `604`, EUR `602`, Gold `608`, NQ `604`, and BTC `850`, all passing with zero fail / zero missing / zero tolerance pass.
- The Backtest / Accuracy dashboard exposes the existing matrices and checker workspaces plus weekday confidence breakdowns, Pair Trade Research, and the first `L2L 1H Sequence Research` release.
- 24H remains the primary short-horizon benchmark focus.
- Historical research presentation remains downstream-only and must not modify live runtime behavior.
