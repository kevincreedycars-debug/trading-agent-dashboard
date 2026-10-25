# Build runbook: the live stack on an always-on Windows host

**Status: prepared 2026-10-24, not bought and not built.** This is the current build plan for the
question *"can the live system keep trading while my PC is off?"*. It supersedes the parked status of
[VPS_SPEC.md](VPS_SPEC.md) but not its sizing work: VPS_SPEC was written on 2026-09-30 when the lane had a
read-only producer and no loop, so its sizing still holds and its inventory of moving parts is now out of
date. Nothing here is in force until the host exists and the acceptance tests at section 7 pass.

**Where this stands on 2026-10-24 (evening):** not bought, not built, no observation started. The purchase
dependency, the missing logins, the unverified cloud schedules and the two-lane code gaps are itemised in
[VPS_DEPLOYMENT_STATUS_20261024.md](VPS_DEPLOYMENT_STATUS_20261024.md), which is the page to read first; this
document stays the build plan.

## 1. What runs where today (observed on this PC, 2026-10-24)

| Piece | Where it runs | Evidence it is real |
| --- | --- | --- |
| Layer 1 calls, the direction artifacts | n8n **cloud** (`silver17.app.n8n.cloud`), publishing to `main` | `docs/N8N_INTEGRATION.md`; no task here touches it |
| The dashboard | GitHub Pages from `main` | published pages, feed commits |
| MT5 terminal (FTMO `FTMO-Server`, login `***614`) | this PC only | `C:\Program Files\FTMO Global Markets MT5 Terminal`, 5.0.0.6231 |
| Feed cadence `LiveTradingFeedTick019` | this PC, Task Scheduler, **principal `A17`, logon type Interactive**, `PT5M` | ready, last run 14:17, result 0 |
| Trader loop `LiveTradingTraderTick019` | this PC, same principal, `PT5M` | ready, last run 14:20, result 0, positions open |
| Gold capture `GoldQualificationWindowTick018` | this PC, same principal | separate research lane |

Both live tasks call a generated wrapper in `tmp/` (`live-trading-feed-run.cmd`,
`live-trading-trader-run.cmd`) through the windowless launcher
`%USERPROFILE%\.trading-agent-dashboard\scripts\run-hidden.vbs`. What those wrappers carry today, read
back from the scheduler rather than assumed:

- feed: `--once --align --publish --publish-min-interval-seconds 600 --quiet --python C:\Python313\python.exe ...`
- trader: `--once --align --settle-seconds 90 --confirm-live --quiet --max-open 1 --max-per-day 4 ...`

Versions the new host has to match or beat: node `v22.19.0`, Python `3.13.7` with `pip install MetaTrader5`,
git `2.53.0`.

The loop's own code is already merged: `scripts/run-live-trading-trader.js`,
`scripts/run-live-trading-feed.js`, `scripts/publish-live-trading-feed.js`,
`tools/mt5-bridge/live-trading-order.py` and `lib/l2l_strategy.js` are byte-identical on this lane and on
`origin/main` (checked by blob hash, 2026-10-24). So the new host runs a plain clone of `main` and behaves
exactly as this PC does today - no lane branch is needed there.

## 2. What has to move, and what must not

**Moves** (nothing else does):

1. The MT5 terminal, installed and logged in on the host, with `EURUSD`, `XAUUSD`, `US100.cash`, `BTCUSD`
   in Market Watch. The producer attaches to the running terminal over local IPC and cannot log in for it;
   the terminal must exist on the same machine as the producer.
2. The repository clone that holds the two runners and the order tool.
3. The two scheduled tasks, registered on the host exactly as they are here.
4. One git credential for pushing the feed to `main` (section 5, step 6). The runners carry no token; the
   publisher pushes with whatever credential the machine's git has for `origin`.

**Stays where it is**: n8n (already cloud), Pages, the published ladder and close-request files (the loop
fetches `origin/main` each tick), and the sealed Gold research window.

**Does not survive the move as-is**: the `l2lclose:` protocol handler (`register-live-trading-close-link.ps1`),
which is a per-user registry key on *this* PC that runs *this* PC's loop against *this* PC's terminal. From
another machine it is dead. The page's second close path is unaffected: a "close request" row written to
`data/live-trading-close-request.json` on `main` is read by the host's loop on its next tick, answered only
while the row is younger than thirty minutes. So after cutover, closing a position remotely means pressing
that, expecting up to five minutes, and the fast link only works when pressed from inside an RDP session on
the host.

