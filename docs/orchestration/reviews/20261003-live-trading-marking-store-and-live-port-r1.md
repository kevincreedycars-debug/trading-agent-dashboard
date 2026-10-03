# Durable review: 20261003-live-trading-marking-store-and-live-port-r1

Worker: `live-trading`. Assignment: `live-trading-001` (the filing), superseded by `live-trading-002` for the
next bounded step. Reviewed 2026-10-03 (twenty-ninth cycle, background review) from the canonical checkout under
the controller lock that owns this run (`.local/orchestration/controller/run.lock` ->
`{"pid":8184,"submission":"20261003-live-trading-marking-store-and-live-port-r1"}`, controller status `reviewing`
with the same detail).

- Mailbox: `.local/orchestration/inbox/live-trading/20261003-live-trading-marking-store-and-live-port-r1.json`,
  7,577 bytes, sha256 `e1aaf8f2b1d400b935476be4ffe1611c6e2bd599b2a5eabe7bfa2d1149c9af3e`, reproduced from the
  immutable inbox file and equal to the requested hash.
- Reply: `.local/orchestration/replies/live-trading/20261003-live-trading-marking-store-and-live-port-r1.json`,
  8,955 bytes, sha256 `6491d43d9bbde630fae5f4ccbd67ced114bced3aec1232862e80c152d83edd40`, decision `accepted`.
- Assignment: `docs/orchestration/assignments/live-trading.md` gains the `live-trading-002` revision this
  cycle, and the register row moves to assignment id `live-trading-002` at status exactly
  `instructions_published_awaiting_worker`.

## Decision

**accepted** - the filing is a truthful record of the two rulings the user gave, every claim it makes about the
repository verifies, and one bounded follow-on assignment is published. Acceptance covers the filing and the
rulings it carries as the user's own words. It does not accept the marking route's code, which stays a disclosed
overrun until the port itself is reviewed and published; nothing was merged, pushed or published this cycle.

## What the envelope claims, and what verifies

The envelope declares `base_commit` `5ff1bf3d`, `head_commit` `464fb2c7`, commits `31a3bb67` and `464fb2c7`,
two changed files, an empty `dirty_files` list, branch `workers/live-trading-20260929` and worktree
`.local/worktrees/live-trading`. Reproduced from the checkout rather than trusted:

- **Range and scope.** `464fb2c` is the branch head and its sole parent is `31a3bb67`, the head the accepted
  r2 reply is bound to, so "the only change since the accepted head is one documentation commit" is exact:
  `git diff --numstat 31a3bb67..464fb2c` is two files, 57/0 (`CONVERSATION_NOTES.md`) and 33/0
  (`STRATEGY_LIVE.md`), 90 insertions and no deletions, matching the declared `+90`. `git status --porcelain
  --untracked-files=all` prints nothing, so `dirty_files: []` and "no code file was touched" are facts of the
  tree, and the commit touches nothing outside `docs/live-trading/`.
- **Artifacts.** `docs/live-trading/CONVERSATION_NOTES.md` reproduces byte-exactly at 81,261 bytes, sha256
  `276550302f4b7f16096663e5594b096059aa4f04c6b8f921fb644fb4f10a3402`, blob `17fb8a36ac29a4a5dbd6d5682dee8ca6c2e971f4`,
  CRLF materialisation (1,001 CRLF, 0 bare LF; 80,260 bytes in LF form), and its new seventh 2026-10-03 entry
  carries the reply outcome, both rulings in the user's words and the order of work, as declared.
  `docs/live-trading/STRATEGY_LIVE.md` reproduces byte-exactly at 72,905 bytes, sha256
  `1b575198e66258232852bb3830d8652df9b1aefb09c6e575940ba79160f72374`, CRLF materialisation (831 CRLF, 0 bare
  LF; 72,074 bytes in LF form), and its new section 22 carries the ruled store and the requested port. The
  declared reply artifact reproduces at 9,926 bytes, sha256 `6f97555d9e5c8743d6a8286916331bd912b108dbd0fc4d2d0919dbbeefd1ce5b`,
  and is the accepted r2 reply this filing answers.
- **Tests re-run here rather than trusted.** `node --check` exits 0 on `script.js`, `lib/l2l_levels_store.js`,
  `lib/l2l_ladder.js` and `scripts/l2l-levels-tool.js`; `node --test tests/l2l_levels.test.js
  tests/live_trading_feed.test.js` is 82 tests, 82 pass, 0 fail; `node scripts/l2l-levels-tool.js --check` exits
  0 with `PASS` on `data/l2l-levels.json` (743 bytes, sha256 `c383997c`, blob `2a0aef4f`), four instruments each
  at 0 levels, 0 seeds and 0 derived. The disclosure that `npm test` was not run in the worktree - it has no
  `node_modules`, verified - is the honest reading, and the withdrawn repo-wide line stays withdrawn (449 of 449
  here, with `backtester/tests/secret_scanner.test.js` alone at 5 of 5).

