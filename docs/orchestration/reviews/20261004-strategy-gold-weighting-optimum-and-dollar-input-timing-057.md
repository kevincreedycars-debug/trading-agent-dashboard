# Review: 20261004-strategy-gold-weighting-optimum-and-dollar-input-timing-057

- Worker / assignment: `strategy` / `strategy-advisory-001`
- Mailbox: `.local/orchestration/inbox/strategy/20261004-strategy-gold-weighting-optimum-and-dollar-input-timing-057.json` - 24,639 bytes, sha256 `a6024d231e6844c78dce8c276d62a3d033cef3441dd0219703de44c229c03733` (reproduced from the immutable inbox file; equal to the requested hash).
- Reply: `.local/orchestration/replies/strategy/20261004-strategy-gold-weighting-optimum-and-dollar-input-timing-057.json` - decision **accepted**, 5,756 bytes, sha256 `ca3775bb8e362689847e8e91700ca89581e9bde07935c90bca9ea38561651172`, its `submission_sha256` equal to the inbox hash above, mtime `2026-10-04T15:01:01.054Z`. **This reply was published by a concurrent interactive coordinator activity in the same canonical checkout, not by the dispatched background turn that holds this submission's controller lock.** The background turn's own draft reply (11,121 bytes, sha256 `50f1d916047632e3fcab91eeed88da261243c5af1b55e7da6beec47d81095260`) was offered to the canonical CLI and **refused with EEXIST**, because `publish()` links its temporary file onto the destination with `fs.linkSync` and a reply is single-published by construction; no second reply exists and none should be looked for.
- Thread partner: `20261004-strategy-gold-weighting-table-denominator-clarification-058`, reply 4,050 bytes at sha256 `eadd582033544c54956e87a4c2388f3886617bc1a815d0b9c50d4dbdb9682573`, mtime `2026-10-04T15:01:01.169Z`, also published by the concurrent pass.
- Cycle: 2026-10-04, forty-fourth coordination cycle, dispatched background run, from the canonical checkout on branch `orchestration/control-plane-20260920`, under the controller lock for this submission (`controller/status.json` state `reviewing`, detail this submission, updated `2026-10-04T14:58:00.582Z`; the turn is the `codex exec` process pid 8016 launched by `scripts/coordinator-dispatch.js serve` pid 32960).
- Assignment published by this review: **none**. `strategy` stays `advisory_active` under `strategy-advisory-001`, and no worker status changed. `projects.json` was not touched.
- After this cycle `check` reports the whole mailbox at `pending 0` with `errors []`.

## What was filed

A `ready_for_review` docs-only advisory answering the user's three questions - what the optimal Gold weighting actually is, why the ten declared Gold factors show nothing predictable on gold, and whether factors are missing - read-only from artifacts already on disk. One commit on `workers/strategy-advisory-20260920`, base `95f4793`, head `4ffa618`:

- `docs/strategy/GOLD_WEIGHTING_OPTIMUM_AND_FACTOR_GAPS_20261004.md` - 324/0.
- `docs/strategy/CONVERSATION_NOTES.md` - 100/0.

424 insertions, 0 deletions, inside `docs/strategy/` only, tree clean. The lane declares no live system, weight, collector, dashboard file, register entry, assignment or other worker worktree, no credential, no sealed-window read and no weight change anywhere; every rate it prints is an exploratory advisory measurement, not edge, accuracy qualification or live-deployment evidence.

## Scope and artefacts reproduced from the checkout

