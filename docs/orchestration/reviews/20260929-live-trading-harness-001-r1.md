# Live-trading harness-001-r1: the harness and design pass is accepted as a reviewed record; the two digests that miss the canonical checkout are explained, not wrong

Reviewed on 2026-09-30 by the Central Orchestrator in an interactive session run at the user's instruction, as
the review queued second after the gold factor draft page publish. Submission `20260929-live-trading-harness-001-r1`,
mailbox SHA-256 `781094d23e5d454a222bf05171c4c6cb8a9ed193a2c39fb45566dacc980eeea5`, reproduced independently from the
immutable inbox file (9,653 bytes) and equal to the requested hash. Decision `accepted`. Acceptance is a reviewed
record, not an adoption, merge, deployment or trading result: nothing was pushed, merged, tagged, deployed or
published by this review, and no lane is opened by it. `-001` stays superseded by this revision.

## What the submission is

The revision of this lane's harness and design pass, documentation only: `docs/live-trading/STRATEGY_LIVE.md` and
`docs/live-trading/CONVERSATION_NOTES.md`, one commit `f6a62cb` on top of the assignment baseline `5ff1bf3`. Its
re-verification of the assignment's starting picture, its ranked options and its one recommended bounded next step
are what this review checks. It claims no code, no connection, no credential, no install, no order and no arming.

## Scope checked

Worker `live-trading`, worktree `.local/worktrees/live-trading`, branch `workers/live-trading-20260929`, base
`5ff1bf3` verified an ancestor of the submitted head, submitted head `f6a62cb` a single documentation commit
(`5ff1bf3..f6a62cb`) over exactly the two files the envelope lists, working tree clean at review. The lane's tip
has since moved on by its own later commits (`8dfda17`, `65557be`, `9a68050`, `4d82bb3`), each reviewed separately.
No registry, harness, ledger, n8n export, warehouse file, Layer 1 input, scheduler or credential file is in the
reviewed range. The canonical checkout was read only; its unrelated dirty state
(`tools/strategy-node/Strategy.code-workspace` modified) was left untouched.

## Independent verification (reproduced, not trusted)

- **Both artifact hashes reproduce exactly, as the CRLF materialisation of the lane's own committed blobs.**
  `docs/live-trading/STRATEGY_LIVE.md` reported 11,403 bytes sha256 `F1F3FC8C...` is the CRLF form of the
  committed blob at `f6a62cb` (11,229 bytes, sha256 `460a2622...`); `docs/live-trading/CONVERSATION_NOTES.md`
  reported 3,870 bytes sha256 `D0FED571...` is the CRLF form of its blob (3,809 bytes, sha256 `b9fcf734...`).
  Both conversions were reproduced byte for byte, which is the same rule already recorded for this repository
  (`core.autocrlf=true`, no `.gitattributes`) and for the gold factor page release.
- **Four of the six cited central digests reproduce byte-exactly** from the canonical checkout as it stands:
  `data/research-proof-map.json` `497AFC0B...` (4,589 bytes), `docs/MT5_MIRRORED_EXECUTION_CHART_REFERENCE.md`
  `EA097914...` (1,116 bytes), `data/layer1.json` `9BD5D8DD...` (417,783 bytes), `data/layer2.json` `59C52354...`
  (673 bytes).
- **Two cited digests do not reproduce from the canonical working copies, and neither is a content error.**
  `docs/ARCHITECTURE.md` `68569020...` is the CRLF form of the lane's own base-and-tip blob `722ded94`
  (2,396 bytes): the canonical line replaced that document the next morning (commit `453505f`,
  2026-09-30T08:39) with blob `4e9902ee` (3,595 bytes), so the figure is a measurement that moved after the
  lane filed, not a wrong one. `config/credential-manifest.json` `69230DD5...` is the CRLF form (7,522 bytes) of
  blob `5dc1c713` (7,287 bytes), which is **still** canonical `HEAD`'s blob: the content is unchanged and only
  the working-copy materialisation differs (the canonical working copy is 7,497 bytes with mixed endings and git
  reports it clean, which is exactly why a raw-byte hash of a working copy is not a content fingerprint here).
