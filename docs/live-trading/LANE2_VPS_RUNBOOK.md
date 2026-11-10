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

## Reaching the host from this PC

The door is a key, not a password: key-only `sshd`, and the host's firewall narrowed to this machine's address.

```powershell
ssh -i "D:\trading-agent-dashboard-codex\.local\vps-access\id_ed25519" -o BatchMode=yes Administrator@158.220.87.240 "hostname"
# -> VMI3697641
```

That session arrives as `VMI3697641\Administrator` and is enough for every read and file write in stages 0, 1, 3, 4
and 5. It is **not** enough for the two GUI acts in stage 2: `sshd` starts its processes outside the desktop session
lane 1's terminal lives in, so the second terminal and its login dialog have to be opened over RDP -
`mstsc /v:158.220.87.240`, user `Administrator`, password in this PC's DPAPI store as `VPS_RDP_PASSWORD`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.trading-agent-dashboard\scripts\validate-credentials.ps1" -Scope vps-host
# VPS_HOST, VPS_RDP_USER, VPS_RDP_PASSWORD -> all present, checked 2026-11-09
```

A **disconnected** RDP window keeps its session, which is why closing the window is safe and signing out is not:
signing out ends the terminal and every interactive task with it, and the watchdog's answer to that is a reboot.

**The revision these commands were written against:** branch `live-trading/lane2-half-l2l-20261107`, commit
`be5954d2` - the commit whose lanes file names account 2 - cut from `origin/main` `4faf3f35`. The executable code was
tested at `f08ce075`, and every commit after it changes the lanes file, this document or its tests and never
`scripts/`. So the two blobs below are the whole of what decides whether a send is possible: **pin the host checkout at
`be5954d2` or a later documentation-only commit, and verify the blobs either way**, because a checkout is only the
revision this runbook was tested against when the bytes that read the terminal hash to these.

| file | git blob |
| --- | --- |
| `scripts/run-live-trading-trader.js` | `1c528e542271194bcf15f77950fc96f241db2791` |
| `scripts/register-live-trading-trader-task.ps1` | `c0bcc9bddb419d0a14ccc101de7a67c815ecae47` |

A host checkout whose `git hash-object` answers differently is not the revision every check in this runbook was
tested against, whatever its `HEAD` says - that is the same distinction the trader's own heartbeat draws between the
blob it was deployed as and the bytes on disk.

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

# 5. Lane 1's own heartbeat, and the snapshot it is trading from. The live status is written by the loop into the
#    runtime checkout's tmp\ (the lanes file's `trader_status`); the copy under publisher\data\ is the last published
#    one, so read the runtime's and treat the publisher's as the thing stage 6 must leave unchanged.
Get-Content C:\live-trading\runtime\tmp\live-trading-trader-status.json -Raw
Get-Content C:\live-trading\publisher\data\live-trading-trader.ftmo-1.json -Raw
Get-Content C:\live-trading\runtime\data\live-trading.json -Raw | ConvertFrom-Json | Select-Object generated_at_utc, account
```

**Stage 0 passes when** the heartbeat says `armed: true`, its `lane` is `ftmo-1`, its `strategy.magic` is `20261004`,
`git status --porcelain` on the deployed checkout is either empty or explained line by line, and the wrapper's command
line carries `--confirm-live` exactly once. Save those five values; stage 6 compares the same heartbeat afterwards and
must find it unchanged except for its timestamps.

**If stage 0 does not pass, stop.** A lane-1 fault found now is not a lane-2 problem, and fixing it inside this
runbook would be exactly the coupling the two-checkout layout exists to avoid.

### What lane 1 was recorded as, read-only, on 2026-11-09

Read from `origin/main` **after `git fetch`** - the branch's own copy of `data/` was two days behind, so the fetch is
part of taking the reading rather than a courtesy. Stage 0's commands on the host have to reproduce these values or
explain the difference:

| What | Recorded value |
| --- | --- |
| host | `vmi3697641`, win32, checkout named `runtime` |
| lane 1's runtime path | `C:\live-trading\runtime` |
| terminal | `C:\Program Files\FTMO Global Markets MT5 Terminal` |
| tasks | `LiveTradingTraderTick019`, `LiveTradingLane-ftmo1`, `LiveTradingTerminalStartup` |
| heartbeat | `at_utc` `2026-11-09T18:06:30.008Z`, `armed: true`, `lane: ftmo-1`, `status: nothing_to_place` |
| account | `***614` in the heartbeat (its `server` is null there), `***614` on `FTMO-Server` in the snapshot |
| the account itself | FTMO Global Markets Ltd, USD, leverage 30, balance and equity `10152.15`, free margin `10152.15` |
| working | 0 open positions and **1 working order**, all carrying lane 1's magic |
| snapshot | `data/live-trading.json` generated `2026-11-09T18:10:20.913Z`, four instruments, every one available with a fresh M5 block (19-21 s old) |
| code | `checkout_head` `c5abd0ac`, `git_blob` `f43ac5ea318fb5e8c87bf55a6a88b76cc1eb6958`, `sha256` `b6422a72...` |
| publication | lane 1 `published`, lane 2 `disabled`; the newest publish commit is `2026-11-09T18:10:57Z`, so the cadence is live |

