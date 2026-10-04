# NQ backtester lane: the window is open, the build is deferred

Assignment: `backtester-nq-001`. Published 2026-09-29.
Worker: `backtester-nq`. Worktree: `D:/trading-agent-dashboard-codex/.local/worktrees/backtester-nq`.
Branch: `workers/backtester-nq-20260929`. Starting commit: `1bb3395`.
User authorization: on 2026-09-29 the user asked for the seven non-Gold asset backtester windows to be built
and opened now - "we first just need to build the 7 VSCs and open them for each backtesting agent" - and
stated that the seven backtesters themselves are built later, "once we have completed and understood all the
lessons from the gold backtesting loop".

## Session timing (user ruling, 2026-10-04)

Decided by the user on 2026-10-04, in these words: "we use the NY timings for all open and end of day
time sections". Every session-open and end-of-day boundary in this lane's work is therefore declared in
New York time (`America/New_York`, US Eastern) - not in UTC and not in a data provider's own clock - and
any artefact this lane writes states that basis at the point where it states a session boundary. This is
the same basis the Gold session-horizon policy already records - "US Eastern Time drives the session; UTC
hours shift by one when US daylight saving changes", `backtester/registries/gold_session_horizon_policy.v1.json` -
so a Gold session timing is not a precedent for any other clock, and it does not need to be re-derived.

This ruling settles the session clock only. Any session-clock question this lane recorded earlier is
answered by it and is not re-asked. It does not authorize stage B, and it does not settle the daily-series
basis: a close-only daily series still cannot reconstruct an exact 24-hour open-to-close window without a
second intraday source or a re-declared close-to-close basis, which stays an open question for the user.

## Purpose and lane

This window exists so the NQ lane is registered, open and able to read the project. It is a **readiness and
standby lane, not a build lane**: the NQ backtester is not designed, built, run or frozen here, and no Gold
lesson is treated as settled. Gold paid for the lessons first; this lane inherits them only when the
coordinator publishes them as frozen and the user authorises a build.

Read this as a starting picture and re-verify it from the files rather than trusting it. Nothing here is an
edge measurement, a validated result, or a claim that NQ is one-day ready in practice.

## Scope (stage A - the only authorized work)

One deliverable file and one report:

1. `docs/backtester-nq/READINESS.md` in your own worktree, with these sections:
   1. *Register identity* - worker, assignment, worktree, branch, baseline, window, provider.
   2. *What exists for NQ today* - every claim carries an exact repository path, and where a path is
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

- The 2026-09-24 readiness matrix calls NQ **ready** with a builder, a real checker and a validator; its
  recorded blockers are that there is no dedicated importer directory and that the registry is missing (two
  blockers). The matrix is `.local/worktrees/backtester-spike/docs/MULTI_ASSET_READINESS_SPIKE.md` (read-only).
- Paths to check and then describe accurately: `backtester/scripts/build_backtester_checker_data_nq.js`,
  `backtester/scripts/check_nq_live_replay_24h_parity.js`,
  `backtester/scripts/validate_backtester_checker_nq.js`,
  `backtester/fixtures/nq_live_replay_24h_parity_fixture.json`,
  `data/backtester-checker-nq-24h-2024-2026.json`, `logic/agent_nq_direction.md`.
- The multi-asset platform code that review names (`backtester/lib/asset_adapters.js`,
  `backtester/scripts/run_asset_matrix.js`, `backtester/scripts/run_asset_real_shard.js`) exists **only** on
  `spike/multi-asset-readiness-20260924`, not in the canonical folder, and that submission carries an open
  change request. It is context, never a foundation to build on.
- `backtester/registries/` holds only `gold_*` registries at this commit and no canonical filename contains
  `asset`. Both are checkable facts, not assumptions.

## Owned scope

Write only `docs/backtester-nq/` in your worktree plus ignored scratch under `tmp/` or `backtester/tmp/`.
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
3. record `node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity backtester-nq paused "<what finished>"`;
4. stop. Start no further work until a recorded reply arrives; read it with
   `node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker backtester-nq`.

A blocker is submitted when it is found, not at the end of the task.

## Window and provider

Open `tools/backtester-nq-node/BacktesterNq.code-workspace` in its own VS Code window, select **DeepSeek** in
the existing agent extension, and run *Mailbox: Connect This Cline Worker* once. This adds no API key, no
credential scope, no provider configuration and no background model runner. The register marks this worker
`mailbox_auto_connect`, so the connection is restored after a reload. Keep exactly one Cline task open in that
window: the bridge binds to the first workspace folder's registered path and has no task selector. The startup
message is in `docs/orchestration/AGENT_MESSAGES.md` and `tools/backtester-nq-node/README.md`.

