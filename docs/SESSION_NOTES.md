# Session Notes

2026-11-23 (third build), USD Layer 1 lane, same branch - the tick sweep was re-priced inside the 05:00 session and readiness was reconciled per session.

The sweep first. `l2l-tick-sweep-v1.json` was produced on 2026-11-12 by one continuous walk of the six
sessions, so a limit that was not touched kept working into later sessions and a position was carried past
the following 05:00 London. Measured from the stored artefact: 4 of 157 fills are stamped after their own
session had ended (one three days later) and 24 exits are at or after the following 05:00, 4 of which have
no exit at all. The earlier note that the ladder hash made the sweep unaffected is withdrawn: the same hash
establishes the same lines, not the same execution outcomes.

`backtester/lib/usd_layer1_backtester/tick_sweep_bounds.js` and
`scripts/rebuild_l2l_tick_sweep_session_bounded.js` re-price v1's own decisions. The script reproduces v1
first - totals, sixteen account blocks and sixteen model summaries to the recorded precision - and refuses
to write if it cannot; then a fill outside its own session window is cancelled at that endpoint
(`cancelled_at_session_end`, not counted as a trade) and a position with no in-window exit is closed at the
last M5 bar inside the window on the side of the book that would have paid it (`session_end`). Every other
trade keeps the price, instant and R it was recorded with.

What moved: targets 33 to 24, stops 120 to 109, session-end closes 0 to 20, working 4 to 0, fills cancelled
4, closed trades unchanged at 153 (the four working positions became endpoint closes as the four late fills
were cancelled). R for the full 5R rule -11 to -5.1936 and for the half 3R rule +4 to +2.7508. Ten of the
sixteen accounts moved; the list is in the supersession record.

What the correction does not do: it does not re-derive a decision, so an order that never filled is not
re-placed and a slot freed by an earlier 05:00 close is not re-filled, because v1 recorded only the fills
it took. The tapes are local evidence - the artefact carries each one's sha256, window, bar count and
endpoint close, so the endpoint prices can be audited, but re-streaming needs broker access.

Readiness. `evaluateReadiness` now keeps levels, tape and shared session apart and copies a `sessions`
block into every test cell. EURUSD, XAUUSD, NAS100 and BTCUSD hold 22 archived levels and a bid/ask tape
over the same six sessions, so their two L2L cells read `measured_tick_replay` (6 of 6) rather than
"no bid/ask tape". The committed M5 archive is a different dataset - mid-price, 2026-11-04 to 2026-11-06 -
and is carried as such. Counts: 4 scored, 1 proxy-scored, 8 measured, 11 blocked, 24 total.

Verified after the rebuild: run artefact 7,090,881 bytes sha256 `90800e10...3ebf39`; screen payload
`e576276c...2adb3`; `check:l2l-tick-sweep`, `check:usd-l1-platform`, `check:usd-l1-ledger`,
`report:layer1:check`, `report:morning:check` and `screen:backtesting:check` reproduce; suites 48/48,
34/34, 17/17, 15/15, 118/118, 32/32, and the browser factory guard 15/15. The browser suite's six failures
are the ones this machine already had; the H1 one was re-run against HEAD's payloads to confirm it.

Not claimed: predictive advantage for any rule, model or market.