### Read on the host itself, 2026-11-09T18:46Z (read-only)

Taken over the ssh session above, so these are the values stage 0 is meant to **reproduce** rather than the values it
is trying to establish. Nothing was written: `git --no-optional-locks status` so no index refresh, no fetch against
the host's checkout, no task, no terminal start, no publish.

| What | Value |
| --- | --- |
| who | `VMI3697641\Administrator`, host clock `2026-11-09T18:46:18Z` |
| lane 1 checkout | `HEAD c5abd0ac5ef5de6eb80bb5500d518fe5a4cbb4bd`, and its own stale `origin/main f20582b4...` (no fetch made) |
| lane 1 trader file | `git hash-object` -> `f43ac5ea318fb5e8c87bf55a6a88b76cc1eb6958`, which is `origin/main`'s blob and **not** `HEAD`'s |
| `git status --porcelain` | ` M data/live-trading.json`, ` M scripts/run-live-trading-trader.js`, `?? scripts/register-orchestrator-refresh-task.ps1`, `?? scripts/trigger-orchestrator-refresh.ps1` |
| that drift, explained | the 2026-11-05 one-file deploy copied `main`'s trader into the checkout and left `HEAD` at `c5abd0ac`; the two untracked scripts are the orchestrator-refresh fix run out of the checkout rather than committed. Neither line is lane 2's |
| lane-1 trader task | `LiveTradingTraderTick019`, principal `Administrator`, state `Running`, last result `267009` (`0x41301` = still running), next run 18:50Z |
| what that task runs | `wscript.exe "...\.trading-agent-dashboard\scripts\run-hidden.vbs" "cmd.exe /c C:\live-trading\runtime\tmp\live-trading-trader-run.cmd"` |
| that wrapper's flags | `--once --align --settle-seconds 90 --confirm-live --quiet --lane "ftmo-1" --max-per-day 4 --terminal "...\FTMO Global Markets MT5 Terminal" --published C:\live-trading\publisher` |
| lane-1 heartbeat | `runtime\tmp\live-trading-trader-status.json`: `at_utc 18:46:30.018Z`, `armed:true`, `lane ftmo-1`, `nothing_to_place`, 0 positions / 1 working order (`ours: 1`), `***614` with `server: null` |
| publisher copy | `publisher\data\live-trading-trader.ftmo-1.json` written 18:26:32Z; publisher checkout `9666ecb0`, clean |
| tasks on the host | `LiveTradingHostBuild` (SYSTEM), `LiveTradingLane-ftmo1` (Administrator), `LiveTradingPublishLanes019` (Administrator), `LiveTradingRefresh0600` (SYSTEM), `LiveTradingTerminalStartup` (Administrator), `LiveTradingTraderTick019` (Administrator), `LiveTradingWatchdog` (SYSTEM) |
| terminal installs | **one**: `C:\Program Files\FTMO Global Markets MT5 Terminal\terminal64.exe`; its data folder `81A933A9AFC5DE3C23B15CAB19C63850` names that install, beside `Common` and `Community` |
| `C:\live-trading\state` | one file, `autologon-rollback.json`, 518 bytes |
| `C:\ftmo2` | did not exist before stage 1 |
| disk and runtimes | 72.8 GB free of 99.6; `C:\Program Files\Python313\python.exe`, `C:\Program Files\nodejs\node.exe` |
| git credentials on the host | `credential.helper = store --file C:/live-trading/.git-credentials`, so a clone is non-interactive; run it with `GIT_TERMINAL_PROMPT=0` so a credential failure stops instead of waiting |

The two answers stage 0's export was there to settle: the lane-1 tasks run as **`Administrator`** - not SYSTEM - so
that is the principal the lane-2 identity file's ACL has to grant, and the host's `LiveTradingWatchdog` already
exists, which is the subject of the note after stage 5.

**Lane 1 is healthy as of that reading, and one thing in it still needs explaining before stage 1.** The heartbeat's
`git_blob` (`f43ac5ea`) is `origin/main`'s trader, while the commit it says it ran at (`c5abd0ac`) carries a different
trader blob (`164eb0d4`). So lane 1's checkout is running a trader file that does not match its own recorded HEAD -
either a deploy copied files in, or the checkout was pulled without its HEAD moving - and stage 0's
`git status --porcelain` is where that shows up. It is a lane-1 question, not made worse by lane 2, but it belongs in
the handoff rather than in a surprise after both lanes are live.

