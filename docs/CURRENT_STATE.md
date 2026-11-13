2026-11-13 (late), the deviation sequence proved on both deployed loops and the reclaim branch prepared for review, not deployed (live-trading lane), prepended without changing the state below: the owner's sentence of 2026-11-13 - at a fixed level of 100, `102 -> 99 -> 98 -> 101` leaves one buy limit at 100, `99 -> 98 -> 101` with no earlier close above leaves no order, the bearish case mirrors it, several closes beyond are still one reclaim, and a wick, a close on the line, a return across a different level or a replay of the same confirming candle leaves nothing - was run through each deployed loop's own decision path, read-only on the host at 18:45Z: lane 1 is `c5abd0ac` whose trader on disk is `f20582b4`'s file of 2026-11-05, 283 lines from the pin's own `164eb0d4` (so its checkout is not at its pin), beside the pin's module, which has no `crossedSince`, lane 2 is `f14f2ac7` whose trader and module are `origin/main`'s own blobs, and the four files were extracted from those commits with CRLF and re-hashed against the host's readings before a line was run. Result, eleven runs of closes read twice each: ftmo-1 14 of 22 rows, ftmo-2 16 of 22 - both place on a first approach and on a touch that never left the line, and lane 1 also puts a level back on a close exactly on the line and on the confirming bar it has already spent, because its put-back path reads no candle. The reclaim fix already in `main` (`crossedSince` and the two-close gate) answers everything but the first approach and the touch and is reused untouched; branch `live-trading/deviation-audit-20261113` adds `levelWasLeft` - a close that held the level on the trade's side, a close that left it on the far side by at least one point of the instrument's grid, the newest completed close back across it, all on one symbol and in one Europe/Prague session, wicks ignored - consulted by both the fresh path and the gate when a lane names `--require-deviation`, plus lane 1's `--reentry-crossing`, after which both lanes are 22 of 22 and `tests/live_trading_deviation_sequence.test.js` is 67 of 67 (40 of 67 with the module reverted). Lane 1's 40 repeat placements, reconciled against the account's 58 closed positions over the 14-day window: 38 new exposure after an exit, 1 replacement of a withdrawn unfilled limit (EURUSD `307022408` -> `307216030`), 1 the record cannot resolve (XAUUSD `306701928`: no deal, no withdrawal row, and a second sell limit at the same price five minutes later), and all 40 carrying the predecessor's own confirming bar. The disputed EURUSD `1.10624` put-back at `13:46Z` is a genuine post-exit reclaim that lane 2's newest-pair gate refuses while lane 1 placed it - flagged as a ruling for the owner, as is lane 2's midpoint population of levels. Full `npm test` 943 with 930 passing, 4 skipped and 9 browser-page failures that fail the same way with `origin/main`'s module and trader put back in place and whose failing set differs between two runs of identical bytes. Neither deployed trader parses `--require-deviation` yet - an unparsed token is a `UsageError` raised before any read - so each lane needs this branch's trader and module placed beside its data before the flags can be named; the decision table and both command lines are section 6 of the audit note. Read-only on both machines: no order, no config, no workflow, no publisher, no data file; the branch is the only change and it is unmerged. Evidence and the before/after table: `docs/live-trading/L2L_DEVIATION_AUDIT_20261113.md`.

2026-11-13 (evening), both corner strips name the model and state one of three words (dashboard only), prepended without changing the state below: the two lamps under the nav now lead with the model's name - `Live L2L Directional`, `Live 0.5L2L Directional`, page-owned constants in `script.js`, never read from a file a publisher rewrites - and say exactly one of `Active`, `Stale`, `Paused` beside it, with the reason (the silence, the parked row, the unreadable document, the unarmed loop) kept on the tooltip and in the detail words that follow. One rule, `liveTradingLaneWord()`, now decides the word for both the lane card and its selector pill, so the two cannot disagree: Paused is a row parked in `config/live-trading-lanes.json`, Active is a snapshot plus a heartbeat from a run inside its window, Stale is everything else. `.live-trader-status` deliberately carries no `text-transform`, so the name keeps the casing it is written in. Corrected on the way through, and the reason the two places had disagreed: the widget behind the second strip dated the heartbeat against the browser's own clock, which dates the publishing commit rather than the run, so whenever the last publish was more than fifteen minutes old it read `Stale` while the lane's own card read `Active`; it now dates the record at the lanes document's `generated_at_utc` and keeps the strip's sixty-minute copy ceiling, and it says `no run for 35m` and `no publish for 1h 30m` apart as the accounts strip does. Shipped on `main` as `4f871da8` (`ea800a1d`, `cbdd6ebe`, `ab6954c6`, `54f95634`, `4f871da8`), branch `dashboard/strip-names-20261113`, cache-buster `20261113-lane-state-clock`. Live read-back from `https://kevincreedycars-debug.github.io/trading-agent-dashboard/` at 18:30Z on the published page itself, not on a local serve: strip one `Live L2L Directional · Active - ftmo-1 nothing to place - as of 18:16Z` in the live tone, strip two `Live 0.5L2L Directional · Active` with `Armed - Last trader tick 2026-11-13 18:16:32 UTC · Result: nothing to place · Open positions: 1 · Working orders: 0` on its tooltip, both lane cards and both selector pills `Active` with the model names, neither strip hidden, no page error, and both refresh selections read the same four labels; the four served files are the commit's bytes (LF) - `index.html` 31,427, `script.js` 1,113,518, `styles.css` 286,942, `lib/ftmo2_status_widget.js` 5,135. Guards: the lamp's own file 8 of 8 (the second strip's test now writes the heartbeat and the lanes document for each of four cases, so neither clock hides behind a fixture), accounts 6 of 6, lane selector and lane status 11 of 11, the live-trading subset 383 of 385, full `npm test` 867 of 876 with 5 failures that fail identically in a worktree held at `origin/main`'s `843317ba` with the same `node_modules` (`site_nav_consistency` 2, `live_trading_chart_pan` 1, `live_trading_chart_zoom` 1, `tests/research_library.browser.test.js` 1), so they are this machine's state and not this change. Nothing about trading moved: no lanes file semantics, no config, no workflow, no order, no deployment of either trader. Evidence, screenshots included: the ignored `.local/evidence/lane-strips-20261113/` (`readback/` for the local serve, `live/` for the published page). Still untouched and separate: the full deviation-sequence proof on both deployed traders and the FTMO 1 execution change for review.


