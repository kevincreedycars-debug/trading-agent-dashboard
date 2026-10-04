# Review: 20261004-backtester-wti-foundation-001

Worker `backtester-wti`, assignment `backtester-wti-001`, branch `workers/backtester-wti-20260929`,
worktree `D:/trading-agent-dashboard-codex/.local/worktrees/backtester-wti`.

- Mailbox submission: `.local/orchestration/inbox/backtester-wti/20261004-backtester-wti-foundation-001.json`,
  8,926 bytes, sha256 `61ea589166ad54c3812a65ef50d88c154cbd91daf25c609fac68e8603fd8cff4`, re-hashed from the
  immutable inbox file and equal to the requested hash; the lane's own ignored copy at
  `tmp/wti/submission_backtester-wti_20261004-foundation-001.json` is byte-identical (8,926 bytes, same sha256).
- Reply: `.local/orchestration/replies/backtester-wti/20261004-backtester-wti-foundation-001.json`, 10,481 bytes at
  sha256 `8dce55e0cddaf52762979090e7bf86efabac61a733af3b697e3ca11dd982cbb5`, decision `accepted`,
  `submission_sha256` equal to the inbox hash, published with the canonical mailbox CLI
  (`node scripts/coordination.js reply --file tmp/reply-backtester-wti-20261004-foundation-001.json`). After
  publication `node scripts/coordination.js check --worker backtester-wti` reads `pending 0`, `errors []` and this
  filing `accepted`.
- Decision: **accepted, on the reviewed bytes only** - the Stage A WTI readiness record plus the Stage B WTI
  foundation-data load filed in `docs/backtester-wti/READINESS.md`. Not integration, merge, deployment, production,
  or an edge, accuracy, ranking or readiness claim.
- Context: this is the fifty-eighth cycle (background review). The controller run lock names this submission
  (`controller/run.lock` = `{"pid":32960,"submission":"20261004-backtester-wti-foundation-001"}`, `status.json`
  state `reviewing` on pid 32960, updated `2026-10-04T17:23:19.301Z`), so the run owns this review and no pause or
  stop was run.
- Assignment published by this review: **none**. The register row for `backtester-wti` keeps status exactly
  `instructions_published_awaiting_worker` under `backtester-wti-001`; no assignment file was written or
  superseded, so no new content hash exists and no wake is claimed for this lane.

## What reproduces, from the artifacts rather than the report

Worktree state, read not trusted: `.local/worktrees/backtester-wti` is on `workers/backtester-wti-20260929` at
HEAD `4f70c3db14572549e256ff4bf5c5fa5ac92793a4`, whose sole parent is the declared base
`1bb3395536fdcf734104dbb40d623e3afecda7fb`; `git rev-list --count 1bb3395..HEAD` is 1; `git diff --stat
1bb3395..HEAD` names exactly the two declared new files - `backtester/importers/wti/import_wti_daily.js` (319
insertions) and `docs/backtester-wti/READINESS.md` (326 insertions), 645 insertions and 0 deletions; `git status
--short --untracked-files=all` prints nothing; `git ls-remote origin workers/backtester-wti-20260929` prints
nothing, so nothing was pushed. The lane's worktree carries no `.local/orchestration` directory at all
(`Test-Path` false), so no worktree copy of the mailbox exists.

Both deliverables reproduce byte-exactly, including the CRLF/LF split the envelope declares:

| Artifact | Disk bytes / sha256 (CRLF) | git blob | Repo bytes | Content sha256 (LF) | CRLF |
| --- | --- | --- | --- | --- | --- |
| `backtester/importers/wti/import_wti_daily.js` | 11,244 / `4e966feb467d0fb38b3e819bef7e83c3e8a3bea7dd1fbd69efb8f6b6389a0009` | `b34dbe3b` | 10,925 | `20b9debfbb82dd8cf3a7d9b931c6ed4e4422cae266f37d0670ebf2ac2864d18c` | 319 |
| `docs/backtester-wti/READINESS.md` | 28,831 / `5b9d4ee909a2235e6c30b7fb053a3619c91b795508e7c926ac2f03c6f3fba600` | `94cbac8b` | 28,505 | `da93fdf092f7f16ecc08b53a8aaeb6d7ce1800f1b956159d19064eceb2a626fa` | 326 |

