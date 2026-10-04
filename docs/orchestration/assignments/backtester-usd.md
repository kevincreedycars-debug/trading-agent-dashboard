# USD backtester lane: the window is open, the build is deferred

Assignment: `backtester-usd-001`. Published 2026-09-29.
Worker: `backtester-usd`. Worktree: `D:/trading-agent-dashboard-codex/.local/worktrees/backtester-usd`.
Branch: `workers/backtester-usd-20260929`. Starting commit: `1bb3395`.
User authorization: on 2026-09-29 the user asked for the seven non-Gold asset backtester windows to be built
and opened now - "we first just need to build the 7 VSCs and open them for each backtesting agent" - and
stated that the seven backtesters themselves are built later, "once we have completed and understood all the
lessons from the gold backtesting loop".

## Purpose and lane

This window exists so the USD lane is registered, open and able to read the project. It is a **readiness and
standby lane, not a build lane**: the USD backtester is not designed, built, run or frozen here, and no Gold
lesson is treated as settled. Gold paid for the lessons first; this lane inherits them only when the
coordinator publishes them as frozen and the user authorises a build.

Read this as a starting picture and re-verify it from the files rather than trusting it. Nothing here is an
edge measurement, a validated result, or a claim that USD is one-day ready in practice.

## Scope (stage A - the only authorized work)

One deliverable file and one report:

1. `docs/backtester-usd/READINESS.md` in your own worktree, with these sections:
   1. *Register identity* - worker, assignment, worktree, branch, baseline, window, provider.
   2. *What exists for USD today* - every claim carries an exact repository path, and where a path is
      hash-bound (fixture, registry, manifest) re-derive its raw-byte SHA-256 and state it. Describe nothing
      from memory or from this assignment's own text.
   3. *What the Gold loop requires before any asset backtester is built* - the contract items you actually
      find in the bound documents, in your own words, each with its source path.
   4. *Ranked blockers* - ordered, each with the path that shows it and the owner (user, coordinator, another
      lane, this lane).
   5. *Open questions for the user only* - questions you cannot answer from the repository.
   6. *Explicitly not built* - one short paragraph stating that no builder, checker, registry, session
      policy, outcome definition, adapter or batch was written, changed or run by this lane.
2. One `status_report` envelope submitted through the shared mailbox.

Stage A ends after that submission. Do not begin stage B because stage A finished early.

## Not authorized (stage B - a later, separate user decision)

No builder, checker, validator, registry, fixture, session policy, outcome definition, adapter, matrix
runner, scheduler or backtester source may be created, edited or run, here or anywhere else. No acquisition,
import, warehouse, n8n, Layer 1, dashboard, credential, production or deployment action. No outcome, holdout
or prospective observation may be read. Leave the Gold capture lane, the canonical folder's five untracked
Gold session-policy files and every other worktree untouched.

## Starting picture to re-verify

- The 2026-09-24 readiness matrix calls USD **ready** with a builder, a real checker and a validator; its
  recorded blocker is that the session policy and the outcome definition are not in a versioned registry. The
  matrix is `.local/worktrees/backtester-spike/docs/MULTI_ASSET_READINESS_SPIKE.md` (read-only).
- Paths to check and then describe accurately: `backtester/scripts/build_backtester_checker_data.js`,
  `backtester/scripts/check_usd_live_replay_24h_parity.js`,
  `backtester/scripts/validate_backtester_checker.js`,
  `backtester/fixtures/usd_live_replay_24h_parity_fixture.json`,
  `data/backtester-checker-usd-24h-2024-01.json`, `logic/agent_usd_direction.md`.
- The multi-asset platform code that review names (`backtester/lib/asset_adapters.js`,
  `backtester/scripts/run_asset_matrix.js`, `backtester/scripts/run_asset_real_shard.js`) exists **only** on
  `spike/multi-asset-readiness-20260924`, not in the canonical folder, and that submission carries an open
  change request. It is context, never a foundation to build on.
- `backtester/registries/` holds only `gold_*` registries at this commit and no canonical filename contains
  `asset`. Both are checkable facts, not assumptions.