- **The lane's re-verification of the starting picture holds.** `origin/main` carries no file named like `mt5`,
  `MetaTrader`, `bridge` or `live-trading`, and its only textual MT5 hits are the `needs_you` feed item and gate
  evidence in `data/research-proof-map.json`, the engine-map legend string in `script.js`, one
  `data/backtest-engine.json` entry and one test file: no connector, client, bridge or order path exists on the
  published line. The proof map still carries *"Provide an MT5 data export or read-only feed"* as `needs_you` with
  the `executable` gate `blocked`; `config/credential-manifest.json` contains zero MT5 mentions;
  `data/layer1.json` is still `last_updated_et` 2026-09-07T06:14:59.998Z with `publication_consistency` UNKNOWN,
  an empty `source_run_ids` and `refresh_schedule_status` PROVISIONAL; `data/layer2.json` still offers no trade
  opportunities and its `avoid_today` rows still cite missing 24H conviction; and
  `data/half-l2l-executable-entry-v1-draft.json` still declares `research_only` with status
  `DRAFT_BLOCKED_FROM_PROFITABILITY_EXECUTION`.
- **The probe evidence exists in the lane's ignored scratch, unmodified:** `tmp/harness-probe.json` (5,280 bytes,
  sha256 `88E68D09...`), `tmp/harness-probe.ps1` (4,338 bytes, sha256 `0CEE9640...`), `tmp/inspect-layer1.cjs`
  (1,966 bytes, sha256 `AC2E2AA0...`).
- **The lane's own suite re-runs.** `node --test tests/coordination.test.js tests/monitor_state.test.js` in the
  lane worktree: 11 tests, 11 pass, 0 fail, reproducing the reported figure. There is no `node_modules` in that
  worktree, so the browser suites were not run there and the report does not claim they were.
- **The window is registered and talking.** `docs/orchestration/projects.json` carries `live-trading` with
  `live-trading-001`, worktree and branch exactly as reported; `.local/orchestration/connections/live-trading.json`
  reads `watching` on extension 0.2.1 (updated 2026-09-30T20:11:40.273Z) and `.local/orchestration/activity/`
  carries the lane's own activity record.
- **Credentials.** No credential value appears in either artifact, and `config/credential-manifest.json`,
  `docs/CREDENTIAL_CONTINUITY.md`, n8n, the warehouse, Layer 1 and the sealed prospective window are untouched.

## Rulings recorded in the reply

1. Accepted as the reviewed record of this lane's harness and design pass. Nothing is adopted, merged, installed,
   deployed or published by that acceptance, and no authority grows from it.
2. The lane's own load-bearing finding is recorded rather than dismissed: the blocker before a live order is
   publication timing, not the connector - `data/layer1.json` still publishes no authoritative call time, so a
   live order would have no clock to bind to. That is a reason the ranked order (read-only feed first) is right.
3. The five open questions stay the user's and are put to them in plain words: authority level; which account and
   terminal; instrument and size; timing source of truth and the staleness that would be acceptable; and whether
   the mirrored view is local only or published. Until the user rules, this lane grows no execution path and the
   coordinator opens no lane for one.
4. The scope ruling stands, recorded and not granted: the `MetaTrader5` install, the read-only read of the user's
   own live account and the writes outside `docs/live-trading/` are disclosed and were not authorised by
   `live-trading-001`; the later publish of a read-only panel is not approval of them either.

## Note, not a defect

Both documents have moved since: at the lane's current tip `docs/live-trading/CONVERSATION_NOTES.md` is 35,200 LF
bytes (sha256 `D3AD9E2E...`; CRLF form 35,678 bytes, `D41DE6A9...`, the figure the `-004` review recorded) and
`docs/live-trading/STRATEGY_LIVE.md` is 20,218 LF bytes. The revision reviewed here is the `f6a62cb` form, and no
claim in it was withdrawn by the later revisions.

## Not done, and the precise unresolved decisions

No production action was taken by this review and no new assignment was published: no evidence supports one while
the decisions below are the user's. Unresolved and the user's: the three-way authority level; which broker,
terminal and symbol a path would ever start from; the timing source of truth and its acceptable staleness; the
local-or-published question for the mirrored view; and the FTMO written confirmation for automated and news
trading inside a Swing evaluation, for which the repository holds an in-chat answer rather than the document.

Separately from this review, and on the user's own word given in the same cycle, the section this lane handed over
in `20260930-live-trading-publish-003` was published by the coordinator: release commit `bc538d7` on production
`main`, one side-rail entry `Live Trading` under a new `Live` group, the four page files plus a browser guard, live
at `https://kevincreedycars-debug.github.io/trading-agent-dashboard/index.html`.