2026-11-07 (evening), the smaller deploy proved and the lock behind it named (live-trading lane + Pages), prepended without changing the objective below: `main`'s published tree is now 593 files and 23.7MB, and its first real deploy went green - run `42387854929` at 15:44Z, no `syncing_files` timeout - only after the actual blocker was cleared. That blocker was not size: the last 80.4MB deploy (`42385129621`, `fd691249`, 15:11Z) timed out at 15:21:49 and left its Pages deployment `in progress`, so the freeze push (`42386460553`) and the next publish (`42386752291`) were each refused in about twenty seconds with `400 ... due to in progress deployment. Please cancel fd691249... first`. The stall was cancelled with `POST /repos/kevincreedycars-debug/trading-agent-dashboard/pages/deployments/<build-version sha>/cancel` (the numeric deployment id answers 404 at that path, the sha answers 204) and one empty commit, `7cde014a`, re-asked for the deploy. Live read-back after the green deploy: the five checker raw URLs on `frozen/backtester-checker-20261107` all `200`, the sub-tab drew 15 tables and 3,399 rows, and the USD panel read `ROWS CHECKED 604 PASS 604 ... 0 FAIL`, so freezing the corpora cost the checker nothing. What remains in the 23.7MB is the dashboard's own documents - largest `data/factor-edge-lab.json` 4.6MB, 19% of the tree and read by one lab page - and that is the only next candidate, and only if a timeout returns at this size. Evidence and the retry recipe: `docs/live-trading/DAILY_ALERT_EMAILS_20261107.md` section 3. Still open: several publish cycles of green runs, not one.


2026-11-07 (later), the published tree cut by 70% (live-trading lane + Pages), prepended without changing the objective below: the owner asked why a site of 80.4MB is republished whole to carry one changed data file, and why the unused Backtest Checker was shipping at all. The answers are one fact and one file set. Pages here is legacy branch publishing - `build_type: legacy`, source `main` at `/`, `.nojekyll` in the tree - so git sends only the changed files (the publisher's commit carries one snapshot document) and GitHub then builds the branch and deploys a fresh snapshot of the entire tree: 80.4MB synced per push, on a 1200s cycle, against a ten-minute deploy cap. `actions/deploy-pages` would not change that arithmetic, so the lever is the size of the tree or the cadence of pushing it. The five `data/backtester-checker-*` corpora were 59,453,494 bytes - 70.5% of the tree - and are read by exactly one place, the Backtest Checker sub-tab (`index.html`, `data-backtest-tab="checker"`), which is not in use, so they are frozen on an orphan branch `frozen/backtester-checker-20261107` whose tree is those five files and nothing else, and `main` goes from 597 files and 84,316,485 bytes to 592 files and 24,862,991 bytes. The sub-tab still works in one click: `script.js`'s five `checkerDataUrls` point at `raw.githubusercontent.com` on that branch, which serves them with `Access-Control-Allow-Origin: *`, and each was read back before the change at `200` and its exact committed byte count (20,830,766 / 13,587,160 / 8,784,728 / 8,472,623 / 7,778,217); a failed read degrades the way it already did, into an empty table. Local work that reads them from disk gets `npm run checker:corpus`, which fills the ignored `.local/checker-corpus`, and `backtester/tests/confidence_calibration.test.js` now looks there first, then at `data/`, and otherwise skips its four corpus cases with the reason and that command. Guards: full `npm test` 779 tests, 776 pass, 3 fail - the three are two live-trading browser cases and `tests/research_library.browser.test.js`, and all three fail identically in a second worktree held at `origin/main`'s `d5aa8b16` with the same `node_modules`, so they are this machine's browser state; the four calibration cases pass 4/4 with the corpus cached and skip without it, and both states were run. Still open: whether the smaller tree clears GitHub's `syncing_files` timeouts - that is evidence after several publish cycles, not one green deploy - and the two levers this repository does not hold, the host's publish cadence and owning the deployment. Full evidence in `docs/live-trading/DAILY_ALERT_EMAILS_20261107.md`, section 3.

2026-11-07, the daily failure email (live-trading lane), prepended without changing the objective below: two workflows were mailing a failure a day and only one of them was the pipeline. `live-trading-monitor` was failing correctly by its own rule and wrongly in fact: `scripts/check-live-trading-publication.js` judged the served snapshot against the snapshot's own `stale_after_seconds` (900s, the page's badge) while the publisher serves a new copy on a 1200s cycle - the publish commits on `main` are 1200s apart at a fixed offset (`09:30:57`, `09:50:57`, `10:10:57`) - so any run landing in the back half of a cycle was a guaranteed red run. The five most recent failures carried snapshot/heartbeat ages of 815s/1044s, 888s/1118s, 1004s/1233s, 1375s/1604s and 1084s/1312s, none of them a stopped publisher (the lanes-document ages, 780s to 1340s, say publication was running) and the same lanes were green twenty minutes later. The checker now judges the served copy against the allowance it is given, defaulting to 1800s for both the snapshot and the heartbeat - the 1200s cycle, one 300s bar, a margin - reports the badge's own window separately as `declared_window_seconds` beside `window_seconds`, and notes a copy that is past the badge but inside the cycle instead of failing it. Exit 0/1/2, identity matching, a declared heartbeat that is not published and a real silence all still fail, and the workflow's header and step summary now state the allowances rather than inheriting a number from the page. Guards: `tests/live_trading_publication_monitor.test.js` 10/10 including a new case that fails on the old script, `tests/live_trading_monitor_workflow.test.js` 3/3, and a live read of the published URLs returns exit 0 reporting `snapshot 524s of 1800s (badge 900s)` with a 753s heartbeat, and the first dispatched run of the fixed workflow, `42380866849` at `14:17:09Z`, came back green carrying `feed age 409s of 1800s (badge 900s)` and `heartbeat 638s`. Deliberately not changed: the host's task cadence and the 600s publish gate, which are the reason the cycle is 1200s rather than 600s, because that is a VPS change and wants its own evidence. Still open: `pages build and deployment` fails on GitHub's deploy step and not on content - 13 of the last hundred runs went red, as 9 `syncing_files` timeouts, 3 `in progress deployment` refusals that are the tail of a timed-out deployment, and 1 `Deployment failed, try again later`, each beside a successful run of the same content, on a workflow this repository cannot edit or retry; the levers are a smaller published tree, a slower cadence, or owning the deployment, and the last of the three needs a Pages setting only the owner can change. Full evidence in `docs/live-trading/DAILY_ALERT_EMAILS_20261107.md`.