The row-set digest was re-derived here from the raw source payload alone, independently of the lane's log and
without touching the warehouse. `tmp/wti/fred_dcoilwtico_2022-10-01_2026-09-30.json` re-hashes to 100,056 bytes /
`3305ddd8070dc311c77ddc95fc728d327930feae478bc6e883416a9eb53f0bcc`; parsing it gives 1,042 observations, 995
in-window kept rows, first `2022-10-03`, last `2026-09-29`, 995 distinct dates, per-year 63 / 248 / 250 / 248 / 186
(sum 995), and the ascending `date|close` sha256
`deb19d9c35a608fdc5a634aa51a408f98437bb5549fe1aee5b58b7f109d4d61b` - identical to the manifest checksum the lane
recorded. The gap split holds: 1,043 weekdays in window = 995 loaded + 48, and all 48 are absent from the payload
too (46 US market-holiday closures, `2025-01-09` national day of mourning, `2026-09-30` unpublished at the
`2026-10-04T16:06Z` pull), so no gap is a load defect and nothing was interpolated, back-filled or carried forward.

Every byte-provenance figure in section 6.6 re-derives exactly, including against `origin/main`:

| File | `origin/main` bytes / content sha256 | Worktree raw bytes | CRLF delta | Verdict |
| --- | --- | --- | --- | --- |
| `backtester/lib/historical_common.js` | 8,163 / `11b870f9437943713ea76e6bb4cceeca7f375151cdedfeecafa0e6380611af8b` | 8,482 | 319 | LF-identical |
| `backtester/sql/003_generic_historical_warehouse.sql` | 9,403 / `7a80b08df18f0379f9259e6259256654f8cd631c4a6953a3e9e429bf6a35ee81` | 9,630 | 227 | LF-identical |
| `backtester/importers/gold/import_gold_daily.js` | 10,520 / `1b0c75c3916ef977be9390d47347863589ea25635da055e764556766ef94eaa4` | 10,863 | 343 | LF-identical |
| `backtester/importers/fred/import_fred_macro.js` | 10,538 / `8b15d4ff9dbd3a94e3b83b4c51f30774d993ff6272db9e3d55d0a12aa552dcbe` | 10,886 | 348 | LF-identical |
| `backtester/importers/oanda/download_oanda_candles.js` | 6,396 / `92e2931af24a9c6ca9359791cb4dc73ddac251e8d61fab351f4808e60f7bd2c4` | 6,604 | 208 | LF-identical |
| `logic/agent_wti_direction.md` (origin/main only) | 6,596 / `841ab7d22568465bb470f837ff9203292500e65336f1351b91d849993e17115e` | absent | - | reference copy only |

The importer's dependencies are therefore real and unchanged: every helper it imports
(`assertDateRange`, `ensureManifest`, `fetchAllRows`, `fetchText`, `maxDate`, `minDate`, `parseArgs`,
`parseDelimited`, `readOptionalEnv`, `readTextInput`, `requireEnv`, `toNullableNumber`, `upsertRows`) is exported by
`backtester/lib/historical_common.js`, the upsert conflict target
(`instrument_key, interval, observed_at, source_manifest_id`) matches the unique constraint at
`backtester/sql/003_generic_historical_warehouse.sql` line 144-145, and `historical_price_series` already existed, so
no schema migration was needed and none was made. `asset_scope = 'WTI'` is admissible (the manifests column has no
closed value list, only a default and a comment). The lane's ignored scratch re-checks too: manifest read-back
1,643 bytes / `41d8db258338c8cc3b8352e49a6be5d59eaa3c3e8a50fccb1e0b43c1673fd0c8`, verify logs 6,708 / 3,356 /
3,632 bytes (all three ending in the same recomputed checksum), `byte_check.log` 6,378 bytes.

## Not independently verified, and stated as such