**Separate decision, not part of today**: `GoldQualificationWindowTick018` also dies with this PC. It needs
`FRED_API_KEY` and `OANDA_API_TOKEN` out of `%USERPROFILE%\.trading-agent-dashboard\secrets\credentials.clixml`,
which is DPAPI-bound to this user on this machine, so a host copy means re-entering both values with
`scripts/local-credentials/set-credential.ps1`. Running it here and taking the gap in the capture series is a
research decision; it is not needed for trading.

## 3. The one trap: both tasks are *interactive*

`Get-ScheduledTask` reports principal `A17`, logon type **Interactive** for all three tasks. That is not a
detail: an interactive-logon task runs only inside a logged-in desktop session, and MT5 needs a desktop
session anyway. So the host has to come back up *by itself* after a reboot and hold an unlocked-to-the-
scheduler session with the terminal running, with nobody present:

1. **Autologon**: a dedicated local user with a long unique password, `Autologon`/`netplwiz` enabled for
   console logons (`HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon` `AutoAdminLogon`,
   `DefaultUserName`, `DefaultPassword` in `LsaStore`). Without this a provider reboot or a Windows Update
   reboot leaves the box at the sign-in screen and the cadence silently stops.
2. **Screen lock after logon is fine**; sign-out is not. Set a screensaver/lock timeout rather than anything
   that signs out or sleeps: set sleep to Never and never "lock then log off".
3. **The terminal starts with the session**: a Startup shortcut for `terminal64.exe`, with its saved login so
   it connects without a prompt. `Algo Trading` stays **off** - this lane never speaks to an EA, it attaches
   through the Python package.
4. **Optional but cheap**: a second, tiny task that starts the terminal if it is not running (every 5 minutes,
   `Get-Process terminal64 -ErrorAction SilentlyContinue`). Without it a crashed terminal is a mystery STALE
   badge until somebody logs in.

Verify this before arming anything: reboot the host with nobody logged in and watch a fresh snapshot appear.

## 4. Host

Sizing and OS come straight from [VPS_SPEC.md](VPS_SPEC.md) section 3: Windows Server 2019/2022 **with
Desktop Experience** (Server Core has no desktop and will not run MT5) or Windows 10/11 Pro, 2 shared vCPU,
4 GB RAM, 60-80 GB SSD, the provider's nearest data centre to `FTMO-Server`, Windows licence line confirmed at
purchase. Every main provider's entry Windows bundle is in this class; no price is quoted here because none has
been read today.

Two additions to VPS_SPEC's security section, because the box now *sends* as well as reads:

- The only inbound port is RDP, restricted to the user's own IP where possible, unique password, MFA at the
  provider if offered. Nothing else listens: the runners open no port.
- Only one machine may run the loop at a time. Two armed loops on one account can each place their own ticket
  for the same bar, so the PC's tasks come out *before* the host's go in (section 6).

## 5. Build, in order

Everything below is run **on the host**, in PowerShell, after it has a desktop session and the terminal is
logged in. Paths must contain no spaces: the registration script refuses a wrapper path it cannot hand to the
windowless launcher unquoted. `C:\live-trading` is used throughout.

1. **Runtimes** - node (22 LTS), Python 3.13, git for Windows. Then
   `C:\Python313\python.exe -m pip install MetaTrader5`. Check `node -v` works from a bare `cmd.exe`, because
   that is what the generated wrapper calls.
2. **Terminal** - install the FTMO MT5 terminal, log in to `FTMO-Server` with the live account, save the
   login, and add `EURUSD`, `XAUUSD`, `US100.cash`, `BTCUSD` to Market Watch. The producer attaches to a
   *running* terminal and does not select symbols itself.
3. **Clone** - `git clone https://github.com/kevincreedycars-debug/trading-agent-dashboard.git C:\live-trading`,
   then `git config user.name "<name>"` and `git config user.email "<email>"` in it: the publisher makes a
   commit per publish and inherits that identity. Stay on `main`.
