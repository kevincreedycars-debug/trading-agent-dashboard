# Lane 2 on the always-on host: the staged runbook

Lane 2 is the second FTMO account: the half grid, three to one, its own terminal, its own checkout, its own tasks, its
own magic `20261005` and its own identity file. This runbook is **lane 2 only**. Nothing here re-registers, stops,
re-publishes or re-configures lane 1, and nothing here arms lane 2 before the FTMO reply in
[SECOND_LANE_HALF_L2L.md](SECOND_LANE_HALF_L2L.md) §8 exists.

The stages are in the order they must run, and the last two - publishing the lane-2 dashboard and arming its trader -
are deliberately separate acts. Each stage ends with a check that can fail; if it fails, stop there rather than
carrying the failure forward.

**Not in this runbook, on purpose:** arming lane 2 (stage 7 needs the FTMO reply in writing), any change to lane 1,
and any reboot of the host. A reboot takes lane 1 down with lane 2, which is why the lane-2 watchdog must judge itself
by its own snapshot and heartbeat and never by "is `terminal64` running".

## 0. Read-only audit of what lane 1 is running today

No writes, no restarts, no registrations. Everything here is a read, and each line produces a value to paste into the
handoff.

```powershell
# 1. What commit is deployed in lane 1's checkout, and is the file that ran the file that was meant to run?
cd C:\live-trading\runtime
git -C . rev-parse HEAD
git -C . rev-parse origin/main
git -C . hash-object scripts/run-live-trading-trader.js
git -C . status --porcelain

# 2. What arguments the lane-1 trader task actually carries (the wrapper is the scheduler's real command line).
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\register-live-trading-trader-task.ps1 -Show -RepoRoot C:\live-trading\runtime
Get-Content C:\live-trading\runtime\tmp\live-trading-trader-run.cmd

# 3. The task definitions, exported rather than described.
Export-ScheduledTask -TaskName LiveTradingTraderTick019 | Out-File -Encoding utf8 C:\live-trading\tmp\audit-lane1-trader.xml
Export-ScheduledTask -TaskName LiveTradingLane-ftmo1  | Out-File -Encoding utf8 C:\live-trading\tmp\audit-lane1-lane.xml
Get-ScheduledTaskInfo -TaskName LiveTradingTraderTick019

# 4. The effective settings read-back: armed, caps, settle, lane, account.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\export-live-trading-effective-config.ps1 -RepoRoot C:\live-trading\runtime -Out C:\live-trading\tmp\effective-lane1.json
Get-Content C:\live-trading\tmp\effective-lane1.json -Raw

# 5. Lane 1's own heartbeat, and the snapshot it is trading from.
Get-Content C:\live-trading\data\live-trading-trader.ftmo-1.json -Raw
Get-Content C:\live-trading\data\live-trading.json -Raw | ConvertFrom-Json | Select-Object generated_at_utc, account
```

**Stage 0 passes when** the heartbeat says `armed: true`, its `lane` is `ftmo-1`, its `strategy.magic` is `20261004`,
`git status --porcelain` on the deployed checkout is either empty or explained line by line, and the wrapper's command
line carries `--confirm-live` exactly once. Save those five values; stage 6 compares the same heartbeat afterwards and
must find it unchanged except for its timestamps.

**If stage 0 does not pass, stop.** A lane-1 fault found now is not a lane-2 problem, and fixing it inside this
runbook would be exactly the coupling the two-checkout layout exists to avoid.

## 1. Lane 2's checkout, pinned to a commit

```powershell
# The commit this branch was tested at is in the handoff. A clone (not a worktree of lane 1's checkout) keeps the two
# lanes' .git, tmp\ and data\ genuinely separate.
git clone https://github.com/kevincreedycars-debug/trading-agent-dashboard.git C:\ftmo2
cd C:\ftmo2
git fetch --all --prune
git checkout --detach <tested-commit>
git rev-parse HEAD
git hash-object scripts\run-live-trading-trader.js
```

**Stage 1 passes when** `git rev-parse HEAD` is the tested commit and the file hash matches the one recorded with it.
`config/live-trading-lanes.json` in this checkout must carry `ftmo-2` with `root: "../ftmo2"`, `magic: 20261005`,
`strategy: { grid: "half", r_multiple: 3 }` and `expect_identity` naming the file stage 2 will make.

## 2. The second terminal and the identity file

One terminal per account. Lane 1's terminal is never opened, re-logged or reconfigured in this stage.