2026-11-05, the trail on the host and the daily slot on the clock (live-trading lane + interactive coordinator), prepended without changing the objective below: the owner's question was why the deployment and the daily check kept landing on them, and the answer was that this PC holds a key-only SSH door to the host (`D:\trading-agent-dashboard-codex\.local\vps-access\id_ed25519`, `Administrator@158.220.87.240`, firewall narrowed to one source), so both were driven from here. **The 3R trail is now running:** `C:\live-trading\runtime` was pinned at `c5abd0ac` from 2026-11-02 and its trader script predated the trail entirely, so the change never had a chance to work; the one-file copy the deployment model expects was made from the object store (`git -C C:\live-trading\runtime checkout origin/main -- scripts/run-live-trading-trader.js`, then `git reset` on that path, old file backed up to `C:\live-trading\logs\run-live-trading-trader.js.bak-20261105094506`), the blob hash now equals `origin/main`'s, `node --check` passes, `lib/` and the feed publisher are byte-identical between the old pin and `main`, and the 09:46:30Z and 09:51:30Z ticks wrote `nothing_to_place` / `armed` / zero positions with `LastTaskResult` 0. The trail itself is still unproved: it needs a position to cross 3R, and the account was flat until a ticket was placed at 21:31:30Z, so the first live move is now possible and unobserved. **The daily slot is now the versioned one:** `LiveTradingRefresh0600` had never been replaced because `scripts/register-orchestrator-refresh-task.ps1` opened `if ($Test) {` and never closed it, so the action, the SYSTEM principal and the `Register-ScheduledTask` call all sat inside the dry-run branch - `-Test` worked, `-Show` printed nothing, and a plain run exited 0 having registered nothing. The brace is closed (AST: guard 62-68, call at 111 outside it), `tests/orchestrator_refresh_register.test.js` holds the statement tree, `-Show` and the dry pass apart (focused script 9 of 9), and the fix is `0dd3d958`. The task is registered on the host with `-NoStart` (a start would have spent a run on a day already green at 06:06:54Z) as SYSTEM/ServiceAccount/Highest, daily 06:00, `StartWhenAvailable`, `IgnoreNew`, 61-minute limit, `next = 2026-11-06T06:00:00Z`, and the SYSTEM context was proved by a temporary task running the slot with `-WhatIf` into `refresh-system-probe.log`, then removed. Not proved: the first real 06:00 run under the new task, and the trail on a live position. **The heartbeat now states the code it ran:** after the owner asked for a daily check that does not rest on a file's mtime, the trader's status document carries a `code` block - the file, a sha256 of the bytes on that host's disk, the file's `git_blob` (the value `git rev-parse origin/main:scripts/run-live-trading-trader.js` states from any checkout) and the checkout's short HEAD as a label - and `scripts/check-live-trading-publication.js`, the monitor a check runs, prints the blob per lane (`f20582b4`; the heartbeat at 21:46:30Z states `sha256 = b6422a72...`, `git_blob = f43ac5ea...` equal to `origin/main`'s, and `checkout_head = c5abd0ac`, the drift it exists to show). The identity is taken when the module loads rather than when the heartbeat is written, because the first live tick proved the lazy shape would name a copy that landed while the run waited. Compare blobs, not sha256s: git normalises a tracked file's line endings and a Windows checkout does not, so the same version digests differently on a disk. Each account card on the page now states it as well: a `Trader code` row carrying the head of the blob, with both whole digests and the checkout label in its tooltip, and the lanes document carries the block beside the artifact so the card can name the version even when the artifact itself cannot be read. Open elsewhere: `Retry On Fail` on the orchestrator's `USD Collector` node in n8n. Detail in `docs/live-trading/CONVERSATION_NOTES.md` (2026-11-05) and `docs/live-trading/ORCHESTRATOR_DAILY_TRIGGER.md` §12-13.


2026-11-04, the stop's second rung (live-trading lane), prepended without changing the objective below: the owner asked for the stop that was taken to break-even at 2R to become a trailing stop once a trade crosses 3R, and that is now what `scripts/run-live-trading-trader.js` does. `BREAKEVEN_R_MULTIPLE = 2` is unchanged, `TRAIL_FROM_R_MULTIPLE = 3` and `TRAIL_BEHIND_R = 3` are new, the review that was `breakevenReview` is `stopReview`, and the run record that was `record.breakeven` is `record.stops`: from three times the risk the trade was placed with, the stop follows the market and stays the trade's own risk behind the furthest price the trade has reached since it was placed - the level is the entry exactly at 3R (where the breakeven rung has already put the stop), entry + 1R at 4R, entry + 1.25R at 4.25R - only ever forward compared with the stop the position already carries and never at or past the target. `TRAIL_BEHIND_R` began as 1 in the committed version of this lane and the owner corrected it the same day to the trade's own risk, so the level is now the extreme minus three times the placement's risk rather than a step down from a whole-R rung, and what a turn gives back is that full risk - though the owner also settled the give-back reading the same day (*"once it hits the 5R target the trade closes as the TP is hit"*), so the trail never ends a run at its best price: the target is five times the risk, the stop the trail holds as it is touched is just under entry + 2R, and the target is what answers the trade. The furthest price is read by a new `marketExtreme` - the snapshot's quote plus the M5 extremes from the bar the ticket was placed in onwards, the same reading the target uses - and the level is written on the symbol's own digits by a new `priceOnDigits`, so no stop is rounded to a scale the terminal would read as somewhere else; a snapshot stating neither digits nor a point produces no move. Every move row now carries `rung` (`breakeven` or `trail`), `best_price` and `at_r`, and a row written before this change carries no rung and is read as the breakeven move, so existing state files keep working. The dashboard's Live trade logic tab was amended with the loop - its stop step, its one-sentence summary and the endings tag - and `index.html` bumps to `script.js?v=20261104-trail-three-r`. Guards: `tests/live_trading_trader.test.js` 71 of 71, `tests/live_trade_logic_tab.browser.test.js` 5 of 5, unit suite 678 of 678. Not proved: no live trade has been trailed yet, no backtest was re-run for the 3R start or the 3R distance (both are the owner's instruction rather than a measured edge), and the order tool still refuses a level inside the symbol's `trade_stops_level`, which the loop reads as a refusal and asks again on the next run. Nothing scheduled, no workflow, no n8n flow and no order tool was touched. Detail in `docs/live-trading/STRATEGY_LIVE.md` §59 and `docs/live-trading/CONVERSATION_NOTES.md`.

