# Review: 20261004-backtester-nq-001-stage-b

Worker `backtester-nq`, assignment `backtester-nq-001`, branch `workers/backtester-nq-20260929`,
worktree `D:/trading-agent-dashboard-codex/.local/worktrees/backtester-nq`.

- Mailbox submission: `.local/orchestration/inbox/backtester-nq/20261004-backtester-nq-001-stage-b.json`,
  18,999 bytes, sha256 `1305790aafe8a356ec678701b5e9e596697206abbc5affc4a33d188e612f4089`, re-hashed from the
  immutable inbox file and equal to the requested hash.
- Reply: `.local/orchestration/replies/backtester-nq/20261004-backtester-nq-001-stage-b.json`, 9,175 bytes at
  sha256 `ecb165a9ef339ea2a9ebb67667c0dc21c5f1fa0c53f39073dbe63ab4eb8830af`, decision `accepted`,
  `submission_sha256` equal to the inbox hash, published with the canonical mailbox CLI.
- New bounded assignment published: a `## Stage B.2 revision, published 2026-10-04` section appended to
  `docs/orchestration/assignments/backtester-nq.md` (18,332 -> 23,191 bytes, 234 -> 291 CRLF, 0 bare LF, sha256
  `43946356a328cb078fe496a16ebd258a3158dca6f689f4093f49942330e28460` ->
  `6147128bd77c695021cdba36e8a835c4318e7561ec7daad7d1d8a69ae195beb6`); register status stays exactly
  `instructions_published_awaiting_worker` under `backtester-nq-001`, which is what carries the wake for the new
  assignment content version.
- Decision: **accepted**, on the reviewed bytes only, as the Stage A readiness record plus the Stage B NQ
  foundation-load record for the window it covers. Stage B is not accepted as a complete-window fulfilment.
- Context: this is the fifty-sixth cycle (background review). The controller run lock names this submission
  (`controller/run.lock` = `{"pid":32960,"submission":"20261004-backtester-nq-001-stage-b"}`, `status.json`
  state `reviewing` on pid 32960, updated `2026-10-04T17:12:20.863Z`), so the run owns this review and no pause
  or stop was run.

## What reproduces, from the artifacts rather than the report

Worktree state, read not trusted: `.local/worktrees/backtester-nq` is on `workers/backtester-nq-20260929` at
HEAD `258151273afb5f9a434e81c1f3ea21048a264882`, whose sole parent is the declared base
`1bb3395536fdcf734104dbb40d623e3afecda7fb`; `git rev-list --count 1bb3395..HEAD` is 1;
`git diff --stat 1bb3395..HEAD` is exactly one file, `docs/backtester-nq/READINESS.md`, 544 insertions and 0
deletions; `git diff --name-status` lists that path only; `git status --short --untracked-files=all` prints
nothing; and `git ls-remote origin workers/backtester-nq-20260929` prints nothing. Nothing tracked moved, nothing
was staged, nothing was pushed.

The committed artifact reproduces byte-exactly. Blob `f2214fe44077b29611f58955dff31e4692e4453c`, 42,129 repo
bytes. The repo-byte (LF) sha256 `4e660bee8ef119e30187243a2f53b76209aad0bcacc2c02d3be72ad7dc909991` was
re-derived here rather than trusted: the 42,673-byte CRLF working copy carries exactly 544 CRLF pairs and 0 bare
LF, and hashing its LF normalisation gives that digest. The register-identity claim holds too: the canonical
`docs/orchestration/assignments/backtester-nq.md` was blob `0165e33ed49b944298f3389b9af2fe36addaebd7` at 18,098
repo bytes before this cycle's append (18,332 disk bytes / 234 CRLF / 43946356...), and the hash-bound
inventory re-derives on spot-check (`backtester/builders/nq/build_nq_historical_snapshots.js`
`c063a5e74d6b493e328dff0eb1f460f0e942ef81`, `backtester/scripts/validate_backtester_checker_nq.js`
`fd66522c81ee2484bebae38657d2b86ea29032ab`, `backtester/sql/009_nq_historical_market_snapshots.sql`
`c1cf1f0dbb1bc840bce2ffdc5300e51417c40ec4`, `backtester/importers/qqq/import_qqq_daily.js`
`451c7f266d0926545373d792daab8e6bece928ff`).