```powershell
# 2a. The terminal, its own install and its own startup file.
Test-Path 'C:\Program Files\FTMO Global Markets MT5 Terminal 2'
# Market Watch must hold EURUSD, XAUUSD, US100.cash and BTCUSD: a cold terminal serves only what it holds or has been
# told to subscribe, and a symbol it does not serve comes back unavailable rather than mispriced.

# 2b. Which account it is really logged into, read-only. The probe prints the masked login, the server and the four
#     symbols' availability, tradability and volume_min - it places nothing.
python C:\ftmo2\tools\mt5-bridge\live-trading-account-probe.py --path 'C:\Program Files\FTMO Global Markets MT5 Terminal 2'

# 2c. The identity file: made here, by hand, from 2b's numbers, and never committed.
New-Item -ItemType Directory -Force -Path C:\live-trading\state | Out-Null
#   {"login": <the account's login as an integer>, "server": "<the server 2b printed>",
#    "terminal_path": "C:\\Program Files\\FTMO Global Markets MT5 Terminal 2"}
notepad C:\live-trading\state\lane-ftmo2-identity.json
icacls C:\live-trading\state\lane-ftmo2-identity.json /inheritance:r /grant:r "Administrators:F" "SYSTEM:F"

# 2d. The gate, read-only, before anything is registered: the tool checks the terminal against that file.
python C:\ftmo2\tools\mt5-bridge\live-trading-order.py status --expect-identity C:\live-trading\state\lane-ftmo2-identity.json --journal C:\ftmo2\tmp\live-trading-orders.log
```

**Stage 2 passes when** 2d exits 0 and its `identity` block names the masked login from 2b, and `icacls` shows only
`Administrators` and `SYSTEM`. An `identity_mismatch` here means the terminal is on the wrong account: fix that before
stage 3, and register nothing yet.

## 3. A lane-2 feed-only reading (no trader, no task)

```powershell
cd C:\ftmo2
node scripts\run-live-trading-feed.js --once --align --settle-seconds 90 --quiet 
  --python "C:\Python313\python.exe" 
  --out data\live-trading.json --log tmp\live-trading-feed.log --lock tmp\live-trading-feed.lock 
  --terminal 'C:\Program Files\FTMO Global Markets MT5 Terminal 2'
node scripts\validate_live_trading_feed.js data\live-trading.json
Get-Content data\live-trading.json -Raw | ConvertFrom-Json | Select-Object generated_at_utc, account, instrument_count
```

**Stage 3 passes when** the validator exits 0, the snapshot's `account.login_masked` is account 2's, its
`instrument_count` is 4, and every instrument reports `available: true`. It writes only under `C:\ftmo2`; lane 1's
snapshot in `C:\live-trading\data` is not touched and the page still serves lane 1's numbers unchanged.

## 4. An unarmed trader run, by hand

The loop reads everything and places nothing, because `--confirm-live` is not passed. Run it once, by hand, before any
task exists.

```powershell
cd C:\ftmo2
node scripts\run-live-trading-trader.js --once --align --settle-seconds 90 
  --python "C:\Python313\python.exe" 
  --lane ftmo-2 --grid half --r-multiple 3 --magic 20261005 
  --expect-identity C:\live-trading\state\lane-ftmo2-identity.json 
  --max-per-day 4 
  --state tmp\live-trading-trader-state.json --log tmp\live-trading-trader.log 
  --lock tmp\live-trading-trader.lock --journal tmp\live-trading-orders.log 
  --status-out tmp\live-trading-trader-status.json

Get-Content C:\ftmo2\tmp\live-trading-trader.log -Tail 1
Get-Content C:\ftmo2\tmp\live-trading-trader-status.json -Raw
```

**Stage 4 passes when** the last log line reads `"armed":false`, `"lane":"ftmo-2"`, `"strategy":{"grid":"half",
"r_multiple":3,"magic":20261005,"identity_checked":true}`, every `placements[]` entry is `"sent":false` and
`"planned":true`, and the journal holds **no** line with an `answer`. Anything sent here is a fault, not a result: the
arm flag was not passed.

## 5. The lane-2 tasks, registered unarmed

Two tasks, both under the lane-2 names the lanes file publishes, and **neither carries `-Arm`**.

```powershell
cd C:\ftmo2
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\register-live-trading-trader-task.ps1 
  -RepoRoot C:\ftmo2 -Lane ftmo-2 -Grid half -RMultiple 3 -Magic 20261005 
  -ExpectIdentity C:\live-trading\state\lane-ftmo2-identity.json 
  -TaskName LiveTradingTraderTick-ftmo2 -ChainFeed -Published C:\ftmo2\data 
  -Terminal 'C:\Program Files\FTMO Global Markets MT5 Terminal 2' -HiddenRunner <the host's run-hidden.vbs> -NoStart

powershell -NoProfile -ExecutionPolicy Bypass -File scripts\register-live-trading-trader-task.ps1 -Show -RepoRoot C:\ftmo2 -Lane ftmo-2 -Grid half -RMultiple 3 -Magic 20261005 -ExpectIdentity C:\live-trading\state\lane-ftmo2-identity.json -TaskName LiveTradingTraderTick-ftmo2
Get-Content C:\ftmo2\tmp\live-trading-trader-run.cmd
```

