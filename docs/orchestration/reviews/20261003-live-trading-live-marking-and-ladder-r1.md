# Durable review: 20261003-live-trading-live-marking-and-ladder-r1

Worker: `live-trading`. Assignment: `live-trading-001`. Reviewed 2026-10-03 (thirteenth cycle,
background review) from the canonical checkout under the controller lock that owns this run
(`.local/orchestration/controller/run.lock` -> `{"pid":8184,"submission":"20261003-live-trading-live-marking-and-ladder-r1"}`).

- Mailbox: `.local/orchestration/inbox/live-trading/20261003-live-trading-live-marking-and-ladder-r1.json`,
  16,209 bytes, sha256 `0896430dcf2aa7e8418f3fee7c77438195219422b37c63beac869afb85d46b0e`, reproduced from the
  immutable inbox file and equal to the requested hash.
- Reply: `.local/orchestration/replies/live-trading/20261003-live-trading-live-marking-and-ladder-r1.json`,
  sha256 `0ff2f5431636c6fbfc94f76836120169b2aa43587b3f7126efe117a99af5a80b`, decision `changes_requested`.
- Assignment: `docs/orchestration/assignments/live-trading.md` (unchanged this cycle; registry keeps
  `live-trading` at status exactly `instructions_published_awaiting_worker`).

## Decision

**changes_requested** - the verified evidence stands, but the envelope's statement of the tree's current
state is false and one declaration is owed under a new submission ID.

## What the envelope claims, and what verifies

- Its own commit `0748dba1` is documentation only: four files, +108/-0, sole parent `13cf8d5`. Confirmed
  with `git show --stat`.
- The four doc artifacts reproduce byte-exactly at that head in their CRLF materialisation. Rebuilt by the
  coordinator from `git show 0748dba1:<path>` and hashed: `docs/SESSION_NOTES.md` 170,673 bytes sha256
  `D10860ADEAF2D9511D4BC60FE5CC67D1201C55E50F0BA41B876F673BF0B7A8A2`; `docs/live-trading/CONVERSATION_NOTES.md`
  64,557 bytes sha256 `2E4F366B47005996DE4E61A7B612305FC9D769059DCBDBC5B7864FD3C9D2A27C`;
  `docs/live-trading/STRATEGY_LIVE.md` 58,091 bytes sha256
  `B1B62E4886124F7B94D326D647A18F1C86F2C71BF436F33EAB5CF8F459CB24E5`; `scripts/README-l2l-levels-tool.md`
  12,723 bytes sha256 `7E6AD2118238B68DF7DC2B0CEFAF1D2DB1A0862AD6D25045C8CFB9B7C15A5704`.
- The five offered site artifacts reproduce exactly in the worktree at review time: `index.html` 20,388 bytes
  sha256 `63B159B963008071F7CF005C387ED84757E6FA2C4D44A1174357CD021A9B1552`; `script.js` 802,471 bytes sha256
  `1D361313B265C5BA2617FBBD4F47027787289A59E2A8574C8DC281228600F360`; `styles.css` 228,425 bytes sha256
  `3414AC9819D0FF9AF68BAD7FFC56D3D58DA3AA3879325FA334A49E381BCC605B`; `lib/l2l_ladder.js` 8,467 bytes sha256
  `344A499DA32643901E27EFD3454EB87097F3B844115BA99DA8561610EA6AF54D`; `data/l2l-levels.json` 743 bytes sha256
  `C383997C636B672BE87C3C9135CFCC21686D435F3DFF4E8B033CD207B1058BFE`.
- `node --test tests/l2l_levels.test.js tests/live_trading_feed.test.js` re-run by the coordinator in the
  worktree: 73 tests, 73 pass, 0 fail.

## The defect

The envelope reports `dirty_files: []` and states "No credential, no scope, no key, no table and no write
path was created, requested or read for this envelope" and "this lane starts no further work until a
recorded reply arrives". Neither is true of the worktree as reviewed, and the work was still changing
during the review.