2026-11-04, the daily Layer 1 slot (interactive coordinator), prepended without changing the objective below: the 06:00 UTC slot on the host did fire, and its run failed at `USD Collector` with `Bad gateway - the service failed to handle your request` (`data/workflow-status.json` as committed at `ea27ad7c`, 06:06:37Z, the other fourteen steps success), so `layer1.json` was republished at 06:06:35Z carrying the previous day's USD direction and stayed that way until a hand press at 07:44:16Z (`4cdf333b`, then `50b2608e`). Two records had been read as evidence of something they cannot show, and neither can: `triggered_by` in that status file is the constant `dashboard_or_manual`, typed into the flow's own Code node, so a host-triggered run is indistinguishable from a press; and a scheduled slot of `master-orchestrator-daily` that skips concludes green under the title `orchestrator daily live`, which the duplicate guard counted as the day's run, so the first slot of each New York day (always a slot before 07:00) spent the day and no scheduled slot ever called the webhook - runs 40203054555 .. 41753003767 all show "Call the webhook" skipped, and GitHub delivered three or four of the twenty-four hourly slots per day. Now: `scripts/trigger-orchestrator-refresh.ps1` is the slot as a versioned script (obey `data/workflow-control.json`, POST the webhook, wait for the status stamp to move, read `status` and `failed_step`, retry up to three times, exit 0 only on a successful run, one JSON line per attempt) with `scripts/register-orchestrator-refresh-task.ps1` to register `LiveTradingRefresh0600` daily at 06:00 in the host's clock as SYSTEM, and the workflow's duplicate guard reads `data/workflow-status.json` instead of run titles, so a failed run leaves the day free for the 07:07-10:07 New York slots to retry inside the same morning. Guards: `npm run test:orchestrator-schedule` 9 of 9 (five of them run the slot against a local listener: failure then success, exhausted attempts exit 1, a 502 to the POST retried, `-WhatIf` posts nothing, an off switch refused), unit suite 677 of 677, and a live `dry_run` dispatch on `main` (`41806994822`) printing `status_file_run_started_at=2026-11-04T07:44:17.978Z status_file_run_status=success ran_today=true` and `decision=skip (today already has a successful run of this job, so a second call would be a duplicate)`. Deployed on `main` as `bcfa415a`. Open: the host still runs the old unversioned `C:\live-trading\logs\trigger-refresh-0600.ps1` and the new task has not been registered there, because the host key is not on the machine this was written from; the 502 itself is untouched, since the next fix is `Retry On Fail` on the orchestrator's `USD Collector` node in n8n, where the export in this repository is a snapshot and not a deployment; and no automatic retry has been observed yet. Detail in `docs/live-trading/ORCHESTRATOR_DAILY_TRIGGER.md`.


2026-11-03, USD research programme resumed at `live.f1-vix-level` (stage 2 open), prepended without changing the objective below: the owner resumed this chain rather than opening a new one or repeating stage 1, so stage 1 research stays as delivered (`d7b8eb40-ce08-48c3-9d2c-5bf94b7618bc`, `VIX_USD_Research_Report.md`, 84,056 bytes, sha256 `e4151937411eb1e9235c21e4942327b2d24486e405887d70a90a8f5367eb381d`), stage 2 red-team is being produced by the owner in ChatGPT, and stage 3 adjudication is next. The live store holds that one row and no stage 2 or 3 record on this chain, and replaying the chain through the page's own library code over those rows shows stage 1 delivered, stage 2 awaiting upload with its parent already fixed, and stage 3 not started; simulated stage-2 and stage-3 rows take the chain to 2/3 and then to complete 3/3, with the stage-3 card naming both the research report and the red-team review as its inputs. The incoming file therefore needs nothing but an upload on this chain's stage 2 through the published page, with no sign-in, no code change, no deploy and no catalogue rebuild; the register's status columns are hard-coded in `scripts/build_research_library.js`, so recording the review there remains a deliberate later edit. Next eligible factor after this chain's adjudication registers is `risk.vix-level-and-change-at-cutoff`, next in catalogue order at 0/3. Guards: `research-library:check` clean, `test:research-library` 42 of 42. Nothing live moved: no workflow, feed, credential, dispatcher, factor status, weight or threshold was touched, and automated research execution stays locked until subscription-only billing is enforceable. Detail in `docs/SESSION_NOTES.md` and `docs/CURRENT_TASK.md`.

2026-10-24, hosted final chain (interactive coordinator), prepended without changing the objective below: the asset-level final chain registers in the private store, so the research lane no longer has a step that needs this PC. The final-chain upload is not held back for a local service, the Register button stays enabled for a signed-in member, and the factor input package the stage judged is carried in the hosted `notes` column behind `research-input-package:v1` and restored per version, so a final return can be read against the evidence it actually judged. The page now reads the whole store once per signed-in session, which is what lets the factor chains and the final gate see stored adjudications without each chain being opened first. The final chain remains `locked` at `0/25`: the gate reads evidence, and no factor status, weight, threshold, sign, live call, workflow, feed or committed hash moved. Guards: upload client 12/12, adapter 12/12, `test:research-library` 36/36 including the browser test, `research-library:check` unchanged; full `npm test` 612/614 with two live-trading browser failures that also fail with this work stashed. Open: the owner's real email and a fresh password in place of the placeholder `research-library@example.com`, then a hosted final-chain run once the gate opens.

2026-10-24, storage and phone handoff (interactive coordinator), prepended without changing the objective below: the storage and mobile questions are answered from the live store and the published page rather than from memory. Uploaded bytes live only in the private Supabase bucket `research-documents` of project `eaolqbrlywczinfordvg`, their metadata in `public.research_documents`, and membership in `public.research_members`; GitHub carries the page, the provisioning script, the prompts and the registry metadata (id, version, sha256, bytes, note) and never the bytes. No upload, download, stage update or parent retrieval depends on this PC: the page holds a publishable key and the reader's own session, and with nothing listening on `127.0.0.1:8791` a scripted phone-sized run of the published page signed in, uploaded one Markdown file into `usd-factor-live-f8-fed-bias` stage 1, saw the pill go Uploaded, saw it stay UPLOADED with the same record id after a reload and without a second sign-in, read stage 2's parent, downloaded that parent byte-for-byte, opened View, saved Download, made no loopback request and raised no page error; the desktop-width run reported the same. Both runs deleted their row, object and disposable member afterwards, so the store again holds one member (the owner), one document (the real VIX report `d7b8eb40-ce08-48c3-9d2c-5bf94b7618bc`, v1 of stage 1, sha256 `e4151937…`, 84,056 bytes) and one object. The project's email provider is the only sign-in; there is no GitHub or Google sign-in, and the remembered session is already the behaviour. `scripts/research_library_page_check.js` (`npm run research-library:page-check[:mobile]`, `--provision`, `--keep-rows`) is the committed runbook engine and `scripts/research_library_export.js` (`npm run research-library:export`) writes every document plus a re-hashed manifest under the ignored `.local/research-library-export/`; both are documented in `docs/research-library/PAGE_CHECK_RUNBOOK.md`. Guards: new export test 6/6, library 29/29, upload client 9/9, adapter 9/9, library browser 1/1. No factor status, weight, threshold, sign, live call, workflow, feed or committed hash moved. Open: the owner uploads the completed VIX red-team file through stage 2 of `usd-factor-live-f1-vix-level` from the phone; the final asset-level chain still needs the local service and is gated anyway.

