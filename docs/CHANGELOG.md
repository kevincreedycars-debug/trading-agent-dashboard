# Changelog
## 2026-10-25 (integration lane) - Every factor asks its own questions: `research-prompt-v3.1.0` on `main`

- `d6cff707` from `workstream/c-research-programme` was ported onto the deployed builder rather than merged or
  cherry-picked whole. Its base is 1,526 commits behind `origin/main`; taking its `lib/research_library.js`,
  `script.js` or prompt files would have reverted the hosted upload path, the `Uploaded` label,
  `original_filename`, the `GBP`-last asset order, the cited-brief prompts, the five evidence kinds and the five
  allowed conclusions.
- What was taken is the content: each of the 25 factor entries owns its four questions in a `FACTOR_PROBES`
  block, a group label keeps only its one or two shared questions, stages 2 and 3 re-ask the factor's own
  questions, a chain whose role is a gate is asked what it changes about the call, and abstention is judged on
  directional accuracy, coverage and skipped sessions against a benchmark of always calling. The builder now
  refuses a chain whose factor has no authored questions, so a chain cannot silently borrow a sibling's.
- The catalogue carries `prompt_template.version` = `research-prompt-v3.1.0` and
  `prompt_source.template_version` on every stage, with the same `prompt_sha256`/`prompt_bytes` discipline as
  before, plus a derived `assets[].catalogue`: USD `dispatchable` (25 entries, 25 chains, 78 prompts, 25
  briefs), the other seven `profile_only` with `remaining` and `open_decisions`. Every generated prompt names the
  version; the page cache-buster is `20261025-research-prompt-v310`.
- Seven chains no longer carry another factor's question and `live.f4-real-yield-delta` no longer asks its own
  question back at itself; 78 of 78 prompts carry the version and every stage carries its chain's questions.
  `docs/research-library/PROMPT_TEMPLATE_INTEGRATION.md` records the defect table, the port decision, the review
  check, the per-stage VIX hashes and the automation handoff.
- The registry moved once, for documentation: `docs/research-library/README.md` was corrected (it still said the
  VIX brief was reproduced in full and gave an old asset order), so `research-library-readme` is version 12,
  21,972 bytes, sha256 `85982bb4d63dbafce7545d01fed0647f636ee14ea51dac850ed5f45e5ee6d8f0`, with version 11 kept
  immutable. No report, review or adjudication was edited, re-registered or re-versioned; the VIX report stays
  version 1, 84,056 bytes, sha256 `e4151937…`; no factor status, weight, threshold or live call moved; the final
  chain stays `usd-final-asset-analysis`, `locked` at `0/25`; the seven non-USD assets stay `profile_only`.
- Guards: `chains --check`, `topics --check`, `catalog --check` and `verify` clean; library unit 35/35 with three
  new guards (per-factor questions through all three stages, the gate and abstention treatment, the catalogue
  states); library unit plus export 41/41; library plus pipeline plus handoff 66/66; `test:unit` 609 with 0
  failures. The library browser test fails waiting for a download event, and fails identically on untouched
  `origin/main` `9c618d22` in a fresh worktree, so it is pre-existing and environmental rather than caused here.
- Nothing was published to a model, dispatched or uploaded, and no allowance was spent.

## 2026-10-25 (integration lane) - Astra route integrated, the supervisor reads chains, probes specified

### Integrated from `workstream/b-dashboard-interface`

- `lib/research_pipeline.js` (the unattended supervisor), `scripts/research-pipeline.js`, its 15 guards and
  `docs/research/pipeline/EXECUTION_ROUTE.md` are on `main` as `eff87b6b` and `a122544e`, cherry-picked rather
  than merged so the branch's unrelated 923-file divergence stays out.
- The supervisor was written against a catalogue whose topics carried the three stages. `main` keeps the stages
  on the factor chain, so against `data/research-library/catalog.json` the first version read zero stages and
  nothing was runnable. `3ad0700a` resolves a topic to its chains, requires `--chain` when a topic groups more
  than one chain, and derives the job key and document id from the chain. Read-only check against the committed
  catalogue: 75 stages, 25 runnable, 1 delivered (the VIX research report), no dispatch, no allowance spent.

### Specified, not changed

- `docs/research/programme/PROBE_SPEC_20261025.md`: the seven chains whose probes do not fit the factor, the
  exact probes to add and the group probes to keep, the abstention rule (coverage, the withheld-call score and a
  coverage-matched comparison on comparable sessions, reported together), and the guards the prompt lane adds.
  DeepSeek's prompt lane owns the generator; this lane reviews and accepts. No prompt changed.
- `docs/research/programme/LANES_20261025.md`: owner, branch, commit, integration state and next action per
  workstream, including that the internal research and automation lanes are additional sessions rather than the
  owner's, and that the automation lane's "no supported route" conclusion is superseded.

### Verified

- The automation lane's carrier evidence is corroborated here from the artifacts on this PC: 6,179-byte return,
  sha256 `0621219e…`, byte-identical stored object, registry row `gpt-6-astra` / `library_object`, one dispatch in
  `usage.json`, one `turn.completed` with 269,333 input and 1,632 output tokens, `auth_mode: chatgpt`.
- `node --test tests/research_pipeline.test.js` 15/15. Full `npm test` 686 with 683 passing: the library browser
  failure is the fresh-worktree one (no private objects), and the two `refresh_progress` browser tests pass 26/26
  alone on both `f54b34f7` and this commit, so they are load-sensitive rather than new.


## 2026-10-25 (interactive coordinator, research programme, round two) - briefs de-duplicated, positive conclusion allowed, asset order aligned

### Changed

- `scripts/build_research_library.js`: the VIX stage-1 prompt no longer pastes the dispatched brief and the
  stage-2 prompt no longer pastes the step-2 brief. Both are cited by path and sha256, and a sentence states that
  their four-step and card language belongs to a workflow the three-stage chain does not use. Two requirements
  only the brief carried - primary sources with disagreement handling, cross-asset carriers with calendar
  conditioning - are kept as explicit bullets. Stage 1 falls from 25,290 to 16,156 characters, stage 2 from
  19,048 to 13,473.
- A fifth permitted conclusion, **a potentially useful input or interaction**, marked unvalidated, in the
  generator and in `docs/research/programme/SHARED_CONTRACT.md` section 4: a supported directional finding stays
  inside the contract.
- The asset strip order is the owner's expansion order, `USD, EUR, GOLD, SILVER, NQ, BTC, WTI, GBP`; GBP moved to
  the end and nothing else about any asset changed.
- The 78 prompts and `data/research-library/catalog.json` regenerated together with `catalog --write`;
  cache-buster `20261025-research-programme-v3` in `script.js` and `index.html`. The strip order lives in `ASSET_ORDER` and in the catalogue's `asset_order` field, both changed, with a test that fails if either drifts.
- `docs/research/programme/PROMPT_AUDIT_20261025.md` records the five defects the round found and what replaced
  them; `CURRENT_TASK.md`, `ACTIVE_MILESTONE.md` and `SESSION_NOTES.md` carry the handoff.

### Guards

- `tests/research_library.test.js`: the 51 deciding prompts must name all five conclusions including the
  unvalidated positive one, and no prompt may contain any of nine superseded phrases (step 1 of four, a research
  card is step 3, the same four steps apply, the per-card hypothesis limit, "none may be proposed", the brief
  markers, the legacy upload instruction).
- `tests/research_library.browser.test.js`: the copied stage-1 prompt must cite the brief by path, must not paste
  its opening sentence, must carry both blocks, and must be between 12,000 and 20,000 characters.

### Unchanged, and checked

- The VIX report is still `usd-baseline-audit-01-vix-usd-report` v1, 84,056 bytes, sha256 `e4151937â€¦`, with
  stage 2's parent link and (empty) stage 3 unchanged; the final chain is still locked at 0/25.
- Both source briefs are byte-identical: a sent brief is a record, and the fix was to stop copying it, not to
  rewrite it.
- No factor status, weight, threshold, sign, live call, workflow or data file moved.


## 2026-10-25 (interactive coordinator, research programme) - shared contract, two owned lanes, cleaned prompt set

### Added

- `docs/research/programme/README.md`, `SHARED_CONTRACT.md`, `INTERFACES.md` and `PROMPT_AUDIT_20261025.md`: the
  owner's session and instrument rules, the five evidence kinds and the four permitted conclusions, the states a
  document passes through, the preserve-then-supplement rule, the asset gate, asset expansion, change control, the
  lane map and the hand-off objects between the lanes.
- Two authored blocks in `scripts/build_research_library.js` - the five evidence kinds, emitted into all six stage
  types, and the permitted conclusions, emitted into research, adjudication and final analysis - plus one extra
  attack in each red-team stage.
- A guard in `tests/research_library.test.js`: every one of the 78 prompts must carry the five kinds and each of the
  51 deciding prompts must name all four permitted conclusions.

### Changed

- The 78 generated prompts and `data/research-library/catalog.json` were regenerated together with
  `node scripts/build_research_library.js catalog --write`, so each prompt and its recorded hash still agree.
