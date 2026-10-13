# Isolation and production boundary for the USD session research programme

Created 2026-10-13 on branch `research/usd-session-20261013`, cut from the coordinator branch
`orchestration/control-plane-20260920` at `c1ea8ab`.

## Why this file exists

The user's instruction of 2026-10-13 forbids any research step from modifying production workflows,
dashboard files, production configuration, scheduled jobs, dispatcher state, credentials or files the
live feed consumes, and requires more than a separate branch: the research scripts themselves must be
shown unable to write into production paths or call production write endpoints.

## The boundary as built

| Item | Value |
| --- | --- |
| Research branch | `research/usd-session-20261013` (local only; never pushed as this programme's output) |
| Research docs | `docs/research/usd-session/v1/` (new tree; no production document is edited) |
| Research run outputs | `backtester/tmp/usd-session-research/` (ignored local folder, verified below) |
| Research caches | `backtester/tmp/usd-24h-research-cache/` (existing ignored cache) plus the new folder |
| Production that stays untouched | `data/*.json`, `config/*.json`, `exports/*.json`, `logic/*.md`, dashboard root pages, `docs/` outside `docs/research/`, dispatcher and mailbox state under `.local/` |

## Measured, not asserted

- The branch was created from the coordinator tip; `git status --short --untracked-files=all` was taken
  before the first write and the pre-existing unrelated state (`tools/strategy-node/Strategy.code-workspace`,
  the five untracked `backtester/*gold_session_policy*` files, and the three modified
  `backtester/lib/layer1_confidence_mapping.js`, `backtester/tests/layer1_confidence_mapping.test.js` and
  `docs/review/usd-24h-ruleset-v1/*` files) was deliberately left in place and is not part of this
  programme's commits. No file outside `docs/research/usd-session/v1/` and this programme's own new modules
  was edited, so no already-dirty file changed state because of this work.
- `backtester/tmp/` and `tmp/` are ignored, so research run outputs cannot reach a published branch. The
  check is `.gitignore` membership, not directory naming; `tmp/usd-session-research-playground.txt` in the
  test below proves the ignore rule fires.
- No research script in this programme calls the n8n API, Supabase or any provider write endpoint. The
  only network use permitted is read-only acquisition of public series (FRED CSV/JSON, provider candles)
  into the ignored cache, exactly as the 24-hour study already does.

## The failure of the previous defaults

The 2026-10-12 study's scripts resolve their defaults with `path.resolve(__dirname, "../../data/...")` and
`path.resolve(__dirname, "../../../config/...")`, so running them unchanged from any checkout writes
committed production artefacts (`data/usd-24h-experiment-registry.json`, `config/usd_24h_ruleset_v2.json`,
`docs/review/usd-24h-ruleset-v1/USD_24H_RESEARCH_CARDS.md`, and so on). A different branch alone therefore
does **not** satisfy the user's requirement: the default output targets must be repointed or the run must
pass an explicit `--out` into the research folder. Every command recorded in this programme's evidence
uses the research folder, and the guard in `backtester/scripts/lib/research_path_guard.js` refuses a run
whose output is outside it.

## What may still be read

Reading is unrestricted and required: `exports/usd_layer1_agent.json` and `exports/usd_collector.json`,
`logic/agent_usd_direction.md`, the 24-hour dataset and its companions, `data/backtester-checker-usd-24h-2024-01.json`,
`backtester/tmp/*.csv` caches, `docs/review/usd-24h-ruleset-v1/` and `origin/main:data/layer1.json`.
Reading a production artefact writes nothing.
