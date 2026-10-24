2026-10-24, live upload repair (interactive coordinator), prepended without changing the objective below: the published dashboard's Research Library upload is finished as a reader meets it, and the milestone below is unchanged. One chosen Markdown file is the whole upload - the model/session label the form demanded is removed, so the open form holds a single `file` input - and the stage it fills reads **Uploaded** (it read "Delivered") with the upload time, file name, hash, version and the private-store note, plus View (the bytes in a new tab) and Download (the same bytes under the uploaded name) through short-lived private links with a fingerprint re-check. The account block signs in with the owner's email and password and remembers only the address; each request swaps the stored refresh token for a fresh access token first, so an hour-old session no longer refuses a file as if the upload were broken, and a 409 means the bytes are already stored. Cache-busters `20261024-research-library-v5`, `20261024-research-upload-v3` and `20261024-research-upload-hosted-v8`; `docs/research-library/UPLOAD_BACKEND.md` carries the flow, the refusals and how the published page is checked. Guards: library unit 29/29, upload client 9/9, adapter 9/9, library browser 1/1, full `npm test` 600/602 with the two live-trading browser failures unchanged on pristine `origin/main`. Deployed as `32489f9b` on `470eb344`; a scripted read of the published page signed in, uploaded one Markdown file into `usd-factor-live-f8-fed-bias` stage 1, saw the pill flip to Uploaded in about 1.3 seconds and stay UPLOADED after a reload, opened View and downloaded 286 identical bytes, and found no model field and no loopback address. The check's rows, objects and disposable account were removed afterwards, leaving the owner's real VIX report as the only stored document. No factor status, weight, threshold, sign or live call changed, and nothing was reviewed, accepted or scored. Open: the completed VIX red-team file still has to be uploaded through `usd-factor-live-f1-vix-level` stage 2.


2026-10-19, factor-chain UI pass (interactive coordinator, USD session lane), prepended without changing the objective below: the Research Library is now one 25-row factor table instead of topic, chain-card, task, filter and factor-detail sections. Each row opens in place on click or Enter/Space to its own three stage controls - Copy prompt, prompt download, inputs download, result download and one Markdown upload - and the stage payload carries the chain, stage, exact input document/version/hash and registered result document/version/hash. A chain is green and reads `data-rl-ready-for-synthesis="true"` only when all three stages are delivered against current parents; the gated final chain and whole-engine evidence stay below the table. The legacy task list is out of the view while its records remain in `catalog.tasks`; deleted renderers include the topic chips, chain board, progress cards, filter row, factor detail, task section, chain step strip, document row and upload form. The cache-buster is `20261019-research-library-factor-table-v6`. Guards: `node --check` clean, library unit 28 of 28 and browser 1 of 1, with the browser audit confirming 25 rows, 25 research/review/backtest pills, closed start, one-row expansion, VIX prompt lengths and stage states, upload linkage to `usd-baseline-audit-01-vix-usd-report` v1, unchanged factor statuses, green complete row with a `1/25` final gate, zero desktop or narrow overflow and no page errors. No factor status, weight, threshold, sign or live call changed, and nothing was reviewed, accepted or scored.

2026-10-19, factor-chain cycle (interactive coordinator, USD session lane), recorded below without changing the objective: the Research Library restructure is finished as factor-scoped chains with a gated final chain. The catalogue now carries twenty-five `factor_chains`, each with `chain_id`, `factor_id`, `topic_id`, `slug` and three stages, plus `final_chain` `usd-final-asset-analysis` with `final_analysis`, `final_red_team` and `final_adjudication`; the six topics are grouping labels only. Seventy-five chain prompts live under `docs/research/factors/usd/<factor-slug>/` and three final prompts under `docs/research/final/usd/final-asset-analysis/` (seventy-eight in total), generated and hash-checked by `scripts/build_research_library.js` (`catalog --write`, `chains --check` or its `topics` alias, `verify`). `script.js` renders one expandable chain row per factor with its own `n/3` progress and stage cards, and the final chain shows its registry gate (`0/25` today, state `locked`, twenty-five pending) with no stage rendered until every factor chain completes against current versions. The registry and store record `chain_id`/`factor_id`, refuse a stage that breaks a chain's parent linkage, and flag a stage when its parent version or any final input package entry changes; each final stage records its `input_documents`. Tests: library unit 28 of 28, library browser 1 of 1, 29 total and 0 fail, with browser assertions for chain rows (`1/3`, `0/3`), sibling isolation, the locked final gate, prompt copy, upload linkage, View/Download, refresh, restart, revision and the published page; `node --check script.js` and `verify` are clean. Open: the completed VIX red-team file still has to be uploaded through `usd-factor-live-f1-vix-level` stage 2. No factor status, weight, threshold, sign or live call changed, and nothing was reviewed, accepted or scored.


