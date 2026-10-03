# Review: 20261003-backtester-harness-nq-series-decision-r7

- Worker: `backtester-harness`, assignment `backtester-harness-001`. Lane authority unchanged: design documents
  inside `docs/backtester-harness/` plus ignored `tmp/`; Stage B stays closed and the seven asset lanes stay
  readiness lanes that build nothing.
- Mailbox submission: `.local/orchestration/inbox/backtester-harness/20261003-backtester-harness-nq-series-decision-r7.json`,
  13,470 bytes, sha256 `20142d878e57e786780aa1f036a54659a1e539d3489b88e6be7bdd69770ecaaa` - reproduced from the
  immutable inbox file rather than taken from the envelope, and equal to the requested hash.
- Reply: `.local/orchestration/replies/backtester-harness/20261003-backtester-harness-nq-series-decision-r7.json`,
  8,401 bytes, sha256 `fa3c55fd8f743af7d07dba590a3939e47b3f21e1bf3162b6df894c214585e54c`, decision `accepted`,
  published with `node scripts/coordination.js reply`; `check --worker backtester-harness` then reports
  `errors: []` and this submission `accepted`.
- Decision: **accepted**, on the reviewed bytes only. No Stage B, build, acquisition, import, warehouse, n8n
  change, credential action, dashboard edit, integration, publication or deployment follows from this review,
  and no assignment is published.
- Reviewed by the background coordinator run that owns the controller lock on 2026-10-03 (controller state
  `reviewing 20261003-backtester-harness-nq-series-decision-r7`, pid `8184`, updated_at 17:18:41.105Z; run lock
  and receipt `20142d87...` present, receipt state `attempting`, started_at 17:18:41.103Z). No subagent, no
  controller or bridge change, no controller pause or stop, no other coordinator process, no production action,
  no warehouse mutation, no holdout or prospective observation read.

## What the filing is

This is a docs-only `status_report`, not new work. It records two user decisions and one correction of its own
earlier wording. (1) The user confirmed the staged document edits stay uncommitted while this coordinator's r2
hold is adjudicated. (2) The NQ `/USD` series is settled as the QQQ proxy, the user having delegated the choice.
(3) The r6 recommendation for uppercase spine keys is withdrawn: the price-row layer and the evaluation layer
use different strings. It also puts two numbered questions to the coordinator. Nothing was committed, pushed or
run by the lane this cycle.

## Independent checks that reproduce

- HEAD is still `a351f0c521f580f14324c962a18f6cae880fa6ff`, on `workers/backtester-harness-20260930` in
  `.local/worktrees/backtester-harness`. `git status --porcelain --untracked-files=all` prints nothing and
  `git rev-parse --abbrev-ref "@{upstream}"` fails with no upstream configured, so no commit and no push were
  made this cycle, exactly as the envelope declares.
- The staged patch file reproduces byte-exactly: `tmp/pending-doc-updates-20261003-r6.md` is 17,124 bytes at
  sha256 `b2ff7ae279472b3f68d24458bfa2173477993d42bb3dbdb61e006541d0fe11e9`, and it is what supersedes the
  11,828-byte `3c0fc8bc...` version r6 disclosed. It is gitignored (`.gitignore:32` `/tmp/`), so it is scratch,
  not a tracked write.
- The NQ probe reproduces at its declared digest, `tmp/nq-price-source-probe.js`
  `fb565ea4db63bf4cd292c5a897699339c76066b8969d7dff8fe0904d85014714`, and it is what it claims: a read-only
  walk over `origin/main:exports/nq_collector.json` that writes no repository file.
- Every leg of the NQ series decision was re-measured by the coordinator from `origin/main` at
  `f8bc80fe1d44a050ebfc247b24ae21cfe2bbbf852` (the same ref the r3 and r5 reviews recorded), not read from the
  envelope: `exports/nq_collector.json` carries the Alpha Vantage node whose URL is
  `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=QQQ`, and its `Normalise Market Snapshot` code
  sets `nq_price: nq.price`; `origin/main:script.js` sets
  `NQ: "./data/backtester-checker-nq-24h-2024-2026.json?v=20260702-nq-qqq-proxy-dashboard"` and that artifact
  exists at `origin/main:data/backtester-checker-nq-24h-2024-2026.json`;
  `backtester/scripts/build_backtester_checker_data_nq.js` filters `evaluated_market=eq.QQQ_NQ_PROXY` with
  `NQ_BENCHMARK_KEY = "qqq_nq_proxy"`; and `backtester/importers/qqq/import_qqq_daily.js` writes
  `instrument_key: "qqq_nq_proxy"` and `instrument_family: "equity_proxy"`, its README stating it does not claim
  true NQ futures history.
- The naming correction reproduces and is material. Lowercase keys are the price rows: `eurusd`
  (`build_eur_historical_snapshots.js`), `xauusd_spot` (gold importer and README), `qqq_nq_proxy` (qqq importer
  and the btc and eur builders), `btc_usd_spot` (`build_btc_historical_snapshots.js`) and legacy `gold_spot_usd`.
  Uppercase `XAUUSD`, `BTCUSD` and `QQQ_NQ_PROXY` appear only as evaluation labels in `backtester/lib/`
  (`outcome_direction.js`, `confidence_calibration.js`, `factor_edge_lab.js`, `outcome_evaluation.js`) and in the
  checker builders. The two keys the correction says are missing, `gbpusd` and `xagusd_spot`, appear nowhere as
  `historical_price_series` keys; `gbpusd` exists only as a dashboard and Layer 1 field, and the silver logic
  document names `xagusd` as the instrument. The schema's natural key is
  `unique (instrument_key, interval, observed_at, source_manifest_id)` in `003_generic_historical_warehouse.sql`.
