# Building and connecting the Live L2L Blind lane (FTMO 3)

The build of the third lane, and the steps that stay undone until the owner buys a third FTMO account. The rule itself is
in [LIVE_L2L_BLIND_RULESET.md](LIVE_L2L_BLIND_RULESET.md); this page is the machine work.

Status, 2026-11-14: **the lane is built and tested on branch `live-trading/l2l-blind-20261114`; nothing is deployed, no
task is registered, no terminal is installed and no account is bought.** The blocker is one purchase. Until it clears,
this page is the plan.

Host progress, 2026-11-14 (`18:57Z`–`19:12Z`, [`FTMO3_HOST_PREP_20261114.md`](FTMO3_HOST_PREP_20261114.md)): §3a is
done — `C:\ftmo3` is cloned at the branch with an empty `git status` and its `tmp` and `data` folders made; §3b's
installer was verified (the lane-2 package, same hash, and the destination field still absent, so the wizard has not been
run); §3c **cannot** be done before the login, because the registration refuses without an identity file and would drop
`--terminal` if the folder were absent; §3d passed on the host, `199/199`; and a five-scene dry run was made from
`C:\ftmo3` against saved inputs with sending disabled (that page §5) — both reclaims, the crossing refusal, the fifth
entry of a day and the one-ticket-per-pair refusal, with the full grid, `5R`, lane 1's 2R/3R stop rungs, broker-minimum
sizing and `max_per_day: null`.

## 1. What the branch contains

| File | What it holds |
| --- | --- |
| `lib/l2l_strategy.js` | `watchPair`, `pairStanding`, `blindPlan`, `blindReadings`, `BLIND_MAGIC = 20261006`, and a `watch` list on `buildPlan` so only the two watched rungs may arm |
| `scripts/run-live-trading-trader.js` | `--blind` (implies `--require-deviation`, refuses `--expire-minutes` and `--reentry-crossing`), `blindWatchPairs`, the pair kept in `state.blind`, a blind branch in the decision, the pending review and the trade cycle, `caps.max_per_day: null` with `entries_today`, and `--max-per-day unlimited` |
| `scripts/register-live-trading-trader-task.ps1` | `-Blind`, `-MaxPerDay 0` → `--max-per-day unlimited`, and the lane-row checks for the blind rule beside magic, identity, grid and multiple |
| `config/live-trading-lanes.json` | the `ftmo-3` row: `"blind": true`, magic `20261006`, root `../ftmo3`, snapshot `data/live-trading.blind.json`, heartbeat `data/live-trading-trader.ftmo-3.json`, `enabled: false` |
| `scripts/publish-live-trading-lanes.js` | the lane's `strategy.blind` carried into the published lanes document |
| `script.js` | the third name in the page's lane list, and a `null` cap read as "no daily entry cap — N entries today" |
| `tests/live_trading_blind_lane.test.js` | thirteen readings, including the armed end-to-end run that places the fifth entry of a day |
| `docs/live-trading/DAILY_CAP_REMOVAL_20261114.md` | the staged no-cap change for FTMO 1 and FTMO 2, with switch and rollback commands — a separate operation |

## 2. The layout this lane will take

Matching lane 2's, which is the pattern already proved on the host (`LANE2_VPS_RUNBOOK.md` §1):

