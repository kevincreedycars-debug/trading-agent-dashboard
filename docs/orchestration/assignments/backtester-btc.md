# BTC backtester lane: the window is open, the build is deferred

Assignment: `backtester-btc-001`. Published 2026-09-29.
Worker: `backtester-btc`. Worktree: `D:/trading-agent-dashboard-codex/.local/worktrees/backtester-btc`.
Branch: `workers/backtester-btc-20260929`. Starting commit: `1bb3395`.
User authorization: on 2026-09-29 the user asked for the seven non-Gold asset backtester windows to be built
and opened now - "we first just need to build the 7 VSCs and open them for each backtesting agent" - and
stated that the seven backtesters themselves are built later, "once we have completed and understood all the
lessons from the gold backtesting loop".

## Purpose and lane

This window exists so the BTC lane is registered, open and able to read the project. It is a **readiness and
standby lane, not a build lane**: the BTC backtester is not designed, built, run or frozen here, and no Gold
lesson is treated as settled. Gold paid for the lessons first; this lane inherits them only when the
coordinator publishes them as frozen and the user authorises a build.

Read this as a starting picture and re-verify it from the files rather than trusting it. Nothing here is an
edge measurement, a validated result, or a claim that BTC is one-day ready in practice.

## Scope (stage A - the only authorized work)

One deliverable file and one report:

1. `docs/backtester-btc/READINESS.md` in your own worktree, with these sections:
   1. *Register identity* - worker, assignment, worktree, branch, baseline, window, provider.
   2. *What exists for BTC today* - every claim carries an exact repository path, and where a path is
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

- The 2026-09-24 readiness matrix calls BTC **ready** with a builder, a real checker and a validator; its two
  recorded blockers are that the 24/7 session rule is unfrozen and that the archived snapshots are the only
  recorded source. Read the matrix's own wording rather than this summary; it is read-only at
  `.local/worktrees/backtester-spike/docs/MULTI_ASSET_READINESS_SPIKE.md`.
- Paths to check and then describe accurately: `backtester/scripts/build_backtester_checker_data_btc.js`,
  `backtester/scripts/check_btc_live_replay_24h_parity.js`,
  `backtester/scripts/validate_backtester_checker_btc.js`,
  `backtester/fixtures/btc_live_replay_24h_parity_fixture.json`,
  `data/backtester-checker-btc-24h-2024-2026.json`, `logic/agent_btc_direction.md`,
  `docs/BTC_HANDOVER_CUMULATIVE.md`, `docs/BTC_RATE_LIMIT_INCIDENT_20260909.md`, `exports/btc_*` and the BTC
  workflow exports under `workflows/` if they exist - verify each rather than assuming it.
- The multi-asset platform code that review names (`backtester/lib/asset_adapters.js`,
  `backtester/scripts/run_asset_matrix.js`, `backtester/scripts/run_asset_real_shard.js`) exists **only** on
  `spike/multi-asset-readiness-20260924`, not in the canonical folder, and that submission carries an open
  change request. It is context, never a foundation to build on.
- `backtester/registries/` holds only `gold_*` registries at this commit and no canonical filename contains
  `asset`. Both are checkable facts, not assumptions.

## Owned scope

Write only `docs/backtester-btc/` in your worktree plus ignored scratch under `tmp/` or `backtester/tmp/`.
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
3. record `node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity backtester-btc paused "<what finished>"`;
4. stop. Start no further work until a recorded reply arrives; read it with
   `node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker backtester-btc`.

A blocker is submitted when it is found, not at the end of the task.

## Window and provider

Open `tools/backtester-btc-node/BacktesterBtc.code-workspace` in its own VS Code window, select **DeepSeek** in
the existing agent extension, and run *Mailbox: Connect This Cline Worker* once. This adds no API key, no
credential scope, no provider configuration and no background model runner. The register marks this worker
`mailbox_auto_connect`, so the connection is restored after a reload. Keep exactly one Cline task open in that
window: the bridge binds to the first workspace folder's registered path and has no task selector. The startup
message is in `docs/orchestration/AGENT_MESSAGES.md` and `tools/backtester-btc-node/README.md`.
