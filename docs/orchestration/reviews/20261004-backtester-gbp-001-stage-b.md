# Review: 20261004-backtester-gbp-001-stage-b

Worker `backtester-gbp`, assignment `backtester-gbp-001`, branch `workers/backtester-gbp-20260929`,
worktree `D:/trading-agent-dashboard-codex/.local/worktrees/backtester-gbp`.

- Mailbox submission: `.local/orchestration/inbox/backtester-gbp/20261004-backtester-gbp-001-stage-b.json`,
  22,556 bytes, sha256 `9b0765a48d1f028fdec1e2c8af9d3288d589e083e43d8f871d75b7b25b70ad8e`, re-hashed from the
  immutable inbox file and equal to the requested hash.
- Reply: `.local/orchestration/replies/backtester-gbp/20261004-backtester-gbp-001-stage-b.json`,
  decision `accepted`, `submission_sha256` equal to the inbox hash, published with the canonical CLI.
- Decision: **accepted on the reviewed bytes only.** No assignment is published and the register row keeps
  status exactly `instructions_published_awaiting_worker` under `backtester-gbp-001`.
- Context: this is the fifty-third cycle (background review). The controller run lock names this submission
  (`controller/run.lock` = `{"pid":32960,"submission":"20261004-backtester-gbp-001-stage-b"}`,
  `controller/status.json` state `reviewing`, updated `2026-10-04T16:52:31.936Z`), so the run owns this
  review and no pause or stop was run. A previous cycle (`aa6e6ca`) had already recorded this filing as the
  late stage-B envelope to be reviewed in the next cycle; this cycle reviews it.

## What reproduces, from the artifacts rather than the report

Worktree state, read not trusted: HEAD `1bb3395536fdcf734104dbb40d623e3afecda7fb` on
`workers/backtester-gbp-20260929`, equal to the declared base `1bb3395` and to the register baseline;
`git rev-list --count 1bb3395..HEAD` is 0; `git diff --stat HEAD` is empty; `git status --porcelain=v1`
shows exactly two lines, `?? backtester/importers/gbp/` and `?? docs/backtester-gbp/`. No tracked file
moved, nothing staged, nothing deleted, no remote ref, nothing pushed.

Deliverable 1: `docs/backtester-gbp/READINESS.md`, 52,037 bytes, sha256
`c59f3e2290189107190b3363bf1116b211c3abb1575046cd2c75fa3d5c943fdb`. 607 lines; all nine declared
sections present, in order: 1 register identity, 2 what exists for GBP today, 3 what the Gold loop
requires, 4 ranked blockers, 5 open questions for the user only, 6 explicitly not built, 7 foundation data
with the achieved window, the digest of the load, the gaps, the duplicate-manifest defect record, the
adjacent spine series and the limits; 8 verification evidence; 9 lane status and what happens next.

Deliverable 2: `backtester/importers/gbp/import_gbp_daily.js`, 8,831 bytes, sha256
`e2b3db11af0d5289358552e3107ed6c3b7ed9d256dba4e8e5fef5034f80079af`. 224 lines; imports only
`backtester/lib/historical_common.js`; holds no session policy, no outcome definition, no factor ranking
and no builder; `DEFAULT_MANIFEST_NAME` is pinned to `GBPUSD daily history (OANDA)` with a comment
recording that the earlier shorter name created a second manifest because the manifest natural key is
`(manifest_name, vendor_name, asset_scope)` and `source_manifest_id` is part of the price-row natural key.