- The catalogue cache-buster moved to `20261025-research-programme-v1` and `index.html` loads `script.js` with the
  same version, so a returning reader does not keep a cached catalogue whose prompt hashes no longer match the
  served prompts.

### Unchanged, and checked

- The stored VIX report, its version, hash and parent links; the factor statuses (22 research ready, 3 blocked,
  review pending and backtest not tested everywhere); the chain states (VIX research delivered, red team awaiting a
  file, adjudication not started) and the final chain still locked at 0/25. Checks: `chains --check` clean,
  `verify` clean, library unit 30/30, `test:research-library` 37/37 including the browser scenario.

## 2026-10-24 (interactive coordinator, hosted final chain) - the asset-level final chain stores in the private store

### Changed

- `script.js` hands the asset-level final chain to the private store like any factor chain: the `isFinalChain && !client` guard is gone from the stage upload, `researchLibraryStageUploadForm` no longer holds the final chain back for the local service, and the reader is told to sign in rather than pointed at a loopback address. The local service remains an optional route only when no member is signed in.
- The final chain's return is uploaded with its whole factor input package: `inputPackage` carries every input document's id, version, sha256, role and role stage, plus the time the package was read, so a reviewer can check a final stage against the evidence it actually judged.
- `lib/research_upload_client.js` stores that package in the `notes` column behind `research-input-package:v1` because the hosted table has no column for it, and `rowsToDocuments` restores it per version, so a later version that recorded no package does not inherit an earlier one. `listAll()` reads the whole store in one request (limit 1000).
- `lib/research_upload_adapter.js` gains `refreshAll()`, which merges every stored chain in one read and returns `-1` when the store could not be read, so the page never claims a library it has not seen.
- `script.js` reads the whole store once per signed-in session (`researchLibraryLoadHostedLibrary`, wired into the render), so the factor chains and the final-chain gate see what is stored without each chain being opened first.
- Cache-busters: `research_upload_client.js` and `research_upload_adapter.js` at `20261024-research-upload-v4`, `script.js` at `20261024-research-upload-hosted-v9`.

### Verified