The warehouse rows were **not** re-read: a read-only coordination review does not open the `market-importers`
credential scope. The 995 rows, manifest `df52343b-0484-45ca-8dbb-cd555af9f9b2`, the append counts
(`appended=995`, `already_present=0`, `skipped_missing=0`), the duplicate check and the three warehouse re-reads are
therefore accepted on the lane's captured evidence, which is coherent with the independent payload re-derivation
above and with the byte-provenance of the plumbing it runs on. Two further points are accepted as correct rather
than counted as defects: the deliberate deviation from the shared template's OANDA downloader to the FRED
observations endpoint with a sibling importer, because `DCOILWTICO` is the series the factor contract names, OANDA
carries no WTI symbol, no new vendor was introduced, and `SERIES_CONFIG` was correctly left untouched because that
list feeds `historical_macro_series`; and the decision to hold the series as a price in the shared spine rather than
as a macro row, which is the store shape revision 2 published.

## Two corrections of record, not defects requiring a re-file

1. Section 3 cites the SQL ceiling as `010_btc_spot.sql`. No such file exists: the file is
   `backtester/sql/010_btc_historical_market_snapshots.sql`. The substance - `backtester/sql/` stops at 010, there is
   no WTI script, the shared spine is `003_generic_historical_warehouse.sql` at 9,630 B here - is correct; the path
   is not.
2. Section 3 lists `backtester/importers/` as `gold/`, `eurusd/`, `qqq/`, `btc/`, `fred/`, `oanda/`. At this baseline
   the tree also carries `binance/`, `crypto_fear_greed/`, `germany_2y/` and `usd_events/`. The load-relevant claim
   - there was no `wti/` directory before this stage - is correct and verified (the canonical importers tree has no
   `wti/`, and the worktree's `wti/` contains only the lane's new file).

Both are to be refreshed in the lane's next filing; no byte needs to change for them.

## The digest that moved, and why it is not the lane's fault

The canonical assignment digest the lane cites (`17,985` bytes /
`cc56c8f970ac0252a26abad2b95aba422b6a470b5422ec08f6b087ec258002e1`) was accurate when measured: it is the CRLF
materialisation of the da9c2c3 blob (`17761` LF bytes, content sha256 `18248b89...`), reproduced here by
LF-normalising and re-materialising that blob. Two coordinator commits landed after the lane's filing
(`1fed2ec` and `740a3c5`, both `2026-10-04T17:47-17:48+01:00`) carrying the user's New York session-timing ruling
into the seven asset-lane assignment files, so the file has moved: it is now 19,207 disk bytes / 18,968 LF bytes /
blob `5f0afd2f` / raw sha256 `9bb345570d31372c4c40671d5a6e9b3c9ab5898f8ca09ac133b8814fa9b7ea60`. That ruling settles
the session clock only; it changes no part of this lane's mandate, adds no authorisation, and does not settle the
daily-series basis. The lane must refresh its register-identity line in its next filing - the same note the NQ
review carried.

## Coordinator-owned follow-up recorded, not a defect of this load

`ensureManifest()` in `backtester/lib/historical_common.js` selects a manifest by
`(manifest_name, vendor_name, asset_scope)` and PATCHes the row it finds. Any later WTI incremental run that keeps
the default manifest name would therefore overwrite this accepted manifest's `coverage_start`, `coverage_end`,
`row_count` and `checksum` while all 995 loaded rows still link to it, so the provenance record would describe only
the new slice. A future tail append must use a distinct manifest name, or the importer must be extended to key a
manifest by its window. Until that exists, a bare tail-only run is not safe. This is the WTI counterpart of the NQ
lane's importer provenance-flag item, and it is recorded here as the coordinator's, not the lane's, to fix.

## Answers to the lane's four questions

- **Q1, store shape: confirmed as recorded.** `DCOILWTICO` is held as a price series in `historical_price_series`
  under `instrument_key = dcoilwtico` with `interval = daily`, written by the sibling importer, with `SERIES_CONFIG`
  untouched. Do not mirror it into `historical_macro_series`: the factor contract names it as the price, and the
  macro table carries macro semantics with no price-shaped provenance. A macro-shaped copy, if ever wanted, is a
  separate second manifest the coordinator will authorise explicitly.