4. **The windowless launcher** - copy `run-hidden.vbs` from this PC's
   `%USERPROFILE%\.trading-agent-dashboard\scripts\` to the same path on the host, or pass
   `-HiddenRunner <path>` at registration. Without it the script falls back to `cmd.exe` and prints that the
   window may flash.
5. **Read-only proof, before any task exists** (attaches to nothing but reads):
   `C:\Python313\python.exe tools\mt5-bridge\live-trading-snapshot.py --out tmp\vps-check.json` then
   `node scripts\validate_live_trading_feed.js tmp\vps-check.json`, then
   `node scripts\run-live-trading-feed.js --once --out tmp\vps-check-feed.json`. All three must end 0.
6. **The one credential** - a fine-grained GitHub PAT scoped to the single repository
   `trading-agent-dashboard`, permission `Contents: Read and write` (and `Metadata: Read`), stored in the
   machine's git credential helper rather than in a file:
   `git config --global credential.helper manager`, then
   `"protocol=https`nhost=github.com`nusername=<user>`npassword=<PAT>`n" | git credential approve`.
   Prove it *without* writing: `node scripts\publish-live-trading-feed.js --dry-run` (this creates the
   `.local\live-trading-feed-publish` worktree, runs the four gates and decides `would_publish`), then
   `git -C .local\live-trading-feed-publish push --dry-run origin HEAD:main` for the authentication itself.
   A real publish is the next step and it publishes Pages: the token can write the whole site.
7. **The suite, on the host** - the same focused set that is green here (186 tests, 2026-10-24):
   `node --test tests/live_trading_feed.test.js tests/live_trading_feed_cadence.test.js
   tests/live_trading_feed_publish.test.js tests/live_trading_trader.test.js
   tests/live_trading_order_tool.test.js tests/live_trading_close_request.test.js`.
   This is what proves the clone runs where it now is; it replaces nothing about the rule.
8. **Register the feed** -
   `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\register-live-trading-feed-task.ps1 -Test`
   (a one-shot self-test task; the verdict line says whether the launcher reached the runner), then the same
   command with `-Publish`. Watch one tick land with `"action":"published"` and a commit sha.
9. **Copy the loop's memory** - `tmp\live-trading-trader-state.json` from this PC to the host's
   `tmp\`, before the first armed tick. It holds the once-per-signal-bar holds (`held` 36 at the time of
   writing), answered close requests and spent stop moves; without it the loop does not know which bars it has
   already acted on. `tmp\live-trading-orders.log` is worth copying as the hand-read journal, but nothing
   depends on it.
10. **Register the trader, unarmed** -
    `... -File scripts\register-live-trading-trader-task.ps1 -Test`, then without `-Arm`. An unarmed tick reads
    the artifacts and records the ticket it would have left, and sends nothing.

## 5b. Two lanes, one publisher

Two accounts are two clones, two terminals, two sets of tasks - and **one** publisher. `config/live-trading-lanes.json`
is the whole wiring: each lane names the checkout its cadence writes in (`root`), its snapshot (`feed`) and the file
it publishes to (`published`). Lane 1 carries its masked login (`***614`) and server, so a snapshot from another
account refuses the run rather than publishing under the wrong label. Lane 2 ships `"enabled": false` because its
terminal does not exist yet: a disabled lane is reported `disabled` and skipped, so it cannot stop lane 1 publishing.

On the host, with `C:\live-trading` as lane 1 and `C:\ftmo2` as lane 2 (the lanes file's `root` values are `.` and
`../ftmo2`, so whichever directory lane 1 lives in, lane 2 is its sibling - edit those two lines if the layout
differs):

1. `node scripts\publish-live-trading-lanes.js --force --dry-run` - every enabled lane named, `would_publish`
   expected. A refusal names the lane and the reason (`has no snapshot at ...`, `publishes the snapshot carrying
   account ...`), and it refuses all of them rather than publishing a mixture.
2. **Retire the old publisher first.** If this host has `LiveTradingFeedTick019` registered with `-Publish`, run
   `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\register-live-trading-feed-task.ps1 -Remove` before
   step 4. Two publishers on one branch is the one race this design cannot repair after the fact.
3. `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\register-live-trading-lanes-publish-task.ps1 -Test` -
   a temporary task runs the wrapper with `--force --dry-run`, so it proves the launcher hop, the lanes file and
   the publish checkout's credentials without writing or pushing, then removes itself.
4. The same command without `-Test` registers `LiveTradingPublishLanes019` on a ten-minute clock and starts one run.
   Ten minutes is six Pages builds an hour against GitHub's documented soft limit of ten.
5. Read one tick: `"action":"published"` and a commit sha, or `"unchanged"` when the branch already carries every
   lane's snapshot. `tmp\live-trading-publish-state.json` holds the last publish.

Switching account 2 on, once its clone, terminal and FTMO answer exist:

1. Put its `account_login_masked` and `account_server` in the lanes file, read from its own snapshot, then delete
   `"enabled": false` (or set it to `true`).
2. Run the dry run again: both lanes named, each with its own identity checked.
3. Register lane 2's feed and trader tasks against its own clone - `-RepoRoot C:\ftmo2 -TaskName ... -Terminal
   "C:\Program Files\FTMO Global Markets MT5 Terminal 2"` - unarmed, one tick, and only then arm.
4. Nothing changes on the publisher side: the same task now publishes both lanes in one commit.

What this does not do: the page's strip lists both lanes and says account 2 is disabled until it is deployed, but
the tables under it - Open positions, working orders, closed trades, the rule panel - are still lane 1's own. A lane
2 ticket is not drawn anywhere yet, and its close control does not exist. That is the next page item.

### 5b.1 What travels with a publish, and what a close request now names

- **The lanes document and the heartbeat travel too.** `scripts/publish-live-trading-feed.js` takes `extras` - files
  copied and staged beside the snapshots in the same commit, and parsed as JSON so a truncated file can never be
  published. `scripts/publish-live-trading-lanes.js` uses that for `data/live-trading-lanes.json` (the account list the
  page reads) and each lane's `data/live-trading-trader.<id>.json` (that lane's heartbeat, written by its trader on
  every run). A missing heartbeat is published as "no heartbeat" and does not fail the run; a heartbeat naming
  another lane or another account refuses it.
- **A close request names its account.** `data/live-trading-close-request.json` is `live-trading-close-request-v2`:
  each row carries `account.lane`, the masked login and server, a unique `request_id`
  (`close-<lane>-<ticket>-<stamp>-<token>`) and its own `expires_at_utc` (never more than 30 minutes out). The loop
  answers only rows matching `--lane` **and** the terminal's own masked login/server; anything else is written down
  as `foreign_account` and nothing is sent. An id the loop has already answered is `replay`, written once.
- **`-Lane` on the trader task.** `scripts/register-live-trading-trader-task.ps1` resolves the lane id from the lanes
  file's `root` for `-RepoRoot` and writes `--lane "<id>"` into the wrapper. It refuses rather than guesses when the
  root matches zero or two lanes, and passing `-Lane` explicitly is always allowed. A loop registered without a lane
  would claim no close request at all and say so in its log.
- **A trade a person closed is not reopened.** If a closed trade left nearer neither its stop nor its target, or this
  lane wrote a close/cancellation for that ticket after it was placed, the trade is over: the level waits for the
  rule's own fresh crossing instead of putting the same ticket back. A stop-out differs - the level re-arms, as ruled.

### 5b.2 The close-request cutover window, and the fallback that still works

The v2 document and the page are one contract: the old page validates `schema_version === live-trading-close-request-v1`
and refuses to write into anything else, and the new loop refuses to act on a v1 document. So there is a window in which
the page cannot ask and the loop cannot answer, and it ends the moment both the v2 document and the new page are on
`main`. On 2026-10-24 that window is **open**: the branch carries v2, `main` still carries v1, and the running loop says
so on every tick in its own words ("the published data/live-trading-close-request.json is not a close-request document
this loop can act on: schema_version is live-trading-close-request-v1...").

What still works in that window: the **Close now on this PC** route. It hands the ticket to the local close link, which
runs the order tool directly and never touches the request log, so a hand close is one press away on the machine holding
the terminal. What does not: **Ask the loop instead** - from the old page it fails when it reads the v2 file, and from
the new page it cannot reach a v1 file - and the loop's own answer to any row.

The order that closes the window, at cutover rather than before:

1. merge the branch (page + v2 document) so `main` carries both;
2. run one lanes publish, which carries `data/live-trading-lanes.json` and the heartbeat beside the snapshot;
3. check it from outside: `node scripts/check-live-trading-publication.js` -> exit 0.

Doing (2) before (1) is also fine and is what the runbook's cutover section wants: a lanes publish that carries the
lanes document and the heartbeat while the old page is still served simply adds two files nobody reads yet.

## 6. Cutover, in this order

The only real risk in the whole exercise is two armed loops on one account, so the sequence is stop-before-start
and the state file travels with it.

1. On **this PC**: remove the trader first, so nothing can send while the feed is half moved -
   `... -File scripts\register-live-trading-trader-task.ps1 -Remove`, then
   `... -File scripts\register-live-trading-feed-task.ps1 -Remove`. Confirm with
   `Get-ScheduledTask -TaskName 'LiveTrading*'` that neither exists.
2. Copy `tmp\live-trading-trader-state.json` to the host (step 9 above).
3. On the **host**: re-register the feed with `-Publish` and confirm one publish lands.
4. On the **host**: re-register the trader **with** `-Arm`, keeping today's hand cap -
   `... -File scripts\register-live-trading-trader-task.ps1 -Arm -MaxOpen 1 -MaxPerDay 4` - which reproduces
   the wrapper this PC runs today (`--confirm-live --max-open 1 --max-per-day 4`).
5. Read one tick of each log and the dashboard badge, then shut the PC down.

## 7. How we test it

Three layers, cheapest first. Layer A runs today with no host; layer B is what makes the build trustworthy;
layer C is the only thing that answers "does it survive a week with my PC off".

**A. Here, now (already green, 2026-10-24):** the whole local suite - `node scripts/test-local.js` - is
**758 pass, 0 fail**, and the lanes+monitor suites are part of it. The live-trading files on their own:
`tests/live_trading_feed.test.js`, `live_trading_feed_cadence.test.js`, `live_trading_feed_publish.test.js`,
`live_trading_trader.test.js`, `live_trading_order_tool.test.js`, `live_trading_close_request.test.js`,
`live_trading_lanes_publish.test.js`, `live_trading_publication_monitor.test.js` and the four
`live_trading_*.browser.test.js` files. They prove the code that is about to move, not the box it moves to.

**A2. From anywhere, against the published page - the independent monitor.** `scripts/check-live-trading-publication.js`
reads only what the site serves, so it works from a phone, a second machine, or a watcher, and needs no credential:

```powershell
node scripts/check-live-trading-publication.js            # the Pages URL, human report
node scripts/check-live-trading-publication.js --json     # one line, for a watcher
node scripts/check-live-trading-publication.js --base http://127.0.0.1:8080   # a local copy of the site
```

Per enabled lane it checks the served snapshot's **identity** against the lanes document, its **age** against the
window it declares, and the **heartbeat** (declared? fresh? armed?) - a parked lane is reported `disabled`, not
failed. Exit 0 all good, 1 a lane is stale/mismatched/missing a heartbeat, 2 the lanes document itself could not be
read. On 2026-10-24, before the lanes publisher has ever run on this branch, it answers **exit 2 - "not published"**,
which is the truthful reading: the deployed page is still published by `LiveTradingFeedTick019`, which carries one
artifact and no lanes document. **Deployment order matters:** deploy this page change only once a lanes publish has
carried `data/live-trading-lanes.json`, or the strip says "not published" and the Close buttons say "no lane
identity" until it does.

**B. On the host, before and after arming:**

| Test | How | Pass condition |
| --- | --- | --- |
| Read-only, deployed | `live-trading-snapshot.py --out tmp\vps-check.json` + `validate_live_trading_feed.js` | exit 0, `read_only` true, the masked login `***614`, no order call in the file |
| One lane, three signals at once | `scripts\show-live-trading-status.ps1 -TaskName LiveTrading1FeedTick,LiveTrading1TraderTick -ExpectedLogin '***614'` | exit 0 and a verdict line `ALIVE`; a task row carries a next run, the published row carries a commit |
| The clone runs there | `npm test` on the host | the PC's totals: **758 pass, 0 fail** (no known failures to explain away); the live-trading suites green |
| The launcher reaches the runner | `register-...ps1 -Test` for feed, trader and the lanes publisher | `self_test_result` 0 and a verdict line that names the runner, not "the launcher never reached" |
| The credential works without writing | `publish-live-trading-lanes.js --force --dry-run`, then `git -C .local\live-trading-feed-publish push --dry-run origin HEAD:main` | `would_publish` and a dry-run push that is not refused; a `too_soon` here is the 600s gate, not a failure |
| The publish really lands | the first armed feed tick | one line with `"action":"published"` and a commit sha; the sha is on `main` |
| The loop plans and does not send | trader registered **without** `-Arm` | log line `"status":"planned"`, and no new ticket on the account |
| The loop's memory survived the copy | `tmp\live-trading-trader-state.json` on the host after one tick | `held` and the close/move counters carry over; no re-placement for a bar already acted on |

**C. The ones that actually answer the question:**

| Test | How | Pass condition |
| --- | --- | --- |
| Reboot without a human | reboot the host, do not log in | a fresh snapshot appears within 15 minutes (this is the autologon test; if it fails nothing else matters) |
| PC off | shut this PC down for at least 30 minutes | the dashboard badges `FRESH` (feed age under 900s) the whole time, and `main` keeps receiving feed commits |
| Overnight | 12 hours unattended | every log line `"status":"ok"`, no gap over 15 minutes, 144 expected lines |
| Single writer | after cutover, look at the account | exactly one ticket per pair, and nothing placed by a machine that was supposed to be off |
| Rollback | section 8 | the PC picks the lane back up with one tick `ok` |

The overnight gap check, run on the host:

```powershell
$t = Get-Content tmp\live-trading-feed.log | ForEach-Object { ([datetime]($_ | ConvertFrom-Json).at_utc).ToUniversalTime() }
$g = for ($i = 1; $i -lt $t.Count; $i++) { ($t[$i] - $t[$i-1]).TotalMinutes }
"lines {0}, largest gap {1:N1} min, worst after {2}" -f $t.Count, ($g | Measure-Object -Maximum).Maximum,
  ($t[([array]$g).IndexOf(($g | Measure-Object -Maximum).Maximum) + 1])