## Notes of record, neither of which changes the decision

1. **One declared blob is wrong: a sibling file's.** The envelope declares `docs/live-trading/STRATEGY_LIVE.md`
   at git blob `d82e0f346b0d65007769f5fa7e54b30a5d8b0720`. That blob is `docs/live-trading/FTMO_SETUP_GUIDE.md`,
   16,188 bytes. The reviewed file's blob at `464fb2c` is `cd2ee4b3218b0462147357a0c13eb5add1a12a7d`, confirmed
   twice (`git ls-tree HEAD` and `git hash-object` over the CRLF worktree file) and equal in both line-ending
   forms once normalised. The path, the byte count and the sha256 all name the reviewed file unambiguously, its
   content reproduces from the commit, and no substantive claim depends on the field, so no re-file is owed; the
   field is to be corrected in the lane's own documents the next time either is revised. The sibling artifact's
   declared blob is its real one, so this is a single mis-transcription rather than a pattern.
2. **`base_commit` again names the register baseline, not the range parent.** `5ff1bf3d` is the lane's starting
   commit and `projects.json`'s `baseline` for this row; the declared commits' actual parent is `2ac080a2`,
   whose own parent is `482aabc4`. The prose in the envelope is correct about that and the convention is the one
   the r2 reply already recorded, so the structured field stays read as the baseline.

## Production and dependency impact

- **Nothing was pushed.** `git ls-remote origin` answers `refs/heads/main` at `f8bc80f` and no
  `refs/heads/workers/live-trading-20260929`, so the lane's branch is not on the remote and production `main` is
  untouched by this lane.
- **The requested capability is genuinely not live.** `origin/main` is `f8bc80fe1d44a050ebfc247b24ae21cfe2bbf852`
  and carries the endpoint-only marking: `liveTradingLevelsEndpoint` is present in `script.js` while
  `liveTradingLevelsCanMark`, `liveTradingPublish` and `L2LLevelsStore` are absent, and `index.html` on main
  loads neither `lib/l2l_ladder.js` nor `lib/l2l_levels_store.js`. The 1h and 4h views and the marking the user
  asked for therefore exist only in the lane's worktree.
- **The port manifest the envelope names is right.** main already carries `scripts/l2l-levels-tool.js`
  `a2540603`, `tests/l2l_levels.test.js` `3ff25f13`, `scripts/README-l2l-levels-tool.md` `87663048` and
  `data/l2l-levels.json` `2a0aef4f` from the earlier port; the worktree's versions of the first three differ
  (`70f26ce6`, `85ea2f46`, `2369ad13`) and `data/l2l-levels.json` is byte-identical, so the eight-file list
  holds and the port stays the already-ruled hunk recipe rather than a merge. main's other three files are
  `script.js` `5190c40f`, `index.html` `45f8b42a` and `styles.css` `e5453d06`, all different from the lane's.

## Boundaries and scope

The code files remain outside the filing assignment's owned scope and stay a disclosed overrun; the new revision
authorises a **local candidate** only. No order path was created or widened; no broker connection, credential,
key, table or arming; Layer 1 stays independent and backtesting downstream-only; the sealed Gold prospective
window stays sealed until `2027-03-25T15:00:00Z`; and nothing in a ported chart view is edge, accuracy, causal
feature-timing or profit evidence. The lane's branch and worktree were left exactly as found, and the two
uncommitted-in-canonical items (the modified `tools/strategy-node/Strategy.code-workspace` and the five untracked
`backtester/` gold session-policy files) are untouched.

## Assignment published

One bounded revision, `live-trading-002`, appended to `docs/orchestration/assignments/live-trading.md` with the
register row set to assignment id `live-trading-002` at status exactly `instructions_published_awaiting_worker`:
prepare the live port candidate from the verified `origin/main` tip by the ruled hunk recipe, evidence it with
the diff, per-file blob and sha256, `node --check` and the focused tests, file one submission, and push nothing.
The production fast-forward onto `main` stays the coordinator's step in a user-authorised cycle, because this
background run may make no production change.

## Unresolved decisions, the user's or the coordinator's

1. **The production port itself.** The user's go-ahead is recorded; the execution is a production change on
   `main` that this background cycle cannot make, and it waits for the reviewed candidate.
2. **The entry rule, ladder reading and everything after it** stay in the order the user set, with the seed
   levels still the user's judgement on the chart: nothing has been marked, so `data/l2l-levels.json` still
   carries four instruments at zero levels.