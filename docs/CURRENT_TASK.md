# Current task

Hold at the completed 28-factor stage and take the one outstanding prospective envelope.

`gold-coverage-025` was reviewed and accepted on 2026-09-25 (mailbox `a1543786...` reproduced, reply
`bd4804c1...`, review `docs/orchestration/reviews/20260925-gold-coverage-025.md`, a controller-locked run
separate from authorship), so the plain-English verdict page is delivered: one additive file,
`docs/GOLD_BACKTEST_VERDICT_20260925.md`, 59 lines and 518 words, sha256 `7198e24e...`, committed as `65e8b3a4`
from base `cdd350af`. Every number in it was verified against the accepted artifacts and every accepted
artifact of 019 through 024 stays byte-identical. The page currently exists only in the Gold worker checkout
(`.local/worktrees/gold-research`, branch `workers/gold-research-policy-20260920`), not in this canonical
folder, because acceptance is not integration.

Nothing in the circuit is accuracy, ranking, timing or edge evidence, and none is possible from spent
intervals; rev1, rev2 and rev3 are spent and immutable, so the batch must not be re-run and no ranking may be
presented as a result. The five declared research definitions (`fed_bias`, `inflation_signal`,
`risk_headline_context`, `equities_regime`, `growth_regime`) are not live Layer 1 fields.

The only outstanding obligation is the 022 item A observation envelope for the `2026-09-28T14:00:00Z|gold|entry`
identity, due at or after the `2026-09-28T16:00:00Z` lane close, delivered from the worker's ignored `tmp/` as
one envelope before stopping. Because a reply or assignment notifies a worker bridge once per content version,
that envelope needs a fresh wake at or after the lane close - an operator resume of the Gold window or a later
coordinator event. The register keeps `gold-coverage-025` published at status exactly
`instructions_published_awaiting_worker` for exactly that reason.

The live window needs no action: exactly one scheduled task, `GoldQualificationWindowTick018`, keeps capturing
through the v2 wrapper and must not be disturbed. It was observed read-only in this review (Ready, one `PT10M`
trigger, `LastRun` 20:46:01 local, `LastTaskResult` 0, zero missed runs). No prospective observation or outcome
may be read before `2027-03-25T15:00:00Z`.

One page was added on 2026-09-27 and changes nothing above: `gold-direction-scorecard.html` renders the accepted
direction check as a self-contained research surface (25 scored states, every hit rate beside its own drift floor, with
the unscored, neutral and unreadable states printed rather than hidden). It measures nothing new. The user authorised
publication on the evening of 2026-09-27 and chose the three-page scope, so the scorecard with its two sibling Gold
pages is public in production `main` `c91bd6f` behind a `Gold Direction` link on the dashboard; the deeper repo-relative
evidence links inside those pages stay local-only, and whether to publish those evidence artefacts is the part of the
publication decision that remains open.

2026-09-29 review outcome, recorded without changing the objective: `strategy` submission
`20260928-strategy-gold-band-edge-table-007` (mailbox `835fb83e...`, reply `dc79147a...`, review
`docs/orchestration/reviews/20260928-strategy-gold-band-edge-table-007.md`) was **accepted** as an accurate
specification advisory, not as authority to open either lane it proposes. Its finding is now recorded: the Gold
Layer 1 document declares absolute bands and magnitude thresholds (VIX >25 / <16, 5 bps, 0.30%) while the accepted
measurement vocabulary forces a median split or a bare sign, so the document's own band never reaches a report cell;
both sides declare the gap in writing and the code forces it at `lib/gold_individual_variable_report.js` lines
1042/1060/1064/1104. That is a vocabulary and contract gap, not evidence of edge, and it is exploratory only. No
assignment was published from it: the same spec file was already rewritten in place by the still-queued `-008`/`-009`
submissions with `-010` revising again, the material forks D6/D8/D4/D15 in its own section 9 are open, and the proposed
page lane has no registered worker - `projects.json` carries a `dashboard` coordinator workstream rather than a worker.
`gold-research` stays published at status exactly `instructions_published_awaiting_worker` for the 022 item A envelope.