- The tip is `482aabc`, one documentation-only commit after the envelope (+1/-1 in `docs/SESSION_NOTES.md`),
  not the declared `0748dba1`.
- The working tree carries uncommitted work that began after the envelope: `lib/l2l_levels_store.js`
  (new, untracked, about 35 KB, mtime 16:58:50 local), `script.js` (+213/-5), `scripts/l2l-levels-tool.js`
  (+37/-383), `tests/l2l_levels.test.js` (+41/-10). `script.js` appeared modified between two consecutive
  `git status` reads during this review.
- Read together, they build a **third marking route** the envelope did not offer: a published-page control
  that commits `data/l2l-levels.json` to production `kevincreedycars-debug/trading-agent-dashboard` on branch
  `main` through `api.github.com` with a reader-supplied token, behind a browser draft. `script.js` gains
  `liveTradingLevelsStore` (`globalThis.L2LLevelsStore`) and a `liveTradingPublish` block defaulting to that
  repository and branch; the store module documents the token as reader-supplied, browser-held and sent only
  to `api.github.com`.
- That route is the production and credential decision this envelope itself reserved for the user, it writes
  the coordinator-owned published line, and the published `script.js` on production `main` is a
  coordinator-owned file. Recording it is not ruling on it.

Defect class: undeclared post-report divergence in the same worktree. This is the class the tenth-cycle review
recorded against the `backtester-harness` lane and answered the same way.

## Required of the lane (bounded, documentation only)

1. Stop work on the route now, report activity with
   `node scripts/monitor-state.js activity live-trading paused "<what you stopped>"`, and do not commit, push
   or open a pull request against production `main`.
2. File one corrected envelope under a new submission ID, HEAD-bound to the tree as it then stands, declaring
   the route, its exact files with byte counts and sha256 at that head, the repository, branch and token it
   would use, whether it writes production `main` directly or a branch, and the lane's scope position;
   withdrawing or restating the two sentences above rather than leaving them standing.
3. Treat the reply as no approval of that route or of anything in it.

## Carried to the user (not decided here)

- The go-ahead to port the unreported range `4d82bb3..13cf8d5` onto `origin/main` by the already-ruled hunk
  recipe: a coordinator production action. This background run carries no production authority, published
  nothing and touched no site file.
- The marking-store route. The list now has three entries, not the envelope's two: a hosted store with a
  write policy and a key; browser-local levels with the JSON copied out for a commit; and the reader-token
  GitHub commit route now appearing in the worktree. The lane's stated preference (browser-local first) is
  advice only.

## Not done

No push, merge, tag, deployment, publication, credential, scope, key, table, workflow, warehouse, Layer 1 or
Layer 2 action. No controller, bridge or limit change; no controller pause or stop; no subagent; no external
message; no holdout or prospective observation read. The unrelated canonical dirty state (a modified
`tools/strategy-node/Strategy.code-workspace` and five untracked `backtester/` Gold session-policy files) was
left exactly as found, and the live-trading worktree's uncommitted work was not staged, reverted or committed.

## Correction to central memory

A pre-existing defect was found and fixed while editing this cycle's files: the twelfth-cycle entry in
`docs/orchestration/DECISIONS.md` carried a NUL byte where the leading `0` of this submission's hash belonged, which made
that file binary to Git and suppressed every readable diff of it. The byte is restored so the recorded hash reads
`0896430d...`; no other byte is changed and no decision is affected.

## Unresolved

(a) the marking-store route; (b) the production go-ahead for the port. Both are the user's. No new assignment
is published: a second assignment on this lane while those stand would break the one-active-milestone rule.
Backtester-harness `20261003-backtester-harness-asset-store-and-tabs-r2` (12,820 bytes, sha256 `a727c850...`)
remains `pending_review`, untouched by this cycle.