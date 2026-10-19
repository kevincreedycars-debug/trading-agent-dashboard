2026-10-19, factor-chain cycle (interactive coordinator, USD session lane), prepended without changing the objective below: the Research Library is now factor-scoped. The catalogue carries twenty-five factor chains (three stages each) plus the gated `usd-final-asset-analysis` chain (three stages: final analysis, final red-team, final adjudication), with the six topics demoted to grouping labels; the generated prompts live under `docs/research/factors/usd/<factor-slug>/` and `docs/research/final/usd/final-asset-analysis/` (seventy-eight prompts total). The panel renders one chain row per factor with its own stage count and stage cards, so sibling factors are isolated, and the final chain is locked at `0/25` with no stage rendered until every factor chain is complete against current versions. The final red-team receives the analysis and its supporting adjudications; the final adjudication receives both prior final documents and writes the complete candidate Layer 1 logic for isolated backtesting. Each final stage records its `input_documents` package, and a changed input flags every downstream final stage stale. The VIX chain still reads research delivered, red-team awaiting the file, adjudication not started. Guards: library unit 28 of 28, browser 1 of 1, 29 tests and 0 failures; `node --check script.js` and `verify` clean. Nothing was reviewed, accepted or scored and no live call, weight, threshold or status moved. Next: upload the completed VIX red-team file through `usd-factor-live-f1-vix-level` stage 2, or hand it over for registration.


2026-10-15, research-topics cycle (interactive coordinator, USD session lane), prepended without changing the objective below: the Research Library was rebuilt around the owner's three-stage correction and the VIX programme was unblocked on the product side. `data/research-library/catalog.json` now carries six USD topics covering all twenty-five factor entries, each with its factor entries, interactions, companions, published briefs and research questions, plus eighteen generated stage prompts (research, red-team, adjudication) under `docs/research/topics/usd/<slug>/` whose sha256 and byte count the catalogue records, so the page can verify the prompt it copies and `verify` fails on drift. The VIX topic's stage 1 prompt is the dispatched deep-research brief reproduced in full (21,283 characters) rather than the legacy `USD-SESSION-A3` reviewer prompt; stage 2 carries the programme red-team brief in full; stage 3 is the new adjudication assignment with a handoff to central USD synthesis. The stage model is enforced rather than described: `topic_id`, `stage`, `parent_document_id` and `parent_version` are validated by the library and by the store, a stage reads `delivered`, `awaiting_upload`, `not_started` or `reassessment_required`, and `ready_for_synthesis` needs all three stages delivered on the current versions. The panel opens on the topic strip and the three stage cards, takes one Markdown file per stage with the metadata assembled for the reader, provides hash-checked Copy prompt and service-backed View, and moves the factor register, the legacy `USD-SESSION-A1`-to-`A5` tasks and the whole-engine documents into a labelled secondary section. Guards: library unit 26 of 26, library browser 1 of 1 in about 40s (rewritten, not patched, for the new workflow: correct prompt per stage, one upload per stage with the judged version, full-content View and Download, persistence across refresh and service restart, a revision flagging its review, the published page refusing what it cannot do, the committed registry unchanged), `research_handoff` 19 of 19, `registry --check`, `catalog --check`, `topics --check` and `verify` ok. The cycle was committed as the scoped checkpoint `56afd67b` (the previous cycle's registration and docs) before this work, and the local service runs on loopback at `http://127.0.0.1:8791` with the page at `/index.html`. Not claimed: no factor status, weight, threshold, sign or live call changed; nothing was reviewed, accepted or scored; the engine is not validated and no performance figure exists. Open: the completed VIX red-team file still has to be uploaded through the VIX topic's stage 2 card (or handed over for registration), and the parallel workstreams recorded in `docs/coordination/VSC_WORKSTREAMS.md` still need their sessions opened.
2026-10-15, report-registration cycle (interactive coordinator, USD session lane), prepended without changing the objective below: the returned VIX-to-USD deep-research report was registered as research evidence in the committed Research Library registry, under the factor it is about and with the audit task named only where a task may legitimately be named.  The new entry is `usd-baseline-audit-01-vix-usd-report` - asset `USD`, factor `live.f1-vix-level`, type report, storage `library_object`, origin `external_upload`, model `Astra deep research`, registered 2026-10-15, version 1, 84,056 bytes, sha256 `e4151937411eb1e9235c21e4942327b2d24486e405887d70a90a8f5367eb381d`, bytes outside Git under `.local/research-library/objects/` and re-hashed equal to the source on read - and `data/research-library/documents.json` is the only committed file the upload wrote. `USD-BASELINE-AUDIT-01` is recorded in the document note and in the version note rather than in `task_id`, because it is a handoff brief id, no library catalogue task carries it, and the validator refuses a task id that does not exist; that is also why the frozen pilot package and its two hand-written records were left untouched and no dispatched hash had to be re-issued. The row reads research delivered, review pending: the factor's statuses are unchanged (research `ready`, review `pending`, backtest `not_tested`), the aggregates still read 22 ready / 3 blocked, 25 review pending and 25 backtest not tested, and this registration was not a review, an acceptance or a score. The library README gained a `Registered returns` section, the worked example of the publish boundary - metadata row visible, bytes private, View and Download through the local service only. Guards after the write: registry and catalog `--check` ok, `verify` ok with zero factors covered by no task, handoff `check` 42 files current, `tests/research_library.test.js` 18 of 18, browser 1 of 1 in 17.7s (now also asserting the F1 page shows this document's row with the audit id in the note, that delivery is not read as review, that the hash is visible, that there is no View link, that the Download is the service-only one and that the three pills still read Ready / Pending / Not tested), handoff 19 of 19, and the full local suite 580 tests with 576 passing, the four failures being the same pre-existing `secret_scanner` cases and nothing new. Next: hand the report to its coordinator with the registration instruction in writing (USD, `live.f1-vix-level`, task `USD-BASELINE-AUDIT-01`, research delivered / review pending), and confirm the panel's upload and download controls in a real browser session against the local service. Full detail in `docs/CHANGELOG.md`, entry of the same date and cycle.