| Thing | Value |
| --- | --- |
| checkout | `C:\ftmo3` (the lanes file's `root: "../ftmo3"`, relative to the publisher's `C:\live-trading\runtime`) |
| terminal | `C:\Program Files\FTMO Global Markets MT5 Terminal 3` — a third installation, not a second shortcut |
| data folder | its own `%APPDATA%\MetaQuotes\Terminal\<hash>` whose `origin.txt` names that install |
| ownership number | `20261006` on every ticket it places |
| identity file | `C:\live-trading\state\lane-ftmo3-identity.json`, private, ACL'd to `Administrators` and `SYSTEM` |
| snapshot | `C:\ftmo3\data\live-trading.json`, published as `data/live-trading.blind.json` |
| heartbeat | `C:\ftmo3\tmp\live-trading-trader-status.json`, published as `data/live-trading-trader.ftmo-3.json` |
| state, log, journal, lock | `C:\ftmo3\tmp\live-trading-trader-state.json`, `…trader.log`, `…orders.log`, `…trader.lock` |
| tasks | `LiveTradingLane-ftmo3`, `LiveTradingTraderTick-ftmo3`, `LiveTradingTerminalStartup-ftmo3` |
| rule | `--blind`, full grid, 5R, no expiry, no daily cap |

Nothing here shares a file with lanes 1 or 2: not the checkout, not the terminal, not the data folder, not the state,
not the log and not the magic.

## 3. Prepare the host before the purchase

All of this runs without an account, and every step is read-only or reversible. It leaves the lane parked
(`enabled: false`, tasks registered and **disabled**), which is the state it must stay in until the login exists.

### 3a. The checkout

```powershell
git clone https://github.com/kevincreedycars-debug/trading-agent-dashboard.git C:\ftmo3
git -C C:\ftmo3 fetch --all --prune
git -C C:\ftmo3 checkout live-trading/l2l-blind-20261114
git -C C:\ftmo3 rev-parse HEAD
git -C C:\ftmo3 status --porcelain          # empty
```

The lane's row in `config/live-trading-lanes.json` already names `../ftmo3`, so the publisher in
`C:\live-trading\runtime` finds this checkout without a local override.

### 3b. The third terminal, and the destination check the owner asked for

Install from the FTMO package **as a separate installation**: the installer's *Destination Folder* field must read
`C:\Program Files\FTMO Global Markets MT5 Terminal 3` — exactly that, ending in ` 3`, not lane 1's folder and not
lane 2's. Compare character by character before pressing **Install**; if the build offers no destination field at all,
cancel and report rather than install over another lane. Lane 1's and lane 2's terminals are not opened, re-logged or
reconfigured in this step.

```powershell
# Three installations, three hashes, three data folders each naming its own install.
'C:\Program Files\FTMO Global Markets MT5 Terminal\terminal64.exe',
'C:\Program Files\FTMO Global Markets MT5 Terminal 2\terminal64.exe',
'C:\Program Files\FTMO Global Markets MT5 Terminal 3\terminal64.exe' | ForEach-Object {
  Test-Path $_; if (Test-Path $_) { (Get-FileHash $_ -Algorithm SHA256).Hash }
}
Get-ChildItem "$env:APPDATA\MetaQuotes\Terminal" -Directory |
  Select-Object Name, @{ n = 'origin'; e = { (Get-Content (Join-Path $_.FullName 'origin.txt') -ErrorAction SilentlyContinue) } } |
  Where-Object { $_.origin } | Format-Table -AutoSize
```

Market Watch in the new terminal must hold **EURUSD, XAUUSD, US100.cash and BTCUSD** before anything else: a cold
terminal serves what it holds or has been told to subscribe, and a symbol it does not serve comes back unavailable.

### 3c. The lane's tasks, registered unarmed and then disabled

```powershell
cd C:\ftmo3
# The command line first, and read it: -Show writes nothing.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\register-live-trading-trader-task.ps1 `
  -Show -Lane ftmo-3 -RepoRoot C:\ftmo3 -Published C:\live-trading\runtime `
  -Magic 20261006 -Blind -Grid full -RMultiple 5 `
  -ExpectIdentity C:\live-trading\state\lane-ftmo3-identity.json `
  -Terminal "C:\Program Files\FTMO Global Markets MT5 Terminal 3" `
  -TaskName LiveTradingTraderTick-ftmo3