- Guards: upload client 12/12, adapter 12/12 (including the package round trip, a later version with no package, one whole-store read, and a source guard that the final chain is no longer held back for the local service), `test:research-library` 36/36 including the browser test, `research-library:check` unchanged with the final chain `locked` at `0/25`.
- Full `npm test` 612/614 with the two live-trading browser failures (the read-only section's order-like control and the closed-window refusal case) reproduced with this work stashed, so they are not from this change. The library registry gained one version: `research-library-readme` moved to version 2 because the README text changed, and `research-library:check` is clean again after `registry --write`.
- Not verified: no hosted final-chain run has happened, because the gate is closed at `0/25` factor chains and no factor status is to be moved to open it; the page check needs a live account (`CHECK_EMAIL`/`CHECK_PASSWORD` or `--provision`) and the published page.

## 2026-10-24 (interactive coordinator, storage and phone handoff) - where documents live, remembered sign-in, and a repeatable page check

### Added

- `scripts/research_library_page_check.js` (`npm run research-library:page-check`, `:mobile`) drives the published page at desktop width or as an iPhone 13 and asserts each reader-visible step: sign-in, one file input and no model field, the pill going Uploaded, the session and record surviving a reload, stage 2 naming and returning its parent byte-for-byte, View, Download, no loopback request, no page error. It can provision its own disposable member (`--provision`) and always removes the rows, objects and account it created.
- `scripts/research_library_export.js` (`npm run research-library:export`) writes every hosted document and a `manifest.json` with the recorded metadata and a per-file sha256 re-check into `.local/research-library-export/`, which Git ignores. It refuses a row whose topic, stage, version or hash could write outside the export folder.
- `tests/research_library_export.test.js` pins the export path rules, the refusal cases and when a copy counts as verified (6 tests).
- `docs/research-library/PAGE_CHECK_RUNBOOK.md` answers where the bytes are, what signs in, what still needs a PC, how to keep local copies, whether a GitHub backup is worth adding, the VIX id-versus-hash question and how to re-run the check, including a five-step real-phone check.

### Changed

- `docs/research-library/UPLOAD_BACKEND.md` records the export route, the GitHub-metadata boundary, that the email provider is the only sign-in, and the committed page check instead of the ad-hoc `tmp` script.
- `docs/research-library/README.md` no longer describes the hosted store as a future step: it states the private bucket and table as the live path for factor chains, and keeps the loopback service as the final chain's route.
- `package.json` gains `research-library:export`, `research-library:page-check` and `research-library:page-check:mobile`, and `test:research-library` now includes the export test.

### Verified

- Phone-sized emulation with the local service stopped: sign-in, one file input, no model field, upload, Uploaded, reload, same record, parent retrieval byte-for-byte, View, Download, no loopback host, no page error; desktop width reported the same. Both runs removed their own row, object and disposable member.
- The store holds one member (the owner), one document (`d7b8eb40-…`, `VIX_USD_Research_Report.md`, 84,056 bytes, sha256 `e4151937…`) and one object; the exported copy re-hashes to the same value.
- Guards: export 6/6, library 29/29, upload client 9/9, adapter 9/9, library browser 1/1. No factor status, weight, threshold, sign, live call, workflow, feed or committed hash moved.



## 2026-10-24 (interactive coordinator, live upload repair) - one file is the whole upload, the stage reads Uploaded, and the published page keeps it

### Fixed

- The published Research Library upload no longer asks for a model or session label before it will take a file. The field is removed from the form and from the record; the page writes the file name, SHA-256, bytes, upload time, asset, factor, chain, stage, document type, version and parent linkage itself.
- A session that had silently expired no longer reads as a broken upload: `lib/research_upload_client.js` swaps the stored refresh token for a fresh access token before a request and asks for the password again only when that token is refused, then explains the state in the account block.
- A 409 from the bucket is treated as the bytes already being stored, so a retry finishes the registration instead of failing on a file that is already there.
- The account block no longer offers an email-link sign-in to an owner address with no inbox; it signs in with the email and password and remembers only the address, in that browser.
- Signing in with a local library service absent no longer points the reader at a loopback address: the panel says the local service is optional and that the private store takes the file.

### Changed

- A stored stage reads **Uploaded** instead of "Delivered", and shows the upload time beside the file name, hash and version.
- Factor-stage cards expose `data-rl-view`: View opens the stored bytes in a new tab from a short-lived private link after a fingerprint re-check, and Download saves the same bytes under the uploaded file name.
- Cache-busters: `research_library.js?v=20261024-research-library-v5`, `research_upload_client.js` and `research_upload_adapter.js?v=20261024-research-upload-v3`, `script.js?v=20261024-research-upload-hosted-v8`.
- `docs/research-library/UPLOAD_BACKEND.md` records the one-file upload, the Uploaded terminology, the refresh behaviour and a new section on checking the published page.

### Added

- `docs/research-library/test-uploads/TEST-RESEARCH-LIBRARY-UPLOAD-20261024.md`: the registered scripted fixture the page check uploads, so the checked file is a catalogued document rather than a stray local file. It is not research evidence and it approves nothing.

### Guards

- Library unit 29/29, upload client 9/9, adapter 9/9, library browser 1/1 (now asserting three View controls, adjudication disabled and research enabled), full `npm test` 600/602 with the two live-trading browser failures unchanged on a pristine `origin/main` checkout.
- Deployed on `main` as `32489f9b` on top of the live-feed snapshot `470eb344`. Scripted read of the published page: sign-in, one file chosen into `usd-factor-live-f8-fed-bias` stage 1, pill flipped to Uploaded in about 1.3 seconds, the same record after a reload, View opened the bytes, Download saved 286 identical bytes, no model field, no loopback address. The check's rows, objects and disposable account were removed afterwards, and no factor status, weight, threshold, sign, live call, workflow or feed moved.

## 2026-10-19 (interactive coordinator, factor-chain cycle) - the Research Library becomes twenty-five factor chains with a gated three-stage final chain, and hosted uploads are repaired

### Added

- `data/research-library/catalog.json`: twenty-five `factor_chains`, each with a `chain_id`, `factor_id`, `topic_id`, `slug` and three stages (research, red team, adjudication). The six topics remain grouping labels; they own no stage and no document.
- `final_chain` `usd-final-asset-analysis` with `final_analysis`, `final_red_team` and `final_adjudication`, gated by the registry. On the committed registry it reads `0/25` factor chains complete, `0/3` final stages and `state=locked`, so no final stage is rendered until every factor chain is complete against current parent versions.
- Seventy-eight generated prompts: seventy-five under `docs/research/factors/usd/<factor-slug>/` and three under `docs/research/final/usd/final-asset-analysis/`. `chains --check` (with `topics --check` as an alias) and `verify` fail on drift.
- Hosted-upload coverage for final stages: a row is owned by its chain id rather than its display topic, the final stage name survives the hosted table's numeric `stage` and `kind` columns, and `model` plus `note` round-trip with the document.

### Changed

- The Research Library panel is now a single 25-row factor table. Each row opens in place on click or Enter/Space to its three stage controls (Copy prompt, prompt download, inputs download, result download and one Markdown upload), and the stage markup carries the chain, stage, exact input document/version/hash and registered result document/version/hash. A row is green and exposes `data-rl-ready-for-synthesis="true"` only when all three stages are delivered against current parents; the gated final chain and whole-engine evidence stay below the table. The legacy topic chips, chain cards, progress cards, filter row, factor detail, task section and upload form are removed from the view, while their records remain in `catalog.tasks`. Cache-busters are `20261019-research-library-factor-table-v6`.
- The registry and store record `chain_id`/`factor_id`, refuse a stage that breaks parent linkage, and flag a stage stale when its parent version or any final input-package entry changes. Each final stage records the exact `input_documents` it judged.
- The shared navigation carries Research Library under Evidence and the existing Live Trade Logic tab under System: 13 pages, 19 rail entries and 3 outbound entries, with `--check` reporting zero changes. The Live Trade Logic entry is navigation copy for an existing read-only tab and changes no trading code or call.
- Browser fixtures now use the current labels, provenance wording and clock, and the hosted adapter tests assert chain ownership and final-stage round-trip.

### Verified

- Full local suite `npm test`: 596 of 596 pass, 0 fail. `node --check script.js` is clean; the Live Trade Logic browser guard is 5 of 5; `node scripts/build_research_library.js verify` reports catalog, registry, repo hashes, chains and chain prompts ok; nav `--check` reports 13 pages, 19 rail entries, 3 outbound, 0 changes.
- VIX evidence is unchanged: `usd-baseline-audit-01-vix-usd-report` is still version 1 at 84,056 bytes with sha256 `e4151937411eb1e9235c21e4942327b2d24486e405887d70a90a8f5367eb381d`; the stored object re-hashes to the same value; the VIX chain reads research delivered, red team awaiting the file and adjudication not started, while its sibling reads `0/3`.
- The branch merges current `origin/main` (`48ee6a5f`) without conflicts. `data/live-trading.json`, `data/layer1.json` and `data/layer2.json` are byte-identical to `origin/main`; no live script, workflow, export, feed or database file appears in the diff.

### Not claimed

- No factor status, weight, threshold, sign, live call or workflow changed. Nothing was uploaded, reviewed, accepted, scored, merged or deployed, and no trading edge is claimed. The VIX red-team file is still the next manual step, at `usd-factor-live-f1-vix-level` stage 2.

## 2026-10-15 (interactive coordinator, pilot-dispatch cycle) - the dispatched VIX pilot is pinned by version and hash beside the archive, the missing-quote policy stays proposed and the pilot stays bundle-only

### Added

- `docs/research/handoff/usd/v1/pilot/PILOT_DISPATCH_RECORD.md`: the exact package handed to the manual Astra pilot, so the returned card is registered against the bytes that produced it - pilot 1 of package `1.0.0` for factor `live.f1-vix-level` (task `USD-BASELINE-AUDIT-01`), pack version `2.0.0`, context version `usd-session-context-20261014.1`, card schema `usd-session-research-card-v3`, generated 2026-10-15 on `research/usd-session-20261013` at `d07af11166ea1d39e5f4184e85a993e03bcb7137`. The archive `pilot/usd-vix-pilot-v1.zip` is pinned at 46,619 bytes and sha256 `1a4dfbeaa0a98987b074c376aade6a7d64c32a77292ecd788bd3d558b2e8451f`, with its four flat members individually: `f1-vix-level.md` 14,724 / `808dc01ada48798e01561ef31fd19899dffc0eac9fee826bf9dacd067e499842`, `RESEARCH_OUTPUT_TEMPLATE.md` 8,582 / `cbea6e9efd5b9b3baacc34c675b6d6b183e5a0ac41ab24c530e45d1b8aa0bc0a`, `research_card.schema.json` 17,060 / `43b549d0279817b88c76863c7f5ba186d74e902cc6310e36711508cd17094746` and `VIX_PILOT_START_HERE.md` 5,611 / `408962f8fe86553404c5f57675765c9911fc7e6a709fea54ab8809acfe793942`. The brief's registered identity is recorded too (`usd-brief-f1-vix-level` version 2 at `808dc01ada48798e…` / 14,724 bytes, version 1 kept immutable at `25f6207967d3c088…` / 12,974 bytes) with the registration rule that follows: the return uploads against `USD-BASELINE-AUDIT-01` for `live.f1-vix-level`, registers against package `1.0.0` and these hashes, a card written against other bytes registers against the version it actually read, and a later package is versioned rather than substituted.

### Notes

- The record is hand-written precisely so the dispatch stays frozen: it is not generated, not a member of the archive and not a library document, so no dispatched byte moved - `node scripts/build_research_handoff.js check` still reads `36 files under docs/research/handoff/usd/v1: all current` and the archive still hashes to `1a4dfbea…` on disk and over both live routes. `HANDOFF_MANIFEST.json` already carries the same values in its `pilot` block and in the `pilot/usd-vix-pilot-v1.zip` row of `files`, so a later edit makes the manifest disagree with the record instead of silently re-pointing the pilot. The bundle the pilot was cut from is recorded with it: `usd-research-handoff-v1.zip` 596,029 / `22a0bb45…`, `HANDOFF_MANIFEST.json` 11,721 / `b4bc3412…`, `USD_SYSTEM_CONTEXT.md` 30,426 / `37b510e6…`, `START_HERE.md` 9,535 / `2136378f…`.
- Two owner decisions are recorded with the dispatch: the proposed missing-quote policy stays **explicitly proposed** until the methodology reviewer assesses it, and is frozen together with the flat band and the study's own tie policy before any candidate is scored, the VIX card being one input to that assessment rather than the decision; and the pilot package stays a **bundle-only download**, with no per-factor action, no new library document and no interface work.
- Not claimed: nothing was deployed, no workflow, feed, dashboard, dispatcher, database or interface was touched, no factor's status moved (22 ready, 3 blocked, before and after), the pilot has not been run and no result exists for it, and an upload is evidence rather than an approval. Guards unchanged: handoff 14 of 14, library 19 of 19, usd-session 33 of 33.


## 2026-10-15

### Added

- Delivered twenty-five self-contained USD research briefs, one per catalogue factor, under `docs/research/handoff/usd/v1/`: 25 briefs in `packs/` (10 baseline audits of the deployed factors, 15 newly authored session-research briefs), `BRIEF_INDEX.json`, `tracker_tasks.json` with 25 rows, `START_HERE.md` with the numbered list of all twenty-five briefs and a link to each pack, and `usd-research-handoff-v1.zip`, a stored archive the builder writes itself and which verifies byte for byte. `scripts/build_research_handoff.js` refuses to write unless the authored briefs cover the catalogue's non-live factors exactly, and every brief states one session - 05:00 `Europe/London` to 05:00 `Europe/London` on the next local date - so none can carry the withdrawn 17:00 New York window.
- Registered the same twenty-five pack files as repo-backed `brief` documents in the Research Library, so each factor page carries a Brief block with Copy prompt and Download and the panel states a coverage line of 25 of 25; the copied prompt and the downloaded file are the same bytes the registry hashed.
- Packaged the first pilot: `docs/research/handoff/usd/v1/pilot/usd-vix-pilot-v1.zip` holds the VIX brief `f1-vix-level.md`, `RESEARCH_OUTPUT_TEMPLATE.md` and `research_card.schema.json` (`usd-session-research-card-v3`) flat in one archive, with `pilot/VIX_PILOT_START_HERE.md` explaining the package. The brief's section 7 lists the card's field names and only points at the schema, which is what carries the required blocks, their required keys, the closed enums and the minimum lengths, so the pilot is not runnable from the field list alone. `HANDOFF_MANIFEST.json` gained a `pilot` block and `counts.pilot_packages`, `START_HERE.md` links the archive, and the bundle archive carries both new files. The pilot has not been run.
- Added `.gitattributes` with `docs/research/handoff/** -text`: the bundle's `HANDOFF_MANIFEST.json` hashes the brief files and the library registry hashes the same bytes, so a checkout must not renormalise that one folder. Scoped to the folder this commit introduces; nothing that already ships is affected.

### Changed

- Tasks `USD-SESSION-A3`, `A4` and `A5` now cover all twenty-five factor ids instead of the fifteen session cards, and their prompts and the three assignment packages tell both reviewers and the synthesis to work the overlaps across the whole set - inside the deployed half (F2/F3, F3/F4, F4/F6, F1/F9/F10, F7/F8) and between the halves - and to say how many independent comparisons the design actually buys. `node scripts/build_research_library.js verify` reports zero factors covered by no task.
- Guards: `npm run test:research-handoff` 12 of 12, including a completeness check that walks every catalogue factor id to a real pack on disk and an archive check that parses the zip's central directory and rebuilds it byte for byte; `tests/research_library.test.js` 18 of 18, including a 25 of 25 registry coverage check; `tests/research_library.browser.test.js` 1 of 1, opening all twenty-five factor pages and failing if any one lacks a brief, a Copy prompt or a Download, then copying one brief and downloading it and checking both.
- Corrected the shared context every brief carries, at the generator (`scripts/build_research_handoff.js`), in `docs/research/handoff/usd/v1/USD_SYSTEM_CONTEXT.md` and in the library's published implementation excerpt (`scripts/build_research_library.js`, reaching `data/research-library/catalog.json`): (1) the deployed engine's `NO_CLEAR_BIAS` is reachable arithmetic (F2 + F3 + F4 + F6 + F8 = 50 against F1 + F5 + F7 + F9 + F10 = 50) and is no longer described as unreachable; (2) the workflow identity separates the executing version v155 (published 2026-10-12T19:52:13.451Z by the supervised live apply of the null-versus-unavailable guard; version id `0fb553c2-b1f1-4afa-bfdc-1166b60a6a79`, `versionCounter` 155, `nodes_sha256` `b2583215…`) from the audited baseline `exports/usd_layer1_agent.json`, measured against v154 on 2026-10-11, whose `Calculate USD Conviction` jsCode `580f0aa3…` is the same bytes v155 executes, and F1's missing-input note now carries both dates (repository repair 2026-10-11, live apply 2026-10-12); (3) the missing-quote policy is one proposed policy instead of a specified drop plus an "undecided" note - a session whose start or endpoint print is missing is a data exclusion that leaves the scored sample and is counted as coverage, never filled, forward-carried or interpolated - and data exclusions are kept apart from model abstentions, which stay in the sample and are scored as no-calls. The flat band and the study's own tie policy remain unfrozen, and all three freeze together before any candidate is scored. `docs/research/handoff/usd/v1/` regenerates to 36 files (up from 34) and `data/research-library/documents.json` registers an immutable version 2 beside v1 for each of the 25 briefs.
- Guards on the corrected bytes: `npm run test:research-handoff` 14 of 14, with two new cases - one walking the pilot archive's members and comparing each with the bundle's own file byte for byte, one asserting on all twenty-five briefs that the tie reads `reachable arithmetic` and never "unreachable", that the missing-quote text is the one proposed exclusion policy and no longer "still undecided", that `data exclusion` and `model abstention` are both named, and that the executing version and the audited baseline are both stated. `tests/research_library.test.js` 19 of 19: the branch's registry entry for `docs/research-library/README.md` was behind the version this line had already registered when the previous publish rewrote that file, and aligning it is what the two earlier failures were, not a new guard being loosened. `npm run test:usd-session` 33 of 33 and the browser panel test (1 of 1) pass.
- No research status moved: 25 factors still read 22 ready and 3 blocked, nothing was uploaded, reviewed, accepted, scored or deployed, and the v155 record is quoted from the 2026-10-12 apply rather than re-measured here.

### Verified

- Published the correction to `main` as commit `6eab14a4`: `git hash-object` on the working copies equals `git rev-parse origin/main:<path>` for `packs/f1-vix-level.md` (`3a5a90c7`), `pilot/usd-vix-pilot-v1.zip` (`4052699a`), `pilot/VIX_PILOT_START_HERE.md` (`ee4340b0`), `START_HERE.md` (`a996d4f6`), `HANDOFF_MANIFEST.json` (`714270fc`) and `data/research-library/documents.json` (`22603472`), so the published bytes are the corrected bytes.
- Read back live over HTTPS on both delivery routes, every file answers HTTP 200 with the delivered bytes: the corrected VIX brief 14,724 bytes / sha256 `808dc01ada48798e…`, the pilot archive 46,619 bytes / `1a4dfbeaa0a98987…`, the bundle archive 596,029 bytes / `22a0bb454ec2592c…`, `START_HERE.md` 9,535 bytes / `2136378f61071a18…`, `USD_SYSTEM_CONTEXT.md` 30,426 bytes and `data/research-library/documents.json` 49,476 bytes / `fa23a266ff059799…`.
- The Research Library's brief actions were verified on the live dashboard itself, headless: the correct URL `https://kevincreedycars-debug.github.io/trading-agent-dashboard/` answers HTTP 200 (28,856 bytes) - the 404 recorded in the previous entry does not reproduce today and no Pages setting was touched - the live registry serves 25 briefs, the panel reads `25 of 25`, all twenty-five factor pages offer Copy prompt and Download for their own registered brief, and on the VIX factor the copied text is 14,724 characters and the downloaded file's sha256 equals both the live registry's hash and the live file, so the two actions deliver one artefact.
- `node scripts/build_research_handoff.js check` reads `36 files under docs/research/handoff/usd/v1: all current, one brief per factor for 25 factors, and the briefs agree with data/research-library/catalog.json`, and `node scripts/build_research_library.js verify` reads catalogue ok, registry ok, repo hashes ok with 41 repo-backed documents (16 artefacts plus 25 briefs).
- Published the delivery to `main` as commit `f7fc4690`, rebased onto the live-feed snapshot `c3589304`: `git hash-object` on the working copies equals `git rev-parse origin/main:<path>` for `START_HERE.md` (`29417229`), `BRIEF_INDEX.json` (`5f38a3c8`), `usd-research-handoff-v1.zip` (`d900d8b1`), `HANDOFF_MANIFEST.json` (`31de2a44`) and `packs/f1-vix-level.md` (`970beee4`), so the published bytes are the delivered bytes.
- A fresh checkout of `main` reports `checked 34 files under docs/research/handoff/usd/v1: all current, one brief per factor for 25 factors, and the briefs agree with data/research-library/catalog.json`, lands that folder as `w/lf` under the new `.gitattributes` rule instead of renormalising it, and passes `tests/research_handoff.test.js` 12 of 12. In the same checkout `tests/research_library.browser.test.js` is 1 of 1 and `tests/research_library.test.js` is 16 of 18, the two failures being the pre-existing `data/usd-24h-experiment-registry.json` and `data/usd-24h-selection.json` registry hash mismatches that fail identically on untouched `main` (15 of 17), which is why the guard line above reads 18 of 18 on the research branch.
- The download links were fetched over HTTPS during this cycle and returned HTTP 200 with the byte lengths of the published blobs: `START_HERE.md` 8,928, `BRIEF_INDEX.json` 18,138, `usd-research-handoff-v1.zip` 502,477, under `https://raw.githubusercontent.com/kevincreedycars-debug/trading-agent-dashboard/main/docs/research/handoff/usd/v1/`, with every pack at `.../v1/packs/<pack>.md`.
- Reported for the owner, not caused by this delivery: `https://kevincreedycars-debug.github.io/trading-agent-dashboard/` answered HTTP 404 for every path tried on 2026-10-15, `/index.html` and the pre-existing `gold-factor-wip.html` included, so the Pages route is not serving while the raw-content and file-page routes are. Superseded on the same day: the host was re-read during the correction cycle and answers HTTP 200 with `index.html` at 28,856 bytes, without any Pages setting being changed.


## 2026-10-09

### Added

- Published `usd-layer1-logic.html`, the reading copy of `docs/analysis-engine/USD_LAYER1_LOGIC.md` - all 11 sections from its 713 source lines, tables and code blocks included, rendered by `backtester/scripts/build_usd_layer1_logic_page.js` through `backtester/lib/markdown_document.js` - with the plain-text download `docs/analysis-engine/USD_LAYER1_LOGIC.md.txt` (48,307 bytes) and the guard that travels with them, `tests/usd_layer1_logic_page.browser.test.js` (6/6), alongside the renderer's unit tests `backtester/tests/markdown_document.test.js` (6/6). The dossier settles the 85-versus-87 question from the code; a published page is a description of the call, not evidence about it.
- Added an eighth bar entry, `USD Logic Dossier`, and a third outbound rail entry of the same label to both variants in `backtester/partials/shared_nav.html`, so the dossier is one click from every published page; the rail keeps its seventeen `data-tab` entries, because these three outbound entries leave the dashboard set for pages of their own.
- Registered the dossier as the thirteenth page in `backtester/scripts/build_shared_nav.js` and wrote the block into it with `--write`: the new page placed, the other twelve refreshed, and `--check` reading `13 pages, 17 rail entries, 3 outbound, 0 change(s)`.

### Changed

- Taught `backtester/scripts/build_usd_layer1_logic_page.js` to keep the shared navigation block through a rebuild: it reads any `SHARED-NAV:START` .. `SHARED-NAV:END` region from the page it is about to replace, holds it byte for byte and splices it back in on the line after the body tag, so regenerating the dossier cannot take the page back off the navigation; a tree whose page carries no block is written exactly as before, and `--check` still compares whole bytes.
- Gave `backtester/templates/usd-layer1-logic.html` what a page carrying the block has to say for itself in print: the bar and the rail are named with both of their classes and taken off the sheet, and the content margin the rail asked for is given back, so the printed dossier still starts at the left edge.
- Extended `backtester/tests/site_nav_consistency.browser.test.js` with the eighth bar label and its href, the third outbound label pair, the updated `--check` report pin, and a third hop made from inside `gold.html`'s gold-direction frame onto the dossier's own heading; the guard is 5/5.
- Added one footer link on `usd-layer1-call-flow.html`, `usd-layer1-logic.html · the full logic dossier`; its guard already checks that every footer link resolves to a file which ships with the page, and `tests/usd_layer1_call_flow.browser.test.js` is 6/6.
- Added `docs/USD_LOGIC_DOSSIER_PUBLICATION_20261009.md` as the handoff note for this release.
- Published the release and read it back live: `66e0b0b` fast-forwarded `origin/main` from `c441ba4`, so GitHub Pages serves the tree; `usd-layer1-logic.html` returns HTTP 200 with 86,940 bytes and sha256 `a983730e...` byte-identical to the committed blob on both delivery paths, the live `index.html` (28,217 bytes, `8c1655f6...`) carries the new bar and rail entry beside its unchanged seventeen `data-tab` views, `usd-layer1-call-flow.html` (34,345 bytes, `2721fdec...`) and the plain-text download (48,307 bytes, `f2b2fd24...`) return their own bytes, and a headless reader on the live dashboard makes the bar hop, the rail hop and the call map's footer hop onto the dossier's own heading with 11 chapters, 15 tables and no script error.


## 2026-10-08

### Added

- Added `usd-layer1-call-flow.html`, the printable one-page map of how the USD Layer 1 call is made - eight workflow steps, the ten weighted factors with their fifty per-horizon weights, the deterministic score behind the worked 2024-01-09 call, and four honesty limits - together with the five-test guard that travels with it (`tests/usd_layer1_call_flow.browser.test.js`).
- Added `docs/USD_CALL_FLOW_PUBLICATION_20261008.md` as the handoff note for this release.

### Changed

- Added a seventh bar entry, `USD Call Map`, and a second outbound rail entry of the same label to both variants in `backtester/partials/shared_nav.html`, so the USD sheet is one click from the bar and from the rail on all twelve published pages; the rail keeps its seventeen `data-tab` entries, because the rail drives dashboard views and these two entries leave the dashboard set.
- Registered the sheet as the twelfth page in `backtester/scripts/build_shared_nav.js` and wrote the block into it with `--write`: the new page placed, the other eleven refreshed, `--check` reading `12 pages, 17 rail entries, 2 outbound, 0 change(s)`.
- Left the USD sheet's own print block to take the bar and the rail off the sheet and to return `main` to the sheet's left edge, so what a reader prints is still the map alone on one A4 landscape page; its guard holds that alongside the sheet's one-page fit, which is unchanged.
- Extended `backtester/tests/site_nav_consistency.browser.test.js` with the seventh bar label, its href and `target`, the two outbound label pairs, the updated `--check` report pin, a USD hop from inside `gold.html`'s gold-direction frame, and whole-label filters in the two places that read `Call Map` - which `USD Call Map` now contains as a substring; the guard is 5/5.
- Extended `tests/usd_layer1_call_flow.browser.test.js` with two tests - the hop from the bar and from the rail into the sheet, and the block on screen with the fixed rail beside the map and the bar and rail `display:none` in print - so the sheet has the same navigation guard the call map has; the guard is 5/5.
- Published the release and read it back live: `usd-layer1-call-flow.html` returns HTTP 200 with 29,932 bytes and sha256 `7478e426...`, byte-identical to the committed blob, and the live `index.html` (27,380 bytes, `b5e70387...`) carries both new entries; a headless reader on the live dashboard makes the bar hop and the rail hop into the sheet.
- Re-ran the neighbouring guards on the same tree with no npm runner - the call map 5/5, live-trading dashboard 2/2, levels visibility 2/2, readback 2/2, rule panel 2/2, refresh progress 26/26, backtesting development release 1/1, gold view tidy 7/7, architecture-map validation 7/7, dashboard writer selection 8/8 - all green; `tests/live_trading_chart_pan.browser.test.js` and `tests/live_trading_chart_zoom.browser.test.js` fail identically on this change and on production `0539f1d` (`expected: 120, actual: 576`), so they are pre-existing and untouched here.

- Given the white printable version the call map has carried since 2026-10-04: `usd-layer1-call-flow.html` now has a `Paper sheet · print preview` switcher (`#sheetToggle`, `aria-pressed`, hidden until its own script runs) that writes `data-theme="paper"` on `<html>` and swaps the dark palette for the same ink-on-paper palette the printed sheet uses, remembers the choice under the page's own `usd-call-map-sheet` key, forces the paper view for the length of a print job with `beforeprint` / `afterprint`, and is `display:none` on the sheet - so a reader who never touches the switcher still prints ink on white rather than the dark palette's pale blue step numbers, mint and amber pills and grey notes on white paper.
- Held the printed sheet to the paper palette itself: the print block now asks for `color-scheme:light` and re-points `--text`, `--muted`, `--dim`, `--amber`, `--blue`, `--teal`, `--good` and `--bad` at the call map's own paper inks, so the two sheets read alike, and only its two card washes and its two pill borders still needed overriding.
- Extended `tests/usd_layer1_call_flow.browser.test.js` with the white-printable-version guard: the switcher and its two states, every colour the reader reads words in above 4.5:1 on the paper palette with the heading above 7:1, no card outgrowing its box at 1440px or 390px, and the printed sheet read from the dark view landing on `rgb(15, 23, 32)` ink over `rgb(255, 255, 255)` paper with the switcher gone and every printed line above 4.5:1 against whatever it sits on - so the sheet's guard is 6/6.

- Published the white printable version and read it back live: `e2df9f6` on `origin/main` fast-forwarded over `0c9ccd9`, `usd-layer1-call-flow.html` returns HTTP 200 with 34,068 bytes and sha256 `97c9233f...` byte-identical to the committed blob on both delivery paths, the live `index.html` and the call map return their own unchanged bytes, both navigation hops still land on the sheet, and the live switcher turns the live page white (`rgb(255, 255, 255)` under `rgb(15, 23, 32)` ink) and back to the dark sheet with no script error.

## 2026-10-04

### Added

- Added the rail's first outbound entry, `Layer 1 Calls`, to both rail variants in `backtester/partials/shared_nav.html` - an anchor with no `data-tab`, directly under `Architecture` in the `System` group, keeping a tab's shape with a blue marker bar and a `&#8599;` arrow - and wrote it into all ten published pages (`index.html` +12, the other nine +10), so the printable call map is one click from the rail as well as from the bar.
- Added `docs/LAYER1_CALL_FLOW_RAIL_ENTRY_20261004.md` as the handoff note for this change.
- Framed the published `what-moves-gold.html` as the gold page's first tab: `gold.html` gained `#tab-whatmoves` / `#panel-whatmoves` (labelled `What moves gold`, `aria-selected="true"`) and the lazy frame `#frame-whatmoves`, the strip's order became the six views, and a reader arriving with no hash or a stale one now lands on that tab rather than on Start here (`#start` still opens Start here); +1,887 bytes.
- Added `docs/GOLD_WHATMOVES_TAB_20261004.md` as the handoff note for this change.
- Added the call map to the shared navigation's own pages: `layer1-call-flow.html` now carries the block itself - the bar, the rail and their CSS - so a reader navigates from it like any other page, and its own print block takes the bar, the rail and the sheet switcher off the printed sheet, leaving the map alone on one page; the block's render is unchanged, so no other page's bytes moved and `--check` reads `11 pages, 17 rail entries, 1 outbound, 0 change(s)`.
- Added a screen paper theme to `layer1-call-flow.html`: a `Paper sheet · print preview` button (`#sheetToggle`, `aria-pressed`, hidden until its own script runs) writes `data-theme="paper"` on `<html>` and swaps the dark palette for the ink-on-paper palette the print block already used, so the white sheet a printer lays down can be read on screen and printed from the view being read; `beforeprint` forces the paper attribute for the length of a print job and `afterprint` puts the reader's own choice back.
- Added `docs/CALL_MAP_NAV_AND_SHEET_20261004.md` as the handoff note for this change.

### Changed

- Taught `backtester/scripts/build_shared_nav.js` the word *outbound*: an `OUTBOUND` regex over the rail parts, `outboundOf` / `withoutOutbound` helpers, an assertion that both rail variants carry the same outbound lines and an assertion that they carry one at all; the summary now reads `10 pages, 17 rail entries, 1 outbound, 0 change(s)`.
- Extended `backtester/tests/site_nav_consistency.browser.test.js` with `RAIL_OUTBOUND_HREFS` / `RAIL_OUTBOUND_LABELS`, the updated `--check` report line, outbound assertions in the static and live-DOM blocks, the entry's file-existence check and a click-through from `index.html` and from inside `gold.html`'s gold-direction frame; the guard is 5/5.
- Re-pointed the fourth test of `tests/layer1_call_flow.browser.test.js` from the hand-written rail the page never published to the shared rail's outbound link - label, `target="_top"`, no `data-tab`, and a click that lands on the map; the guard is 4/4.
- Recorded in `docs/LAYER1_CALL_FLOW_PUBLICATION_20261003.md` that its note about the rail entry being written against a hand-written rail is now superseded by this change.
- Re-cut this change on `ae9a1f0` after another lane published the tenth page, `what-moves-gold.html`, mid-branch: the bar and rail hunks merged as they were, the only conflict was the navigation guard's `--check` report line, `--write` refreshed `what-moves-gold.html`, and the three navigation comments that still said nine pages were brought up to ten.

- Re-pointed the two guards that pin `gold.html`'s strip at its six views and at the view a reader now lands on: `backtester/tests/gold_view_tidy.browser.test.js` (six views and labels, the five framed pages in document order, `what-moves-gold.html`'s three declared lines, the landing view beside `#start`'s own check, and a load check for the frame a reader now lands on; +1,334 bytes, 7/7) and `backtester/tests/site_nav_consistency.browser.test.js` (the strip's six ids, the five framed pages, and the bar's no-hash gold entry waiting on `#tab-whatmoves` rather than on Start here; +141 bytes, 5/5).
- Moved the gold page's default view onto its first tab, What moves gold, and made the strip's fallback for a hash it does not name read `order[0]` rather than the literal `start`; `#start`, `#direction` and the two census aliases keep meaning exactly what they meant, and the page's own head comment states the new landing view so nothing is implicit.
- Re-ran the neighbouring guards on the same tree with no npm runner - live trading dashboard, backtesting development release, architecture-map validation, dashboard writer selection and refresh progress - all green.

- Registered the printable call map as the eleventh page in `backtester/scripts/build_shared_nav.js` (under `<body>`, like the other standalone pages) and brought its comments and the `--check`/`--write` summary up to eleven; the partial's own header comment now records that the map carries the block and that a page meant to print must take the block off its sheet itself.
- Extended `tests/layer1_call_flow.browser.test.js` with a fifth test - the bar, the rail and the switcher on screen, the 232px the fixed rail holds, the paper palette's six colours held to a measured contrast floor (heading above 7:1, the other five above 4.5:1), no card starved in the paper view at 1440px or 390px, and in print the bar, the rail and the switcher gone, `main` at the sheet's own left edge and paper ink from either view - and re-pointed the wide-screen chain assertions at the map's own column, because the rail now takes a fixed 232px off it; the guard is 5/5.
- Re-pointed `backtester/tests/site_nav_consistency.browser.test.js` at eleven served pages - the report pin, the test name and the two comments that still called the map a page carrying no navigation of its own; the guard is 5/5 and now loads the map in its per-page fingerprint and layout pass at six widths.
- Changed the call map's chain from a window-wide breakpoint to a container query on the map's own column (`main{container-type:inline-size}`, 1216px), so the seven cards stack where the rail has taken their room rather than breaking a word, while the print block keeps the run on one line.
- Recorded in `docs/CALL_MAP_LAYER2_20261004.md` that its note about the page carrying no bar and no rail of its own is superseded by this change.
- Re-cut this change on `6f4e91b` after another lane published two live-trading snapshots (`data/live-trading.json` only) mid-branch: no file here overlapped them and the rebase was clean.

## 2026-10-03

### Added

- Added `backtester/partials/shared_nav.html`, the one canonical source for the dashboard's top bar and side rail, with the rail in two named variants and the nav's CSS subset inside `<style id="shared-nav-css">`, so no page needs a new stylesheet link.
- Added `backtester/scripts/build_shared_nav.js` (`--write`, `--check`, `--print`) to render that partial into all nine published pages between the `SHARED-NAV` markers, in each page's own line endings.
- Added `backtester/tests/site_nav_consistency.browser.test.js`, a five-test guard over byte equality with the partial, the bar and rail fingerprint, every link's landing place (including from inside `gold.html`'s frames and from a stale hash), the draft page's one-request budget, and the block's layout cost at six widths.
- Added `docs/SITE_NAV_CONSISTENCY_20261003.md` as the handoff note for this change.
- Added `layer1-call-flow.html`, the printable one-page map of how the eight Layer 1 calls are made, with the four-test guard that holds it (`tests/layer1_call_flow.browser.test.js`) and the incident note its footer cites as a source (`docs/LAYER1_OPENAI_CREDITS_INCIDENT_20261001.md`).
- Added `docs/LAYER1_CALL_FLOW_PUBLICATION_20261003.md` as the handoff note for this release.
- Added `lib/l2l_ladder.js` and `lib/l2l_levels_store.js`, loaded by `index.html` ahead of `script.js`, so the Live Trading section draws the 1h and 4h views, the L2L ladder and the levels marking the user asked for.
- Added `docs/LIVE_TRADING_PORT_20261003.md` as the handoff note for that publish.
- Added `backtester/tests/gold_view_tidy.browser.test.js`, a seven-test guard for the tidied gold page: the five views and their order, the four pages still framed with their own honesty lines, every printed rate carrying its sample count and plain words, the direction-and-two-ranges block on each view written into the page, the landing view's dates and disclaimers, the hash and keyboard behaviour including the old census hashes, and the layout at six widths.
- Added `docs/GOLD_VIEW_TIDY_20261003.md` as the handoff note for the gold view tidy.