```

## 8. Rollback

Not a hope, a command list. Nothing on the host is hard to undo because nothing on the host is new code:

1. On the **host**: `... -File scripts\register-live-trading-trader-task.ps1 -Remove` and then the feed script's
   `-Remove`. No task means no send and no publish, whatever the terminal is doing.
2. On **this PC**: re-register exactly what runs today -
   `... -File scripts\register-live-trading-feed-task.ps1 -Publish` and
   `... -File scripts\register-live-trading-trader-task.ps1 -Arm -MaxOpen 1 -MaxPerDay 4`. The generated wrapper
   is rewritten at registration, so the paths follow this machine again.
3. **The state file**: copy the host's `tmp\live-trading-trader-state.json` back if the host ran any tick worth
   keeping - it carries the answered close requests and spent stop moves. The PC's own copy from before the move
   is still valid, and the loop re-derives its rows from the artifacts on every tick either way.
4. **A bad published feed**: the next publish overwrites `data/live-trading.json`; nothing else changes on
   `main`. A bad page commit is a plain `git revert <sha>` on `main` and a Pages rebuild.
5. **The credential**: revoke the PAT at GitHub and remove it from the host's credential store. Nothing in the
   repository or in any log holds it.

## 9. What this does not fix, stated rather than hidden

- **One session, one terminal.** A provider reboot or a maintenance window costs freshness - minutes normally,
  longer if the provider is slow. The dashboard badges what it sees (`STALE` with the age) rather than pretending.
- **An invalidated terminal login** (password change, broker maintenance) leaves MT5 at a login dialog and the
  feed goes stale. Check it after any account change.
- **The fast close link becomes RDP-only.** From the road, closing a position means the page's close request,
  answered on the next tick and only while the row is under thirty minutes old.
- **The host is now a single point of failure.** If it dies while you are away, open positions keep the stops and
  targets the broker already holds, and resting limits stay working - with no loop to take them out when a call
  turns. That is the trade-off for not leaving the PC on.
- **Nothing here is edge, a rule change or a performance claim.** It moves a clock to a machine that does not
  sleep; the entry rule, the exit rule and the hand caps are untouched, and the sealed Gold window stays sealed.

## 10. Time, and what can realistically finish today

- **One-off**: roughly 15-20 minutes provisioning plus 45-90 minutes of build and layer B tests, if the provider
  hands over a Windows image that behaves.
- **Not finishable today**: the overnight test and a full week's PC-off claim. The reboot test and a 30-minute
  PC-off test can both be done before you leave, which is enough to know the box survives an unattended night.
- **Monthly**: one entry-class Windows VPS with its licence; read the live price at purchase. No figure is quoted
  here, for the same reason VPS_SPEC quotes none.
- **The travelling check, with no RDP needed**: the feed's own commits to `main` are a heartbeat. Roughly one
  every ten minutes means the cadence is alive, and a gap in that list is the honest signal that it is not. That
  is checkable from a phone.