Load arithmetic, re-derived from the raw bundle. `backtester/tmp/gbpusd_daily_oanda.csv` is 108,161 bytes
with sha256 `0b088edf01b850199490c86ad10df59be415ccc8d9d536c9776c05bb830e263b`, the same number the
manifest stamped as its bundle checksum. Re-running `backtester/tmp/gbp_load_analysis.js` over it
reproduced every declared figure: series digest
`7e9aea92ad4f1a0e2e4493f315593e894e848a0e635ad4fc97e07058ba842141` (sha256 of sorted
`<date>,<close to 5dp>` lines), parsed 1036, loaded 1036, dropped 0 in every category, coverage
`2022-10-03` to `2026-09-30`, per-year 2022:64 / 2023:259 / 2024:260 / 2025:259 / 2026:194, per-weekday
Mon 206 / Tue 209 / Wed 207 / Thu 206 / Fri 208 with 0 weekend rows, three gaps over three calendar days
(`2022-12-23..2022-12-27`, `2023-12-22..2023-12-26`, `2023-12-29..2024-01-02`), seven missing weekdays all
Christmas Day, Boxing Day or New Year's Day, first close 1.13209 on `2022-10-03` and last close 1.32636 on
`2026-09-30`.

Tests, re-run independently from the worker checkout:
`node --test backtester/tests/gbp_replay_core.test.js tests/layer1-onboarding/gbp_snapshot_contract.test.js
tests/layer1-onboarding/gbp_workflow_drafts.test.js` reads `# tests 20 / # pass 20 / # fail 0`, exit 0,
differing from the filed figure in wall time only. These are the only three test files in the repository
whose names contain `gbp`. The worktree has no `node_modules`, so `npm test`, the documented local suite
and the browser suites are correctly reported as not run rather than claimed.

Repository comparison, re-run: of the fifteen tracked GBP-named paths, exactly one
(`logic/agent_gbp_direction.md`) exists on `origin/main` and the other fourteen do not; the same check
succeeds for `backtester/sql/003_generic_historical_warehouse.sql`, `backtester/lib/historical_common.js`
and `backtester/importers/oanda/download_oanda_candles.js`, which is what makes the `gbpusd` rows
reachable from a production checkout.

## What was not independently verified

The warehouse rows were not re-read. A linked-warehouse operation is not incidental validation and this
cycle did not invoke the credential runner, so the 1,036 rows, the keeper manifest
`4536241d-76d8-499c-8694-259260ab56d9`, the removed duplicate `48f90308-4017-4f07-864c-3c95020f1343` and
the three read-only captures at 16:02:41Z, 16:07:13Z and 16:08:48Z are accepted on the lane's captured
JSON. That evidence is internally consistent and coherent with the local re-derivations above: the repair
trail records a dry run that deleted nothing, then `deleted_rows 1036 / deleted_manifests 1` against a
keeper manifest never touched, then a full re-run submitting 1,036 rows and creating no new manifest, and
the load and idempotency logs both name the keeper manifest, `instrument_key gbpusd`, the requested range
`2022-10-01 -> 2026-09-30`, the achieved range `2022-10-03 -> 2026-09-30` and the bundle checksum
`0b088edf...`. Matching digests and passing tests remain statements about a faithful copy, not about causal
feature timing or trading edge.

## Two questions answered by the canonical record, and one provenance point

The lane's question 3 asked which authorisation governs. The 2026-10-04 seven-lane foundation-build
authorisation governs: `docs/orchestration/DECISIONS.md` opens with the user-authorised publication entry
naming this lane's file at 17,961 bytes / `6594048...`; the seven revisions were published at `da9c2c3`
(2026-10-04T15:56:47+01:00); and the coordinator's `r13` reply
(`replies/backtester-harness/20261004-backtester-harness-seven-lane-authorisation-confirmed-request-r13.json`)
confirms the authorisation record exists and the revisions are published, with `r14`/`r14b` correcting its
figures. The `r10`, `r11b` and `r12` refusals are earlier history, not a competing state of the register.

The lane's question 6 asked whether the pre-existing `gbp` worker is still live. It is not: the register
row `gbp` is a pre-consolidation Layer 1 direction row cut on 2026-09-07, `awaiting_status_submission`,
last verified 2026-09-20, whose worktree is under the old root; `docs/orchestration/README.md` states in
terms that these rows are historical and are never the seven `backtester-<asset>` lanes. The GBP
foundation series is owned by `backtester-gbp` alone.

