# Review: 20261003-backtester-harness-corrections-and-production-move-r9

- Worker: `backtester-harness`, assignment `backtester-harness-001`. Lane authority unchanged: design documents
  inside `docs/backtester-harness/` plus ignored `tmp/`; Stage B stays closed and the seven asset lanes stay
  readiness lanes that build nothing.
- Mailbox submission: `.local/orchestration/inbox/backtester-harness/20261003-backtester-harness-corrections-and-production-move-r9.json`,
  19,278 bytes, sha256 `747bd86445bcbfab76f3265a51034b47b0d3ae93e296286b64f1e8877d9c5c77` - reproduced from the
  immutable inbox file rather than taken from the envelope, and equal to the requested hash.
- Reply: `.local/orchestration/replies/backtester-harness/20261003-backtester-harness-corrections-and-production-move-r9.json`,
  6,532 bytes, sha256 `a1a8e99c3f2fa6a2df13a13fa71b61f8e05c0fee7f0917077af2909d50bb4f20`, decision `accepted`,
  published with `node scripts/coordination.js reply`; `check --worker backtester-harness` then reports
  `pending 0`, `errors: []` and this submission `accepted`.
- Decision: **accepted**, on the reviewed bytes only. No Stage B, build, acquisition, import, warehouse, n8n
  change, credential action, dashboard edit, integration, publication or deployment follows from this review.
  One bounded docs-only assignment is published with it - revision 2 of `backtester-harness-001` - and two
  design decisions are taken as records; neither authorises a build, a migration or a warehouse write.
- Reviewed by the background coordinator run that owns the controller lock on 2026-10-03 (controller state
  `reviewing 20261003-backtester-harness-corrections-and-production-move-r9`, pid `8184`, `status.json`
  updated_at 20:03:59.917Z, `run.lock` present). No subagent, no controller or bridge change, no controller
  pause or stop, no other coordinator process, no production action, no warehouse mutation, no holdout or
  prospective observation read.

## What the filing is

This is a docs-only `status_report` that discharges the two r3 corrections of record in a single commit and
records one thing it found while doing so: production moved underneath these documents the same evening. It
reports commit `81977eb`, the four revised documents with their before and after blobs and byte counts, the
corrected scorecard size and the replaced section 0 commit label, a dated addendum for the production move, a
dated note in the accordion spec, and its own limits - nothing pushed, `npm test` not run because the worktree
has no `node_modules`. It closes with six blockers, five of them the coordinator's, and five numbered
questions.

## Independent checks that reproduce

- HEAD is `81977eba0ee096902e964b95b94f96bbcbacbe5e` with sole parent `928a42d162780342fade8c01145e0531f867f8bd`,
  on `workers/backtester-harness-20260930` in `.local/worktrees/backtester-harness`. `git show --numstat 81977eb`
  is exactly the four declared documents - `ASSET_DATA_AND_TABS_PLAN.md` 9/4, `CONVERSATION_NOTES.md` 41/8,
  `FOUNDATION_BUILD_WORK_ORDER_20261003.md` 44/8, `RAIL_ACCORDION_SPEC_20261003.md` 12/0, 106 insertions and 20
  deletions - and no path outside `docs/backtester-harness/` is touched.
- `git status --porcelain --untracked-files=all` prints nothing and `git rev-parse --abbrev-ref "@{upstream}"`
  fails with no upstream configured, so nothing was committed dirty and nothing was pushed.
- All four documents reproduce byte-exactly at the declared digests, line counts, CRLF counts and blobs, with
  zero bare LF: work order 51,460 / 617 / 616 /
  `324bb03c8b07d234e1ceee069495d706bedfe25a72ea65e589fde2e03d1279f1` / blob `6c2bab06` from `a2511a81`; notes
  30,485 / 411 / 410 / `0217542435c141dbd4e8990a0596f5c915233d722a6b0588542b58edc690607d` / `52c902af` from
  `5d736d08`; plan 28,788 / 389 / 388 /
  `d6e9817600719b8352e2b7a4c99b68afcd8b51dd7ba5e326443596f2b53af8e2` / `ddae2359` from `a03e1c24`; spec
  18,108 / 376 / 375 / `40410638b7cb17ce1324b736a4033bf06dd7f475223c4ebf629cb737c58102ea` / `d241482c` from
  `4a3491c9`. The two documents this commit does not touch are unchanged at `bfc73213`/`b0b5061a` and
  `e6e9d2fa`/`fb204d49`, and `HARNESS_ARCHITECTURE.md` stays at 46,554 / `34160779` / `3548290a`.
- The two r3 corrections of record are discharged, re-measured here from production rather than read from the
  envelope: `git cat-file -s f8bc80f:gold-direction-scorecard.html` is 143,102 at blob `d2af334d`, and
  `git cat-file -s f8bc80f:gold.html` is 5,733 at blob `d9045914`. After the edit every remaining `5,733` hit in
  `docs/backtester-harness/` attributes that size to `gold.html`, the scorecard figure appears correctly in the
  work order section 0 and 2.3, the plan and the notes, and `931 commits` survives only inside the addendum
  that records it as the rejected figure.