## Owned scope

Write only `docs/backtester-usd/` in your worktree plus ignored scratch under `tmp/` or `backtester/tmp/`.
Read central state, the dashboard files, the Gold artifacts and other registered worktrees by absolute path.
Never edit the canonical folder, the register, assignments, another worker's worktree or another worker's
mailbox. Submit only through the canonical mailbox CLI.

## Accepted bindings

Re-verify each before relying on it, and say plainly if a claim, path or digest has moved:

- `docs/ARCHITECTURE.md` - Layer 1 stays sealed, independent and upstream; backtesting is downstream only.
- `docs/BACKTESTING_REVIEW_PLAN.md`, `docs/backtester_master_logic.md`, `docs/CORE_RESEARCH_PHILOSOPHY.md`.
- `docs/GOLD_TIMESTAMPED_EVALUATION_CONTRACT.md` with `backtester/docs/gold_timestamped_backtesting.md`;
  `docs/GOLD_RESEARCH_DELIVERY_CONTRACT.md`, `backtester/docs/historical_outcome_evaluation.md`,
  `backtester/docs/variable_event_research_framework.md`.
- `docs/orchestration/reviews/20260924-multi-asset-readiness-spike-001-r1.md` - the open change request,
  including the CRLF/raw-byte materialisation finding and the instruction to group the USD/EUR/NQ/BTC
  session-policy and outcome registries into one later bounded assignment rather than four.

## Evidence and validation

Documentation only, so no test run is required; if you run anything, report the exact command and result. A
fresh worktree has no `node_modules`, and the spike review records a CRLF/raw-byte materialisation asymmetry
in freshly created worktrees, so do not run the documented local suite here and do not report its failures as
your own finding unless you reproduce one exactly. Keep raw logs in your own ignored `tmp/`. State
unavailable information explicitly instead of inventing a file, a digest or a result.

## Reporting (mandatory)

Finish only by reporting. On completion, on a blocker or at a decision point:

1. write one envelope from `templates/submission.json` into your own ignored `tmp/` with status
   `ready_for_review`, `blocked` or `status_report`, the observed worktree/branch/base/HEAD, changed files,
   exact commands and results, artifact hashes, blockers, questions and a production disclosure;
2. submit it with `node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <file>`;
3. record `node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity backtester-usd paused "<what finished>"`;
4. stop. Start no further work until a recorded reply arrives; read it with
   `node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker backtester-usd`.

A blocker is submitted when it is found, not at the end of the task.

## Window and provider

Open `tools/backtester-usd-node/BacktesterUsd.code-workspace` in its own VS Code window, select **DeepSeek**
in the existing agent extension, and run *Mailbox: Connect This Cline Worker* once. This adds no API key, no
credential scope, no provider configuration and no background model runner. The register marks this worker
`mailbox_auto_connect`, so the connection is restored after a reload. Keep exactly one Cline task open in that
window: the bridge binds to the first workspace folder's registered path and has no task selector. The startup
message is in `docs/orchestration/AGENT_MESSAGES.md` and `tools/backtester-usd-node/README.md`.

---

## Stage B revision, published 2026-10-04: the USD foundation data build is authorised

