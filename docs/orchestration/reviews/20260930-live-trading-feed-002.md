# Live-trading feed-002: changes requested, one bounded documentation correction; the boundary stays the user's

Reviewed on 2026-09-30 by the background Central Orchestrator (a controller-locked run, a session separate from
authorship; the controller lock named this submission, so no interactive pause/stop was run). Submission
`20260930-live-trading-feed-002`, mailbox SHA-256
`088e8a9515fddcc149edd6bc41230952f141d8075a16bf7ba04b4e429e4c0f21`, reproduced independently from the immutable inbox
file (17,248 bytes) and equal to the requested hash. Reply published at
`.local/orchestration/replies/live-trading/20260930-live-trading-feed-002.json` (3,908 bytes, SHA-256
`0e24fda54cf6e5a3924a8970f81782bb881f1700ad4dd8f44eee943beef62c7c`), decision `changes_requested`, confirmed by
`node scripts/coordination.js check --worker live-trading` (state `changes_requested`, errors 0). A review decision is
not integration, merge, deployment or a trading result, and this one is not acceptance.

## Scope checked

Worker `live-trading`, worktree `.local/worktrees/live-trading`, branch `workers/live-trading-20260929`, base
`5ff1bf3` (the assignment baseline), reported head `65557be` verified an ancestor of the current tip `9a68050` (the
worker's own `-003` hand-over commit, filed after this submission), working tree clean at review. `5ff1bf3..HEAD`
holds 13 commits and `git diff --stat` gives 3,236 insertions and 2 deletions across exactly the 12 files the report
lists. No registry, harness, ledger, n8n export, warehouse file, Layer 1 input, scheduler or credential file is in the
range. The canonical checkout was read only and its unrelated dirty state was left untouched.

## Independent verification (reproduced, not trusted)

- **Producer is read-only by construction.** `tools/mt5-bridge/live-trading-snapshot.py` calls only `initialize`,
  `shutdown`, `last_error`, `terminal_info`, `account_info`, `symbol_info`, `symbol_info_tick`, `copy_rates_from_pos`,
  `positions_get`, `orders_get`. There is no `order_send`, `order_check` or positions-close call anywhere in the
  changed set; the only textual hits are the test's allowlist assertion and the docstring. The allowlist test that
  stops a non-read-only call being added passes.
- **Artifact.** `data/live-trading.json`, 27,727 bytes, sha256 `b3db6cc5...`, `generated_at_utc`
  `2026-09-30T19:28:37.575240Z`, four instruments, masked account `***614`, zero positions and zero orders.
  `node scripts/validate_live_trading_feed.js data/live-trading.json` returns `PASS` when the coordinator runs it.
- **Tests.** `node --test tests/live_trading_feed.test.js` in the worktree: 18 tests, 18 pass, 0 fail (coordinator
  re-run). The worktree has no `node_modules`, so the full `npm test` cannot run there; the worker disclosed that and
  did not claim otherwise.
- **Dashboard wiring.** `index.html` +2 rail lines and +15 section lines; `styles.css` +50 live-trading-scoped lines
  and no deletion; the script additions are live-trading-scoped. "The section exists in exactly one copy" verified: the
  canonical checkout (HEAD blob 19,251 bytes, working copy 19,698 bytes), all eleven other worktrees and the four
  `.local/*-release` copies carry zero `live-trading` references; only this worktree's `index.html` (20,315 bytes)
  carries them.
- **Credentials.** No credential value appears in any changed file; `config/credential-manifest.json`,
  `docs/CREDENTIAL_CONTINUITY.md` and the canonical folder are untouched.

## Defects found (the reason for changes requested)

1. **Mis-attributed live evidence.** The summary states "Live evidence at the last producer run,
   2026-09-30T19:28:37Z" with EURUSD 1.13292/1.13294, XAUUSD 4151.17/4151.58, US100.cash 30571.33/30572.78, BTCUSD
   83683.95/83684.95. Those four quotes reproduce exactly in the ignored scratch file `tmp/live-trading.real.json`,
   `generated_at_utc 2026-09-30T19:15:25.891323Z` - a different run. The committed artifact at the claimed
   19:28:37.575240Z holds 1.13310/1.13312, 4153.30/4153.71, 30558.33/30559.78, 83739.20/83740.20. Spreads and account
   facts match both runs, so only the attribution is wrong; the sentence as written is still false, and this project
   treats a disproved claim in a report as a correction owed.
2. **The same 19:15:25Z console text is the example block in `tools/mt5-bridge/README.md`**, presented without its
   run time, so it reads as generic sample output when it is one real reading.
3. **"the canonical index.html at 19616 bytes" does not reproduce.** Canonical HEAD is 19,251 bytes and the canonical
   working copy is 19,698 bytes; 19,616 is the size of the seven `backtester-<asset>` worktree copies. The
   load-bearing claim behind the figure (no other copy carries the section) is nevertheless true.

## Boundary ruling (recorded, not granted)

The work exceeded the published `live-trading-001` scope in three ways that the worker disclosed rather than hid: the
`MetaTrader5` 5.0.6231 package was installed into the user's Python, the user's own logged-in terminal was attached
read-only and facts about the user's own evaluation account were read, and files outside `docs/live-trading/` were
written. The worker's account is consistent with the artifacts and with its activity record. The coordinator does not
retroactively authorise any of the three and does not read them as approval; the three-way authority question -
read-only feed, demo execution, or funded execution - is the user's and stays open, which is exactly what the
published assignment requires. No order path exists in the deliverable; nothing was pushed, merged, tagged, deployed,
bought or scheduled; no credential value was requested, read, stored, logged or committed; and n8n, the warehouse,
Layer 1 and the sealed prospective window were not touched.

## Unresolved and the user's

- The authority level. Until the user rules, the lane cannot grow an execution path and the coordinator does not open
  one.
- The publish route for the dashboard section, which is the subject of the separate, unreviewed submission
  `20260930-live-trading-publish-003` and is not decided here.
- The FTMO written confirmation for automated trading and for news trading inside a Swing evaluation. The repository
  holds an in-chat user answer, not the written confirmation earlier sessions made a gate; whether to draft that
  support email and hold it unsent in `docs/live-trading/` is the user's.
- The 660-second M5 freshness limit and the fifteen-minute staleness badge are a disclosed first cut; re-deriving or
  tightening them is open.

## Integration and deployment status

None. Nothing was merged to `main`, published to the dashboard address, scheduled on any host, or added to a workflow,
and no new assignment was published. The section and the artifact remain in the worker checkout only. The register
keeps `live-trading` at status exactly `instructions_published_awaiting_worker` so the reply stays deliverable.

## Notes

- The report lists 12 commits where `5ff1bf3..HEAD` holds 13; the omitted one is the lane's own earlier harness commit
  `f6a62cb`, which the summary itself names as the acknowledged head, so the base is honest and the account is
  complete in substance.
- The live-trading worktree's ignored `tmp/` also holds another lane's scratch (Gold page screenshots and
  `gold-asof-cli-*` directories), so "the worker's own ignored tmp" is not lane-exclusive at present. Not a defect of
  this submission; recorded so a later reviewer is not surprised.
- One ignored coordinator scratch file, `.local/orchestration/tmp/write-probe.txt`, was created during this run as a
  write-capability check and could not be removed (`Remove-Item` is refused by the command policy in this session).
