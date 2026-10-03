# Review: 20261003-backtester-harness-user-scope-and-n8n-ownership-r6

- Worker: `backtester-harness`, assignment `backtester-harness-001`. Lane authority unchanged: design documents
  inside `docs/backtester-harness/` plus ignored `tmp/`; Stage B stays closed and the seven asset lanes stay
  readiness lanes that build nothing.
- Mailbox submission: `.local/orchestration/inbox/backtester-harness/20261003-backtester-harness-user-scope-and-n8n-ownership-r6.json`,
  12,229 bytes, sha256 `fd6b9f68cb936ffa7863e721ca8818a422b5d3175fff15d3e89394d866d8eada` - reproduced from the
  immutable inbox file rather than taken from the envelope, and equal to the requested hash.
- Reply: `.local/orchestration/replies/backtester-harness/20261003-backtester-harness-user-scope-and-n8n-ownership-r6.json`,
  10,170 bytes, sha256 `06f2fc730c1f43cee0f07179e4f8207ccd6161a1e0f2c9b1bdf8cb0431954a31`, decision `accepted`,
  published with `node scripts/coordination.js reply`; `check --worker backtester-harness` then reports
  `pending: 0`, `errors: []` and this submission `accepted`.
- Decision: **accepted**, on the reviewed bytes only. No Stage B, build, acquisition, import, warehouse, n8n
  change, credential action, dashboard edit, integration, publication or deployment follows from this review,
  and no assignment is published.
- Reviewed by the background coordinator run that owns the controller lock on 2026-10-03 (controller state
  `reviewing 20261003-backtester-harness-user-scope-and-n8n-ownership-r6`, pid `8184`, `status.json` updated_at
  `2026-10-03T17:29:57.990Z`, `run.lock` and receipt `fd6b9f68...` present; `coordinator-dispatch.js status`
  shows `enabled` with `activeRun true`). No subagent, no controller or bridge change, no controller pause or
  stop, no other coordinator process, no production action, no warehouse mutation, no holdout or prospective
  observation read.

## What the filing is

This is a docs-only `status_report`, not new work. It records the user's fourth message of 2026-10-03 as three
items - (1) questions to the user are numbered, (2) the backtesting scope is the dashboard's own pairs and the
`/USD` pairs first, (3) all n8n work is agent-owned without user oversight - and it stages the document edits
that carry them instead of committing them, because the coordinator's r2 hold is still in force. It puts three
numbered questions to the coordinator. Nothing was committed, pushed or run by the lane this cycle.

## Independent checks that reproduce

- HEAD is still `a351f0c521f580f14324c962a18f6cae880fa6ff`, on `workers/backtester-harness-20260930` in
  `.local/worktrees/backtester-harness`. `git status --short --untracked-files=all` prints nothing and
  `git rev-parse --abbrev-ref "@{upstream}"` fails with no upstream configured, so no commit and no push were
  made this cycle, exactly as the envelope declares.
- Two of the three declared artifacts reproduce byte-exactly: `tmp/dashboard-pair-map-20261003-r6.json` is
  3,859 bytes at sha256 `f87c71392c75b3d8fc541301ddd66db5fccdbe439cc4a654d4bd5dfdd3f763f9`, and
  `tmp/pair-map-probe.js` is 2,155 bytes at sha256
  `aa70258037a1abca5d6cc66f7984f6a64df1bb7c9087c9c69206bc4bfbe7ef8c`.
- Every substantive measurement was re-measured by the coordinator from `origin/main` at
  `f8bc80fe1d44a050ebfc247b24ae21cfe2bbbf852` (the same ref the r3, r5 and r7 reviews recorded), not read from
  the envelope. `origin/main:script.js` holds 18 `pairTradeResearchConfigs` over seven assets (EUR, GBP, GOLD,
  SILVER, WTI, NQ, BTC), exactly seven of them `/USD` - `EUR_USD`, `GBP_USD`, `XAU_USD`, `XAG_USD`, `WTI_USD`,
  `NQ_USD`, `BTC_USD` - eleven non-`/USD`, and no `USD_*` config at all. The quote-key asymmetry reproduces
  exactly: the file carries 17 `quoteAssetCode` keys for the 18 configs, so `XAG_USD` is the only one with none.
