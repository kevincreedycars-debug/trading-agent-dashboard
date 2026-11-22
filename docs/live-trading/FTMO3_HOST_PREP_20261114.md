# FTMO 3 on the host: what was staged on 2026-11-14

The blind lane's host preparation, run over the key-only ssh door from `D:\trading-agent-dashboard-codex` between
`2026-11-14T18:57Z` and `2026-11-14T19:12Z`. Read with [`BLIND_LANE_BUILD.md`](BLIND_LANE_BUILD.md) §3, which is the
plan this page reports on, and [`LIVE_L2L_BLIND_RULESET.md`](LIVE_L2L_BLIND_RULESET.md), which is the rule.

Host `VMI3697641` (`VMI3697641\Administrator`), Windows PowerShell 5.1, `node` v22.19.0 at
`C:\Program Files\nodejs\node.exe`, `python` 3.13.7 at `C:\Program Files\Python313\python.exe`, `git` 2.53.0.

**Staged:** the lane-3 checkout, its `tmp` and `data` folders, the installer package checked and its destination
proved absent, the whole host-side suite green, and a five-scene dry run of the lane against saved inputs with sending
disabled. **Not staged, and not able to be:** the third terminal (an RDP wizard act), the identity file and the tasks
(both need the login). No task was registered, no terminal was started, no order was sent, no lane row was published,
and the lane-1 and lane-2 checkouts were not written to.

