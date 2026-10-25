# Prompt integration: `research-prompt-v3.1.0` on `main`

This note records the integration of `d6cff707` from `workstream/c-research-programme` (DeepSeek's
per-factor question work) into the deployed library on `main`, and the state it leaves for the
automation coordinator.

## Why this was a port, not a merge

The workstream branch is based on `125d871e`, 1,526 commits behind `origin/main` (`9c618d22`). A whole-file
merge or cherry-pick would have brought back the branch's older `lib/research_library.js`, `script.js` and
seventy-eight prompt files, and reverted deployed behaviour that the branch never saw:

- the hosted upload and sign-in path, the `Uploaded` stage label, the uploaded file's `original_filename`,
  and a hosted row counted through its `chain_id`;
- the asset order `USD, EUR, GOLD, SILVER, NQ, BTC, WTI, GBP`;
- the prompts that cite a dispatched brief by path and hash instead of reproducing it, the five evidence kinds,
  the five allowed conclusions and the two-route supervisor.

So the branch was read for what it actually changed, and that content was ported onto `main`'s builder. Taken:
per-factor question ownership, the role-aware chain question, the stage 2 and 3 questions, the gate wording,
the abstention treatment, the derived asset catalogue record and the version stamp. Not taken: the branch's
template module (on `main` the builder owns every word), its asset order, its `lib` and `script.js` changes, its
`data/research-library/documents.json` deletions — the two `usd-24h` version-2 records it removed are the
*current* versions on `main`; both files on disk hash to those v2 entries — and its topic-map proposal.

## The defect, stated precisely

Probes sat on the six topic labels and every chain inherited the whole list. Where a label grouped unlike
factors, the wrong question arrived:

| Factor chain | Probe it was asked | Whose question it was |
| --- | --- | --- |
| `live.f6-gold-delta` | "Is the dollar smile a measured relation for this window" | `live.f9-dollar-smile` |
| `live.f5-dxy-delta` | "Are gold and equities independent evidence for the dollar" | the label, not this entry |
| `live.f10-equity-versus-usd` | the dollar-smile and dollar-index probes | `live.f9` and `live.f5` |
| `risk.usd-safe-haven-demand` | range position and bid-ask bounce | the three `fx.usd-*` chains |
| `risk.risk-on-off-cross-asset-state` | range position and bid-ask bounce | the three `fx.usd-*` chains |
| `data.quality-gate-for-abstention` | scheduled releases and release timestamps | the two `calendar.*` chains |
| `calendar.days-since-and-until-high-impact-events` | "Can an abstention rule be evaluated at all" | `data.quality-gate-for-abstention` |

Seven chains, eleven borrowed questions. `live.f4-real-yield-delta` carried a related defect: it was asked
whether a real-yield change adds information beyond the nominal front end, which is its own question asked
back at it.

## What changed at `research-prompt-v3.1.0`

- **Every factor entry owns its four questions.** They are authored in the `FACTOR_PROBES` block of
  `scripts/build_research_library.js`, keyed by factor id, and the chain is built from them. The builder now
  refuses a chain whose factor has no authored questions, so a chain cannot silently borrow a sibling's again.
- **A group label keeps only the shared question.** Six labels, one or two questions each: which of the eight
  front-end entries duplicates which, which dollar index a claim is about, whether gold and equities are
  independent, which instrument labels the FX factors, and whether an abstention rule can be evaluated without
  a frozen label.
- **Stages 2 and 3 re-ask the factor's questions.** The red-team must say whether the report answered each one
  and on what source; the adjudication must decide each one or record it unresolved with what would decide it.
- **A gate is asked what it changes.** Any factor whose role contains `gate` gets a chain question about what it
  changes about the call, not whether it predicts direction.
- **Abstention is judged on three quantities.** The gate's questions ask whether it improves directional
  accuracy on the sessions it trades, what it costs in coverage, and how skipped sessions are counted — as
  errors, as excluded observations or as a separate coverage figure — against the coverage-matched benchmark of
  calling every session.