Correction note, 2026-10-15 (brief-correction cycle, interactive coordinator), prepended without changing the objective below: the three stale facts named in the delivered briefs are corrected wherever the shared text is generated - the claim that `NO_CLEAR_BIAS` is unreachable (it is reachable arithmetic: F2 + F3 + F4 + F6 + F8 = 50 against F1 + F5 + F7 + F9 + F10 = 50), the workflow described as v154 when v155 is the executing version (published 2026-10-12T19:52:13.451Z by the supervised live apply of the null-versus-unavailable guard, measured against the v154 baseline export taken 2026-10-11), and a missing-quote policy that was specified and called undecided in the same breath (it is now one proposed policy: a missing start or endpoint print is a data exclusion that leaves the scored sample and is counted as coverage, with data exclusions kept apart from model abstentions). The briefs are regenerated - 36 files under `docs/research/handoff/usd/v1/`, with the manifest, the catalogue and the registry refreshed - and the first pilot is packaged as `pilot/usd-vix-pilot-v1.zip` holding the VIX brief, the output template and the full `usd-session-research-card-v3` schema, opened by `pilot/VIX_PILOT_START_HERE.md`. Guards: handoff 14 of 14, library 19 of 19, usd-session 33 of 33, browser panel green. No deployment, no dashboard change, no factor status moved (22 ready, 3 blocked), and a returned pilot card is evidence rather than an approval.


Delivery note, 2026-10-15 (USD session brief-delivery cycle, interactive coordinator), prepended without changing the objective below: the deliverable this cycle was factual completeness rather than a description of it, and it exists. Twenty-five self-contained research briefs, one per USD factor, are generated by `scripts/build_research_handoff.js` into `docs/research/handoff/usd/v1/` as 34 files - 25 briefs under `packs/` (10 baseline audits of the deployed factors, 15 newly authored session-research briefs, each with its own context, questions, hypothesis seed, falsification test, data asks, prohibitions, card field list and schema path, all on one session of 05:00 `Europe/London` to 05:00 `Europe/London` on the next local date), `BRIEF_INDEX.json`, `tracker_tasks.json` with all 25 briefs as rows, `START_HERE.md` with the numbered list of all 25 and a link to each pack, and `usd-research-handoff-v1.zip`, a stored archive the builder writes itself and reproduces byte for byte. The same 25 files are registered in the Research Library, so every factor page carries its own brief with Copy prompt and Download and the panel states 25 of 25; copied text and downloaded file are the same bytes the registry hashed, which the browser test checks. Tasks `USD-SESSION-A3`, `A4` and `A5` now cover all 25 factor ids and instruct the reviewers and the synthesis to work the overlaps across the whole set; `verify` reports zero factors covered by no task. Guards: `test:research-handoff` 12 of 12, `tests/research_library.test.js` 18 of 18, `tests/research_library.browser.test.js` 1 of 1. Nothing was approved, scored, uploaded or published as a result, and no weight, rule, sign, threshold or lookback changed.