Provenance point. The assignment digest this envelope re-hashed (17,961 bytes /
`659404845aa50050cbefde4d74dc32bfdc278b7e0e7f9e80771718f0a4365826`) was correct at its read time
(`mailbox_read_at` 2026-10-04T16:34:41Z): it is the CRLF materialisation of the `da9c2c3` revision, and it
is the figure `DECISIONS.md` records. The file was then superseded by the user's NY session-timing
carriage (`1fed2ec` at 2026-10-04T16:47:09+01:00 and `740a3c5` at 16:48:30+01:00), and the canonical
worktree file now reads 19,183 bytes /
`3b7834c4ea7162a4f6df0367d4cdc14de08e7fb5cf0b130cab3de4b365ab16e`, the CRLF materialisation of the
`740a3c5` blob (18,943 LF bytes over 240 lines). Nothing in the filing is wrong; the register's stored
figure is one revision behind the assignment text.

## The precise unresolved decision, and why no assignment is published

The stage-B mandate appended to the assignment - inventory, store the accepted four-year window in the
shared spine under `instrument_key = gbpusd` with one manifest, acquire `2022-10-01 -> 2026-09-30` with
the existing plumbing, prove the load, and file `READINESS.md` plus one envelope - is discharged by this
filing. Nothing further is authorised today.

The precise unresolved decision that gates every downstream GBP step is the user's alone, and it is the
same class of question the EUR and USD replies left open: who defines GBP's measurement, and on what basis
- price source, flat band, session calendar and entry rule, and specifically whether a GBP day is a
close-to-close daily change, which the loaded OANDA daily series can support, or an exact-24-elapsed-hour
open-to-close window, which it cannot support without a second intraday source or an explicitly declared
close-to-close change to the outcome definition. The 2026-10-04 NY session-timing ruling settles the
session clock only. Carried beside it, in the order that gates work:

- Whether a second GBP acquisition round or a second vendor cross-check is authorised (user). The current
  bundle is one vendor's pull over one window and the only integrity check is a hash the lane computed
  itself.
- Whether the branch-local GBP artefacts and the untracked loader are merged toward production before any
  build (user, with the coordinator performing the integration).
- Which copy of `logic/agent_gbp_direction.md` governs - the 5,839-byte blob on the consolidated baseline
  (5,939 bytes as materialised in the lane's worktree, sha256
  `ba28b84c903483c736331e9c23f0a5fea8369710e6ca6e8084f9a15f9c132696`) or the 12,251-byte production blob
  on `origin/main`. They differ not only in size but in F2's input (`uk_2y_d5_bps` against
  `uk_5y_d5_bps`) and F3's input (`us_uk_2y_spread_d5_bps` against `us_uk_10y_spread_d5_bps`), while the
  ten weights are identical at 20/16/20/12/8/10/6/4/2/2. This is a consolidated-baseline versus production
  divergence; this cycle records it precisely rather than declaring a winner.
- For the coordinator: nothing serialises writers on the shared spine. `ensureManifest` upserts on
  `(manifest_name, vendor_name, asset_scope)`, and this lane observed the spine grow from 4,840 to 6,866
  rows between its own reads through two manifests that were not its own.

## Boundaries observed by this cycle

No builder, checker, registry, session policy, outcome definition, factor ranking, adapter or edge claim
was written, changed or run; no worker row moved; no controller, bridge, worker, worktree, artefact, live
path, warehouse, credential, deployment, merge, push or refresh was touched; no outcome, holdout or
prospective observation was read and no final holdout was consumed. Layer 1 stays sealed and independent
and backtesting stays downstream only. Acceptance is of the reviewed bytes only and is not integration,
merge, deployment or a trading-edge claim.