---

## Stage B revision, published 2026-10-04: the NQ foundation data build is authorised

Published by the coordinator as the user's delegate on 2026-10-04, on the user's own instruction recorded in
`docs/orchestration/DECISIONS.md` ("the seven `backtester-<asset>` foundation-data revisions are published in
tandem"). Everything above remains the readiness record it already is; this section supersedes only the stage-A
sentence that forbids building, and only for the actions named here.

Stage B: foundation data build for NQ. Authorised by the user on 2026-10-03, confirmed by the user on 2026-10-04 and published on 2026-10-04.

Until now this lane was a readiness and standby lane: one docs/backtester-nq/READINESS.md and no
build. The user has now asked for the per-day foundation series for NQ to be ready inside this
backtester, built the same way XAU/USD's is, so that when the analysis method is settled this lane can run
without a second acquisition round. Your deliverable in this stage is data plus provenance, not analysis.

Do, in this order, and re-verify every claim from the files rather than from this text:

1. Inventory, in your own worktree, what already exists for NQ: backtester/sql/*, backtester/importers/*,
   backtester/lib/historical_common.js, backtester/replay/*, backtester/scripts/*, data/backtester-checker-*.
   State what is absent and show the search that establishes it.
2. Store, **in the shape the coordinator decided in revision 2**: load the accepted four-year window into
   the shared `historical_price_series` table in `backtester/sql/003_generic_historical_warehouse.sql` with
   lowercase `instrument_key = `qqq_nq_proxy`` and `interval = daily`, appending to what is already loaded
   rather than rebuilding it; the macro and FRED rows go to `historical_macro_series`. Seven Gold-shaped
   per-asset tables are **rejected**, so step 0NN is no longer an alternative here. Every loaded row must
   link to one `historical_source_manifests` row carrying coverage_start, coverage_end, row_count, checksum
   and import_mode = 'historical_backfill'.
3. Acquisition over `2022-10-01` -> `2026-09-30`, with the existing plumbing and no new vendor, and **over a 3-year minimum
   per the user's fifth reply of 2026-10-03** (the agreed target is the longer one: `2022-10-01` ->
   `2026-09-30`). The instrument-parameterised `backtester/importers/oanda/download_oanda_candles.js`
   (granularity D) for `qqq_nq_proxy`, plus the shared macro block from
   `backtester/importers/fred/import_fred_macro.js`, which already carries the USD series every pair
   reuses. The provider and the missing piece per asset, measured this cycle and **NQ-specific**, are
   in the table below: a lane starts from the piece its own row names, and never from a symbol guess.
   Run the importers through the local credential runner so no value is printed:
   %USERPROFILE%\.trading-agent-dashboard\scripts\run-with-credentials.ps1 -Scope market-importers
   -Command node -Arguments <script> <args>

Per-asset provider and the missing piece, measured from production this cycle. A lane's own row is the one
that binds it; `NQ` is substituted per lane. All paths are read with `git show origin/main:<path>`,
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
   deliverables: docs/backtester-nq/READINESS.md (still owed from stage A, now with a foundation
   section listing the achieved window per series and the digest of the load) and one envelope through
   node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <file> with the exact
   commands, results, artifact hashes, blockers and questions.
6. Record activity with node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity
   backtester-nq working|paused "<task>".

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
| NQ (NQ/USD) | `importers/qqq/import_qqq_daily.js` writing `qqq_nq_proxy`; `sql/009`; `builders/nq` | Front backfill only; the series is the QQQ proxy by decision, not NQ futures. |

Lane-specific facts to confirm rather than assume:

- Dashboard pair it must match: `NQ_USD` / `NQ/USD`
- Price series for the instrument, as the evidence stands: settled 2026-10-03: the QQQ proxy series, not a true NQ futures feed - `qqq_nq_proxy`, `weekday_only`, via `importers/qqq/import_qqq_daily.js`, evaluation label `QQQ_NQ_PROXY`
- Factor document: `logic/agent_nq_direction.md`
- Keep the proxy label in metadata as `importers/qqq/README.md` requires, and record plainly that the `2022-10-01` to `2026-09-30` history is QQQ history, not NQ futures history.

Reporting is unchanged from this file's own "Reporting (mandatory)" section: one envelope through the shared
mailbox, `monitor-state.js activity backtester-nq working|paused "<task>"`, then pause. File a
blocker when it is found, not at the end.

---

## Stage B.2 revision, published 2026-10-04: complete the authorised NQ window (the 105-day tail)

Published by the coordinator as the user's delegate on 2026-10-04, under the user's own 2026-10-04 tandem
instruction recorded in `docs/orchestration/DECISIONS.md` (the seven `backtester-<asset>` foundation-data
revisions are published in tandem). This section bounds, and does not expand, the Stage B revision above: it
carries the one remaining piece of that mandate's own window across `2022-10-01` -> `2026-09-30`, and nothing
else. It was published with the acceptance of submission `20261004-backtester-nq-001-stage-b`, whose reviewed
bytes record the front-window load and its evidence.

Why it exists. The Stage B revision's step 3 authorises acquisition over the whole window, but the load it
delivered stops at `2026-04-30`: the calendar audit finds `uncovered_tail_expected_trading_days` **105** to
`2026-09-30`, and the lane records that as its own blocker 1. Nothing in the mandate authorised stopping at the
front window, so the tail is authorised work that is not yet done rather than new scope.

Authorised, in this order, and nothing else:

1. Acquire only the tail `2026-05-01` -> `2026-09-30` from the proven, credential-free Yahoo Finance chart API
   v8 daily route the front window already used, and import it through the production
   `backtester/importers/qqq/import_qqq_daily.js` into `historical_price_series` for
   `instrument_key = 'qqq_nq_proxy'`, `interval = 'daily'`, appending only. Do not re-acquire, rewrite or
   delete the existing 897 rows, and do not re-run the front window.
2. Keep the basis unchanged from what is already loaded: `is_adjusted = true` with
   `adjustment_type = 'source_adjusted_close'` (Yahoo adjclose), the same basis as every existing
   `qqq_nq_proxy` row. This section does not settle the daily-series basis question, which stays the user's; it
   only requires the tail to match what is already in the spine. If the user answers the basis question with a
   change before the tail is acquired, stop and re-file instead of acquiring under a superseded basis.
3. Give the new rows their own `historical_source_manifests` row carrying `coverage_start`, `coverage_end`,
   `row_count`, a `checksum` over the exact bytes of the normalised import bundle, and
   `import_mode = 'historical_backfill'`, as the Stage B revision requires. Do not modify the existing manifest
   rows, and do not touch the pre-existing `74141dc6-...` row.
4. Prove the load, do not assert it: rows loaded, min and max date, day count per calendar year, the gaps and
   their cause, the duplicate check on the natural key, the sha256 of the untouched vendor response and of the
   bundle you loaded. Then re-run the calendar audit over the **full merged span** to `2026-09-30` and
   re-measure **both** seams like-for-like - the existing `2024-01-02` join and the new `2026-05-01` join the
   tail creates. The tail is a third acquisition vintage of an adjusted series, so its seam must be measured,
   not assumed.
5. Update `docs/backtester-nq/READINESS.md`: the foundation section, the calendar and seam subsections, and the
   register-identity line whose assignment blob changes with this revision (this append moves
   `docs/orchestration/assignments/backtester-nq.md` off blob `0165e33ed49b944298f3389b9af2fe36addaebd7`).
6. Keep the raw pull and load log in the lane's ignored `backtester/tmp/`; file exactly one envelope through the
   shared mailbox with the exact commands, results, artifact hashes, blockers and questions; record
   `node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity backtester-nq working|paused
   "<task>"`; then pause. The lane starts no further work until a recorded reply arrives.

Still not authorised, unchanged from the Stage B boundaries and non-negotiable: no builder, checker, validator,
registry, fixture, session policy, outcome definition, factor ranking, adapter, matrix runner, scheduler or
backtester source; no read of any outcome, holdout or prospective observation; no basis change, no instrument
change (the QQQ ETF proxy stays the instrument of record until the user rules otherwise), no window
freeze-versus-roll decision; no Layer 1 or Layer 2 file, dashboard, n8n workflow, credential, warehouse-schema,
production or deployment action. Layer 1 stays sealed and independent and backtesting stays downstream only.

Open and the user's, unchanged and not answered here: question 1 (the daily-price basis of record), question 2
(close-to-close versus a true NY open-to-close horizon), and question 4 (whether `qqq_nq_proxy` remains the NQ
instrument of record). Question 3 (the window end) is answered: the window ends `2026-09-30`, as the Stage B
revision's agreed target already states.