- **One version, one hash per stage.** `prompt_template.version` and every stage's
  `prompt_source.template_version` read `research-prompt-v3.1.0`; each prompt carries
  `prompt_path`, `prompt_sha256` and `prompt_bytes`, and each prompt file names the version and points at the
  catalogue for its hash.
- **A derived asset catalogue record.** `assets[].catalogue` states what each asset can dispatch today: USD
  `dispatchable` (25 entries, 25 chains, 78 stage prompts, 25 briefs), the other seven `profile_only` with the
  four things each still needs and its open-decision count. It opens no chain and moves no status.

## Evidence from the regenerated files

- 78 of 78 prompts carry `research-prompt-v3.1.0`, and every stage records the version in the catalogue.
- Each factor chain carries six or seven questions: its chain question, its four own questions and its label's
  shared question(s). No question appears under two labels.
- `live.f6-gold-delta` no longer contains "dollar smile" and does contain `XAU`; `live.f10-equity-versus-usd`
  names QQQ, the Nasdaq-100 and the future.
- `data.quality-gate-for-abstention` no longer contains "scheduled release inside the session", and does contain
  "accuracy", "coverage" and "skipped sessions" in all three stages. `live.f4-real-yield-delta` no longer asks
  its own question back at itself.
- All three stages of all twenty-five chains contain each of that chain's own questions.

## Preserved

- The registered VIX report is untouched: version 1, 84,056 bytes, sha256 `e4151937…`, with its parent links;
  `data/research-library/documents.json` is not modified by this integration.
- No report, review or adjudication was edited or re-registered. Prompts are not registered documents, so the
  seventy-eight regenerated files add no version.
- No factor status, weight, threshold, sign, lookback, live call, feed, workflow or dispatcher state moved.
- The final chain is still `usd-final-asset-analysis`, still `locked` at `0/25`, and still renders no stage.
- Nothing was published to a model, dispatched, or uploaded. The seven non-USD assets stay `profile_only`.

## Research review check

The review pass that the coordinator asked for was run against the regenerated files, not the generator:

- For each of the twenty-five chains, each of the three stage files was searched for each of that chain's own
  questions. Result: 0 missing. A question cannot stop at stage 1, and no stage carries a question from another
  label.
- The two chains whose role is a gate (`data.quality-gate-for-abstention` and
  `calendar.known-releases-between-cutoff-and-endpoint`) were read against the role rule: both ask what they
  change about the call, neither asks which way the dollar moves. `risk.vix-level-and-change-at-cutoff` keeps
  its directional question because its catalogue role is `regime`, not a gate; the label's shared abstention
  question still reaches it.
- The abstention treatment was checked against the agreed comparison. The gate is asked for directional
  accuracy **on the sessions it trades**, the **cost in coverage**, and how **skipped sessions** are counted,
  with "what benchmark makes abstention comparable to always calling" stated in the question. That is the
  coverage-matched comparison, not an accuracy figure that rewards skipping hard sessions.
- The seven borrowed-probe chains and the self-questioning real-yield chain were re-read: each now asks its own
  questions, and the group label's one or two shared questions are the only ones they have in common.

## Verification performed

- `node scripts/build_research_library.js catalog --write` regenerated the catalogue and all seventy-eight
  prompts from one source; `chains --check`, `topics --check`, `catalog --check` and `verify` pass.
- `node --test tests/research_library.test.js` passes 35 of 35, including three new guards: every chain owns its
  questions and carries them through all three stages; the gate asks what it changes and abstention is judged on
  accuracy, coverage and skipped sessions against always calling; the catalogue marks USD `dispatchable` and the
  other seven `profile_only` while the final gate stays at 25.
- `node --test tests/research_library.test.js tests/research_pipeline.test.js tests/research_handoff.test.js`
  passes 66 of 66. The full suite result is recorded in `docs/CHANGELOG.md`.
- The prompt-hash tests still hold every file to its catalogue sha256 and byte count, and the existing guards
  for the five evidence kinds, the allowed conclusions and the nine superseded phrases still pass.

What the checks do not establish: that these are the right questions. That is a reading of the text, recorded
factor by factor here and in the changelog; a hash cannot prove it.

## Deployed and read back