2026-10-24, live upload repair (interactive coordinator), prepended without changing the objective below: choosing a file on the published dashboard is now the whole upload, and the stage it fills reads Uploaded on the page itself rather than only after a reopen. The form used to demand a model or session label and refused the file without it, the account block offered an email link that could never arrive, and the session was read from an access token that silently expired after an hour, so a reader who had signed in earlier saw a refusal that looked like "the upload does not work". The field is gone, the link is gone, the block signs in with the owner's email and password and remembers only the address, and every request now swaps the stored refresh token for a fresh access token first, asking for the password again only when that refresh token is itself refused; a duplicate 409 from the store is read as the file already being there, so a retry finishes registration instead of failing. Stage cards read **Uploaded** instead of Delivered, carry the upload time next to the file name, hash and version, and expose `data-rl-view` alongside the download control, so View opens the stored bytes in a new tab and Download saves the same bytes under the uploaded name. The optional local library service is still described as optional and no longer points a signed-in reader at a loopback address. Cache-busters are `20261024-research-library-v5`, `20261024-research-upload-v3` and `20261024-research-upload-hosted-v8`. Guards: library unit 29/29, upload client 9/9, adapter 9/9, library browser 1/1 (asserting three View controls, adjudication disabled and research enabled), full `npm test` 600/602 with the same two live-trading browser failures reproduced unchanged on a pristine `origin/main` checkout. Deployed on `main` as `32489f9b` on top of the live-feed snapshot `470eb344`; the published `index.html` serves the three new bundles. Live check at `https://kevincreedycars-debug.github.io/trading-agent-dashboard/` on `usd-factor-live-f8-fed-bias` stage 1, signed in fresh from the account block: the open form held one input (`file`) and no model field, the stage pill went from Not started to Uploaded about 1.3 seconds after the click, the page said the file was stored as stage 1 version 1 and asked the reader to use View or Download, a reload kept it as UPLOADED with the record id, `v1`, `sha256 f8df3674f6df`, the file name, `uploaded 24 Oct 2026, 15:28:25` and the private-store note, View opened those bytes in a new tab, Download saved 286 bytes identical to the chosen file under its own name, and nothing pointed at a loopback address. The check's rows and objects for that chain and for the earlier scratch topic were deleted afterwards, and the disposable check account was removed from `public.research_members` and from auth, so the private store holds one member (the owner), one document (the real VIX research report, `d7b8eb40-…`, v1 of stage 1, `e4151937…`) and one object. No factor status, weight, threshold, sign, live call, workflow or feed moved, and the committed registry and its hashes are untouched. Next: the owner uploads the completed VIX red-team file through stage 2 of `usd-factor-live-f1-vix-level` on the published page.


2026-10-20, hosted-upload completion (interactive coordinator), prepended without changing the objective below: the live page no longer needs a loopback service to register a research document. The private store in `eaolqbrlywczinfordvg` is provisioned and membership-gated, the page carries an account block that signs in with an email and password (or an email link), a signed-in reader uploads a factor-chain stage straight to it, and the chain's hosted rows are merged when the chain opens so a reload still shows the stage as delivered with the file name, version, hash and private-store note. Downloads use a short-lived signed link and re-check the recorded fingerprint before showing or saving the bytes. The final chain still needs the local service because its return records the full factor input package. Committed documents, hashes, versions, parent relationships and acceptance gates are unchanged; no factor status, weight, threshold or live call moved. Evidence: `node scripts/verify-research-upload.js` all five PASS, anonymous read refused (401), membership table refused to a member (403), library unit 29/29, upload client and adapter 44/44, library browser 1/1, full suite 597/599 with the two failures reproduced on pristine `origin/main`. Live check at the published URL with the local service stopped: sign-in, upload of the delivered VIX research report (84,056 bytes, `e4151937…`) as `VIX_USD_Research_Report.md`, the same row and file name after a reload, a download of 84,056 bytes with that name and hash, stage 2 naming that stored document as its input, stage 3 still waiting for the red-team, sign-out returning the stage to the committed row, and the final gate still `0/25`.


2026-10-19, factor-chain cycle (interactive coordinator, USD session lane), prepended without changing the objective below: the Research Library is now factor-scoped rather than topic-scoped. `data/research-library/catalog.json` carries twenty-five `factor_chains` (a `chain_id`, `factor_id`, `topic_id`, `slug` and three stages each) and one gated `final_chain` (`usd-final-asset-analysis`, stages `final_analysis`, `final_red_team` then `final_adjudication`), while the six topics remain grouping labels that own no stage and no document. The generated prompts moved to `docs/research/factors/usd/<factor-slug>/` (three per chain, seventy-five files) and `docs/research/final/usd/final-asset-analysis/` (three files, seventy-eight prompts in total), and `node scripts/build_research_library.js catalog --write` writes them with the catalogue they are hashed into; `chains --check` (with `topics --check` kept as an alias) and `verify` fail on drift. The panel now opens on a chain board: one expandable row per factor chain with its own `n/3` count and its own three stage cards, so a sibling factor never inherits another chain's document, and the final chain shows its registry gate (today `0/25` complete, twenty-five pending, state `locked`) and renders no stage until every factor chain delivers research, red-team and adjudication against current versions. The final chain then runs `final_analysis`, `final_red_team` and `final_adjudication`: the red-team receives the analysis and its supporting adjudications, and the adjudication receives both prior final documents before writing the complete candidate Layer 1 logic for isolated backtesting. Each final stage records its exact `input_documents` package, so a later version of any adjudication or final document flags every downstream final stage stale. The VIX chain `usd-factor-live-f1-vix-level` reads research delivered (the registered report, v1, `e4151937…`), red-team awaiting the file and adjudication not started, and its research prompt is still the dispatched deep-research assignment rather than the legacy `USD-SESSION-A3` reviewer task; the sibling `usd-factor-risk-vix-level-and-change-at-cutoff` reads `0/3`, so the one report is not counted as two independent results. Guards after the restructure: library unit 28 of 28, library browser 1 of 1 (29 tests, 0 fail; the browser test asserts the factor rows, chain isolation, the locked final gate with no rendered stage, prompt copy, upload linkage, View/Download, refresh, restart, revision and the published page), `node --check script.js` clean and `verify` ok. No factor status, weight, threshold, sign or live call changed; nothing was reviewed, accepted or scored.


