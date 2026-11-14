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
| terminal | `C:\Program Files\FTMO Global Markets MT5 Terminal` | `C:\Program Files\FTMO Global Markets MT5 Terminal 2` | `C:\Program Files\FTMO Global Markets MT5 Terminal 3` — **not installed** |
| MT5 data folder | `%APPDATA%\MetaQuotes\Terminal\81A933A9AFC5DE3C23B15CAB19C63850` | `…\8A052B160E5CE0B13984FF3CD196FEFE` | none yet; its `origin.txt` must name the `… Terminal 3` install |
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

In the order the host needs them:

1. **The third FTMO account.** The login, server and passwords come from FTMO's own confirmation; nothing before this
   step can be finished.
2. **The terminal install on the RDP desktop**, with the destination field reading `… MT5 Terminal 3` (§3).
3. **The identity file**, written by hand from the login (§4).
4. **The account probe** (`live-trading-account-probe.py`) and the tool's `status` against the new identity — read-only,
   and the proof that the gate holds before anything is registered.
5. **The registration, unarmed, then disabled**, then the two-minute BTCUSD connection test, then the report, then —
   only after the owner has read it — arming.

Steps 1 and 2 are the owner's; 3 onwards is where an agent can act again.