- The prompts and catalogue were deployed to `main` as `65ec66aa` (`d4de0110..65ec66aa`), a fast-forward over
  the live-snapshot commits, and the integration branch is pushed alongside it.
- Read back from the public site at 2026-10-25T21:26Z, not assumed: the live
  `data/research-library/catalog.json` is 319,477 bytes, sha256
  `aa249c41cb51eae8a9a25fba5db2c28ccbc5d477710daf7863a5279b197541a9`, byte-identical to the committed file,
  carries `research-prompt-v3.1.0`, and its USD record reads `dispatchable` 25/25/78/25. The live
  `index.html` serves cache-buster `20261025-research-prompt-v310`.
- The three live VIX prompts hash to the catalogue's values: research 16,598 bytes /
  `596a6530…`, red-team 14,699 / `78d66cda…`, adjudication 16,119 / `c2e7312a…`.
- The dispatcher reads the same bytes: `node scripts/research-pipeline.js preview
  usd-topic-vix-level-and-risk-regime research --chain usd-factor-live-f1-vix-level` reports
  `prompt_path` `docs/research/factors/usd/live-f1-vix-level/01-research-prompt.md` and `prompt_sha256`
  `596a6530…`, identical to the catalogue, inside its own envelope. `plan --asset USD --runnable` lists 25
  runnable stages with the VIX red-team first.
- Two environment limits, stated rather than worked around: the red-team preview needs the registered research
  object, which is present in the canonical checkout's `.local/research-library/objects` (84,056 bytes,
  `e4151937…`) but absent from a fresh worktree; and `research-library:page-check` needs the owner's hosted
  sign-in, so it was not run.

## Handoff: automation coordinator

- **Deployed prompt version:** `research-prompt-v3.1.0`; the prompts and catalogue were deployed in
  `65ec66aa` on `main`, and this note is the follow-up commit.
- **Canonical identity:** `usd-final-asset-analysis` for the asset-level chain. Do not create a second dispatch
  task; the factor chains are `usd-factor-<factor-id>`.
- **Per-stage hashes:** each stage's `prompt_path`, `prompt_sha256`, `prompt_bytes` and
  `prompt_source.template_version` are in `data/research-library/catalog.json`. The VIX chain, which is the
  pilot's next eligible stage, reads:

  | Stage | Path | Bytes | sha256 |
  | --- | --- | --- | --- |
  | research | `docs/research/factors/usd/live-f1-vix-level/01-research-prompt.md` | 16,598 | `596a6530858850cf2865185eee5140e41267102a4a84c612551504336319d324` |
  | red_team | `docs/research/factors/usd/live-f1-vix-level/02-red-team-prompt.md` | 14,699 | `78d66cdab6eb8a9cbbf088044af6ff856a49556263dd9332f23e7bba0dbe400d` |
  | adjudication | `docs/research/factors/usd/live-f1-vix-level/03-adjudication-prompt.md` | 16,119 | `c2e7312a5ec487c91ac24cef62b9b9b8b460f51a012eb0354af5eef18cdcd366` |

- **Manual and automated paths are identical by construction.** The dashboard copies the file at
  `prompt_path` and verifies it against `prompt_sha256`; `lib/research_pipeline.js` reads the same file, checks
  the same sha256 and byte count, and refuses a drift before building an envelope. Neither renders its own copy.
- **Next eligible stage:** `usd-factor-live-f1-vix-level` stage 2 (red-team), against research version 1. The
  final chain is not eligible at `0/25`; stage 1 of every other factor chain is written but not dispatched.
- **Remaining blocker:** the final chain's gate (25 factor chains complete) and the owner's label-instrument
  decision. No allowance has been spent by this integration, and the pilot still needs its bounded allowance
  controls from the automation lane.

## What remains per draft asset

For each of EUR, GOLD, SILVER, NQ, BTC, WTI and GBP:

1. A label instrument and quote-source decision, naming the contract, index or spot venue and how it is quoted
   at the cutoff.
2. One factor entry per candidate factor, with its series, publication timing, transformations and blockers.
3. A three-stage chain per factor, with its prompts generated and hash-checked.
4. A published brief per factor, and an asset-level final chain with its own completion gate.

