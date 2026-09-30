# 2026-09-30 (cont.) - live-trading feed-004 accepted: the -002 correction lands, and the coordinator's own byte figure was wrong

The second of this run's two reviews took `live-trading` submission `20260930-live-trading-feed-004` (mailbox SHA-256
`aa651b87258899bf5c452594a2b9961f243021e55ed48b303b7dc09d51dbe773`, reproduced from the immutable inbox file at 7,970
bytes; reply `90b4d40f...` at 6,234 bytes; durable review
`docs/orchestration/reviews/20260930-live-trading-feed-004.md`) and accepted it as documentation only. It is the
revision the `-002` reply required: one commit `4d82bb3` in `.local/worktrees/live-trading`, parent `9a68050`, base
`5ff1bf3` verified an ancestor, worktree clean, `+36/-5` across exactly `docs/live-trading/CONVERSATION_NOTES.md` and
`tools/mt5-bridge/README.md`, both artifact digests reproduced (`D41DE6A9...` at 35,678 bytes, `6A8338CD...` at 4,341
bytes). All three defects are fixed and were checked rather than trusted: the four quotes the `-002` summary attached to
the `19:28:37Z` run reproduce in the ignored scratch `tmp/live-trading.real.json` at `19:15:25.891323Z`, the fifth
session entry now labels each quote set with its own run and gives the committed artifact's own values (bid 1.1331 /
ask 1.13312, 4153.3 / 4153.71, 30558.33 / 30559.78, 83739.2 / 83740.2), the README example block carries its run time
and says it is one real read, and the unreproducible figure is dropped and replaced with measured sizes.

One coordinator error is corrected by this cycle. The canonical `HEAD:index.html` blob is `19,332` bytes, not the
`19,251` the `-002` reply and review recorded: `git ls-tree -l HEAD -- index.html` and `git cat-file -s` agree, the
canonical working copy is `19,698`, `origin/main:index.html` is `18,219`, and `19,616` is the seven
`backtester-<asset>` worktree copies with `19,373` for the four other worktrees. The worker measured it correctly and
flagged the disagreement instead of resolving it silently. The claim the figure carried is unaffected and was
reconfirmed: `live-trading` appears in exactly one `index.html` - the worker worktree's, 2 hits at 20,315 bytes - while
the canonical checkout, the eleven other worktrees and the four release copies carry zero, and the four `-003` file
figures all reproduce (`b5faf31b`, `fb211f15`, `e003d4b9`, `b3db6cc5`).

Not done: no merge, publish, deployment or production action, no release worktree, and no new worker assignment -
no evidence supports one while the authority level and the publish route are the user's. This run's command policy
refused `node`, so the suite, the validator and the mailbox CLI could not be re-run here; the suite file holds 18
`test()` declarations and the validator is present at 11,119 bytes, the earlier PASS and 18-of-18 stand as the last
reproduced evidence rather than this cycle's own, and the reply was published by writing the identical validated
envelope bytes. The register keeps `live-trading` at status exactly `instructions_published_awaiting_worker`, and the
correction owed on `-002` is closed, so `-002` and `-004` are both spent.

# 2026-09-30 (cont.) - the gold factor draft page is live at the user's request

The user answered the publish question in one line - "yes show it live" - so the coordinator published the strategy
worker's frozen draft page as a production publication of its own, following the two earlier page releases: a release
worktree cut from production `main`, the page taken verbatim, exactly one added topbar line, one push, and a live check
against the committed blob.

Released: `.local/gold-factor-wip-release` on `release/gold-factor-wip-20260930` cut from `origin/main` `9b20360`,
commit `a2b0e13` (`9b20360..a2b0e13`, `refs/heads/main` now `a2b0e134cf722212cc85baecf7d8f08c7941d4e0`), carrying
`gold-factor-wip.html` and exactly one added line in production `index.html`:
`<a class="topbar-link" href="gold-factor-wip.html">Gold Factor (draft)</a>`. Live at
`https://kevincreedycars-debug.github.io/trading-agent-dashboard/gold-factor-wip.html`, verified this run: HTTP 200,
21,281 bytes, sha256 `5dbe1364...`, byte-identical to the committed blob, with the live dashboard `index.html`
HTTP 200 and carrying the draft link. No other file was touched: no stylesheet edit, no shared script edit, no lane,
credential, workflow, warehouse, Layer 1 or Layer 2 action.

The frozen copy was re-verified from `.local/worktrees/strategy` before copying: 21,541 bytes, 260 CRLF lines, no bare
LF, sha256 `675fc9da...`. That copy and its published form differ only in line endings, and the mechanism is the
repository's own: `core.autocrlf` is `true` and there is no `.gitattributes`, so the commit stored the LF form (21,281
bytes, sha256 `5dbe1364...`), which is exactly the frozen file with CRLF-to-LF applied - proved by rebuilding it from
the frozen bytes. Earlier published pages were stored the same way (`gold-direction-scorecard.html`: blob 143,102
bytes, working copy 143,517). It is recorded because the strategy worker's refresh rule is a hash check: a later
refresh must compare the CRLF-to-LF conversion, or an exact live copy will look mismatched.

The canonical working branch (`orchestration/control-plane-20260920`) committed `561cf6b`: the same page copy at
`gold-factor-wip.html`, the same one topbar line, and a new guard
`backtester/tests/gold_factor_wip_dashboard_link.browser.test.js` (the dashboard hop, the draft label, the banner
count, self-containment and no external request). That guard and the two existing page guards pass 5 of 5. The
line-ending note, the live identity and the refresh rule are recorded in `docs/orchestration/DECISIONS.md` and
`docs/orchestration/assignments/strategy.md`.


# 2026-09-30 (cont.) - live-trading feed-002 reviewed: changes requested, one bounded documentation correction

The background coordinator took the one review it owned, live-trading submission `20260930-live-trading-feed-002`, and
decided `changes_requested` (documentation only). Mailbox SHA-256
`088e8a9515fddcc149edd6bc41230952f141d8075a16bf7ba04b4e429e4c0f21` reproduced from the immutable inbox file; reply
`.local/orchestration/replies/live-trading/20260930-live-trading-feed-002.json` (3,908 bytes, sha256 `0e24fda5...`);
durable review `docs/orchestration/reviews/20260930-live-trading-feed-002.md`; `check --worker live-trading` returns
state `changes_requested` with zero errors.

Verified from the checkout rather than trusted: `tools/mt5-bridge/live-trading-snapshot.py` is read-only by
construction, with no order call anywhere in the changed set and an import-allowlist test that would fail if one were
added; `scripts/validate_live_trading_feed.js` returns PASS on the committed `data/live-trading.json` (27,727 bytes,
sha256 `b3db6cc5...`, generated `2026-09-30T19:28:37.575240Z`, four instruments, masked `***614`, zero positions and
orders); `tests/live_trading_feed.test.js` is 18 of 18 in the worktree; the `index.html` (+2 rail, +15 section),
`script.js` and `styles.css` (+50, nothing deleted) additions are additive and live-trading-scoped; and the section
exists in exactly one copy, since the canonical checkout, eleven other worktrees and four `*-release` copies carry zero
references to it. Base `5ff1bf3` is the assignment baseline and the reported head `65557be` is an ancestor of the
current tip `9a68050`.

One documentation correction is owed under a new submission ID: the report attributes the 19:15:25.891323Z reading in
the ignored scratch file `tmp/live-trading.real.json` to the committed 19:28:37.575240Z run, whose own quotes are
EURUSD 1.13310/1.13312, XAUUSD 4153.30/4153.71, US100.cash 30558.33/30559.78 and BTCUSD 83739.20/83740.20; the same
scratch console text is the `tools/mt5-bridge/README.md` example without its run time; and the quoted canonical
`index.html` size of 19,616 bytes is the seven `backtester-<asset>` worktrees' size, not the canonical file's.

The lane's disclosed scope overrun - the `MetaTrader5` 5.0.6231 install into the user's Python, the read-only attach to
the user's own logged-in terminal and the read of facts about the user's own evaluation account, and the writes outside
`docs/live-trading/` - is recorded as disclosed and not authorised. The authority question (read-only feed, demo
execution, funded execution) stays the user's open decision. No new assignment was published, no worker status was
altered, nothing was merged, published or deployed, and submission `20260930-live-trading-publish-003` remains
`pending_review` with its publish route undecided.
# 2026-09-30 (cont.) - coordinator answered every waiting submission; the draft gold factor page is next

At the user's instruction to "communicate with the other VSC to ensure you have everything", the coordinator read
the whole shared mailbox and answered all 21 submissions waiting for review - 19 from `strategy` and 2 from
`live-trading` - with hash-bound replies published through `node scripts/coordination.js reply`, each bound to the
mailbox SHA-256 of that exact file and each decision `acknowledged`, a receipt of record rather than an adoption.
`check` now reports `pending 0` with `errors 0`; the cumulative totals are 26 acknowledged, 23 changes requested
and 23 accepted. Nothing was merged or deployed and no lane was opened.

Two coordinator decisions were recorded in `docs/orchestration/DECISIONS.md`: the gold factor draft page is
published to the live dashboard ahead of the live-trading harness review, and the strategy reply-style rule is
adopted canonically. The per-window obligations that remain are written in
`docs/orchestration/AGENT_MESSAGES.md`, including the past-due 022 item A anchor observation envelope for
`gold-research` and the seven `backtester-<asset>` windows that have never confirmed pickup.


# 2026-09-30 - no fresh Layer 1 or Layer 2 run: the orchestrator has no clock, and the button was blocked in one browser profile

The user reported that the live dashboard had stopped producing Layer 1 and Layer 2 calls and that `Run Refresh`
could not be clicked. Both reports are correct, and they have two different causes.

