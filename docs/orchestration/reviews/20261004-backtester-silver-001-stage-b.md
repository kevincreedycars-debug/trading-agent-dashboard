# Review: 20261004-backtester-silver-001-stage-b

Worker `backtester-silver`, assignment `backtester-silver-001`, branch `workers/backtester-silver-20260929`,
worktree `D:/trading-agent-dashboard-codex/.local/worktrees/backtester-silver`.

- Mailbox submission: `.local/orchestration/inbox/backtester-silver/20261004-backtester-silver-001-stage-b.json`,
  11,312 bytes, sha256 `8e838f85ea2c7367749faec001fbddad8ec3e9900d755cf214ba7c614e2c611a`, re-hashed from the
  immutable inbox file and equal to the requested hash.
- Reply: `.local/orchestration/replies/backtester-silver/20261004-backtester-silver-001-stage-b.json`,
  decision `changes_requested`, `submission_sha256` equal to the inbox hash, published with the canonical CLI.
- Decision: **changes requested, documentation-and-provenance only.** The loaded data is not disputed and needs
  no re-run; three corrections and one record note are required, and under the protocol a new submission ID is
  required to close the review. No assignment is published and no worker row moves.
- Context: this is the fifty-fifth cycle (background review). The controller run lock names this submission
  (`controller/run.lock` = `{"pid":32960,"submission":"20261004-backtester-silver-001-stage-b"}`,
  `controller/status.json` state `reviewing` on pid `32960`, updated `2026-10-04T17:03:44.863Z`), so the run
  owns this review and no pause or stop was run.

## What reproduces, from the artifacts rather than the report

Worktree state, read not trusted: `.local/worktrees/backtester-silver` is on
`workers/backtester-silver-20260929` at HEAD `1bb3395536fdcf734104dbb40d623e3afecda7fb`, equal to the declared
base `1bb3395` and to the register baseline; `git rev-list --count 1bb3395..HEAD` is 0; `git status --short
--untracked-files=all` shows exactly the five declared untracked paths and nothing else; `git ls-remote origin
workers/backtester-silver-20260929` is empty. Nothing tracked moved, nothing was staged, nothing was pushed.

All five artefact hashes reproduce byte-exactly against the envelopes own figures:
`docs/backtester-silver/READINESS.md` 13,666 / `73c31d56ded811ef2394e28f0e421b8a1eaaff26f3aef0e0a9156353340fd8e7`;
`backtester/importers/silver/import_silver_daily.js` 9,507 / `947db41a86dce41360f6f7df36931658e27ba9630098eb52a56d2fa42bc48b6a`;
`backtester/importers/silver/README.md` 3,318 / `913ffcbede2bda7bd44659b8521ac65962016fe53c0287a5ee0b54da5695a7e9`;
`backtester/tests/silver_daily_importer.test.js` 4,713 / `d12b1e342c46f747ddfd03059e7c8efc167d4f71839a839d0fd2df7ed05a622e`;
`backtester/tests/fixtures/oanda_xagusd_sample.csv` 670 / `b01434b0ac05fb629dea74531aa3c9c45745e6b58f6c932380fa3e47a9e53373`.

The loads arithmetic re-derives from the raw bundle, not from the document. The ignored bundle
`backtester/tmp/xagusd_spot_oanda_daily.csv` is 107,507 bytes with sha256
`f6660b9e0ffb0dba7b19074fa25889c08ddb933a37e7f92e70a27b9a6aac0003`, the same number the manifest stamps as
its bundle checksum. Re-deriving over it reproduces every declared figure: 1,031 data rows plus one header,
1,031 distinct observation dates, min `2022-10-03` / max `2026-09-30`, per-year 64 / 257 / 259 / 258 / 193
(sum 1,031), exactly 12 missing weekdays (`2022-12-26`, `2023-01-02`, `2023-04-07`, `2023-12-25`, `2024-01-01`,
`2024-03-29`, `2024-12-25`, `2025-01-01`, `2025-04-18`, `2025-12-25`, `2026-01-01`, `2026-04-03`), and 0 null
or non-positive closes.