### Changed

- Gave `index.html`, `gold.html`, `dashboard-northstar.html`, `standing-dashboard.html`, `backtest-flow.html`, `gold-direction-scorecard.html`, `gold-backtest-outcomes.html`, `gold-backtesting.html` and `gold-factor-wip.html` the same bar - four entries, one `Gold` entry into `gold.html` - and the same seventeen-entry, four-group rail with the `ADM` / `Control Room` head and the `Published dashboard` foot.
- Replaced the hand-written bar and rail on `index.html` and the one-line related-pages headers on the three gold research pages with that block, keeping each page's own content and tabs.
- Added `tabFromHash` / `setupHashTabs` to `script.js` so a rail entry that names a dashboard view (`index.html#<view>`) opens that view on load and on `hashchange`, with an unknown hash falling back to the dashboard's default view.
- Recorded that the three gold hop guards pass only because the checkout on `orchestration/control-plane-20260920` mirrors a six-entry bar (`Gold Backtest`, `Gold Direction`, `Gold Factor (draft)`) that production no longer serves: `origin/main` already carries the published four-entry bar, and re-pointing those three assertions at the published route belongs in the checkout that holds them, per `codex-045` section 4.

- Added a fifth bar entry, `Layer 1 Calls`, to both bar variants in `backtester/partials/shared_nav.html` and wrote it into the nine published pages, so every page reaches the printable Layer 1 call map; the rail is unchanged at seventeen entries, because the rail drives dashboard views by `data-tab` and the map is a page a reader prints.
- Extended `backtester/tests/site_nav_consistency.browser.test.js` to pin the fifth bar label, its href, its `target="_top"` and its landing place, and re-pointed the fourth test of `tests/layer1_call_flow.browser.test.js` at the shared bar rather than at the hand-written entry it was written against.
- Recorded in `docs/LAYER1_CALL_FLOW_PUBLICATION_20261003.md` that the checkout on `workers/analysis-engine-20261003` carries a rail entry of its own against the hand-written rail `a94fb55` replaced, and that a rail entry for a printable page is a change to the navigation contract rather than a port of that work.
- Published the port candidate the `live-trading` worker filed as `20261003-live-trading-live-port-candidate-r1` - eight files, +2,892/-324, cut from `a94fb550` by the already-ruled hunk recipe with no merge commit, and re-cut on this tip by the same recipe once another lane had published `3350a89` - so the Live Trading section carries the M5, 1h and 4h views, the L2L ladder and the levels marking, with `data/l2l-levels.json` and `liveTradingUrl` left exactly as `main` carried them.
- Widened `tests/live_trading_dashboard.browser.test.js` from "the read-only section must carry no form control" to "every control must be one the section binds with its own live data attribute": the ruled marking panel's six fields are allowed, a form, dropdown or free-text area is not, the token field must stay a password field, the panel must say the token is only ever sent to `api.github.com`, and no control may read like an order path. The guard is 1 of 2 on the candidate before the widening and 2 of 2 after it.
- Bumped the `script.js` cache-buster token in `index.html` to `20261003-live-trading-port`, so a returning reader is not served the pre-port `script.js` from cache under the old token; the two new library tags keep the lane's own tokens.
- Tidied `gold.html` into five views - Start here, Direction, Movement - L2L and half L2L, Factor tables (draft) and Archive census - so the direction read, the full-L2L share and the half-L2L share are printed together wherever a rate appears, each with its own sample count and plain-words line, and the two archive censuses moved from the front of the strip to the last view, where they are labelled as being about the archive.
- Wrote the caller's own record, the per-side split and the scorecard's per-year up-day baseline into the gold page's Direction view, and the movement base rates into its Movement view, every figure quoted from what the site or the accepted read already publishes, with the 2026-09-28 figures marked as that measurement and the two honest omissions stated rather than filled in.
- Kept every old address working: the four framed pages are unchanged and still framed, and a link that named one of the two censuses (`gold.html#backtesting`, `gold.html#outcomes`) opens the Archive census view and scrolls to the page it names.
- Re-pointed the navigation guard's gold assertions at the tidied page (+28 / -8) - five views rather than four, the same four frames, the rail's gold entry naming a view that exists, the bar's gold entry landing on the page's first view, and the frame hop opening the Direction view before it reads the frame - and left the shared navigation block untouched (`9 pages, 17 rail entries, 0 change(s)`).
- Published the gold view tidy on the user's word: the branch `gold/view-tidy-20261003` fast-forwarded onto `main` over the live-trading port that preceded it, with the live `gold.html` re-read afterwards and every old gold address still landing.