```

It must state `rule = blind: two watched lines, no Layer 1 call`, `max_per_day = unlimited`, and a `loop_command`
carrying `--lane "ftmo-3" --magic 20261006 --expect-identity "…lane-ftmo3-identity.json" --blind
--max-per-day unlimited --terminal "…MT5 Terminal 3"` and **no** `--confirm-live`. The identity file has to exist
before the registration will write that line; make it at §4 step 3, or point `-ExpectIdentity` at a placeholder only
for this dry read, never for a registration.

```powershell
# Register unarmed, then park both tasks until the account exists. -NoStart keeps the scheduler from firing the first
# tick at once; Disable-ScheduledTask is what makes "disabled" a state of the host rather than a note in a file.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\register-live-trading-trader-task.ps1 `
  -Lane ftmo-3 -RepoRoot C:\ftmo3 -Published C:\live-trading\runtime `
  -Magic 20261006 -Blind -Grid full -RMultiple 5 `
  -ExpectIdentity C:\live-trading\state\lane-ftmo3-identity.json `
  -Terminal "C:\Program Files\FTMO Global Markets MT5 Terminal 3" `
  -TaskName LiveTradingTraderTick-ftmo3 -NoStart
Disable-ScheduledTask -TaskName LiveTradingTraderTick-ftmo3
Get-ScheduledTask -TaskName LiveTradingTraderTick-ftmo3 | Select-Object TaskName, State
```

`-Test` may be run on this registration before it is armed: it proves the launcher in a throwaway folder and checks the
production wrapper and task are byte-for-byte what they were. It never passes `--confirm-live`.

### 3d. The local suite, on the host, before anything is switched on

```powershell
cd C:\ftmo3
node --test tests/live_trading_blind_lane.test.js tests/l2l_strategy.test.js tests/live_trading_deviation_sequence.test.js
node --test tests/live_trading_trader.test.js tests/live_trading_lane_isolation.test.js
```

This is where the owner's checklist is proved: both directions, the unwatched-line refusal, order management, restart
behaviour and the fifth same-day entry are assertions in `tests/live_trading_blind_lane.test.js`; the registration's
command line is asserted in `tests/live_trading_lane_isolation.test.js`. Passing here is evidence about the code, not
about the account — the fifth entry and the two-minute test below are the account's own evidence.


## 4. When the third account exists: purchase and login

Step-by-step, in the order they have to happen. Nothing here is run by an agent; every credential step is the owner's.

1. **Buy the account in the FTMO client area.** The lane trades the minimum volume each symbol allows, so the account
   size does not change the rule — the ruleset's percentages are quoted against a $10,000 account only because that is
   the size its risk arithmetic was worked on. Choose the MT5 platform for the new account, not cTrader: the cTrader
   Challenge stays reserved for the separate copy-trading project.
2. **Take the login, server and passwords from FTMO's own confirmation**, in the client area. Three values matter:
   the login number, the server name (lanes 1 and 2 are on `FTMO-Server` and `FTMO-Server3`, so this one is likely a
   third name — read it, do not assume), and the password.
3. **Enter them in the new terminal only.** Open `C:\Program Files\FTMO Global Markets MT5 Terminal 3\terminal64.exe`
   on the RDP desktop, *File → Login to Trade Account*, and type the login, password and server there. Do not paste any
   of them into a chat, a file in the repository, or this page. For the unarmed stages sign in with the **investor
   (read-only) password**: the server then refuses every trade request, so "this lane cannot send yet" is enforced by
   the account rather than only by a flag.
4. **Write the identity file by hand**, from the login and the terminal path, and lock it down:

   ```powershell
   New-Item -ItemType Directory -Force -Path C:\live-trading\state | Out-Null
   # {"login": <the full account number>, "server": "<the server from step 2>",
   #  "terminal_path": "C:\\Program Files\\FTMO Global Markets MT5 Terminal 3\\terminal64.exe"}
   notepad C:\live-trading\state\lane-ftmo3-identity.json
   icacls C:\live-trading\state\lane-ftmo3-identity.json /inheritance:r /grant:r "Administrators:F" "SYSTEM:F"
   ```

   `terminal_path` ends in `terminal64.exe`; a folder never resolves to an executable and the gate refuses it.
5. **Prove the gate before registering anything.**

   ```powershell
   python C:\ftmo3\tools\mt5-bridge\live-trading-account-probe.py --path "C:\Program Files\FTMO Global Markets MT5 Terminal 3"
   python C:\ftmo3\tools\mt5-bridge\live-trading-order.py status `
     --expect-identity C:\live-trading\state\lane-ftmo3-identity.json `
     --journal C:\ftmo3\tmp\live-trading-orders.log
   ```

   Passing: the probe names the new account's masked login on its own server, shows all four symbols available and
   tradable with their `volume_min`, and the `status` call's `identity` block agrees with the file. An
   `identity_mismatch` means the terminal is on the wrong account or the file names the wrong terminal: fix that before
   going on.

## 5. The connection test, after the login

Run with the lane **unarmed and entries paused**, so no rule can place anything while the account is being proved:
`--pause-entries` on the trader, or simply leave `LiveTradingTraderTick-ftmo3` disabled as §3c left it and drive the
tool by hand. The test is one ticket the operator places and closes, and it is labelled so it can never be mistaken for
a rule trade.

1. **Identity, server, size.** From §4 step 5: masked login, server, and BTCUSD's `volume_min`. Record all three.
2. **One protected, minimum-size BTCUSD position**, labelled as a connection test and carrying a stop:

   ```powershell
   python C:\ftmo3\tools\mt5-bridge\live-trading-order.py open `
     --symbol BTCUSD --side buy --lots <BTCUSD volume_min> `
     --stop-loss <a price below the market that the platform accepts> `
     --comment tech-conn-test-ftmo3 `
     --magic 20261006 `
     --expect-identity C:\live-trading\state\lane-ftmo3-identity.json `
     --journal C:\ftmo3\tmp\live-trading-orders.log `
     --confirm-live
   ```

   The ticket, its fill price and the fill instant come back in the tool's own record. **The two-minute timer starts at
   the confirmed fill**, not at the request.