**Stage 5 passes when** the `-Show` output's `loop_command` carries `--lane "ftmo-2"`, `--grid half`,
`--r-multiple 3`, `--magic 20261005` and `--expect-identity` with the path, and carries **no** `--confirm-live`; and the
`Lane ftmo-2` line names this lane. A registration that omits any of those refuses itself, which is what stage 0 of
§9 in the design document proves with tests.

Start it once by hand (`Start-ScheduledTask -TaskName LiveTradingTraderTick-ftmo2`) and read
`C:\ftmo2\tmp\live-trading-trader.log` - it must still report `"armed":false`.


## 6. Publishing the lane-2 dashboard (not arming it)

Publishing makes account 2 visible on the page. It does not let anything be traded: the trader task from stage 5 is
unarmed, and this stage does not touch it.

```powershell
# 6a. The one switch: the lane's own row in the lanes file. `enabled: true` is what the publisher reads; until now the
#     page has drawn FTMO 2 as parked, which was the honest state.
cd C:\ftmo2
notepad config\live-trading-lanes.json    # "id": "ftmo-2" -> "enabled": true, root "../ftmo2", magic 20261005

# 6b. One publish, by hand, from lane 2's checkout, which reads both lanes' artifacts.
node scripts\publish-live-trading-lanes.js --once
Get-Content data\live-trading-lanes.json -Raw
Get-Content data\live-trading.account2.json -Raw | ConvertFrom-Json | Select-Object generated_at_utc, account

# 6c. The published heartbeat, which the page uses to say whether lane 2's loop is alive.
git -C . log -1 --stat
Get-Content data\live-trading-trader.ftmo-2.json -Raw
```

Then open the page and switch the selector to **FTMO 2 · 0.5 L2L**: the chips must read account 2's masked login, the
tables must show its tickets, and the four cards must draw the dashed midpoints. Switching back must restore lane 1
exactly. If the page says parked, missing or stale, that is the true state - read the notice rather than the numbers.

**Stage 6 passes when** `data/live-trading-lanes.json` reports both lanes `published`, `data/live-trading.account2.json`
carries account 2's masked login, and stage 0's lane-1 values are unchanged (same commit, same wrapper, same task,
same heartbeat fields apart from timestamps). Publishing did **not** arm anything: re-read stage 5's log line.

## 7. Arming lane 2 (last, and only with the FTMO reply in hand)

This stage is the only one that can place a ticket, and it is deliberately one command away from the previous stage.

```powershell
cd C:\ftmo2
# The lane-2 registration, identical to stage 5 except for -Arm.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\register-live-trading-trader-task.ps1 
  -RepoRoot C:\ftmo2 -Lane ftmo-2 -Grid half -RMultiple 3 -Magic 20261005 
  -ExpectIdentity C:\live-trading\state\lane-ftmo2-identity.json 
  -TaskName LiveTradingTraderTick-ftmo2 -ChainFeed -Published C:\ftmo2\data -Arm 
  -Terminal 'C:\Program Files\FTMO Global Markets MT5 Terminal 2' -HiddenRunner <the host's run-hidden.vbs>

Get-Content C:\ftmo2\tmp\live-trading-trader-run.cmd      # must now carry --confirm-live, once
Get-Content C:\ftmo2\tmp\live-trading-trader.log -Tail 1
Get-Content C:\ftmo2\tmp\live-trading-orders.log -Tail 3
```

**Stage 7 passes when** the wrapper carries `--confirm-live` exactly once, the first armed tick's log line says
`"armed":true`, `"lane":"ftmo-2"`, `"identity_checked":true`, and every placement it reports has a journal line beside
it carrying `magic 20261005`. A first armed tick that places nothing is a normal outcome - the rule may have no
confirmed row - and the log's own `rows` state the reason per pair.

**Lane 2's four-a-day cap** is whatever the user states before arming; `--max-per-day 4` is the offline default this
branch was tested with and the value the registration above carries. Change it in the registration, not in the
wrapper, so the scheduler and the loop's log cannot disagree.


## 8. Stopping lane 2 only, with its resting orders accounted for