The third terminal was installed later the same evening, at `20:14Z`, once the wizard could be driven from the desktop
session; [§9](#9-the-third-terminal-installed-2014z) is that record, and it supersedes the "not installed" readings
above without rewriting them.

The account was logged in and the lane proved at `21:39Z`-`21:52Z` the same evening: [§10](#10-the-login-the-gate-and-the-connection-test-2138z-2152z)
holds the login, the identity file, the gate's own read-backs, the unarmed-then-disabled registration and the
`+0.32 USD` two-minute BTCUSD connection test. The lane is still unarmed.


## 1. The checkout

```powershell
git clone --branch live-trading/l2l-blind-20261114 https://github.com/kevincreedycars-debug/trading-agent-dashboard.git C:\ftmo3
git -C C:\ftmo3 rev-parse HEAD        # 1653b693, then fast-forwarded to 702b20c6 at 19:13Z (test fix, §6)
git -C C:\ftmo3 status --porcelain    # empty
New-Item -ItemType Directory -Force -Path C:\ftmo3\tmp, C:\ftmo3\data
```

The bytes that decide whether a send is possible are the ones the checkout holds, so they were hashed on the host and
compared with the reviewed branch: `run-live-trading-trader.js` `e3bc8fe85eaa886ad2597cee30a294e1249f3634`,
`register-live-trading-trader-task.ps1` `7d95c76c3be8302cdd2b2730dd552b7085f2be71`, `lib/l2l_strategy.js`
`6b99cfde1877c92f652329293ae90dae66028be1`, `config/live-trading-lanes.json`
`3cf189c5567ebee1fd324835e4cf68fa18cc6e24` — each equal to the same file on this PC.

The clone is the lane's own checkout; nothing in it is shared with lane 1 (`C:\live-trading\runtime`) or lane 2
(`C:\ftmo2`).

## 2. The three lanes' paths, read on the host

| | lane 1 (running) | lane 2 (running) | lane 3 (staged) |
| --- | --- | --- | --- |
| checkout | `C:\live-trading\runtime` | `C:\ftmo2` | `C:\ftmo3` |
| terminal | `C:\Program Files\FTMO Global Markets MT5 Terminal` | `C:\Program Files\FTMO Global Markets MT5 Terminal 2` | `C:\Program Files\FTMO Global Markets MT5 Terminal 3` — **not installed at 19:12Z; installed 20:14Z (§9)** |
| MT5 data folder | `%APPDATA%\MetaQuotes\Terminal\81A933A9AFC5DE3C23B15CAB19C63850` | `…\8A052B160E5CE0B13984FF3CD196FEFE` | none yet; its `origin.txt` must name the `… Terminal 3` install — it does, in `…\D31040007DAC7476494A754CD0942EA6` (§9) |
| identity file | none — lane 1 is not identity-gated | `C:\live-trading\state\lane-ftmo2-identity.json` | `C:\live-trading\state\lane-ftmo3-identity.json` — **missing** |
| snapshot | `C:\live-trading\runtime\data\live-trading.json` | `C:\ftmo2\data\live-trading.json` | `C:\ftmo3\data\live-trading.json` (not produced yet) |
| heartbeat | `C:\live-trading\runtime\tmp\live-trading-trader-status.json` | `C:\ftmo2\tmp\live-trading-trader-status.json` | `C:\ftmo3\tmp\live-trading-trader-status.json` |
| published as | `data/live-trading.json`, `data/live-trading-trader.ftmo-1.json` | `data/live-trading.account2.json`, `data/live-trading-trader.ftmo-2.json` | `data/live-trading.blind.json`, `data/live-trading-trader.ftmo-3.json` |
| magic | `20261004` | `20261005` | `20261006` |
| tasks | `LiveTradingTraderTick019`, `LiveTradingLane-ftmo1`, `LiveTradingTerminalStartup` | `LiveTradingTraderTick-ftmo2` | none registered |
| identity checked before a send | no | yes | yes (`--expect-identity`) |
| rule | full L2L, 5R, Layer 1 call | half L2L, 3R, call, crossing re-arm | **blind: two watched rungs, no call, 5R, no expiry, no daily cap** |

Both data folders name their own install in `origin.txt`, which is the property that keeps two terminals from sharing
one account: `81A9…` → `C:\Program Files\FTMO Global Markets MT5 Terminal`, `8A05…` → `… Terminal 2`.

## 3. The installer, and the destination check

The package is the one lane 2 was installed from, still in the installer's download folder:

| What | Value |
| --- | --- |
| path | `C:\Users\Administrator\Downloads\ftmo5setup.exe` |
| bytes | 4,744,320 |
| SHA-256 | `34F80A78DE65029992F99AC7C16F84383E8CFF4B82CBA02F1E04CDE816B2568D` — the hash `LANE2_VPS_RUNBOOK.md` §2r records |

Checked **before** anything was started:

- the destination folder `C:\Program Files\FTMO Global Markets MT5 Terminal 3` **does not exist**, so nothing has been
  installed there and nothing has been installed over lane 1;
- the wizard's default destination is `C:\Program Files\FTMO Global Markets MT5 Terminal` — **lane 1's own folder**, the
  installation a running lane reads every five minutes. That is why this package is never run with defaults and never
  from an ssh session: MT5's setup takes no destination on its command line, so a silent or defaulted run would rewrite
  the terminal that is trading;
- `C:` has 71.4 GB free.

**The install itself is the owner's act on the RDP desktop** (`mstsc /v:158.220.87.240`, `Administrator`), and the one
thing to read in the wizard is the *Destination Folder* field: it must read exactly
`C:\Program Files\FTMO Global Markets MT5 Terminal 3` — ending in ` 3`, not lane 1's folder and not lane 2's. If this
build's wizard has no destination field, cancel and report rather than install over a lane. After the first run of the
new terminal, Market Watch must hold `EURUSD`, `XAUUSD`, `US100.cash` and `BTCUSD`.

## 4. What "state and disabled tasks" can and cannot mean yet

Both remaining prerequisites are behind the login, and the order between them and the registration matters:

1. **The identity file has to exist before the registration is written.** `register-live-trading-trader-task.ps1`
   throws `Not found: … The identity file must exist before a task is registered to check it.` It needs the account
   number, the server and `terminal_path`, and it is written by hand and ACL'd to `Administrators` and `SYSTEM`
   (`BLIND_LANE_BUILD.md` §4 step 4).
2. **The terminal folder has to exist before the registration too**, for a quieter reason: the script writes
   `--terminal` only when the path is present, and *prints a note and leaves the flag out* when it is not
   (`scripts/register-live-trading-trader-task.ps1`, the `$terminalArgument` block). A lane-3 task registered before
   its terminal exists would fall back to the order tool's own discovery — lane 1's terminal — with the lane's identity
   gate as the only thing standing between that line and a send.

So no `LiveTradingTraderTick-ftmo3` task was created: a task whose command line would be wrong is worse than a task that
does not exist. The three names are reserved and unwritten: `LiveTradingLane-ftmo3`, `LiveTradingTraderTick-ftmo3`,
`LiveTradingTerminalStartup-ftmo3`. The registration commands to run after the login are `BLIND_LANE_BUILD.md` §3c, and
they register **unarmed** and then `Disable-ScheduledTask` both tasks until the connection test in §5 of that page has
been read.

One further fact found on the host, worth having in the record: a checkout whose own folder is named after a lane's root
makes "one lane by construction" ambiguous, because in `C:\ftmo3` the lanes file's `.` (lane 1) and `../ftmo3` (lane 3)
resolve to the same directory. The registration refuses and names both lanes rather than guessing; every runbook line
therefore passes `-Lane` explicitly, and the lane-1 registration test was changed to do the same (§6).

## 5. The dry run: saved inputs, sending disabled

Run at `19:09Z` from `C:\ftmo3` at `1653b693`, against saved inputs, by `node C:\ftmo3\tmp\demo\demo.js`. The runner is
the lane's own `scripts/run-live-trading-trader.js --blind`; the inputs are a feed (`live-trading-feed-v4`), a marked
ladder (`l2l-levels-v1`) and a state file, written per scene; the *answers* printed below are the runner's own record,
not a re-implementation.

**What stands in for the order tool, and why.** The third terminal does not exist yet, so the loop's read-only `status`
is answered by `C:\ftmo3\tmp\demo\status-stub.exe` — a four-kilobyte program compiled on the host with
`Add-Type -OutputAssembly`, which prints one saved record and appends its own argument list to a log. It has no send
path of any kind: it can answer a status and it cannot place, cancel, close or modify anything, whatever it is asked.
Consequently:

- `--confirm-live` was **not** passed to any of the five runs, and `armed=false` in every record;
- the tool's own `--lots` flag appears in **none** of the five calls, so sizing stays the order tool's
  `resolve_volume(None, …)` — the symbol's `volume_min`, the broker minimum;
- `--expire-minutes` appears in none of them;
- nothing was read from any FTMO account, and the record's `identity_checked: true` states that the flag was passed, not
  that an account was compared;
- the `--terminal "… Terminal 3"` path in the call does not exist yet; it is carried so the invocation is the one the
  registered task will write.

The five scenes, in the runner's own words (EURUSD at the ruleset §9 rungs 1.11887 / 1.12308 / 1.12729):

| # | Scene | What the runner decided |
| --- | --- | --- |
| 1 | closes 1.11950, 1.11920, 1.11850, 1.11905 | `place`, **long**: entry `1.11887`, stop `1.118028`, target `1.12308`, risk `0.000842` (84.2 points), pair 1.11887 / 1.12308, 4 probes |
| 2 | closes 1.12700, 1.12760, 1.12690 | `place`, **short**: entry `1.12729`, stop `1.128132`, target `1.12308`, risk `0.000842`, pair 1.12308 / 1.12729 |
| 3 | closes 1.11860, 1.11890, 1.11905 | **no ticket**: "the newest closed M5 candle at 1.11905 has not completed a reclaim of either watched line, so no side is set" |
| 4 | scene 1's closes, four placements already on the Prague day | `place` — `taken_today=4`, `max_per_day=null`; the heartbeat says `entries_today=4`, `capped=false` |
| 5 | scene 1's closes, with one working EURUSD order (magic `20261006`) in the account read | `skip` — "EURUSD already carries a ticket from this loop, and the rule holds one trade at a time on a pair" |

Every run's heartbeat said the same thing about the configuration, which is the effective-settings check:

```
strategy: rule=blind call_read=none grid=full r_multiple=5 require_deviation=true reentry=level
caps:     expire_minutes=null max_open=null max_per_day=null
```

and the module's own stop rungs, read out of the same checkout, are `breakeven=2R`, `trail_from=3R`, `behind=3R` —
lane 1's stop management, from module constants no lane overrides. So: full L2L grid, 5R, lane 1's stop rungs, broker
minimum size, one working ticket per pair, and no daily entry cap.

**What this does not prove.** It is a decision-path demonstration on saved inputs, not an account test: no fill, no
broker, no symbol specification, no slippage, and no evidence of edge. The two-minute BTCUSD test after the login is the
account's own evidence, and it is still to come.

## 6. Lanes 1 and 2 before and after

No lane-1 or lane-2 file was written, no task was re-registered, no terminal was started or re-logged. The checkpoints
are the heartbeats the page reads, taken at `18:57:35Z` (before the first write) and `19:10:31Z` (after the last):

| | before `18:57:35Z` | after `19:10:31Z` |
| --- | --- | --- |
| lane 1 heartbeat (`LiveTradingPublishLanes019` carries it) | `at_utc 18:36:30`, `armed: true`, `ftmo-1`, `nothing_to_place`, `***614` | `at_utc 18:56:30`, same five values; the publisher's own last run `19:00:55Z`, so the copy is one cadence behind its lane's status — which itself read `19:06:30Z`, 4.3 min old |
| lane 1 snapshot | `data/live-trading.json` fresh | generated `19:10:20Z`, 0.5 min old, `***614` on `FTMO-Server`, four instruments |
| lane 2 heartbeat (`C:\ftmo2\tmp\live-trading-trader-status.json`) | `at_utc 18:56:31`, `armed: true`, `ftmo-2`, `nothing_to_place`, `***841`, half grid / 3R / `reentry: crossed`, `max_per_day: 4` | `at_utc 19:06:31`, **identical except the instant** |
| lane 1 task | `LiveTradingTraderTick019` `Running`/`Ready` | unchanged |
| lane 2 task | `LiveTradingTraderTick-ftmo2` `Running` | unchanged |
| lane 1 checkout | `HEAD c5abd0ac`, four pre-existing modified/untracked lines | identical, untouched |
| lane 2 checkout | `HEAD f14f2ac7`, one pre-existing modified line | identical, untouched |
| terminals | two installs, two hash folders | two installs, two hash folders — no third |
| tasks named `…ftmo3` | none | none |

The lane-2 heartbeat still states `caps.max_per_day: 4`: the no-cap change is **staged in the branch and not applied**,
exactly as [`DAILY_CAP_REMOVAL_20261114.md`](DAILY_CAP_REMOVAL_20261114.md) says.

## 7. The suite on the host

```powershell
cd C:\ftmo3
node --test tests/live_trading_blind_lane.test.js tests/l2l_strategy.test.js tests/live_trading_deviation_sequence.test.js `
  tests/live_trading_trader.test.js tests/live_trading_lane_isolation.test.js
```

- at `1653b693`, `19:02Z`: `199 tests, 198 pass, 1 fail` — the failure was the lane-1 registration test, which asked the
  script to work the lane out from the checkout, and the checkout at `C:\ftmo3` names two lanes at that root (§4). The
  test now passes `-Lane ftmo-1` explicitly, as every runbook line does.
- at `702b20c6`, `19:14Z`: `199 tests, 199 pass, 0 fail, 0 skipped`.

## 8. What is left, and what it waits on

All five steps below are now done; §10 is the evidence. The list is kept in the order the host needed them:

1. ~~**The third FTMO account.**~~ Done `21:39Z` (§10): `***584` on `FTMO-Server3`, titled `Hedge`, and
   `config\accounts.dat` present afterwards, so the terminal can log itself back in after a reboot.
2. ~~The terminal install on the RDP desktop, with the destination field reading `… MT5 Terminal 3` (§3).~~ Done
   `20:14Z`; the field read `C:\Program Files\FTMO Global Markets MT5 Terminal 3`, and §9 is the proof.
3. ~~**The identity file**, written from the login (§4).~~ Done `21:43:43Z` (§10).
4. ~~**The account probe** and the tool's `status` against the new identity.~~ Done `21:41:40Z` and `21:44:23Z` (§10):
   `ok: true`, all four symbols at `volume_min` `0.01`, and the `status` identity block agreeing with the file.
5. ~~**The registration, unarmed, then disabled**~~, done `21:46:54Z`, and ~~the two-minute BTCUSD connection test~~
   done `21:47:35Z`–`21:50:06Z` (§10), with the report below.

What still waits is the owner's: reading §10, then arming — enable and register `LiveTradingTraderTick-ftmo3` **with**
`-Arm`, flip `enabled` to `true` in `config/live-trading-lanes.json` so the publisher carries its snapshot and
heartbeat, and watch the first unarmed tick before letting the armed one run.


## 9. The third terminal, installed 20:14Z

Run over the same key-only ssh door, `2026-11-14T20:12Z`–`20:21Z`. The installer is a wizard, so it was driven from the
RDP desktop session (session 1) rather than from the ssh session: a scheduled task registered as
`VMI3697641\Administrator`, `LogonType Interactive`, `RunLevel Highest`, running a script that launches
`ftmo5setup.exe`, clicks **Settings**, writes the two fields and reads them back, then proceeds only if both read back.
The task was unregistered by the same script as its last act.

| | value read on the host |
| --- | --- |
| `Installation folder:` readback | `C:\Program Files\FTMO Global Markets MT5 Terminal 3` |
| `Program group:` readback | `FTMO Global Markets MT5 Terminal 3` |
| guard | the run aborts before **Install** if either readback differs or names lane 1 or lane 2; a recursive snapshot of both lane folders was taken first and compared each loop, and a change would have taskkilled the setup |
| installed `terminal64.exe` | `5.0.0.6320`, 120,622,880 bytes, mtime `20:14:37Z`, sha256 `CEDC985E4E82753DDEFDDD0AC41EC255364DB2DA13DA3492F4C720F544D5FBA2` |
| install folder contents | 579 files, no file outside the requested folder |
| new MT5 data folder | `%APPDATA%\MetaQuotes\Terminal\D31040007DAC7476494A754CD0942EA6`, `origin.txt` reading `C:\Program Files\FTMO Global Markets MT5 Terminal 3` |
| `config\` in that folder | `assistant.ini`, `common.ini`, `dnsperf.dat`, `hotkeys.ini`, `servers.dat`, `settings.ini`, `terminal.ini` — **no `accounts.dat`**, so no login is stored |
| terminal window, session 1 | `pid=596` class `MetaQuotes::MetaTrader::5.00` name `FTMO Global Markets MT5 Terminal - Netting - EURUSD,H1` — no account number, no server, so it is at the login step |

The three installs are now three installs and three data folders, each `origin.txt` naming its own directory:
`…Terminal` → `81A933…`, `…Terminal 2` → `8A052B…`, `…Terminal 3` → `D31040…`. Nothing is shared.

Two details of the run are worth keeping. The installer (`ftmo5setup.exe`, sha256 `34F80A78…B2568D`) opened its
`Installation folder:` field pre-filled with `C:\Program Files\FTMO Global Markets MT5 Terminal` — lane 1's own
directory, which is the collision §3 warned about, so the readback guard was load-bearing and not decoration. And a
single `WM_SETTEXT` did not stick (the field still read the old value at 0.7 s and 3.7 s), so the path was typed
character by character and read back again at 0.7 s and 2.7 s before **Next >** was posted.

Before and after the install, lane 1's and lane 2's `terminal64.exe` hashes were read and were unchanged
(`97C204AD…253D590`, `C033CE8F…5688B3`), each install still 579 files.

The one line in the new terminal's journal that looks like a fault is not one:

```
20:14:47.707  MCP  bind error on 127.0.0.1:22346 [Only one usage of each socket address … (10048)]
```

`22346` is held by lane 1's terminal (`pid=1592`, `LISTENING`), and lane 2's own journal carries the identical line from
its first start on `2026-11-09 21:12:04`. Lane 2 has been trading through the Python bridge since, so the line is a
side-service port clash, not a bridge fault. What the bridge does say about the new terminal is the expected pre-login
answer, from the same session-1 run that read lane 2 successfully as a control:

```
--path "C:\Program Files\FTMO Global Markets MT5 Terminal 3"  →  ok: false, code -10005, "IPC timeout"
--path "C:\Program Files\FTMO Global Markets MT5 Terminal 2"  →  ok: true,  ***841, FTMO-Server3, build 6314, positions_open 1
```

The package attaches only to a terminal that is logged in, so `IPC timeout` here is the read-only statement "no account in
that terminal yet". It is also the reason the account probe is step 4 and not step 2 of §8.

Lanes 1 and 2, before `20:12Z` and after `20:21Z`:

| | before | after |
| --- | --- | --- |
| lane 1 heartbeat | `armed: true`, `ftmo-1`, `nothing_to_place`, `***614`, 0 positions | `at_utc 20:21:30`, same values |
| lane 2 heartbeat | `armed: true`, `ftmo-2`, `nothing_to_place`, `***841`, 1 position / 1 ours | `at_utc 20:21:31`, same values |
| `LiveTrading*` task XMLs | 8 files, newest mtime `2026-11-10T20:46:25` | identical 8 files, same sha256 and mtimes |
| tasks named `…ftmo3` | none | none — the runner unregistered itself, `ftmo3_task_files=0` |
| lane checkouts | `C:\live-trading\runtime`, `C:\ftmo2` untouched | untouched |

### What the login will have to clear

1. **The account probe against the new identity** — `ok: true`, login masked, `FTMO-Server*`, currency, leverage, margin
   mode, and the per-symbol rows for the four pairs. Anything other than `ok: true` stops the sequence there.
2. **The min-size BTCUSD test** — one order at the broker minimum on the account's own terminal, held two minutes,
   closed, read back through the order tool's journal. That is the account's evidence; the dry run in §5 is not.
3. **Then the registration, unarmed and disabled**, exactly as §8 step 5 says. The terminal stays unarmed — no task, no
   identity file, no order — until 1 and 2 pass.

### The login dialog, opened 21:09Z and left for the owner

The dialog is the owner's to fill, so it was opened and left: nothing typed, nothing submitted, kept open. MT5's menu
bar is a real `HMENU`, so the item was read rather than guessed — `GetMenu` on the main window `68300` gave seven bars,
and `File` (`68501`) 22 items, with `&Login to Trade Account` at index 17, id `32853` (read `21:05:58Z`). Posting
`WM_COMMAND` `32853` to `68300` opened a `#32770` window titled `Login`, `hwnd 1182098`, 541×253 at 690,387, visible
and enabled, `21:06:48Z`–`21:09:06Z`.

The dialog's own controls, read by class and label: `Login:` (combo, `account number or client ID`), `Password:`
(`main, trader, money manager or read only`), `Certificate password:`, `One-time password:`, `Server:` (combo), a
`Save password for quick login` checkbox, **OK**, **Cancel**. No screenshot was taken and no `Edit` was read — the Login
field is unmasked — so the log records each `Edit` as `<not read>`.

The first-run `Open an Account` wizard is still on that desktop, greyed out (`enabled=False`) behind the login dialog,
which is the modal owner. `WM_CLOSE`, `WM_SYSCOMMAND SC_CLOSE`, `BM_CLICK` on its own `Cancel`, and `WM_COMMAND`
`IDCANCEL` were each sent, each left it open — what a disabled window does with messages. It opens no account until one
of its step buttons is pressed, so it is inert where it stands; its `Cancel` works again once the login dialog closes,
and `File > Open an Account` reaches it afterwards.

One automation fault is recorded because the guard rails are part of the evidence: a helper function took an inserted
block inside its body, so a session-1 runner looped its close attempts from `21:09:53Z` to `21:12:53Z`. Only
`Cancel`-family messages were in that loop — no OK, no step button — and the looping process (`pid 5128`) was stopped at
`21:13Z`. Dialog state before and after is identical.

State after, read in session 1 at `21:15:55Z`: `pid=596`, started `20:14:44Z`, one `#32770` `Login` enabled on top and
one `Open an Account` disabled behind it; `foreground_hwnd=0` because no RDP session is attached, so the dialog is
already on session 1's desktop and is what the owner sees on connecting. `config\accounts.dat` absent,
`lane-ftmo3-identity.json` absent, tasks named `ftmo3` zero, `LiveTrading*` still 8, lane 1
`at_utc 21:11:30.014Z armed=true nothing_to_place`, lane 2 `at_utc 21:11:31.693Z armed=true nothing_to_place`.

### The account details, and the two fields filled for the owner

The owner sent the account's login, server and both passwords through the chat on `21:19Z`, with the intent stated
plainly: *they* paste the trading password themselves, from the Client Area's `Copy` button, because that page's copy
blob carries `svg` markup alongside the text and the password field itself is the only clean source. So the terminal got
the two fields that are not secrets, and the password field is left empty. Nothing from that message was written to
disk, to a log, or into the terminal, and the login is logged masked as `***584` throughout, the way lane 2's is.

What was filled in, in session 1, and read back through `WM_GETTEXT` rather than `GetWindowText`:

| field | before | after | proof |
| --- | --- | --- | --- |
| `Login:` (`10137`, edit `1001`) | empty | `***584`, 9 chars | read back exact at `21:25:56Z` |
| `Server:` (`10139`, edit `1001`) | `FTMO-Demo` (`cursel 0`) | `FTMO-Server3` (`cursel 3` of 6) | combo list read live, then the edit read back exact |
| `Password:` (`10138`) | empty, `len=0` | empty, `len=0` | `WM_GETTEXTLENGTH` before and after |
| `Save password for quick login` (`10140`) | `BM_GETCHECK=1` | left at `1` | owner's decision, see below |

The dialog's server list is worth having in the record, because it settles the open question in the earlier hand-off:
`FTMO-Demo`, `FTMO-Server`, `FTMO-Server2`, `FTMO-Server3`, `FTMO-Server4`, `FTMO-Server5` — six, already present in the
fresh install, so no server-list download and no `Find your company` step is needed. `FTMO-Server3` is index 3.

Three delivery paths were tried, and the failures are the useful part. `WM_SETTEXT` to the combo is swallowed and leaves
the field empty; `WM_CHAR` to the combo's `Edit` child is also ignored; `WM_CHAR` to the **combo** inserts the characters.
Reading is the mirror of it: `GetWindowText` returns empty for a control in another process — which made a filled field
look empty and cost two runs — and `WM_GETTEXT`/`WM_GETTEXTLENGTH` return the truth. The first nine-digit login typed
this way was already in the field at `21:23:32Z` (`before_login_len=9`); the field was cleared and retyped once so the
value, not the count, was verified.

The `Save password for quick login` box is **already ticked in this build**, so pressing OK as things stand stores the
master password in the terminal's own data folder. It was left as the dialog presented it, because that is a security
choice about a live trading account rather than an automation detail; lane 2's runbook took the same box for its
read-only login, and the lane-3 startup task assumes the terminal can log itself back in after a reboot.

Readiness for the steps after the login, so none of them is written while the owner is watching the dialog:

- `write-identity-lane3.py` is on the host at `C:\live-trading\state\`, a lane-3 copy of the writer that produced lane
  2's file: it refuses to write anything unless the masked login ends in `584`, the server is `FTMO-Server3` and the
  terminal path contains `MT5 Terminal 3`, then writes only `login`, `server`, `terminal_path`.
- `C:\Program Files\Python313\python.exe` imports `MetaTrader5` (Python 3.13.7), the same interpreter lane 2 uses.
- Nothing else moved: `LiveTrading*` still 8 tasks with no `ftmo3` task, no `accounts.dat`, no lane-3 identity file,
  all three terminals up (`596` lane 3, `1592` lane 1, `4540` lane 2), session 1 `Disc` with no RDP attached.

## 10. The login, the gate and the connection test, 21:38Z-21:52Z

The owner asked, at `21:36Z`, for the login to be finished from here instead of by hand, because the RDP desktop showed
the dialog with a caret over the password box and keystrokes were not reaching it. Everything below ran from the same
key-only ssh door through the session-1 runner; the dialog was never re-opened or re-filled.

### The password, and what was and was not written down

The password was typed into the dialog's own `Password:` edit (`10138`) and read back as a length only: `11` before OK,
equal to the value the owner supplied, never echoed and never compared as text in a script that writes a log. The route
that worked belongs beside §9's table: **`WM_SETTEXT` to the plain `Edit` is accepted where the same call to the login
*combo* was swallowed** - the combo needs `WM_CHAR` to the combo itself, and its child edit needs neither. `OK`
(`id 1`) was pressed with `BM_CLICK` after `WM_NEXTDLGCTL` put focus back on the button, and the dialog was gone within
two seconds.

The staging script that carried the password existed on the host for the length of that run and was deleted at `21:51Z`
(`login_script_present=False` in the closing read). No log, no journal and no document received it, and the login is
masked as `***584` throughout, as lane 2's is.

| field | before OK | proof |
| --- | --- | --- |
| `Password:` (`10138`) | `len=11` | `WM_GETTEXTLENGTH`; the value was never read |
| `Login:` (`10137`, edit `1001`) | `***584` | read back exact in §9, untouched here |
| `Server:` (`10139`) | `cursel 3` = `FTMO-Server3` | the combo's own `CB_GETCURSEL`, unchanged |
| `Save password for quick login` (`10140`) | ticked, as this build presents it | `config\accounts.dat` exists afterwards, 7,101 bytes |

The title bar at `21:39:31Z` reads `***584 - FTMO-Server3 - Hedge - FTMO Global Markets Ltd`. Two facts follow from it:
the account is **hedging**, where lanes 1 and 2 are netting, and the terminal is logged in on the right server without a
second attempt.


### The probe, the identity and the gate

| | value |
| --- | --- |
| account probe, `21:41:40Z` | `ok: true`, `***584`, `FTMO-Server3`, `USD`, leverage `30`, balance and equity `10,000.00`, `trade_allowed: true`, `trade_expert: true`, 0 positions / 0 orders, build `6320`, terminal path `... MT5 Terminal 3` |
| symbols, before selection | `EURUSD` visible; `XAUUSD`, `US100.cash`, `BTCUSD` present but not visible, so `tradable: false` and no tick |
| symbols, after `symbol_select` | all four at `volume_min` `0.01`, `volume_step` `0.01`; `volume_max` `50.0` / `100.0` / `1000.0` / `5.0`; `trade_stops_level` `0` |
| identity file, `21:43:43Z` | written by `write-identity-lane3.py` after its three refusals passed; `login_masked ***584`, server, terminal path; ACL `NT AUTHORITY\SYSTEM` and `BUILTIN\Administrators` full control, inheritance removed |
| order tool `status`, `21:44:23Z` | `IDENTITY ***584 on FTMO-Server3 at C:\Program Files\...MT5 Terminal 3`, `0 position(s), 0 pending order(s)` - the gate agrees with the file |
| the size the send path resolves | `resolve_volume`, called on the tool's own module for each of the four: `0.01` on the way in and `0.01` on the way out, exactly `volume_min` in all eight answers |

The identity file names the install **folder**, not `terminal64.exe`, which is what lane 2's file holds and what the gate
compares (`terminal.path` in the tool's read-back is the folder). §4's wording about a path ending in `terminal64.exe`
describes a hand-written file; this one is derived from the terminal, so it cannot disagree with it.

### The registration, and the one thing that had to be passed by name

`-Show` first, at `21:46Z`: `rule = blind: two watched lines, no Layer 1 call`, `max_per_day = unlimited`,
`armed = false`, and a `loop_command` carrying `--lane "ftmo-3" --magic 20261006 --expect-identity
"...lane-ftmo3-identity.json" --blind --max-per-day unlimited --terminal "...MT5 Terminal 3"` with no `--confirm-live`.

The registration itself failed once, and the reason is a property of the reviewed script rather than of this host:
it defaults `-HiddenRunner` to `C:\Users\A17\...\run-hidden.vbs`, a path from the owner's own PC. That file is absent
here, `Get-LauncherPair` writes its *hidden runner is absent* sentence into the output stream ahead of the pair it
returns, and the caller's two-variable assignment then hands `New-ScheduledTaskAction` an array: `Cannot process
argument transformation on parameter 'Argument'`. Nothing was registered by that attempt. Lanes 1 and 2 carry
`wscript.exe "C:\Users\Administrator\.trading-agent-dashboard\scripts\run-hidden.vbs" "cmd.exe /c ..."`, so the same
file was passed explicitly with `-HiddenRunner` and the registration went through at `21:46:54Z`: `task_state = Ready`,
then `Disable-ScheduledTask`, final state **Disabled**, action `wscript.exe "...\run-hidden.vbs" "cmd.exe /c
C:\ftmo3\tmp\live-trading-trader-run.cmd"`, and the wrapper holds no `--confirm-live`. The eight `LiveTrading*` tasks
were not touched; `ftmo3` tasks before this run: zero, after: one.


### The connection test, and its numbers

Run by hand with the task disabled, so no rule could place anything: one protected market buy at BTCUSD's `volume_min`,
labelled `tech-conn-test-ftmo3`, magic `20261006`, stop `500.00` below the ask (about `0.8%`, `$5.00` of risk at
`0.01 BTC`).

| | value |
| --- | --- |
| ask at planning, `21:47:34Z` | `64,508.85`; stop set at `64,008.85` |
| request | `open --symbol BTCUSD --side buy --lots 0.01 --stop-loss 64008.85 --comment tech-conn-test-ftmo3 --magic 20261006 --expect-identity ... --confirm-live` |
| answer | `TRADE_RETCODE_DONE` on the first attempt; position **200523930**, entry deal `187289937` |
| fill | `64,493.98`, `0.01` lot, notional `$644.86`, commission `-0.21`, on the request's own price |
| the stop as held | `64,008.85` on the position, so the ticket was protected for its whole life |
| close | `TRADE_RETCODE_DONE`, deal `187290047`, price `64,568.15`, profit `+0.74`, commission `-0.21` |
| holding time | `151 s` (server clock `23:47:35` to `23:50:06`): the `120 s` timer plus the `31 s` the refused first close cost |
| net | **`+0.32 USD`**, balance `10,000.00` to `10,000.32` |
| left behind | `0` positions, `0` pending orders; magic `20261006` positions `0`, orders `0` |

The first close at `21:49:36Z` was **refused, and nothing was sent**: `close` defaults `--magic` to the tool's own
`20261004`, so the run asked the tool to close a ticket it did not think it had placed - `refused: ticket 200523930
carries magic 20261006, not this lane's 20261004`. That is the ownership guard doing its job on a caller's mistake, not a
broker answer; re-issued with `--magic 20261006` it closed on the first attempt. Lane 3's own wrapper always passes
`--magic 20261006`, so the loop cannot hit this.

One clock fact to carry: the terminal's own records stamp `21:47:35Z`, the server stamps the same fill `23:47:35Z`. The
server runs `+2 h` against the terminal's UTC, so a history window measured in local UTC time misses fresh deals - the
first read-back returned none for exactly that reason, and the widened window returned both.

### Closing state, read at `21:51Z`

- lane-3 task `LiveTradingTraderTick-ftmo3`: **Disabled**, armed `false`; the other `LiveTrading*` tasks are in the state
  §9 recorded (`LiveTradingLane-ftmo1` and `LiveTradingTraderTick-ftmo2` `Running`, the rest `Ready`);
- lane 1 heartbeat `21:51:30.011Z`, `armed=true`; lane 2 `21:51:31.460Z`, `armed=true` - both still trading, both untouched;
- terminals up: lane 3 `596` (started `20:14:44Z`), lane 2 `4540` (started `2026-11-09T21:11:58Z`), lane 1 `5628`
  **started `21:37:17Z`** - lane 1's terminal restarted on its own about two minutes before this login run, before any
  lane-3 step and with no lane-3 process pointed at it, and its heartbeat has been continuous since; recorded because a
  changed pid on a running lane should never appear unexplained in a later diff;
- `config\accounts.dat` present in lane 3's data folder, so the quick-login box took the password and the terminal can log
  itself back in after a reboot;
- the password staging script removed from the host.

The lane is **still unarmed**: no `enabled: true` for `ftmo-3` in `config/live-trading-lanes.json`, and
`data/live-trading.blind.json` has not been produced. Arming is the owner's next act, and §8 says what it consists of.


