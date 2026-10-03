# Review: 20261003-backtester-harness-foundation-build-work-order-r3

- Worker: `backtester-harness`, assignment `backtester-harness-001`. Lane authority unchanged: design documents
  inside `docs/backtester-harness/` plus ignored `tmp/`; Stage B stays closed and the seven asset lanes stay
  readiness lanes that build nothing.
- Mailbox submission: `.local/orchestration/inbox/backtester-harness/20261003-backtester-harness-foundation-build-work-order-r3.json`,
  19,642 bytes, sha256 `2770c5475ece8123f6e077a6687c740d8c709d91090bfd58a250872bb37eb699` - reproduced from the
  immutable inbox file rather than taken from the envelope.
- Reply: `.local/orchestration/replies/backtester-harness/20261003-backtester-harness-foundation-build-work-order-r3.json`,
  6,101 bytes, sha256 `d588f7e42cb966c3f7b425c3405a77e0bcf268c36d80dd2988b1817a643c8d32`.
- Decision: **accepted**, on the reviewed bytes only, as a docs-only status report. No Stage B, build,
  acquisition, import, warehouse, n8n change, credential action, dashboard edit, integration, publication or
  deployment follows from this review, and no assignment is published.
- Reviewed by the background coordinator run that owns the controller lock on 2026-10-03 (dispatch state
  `reviewing 20261003-backtester-harness-foundation-build-work-order-r3`, pid `8184`, `activeRun true`). No
  subagent, no controller or bridge change, no other coordinator process, no production action, no warehouse
  mutation, no holdout or prospective observation read.

## Inspected material

Reported HEAD `ef8019bf6b47ebe66de31b1552a012c32f5640e9` (committed 2026-10-03 17:03:29 +0100; envelope filed
17:05:44); base `b778c956b6c7857be070c4e43954f3d61bff662e`; worktree
`D:/trading-agent-dashboard-codex/.local/worktrees/backtester-harness`, branch
`workers/backtester-harness-20260930`. Changed set at that head: exactly the three declared files -
`docs/backtester-harness/FOUNDATION_BUILD_WORK_ORDER_20261003.md` (added, 513 lines),
`docs/backtester-harness/CONVERSATION_NOTES.md` (+45) and `docs/backtester-harness/ASSET_DATA_AND_TABS_PLAN.md`
(+38) - measured as 3 files / 596 insertions / 0 deletions between the base and `ef8019b`. Companions declared
unchanged: `RAIL_ACCORDION_SPEC_20261003.md`, `HARNESS_ARCHITECTURE.md`, `DATA_ANALYSIS_STRATEGY.md`,
`ASSET_ENGINE_CYCLE_TIME_PLAN.md`. The envelope carries the user's 2026-10-03 second message verbatim as the
authority for two things: the rail accordion publish, and a per-asset four-year foundation acquisition for the
seven non-Gold lanes. The submission is evidence of that instruction, not itself an authority to act.

## Independent checks that reproduce

- The commit chain is a real descendant path: `b778c95` is an ancestor of `ef8019b` through `3d362b3` and
  `ef8019b`, and the declared changed set is exactly the three files `git diff` reports.
- Every declared raw-byte digest reproduces byte-exactly at `ef8019b` in its CRLF materialisation, with the
  matching git blob, from the LF blob form plus one CR per line: work order `c21dd558...` at 40,294 bytes /
  513 lines (blob `1ab68274`, LF 39,781); `CONVERSATION_NOTES.md` `36e79d48...` at 20,347 / 290 (blob
  `396ef3f6`); `ASSET_DATA_AND_TABS_PLAN.md` `db68299e...` at 28,241 / 383 (blob `a03e1c24`).
- The four companions reproduce unchanged: `RAIL_ACCORDION_SPEC_20261003.md` 16,995 / `d4f0bbdd` / `4a3491c9`;
  `HARNESS_ARCHITECTURE.md` 46,554 / `34160779` / `3548290a`; `DATA_ANALYSIS_STRATEGY.md` 13,198 / `e6e9d2fa` /
  `fb204d49`; `ASSET_ENGINE_CYCLE_TIME_PLAN.md` 11,878 / `bfc73213` / `b0b5061a`.