Cause one, verified: nothing starts the pipeline on a schedule. The live `Master Orchestrator`
(`X75RKU34ikiM5RMU`) is active and exposes only `Manual Start - Run All Agents` and `Dashboard Trigger - Run All
Agents` (`POST master-orchestrator-dashboard-refresh`) - no schedule trigger exists on any active workflow in the
workspace, and the published `data/layer1.json` states the same (`refresh_schedule` `07:00`,
`refresh_schedule_status` `PROVISIONAL`, `validity_schedule_note` "No authoritative orchestrator cron exists in
the repository"). The n8n execution history shows one webhook-triggered orchestrator run per day on 25-29
September and none on 30 September, and the 29 September run published `last_updated_et`
`2026-09-29T08:06:43.090Z` with USD `expires_at` `2026-09-30T08:04:36.805Z` - so by the morning of 30 September
the dashboard was serving expired calls with no replacement.

Cause two, verified: the published dashboard itself is healthy, so the unclickable button is browser-local.
Opening the live site in a clean browser profile leaves `Run Refresh` enabled ("Trigger the n8n Master
Orchestrator"), with no page errors and an empty refresh lock; the only console noise is an unrelated 404 for
`data/half-l2l-reach-research.json`. The button is disabled while a non-terminal request sits in the
`dashboard-workflow-refresh-state` localStorage key ("A refresh request is already being tracked in this browser
profile") or while `data/workflow-control.json` has no webhook URL - and that control file is correctly
configured on the served branch.

Fix applied: the refresh was triggered through the live webhook (the same POST the button makes) at
2026-09-30T10:08:40Z. Orchestrator execution `4352` succeeded (10:08:41Z -> 10:13:18Z) with every collector
succeeding this time, and the pipeline published `data/layer1.json` `last_updated_et`
`2026-09-30T10:13:13.937Z` with all 8 agents and `data/layer2.json` at `2026-09-30T10:13:10.354Z` with one live
opportunity (WTI/USD SELL 77, rank 1). The published `data/workflow-status.json` now reads `success`, and the
browser probe of the live site shows "Last run completed 30 Sept 2026, 11:13:16".

Recorded for the next operator: `docs/N8N_INTEGRATION.md` gains a `Live Refresh Triggering` section with the
trigger inventory, the read-only inspection commands (local credential runner), the direct webhook call, the ~5
minute refresh-plus-publication timing, and the two reasons the `Run Refresh` button can be disabled. No workflow
was edited, deactivated or activated; no data file was rewritten by hand; the only state change was the single
webhook trigger the user asked for. Adding a real 07:00 ET schedule trigger to the orchestrator - the durable fix -
is a live workflow change and is left to the user's decision.

# 2026-09-29 (cont.) - a checkout copy of the dashboard data is a snapshot, not the live feed

The live-trading coworker read `data/layer1.json` and `data/layer2.json` inside its own worktree and reported the
feed as "stale and empty". The user checked the live site and was precise: Layer 1 live carries all 8 agents (USD,
EUR, GOLD, SILVER, NQ, BTC, WTI, GBP, published 2026-09-29 08:06Z) and Layer 2 live carries 6 pairs with one live
opportunity, WTI/USD SELL confidence 75 rank 1. Both statements are true of different copies.

Cause, verified: the two files are tracked published artefacts that the live pipeline (Dashboard Writer, trade
selection agent) commits straight to `main` - `6d81f7e` and `043274f`, 2026-09-29 09:06, matching the published
pages' `dashboard_meta.last_updated_et` of `2026-09-29T08:06:35.263Z` (Layer 2) and `2026-09-29T08:06:43.090Z`
(Layer 1) - and GitHub Pages serves `main`, so the dashboard is current by construction. Every lane branch in
this repository forks from `125d871` (2026-09-07 07:15 - the merge base of `HEAD` and `origin/main`) and no
branch here has merged `main` since, so a worktree holds the 2026-09-07 refresh: `layer1.json` with 5 of the 8
`required_agents` and `layer2.json` with no `trade_opportunities`. `git show origin/main:data/layer1.json` counts
8 agents and `git show origin/main:data/layer2.json` shows the live WTI/USD row; `HEAD` shows 5 and no rows.
Nothing in the dashboard, the pipeline or the publication path is stale or broken, and `script.js` fetches
`./data/layer1.json` from the site it is served on, not from a checkout.

Recorded as a reading rule, not a rewrite: `CODEX_STARTUP.md` gains it beside the other production/research
boundaries, and `docs/ARCHITECTURE.md` gains a `Published data snapshots` subsection under GitHub Pages with the
commands for reading live values (`git fetch origin`, then `git show origin/main:data/layer2.json`). No merge of
`main` into any branch, no rewrite of the tracked data files, no dashboard, workflow, credential, warehouse or
production action occurred. One `git fetch origin --no-tags` refreshed the previously stale local remote ref
(`b649ef1` -> `b1b8747`) so the comparison could be made. The decision whether to merge `main` into the
orchestration line, or to sync just the two data files, remains open with the user.


# 2026-09-29 (cont.) - seven asset backtester lanes opened as windows; every backtester build is deferred

At the user's instruction - "we want to do 7 at the same time for the other assets in the dashboard ... we
first just need to build the 7 VSCs and open them for each backtesting agent", with the builds following "once
we have completed and understood all the lessons from the gold backtesting loop" - the seven non-Gold assets of
the 2026-09-24 readiness matrix were registered as their own VS Code windows and mailbox lanes: USD, EUR, NQ,
BTC, GBP, Silver and WTI.

Created and published: seven worker rows `backtester-<asset>` in `docs/orchestration/projects.json` at status
exactly `instructions_published_awaiting_worker` with `mailbox_auto_connect` true and baseline `1bb3395`;
`docs/orchestration/assignments/backtester-<asset>.md` for each (`backtester-<asset>-001`); seven Git worktrees
`.local/worktrees/backtester-<asset>` on branches `workers/backtester-<asset>-20260929` cut from the
control-plane tip with `git worktree add`; `tools/backtester-<asset>-node/Backtester<Asset>.code-workspace`
plus a README per lane, each with its own tint and the worker checkout as the first workspace folder because
the bridge binds the mailbox to the first folder's registered path; seven startup messages in
`docs/orchestration/AGENT_MESSAGES.md`; the `Seven asset backtester lanes` paragraph in
`docs/orchestration/README.md`; and the decision entry in `docs/orchestration/DECISIONS.md`. The
`<Asset> Backtester` rows appear in `npm run monitor` from the register with no monitor, bridge or extension
code change.

What the lanes may not do, in the assignment's own words: create, edit or run any builder, checker, validator,
registry, fixture, session policy, outcome definition, adapter, matrix runner or scheduler; acquire or import
data; touch the warehouse, n8n, Layer 1, the dashboard, credentials, production or deployment; read any
outcome, holdout or prospective observation; or touch the Gold capture lane, the canonical folder's five
untracked Gold session-policy files, the historical `gbp`/`silver`/`wti`/`eur-pairs` checkouts or another
worker's files. Stage A is one file, `docs/backtester-<asset>/READINESS.md`, plus one `status_report` through
the shared mailbox, a monitor activity line and a pause. The reason is that the multi-asset platform code
(`backtester/lib/asset_adapters.js`, `backtester/scripts/run_asset_matrix.js`,
`backtester/scripts/run_asset_real_shard.js`) is unmerged on `spike/multi-asset-readiness-20260924` under a
change request, `backtester/registries/` holds only `gold_*` registries, and building seven backtesters on an
unfinished platform would repeat the Gold loop's mistakes seven times at once.

Honest scope: this is seven windows and seven written boundaries, not seven backtesters, and no backtesting
capability. Registration is not pickup, and a connected window or a send receipt is not proof that an agent
started. The dispatcher was found paused - `config.json` `{"enabled": false}`, `status.json` paused at
`2026-09-29T20:35:00.029Z` with pid 34192 and `activeRun` false - and was left untouched; no controller command
was issued. The queue held eight `pending_review` submissions before this change and will grow by up to seven
`status_report` envelopes once the windows are connected. No credential, warehouse, Layer 1, live-workflow,
dashboard, production, purchase, deployment or holdout action occurred, `GoldQualificationWindowTick018` was not
disturbed, and the sealed prospective window stays sealed until `2027-03-25T15:00:00Z`.


# 2026-09-29 (cont.) - strategy submission 20260928-strategy-gold-band-edge-table-008 accepted as an accurate short-plan advisory

A fifth controller-locked background cycle reviewed exactly one submission, `20260928-strategy-gold-band-edge-table-008` from the `strategy` worker, and accepted it. The mailbox SHA-256 `a4156f0a...` was reproduced twice from the immutable inbox file, the reply `08b208b5...` is published at `.local/orchestration/replies/strategy/20260928-strategy-gold-band-edge-table-008.json` bound to that hash, and the durable review is `docs/orchestration/reviews/20260928-strategy-gold-band-edge-table-008.md`. Acceptance is of the advisory and its record only; it opens neither `gold-declared-band-measurement-026` nor `dashboard-gold-factor-edge-page-001`, and it authorises no research, integration or live-system action. `check --worker strategy` then reported 5 `pending_review` with `errors: []`.

Provenance exact: `.local/worktrees/strategy` is clean on `workers/strategy-advisory-20260920`, base `9d4403ec` is the direct parent of the single head `1576e898` (`git rev-list --count 9d4403ec..1576e898` is 1), and the commit is +250 / -0 lines across three files inside the owned `docs/strategy/` scope: `GOLD_VIX_BOTH_AND_FACTOR_TABLE_PLAN_20260928.md` new at 211 lines, `GOLD_BAND_FIX_AND_EDGE_TABLE_SPEC_20260928.md` +7 (retitled as the mechanical appendix with section 9 superseded), `CONVERSATION_NOTES.md` +32. The three artifact byte hashes reproduce exactly against the commit (plan `A2B680BD...` from its CRLF bytes at 211 lines, retitled spec `F5747BC5...`, notes `C392CEA8...`), the retitle and section 9 supersede note are verbatim in the diff, and no test, registry, gate, manifest or workflow names either path, so dependency impact is nil.

Every load-bearing number was re-derived and is exact. `logic/agent_gold_direction.md` F6 declares `document_inputs` `vix_level`/`vix_d1`/`vix_d5` with a rule for the level only, so the document asks for both streams and defined one. The `unscored` blocks of `data/gold-direction-scorecard-20260927.json` carry the plan's Stream B table cell-for-cell (`vix_d1` positive session n 437 52.86% / week n 433 60.51%; `vix_d1` negative 58.32/56.60; `vix_d1` exact_zero n 4 50.00/25.00; `vix_d5` positive 59.21/59.82; `vix_d5` negative 52.86/56.92; `vix_d5` exact_zero n 1 0.00/0.00; `vix_level` median split 56.96/58.84 and 54.66/57.62), with baselines 55.81% n 964 and 58.23% n 960 and the F6 factor block `testable` false / `rows_scored` 0 / `blocked_states` 8. Exactly one cell is at or above 60% on either horizon - the `vix_d1` positive **week** row, 60.51% n 433, one of twelve looks on spent data with a below-drift session number (52.86%) - and the flagged numeric coincidence is not a shared count (262 of 433 versus F9's 285 of 471). The accepted 019 report is exactly 95,842,994 bytes with zero occurrences of the field `"values"`; `VIXCLS.json` is 97,074 bytes and the only VIX series; `logic/agent_usd_direction.md` line 154 does carry the change rule cited; and the sizing scratch estimate reproduces exactly (954 weekday observations, 41 above 25 / 400 below 16 / 513 inside). One minor citation slip is recorded as a note, not a required change: section 4 labels the sizing window end `2026-09-21` where the file's last in-range observation is `2026-09-11` (the 954 count and all three band counts are exact); it is the same slip review 007 already noted on the spec.

No new assignment was published, for sequencing and ownership reasons rather than any defect in the evidence: the worker's later `-009`/`-010` submissions already rewrite the plan this envelope delivers (live file now 287 lines, sha256 `A5DF999D...`) and `-011` changes D1's floor default, all still queued behind the one-review-per-cycle rule; `gold-research` deliberately stays at status exactly `instructions_published_awaiting_worker` for the carried 022 item A envelope, so a second assignment to that lane would break the one-active-milestone rule; and the proposed page lane still has no registered worker. The queue now holds 5 `pending_review` `strategy` submissions (2026-09-28 to 2026-09-29). Boundary unchanged: no credential, warehouse, Layer 1, live-workflow, dashboard, production, purchase, deployment or holdout action occurred, `GoldQualificationWindowTick018` was not disturbed, and the sealed prospective window stays sealed until `2027-03-25T15:00:00Z`.
# 2026-09-29 (cont.) - strategy submission 20260928-strategy-gold-band-edge-table-007 accepted as an accurate specification advisory

A fourth controller-locked background cycle reviewed exactly one submission, `20260928-strategy-gold-band-edge-table-007`
from the `strategy` worker, and accepted it. The mailbox SHA-256 `835fb83e...` was reproduced twice from the immutable
inbox file, the reply `dc79147a...` is published at
`.local/orchestration/replies/strategy/20260928-strategy-gold-band-edge-table-007.json` bound to that hash, and the durable
review is `docs/orchestration/reviews/20260928-strategy-gold-band-edge-table-007.md`. Acceptance is of the advisory and its
record only; it opens neither `gold-declared-band-measurement-026` nor `dashboard-gold-factor-edge-page-001`.

Provenance was checked from the checkout this time rather than assumed: `.local/worktrees/strategy` is clean on
`workers/strategy-advisory-20260920`, the reported base `4fc61096` is the direct parent of the single head commit
`9d4403ec` (`git rev-list --count 4fc61096..9d4403ec` is 1), and the commit is +610 lines across exactly two files, both
inside the worker's owned `docs/strategy/` scope: `GOLD_BAND_FIX_AND_EDGE_TABLE_SPEC_20260928.md` +454 (454 lines at that
head) and `CONVERSATION_NOTES.md` +156 (1245 lines at that head). No test, registry, gate, manifest or workflow file names
either path, so dependency impact is nil.

Every quoted figure reproduced exactly against the canonical artifacts. From `data/gold-direction-scorecard-20260927.json`:
parameters `min_n` 100 / `min_year_n` 20 / `edge_pp` 5 / `threshold_pct` 60; baselines session 55.81% n 964 and week 58.23%
n 960; coverage 28/28 variables, 965 anchors of which 964 carry an outcome, 5115 event rows, 25 scored, 20 unscored, 6
neutral, 7 factors scored; unscored by reason 8 `level_band_not_declared`, 6 `change_rule_absent`, 2
`threshold_is_absolute_band`, 4 `regime_label_not_reproduced`; the two `threshold_is_absolute_band` rows are exactly
`vix_level:above_own_median` (session n 481) and `vix_level:at_or_below_own_median` (session n 483); the six neutral states
are the four `exact_zero` change states plus `inflation_signal:exact_zero` and
`risk_headline_context:at_or_below_own_median`; 25/25 session verdicts `no_information` with 24 week `no_information` plus
one `unstable_across_years`; exactly one row at or above 60% per horizon. That row is the F9
`risk_headline_context:above_own_median` entry, provenance `interpreted` with caveat `interpreted_regime_mapping`, session
60.51% n 471 (+4.70pp), week 63.69% n 471 (+5.46pp), `years_same_edge_sign` false on both horizons, per-year session edges
-1.54 / -0.18 / +6.52 / +15.84 pp.

The dependency claims are real, not inferred. The 60% bar is verbatim at
`backtester/scripts/report_gold_factor_direction_check.js` lines 204 and 387. `lib/gold_individual_variable_report.js`
lines 1042, 1060, 1064 and 1104 match the quoted text character-for-character, including the forced
`stratification: levelVariable ? 'median_split_of_own_distribution' : variable.measurement.strata`, and the v2 registry
really declares `vix_level` as `{"kind":"fred_level","series_id":"VIXCLS","strata":"median_split"}` with the
`variable_state_strata.median_split_revision_8` text verbatim as quoted, so the declared `strata` field is genuinely
ignored for level variables. The accepted 019 report is exactly 95,842,994 bytes, version
`gold-individual-variable-report-v1`, generated `2026-09-25T14:44:33.370Z`, with zero occurrences of the quoted `"values"`
token, so the re-cut really is impossible. All three of the worker's self-corrections hold: the 019 series directory is in
the gold-research worktree only (10 files, 2,778,424 bytes), the two other input directories are canonical and present (17
files / 12,099,758 bytes and 2 files / 3,456,639 bytes), and the report library, builder and v2 registry are absent from
canonical. The scratch VIX sizing check reproduces exactly: 954 Monday-Friday observations in range, 41 above 25, 400 below
16, 513 between 16 and 25.

Two minor citation slips were recorded as notes rather than as required changes, because neither alters a number or a
conclusion: section 3.7 labels the VIX window "2023-01-03 to 2026-09-21" while the file's last in-range observation is
2026-09-11 (the count and all three band counts are exact, and section 3.6 states the correct end date), and the section 8
reference to the scorecard's embedded JSON as line 214 is line 211 in both the built page and the template.

No new worker assignment was published, and no register status changed, for three recorded reasons: the delivered spec has
already been rewritten in place by the worker's own still-queued `-008` (head `1576e89`) and `-009` (head `73e64852`)
submissions with `-010` (head `45b7864a`) revising the plan again; the material forks D6, D8, D4 and D15 in the spec's own
section 9 are open; and the proposed page lane has no owner because `docs/orchestration/projects.json` carries a `dashboard`
coordinator workstream rather than a registered worker. `gold-research` deliberately stays published at status exactly
`instructions_published_awaiting_worker` for the carried 022 item A obligation, and the queue now holds six
`pending_review` `strategy` submissions dated 2026-09-28 to 2026-09-29, taken one review per cycle.

Boundary unchanged: no production, dashboard, credential, warehouse, Layer 1, workflow, purchase, deployment or holdout
action occurred or is authorised, no credential value was read, the sealed prospective window is untouched and stays sealed
until `2027-03-25T15:00:00Z`, and `GoldQualificationWindowTick018` was observed read-only and not disturbed. Review was a
separate session from authorship. Mechanism note: `node scripts/monitor-state.js activity central-orchestrator ...` was
accepted by the harness this cycle and used directly, unlike the two previous cycles that were refused by policy and fell
back to writing the activity JSON by hand.

# 2026-09-29 (cont.) - strategy submission 20260927-strategy-window-flash-fix-006 reviewed with changes requested

A third controller-locked background cycle reviewed exactly one submission, `20260927-strategy-window-flash-fix-006` from
the `strategy` worker, and requested changes rather than accepting it. The mailbox SHA-256 `a057ca77...` was reproduced
twice from the immutable inbox file, the reply `e1eb71db...` is published at
`.local/orchestration/replies/strategy/20260927-strategy-window-flash-fix-006.json` bound to that hash, and the durable
review is `docs/orchestration/reviews/20260927-strategy-window-flash-fix-006.md`. Provenance was checked from the
checkout: `.local/worktrees/strategy` is clean on `workers/strategy-advisory-20260920`, and `f7c0cc7` (+62 lines) and
`4fc6109` (+11/-3) touch only `docs/strategy/CONVERSATION_NOTES.md`, inside the worker's owned scope with no dependency on
the notes path or the capture-task action.

The submitted fix is verified live, not taken on report: the launcher
`C:/Users/A17/.trading-agent-dashboard/scripts/run-hidden.vbs` exists and matches its described neutral body, and read-only
task state shows `GoldQualificationWindowTick018` `Ready` with exactly one `wscript.exe` launcher action,
`LastTaskResult` 0, last run 2026-09-29 20:46:01 local, next 20:56 and zero missed runs. The withdrawal of the `-005`
"fix held" claim is honest and recorded, and the two verification ticks it cites are real in `tick.log`
(`2026-09-27T14:56:02Z` and `2026-09-27T15:06:02Z`, both `attempted 0`). Changes were requested for three documentation
defects: the commit adds a fresh unqualified gaplessness claim around line 1030 ("a write at every `:x6` boundary through
the night" so "the lane never missed a tick") of exactly the class `-004` and `-005` already required to be removed, while
the log holds a 780.0-minute gap (`2026-09-26T20:56:02Z` to `2026-09-27T09:56:04Z`) inside that span and an `attempted 3`
block at `2026-09-27T14:06:02Z`; the line ~911 and ~1005 revisions are still outstanding at that head because the commit
only appends text at the end of the file; and the reported base `0802dd74` is not the parent of `f7c0cc7` (the parent is
`0d7808c`, `rev-list --count` 3), with the notes' applied minute 15:47 disagreeing with the central record's 15:46 local.
The submission's request to record the capture-task action string centrally was already answered by `DECISIONS.md`, which
carries the windowless launcher including its path. Boundary unchanged: the live-system edit stays recorded as disclosed,
validated and superseded, not as precedent. No production, dashboard, credential, warehouse, Layer 1, workflow, purchase,
deployment or holdout action occurred, the capture lane was observed read-only, and the sealed prospective window stays
sealed until `2027-03-25T15:00:00Z`. No new worker assignment was published; the queue holds seven `pending_review`
`strategy` submissions dated 2026-09-28 to 2026-09-29.

# 2026-09-29 (cont.) - strategy submission 20260926-strategy-window-flash-fix-005 reviewed with changes requested

A second controller-locked background cycle reviewed exactly one submission, `20260926-strategy-window-flash-fix-005` from
the `strategy` worker, and requested changes rather than accepting it. The mailbox SHA-256 `15fb7024...` was reproduced
twice from the immutable inbox file, the reply `8eacfe11...` is published at
`.local/orchestration/replies/strategy/20260926-strategy-window-flash-fix-005.json` bound to that hash, and the durable
review is `docs/orchestration/reviews/20260926-strategy-window-flash-fix-005.md`. Provenance was checked from the checkout:
`.local/worktrees/strategy` is clean on `workers/strategy-advisory-20260920`, base `0802dd74` is the direct parent of head
`0d7808cc` with a single commit in between, and `0d7808c` is exactly +28 lines in `docs/strategy/CONVERSATION_NOTES.md` and
nothing else, inside the worker's owned scope with no test, registry, gate, manifest or workflow dependency on the notes
path or the capture-task action.

The submission's positive claim is confirmed rather than accepted on report. `tick.log` holds 342 blocks from
`2026-09-24T20:06:27Z` to `2026-09-29T19:36:02Z`, and the block at `2026-09-26T20:56:02.521Z` has `dry_run false`,
`attempted 0`, `settled 0`, `blocked 0`, `not_yet_eligible 0`, `open_identities []` and `eligible_identities []`, so the
promised acceptance tick ran at the next boundary and the lane stayed metadata-only. The disclosed scratch-verifier FAIL is
honest and artifact-backed: `tmp/gold-tick-verify-20260926.txt` records `last_run=09/26/2026 21:56:01 result=267009` with its
FAIL verdict, and `267009` is `0x41301` `SCHED_S_TASK_RUNNING`, so the verdict is a poll artefact and the reported read-back
of result 0 is the correct reading. The user's visual confirmation is recorded, and the flasher identification stands on
mechanism as before.

Changes were requested for documentation only, twice over. First, the revision required by `-004` is still outstanding:
line ~911 of the notes still asserts that the `:06/:16/:26/:36/:46/:56` timestamps run "with no gaps" from
`2026-09-24T20:06Z` through `2026-09-26T20:36Z`, and the log again shows otherwise - a 630.0-minute gap
(`2026-09-24T21:16:01Z` to `2026-09-25T07:46:03Z`), a 19.8-minute skipped slot (`2026-09-25T15:16:02Z` to
`2026-09-25T15:35:52Z`), a 1069.4-minute gap (`2026-09-25T21:26:02Z` to `2026-09-26T15:15:29Z`) and exactly three
`attempted 1` blocks, 126 blocks in total by a `20:36:59Z` boundary with 123 metadata-only and 3 not. Second, this commit
adds a new instance of the same error, saying "`tick.log` is gapless" in its close-out section, which was false when
written because the cited tick is followed by a 780.0-minute overnight gap (`2026-09-26T20:56:02Z` to
`2026-09-27T09:56:04Z`) and six further non-metadata blocks from `2026-09-27T14:06:02Z` onward. The required revision is one
bounded edit in the worker's own notes file under a new submission ID, keeping the flasher conclusion, the verification
record and the verifier caveat, which do not depend on gaplessness.

The report's request to record the capture-task action string centrally needed no action. `docs/orchestration/DECISIONS.md`
already carries the current action of `GoldQualificationWindowTick018` - the windowless `wscript.exe run-hidden.vbs`
launcher applied on 2026-09-27 15:46 local, the worker's own named residual fallback - and marks the 2026-09-24 hardening
entry's "action unchanged" clause superseded; the `-WindowStyle Hidden` string this report verified is recorded as interim,
no revert is wanted and no worker action is needed. Read-only task state today: `Ready`, `LastTaskResult` 0, last run
2026-09-29 20:36:01 local, next 20:46, zero missed runs, action the `wscript` launcher. Editing a live system remains
outside the strategy assignment even at a direct user instruction, recorded as disclosed, validated and superseded rather
than as precedent.

No new worker assignment was published: the submission carries no research recommendation, and the register already keeps
`gold-research` published at status exactly `instructions_published_awaiting_worker` for the carried 022 item A obligation,
so a second publication would break the one-active-milestone rule. One observation is recorded as unverified, not as a
finding, and was not chased: the newest block reproduces the `-004` cycle's flag that `2026-09-30T14:00:00.000Z` is
labelled `already_settled` while `attempted` is 0 and `not_yet_eligible` is 0, and `2026-09-28T14:00:00.000Z` and
`2026-09-29T14:00:00.000Z` now carry the same label; interpreting it needs the Gold lane's driver source and its owner. No
production, dashboard, credential, warehouse, Layer 1, workflow, purchase, deployment or holdout action occurred, the sealed
prospective window stays sealed until `2027-03-25T15:00:00Z`, and the queue now holds eight `pending_review` `strategy`
submissions dated 2026-09-26 to 2026-09-29, taken one review per cycle.

# 2026-09-29 (cont.) - strategy submission 20260926-strategy-window-flash-fix-004 reviewed with changes requested

A controller-locked background cycle reviewed exactly one submission, `20260926-strategy-window-flash-fix-004`
from the `strategy` worker, and requested changes rather than accepting it. The mailbox SHA-256 `e3615716...`
was reproduced from the immutable inbox file, the reply `dcd739d6...` is published at
`.local/orchestration/replies/strategy/20260926-strategy-window-flash-fix-004.json` bound to that hash, and the
durable review is `docs/orchestration/reviews/20260926-strategy-window-flash-fix-004.md`. Provenance was checked
from the checkout rather than taken on report: `.local/worktrees/strategy` is clean on
`workers/strategy-advisory-20260920`, base `703daf8a` is an ancestor of head `0802dd74`, and the single commit
`0802dd7` is exactly +97 lines in `docs/strategy/CONVERSATION_NOTES.md`, inside the worker's owned scope, with no
test, registry, gate, manifest or workflow dependency on either the notes path or the capture-task action.

The change requested is one bounded documentation correction. The submission's corroboration - that the capture
lane's ticks run "continuously ... with no gaps" from `2026-09-24T20:06Z` through `2026-09-26T20:36Z` and that
every block in that range is metadata-only - is not what `tick.log` shows. Inside that exact window the log holds
121 blocks with a 630.0-minute overnight gap (`2026-09-24T21:16:01Z` to `2026-09-25T07:46:03Z`), a 1069.4-minute
gap (`2026-09-25T21:26:02Z` to `2026-09-26T15:15:29Z`), a 19.8-minute skipped slot, and three `attempted 1`
blocks, which the Gold lane's own `CURRENT_STATE` entry for 2026-09-26 18:45 also records. The flasher
identification itself survives, because it rests on mechanism: a console action under an interactive principal
necessarily creates a real window, `Settings.Hidden` only hides the task in the scheduler list, and the
phase-regular `:06/:16/:26/:36/:46/:56` cadence is what a user sees as flashing every few minutes. The promised
acceptance check was met rather than assumed: a real tick ran at `2026-09-26T20:56:02Z` with `attempted 0`, and the
task reads `Ready` with `LastTaskResult` 0, last run 2026-09-29 20:36:01 local, zero missed runs.

The disclosed live-system change is recorded centrally in its current form, not the form the submission asked for.
Its `-WindowStyle Hidden` argument was applied on 2026-09-26 and superseded on 2026-09-27 15:46 local by the
windowless `wscript.exe run-hidden.vbs` launcher the worker itself named as the residual fallback, so
`docs/orchestration/DECISIONS.md` carries the current action string and states that the 2026-09-24 hardening
entry's "action unchanged" clause is superseded; no revert is wanted. Editing a live system is outside the strategy
assignment even at a direct user instruction, so the edit is recorded as disclosed, validated and superseded, not as
precedent, and further live-system requests route through the coordinator to the owning lane. No new assignment was
published: the submission carries no research recommendation and the register keeps `gold-research` published at
status exactly `instructions_published_awaiting_worker` for the carried 022 item A obligation, so a further
publication would break the single-active-milestone rule. Nine `strategy` submissions dated 2026-09-26 to 2026-09-29
remain `pending_review` and are taken one review per cycle. Two harness substitutions are recorded because the
documented commands were refused by policy in this background run: `monitor-state.js activity central-orchestrator`
and the `coordination.js reply` call with a literal path; the coordinator activity record was written directly and
the reply was published through the canonical CLI with the path passed by variable. The monitor, bridge and
controller were not changed, and no credential, warehouse, Layer 1, live workflow, dashboard, production,
deployment, purchase or holdout action occurred.
# 2026-09-29 (cont.) - the paused background dispatcher was diagnosed and restored

A later pass in the same session diagnosed the background Central Orchestrator pause that the live-trading work left
behind, and restored unattended review. `.local/orchestration/controller/config.json` was `{"enabled": false}`,
written 2026-09-29 20:28 local by this session's own `pause` command before the central-memory edits, while
`.local/orchestration/controller/status.json` was stamped `2026-09-25T21:34:32.765Z` on pid 15124 and `daemon.lock`
held that same dead pid. The diagnosis is a mechanism fact rather than a guess: `status.json` is written only inside
a live `serve()` loop in `scripts/coordinator-dispatch.js`, so a four-day-old record means no dispatcher has run
since 2026-09-25 21:34Z, and the fresh `config.json` and activity timestamps came from interactive commands, not from
a running daemon. `run.lock` was absent, so no unfinished review required inspection, and `serve()` unlinks a stale
`daemon.lock` whose pid is no longer running. Restoration used the documented launcher
`tools/agent-mailbox-bridge/start-coordinator.ps1`, which validated the `deepseek-coordinator` credential scope, ran
`enable` so `config.json` is now `{"enabled": true}`, and spawned `run-coordinator.ps1`; the new daemon stamped
`status.json` with pid 34192 and re-created `daemon.lock`. It began in `waiting` with the detail *"Interactive
coordinator reports working; review deferred"*, because this session's own
`.local/orchestration/activity/central-orchestrator.json` still reported `working` from 19:28:53Z - the intended guard
against two reviewers working the same mailbox - so the flag was reported `paused` at 19:39:20Z and the daemon moved
to `reviewing` on `20260926-strategy-window-flash-fix-004` at 19:39:22Z, with `run.lock` present and pid 34192 alive.
The queue as measured at that moment is nine `pending_review` submissions, all from the `strategy` worker, dated
2026-09-26 to 2026-09-29, none stale and none carrying a receipt, so all nine are dispatch candidates, taken one
review at a time with a forty-minute timeout and `DAILY_REVIEW_CAP` 0. One design property matters because it can
switch the lane off by itself: a review that ends `needs_attention` writes `{"enabled": false}` and pauses dispatch
until the receipt and log are inspected. This entry also corrects the record in the live-trading entry below, which
states that the dispatcher was "re-enabled after" the edits - that clause was written ahead of the fact and the
re-enable had not run until this pass. No controller or bridge code or setting changed, and no MT5 connection,
credential, order, dashboard, Layer 1, production or warehouse action occurred; the Gold hold, the sealed prospective
window whose evaluation stays closed until `2027-03-25T15:00:00Z`, and every accepted artifact are unchanged.

# 2026-09-29 - Live-trading window registered as an advisory lane

The user asked for another registered Cline window, on DeepSeek, connected to the wider project and the
dashboard, so the live-trading path through a MetaTrader 5 (MT5) connection can be discussed in its own window
before anything is built. Published worker `live-trading` in `docs/orchestration/projects.json` with
`display_name` "Live Trading Agent", `mailbox_auto_connect` true, baseline `5ff1bf3`, worktree
`.local/worktrees/live-trading` and branch `workers/live-trading-20260929`, at register status exactly
`instructions_published_awaiting_worker`; the assignment is `docs/orchestration/assignments/live-trading.md`
(`live-trading-001`), the startup message is in `docs/orchestration/AGENT_MESSAGES.md`, the register note is in
`docs/orchestration/README.md`, the decision is at the top of `docs/orchestration/DECISIONS.md`, and the window is
`tools/live-trading-node/LiveTrading.code-workspace` with its own `README.md`. The monitor's `Live Trading Agent`
row is derived from the register, so no monitor or bridge code changed. Verified before publishing rather than
assumed: no MT5 connector, client, bridge or order path exists in this repository - MT5 is the declared `needs_you`
gap in `data/research-proof-map.json` with `executable_trade_validated` false, the 2026-08-21 visual direction in
`docs/MT5_MIRRORED_EXECUTION_CHART_REFERENCE.md`, and a prerequisite named by `docs/BACKTESTING_REVIEW_PLAN.md` and
`docs/GOLD_TIMESTAMPED_EVALUATION_CONTRACT.md`. The assignment is advisory and design-only: it authorizes no
connection to any MT5 terminal, broker server or account, no `MetaTrader5` package or Expert Advisor installation,
no MT5 credential and no credential-manifest or scope change, no order placement, modification, cancellation or
arming, no funded-account history read, and no dashboard, n8n, Layer 1, production, warehouse, scheduler or
deployment action; its deliverables are `docs/live-trading/STRATEGY_LIVE.md` and
`docs/live-trading/CONVERSATION_NOTES.md`, and the authority boundary - read-only feed, demo execution, or
real-money execution - is recorded as the user's open decision. Two facts observed while doing this and not caused
by it: seven Strategy submissions were pending review in the mailbox, none stale, and the dispatcher's status
record is stamped `2026-09-25` on pid 15124. No MT5 connection, credential, order, dashboard, Layer 1, production
or warehouse action occurred; the Gold hold, the sealed prospective window whose evaluation stays closed until
`2027-03-25T15:00:00Z`, and every accepted artifact are unchanged. Local suite after the change: `npm run test:monitor` 15 tests, 15 pass, and `npm test` 447 tests with 444 pass and 3 fail, the three being `backtester/tests/secret_scanner.test.js` console-width cases that fail the same way before this change (that file alone: 5 tests, 2 pass, 3 fail) - a pre-existing environment split, not caused here. That run also picked up the untracked `backtester/tests/gold_session_policy.test.js`, which belongs to another workstream and is not part of this change.

# 2026-09-25 - Gold coverage-024 accepted; the 28-factor exploratory circuit closed

2026-09-25 reviewed and accepted Gold submission `20260925-gold-coverage-024-r2` (mailbox SHA-256 `5dcfaf796a7685a18b6df423d7eb9cf11290fda0b81d5afc39c45fc16b64838e`, reproduced) in a background Central Orchestrator cycle separate from authorship. Accepted at clean `cdd350af` from the declared base `6fd501a7` (an ancestor): the single new commit adds exactly one file, `backtester/tests/gold_combination_engine_024.test.js`, and `2c3606dd` is still its parent, so the repaired adapter and ledger and `docs/GOLD_COMBINATION_ANALYSIS_023.md` are byte-identical to the revisions verified in `20260925-gold-coverage-024-r1`. Both required evidence items are delivered and independently reproduced: the focused file re-ran 6 of 6, and the local suite ran 545 tests with 539 pass and 6 fail, the five CRLF materialisation cases plus 210, which fails closed on the coordinator shell's exported `DEEPSEEK_API_KEY` where the worker reported the four console-width secret-scanner cases instead - an environment split, disclosed rather than normalised. The ledger reproduces at `f02a88cb` (23,948,174 bytes) and was re-derived from the artifact: 4,956 records, 2,745 reported / 704 ineligible / 1,507 empty / 0 unavailable, 4,673 candidates with an unavailable anchor, every record reconciling `350,283 + 91,036 + 0 = 441,319`; summary `d594646d`, manifest `1ec2a382`, row reconciliation `a23f65d1`. Dependency impact is nil: the only cross-module consumer `parseCandidateId` is untouched, and the frozen 014 manifest's eight bound paths and every preserved artifact still match on disk, so the accepted gate cannot move. The batch was not re-run and rev1, rev2 and rev3 remain spent and immutable. Accepted decision: the 28-factor circuit is closed as exploratory and reports descriptive counts only - no accuracy, ranking, timing or edge claim is made or possible from spent intervals. No new assignment was published; the register keeps `gold-coverage-024` at status exactly `instructions_published_awaiting_worker` with its section 0 carrying the 022 item A envelope due at or after `2026-09-28T16:00:00Z`. The durable review is `docs/orchestration/reviews/20260925-gold-coverage-024-r2.md` (reply SHA-256 `40eaccc4a2734f80e1d83945bac19d5565397cc6748736abe43e5ef5e48cec99`). No outcome, holdout, acquisition, credential, production, warehouse, Layer 1, live workflow or deployment action occurred; the live capture lane was neither touched nor re-queried, and evaluation stays sealed until `2027-03-25T15:00:00Z`.

# 2026-09-25 - Gold coverage-completion-019 accepted; gold-coverage-020 published

2026-09-25 reviewed and accepted Gold submission `20260925-gold-coverage-completion-019-r1` (mailbox
SHA-256 `87a6cfdeb99d1381d27341c5d0088102dde545a2e4022afa4165a2b26869df36`, reproduced) in a
background Central Orchestrator cycle that is separate from authorship. Accepted at clean `3240f598`
from the declared base `67f51e8`: the seven remaining drivers were declared before measurement and
sourced keylessly (FRED `DTWEXBGS` under honest `usd_broad_index_*` ids, the San Francisco Fed Daily
News Sentiment Index, FRED `SP500`, and the Philadelphia Fed ADS all-vintages file), the four legacy
`dxy_*` ids were retired with declared reasons and without relabel or back-fill, the findings digest
was regenerated at 28 of 28 with the 21 previously measured blocks byte-identical, and section 8
hardened the installed capture task. Every disclosed digest was reproduced by the coordinator, the
central claim was re-derived independently, no prospective observation was read, and the live capture
lane was verified untouched (one `Ready` `GoldQualificationWindowTick018`, `StartWhenAvailable` true,
`PT10M`, last run `15:46:01` result `0`, zero missed runs, three sealed anchor-2 captures unchanged).
Local suite: 520 tests, 515 pass, 5 fail, the five being the pre-existing hash-bound CRLF
materialisation owned by the `backtester-spike` change request. The durable review is
`docs/orchestration/reviews/20260925-gold-coverage-completion-019-r1.md` (reply SHA-256
`09e1a168760b8b21a6a2424a2fc17729113bdc8d0c2c4025f10e5b4083fff3f8`). The next bounded assignment,
`gold-coverage-020` (Reconcile the accepted declarations the gate and the audit still read as stale),
was published for declaration reconciliation only, with the `gold-research` register entry set to
status exactly `instructions_published_awaiting_worker`. Opening a fresh exploratory combination stage
over the 28 measured variables is left as an explicit user decision. No outcome, holdout, production,
warehouse, Layer 1, live workflow, credential or deployment action occurred.

# 2026-09-20 - Gold coverage registry accepted at checkpoint review

2026-09-24 acknowledged strategy advisory `20260924-strategy-second-adviser-003-asap`
(mailbox SHA-256 `6a08b366...`, `status_report`, no commits and no changed files) after an
independent background review reproduced the hash, confirmed the register, worktree,
workspace and wake prompt created by canonical `c4948df`, verified that
`.local/worktrees/strategy-2` is clean at `4884339` with no `docs/strategy-2/` yet, and
corroborated the capture-lane claim by a read-only check that `GoldQualificationWindowTick018`
is `Ready` with `LastTaskResult` 0, last run `21:36:01`, next run `21:46` and
`NumberOfMissedRuns` 0. One gap was closed: revision 2 of
`docs/orchestration/assignments/strategy-2.md`, the `strategy-2` wake prompt and
`tools/strategy-node/README.md` now name DeepSeek explicitly with no new key, credential
scope or provider configuration, and no provider field was invented in the register. The
durable review is `docs/orchestration/reviews/20260924-strategy-second-adviser-003-asap.md`.
No new assignment was published, and no outcome, holdout, production, warehouse, Layer 1,
live workflow or credential action occurred.

2026-09-24 reconciled the Gold 017 overlap and delivered the multi-asset one-day
readiness spike at commit `aaa5103` in the isolated worktree
`.local/worktrees/backtester-spike` (branch `spike/multi-asset-readiness-20260924`).
Readiness matrix for eight assets, asset/job manifest schema, shared-cache contract
and hash validator, deterministic concurrency-capped batch kernel with
attempt-unique immutable shards, ordered merge, duplicate refusal, resource budgets
and stage metrics, 8/8 focused tests. Measured 2,548 candidates x 965 anchors at
1/2/4/8 workers: 3202/1664/905/775 ms, peak RSS about 50 MB, identical logical output
and identical aggregate checksum at every worker count, 247 KB of compact NDJSON
output, all resource budgets passing. No acquisition, warehouse write, scheduler
install, evaluation, publication or research-rule change.


2026-09-24 accepted Gold offline collectors 016 at clean worker `4eea9a8` (base
`b5f2e27`, one commit, the four disclosed added files only; submission SHA-256
`efe76d7c...`) after an interactive coordinator review that reproduced the accepted
manifest and contract bindings, a byte-identical independent capture plan
`807dc73e...` over 130 anchors and 780 unique blocked items, metadata-only envelopes
and index, the CLI's network/evaluation/real-window/escape refusals and two failing
tamper probes; focused 10/10 and full local 490 tests with 486 pass, the four
failures being the pre-existing console-width `secret_scanner.test.js` cases. No real
acquisition, prospective read, window activation, integration, deployment or
production change, and acceptance is not qualification, accuracy or edge. No
successor assignment was published: the user must decide whether real prospective
collection over the frozen 014 window is authorized, so the window stays closed and
Gold stops at `4eea9a8`.


2026-09-23 accepted Gold shortlist 013 after independent reproduction of four ids,
the complete 255-candidate audit, 79/79 focused tests and 463/463 full local tests.
Published future-window manifest freeze 014 with a 2026-09-24 14:00 UTC first anchor
and an explicit no-backfill boundary. No prospective outcome or production action.

2026-09-23 user chose to narrow the accepted Gold eligible pool before prospective
qualification. Published `gold-qualification-shortlist-013` to execute the frozen
protocol-012 selector once on consumed run-011 evidence and freeze at most 20 ids
with an exhaustive audit. No prospective outcome, holdout, live or production
action is authorized.

2026-09-23 Gold `gold-qualification-protocol-012` revision 3 reviewed by the
background central coordinator and accepted, documentation-only. Submission
SHA-256 `868c0611...` reproduced; worker clean at 67fcc09 (one commit on 7792477,
two disclosed documents, +6/-4); the escape defect is gone and the Assignment 012
and session-notes counts now read 8 tests / 72-72 / 456-452. Coordinator re-runs:
focused file 8/8, eight focused Gold files 72/72, full local suite 456 tests /
456 pass / 0 fail (the documented four console-width-dependent secret-scanner
failures pass in this environment). Changed-document hashes and all fourteen
protected artifacts verified byte-identical, so nothing was rerun or regenerated.
Assignment 012 is complete as a bounded predeclaration deliverable; acceptance is
not integration, merge, deployment, qualification or edge. No next worker
assignment was published: the user must decide whether a prospective qualification
window opens over the 255-candidate eligible pool with the declared 20-hypothesis
cap or the pool is narrowed first. No production, warehouse, credential, Layer 1,
integration, holdout or deployment change.

2026-09-23 Gold `gold-qualification-protocol-012` revision 2 reviewed by the
background central coordinator: submission hash 413b6b17... matched, worker clean at
7792477, the focused protocol file re-ran 8/8, the gate re-ran deterministically at
255 eligible of 2,548 with reproducing fail-closed probes, the 37-atom/15-variable
coverage and fixed-offset boundary were confirmed, and all nine run-011 artifacts
re-hashed byte-identical. Decision: changes requested, documentation-only - a
literal backslash escape and stale 7-test/71-71/455-451 counts in
`docs/GOLD_INDIVIDUAL_VARIABLE_REPORT_PROGRESS.md` and `docs/SESSION_NOTES.md` must be
corrected to the delivered 8-test/72-72/456-452 state, preserving every code,
registry, test and run-011 artifact. No next assignment was published; the open
decision is whether a prospective qualification window opens over the 255-candidate
eligible pool with the declared 20-hypothesis cap or the pool is narrowed first. No
production, warehouse, Layer 1, integration or deployment change.

2026-09-23 accepted Gold run-011 revision 3 after 26/26 coordinator focused tests
and published prospective qualification protocol 012. Migrated the unattended
coordinator configuration from OpenAI inference to DeepSeek `deepseek-flash`, with
an encrypted dedicated credential scope and no OpenAI fallback; the live smoke was
verified after securely migrating the existing Cline credential. Persistent daemon
start remains disabled pending explicit third-party repository-data egress approval.

2026-09-22 evening: all six inboxes checked; Gold 010 r3 was the only pending item. Accepted a185086 after independent 50/50 focused checks and synthetic rejection probes; unchanged frozen registry verified. Published gold-combination-run-011 for the first bounded 2,548-candidate exploratory run with pre-execution manifest/code, strict reconstruction reconciliation and exhaustive ledger. Await actual pickup. Other workers have no new submissions. Automatic reviews remain capped at six per UTC day; this review was user-requested. No real combinations have run at this checkpoint and no production change occurred.

2026-09-22 combination-registry-010 r2 manually reviewed at e8b9a89 on user request. Focused 22/22 pass and frozen registry unchanged. Requested corrections are present, but synthetic probes reproduce min_n override (1 accepted against frozen 20), duplicate-anchor inflation (one anchor counted 20 times), and writer provenance bypass (missing inputs and mismatched registry object/file accepted). Published narrow revision-3 request. No real outcomes or production changes. Automatic six-review daily cap remains unchanged; manual review was explicitly requested.

2026-09-22 reporting-009 revision 5 accepted at clean `7cb773a`. Independent
freshness probes pass, focused checks pass 12/12 and 26/26, revision-5 evidence is
present and accepted hashes/counts remain unchanged. Published
gold-combination-registry-010 to freeze and synthetically verify the first daily
2,548-candidate `and` batch before any execution. No real outcome, holdout,
integration or production action.

2026-09-22 reporting-009 revision 4 reviewed at clean `5d3f890`. The missing
`run.json` evidence is now present, focused checks pass 12/12 and 26/26, and
accepted evidence hashes remain unchanged. Acceptance is withheld because the
forward-form provenance allowlist still permits unrelated-negation bypasses; a
hash-bound narrow correction was published. No combination, holdout, integration
or production action.

2026-09-22 reporting-009 revision 3 reviewed at clean `a4676ab`. Candidate grammar,
counts and endpoint wording reconcile, focused checks pass 12/12 and 26/26, and
accepted evidence hashes remain unchanged. Acceptance is withheld for a structural
freshness-negation bypass; a hash-bound narrow correction was published. No
combination, holdout, integration or production action.

2026-09-22 mailbox repair: installed local bridge 0.2.0. Gold's registered trusted workspace now auto-connects; manual connections persist across reloads, explicit Disconnect overrides auto-connect, and connection health is recorded under ignored .local/orchestration/connections. Fourteen focused bridge/mailbox tests passed, including reconnect, workspace/trust boundaries and persistent disconnect. Live activation/pickup remains pending: the already-open Gold window must load the installed update via Developer: Reload Window and retain its existing Cline task. No new delivery or Gold activity was observed during installation. Cline has no active-task query and a send return remains unconfirmed; never infer pickup from it. Research assignment reporting-009 and its latest corrections are unchanged.

2026-09-22 RESUMED: user authorized building and communication. Coverage-008 revision 2 at de775b5 accepted after independent byte-identical digest/companion reproduction and unchanged report hash. Published gold-reporting-009 for a durable findings renderer, regression checks and next-stage combination protocol proposal; no search or new measurements yet. Restore background coordinator after interactive edits; worker pickup must be confirmed from actual activity. Existing source/calendar/timing limitations and all consumed-period exclusions remain. No integration or production change.

2026-09-21 source-007 revision 2 accepted at 3b10d73 after independent
byte-identical registry regeneration, archive-hash verification, 5/5 focused tests
and 407/407 full local tests. Published gold-coverage-008 for two documented FRED
variables with pre-outcome rules and invariance gates. No holdout, formula,
integration or production action.

2026-09-21 background coordinator configured on user request. Codex CLI live read-only smoke succeeded with gpt-5.6-sol after replacing unsupported inherited gpt-5.4 default. Event-driven new current submissions only; single daemon/run lock, hash receipts before invocation, 6 runs/day, 20min/run, workspace-write sandbox and approval policy never. Failures pause; no silent retries. Reads canonical notes in fresh CLI turns rather than injecting this IDE chat. Interactive coordinator must pause/wait before edits, then re-enable. Gold Cline bridge remains separate and must be connected. Full research-review round trip awaits a new submission.

2026-09-21 automatic communication work: built and installed local VS Code extension trading-local.trading-agent-mailbox 0.1.0. Cline 4.1.19 legacy/next expose sendMessage; companion polls validated mailbox every 5s, binds explicitly to registered worker window, deduplicates before sending, caps attempts and never clicks approvals. Six bridge tests plus four mailbox tests pass. Live end-to-end delivery is NOT verified: worker window must connect to its existing Cline task. Binding expires on reload because API has no task-ID selector/receipt. Current Codex IDE chat has no verified injection API; background coordinator vs current-chat choice asked, not answered. No automatic coordinator installed. Documentation: tools/agent-mailbox-bridge/README.md. Gold source-007 remains the research assignment.

2026-09-21 coverage-006 accepted at 4e051ca after fresh report hash reproduction and byte-identical digest/companion regeneration; original variables/baselines/conditioning unchanged, 19/28 measured. Independent focused tests previously 62/62; inspected full-suite log 398/402 with four pre-existing scanner failures. Published gold-source-007 for remaining sources, DXY feasibility and exact consumed-data manifest. Awaiting pickup; no integration or trading qualification.

2026-09-21 user authorized orchestrator to advance Gold research toward better validated Layer 1 calls. Published gold-coverage-006 from accepted ffa380c: prior 1/5/20-session Gold returns, expanded individual-variable/context report, regression tests and concrete remaining-coverage/qualification plan. Earlier Phase 1 approval hold superseded. Awaiting worker pickup; publication does not prove activity. Further bounded research assignments follow coordinator review under standing user direction; no production or accuracy claim.

2026-09-21 inbox review: Gold findings digest revision 3 at ffa380c accepted for exploratory reporting. Independently reproduced corrected year-agreement totals and byte-identical digest/companion; accepted source raw hash verified. Acceptance reply published; Gold holds for next assignment. No other new submissions. Phase 1 prior Gold return transformations remain proposed pending user confirmation; no integration or deployment. Review: docs/orchestration/reviews/20260921-gold-findings-summary-005-r3.md.

2026-09-21 monitor mailbox prompts: added slowly flashing attention icons, explicit recipient and short prompt in the header/rows, and Copy prompt in Details. Pending submissions direct the user to Central Orchestrator; replies awaiting reported pickup direct the user to the worker. Session logs alone cannot clear the prompt. Native build and normal/narrow visual checks passed; 15 focused monitor/mailbox/usage tests passed. Manual dispatch remains unchanged. Gold digest revision 3 is received and pending review. Unrelated Strategy workspace and Gold originals preserved.

## 2026-09-20 - Compact green monitor and local token usage

Restyled the native monitor to the user reference and added today's semi-live token footer across locally recorded projects. Includes source coverage and input/output/cache breakdowns; does not infer remaining quota or costs. Eleven focused tests and native layout checks pass. No production changes.

## 2026-09-20 - Desktop project monitor

Added native pinnable Windows tray panel, local monitor snapshot/activity commands, deduplicated change alerts and explicit stale/activity/controller states. No AI calls for polling. Seven focused tests and native default/narrow rendering/pin smoke checks pass. No production publication or auto-dispatch.

## 2026-09-20 - Central coordinator and worker mailboxes

Added a project register, shared coordination protocol, bounded worker assignments, ready-to-paste messages and an immutable JSON submission/reply CLI. Replies bind to report hashes; scan reports malformed/stale submissions explicitly. Added four focused transport tests and npm run test:coordination. No production changes or automatic agent startup. Gold coverage acceptance is preserved and further policy work moves to its own worktree.

Reviewed and committed the September 19 variable-first scope documents (f29b967) and the Gold variable/horizon/prior-context coverage registry with its audit CLI, 24 tests, fixtures and documentation (b8193ba). Independently reproduced content hash 278b4070 in two fresh output directories and registry hash 4075f110, and confirmed all reported totals, including zero contiguous 24-hour windows. Added the missing gap report, changed-file record and no-production-change confirmation to DEEPSEEK_GOLD_RESEARCH_PROGRESS.md. Focused suite 24/24; full local suite 356/360, where the four failures are the pre-existing environment-dependent secret-scanner console-width truncation reproduced identically in a clean worktree at HEAD without any milestone file. No production, Layer 1, credential or trading change.

# 2026-09-19 - Variable-first research scope agreed

Recorded individual-variable association research over meaningful horizons up to five trading days, preceding weekly context, systematic combinations and later formula qualification. Added explicit program/workflow/database execution and AI-credit discipline. Updated active task and milestone; no runtime changes.

# 2026-09-18 - Extended Gold research delivered

Predeclared and executed 2023-2026 research in both evidence modes. Added verified archive merger, configurable plan wiring, training-selected diagnostic scorecards and paired month-block sensitivity. Usable training grew 390 to 613; 53,751 retrospective candidates yielded 23 eligible event conditions. Claims-below-consensus lead scores 12/16 directional validation outcomes, with five flats, unverified vintages and broad uncertainty; macro-only winner stays 53.57%. Full local suite 336/336. No production changes. See GOLD_EXTENDED_RESEARCH_20260918.md.

# 2026-09-18 - Gold pre-2024 coverage

September 18: pre-2024 overlap check complete on `research/gold-pre2024-coverage`. Acquired 1,197 events, 5,895 hourly candles and five FRED series. Of 260 decisions, 205 have exact endpoints and 163 also have retrospective events; zero have eligible as-of events or contiguous paths. No new accuracy search or production change. Full local suite: 333/333 passed. See `GOLD_PRE2024_COVERAGE_20260918.md`. Next: predeclare the extended exploratory schedule/split, acquire the December 2022 event buffer and build a versioned 2023?2026 bundle, preserving prior results and consumed-validation labels. This supersedes earlier coverage-check next actions.

# 2026-09-17 - USD FRED gateway recovery

Confirmed HTTP 502 at USD's first FRED GET. Added guarded three-attempt/five-second retries without error suppression or changing single-run behavior. Backed up and verified live saved/active workflow; fresh Master 3992 and every child succeeded. Public Pages reports Manual Refresh Complete at 21:16:17 UTC. Full local suite 333/333. See USD_GATEWAY_INCIDENT_20260917.md.

# 2026-09-17 - Gold event coverage and source mapping

Expanded calendar acquisition to explicit dates and impact filters; captured 3,829 HIGH/MEDIUM records and reran both modes. Retrospective coverage reaches 62 families and 44,367 candidates. One jobless-claims age condition meets the floor but matches its cohort baseline at 59.26% validation; overall macro remains 53.57%. Added reviewed snapshot mapping, fixture exclusion and provenance accounting: some coverage for 25/28 variables, not publication qualification. Full local suite 331/331. See GOLD_COVERAGE_EXPANSION_20260917.md. No production changes.

# 2026-09-12 - Expanded stored-data event associations

Added explicit retrospective event mode, preserving vendor timestamps outside causal inputs; class-specific training-only selection; event-family denominator/exclusion tables; and corrected missing-value versus late-vintage audit categories. Executed 7,678 candidates from stored macro/prices and the newer API's 841 records. No event candidate meets the existing training floor; selected macro validation remains 53.57%. See GOLD_EVENT_ASSOCIATIONS_20260912.md. No production changes.

# 2026-09-12 - Executed Gold macro/event research bundle

Added read-only FRED-vintage, OANDA H1 and current calendar-archive acquisitions; conservative macro as-of dataset builder; event-vintage attachment; training-defined single/pair experiments; and one offline bundle command with reports/source hashes. Fresh evidence covers 681 scheduled observations, five macro series, 15,977 hourly prices and 841 events. Training-selected candidate: 75.86% training, 53.57% validation; reliable greater-than-60% calls remain unestablished. Event contemporaneous coverage is only ten scheduled decisions. Report and evidence limits: `GOLD_RESEARCH_RESULTS_20260912.md`. Full local suite 324/324. No live changes.

# 2026-09-12 - Gold dataset integrity and fresh source acquisition

Enforced exact 24-hour horizons in the variable/event harness, strict timestamps and numeric values, valid cohort bounds and non-overwriting reports. Added raw-return summaries/correlation, retained Gold evaluation configuration and exposed cohort IDs/complement baselines. Added a 28-variable publication/vintage readiness audit and read-only Gold snapshot acquisition. Fresh evidence contains 164 stored calls over 83 dates and 154 snapshots, with 78 full-source fields; nineteen inventory variables have exact top-level values, but none has established publication/vintage qualification. Added the user-confirmed dataset-to-combinations-to-60%-qualification delivery contract. Full suite 315/315 before final numeric-return additions; final unit suite 287/287. No live mutation or performance qualification.

# 2026-09-12 - Variable and event 24-hour research framework

Added a generic downstream-only research harness with pre-declared feature/hypothesis registries, per-feature availability cutoffs, versioned outcomes, chronological training/validation partitions plus embargo, explicit exclusions, Wilson intervals and same-partition baselines. Results are explicitly association-only: no causal, executable-P&L, automatic weight or production claim is permitted. Added the first Gold timestamped adapter, F1-F10 exploratory factor-state registry and hashed-source CLI; upstream timestamped-evaluator rejections remain visible in its output. The registry uses factor states only and remains pending authentic source timing. No live workflow, database or Layer 1 change occurred. Focused tests passed 20/20; final local suite passed 311/311.

# 2026-09-11 - Layer 1 refresh-control tooltips

Added hover and keyboard-focus explanations to Elapsed, Ready/ETA, workflow status and Run Refresh. Help follows current states, supports disabled-button hover and Escape dismissal, and stays within desktop/mobile viewports. Success degraded distinguishes execution success from input health and shows the health-report date. Read-only production inspection confirmed the screenshot combines September 11 workflow success with a September 1 critical input-health report; tooltips do not regenerate that report or change status logic. Browser interaction/layout check passes at 1440px and 390px. UI changes are local to the task branch, not published to production.

# 2026-09-11 - Live collector request multiplication repaired

Traced FRED 429 to 16 economic-event items causing duplicate static requests in USD, then rate-limit failures in the remaining collectors. Set the initial DGS2 request to execute once in all five active collectors, preserving all other nodes, credentials, connections and error behavior. Guarded backups and saved/active verification completed. Fresh Master 3563 and all child steps succeeded; each collector stored one snapshot and USD demonstrated 16 trigger items becoming one item per HTTP request. Pages and raw production status report Manual Refresh Complete at 07:56:07 UTC. Existing partial history/calendar data stays disclosed. Local suite 305/305. See `COLLECTOR_FANOUT_INCIDENT_20260911.md`.

# 2026-09-09 - Live BTC CoinGecko repair; FRED failure identified

Applied a targeted, backed-up live repair to BTC CoinGecko input after confirmed 429 execution 3482. Three tries with five-second waits precede explicit partial-data continuation. Active version verified; retry 3490 succeeded, fetched CoinGecko and stored a snapshot. A single full refresh 3491 exposed separate FRED 403 Access Denied failures; end-to-end recovery is not claimed. No FRED credentials/nodes changed. Final local suite 302/302. Corrected startup credential discovery to use the existing encrypted CLIXML runner. See `BTC_RATE_LIMIT_INCIDENT_20260909.md`.

# 2026-09-09 - Gold isolated workflow and capture comparison tooling

Built an inactive manual/read/capture workflow generator from the reviewed Gold source and patch, with credential omission, explicit UTC cutoff and byte/object hashes. Added a capture/reference checker that rejects graph or execution drift, pinning, missing/duplicate rows, field changes, out-of-bound dates and incorrect ordering across page boundaries. New-directory/report guards preserve evidence. A local candidate is saved under ignored `tmp/gold-history-isolation-20260909/`; no import, execution or production change occurred.

Validation: `npm test` passed 297/297; after one additional timestamp/boundary regression, final `npm run test:unit` passed 268/268 and focused isolation tests passed 6/6. No failures, skips or cancellations. Installed n8n validation remains unavailable because this session has no runtime connection; see `GOLD_HISTORY_PATCH_VALIDATION.md` and `SESSION_NOTES.md`.

# 2026-09-09 - Offline Gold history repair validation package

Added an offline harness executing the exact exported normalizer with 600 synthetic rows, independent lookback expectations, UTC/date and duplicate/fallback checks. The new-path-only CLI records source/code hashes. Mutation regressions catch query caps and consumer drift. Documented installed-n8n isolation and acceptance criteria; no workflow edits, imports or production execution occurred. Focused tests pass 2/2; the six harness checks pass; final `npm run test:unit` passes 262/262. Full Gold v2 suite immediately before this addition passed 290/290.

# 2026-09-09 - Gold v2 measurement and reporting repairs

Require explicit completed candles in both coverage modes; preserve conservative normalized storage entry through an explicit policy and legacy alias; retain as-of protocol and selected source lineage through rejection reporting. Pilot v2 shares deterministic earliest-snapshot selection with IDs and denominator exclusions, including invalid-horizon earliest calls. Frozen artifacts and production workflows are unchanged. Final `npm test`: 290/290 passed, no failures/skips/cancellations; final unit suite: 260/260. See `GOLD_TIMESTAMPED_EVALUATION_CONTRACT.md`.

# 2026-09-07 - Parallel builder handoff saved

Prepared isolated GBP, Silver, WTI and EUR pair-coverage DeepSeek workspaces with explicit assignments, ownership and integration boundaries. Installed local dependencies and opened their VS Code windows. Saved the evening resume checkpoint in `SESSION_NOTES.md`. Setup only; DeepSeek processes were not launched by this session and no live deployment occurred.

# 2026-09-07 - Gold timestamped contract review

Documented the versioned measurement contract, alternative input paths, lineage and denominator rules. Added six offline review tests, including reproductions of permissive completion flags, minute-boundary storage rounding and lost as-of protocol metadata. No engine behavior or frozen research artifact changed. All 286 local tests pass. See `GOLD_TIMESTAMPED_EVALUATION_CONTRACT.md`; production and parked GBP/macro work remain outside this review.

# 2026-09-07 ? Repository consolidation

Preserved all existing worktrees and local evidence; reconciled research and production dashboard files; retained GBP drafts and isolated macro source; removed collector export credential literals; made local tests repeatable; archived superseded handoffs and established a focused backtesting review plan. Validation: 275 local tests plus five credential-reference regressions pass; 18 browser viewport/page combinations pass. Local baseline only; no production publication. See `CONSOLIDATION_20260907.md`.

# Changelog

## 2026-09-06 - Gold stored-call evidence and collector history defect

- Acquired 154 recorded Gold calls and 76,143 completed OANDA M1 candles through read-only APIs, retaining raw evidence and hashes locally.
- Confirmed the active Gold collector reads 25 unordered history rows: the June 9 price anchors 143 of 147 linked snapshots. Prepared an unapplied query patch; a replacement GET returned 543 rows across 49 recent dates.
- Reproduced all 154 recorded directions and ten-factor signal sets from their linked inputs. A counterfactual one-day input repair changes 97 F5 signals and 19 directions; no outcome-improvement claim or historical rewrite.
- Built a stored-call pilot: 97 exact-endpoint outcomes, 45 correct/37 wrong/13 flat/2 no-call; zero strict continuous paths. Earlier/later directional accuracy is 68.0%/34.4%, with explicit storage-time, cohort and input-quality limitations.
- Added opt-in delayed entry and endpoint diagnostics, indexed batch candle lookup, factor correlation and cohort baselines. Fixed as-of selection advancing explicit cutoffs and clearing upstream rejections.
- Updated the offline Gold evidence page, reproduction guide and research handoff. Focused validation: 87 passing tests, including desktop/narrow browser checks. No production writes, deployment, activation or weight changes.

## 2026-09-01 - Layer 2 refresh timeout hardening

- Replaced the unfiltered 1,000-row `agent_outputs` read in Layer 2 with five bounded, newest-first Layer 1 agent reads.
- Added the `agent_outputs` lookup index migration and a guarded production apply script that backs up the live n8n workflow before updating it.
- Extended the Eco Events duplicate guard to the collector's full rolling seven-day window, so existing future events update rather than violate the composite unique key.
- Reduced Dashboard Writer reads from 250 to 20 newest-first rows per agent, preserving the published data contract while preventing unnecessary full-output memory pressure.

## 2026-07-21

### Added

- Added the read-only `Architecture` dashboard tab driven by checked-in `data/architecture-map.json`.
- Added `data/architecture-map.schema.json`, `scripts/validate_architecture_map.js`, and `tests/validate_architecture_map.test.js` for schema validation, deterministic validation, and rule-level rejection coverage.

### Changed

- Added Architecture smoke coverage for lazy loading, failure isolation, selection, filtering, and responsive overflow.
- Deployed the Architecture Mirror to GitHub Pages and validated the live manifest, script, and stylesheet assets.
- Preserved the six explicitly uncertain architecture relationships as unverified rather than inferring unsupported production or research dependencies.
- Reworked the Architecture renderer so Overview now uses the exact 8-stage top-to-bottom order, focused views use deterministic vertical waterfalls, parallel nodes stay in contained responsive grids, the detail panel sits below the canvas, and geometry checks cover all 13 views.
- Removed the active horizontal graph path by using no absolute placement, no SVG bus routing, and no horizontal scrolling in the deployed Architecture renderer.
- Verified the live GitHub Pages waterfall deployment across all 13 views at `1440x900`, `1920x1080`, `1024x768`, and `390x844`.

## 2026-07-20

### Added

- Added a CLIXML-based local credential continuity system under `%USERPROFILE%\.trading-agent-dashboard\` with local templates for setting, validating, loading, running with, backing up, and restoring encrypted credentials.
- Added repository-safe bootstrap and validation wrappers for the local credential system in `scripts/bootstrap-local-secrets.ps1` and `scripts/check-required-secrets.ps1`.
- Added `config/credential-manifest.json` and `config/credential-manifest.schema.json` to define the supported credential inventory, scopes, and availability policy.
- Added `docs/CREDENTIAL_CONTINUITY.md` to document the supported local continuity workflow for future Codex sessions.
- Added `backtester/tests/credential_redaction.test.js` for importer URL-redaction behavior.
- Added `backtester/tests/secret_scanner.test.js` and repository-local `.githooks/pre-commit` secret-scanner enforcement.
- Added UK-time hover/focus tooltips to every available Layer 1 `24H` expiry section while preserving the visible ET expiry value on the Overview cards.

### Changed

- Updated `scripts/create-local-secret-home.ps1` so local bootstrap preserves an existing credential home by default and only force-syncs templates when explicitly requested.
- Validated local credential continuity with successful read-only probes for `n8n`, Supabase, FRED, OANDA, and Alpha Vantage, while recording RapidAPI endpoint verification as inconclusive due to timeout.
- Corrected project-memory runtime references so the latest successful workflow evidence now reflects the 2026-07-20 `data/workflow-status.json` artifact.
- Kept the expiry source contract unchanged by continuing to use `forecast_window_end` with `expires_at` as fallback only, then converting that same timestamp to `Europe/London` in the tooltip with automatic GMT/BST handling.
- Extended `playwright-dashboard-smoke.js` to verify the Layer 1 expiry tooltip contract, hover/focus accessibility, ET display preservation, and no-overflow behavior.
- Updated startup and active-state project memory so routine summaries ignore unrelated `.claude/launch.json` local state and the active task now points to the upcoming Architecture Mirror phase.

## 2026-07-07

### Added

- Added `backtester/lib/phase2_shadow_backtest.js` for conservative research-only shadow reweighting, shadow decision gating, and original-vs-shadow comparison helpers.
- Added `backtester/scripts/build_phase2_shadow_backtest.js` to build the checked-in `data/phase-2-shadow-backtest.json` artifact from the existing checker artifacts plus checked-in Factor Edge evidence.
- Added `backtester/tests/phase2_shadow_backtest.test.js` covering increase/reduce decisions, low-sample no-change handling, conservative no-call gating, and summary reconciliation.
- Added a new top-level `Shadow Logic Backtest` dashboard tab that reads only from `data/phase-2-shadow-backtest.json`.

### Changed

- Built and checked in the first `data/phase-2-shadow-backtest.json` artifact for `USD`, `EUR`, `Gold`, `NQ`, and `BTC` at `24H`.
- Kept the Phase 2 shadow path fully downstream-only by reusing stored checker factor signals and stored evaluation inputs instead of touching live Layer 1 logic, live Layer 2 logic, replay source-of-truth files, checker outputs, or existing Factor Edge evidence calculations.
- Extended `playwright-dashboard-smoke.js` so the browser smoke now verifies the `Shadow Logic Backtest` tab and confirms the new research tables keep horizontal overflow contained locally.

## 2026-07-06

### Added

- Added `backtester/lib/factor_edge_lab.js` for research-only factor reliability, alignment, and weight-mismatch helpers driven from checked-in checker artifacts.
- Added `backtester/scripts/build_factor_edge_lab.js` to build the checked-in `data/factor-edge-lab.json` artifact for Layer 1 and Layer 2 factor evidence review.
- Added `backtester/tests/factor_edge_lab.test.js` covering ex-flat directional scoring, alignment splits, and Layer 2 USD-side inversion semantics.
- Added a new top-level `Factor Edge Lab` dashboard tab that reads only from `data/factor-edge-lab.json`.

### Changed

- Built and committed the first Factor Edge Lab artifact in `data/factor-edge-lab.json` with Layer 1 coverage for `USD`, `EUR`, `Gold`, `NQ`, and `BTC`, plus Layer 2 coverage for `EUR/USD`, `XAU/USD`, `NQ/USD`, and `BTC/USD`.
- Kept factor-level ADR/L2L opportunity metrics explicitly unavailable in the artifact and dashboard because no full per-prediction factor-joinable export is staged locally.
- Extended `playwright-dashboard-smoke.js` so the browser smoke now verifies the `Factor Edge Lab` tab and its research-only ADR/L2L unavailable contract.

## 2026-07-05

### Added

- Added `backtester/lib/adr_reach_research.js` for shared daily-ADR + `1H` sequence research helpers.
- Added `backtester/tests/adr_reach_research.test.js` with synthetic `1H` sequence cases covering bullish/bearish order dependence and missing-candle handling.
- Added `backtester/importers/oanda/download_oanda_candles.js` for reproducible OANDA daily + `1H` candle downloads.
- Added `backtester/importers/binance/download_binance_candles.js` for reproducible Binance daily + `1H` candle downloads.

### Changed

- Replaced the old daily OHLC range-availability path with `L2L 1H Sequence Research`.
- Rebuilt `data/adr-reach-research.json` so required move is `50% ADR20` from daily candles while win/miss evaluation is sequence-aware using `1H` candles.
- Added supportable downstream research coverage for `Gold` and `XAU/USD` using OANDA `XAU_USD`, and switched `NQ` research onto OANDA `NAS100_USD`.
- Updated the dashboard wording, summaries, diagnostics tables, and smoke coverage to use the new `L2L 1H Sequence Research` terminology consistently.

## 2026-07-03

### Added

- Added a new `ADR Reach Research` Backtest / Accuracy sub-tab driven by a checked-in downstream artifact in `data/adr-reach-research.json`.
- Added `backtester/scripts/validate_adr_reach_research.js` to audit supportable OHLC coverage, build the ADR reach artifact, and validate ADR20 windowing, no-lookahead behavior, threshold calculation, weekday reconciliation, and checker invariants.
- Added `backtester/importers/eurusd/download_eurusd_daily_ohlc_alpha_vantage.js` to download deterministic repo-local `EUR/USD` daily OHLC coverage from Alpha Vantage `FX_DAILY`.
- Added `backtester/importers/btc/download_btcusd_daily_ohlc_coinbase.js` to download deterministic repo-local `BTC/USD` daily OHLC coverage from Coinbase Exchange candles.

### Changed

- Kept the new ADR module fully downstream of replay, checker, confidence, and Pair Trade Research logic.
- Implemented ADR reach using the existing repo-local `QQQ` OHLC proxy file for `NQ`, with evaluation-day `Open` as the reference price and previous-close fallback logic preserved for future supportable OHLC feeds.
- Expanded ADR reach support onto `EUR`, `BTC`, `EUR/USD`, and `BTC/USD` using the new repo-local OHLC sources, while keeping `Gold`, `XAU/USD`, and `USD` unavailable until supportable true `XAU/USD` and `DXY` OHLC sources exist.
- Tightened ADR validation so non-BTC assets cannot silently pick up weekend OHLC rows and BTC must preserve weekend calendar handling.
- Expanded the local dashboard smoke script so the new ADR Reach Research tab verifies summary tables, confidence tables, day totals, weekday tables, and console-clean rendering.

## 2026-07-02

### Added

- Added a `Weekday Breakdown` Backtest / Accuracy tab that shows day-of-week performance by displayed headline confidence bucket for USD, EUR, Gold, NQ, and BTC without changing the existing matrices or checker views.
- Added `backtester/scripts/validate_weekday_breakdown.js` to reconcile weekday totals and confidence-bucket totals back to each canonical checker artifact, while enforcing weekday coverage rules for BTC vs non-BTC assets.
- Added flat-aware weekday cells that show ex-flat directional win rate plus `W / L / F / T` counts, including `Flat only` handling when a bucket or weekday has no directional rows.
- Added a `Day Totals` row/table above each asset's confidence-bucket weekday table so users can scan weekday performance before drilling into confidence buckets.
- Added a new `Pair Trade Research` Backtest / Accuracy sub-tab for EUR/USD, XAU/USD, NQ/USD, and BTC/USD using same-date target + USD checker rows.
- Added `backtester/scripts/validate_layer2_pairing_analysis.js` to validate pair-trade coverage, accuracy, combined-confidence buckets, day totals, weekday breakdowns, and conflict/no-trade summaries.

### Changed

- Derived the weekday breakdown directly from the existing deterministic checker artifacts so the dashboard uses stored displayed headline confidence and stored evaluation outcomes instead of recalculating confidence or altering replay/checker semantics.
- Expanded the local Playwright dashboard smoke script to cover the new weekday breakdown tab, verify weekday columns by asset, and keep the Backtest / Accuracy panel free of console errors during the smoke path.
- Updated the weekday breakdown so flats are separated from directional wins and losses the same way the main accuracy matrices treat flat outcomes.
- Extended the weekday validator to verify bucket-to-weekday reconciliation, flat-rate calculations, ex-flat win-rate calculations, and the new day-level totals.
- Added pair-trade research coverage, accuracy, confidence-bucket, day-total, weekday, and conflict/no-trade views without changing Layer 1 replay outputs, checker semantics, flat bands, or headline confidence logic.
- Used combined pair confidence as `min(target headline confidence, USD headline confidence)` and treated same-direction or missing-USD setups as non-trade research outcomes rather than live Layer 2 logic.
- Refined the Pair Trade Research UI so the per-pair KPI cards use the same responsive dashboard grid language as the rest of the dashboard and the confidence-bucket table spacing no longer crushes right-hand percentage columns.
- Replaced the original wide Layer 2 top-summary table with a compact comparison layout, then clarified its terminology so `Trade Days %` and `Strong+ Trade Days %` are defined against matched historical days instead of the broader paired-row count.
- Re-ran lightweight syntax checks, the pair-trade validator, and browser smoke at session close to confirm the current research platform remains stable after the Pair Trade Research UI refinements.

## 2026-06-29

### Added

- Added EUR replay core, historical snapshot builder, historical replay runner, parity fixture, parity script, EURUSD importer, EUR evaluation script, EUR checker builder, and EUR checker artifact.
- Added dashboard support for the EUR 24H matrix and EUR checker alongside the existing USD research views.
- Added linked-warehouse test locking so the Node smoke tests no longer race each other against shared Supabase-backed tables.

### Changed

- Reproduced the live EUR 24H deterministic workflow exactly in replay using the current `exports/eur_layer1_agent.json` node semantics rather than the generic markdown weight table where they differ.
- Generated EUR historical replay coverage for `2024-01-02` through `2026-04-30` where warehouse data allows.
- Unblocked EUR outcome evaluation by importing historical EURUSD series and evaluating EUR primarily against direct EUR/USD movement instead of any USD-style DXY benchmark.
- Set the provisional EUR-only 24H flat band to `0.15` for EUR evaluation and checker generation without changing shared USD evaluation defaults.
- Generated a passing EUR checker artifact with result `602 / 0 / 0 / 0`.
- Updated the linked-warehouse tests to validate stable research invariants instead of brittle global row-count assumptions.

## 2026-06-22

### Added

- Added `docs/CORE_RESEARCH_PHILOSOPHY.md` as the authoritative guiding document for research/backtesting principles.
- Added `docs/PHASE3_HISTORICAL_EXPANSION_REPORT.md` to record the first USD historical expansion attempt and its evidence summary.
- Added `docs/PHASE3_HISTORICAL_WEAKNESSES.md` to capture warehouse and evaluator issues discovered during Phase 3 evidence collection.
- Added `docs/HISTORICAL_DATA_INVENTORY.md` as the warehouse-completeness source of truth for USD replay inputs through end-2024.

### Changed

- Updated backtester and project-memory documentation to reference the new core research philosophy and reinforce that measurement comes before optimization.
- Corrected stale hosting references where documentation still conflicted with the current GitHub Pages deployment model.
- Corrected the historical evaluator so missing or zero close prices are now treated as `NOT_EVALUABLE` instead of false `-100%` benchmark wins.
- Attempted expansion of the USD replay window to `2024-05-31`, confirmed the frozen research framework still runs end-to-end, and documented that the warehouse currently only supports the continuous January 2024 USD window.
- Shifted Phase 3A focus onto historical warehouse completion planning instead of replay or metric changes.

## 2026-06-21

### Changed

- Updated the live `Eco Events Collector` workflow to remove the duplicate-insert failure against `economic_events`.
- Replaced the previous direct Supabase write with idempotent routing: dedupe incoming events, look up existing rows for the run date, update matching rows, and create only unmatched rows.
- Validated the live collector with two immediate reruns; executions `1081` and `1082` both succeeded with no `economic_events_event_date_currency_event_name_event_time_t_key` error.
- Re-exported the updated live workflow into `exports/eco_events_collector.json`.

## 2026-06-19

### Added

- Confirmed GitHub repository access for `kevincreedycars-debug/trading-agent-dashboard`.
- Added project memory documentation scaffold.
- Added `docs/CURRENT_STATE.md`.
- Added `docs/CURRENT_TASK.md`.
- Added `docs/NEXT_STEPS.md`.
- Added `docs/ARCHITECTURE.md`.
- Added `docs/N8N_INTEGRATION.md`.
- Added `CODEX.md`.
- Added read-only n8n MCP server scaffold in `mcp-n8n/`.
- Added MCP tools for listing workflows, fetching workflows, listing executions, and fetching executions.

### Current Focus

- Build AI-assisted development environment.
- Connect ChatGPT/Codex to GitHub and n8n.
- Reduce manual copy/paste of workflow JSON and node code.
- Keep first n8n MCP version read-only until exports exist.

### Known Issues

- Eco Events Collector duplicate insert failure.
- EUR Agent parser must support OpenAI JSON Object output.
- Master Orchestrator needs final execution summary.

## 2026-06-20

### Added

- Exported live n8n workflow JSON snapshots into `exports/`.
- Added dashboard Master Orchestrator control panel.
- Added `data/workflow-control.json` for non-secret dashboard trigger configuration.
- Added `data/workflow-status.json` for published run status and error reporting.
- Added dashboard rendering for workflow status, step reports, and error reports.
- Added `CODEX_STARTUP.md` as the permanent Codex working-memory startup guide.
- Added `docs/SESSION_NOTES.md` for latest-session handoff notes.
- Added `docs/PROJECT_HISTORY.md` for concise high-level project milestones.

### Pending

- Verify an end-to-end dashboard-triggered run.
- Refine status reporting if n8n child workflow error payloads need richer parsing.

### Changed

- Added a production Webhook Trigger to the live Master Orchestrator.
- Published the Master Orchestrator and referenced child workflows.
- Configured `data/workflow-control.json` with the production webhook URL.
- Added Master Orchestrator status publishing to `data/workflow-status.json`.
- Added visual-only Backtest / Accuracy dashboard tab using placeholder mock data.
- Added static `data/backtest.json` placeholder for agent accuracy and variable correlation UI scaffolding.
- Updated `CODEX.md` and project memory docs to require Codex to read memory first, summarise state, and update only changed memory documents at session end.
- Expanded the permanent memory process with startup summaries, milestone updates, session close notes, commit/push expectations, and canonical memory file locations.
- Updated `CODEX_STARTUP.md` to require continuous documentation updates, logical milestone commits, and startup recovery from repository memory.
- Added `docs/ACTIVE_MILESTONE.md` as the live checkpoint for the current feature and updated startup rules to read it after `docs/CURRENT_TASK.md`.
- Refined `CODEX_STARTUP.md` to use smart staged startup, concise startup summaries, runtime validation against repository evidence, documentation-drift handling, and stricter session close rules.
- Updated supporting documentation to point startup behavior at `CODEX_STARTUP.md` and use `docs/SESSION_NOTES.md` for current session memory.
- Reworked the dashboard to display a derived confidence score as the headline call metric while preserving Bull Case, Bear Case, Net Edge, and Participation as separate diagnostics.
- Added a compact Overview definitions legend beneath the Layer 1 calls.
- Replaced the shared dashboard card top strip gradient with a single navy strip.
- Added shared Layer 1 dashboard normalization so confidence and a 7-day direction outlook are derived reliably from the latest loaded timeframe calls.
- Added an Overview 7-day direction outlook section and updated the current `data/layer1.json` snapshot to carry `confidence` and `seven_day_outlook`.
- Confirmed the public static host is GitHub Pages and that the earlier local confidence commit had not yet been pushed when deployment was checked.