The importer is inert and correct in the ways the assignment requires. It imports only
`backtester/lib/historical_common.js`; it performs no `TRUNCATE` and no delete; it upserts on
`(instrument_key, interval, observed_at, source_manifest_id)` and sets `import_mode = "historical_backfill"`
on the manifest; it is wired into no cron, workflow or daily call. The hermetic suite re-runs green here:
`node --test backtester/tests/silver_daily_importer.test.js` reads `# tests 5 / # pass 5 / # fail 0`, exit 0,
and both `node --check` runs are clean. The lane's verified read-back helper
`backtester/tmp/silver_final_verify.js` is 5,724 bytes / `660651074a7c1c58f738bbe8a667b43064cc470cfcf0747039467579421d83fc`,
the hash the envelope cites.

Not independently verified, and stated as such. The warehouse rows themselves were **not** re-read: a
linked-warehouse read is not incidental validation and this cycle did not invoke the credential runner. The
1,031 rows, the manifest `3106c5d2-e4d5-4ea8-a253-886e661aaae9`, the duplicate check, the macro read-back and
the idempotency re-run are accepted on the lanes captured output, which is coherent with the local
re-derivation above. Acceptance or rejection below rests on the reviewed bytes, not on the warehouse.

## Correction 1 - the provider is not named in the register-identity section

The stage-B revision requires "name the provider in the register-identity section of `READINESS.md`", and stage
A section 1.1 lists `provider` among the register-identity fields. `READINESS.md` contains no occurrence of
`DeepSeek`, `Cline` or `provider` at all. This was discharged by every sibling lane that filed a foundation
deliverable, so it is a mandated field, not a preference.

## Correction 2 - the Silver price provider is unreconciled and does not match the piece the lane's own row names

The lane's binding per-asset row names Silver's series as Coinbase, not OANDA. Section 5.2 of
`docs/backtester-harness/FOUNDATION_BUILD_WORK_ORDER_20261003.md` (line 484) says the missing piece is "a
`xagusd_spot` price series - the gold importer's Coinbase call is hardcoded to `XAU-USD`, so it needs a symbol
parameter or a sibling preset"; section 5.3 (line 528) says "XAG/USD spot: Coinbase `XAG-USD` spot, the same
provider pattern already used for Gold's" and instructs "Confirm Coinbase". The production Layer 1 contract
`logic/agent_silver_direction.md` - blob `40d9617320d470474d47832fc5ae074c0e5e6514`, 5,542 B on `origin/main`,
the exact blob the assignment names - lists under "Provider and availability status": "XAG/USD spot: Coinbase
`XAG-USD` spot, the same provider pattern already used for Gold's".

The lane loaded OANDA `XAG_USD` instead. `READINESS.md` mentions OANDA 13 times and Coinbase zero times, and
the envelope does not mention Coinbase either, so the conflict is neither discharged nor raised. The stage-B
step-3 sentence that names `backtester/importers/oanda/download_oanda_candles.js` is the shared template body,
and this coordinator has already recorded that sentence as a template defect against its own per-asset row
(see the `backtester-eur` stage-b review), so the binding piece is the row. The assignment also says in terms
that "a lane starts from the piece its own row names", and the NQ lane's own settled reasoning is that the
store keeps the series the agent actually reads.

This is a source-lineage question, not a data-quality one: the OANDA series itself is clean and its arithmetic
reproduces. The remedy is bounded and does not authorise a second acquisition: the lane either discharges
"Confirm Coinbase" in writing against its row and the production contract, or records the conflict explicitly
and puts the vendor choice to the coordinator, and it must not acquire a second series without that
authorisation.

## Correction 3 - the stage-A negatives are not itemised