2026-11-23 (second build), USD Layer 1 lane, same branch - the four-market arrangement became configuration and
the L2L ladder's history became evidence. `backtester/config/usd_layer1_market_matrix.json` declares a primary
market (`DXY`) and seven additional markets, and every selected market receives three tests: directional
accuracy, original L2L 5R and 0.5 L2L 3R. That is 24 combinations per strategy, and the new `market_matrix.js`
validates the document (one primary; a duplicate primary is refused; no unknown test; a declared sign per
market), fingerprints it for experiment identity, and evaluates each combination against the data that exists.
The published run scores 5 combinations and blocks 19 with a named missing dataset - three markets have no
cached one-hour series, the M5 sample is mid-price only with no bid/ask, and no session has both a tape and a
pre-session ladder - and a blocked combination is never rendered as a zero, on the artefact, in the ledger, in
the n8n `test_configuration` or on the Tests tab. The configuration travels: `run.markets`, `market_matrix`,
`market_matrix_id`/fingerprint, the ledger's configuration digest, the per-market comparisons, the screen
payload and the dashboard table. The session-horizon fix now has its endpoint proof as well as its resolver
tests: pricing reads the following 05:00 London close and ignores the next session's bar; `sessionTape` cuts a
tape to `[cutoff, endpoint)` and `simulateSessionPath` closes an open position at the last in-session close, so
a target that prints at the endpoint is dropped and counted, and the clock-change sessions either side of both
2026 and 2027 transitions measure exactly 24 hours while the Saturday starts measure 23 and 25 and are refused.
Level provenance was the other correction. The live ladder had been re-marked automatically at
`2026-11-23T16:20:57.042Z`, so dating the six sessions against the file on disk priced none of them. The 22-level
ladder those sessions were actually traded against was recovered intact (sha256 `a5dc10a3...`, matching the
published tick sweep's own record), its git commit `5262f8d2` (`2026-10-04T19:02:52Z`) and its internal stamp
`2026-10-04T16:14:19Z` both precede the first session start `2026-10-05T04:00:00Z`, and it is now committed
under `data/usd-layer1-backtester/level-snapshots/` with an index that records the hash, the commit and the
timing. Eligibility is resolved against the latest archived snapshot that precedes a session, so the six
sessions are priced from the archive and the live file prices zero of them: approval cannot make an unavailable
historical level contemporaneous, and a re-mark can no longer back-date history. The v1 artefact is preserved
byte for byte (`run-v1-superseded-20261114.json`, `0fea0347...61f3`) with `run-v1-supersession.json` recording
what changed and what did not; the v2 build is `adad65fd...dc7`, 7,056,949 bytes. The ledger check was pinned to
the preserved v1 dataset for the same reason: re-merging old captures against v2 recomputed every record's
configuration digest and doubled the rows, so that run was reverted and the check now names its dataset. Green
after the rebuild: platform check exit 0 (four artefacts reproduce, verdict pass), ledger reproduces,
platform 40/40, n8n 34/34, controller 17/17, l2l simulation 15/15, usd-session 118/118, engine 32/32, native and
browser backtesting 26/26, and the report, screen and morning-run checks. H1's 0 of 725 is a measured result, not
an owner decision: what is pending there is the gold identity/licence and the calendar vintage (D5, D6), and the
0 stands if those inputs never exist. Full detail: `docs/research/usd-session/v1/MARKET_MATRIX_AND_READINESS.md`
and checklist sections 5, 5b and 5c.


2026-11-23, USD Layer 1 lane (branch `backtesting/usd-l1-session-horizon-20261123`, cut from `origin/main`
`0288994a`) - the session-engine interface was ending a session at 17:00 `America/New_York` while the contract
it serves, the four test definitions and every published artefact say 05:00 London to 05:00 London on the next
local day, so the one module whose whole job is to place those two instants was measuring a window of 16 or 17
hours. Across 2026's 261 Monday-to-Friday starts the old endpoint gave 17 hours on 241 of them and 16 on the 20
that fall in the two weeks a year when London and New York are on different offsets; nothing failed, because
nothing else read the module, which is exactly why it was worth correcting before an implementation inherited
it. Both ends are now 05:00 `Europe/London` with `endpoint_day_offset` 1, `nominal_hours` 24,
`session_start_weekdays` Monday to Friday and the rule written out in `session_start_rule`; `isSessionStart()`
refuses a Saturday or Sunday start, `resolveSession()` returns the measured window and the weekday flag beside
the two instants, the version is `usd-session-engine-interface-v2`, and `America/New_York` stays in the
transition table only because the macro as-of builder times the Fed's H.10 release in it. All 261 weekday
starts now measure exactly 24 hours, and the 2026 Saturday starts measure 23 (2026-03-28) and 25 (2026-10-24)
hours - the two EU transitions, both refused - so no eligible session can contain one. The Cloud runtime was
re-cut around the corrected interface: `node scripts/build_usd_l1_n8n_cloud_workflows.js` rewrote all six files
to identical bytes at `bundle_sha256` `73215c1e4785b6029e6ead99a7b7a9783f96497833f01acebfe0dbba01b6d787`,
119,268 bytes, with the interface source at `73ba4fc1d181…c808`, the three child ids (`giGJKNQw5WLh1xbX`,
`42sxXHScRvE3qSTX`, `kaWqy2iYIz8UzPRS`) and the header-auth credential preserved; nothing was uploaded or
executed on n8n Cloud in this session.

Landed with it on the same branch, each with its own evidence: `contracts.ACCOUNT` is now the only
machine-readable account - `usd_layer1_backtester/accounts.js#runAccount` defaults, the demo call and the
panel's account note read it instead of retyping GBP 100,000 and 1%, and `tests/execution_accounting.test.js`
asserts they agree; the M5 archive has a verifier (`backtester/scripts/verify_m5_archive.js`, 4 of 4 markets
hold five-minute bars, 0 hold bid/ask, 4 hold a marked ladder, 6 of 6 recorded EUR/USD trades re-derived on
2026-11-05 with 0 failures) and a guard (`backtester/tests/usd_layer1_m5_archive.test.js`, 5 of 5); and the
research artefacts this lane reads are committed (`data/usd-24h-research-dataset.json`,
`data/usd-24h-baseline-comparison.json`, `data/usd-layer1-backtester/l2l-tick-sweep-v1.json`,
`data/usd-layer1-backtester/m5-archive-status.json`). Verified on this base: `check:usd-l1-platform` exit 0 with
all four artefacts `reproduces` and `verdict: pass`, `test:usd-l1-platform` 29 of 29, `test:usd-l1-n8n` 34 of
34, `test:usd-session` 117 of 117, `execution_accounting` 8 of 8, `check:usd-l1-ledger` `ledger reproduces`
with no verification failures, `report:layer1:check`, `report:morning:check` and `screen:backtesting:check`
each reproducing their artefact, and the four browser suites 23 of 23 (`site_nav_consistency` 6,
`usd_layer1_logic_page` 6, `layer1_call_flow` 5, `usd_layer1_call_flow` 6). The commit also refreshes
`run-v1.json`'s recorded provenance - the ladder source is named as the tracked `data/l2l-levels.json` rather
than the ignored raw copy, and two input hashes are updated to the catalogue and macro inventory as they stand
on `main` - with no result moving. One thing was found and deliberately not acted on: re-running the artefact
builder now yields SHA-256 `390b6118…1af7` instead of the committed `0fea0347…61f3`, with all 51 differing
leaves in `results.lead_numbers[1]` and `level_provenance`, because `origin/main` published a re-marked L2L
ladder today (`a04cc73a`, stamped `2026-11-23T16:20:57.042Z`, automatic coverage, 30 levels per asset against
22) over the 2026-10-04 hand-marked ladder the artefact was built from. Every session is dated against the
ladder stamp, so the rebuild prices 0 sessions with original levels where the committed artefact records 6
(2026-10-05 onward): republishing would move the panel's lead number from 6 to 0 and withdraw the only
original-level coverage there is, so it is recorded as the owner decision it is in
`docs/research/usd-session/v1/PLATFORM_COMPLETION_CHECKLIST.md` section 11 rather than folded into this fix. No
rule, weight, threshold, workflow, order, size, feed, lane or runtime table was touched, and nothing live moved.

2026-11-23, live-trading coverage row published and FTMO 2 audited - the `Ladder coverage` row the 21 November record
asked for is live on the lane card and in the status panel (`main` `f30deafa`, buster
`script.js?v=20261123-ladder-coverage-row`), and the published `script.js` is the committed file byte for byte (HTTP 200,
1,215,467 bytes, sha256 `35BA4E6E…52E6`, equal to the worktree's copy after line-ending normalisation and to
`raw.githubusercontent.com/…/main/script.js`). A read-only Playwright probe opened the hosted page at 20:56:30Z and read
all three lanes: each card states `held at 10 full lines each side`, the status panel carries the row between
`LOADED RULES` and `EFFECTIVE CAP` on every lane, and no page error was raised; the hosted heartbeats were read beside it
and state exactly the fields the page reads, which closes the "schema not confirmed" risk, with `armed: true`,
`max_per_day: null`, `capped: false` and `entries_today` 3 / 9 / 24. Tests: `node --check` clean, the two touched browser
files 15 of 15, the ten trader/lane/L2L suites 330 of 330, the eleven other live-trading browser suites 36 of 37 with the
chart-zoom failure, which fails identically in a clean worktree at `d9018198`. The audit then answered the FTMO 2
question: all three lanes run the same two files (trader `74b0cd18…`, library `db164d85…`, checkouts on `e3406286`, both
files unchanged up to `f30deafa`), so lane 2 *has* the session-expiry rule (`43c48316`) and the ordered three-leg reading
(`e75757f4`) but runs neither, because both sit behind `requireDeviation` and its wrapper passes `--reentry-crossing` and
no `--require-deviation`; only lane 3 (`--blind`) asks for it. The Blind day-boundary re-selection is blind-only and is a
selection reset, and lane 2 keeps no pair state, so there is nothing of it to inherit. The record agrees: lane 2's 90
placed tickets include 34 put-backs, every one re-armed within 24 h of its exit and quoting the newest completed candle
(largest lag 1.6 min), and no lane placed a ticket on a shut market; the one weekend-spanning re-arm in the history is
lane 1's EURUSD put-back at 2026-11-22T22:06Z from a window opened 2026-11-20T17:41Z, which lane 1's rule allows. Open risk
recorded, not changed: the market-closure test is keyed on `requireDeviation`, so a lane trading ordinary crossings can
state a limit from a pre-closure candle while a Layer 1 call is still live. Record:
`docs/live-trading/TRADER_COVERAGE_NO_DAILY_CAP_20261122.md` sections 8 and 9.



2026-11-22, live-trading trader lane - the trader half of the L2L coverage work shipped to all three FTMO accounts, and
the daily entry cap came off the two lanes still carrying it. The three checkouts were on three different revisions
(`c5abd0ac`, `f14f2ac7`, `441c308f`) and none of them was `main`; the blind lane's line was merged into `main`
(`981b81cf`) and the ordered three-leg reclaim fix that lane 3 was running as an uncommitted file came with it
(`6b408c2f`, merged as `e75757f4`), so one revision, `e3406286`, now carries the blind rule, the cap removal and the
coverage work together. On that revision the tick plans the publisher's own coverage extension in memory against the
lane's own snapshot prices before evaluating an entry, withholds an asset's entries when it cannot reach ten full lines
a side, states the floor and failures in the heartbeat's `coverage` block, and refuses a generated line as a crossing
when the confirming candle closed before the line existed (`retrospective: true`); it writes no levels. All three lanes
were moved to it with backups, lanes 1 and 2 were re-registered (`--max-per-day unlimited`), lane 3 was left alone
because its wrapper already carried every flag. At the 18:36:3xZ ticks every lane read `armed: true`,
`max_per_day: null`, `capped: false`, `coverage: covered`, `min_per_side: 10`, `short: []`, with EURUSD 18 up/10 down,
XAUUSD 20/10, US100.cash 30/10 and BTCUSD 26/11 at each lane's own price, and every ticket and position at 0.01 lots.
One regression was caught in the deploy itself and fixed within the hour: lane 1 re-registered without `-Elevated` ran on
the filtered token, could not append to the order tool's journal (ACL: Administrators and SYSTEM only) and refused two
ticks before reading the terminal; `-Elevated` restored it. Tests: live-trading and L2L 627/626 with the one
`origin/main` browser failure; full suite 1,283 with 16 failures, all present on `origin/main`. Record:
`docs/live-trading/TRADER_COVERAGE_NO_DAILY_CAP_20261122.md`.

2026-11-19, USD Layer 1 lane (branch `backtesting/usd-l1-screen-20261117`) - the backtest now exists as
versioned n8n Cloud workflows, and the four recorded mornings are drawn as a model-swap map on the Backtesting
tab. n8n Cloud has no `Execute Command`, so the two existing wrappers could not run there; the new lane bundles
the controller library into a Code node (`automation/n8n/usd-l1-cloud-runtime.js`, 90,011 bytes, source-set hash
`e1e7ecb0...` in `automation/n8n/usd-l1-cloud-workflows.manifest.json`), pins one model per child
(`usd-l1-challenger-v0` `giGJKNQw5WLh1xbX`, `usd-l1-challenger-v1` `42sxXHScRvE3qSTX`) and binds both from a
parent (`89uk5JnPbWPL5lGD`) whose webhook is header-authenticated and deactivated after the runs. Executions on
2026-11-19: 5471 structural (children 5472/5473, both `allowed` BULLISH conviction 2), 5474 receipted (5475/5476,
both `blocked`), 5477 missing date (5478/5479, both `blocked`) and 5480 missing inputs (5481/5482, both
`abstained`); every parent returned success and both children always carried the same validation verdict with
different decisions, which is the point of the swap. The bundle reproduced the Node controller for both challengers
over all 725 stored mornings (1,450 decisions, 0 mismatches). Guards re-run in this session: `test:usd-l1-n8n`
15/15 (Cloud 5/5 including real child ids and the header-auth credential, map 10/10), browser map 1/1 at 1440 and
390 pixels, controller 17/17, architecture map 6/6, and `node scripts/validate_architecture_map.js` clean. Two
build fixes: the builder now keeps the imported child ids and webhook credential already in the manifest and parent
file, so `npm run build:usd-l1-n8n` rewrites identical bytes instead of placeholders, and the earlier removal of
`test:usd-layer1-engine`, `backtest:usd-l1-engine`, `check:usd-l1-engine`, `shadow:usd-l1` plus the two H1 files in
`test:usd-session` was reverted - every one of those files exists and passes (engine 32/32, `test:usd-session`
90/90). Full local bucket: 1,076 tests, 1,059 pass, 13 fail, 4 skipped; the same 11 failures exist at `origin/main`
`5ab099a3` in a clean worktree (globe 2, layer-1 call map 2, M5 pan and zoom 2, research library 1, USD call map 2,
USD logic dossier 2) and the other 2 are the clock-dependent `refresh_progress` cases, which also failed at `main`
on a different test in the same rerun and passed 26/26 locally on the next. Then published: a plain rebuild rewrote
identical bytes, the lane was committed as `80a50536`, opened as PR #11 and merged to `main` as `719bc1b2`.
Reading the live site back on 2026-11-19: `backtesting.html` answered 200 at 75,024 bytes with four `n8nmap`
references, the evidence file answered 200 at 62,511 bytes with sha256 `17dd410c...` (identical to the checkout), and
a headless pass of 18 of 18 checks - map as the default view, 725/725, 0/725 and 2,175/2,175, both model versions,
four recorded cases, child links to executions 5472 and 5473, the blocked receipted case, no page error and no failed
response. The earlier "not published" reading (58,292 bytes, no `n8nmap`, evidence 404) was accurate before the
merge. Nothing scheduled, no order, stop, size, feed or runtime table touched. After the merge, a fresh Windows
checkout exposed a line-ending defect: `core.autocrlf` rewrote the checked-in runtime to 91,896 bytes, so the
manifest's `bundle_bytes` no longer described the file a checkout handed back and the bundle guard failed. The
runtime is now pinned with `-text` in `.gitattributes` and re-added with its published 90,011 bytes (96 of them
the runtime template's CR), and the guard compares the bundle's code canonically with the source-set hash masked
and accepts each pinned source hash in either line-ending form. Verified by measurement: a pristine clone of
`origin/main` returns 90,011 bytes with 96 CR and passes the Cloud guard 5/5, a copy of the same files with LF
endings passes 5/5, and the full guard set (Cloud, map, browser map, architecture map) is 22/22 with
`node scripts/validate_architecture_map.js` exit 0. PR #13, merged as `856dbcfe`; no workflow JSON, manifest
value, evidence byte or page changed.

2026-11-15 late evening, second lane (factory drill-downs, branch `design/architecture-factory-drilldowns` off
`origin/main` `fb059c17`) - the Architecture factory gained its two second levels and a corrected execution floor.
Each replay chamber now offers **Explore test library**: the camera drops below the floor, the chamber keeps its
label above, five plaques stand in investigation order (research → model → inputs → replay → results) and the side
panel lists each group's committed documents with a tag that separates what the replay reads from related research.
The USD chamber exposes its four tests separately with market, logic, required data and result artefact: T1 is
blocked on the official cash DXY series with a broker proxy scored, T2 is scored, T3 and T4 are blocked for all four
markets on the missing M5 tape and pre-session ladder, and the two-day execution demo is labelled a demo. Each Layer
1 core now offers **Inspect n8n flow**: `scripts/build_factory_flows.js` copies an allowlist (node names, types, type
versions, edges, written purposes) out of the six committed agent exports into `lib/factory-flows.js` and writes
`docs/dashboard-design/n8n-agent-flows.md`; `--check` fails on drift, and the builder rejects a URL, key, token,
secret, webhook or credential-shaped string before writing. USD is the one *verified* flow (the logic dossier walks
it); the other five read *documented workflow*, and WTI and GBP have no export so their panel says so. The floor now
draws three FTMO traders: lane 1 (full ladder, 5R), lane 2 (half grid, 3R) and a third blind trader with its own M5
feed and M5 deviation rule, connected but unarmed, with no Layer 1 or Layer 2 input and no payout route. A fourth,
visually distinct cTrader component is drawn apart with dotted grey *hosting* links that are not counted as data flow;
its four states read installation (source committed, deployment not evidenced), account connection (verification
pending), trading authorisation (**pending**, orders default to disabled) and active copying (**none documented**).
**No order-copying relay exists in this checkout** - the only cTrader artefact is the independent `ctrader/Ftmo3L2L`
robot - so none is drawn and the station says it twice. Guards: `tests/factory_library.test.js` 7/7,
`tests/factory_flows.test.js` 5/5, `tests/system_factory.browser.test.js` 11/11 and
`tests/system_map.browser.test.js` 2/2; the local unit bucket ran 807 tests with 803 pass / 4 skipped / 0 fail, and
the browser bucket 129 with 122 pass and the same 7 failures seen at `origin/main` in a clean worktree (nav partial
2, XAU/USD dev board, two M5 pan/zoom, research-library, and one clock-dependent blind-lane freshness check). Local
preview: `node scripts/research-library-server.js --serve-repo --port 8815`; screenshots in `tmp/shots/`
(`journey-1-usd-library.png`, `journey-2-usd-flow.png`, `journey-3-floor-relay.png`, `phone-library.png`). Nothing is
published: the branch is local, `main` and Pages are untouched.

2026-11-15 late evening (the verified-mornings strip, built on `origin/main` `478ab9b9`, merged `35315dac`) - the
owner asked the tab one question: on how many of the 725 historical mornings can we prove the intended 25-factor USD
agent had every input it needed by 05:00 London and applied the final adjudicator's logic? The answer already existed
in `run-v1.json`'s `validity_gate` but nowhere a reader could see it - `research_gate.accepted` 0, a four-rung ladder
at present 618 / fresh 617 / clocked 0 / identified 0, and one `days[]` row per morning naming the missing, stale,
unclocked and wrong-instrument inputs. `lib/backtesting_native.js` gained `verification(run, engine)`, which reads
those rows into one model - the count, the outcomes, the rungs, six blockers with the dates each touches and the file
that closes it, the four tests with a zero verified denominator beside the artefact's experimental numbers, and one
blocked morning to open - and `script.js` gained `renderBacktestingVerification()` to draw it above the three columns.
Nothing is recomputed: the rungs and the blocker dates are the gate's own rows and the per-input counts inside the
fixes are read from the same `days[]` rows, so a rewritten artefact cannot leave the prose behind. The strip says why
the answer is none in the artefact's own terms: the intended candidate is `CONFIG_BLOCKED` with `rule_defined: false`,
so all 725 mornings are undefined-rule mornings, and no print carries a receipt that puts it before 05:00 London - the
clocked rung is 0 while presence is 618 and freshness 617 - and the blockers overlap rather than add, which the strip
prints instead of a sum. Live read-back through `tmp/probe-live-verify.js` at 1440 and 390 pixels: the strip leads with
`0 / 725`, the rungs read 618 / 617 / 0 / 0, all six blockers and four denominators print, the exemplar link opens
`#backtesting/four_markets/EURUSD/2024-02-06` as BULLISH abstained at E6 with E1-E5 passed and 25 rows, no page error
is raised and the 390-pixel strip is 370 wide with no document overflow. Guards: `tests/backtesting_native.test.js`
18/18, `tests/backtesting_native.browser.test.js` 8/8 and the map suites 16/16. Published as PR #8, merged `35315dac`
(feature `31dd5f97`); the two merged publication branches `publish/backtesting-native-20261115` (`cd5ce545`) and
`docs/backtesting-published-20261115` (`cf67a858`) were deleted after both tips were confirmed ancestors of `main`,
and `feat/verified-mornings` was deleted after its own merge. Evidence kept in ignored `tmp/verify-acceptance/` and
`tmp/live-verify/`.

2026-11-15 evening (the Backtesting tab made native, on `#backtesting`, ported onto `origin/main` `4b6423b0`) -
the 10 November release put the USD Layer 1 backtester on a page of its own because `main` did not carry the panel;
this port makes it a tab of the dashboard itself, `data-tab="usd-layer1-backtester"` unchanged so saved navigation
still resolves, reached from the top menu's `index.html#backtesting` and from the rail, with deep links
`#backtesting/<test>/<market>/<date>` kept in step as the reader selects (`#backtesting/four_markets/EURUSD/2026-10-12`
and `.../2026-10-09` are the two acceptance paths). The engine, the Three.js diagram and its 2D fallback, the two
artefacts, the rulebook wiring, the n8n shadow export and the asset links are the research branch's own code, moved
rather than rewritten, and `lib/backtesting_native.js` gains two readers: `staleInputs()` lists every row the engine
refused with the reason (including prints that carry a date but no time of day, so they are unclocked at the 05:00
cutoff) and `voteRegister()` prints the recorded vote symbol per direction row with its state, whether it counted and
a tally. The tab prints those and E5's own deadband sentence and deliberately prints no family `net_score`, because
the artefacts store one vote symbol per book row and a computed net would be the tab's arithmetic rather than the
run's. Read back at 1440 and 390 pixels through `tmp/probe-acceptance.js`: `2026-10-12` is a miss with EUR/USD
`-0.3194%`, `2026-10-09` is excluded from directional accuracy with E5 `abstained`, the refused rows
`live.f5-dxy-delta` and `risk.usd-safe-haven-demand` named with the unclocked reason, 2 rows unable to vote, no page
error and nothing wider than the phone. The phone needed one layout change: below 620 pixels the vote and fail-safe
tables become stacked cards and `.bt-canvas` holds its canvas absolutely at `inset: 0` so the wide drawing buffer can
no longer stretch the panel. Guards: `tests/backtesting_native.test.js` 13/13 and
`tests/backtesting_native.browser.test.js` 7/7, the browser file now asserting that no section, panel, table or
wrapper overflows 390 pixels. Triage of the full suite: the six failures left over - `site_nav_consistency` 3 of 5
(same one stale `index.html` in both trees), chart pan, chart zoom, `backtesting_development_release` and
`research_library.browser` - reproduce in a clean worktree of `origin/main` `4b6423b0`; the two that did not,
`refresh_progress` and the research-library registry hashes, were stale working-tree copies of six
`data/live-trading*.json` snapshots and two backtester artefacts, restored from `HEAD` and now 26/26 and 41/41.
Nothing published yet: the commit, the PR and the live read-back are the remaining steps. Published afterwards the
same evening: PR #6, `main` at `a289a259` with the work as `cd5ce545`, after a rebase onto `main`'s architecture-map
commits - `index.html` and `script.js` carry both sides, the map's `ensureSystemMap()` and `system-map.css` beside the
backtesting scripts and render block, the three map suites 16/16 and `backtesting_native` 20/20 after the union. The
rebased full suite reads 914 tests, 902 pass, 8 fail: the six that already fail on `origin/main`, plus two that read the
published feed files and the clock - `live_trading_publication_monitor` 1 of 10 in the parallel run and 10/10 alone,
`refresh_progress.browser.test.js` 1 of 26 in the run, 1 of 26 alone and 2 of the same 26 in the clean `origin/main`
worktree at the same moment. Read back from the live site at 1440 and 390 pixels, by the menu link and by both deep
links: `2026-10-12` a `miss` with EUR/USD `-0.3194%` and E5 `passed`, `2026-10-09` `excluded` with E5 `abstained`, the
refused rows `live.f5-dxy-delta` and `risk.usd-safe-haven-demand` named with the unclocked reason, a tally of 3
bullish, 2 bearish, 4 flat and 2 unable to vote, the map in WebGL, no page error and no 390-pixel overflow; evidence in
`tmp/live-acceptance/` and `tmp/live-probe-out.txt` (both ignored).

2026-11-15 afternoon (the blind lane published beside the other two, and its feed task made able to write) -
FTMO 3 now reads on the published dashboard like the other two lanes: its own strip, `Live L2L Blind · Connected`
in the connected tone rather than the active one, its own lane tab and card, and `data/live-trading.blind.json` in
the same commit as `data/live-trading.json` and `data/live-trading.account2.json`. The account's one closed trade -
the owner's BTC connection test of 14 Nov, `tech-conn-test-ftmo3`, #200523930, +0.32 net, 151 s - shows as `Kind:
Connection test` in the closed-trades table and in the account balance, and the note above the table says its net is
in the balance and excluded from the Blind win rate, trade count and expectancy, which stay at zero. The lane had
written nothing since 13:35Z because its feed task was registered without a principal: the scheduler stored it at
`Limited`, the unelevated Administrator token's `BUILTIN\Administrators` is deny-only, and every scheduled run died
with `EPERM ... C:\ftmo3\tmp\live-trading-feed.log` while the same command over ssh wrote it - the fault
`VPS_DEPLOYMENT_STATUS_20261024.md` §14.2 records for lane 1. `scripts/register-live-trading-feed-task.ps1` now
takes `-RunLevel` (default `Highest`) and `-RunAs`, resolves the account from the token and translates it to a SID
before anything is unregistered (the first attempt took `USERDOMAIN`/`USERNAME`, empty over ssh, and the
registration had already removed the task by the time it refused), and reads the stored run level back as
`task_run_level`; lane 3 returns `Administrator` / `Highest` / `LastTaskResult 0` and wrote a fresh snapshot at
`14:00:20Z`. Published `27967f28` at `14:01:00Z` with all three lanes and `validate_error_count` 0, then `35bc8b03`
to carry the lane's `blind: true` into the published row, which the loader had normalised away. Read back on the
hosted page at `14:2xZ` with the lanes walked `ftmo-3 -> ftmo-2 -> ftmo-1`: badges `Connected`, `Active`, `Active`;
tab bodies 5, 47 and 78 rows; no other lane's login on any card; no page error. Focused suites 25/25, 43/43, 77/77;
the browser suite's 5 failures are the same 5 that fail at `8a3361e6` in a clean worktree with the same
`node_modules`. Record: `docs/live-trading/LANE3_BLIND_ON_DASHBOARD_20261115.md`. Still unarmed:
`LiveTradingTraderTick-ftmo3` is `Disabled`, no order was sent, and no rule, grid, size or other lane moved.



2026-11-13 evening (both corner strips name the model and state three words, published) -
`Live L2L Directional` and `Live 0.5L2L Directional` are page constants again and each strip says one of
`Active`, `Stale`, `Paused` beside the name, the reason living on the tooltip; `liveTradingLaneWord()` is the one
rule the lane card and its selector pill both read, so the two agree by construction. Found while reading the
strips back: the widget behind the second strip dated the heartbeat with the browser's clock, which dates the
commit rather than the run, and so read `Stale` beside a card that said `Active` whenever the last publish was
fifteen minutes old; it now dates the record at the lanes document's `generated_at_utc`, keeps the sixty-minute
copy ceiling and separates `no run for` from `no publish for`. Shipped on `main` as `4f871da8` with the
cache-buster `20261113-lane-state-clock`; the published page read back at 18:30Z with both strips green, both
cards and pills `Active`, no page error and the served files byte-equal to the commit. Full `npm test` 867 of
876, the 5 failures reproduced on `origin/main` `843317ba` in a second worktree. No trading change: no lanes
semantics, no config, no workflow, no order.


2026-11-12 evening (lane 2's crossing gate tightened to the owner's ruling, and deployed to `C:\ftmo2` at `21:49Z`) -
the four statements of 2026-11-12 are now the code the second account runs: a crossing is the two newest completed M5
closes straddling the level (older at or on the near side, newer at least one point beyond, so two closes already
beyond arm nothing, which is the `14:01Z` gold shape), the confirming candle has to close after the window opens, a
window with no exit opens on the call's own `sealed_at` so a crossing that closed before the call was sealed cannot
place anything, and a limit withdrawn unfilled now ends its set-up (`call_ended: true` on the cancellation,
`ended_by: call` with `ended_call: withdrawn` and the ticket's level on the trade row) so the `06:11Z` replacements
cannot recur — a new call in the same direction needs a crossing of its own, and the ticket that follows is labelled
`replacement-of-unfilled-limit` rather than passing as a fresh entry. One confirming bar spends once, on both paths.
Levels, half grid, 3R, minimum size and the four-a-day cap unchanged; lane 1 passes no `--reentry-crossing` and reads
none of it (`tests/fixtures/lane1/run.golden.json` still matches). Tests: the two focused files 52 of 52, the trader
and lane-1 baseline files 75 of 75, `npm test` 874 with 865 passing, 4 skipped and the same 5 browser-page failures
that fail at `234e4d85` in a clean worktree (three in `site_nav_consistency`, one each in `live_trading_accounts` and
`live_trading_chart_zoom`, plus `research_library`). Deployed `f14f2ac7` the way §8 of the lane-2 doc describes -
detached, clean tree, `scripts/run-live-trading-trader.js` blob `7c3538e0…` and `lib/l2l_strategy.js` blob `e0e64c2b…`
matching `HEAD:`, state byte-identical `B491CFFC…`, backups in `C:\ftmo2\tmp\predeploy-20261112-gate`, run command
unchanged, lane 1 read only at `c5abd0ac` - and the first tick on it, `2026-11-12T21:51:31.431Z`, is
`nothing_to_place` with `checkout_head f14f2ac7` and the terminal at nothing. No natural post-exit re-entry has gone out
yet: BTCUSD long `73,657.005` (exit `06:55:37Z`) is the one pair the gate is judging, and at that tick both newest
closes, `21:40 @71,563.42` and `21:45 @71,599.20`, were far under the level, so `crossed: false` and the row states
both closes by time and price. §14 of `docs/live-trading/LANE2_REENTRY_FIX_20261111.md` holds the rules, the four test
cases and the deploy record. A second tick after that one, `2026-11-12T21:56:31.490Z`, reads the same head, the same
state hash and `nothing_to_place`, with the gate rolled on to `21:45 @71,599.20` and `21:50 @71,539.72`.

2026-11-12 later (the 06:11Z pair reconciled against history, and the crossing question answered on the one case there
is) - read-only audit, nothing placed or cancelled, lane 1 and the DXY page-nav work untouched. Both 06:11Z re-entries
are **replacement of unfilled limit**, not re-entry after exit: EURUSD `199819136` (placed `02:41:34.467Z`) and XAUUSD
`199803009` (placed `01:26:35.042Z`) had filled nothing, and were withdrawn at `06:06:35.909Z` / `06:06:34.887Z` with
`TRADE_RETCODE_DONE` because the call each was left for had expired six minutes earlier (the loop read yesterday's
seal, `direction: ""`, `live: false`); the new day's calls sealed `06:04:33Z`/`06:04:49Z` were read at `06:11`, so the
same levels went back as `199851757` (`06:11:36.672Z`) and `199851758` (`06:11:37.465Z`). Those two then died unfilled
as well - EURUSD at `06:31:34.610Z` because the `06:15:07Z` call reads `NO_CLEAR_BIAS`, XAUUSD at `07:16:34.756Z`
because the ask reached the 3961.81 take-profit with the limit still working - so 2026-11-12 placed four tickets, filled
none and holds no position; the `null` exit and crossing on those rows are the truth of a replacement. That corrects
the reading in the entry below, which called them a plain put-back. On the crossing question: no filled exit since
`2026-11-11T17:51:30Z`, so the newest re-entry-after-exit is still the `14:01:35.317Z` XAUUSD one, and price really did
cross the line there (13:40 bar `o 4034.87 l 4032.00 c 4032.82` after 13:35 closed 4034.86, then 13:50 close 4032.52
after 13:45 closed back above), so the "closed beyond twice" worry does not show up in the case there is. The narrower
finding worth a ruling: the gate takes *any* close beyond since the exit, so at `14:01:35Z` the newest close, 13:55 at
4037.84, was already back on the near side. Live candidate now is BTCUSD long 73,657.005 (exit `06:55:37Z`, 0 of 157
closes above the level, price 71,721). `§13` of `docs/live-trading/LANE2_REENTRY_FIX_20261111.md` holds the table and
the numbers; `tmp/host/crossing-report.ps1` prints the report for whichever row carries an exit.

2026-11-12 (lane 2's two re-entries sent overnight, and the four facts moved onto the row that sends one) - the lane
sent two re-entries nobody was watching, both on `2026-11-12T06:11:32.462Z`: EURUSD short at 1.108345 (ticket
`199851757`, stop 1.109047, target 1.10624, 2.9986 to one) and XAUUSD short at 3997.55 (ticket `199851758`, stop
4009.463333, target 3961.81, exactly three to one). Both rows carry `last_exit_utc: null` and `crossing: null` because
neither level had been left - the trade was still the pair's own and its ticket simply went back, which is the second
kind of re-entry on this lane beside the 14:01Z crossing one. The gap that exposed: the four facts lived only on
`rule.rows[].trade`, so the placement row that actually sends the order had the level and the three prices but not the
exit or the candle. From `71680af8` the trader writes `last_exit_utc` and `crossing` on the placement too, as `null`
where the level never left, so one row states the previous exit, the M5 crossing, the fixed level and the sent prices.
Lane 1 is untouched (`tests/fixtures/lane1/run.golden.json` still matches) and the two new assertions sit in
`tests/live_trading_lane2.test.js` and `tests/live_trading_trader.test.js`. `npm test` runs 869 tests with 859 passing
and 6 failing: the 4 pre-existing ones plus 2 in `backtester/tests/site_nav_consistency.browser.test.js` that name
`usd-layer1-backtester.html` as the page out of step with the partial, which `4c5222e8` (a DXY.cash research commit)
changed and which fails the same 2 of 5 when run on its own. Deployed to `C:\ftmo2` at 10:59Z the same way as before -
detached at `71680af8`, blob `7ebf3348…`, sha256 `025f5157…`, state byte-identical `b491cffc…`, backups in
`C:\ftmo2\tmp\predeploy-20261112`, run command unchanged, lane 1 read only at `c5abd0ac` - and the first tick on it,
`11:01:31.775Z`, is `nothing_to_place` with head `71680af8` and the terminal at nothing. Open: BTCUSD 73,657.005 long is
the live candidate (exited `06:55:37Z`, market 73,420.77, the far side, so skipped until price returns), and US100
28,163.82 is no longer waiting on price - its call ended at `06:11:34Z`, so that level's turn is over. §12 of
`docs/live-trading/LANE2_REENTRY_FIX_20261111.md` holds both.


2026-11-11 (lane 2's re-entry named, lane 1 left alone) - the owner answered the open question the other way round
from a code change: lane 1 keeps everything it has (no crossing gate, its own put-back wording, its own checkout and
task), and lane 2's ticket is called *a re-entry order at the same fixed level* on the page and in its notes. Both
ladders stay fixed - the marked lines and the half grid's midpoints are the prices they already are - so a re-entry
goes back on the level the trade was triggered at with the next marked line as its target at three to one. The word
now comes from one place: `ticketKinds(trades, { rMultiple, reentryLabel })` in
`lib/live_trading_performance.js` takes it from the caller, and `liveTradingReentryWording(view)` in `script.js`
states lane 2's `re-entry · fixed level` and lane 1's `put-back`; `kind` stays the stable key, and the three
historical bitcoin rows keep `put-back · 5R` (the owner's earlier call, now pinned by a test). The next natural
re-entry is now checkable from one log row: `trade.last_exit_utc` (new - the instant the window opens, null where
the newest ticket never filled), `trade.crossing.bar_time_utc` (the candle that re-armed the level),
`trade.trigger_level` (the fixed entry) and `placements[].{entry, stop, target, r_multiple}` (what was sent). §11 of
`docs/live-trading/LANE2_REENTRY_FIX_20261111.md` holds the ruling and the table of where each fact is written;
`npm test` runs 869 tests with the same 4 pre-existing browser/DOM failures. The revision was deployed to `C:\ftmo2`
the same evening at 20:55Z, lane 2 only - detached at `1858d675`, blob `b462c531…`, state byte-identical
(`45ce889d…`), the run command unchanged, lane 1 read only at `c5abd0ac` - and the first tick on it,
`20:56:32.273Z`, states `last_exit_utc` on all four trade rows. §11 of the doc also states the 14:01Z XAUUSD re-entry
already sent under the fix (exit `01:34:15Z`, crossing `13:50:00Z` at 4032.52, level 4033.29, entry 4033.29, stop
4045.203333, target 3997.55, exactly 3 to 1) and the US100 row that is waiting for price to return to 28,163.82. The
served page was read at 21:12Z and is byte-for-byte `origin/main:script.js` (blob `50c2079f…`), carrying both lanes'
wording, so the ruling is what a reader's browser runs.

2026-11-11 (lane 2 deployed at `3a2e6566`, the 04:31Z put-back answered, lane 2 now re-arms only on a fresh
crossing) - the 3R put-back fix was deployed to `C:\ftmo2` from the project workstation with the key at
`.local\vps-access\id_ed25519`, lane 2 only: detached at `3a2e6566`, `git status --short --untracked-files=no` empty,
and the deployed `scripts/run-live-trading-trader.js` is the commit's own blob `136fa60f…` (sha256 `36540ed4…`). The
first tick on it read `2026-11-11T09:36:32.261Z`, `status: nothing_to_place`, `armed: true`, `checkout_head:
3a2e6566`, `terminal: {0 positions, 0 orders, 0 of ours}`. Lane 1 was read and not touched: `C:\live-trading\runtime`
is still `c5abd0ac` and its published heartbeat still reads `nothing_to_place`, `armed: true`. The one tracked file
the checkout had to give up was `data/live-trading.json`, the lane's own regenerated snapshot; a copy of it, of the
state, of the status and of the run command was kept in `C:\ftmo2\tmp\predeploy-20261111` first, and the state, the
working orders, the 0.01 sizing and `--max-per-day 4` were not touched.

The 04:31Z bitcoin put-back the first audit could not explain opened new exposure rather than replacing an unfilled
order: the position before it (199488169) closed at its stop at `04:19:18Z`, the new limit (199500177) was placed at
`04:31:34.841Z`, filled at `04:57:20Z` and closed at `06:11:35Z` for `+1.69`, and the signal carried on it was the
`2026-11-10T20:45:00Z` bar the trade was originally opened on. No closed M5 candle had finished above 73,657.005 in
between - 04:25 closed 73,650.31, and the 04:30 candle was 21 seconds old when the tick read it. That is a fault
against the second half of the permanence ruling ("re-armed when a 5m candle deviates at them again"), which the code
never implemented.

So lane 2 now asks for it: `strategy.crossedSince` in `lib/l2l_strategy.js`, `--reentry-crossing` threaded through
`tradeCycles`/`tradeCycle`, `reentry: "crossed"` in the heartbeat's `strategy` block, and `-ReentryCrossing` in
`scripts/register-live-trading-trader-task.ps1`. Lane 1 passes nothing and is unchanged. Six new tests - three in
`tests/l2l_strategy.test.js` (the window, the one-point margin, a forming candle, a short, an unstated window) and
three in `tests/live_trading_lane2.test.js` (the 04:31Z case as a rule, the crossing that re-arms the level, and the
same account with no flag) - hold it; `npm test` runs 864 tests with 5 failures, all of them the pre-existing
browser/DOM ones (the disabled-lane tone test fails on `3a2e6566` with these changes stashed, and the nav/render/tab
ones are the same as before).

The correction went to the host the same day, at 10:35Z: `C:\ftmo2` detached at `126f1674`, the deployed runner the
commit's own blob `cd5797fa…` (sha256 `de3902fc…`, matched three ways - the commit, the checkout, this workstation) -
and `--reentry-crossing` added to the run command, whose previous copy is in `C:\ftmo2\tmp\predeploy-20261111`. The
task was not restarted. The first tick on it is `2026-11-11T10:36:31.930Z`: `nothing_to_place`, `armed: true`,
`checkout_head: 126f1674`, `strategy.reentry: "crossed"`, nothing open, `--max-per-day 4` still the cap, and the state
file byte-identical to the pre-deploy copy. Lane 1 still `c5abd0ac`, still touching nothing. The full account, with
the broker times and both revisions, is §10 of `docs/live-trading/LANE2_REENTRY_FIX_20261111.md`.

2026-11-11 (lane 2 put-backs fixed to the lane's own 3R on the half grid; the day audited; dashboard labels the
kinds) - the 5R finding of lane 2's first day is fixed in `scripts/run-live-trading-trader.js`: `tradeCycles` /
`tradeCycle` now take the run's `grid` and `rMultiple` and pass them to `strategy.reentryPlan`, so a ticket put
back at a standing trade's level is priced exactly as a fresh one - half grid, three to one, stop 73,414.53 on the
bitcoin ladder instead of 73,511.52. Lane 1 is untouched: it passes neither flag, the defaults are its five to
one on the marked ladder, and the new tests assert both lanes on long and short put-backs. Reverting only the
runner leaves the two lane-2 put-back tests red, which is what makes them regression tests rather than
restatements. `lib/live_trading_performance.js` gained `ticketKinds`, and the hosted Live Trading tab now prints
a Kind column (`fresh` / `put-back` / `put-back · 5R`) with the measured multiple in the row's title, counts the
same labels in the performance panel, and states the balance-versus-sum explanation beside the closed trades.
The audit of the three bitcoin put-backs is in `docs/live-trading/LANE2_REENTRY_FIX_20261111.md`: two of the
three placements had a fresh crossing of 73,657.005 immediately before them and the third had none, none of them
was placed after the trade had ended, and no lane-2 path reuses a spent signal - the put-back's exception to the
spent-bar guard is by design and the ended-trade guard is now held by a test. `npm test` runs 857 tests with 4
failures, all of them the same pre-existing browser/nav failures seen on a clean `main` (the subset of 10 that
fails without these changes). **Not done**: the deploy to the host - this session had no SSH key for
158.220.87.240, so the release is committed and pushed and section 8 of the document is the three commands to run on
the VPS. The owner's open questions are unchanged and listed there.

2026-11-11 (lane 2's first day: seven trades closed, net −$13.49, one live finding; release `4d93757d` unchanged) - lane
2 traded the whole first day unattended at 0.01 lots and every send came back `TRADE_RETCODE_DONE`. Seven positions
closed: US100.cash +1.32 to its target, BTCUSD −2.75 to its stop, XAUUSD −10.80 to its stop, US100.cash +1.37 to its
target after a breakeven move, then three BTCUSD re-entries at −1.90, −1.94 and +1.21, the last one closed by the loop
itself at 06:11Z when Layer 1 turned `BEARISH_LEAN` for BTC and NQ together (that run also took back the unfilled
US100.cash buy limit). Balance 10000.00 → 9986.48; the Prague day has spent all four of its placements (EURUSD 23:51Z,
US100.cash 00:51Z, 03:11Z, 06:46Z) and the three BTCUSD tickets are re-entries, which the cap excludes - so every tick
since 06:46Z reads `nothing_to_place` on the cap rather than on the ladder. At 07:56Z the account holds one EURUSD short
whose stop is at breakeven (2R reached at 06:36Z) and one working US100.cash sell limit. **Finding, not fixed**: the
three re-entries were priced at 5R rather than the lane's 3R, because `scripts/run-live-trading-trader.js` line 910 calls
`strategy.reentryPlan({ symbol, side, entry: trigger, levels, point })` without the `rMultiple` every fresh plan gets and
`lib/l2l_strategy.js` defaults it to `REWARD_R_MULTIPLE = 5`; the same ladder therefore put their stop at 73511.518
instead of 73414.527, and two of the three stops are what the market then hit. Two stop moves were refused before
sending for a different reason and correctly: the 2R touch of 73999.42 had already come back below the entry when the
next tick read it, and a buy stop cannot sit above the market, so nothing was sent and no rung was spent - a trade that
touches 2R and returns can end unprotected. The day's tickets, timings, arithmetic and both findings are in
`docs/live-trading/LANE2_ARMED_20261110.md` §8.

2026-11-10 (lane 2 armed at the minimum lot; three limits sent; release `4d93757d`) - the owner confirmed the half-grid
/3R ruleset and authorised live trading on FTMO account 2 at the smallest broker-permitted size, so
`LiveTradingTraderTick-ftmo2` was re-registered with `-Arm` at 20:46Z and is now trading unarmed no more. The rules were
checked against the deployed code rather than the prose: `lib/l2l_strategy.js` `halfGrid` (line 125) inserts one midpoint
between every adjacent marked level and `gridLevels` (149) makes that the only list the reading uses, so every marked
line and every midpoint is both a trigger and a target through `ticketGeometry` (232), where `risk = reward / 3`; the
crossing is still the newest *closed* M5 bar finishing beyond a line the bar before it had not, in the call's side;
`--max-per-day` counts *placed* trades in `Europe/Prague`, excludes refused attempts and excludes re-entry put-backs at a
standing trade's trigger level; a signal bar is spent once by `symbol|signal_time_utc`, so a fresh crossing after a
take-profit - the same level included - is a new signal on the same day but the same candle never becomes two tickets;
the hold is the rule's own one ticket per pair with no cap across pairs, and the stop rungs are breakeven at 2R and a
trail from 3R kept three times the placement risk behind the furthest price. Terminal 2's probe at 20:45Z reported
`volume_min` 0.01 / `volume_step` 0.01 for EURUSD, XAUUSD, US100.cash and BTCUSD (`trade_mode full` on all four), and the
order path needs no number to hit that: the trader passes no `--lots` and `live-trading-order.py`'s `resolve_volume` takes
the symbol's own minimum, so every ticket is 0.01. The pre-arm checks passed on the account itself - `***841` on
`FTMO-Server3`, terminal `...MT5 Terminal 2` connected, `account.trade_allowed` and `trade_expert` true, magic
`20261005`, identity file matching, feed 20:41:31Z fresh, calls sealed 18:57Z all ACTIVE - so **no credential step was
needed**: the login is a trading session, not the investor password. The registration is stage 7 with two corrections
now edited into the runbook itself: `-Published C:\live-trading\publisher` (the publisher's checkout, where the calls and
the ladder live) and the host's own `-HiddenRunner` under `C:\Users\Administrator\`. The armed ticks then did the rest:
20:46:30Z `nothing_to_place`; 20:51:32Z BTCUSD buy limit 73657.005 / SL 73414.526667 / TP 74384.44 (order 199440753,
`TRADE_RETCODE_DONE`); 20:56:32Z US100.cash buy limit 27751.59 / SL 27705.786667 / TP 27889 (order 199441238, DONE, and
filled at 27750.88); 21:01:32Z XAUUSD sell limit 4033.29 / SL 4045.203333 / TP 3997.55 (order 199442155, DONE). All three
are 0.01 lots, magic `20261005`, `l2l-rule-<asset>`; BTCUSD's *entry* is a midpoint with a marked target, US100.cash's
*target* is a midpoint from a marked entry, XAUUSD's entry is a midpoint - the half grid working in both roles, each stop
exactly one third of that ticket's distance. The publisher's 21:11:02Z run (`dc9a849c`) published both lanes and the
hosted page read headlessly at 21:14Z shows FTMO account 2 tone `live`, "Live · armed", feed inside the window, "LOADED
RULES half grid · 3R · magic 20261005", "EFFECTIVE CAP 4 a day, as the last run recorded it", identity verified, plus the
filled US100.cash position and both working limits; lane 1 still reads `armed`/`nothing_to_place` with its own heartbeat
and code hash untouched. Three of the four daily placements are spent, EURUSD is the remaining slot, and the deployed
configuration, sizes, checks and tick evidence are recorded in `docs/live-trading/LANE2_ARMED_20261110.md`.

2026-11-10 (lane 2 goes live unarmed on `main`; release `4d93757d`) - lane 2's FTMO 2 half-grid/3R release is merged
and deployed: `C:\ftmo2` runs detached at `4d93757d`, its chained feed+trader task `LiveTradingTraderTick-ftmo2` exits
0 every five minutes with `"armed":false`/`"status":"planned"` and no journal write beyond the read-only `status` line,
and the publisher's 20:12:34Z run (`e6673432`) published both lanes in one commit: `data/live-trading-lanes.json` reads
ftmo-2 `published`, `***841`/`FTMO-Server3`, half grid at R3, magic `20261005`; `data/live-trading.account2.json` holds
the four-instrument snapshot; `data/live-trading-trader.ftmo-2.json` says `armed:false`. The scheduled route failed on
its own for two hours and the wrapper was innocent: a throwaway probe task capturing the scheduled run's stderr named
`EPERM ... open 'C:\ftmo2\tmp\live-trading-feed.log'`, because a `Limited` task token has `BUILTIN\Administrators`
deny-only and a fresh `C:\ftmo2` carries no grant for the account where lane 1's `C:\live-trading\runtime` does;
`icacls C:\ftmo2\tmp` and `C:\ftmo2\data` granting `VMI3697641\Administrator:(OI)(CI)F` fixed it and the next scheduled
run exited 0. On the publish side the host supplies lane roots through the ignored
`C:\live-trading\publisher\config\live-trading-lanes.local.json` (`lane_roots` `ftmo-1` `C:\live-trading\runtime`,
`ftmo-2` `C:\ftmo2`) written without a BOM, since the publisher force-resets its checkout and neither lane runs from it.
`docs/live-trading/LANE2_VPS_RUNBOOK.md` gains both records, including the correction that `-Published` names the
publisher's checkout rather than `C:\ftmo2\data`. Nothing was armed: lane 2 sent no order, lane 1 still reads
`armed:true`/`nothing_to_place` on its own heartbeat, and the hosted page serves the new lanes document.

2026-11-03 (the reversion fix is accepted and the lane closes; next is F2 stage 1) - the owner accepted `f2951330` as fixing the reported reversion and closed the lane, deciding that the hosted store stays authoritative for uploaded results with the committed registry as the historical fallback, so the store's rows are not mirrored into `data/research-library/documents.json`; they run one final phone check of the three VIX stages after a background refresh, and nothing further changes unless that check finds a fault. No code, asset, cache-buster or store row was touched to close it - the deployed implementation, the four guard runs and the live verification stand as recorded. The next priority is stage 1 research on `usd-factor-live-f2-us-2y-delta` (`live.f2-us-2y-delta`, topic `usd-topic-front-end-rates`) using the existing prompt, and it was prepared rather than launched. Checks, all read-only and all done before recording it: the stage 1 prompt `docs/research/factors/usd/live-f2-us-2y-delta/01-research-prompt.md` is 22,242 bytes with sha256 `f758c034e1ecc3f550733faa54a6fa2a01bda14cb78fdb4dd095a1605e6fe85c`, matching the catalogue's recorded hash exactly; all three of the chain's prompts carry template `research-prompt-v3.2.0` and each still matches its recorded sha256; the contract the prompt names - USD North Star v2.0, `docs/research-library/USD_North_Star_Model_Contract_v2.md` - is 7,272 bytes with sha256 `e39e13098829fd2f61e53a8430277bcbf04ba103b8ef9f93b914847c19e8369f`, the same full string the prompt quotes; and an `op=documents` read through the page's own access gateway returned 4 rows in the private store - `usd-factor-live-f1-vix-level` 3 rows (the three stages the earlier lane verified) and `usd-factor-live-f5-dxy-delta` 1 row - with none on `usd-factor-live-f2-us-2y-delta`, while the committed register carries only the baseline-audit brief `usd-brief-f2-us-2y-delta`, so a first research upload cannot collide and lands as stage 1 version 1. The owner pastes the prompt into their own fresh session and uploads the return themselves; no automated research run was started, nothing was dispatched from the dashboard, and no billing or safeguard setting was read or changed. Stages 2 and 3 stay out of scope for this lane.

2026-11-03 (a completed chain reverted to the registry about a minute after opening it) - the owner reported that the finished VIX chain went back to its registry reading while they were looking at it. Reproduced read-only on the published page before any change: opening `usd-factor-live-f1-vix-level` read all three stages from the store (`d7b8eb40-…`, `5d51a6ac-…`, `60494b47-…`, pill `UPLOADED`), and running the function the dashboard's 60-second timer runs moved stage 1 to the register's id `usd-baseline-audit-01-vix-usd-report`, stage 2 to `awaiting_upload` and stage 3 to `not_started` - 3 of 4 scripted checks failed, with nothing uploaded, deleted or edited. Cause: `loadDashboard()` assigned the page's registry copy wholesale from `data/research-library/documents.json`, the committed register, which never carries a private-store row, while the store's rows had been written into that same object, so every tick hid them and then discarded them; unordered reads were the second fault, since a slow registry read or an upload's follow-up could settle after a newer one and win. Fix in `f2951330`: `lib/research_library.js` gains `mergeDocumentRecords` and `mergeDocumentLayers` (newer version wins, a blank field is filled from the older record, every version either side names is kept), and `script.js` holds the store's rows in their own map, layers them over every registry read, numbers its reads so a late read cannot replace a newer answer, and routes every writer of the registry copy through `researchLibraryApplyDocuments`; cache-buster `20261103-stored-chain-v1`. Guards: library unit 39/39 with 3 new tests, a new browser reversion scenario that fails on the previous `script.js` at "a background load must not revert any of the three stages" and passes on this one while covering navigation, a second background load and a page reload, focused suite 46/46, and 51/51 with the live-trading lamp test after the rebase onto `1964d63f`. Live verification after the deploy: published `script.js` `0a483e16a636…` (1,040,428 bytes), `lib/research_library.js` `627c903bebdb…` (77,062 bytes) and `index.html` `56d87bba201e…` identical to the commit's blobs, new cache-busters served, and the same scripted check now passes 4 of 4 - all three stages keep their stored ids across a background load, stage 3 still offers both parents - and, in an 80-second soak with the dashboard's own 60-second timer firing a real tick, still read `delivered` with the same three ids. No document's bytes, id, version or hash changed, no row was edited, added or removed, and no factor status, weight, threshold, prompt, chain association or live call moved. Detail in `docs/research-library/BACKGROUND_RELOAD_REVERT_20261103.md`. Closed on the owner's acceptance, 2026-11-03, with the implementation preserved as deployed: the hosted store stays authoritative for uploaded results and the committed register stays the historical fallback, the store's rows are not mirrored into the committed register, and the owner runs one final phone check of the three VIX stages after a background refresh. Still open with the owner, untouched by this repair: whether the register's review column flips to delivered after adjudication.

2026-11-03 (VIX stage 2 read stale although its parent had not moved) - the owner reported the uploaded red-team flagged "Stale: an input changed" against `d7b8eb40-…` v1 `e4151937…`, the report that had been registered all along. Root cause, from the live store rather than from the page: the stage 2 row names its parent `usd-baseline-audit-01-vix-usd-report`, the committed register's id for the same 84,056-byte report, while the store rows that report as `d7b8eb40-ce08-48c3-9d2c-5bf94b7618bc`; and `lib/research_library.js` `chainStageState` turned the resulting absent `parent_version` into version zero (`Number(null) === 0` is finite), compared it as `0 < 1` and raised `stale_parent_version`. `parentVersion(rows, id)` only searches hosted rows, so a registry id in the parent column always came back null. Nothing had changed: bytes, ids, versions and hashes were all correct, and the store was not touched. Fix in `253d4f45` and `31ca320c`: an absent version stays unknown (`numberOrNull`), the parent name is resolved through the whole register (`documentsById`) so a registry id and the stored row holding identical bytes are the same input, freshness is decided by fingerprint when both sides record one and by version otherwise, `parent_unresolved` reports an unknown name without calling a stage stale, and `reviewed_version`/`reviewed_sha256` now report what the stage judged instead of `v0`; the page translates a parent reference to the stored row holding the same bytes before upload, and a later factor stage offers every earlier return for download, which the adjudication prompt needs (research report and red-team review together). Live verification on the published page, 14 of 14 PASS in a clean browser: deployed `lib/research_library.js` `534a11eafd8e…` and `script.js` `7980fb2b0677…` identical to the commits, new cache-busters served, red-team reads `UPLOADED` with no reassessment note, adjudication `AWAITING UPLOAD` offering both documents, research report downloaded 84,056 bytes `e4151937411e` and red-team 55,367 bytes `fa7e5f43602d` through the adjudication stage, unchanged after a reload. Both documents keep their bytes and hashes, no row was edited or added, research and red-team were not rerun, and no factor status, weight, threshold, prompt or live call moved. Repeat of the reading through the page's own code over the live rows now gives the VIX chain 2 of 3 with stage 3 awaiting its upload (it read 1 of 3 plus a stale flag before). Detail in `docs/research-library/STALE_PARENT_20261103.md`. Still open with the owner: whether the register's review column flips to delivered after adjudication, and whether the new rows are mirrored into the committed `data/research-library/documents.json`.

2026-11-03 (USD research programme resumed at `live.f1-vix-level`) - the owner resumed the existing chain instead of a new one, with stage 2 running in their own ChatGPT session and stage 3 next, so this step is verification and setup only: nothing was launched, uploaded, registered, deployed or published, and no factor status, weight, threshold, prompt, workflow or live call moved. The live store was read once through the access gateway with the page's own key: two rows in total, one on `usd-factor-live-f1-vix-level` (stage 1, v1, `d7b8eb40-ce08-48c3-9d2c-5bf94b7618bc`, `VIX_USD_Research_Report.md`, 84,056 bytes, sha256 `e4151937411eb1e9235c21e4942327b2d24486e405887d70a90a8f5367eb381d`, no parent) and one on `usd-factor-live-f5-dxy-delta` (stage 1, 47,576 bytes, `9048e897…`), so the VIX chain carries no stage-2 or stage-3 record and the incoming red-team has nothing to overwrite. The chain was then replayed through the page's own code - `lib/research_library.js` `chainProgress`/`chainStageDocument` over the committed registry merged with those live rows, the same merge `lib/research_upload_adapter.js` performs (`chain_id` taken from `topic_id`, `hosted: true`) - and it reads stage 1 `delivered`, stage 2 `awaiting_upload` with `parent=d7b8eb40… v1`, stage 3 `not_started`, `1/3`, `next=red_team`. Two simulated rows show the rest without touching the store: a stage-2 row (id, `parent_research_ref` = `d7b8eb40…`) reads the chain at `2/3`, moves stage 3 to `awaiting_upload` and makes the stage-3 attach list name both documents - research `d7b8eb40…` v1 `e4151937…` and the red-team row; a stage-3 row then reads `complete` `3/3` and the asset-level gate reports 24 pending factors instead of 25. The upload path was re-read rather than assumed: the stage-2 form is enabled without any sign-in because `available()` is `isConfigured() && (signedIn() || openAccess())`, the page passes `parents.researchRef` from the stage-1 card, the gateway needs a stage-2 `research_ref` matching `^[A-Za-z0-9._:-]{1,200}$` (a UUID passes), and it re-hashes the bytes, refuses non-text, over 1 MB, duplicate bytes for the same chain and stage, and caps the store at 40 uploads an hour. Both the stage-2 and stage-3 prompts are unchanged at their catalogue hashes (`ca00f07a…` and `0b045e67…`), and the stage-2 prompt's own instruction is to copy the stage-1 card's document id, version and sha256 into the return's identifier lines and to stop if the held copy hashes differently. One consequence worth recording: a hosted upload does not write `data/research-library/documents.json` and does not move the register's status columns, which are hard-coded per factor in `scripts/build_research_library.js` (`review_status: 'pending'`), so "review delivered" is an explicit edit plus `catalog --write` and the handoff rebuild when the owner asks for it, while the chain card reading complete follows from the store alone. Guards: `npm run research-library:check` clean, `npm run test:research-library` 42 of 42. Cleanup: the two read-only probe scripts used for the replay were removed from the ignored `tmp/rl/` and left no artifact anywhere else.

2026-11-03 (Research Library access: accepted and closed) - the owner accepted `7ca34b45` and closed the task, and the implementation is preserved exactly as it stands. Decisions taken, not to be revisited without the owner: the gateway architecture stays as it is; the browser gateway key is treated as public and not as an authentication secret; the server-side validation, append-only storage, upload limits and private bucket are all kept; no run-time key fetching is added, because it would not buy meaningful secrecy; the hidden sign-in code stays untouched for now; and nothing further is developed in this lane unless a security or functionality issue is identified. Research execution is the owner's priority from here and stays with the Research Coordinator.

2026-11-03 (Research Library: no research-account sign-in) - the owner asked for uploads and downloads to need no login, because the research-account sign-in was unreliable and blocking research. The store, the table, the registry, the SHA-256 rule and the stage associations are reused unchanged; what changed is the door. A Supabase Edge Function, `supabase/functions/research-library/index.ts`, is now the only code that touches the private bucket or the table, and it runs on the service key the function runtime injects, so no privileged credential is in the page or the repository and no RLS policy was loosened. The page calls four operations on it - list rows, upload one Markdown file, mint a short-lived private link, and a metadata-only status - and holds only a purpose-specific `RESEARCH_LIBRARY_KEY` (mirrored as `researchLibraryAccessKey` in `script.js`) which reaches nothing else and can be rotated in a minute; because the page is public that key is not secret, and the docs say so plainly. The function re-computes the fingerprint, assigns the version, enforces the parent shape of each stage, refuses non-text, over 1 MB and already-stored bytes, caps uploads at 40 per rolling hour, gives every row the library owner as `uploaded_by`, and cannot update or delete anything, so the archive stays append-only. Page side: `lib/research_upload_client.js` grew an open-access mode (list, upload, signed link) beside the untouched signed-in path, `lib/research_upload_adapter.js` now gates uploads and downloads on `available()` and draws "Open access" instead of a password form, and `script.js` configures the gateway and asks `available()` everywhere, while a page served from this machine that has its own service token keeps the offline developer path exactly as before. Deployed as `7ca34b45`, with the function deployed by `npm run research-library:deploy`. Live verification on the published page with no session at all, 18 of 18 PASS: a clean browser and a browser still holding a stale local-service endpoint and token both downloaded `VIX_USD_Research_Report.md`, 84,056 bytes, sha256 `e4151937411e`, through the gateway with zero loopback requests; the red-team stage's **Download inputs** returned the same bytes; a 239-byte Markdown file uploaded to `usd-factor-live-f10-equity-versus-usd` stage 1 read `UPLOADED` after a reload and downloaded back under its own name with the same sha256. Live refusals also checked: no key 401, binary bytes 415, stage 2 with no parent 400, a path outside the object pattern 400, existing bytes 409. The store read back at two rows, two objects and one member, both objects matching their recorded hashes, and nothing in trading, prompts, research history or billing was touched. Guards: upload client 22/22, upload adapter 21/21, library browser 1/1, full local suite 750/751 with the one failure the pre-existing `live_trading_levels_visibility` chart case. Open item: a check on the owner's own device.

2026-11-02 (Phase 2, Astra prompt audit) - All 78 USD prompts revised locally to v3.2.0 against North Star v2.0 on research/north-star-v320-20261102. IDs, paths, document links and registry preserved; 650 unit tests pass. All 78 catalogue hashes validate; 75 factor prompts preview through the existing dispatcher. Final-stage dispatch and full adjudication input packaging remain existing gaps. See docs/research-library/PHASE2_VALIDATION_V320.md and ASTRA_PROMPT_AUDIT_V320.md. No research, paid external API calls, publication or trading changes. Await user approval before publishing.

2026-11-03 (Research Library download repair, reopened and fixed at the cause) - the owner's device check failed with "could not be downloaded: Failed to fetch" on the committed VIX report, so the close-out of 2026-11-02 was premature. Root cause: the published page still had a loopback path. A click that did not resolve to a stored row called `researchLibraryDownloadDocument` and asked the local service; a browser that had used the local service earlier keeps `research-library-service-endpoint` and `research-library-service-token` in `localStorage`, so the page believed a service existed and asked `http://127.0.0.1:8791/health` and `http://127.0.0.1:8791/documents/usd-baseline-audit-01-vix-usd-report/versions/1`, both `net::ERR_CONNECTION_REFUSED`, and the reader saw that as a broken document. Reproduced against the published page with the real document before changing anything. Fix in `40533e0e`: `researchLibraryIsLocalPage()` keeps the loopback path only for a page served from `localhost`, `127.0.0.1` or a file, and on any other page a store-backed record is answered by the store - one fresh store read when the rows are missing, a sign-in prompt when signed out, an honest message when the read fails; a download whose page-side read-back fails still hands the browser the signed link, while a view stays strict. Guards: adapter 18/18, browser panel 1/1 with a new step proving a published page makes no loopback request, and a live probe with the real document. Live verification, every step PASS: stale-token browser - sign-in message, no loopback; signed-in throwaway member - `VIX_USD_Research_Report.md`, 84,056 bytes, sha256 `e4151937411e`, no loopback, again after a refresh without a second sign-in, and through the red-team stage's **Download inputs**; store read refused - honest message, no loopback. Store unchanged (two rows: `d7b8eb40-...` VIX 84,056 `e4151937`, `1b64468d-...` f5 DXY 47,576 `9048e897`; one member), the throwaway account removed, and no factor status, weight, threshold, prompt, chain association or live call moved. The adjudication stage of `live.f1-vix-level` has no red-team return registered yet and states "No earlier result", which is correct at that stage; its **Download inputs** control is the same one the red-team stage used successfully. Full local suite passes except the pre-existing `live_trading_levels_visibility` chart case, which fails identically at `44e4c070`. Open item: the owner's own device check.

2026-11-02 (Research Library download repair, close-out) - the owner accepted the structural fix and closed the issue. Decisions taken, not to be revisited without the owner: the chain card stays the single download location, so no download control is added to the registry record; no further development is done on this issue; the implementation is preserved as it stands. Deployment is `35023d8b` (client, adapter, `script.js`, cache-busters, tests, docs) with the read-back notes committed as `8afaf11d` and `9a7a0ea1`; the published `script.js`, `research_upload_client.js` and `research_upload_adapter.js` hash identical to the commit. Live read-back on the published page, every step PASS: an isolated member uploaded a completed document to `usd-factor-live-f10-equity-versus-usd` (row `8076dac0-…`, 554 bytes, sha256 `e2308b55cafa`), it read `UPLOADED` with the same record after two refreshes and downloaded twice at 554/554 bytes with that same sha256; a red-team return on stage 2 of the same chain was stored and the adjudication card named it and returned those bytes exactly (72/72, `3e45b8848d15`) through **Download inputs**; the existing VIX report downloaded at 84,056 bytes `e4151937…` and the f5 DXY report at 47,576 bytes `9048e897…`; no request went to `127.0.0.1:8791`. The run deleted its own rows, objects and account, and the store was read back afterwards at two documents, two objects and one member, both objects matching their recorded hashes. Storage, the committed registry, the v3.2.0 prompts, the 78 chain associations and every file hash are unchanged, and no factor status, weight, threshold or live call moved. The one open item is the owner's own check from their device; if it fails they will report the device and the error, and that report starts any further work. Nothing is outstanding in this lane, and research execution stays with the Research Coordinator.

2026-11-02 (Research Library download repair) - handoff. A completed document now downloads as the stored file itself. Root cause: a download was assembled in page memory and handed over as a blob link the page revoked seconds later, and any record the page had not merged from the store fell back to the loopback service at `127.0.0.1:8791`. Fix: the private link carries `download=<the uploaded file name>` so the store answers with a download disposition, the page reads the bytes once and re-checks the recorded sha256, then hands the link to the browser, which streams the original file; a registry record resolves to the stored record holding the same bytes, and a record whose bytes are not in the store says so plainly. Guards: upload client 17/17, adapter 16/16, unit suite 653/653, `research-library:check` catalogue/registry/repo hashes/chains/chain prompts ok. Storage, the committed registry, the v3.2.0 prompts, the 78 chain associations and every file hash are untouched, and no factor status, weight, threshold or live call moved. Live verification is recorded in `docs/research-library/UPLOAD_BACKEND.md`.

2026-10-25 (prompt v3.1.0 integration, session close) - saved and pushed, nothing outstanding in this worktree. `main` carries the port as `65ec66aa` (builder, catalogue, 78 prompts), `2f8b8f08` (deployment record and live read-back) and `1dbb28cf` (lane table closed, review recorded); `integration/research-prompt-v310-20261025` is at the same commit, and the live-snapshot commits pushed afterwards (`a831ae80`, `52543d52`, `1f9a81f8`) are data files only and leave the research files untouched, and this note is the commit on top of them. Re-checked at exit, not assumed: the live catalogue is 319,477 bytes with sha256 `aa249c41cb51eae8a9a25fba5db2c28ccbc5d477710daf7863a5279b197541a9`, byte-identical to the committed file, carrying `prompt_template.version` `research-prompt-v3.1.0` and USD `dispatchable` 25/25/78/25 with the other seven assets `profile_only`; the three live VIX prompts hash to `596a6530…` (16,598 bytes), `78d66cda…` (14,699) and `c2e7312a…` (16,119), exactly the catalogue's values, and `research-pipeline.js preview` reports the same `prompt_sha256` for the bytes it would send, so the manual copy and the automated dispatch read one file. Nothing was dispatched, published, uploaded or approved and no allowance was spent. Where it stopped: the bounded pilot is the automation coordinator's - stage `usd-factor-live-f1-vix-level` stage 2 (red team) against research version 1, whose registered object is in the canonical checkout's `.local/research-library/objects` (`e4151937…`, 84,056 bytes) rather than in this worktree; the final chain stays `locked` at `0/25` until all 75 factor stages deliver, and the owner's label-instrument decision is still open. Deferred, not started: asset-specific factor entries for the seven `profile_only` assets and the `mkdirSync` fix in `tests/usd_session_research_guard.test.js`. Evidence kept in ignored local folders: `.local/tmp/live-verify-v310-20261025.json`, `.local/tmp/vix-research-envelope.json`, `.local/tmp/preview-out.txt`, and the worktree's `verify-live-v310.js`. The canonical checkout was not touched by this lane and keeps its own uncommitted work, backed up read-only to `.local/tmp/canonical-dirty-diff-20261025.patch` and `.local/tmp/canonical-dirty-files-20261025.txt` so an exit loses nothing.

2026-10-25 (prompt v3.1.0 integration, integration lane) - handoff. DeepSeek's per-factor question work (`d6cff707`, `workstream/c-research-programme`) is integrated on `main` as a content port, not a merge: the branch is 1,526 commits behind `origin/main`, and taking its `lib`, `script.js` or prompt files would have reverted the hosted upload path, the `Uploaded` label, `original_filename`, the `GBP`-last asset order, the cited-brief prompts, the five evidence kinds and the five allowed conclusions. What moved is the content: each of the 25 factor entries owns its four questions in a `FACTOR_PROBES` block, a label keeps only its one or two shared questions, stages 2 and 3 re-ask the factor's own questions, gates are asked what they change about the call, and abstention is judged on accuracy, coverage and skipped sessions against always calling. The catalogue carries `prompt_template.version` = `research-prompt-v3.1.0` and `prompt_source.template_version` on every stage, and a derived `assets[].catalogue`: USD `dispatchable` (25/25/78/25), the other seven `profile_only`. The research review pass ran against the regenerated files: every stage of every chain carries that chain's own questions (0 missing), no question spans two labels, the two gate chains ask what they change, and the coverage-matched comparison is stated in the gate's questions. Guards: checks and `verify` clean; library unit 35/35 with three new guards; unit plus export 41/41; library plus pipeline plus handoff 66/66; `test:unit` 609 with 0 failures; the library browser test fails waiting for a download event and fails identically on untouched `origin/main`, so it is environmental. Registry: only `research-library-readme` moved, to version 12 (21,972 bytes, `85982bb4`), after correcting its stale prompt paragraph and asset order; the VIX report stays v1, 84,056 bytes, `e4151937`, and nothing was dispatched, uploaded or approved. Next: the automation coordinator takes the commit and the per-stage hashes in `docs/research-library/PROMPT_TEMPLATE_INTEGRATION.md`; the pilot's next eligible stage is `usd-factor-live-f1-vix-level` stage 2 against research version 1, the final chain stays `locked` at `0/25`, and the owner's label-instrument decision still blocks the seven other assets.

2026-10-25 (Astra integration, integration lane) - handoff. The automation coordinator's carrier evidence was fetched from `workstream/b-dashboard-interface` and integrated rather than re-requested: `eff87b6b` and `a122544e` on `main` add `lib/research_pipeline.js`, its CLI, 15 guards and `docs/research/pipeline/EXECUTION_ROUTE.md`, and `3ad0700a` makes the supervisor read the stages where the committed catalogue keeps them, on the factor chain. Against `data/research-library/catalog.json` it now reports 75 stages and 25 runnable rather than an empty plan, a topic with several chains refuses an unnamed stage with `chain_required` and takes `--chain`, and job keys and document ids come from the chain. Nothing was dispatched, so no allowance was spent and `documents.json` is unchanged; the VIX report is still the one delivered stage. The carrier claim was re-checked from this PC's artifacts (6,179 bytes, sha256 `0621219e`, byte-identical object, `gpt-6-astra` row, one dispatch in `usage.json`, 269,333 input / 1,632 output tokens, `auth_mode: chatgpt`), while the real factor chain, automatic allowance handling and PC-off execution stay unverified and are not claimed. Guards: pipeline 15/15; full suite 686 with 683 passing, the library browser failure being the fresh-worktree one and the two `refresh_progress` browser tests passing 26/26 alone at `f54b34f7` and here. Prompt ownership is reconciled in `docs/research/programme/LANES_20261025.md`: DeepSeek's lane owns the generator and gets `PROBE_SPEC_20261025.md`; the internal research and automation lanes are additional sessions, and the automation lane is stood down on the route question because its conclusion is superseded. GitHub sign-in remains a separate user-access task.

Last updated: 2026-10-25 (research programme)

2026-10-25 (research programme, round two) - handoff. The owner asked whether the four-step workflow, card instructions, conflicting deliverables and recommendation contradictions had actually gone from the prompts, and whether a useful directional finding was still allowed. The four-step and card text had not gone: it lived inside the dispatched brief and the step-2 brief, which the VIX stage-1 and stage-2 prompts reproduced word for word. Both prompts now cite their brief by path and sha256 and say its step language belongs to a workflow this chain does not use; the requirements only the brief carried are kept as two bullets; stage 1 falls from 25,290 to 16,156 characters and stage 2 from 19,048 to 13,473. A supported directional input or interaction is now the fifth allowed conclusion, explicitly unvalidated, in the generator and in `SHARED_CONTRACT.md`. The asset strip now reads `USD, EUR, GOLD, SILVER, NQ, BTC, WTI, GBP`. Two guards: the 51 deciding prompts must name all five conclusions, and no prompt may carry any of nine superseded phrases. Library unit 31/31, `test:research-library` 38/38 with the browser copy scenario, full `npm test` 664 with the two pre-existing live-trading browser failures. Preserved: VIX report v1, 84,056 bytes, sha256 `e4151937…`, and both source briefs untouched. Open: GitHub OAuth app by the owner, the Astra route question, the label instrument, and no copy of the brief text remains in any prompt - which is why the record now lives only in `docs/research/handoff/usd/v1/deep-research/` and in the catalogue's `prompt_source`.

2026-10-25 (research programme, interactive coordinator) - handoff. The Layer 1 factor programme is now specified, split into three owned lanes and re-audited, and everything below was verified from this checkout rather than quoted from earlier notes. Live on main: `docs/research/programme/` (README, SHARED_CONTRACT, INTERFACES, PROMPT_AUDIT_20261025), the cleaned generator `scripts/build_research_library.js`, the regenerated 78 prompt files with their catalogue hashes, and the new guard test in `tests/research_library.test.js`. What the audit found: the prompt set stated the session, the unresolved DXY label and the prohibitions correctly, but no prompt separated contemporaneous association from predictive evidence, none named incremental value beyond existing inputs, and none allowed exclusion, regime-only use or insufficient evidence as conclusions - zero occurrences across 78 prompts and zero in the generator. The fix is two authored blocks emitted into all six stage types plus the four permitted conclusions in the 51 deciding stages, one extra red-team attack in each red-team stage, and a test that fails if either block disappears. Regenerated with `catalog --write`; `chains --check` and `verify` clean and unchanged in substance (VIX research delivered, red team awaiting a file, adjudication not started, final chain locked at 0/25); library unit 30/30 and `test:research-library` 37/37 with the browser scenario. Preserved exactly: the stored VIX report stays `usd-baseline-audit-01-vix-usd-report` v1, 84,056 bytes, sha256 `e4151937…`, with its version and parent links, and no factor status moved. Lanes: `research-coordinator` (prompt templates, factor briefs, prompt generation) and `automation-coordinator` (Astra route, queue, allowance, hosted registration) are registered in the canonical checkout at `instructions_published_awaiting_worker`, with assignments in `docs/orchestration/assignments/` and isolated worktrees in `.local/worktrees/`, cut from `origin/main` `11cdb077`. The register row change sits in the working tree beside the strategy lane's pending dashboard-design row, so `projects.json` was deliberately not committed alone; the programme documents on main name both lanes, their scopes and their first actions, so the specification survives without the local register. Blocked or open, in order of what matters: no supported Astra execution route is established, so no machine run exists and none is claimed; the GitHub provider is still off in Supabase (`/auth/v1/settings` reports `github: false`), so the owner must create the OAuth app and enable it, or hand over a Supabase access token; after the owner's first GitHub sign-in the ownership-transfer SQL still has to run once; the USD label instrument and quote source are unresolved, so the session is defined but unmeasured; only USD has a catalogue, the other seven assets have nothing; and the catalogue's asset strip order still differs from the owner's expansion order by GBP's position. Nothing in this cycle touched a live call, weight, threshold, sign, MT5 path, workflow or data file.

2026-10-25 (GitHub sign-in, interactive coordinator) - handoff. The owner signs in with GitHub from now on, and the option is live on the published page. The account block draws **Sign in with GitHub** first and keeps the email and password underneath as the fallback; the button only sends the browser to `{project}/auth/v1/authorize?provider=github&redirect_to=<this page>` through `ResearchUpload.signInWithGitHub()`, so the GitHub client id and secret stay in Supabase and the page still carries nothing but the publishable key. A return that GitHub or Supabase refused is shown in plain words in the block (`provider is not enabled` gets its own sentence) and the error fragment is stripped from the address bar, so a second try starts clean. Cache-busters `20261024-research-upload-v6` and `20261024-research-upload-hosted-v10`. Published: `research/upload-live-20261024` was rebased onto `origin/main` (moved 76 commits, live-trading snapshots only) and pushed, so the code commit is `2c8b486f` (`4a8599b2` the gate check, `c98bf16c` the GitHub block, `b4d25b4d` the earlier final-chain work - the same content as `6aa59636`, re-cut on the newer base and therefore re-hashed, and this note on top of them), and the Pages build of `2c8b486f` finished `built` at 11:27Z with the live page serving the v6/v10 files and the GitHub button in them. Guards: upload client 16/16, adapter 14/14, `test:research-library` 36/36, full `npm test` 618/620 with the same two live-trading browser failures that reproduce with this work stashed. Verification with the local service stopped (nothing listening on 8791): `node scripts/research_library_page_check.js --mobile --provision` passed every step against the live page - sign-in, one file, **Uploaded**, the same record id after a reload, stage 2's parent byte for byte, View and Download - and the final chain still read `0/25` with `unlocked=false` and no upload form offered, so a factor upload left the real gate exactly where it was; the run removed its own row, object and account, leaving the store at its previous state, one member and the one VIX report (`usd-factor-live-f1-vix-level` v1, `VIX_USD_Research_Report.md`). Not done, and blocked on the owner: `/auth/v1/settings` still reports `github: false`, so the button returns the plain "not turned on yet" sentence; turning it on needs a GitHub OAuth app on `kevincreedycars-debug` with callback `https://eaolqbrlywczinfordvg.supabase.co/auth/v1/callback` plus either the Supabase dashboard or a Supabase access token, both written out in `docs/research-library/GITHUB_SIGN_IN.md`. A GitHub sign-in also arrives as a new Supabase user, so the ownership transfer recorded there - one membership row for that id, `uploaded_by` re-pointed on the VIX row, the placeholder account and its membership left alone, versions and parent links untouched - is run once after the owner's first GitHub sign-in. No factor status, weight, threshold, sign, call, feed or workflow was touched, and the gate stays at `0/25` for lack of factor evidence rather than lack of code.

2026-10-24 (hosted final chain, interactive coordinator) - handoff. The asset-level final chain no longer needs this PC. Its three stages go through the same private-store adapter as the factor chains: the `isFinalChain && !client` refusal is gone from the stage upload, and `researchLibraryStageUploadForm` no longer holds the chain back for the local service, so a signed-in member sees an enabled Register button for final analysis, final red-team and final adjudication. What the local service alone used to record - the factor input package a final stage judged - now travels with the return: the page sends every input document's id, version, sha256, role and role stage plus the time the package was read, `lib/research_upload_client.js` writes it into the hosted `notes` column behind the marker `research-input-package:v1` (the table has no column for it), and `rowsToDocuments` restores it against that version only, so a corrected version that recorded no package never inherits the earlier one. The page also reads the whole store once per signed-in session through the new `listAll()`/`refreshAll()` pair, which is what lets the factor chains and the final gate see stored adjudications without each chain being opened first; a read that fails returns `-1` and says so rather than showing an empty library as up to date. Final stage names are kept in the `kind` column (`final_analysis`, `final_red_team`, `final_adjudication`) because the hosted table's three stage numbers cannot tell the two chains apart. Guards: upload client 12/12, adapter 12/12 with the package round trip and a source guard that the final chain is not gated on the local service, `test:research-library` 36/36 including the browser test, `research-library:check` unchanged at `locked` `0/25`. Full `npm test` is 612/614 with the two live-trading browser failures reproduced with this work stashed. Not done: no hosted final-chain run exists yet, because the gate is closed at 0 of 25 factor chains and opening it would mean moving factor status; and the owner account is still `research-library@example.com`, which needs the owner's real address and a fresh password before a phone can sign in. The work sits on `research/upload-live-20261024`, which is 6 commits behind `origin/main` and has not been rebased or pushed; nothing in this cycle touched a live file, feed, workflow, weight, threshold, sign or call.

2026-10-24 (storage and phone handoff, interactive coordinator) - handoff. The upload fix is verified and now documented for someone running research from a phone with the PC off. Storage: bytes in the private Supabase bucket `research-documents` (project `eaolqbrlywczinfordvg`), rows in `public.research_documents`, access in `public.research_members`; GitHub holds the page, the provisioning script, the prompts and the registry metadata (document id, version, sha256, bytes, note) and never the bytes. Auth: the owner account `research-library@example.com` against Supabase Auth's email provider, which is the only provider enabled - no GitHub or Google sign-in - with the session kept in the browser and refreshed from the stored refresh token before every request, so one sign-in per device lasts. Independence: with nothing listening on `127.0.0.1:8791`, `npm run research-library:page-check:mobile` (iPhone 13 emulation) signed in, uploaded `TEST-RESEARCH-LIBRARY-UPLOAD-20261024.md` (554 bytes, sha256 `e2308b55cafa`) into `usd-factor-live-f8-fed-bias` stage 1, saw the pill go **Uploaded**, saw it stay UPLOADED after a reload with the same record id and without a second sign-in, read stage 2's parent and downloaded it byte-for-byte, opened View, saved Download under the uploaded name, contacted only the published site, the Supabase project and the two font hosts, and raised no page error; the desktop-width run reported the same, and both removed their row, object and disposable member in a `finally` block. Emulation is not a phone: file selection is scripted and iOS Safari's download handling is untested, so `docs/research-library/PAGE_CHECK_RUNBOOK.md` ends with a five-step check to do by hand on the phone over mobile data. VIX document: `d7b8eb40-ce08-48c3-9d2c-5bf94b7618bc` is the row id and `e4151937411eb1e9235c21e4942327b2d24486e405887d70a90a8f5367eb381d` the content sha256 of the same document - `VIX_USD_Research_Report.md`, 84,056 bytes, stage 1 v1, no parent - and the registry entry `usd-baseline-audit-01-vix-usd-report` carries the same sha256 and byte count. Local copies: **Download result** for one file, or `npm run research-library:export` with the service key for everything into the ignored `.local/research-library-export/` with a re-hashed manifest. Guards: export test 6/6, library 29/29, upload client 9/9, adapter 9/9, library browser 1/1. Store restored to one member, one document and one object; no factor status, weight, threshold, sign, live call, workflow, feed or committed hash moved.

2026-10-24 (live upload repair, interactive coordinator) - handoff. The published dashboard's Research Library upload was repaired at the cause rather than around it. Three things had combined to make a chosen file look like it did nothing: the stage form asked for a model or session label and refused the upload without it, the account block offered an email link to an owner address that has no inbox, and the page judged the session from an access token that expires after an hour, so a reader who signed in earlier in the day was refused with a message that read like a broken upload. The form now holds one file input and nothing else (`formFields: ["file"]` in the live check); the block signs in with the owner's email and password, remembers only the address in that browser, and no longer renders the email-link button; `lib/research_upload_client.js` refreshes the session with the stored refresh token before a request and signs out with an explanation only when that token is refused; a 409 from the bucket is treated as the bytes already being stored, so a retry finishes registration instead of failing; and the stage pill reads **Uploaded** (it read "Delivered"), carries the upload time with the file name, hash and version, and exposes `data-rl-view` as well as the download control. `docs/research-library/UPLOAD_BACKEND.md` records the flow, the messages a reader can see and a new section on checking the published page; the scripted fixture is registered as `docs/research-library/test-uploads/TEST-RESEARCH-LIBRARY-UPLOAD-20261024.md`, so the file the check uploads is a catalogued document rather than a stray local file.

Deployment: the work is on `main` as commit `32489f9b`, rebased onto the live-feed snapshot `470eb344`, and the published `index.html` serves `research_library.js?v=20261024-research-library-v5`, `research_upload_client.js` and `research_upload_adapter.js?v=20261024-research-upload-v3` and `script.js?v=20261024-research-upload-hosted-v8`.

Live check, run as a reader against `https://kevincreedycars-debug.github.io/trading-agent-dashboard/` with no local service: signed in from the account block, opened `live.f8-fed-bias`, and the stage read Not started. Opening Upload result showed one input (`file`) and no model field. Choosing `TEST-RESEARCH-LIBRARY-UPLOAD-20261024.md` and clicking Upload result flipped the pill to Uploaded about 1.3 seconds later and the page said the file was stored as stage 1 version 1, that the stage now reads Uploaded, and that no factor status, weight or live call had moved. A reload kept three chain cards with the stage still UPLOADED, showing the record id, `v1`, `sha256 f8df3674f6df`, the file name, `uploaded 24 Oct 2026, 15:28:25` and the private-store note. View opened those bytes in a new tab; Download saved 286 bytes identical to the chosen file under its own name and reported the fingerprint it checked. A second scripted run on `risk.vix-level-and-change-at-cutoff` timed the same in-place flip from click to Uploaded at 1.5 seconds. No loopback address appeared anywhere in the signed-in flow.

Cleanup: the check's row and object for `usd-factor-live-f8-fed-bias` (v1 of stage 1) and for the earlier scratch topic `zz-upload-check-20261024` were deleted, and the disposable account `upload-check-20261024@example.com` was removed from `public.research_members` and from auth. The private store now holds one member (the owner), one document - the real VIX research report `d7b8eb40-ce08-48c3-9d2c-5bf94b7618bc`, v1 of stage 1, `e4151937…`, uploaded 2026-10-20 - and one object. The committed registry, its hashes and every parent relationship are unchanged, and no factor status, weight, threshold, sign, live call, workflow or feed moved.

Guards: `tests/research_library.test.js` 29/29, `tests/research_upload_client.test.js` 9/9, `tests/research_upload_adapter.test.js` 9/9, `tests/research_library.browser.test.js` 1/1 (now asserting three View controls, adjudication disabled and research enabled), full `npm test` 600/602 with the two remaining failures in `live_trading_dashboard.browser.test.js` and `live_trading_rule_panel.browser.test.js` reproduced unchanged on a pristine `origin/main` checkout.

Next: the owner uploads the completed VIX red-team file through stage 2 of `usd-factor-live-f1-vix-level` on the published page, then adjudication through stage 3.

2026-10-20 (hosted-upload completion, interactive coordinator) - handoff. The Research Library now uploads from the published page itself. The private store planned on 2026-10-16 is provisioned in project `eaolqbrlywczinfordvg`: private bucket `research-documents`, table `public.research_documents` (chain id, numeric stage, version, title, kind, `original_filename`, sha256, bytes, storage path, hosted or catalogue parent, uploader, time, notes), view `public.research_documents_current`, membership table `public.research_members` with `public.is_research_member()`, two documents policies and two object policies that admit listed members only, and the metadata-only `research_upload_backend_status()` check. `supabase/research-uploads.sql` is the one-time script and refuses to run over conflicting objects; it no longer alters `storage.objects`, which the platform already has under RLS. `node scripts/verify-research-upload.js` reads all five checks PASS; an anonymous select is refused with 401 and a member's read of the membership table with 403.

The owner account `research-library@example.com` was created with a confirmed address and added to `public.research_members`; its password is held by the owner and is not in this repository. `docs/research-library/UPLOAD_BACKEND.md` records what exists, how to sign in, how to add a member and what each refusal means.

The page changes: the account block is rendered above the library (email and password with a Sign in button, plus an email link), a signed-in reader's factor-chain upload goes straight to the store, each opened chain pulls its own hosted rows once so a reload keeps the stage delivered, the stage card shows the uploaded file name and a private-store note, and hosted downloads keep the uploaded name and re-check the fingerprint. A hosted row is owned by its chain id, so `chainDocuments` finds it next to the committed registry documents of that chain. Refusals stay in the form with the file selected. The final chain still needs the local service for its input package. No factor status, weight, threshold, sign, live call, workflow or feed moved; `data/research-library/documents.json` and every registered hash are unchanged.

Guards: library unit 29 of 29, upload client and adapter 44 of 44, library browser 1 of 1 (the stale-registry scenario rewritten for the factor table, still asserting refusal keeps the file, service-registry truth, parent linkage, download name and hash, stage 3 input and the reload), full `npm test` 597 of 599 with the two remaining failures in `live_trading_dashboard.browser.test.js` and `live_trading_rule_panel.browser.test.js` reproduced unchanged on a pristine `origin/main` checkout. `node --check script.js` is clean.

Live check at `https://kevincreedycars-debug.github.io/trading-agent-dashboard/` with the local service stopped: signed in from the account block, uploaded the delivered VIX research report into `usd-factor-live-f1-vix-level` stage 1 (84,056 bytes, sha256 `e4151937…`), saw it read back as `VIX_USD_Research_Report.md` with the private-store note, reloaded the page and found the same stored row, downloaded 84,056 bytes with that file name and the same hash, saw stage 2 name the stored document as its input (v1, same hash) and download it with the same name and hash, and saw stage 3 stay at not started with no red-team to attach. Signing out returned the stage to the committed registry row. The final chain gate still reads `0/25` and the factor row still reads Ready / Pending / Not tested. The private store now holds that one row, `d7b8eb40-ce08-48c3-9d2c-5bf94b7618bc`, v1 of stage 1, which is the same bytes as the committed registration; the committed registry itself was not changed.

Next: the owner uploads the completed VIX red-team file through `usd-factor-live-f1-vix-level` stage 2.

2026-10-19 (PR #1 reconciliation, interactive coordinator) - handoff. `publish/research-library-20261019` now merges `origin/main` at `48ee6a5f`, so the branch carries the 12:30 live snapshot while the Research Library work stays scoped. The integrated tree passes `npm test` 596 of 596 with 0 failures, `node scripts/build_research_library.js verify` (catalog, registry, repo hashes, chains and chain prompts), the shared-nav check (13 pages, 19 rail entries, 3 outbound, 0 changes), `node --check script.js` and the five-case Live Trade Logic browser guard. The shared-nav addition puts Research Library under Evidence and restores the existing Live Trade Logic tab under System; the latter is navigation copy for a read-only page and changes no trading behaviour. `data/live-trading.json`, `data/layer1.json` and `data/layer2.json` are byte-identical to `origin/main`, and no live script, workflow, export, feed or database file is in the diff.

The VIX evidence is intact. `usd-baseline-audit-01-vix-usd-report` remains version 1 at 84,056 bytes with sha256 `e4151937411eb1e9235c21e4942327b2d24486e405887d70a90a8f5367eb381d`; the stored object re-hashes to that value. The `usd-factor-live-f1-vix-level` chain reads research delivered, red team awaiting the file and adjudication not started; its sibling chain reads `0/3`; the final chain remains `locked` at `0/25` with `0/3` final stages.

The earlier branch copies of `CHANGELOG.md` and `SESSION_NOTES.md` were full-file CRLF rewrites carrying stale accumulated history, which is why the PR showed thousands of documentation lines. They were reset to the current `main` versions and only this cycle's entries were added. PR #1 remains open and draft; it is not merged or deployed. The next manual action is unchanged: upload the completed VIX red-team file through `usd-factor-live-f1-vix-level` stage 2.

Dispatch note, 2026-10-15 (pilot-dispatch cycle, interactive coordinator), prepended: the manual Astra pilot started from the published VIX package, and its exact version and bytes are recorded before the return arrives, in `docs/research/handoff/usd/v1/pilot/PILOT_DISPATCH_RECORD.md`. It pins pilot 1 of package `1.0.0` for factor `live.f1-vix-level` (task `USD-BASELINE-AUDIT-01`), pack version `2.0.0`, context version `usd-session-context-20261014.1`, card schema `usd-session-research-card-v3`, generated 2026-10-15 on `research/usd-session-20261013` at `d07af11166ea1d39e5f4184e85a993e03bcb7137`; the archive `pilot/usd-vix-pilot-v1.zip` at 46,619 bytes and sha256 `1a4dfbeaa0a98987b074c376aade6a7d64c32a77292ecd788bd3d558b2e8451f`; each of its four flat members (`f1-vix-level.md` 14,724 / `808dc01ada48798e…`, `RESEARCH_OUTPUT_TEMPLATE.md` 8,582 / `cbea6e9efd5b9b3b…`, `research_card.schema.json` 17,060 / `43b549d0279817b8…`, `VIX_PILOT_START_HERE.md` 5,611 / `408962f8fe865534…`); and the brief's registered identity (`usd-brief-f1-vix-level` version 2 at `808dc01ada48798e…` / 14,724 bytes, version 1 kept immutable at `25f6207967d3c088…` / 12,974 bytes). The return is read against those values: it uploads against `USD-BASELINE-AUDIT-01` for `live.f1-vix-level`, registers against package `1.0.0`, and a card written against different bytes registers against the version it actually read - a later package is versioned rather than substituted, and no return is re-pointed. The record is written by hand so that it cannot be regenerated or swept away: `write` neither rewrites nor removes it, it is not an archive member, it is not a library document, and `check` still reads 36 files current with the archive unchanged at `1a4dfbea…`. Two owner decisions are recorded with it: the proposed missing-quote policy stays explicitly proposed until the methodology reviewer assesses it and is frozen with the flat band and the study's own tie policy before any candidate is scored, the VIX card being one input rather than the decision; and the pilot stays a bundle-only download, so no per-factor action, no new library document and no further interface work follows. Read next: the dispatch record, then `docs/research/handoff/usd/v1/pilot/VIX_PILOT_START_HERE.md` for what the pilot session does. Nothing is blocked and nothing is pending except the manual return: no deployment, workflow, feed, dashboard, dispatcher or database was touched, no interface changed, 22 factors stay ready and 3 blocked, the pilot has not been run, and an upload is evidence rather than an approval.

Publish note, 2026-10-15 (brief-correction cycle), prepended: the correction above is on `main` as commit `6eab14a4`. The pages route serves it: `https://kevincreedycars-debug.github.io/trading-agent-dashboard/` returns HTTP 200 (`index.html` 28,856 bytes), the corrected VIX brief returns 14,724 bytes with sha256 `808dc01ada48798e…`, the pilot archive 46,619 bytes with `1a4dfbeaa0a98987…`, the bundle archive 596,029 bytes with `22a0bb454ec2592c…`, and the raw-content route returns the same bytes for each. A headless read of the live Research Library confirms the brief actions rather than assuming them: 25 briefs in the live registry, coverage `25 of 25`, Copy prompt and Download present on all twenty-five factor pages with the expected document ids, and on the VIX factor a copied prompt of 14,724 characters whose bytes equal the downloaded file and the live registry's latest hash. The 404 recorded against this host in the previous cycle does not reproduce; no Pages setting was changed.

Correction note, 2026-10-15 (brief-correction cycle, interactive coordinator), prepended to the record below: the shared context that all twenty-five briefs carry was corrected at the generator rather than in one file, the briefs regenerated, and the first pilot packaged. What was wrong and is now fixed: the deployed engine's `NO_CLEAR_BIAS` was described as unreachable when it is reachable arithmetic (F2 + F3 + F4 + F6 + F8 = 50 against F1 + F5 + F7 + F9 + F10 = 50, which `USD_SYSTEM_CONTEXT.md` §3.4 and §6.3 already recorded); the workflow was described as `v154, active` when the executing version is v155, published 2026-10-12T19:52:13.451Z by the supervised live apply of the null-versus-unavailable guard (version id `0fb553c2-b1f1-4afa-bfdc-1166b60a6a79`, `versionCounter` 155, `nodes_sha256` `b2583215…`), with `exports/usd_layer1_agent.json` now named as the audited baseline measured against v154 on 2026-10-11 whose `Calculate USD Conviction` jsCode `580f0aa3…` is the same bytes v155 executes, and F1's repair carrying both dates (repository 2026-10-11, live 2026-10-12); and the missing-quote policy was both specified and called undecided, when it is one proposed policy - a session whose start or endpoint print is missing is a data exclusion that leaves the scored sample and is counted as coverage, never filled, forward-carried or interpolated - with data exclusions kept apart from model abstentions, which stay in the sample and are scored as no-calls. The corrected text reaches the generator (`scripts/build_research_handoff.js`), `USD_SYSTEM_CONTEXT.md` and the library's published implementation excerpt; `docs/research/handoff/usd/v1/` now holds 36 generated files, the two new ones being the first pilot package - `pilot/usd-vix-pilot-v1.zip` with the VIX brief, the output template and the full `usd-session-research-card-v3` schema flat inside it, and `pilot/VIX_PILOT_START_HERE.md` explaining why the brief alone cannot be run. Guarded by `npm run test:research-handoff` 14 of 14 (two new cases), `tests/research_library.test.js` 19 of 19 with the 25 briefs registered as immutable version 2, `npm run test:usd-session` 33 of 33 and the browser panel test. Open: the flat band and the study's own tie policy are still unfrozen, the pilot has not been run, no status moved (22 ready, 3 blocked), and nothing was deployed, published to a workflow or sent.

Delivery note, 2026-10-15 (USD session brief-delivery cycle, interactive coordinator), prepended to the record below: all twenty-five USD factors now carry their own self-contained research brief, delivered as files rather than described. `scripts/build_research_handoff.js` writes 34 files under `docs/research/handoff/usd/v1/` - the ten baseline-audit packs for the deployed factors, fifteen newly authored session-research briefs (one per non-live catalogue factor, authored in the builder and refused at write time unless they cover the catalogue exactly), `BRIEF_INDEX.json`, `tracker_tasks.json` with 25 rows, `START_HERE.md` with the numbered list of all twenty-five briefs and a link to each, and `usd-research-handoff-v1.zip`, a stored archive the builder writes itself so the bytes are reproducible without an external tool. Every brief states 05:00 `Europe/London` to 05:00 `Europe/London` on the next local date, taken from one constant, so the withdrawn 17:00 New York window appears in none of them, and each brief carries its factor's own context, questions, hypothesis seed, falsification test, data asks, prohibitions, the full card field list and the schema path, which is what makes it handable to a model on its own. The same twenty-five packs are registered as repo-backed brief documents, so each factor page offers Copy prompt and Download for its own brief and the panel states 25 of 25; the copied text and the downloaded file are the same bytes the registry hashed, checked in a browser by opening all twenty-five factor pages and failing if any one lacks a brief action, then copying one brief and downloading it. No status moved: 22 ready and 3 blocked before and after, nothing uploaded, accepted or scored. The two reviews and the synthesis now cover the whole set through tasks `USD-SESSION-A3`, `A4` and `A5`. Guards: `test:research-handoff` 12 of 12, `tests/research_library.test.js` 18 of 18, `tests/research_library.browser.test.js` 1 of 1. Added `.gitattributes` with `docs/research/handoff/** -text` so a checkout cannot renormalise the bytes the manifest and the registry hash. Nothing live changed: no workflow, feed, credential, dispatcher or production file was touched, and the dispatcher stays paused.

Publish note, 2026-10-15 (same cycle), prepended: the delivery above is on `main` as commit `f7fc4690`, rebased onto the live-feed snapshot `c3589304` and pushed, and the published bytes are the delivered bytes - `git hash-object` on the working copies equals `git rev-parse origin/main:<path>` for `START_HERE.md` (`29417229`), `BRIEF_INDEX.json` (`5f38a3c8`), `usd-research-handoff-v1.zip` (`d900d8b1`), `HANDOFF_MANIFEST.json` (`31de2a44`) and `packs/f1-vix-level.md` (`970beee4`). A fresh checkout of `main` reproduces the bundle: `node scripts/build_research_handoff.js check` reads "checked 34 files under docs/research/handoff/usd/v1: all current, one brief per factor for 25 factors, and the briefs agree with data/research-library/catalog.json", the new `.gitattributes` rule lands that folder as `w/lf` rather than renormalised, and `tests/research_handoff.test.js` is 12 of 12 there. The two failures a `main` checkout shows in the library suite are not from this cycle: `data/usd-24h-experiment-registry.json` and `data/usd-24h-selection.json` fail their registry hash comparison on untouched `main` as well, which is why the guards read `18 of 18` on the research branch and `16 of 18` in the publish context. Downloads, fetched over HTTPS this cycle and returning HTTP 200 with the byte lengths of the published blobs: `https://raw.githubusercontent.com/kevincreedycars-debug/trading-agent-dashboard/main/docs/research/handoff/usd/v1/START_HERE.md` (8,928 bytes), `.../BRIEF_INDEX.json` (18,138), `.../usd-research-handoff-v1.zip` (502,477), with every pack at `.../v1/packs/<pack>.md`. Observation for the owner, not caused by this delivery and not a blocker: the GitHub Pages host `https://kevincredycars-debug.github.io/trading-agent-dashboard/` answered HTTP 404 for every path tried on 2026-10-15, including `/index.html` and the pre-existing `gold-factor-wip.html`, so the briefs are reachable through the raw links and the GitHub file pages while the Pages route is not serving.

## Work Completed

- Completed the CLIXML-based local credential continuity system using the pre-existing encrypted local store under `%USERPROFILE%\.trading-agent-dashboard\`.
- Added repository-safe bootstrap and validation wrappers so future Codex sessions can sync local templates and validate required credential names without exposing values.
- Repaired the local CLIXML loader/runner path so child commands load credentials into the process environment and restore the previous environment afterward.
- Classified the credential inventory, validated eight continuity variables present, and confirmed `OANDA_ACCOUNT_ID` remains conditional and currently absent.
- Safely migrated the missing supported credentials from the local ignored `Keys/` folder into the CLIXML store without printing values and corrected the stored FRED key from the explicit local FRED key source.
- Validated read-only connectivity for `n8n`, Supabase, FRED, OANDA, and Alpha Vantage.
- Confirmed RapidAPI credential loading and storage, while leaving external endpoint verification inconclusive because the harmless endpoint timed out.
- Verified isolated CLIXML backup and restore behavior.
- Added repository secret-scanner tests plus importer URL-redaction tests and kept the scanner output free of matched values.
- Confirmed the current production baseline is the deployed dashboard at commit `a15100d62f9a8a4c6ad6d8390f97f7de25ca1cdd`.
- Confirmed the visible Layer 1 `24H` ET expiry blocks, UK/ET header clock, Directional Viability spacing fix, and Overview prose removal are already deployed and validated.
- Identified `CODEX_STARTUP.md` as the instruction source causing routine `.claude/launch.json` prompts and prepared the minimum startup-rule correction.
- Identified that the current active-state project memory pointers were still aimed at the earlier shadow-backtest task and needed correction before the next startup.
- Deployed UK-time hover/focus tooltips on every available Layer 1 `24H` expiry section while preserving the visible ET expiry.
- Verified that the tooltip converts the same expiry timestamp into UK time with browser-native `Intl.DateTimeFormat` using automatic GMT/BST handling.
- Verified live GitHub Pages asset cache busting and live tooltip behavior after deployment.
- Approved the Architecture Mirror direction: top-level `Architecture` tab, checked-in `data/architecture-map.json` manifest, custom HTML/CSS/SVG renderer, overview map plus expandable module maps, and a read-only documentation surface with no effect on production or research logic.
- Implemented and deployed the Architecture Mirror as a top-level read-only dashboard tab at commit `67379533005d9c163b849016dc773ab498551004`.
- Shipped the checked-in Architecture manifest and schema with 36 nodes, 59 edges, 5 boundaries, and 13 views.
- Added deterministic manifest validation plus direct validator rejection tests for duplicate IDs, invalid references, and unsupported verification statuses.
- Verified the live GitHub Pages deployment serves the Architecture tab, `data/architecture-map.json`, and the updated `script.js` and `styles.css` assets.
- Verified live Architecture behavior: no manifest fetch on initial Overview load, one manifest fetch on first Architecture open, stable cached reuse on view changes and tab reopen, working click and keyboard selection, verified-only filtering, and no desktop or mobile page-level horizontal overflow.
- Observed an unrelated live research warning from `research_best_factor_combinations` returning HTTP 500 from Supabase; Architecture behavior remained unaffected and no new Architecture-specific console errors were present.
- Replaced the old horizontal Architecture graph with the vertical waterfall renderer at implementation commit `7586016d89c1e06c9f20beed3201034248d1e048` and deployed it with cache-busted asset commit `9407893cc668b47fc9ddddf0cfa4b9e8a6f722bc`.
- Changed the Architecture presentation to a strict top-to-bottom waterfall with full-width canvas use, below-canvas detail layout, and a compact collapsible legend.
- Changed Overview into the exact 8-stage top-to-bottom order: External Data, Collection and Storage, Master Orchestration, Layer 1 Agents, Layer 2 Selection, Artifact Publication, Dashboard, Research System.
- Changed every focused Architecture view to a deterministic top-to-bottom waterfall with contained responsive grids for parallel nodes, centered vertical connectors, no absolute node placement, no SVG bus routing, and no horizontal scrolling.
- Verified the live GitHub Pages deployment at `1440x900`, `1920x1080`, `1024x768`, and `390x844`, with all 13 Architecture views rendering inside bounds with no card overlap, no stage overlap, no horizontal Architecture scrollbar, and no new Architecture-specific console errors.

## Unfinished Work

- Await review of the deployed Architecture Mirror.
- Leave the six explicitly unverified architecture relationships unchanged until stronger repository evidence exists.

## Blockers

- No repository-side blocker.

## Assumptions

- The CLIXML local credential store remains the supported continuity foundation and should not be replaced with SecretStore.
- Future sessions should bootstrap with `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\bootstrap-local-secrets.ps1` and validate with `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\check-required-secrets.ps1 -Scope all`.
- The Architecture Mirror remains read-only and must not alter production or research logic.
- The first Architecture release should be driven from a checked-in manifest rather than hand-maintained independent diagrams.
- Production versus research-only boundaries and failure/status paths must be explicit in the mirror.

## Exact Next Task

Review the deployed Architecture Mirror and approve or reject any follow-up milestone.