What it does **not** mean: lane 1 is running this branch. This branch's trader is `1c528e542271194bcf15f77950fc96f241db2791`
and its registration script is `c0bcc9bddb419d0a14ccc101de7a67c815ecae47`; both are this branch's own changes, neither is
on `main`, and lane 2 is the only lane that will ever run them. `main` is 161 commits ahead of this branch's base and
**none of them touches `scripts/`, `config/`, `tools/`, `lib/`, `script.js` or `tests/`** - they are data publishes - so
pinning lane 2 here pins the code without pinning a two-day-old tree.

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

**Stage 1 passes when** `git rev-parse HEAD` is the tested commit and the two `git hash-object` answers are the blobs
in the table at the top of this file.
`config/live-trading-lanes.json` in this checkout must carry `ftmo-2` with `root: "../ftmo2"`, `magic: 20261005`,
`strategy: { grid: "half", r_multiple: 3 }`, `expect_identity` naming the file stage 2 will make, and its masked
identity `account_login_masked: "***841"` on `account_server: "FTMO-Server3"`:

```powershell
Get-Content config\live-trading-lanes.json -Raw | ConvertFrom-Json |
  Select-Object -ExpandProperty lanes | Select-Object id, enabled, magic, account_login_masked, account_server
```

Lane 2 must read `False` under `enabled` at this point - the page still draws it as parked, and stage 6 is the only
place that switch moves.

### Done on the host, 2026-11-09T18:52Z

The branch was pushed to `origin` as `live-trading/lane2-half-l2l-20261107` first, because the clone has to be able to
reach the commit it pins - a commit that exists only on this PC is not a pin, it is a copy. Then, over the ssh session:

```text
git clone https://github.com/kevincreedycars-debug/trading-agent-dashboard.git C:\ftmo2
git -C C:\ftmo2 fetch --all --prune
git -C C:\ftmo2 checkout --detach be5954d2      -> HEAD is now at be5954d2
git -C C:\ftmo2 rev-parse HEAD                  -> be5954d2e2ff694d55b0137e0721fbe30466a860
git -C C:\ftmo2 hash-object scripts/run-live-trading-trader.js            -> 1c528e542271194bcf15f77950fc96f241db2791
git -C C:\ftmo2 hash-object scripts/register-live-trading-trader-task.ps1 -> c0bcc9bddb419d0a14ccc101de7a67c815ecae47
git -C C:\ftmo2 status --porcelain              -> empty
```

Both blobs equal the table at the top of this file, so stage 1 has passed on the host. The checkout is **detached at
`be5954d2`**, the commit that names account 2 and changes no script, while this document is read from the branch tip
(`599c7e36` and later) - the two are expected to differ, and only a difference in the two blobs above would be a
failure. The lanes file in `C:\ftmo2` read back as `ftmo-2`: `enabled False`, `magic 20261005`,
`strategy {grid: half, r_multiple: 3}`, `***841` on `FTMO-Server3`, `root ../ftmo2`, terminal
`C:\Program Files\FTMO Global Markets MT5 Terminal 2`, tasks `LiveTradingLane-ftmo2` / `LiveTradingTraderTick-ftmo2` /
`LiveTradingTerminalStartup-ftmo2`, identity `C:\live-trading\state\lane-ftmo2-identity.json`.

Lane 1 was re-read after the clone and had not moved: same `HEAD`, same trader blob, the wrapper file untouched since
`2026-11-03T12:29:39Z`, the 18:50:01Z tick returning `0` with the next at 18:55Z, and the 18:51:30Z heartbeat still
`armed:true` on `ftmo-1` with 0 positions and 1 working order. A clone writes only under `C:\ftmo2`.

### The pin against the branch head, 2026-11-09T19:05Z

`git diff --stat be5954d2..<the branch tip>` answers whether the pin still describes the branch, and on this branch the
answer is one file:

```text
docs/live-trading/LANE2_VPS_RUNBOOK.md | 143 +++++++++++++++++++++++++++++++--
```

Documentation only - no script, no `config/live-trading-lanes.json`, no test - so lane 2 keeps `be5954d2` as its tested
runtime pin and this document is read from the tip.

The watchdog correction of stage 5a is the first change since to touch a script, and it does not move the pin. That file
is lane 1's runtime, not lane 2's: lane 2 runs no watchdog, and the two files lane 2 does run - the trader and its task
registration - are still identical to the pin:

```text
git -C C:\ftmo2 diff --stat be5954d2 -- scripts/run-live-trading-trader.js scripts/register-live-trading-trader-task.ps1 config/live-trading-lanes.json
   (no output)
git -C C:\ftmo2 rev-parse HEAD:scripts/run-live-trading-trader.js   -> 1c528e542271194bcf15f77950fc96f241db2791
```

So the rule stands with one clarification: a tip that touches the trader, its registration, the lanes file or the gate
is the signal to re-pin and re-run stages 1, 3 and 4; a tip that touches the host's watchdog is a lane-1 change and
stage 5a.

