# Backtester harness architect: the shared harness design lane

Assignment: `backtester-harness-001`. Published 2026-09-30.
Worker: `backtester-harness`. Worktree: `D:/trading-agent-dashboard-codex/.local/worktrees/backtester-harness`.
Branch: `workers/backtester-harness-20260930`. Starting commit: `ab21177`.
User authorization: on 2026-09-30 the user asked for another registered agent window called "backtester
harness architect", after the seven non-Gold asset backtester windows were opened on 2026-09-29 as
readiness and standby lanes whose build is deferred.

## Purpose and lane

This is a **design lane, not a build lane**. It owns the architecture question the seven asset lanes cannot
answer separately: what one shared backtesting harness looks like, so that seven asset backtesters are one
harness with asset-specific inputs rather than eight programs that drift apart.

Write no harness code. The harness itself is built later, once the Gold backtesting loop's lessons are
frozen and published and the user authorises the build.

Read this as a starting picture and re-verify it from the files rather than trusting it. Nothing here is an
edge measurement, a validated result, or a claim that any asset is ready in practice.

## Scope (stage A - the only authorized work)

Two documents in your own worktree, plus one report:

1. `docs/backtester-harness/HARNESS_ARCHITECTURE.md` with these sections:
   1. *Register identity* - worker, assignment, worktree, branch, baseline, window, provider.
   2. *What exists today that a harness would have to fit* - the real builders, checkers, validators,
      registries, contracts and runners you find, each with an exact repository path, and a raw-byte
      SHA-256 where the file is hash-bound. Describe nothing from memory or from this assignment's text.
   3. *What one shared harness is for* - the job, its inputs and outputs, and the sentence that says what it
      is deliberately not (no live trading, no order path, no Layer 1 feedback, no production publication).
   4. *Shared versus asset-specific* - what belongs in the harness once and what each asset lane supplies.
   5. *Contracts the harness must not contradict* - the carried Gold contracts, in your own words, with the
      source path for each.
   6. *Exploration versus confirmation* - how the harness keeps exploratory work from becoming accuracy,
      ranking or edge evidence, and what it refuses to do with spent intervals.
   7. *Ranked blockers* - ordered, each with the path that shows it and the owner (user, coordinator, another
      lane, this lane).
   8. *Open questions for the user only* - questions you cannot answer from the repository.
   9. *Explicitly not built* - one short paragraph stating that no builder, checker, validator, registry,
      fixture, session policy, outcome definition, adapter, matrix runner, scheduler or harness source was
      written, changed or run by this lane.
2. `docs/backtester-harness/CONVERSATION_NOTES.md` - what the user decided, what is still open, and what was
   asked but not answered, kept current so a later window can pick the discussion up.
3. One `status_report` envelope submitted through the shared mailbox.

Stage A ends after that submission. Do not begin stage B because stage A finished early.

## Not authorized (stage B - a later, separate user decision)

No builder, checker, validator, registry, fixture, session policy, outcome definition, adapter, matrix
runner, scheduler or harness source may be created, edited or run, here or anywhere else. No acquisition,
import, warehouse, n8n, Layer 1, Layer 2, dashboard, credential, workflow, production or deployment action.
No outcome, holdout or prospective observation may be read. Do not edit the seven asset lanes' folders, the
Gold capture lane, the canonical folder or any other worktree.

## Starting picture to re-verify

- Seven asset readiness lanes exist as registered workers (`backtester-usd`, `-eur`, `-nq`, `-btc`, `-gbp`,
  `-silver`, `-wti`), each writing one `docs/backtester-<asset>/READINESS.md` and building nothing.
- A multi-asset readiness spike was reviewed on 2026-09-24 and left an open change request; read
  `docs/orchestration/reviews/20260924-multi-asset-readiness-spike-001-r1.md`.
- `backtester/` in this repository is the Gold lane's work and is read-only for you.

## Owned scope

Write only `docs/backtester-harness/` in your worktree plus ignored scratch under `tmp/` or
`backtester/tmp/`. Read central state, the dashboard files, the Gold artifacts and other registered
worktrees by absolute path. Never edit the canonical folder, the register, assignments, another worker's
worktree or another worker's mailbox. Submit only through the canonical mailbox CLI.

## Accepted bindings

Re-verify each before relying on it, and say plainly if a claim, path or digest has moved:

- `docs/ARCHITECTURE.md` - Layer 1 stays sealed, independent and upstream; backtesting is downstream only.
- `docs/BACKTESTING_REVIEW_PLAN.md`, `docs/backtester_master_logic.md`, `docs/CORE_RESEARCH_PHILOSOPHY.md`.
- `docs/GOLD_TIMESTAMPED_EVALUATION_CONTRACT.md` with `backtester/docs/gold_timestamped_backtesting.md`;
  `docs/GOLD_RESEARCH_DELIVERY_CONTRACT.md`, `backtester/docs/historical_outcome_evaluation.md`,
  `backtester/docs/variable_event_research_framework.md`.
- `docs/orchestration/reviews/20260924-multi-asset-readiness-spike-001-r1.md` - the open change request, the
  CRLF/raw-byte materialisation finding, and the instruction to group the USD/EUR/NQ/BTC session-policy and
  outcome registries into one later bounded assignment rather than four.

## Evidence and validation

Documentation only, so no test run is required; if you run anything, report the exact command and result. A
fresh worktree has no `node_modules`, so do not run the documented local suite here and do not report its
failures as your own finding unless you reproduce one exactly. Keep raw logs in your own ignored `tmp/`.
State unavailable information explicitly instead of inventing a file, a digest or a result.

## Reporting (mandatory)

Finish only by reporting. On completion, on a blocker or at a decision point:

1. write one envelope from `templates/submission.json` into your own ignored `tmp/` with status
   `ready_for_review`, `blocked` or `status_report`, the observed worktree/branch/base/HEAD, changed files,
   exact commands and results, artifact hashes, blockers, questions and a production disclosure;
2. submit it with `node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <file>`;
3. record `node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity backtester-harness paused "<what finished>"`;
4. stop. Start no further work until a recorded reply arrives; read it with
   `node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker backtester-harness`.

A blocker is submitted when it is found, not at the end of the task.

## Window and provider

Open `tools/backtester-harness-node/BacktesterHarness.code-workspace` in its own VS Code window, select
**DeepSeek** in the existing agent extension, and run *Mailbox: Connect This Cline Worker* once. This adds no
API key, no credential scope, no provider configuration and no background model runner. The register marks
this worker `mailbox_auto_connect`, so the connection is restored after a reload. Keep exactly one Cline task
open in that window: the bridge binds to the first workspace folder's registered path and has no task
selector. The startup message is in `docs/orchestration/AGENT_MESSAGES.md` and
`tools/backtester-harness-node/README.md`.
