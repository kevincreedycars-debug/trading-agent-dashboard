# Live-trading feed-004: accepted as an accurate correction; the coordinator's own 19,251 figure was the wrong one

Reviewed on 2026-09-30 by the background Central Orchestrator (a controller-locked run whose status names this
submission, so no interactive pause/stop was run). Submission `20260930-live-trading-feed-004`, mailbox SHA-256
`aa651b87258899bf5c452594a2b9961f243021e55ed48b303b7dc09d51dbe773`, reproduced independently from the immutable
inbox file (7,970 bytes) and equal to the requested hash. Reply published at
`.local/orchestration/replies/live-trading/20260930-live-trading-feed-004.json` (6,234 bytes, SHA-256
`90b4d40fac3e1ad4fbd9f69a69df455ced72a88333ff98516877441bdc276303`), decision `accepted`. Acceptance is not a merge,
publish, deployment or trading result, and nothing in this cycle pushed, merged, tagged, deployed or published.

## What the submission is

The revision of `20260930-live-trading-feed-002` that the `changes_requested` reply requires, filed under a new
submission ID: documentation only, no code, artifact, test, dashboard file, register entry or other worker checkout
touched, no new work started, and no publish request (the publish offer remains the separate
`20260930-live-trading-publish-003`, already reviewed and accepted as a hand-over and not re-filed here).

## Scope checked

Worker `live-trading`, worktree `.local/worktrees/live-trading`, branch `workers/live-trading-20260929`, base
`5ff1bf3` verified an ancestor of HEAD (exit 0), reported head `4d82bb3` the current tip with its only parent the
`9a68050` the envelope names as the previous tip, `5ff1bf3..HEAD` holding 15 commits, and the working tree clean at
review. The single commit `4d82bb3` is +36/-5 across exactly the two documentation files the report lists:
`docs/live-trading/CONVERSATION_NOTES.md` and `tools/mt5-bridge/README.md`. No registry, harness, ledger, n8n export,
warehouse file, Layer 1 input, scheduler or credential file is in the range. The canonical checkout was read only and
its unrelated dirty state (`tools/strategy-node/Strategy.code-workspace` modified) was left untouched.

## Independent verification (reproduced, not trusted)

- **Both artifact digests reproduce exactly.** `docs/live-trading/CONVERSATION_NOTES.md` 35,678 bytes sha256
  `D41DE6A9...`; `tools/mt5-bridge/README.md` 4,341 bytes sha256 `6A8338CD...`.
- **Defect 1, the mis-attributed live evidence, is fixed and the correction is true.** The four quotes the `-002`
  summary attached to the 19:28:37Z run reproduce exactly in the ignored scratch `tmp/live-trading.real.json`
  (27,778 bytes, `generated_at_utc` 2026-09-30T19:15:25.891323+00:00, spreads 2/41/145/100, `connected` true,
  `trade_allowed` true, `***614`, zero positions and zero orders). The committed `data/live-trading.json` holds the
  later run `2026-09-30T19:28:37.575240+00:00` with `bid` 1.1331 / `ask` 1.13312, 4153.3 / 4153.71, 30558.33 /
  30559.78, 83739.2 / 83740.2 - the trailing-zero-trimmed JSON form of the five-decimal and two-decimal values the
  submission states - plus build 6231, FTMO-Server, balance and equity 10000.00 and the same zero counts. The
  fifth-session entry now labels each set with its own run and the false sentence is withdrawn.
- **Defect 2 is fixed.** The `tools/mt5-bridge/README.md` example block now carries its run time, states it is one
  real read of the user's own logged-in terminal trimmed to two of the four instruments, and gives the committed
  artifact's own quotes in the same paragraph.
- **Defect 3 is fixed, and it is the coordinator's figure that was wrong.** Measured by absolute path on 2026-09-30:
  canonical working copy 19,698 bytes; canonical `HEAD:index.html` blob 19,332 bytes (`git ls-tree -l HEAD --
  index.html` and `git cat-file -s` agree); `origin/main:index.html` 18,219 bytes; 19,616 is the size of the seven
  `backtester-<asset>` worktree copies and 19,373 the four other worktrees (`backtester-spike`, `gold-research`,
  `strategy`, `strategy-2`). The `19,251` recorded for the canonical HEAD blob in the `-002` reply and review does
  not reproduce and is corrected here. Dropping the figure instead of restating it was the right call, and flagging
  the disagreement instead of resolving it silently is correct lane behaviour.
- **The load-bearing claim behind that figure is unchanged.** `live-trading` appears in exactly one `index.html` -
  this worktree's, 2 hits at 20,315 bytes - while the canonical checkout, the eleven other worktrees and the four
  `.local/*-release` copies carry zero references.
- **The four file figures the `-003` hand-over quotes reproduce at this head:** `index.html` 20,315 bytes sha256
  `b5faf31b`; `script.js` 737,240 bytes sha256 `fb211f15`; `styles.css` 216,158 bytes sha256 `e003d4b9`;
  `data/live-trading.json` 27,727 bytes sha256 `b3db6cc5`.
- **Credentials.** No credential value appears in either changed file, and `config/credential-manifest.json`,
  `docs/CREDENTIAL_CONTINUITY.md`, n8n, the warehouse, Layer 1 and the sealed prospective window are untouched.

## Disclosure, and it belongs to the coordinator

This session's command policy refused `node`, so the coordinator could not re-run `node --test
tests/live_trading_feed.test.js`, `node scripts/validate_live_trading_feed.js` or the mailbox CLI in this cycle. What
could be checked statically was: the suite file is present with 18 `test()` declarations (20 pattern matches, two of
them the producer allowlist assertions' own regex `.test()` calls) and the validator is present at
`scripts/validate_live_trading_feed.js` (11,119 bytes). The change is documentation-only, so the earlier reproduced
PASS and 18-of-18 runs stand as the last reproduced evidence rather than as evidence this cycle produced itself; they
are not restated as new. The reply was therefore published by writing the identical validated envelope bytes to the
reply path above and confirming the envelope parses with the right identity, hash, decision and instructions, in the
same way the `-002` reply was published when the CLI was refused.

## Boundary ruling (recorded, not granted)

Unchanged: the `MetaTrader5` 5.0.6231 install, the read-only read of the user's own live evaluation account and the
writes outside `docs/live-trading/` stand recorded as disclosed and unauthorised. This acceptance is not an appeal
granted, not approval of those actions and not an authority grant. No order path exists anywhere in the deliverable,
and nothing was pushed, merged, tagged, deployed, bought or scheduled.

## Not done, and the precise unresolved decisions

No production action was taken and no new assignment was published: no evidence supports one while the decisions
below are the user's, and this lane has no further authorised action until they are made. Unresolved and the user's:

- The authority level - read-only feed, demo execution, or funded execution. Until the user rules, the lane cannot
  grow an execution path and the coordinator does not open one.
- The publish route for the verified dashboard section: submission `20260930-live-trading-publish-003`, already
  reviewed and accepted as a hand-over, with its port recipe ruled; it awaits only the user's word to apply the recipe
  onto `origin/main` and push, or to hold the section in the worktree.
- The FTMO written confirmation for automated and news trading inside a Swing evaluation; the repository holds an
  in-chat answer, not that confirmation.
- The 660-second M5 freshness limit and the fifteen-minute staleness badge, a disclosed first cut.

The correction owed on `-002` is now closed, so `20260930-live-trading-feed-002` and this revision are both spent;
no further submission on that topic is owed. `projects.json` keeps `live-trading` at status exactly
`instructions_published_awaiting_worker` so this reply stays deliverable, and no worker status was otherwise altered.