2026-09-29 review outcome (same day, second cycle), recorded without changing the objective: `strategy` submission `20260928-strategy-gold-band-edge-table-008` (mailbox `a4156f0a...`, reply `08b208b5...`, review `docs/orchestration/reviews/20260928-strategy-gold-band-edge-table-008.md`) was **accepted** as an accurate docs-only advisory - the short plan answering the user's "simplify this / keep both VIX streams" follow-up, with the decision list cut from fifteen to four (D1 both VIX streams incl. a declared 1/2/5 and 2/5/10 sweep with `looks_counted`; D2 full page versus minimum version; D3 rebuild F9; D4 keep `>= 60` and `n >= 100`). Verified from the checkout and the artifacts: base `9d4403ec` is the direct parent of head `1576e898` (`rev-list --count` 1), the commit is +250/-0 lines across three `docs/strategy/` files only, the three artifact byte hashes reproduce exactly, and every load-bearing figure is exact - F6 asks for both VIX streams and rules the level only, the scorecard's `unscored` blocks already carry the change-state numbers, baselines 55.81% n 964 and 58.23% n 960, exactly one cell is at or above 60% on either horizon (`vix_d1` positive **week** 60.51% n 433, one of twelve looks, session 52.86% below drift, 262 of 433 and not F9's 285 of 471), the accepted 019 report is exactly 95,842,994 bytes with zero occurrences of the field `"values"`, and the sizing estimate is exactly 954 / 41 / 400 / 513. One minor citation slip is recorded as a note: section 4 labels the sizing window end `2026-09-21` where the file's last in-range observation is `2026-09-11` (the same slip review 007 noted on the spec). No assignment was published from it, for the same structural reasons as `-007` plus one: the worker's own later `-009`/`-010` submissions already rewrite this plan (live file now 287 lines, sha256 `A5DF999D...`) and `-011` changes D1's floor default, all still queued behind the one-review-per-cycle rule; the D1-D4 forks remain open; `gold-research` deliberately stays published at status exactly `instructions_published_awaiting_worker` for the 022 item A envelope; and the page lane still has no registered owner.
2026-09-30 review outcome (live-trading lane), recorded without changing the objective: `live-trading` submission
`20260930-live-trading-feed-002` was reviewed and decided **changes requested, documentation only** (mailbox
`088e8a9515fddcc149edd6bc41230952f141d8075a16bf7ba04b4e429e4c0f21` reproduced from the immutable inbox file, reply
`0e24fda54cf6e5a3924a8970f81782bb881f1700ad4dd8f44eee943beef62c7c`, review
`docs/orchestration/reviews/20260930-live-trading-feed-002.md`). Verified from the checkout rather than trusted: the
producer `tools/mt5-bridge/live-trading-snapshot.py` is read-only by construction and holds no order call, its import
allowlist test passes, `scripts/validate_live_trading_feed.js` returns PASS on the committed `data/live-trading.json`
(27,727 bytes, sha256 `b3db6cc5...`, generated `2026-09-30T19:28:37.575240Z`, four instruments, masked `***614`, zero
positions and zero orders), `tests/live_trading_feed.test.js` is 18 of 18 in the worktree, and the dashboard section
exists in exactly one copy - the canonical checkout, the other eleven worktrees and the four `*-release` copies carry
zero references to it. One bounded documentation correction is owed under a new submission ID: the report's live-evidence
line attributes the 19:15:25.891323Z reading in the ignored scratch file `tmp/live-trading.real.json` to the committed
19:28:37.575240Z run, whose own quotes are EURUSD 1.13310/1.13312, XAUUSD 4153.30/4153.71, US100.cash 30558.33/30559.78
and BTCUSD 83739.20/83740.20; the same scratch console text is `tools/mt5-bridge/README.md`'s example without its run
time; and the quoted canonical `index.html` size of 19,616 bytes is the seven `backtester-<asset>` worktrees' size
(canonical HEAD 19,251, working copy 19,698). The lane's disclosed scope overrun - the `MetaTrader5` 5.0.6231 install into
the user's Python, the read-only attach to the user's own logged-in terminal and the read of facts about the user's own
evaluation account, and the writes outside `docs/live-trading/` - is recorded as disclosed and not authorised, and the
three-way authority question (read-only feed, demo execution, funded execution) stays the user's open decision, so no
lane was opened and no order path exists. No new assignment was published and the register keeps `live-trading` at status
exactly `instructions_published_awaiting_worker` so the reply stays deliverable; `20260930-live-trading-publish-003` stays
`pending_review` and its publish route is a coordinator production decision taken in that submission's own review.

Next: hold, and take the 022 item A envelope at the lane close. No further research is authorised. The precise
unresolved decisions are the user's: whether to open another exploratory stage over the spent intervals at all, since
the undeclared `event_releases` cell at 40,324 would need a selection rule and the other horizons, context fields and
endpoint groups sit in the same already-consumed calendar (the declared-band measurement proposed by `-007`/`-008` is one such
candidate and would need the D1-D4 forks answered (formerly D1-D15)); if such a stage is opened, whether one writer or two sequenced
lanes should carry it; whether a Gold factor edge page may be built at all while the page lane has no registered owner,
given the dashboard workstream's standing "user-requested UI changes only" policy; and whether to promote the accepted
verdict page from the worker checkout into this canonical checkout. The CRLF materialisation and the accepted-inputs
raw/LF digest asymmetry stay owned by the `backtester-spike` change request and are not to be repaired here.

2026-10-03 review outcome (eighteenth cycle), recorded without changing the objective: `strategy` submission `20261003-strategy-user-confirmed-all-five-044` (mailbox `d4b3ff83...` reproduced from the immutable inbox file at 10,046 bytes, reply `cf0766b2...`, review `docs/orchestration/reviews/20261003-strategy-user-confirmed-all-five-044.md`) was **accepted** as an accurate docs-only advisory status report, not as authority to make any production change. Its scope and artifacts were reproduced from the git object at `6e2c831` rather than trusted; its coordinator-record citations (`projects.json` line 36, the `gold-research` work order, the R4 withdrawal) hold; and its one wrong sentence about `-043` is noted as already corrected by the accepted addendum. The two asks it repeats are production and stay the user or the interactive coordinator: the validated Gold history patch and the 25-row unordered read, and the one combined published-site change with Task 0 first. No assignment was published from it: `gold-research` already holds `gold-declared-band-measurement-026` at status exactly `instructions_published_awaiting_worker`, its event is delivered to a connected window with pickup unproven, every other lane holds its own assignment, the Gold circuit is spent or sealed to `2027-03-25T15:00:00Z`, and no dashboard worker is registered to own a page lane.

2026-10-03 review outcome (nineteenth cycle), recorded without changing the objective: `strategy` submission `20261003-strategy-user-confirmed-all-five-044-addendum-accepted-045` (mailbox `8ec9f279...` reproduced from the immutable inbox file at 13,466 bytes, reply `1ecbe248...`, review `docs/orchestration/reviews/20261003-strategy-user-confirmed-all-five-044-addendum-accepted-045.md`) was **accepted** as an accurate docs-only advisory status report, not as authority to make any production change. Its scope and all three artifacts were reproduced from the git object at `c7c8bb2` rather than trusted, both corrections of record and every coordinator-record citation hold, and its one stale queue item - the claim that `-044` was still `pending_review` - is recorded here and already corrected by the lane's own next filing. The two asks it repeats are production and stay the user's or the interactive coordinator's, and no assignment was published from it, for the same verified reasons as the previous cycle. The lane's only pending mailbox item is now `20261003-strategy-044-accepted-and-the-045-status-correction-046` (inbox 14,227 bytes, sha256 `61f1508f...`), which declares the moved branch tip `5e80ec0`; it was not reviewed in this cycle.

2026-10-03 review outcome (twentieth cycle), recorded without changing the objective: `strategy` submission `20261003-strategy-044-accepted-and-the-045-status-correction-046` (mailbox `61f1508f...` reproduced from the immutable inbox file at 14,227 bytes, reply `54f617ad...`, review `docs/orchestration/reviews/20261003-strategy-044-accepted-and-the-045-status-correction-046.md`) was **accepted** as an accurate docs-only advisory status report carrying a same-turn correction of record to its own `-045` filing, not as authority to make any production change. Its scope and all three artifacts were reproduced from the git object at `5e80ec0` rather than trusted, its correction of record (the 178.348 s gap between the `-044` reply and the `-045` file) and every coordinator-record citation hold, and the one statement it makes that is now overtaken - that no reply to `-045` existed when it was generated - is recorded as overtaken rather than as a defect. The three production decisions are unchanged and stay the user's or the interactive coordinator's, and no assignment was published from it, for the same verified reasons as the previous two cycles. Nothing is left pending for this lane, and `gold-research` stays the single open research lane at `instructions_published_awaiting_worker` awaiting pickup.