- The production move reproduces exactly. `origin/main` is `a94fb55030d67cff0a76ea04e92482bf7bc838f6`,
  "site-nav: one canonical top bar and side rail on all nine published pages", 2026-10-03T18:53:09+01:00;
  `git diff --stat f8bc80f a94fb550` is 16 files, 1,729 insertions and 55 deletions, and `--name-status` is the
  same 16 paths the addendum lists. Sizes and blobs at both heads re-measure as declared: `index.html` 18,775
  (`45f8b42a`) to 24,821 (`8270cd4f`), `gold.html` 5,733 (`d9045914`) to 14,388 (`31a68321`),
  `gold-direction-scorecard.html` 143,102 (`d2af334d`) to 151,757 (`894bf469`), `script.js` 748,620
  (`5190c40f`) to 749,575 (`e6953dad`), and `styles.css` byte-identical at 201,976 (`e5453d06`). The generated
  rail is real: `backtester/partials/shared_nav.html` 13,019 (`0c10cae1`),
  `backtester/scripts/build_shared_nav.js` 9,445 (`0b49090c`) and
  `backtester/tests/site_nav_consistency.browser.test.js` 21,164 (`2cc4779f`) all exist at the new head and none
  of them exists at `f8bc80f`.
- The commit counts reproduce as written: 917 at HEAD, 916 at `928a42d`, 915 at `a351f0c`, 914 at `ef8019b`,
  726 at `125d871`, 190 for `125d871..928a42d` (191 at the new HEAD), 297 for `125d871..f8bc80f`, 1,023 at
  `origin/main` `f8bc80f` and 1,024 at `a94fb550`, with `origin/main` not an ancestor of this branch.
- The lane's own limit is accurate rather than an omission: this is documentation only, the worktree has no
  `node_modules`, and the mailbox suite validates the envelope at submit time.

## What was accepted

- **The landed commit as record.** One docs-only commit on top of `928a42d` that touches only
  `docs/backtester-harness/`, folds the two r3 corrections into the sections that carry them, keeps the
  `f8bc80f` basis labelled wherever it is kept, records the production move as another lane's publication
  rather than its own, and leaves everything else alone. Nothing is pushed and no production file is touched.
- **The production-move handling.** Re-measuring the moved head and recording its consequence for the
  accordion - the rail is now a generated block, so an edit belongs in the partial or the generator and never
  in `index.html` - is exactly the right response to a change it did not cause and cannot control.

## Corrections and precision notes

- **Non-blocking, no re-file owed.** The section 0 note reads the r3 review's count of 914 as "one below the
  measured 915 at `a351f0c`". 914 is the count at `ef8019b`, the parent of `a351f0c`, so both figures are
  correct for the ref each names; the sentence is corrected the next time that line is revised, and the
  commands stay named so the reviewer can settle it.
- **Closed.** The two r3 corrections are applied and no other correction of record is outstanding on this
  lane's side.

## Decisions taken this cycle, as design records only

Both had sat open across the r5, r6, r7 and r8 cycles as the coordinator's to take. They commit nothing: no
table, migration, importer, loader, builder, checker, registry, session policy, outcome definition, adapter,
matrix runner, scheduler or harness source, no acquisition, no import, no warehouse write, no production edit.

1. **The store shape is the shared spine** - `historical_price_series` for price rows and
   `historical_macro_series` for the macro and FRED block, one row set per instrument, on the lowercase
   `instrument_key` convention r7 settled (`eurusd`, `xauusd_spot`, `qqq_nq_proxy`, `btc_usd_spot`, legacy
   `gold_spot_usd`) with only `gbpusd` and `xagusd_spot` to add and the uppercase market keys kept as
   evaluation labels; append-not-rebuild, with the eleven deferred non-`/USD` crosses appendable without a
   per-asset table or a further migration. Seven Gold-shaped per-asset tables are rejected. The schema already
   exists and already carries both spines, `backtester/sql/003_generic_historical_warehouse.sql`, with six
   importers and five builders reading it.
2. **The shared USD macro block and the FRED pull stay one owner and one pull**, confirming r7 in principle.
   Publishing or running that acquisition is not authorised here and waits on a user-authorised cycle.

## The assignment published

Revision 2 of `backtester-harness-001` is published and the register row now carries status exactly
`instructions_published_awaiting_worker`. It is docs-only and read-only: fold the two decisions into
`FOUNDATION_BUILD_WORK_ORDER_20261003.md` (section 5 and the section 7 blocker table at least, plus section 2.1)
and `ASSET_DATA_AND_TABS_PLAN.md`; re-base `RAIL_ACCORDION_SPEC_20261003.md` section 1 on `a94fb550`, keeping
the kept figures labelled, with the generated-rail edit path recorded; land it in exactly one docs-only commit
inside `docs/backtester-harness/` on top of `81977eb`; push nothing; declare the head; file one submission, or
one blocker the moment something contradicts a decision. The lane paused before this review, so the assignment
is published and not yet started, and its wake is the reply this cycle published.

## Not this cycle's, and not this lane's

- The production rail-accordion publish: user-authorised and executor-ready, but a production dashboard change
  a background run may not make, and at the new head the edit belongs in the generated block.
- The n8n executor and its scope - new backtester-side flows only, or also the eight production Layer 1 model
  nodes - which needs a credential action and a strict-JSON validation pass, both outside this run.
- The seven-lane foundation revision itself: a build-and-acquisition assignment that would mutate the
  warehouse, which this background run has no authority to authorise. It waits on the user.
- Layer 1 stays independent and backtesting stays downstream only; a shared store, a re-based spec or a
  passing local suite is not edge, accuracy, causal feature-timing or live-deployment evidence, and no
  outcome, holdout or prospective observation was read.

## Integration and deployment status

Nothing is integrated, merged, published or deployed by this review. The lane keeps design-only authority
inside `docs/backtester-harness/` plus ignored `tmp/`, Stage B stays closed, and the seven asset lanes stay
readiness lanes that build nothing.