## 2. The second terminal and the identity file

One terminal per account. Lane 1's terminal is never opened, re-logged or reconfigured in this stage.

```powershell
# 2a. The two installations are different installations, not one installed twice. Run all four lines and compare:
#     the executable paths, the hashes, and the data folder each install owns.
'C:\Program Files\FTMO Global Markets MT5 Terminal\terminal64.exe'
'C:\Program Files\FTMO Global Markets MT5 Terminal 2\terminal64.exe'
Get-FileHash 'C:\Program Files\FTMO Global Markets MT5 Terminal\terminal64.exe'   -Algorithm SHA256 | Select-Object Hash
Get-FileHash 'C:\Program Files\FTMO Global Markets MT5 Terminal 2\terminal64.exe' -Algorithm SHA256 | Select-Object Hash

# The data directories. A non-portable MT5 keeps its account, history and profile under a per-install hash, and each
# of those folders records the install it belongs to in origin.txt. Two installs must appear as two hashes, each
# naming its own path; one hash appearing twice means the second terminal is sharing the first one's data.
Get-ChildItem "$env:APPDATA\MetaQuotes\Terminal" -Directory |
  Select-Object Name, @{ n = 'origin'; e = { (Get-Content (Join-Path $_.FullName 'origin.txt') -ErrorAction SilentlyContinue) } } |
  Where-Object { $_.origin } | Format-Table -AutoSize

# 2b. Market Watch must hold EURUSD, XAUUSD, US100.cash and BTCUSD: a cold terminal serves only what it holds or has
#     been told to subscribe, and a symbol it does not serve comes back unavailable rather than mispriced.

# 2c. Which account each terminal is really logged into, read-only. The probe prints the masked login, the server,
#     the terminal path and the four symbols' availability, tradability, min volume and spread - it places nothing.
#     Run it against lane 1's terminal too: the two readings must name two different accounts.
python C:\ftmo2\tools\mt5-bridge\live-trading-account-probe.py --path 'C:\Program Files\FTMO Global Markets MT5 Terminal'
python C:\ftmo2\tools\mt5-bridge\live-trading-account-probe.py --path 'C:\Program Files\FTMO Global Markets MT5 Terminal 2'
```

### 2r. The installer, on the RDP desktop

The destination is **`C:\Program Files\FTMO Global Markets MT5 Terminal 2`** - the folder, not `terminal64.exe`, and
not lane 1's folder, which differs from it by four characters and a space.

