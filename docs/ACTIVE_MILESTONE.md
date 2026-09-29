# Active milestone

Current milestone: the 28-factor Gold stage is complete and its plain-English verdict page is accepted; hold
until the one carried observation envelope at the lane close, then stop.

Status at 2026-09-25 20:52 local: `gold-coverage-024` revision 2 is accepted at clean `cdd350af` from base
`6fd501a7` (reply `40eaccc4...`, review `docs/orchestration/reviews/20260925-gold-coverage-024-r2.md`,
acceptance commit `41210c1`) and the 28-factor circuit is **closed as exploratory**. `gold-coverage-025` is
also accepted (mailbox `a1543786...` reproduced, reply `bd4804c1...`, review
`docs/orchestration/reviews/20260925-gold-coverage-025.md`): the verdict page
`docs/GOLD_BACKTEST_VERDICT_20260925.md` is delivered at clean `65e8b3a4` from base `cdd350af` as one additive
file of 59 lines and 518 words (sha256 `7198e24e...`), every number in it re-checked against the accepted
artifacts, the five distribution figures the worker disclosed it had not re-derived independently confirmed by
the coordinator from `descriptive-analysis.json`, dependency impact nil (the new path is outside the frozen 014
manifest's eight bound paths and no test enumerates `docs/`), and the live capture lane observed read-only and
undisturbed. The page lives only in the worker checkout, not in this canonical folder; promoting it is a
central decision, not an accepted fact.

Honest reading, unchanged: the declaration is `5fe48767` (v2 registry `c19315e6`), the executed stage is
`gold-combination-run-024-20260926-rev3` (exit 0, ledger `f02a88cb`, 4,956 of 4,956 candidates - 2,745 reported
/ 704 ineligible / 1,507 empty / 0 unavailable - denominators `350,283 + 91,036 + 0 = 441,319`, manifest
`1ec2a382`, summary `d594646d`, row reconciliation `a23f65d1`), and nothing in it is accuracy, ranking, timing
or edge evidence, nor can it be from spent intervals. No successor assignment was published; the register keeps
`gold-coverage-025` at status exactly `instructions_published_awaiting_worker` so the delivery trigger path
stays intact for the carried 022 item A envelope.

Next immediate action on resume: work the strategy review queue one cycle at a time. The 2026-09-29 background cycles reviewed `20260926-strategy-window-flash-fix-004`, `-005` and `-006` (all changes requested for documentation defects), then **accepted** `20260928-strategy-gold-band-edge-table-007` (mailbox `835fb83e...`, reply `dc79147a...`), and then **accepted** `20260928-strategy-gold-band-edge-table-008` (mailbox `a4156f0a...`, reply `08b208b5...`, review `docs/orchestration/reviews/20260928-strategy-gold-band-edge-table-008.md`) as an accurate docs-only advisory - the short plan answering the user's "simplify this / keep both VIX streams" follow-up, with the decision list cut from fifteen to four and both VIX uses of the single `VIXCLS` series carried as level bands (scored), change states (raw context) and a declared 1/2/5 and 2/5/10 sweep. Verified from the checkout and the artifacts: base `9d4403ec` is the direct parent of head `1576e898` (`rev-list --count` 1), +250/-0 across three `docs/strategy/` files only, the three artifact byte hashes reproduce exactly, and every figure is exact (F6 asks for both streams and rules the level only; the scorecard's `unscored` blocks already carry the change-state numbers; baselines 55.81% n 964 and 58.23% n 960; exactly one cell is at or above 60% on either horizon, `vix_d1` positive **week** 60.51% n 433, one of twelve looks with a below-drift session number; the accepted 019 report exactly 95,842,994 bytes with zero occurrences of the field `"values"`; `VIXCLS.json` 97,074 bytes as the only VIX series; sizing exactly 954 / 41 / 400 / 513). One minor citation slip is recorded as a note (section 4 labels the sizing window end `2026-09-21` where the last in-range observation is `2026-09-11`). No assignment was published from either accepted advisory: the same plan file has already been rewritten in place by the still-queued `-009` (head `73e64852`) and `-010` (head `45b7864a`) with `-011` changing D1's floor default, the material forks D1-D4 remain open, the proposed page lane has no registered worker (`projects.json` carries a `dashboard` coordinator workstream, not a worker), and `gold-research` deliberately stays at status exactly `instructions_published_awaiting_worker` for the carried 022 item A envelope. The queue now holds 5 `pending_review` `strategy` submissions (2026-09-28 to 2026-09-29). In parallel, hold on Gold: the accepted verdict page still lives only in the worker checkout and promoting it is a central decision, the 022 item A anchor observation envelope for `2026-09-28T14:00:00Z|gold|entry` was due at or after the `2026-09-28T16:00:00Z` lane close and still needs a fresh wake - an operator resume of the Gold window or a later coordinator event - before Gold stops, and the precise unresolved decisions (whether to open another exploratory stage over the already-spent intervals at all, which writer model if so, whether the page lane may run while it has no owner, promoting the verdict page, and publishing the remaining local-only Gold evidence artefacts) stay the user's. Do not re-run the batch, do not disturb `GoldQualificationWindowTick018` - whose action is the windowless `wscript.exe run-hidden.vbs` launcher recorded in `DECISIONS.md` - and keep evaluation sealed until `2027-03-25T15:00:00Z`.

Second lane set opened on 2026-09-29, recorded without displacing the objective above: seven non-Gold asset
backtester windows - USD, EUR, NQ, BTC, GBP, Silver and WTI, the seven non-Gold rows of the 2026-09-24 readiness
matrix - are registered as `backtester-<asset>` under assignment `backtester-<asset>-001`, each a read-only
readiness and standby lane with one `docs/backtester-<asset>/READINESS.md` as its only deliverable, its own
worktree `.local/worktrees/backtester-<asset>` on `workers/backtester-<asset>-20260929` from `1bb3395`, and its
own window in `tools/backtester-<asset>-node/`. The backtesters themselves are **not** authorised: the user's
direction is that they are built once the Gold backtesting loop's lessons are complete and understood, and the
repository agrees, because the multi-asset platform code lives unmerged on `spike/multi-asset-readiness-20260924`
under a change request and `backtester/registries/` still holds only `gold_*` registries. Opening the windows
changes nothing about the Gold hold: the 28-factor circuit stays closed as exploratory, the 022 item A envelope
is still the one carried obligation, no prospective observation may be read before `2027-03-25T15:00:00Z`, and
`GoldQualificationWindowTick018` must not be disturbed. Two decisions stay the user's: whether the Gold loop's
lessons should be written up as one frozen document that all seven lanes inherit (which is what would authorise
any build), and in what order the seven assets should then be built - the matrix itself places USD, EUR, NQ and
BTC ahead of GBP, and records no source contract at all for Silver and WTI.