Delivery note, 2026-10-15 (research-topics cycle, interactive coordinator), recorded against the action below and changing none of it: the Research Library now works one topic at a time through three numbered stages - research, red-team, adjudication - and the factor-and-task register moved below them into a labelled secondary section. `data/research-library/catalog.json` carries six USD topics covering all twenty-five factor entries with their factor mappings, interactions, companions, published briefs and research questions, and eighteen generated stage prompts live under `docs/research/topics/usd/<slug>/` with their sha256 and byte count in the catalogue, so the prompt the page copies is verified against the catalogue and `topics --check` plus `verify` fail on any drift. Stage 1 of the VIX topic is the dispatched deep-research brief reproduced in full (21,283 characters), so the VIX Copy prompt is the VIX research assignment and not the legacy `USD-SESSION-A3` reviewer prompt; stage 2 carries the programme's step-2 red-team brief in full; stage 3 is the new adjudication assignment, which decides every material objection and ends with a handoff to central USD synthesis. The stage chain is enforced rather than described: the library validator and the store both refuse an unknown topic, a stage whose document type does not match, a missing or cross-topic parent and a parent version that is not registered, and a stage reads `delivered`, `awaiting_upload`, `not_started` or `reassessment_required` when it judged a version the parent has since replaced; `ready_for_synthesis` needs all three stages on the current versions and says nothing about an edge. The panel opens on the topic strip and the three stage cards, takes one Markdown file per stage with the metadata assembled for the reader, and offers hash-checked Copy prompt plus service-backed View and Download. On the committed registry the VIX topic reads research delivered (the registered report, v1, `e4151937…`), red-team awaiting the file and adjudication not started; no factor status moved - 22 ready / 3 blocked, 25 review pending, 25 backtest not tested - and nothing was reviewed, accepted or scored. Guards: library unit 26 of 26, library browser 1 of 1 in about 40s (rewritten for the new workflow, and it proves its uploads went to a temporary registry by hashing the committed one before and after), `research_handoff` 19 of 19, `registry --check`, `catalog --check`, `topics --check` and `verify` ok. The local service runs on loopback at `http://127.0.0.1:8791`, page at `/index.html`, and two workstream worktrees are cut from checkpoint `56afd67b` with the shared contract and both bootstrap prompts written in `docs/coordination/VSC_WORKSTREAMS.md`. Not claimed: no live call, weight, threshold, sign or score changed, the engine is not validated, and no report is published - reading an uploaded document needs the local service.
Delivery note, 2026-10-15 (report-registration cycle, interactive coordinator), kept for the record, recorded against the action below and changing none of it: `USD-BASELINE-AUDIT-01` is named in the document note and the version note and in `task_id` it is absent, because no catalogue task carries that brief id and the validator refuses a task that does not exist; the frozen pilot archive and the two hand-written records beside it were therefore left untouched, pack version stays `2.0.0` and the package still hashes to 46,619 / `1a4dfbeaa0a98987b074c376aade6a7d64c32a77292ecd788bd3d558b2e8451f`. The row reads research delivered, review pending, and no status moved: F1 stays research `ready`, review `pending`, backtest `not_tested`, the aggregates stay 22 ready / 3 blocked, 25 pending and 25 not tested, and an upload is evidence rather than an approval. The library README gained a `Registered returns` section recording the same facts and the boundary they illustrate: metadata visible, bytes private, View and Download through the local service only. Guards after the write: registry and catalog `--check` ok, `verify` ok with zero factors covered by no task, handoff `check` 42 files current, library 18/18, browser 1/1 (which now checks this document's row on the F1 page, its note, its visible hash, its missing View link, its service-only Download, and the three unchanged pills), handoff 19/19, and a full local suite of 580 tests with the four pre-existing `secret_scanner` failures unchanged. Nothing was deployed, published or mirrored, no review was recorded and nothing was scored; the next immediate action is unchanged, and the report still has to reach its coordinator with the registration instruction in writing.

Delivery note, 2026-10-15 (USD session brief-delivery cycle, interactive coordinator), prepended without changing the milestone below: the twenty-five self-contained USD research briefs the user asked for exist as files rather than as a description. `docs/research/handoff/usd/v1/` carries 34 generated files - 25 briefs under `packs/` (10 baseline audits of the deployed factors and 15 session-research briefs authored in `scripts/build_research_handoff.js`), `BRIEF_INDEX.json`, `tracker_tasks.json` with 25 rows, `START_HERE.md` with the numbered list of all twenty-five briefs and a link to each, and `usd-research-handoff-v1.zip`, a stored archive the builder writes itself and which verifies byte for byte. Every brief states 05:00 `Europe/London` to 05:00 `Europe/London` on the next local date, and the builder refuses to write unless the authored briefs cover the catalogue's non-live factors exactly. The same 25 files are published in the Research Library: each factor page offers Copy prompt and Download for its own brief, the panel reads 25 of 25, and no research status moved (22 ready, 3 blocked, nothing uploaded, accepted or scored). Tasks `USD-SESSION-A3`, `A4` and `A5` now cover all 25 factor ids. Guards: `test:research-handoff` 12 of 12, `tests/research_library.test.js` 18 of 18, `tests/research_library.browser.test.js` 1 of 1. Nothing live changed: no workflow, feed, credential or dispatcher file was touched.

## Current Feature

Architecture Mirror

## Current Milestone

Read-only Architecture Mirror implemented and deployed

## Status

Awaiting review

## Completed Work

- CLIXML-based credential continuity is complete under `%USERPROFILE%\.trading-agent-dashboard\`.
- Repository bootstrap and validation wrappers are in place for future Codex sessions.
- Eight continuity variables are present in the encrypted local store.
- `OANDA_ACCOUNT_ID` is confirmed conditional and currently absent without blocking ordinary OANDA candle downloads.
- Read-only connectivity validation passed for `n8n`, Supabase, FRED, OANDA, and Alpha Vantage.
- RapidAPI credential loading is confirmed, while external endpoint verification remains inconclusive due to timeout.
- Isolated backup/restore validation passed for the CLIXML store.
- UK-time hover/focus tooltips are deployed on every available Layer 1 `24H` expiry section.
- The visible Layer 1 expiry remains in ET.
- The tooltip converts the same expiry timestamp to UK time with automatic GMT/BST handling.
- The UK/ET live header clock, Directional Viability spacing fix, and Overview prose removal remain intact in production.
- Deployed the original Architecture Mirror implementation at commit `2c4f0cc177b6cca9ac26d72a7cfac939de84e4d2`.
- Replaced the old horizontal Architecture graph with the vertical waterfall renderer at commit `7586016d89c1e06c9f20beed3201034248d1e048`.
- Published the cache-busted waterfall deployment at commit `9407893cc668b47fc9ddddf0cfa4b9e8a6f722bc`.
- Added the top-level `Architecture` tab with lazy manifest loading and isolated failure handling.
- Added the checked-in manifest and schema with 36 nodes, 59 edges, 5 boundaries, and 13 views.
- Added deterministic manifest validation and direct validator rejection tests.
- Verified the live GitHub Pages deployment serves the Architecture tab, manifest, updated script, and updated styles.
- Reworked the Architecture renderer so Overview uses the exact 8-stage top-to-bottom order, focused views use deterministic vertical waterfalls, parallel nodes stay in contained responsive grids, and the selected-node panel sits below the canvas.
- Removed the active horizontal graph path by using no absolute node placement, no SVG bus routing, and no horizontal scrolling in the deployed Architecture renderer.
- Verified geometry checks across all 13 Architecture views and live viewport checks at `1440x900`, `1920x1080`, `1024x768`, and `390x844`.

## Remaining Work

- Await review of the deployed vertical-waterfall Architecture Mirror.
- Preserve the six explicitly unverified architecture areas until stronger repository evidence exists.
- Do not start a new milestone until a documented follow-up task is approved.

## Current Files Being Modified

- `docs/CURRENT_STATE.md`
- `docs/CURRENT_TASK.md`
- `docs/ACTIVE_MILESTONE.md`
- `docs/SESSION_NOTES.md`
- `docs/CHANGELOG.md`

## Blockers

No repository-side blocker.

## Next Immediate Action

Review the deployed Architecture Mirror and decide the next milestone.

## Last Updated

2026-07-21 17:55:00 Europe/London