Published by the coordinator as the user's delegate on 2026-10-04, on the user's own instruction recorded in
`docs/orchestration/DECISIONS.md` ("the seven `backtester-<asset>` foundation-data revisions are published in
tandem"). Everything above remains the readiness record it already is; this section supersedes only the stage-A
sentence that forbids building, and only for the actions named here.

Stage B: foundation data build for USD. Authorised by the user on 2026-10-03, confirmed by the user on 2026-10-04 and published on 2026-10-04.

Until now this lane was a readiness and standby lane: one docs/backtester-usd/READINESS.md and no
build. The user has now asked for the per-day foundation series for USD to be ready inside this
backtester, built the same way XAU/USD's is, so that when the analysis method is settled this lane can run
without a second acquisition round. Your deliverable in this stage is data plus provenance, not analysis.

Do, in this order, and re-verify every claim from the files rather than from this text:

1. Inventory, in your own worktree, what already exists for USD: backtester/sql/*, backtester/importers/*,
   backtester/lib/historical_common.js, backtester/replay/*, backtester/scripts/*, data/backtester-checker-*.
   State what is absent and show the search that establishes it.
2. Store, **in the shape the coordinator decided in revision 2**: load the accepted four-year window into
   the shared `historical_price_series` table in `backtester/sql/003_generic_historical_warehouse.sql` with
   lowercase `instrument_key = the five shared FRED series (`DGS2`, `DGS10`, `DFII10`, `VIXCLS`, `DTWEXBGS`)` and `interval = daily`, appending to what is already loaded
   rather than rebuilding it; the macro and FRED rows go to `historical_macro_series`. Seven Gold-shaped
   per-asset tables are **rejected**, so step 0NN is no longer an alternative here. Every loaded row must
   link to one `historical_source_manifests` row carrying coverage_start, coverage_end, row_count, checksum
   and import_mode = 'historical_backfill'.
3. Acquisition over `2022-10-01` -> `2026-09-30`, with the existing plumbing and no new vendor, and **over a 3-year minimum
   per the user's fifth reply of 2026-10-03** (the agreed target is the longer one: `2022-10-01` ->
   `2026-09-30`). The instrument-parameterised `backtester/importers/oanda/download_oanda_candles.js`
   (granularity D) for the five shared FRED series (`DGS2`, `DGS10`, `DFII10`, `VIXCLS`, `DTWEXBGS`), plus the shared macro block from
   `backtester/importers/fred/import_fred_macro.js`, which already carries the USD series every pair
   reuses. The provider and the missing piece per asset, measured this cycle and **USD-specific**, are
   in the table below: a lane starts from the piece its own row names, and never from a symbol guess.
   Run the importers through the local credential runner so no value is printed:
   %USERPROFILE%\.trading-agent-dashboard\scripts\run-with-credentials.ps1 -Scope market-importers
   -Command node -Arguments <script> <args>

Per-asset provider and the missing piece, measured from production this cycle. A lane's own row is the one
that binds it; `USD` is substituted per lane. All paths are read with `git show origin/main:<path>`,
and "nothing" means no importer, no SQL table, no builder and no checker data:

| Asset (`/USD` pair) | Provider path that exists | Piece that is missing for a 3+ year series |
| --- | --- | --- |
| Gold (XAU/USD) | `backtester/importers/gold/import_gold_daily.js`, `DEFAULT_START = "2000-01-01"`, Coinbase `XAU-USD` by date plus a FRED LBMA path; `sql/008`; `builders/gold` | Nothing structural: backfill the front from 2023-01-02 and pull a fresh tail past 2026-04-30 (fresh tail only). |
| USD (shared block) | `importers/fred/import_fred_macro.js` with five series (`DGS2`, `DGS10`, `DFII10`, `VIXCLS`, `DTWEXBGS`); `sql/002`; `builders/usd` | Macro backfill to the front; the file's `SERIES_CONFIG` is the fixed list, so a series outside it needs a config entry. |
| EUR (EUR/USD) | `importers/eurusd/` (FRED `DEXUSEU`); `sql/007`; `builders/eur` | Front backfill only; the importer's default start is already pre-2022. |
| NQ (NQ/USD) | `importers/qqq/import_qqq_daily.js` writing `qqq_nq_proxy`; `sql/009`; `builders/nq` | Front backfill only; the series is the QQQ proxy by decision, not NQ futures. |
| BTC (BTC/USD) | `importers/btc/` writing `btc_usd_spot`; `sql/010`; `builders/btc` | Front backfill only; the importer's default start is already `2010-07-18`. |
| GBP (GBP/USD) | none: `backtester/importers/` has no `gbp` directory and `backtester/sql/` stops at `010` | **All of it**: a `gbpusd` price series (OANDA `GBP_USD` on `download_oanda_candles.js`, or FRED `DEXUSUK` through the EUR importer's shape), the `gbpusd` spine key, then a builder. |
| Silver (XAG/USD) | none: no `silver`/`xag` importer and no table | **All of it**: a `xagusd_spot` price series - the gold importer's Coinbase call is hardcoded to `XAU-USD`, so it needs a symbol parameter or a sibling preset - then a builder. |
| WTI (WTI/USD) | none as a price series: `DCOILWTICO` is **not** in the FRED importer's `SERIES_CONFIG` (five series, none of them WTI) | **All of it**: either a priced `wti_usd_spot` series or a decision to hold WTI as a macro series (`series_key = 'DCOILWTICO'`), plus a `SERIES_CONFIG` entry in the first case; then a builder. |

Sizing, unchanged and repeated here because it is the "asap" answer: Gold needs about three months of front
backfill; USD, EUR, NQ and BTC need roughly 2.75 years more each; GBP, Silver and WTI start from zero. The
downloaders are not the limit - only the raw evidence is short.

4. Prove the load, do not assert it: rows loaded, min and max date, day count per calendar year, the gaps
   and their cause (weekend, exchange holiday, source outage), duplicate check on the natural key, and the
   sha256 of the bundle you loaded. Where a source cannot reach 2022-10-01, report the achieved start and
   the reason; never interpolate, back-fill silently or fabricate a row.
5. Keep the raw pull and the load log in your own worktree's ignored tmp/, and file the two written
   deliverables: docs/backtester-usd/READINESS.md (still owed from stage A, now with a foundation
   section listing the achieved window per series and the digest of the load) and one envelope through
   node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <file> with the exact
   commands, results, artifact hashes, blockers and questions.
6. Record activity with node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity
   backtester-usd working|paused "<task>".

Boundaries, unchanged and non-negotiable:

- Layer 1 stays sealed and independent, and backtesting stays downstream only. No Layer 1 workflow, no
  Layer 2, no dashboard file, no production publish, no scheduler, no order or broker path.
- No outcome, holdout or prospective observation is read in this stage, and no session policy, outcome
  definition, factor ranking or edge claim is written. Those wait until the analysis method is settled.
- Nothing you build may be wired into a daily call, so an import is inert by design.
- Write only your own worktree plus ignored tmp/; submit only through the canonical mailbox; never edit the
  canonical folder, the register, an assignment, or another lane's worktree or inbox.
- One acquisition per asset, plus the single shared USD macro pull: coordinate with the coordinator rather
  than duplicating the FRED and USD pull seven times.
- Provider: run this window on DeepSeek in the existing Cline extension, exactly as the coordinator's own
  checker runs, and name the provider in the register-identity section of READINESS.md.
- A fresh worktree has no node_modules. If a package install is genuinely needed, report it as a blocker
  and wait; do not install silently, and do not run the documented local suite here and report its
  environment failures as your own findings.

### Your own row, measured from production on 2026-10-03

| Asset (`/USD` pair) | Provider path that exists | Piece that is missing for a 3+ year series |
| --- | --- | --- |
| USD (shared block) | `importers/fred/import_fred_macro.js` with five series (`DGS2`, `DGS10`, `DFII10`, `VIXCLS`, `DTWEXBGS`); `sql/002`; `builders/usd` | Macro backfill to the front; the file's `SERIES_CONFIG` is the fixed list, so a series outside it needs a config entry. |

Lane-specific facts to confirm rather than assume:

- Dashboard pair it must match: none: USD is the quote side of all seven, and no `USD_*` config exists
- Price series for the instrument, as the evidence stands: the shared FRED block (already `assetScope: "USD"`) plus the existing `002`/`005` tables; this lane confirms and records which USD series the store uses
- Factor document: `logic/agent_usd_direction.md`
- This is the one lane whose rows are macro rows rather than price rows: `historical_macro_series` by `series_key` in the shared block, with no `usd` price key, so the OANDA sentence in step 3 does not apply here. The single shared USD pull is yours; the other six lanes reuse it and must not pull it again.

Reporting is unchanged from this file's own "Reporting (mandatory)" section: one envelope through the shared
mailbox, `monitor-state.js activity backtester-usd working|paused "<task>"`, then pause. File a
blocker when it is found, not at the end.