- The worktree is clean (`git status --porcelain` prints nothing), so `dirty_files: []` is a fact of the tree,
  and the branch still has no upstream, so nothing was pushed.
- Production claims re-measured by the coordinator from `origin/main` at
  `f8bc80fe1d44a050ebfc247b24ae21cfe2bbbf852` (2026-10-03 15:30:19 +0100, 1,023 commits; `git merge-base
  --is-ancestor origin/main HEAD` exits 1), not read from the envelope: `logic/agent_silver_direction.md`
  5,542 B / blob `40d96173`, `logic/agent_wti_direction.md` 6,596 / `2a7acc88`, `logic/agent_gbp_direction.md`
  12,251 / `a6908930`, `logic/agent_usd_direction.md` 28,952 / `fafa21c9`; `origin/main:data/layer1.json`
  carries eight agents in an `agents` array with `dashboard_meta.last_updated_et` `2026-10-02T07:29:28.874Z`;
  five replay directories only (`usd`, `eur`, `nq`, `btc`, `gold`), so no `gbp` replay directory exists;
  exactly five gold-named files under `backtester/scripts` against the lane worktree's 41;
  `backtester/registries` holds nothing and `backtester/lib` holds eleven files with no session-policy library;
  `docs/backtester-<asset>/` does not exist; `backtester/sql` holds ten migrations with
  `003_generic_historical_warehouse.sql` at blob `08965449` whose `interval` check constraint accepts
  `intraday`, `daily`, `weekly` and `monthly` (so `daily`, not `1d`) and whose natural key is
  `(instrument_key, interval, observed_at, source_manifest_id)`; `backtester/importers` holds ten preset
  directories (`binance`, `btc`, `crypto_fear_greed`, `eurusd`, `fred`, `germany_2y`, `gold`, `oanda`, `qqq`,
  `usd_events`) with no `gbp`, `silver` or `wti`; and the published checker artifacts parse to USD 604 / EUR
  602 / NQ 604 / BTC 850 / GOLD 608 rows, all `2024-01-02 -> 2026-04-30`, with the NQ, BTC and GOLD benchmark
  and session fields the work order attributes to them. The withdrawn `2026-06-30` / 610-row Gold figure is
  correctly dropped and the `daily`-not-`1d` correction is right.
- Blob and size checks hold for the acquisition and store files the work order cites:
  `backtester/importers/gold/import_gold_daily.js` `bfa2228e` / 10,520 B,
  `backtester/importers/oanda/download_oanda_candles.js` `1e978413` / 6,396 B,
  `backtester/importers/fred/import_fred_macro.js` `0412084e` / 10,538 B,
  `backtester/lib/historical_common.js` `b67c9f03` / 8,163 B,
  `backtester/scripts/build_backtester_checker_data_gold.js` `7a16b627` / 18,993 B,
  `backtester/sql/008_gold_historical_market_snapshots.sql` `22580d80` / 4,252 B.
- The document itself is a request and a specification, not a build: section 5.2 is a paste-ready per-lane
  assignment block with placeholders and explicit non-goals (no factor ranking, no session policy, no outcome
  definition, no Layer 1 or Layer 2 wiring, no dashboard file, no production publish), section 8 lists
  checkable per-lane acceptance, and section 11 lists the eight carried corrections.

## Defects the r1 review raised that these bytes close

- **Wrong-tree per-asset inventory (r1 defect 2) and the reverse GBP error (r1 defect 3): closed.** Every
  corrected claim reproduces from `origin/main`, including the Silver and WTI factor documents, the eight-agent
  `data/layer1.json`, the absent production `gbp` replay directory, the branch-local session policy, verifier
  and scorecard, and the branch-local-versus-production gold-script count.
- **Section 8 and the Silver and WTI framing (r1 defect 4): closed.** The framing is now store-first, and the
  real gap is stated as the backtester-side store rather than a missing factor contract.
- **Gold checker window (r2 defect 4): closed.** Both trees give `2024-01-02 -> 2026-04-30` with 608 rows; the
  earlier `2026-06-30` / 610 figure is withdrawn in the work order and in the plan's appended corrections.
