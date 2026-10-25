# Where the always-on host and the second account actually stand

**Status 2026-10-24, evening. Nothing is bought, nothing is deployed, and no observation has started.** This page
is the honest ledger for the request *"run both FTMO accounts continuously on a Windows VPS, with my PC off,
before I leave"*. [VPS_BUILD_RUNBOOK.md](VPS_BUILD_RUNBOOK.md) is still the build plan; this page records what is
done, what is blocked on a purchase or a login, and what is code that does not exist yet.

## 1. Done today

| Change | Where | Proof |
| --- | --- | --- |
| `--max-per-day` counts a **Europe/Prague** day, DST-aware, instead of a UTC day | `scripts/run-live-trading-trader.js` (`TRADE_DAY_TIMEZONE`, `tradeDayKey`, `todayPlacements`) | the seven live-trading suites: 203 tests, 0 failures, including both 2026 clock changes and the midnight case |
| The run record states `caps.trade_day` and `caps.trade_day_timezone`, so a reader of the log can tell a fresh Prague day from a quiet one | same file | same suite |
| `scripts/show-live-trading-status.ps1` - read-only lane status: scheduled (task state, next run), ran (last result, log age), published (publisher state), feed freshness and login | new file | run against this PC lane: exit 0, `ALIVE`; wrong `-ExpectedLogin` and a missing task both exit 1 with the reason |
| One publisher for every lane: `--artifacts` on the feed publisher, a lanes file, and `scripts/publish-live-trading-lanes.js` reading each lane's snapshot, refusing a lane that is missing, unreadable or not the account the file names, and publishing the set in one commit | `scripts/publish-live-trading-feed.js`, `scripts/publish-live-trading-lanes.js` (new), `config/live-trading-lanes.json` (new), `tests/live_trading_lanes_publish.test.js` (new) | lanes and feed-publish suites together: 39 tests, 0 failures; `--force --dry-run` against this checkout answers `would_publish` for `ftmo-1` (identity `***614` / `FTMO-Server` checked) and `disabled` for `ftmo-2` |
| The trader's scheduled run can produce the snapshot first and stop if it fails (`-ChainFeed`, `--align --settle-seconds 90`), so the loop cannot read an older snapshot | `scripts/register-live-trading-trader-task.ps1` | `-ChainFeed -Show` prints `chain_feed = true`, `feed_settle_seconds = 90`, and the generated wrapper carries `if errorlevel 1 exit /b` between the producer and the loop |
| Close requests name their account: `account.lane`, the masked login and the server, a unique id (`close-<lane>-<ticket>-<stamp>-<token>`), its own `expires_at_utc` and an answer row per ask | `lib/live_trading_close_request.js` (schema `-v2`), `data/live-trading-close-request.json` | 19 document tests, including cross-account refusal, duplicate-id refusal, a legacy `-v1` document refused by name, and an expiry that cannot exceed the 30-minute window |
| The loop answers only its own asks: `--lane` on the trader, an account match against the terminal it just read, `foreign_account` / `replay` / `expired` written down once, and a trade a person closed is not reopened | `scripts/run-live-trading-trader.js`, `scripts/register-live-trading-trader-task.ps1` (`-Lane`, resolved from the lanes file's root) | 66 trader tests, including an ask from the other lane, a terminal reporting another login, a replay written once, a hand close ending the trade, and a stop-out still re-entering |
| A second account on the page: an Accounts strip draws each lane from the published lanes document, its own snapshot and its own trader heartbeat, with lane 2 shown as DISABLED | `script.js` (`liveTradingAccounts`), `styles.css`, `data/live-trading-lanes.json` | browser close-control suite 6/6; the strip is drawn from the same artifacts the publisher writes |
| The lanes publisher carries the lanes document and each lane's trader heartbeat in the same commit, refuses a heartbeat naming another lane or account, and writes the summary to `data/live-trading-lanes.json` | `scripts/publish-live-trading-lanes.js`, `scripts/publish-live-trading-feed.js` (`extras`), `config/live-trading-lanes.json` | lanes and feed-publish suites together: 39 tests, 0 failures; `-Test` through the launcher answered `would_publish`, `origin/main` unchanged |
| The secret scanner's report is readable when it has no console: one line per finding instead of a `Format-Table` sized to the terminal | `scripts/check-repo-for-secrets.ps1` | `backtester/tests/secret_scanner.test.js` 5/5, and the full local suite was **758 pass, 0 fail** in the research-library branch's checkout (a main-line checkout lists 666 test cases, so the two runs are not the same file list) |
| Two browser-test expectations that only held while the account was flat now read the artifacts instead of a remembered stage: the read-only guard allows the Close button the Open-positions table draws for a lane ticket and none other, and the rule-panel case expects the module's own stages, so a pair holding an open position reads `blocked` rather than `no call` | `tests/live_trading_dashboard.browser.test.js`, `tests/live_trading_rule_panel.browser.test.js` | on a main-line checkout with the local research-library object store present: **666 tests, 666 pass, 0 fail** (the same tree without that ignored blob fails `research_library.browser.test.js`, and nothing else) |

Where the two suite counts come from, and why neither is a quality signal: [TEST_SUITE_666_VS_758.md](TEST_SUITE_666_VS_758.md).

Why it mattered: 00:00 Prague is 22:00 or 23:00 UTC, so the old UTC cut handed the loop a **second** daily cap
inside the same FTMO trading day (01:00/02:00 local). The counter is a placement counter, not a loss-limit guard,
and that sentence is now in `--help` too. Historical placements were not rewritten: the day is derived from each
placement's own `placed_at_utc` at read time, so nothing in any existing state file changes meaning.

Nothing else in the trading path was touched. Directional logic, the level ladder, the five-minute crossing rule,
the 5R geometry and the exits are unchanged, and no test asserting them was edited.

The status script exists because the page shows results and a host has three ways to be quietly dead: no task,
a task whose last run failed, and a feed that stopped while the terminal still looks connected. It reads, writes
nothing, and exits 1 with the reason, so it can be the thing a phone check or a watcher runs.

## 2. Purchase dependency (blocks everything on the host)

Buy one **Windows Server 2022 or 2025 with Desktop Experience** (Server *Core* cannot run MT5) or Windows 11 Pro
VPS:

- 2-4 vCPU, 8 GB RAM if the price is close, otherwise 4 GB is the floor for two terminals plus Node/Python.
- 60-80 GB SSD/NVMe.
- Data centre in the **UK/London**, then ping the FTMO server from the box before trusting it.
- Windows licence **included**, monthly term, RDP access, provider console reboot.

**Verified at the configurator on 2026-10-25.** The table this page carried on 2026-10-24 read Contabo's headline VPS
rate as a Windows total, and the difference is the whole decision: the plan rate and the Windows Server licence are
**two separate monthly lines** in Contabo's configurator, and the licence is not included in the plan price. The
numbers below are the configurator's own, read plan by plan (Cloud VPS Core is the new name for Cloud VPS); nothing
here is a cart total, because the cart is where term, region and VAT are fixed.

| Plan | Spec | Windows Server Datacenter 2025 (2022/2019/2016 same price) | Plan, 1 month | Plan, 12 months | Plan, 24 months | Windows total, 1 month | Windows total, 24 months |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cloud VPS Core 4 | 4 vCPU, 8 GB RAM, 100 GB SSD, 1 snapshot, 200 Mbit/s | +EUR 8.00/month | EUR 5.50 | EUR 4.68 | EUR 4.40 | **EUR 13.50** | EUR 12.40 |
| Cloud VPS Core 6 | 6 vCPU, 12 GB RAM, 200 GB SSD or 100 GB NVMe, 2 snapshots, 300 Mbit/s | +EUR 17.00/month | EUR 7.50 | EUR 6.38 | EUR 6.00 | EUR 24.50 | EUR 23.00 |
| Cloud VPS Core 8 | 8 vCPU, 24 GB RAM, 300 GB SSD or 150 GB NVMe, 3 snapshots, 600 Mbit/s | +EUR 28.00/month | EUR 14.00 | EUR 11.90 | EUR 11.20 | EUR 42.00 | EUR 39.20 |
| netcup VPS 1000 G12.5 | 4 vCore, 8 GB RAM, 128 GB SSD | not offered | - | - | - | - | - |
| IONOS VPS+ Windows | not read: the plan table truncated on every fetch | - | - | - | - | - | - |

Every row: **no setup fee** at any term (`No Setup Fee`, and the order summary prints `One-Time EUR 0.00`), one IPv4
included, unlimited traffic under fair use. netcup stays rejected for the same reason as before: it sells no Windows
licence, only a self-install with a 180-day trial. IONOS stays **unquoted** rather than guessed.

What those same reads did settle, and what they did not:

- **Licence.** Windows Server Datacenter is an image option priced per month, chosen at install from the Control
  Panel. There is no "bring your own licence" path in the configurator, which matches the 2026-10-24 note that
  Contabo does not accept customer-supplied Windows licences. **Desktop Experience vs Server Core is therefore an
  install-time check** (Server Core cannot run MT5), not a purchase-time one.
- **Region.** The configurator's region list is `Best / Europe / America / Asia / Australia`; Contabo's UK data
  centre is Portsmouth. A specific UK location is picked inside Europe at checkout, so the runbook's "choose the UK
  location, then ping the FTMO server from the box" step is unchanged and still to be done.
- **VAT.** The configurator shows the plan and licence rates with no tax line; the site's country selector is
  labelled "Country (Tax Purposes Only)" and lists United Kingdom at 20%; the Cloud VPS page's footnote calls its
  card prices "the effective monthly rate for a 24-month subscription including applicable taxes". Those statements
  do not add up to one verified gross figure, so the totals above are **before VAT**. At 20% UK VAT, Core 4 with
  Windows is EUR 16.20/month on a 1-month term and EUR 14.88/month on 24 months - arithmetic on the configurator's
  figures, not a quote. The cart, with country set to the United Kingdom, is where the gross total is read.
- **Term and renewal.** Minimum initial contract length 1 month; the following contract length equals the initial
  one; cancellation notice none (pre-paid) or 4 weeks (post-paid). A 24-month term therefore renews for another 24
  months at the then-current price: EUR 4.40 is not a lifetime rate, and nothing here commits to 24 months.
- **Provisioning.** Not stated anywhere on the pages read, and not verified. It does not change the buy decision;
  the first RDP attempt is the evidence.

**Bought on 2026-10-25: Contabo order 15592634, EUR 17.46 paid, one-month term, United Kingdom.** The cart read
higher than the estimate below, and the difference is a region surcharge rather than VAT: Cloud VPS Core 4
(4 vCPU, 8 GB RAM, 100 GB SSD, Windows Server) with the UK location selected. Net EUR 14.55 = plan EUR 5.50 +
Windows Server EUR 8.00 + UK surcharge EUR 1.05; UK VAT at 20% = EUR 2.91; **total EUR 17.46**. Every EUR 16.20
written below is therefore superseded by EUR 17.46: the estimate was arithmetic on the configurator's two
rate lines with no surcharge, and it was low by EUR 1.26. The purchase confirmation says provisioning is under
way, normally 30 minutes and up to three hours, so **the host does not exist until the provisioning email says
it does**; the Windows version and Desktop Experience are read at the first login, not assumed from the order.

| Corrected line | Figure |
| --- | --- |
| plan, Cloud VPS Core 4, 1-month term | EUR 5.50/month |
| Windows Server licence | + EUR 8.00/month |
| UK region surcharge | + EUR 1.05/month |
| net | EUR 14.55/month |
| UK VAT 20% | + EUR 2.91 |
| **paid** | **EUR 17.46, one month, no setup fee** |

Those were the lines the order was read on, in this order: the **term** (1 month, not 24), the **Windows Server
version** and Desktop Experience, the **location** (UK), the **VAT line**, the **total payable now**, and whether a
multi-month term is charged in full up front. The order as placed: 1 month, Windows Server, United Kingdom,
EUR 17.46 payable now - so the surcharge line was the one difference from the estimate, and it was on the cart
rather than in the licence.

**The plan that was bought:** Cloud VPS Core 4 + Windows Server at a 1-month term, because it meets the floor
above and commits to nothing beyond a month. Core 6 + Windows (EUR 24.50/month before VAT) stays the
comfortable option if nearly double the monthly cost ever becomes acceptable. Configurator links:
`https://contabo.com/en/vps/cloud-vps-core-4/`, `.../cloud-vps-core-6/`, `.../cloud-vps-core-8/`; Windows product
page `https://contabo.com/en/windows-servers-vps/`; UK location `https://contabo.com/en/locations/united-kingdom/`.
- Account checklist for the purchase itself: business or private account with 2FA on, address and VAT details
  that match the card, a card that accepts foreign currency, the provider's abuse/support contact saved somewhere
  other than the host, and the invoice in the same mailbox the renewal notices reach.

A second FTMO-provided VPS is worth one question to support, because it would arrive pre-configured for the
platform; nothing in this repository confirms FTMO offers one for this account type.

## 3. Login and credential dependencies (blocks arming, not the build)

| Needed | Why | Safe place |
| --- | --- | --- |
| Account #1 login + **server name** | the terminal must be logged in before anything runs | typed into MT5 on the host; never in chat, logs or Git |
| Account #2: **type (Challenge/Verification/Funded), stage, login, server, owner** | decides the lane's caps and whether it may trade the same calls | lane config, masked login only |
| Windows user + autologon password on the host | the tasks are *interactive*; a reboot that stops at the sign-in screen stops the cadence | local user, `netplwiz`/Autologon, never in the repo |
| A GitHub fine-grained PAT, `contents:write` on `main` | the publisher pushes the artifact; the runners carry no token | the host's git credential store only |

## 4. The FTMO question to ask now, in this wording

> I run one automated strategy (my own code, no EA, through the MetaTrader5 Python package) on this account. I am
> about to open a second FTMO account and want to run the **same strategy, same signals, same position sizing
> rules** on both independently. Is that permitted on my account combination - in particular, does it count as
> copying or as opposite-account hedging, and is there an aggregate allocation or maximum-lot limit across my
> accounts that I must respect? Also: is running the terminal on a VPS with no human present permitted for this
> account type?

Until the answer is in writing, account #2 stays **unarmed**. I will not add entry/SL/TP offsets or different
timings to make the two lanes look different; the strategy's geometry and the per-account caps are the only
differences allowed.

## 5. The cloud schedules: what the repository held, and what the API read answered

This part **could not be answered from the repository**, and that is still true: `exports/*.json` was last written
**2026-06-20** and contains no `scheduleTrigger` node in any of the 16 exports; the cadence was stated only in prose
(`docs/STRATEGY_LIVE.md`, `docs/live-trading/BRIEF_FOR_EXTERNAL_REVIEW.md` section 2) and lived in the cloud instance.
On 2026-10-24 the instance itself was read (read-only, through the credential runner), and the answer is below.
**What the API read on 2026-10-24 replaced this table with:** nothing is scheduled in the cloud. 45 workflows, no
active schedule trigger, eight asset agents called by an active Master Orchestrator whose only triggers are a manual
start and a webhook (`POST /webhook/master-orchestrator-dashboard-refresh`), and eight observed webhook calls in the
last week at irregular times (2026-10-24T11:19:53Z, 2026-10-23T19:08:50Z, 2026-10-21T08:45:48Z, 2026-10-20T17:39:58Z,
2026-10-20T04:12:30Z, 2026-10-19T03:38:45Z, 2026-10-18T19:31:20Z, 2026-10-18T10:07:55Z). The table below is what the
repository *recorded* before that read; it is kept only so the difference is visible.

The full record - command, workflow names, execution times, and the untracked verifier whose premise does not match
the instance - is [LAYER1_SCHEDULE_VERIFICATION_20261024.md](../orchestration/LAYER1_SCHEDULE_VERIFICATION_20261024.md).

| Flow | Recorded cadence | Weekday/weekend | Timezone handling | What the API read shows |
| --- | --- | --- | --- | --- |
| USD, EUR, GBP, GOLD, SILVER, NQ, BTC, WTI Layer 1 agents (8) | 07:00 | weekdays only, per the intended design | `America/New_York`, named | active, `executeWorkflowTrigger`, no schedule of their own; last runs 2026-10-24T11:22-11:24Z |
| Master orchestrator | fans them out; called once a day at 07:00 `America/New_York` from `main` | inherits the caller | inherits | active; webhook + manual trigger; since 2026-10-24 called by `.github/workflows/master-orchestrator-daily.yml`; last manual call 2026-10-24T11:19:53Z |
| `layer2_trade_selection_agent`, `dashboard_writer` | downstream of the fan-out | inherits | inherits | `Dashboard Writer - Layer 1` active, last success 2026-10-24T11:24:49Z |
| Research session (separate from live execution) | 05:00 | - | `Europe/London`, named | not read in this pass |

The 05:00 Europe/London research session is deliberately **not** part of live execution and nothing on the host
reads it.

**Still open, and now precisely stated:**

1. ~~Identify **who or what POSTs** the orchestrator webhook.~~ **Answered 2026-10-24:** a GitHub Actions schedule,
   `.github/workflows/master-orchestrator-daily.yml`, POSTs the same webhook the dashboard's Refresh button posts,
   once a day at 07:00 `America/New_York` (window 07:00-10:00 to absorb GitHub's start delay), with a once-a-day
   guard, a concurrency group and a confirmation read of `data/workflow-status.json`. The dashboard is no longer the
   only caller. See [ORCHESTRATOR_DAILY_TRIGGER.md](ORCHESTRATOR_DAILY_TRIGGER.md).
2. ~~Decide whether 07:00 `America/New_York` should become a real schedule.~~ **Done 2026-10-24, at the orchestrator
   and not at the agents.** The eight agents keep their `executeWorkflowTrigger` and are still started by the
   fan-out; what is scheduled is the single call that starts it. `scripts/verify-layer1-schedules.js` still asserts a
   per-agent 07:00, which the instance still does not implement - that assertion is now wrong about where the
   schedule lives, not about whether one exists, and the script remains untracked here.
3. Re-export the flows into `exports/` if a fresh copy is wanted. An export is a read of the live definition, and stays
   a deliberate separate act.

Until 1 and 2 are settled, the page can show "last published" but neither I nor the page can claim the cloud side is
on a schedule. On the host the three signals are separable and the registration scripts report them: **scheduled**
(`-Show` next run time), **ran** (last task result), **published** (last commit to `main`), and the trader's own
heartbeat adds **armed** and **last status** per lane.

## 6. What the host will run, per lane

Two lanes, and today they are **two clones**, not one clone with a flag: every path in both runners resolves
against the clone root, and both registration scripts already take `-RepoRoot`, `-TaskName`, `-Terminal`, `-Python`
and `-HiddenRunner`. So lane isolation is configuration that exists, not code that has to be written.

| Piece | Lane 1 | Lane 2 |
| --- | --- | --- |
| clone | `C:\live-trading` (lane 1's root in the lanes file is `.`) | `C:\ftmo2` (lane 2's root is `../ftmo2`) |
| terminal install | `C:\Program Files\FTMO Global Markets MT5 Terminal` | `C:\Program Files\FTMO Global Markets MT5 Terminal 2` |
| lane block | `config/live-trading-lanes.json`, `id: ftmo-1`, `root: .` | same file, `id: ftmo-2`, `root: ../ftmo2`, `enabled: false` until its terminal exists |
| feed task | `LiveTrading1FeedTick` | `LiveTrading2FeedTick` |
| trader task | `LiveTrading1TraderTick` | `LiveTrading2TraderTick` |
| snapshot | `C:\live-trading\data\live-trading.json` | `C:\ftmo2\data\live-trading.json` |
| published file | `data/live-trading.json` | `data/live-trading.account2.json` |
| state / log / lock / journal | under each clone's `tmp\` | under each clone's `tmp\` |
| caps | `--max-open 1 --max-per-day 4` | decided with the account type, not copied yet |
| publish | one task for both: `LiveTradingPublishLanes019`, 10 minutes | same task |

`-HiddenRunner` defaults to `C:\Users\A17\...` and **must be passed** on the host, because the host's user is not
`A17`. That is the one default that will silently point at a path that does not exist.

## 7. The coordinated publisher, built 2026-10-24, and what is still missing

### 7.1 Built: one publish for both lanes

The item this page used to list first no longer blocks: `scripts/publish-live-trading-lanes.js` reads every lane in
`config/live-trading-lanes.json`, refuses the whole run if a lane is missing, unreadable, stale, or carrying a
different masked login/server than the lanes file says, and hands the set to
`scripts/publish-live-trading-feed.js`, which now takes `--artifacts` and publishes them in **one commit and one
push**. One publisher rather than one per lane is the point: two runs seconds apart would serve a page whose
account blocks come from different reads, and two runs racing `main` is where a rejected push comes from.

The lanes file the publisher reads by default was missing from `main` until 2026-10-25. Every reference to
`config/live-trading-lanes.json` - the publisher's `--config` default, the registration script's `-Config` default, the
trader's `--lane` error message, this page and the runbook - pointed at a file that existed only, untracked, in the PC
worktree, so a fresh clone on a host would have failed the lanes publish at its first read. It is tracked now, with the
layout section 6 already describes (lane 1 `root: "."`, lane 2 `root: "../ftmo2"` and `enabled: false`), and two tests
in `tests/live_trading_lanes_publish.test.js` read the shipped file through the publisher's own loader: the two ids,
the two published paths and the parked second lane, plus the absence of any credential-shaped key and the masked login
`***614` being the only account text in it.

`scripts/register-live-trading-lanes-publish-task.ps1` puts that on a ten-minute clock (`LiveTradingPublishLanes019`,
hidden launcher, `-Show` / `-Test` / `-Remove`). Its `-Test` is a **dry run** through the launcher, so running it
cannot commit or push, and the run on 2026-10-24 19:17Z proved exactly that:

- `test_task_result = 0`, `test_verdict = the launcher reached the runner and every gate passed on a dry run; nothing
  was written or pushed`, and the runner's own line said `action: would_publish`, `dry_run: true`, `force: true`,
  `published: false`;
- lane 1 was reported with its identity checked (`***614` / `FTMO-Server`), lane 2 as `"status":"disabled"`;
- `origin/main` was `39756d9` before and after, and the publish state file's hash was unchanged, so the test wrote
  nothing;
- the test registers only `LiveTradingPublishLanes019-SelfTest`, never the production task, and removes it afterwards
  (confirmed: no `LiveTradingPublishLanes019*` task exists);
- the **existing publisher was disabled for the duration** (`LiveTradingFeedTick019`, which runs
  `--publish --publish-min-interval-seconds 600` every five minutes) and re-enabled afterwards, because `--dry-run`
  still resets the shared publish checkout (`fetch` + `checkout --detach --force`) and a forced detach during a real
  commit is the one overlap worth avoiding. The task came back `Ready`, next run 20:22:58.

The lanes document and the heartbeat ride in that same commit: `publish-live-trading-feed.js` gained `extras`, files
copied and staged beside the snapshots without being validated as feeds, and `scripts/publish-live-trading-lanes.js`
writes `data/live-trading-lanes.json` (the page's account list) and each lane's `data/live-trading-trader.<id>.json`
from the heartbeat that lane's trader wrote. A heartbeat is optional - a lane whose trader has never run publishes
its snapshot without one - but a heartbeat that is there and names another lane or another account refuses the run,
the way a snapshot from another account does.

A lane whose terminal is not deployed yet is written off explicitly - `"enabled": false` - rather than left to fail
as a missing snapshot, so account 2 cannot stop account 1 publishing. Enabled is the default, so the flag has to be
written to switch a lane off, and deleting it is the whole switch-on.

Two consequences that are easy to get wrong:

- **Only one publisher may run per machine.** The existing single-artifact publish task has to be unregistered
  before the lanes task is registered, or two tasks push the same branch. Do not arm lane 1 through the old task
  and lane 2 through the new one.
- **The page draws both accounts now, but only lane 1's tables.** The Accounts strip draws every lane from the
  lanes document, so account 2 reads DISABLED until it is deployed. The Open positions, working-order, closed-trade
  and rule tables below the strip are still lane 1's own; a lane 2 ticket is not drawn anywhere yet, and its close
  control does not exist. That is the next page item, not a hidden one.

### 7.2 Still missing, in the order it hurts if left undone

1. **Distinct magic numbers per lane.** `ORDER_MAGIC` is one constant (`20261004`) in the trader and the order
   tool. Account scoping now decides which lane may act - the request names its lane and masked login, and the loop
   compares both against the terminal it just read - so the shared magic is no longer what keeps the two accounts
   apart. A per-lane magic is still the cheap belt if two accounts ever share one terminal, which the two-clone
   design avoids.
2. **Bar currency in the trader.** The trader refuses a *stale* snapshot, but a snapshot that is fresh and yet one
   bar behind is read as the market: the newest closed bar is then the previous one, and an entry can be placed on
   a crossing that is 6+ minutes old. The entry path should require the confirming bar to be the bar that just
   closed. It is entry-only, so the exits are unaffected - but the existing fixtures are deliberately hours behind
   `now`, so this change touches many tests and was **not** made today. What did change is the ordering: the
   trader task can now run the snapshot producer first (`-ChainFeed`, `--align --settle-seconds 90`) and abort if
   it fails, so it never reads an older snapshot instead of the current one.
3. **The heartbeat only exists once each lane's trader runs.** `--status-out` (default
   `tmp/live-trading-trader-status.json`) is written by every run, but nothing publishes it until the lanes task is
   registered: the single-artifact `LiveTradingFeedTick019` does not carry it. Until cutover, the page's account
   strip says "no heartbeat published" for lane 1, which is the honest reading of today's publisher.
4. **Outside monitoring exists; a watcher does not.** `scripts/check-live-trading-publication.js` reads the
   *published* lanes document, snapshots and heartbeats from any machine and answers exit 0/1/2 (all good / a lane
   is stale, mismatched or missing a beat / the lanes document cannot be read), with `--json` for a watcher. On
   2026-10-24 it answers exit 2 against the live site, correctly: `data/live-trading-lanes.json` has not been
   published yet, because the deployed publisher is still the single-artifact task. What is still missing is
   something to *run* it on a clock and alert a phone - and the deployment order that says a page carrying the
   Accounts strip should go out with, or after, the first lanes publish.
5. **Terminal watchdog.** Runbook section 3 step 4 describes starting a stopped terminal from a small task. Not
   written.
6. **Per-lane registration paths.** Both registration scripts take `-TaskName`, `-RepoRoot`, `-Terminal`, `-Node`,
   `-Python` and `-HiddenRunner`, and every other path (snapshot, log, lock, state, journal, heartbeat) derives from
   `-RepoRoot`. Lane 2 is a second clone with its own task names and its own terminal path; isolation rests on the
   clone boundary, which is why the lanes file's `root` and the registration's `-RepoRoot` have to name the same
   directory. `-Lane` now names the identity for close requests, is resolved from that root, and refuses rather
   than guesses when the root matches zero or two lanes.

### 7.3 Account-scoped close requests and the Accounts strip, built 2026-10-24

The old request file named a ticket and no account, and both lanes would have read it. `data/live-trading-close-request.json`
is now `live-trading-close-request-v2`, and every row carries:

| Field | Why |
| --- | --- |
| `account.lane`, `account.login_masked`, `account.server` | which account the ask was made on. A row asked on `ftmo-2` is answered by lane 1 as `foreign_account`, written down once and never acted on |
| `request_id` = `close-<lane>-<ticket>-<stamp>-<token>` | one ask is one close. The lane and a four-hex token make two presses on the same ticket in the same second two rows; the same press replayed by a retry, a merge or a reload stays one row |
| `expires_at_utc` | the ask's own end, never later than 30 minutes after it was asked. A row asking for longer is cut to the window; one asking for a time before it was made is refused |

The loop (`--lane`, resolved from the lanes file by the registration script) then:

- refuses to claim any ask when it was not told its lane, and says so in `close_requests.error`;
- compares the row's lane **and** the masked login/server against the terminal it has just read, so a row copied
  from the other account, or a terminal logged into another account since the ask was written, comes back
  `foreign_account` with nothing sent;
- answers each row once, in its own state: `closed`, `cancelled`, `nothing_to_close`, `refused`, `send_failed`,
  `foreign_account`, `replay` or `expired`. A replay is written once and then left alone, so an append-only log
  cannot grow an answer every five minutes;
- still requires the ticket to carry this lane's own magic (`20261004`) and its own comment prefix.

**A trade a person closed is not reopened.** The trade-cycle reading gained a `hand-close` ending: a closed trade
whose exit sits nearer neither its stop nor its target, or a close/cancellation this lane wrote down for that
ticket after it was placed, ends the trade for the rest of its life. The level then waits for the rule's own fresh
crossing rather than putting the same ticket back. A stop-out is unchanged - the level re-arms, as the user ruled -
and a target fill still ends it.

The Accounts strip (`liveTradingAccounts`) is the page half: one card per lane from `data/live-trading-lanes.json`,
showing the lane id, the masked identity, whether the lane is enabled, the snapshot age, the terminal connection,
the trader heartbeat (age, armed, last status) and the position count. Lane 2 reads **DISABLED** with the sentence
that says it is parked in `config/live-trading-lanes.json`, not broken. A close control is offered only on a row
carrying this lane's magic, and only when the lanes document gives the page a lane id and an identity to name;
otherwise the cell says `no lane identity` rather than offering a button the loop would refuse.

**The heartbeat.** The trader writes `tmp/live-trading-trader-status.json` on every run it logs (a refusal
included): lane, `armed`, `status`, the masked account, the position count, the close-request state and when it
wrote the file. The lanes publisher carries it, and the lanes document, in the same commit as the snapshots
(`publish-live-trading-feed.js` gained `extras`), and refuses a heartbeat naming another lane or another account. A
lane with no heartbeat is published as "no heartbeat" rather than failing the run, because a trader that has never
run is a fact the page should state, not a reason to stop publishing the account's snapshot.

**The cutover window, stated because it is live today.** The old page only writes a v1 document and the new loop only
acts on v2, so between this branch and `main` the request log is one-way dead: the loop's own log line says
`the published data/live-trading-close-request.json is not a close-request document this loop can act on:
schema_version is live-trading-close-request-v1...` on every tick. **Close now on this PC still works** - it runs the
order tool directly and never touches the log - so a hand close is one press away while this window is open. The
window closes when `main` carries both the v2 document and the new page; runbook section 5b.2 has the order.

**This paragraph described the branch, not `main`, until 2026-10-25.** `liveTradingAccounts` was written on
`workers/live-trading-20260929` and never merged, so the published page drew no account card at all: the
heartbeat the publisher carried had no reader, which is why two days of an unarmed loop read as ordinary on the
page. Section 11 records the port, the host row and the stale rule that now make it visible.

## 8. What has to be true before you leave, in order

1. Host bought (section 2), first RDP session, Windows licence confirmed on the invoice.
2. Dedicated user + autologon + one MT5 install per lane, logged in, with a Startup shortcut; Algo Trading **off**.
3. `npm test` on the host: **758 pass, 0 fail** on this checkout (2026-10-24), with the live-trading suites green:
   19 document tests, 66 trader tests, 6 browser close-control tests, 54 feed, 39 lanes+feed-publish, and the secret
   scanner's 5/5. Any failure on the host is a difference between the two machines, not a known one.
4. `-Test` on both registration scripts and on the lanes publish script; one read-only snapshot carrying the masked
   login `***614`, and the lanes publisher's `-Test` answering `would_publish` with lane 2 `disabled` and
   `origin/main` unchanged. Register the trader with `-Lane` (or let it resolve from the lanes file's root) and check
   the generated wrapper carries `--lane "<id>"`.
5. Lane 1 registered **unarmed**, one tick, log line `"status":"planned"`, no new ticket.
6. Reboot with nobody logged in: a fresh snapshot within 15 minutes.
7. Arm lane 1 only if 1-6 pass and no other writer is running, then shut the PC down for 30 minutes and watch the
   page stay fresh.
8. Rollback is runbook section 8: unregister the host trader first, then the publisher; re-register on the PC.

One publisher at a time: if a lane is publishing through `register-live-trading-feed-task.ps1 -Publish`
(`LiveTradingFeedTick019`), that task is unregistered before `register-live-trading-lanes-publish-task.ps1` is run
for the same root (runbook section 5b), because two tasks pushing `main` is the race the lanes publisher exists to
remove. Lane 2 stops at step 5 until the FTMO answer (section 4) is in writing; the coordinated publisher it used to
wait for now exists (section 7.1), so switching it on is its own clone, terminal and task names plus
`"enabled": true` in the lanes file - and, today, nothing on the page draws a second account yet (section 7.2.1).

## 9. What is not claimed

- No host, no terminal, no autologon and no task has been created or tested. Nothing in section 8 has been run.
- No observation has started, so there is no duration to report; the 12-hour check is not done and will not be
  claimed.
- It is the weekend. Nothing about execution behaviour - placing, fills, exits, the 90-second settle against a live
  tick - can be verified until the market reopens; a quiet weekend proves only that a schedule fires.
- The cloud schedule is **no longer absent, and still not trusted**: as of 2026-10-24 the eight agents had no
  schedule of their own and were started only behind the Master Orchestrator's webhook, with irregular observed
  calls. [LAYER1_SCHEDULE_VERIFICATION_20261024.md](../orchestration/LAYER1_SCHEDULE_VERIFICATION_20261024.md)
  records that API read. Since then `.github/workflows/master-orchestrator-daily.yml` calls that webhook once a day
  at 07:00 `America/New_York` ([ORCHESTRATOR_DAILY_TRIGGER.md](ORCHESTRATOR_DAILY_TRIGGER.md)); the first week of its
  runs is the evidence that the cadence exists, and `scripts/verify-layer1-schedules.js` still encodes a per-agent
  07:00 intent the instance does not implement (that script is untracked and unowned here).
- The trader heartbeat is written on this PC but **not yet published**: the running publisher is still the
  single-artifact `LiveTradingFeedTick019`, so the page's lane 1 card says "no heartbeat published" until the lanes
  task replaces it. **Superseded 2026-10-25**: the lanes publisher is now the only publisher on this PC and the
  heartbeat travels with the snapshot - see section 10.

## 10. 2026-10-25: the publisher switched, and the production trader was found unarmed

### 10.1 The one publisher, and the snapshot that kept running

`LiveTradingFeedTick019` was re-registered **without** `-Publish` at 2026-10-25T19:48:37Z. Its wrapper now reads
`--once --align --quiet ...` and carries no `--publish`; the registration reports `publishes_anything = false`. The
snapshot cadence itself is untouched: one aligned producer run per M5 bar into `data/live-trading.json`, logged in
`tmp/live-trading-feed.log` (19:45:21Z was the last read before the change).

`LiveTradingPublishLanes019` was registered at 2026-10-25T19:49:13Z and took its final shape at 20:03:21Z: a ten-minute
clock, `--min-interval-seconds 540`, `--config config/live-trading-lanes.json`, and
`--checkout D:\trading-agent-dashboard-codex\.local\live-trading-feed-publish` - the same publish checkout and the same
state file (`tmp/live-trading-publish-state.json`) the old publisher used, and therefore the same lock
(`live-trading-publish.lock`, 900s TTL).

**Why the gate is 540 and not 600.** The interval is measured from the *publish*, which happens a few seconds after its
tick, so a 600-second clock against a 600-second gate refuses every other run - the second tick is 595s after the
publish, not 600 - and a ten-minute clock would have published every twenty minutes. 540 sits inside the tick with a
55-second margin and still holds six publishes an hour, the script's own budget against GitHub's ten-builds soft limit.
The first tick under the final shape logged `too_soon` - "the last publish was 216s ago, inside the 540s cadence" - and
the **20:13:51Z tick published** (commit `5290ac46`, 795s after the previous publish, three files again). From here the
spacing between publishes is one clock interval, ~600s, which is inside the 540s gate, so every tick publishes: a
ten-minute cadence, six builds an hour. The publish line itself is now evidence a reader can quote - `"action":
"published"` with the lock holder's pid, start time and checkout in the same line.

**The real run's one JSON line is kept.** The wrapper the task runs now appends to `tmp/live-trading-lanes-publish.log`.
Before this, only the self-test logged: a gated tick and a publish both exit 0, so from outside there was nothing to
read except the state file - which is written only when something is published.

The engine `scripts/publish-live-trading-feed.js` is kept: the lanes publisher calls it. What is retired is the
single-artifact **invocation** - the `-Publish` flag on the feed task - not the file.

No overlap, in three places: the feed task cannot publish any more (no flag); the lanes task is registered
`MultipleInstances IgnoreNew` with a 15-minute limit, as the feed task is with 10; and the publisher's own lock refuses
a second real publish on the shared checkout/state. The first two real lanes ticks (19:49:13Z and 19:49:41Z) exited 0
as `too_soon` - "the last publish was 337s ago, inside the 600s cadence" - which is the interval gate doing its job,
not a failure; the first publish was due at 19:59:41Z.

The lanes publisher's own `-Test` (a `--force --dry-run`, so it cannot commit or push) answered `would_publish` with
`extras` = `data/live-trading-trader.ftmo-1.json` and `data/live-trading-lanes.json`, lane 1 identity `***614`
matched, and lane 2 `disabled` - "the lanes file marks this lane disabled, so it is not read and not published".

**The first real lanes publish landed at 2026-10-25T19:59:46.541Z, commit `0b2a1c67`**, three files in one commit:
`data/live-trading.json` (generated 19:55:20Z), `data/live-trading-trader.ftmo-1.json` and
`data/live-trading-lanes.json`. Read back from the Pages origin, not from the checkout: the lanes document carries
lane 1 `status: "published"` with `trader: {published: data/live-trading-trader.ftmo-1.json, written_at_utc:
2026-10-25T19:56:32.204Z, armed: true, status: nothing_to_place}`, and lane 2 `enabled: false`, `status: "disabled"`,
`reason: "the lane is disabled, so no trader runs it"`. The heartbeat file is served on its own URL with lane
`ftmo-1`, `armed: true`, `account ***614 FTMO-Server`, `positions_open: 1`, `orders_open: 0`, `ours: 1`. Then
`node scripts/check-live-trading-publication.js` reports
`ftmo-1 | ok | enabled | identity ***614 (matched) | snapshot 349s of 900s | heartbeat 278s, armed` and
`ftmo-2 | disabled` - exit 0, where before the switch it said "heartbeat not declared" and could only check the
snapshot.

**Publishing status and armed status are separate fields and stay separate.** A lane row's `status` answers "are this
lane's artifacts published" (`published` / `disabled`); `trader.armed` answers "may its loop send" (`true` / `false`).
A lane can be published with an unarmed loop, and that combination is exactly what lane 1 showed for two days.

**What the page draws, precisely.** `script.js` reads this document for the lane id a close request is stamped with
(`liveTradingLanesUrl`), and no element of the page renders the heartbeat or the lane rows yet. So the heartbeat is
published and served on the site's own URLs, but nothing on the page's cards displays it: that is a page change, not a
publishing gap, and it is the next UI item if the heartbeat is to be read on the page itself.

### 10.2 The production loop had been unarmed since 2026-10-24 19:35Z

`tmp/live-trading-trader-run.cmd` was rewritten at **2026-10-24T19:35:28Z** (local 20:35:28, BST) and lost three
flags: `--confirm-live`, `--max-open 1` and `--expire-minutes 30`. The task name, the interval and the log line were
unchanged, which is why it read as a normal cadence. The wrapper kept as
`tmp/live-trading-trader-run.cmd.bak-20261005` still carries all three, so the before/after is readable on disk.

**Cause, not guess:** `scripts/register-live-trading-trader-task.ps1` wrote the live wrapper *above* its `-Show` and
`-Test` returns, so a read-only inspection (`-Show`) or a launcher self-test (`-Test`) rewrote the production command
line from the script's defaults - no `-Arm`, no `-MaxOpen`, no `-ExpireMinutes`. That is the only way this file
changes, and nothing else on this machine writes it.

**What 19:26:30Z therefore was:** the production scheduled task, running **plan-only**. Not a deliberate dry run and
not a separate process - `"armed": false`, `"status": "planned"`, and
`"reason": "not armed: --confirm-live was not passed, so nothing was sent and no signal bar was spent."` Every tick
from 19:35Z on 24 October to 19:46:30Z on 25 October read the account, the calls and the ladder, reviewed the pending
orders and the open position, and sent nothing. The last armed tick before the disarm was **2026-10-23T19:31:30Z**
(`"armed": true`, `"status": "placed"`), which placed ticket `302712595` at 19:31:32.365Z.

**Fixed, and made hard to repeat.** The wrapper is now written only on the path that really registers the task; `-Show`
is read-only (its output includes `live_wrapper_armed`, read from the wrapper) and `-Test` cannot touch it; and every
registration keeps the previous wrapper as `...cmd.bak-<yyyyMMddHHmmss>` before replacing it. Re-armed at
**2026-10-25T19:50:35Z** with the last authorised configuration - `-Arm -MaxOpen 1 -ExpireMinutes 30 -MaxPerDay 4`,
lane `ftmo-1` - and the first armed tick at 19:51:30.011Z reports `armed: true`, caps
`expire_minutes 30 / max_open 1 / max_per_day 4`, `status: nothing_to_place`, nothing sent. A leftover unarmed process
from the pre-arm registration reached the same bar and was refused by the loop's own lock ("another run holds the
lock"), so exactly one loop acted - the armed one.

### 10.3 Exposure and the management it was (not) getting

Read from the order tool's own journal at 2026-10-25T19:46:32Z, `***614 FTMO-Server`: balance 10014.23, equity
10009.40, **one** open position, **no** pending orders.

| field | value |
| --- | --- |
| ticket | 302712595 |
| symbol / side / volume | XAUUSD buy 0.01 |
| open price | 3997.55 |
| stop loss / take profit | 3983.25 / 4069.03 |
| magic | 20261004 (this lane's) |
| comment | `l2l-rule-gold` |
| floating P/L at 19:46:32Z | -4.25 |

While unarmed, that position had only the stop and target it was placed with: the breakeven move (which would trigger
at 4026.142, twice the 14.296 risk), the close-on-a-turned-call, and pending-order cancellation are all sends behind
`--confirm-live`, and a plan-only run writes down what it would send and leaves the account alone. The review itself
was still running every five minutes: GOLD's call reads `BULLISH_LEAN` and stands, so the row's decision was `keep` -
"the long call for GOLD is still standing, so this position stays". With the loop armed again the same review now acts,
and `--max-open 1` against one working ticket means no second ticket can be placed on any pair until this one closes.

**Sole production writer, confirmed before arming:** one PC, one trader task (`LiveTradingTraderTick019`), one loop
process per tick (the lock refused the duplicate), one publisher task, one publish checkout, and no VPS. Lane 2 is
`"enabled": false` in `config/live-trading-lanes.json`, so no second account has a loop or a snapshot anywhere.

### 10.4 The cart being bought (verified figures, what to read off the screen)

Contabo, UK billing (the vendor's tax list reads "United Kingdom (20.0% VAT)"), **1-month** initial term, with the
following term equal to the initial one:

| line | selection | verified figure |
| --- | --- | --- |
| product | Cloud VPS **Core 4** - 4 vCPU, 8 GB RAM, 100 GB SSD, 200 Mbit/s | €5.50/month on a 1-month term |
| licence | **Windows Server Datacenter** (billed separately from the plan) | +€8.00/month |
| region | **United Kingdom** (Portsmouth) | +€1.05/month surcharge |
| subtotal before VAT | | €14.55/month |
| UK VAT 20% | | €2.91 |
| **total** | **order 15592634, paid 2026-10-25** | **€17.46, one month, no setup fee** |
| 24-month alternative | €12.40/month before VAT, renews for another 24 months | not chosen |
| OS install | Windows Server **with Desktop Experience** | required - Server Core has no GUI and cannot run the MT5 terminal |
| provisioning | normally 30 minutes, up to three hours | the host is not assumed to exist until the email says so |

The estimate this section carried before the order (€16.20) came from the configurator's plan and licence lines
alone; the cart added the UK surcharge, which is €1.05 net and €1.26 with VAT. That is the whole of the
difference, and it is a correction to the record rather than a change of plan.

The order was read off the cart on these items and none of them differed: no setup fee line, a 1-month term, VAT
at 20%, a Windows selection with Desktop Experience, and the United Kingdom as the location. The one number that
did move was the total - €17.46 rather than the €16.20 estimated from the plan and licence lines, because the
cart carries a UK surcharge. Two items were still **not** confirmed from the vendor's own pages before the order -
the exact Windows Server version and the Desktop Experience wording - so both are read on the host at first login
(`Get-ComputerInfo` and the presence of `explorer.exe`), and `scripts/prepare-live-trading-host.ps1 -Mode Verify`
fails if Desktop Experience is not there.

### 10.5 What is still between here and "PC off"

1. The host is **bought and not yet delivered**: Contabo order 15592634, €17.46 paid, provisioning normally 30
   minutes and up to three hours. Nothing below is claimed until the email arrives and the first login proves the
   Windows build. Access, the one-time remote-access setup and the account #2 checklist are written down in
   [VPS_ACCESS_HANDOFF.md](VPS_ACCESS_HANDOFF.md).
2. On the host: one MT5 install per lane, logged in, Startup shortcut, Algo Trading **off**; then the three `-Test`
   runs (feed register, trader register, lanes publish), then a snapshot carrying `***614`.
3. State migration, in this order: `tmp/live-trading-trader-state.json` (held 36, cancellations 4, closes 1, moves 3),
   `tmp/live-trading-orders.log` (the journal), `tmp/live-trading-trader-status.json` (the heartbeat), then
   `data/live-trading.json` (regenerated anyway). The lanes file's `root`, `terminal` and `tasks` lines are the only
   edits lane 1 needs on the host.
4. Cutover is stop-before-start: **unregister** the PC's `LiveTradingTraderTick019` first, confirm no
   `run-live-trading-trader.js` process remains, then register the host's trader unarmed, one tick, then arm it - and
   only then move publishing (the PC's `LiveTradingPublishLanes019` removed before the host's is registered, because
   two publishers on one branch is the race section 10.1 is about).
5. Reboot recovery: `StartWhenAvailable` on all three tasks, autologon, the terminal's Startup shortcut, then one
   reboot with nobody logged in and a fresh snapshot inside 15 minutes.
6. PC-off checks: the page's snapshot and heartbeat ages, `node scripts/check-live-trading-publication.js` (it reads
   the lanes document and, once the lanes publisher has run, the heartbeat that document declares), and the 07:07 New
   York orchestrator slot recorded in [ORCHESTRATOR_DAILY_TRIGGER.md](ORCHESTRATOR_DAILY_TRIGGER.md).
7. External monitoring is still manual: the Actions run list and the publication checker. Nothing pages anyone while
   the PC is off.

Account #2 stays parked (`"enabled": false`) and blocks none of the above: switching it on is a second clone, terminal
and task names, plus that one line in the lanes file.


## 11. 2026-10-25, late: the account card, the bundle and the read-back

Four things were built and one hazard was found. All of it is on `main`; the three scripts the PC runs were
copied to the runtime checkout byte-for-byte, so the next tick carries them.

### 11.1 The account card now says whether a loop is alive, and where it is

The strip that only existed on the branch is on the published page. Each card draws: lane state (enabled or
disabled), the account, arming, the last heartbeat with its age and instant, the last result, the snapshot age,
the trader host, and the open position count.

Two rules make it honest:

- **Armed and fresh are separate fields.** A heartbeat older than three ticks (900s at the M5 cadence the
  heartbeat itself states) is drawn as **HEARTBEAT STALE**, with a sentence above the rows: it was armed when it
  last wrote, and nothing shows a loop running now. The arming row reads "armed when last seen - no run since"
  rather than "armed". A heartbeat with no readable time is treated as stale, because silence cannot be shown to
  be current.
- **The host is evidence, not configuration.** The trader writes `host: { computer, platform, checkout }` into
  its heartbeat; the publisher copies the host into the lane's row in the same commit, so a device holding an
  older artifact still sees which machine wrote it. The publisher never stamps its own name: during a cutover
  the publisher and the loop can be on different hosts, and the page must show the loop's host. The absolute
  checkout path is deliberately not published - it would name the operator's profile.

Lane 2 stays **DISABLED** with the sentence that says it is parked rather than broken, and no arming row at all:
a lane with no trader must not borrow one. Rows are stacked at phone width (one column under 560px) and the test
holds a 390px viewport to no sideways overflow.

The older strip on `workers/live-trading-20260929` is superseded by this one. That branch's copy was never
merged and is not served; the next sync of the branch should take `main`'s, not keep two implementations of the
same card drifting apart.

### 11.2 The self test could have armed the loop; it no longer can

`-Arm -Test` used to pass the registration's own `--confirm-live` into the wrapper the self test ran, so proving
the launcher could have placed a ticket. `-Test` now runs **unarmed, always**, against its own state, journal, log
and lock under `tmp/live-trading-selftest`, and it fingerprints the production wrapper and the production task
definition before the run and again after it: a change to either one throws instead of passing quietly. `-Show`
gained `wrapper_sha256` and `task_sha256`, so an inspection names what it read.

The regression for this is a real run, not a comment: `tests/live_trading_trader.test.js` registers nothing,
executes `-Show` twice against a throwaway checkout, and asserts the wrapper's hash, the directory listing and
the output are all unchanged.

### 11.3 Effective settings are read back, and two readings are compared

`scripts/export-live-trading-effective-config.ps1` reads the four places the effective answer lives - the
wrapper, the task definition, the lanes file and the heartbeat - and writes one document. It parses
`--confirm-live`, `--max-open`, `--max-per-day`, `--expire-minutes`, `--align`, `--settle-seconds`,
`--interval-seconds`, lane, the account identity from both the heartbeat and the lanes file, and the checkout,
terminal, state, log, lock and journal paths. `-Compare` sorts the differences into **behaviour** (a change in
what the loop does: exit 1) and **location** (a path that moved: exit 1 until `-AllowRelocatedPaths` says the
move is intended). Same-host comparisons also compare the wrapper and task hashes; cross-host ones say they
skipped them rather than reporting a difference that is not one.

Read back on this PC at 2026-10-25T20:50Z: lane `ftmo-1`, **armed true**, `max_open 1`, `max_per_day 4`,
`expire_minutes 30`, `settle_seconds 90`, `align true`, account `***614 / FTMO-Server` (heartbeat and lanes file
agree), task `LiveTradingTraderTick019` Ready with `PT5M`, `IgnoreNew`, `PT10M`, and wrapper
`49172f4e…755f9`. That document is the "before" side of the cutover comparison.

The baseline kept for the cutover is `.local/live-trading-effective-before-20261025.json`, written at 21:24Z from
commit `9ddb3853` on `DESKTOP-UD0L47I`. The wrapper hash `49172f4e…6755f9` and the task hash `2824d100…ece6ac`
are the same values as the 20:50Z reading, which is what the scripts' own edits should look like: the code changed
and production did not. Compare the host's reading against this file with `-Compare`; the two paths that will
differ are the checkout and the state/log/lock/journal paths, and both must be named and accepted, not skipped.



### 11.4 The migration bundle, prepared but not final

`scripts/prepare-live-trading-migration.js` writes one directory per lane holding the state, journal, run log,
heartbeat, wrapper, lanes file and publish state, each with bytes and SHA-256, plus a manifest that names the
checkout, commit, dirty flag, restore order, and a `heartbeat` block that says the copied record is history and
not proof of a running loop. Credentials are not in it and a file that matches a password, token or key pattern
refuses the run rather than being redacted. `--verify` re-hashes everything, refuses an unnamed file, and
re-scans. `docs/live-trading/MIGRATION_CUTOVER.md` is the procedure: stop the PC and prove the process exited,
take and verify the final copy, reconcile positions, pendings and deal history, install the host, restore in the
manifest's order, compare the effective settings, prove the PC cannot restart its trader, arm only the host and
verify a newly generated heartbeat, then move publishing last, with a rollback for each half.

The provisional bundle sits at `<checkout>/.local/live-trading-migration/ftmo-1` (git-ignored) and was rebuilt
after the host field landed. It is **not** the cutover copy: the PC keeps writing state while it trades, so the
copy taken after the stop is the one restored, and the manifest says so in `provisional`.

### 11.5 What is ready, what is proved, and what is still yours

- **Ready:** the card and its tests; the host field end to end (`heartbeat` to publisher row to page); the read-back
  and comparison script with its tests; the bundle, its verifier and the cutover/rollback procedure.
- **Proved on this machine:** 615 unit and 84 browser tests green; `-Show` proved read-only by hash; the two
  effective-config readings compared (`identical`); the real bundle written and `--verify`d on live state; the
  page drawing a fresh armed card, a stale armed card and the parked lane at 390px.
- **Proved on the deployed page** (2026-10-25T21:22Z, `https://kevincreedycars-debug.github.io/trading-agent-dashboard/`):
  lane 1 badge **LIVE** with `DESKTOP-UD0L47I`, armed, `nothing_to_place`, no stale alert; lane 2 **DISABLED** and
  parked; no page script errors; at 390px the page and both cards overflow by 0px and the rows stack to one
  column. The served `data/live-trading-trader.ftmo-1.json` carries `host.computer: DESKTOP-UD0L47I`,
  `expected_interval_seconds: 300`, `armed: true`, written 21:11:34Z. `scripts/check-live-trading-publication.js`
  exits 0 (lanes 2, failing 0). The stale card cannot be produced live while the PC trades, so it is proved by
  fixture in the browser suite rather than by the published page.
- **Not proved:** that the host trades correctly after a restore, that a reboot recovers with nobody logged in,
  and that the PC stays off. Those need the host. The rollback is documented step by step and its two mechanical
  parts are tested - the bundle that would be restored verifies byte for byte, and the registration script keeps
  the wrapper it replaces - but the full stop/restore/arm cycle has not been rehearsed, because a rehearsal needs
  the second host it is meant to protect.
- **Yours, and now only this:** the provisioning email, the first RDP login, and the stop-and-arm at cutover.
  The cart is bought (order 15592634, €17.46, one month, UK, Windows Server) and the €16.20 in this section is
  superseded by §10.4's corrected table; the IONOS quote is closed as unused. What replaced "wait for a host" is
  §12: an account probe that reads a lane's identity and symbol rules, and a prepare/verify script that names
  every host-side claim before anything is armed. Nothing in this section changes what the PC is doing: one
  trader, one publisher, lane 2 disabled.


## 12. 2026-10-25, later: the host is bought, and every host-side claim is now checkable

### 12.1 The purchase, and the correction it forced on this record

Contabo order **15592634**, **EUR 17.46 paid**, Cloud VPS Core 4 (4 vCPU, 8 GB RAM, 100 GB SSD), Windows Server,
one-month term, United Kingdom. Provisioning is under way: the confirmation says normally 30 minutes and
potentially up to three hours, so the host is treated as **not existing** until the provisioning email says it
does, and the Windows build and Desktop Experience are read at the first login.

The record's own estimate was wrong by EUR 1.26 and the error is instructive rather than embarrassing: the UK
region surcharge (EUR 1.05 net) is a cart line, not a configurator line, so an estimate built from the plan and
licence rates alone lands at EUR 16.20 while the cart lands at EUR 17.46. Corrected in §2 (block plus table),
§10.4 (the ordered cart), §10.5 item 1 and §11.5. The IONOS line is closed: nothing was bought there and no quote
is outstanding.

### 12.2 Access: what to do when the email arrives, and where the secret goes

The whole sequence is [VPS_ACCESS_HANDOFF.md](VPS_ACCESS_HANDOFF.md). The short form, because the order matters:

1. **Keep the password in the email and in the local DPAPI store, never in chat, Git, a log or the migration
   bundle.** The store is the one this repository already uses (`%USERPROFILE%\.trading-agent-dashboard\`,
   `set-credential.ps1`, no echo, encrypted per user). Three names were added to `config/credential-manifest.json`
   so that script will accept them: `VPS_HOST` (non-secret), `VPS_RDP_USER` (non-secret), `VPS_RDP_PASSWORD`
   (secret). Run `set-credential.ps1 -Name VPS_RDP_PASSWORD` and type the password at the prompt.
2. **First login by RDP**, once, and paste the one-time block in §3 of the handoff doc: it installs OpenSSH
   Server, installs the key below, turns password login off for `sshd`, and narrows SSH and RDP to one source
   address.
3. **From then on I connect with the key, not the password**: `ssh -i .local\vps-access\id_ed25519
   Administrator@<host>`. Key-only auth is what makes it possible to automate the build without a credential ever
   appearing in a command line, a log or a document.

The key pair exists as of this session, generated locally and never exported:

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJr9y6QMdql8e5RQTAcYS1vfk18nG39Buht8tpHDWP0z trading-agent-vps-access 2026-10-25
```

That line is a **public** key and is safe to paste into the host; the private half stays in
`.local\vps-access\id_ed25519`, which is inside the ignored folder. The private key has no passphrase, because a
passphrase that has to be typed defeats unattended automation; the compensating controls are the ACL on the file,
key-only SSH, and the fact that both RDP and SSH are limited to a named source address. If the PC's public IP
changes (it is a domestic address, `46.208.115.96` at the time of writing), the firewall rule is what has to be
updated - in the Contabo panel or on the host - and that is a step the handover doc spells out for the phone case
as well.


### 12.3 Two new tools, because "the host looks right" is not a check

The gap this session closed is not a missing step in the runbook; it is that the host after the build could be
wrong in ways nothing in this repository would notice. Both tools read and neither writes.

**`tools/mt5-bridge/live-trading-account-probe.py`** answers, per lane, against one terminal: which account is
logged in (masked, `***614`-style), on which server, with what currency, leverage, margin rules and permissions,
and for each instrument the plan names - is it known, is it in Market Watch, is its trade mode full, what are its
digits, contract size, volume step and stops level. It takes the terminal path as an argument, because on a host
with two terminals a bare `initialize()` attaches to whichever answers, and it prints one JSON document so the
prepare script can read it. It names no order function and the suite asserts that; it does not even select a
symbol, so it cannot change Market Watch.

Proved against the live terminal at 2026-10-25T21:32Z: build 6231, connected, account `***614` on `FTMO-Server`,
USD, leverage 30, balance 10014.23, `trade_allowed` and `trade_expert` true, margin mode retail hedging, one open
position, and all four instruments (EURUSD, XAUUSD, US100.cash, BTCUSD) known, visible and full trading. That is
the reading the host's lane 1 has to reproduce after the restore, and the reading lane 2 has to reproduce for its
own account - which is why the probe compares against the lanes file rather than merely printing.

**`scripts/prepare-live-trading-host.ps1`** has two modes that share one list. `-Mode Plan` prints the ten build
steps with the command each one runs and the fact it proves, and changes nothing. `-Mode Verify` reads the host
and emits one check per claim, `blocking` or `advisory`, with `-Out` for the JSON a reader can diff later. The
claims are the ones that have bitten elsewhere in this project:

- Desktop Experience present (`explorer.exe`, installation type), because Server Core cannot run a terminal;
- node 20+, git, python 3.13, `MetaTrader5 5.0.6231` - the versions the PC proved;
- an execution checkout and a publisher checkout that are **neither the same tree nor nested**, each exactly on
  `-PinnedCommit` and the runtime one clean, and **no scheduled task that pulls or reinstalls code**;
- auto-logon on with a stored password, RDP enabled with NLA, `sshd` present - reported as facts, and the first
  two blocking because "recovers with nobody logged on" and "reconnect from the phone" are those two fields;
- per lane: root, terminal, wrapper, declared state/log/lock/journal, and the account identity in the lanes file;
- **no path and no task name shared between lanes** (terminal, state, log, lock, journal, heartbeat, published);
- **the heartbeat's `host.computer` must be this computer** - a copied heartbeat is history, not health, and that
  is exactly what a migrated lane's first hour looks like;
- heartbeat fresh within 3 x its own `expected_interval_seconds`, feed fresh within 900s;
- the lane's trader task registered, and its **logon type not `Interactive`** - a task that only runs for a logged-on
  user never runs on a host whose session nobody opens;
- with `-ProbeTerminal`: the terminal is reachable, the masked login and server match the lanes file, permissions
  allow trading, and every symbol in the lane's own feed is fully tradable.

**What the PC's own run says**, and it is worth reading rather than glossing: on the live checkout, lane 1 passes
identity, wrapper, isolation, freshness, terminal and probe checks, and **fails
`lane_ftmo-1_trader_runs_without_logon`** - its task's logon type is `Interactive`. That is the precise reason a
reboot on this PC with nobody logged in would not bring the loop back, and it is the check the host must pass
before the PC is allowed to go quiet. With the seven checks that cannot apply to this machine named with
`-IgnoreCheck` (checkout separation and pinning, auto-logon, RDP, the PC's interactive task, and the runtime tree's
own uncommitted files) the same run prints `result = host_ready` and exits 0, which is how the exit code was shown
to follow the checks rather than the mood of the run.

`-IgnoreCheck` never turns a failure into a pass: the check keeps `ok: false`, its reason, and the line is marked
`skip` and prefixed `ignored by -IgnoreCheck:`. At cutover nothing is ignored.



### 12.4 Account #2: the exact list, and nothing invented to fill it

Lane 2 is prepared in structure (`root: ../ftmo2`, its own terminal path, its own three task names, its own
`status_published`) and blocked in four facts. The authoritative checklist is in
[VPS_ACCESS_HANDOFF.md](VPS_ACCESS_HANDOFF.md) §5; what the verify run reports on the PC today is:

| Check | Reads now | What answers it |
| --- | --- | --- |
| `lane_ftmo-2_account_identity_configured` | fail - the lanes file holds no login and no server | the account number (masked to its last three digits here) and the server name **exactly as the terminal shows it**, from the FTMO account page |
| `lane_ftmo-2_terminal_present` | fail - `C:\Program Files\FTMO Global Markets MT5 Terminal 2` does not exist | the second terminal install on the host, logged in by hand to account 2 |
| `lane_ftmo-2_wrapper_present`, `..._trader_task_registered` | fail - nothing registered because the terminal is not there | the lane's own registration, unarmed, after the terminal exists |
| `lane_ftmo-2_heartbeat_written_here` | fail - no heartbeat | one tick of that lane's own trader on the host; a copied one would be meaningless |

Two of those four are mine to do the moment the terminal exists; the first is the one only the user can supply.
Not copied from lane 1, deliberately: the login, the server, the ticket history, the state file, the journal and
the heartbeat. Copied on purpose, because it is one strategy with one set of caps: the rule, `--max-open 1`,
`--max-per-day 4`, `--expire-minutes 30`, `--settle-seconds 90`, the alignment rule and the four instruments -
and no price offset anywhere, since shifting a limit to look different from lane 1 would be inventing a strategy
to satisfy a check.

### 12.5 What is proved, and what is not

- **Proved today:** the purchase and its corrected figure; the key pair and the access sequence, written down
  rather than remembered; the probe against the live terminal (identity, permissions, all four symbol
  specifications); the prepare script's plan ordering and its read-only promise; the verify script's isolation,
  pinning, heartbeat-host and unattended-logon checks, each failing for its own reason in a fixture and passing
  when the fixture is corrected; the exit code following the check list; the PC's live run naming the interactive
  task as the reboot gap.
- **Not proved, and not claimed:** anything on the host. No login, no Windows build, no Desktop Experience, no
  terminal, no task, no restore, no reboot with nobody logged on, no RDP-from-phone reconnect, no PC-off run, no
  automatic daily trigger (the first slot is 2026-10-26 11:07Z and it is still an attempt), and no external
  monitoring beyond a person running the checker.
- **Next, in order:** wait for the email; §12.2 steps 1-3; run `-Mode Plan` against the real roots and follow it;
  `-Mode Verify -ProbeTerminal -PinnedCommit <commit>` until every check is `ok` (nothing ignored); then the
  cutover in [MIGRATION_CUTOVER.md](MIGRATION_CUTOVER.md), with publishing moving last.
- **The pinned commit to deploy:** `5a73c295b3cede5bce0172603c8d1bf14c8e7dcb`, pushed to `main` at
  2026-10-25T22:08:36Z - the commit that carries the probe, the prepare/verify script, the access handoff and the
  monitor. It is **not** a floating reference: the host clones this SHA into both checkouts, and
  `-Mode Verify -PinnedCommit 5a73c295` fails if either tree has moved. Later commits on `main` are the live
  publisher's data files; they are not code and the host does not pull them.
- **The observation clock, stated honestly.** The external monitor's first scheduled run is the first
  measurement taken from outside this PC, and it starts from 2026-10-25T22:08Z. The *unattended operation period*
  the user asked for cannot start at that timestamp: it starts when the host trades, the PC is off and the
  monitor stays green across at least one scheduled daily signal. Durations will be reported from that moment,
  not from this one.
