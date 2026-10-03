# Durable review: 20261003-live-trading-live-marking-and-ladder-r2

Worker: `live-trading`. Assignment: `live-trading-001`. Reviewed 2026-10-03 (twenty-first cycle,
background review) from the canonical checkout under the controller lock that owns this run
(`.local/orchestration/controller/run.lock` -> `{"pid":8184,"submission":"20261003-live-trading-live-marking-and-ladder-r2"}`).

- Mailbox: `.local/orchestration/inbox/live-trading/20261003-live-trading-live-marking-and-ladder-r2.json`,
  13,222 bytes, sha256 `e9470238415b9c3cbf30ef0da87234331cd73ac043e79592abc138f9303cc9b5`, reproduced from the
  immutable inbox file and equal to the requested hash.
- Reply: `.local/orchestration/replies/live-trading/20261003-live-trading-live-marking-and-ladder-r2.json`,
  sha256 `6f97555d9e5c8743d6a8286916331bd912b108dbd0fc4d2d0919dbbeefd1ce5b`, decision `accepted`.
- Assignment: `docs/orchestration/assignments/live-trading.md` (unchanged this cycle; registry keeps
  `live-trading` at status exactly `instructions_published_awaiting_worker` so the reply stays deliverable).

## Decision

**accepted** - the correction the previous reply (`changes_requested`, reply
`0ff2f5431636c6fbfc94f76836120169b2aa43587b3f7126efe117a99af5a80b`) required is delivered and every claim in
the envelope verifies. Acceptance is of the filing, not of the route it discloses: the page-side commit route
stays unaccepted, unmerged and unpushed, and both open decisions stay the user's.

## What the envelope claims, and what verifies

The envelope declares `base_commit` `5ff1bf3d`, `head_commit` `31a3bb67`, commits `2ac080a2` and `31a3bb67`,
ten changed files, an empty `dirty_files` list, branch `workers/live-trading-20260929` and worktree
`.local/worktrees/live-trading`. Reproduced from the checkout rather than trusted:

- **Range and scope.** `31a3bb67^` is `2ac080a2` and `2ac080a2^` is `482aabc4`, so the declared pair is a
  two-commit chain. `2ac080a2` is 8 files, +1784/-461 against `482aabc4`; `31a3bb67` is 2 files, +240/-2
  against `2ac080a2`. The union is exactly the ten declared files, and `git diff --stat 482aabc4..31a3bb67`
  reports the matching total of 10 files, +2024/-463. `git status --porcelain` at `31a3bb67` prints nothing,
  so `dirty_files: []` is a fact of the tree rather than a claim about it.
- **Artifacts.** Every declared file reproduces byte-exactly in the worktree copy at that head in its CRLF
  materialisation, with the declared byte count, sha256 and a matching git blob: `lib/l2l_levels_store.js`
  35,195 / `e02f8d50...` / `8b5e41d7`; `script.js` 822,282 / `3fce35e9...` / `787c23b5`; `index.html` 20,467 /
  `dc865d47...` / `64ea0767`; `styles.css` 230,355 / `6feb5c62...` / `ea1716a0`; `scripts/l2l-levels-tool.js`
  12,533 / `94cfa177...` / `70f26ce6`; `tests/l2l_levels.test.js` 72,832 / `1b7fc08e...` / `85ea2f46`;
  `config/secret-scan-allowlist.json` 2,721 / `1367abae...` / `ce2f69be`; `scripts/README-l2l-levels-tool.md`
  16,355 / `7c1c93a0...` / `2369ad13`; `docs/live-trading/CONVERSATION_NOTES.md` 76,204 / `0e9a7f79...` /
  `ffec875c`; `docs/live-trading/STRATEGY_LIVE.md` 70,293 / `94310d23...` / `74b52fd2`. The two files declared
  unchanged are unchanged: `data/l2l-levels.json` 743 / `c383997c...` / `2a0aef4f`, the same hash the previous
  reply verified, and `lib/l2l_ladder.js` 8,467 / `344a499d...`.
- **The route, read from the code.** `lib/l2l_levels_store.js` carries `API_ROOT "https://api.github.com"`,
  `DEFAULT_REPO "kevincreedycars-debug/trading-agent-dashboard"`, `DEFAULT_BRANCH "main"`, and
  `buildCommitRequest` as `method: "PUT"` to `/repos/{owner}/{repo}/contents/{path}` with `branch` in the body;
  no pull request, review branch or approval step appears anywhere in the file. `commitLevels` runs
  `validateLevelsState` first and refuses a state the checker would reject, and refuses to overwrite a file
  whose remote sha moved since the read (409, `force` to override). The token is read only from the reader's
  field or the settings key `l2l-levels-publish-v1`, kept in session storage unless "remember on this device"
  is ticked (then local storage) and removed from both by Disconnect; it is never written into the artifact.
  The page wiring reproduces: `liveTradingLevelsCanMark()` returns endpoint OR store; `index.html` adds exactly
  one script tag for the store ahead of `script.js`; `config/secret-scan-allowlist.json` gains exactly one
  entry, the `script.js` token-by-reference line, with its reason.
