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

**The page prices, read on 2026-10-24 evening.** Contabo's Windows pages answered this time, so the numbers below are
the provider's own, not a guess:

| Product | Spec | Price shown (24-month rate) | Verdict |
| --- | --- | --- | --- |
| Contabo **Cloud VPS 4 + Windows Server** | 4 vCPU, 8 GB RAM, 100 GB SSD, 1 snapshot, 200 Mbit/s | €5.50/month incl. VAT (€4.40 excl.) | **the one to buy**: meets the floor, UK is a listed location |
| Contabo **Cloud VPS 6 + Windows Server** | 6 vCPU, 12 GB RAM, 200 GB SSD / 100 GB NVMe | €7.50/month incl. VAT (€6.00 excl.) | the comfortable option: two terminals plus Node and Python leave room |
| Contabo Cloud VPS 8 + Windows Server | 8 vCPU, 24 GB RAM, 300 GB SSD / 150 GB NVMe | €14.00/month incl. VAT (€11.20 excl.) | more than this job needs |
| netcup VPS 1000 G12.5 | 4 vCore, 8 GB RAM, 128 GB SSD | €14.50/month incl. 19% VAT (12-month term) | **rejected**: netcup sells no Windows licence (self-install, 180-day trial only) |
| IONOS VPS+ Windows | not read: the plan table truncated on every fetch | - | unquoted rather than guessed |

- Order page: `https://contabo.com/en/windows-servers-vps/` (the product page carries the plan cards above; the licence
  is included in that price, and Contabo's own FAQ says a customer-supplied Windows licence is **not** allowed).
- Location list on the same page: Australia, India, Germany, Japan, Singapore, **United Kingdom**, United States.
  Choose the UK location at checkout, then ping the FTMO server from the box before trusting it.
- The €5.50 is the *24-month* rate the page headlines. If a 1-month term is wanted, the checkout shows that price
  instead; read the **term line**, the **Windows Server version** (2022 or 2025 with Desktop Experience - not Server
  Core, which cannot run MT5) and the **location line** before paying. Nothing here is bought yet.
- Account checklist for the purchase itself: business or private account with 2FA on, address and VAT details that
  match the card, a card that accepts foreign currency, the provider's abuse/support contact saved somewhere other
  than the host, and the invoice in the same mailbox the renewal notices reach.

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
  task replaces it.