1. Connect by RDP to `158.220.87.240` as `Administrator` (the interactive desktop, not the ssh session - the wizard needs
   a window and lane 1's terminal must not be restarted from under a running tick).
2. In Explorer go to `C:\Users\Administrator\Downloads` and check `ftmo5setup.exe` is still there: 4,744,320 bytes,
   SHA-256 `34F80A78DE65029992F99AC7C16F84383E8CFF4B82CBA02F1E04CDE816B2568D`. Run it, allow the elevation prompt.
3. First screen: **Next**. Licence: **Next**. On the **Destination Folder** screen, click **Browse** (or edit the path
   field) and set it to `C:\Program Files\FTMO Global Markets MT5 Terminal 2` - **exactly that**, keeping the ` 2`.
   Compare it character by character with `C:\Program Files\FTMO Global Markets MT5 Terminal`, which is lane 1's
   folder and must not appear in this field.
4. **Next**, then **Install**, then **Finish**, leaving the "Launch" box as it is.
5. If any screen of this build has no destination field at all, cancel the wizard and stop: report it rather than
   installing over lane 1, and the hand-copied-folder fallback becomes a separate proof of 2a rather than an assumption.
6. Open `C:\Program Files\FTMO Global Markets MT5 Terminal 2\terminal64.exe`. First run opens FTMO's "Open an Account"
   wizard - close it; the login dialog is what the next step uses.
7. Then sign in as **stage 2's numbered list** says: **File → Login to Trade Account**, login `***841` (all digits),
   password the account's **investor** password, server `FTMO-Server3`, **Save account information** ticked, **OK**.
   Do not screenshot the dialog - the Login field is unmasked - and type nothing into any file or shell.

Baseline read before the install, so the second install is visible as a new thing rather than assumed: one running
terminal (`pid=3136`, `C:\Program Files\FTMO Global Markets MT5 Terminal\terminal64.exe`), one MT5 data folder,
`%APPDATA%\MetaQuotes\Terminal\81A933A9AFC5DE3C23B15CAB19C63850` (beside `Common` and `Community`, neither of which is
an install), and 73 GB free on `C:`. After step 6 there must be **two** install folders under `C:\Program Files` and
**two** hash folders under `%APPDATA%\MetaQuotes\Terminal`, each naming its own install in `origin.txt`.


hurt lane 1, so it is not run from an ssh session and never with defaults.** Its default destination is
`C:\Program Files\FTMO Global Markets MT5 Terminal` - lane 1's own folder, the terminal lane 1's loop reads every five
minutes. A default double-click therefore rewrites the installation that is trading, and may restart the terminal under
a running tick. Run it from the **RDP desktop**, and in the wizard's settings step set the destination to
`C:\Program Files\FTMO Global Markets MT5 Terminal 2` before Install. If this build's wizard offers no destination, cancel
it and stop - do not install over lane 1 to keep going, because that is the trade this runbook exists to avoid. A
hand-copied install folder is the fallback, and it is a different arrangement from the one stage 2a's proof assumes, so
it would have to be proved by 2a rather than assumed.

**Stage 2 stops here until account 2 is signed in.** The login is entered in the terminal's own dialog, not in a
script:

1. On the VPS, open `C:\Program Files\FTMO Global Markets MT5 Terminal 2\terminal64.exe`. If the second install has
   never run, it opens on the FTMO "Open an Account" wizard; close the wizard, the login dialog is what is wanted.
2. Menu **File → Login to Trade Account**. The dialog has three fields: **Login** (the full account number, all
   digits), **Password** (the **read-only / investor password** for this stage), and **Server**.
3. **Server**: pick `FTMO-Server3` from the list. If `FTMO-Server3` is not listed, the terminal has not downloaded
   FTMO's server list yet: **File → Open an Account** → type `FTMO` in the broker search → the servers appear → close
   that wizard without creating anything, then reopen **File → Login to Trade Account** and `FTMO-Server3` will be in
   the dropdown.
4. Tick **Save account information**, press **OK**. Nothing else is typed anywhere: not in PowerShell, not in a
   wrapper, not in a task argument, not in the identity file, not into any file in `C:\ftmo2`.

**The dialog is the only place those two values appear, and it is the only screen not to capture.** The password field
draws dots, but the **Login** field draws the full account number, so a screenshot taken while the dialog is open puts
an unmasked account number into the evidence folder. Capture the terminal after it has connected - chart, Market Watch
and the status bar - not the dialog. The rest of the credential trail is closed by construction: the identity file
holds the login because it has to compare it and is ACL'd to `Administrators` and `SYSTEM`, the journal and the logs
carry only `***841`, and `scripts/validate_live_trading_feed.js` refuses a snapshot whose account block carries a
`login`, `password` or `investor_password` key at all.

**Why the read-only password is the right one for this stage.** MT5's read-only credential is the **investor
password**. Signed in with it, the terminal reads accounts, symbols and history normally - the identity gate, the
probe, the feed and the unarmed trader run all work - but the server will refuse any trade request, so "lane 2 cannot
send" is enforced by the account and not only by a flag. It also sets `account.trade_allowed` false, which
`scripts/prepare-live-trading-host.ps1` reads when it checks that a lane may trade; that check is therefore expected
to fail while this login is in place, and **stage 7 re-logs this terminal with the account's master (trading)
password before arming**. If the intent is rather to arm in the same session, sign in with the master password here
and treat the unarmed stages as the only guard.

```powershell
# 2d. The identity file: made here, by hand, from 2c's numbers, and never committed.
New-Item -ItemType Directory -Force -Path C:\live-trading\state | Out-Null
#   {"login": <the full account number as an integer - all of it, this file is private>, 
#    "server": "FTMO-Server3",
#    "terminal_path": "C:\\Program Files\\FTMO Global Markets MT5 Terminal 2\\terminal64.exe"}
notepad C:\live-trading\state\lane-ftmo2-identity.json
icacls C:\live-trading\state\lane-ftmo2-identity.json /inheritance:r /grant:r "Administrators:F" "SYSTEM:F"

# If the lane-2 tasks run under a dedicated account rather than SYSTEM or Administrators, that account has to be
# added with read rights or the gate refuses at the first run:
#   icacls C:\live-trading\state\lane-ftmo2-identity.json /grant:r "<task-principal>:(R)"
# Stage 0 settled which it is: the lane-1 tasks run as VMI3697641\Administrator, and a lane-2 task registered the same
# way is covered by Administrators:F, so no fourth entry is needed. Register the lane-2 tasks under that same
# principal rather than under SYSTEM, which has never had a session and cannot see the terminal.

# terminal_path must end in terminal64.exe, not in the folder: the gate compares it with the path the terminal
# reports for its own executable, and a folder never resolves to an executable.

# 2e. The gate, read-only, before anything is registered: the tool checks the terminal against that file.
python C:\ftmo2\tools\mt5-bridge\live-trading-order.py status --expect-identity C:\live-trading\state\lane-ftmo2-identity.json --journal C:\ftmo2\tmp\live-trading-orders.log
```

**Stage 2 passes when** 2e exits 0 and its `identity` block names `***841` on `FTMO-Server3` at the lane-2
`terminal64.exe`; 2a showed two distinct install paths, two data folders each naming its own install, and 2c showed
lane 1's terminal still on `***614`; and `icacls` shows only `Administrators` and `SYSTEM`. An `identity_mismatch`
here means the terminal is on the wrong account or the identity file names the wrong terminal: fix that before stage 3,
and register nothing yet.


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

**Stage 3 passes when** all six of these hold, because "fresh data on all four instruments" is the step that decides
whether stages 4 and 6 have anything real to show:

1. the validator exits 0;
2. the snapshot's `account.login_masked` is `***841` and its `account.server` is `FTMO-Server3` - the snapshot's own
   account block, not the lanes file's;
3. `instrument_count` is 4, and the four symbols are exactly EURUSD, XAUUSD, US100.cash and BTCUSD;
4. every instrument reports `available: true` and an `m5` block whose `stale` is `false`;
5. every instrument's `m5.bar_age_seconds` is under `660` (the validator's own M5 freshness limit) - a stale M5 block
   with `stale: true` and a note is legal in the schema but is **not** a pass here, since the rule reads M5 crossings;