- **Q2, shared USD macro block: not this lane's to run, and the lane was right not to run it.** The standing
  coordinator decision recorded in `docs/orchestration/DECISIONS.md` on 2026-10-04 assigns the single shared USD
  macro pull once to `backtester-usd`; a second lane running it would duplicate the one pull seven times. The lane's
  measured note is recorded as an open item for that owner and for the coordinator: the shared importer's five
  series (`us_2y_yield`, `us_10y_yield`, `us_10y_real_yield`, `vix_level`, `dxy_level`) do not cover the factor
  contract's `SP500` context, and adding a series outside `SERIES_CONFIG` is a scope change to a shared importer.
- **Q3, tail and freshness: the user's, on the same footing as the USD and EUR lanes** - whether `2026-09-30` is the
  frozen analysis window or a later incremental refresh picks it up. Until that answer, and until the manifest-keying
  fix above exists, the frozen snapshot stands and nothing is appended.
- **Q4, next stage: not authorised, so nothing is published.** The inert builder and registry wiring, and a WTI
  evaluation rule (flat band, calendar), are build and outcome-definition work this lane is not authorised to do, and
  an outcome definition cannot precede the basis decision. `there is no WTI entry in historical_outcome_evaluation.md
  and no WTI flat band` is confirmed here rather than trusted: the canonical
  `backtester/docs/historical_outcome_evaluation.md` Phase-1 market list is USD, EUR, Gold, NQ and BTC only.

## The precise unresolved decisions, and why no assignment is published

No assignment is published because the evidence does not support one: this lane's Stage B mandate - its own
four-year daily price series in the shared spine, proved and filed - is complete for the window it can reach, and
every remaining item is a decision the lane cannot take.

- (a) **User.** How a WTI day is measured: a close-to-close change, which the single loaded daily close supports, or
  an exact-24-hour New York open-to-close window, which needs a second intraday source or an explicitly declared
  change to the outcome definition. The 2026-10-04 NY session-timing ruling settles the clock only.
- (b) **User.** Whether `2026-09-30` is the frozen window or a later incremental refresh picks up the tail.
- (c) **Coordinator/user.** When the one shared USD macro pull runs, who adds the missing `SP500` context, and
  whether a `SERIES_CONFIG` change is authorised.
- (d) **Coordinator/user.** Whether a WTI builder and registry are authorised at all, and when.
- (e) **Coordinator.** Which untouched holdout a WTI backtester reserves.

Carried beside them, coordinator-owned: the manifest-keying fix above, the one bounded session-policy and
outcome-definition registry assignment (no WTI registry exists and `backtester/registries/` is gold-only), and the
recorded-but-not-actioned CRLF versus `.gitattributes` convention question, with the hard constraint that nothing may
silently renormalise a bound digest.

## Boundaries observed by this cycle

No Layer 1, Layer 2, dashboard, workflow, export, scheduler, production, credential, warehouse-schema or order path
was touched; no builder, checker, registry, session policy, outcome definition, factor ranking, adapter or edge claim
was written, changed or run; no outcome, holdout or prospective observation was read and no final holdout was
consumed; nothing was merged, pushed, deployed, purchased, credential-changed or messaged externally; no controller
or bridge file or setting was changed, no controller pause or stop was run, no other coordinator process was started
and no subagent was spawned. Layer 1 stays sealed and independent and backtesting stays downstream only. The
canonical checkout's pre-existing modification to `tools/strategy-node/Strategy.code-workspace` and its five untracked
`backtester/` Gold session-policy files were left exactly as found. This cycle's own coordinator activity was
recorded with `monitor-state.js` (working, then paused). Left `pending_review` and outside this single-submission
scope: `backtester-nq` `20261004-backtester-nq-001-stage-b2`, `backtester-harness`
`20261004-backtester-harness-ny-session-timing-user-ruling-r15` and
`20261004-backtester-harness-ny-session-timing-carriage-r16`.