- The two factor documents say what the filing says they say. `origin/main:logic/agent_wti_direction.md` names
  the price as the FRED `DCOILWTICO` daily Cushing spot series in USD per barrel with context `DTWEXBGS`,
  `VIXCLS`, `SP500` and `DGS2`, and states the agent must not produce WTI/USD pair calls.
  `origin/main:logic/agent_silver_direction.md` states the agent analyses SILVER as the XAG/USD instrument only,
  with XAG/USD spot from Coinbase `XAG-USD`, the same provider pattern already used for Gold.
- The staged text's own side facts reproduce too: `backtester/importers/eurusd` (Alpha Vantage daily OHLC) and
  `backtester/importers/germany_2y` exist on production; the Silver factor document is 5,542 bytes with blob
  `40d96173`; the GBP factor document is 12,251 bytes; the anchor line the patch quotes, "pauses only if an
  instrument cannot be confirmed on the account.", is line 274 of the 528-line committed work order; and
  `CONVERSATION_NOTES.md` is 319 lines, matching the r4 review.

## The staged patch, which is the one declared digest that does not reproduce in place

`tmp/pending-doc-updates-20261003-r6.md` is now 17,124 bytes at sha256
`b2ff7ae279472b3f68d24458bfa2173477993d42bb3dbdb61e006541d0fe11e9`, not the 11,828-byte
`3c0fc8bc1619ecbaa33522fbe78fb6db87df5e6616b24420752eed398abe3c51` this envelope declares. The reason is
benign and already of record: the lane rewrote the patch in its own next cycle to fold in the NQ decision and the
corrected lowercase key convention, and disclosed that supersession in r7, which the twenty-fifth cycle measured
and recorded. This is therefore a moved measurement of the same class as the earlier cycles already logged, not a
misdeclaration - the file was accurate when filed and was revised afterwards by the lane itself. It is scratch
under gitignored `tmp/` (`.gitignore:32` `/tmp/`), so nothing tracked changed.

## What was adopted

- **The numbered-question working rule.** Every question this lane puts to the user, in a reply and in an
  envelope, is numbered from now on, and this coordinator applies the same rule to its own questions to the
  user. Envelope and reply both comply.
- **The pair scope, on measured evidence rather than interpretation.** The immediate backtesting scope is one
  dashboard-named `/USD` pair per non-Gold lane - `EUR_USD`, `GBP_USD`, `XAG_USD`, `WTI_USD`, `NQ_USD`,
  `BTC_USD` - with Gold's `XAU_USD` already built. The eleven non-`/USD` pairs the dashboard also carries are
  deferred rather than refused, so the store shape must leave them appendable, which is a hard constraint on the
  open store-shape decision. The USD lane has no pair series at all, because USD is the quote side of all seven
  configs and no `USD_*` config exists, so its part of the pass is the shared FRED and USD macro block.
- **The two vendor-guess withdrawals.** WTI needs no OANDA call because the production factor contract already
  names FRED `DCOILWTICO`, and Silver is XAG/USD spot from Coinbase. Both are the factor contract's own words,
  so they are facts already on production rather than new vendor choices, and the lane's earlier guesses are
  withdrawn. Carry the asymmetry with them: `XAG_USD` is the only one of the eighteen dashboard configs with no
  explicit `quoteAssetCode` key, so a store keyed on it must not assume the field.
- **The FRED-importer evidence note**, recorded for the later store work rather than acted on here:
  `backtester/importers` writes FRED series to `historical_macro_series` by `series_key`, not to
  `historical_price_series`, so `DCOILWTICO` lands in the shared macro block unless a WTI price importer is
  written.

## Corrections of record, neither load-bearing to the decision

- As above, the staged-patch digest in this envelope is superseded in place by the lane's own later revision, and
  the current bytes are `b2ff7ae2` at 17,124 bytes.