6. `generated_at_utc` is within the document's own `stale_after_seconds` of the clock, and the run printed no
   `refresh_attempts` above 1 for a symbol it then described as fresh.

It writes only under `C:\ftmo2`; lane 1's snapshot in `C:\live-trading\data` is not touched and the page still serves
lane 1's numbers unchanged.

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
  -TaskName LiveTradingTraderTick-ftmo2 -ChainFeed -Published C:\live-trading\publisher 
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

### Registered on the host, 2026-11-10

Registered with `-NoStart`, `-ChainFeed`, `-Published C:\live-trading\publisher`, lane 2's own terminal and the host's
`run-hidden.vbs`, so the task is `LiveTradingTraderTick-ftmo2`, principal `Administrator`, `Interactive`, `Limited` -
the same shape lane 1's task runs under.

The first scheduled ticks exited 1 with an empty feed log, while the same wrapper run by hand under `cmd /c` produced a
fresh snapshot and an `"armed":false` plan. A throwaway probe task that captured the scheduled run's own output named
the fault in one line:

```text
Error: EPERM: operation not permitted, open 'C:\ftmo2\tmp\live-trading-feed.log'
```

A task registered `Limited` runs with a filtered token in which `BUILTIN\Administrators` is deny-only, so it may write
only where the account itself is granted. `C:\live-trading\runtime` carries that grant - its
`tmp\live-trading-feed.log` shows `VMI3697641\Administrator:(I)(F)` beside the built-in entries - while a fresh
`C:\ftmo2` checkout carries only the inherited `Users:(RX)` on the same file. Two folders, granted on the host:

```powershell
icacls C:\ftmo2\tmp  /grant "VMI3697641\Administrator:(OI)(CI)F" /T
icacls C:\ftmo2\data /grant "VMI3697641\Administrator:(OI)(CI)F" /T
```

The next scheduled tick exited 0: feed `2026-11-10T20:11:31Z`, trader `"armed":false`, `"status":"planned"`, journal
unchanged apart from the read-only `status` line. A restage that reclones `C:\ftmo2` needs the same two grants; it is
the one step of this stage a checkout cannot carry.

`-Published` names the publisher's checkout rather than `C:\ftmo2\data`, because the calls, the ladder and the
close-request log are read from the published tree, and lane 2's own `data` folder is not the tree the publisher writes.

### The watchdog already on the host, and why lane 2 stays out of it

`LiveTradingWatchdog` exists: SYSTEM, a boot trigger plus every ten minutes, running
`C:\live-trading\runtime\scripts\run-live-trading-watchdog.ps1`. Its whole question is "is a process named `terminal64`
running", and its answers are to start `LiveTradingTerminalStartup`, or to reboot the host when nobody is signed on. Two
consequences follow from a second terminal, and they are recorded here rather than discovered later:

- once lane 2's terminal exists, a dead **lane-1** terminal looks alive to that task, because it counts processes by
  name. From that moment lane 1's liveness is no longer watched by it, and its reboot path is no longer reachable
  either;
- the reverse is equally true: lane 2's terminal dying is invisible to it.

So stage 5 registers **no** lane-2 watchdog, and lane 2 is not added to the existing one by editing its arguments:
`-TerminalProcess` names a process, both terminals are called `terminal64`, and a name cannot express the difference. A
per-lane liveness test needs a path-based check inside the script, which lives in lane 1's deployed checkout - so it is a
lane-1 change. It has now been written and tested offline (stage 5a below), and it is applied only after the operator
has read it: until then lane 1's liveness is judged the way the monitor already judges it, from the published
heartbeat, and lane 2's the same way from `data/live-trading-trader.ftmo-2.json` once stage 6 has published it.

### 5a. The watchdog correction: one file, and it is lane 1's