All five Stage B scratch digests reproduce byte-exactly against the ignored `backtester/tmp/` files:
`qqq_yahoo_chart_raw_2022_2024.json` 37,208 /
`dde914a5b5c7327622c3edb9541e01a326939f8692b174ebf1f24a02818326e3`;
`qqq_front_backfill_2022-10-01_2024-01-01.csv` 35,343 /
`306482b37e29352cd60d31938c0448dfcbbec4c88288c40df6c21aa7bc34d430` (also the manifest checksum);
`nq_foundation_load_verify_20261004.log` 10,346 /
`6093d2d10d25ac058f418eb15cdf46bbe0b18440406ba23c8c797175e4ad7242`;
`nq_calendar_holes_20261004.log` 6,164 /
`fe70720e6dc838e72c8e458815a0a03bed90b038b593a0554af27d095be9166d`;
`nq_snapshot_coverage_20261004.utf8.log` 3,824 /
`0445c067ff1002e75af5c8b5c7a9d54eaed7b163b17c2ed6b4c115a6e0bd117f`.

The load log re-derives every declared figure: `qqq_nq_proxy|daily` 897 rows, 897 distinct dates, 0 duplicate
rows, `2022-10-03` -> `2026-04-30`, `is_adjusted` `true` only, rows by manifest `e7916ef3-...` 313 plus
`74141dc6-...` 584 with no overlap and no join gap (313 + 584 = 897), max calendar gap 4 days; the
`seam_like_for_like` block reproduces the control pair at 0.000000 pp drift in all three vendor bases and the
`2023-12-29` -> `2024-01-02` pair at 0.102453 pp; and the calendar audit reproduces 37 named closures, an empty
`missing_weekdays_that_are_not_named_closures`, an empty `named_closures_present_in_series`, and
`uncovered_tail_expected_trading_days` 105 against `authorised_end` `2026-09-30`. The vendor probe reproduces
without writing any credential: OANDA `QQQ_USD` HTTP 400 (`Invalid value specified for 'instrument'`), Stooq
HTTP 403 with an `text/html` body that is not CSV, Yahoo chart v8 HTTP 200 with an `adjclose` block. The importer
is inert as the filing states: `backtester/importers/qqq/import_qqq_daily.js` calls `upsertRows` with no
`TRUNCATE` and no `DELETE`, stamps `import_mode: "historical_backfill"`, and is wired into no cron, workflow or
daily call.

## The Stage B write, and its authorisation

The Stage B revision appended to this assignment on 2026-10-04 authorises the NQ foundation load, and the
`DECISIONS.md` entry recording the user's tandem publication is the authorisation record. What was written
matches that authority: 313 insert-only rows into `historical_price_series` for `qqq_nq_proxy|daily` over
`2022-10-03` -> `2023-12-29`, plus one metadata patch on manifest
`e7916ef3-2b19-415f-9a55-7f57a2ef92ba` adding the `checksum` and provenance. Accepted as the NQ foundation and
its provenance for the window it covers, not as an outcome basis. No edge, accuracy, session-policy, timing or
qualification claim is made anywhere in the filing, and none is granted here.

## Deviations accepted and recorded, not counted as defects