3. **Close it after two minutes** if it is still open:

   ```powershell
   python C:\ftmo3\tools\mt5-bridge\live-trading-order.py close --ticket <ticket> `
     --expect-identity C:\live-trading\state\lane-ftmo3-identity.json `
     --journal C:\ftmo3\tmp\live-trading-orders.log --confirm-live
   ```

   A ticket the stop closes first is a normal answer too: report the stop's own exit instead of a hand close.
4. **Read the account back** and report, in this order: ticket, volume, fill price and instant, exit price and instant,
   actual holding time, P&L (with commission and swap), and any remaining FTMO 3 exposure — positions and working orders
   of magic `20261006`. "No remaining exposure" is a fact to be read, not assumed.
5. **Bring the result before arming.** The lane is armed only after this report has been read: re-log the terminal with
   the master password, enable and register `LiveTradingTraderTick-ftmo3` **with** `-Arm`, flip `enabled` to `true` in
   `config/live-trading-lanes.json` so the publisher starts carrying its snapshot and heartbeat, and watch the first
   unarmed tick's heartbeat before letting the armed one run.

## 6. What "ready" means, and what it does not

Ready means: the branch is reviewed, the host is prepared to §3, the tests pass on the host, and **the third login is
the remaining dependency**. It does not mean the lane has traded, that it has an edge, or that FTMO has agreed to a
third account trading a *different* rule — that letter is still outstanding, on the same terms as lane 2's
(`VPS_DEPLOYMENT_STATUS_20261024.md` §4). It also does not mean lanes 1 and 2 have changed: the no-cap change for them
is [DAILY_CAP_REMOVAL_20261114.md](DAILY_CAP_REMOVAL_20261114.md) and its switches are separate, reviewed, and not
applied here.