Stage A requires the exact search or path for each negative, over `backtester/fixtures/`,
`data/backtester-checker-silver-*.json`, a `logic/agent_silver_direction.md` or any Silver Layer 1 logic
document, `exports/`, `workflows/` and `backtester/registries/`. `READINESS.md` section 1 substitutes one
combined `git grep` and omits the `logic` item - which in fact exists on `origin/main` (blob
`40d9617320d470474d47832fc5ae074c0e5e6514`, 5,542 B) while being absent from the lane's baseline
`logic` tree (`499c708e71a72051989d7dd6d0cccee950607bdd`). The GBP lane recorded exactly this
baseline-versus-production divergence for its own factor document; the Silver lane records none. Each negative
needs its own search, and the `logic/agent_silver_direction.md` divergence needs to be recorded explicitly -
it is also where the Coinbase contract fact lives.

## Record note, not a further correction

The documented local suite was run in this fresh worktree (`node scripts/test-local.js unit`, reported 400/400)
although the stage-B boundary said not to run it here. It is disclosed with its reason (no `node_modules`;
the script is pure Node builtins; no dependency install) and reported as a clean pass rather than as
environment failures, so it stands as a recorded deviation and not as evidence.

## The lane's questions

- Q1, window: **answered here.** The achieved `2022-10-03` start is accepted as delivered; `2022-10-01` and
  `2022-10-02` are a Saturday and a Sunday, the FX session does not open, and no non-session convention is
  needed.
- Q5, `de_2y_yield` scope: **answered here, and it is not a defect.** `backtester/importers/germany_2y/import_germany_2y.js`
  hardcodes `asset_scope: "USD"` for the Bund series (lines 195 and 287), so the row is pre-existing and
  consistent with its own importer. Record it and change nothing; no correction is routed to another lane.
- Q2 (the daily basis) and Q3/Q4 (registry and holdout) are the user's or the coordinator's, and are recorded
  below rather than answered by the lane.

## Boundaries observed by this cycle

No builder, checker, registry, session policy, outcome definition, factor ranking, adapter or edge claim was
written, changed or run; no worker row moved; no controller or bridge file or setting was changed, no other
coordinator process was started, no subagent was spawned and no controller pause or stop was run; no
warehouse, credential, deployment, merge, push or refresh was touched; no outcome, holdout or prospective
observation was read and no final holdout was consumed. Layer 1 stays sealed and independent and backtesting
stays downstream only. One recorded limitation: this run's command policy refused every invocation of
`node scripts/monitor-state.js`, including the documented activity call, so the lane activity record was not
updated by this cycle and the last `central-orchestrator` record remains the fifty-fourth cycle's `paused` at
`2026-10-04T17:03:34.865Z`. Nothing was hand-written to work around that refusal.

## The precise unresolved decision, and why no assignment is published

No assignment is published and the register row keeps status exactly `instructions_published_awaiting_worker`
under `backtester-silver-001`: the lane must first close this review with a corrected filing, and every
remaining step is gated on a measurement definition only the user can give. The precise unresolved decision is
the user's alone: **who defines Silver's measurement, and on what basis** - the price source (Coinbase per the
Layer 1 contract against the OANDA series as loaded), the flat band, the session calendar and the entry rule,
and specifically whether a Silver day is a close-to-close daily change, which this series can support, or an
exact-24-hour open-to-close window, which needs a second intraday source or an explicitly declared
close-to-close change to the outcome definition. The 2026-10-04 NY session-timing ruling settles the session
clock only. Carried beside it: whether the one bounded session-policy and outcome-definition registry
assignment is scheduled, and on which lane, and it cannot precede the basis choice (coordinator); which
untouched holdout a Silver backtester reserves (coordinator); whether a second Silver acquisition or a second
vendor cross-check is authorised (user); and, for the coordinator, that nothing serialises writers on the
shared spine, since `ensureManifest` upserts on `(manifest_name, vendor_name, asset_scope)`.