- `git` in `.local/worktrees/strategy`: `4ffa618` is exactly one commit past the declared base `95f4793` (`rev-list --count` 1), `git show --numstat` names exactly the two declared files (324/0 and 100/0; 424 insertions, 0 deletions), and `4ffa618` is an ancestor of the branch tip, which has since advanced to the lane's own 058 commit `3815ee2` (9 insertions, 4 deletions on the same document). `git ls-remote origin` reports the remote tip of `workers/strategy-advisory-20260920` as exactly `3815ee26617cfa1001baf626c395f45439bb25b2`, so the `-057` push landed.
- Both artefacts reproduce byte-exactly at the filed head, re-derived from the committed blobs with `core.autocrlf=true` materialising the working-tree form rather than taken from the filing: the weighting document is 23,779 bytes, 324 CRLF endings, 0 bare LF, sha256 `dd513ba85883cbeb62c02a3aecfffd39a240c034b9b1c1fbf14f77ae84f4430a`; the conversation notes are 364,384 bytes, 3,917 CRLF endings, 0 bare LF, sha256 `921c20c73eb94d486d0ddbb75f24293221efa53fea85903001f16b5ae5e561d8`.
- Every cited source artifact reproduces at the filed size and digest: `data/backtester-checker-gold-24h-2024-2026.json` 9,091,206 / `9b4fbd4fd958c4f86f8d70d853990e16d335a0043c0304059699a25d5f693586`; `data/gold-direction-scorecard-20260927.json` 186,490 / `639bb9334cc5abee`; `backtester/tmp/gold-fred-extended-20260918/DTWEXBGS.json` 212,191 / `51064923587d8c2b`; `backtester/tmp/gold-hourly-extended-20260918/candles.json` 6,047,843 / `20ff2299f8c8d422`; `logic/agent_gold_direction.md` 7,794 / `fd6e2aac6915c7f0`; `backtester/builders/gold/build_gold_historical_snapshots.js` 18,584 / `df4cd99c97732992`. The declared ten-factor weighting 22/18/14/8/8/10/6/6/6/2 also reproduces from `logic/agent_gold_direction.md` lines 105-114.

## The sample facts re-derive

Re-computed from the 608 stored rows of the checker artifact, not taken from the document:

- 563 rows carry a usable 24h window (42 rows have no usable open/close pair and 3 more carry prices while stored `NOT_EVALUABLE`, giving the stated 45). Of those, 251 are up days, 163 down and 149 inside the 0.3% band, so 251 of 414 non-flat days are up, **60.63%**; mean 24h move **+0.1671%**, standard deviation **1.0988%**, t = 3.61.
- The stored `evaluation_result` histogram is CORRECT **223**, WRONG **173**, FLAT **141**, NOT_EVALUABLE **45**, NO_CALL **26**, so 396 stored calls carry an outcome and 223 are correct, **56.31%**.
- The per-factor table reproduces row for row from the per-row `factor_comparisons` on the 563 usable windows: F1 307 speaking days at **53.39%**, F2 288 at **71.95%**, F4 323 at **56.67%**, F5 363 at **50.74%**, F6 278 at **39.71%**, F7 12 at **71.43%**, and F3, F8, F9 and F10 neutral on every one of the 608 days - the 28 of 100 weight points that never fire.
- Contiguity reproduces: 607 of 607 consecutive row pairs have the next open equal to the previous close to the cent. The filing quotes 565 of 565 on the narrower denominator of rows carrying a window; the property is the same and holds at 100%.

## The load-bearing timing claim reproduces independently

This is the verification the already-published reply explicitly declined to perform, and the one this review adds. Building the local FRED `DTWEXBGS` observation series from its vintages (earliest published value per observation date) and aligning it to the stored F2 vote:

- On every F2-speaking row whose **same-day** broad-dollar change exceeds 0.3% in absolute value, the stored vote is exactly the negation of that same-day change on **138 of 138 days (100.00%)**; restricted to the 98 of those rows that also carry a window and a non-flat outcome it is **98 of 98**.
- Against the **next** day's change the agreement is 52.90%, i.e. a coin flip, which is what distinguishes a same-day reading from a lagged one.
- The structural half of the claim is confirmed from the builder source only, exactly as the filing scopes it: `backtester/builders/gold/build_gold_historical_snapshots.js` derives each input with `previousValue(series, snapshotDate, n)` against `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` and the snapshot table `historical_gold_market_snapshots`, which is not readable from this checkout, so the filing's statement that the owning worker should confirm it stands.

## Note of record