The order matters: **stop the loop first**, then deal with what it left working, because a loop that is still running
will put its own limits back on a reading you cannot see.

```powershell
# 8a. Stop the cadence. Stop the lane-2 task; leave lane 1's task names alone.
Stop-ScheduledTask -TaskName LiveTradingTraderTick-ftmo2
Get-ScheduledTask -TaskName LiveTradingTraderTick-ftmo2 | Select-Object TaskName, State
# To disarm rather than merely stop, re-register the same command line WITHOUT -Arm (stage 5's command), which
# rewrites tmp\live-trading-trader-run.cmd without --confirm-live. Re-read it afterwards and confirm the flag is gone.

# 8b. What it left working: read the lane-2 account, read-only.
python C:\ftmo2\tools\mt5-bridge\live-trading-order.py status --expect-identity C:\live-trading\state\lane-ftmo2-identity.json --journal C:\ftmo2\tmp\live-trading-orders.log

# 8c. Each working entry, removed by hand, one ticket at a time. The magic is the lane's own, so lane 1's tickets
#     cannot be removed by this command even if a ticket number is typed wrongly.
python C:\ftmo2\tools\mt5-bridge\live-trading-order.py cancel --ticket <ticket> --magic 20261005 
  --expect-identity C:\live-trading\state\lane-ftmo2-identity.json 
  --comment l2l-rule-hand --journal C:\ftmo2\tmp\live-trading-orders.log --confirm-live

# 8d. Open positions: either leave them to the stop and target they were placed with, or close them the same way.
python C:\ftmo2\tools\mt5-bridge\live-trading-order.py close --ticket <ticket> --magic 20261005 
  --expect-identity C:\live-trading\state\lane-ftmo2-identity.json 
  --comment l2l-rule-hand --journal C:\ftmo2\tmp\live-trading-orders.log --confirm-live

# 8e. Prove the account is clean and lane 1 is untouched.
python C:\ftmo2\tools\mt5-bridge\live-trading-order.py status --expect-identity C:\live-trading\state\lane-ftmo2-identity.json
Get-Content C:\live-trading\data\live-trading-trader.ftmo-1.json -Raw
Get-ScheduledTaskInfo -TaskName LiveTradingTraderTick019
```

**The alternative to 8c**, when the loop is still running and its own reasoning should remove its limits: register lane
2 with `-PauseEntries` (stage 5's command plus `-PauseEntries`). The loop then keeps reviewing, exiting and moving stops
but leaves no new limit, and removes a limit whose reason has gone on its own reading. Pausing entries is not stopping:
the loop still sends closes and stop moves while it runs, so it is not a substitute for 8a when "nothing at all from
this lane" is the goal.

**Stage 8 passes when** the lane-2 `status` reports no pending order carrying `20261005`, every close and cancellation
appears in `C:\ftmo2\tmp\live-trading-orders.log`, lane 1's heartbeat is still `armed: true` with its own timestamps
advancing, and lane 1's task still reports a next run time.

**Do not**, in any stage: `Unregister-ScheduledTask` on a lane-1 task name; edit `C:\live-trading`'s wrapper, lanes
file or snapshot; run a publish from lane 1's checkout that would rewrite lane 2's artifact; or let a lane-2 watchdog
reboot the host. A reboot is a lane-1 event whatever caused it.

## 9. What each stage leaves behind, for the handoff

| Stage | The value that proves it | Where it is written |
| --- | --- | --- |
| 0 | lane 1's commit, wrapper line, task XML, effective settings, heartbeat | `C:\live-trading\tmp\audit-lane1-*.xml`, `effective-lane1.json` |
| 1 | lane 2's commit and the trader's blob hash | `git -C C:\ftmo2 rev-parse HEAD` |
| 2 | masked login, server, four symbols' availability; `icacls` of the identity file | the probe's own output, `C:\live-trading\state\` |
| 3 | the validator's exit code and the snapshot's account block | `C:\ftmo2\data\live-trading.json` |
| 4 | one unarmed run record with `"armed":false` and no journal `answer` | `C:\ftmo2\tmp\live-trading-trader.log` |
| 5 | `loop_command` with the lane's own five flags and no `--confirm-live` | `C:\ftmo2\tmp\live-trading-trader-run.cmd` |
| 6 | both lanes `published`; account 2's masked login on the page | `data/live-trading.account2.json`, `data/live-trading-lanes.json` |
| 7 | `--confirm-live` once, `"armed":true`, `magic 20261005` in the journal | `C:\ftmo2\tmp\live-trading-orders.log` |
| 8 | no pending order carrying `20261005`; lane 1 still `armed: true` | the lane-2 `status` output, lane 1's heartbeat |