- The two dependency notes reproduce. The FRED importer writes `historical_macro_series` by `series_key` and not
  `historical_price_series`, so WTI's FRED series land in the shared macro block. The gold importer hardcodes
  `COINBASE_XAUUSD_SPOT_URL = "https://api.coinbase.com/v2/prices/XAU-USD/spot"` (line 23), so the same-script
  per-lane pull has a real gap for Silver. `git ls-tree` on `origin/main` `exports/` lists seven collector
  bundles - btc, eco_events, eur, gold, nq, silver, usd - and no `gbp_collector.json` and no
  `wti_collector.json`.

## What was adopted

- **The NQ series decision.** The NQ `/USD` foundation reuses the existing QQQ path. A futures feed would measure
  a market the live agent does not read and would add a vendor, a key and a second provenance story for a pair
  the dashboard already labels NQ/USD. The proxy limitation travels with the data: an NQ result built on this
  foundation is QQQ-proxy evidence and is never presented as NQ futures history or as accuracy qualification.
  This keeps exploratory and proxy material distinct from accuracy qualification, as the standing direction
  requires.
- **The naming correction.** r6's uppercase-at-price-row proposal is withdrawn, and the still-open store-shape
  decision must be made on the lowercase price-row convention. The upper/lower distinction is not cosmetic: a
  second convention at the price-row layer would re-key rows the gold, btc and nq builders already read.
- **Question 1 (spine key convention), answered.** Keep production's existing lowercase
  `historical_price_series.instrument_key` convention, add only the missing siblings the seven `/USD` targets
  need (working spellings `gbpusd` and `xagusd_spot`, no production price row existing for either yet), keep the
  uppercase strings where production already uses them as evaluation labels, and do not introduce a second key
  convention.
- **Question 2 (pull split), answered in principle.** The shared USD macro block and the FRED pull have one owner
  and are pulled once, not seven times; the concrete assignment shape follows the store-shape decision, which
  stays open.

## Corrections of record

- The r3 cycle's records state the r3 reply at `6,101 bytes`. Measured in the canonical mailbox,
  `replies/backtester-harness/20261003-backtester-harness-foundation-build-work-order-r3.json` is **6,033 bytes**
  at sha256 `d588f7e42cb966c3f7b425c3405a77e0bcf268c36d80dd2988b1817a643c8d32`. The digest matches exactly, so only
  the recorded size is wrong, and it is non-load-bearing. The r2 reply (`6,053` / `3de35a0c...`) and the r5 reply
  (`8,363` / `dd255447...`) reproduce as recorded.

## No assignment published, and why

No assignment is published and the register keeps `backtester-harness` at `design_records_accepted_awaiting_decisions`;
no worker status is changed by this review, so no `instructions_published_awaiting_worker` state is set or
disturbed. This filing carries no research ask - its two questions are coordinator decisions and both are answered
above. The only residual research item it names, the per-pair source-and-store inventory that would confirm a
same-script run, is already largely inside this filing and is a build-side inventory gated on the store shape. The
seven `backtester-<asset>` lanes are readiness lanes that build nothing and already hold their own published
revisions, and the seven-lane foundation revision the work order asks for is a build and acquisition assignment
that would mutate the warehouse, which this background run has no authority to authorise.

## The precise unresolved decisions

Unchanged in the work order's own order, and narrowed by the two answers above: (a) publish the left-rail accordion
from `RAIL_ACCORDION_SPEC_20261003.md`, user-authorised but a production dashboard change this background run has no
authority to make, and any rail edit must start from `git show origin/main:index.html` or it silently reverts the
published Silver, WTI and GBP tabs; (b) choose the store shape, the shared `historical_price_series` and
`historical_macro_series` spine with the eleven deferred non-`/USD` crosses appendable, or seven Gold-shaped
per-asset tables - now on the lowercase price-row convention, not r6's withdrawn uppercase one; (c) adopt the window
reading on `r4`'s bytes, which carry the user's own words and remain `pending_review`; and (d) decide the DeepSeek
scope, new backtester-side flows only or also the production Layer 1 model-node swap, which needs the user's n8n
credential action and a strict-JSON validation pass first.

## Hold unchanged, and pending filings left untouched

The r2 hold continues: start nothing, keep the worktree at `a351f0c`, commit and push nothing until the hold is
lifted or adjudicated, and the lane's next revision declares `a351f0c` as its head.
`20261003-backtester-harness-user-decisions-r4` (11,326 bytes) and
`20261003-backtester-harness-user-scope-and-n8n-ownership-r6` (12,229 bytes) remain `pending_review` and are not
adjudicated here.

## Integration and deployment status

Nothing is integrated, merged, published or deployed by this review. The lane keeps design-only authority inside
`docs/backtester-harness/` plus ignored `tmp/`, Stage B stays closed, Layer 1 stays independent and backtesting
stays downstream only, and no outcome, holdout or prospective observation was read.