2026-10-15, research-topics cycle (interactive coordinator, USD session lane), prepended without changing the objective below: the Research Library now works one topic at a time through three numbered stages, and the factor-and-task register has moved below them into a labelled secondary section. `data/research-library/catalog.json` carries a new `topics` array of six USD topics covering all twenty-five factor entries - VIX and the risk regime (the dispatched one), front-end rates, dollar index / gold / equities, economic surprise and Fed bias, FX session structure, and calendar plus data quality - each naming its factor entries, its interactions, the repository files it rests on, the published briefs behind it and its research questions. Each topic owns three generated prompt files under `docs/research/topics/usd/<slug>/` written by the same builder run as the catalogue, with the sha256 and byte count in the catalogue: stage 1 research (VIX stage 1 is the dispatched deep-research brief reproduced in full, 21,283 characters, so the VIX Copy prompt is the VIX assignment and not the legacy `USD-SESSION-A3` reviewer prompt), stage 2 red-team (the programme step-2 brief in full, and it must name the research version it attacked), and stage 3 adjudication (a new assignment that decides every material objection, proposes nothing unmeasured and ends with a handoff to central USD synthesis). `verify` fails if any prompt file on disk differs from the authored text, and the page verifies a prompt against its catalogue hash before copying it.

Last updated: 2026-10-15

Dispatch note, 2026-10-15 (pilot-dispatch cycle, interactive coordinator), prepended: the manual Astra pilot started from the published VIX package, and the exact dispatched version and bytes are now pinned in `docs/research/handoff/usd/v1/pilot/PILOT_DISPATCH_RECORD.md` - pilot 1 of package `1.0.0` for factor `live.f1-vix-level` (task `USD-BASELINE-AUDIT-01`), pack version `2.0.0`, context version `usd-session-context-20261014.1`, card schema `usd-session-research-card-v3`, archive `pilot/usd-vix-pilot-v1.zip` at 46,619 bytes and sha256 `1a4dfbeaa0a98987b074c376aade6a7d64c32a77292ecd788bd3d558b2e8451f`, with its four flat members pinned as well (`f1-vix-level.md` 14,724 / `808dc01ada48798e…`, `RESEARCH_OUTPUT_TEMPLATE.md` 8,582 / `cbea6e9efd5b9b3b…`, `research_card.schema.json` 17,060 / `43b549d0279817b8…`, `VIX_PILOT_START_HERE.md` 5,611 / `408962f8fe865534…`, each byte-identical to the file it came from) and the brief's registered identity recorded (`usd-brief-f1-vix-level` version 2 at `808dc01ada48798e…` / 14,724 bytes, version 1 kept immutable at `25f6207967d3c088…` / 12,974 bytes), so a returned card registers against the version it actually read. The record is hand-written precisely so the dispatch stays frozen: it is not generated, not a member of the archive and not a library document, so `node scripts/build_research_handoff.js check` still reads 36 files current and the live archive still hashes to `1a4dfbea…`; the manifest's `pilot` block and `files` row carry the same values, so a later edit makes the two disagree rather than silently re-pointing the pilot. Two owner decisions are recorded with the dispatch: the proposed missing-quote policy stays explicitly proposed until the methodology reviewer assesses it and is frozen with the flat band and the study's own tie policy before any candidate is scored, the VIX card being one input rather than the decision; and the pilot stays a bundle-only download, with no per-factor action, no new library document and no interface work. Nothing else moved: 22 factors ready and 3 blocked before and after, no deployment, workflow, feed, dashboard, dispatcher or database touched, the pilot not yet run, and a returned card evidence rather than an approval.



Publish note, 2026-10-15 (brief-correction cycle), prepended: the correction above is on `main` as commit `6eab14a4` and is live on both delivery routes. `https://kevincreedycars-debug.github.io/trading-agent-dashboard/` answers HTTP 200 with `index.html` at 28,856 bytes; the 404 recorded in the previous cycle's note does not reproduce and no Pages setting was touched. The corrected VIX brief (14,724 bytes, sha256 `808dc01ada48798e…`), the first pilot archive (46,619 bytes, `1a4dfbeaa0a98987…`), the bundle archive (596,029 bytes, `22a0bb454ec2592c…`) and `data/research-library/documents.json` (49,476 bytes, `fa23a266ff059799…`) each return HTTP 200 with the delivered bytes. The Research Library's brief actions were verified on the live dashboard itself, headless: 25 briefs in the live registry, the panel reads 25 of 25, all twenty-five factor pages offer Copy prompt and Download for their own registered brief, and on the VIX factor the copied text is 14,724 characters and the downloaded file hashes to the same sha256 as the live registry entry and the live file, so the two actions deliver one artefact.


Correction note, 2026-10-15 (brief-correction cycle, interactive coordinator), prepended: the shared text the twenty-five briefs carry was corrected at the generator rather than in one file, the briefs were regenerated, and the first pilot is packaged. Three fixes: the deployed engine's `NO_CLEAR_BIAS` is reachable arithmetic (F2 + F3 + F4 + F6 + F8 = 50 against F1 + F5 + F7 + F9 + F10 = 50) and is no longer described as unreachable; the workflow identity separates the executing version v155 (published 2026-10-12T19:52:13.451Z by the supervised live apply of the null-versus-unavailable guard; version id `0fb553c2-b1f1-4afa-bfdc-1166b60a6a79`, `versionCounter` 155, `nodes_sha256` `b2583215…`) from the audited baseline `exports/usd_layer1_agent.json`, measured against v154 on 2026-10-11, whose `Calculate USD Conviction` jsCode `580f0aa3…` is the same bytes v155 executes; and the missing-quote policy is one proposed policy - a session whose start or endpoint print is missing is a data exclusion that leaves the scored sample and is counted as coverage, never filled, forward-carried or interpolated - with data exclusions kept apart from model abstentions, which stay in the sample and are scored as no-calls. Corrected in `scripts/build_research_handoff.js`, in `docs/research/handoff/usd/v1/USD_SYSTEM_CONTEXT.md` and in the library's published implementation excerpt. `docs/research/handoff/usd/v1/` is now 36 generated files, the two new ones being the first pilot package: `pilot/usd-vix-pilot-v1.zip` (the VIX brief, the output template and the full card schema flat inside it) and `pilot/VIX_PILOT_START_HERE.md`. Guards: `npm run test:research-handoff` 14 of 14, `tests/research_library.test.js` 19 of 19, `npm run test:usd-session` 33 of 33, browser panel 1 of 1, and the 25 briefs registered an immutable version 2 in `data/research-library/documents.json`. Nothing was deployed, no factor's status moved (22 ready, 3 blocked), the pilot has not been run, and the flat band and the study's own tie policy remain unfrozen.


