# Strategy 039: the nav tidy-up work order, the stale-bar Task 0, and the single-publisher queue answer

Reviewed on 2026-10-03 (seventh cycle, background dispatcher run) from the canonical checkout
`D:\trading-agent-dashboard-codex` (branch `orchestration/control-plane-20260920`) by the background
coordinator lane, under the controller lock that owns this run. Submission
`20261003-strategy-nav-tidy-work-order-039`, mailbox SHA-256
`e8f547551a3a2ee4bc00a48224eba676309032f1bd7b6013443861c3fd68c91e`, reproduced independently from the
immutable inbox file (8,159 bytes) and equal to the requested hash. Reply published at
`.local/orchestration/replies/strategy/20261003-strategy-nav-tidy-work-order-039.json`
(9,184 bytes, SHA-256 `5f2e3f353da5705a2a143805b7eac1cd9aed05cc8eedbe098c89c66a339761ef`), decision
`accepted`.

Acceptance is not adoption, execution or production. This cycle published no page, copied nothing,
merged nothing, deployed nothing, refreshed nothing, triggered nothing and armed nothing. No lock,
controller or bridge file was touched, no controller pause or stop was run, no other coordinator
process was started, no subagent was spawned, no lane was opened and no worker status was set to a
publish state.

## What the submission is

A `ready_for_review` work order, not new research. It turns the user's 2026-10-01 nav-consistency
request and the user's 2026-10-03 wording ("craft the instructions to tidy up the top and side bar menu
to ensure consistency site wide") into an executable order for the coordinator's own dashboard lane,
and answers the user's separate question about the single-publisher / reviewed-queue model. Its
deliverables are two `docs/strategy/` files and nothing else.

## Scope checked

Worker `strategy`, worktree `.local/worktrees/strategy`, branch `workers/strategy-advisory-20260920`,
base `817763783fc1635eedd0c439a25fc00994d64f1a`, HEAD `bbf4f732bca98325bbd18977322b9a3bd32e75b0`,
working tree clean with no dirty or untracked file. The change set is `docs/strategy/` only - one commit
`bbf4f73` adding exactly two new files, `git diff --name-status 8177637 HEAD` reads `A` for both, 326
insertions and 0 deletions. The canonical checkout's unrelated dirty state and every other worktree
were left exactly as found.

## Independent verification (reproduced, not trusted)

- **Both artifacts reproduce byte-exactly.** `docs/strategy/COORDINATOR_NAV_TIDY_HANDOVER_20261003.md`
  is 19,906 bytes, 247 CRLF, 0 bare LF, SHA-256
  `ba45df129c2db3a7ebda81624fa44db47f03b31f1c860d251a2448510eff92d4`.
  `docs/strategy/PUBLISH_QUEUE_MODEL_NOTE_20261003.md` is 6,334 bytes, 79 CRLF, 0 bare LF, SHA-256
  `5bfe9f5af3903e8609241bcaf7a254f93cf76c49c2e248da651c156f01784ce6`.
- **The served site is what the work order says it is.** From `origin/main` `f8bc80f`: exactly nine
  `.html` files and no nested page; `git cat-file -s` reproduces all nine blob sizes in the table
  exactly (index 18,775; gold 5,733; north-star 5,002; standing 8,957; backtest-flow 18,402;
  factor-wip 24,398; direction-scorecard 143,102; backtesting 292,270; outcomes 19,186);
  `class="topbar"` and `class="side-rail"` each count 1 on `index.html` and 0 on the other eight; the
  bar (lines 14-30) and the rail (lines 33-65) carry exactly the quoted brand, four bar entries, head,
  four groups, seventeen entries and foot; four pages link `styles.css` and five keep everything inline.
- **The hash finding reproduces.** `gold.html` honours the hash at lines 101-102; `script.js` contains
  zero `location.hash` occurrences and binds `.tab-button` through `dataset.tab` at lines 14,875 and
  14,931-14,932. `index.html#GOLD` therefore selects no tab today.
- **Task 0's drift is real on the current canonical HEAD.** `origin/main` `index.html` carries four bar
  entries; the canonical `index.html` carries six, last written by `561cf6b`, and
  `git merge-base --is-ancestor 2f25c8c HEAD` exits 1. The three hop guards assert bar hrefs production
  no longer serves (`gold_direction_dashboard_link.browser.test.js:15`,
  `gold_outcomes_dashboard_link.browser.test.js:15`,
  `gold_factor_wip_dashboard_link.browser.test.js:20`) and no test asserts the `gold.html` entry.
- **The guard couplings the order relies on reproduce.** The draft-page guard pins `script, link, img,
  iframe` at 0, one `.draft` reading `/50 of 50 answered/`, and five `h2`; the backtest-flow guard pins
  the header-band count at 0 and three direct children of `main`. The template-to-builder mapping holds
  and no template emits `index.html`, `gold.html` or `gold-factor-wip.html`.
- **The queue note's costs reproduce.** `origin/main` `data/layer1.json` `last_updated_et`
  `2026-10-02T07:29:28.874Z`; the concurrent second review of the `-038` filing is corroborated by
  canonical commit `30d853b`.

## Precision notes (not required changes)

- The order cites the canonical checkout at `30d853b`; HEAD has since advanced to `3a8c1a0`, but
  `index.html` still carries six entries and the merge-base check still exits 1, so Task 0's premise is
  unchanged on the current HEAD.
- Section 9 names `tests/live_trading_dashboard.browser.test.js` as an existing guard to keep green; it
  exists on `origin/main` but not in the canonical checkout - the same one-release-behind drift Task 0
  describes, which leveling the mirror would resolve.

## Decision and next work

`accepted` as a verified advisory work order.

No new bounded research assignment is published and the register is untouched. The nav work is
coordinator-owned dashboard work under the single-writer rule, not worker research, and no dashboard
worker is registered; the Gold circuit is spent or sealed to `2027-03-25T15:00:00Z`; the movement-screen
lane is uncovered; and the live-trading call-to-order contract is already directed inside
`live-trading-001` at exactly `instructions_published_awaiting_worker`. `strategy` stays `advisory_active`
under `strategy-advisory-001`.

**The precise unresolved decision stays the user's:** (a) the rail deep-link choice - add the roughly ten
lines to `script.js` so `index.html#GOLD` selects a tab (recommended) or anchor to plain `index.html`;
(b) the date/clock choice - omit the live spans on the other eight pages (recommended) or bake a static
line - plus whether the dashboard lane executes Task 0 and the N1a build now that the release it was
sequenced behind has landed.

**Noted, out of scope for this cycle:** a new filing `20261003-strategy-nav-work-order-039-addendum`
(4,417 bytes, SHA-256 `64942d41e4c587e23b35ed50f1eeca93affad02f51b2f920d0e520e3d6350190`) arrived while
this review ran. It is `pending_review` and was deliberately not reviewed: this cycle's brief was the
`-039` filing alone; a second filing, `20261003-backtester-harness-asset-store-and-tabs-r1` (9,963 bytes, SHA-256 `7d3563b71b0af1be53df2d243d41789182ff461fe42b093206e2190a5072c848`), from `backtester-harness` also arrived and is likewise `pending_review`.