The version running on the host is `C:\live-trading\runtime\scripts\run-live-trading-watchdog.ps1`, and it is **byte
for byte** the version in this repository at `be5954d2` and at the branch tip - blob `798e7537cfe0`, SHA-256
`806360e8d7e3`. That is what makes an offline change safe to prepare: the file was read off the host and compared, not
assumed.

The change adds `-TerminalPath` (default `C:\Program Files\FTMO Global Markets MT5 Terminal\terminal64.exe`) and asks
liveness by path: `running` when a process's executable is exactly that file, `unknown` when no process matches but one
carrying the name has a path Windows will not give up, `missing` when there is no such process at all. Only `missing`
can start `LiveTradingTerminalStartup` or reboot; `unknown` writes a line naming the pid and does neither, because a
wrong reboot ends the session both lanes trade in. The new blob is `de6264269100fd7f28c325fbe74f072d207c802e`.

```powershell
# 5a-1. Read-only first: what the host says today, and what it would say with the new file (no writes to the task).
Get-ScheduledTask -TaskName LiveTradingWatchdog | Select-Object -ExpandProperty Actions
Get-Process -Name terminal64 -ErrorAction SilentlyContinue | ForEach-Object { "$($_.Id) $($_.SessionId) $($_.Path)" }

# 5a-2. The change. One file, backed up beside its own state folder, arguments untouched, no task re-registration.
#       The candidate copy is scp'd from this PC; nothing else on the host is written.
$dst = 'C:\live-trading\runtime\scripts\run-live-trading-watchdog.ps1'
$src = 'C:\live-trading\state\run-live-trading-watchdog.lane2-candidate.ps1'
Copy-Item -LiteralPath $dst -Destination 'C:\live-trading\state\run-live-trading-watchdog.pre-lane2-20261109.ps1' -Force
git -C C:\live-trading\runtime hash-object $src                                  # must be de6264269100fd7f...
Copy-Item -LiteralPath $src -Destination $dst -Force
git -C C:\live-trading\runtime hash-object $dst                                  # must equal the same blob

# 5a-3. Verification. -WhatIfAction takes no action and still writes the line it would have written.
powershell -NoProfile -ExecutionPolicy Bypass -File $dst -WhatIfAction
#   expected, verbatim in shape: ok terminal running C:\Program Files\FTMO Global Markets MT5 Terminal\terminal64.exe
#   pid=<lane 1's pid> session=1        (and, once stage 2 is done: "; other terminals running: pid=<p> ...Terminal 2\...")
# Then leave the scheduled task alone: the next 10-minute run proves it, one line in
# C:\live-trading\logs\live-trading-watchdog.log naming the path rather than just "ok terminal running pid=...".

# 5a-4. Rollback, if any line looks wrong. The file is tracked and was unmodified, so git restores the exact bytes.
Copy-Item -LiteralPath 'C:\live-trading\state\run-live-trading-watchdog.pre-lane2-20261109.ps1' -Destination $dst -Force
git -C C:\live-trading\runtime hash-object $dst                                  # back to 798e7537cfe0
# and confirm: git -C C:\live-trading\runtime status --porcelain scripts/run-live-trading-watchdog.ps1 -> empty
```

**What is not produced on the host**: the `unknown` case. Making a real process refuse its path would mean running one
under another account or protecting it, and neither is worth doing on the host that is trading. The three-way answer and
all five decisions are held by `tests/live_trading_watchdog_lane_identity.test.js`, which lifts the three functions out
of the file and runs them on made-up processes: both terminals up, lane 1 gone with lane 2 up, no terminal at all
(signed on and not), a path that cannot be read (signed on and not), a match beside an unreadable one, path case and
trailing separator, an empty lane path, and the reboot cooldown either side. It also reads the statement tree to prove
`schtasks.exe` sits in the `start-task` branch and `shutdown.exe` in the `reboot` branch, so no route through the file
reaches either without the decision having chosen it.

**Stage 5a passes when** the host file hashes to `de6264269100fd7f...`, one `-WhatIfAction` run names lane 1's path,
and the next scheduled run's log line does too. The rollback above returns the host to what it ran before.

### Applied on the host, 2026-11-09T19:23-19:31Z

Run over the ssh session, in the order 5a-2 and 5a-3 give, with the swap done by `[System.IO.File]::Replace` so the
scheduled run at `19:31:33` could not read a half-written file.