- The r4 review listed the DeepSeek scope as a **user action**. That wording is overtaken by the user's own words
  in this filing: the n8n oversight gate is lifted, so creating the n8n DeepSeek credential from the local
  CLIXML `DEEPSEEK_API_KEY` is an **executor** action rather than a user action, and the strict-JSON validation
  pass stays a technical precondition of the model swap rather than an approval step. This changes ownership and
  scheduling only and authorises nothing here: a credential action and a workflow change stay outside a
  background run's authority, and no executor is named by this reply.

## Question 1 (release or freeze), answered: release, and not as a revert

The r2 hold was imposed to freeze this branch while the coordinator adjudicated r3, r4 and r5, and r6 and r7
have since joined that queue. Every one of those filings is now adjudicated and accepted; the staged text
reproduces and is consistent with every adopted decision, including the r7 lowercase convention and the NQ proxy
decision; and `a351f0c` already carries content the r4 and r5 reviews adopted, so there is nothing to revert.
The hold is therefore discharged on these terms and no wider: land the staged text in **exactly one docs-only
commit** on top of `a351f0c`, touching only `docs/backtester-harness/`, and fix three now-stale sentences first,
because the patch was written to stay staged and would otherwise commit a false statement - the header paragraph
that says it applies only when the hold is lifted or adjudicated, the session 7 sentence that says the head stays
at `a351f0c`, and the session 7 addendum sentence that says the edits stay in ignored `tmp/`. Commit nothing
else, push nothing, and declare the new head as the head of the next revision. If an anchor does not match the
committed bytes, the lane stops and reports it rather than guessing.

## Question 2 (store shape) and question 3 (executors)

- Question 2 stays the coordinator's decision and is now correctly framed: the shared `historical_price_series`
  spine with the eleven deferred non-`/USD` crosses appendable and the append-not-rebuild rule, or seven
  Gold-shaped `0NN_<asset>_historical_market_snapshots.sql` tables, to be chosen on the lowercase price-row
  convention r7 settled rather than on this filing's withdrawn uppercase recommendation.
- Question 3 is not a decision a background run may make. Naming the executor for the n8n credential plus the
  strict-JSON validation pass, and the executor for the rail-accordion publish, is a scheduling choice for an
  authorised assignment. The rail edit is a production dashboard change this run may not make, and any rail edit
  must start from `git show origin/main:index.html` or it silently reverts the published Silver, WTI and GBP
  tabs.

## No assignment published, and why

No assignment is published and the register keeps `backtester-harness` at
`design_records_accepted_awaiting_decisions`; no worker status is changed by this review, so no
`instructions_published_awaiting_worker` state is set or disturbed. This filing carries no research ask - its
residual items are coordinator decisions and one executor-naming choice. The read-only per-pair source-and-store
inventory that would otherwise be the candidate was already declined on r7's bytes as substantially inside the
filing and build-side. The seven `backtester-<asset>` lanes are readiness lanes that already hold their own
published revisions, and the seven-lane foundation revision is a build and acquisition assignment that would
mutate the warehouse, which this background run has no authority to authorise.

## The precise unresolved decisions

In the work order's own order: (a) publish the left-rail accordion from `RAIL_ACCORDION_SPEC_20261003.md`,
user-authorised and executor-ready but a production dashboard change, starting from
`git show origin/main:index.html`; (b) choose the store shape on the lowercase price-row convention as framed
above; (c) decide one bounded acquisition assignment versus seven per-asset revisions, and name the single owner
of the shared USD macro block and the FRED pull, whose split r7 answered in principle as one owner pulled once;
and (d) name the executor and settle the scope of the n8n work - new backtester-side flows only, or also the
production Layer 1 model-node swap - which now needs no user gate but still needs the credential and the
strict-JSON validation pass.

## Integration and deployment status

Nothing is integrated, merged, published, deployed or refreshed by this review. No production action, warehouse
mutation, credential action, n8n change, dashboard edit, scheduler or publication was taken or authorised, and no
outcome, holdout or prospective observation was read and the sealed qualification window manifest was not opened.
Layer 1 stays independent and backtesting stays downstream-only, this acceptance is not evidence of edge, accuracy
or live deployment, and the bounded hold release authorises one docs-only commit inside the lane's own folder and
nothing else.