- **Materialisation statement (r1 defect 5) and the interval value: closed.** Digests are declared CRLF-form
  and reproduce as such, and the store uses `daily`.
- **The undeclared-trailing-commit class (r1 defect 1): not repeated in this filing.** `ef8019b` was the branch
  tip when the envelope was filed, and the envelope declares it with digests.

## Corrections of record

1. **Production `gold-direction-scorecard.html` size is wrong, and it appears twice.** The work order's section
   2.3 and the folder summary, and the appended corrections bullet in `ASSET_DATA_AND_TABS_PLAN.md`, state that
   production carries `gold-direction-scorecard.html` at 5,733 bytes. Measured from `origin/main`:
   `gold-direction-scorecard.html` is **143,102 bytes at blob `d2af334d`**, and 5,733 bytes is `gold.html` at
   blob `d9045914`. The figure must be corrected or dropped when either section is next revised. It is the same
   class of production-inventory figure r1 refused, but it is a non-load-bearing side remark: it changes no
   ingredient, parity row, decision or acceptance check.
2. **`931 commits on the worker branch` is a mislabel.** Section 0 says the lane branch carries 931 commits
   against `origin/main`'s 1,023. Measured: the lane branch is **914 commits at `ef8019b`** (912 at the base
   `b778c95`, plus `3d362b3` and `ef8019b`), while **931 is the canonical control-plane checkout's count at the
   read time** (1,023 on `origin/main`, so `origin/main` diverges by more than the branch's own extra commits).
   The genuinely load-bearing claim - `origin/main` is not an ancestor of this branch - reproduces. Label the
   count by tree in the next revision.

Neither correction changes a production-versus-branch claim, and neither is load-bearing for the work order, so
both are recorded rather than treated as blocking.

## The reviewed head is no longer the branch tip

`a351f0c521f580f14324c962a18f6cae880fa6ff` was committed at 2026-10-03 17:10:16, after this filing, changing
`CONVERSATION_NOTES.md` (+29) and the work order (+18/-3); the current worktree copies are the work order at 528
CRLF lines / 41,688 bytes (`88a7cafd`) and the notes at 319 CRLF lines / 22,628 bytes (`410a88c2`). That commit
is disclosed in the lane's own pending filing `20261003-backtester-harness-hold-divergence-r5` (8,243 bytes,
sha256 `8d19b71ee8b954dd9758beed5c411da1574de54021b2c53644575bbb06e6174c`) and is not adjudicated here. The
r2 reply's hold at `ef8019b` continues on the document set this review accepted.

## Pending filings left untouched

Four filings for this lane remain `pending_review` and are not reviewed here: `20261003-backtester-harness-user-decisions-r4`
(11,326 bytes), `20261003-backtester-harness-hold-divergence-r5` (8,243 bytes),
`20261003-backtester-harness-user-scope-and-n8n-ownership-r6` (12,229 bytes) and
`20261003-backtester-harness-nq-series-decision-r7` (13,470 bytes). They are the next cycle's items.

## No assignment published, and why

No assignment is published and the register keeps this lane off any publish state. The work order's own section
6 queue items are prerequisite decisions, and none is executable by this background run: publishing the rail
accordion is a production dashboard change; the store shape (shared spine versus seven Gold-shaped tables), the
one-assignment-versus-seven question and the ownership of the single shared USD and FRED pull, and the window
reading (Reading A `2022-10-01 -> 2026-09-30` with achieved starts recorded versus Reading B the spans already
on disk) are coordinator and user choices; and the DeepSeek part needs a user credential action in n8n, which
holds no DeepSeek credential today, with the production Layer 1 model-node swap additionally requiring explicit
authorisation and a strict-JSON validation pass. The seven lanes cannot be woken by unchanged assignment
content, so any eventual publication needs a new content hash, and publishing before those decisions would
either duplicate the shared pull seven times or assign build work that the seven readiness lanes are not
authorised to do while this lane's Stage B stays closed.

## Integration and deployment status

Nothing is integrated, merged, published or deployed by this review. The lane keeps design-only authority inside
`docs/backtester-harness/` plus ignored `tmp/`, Stage B stays closed, and no outcome, holdout or prospective
observation was read. Layer 1 stays independent and backtesting stays downstream only.