| Reading | Value |
| --- | --- |
| deployed file before | blob `798e7537cfe09957ff188333d20f6ac9c287f134` - the committed lane-1 file, so nothing local was unrecorded |
| candidate, as scp'd | blob `de6264269100fd7f28c325fbe74f072d207c802e` |
| deployed file after | blob `de6264269100fd7f28c325fbe74f072d207c802e` |
| backup, `C:\live-trading\state\run-live-trading-watchdog.pre-lane2-20261109.ps1` | blob `798e7537cfe09957ff188333d20f6ac9c287f134` |
| parse of the deployed file on the host | clean |
| `-WhatIfAction` at `19:23:44Z` | `ok terminal running C:\Program Files\FTMO Global Markets MT5 Terminal\terminal64.exe pid=3136 session=1` |
| scheduled run `19:31:33Z` | the same line, naming the path; `LastTaskResult 0`, next run `19:41:31` |
| lane 1's heartbeat at `19:31:30Z` | `armed: true`, `lane: ftmo-1`, `status: nothing_to_place`, 14 s old |

The line changed from `ok terminal running pid=3136 session=1` to `ok terminal running C:\...\MT5 Terminal\terminal64.exe
pid=3136 session=1`, which is the whole point: the same pid, now identified by the file it was started from. No task was
re-registered, no argument changed, and the rollback copy is in `state\` beside the identity file.

`C:\live-trading\runtime` now carries `M scripts/run-live-trading-watchdog.ps1` in `git status`, and that line is this
change - it is the only new one. The other four were already there on 2026-11-09T18:46Z and are lane 1's own
business: `M data/live-trading.json` (the snapshot is rewritten every feed run), `M scripts/run-live-trading-trader.js`,
and two untracked `scripts/*orchestrator-refresh*` files. When lane 1 next pulls, the deployed file returns to the
committed version only if `dc53dc3e` reaches `origin/main` first; until then a pull would show a conflict-free
overwrite of this file back to `798e7537cfe0`, which is the rollback rather than a fault.


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

Then open the page and switch the selector to **FTMO 2 · 0.5 L2L**: the chips must read `***841 / FTMO-Server3`, the
tables must show its tickets, and the four cards - EURUSD, XAUUSD, US100.cash, BTCUSD - must draw the original marked
lines **plus** the dashed midpoints, with the entry band at lane 2's own entry. Switching back must restore lane 1
exactly. If the page says parked, missing or stale, that is the true state - read the notice rather than the numbers.

The publisher now holds account 2's identity (`***841` on `FTMO-Server3`, in `config/live-trading-lanes.json`), so a
lane-2 snapshot taken from the wrong account is **refused** rather than published: `6b` fails with the snapshot's
account named beside the lanes file's. That refusal is the point of naming the account before the terminal exists, and
it is the reason stage 2's `2e` comes before this stage rather than after it.

**Stage 6 passes when** `data/live-trading-lanes.json` reports both lanes `published`, `data/live-trading.account2.json`
carries account 2's masked login, and stage 0's lane-1 values are unchanged (same commit, same wrapper, same task,
same heartbeat fields apart from timestamps). Publishing did **not** arm anything: re-read stage 5's log line.

### Published on the host, 2026-11-10

The publisher task `LiveTradingPublishLanes019` runs from `C:\live-trading\publisher` and force-resets that checkout to
`origin/main` on every run, so the lane roots come from the ignored
`C:\live-trading\publisher\config\live-trading-lanes.local.json` (`lane_roots`: `ftmo-1` `C:\live-trading\runtime`,
`ftmo-2` `C:\ftmo2`). It has to be written **without a BOM**: a BOM makes the publisher exit 2 before it reads a lane.

The 20:12:34Z run published both lanes in `e6673432`. `data/live-trading-lanes.json` reads ftmo-2 `enabled: true`,
`published`, `***841` on `FTMO-Server3`, half grid at R3, magic `20261005`, beside lane 1's unchanged
`***614`/`FTMO-Server` full grid at R5; `data/live-trading.account2.json` carries the four-instrument snapshot; and
`data/live-trading-trader.ftmo-2.json` carries `"armed":false`, `"status":"planned"`, `"checkout_head":"4d93757d"`.

## 7. Arming lane 2 (last, and only with the FTMO reply in hand)

This stage is the only one that can place a ticket, and it is deliberately one command away from the previous stage.

```powershell
cd C:\ftmo2
# The lane-2 registration, identical to stage 5 except for -Arm.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\register-live-trading-trader-task.ps1 
  -RepoRoot C:\ftmo2 -Lane ftmo-2 -Grid half -RMultiple 3 -Magic 20261005 
  -ExpectIdentity C:\live-trading\state\lane-ftmo2-identity.json 
  -TaskName LiveTradingTraderTick-ftmo2 -ChainFeed -Published C:\live-trading\publisher -Arm 
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

**The armed registration, as it was run on 2026-11-10**, is recorded in
[LANE2_ARMED_20261110.md](LANE2_ARMED_20261110.md): the exact command (including the corrected `-Published` and the
host's own `-HiddenRunner`), the four `volume_min` sizes read from Terminal 2, the rule checked line by line against
the deployed code, the three limits the first armed ticks sent with their broker answers, and what the hosted page
showed afterwards. Read that page before changing a flag here, because it is the only record of what lane 2 has
actually sent.


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

