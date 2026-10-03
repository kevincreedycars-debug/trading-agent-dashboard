# Backtester harness architect: the shared harness design lane

Assignment: `backtester-harness-001`. Published 2026-09-30.
Worker: `backtester-harness`. Worktree: `D:/trading-agent-dashboard-codex/.local/worktrees/backtester-harness`.
Branch: `workers/backtester-harness-20260930`. Starting commit: `ab21177`.
User authorization: on 2026-09-30 the user asked for another registered agent window called "backtester
harness architect", after the seven non-Gold asset backtester windows were opened on 2026-09-29 as
readiness and standby lanes whose build is deferred.

**Current assignment: revision 2 (published 2026-10-03, background review).** The
`backtester-harness-001` body below still binds in full, including the design-only lane, the
write scope and the stage-B prohibition. The newest section at the end of this file carries the
current bounded work; the register row in `docs/orchestration/projects.json` keeps the id
`backtester-harness-001` and carries status exactly `instructions_published_awaiting_worker`.

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

## Revision 2: the coordinator's two design decisions, recorded, and the production re-base (2026-10-03)

The r9 filing is accepted and the two r3 corrections of record are closed. Nothing in this section
authorises a build, an acquisition, a warehouse write, a migration, a dashboard edit, an n8n change,
a credential action or a publication. It is design and measurement only, inside
`docs/backtester-harness/` plus ignored `tmp/`.

Two decisions are now the coordinator's of record. They were taken this cycle on the evidence in
your own documents and on the schema that already exists. Record them as decided, not as open
choices:

1. **The store shape is the shared spine.** `historical_price_series` for price rows and
   `historical_macro_series` for the macro and FRED block, one row set per instrument, with the
   lowercase `instrument_key` convention the r7 reply settled (`eurusd`, `xauusd_spot`,
   `qqq_nq_proxy`, `btc_usd_spot`, legacy `gold_spot_usd`) and only the two missing siblings
   `gbpusd` and `xagusd_spot` to add; the uppercase `XAUUSD`, `BTCUSD` and `QQQ_NQ_PROXY` strings
   stay as evaluation-layer labels only. Rows are appended, never rebuilt, and the eleven deferred
   non-`/USD` crosses must stay appendable without a per-asset table or a further migration. Seven
   Gold-shaped per-asset tables are rejected: seven tables cannot hold the eleven deferred crosses
   without eleven more migrations.
2. **The shared USD macro block and the FRED pull are one owner and one pull**, not seven, which
   confirms what r7 answered in principle. Publishing or running that acquisition is not part of
   this assignment; it waits on a user-authorised cycle.

Before either decision is written back into the documents, re-verify it against the files, not
against this text: the `historical_price_series` and `historical_macro_series` definitions in
`backtester/sql/003_generic_historical_warehouse.sql` (including the `daily` interval constraint
your own section 11 item 8 records), the six importers and five builders that already read the
spine, and the keys production already holds. If anything contradicts a decision, say so plainly
in the submission as a blocker rather than reinterpreting it.

Bounded work, all docs-only:

1. Fold decision 1 into `docs/backtester-harness/FOUNDATION_BUILD_WORK_ORDER_20261003.md` - at
   least section 5 and the section 7 blocker table, plus section 2.1 where the store is described -
   and into `docs/backtester-harness/ASSET_DATA_AND_TABS_PLAN.md` where the store shape is stated.
2. Fold decision 2 into the same two documents, naming it as the coordinator's confirmation of the
   r7 answer rather than as a new question.
3. Re-base the production-facing figures that can now be re-measured against the current
   `origin/main` head `a94fb550` ("site-nav: one canonical top bar and side rail on all nine
   published pages", 2026-10-03T18:53:09+01:00, 1,024 commits, 16 paths and 1,729 insertions ahead
   of `f8bc80f`): `RAIL_ACCORDION_SPEC_20261003.md` section 1 at least, and any other line you
   judge stale, keeping every figure that is kept at `f8bc80f` labelled as that head. Record the
   generated-rail edit path in the spec: the rail is rendered from
   `backtester/partials/shared_nav.html` by `backtester/scripts/build_shared_nav.js`, whose
   `--check` mode compares bytes and is guarded by
   `backtester/tests/site_nav_consistency.browser.test.js`, so the change belongs in the partial or
   in the generator and must never be hand-edited into `index.html`.
4. Land all of it in exactly one docs-only commit inside `docs/backtester-harness/`, on top of
   `81977eb`; commit nothing else, edit no other lane's files, push nothing, and declare the new
   head in the envelope. File one submission when it lands, or one blocker the moment you find
   something that contradicts a decision.

Still not yours and still not authorised: publishing the rail accordion to production, and the n8n
executor and its scope, new backtester-side flows only or also the production Layer 1 model swap.
Both need a user-authorised cycle; do not prepare or attempt either.

Then report as usual: one envelope, `monitor-state.js activity backtester-harness paused "<what
finished>"`, and stop.