- **Withdrawals.** Both sentences the previous reply required withdrawn are corrected where the reply asked:
  the fourth entry's "no write path was created" is amended in place, the departure from "starts no further
  work" is recorded, the sixth entry states the route plainly, and `STRATEGY_LIVE.md` section 21 carries the
  same correction with the scope position. All in `31a3bb67`.
- **Tests.** `node --check` exits 0 on the four files; `node --test tests/l2l_levels.test.js
  tests/live_trading_feed.test.js` re-run by the coordinator in the worktree is 82 tests, 82 pass, 0 fail.
- **The stop.** No push, no merge, no pull request, no publication; the lane's activity record reads `paused`
  against this envelope.

## Two notes of record, neither of which changes the decision

1. **`base_commit` names the lane baseline, not the range parent.** `5ff1bf3d` is the parent of the lane's
   first commit `f6a62cb` and is `projects.json`'s `baseline` for this row; the declared commits' actual parent
   is `482aabc4`, which the envelope's own artifacts line names correctly. The previous envelope used the same
   convention. Read the structured field as the register baseline and the prose as the range.
2. **The repo-wide test line does not reproduce.** `npm test` (`scripts/test-local.js`, 156 local files,
   concurrency 4) reads 449 tests, 449 pass, 0 fail in this checkout, and
   `node --test backtester/tests/secret_scanner.test.js` alone reads 5 of 5. The declared "515 tests, 511 pass,
   4 fail" and the assertion that the canonical suite is currently red are therefore not reproduced, and 515
   matches no invocation tried here. The four console-width `secret_scanner` cases remain a documented,
   environment-dependent and pre-existing condition already tracked in `CURRENT_STATE.md` and `CHANGELOG.md`,
   not this lane's work and not a defect in this envelope's own files. The lane's own 82-of-82 focused result
   reproduces exactly.

## Production and dependency impact

- **Nothing was pushed.** `git ls-remote origin` is reachable in this run and answers `refs/heads/main` only;
  `refs/heads/workers/strategy-advisory-20260920` is the sole worker ref, so `workers/live-trading-20260929`
  is absent from the remote.
- **`origin/main` moved and the previously recorded reading is superseded.** It is now `f8bc80f`
  (2026-10-03 15:30:19 +0100), with `2f25c8c` (gold.html, one gold bar entry, the draft factor page),
  `7ce136e` (refreshed MT5 snapshot with OHLC candles) and `f8bc80f` (the same snapshot republished with the
  corrected server-clock conversion) after `16104a3`.
- **The route is not live.** `origin/main:script.js` carries `liveTradingLevelsEndpoint` but no
  `liveTradingLevelsCanMark`, no `liveTradingPublish` and no `L2LLevelsStore`, and `index.html` on main loads
  neither `lib/l2l_ladder.js` nor `lib/l2l_levels_store.js`.
- **The port manifest is larger than script.js plus the store.** main already carries four of this lane's
  earlier site files from an earlier port - `scripts/l2l-levels-tool.js` (`a2540603`),
  `tests/l2l_levels.test.js` (`3ff25f13`), `scripts/README-l2l-levels-tool.md` (`87663048`) and
  `data/l2l-levels.json` (`2a0aef4f`) - and the worktree versions of the first three differ from main's
  (`70f26ce6`, `85ea2f46`, `2369ad13`). Any port must carry the rewritten tool, tests and README as well as
  `script.js`, `index.html`, `styles.css`, `lib/l2l_levels_store.js` and `lib/l2l_ladder.js`. The lane's base
  blobs are not main's (`faea91f0` against `5190c40f` for `script.js`, `4a0083fb` against `45f8b42f` for
  `index.html`, `5d2a7edf` against `e5453d06` for `styles.css`), so the port stays the already-ruled hunk
  recipe rather than a merge.

## Boundaries and scope

The code files are outside the assignment's owned scope (`docs/live-trading/` plus ignored scratch) and remain
a disclosed overrun and an open offer, not authorised or accepted work; nothing in the reply authorises them.
No code file in the envelope is accepted as work, nothing is merged, and the lane's branch and worktree were
left exactly as found. No order path was created or widened; Layer 1 stays independent and backtesting
downstream-only; the sealed Gold prospective window stays sealed until `2027-03-25T15:00:00Z`; the disclosed
overruns (the MetaTrader5 install, the read-only read of the user's own evaluation account, the writes outside
`docs/live-trading/`) remain recorded and unauthorised. The user's 2026-09-30 choice of funded trading answers
the authority question and nothing else.

## Unresolved decisions, the user's

1. **The marking-store ruling**, now with three entries: a hosted store with a write policy and a key;
   browser-local levels with the JSON copied out for a commit; and this reader-token GitHub commit route. The
   lane's browser-local-first advice is recorded as advice, overrulable only on the user's word.
2. **The production go-ahead** to port the unreported range (now `4d82bb3..31a3bb67`) onto `origin/main` by the
   already-ruled hunk recipe. Entry is (2), not (1) - rule the storage route first.

## No assignment published, and why

The filing carries no research ask. Both open items are the user's, a second assignment on this lane would
break the one-active-milestone rule, and the register keeps `live-trading` at status exactly
`instructions_published_awaiting_worker` so this reply stays deliverable through the bridge's newest-reply
event. No lane authority was widened, no lane was opened, and no production, credential, workflow, warehouse,
Layer 1, Layer 2, dashboard or trading action occurred in this cycle.