Delivery note, 2026-10-15 (USD session brief-delivery cycle, interactive coordinator), prepended without changing the state description below: the twenty-five self-contained USD research briefs are delivered, downloadable and published in the Research Library. `docs/research/handoff/usd/v1/` holds 34 generated files written by `scripts/build_research_handoff.js`: 25 briefs under `packs/` (10 baseline audits of the deployed factors and 15 session-research briefs, one per non-live catalogue factor, each self-contained with its own context, questions, hypothesis seed, falsification test, data asks, prohibitions, card field list and one session - 05:00 `Europe/London` to 05:00 `Europe/London` on the next local date), `BRIEF_INDEX.json`, `tracker_tasks.json` with 25 rows, `START_HERE.md` with the numbered list of all twenty-five briefs and a link to each, and `usd-research-handoff-v1.zip`, a stored archive the builder writes itself and verifies byte for byte. The same 25 files are registered as repo-backed `brief` documents, so each factor page carries a Brief block with Copy prompt and Download, the coverage line reads 25 of 25, and the copied prompt and the downloaded file are the same bytes the registry hashed. No status moved: 22 ready and 3 blocked, before and after, nothing uploaded, accepted or scored. Tasks `USD-SESSION-A3`, `A4` and `A5` cover all 25 factor ids and `verify` reports zero factors covered by no task. Guards: `npm run test:research-handoff` 12 of 12, `tests/research_library.test.js` 18 of 18, `tests/research_library.browser.test.js` 1 of 1. The Research Library's factor table is at the full width of its panel, an implementation published by the dashboard lane and re-measured here at both widths. Nothing live changed: no workflow, feed, credential, dispatcher or production file was touched.
Publish note, 2026-10-15 (same cycle): the delivery described here is on `main` as commit `f7fc4690`, pushed onto the live-feed snapshot `c3589304`, and the published bytes are identical to the delivered ones (`git hash-object` against `git rev-parse origin/main:<path>` for `START_HERE.md`, `BRIEF_INDEX.json`, `usd-research-handoff-v1.zip`, `HANDOFF_MANIFEST.json` and the packs). Downloads, verified live this cycle at HTTP 200 with the published byte lengths: `https://raw.githubusercontent.com/kevincreedycars-debug/trading-agent-dashboard/main/docs/research/handoff/usd/v1/START_HERE.md`, `.../BRIEF_INDEX.json`, `.../usd-research-handoff-v1.zip`. In a `main` checkout the guards read `test:research-handoff` 12 of 12, `tests/research_library.test.js` 16 of 18 and `tests/research_library.browser.test.js` 1 of 1; the two failures are the pre-existing registry hash mismatches on `data/usd-24h-experiment-registry.json` and `data/usd-24h-selection.json`, which fail the same way on untouched `main` and predate this cycle.



## Platform Status

The Layer 1 trading-agent platform remains operational, and the latest runtime evidence in `data/workflow-status.json` shows a successful manual refresh on 2026-07-20 with every listed step marked successful, including `Layer 2 Trade Selection Agent`.

The full Layer 1 historical replay rollout is now validated across USD, EUR, Gold, NQ, and BTC. The active repository work has shifted from replay rollout itself into downstream research presentation and breakdown views built on top of the canonical checker artifacts.

The current deployed production baseline includes the UK/ET live header clock, explicit Layer 1 `24H` expiry display on Overview cards, the Layer 1 Directional Viability spacing fix, removal of the redundant Overview weighted-verdict prose, and UK-time hover/focus tooltips on every available Layer 1 `24H` expiry section while preserving the visible ET expiry. The tooltip converts the exact same expiry timestamp into UK time using browser-native `Intl.DateTimeFormat` with automatic GMT/BST handling.

Current platform state is stable and validated. The production dashboard exposes the live Layer 1 and Layer 2 surfaces plus the read-only historical research tabs. The credential-continuity milestone is complete, and the Architecture Mirror is now implemented and deployed as a read-only top-level dashboard tab.

The deployed Architecture Mirror baseline is implementation commit `7586016d89c1e06c9f20beed3201034248d1e048`, published at deployed commit `9407893cc668b47fc9ddddf0cfa4b9e8a6f722bc`. It ships a validated checked-in manifest and custom HTML/CSS renderer with:

- 36 nodes
- 59 edges
- 5 boundaries
- 13 views

The current deployed presentation uses:

- an 8-stage grouped Overview map rendered from the browser-side renderer rather than from altered manifest facts
- deterministic vertical waterfall views for every Architecture tab
- contained responsive grids for parallel nodes within a stage
- centered vertical connectors between stages
- a below-canvas selected-node detail panel
- no absolute node placement in the active renderer
- no SVG bus routing in the active renderer
- no horizontal scrolling in the Architecture canvas
- four-viewport geometry and live review coverage across all 13 views

The Architecture Mirror remains documentation-only. It does not change production logic, research calculations, workflow execution, credentials, or existing artifact semantics.

The following architecture areas remain intentionally explicit but unverified in the deployed mirror:

- whether Dashboard Writer publishes artifacts beyond `data/layer1.json`
- the exact publication responsibility split for `data/layer2.json`
- which non-BTC collectors directly consume economic events
- exact GitHub commit sequencing during an orchestrator run
- complete column-level Supabase lineage
- node-level failure fan-out inside every exported workflow

## Credential Continuity Status

Credential continuity is now functionally complete using the existing CLIXML-based encrypted local store under:

```text
%USERPROFILE%\.trading-agent-dashboard\
```

Current validated local state:

- eight continuity variables are present in the local encrypted store
- `OANDA_ACCOUNT_ID` remains optional / conditional and is currently absent
- repository bootstrap is `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\bootstrap-local-secrets.ps1`
- repository validation is `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\check-required-secrets.ps1 -Scope all`
- isolated backup and restore validation passed
- read-only connectivity validation passed for `n8n`, Supabase, FRED, OANDA, and Alpha Vantage
- RapidAPI credential loading is confirmed, but external endpoint verification remains inconclusive because the harmless validation endpoint timed out

This continuity work did not change production logic, trading logic, or live workflows.

## Current Architecture

```text
Market Collectors
        ->
Market Snapshot (Supabase)
        ->
Independent Layer 1 Agents
        ->
agent_outputs
        ->
Dashboard Writer
        ->
GitHub Pages Dashboard
```

Layer 2 economic-event adjustment will be built later.

## Layer 1 Assets

- USD
- EUR
- Gold / XAU
- NQ
- BTC

