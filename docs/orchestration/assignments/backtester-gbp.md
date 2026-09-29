# GBP backtester lane: the window is open, the build is deferred

Assignment: `backtester-gbp-001`. Published 2026-09-29.
Worker: `backtester-gbp`. Worktree: `D:/trading-agent-dashboard-codex/.local/worktrees/backtester-gbp`.
Branch: `workers/backtester-gbp-20260929`. Starting commit: `1bb3395`.
User authorization: on 2026-09-29 the user asked for the seven non-Gold asset backtester windows to be built
and opened now - "we first just need to build the 7 VSCs and open them for each backtesting agent" - and
stated that the seven backtesters themselves are built later, "once we have completed and understood all the
lessons from the gold backtesting loop".

## Purpose and lane

This window exists so the GBP lane is registered, open and able to read the project. It is a **readiness and
standby lane, not a build lane**: the GBP backtester is not designed, built, run or frozen here, and no Gold
lesson is treated as settled. Gold paid for the lessons first; this lane inherits them only when the
coordinator publishes them as frozen and the user authorises a build.

Read this as a starting picture and re-verify it from the files rather than trusting it. Nothing here is an
edge measurement, a validated result, or a claim that GBP is one-day ready in practice - the 2026-09-24
matrix places GBP at *onboarding*, not ready.

## Scope (stage A - the only authorized work)

One deliverable file and one report:

1. `docs/backtester-gbp/READINESS.md` in your own worktree, with these sections:
   1. *Register identity* - worker, assignment, worktree, branch, baseline, window, provider.
   2. *What exists for GBP today* - every claim carries an exact repository path, and where a path is
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
Gold session-policy files and every other worktree untouched - including the historical
`D:/trading-agent-dashboard-codex.worktrees/agent-gbp` lane, which belongs to the registered `gbp` worker and
is read-only for you.

## Starting picture to re-verify

- The 2026-09-24 readiness matrix places GBP at **onboarding**, not ready: replay core only, two files, no
  builder and no checker, with two blockers - the builder and source onboarding are incomplete, and the
  existing work sits outside the canonical backtester. The matrix is read-only at
  `.local/worktrees/backtester-spike/docs/MULTI_ASSET_READINESS_SPIKE.md`; read its own wording.
- Paths to check and then describe accurately: `backtester/replay/gbp/gbp_replay_core.js`,
  `backtester/tests/gbp_replay_core.test.js`, `logic/agent_gbp_direction.md`, `exports/gbp_collector.json`,
  `exports/gbp_layer1_agent.json`, `workflows/gbp_collector.md`, `workflows/gbp_layer1_agent.md`, and the
  Layer 1 onboarding contract under `tests/layer1-onboarding/`. Verify whether a
  `data/backtester-checker-gbp-*.json` or a GBP parity fixture exists before claiming either way.
- The multi-asset platform code that review names (`backtester/lib/asset_adapters.js`,
  `backtester/scripts/run_asset_matrix.js`, `backtester/scripts/run_asset_real_shard.js`) exists **only** on
  `spike/multi-asset-readiness-20260924`, not in the canonical folder, and that submission carries an open
  change request. It is context, never a foundation to build on - and that review records that the adapter
  refuses un-onboarded assets such as GBP.
- `backtester/registries/` holds only `gold_*` registries at this commit and no canonical filename contains
  `asset`. Both are checkable facts, not assumptions.

## Owned scope

Write only `docs/backtester-gbp/` in your worktree plus ignored scratch under `tmp/` or `backtester/tmp/`.
Read central state, the dashboard files, the Gold artifacts and other registered worktrees by absolute path.
Never edit the canonical folder, the register, assignments, another worker's worktree or another worker's
mailbox. Submit only through the canonical mailbox CLI.

## Accepted bindings

Re-verify each before relying on it, and say plainly if a claim, path or digest has moved:

- `docs/ARCHITECTURE.md` - Layer 1 stays sealed, independent and upstream; backtesting is downstream only.
- `docs/BACKTESTING_REVIEW_PLAN.md`, `docs/backtester_master_logic.md`, `docs/CORE_RESEARCH_PHILOSOPHY.md`.
- `docs/GOLD_TIMESTAMPED_EVALUATION_CONTRACT.md` with `backtester/docs/gold_timestamped_backtesting.md`;
  `docs/GOLD_RESEARCH_DELIVERY_CONTRACT.md`, `backtester/docs/historical_outcome_evaluation.md`,
  `backtester/docs/variable_event_research_framework.md`, and `backtester/docs/historical_collector_handoff.md`
  as the collector-side counterpart.
- `docs/orchestration/reviews/20260924-multi-asset-readiness-spike-001-r1.md` - the open change request,
  including the CRLF/raw-byte materialisation finding and the instruction that GBP onboarding and any
  Silver/WTI work stay separate and unauthorised until their data and timing contracts exist.

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
3. record `node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity backtester-gbp paused "<what finished>"`;
4. stop. Start no further work until a recorded reply arrives; read it with
   `node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker backtester-gbp`.

A blocker is submitted when it is found, not at the end of the task.

## Window and provider

Open `tools/backtester-gbp-node/BacktesterGbp.code-workspace` in its own VS Code window, select **DeepSeek** in
the existing agent extension, and run *Mailbox: Connect This Cline Worker* once. This adds no API key, no
credential scope, no provider configuration and no background model runner. The register marks this worker
`mailbox_auto_connect`, so the connection is restored after a reload. Keep exactly one Cline task open in that
window: the bridge binds to the first workspace folder's registered path and has no task selector. The startup
message is in `docs/orchestration/AGENT_MESSAGES.md` and `tools/backtester-gbp-node/README.md`.