1. **Route.** The front window was acquired from the Yahoo Finance chart v8 endpoint rather than the
   instrument-parameterised OANDA downloader the shared template body names. That is correct: OANDA has no QQQ
   instrument (the lane's own probe answers HTTP 400), YahooFinance is already the vendor of record for
   `qqq_nq_proxy`'s 584 pre-existing rows, and the lane's binding provider row is
   `backtester/importers/qqq/import_qqq_daily.js`, which is the importer it used. No new vendor was introduced.
2. **Manifest patch.** The manifest `checksum` and provenance metadata were written by the lane's ignored
   scratch script `backtester/tmp/patch_nq_manifest.js`, because the importer CLI exposes no checksum flag and
   `ensureManifest` replaces the whole metadata blob. It modified no series row and no other manifest row, and
   it is the reason the assignment's provenance requirement is met at all. Coordinator-owned follow-up,
   recorded and not fixed here: the importer should gain a checksum/provenance flag so a future load does not
   need a hand-written patch.

## Answers this review can give

- **Q3 (window end) is answered and is not open.** The assignment's agreed target is `2022-10-01` ->
  `2026-09-30`, so the window ends `2026-09-30`. That is why Stage B is accepted only for what it covers, and
  why the 105 expected trading days `2026-05-01` -> `2026-09-30` are the single remaining piece of the same
  authorised mandate rather than new scope.
- **On the lane's 8.3.1 sequencing argument** (answer the basis first, to avoid a third vintage): the tail does
  not require the user's basis answer, because it continues the basis already in the spine for every
  `qqq_nq_proxy` row (`is_adjusted = true`, `source_adjusted_close`), so it creates no new rule. What it does
  create is a third acquisition vintage, so the Stage B.2 revision requires the new `2026-05-01` join to be
  measured like-for-like exactly as the `2024-01-02` join was, not assumed. If the user changes the basis
  before the tail is acquired, the lane stops and re-files rather than acquiring under a superseded basis.
- **Q1 (daily-price basis), Q2 (close-to-close versus a true NY open-to-close), Q4 (the QQQ ETF proxy versus NQ
  futures) are the user's** and are recorded, not answered. Q2 is the same basis question every sibling lane
  carries, and the 2026-10-04 NY session-timing ruling settles the session clock only.

## Reviewed limitations, so this acceptance is not read as more than it is

The warehouse rows were **not** re-read: a read-only coordination review does not open the market-importers
credential scope, so the 313 rows, the manifest patch, the duplicate check and the seam/calendar read-back are
accepted on the lane's captured evidence, coherent with the two `tmp` digests re-derived here. The accepted
`READINESS.md` register-identity line quotes the pre-revision assignment blob `0165e33e...`; this review appends a
Stage B.2 section to that assignment, so its blob and bytes move and the lane must refresh that line in its next
filing.

## The precise unresolved decision, and what was published instead

No user decision is invented and none is bypassed. The new bounded assignment is the tail-completion step that
the Stage B revision's own window already authorised; it expands no scope, decides no reserved question, and its
boundaries are unchanged. The precise unresolved decisions remain the user's alone, in the order that gates
everything downstream: (a) the NQ daily-price basis of record - the loaded rows are `is_adjusted = true` with
`adjustment_type = source_adjusted_close`, and a source-adjusted series is rewritten when the vendor re-bases
it, which is the property the measured `0.102453` pp seam exhibits, against a raw close or an explicitly
declared adjusted-to-a-reference-date series; (b) whether the following-24hrs horizon for NQ is close-to-close
or a true NY open-to-close, which needs a second intraday source or a re-declared outcome definition; and (c)
whether `qqq_nq_proxy` remains the NQ instrument of record or NQ futures are wanted, which changes the vendor
route and re-keys the whole stack. Carried beside them and coordinator-owned: the one bounded USD/EUR/NQ/BTC
session-policy and outcome-definition registry assignment (a single NQ registry does not exist and
`backtester/registries/` is gold-only), the importer checksum/provenance flag, the untracked canonical
`backtester/registries/gold_session_horizon_policy.v1.json` discrepancy (34,787 bytes, differing from every
tracked copy) that blocker 5 raises, the assignment-not-tracked-in-the-lane-worktree note in blocker 6, and the
CRLF/`.gitattributes` convention question, with nothing allowed to silently renormalise a bound digest.

## Boundaries observed by this cycle

No builder, checker, registry, session policy, outcome definition, factor ranking, adapter or edge claim was
written, changed or run; no outcome, holdout or prospective observation was read and no final holdout was
consumed; Layer 1 stays sealed and independent and backtesting stays downstream only. No warehouse, credential,
deployment, merge, push or refresh was touched, and no production action follows from this acceptance. No
controller or bridge file or setting was changed, no controller pause or stop was run, no other coordinator
process was started, no subagent was spawned and no external message was sent. The canonical checkout's
pre-existing modification to `tools/strategy-node/Strategy.code-workspace` and its five untracked
`backtester/` Gold session-policy files were left exactly as found. This cycle's own coordinator activity was
recorded with `monitor-state.js`. Left `pending_review` and outside this single-submission scope: the other
lane filings still in the queue.