## Layer 1 Isolation Rule

Each Layer 1 agent must remain sealed and independent.

No Layer 1 agent may:

- read another agent output
- read dashboard output
- read Layer 2 output
- synthesise pair relationships using other agents
- contaminate its own raw call with another asset's call

Each Layer 1 agent receives only:

- its own logic document
- the latest usable market snapshot

Each Layer 1 agent answers:

> Based on confirmed value-driving factors available at execution time, what is the likely direction of this asset?

## Master Orchestrator

A Master Orchestrator workflow has been created in n8n.

Purpose: one manual button press runs the whole platform sequentially.

Current intended execution order:

```text
Manual Trigger
        ->
Eco Events Collector
        ->
USD Collector
        ->
EUR Collector
        ->
Gold Collector
        ->
NQ Collector
        ->
BTC Collector
        ->
USD Layer 1 Agent
        ->
EUR Layer 1 Agent
        ->
Gold Layer 1 Agent
        ->
NQ Layer 1 Agent
        ->
BTC Layer 1 Agent
        ->
Dashboard Writer
```

Every workflow has been converted to use `Execute Sub-workflow Trigger`, allowing the master workflow to call workflows sequentially.

Runtime evidence in `data/workflow-status.json` shows a successful run on 2026-07-20, with every listed step marked successful and no reported error.

## Known Current Issues

### 1. Eco Events duplicate insert

This issue was fixed on 2026-06-21.

The live `Eco Events Collector` was updated to dedupe incoming events, update existing rows, and create only unmatched rows. The previous duplicate-key failure is no longer an active known issue.

### 2. EUR Agent JSON parsing

The EUR Layer 1 Agent can fail when the OpenAI node output is returned as an object instead of a string.

Original parser assumed:

```js
JSON.parse(text)
```

After enabling OpenAI `Output Format: JSON Object`, the parser must support both:

- string output
- object output

This remains a known issue unless confirmed fixed in the live workflow.

### 3. Master workflow final status summary

The latest runtime artifact in `data/workflow-status.json` now provides a useful success payload, including a top-level message, per-step statuses, and no reported error for the latest run.

Any further refinement should be driven by observed runtime gaps rather than by the older missing-summary assumption.

## Current Deployment State

The repository currently documents and exposes GitHub Pages as the active static host:

```text
https://kevincreedycars-debug.github.io/trading-agent-dashboard/
```

Older architecture notes that refer to Netlify are historical context and should not be treated as the current host model.

## Current Strategic Shift

The project has already established the AI-assisted development environment baseline and completed the Layer 1 historical replay rollout. The current repository priority is downstream analytical visibility and validation on top of those frozen checker artifacts.

The current repository priority is:

> keep the production dashboard baseline clean and explicit while validating and reviewing the newly deployed Architecture Mirror

The current immediate implementation task is:

> review the deployed Architecture Mirror and decide the next milestone

The next planned phase after this production polish task is:

> no new implementation phase is active yet; the next milestone awaits review unless a separately documented task is approved

The `L2L 1H Sequence Research` module is not another close-to-close accuracy table. It answers whether price moved at least the required `50% ADR20` distance in the direction of a Layer 1 or Layer 2 call after the relevant intraday swing, using sequence-aware `1H` candles and daily candles only for ADR20.

Current repository evidence supports real sequence-aware L2L measurement for:

- `EUR` Layer 1 using repo-local OANDA `EUR_USD` daily + `1H` candles
- `Gold` Layer 1 using repo-local OANDA `XAU_USD` daily + `1H` candles
- `NQ` Layer 1 using repo-local OANDA `NAS100_USD` daily + `1H` candles
- `BTC` Layer 1 using repo-local Binance `BTCUSDT` daily + `1H` candles
- `EUR/USD` Layer 2 using the existing Pair Trade Research tradable-signal logic plus the same `EUR_USD` candle source
- `XAU/USD` Layer 2 using the existing Pair Trade Research tradable-signal logic plus the same `XAU_USD` candle source
- `NQ/USD` Layer 2 using the existing Pair Trade Research tradable-signal logic plus the same `NAS100_USD` candle source
- `BTC/USD` Layer 2 using the existing Pair Trade Research tradable-signal logic plus the same `BTCUSDT` candle source

Current repository evidence does not yet support real sequence-aware L2L measurement for:

- `USD`

That unsupported path is now rendered as unavailable in the `L2L 1H Sequence Research` module rather than estimated from close-only data.

GitHub is the source of truth. n8n remains the execution engine. Supabase remains the data layer. GitHub Pages is the active presentation host.

## Target Development Model

```text
ChatGPT / Codex
        |
        |-- GitHub repository
        |-- n8n workflows
        |-- Supabase data layer
        `-- GitHub Pages dashboard
```

ChatGPT should handle architecture, debugging, reasoning, planning, and documentation.

Codex should handle file edits, workflow JSON edits, code changes, commits, and implementation.

Both should eventually be able to inspect GitHub and n8n without manual copy/paste from the user.

## Permanent Working Memory

Codex startup is now governed by `CODEX_STARTUP.md`.

Every Codex session must use `CODEX_STARTUP.md` as the single startup entry point, always read the core memory files first, selectively load additional documents only when relevant, then inspect repository and runtime state before editing.

The memory documents are authoritative between sessions and should be updated only when their contents actually change.

The canonical project memory set is:

- `CODEX_STARTUP.md`
- `docs/CURRENT_STATE.md`
- `docs/CURRENT_TASK.md`
- `docs/ACTIVE_MILESTONE.md`
- `docs/NEXT_STEPS.md`
- `docs/CHANGELOG.md`
- `docs/DECISIONS.md`
- `docs/SESSION_NOTES.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ARCHITECTURE.md`
- `docs/N8N_INTEGRATION.md`
- `workflows/WORKFLOW_INVENTORY.md`

## Historical Research Platform

The historical research platform is downstream-only and must not modify production behavior.

Authoritative principles live in:

- `docs/CORE_RESEARCH_PHILOSOPHY.md`

Current implemented state:

- Historical replay and deterministic checker coverage are validated for USD, EUR, Gold, NQ, and BTC.
- Current checker totals are USD `604`, EUR `602`, Gold `608`, NQ `604`, and BTC `850`, all passing with zero fail / zero missing / zero tolerance pass.
- The Backtest / Accuracy dashboard exposes the existing matrices and checker workspaces plus weekday confidence breakdowns, Pair Trade Research, and the first `L2L 1H Sequence Research` release.
- 24H remains the primary short-horizon benchmark focus.
- Historical research presentation remains downstream-only and must not modify live runtime behavior.