The submission **summary** sentence "the stored dollar reading equals the negation of that same day's dollar change on 101 of 101 days where the change exceeds 0.3% (138 of 138 on the looser filter)" inverts its own two filters against the envelope's own `tests` entry, which gives n 138 for the 0.3% filter. Reproduced: **138 of 138 at 0.3%**. Both readings are 100%, the document states both of its own numbers on the filters it names, and no conclusion moves.

## Decision

**Accepted** on the reviewed bytes only, as the docs-only advisory it declares itself to be. The finding stands and is now reproduced rather than trusted: the archive's in-sample "optimum weighting" is not a weighting but all the weight on the dollar factor, the apparent gain collapses from +11.02pp to -11.21pp at 30% coverage once that factor is removed, and the optimum must not be adopted because the macro side of each row is dated to the same calendar day as the 24h window it is scored against. Nothing follows for production, no weight moves, no assignment is published and no worker status changes.

## Next action towards the current objective

- **None for this lane.** The bounded timing job the filing asks about in its recommendation 2 - re-derive each snapshot input at the project's own availability lag and re-run the same six factors - is recorded centrally as the concrete, cheap and downstream-only candidate and is **not scheduled now**, for the two reasons the published reply gives and this review confirms: it changes the accepted Gold snapshot builder on its warehouse-backed build path rather than being a docs filing, and no lane is free to take it, because `gold-research` holds `gold-declared-band-measurement-026` and the one-assignment rule forbids a second published assignment for that lane while the seven `backtester-<asset>` lanes now hold their own published foundation-build revisions.
- The **precise unresolved decision** stays the user's or the operator's: whether to schedule that timing rebuild and the already-recorded Phase-2 gold baseline reconciliation, and **on which lane**; together with the existing pickup of `gold-declared-band-measurement-026`, whose window is attached but idle (its dispatch record is a dedupe echo and its activity has sat paused at `gold-coverage-025` since `2026-09-25T19:54:06.758Z`), so no lane may be reported as woken.

## Blocker and concurrency disclosure

The one reply this cycle was instructed to publish could not be published by this turn, because a concurrent interactive coordinator activity in the same canonical checkout published the -057 and -058 replies at `15:01:01Z` and the three `backtester-harness` replies at `14:59:58Z` while this background turn held the -057 controller lock. The duplicate was refused by the CLI (`EEXIST`), so no second review was written and no state was overwritten. The concurrent pass has its own durable record for the same thread at `docs/orchestration/reviews/20261004-strategy-gold-weighting-optimum-and-dollar-timing-and-denominator-057-058-published.md` (4,775 bytes, written `2026-10-04T15:03:03Z`, after this file), which covers 057 and 058 together and does not perform the timing reproduction recorded above; this file is the canonical per-submission review and the two are complementary, not competing. Observed and deliberately **not** fixed here, because it is outside this cycle's single-submission scope: that concurrent pass's three `backtester-harness` replies and its review file `docs/orchestration/reviews/20261004-backtester-harness-r13-r14-r14b-seven-lane-publication-published.md` stand with no `CURRENT_STATE`, `CHANGELOG` or `DECISIONS` entry of their own; and the concurrent pass's temporary working files remain in the ignored `tmp/`.

## Boundaries confirmed

Read-only apart from this cycle's own coordination files: no live system, weight, collector, dashboard file, Layer 1 or Layer 2 surface, workflow, builder, dataset, register entry, assignment or other worker worktree was touched; no credential was used and none was printed; the sealed prospective window was not read and no outcome, holdout or prospective observation was consumed, and no final holdout was consumed; nothing was published, deployed, merged, pushed, refreshed or mutated; no controller or bridge file or setting was changed, no controller pause or stop and no coordinator-dispatch pause was run, no other coordinator process was started, no subagent was spawned and no external message was sent. The canonical checkout's one modified `tools/strategy-node/Strategy.code-workspace`, its five untracked `backtester/` Gold session-policy files, the concurrent pass's untracked review file and every worker checkout were left exactly as found.