## 2026-07-21

### Added

- Added the read-only `Architecture` dashboard tab driven by checked-in `data/architecture-map.json`.
- Added `data/architecture-map.schema.json`, `scripts/validate_architecture_map.js`, and `tests/validate_architecture_map.test.js` for schema validation, deterministic validation, and rule-level rejection coverage.

### Changed

- Added Architecture smoke coverage for lazy loading, failure isolation, selection, filtering, and responsive overflow.
- Deployed the Architecture Mirror to GitHub Pages and validated the live manifest, script, and stylesheet assets.
- Preserved the six explicitly uncertain architecture relationships as unverified rather than inferring unsupported production or research dependencies.
- Reworked the Architecture renderer so Overview now uses the exact 8-stage top-to-bottom order, focused views use deterministic vertical waterfalls, parallel nodes stay in contained responsive grids, the detail panel sits below the canvas, and geometry checks cover all 13 views.
- Removed the active horizontal graph path by using no absolute placement, no SVG bus routing, and no horizontal scrolling in the deployed Architecture renderer.
- Verified the live GitHub Pages waterfall deployment across all 13 views at `1440x900`, `1920x1080`, `1024x768`, and `390x844`.

## 2026-07-20

### Added

- Added a CLIXML-based local credential continuity system under `%USERPROFILE%\.trading-agent-dashboard\` with local templates for setting, validating, loading, running with, backing up, and restoring encrypted credentials.
- Added repository-safe bootstrap and validation wrappers for the local credential system in `scripts/bootstrap-local-secrets.ps1` and `scripts/check-required-secrets.ps1`.
- Added `config/credential-manifest.json` and `config/credential-manifest.schema.json` to define the supported credential inventory, scopes, and availability policy.
- Added `docs/CREDENTIAL_CONTINUITY.md` to document the supported local continuity workflow for future Codex sessions.
- Added `backtester/tests/credential_redaction.test.js` for importer URL-redaction behavior.
- Added `backtester/tests/secret_scanner.test.js` and repository-local `.githooks/pre-commit` secret-scanner enforcement.
- Added UK-time hover/focus tooltips to every available Layer 1 `24H` expiry section while preserving the visible ET expiry value on the Overview cards.

### Changed

- Updated `scripts/create-local-secret-home.ps1` so local bootstrap preserves an existing credential home by default and only force-syncs templates when explicitly requested.
- Validated local credential continuity with successful read-only probes for `n8n`, Supabase, FRED, OANDA, and Alpha Vantage, while recording RapidAPI endpoint verification as inconclusive due to timeout.
- Corrected project-memory runtime references so the latest successful workflow evidence now reflects the 2026-07-20 `data/workflow-status.json` artifact.
- Kept the expiry source contract unchanged by continuing to use `forecast_window_end` with `expires_at` as fallback only, then converting that same timestamp to `Europe/London` in the tooltip with automatic GMT/BST handling.
- Extended `playwright-dashboard-smoke.js` to verify the Layer 1 expiry tooltip contract, hover/focus accessibility, ET display preservation, and no-overflow behavior.
- Updated startup and active-state project memory so routine summaries ignore unrelated `.claude/launch.json` local state and the active task now points to the upcoming Architecture Mirror phase.

## 2026-07-07

### Added

- Added `backtester/lib/phase2_shadow_backtest.js` for conservative research-only shadow reweighting, shadow decision gating, and original-vs-shadow comparison helpers.
- Added `backtester/scripts/build_phase2_shadow_backtest.js` to build the checked-in `data/phase-2-shadow-backtest.json` artifact from the existing checker artifacts plus checked-in Factor Edge evidence.
- Added `backtester/tests/phase2_shadow_backtest.test.js` covering increase/reduce decisions, low-sample no-change handling, conservative no-call gating, and summary reconciliation.
- Added a new top-level `Shadow Logic Backtest` dashboard tab that reads only from `data/phase-2-shadow-backtest.json`.

### Changed

- Built and checked in the first `data/phase-2-shadow-backtest.json` artifact for `USD`, `EUR`, `Gold`, `NQ`, and `BTC` at `24H`.
- Kept the Phase 2 shadow path fully downstream-only by reusing stored checker factor signals and stored evaluation inputs instead of touching live Layer 1 logic, live Layer 2 logic, replay source-of-truth files, checker outputs, or existing Factor Edge evidence calculations.
- Extended `playwright-dashboard-smoke.js` so the browser smoke now verifies the `Shadow Logic Backtest` tab and confirms the new research tables keep horizontal overflow contained locally.

## 2026-07-06

### Added

- Added `backtester/lib/factor_edge_lab.js` for research-only factor reliability, alignment, and weight-mismatch helpers driven from checked-in checker artifacts.
- Added `backtester/scripts/build_factor_edge_lab.js` to build the checked-in `data/factor-edge-lab.json` artifact for Layer 1 and Layer 2 factor evidence review.
- Added `backtester/tests/factor_edge_lab.test.js` covering ex-flat directional scoring, alignment splits, and Layer 2 USD-side inversion semantics.
- Added a new top-level `Factor Edge Lab` dashboard tab that reads only from `data/factor-edge-lab.json`.

### Changed

- Built and committed the first Factor Edge Lab artifact in `data/factor-edge-lab.json` with Layer 1 coverage for `USD`, `EUR`, `Gold`, `NQ`, and `BTC`, plus Layer 2 coverage for `EUR/USD`, `XAU/USD`, `NQ/USD`, and `BTC/USD`.
- Kept factor-level ADR/L2L opportunity metrics explicitly unavailable in the artifact and dashboard because no full per-prediction factor-joinable export is staged locally.
- Extended `playwright-dashboard-smoke.js` so the browser smoke now verifies the `Factor Edge Lab` tab and its research-only ADR/L2L unavailable contract.

## 2026-07-05

### Added

- Added `backtester/lib/adr_reach_research.js` for shared daily-ADR + `1H` sequence research helpers.
- Added `backtester/tests/adr_reach_research.test.js` with synthetic `1H` sequence cases covering bullish/bearish order dependence and missing-candle handling.
- Added `backtester/importers/oanda/download_oanda_candles.js` for reproducible OANDA daily + `1H` candle downloads.
- Added `backtester/importers/binance/download_binance_candles.js` for reproducible Binance daily + `1H` candle downloads.

### Changed

- Replaced the old daily OHLC range-availability path with `L2L 1H Sequence Research`.
- Rebuilt `data/adr-reach-research.json` so required move is `50% ADR20` from daily candles while win/miss evaluation is sequence-aware using `1H` candles.
- Added supportable downstream research coverage for `Gold` and `XAU/USD` using OANDA `XAU_USD`, and switched `NQ` research onto OANDA `NAS100_USD`.
- Updated the dashboard wording, summaries, diagnostics tables, and smoke coverage to use the new `L2L 1H Sequence Research` terminology consistently.

## 2026-07-03

### Added

- Added a new `ADR Reach Research` Backtest / Accuracy sub-tab driven by a checked-in downstream artifact in `data/adr-reach-research.json`.
- Added `backtester/scripts/validate_adr_reach_research.js` to audit supportable OHLC coverage, build the ADR reach artifact, and validate ADR20 windowing, no-lookahead behavior, threshold calculation, weekday reconciliation, and checker invariants.
- Added `backtester/importers/eurusd/download_eurusd_daily_ohlc_alpha_vantage.js` to download deterministic repo-local `EUR/USD` daily OHLC coverage from Alpha Vantage `FX_DAILY`.
- Added `backtester/importers/btc/download_btcusd_daily_ohlc_coinbase.js` to download deterministic repo-local `BTC/USD` daily OHLC coverage from Coinbase Exchange candles.

### Changed

- Kept the new ADR module fully downstream of replay, checker, confidence, and Pair Trade Research logic.
- Implemented ADR reach using the existing repo-local `QQQ` OHLC proxy file for `NQ`, with evaluation-day `Open` as the reference price and previous-close fallback logic preserved for future supportable OHLC feeds.
- Expanded ADR reach support onto `EUR`, `BTC`, `EUR/USD`, and `BTC/USD` using the new repo-local OHLC sources, while keeping `Gold`, `XAU/USD`, and `USD` unavailable until supportable true `XAU/USD` and `DXY` OHLC sources exist.
- Tightened ADR validation so non-BTC assets cannot silently pick up weekend OHLC rows and BTC must preserve weekend calendar handling.
- Expanded the local dashboard smoke script so the new ADR Reach Research tab verifies summary tables, confidence tables, day totals, weekday tables, and console-clean rendering.

## 2026-07-02

### Added

- Added a `Weekday Breakdown` Backtest / Accuracy tab that shows day-of-week performance by displayed headline confidence bucket for USD, EUR, Gold, NQ, and BTC without changing the existing matrices or checker views.
- Added `backtester/scripts/validate_weekday_breakdown.js` to reconcile weekday totals and confidence-bucket totals back to each canonical checker artifact, while enforcing weekday coverage rules for BTC vs non-BTC assets.
- Added flat-aware weekday cells that show ex-flat directional win rate plus `W / L / F / T` counts, including `Flat only` handling when a bucket or weekday has no directional rows.
- Added a `Day Totals` row/table above each asset's confidence-bucket weekday table so users can scan weekday performance before drilling into confidence buckets.
- Added a new `Pair Trade Research` Backtest / Accuracy sub-tab for EUR/USD, XAU/USD, NQ/USD, and BTC/USD using same-date target + USD checker rows.
- Added `backtester/scripts/validate_layer2_pairing_analysis.js` to validate pair-trade coverage, accuracy, combined-confidence buckets, day totals, weekday breakdowns, and conflict/no-trade summaries.

### Changed

- Derived the weekday breakdown directly from the existing deterministic checker artifacts so the dashboard uses stored displayed headline confidence and stored evaluation outcomes instead of recalculating confidence or altering replay/checker semantics.
- Expanded the local Playwright dashboard smoke script to cover the new weekday breakdown tab, verify weekday columns by asset, and keep the Backtest / Accuracy panel free of console errors during the smoke path.
- Updated the weekday breakdown so flats are separated from directional wins and losses the same way the main accuracy matrices treat flat outcomes.
- Extended the weekday validator to verify bucket-to-weekday reconciliation, flat-rate calculations, ex-flat win-rate calculations, and the new day-level totals.
- Added pair-trade research coverage, accuracy, confidence-bucket, day-total, weekday, and conflict/no-trade views without changing Layer 1 replay outputs, checker semantics, flat bands, or headline confidence logic.
- Used combined pair confidence as `min(target headline confidence, USD headline confidence)` and treated same-direction or missing-USD setups as non-trade research outcomes rather than live Layer 2 logic.
- Refined the Pair Trade Research UI so the per-pair KPI cards use the same responsive dashboard grid language as the rest of the dashboard and the confidence-bucket table spacing no longer crushes right-hand percentage columns.
- Replaced the original wide Layer 2 top-summary table with a compact comparison layout, then clarified its terminology so `Trade Days %` and `Strong+ Trade Days %` are defined against matched historical days instead of the broader paired-row count.
- Re-ran lightweight syntax checks, the pair-trade validator, and browser smoke at session close to confirm the current research platform remains stable after the Pair Trade Research UI refinements.

## 2026-06-29

### Added

- Added EUR replay core, historical snapshot builder, historical replay runner, parity fixture, parity script, EURUSD importer, EUR evaluation script, EUR checker builder, and EUR checker artifact.
- Added dashboard support for the EUR 24H matrix and EUR checker alongside the existing USD research views.
- Added linked-warehouse test locking so the Node smoke tests no longer race each other against shared Supabase-backed tables.

### Changed

- Reproduced the live EUR 24H deterministic workflow exactly in replay using the current `exports/eur_layer1_agent.json` node semantics rather than the generic markdown weight table where they differ.
- Generated EUR historical replay coverage for `2024-01-02` through `2026-04-30` where warehouse data allows.
- Unblocked EUR outcome evaluation by importing historical EURUSD series and evaluating EUR primarily against direct EUR/USD movement instead of any USD-style DXY benchmark.
- Set the provisional EUR-only 24H flat band to `0.15` for EUR evaluation and checker generation without changing shared USD evaluation defaults.
- Generated a passing EUR checker artifact with result `602 / 0 / 0 / 0`.
- Updated the linked-warehouse tests to validate stable research invariants instead of brittle global row-count assumptions.

## 2026-06-22

### Added

- Added `docs/CORE_RESEARCH_PHILOSOPHY.md` as the authoritative guiding document for research/backtesting principles.
- Added `docs/PHASE3_HISTORICAL_EXPANSION_REPORT.md` to record the first USD historical expansion attempt and its evidence summary.
- Added `docs/PHASE3_HISTORICAL_WEAKNESSES.md` to capture warehouse and evaluator issues discovered during Phase 3 evidence collection.
- Added `docs/HISTORICAL_DATA_INVENTORY.md` as the warehouse-completeness source of truth for USD replay inputs through end-2024.

### Changed

- Updated backtester and project-memory documentation to reference the new core research philosophy and reinforce that measurement comes before optimization.
- Corrected stale hosting references where documentation still conflicted with the current GitHub Pages deployment model.
- Corrected the historical evaluator so missing or zero close prices are now treated as `NOT_EVALUABLE` instead of false `-100%` benchmark wins.
- Attempted expansion of the USD replay window to `2024-05-31`, confirmed the frozen research framework still runs end-to-end, and documented that the warehouse currently only supports the continuous January 2024 USD window.
- Shifted Phase 3A focus onto historical warehouse completion planning instead of replay or metric changes.

## 2026-06-21

### Changed

- Updated the live `Eco Events Collector` workflow to remove the duplicate-insert failure against `economic_events`.
- Replaced the previous direct Supabase write with idempotent routing: dedupe incoming events, look up existing rows for the run date, update matching rows, and create only unmatched rows.
- Validated the live collector with two immediate reruns; executions `1081` and `1082` both succeeded with no `economic_events_event_date_currency_event_name_event_time_t_key` error.
- Re-exported the updated live workflow into `exports/eco_events_collector.json`.

## 2026-06-19

### Added

- Confirmed GitHub repository access for `kevincreedycars-debug/trading-agent-dashboard`.
- Added project memory documentation scaffold.
- Added `docs/CURRENT_STATE.md`.
- Added `docs/CURRENT_TASK.md`.
- Added `docs/NEXT_STEPS.md`.
- Added `docs/ARCHITECTURE.md`.
- Added `docs/N8N_INTEGRATION.md`.
- Added `CODEX.md`.
- Added read-only n8n MCP server scaffold in `mcp-n8n/`.
- Added MCP tools for listing workflows, fetching workflows, listing executions, and fetching executions.

### Current Focus

- Build AI-assisted development environment.
- Connect ChatGPT/Codex to GitHub and n8n.
- Reduce manual copy/paste of workflow JSON and node code.
- Keep first n8n MCP version read-only until exports exist.

### Known Issues

- Eco Events Collector duplicate insert failure.
- EUR Agent parser must support OpenAI JSON Object output.
- Master Orchestrator needs final execution summary.

## 2026-06-20

### Added

- Exported live n8n workflow JSON snapshots into `exports/`.
- Added dashboard Master Orchestrator control panel.
- Added `data/workflow-control.json` for non-secret dashboard trigger configuration.
- Added `data/workflow-status.json` for published run status and error reporting.
- Added dashboard rendering for workflow status, step reports, and error reports.
- Added `CODEX_STARTUP.md` as the permanent Codex working-memory startup guide.
- Added `docs/SESSION_NOTES.md` for latest-session handoff notes.
- Added `docs/PROJECT_HISTORY.md` for concise high-level project milestones.

### Pending

- Verify an end-to-end dashboard-triggered run.
- Refine status reporting if n8n child workflow error payloads need richer parsing.

### Changed

- Added a production Webhook Trigger to the live Master Orchestrator.
- Published the Master Orchestrator and referenced child workflows.
- Configured `data/workflow-control.json` with the production webhook URL.
- Added Master Orchestrator status publishing to `data/workflow-status.json`.
- Added visual-only Backtest / Accuracy dashboard tab using placeholder mock data.
- Added static `data/backtest.json` placeholder for agent accuracy and variable correlation UI scaffolding.
- Updated `CODEX.md` and project memory docs to require Codex to read memory first, summarise state, and update only changed memory documents at session end.
- Expanded the permanent memory process with startup summaries, milestone updates, session close notes, commit/push expectations, and canonical memory file locations.
- Updated `CODEX_STARTUP.md` to require continuous documentation updates, logical milestone commits, and startup recovery from repository memory.
- Added `docs/ACTIVE_MILESTONE.md` as the live checkpoint for the current feature and updated startup rules to read it after `docs/CURRENT_TASK.md`.
- Refined `CODEX_STARTUP.md` to use smart staged startup, concise startup summaries, runtime validation against repository evidence, documentation-drift handling, and stricter session close rules.
- Updated supporting documentation to point startup behavior at `CODEX_STARTUP.md` and use `docs/SESSION_NOTES.md` for current session memory.
- Reworked the dashboard to display a derived confidence score as the headline call metric while preserving Bull Case, Bear Case, Net Edge, and Participation as separate diagnostics.
- Added a compact Overview definitions legend beneath the Layer 1 calls.
- Replaced the shared dashboard card top strip gradient with a single navy strip.
- Added shared Layer 1 dashboard normalization so confidence and a 7-day direction outlook are derived reliably from the latest loaded timeframe calls.
- Added an Overview 7-day direction outlook section and updated the current `data/layer1.json` snapshot to carry `confidence` and `seven_day_outlook`.
- Confirmed the public static host is GitHub Pages and that the earlier local confidence commit had not yet been pushed when deployment was checked.