## Task

Architecture Mirror review and closeout.

## Objective

Confirm the deployed read-only Architecture Mirror is complete, documented, and ready for follow-up review without changing production or research logic.

The completed Architecture Mirror now:

- cover Layer 1, Layer 2, historical replay/backtesters, Factor Edge Lab, Phase 2 Shadow Backtest, Phase 3 validation modules, ADR/L2L research, n8n execution, data sources, artifacts, GitHub publication, and dashboard rendering
- clearly separate production versus research-only boundaries
- show failure and status-reporting paths
- use a top-level `Architecture` tab
- use a checked-in `data/architecture-map.json` manifest as the source of truth
- render the diagrams with a custom HTML/CSS/SVG renderer
- expose one overview map plus expandable module maps
- remain read-only and documentation-only
- avoid changing production logic, research logic, workflow execution, or artifact-generation semantics

## Current Status

Architecture Mirror is deployed and validated at implementation commit `7586016d89c1e06c9f20beed3201034248d1e048`, with cache-busted deployment commit `9407893cc668b47fc9ddddf0cfa4b9e8a6f722bc`.

Current deployed scope:

- 36 nodes
- 59 edges
- 5 boundaries
- 13 views
- 8 grouped Overview stages
- deterministic vertical waterfall focused views
- contained responsive grids for parallel nodes
- centered vertical stage connectors
- below-canvas detail panel
- no absolute placement
- no SVG bus routing
- no horizontal scrolling
- geometry checks across all 13 views and four live viewport sizes

Credential continuity remains complete and documented. The current production baseline is already deployed and validated with:

- explicit Layer 1 `24H` expiry visible on Overview cards
- UK/ET live header clock
- Layer 1 Directional Viability spacing fix
- redundant Overview weighted-verdict prose removed
- UK-time hover/focus tooltips deployed on every Layer 1 `24H` expiry section while keeping the visible ET expiry unchanged

## Completed

- Completed the CLIXML-based local credential continuity system under `%USERPROFILE%\.trading-agent-dashboard\`.
- Verified eight continuity variables present in the encrypted local store.
- Confirmed `OANDA_ACCOUNT_ID` is conditional, currently absent, and not a blocker for ordinary OANDA candle downloads.
- Validated read-only connectivity for `n8n`, Supabase, FRED, OANDA, and Alpha Vantage.
- Confirmed RapidAPI credential loading while leaving external endpoint verification marked inconclusive because the harmless validation endpoint timed out.
- Validated isolated CLIXML backup and restore behavior.
- The visible ET expiry block on each Layer 1 Overview card is deployed.
- The UK/ET live header clock is deployed and validated.
- The Layer 1 Directional Viability spacing fix is deployed and validated.
- The redundant Overview weighted-verdict summary prose is removed.
- The UK-time hover/focus tooltip is deployed on every available Layer 1 `24H` expiry section.
- The tooltip converts the same expiry timestamp to UK time with automatic GMT/BST handling.

## Remaining Explicit Unverified Areas

- whether Dashboard Writer publishes artifacts beyond `data/layer1.json`
- the exact publication responsibility split for `data/layer2.json`
- which non-BTC collectors directly consume economic events
- exact GitHub commit sequencing during an orchestrator run
- complete column-level Supabase lineage
- node-level failure fan-out inside every exported workflow

## Next Immediate Steps

1. Review the deployed Architecture Mirror with the current repository baseline.
2. Decide whether any follow-up Architecture depth is required.
3. Leave the next milestone unset until review approves a documented successor task.

## Current Blocker

No repository-side blocker.

## Target Outcome

The achieved outcome is:

> a read-only Architecture Mirror that explains the production and research platform clearly inside the dashboard

The next planned phase is:

> awaiting review; no new implementation phase is active yet
