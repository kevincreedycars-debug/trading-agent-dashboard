# Removing the daily entry cap from FTMO 1 and FTMO 2

Owner's instruction, 2026-11-14: *"Correct the daily cap on all three traders … There is no strategy-imposed daily entry
limit on FTMO 1, FTMO 2 or FTMO 3."* This page is the **staged, reviewed change for the two traders already running**.
Nothing in it has been applied: the live tasks are untouched, the deployed checkouts are untouched, and the commands
below are for the owner to read and approve before either lane is switched.

Status: staged in branch `live-trading/l2l-blind-20261114`. **No live task changed, no task re-registered, nothing
restarted.**

## 1. What the change is

| Layer | Before | After |
| --- | --- | --- |
| runner default (`scripts/run-live-trading-trader.js`) | `DEFAULT_MAX_PER_DAY = 4` | `null` — no cap unless a run asks for one |
| runner flag | `--max-per-day <n>` only | `--max-per-day <n>` or `unlimited`/`none`/`off`/`0` for no cap; a bad value is still a refusal |
| the gate | `used >= options.maxPerDay` | the same line, only when a number is in force (`options.maxPerDay !== null`) |
| registration (`register-live-trading-trader-task.ps1`) | `-MaxPerDay 4`, written into the task as `--max-per-day 4` | `-MaxPerDay 0` (default) writes `--max-per-day unlimited` **explicitly**, so a re-registration cannot leave the old four behind |
| run record / heartbeat | `caps.max_per_day: 4` | `caps.max_per_day: null`, plus `caps.capped: false` and `caps.entries_today` |
| page | a `null` was turned into `0` and printed as "0 a day — entries stop at the cap" | `null` reads as "no daily entry cap — N entries today" |

Why the word rather than dropping the flag: the owner asked that an unlimited configuration be **explicit and survive a
restart or a re-registration**. A missing flag is indistinguishable from a registration that predates the decision; the
word is a fact about the task that can be read back with `-Show`, `export-live-trading-effective-config.ps1` and
`Get-Content …\tmp\live-trading-trader-run.cmd`.

What is **not** in this change, deliberately: `--max-open` (still off unless a lane already carries one),
`--expire-minutes` (still none), the per-pair one-working-ticket hold, the size, the stop rungs, the 5R/3R rule, and
`--require-deviation`. The deviation rollout for the two called lanes is a separate decision and a separate switch, and
the two must not be re-registered in one step.

## 2. What was proved, and where

- `tests/live_trading_blind_lane.test.js` — "a fifth entry can be placed on the same day on every lane, with the
  earlier four spread across assets": for `ftmo-1`'s and `ftmo-2`'s settings, four placements of the day on four
  different assets (`XAUUSD`, `US100.cash`, `BTCUSD`, `GBPUSD`) and a confirmed fifth on `EURUSD` reaches `decide()`
  and comes back `place`; the same input with `maxPerDay: 4` comes back `skip` with the cap named. That is the runner's
  own decision function, not a re-implementation.
- The same file — "the runner states no daily cap by default, and every way of saying so reads as no cap": the default,
  `parseArgs` with nothing passed, all four words, and a bad value still refused.
- `tests/live_trading_trader.test.js` — the run record states `max_per_day: null` with the trade day and zone unchanged;
  the registration's `-Show` writes `max_per_day = unlimited` and `--max-per-day unlimited` on lane 1's command line.
- `tests/live_trading_lane_isolation.test.js` — the generated lane-1 wrapper carries `--max-per-day unlimited` and
  nothing else new.

These are local tests. They are evidence about the decision path, not about the live account: a fifth entry still has
to be available in the market, and the first day a lane runs uncapped is the first day the claim can be observed.

## 3. The switch, lane by lane

The deployed layout (from `LANE2_VPS_RUNBOOK.md` §1): lane 1 runs in `C:\live-trading\runtime` on
`LiveTradingTraderTick019`, lane 2 in `C:\ftmo2` on `LiveTradingTraderTick-ftmo2`, and both read the published tree at
`C:\live-trading\publisher`. **One lane at a time**, and lane 2 first: it is the smaller book and the easier rollback.

### 3a. Stage the new code into the lane's checkout (no task change yet)

```powershell
# The branch under review, fetched into the lane's own checkout. `git status --porcelain` must be empty first; the
# wrapper and the identity file are the only machine-specific files and neither is tracked.
git -C C:\ftmo2 fetch --all --prune
git -C C:\ftmo2 rev-parse HEAD                      # record the rollback point
git -C C:\ftmo2 status --porcelain

# Bring the two files the change lives in, from the reviewed branch, without touching the lanes file's local overrides:
git -C C:\ftmo2 checkout live-trading/l2l-blind-20261114 -- scripts/run-live-trading-trader.js scripts/register-live-trading-trader-task.ps1
git -C C:\ftmo2 diff --stat
git -C C:\ftmo2 hash-object scripts/run-live-trading-trader.js scripts/register-live-trading-trader-task.ps1
```

### 3b. Read the command line the new registration would write, before writing it

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\ftmo2\scripts\register-live-trading-trader-task.ps1 `
  -Show -Lane ftmo-2 -RepoRoot C:\ftmo2 -Published C:\live-trading\publisher `
  -Magic 20261005 -Grid half -RMultiple 3 -ExpectIdentity C:\live-trading\state\lane-ftmo2-identity.json `
  -MaxPerDay 0
```

Pass every flag the deployed lane already carries, plus `-MaxPerDay 0`. `-Show` writes nothing. Three lines have to be
in the output before going on: `max_per_day = unlimited (no strategy cap, owner 2026-11-14)`, and in `loop_command`
the same `--max-per-day unlimited` beside the lane's own `--magic`, `--grid half`, `--r-multiple 3`,
`--expect-identity` and `--terminal`, and **no** `--confirm-live` unless the registration being written is armed.

### 3c. Back up, register, verify

```powershell
$stamp = Get-Date -Format yyyyMMdd-HHmm
New-Item -ItemType Directory -Force -Path C:\live-trading\tmp | Out-Null
Copy-Item C:\ftmo2\tmp\live-trading-trader-run.cmd C:\live-trading\tmp\wrapper-ftmo2-$stamp.cmd -Force
Export-ScheduledTask -TaskName LiveTradingTraderTick-ftmo2 | Out-File -Encoding utf8 C:\live-trading\tmp\task-ftmo2-$stamp.xml

powershell -NoProfile -ExecutionPolicy Bypass -File C:\ftmo2\scripts\register-live-trading-trader-task.ps1 `
  -Lane ftmo-2 -RepoRoot C:\ftmo2 -Published C:\live-trading\publisher `
  -Magic 20261005 -Grid half -RMultiple 3 -ExpectIdentity C:\live-trading\state\lane-ftmo2-identity.json `
  -MaxPerDay 0 -Arm

Get-Content C:\ftmo2\tmp\live-trading-trader-run.cmd            # --max-per-day unlimited is on the line
powershell -NoProfile -ExecutionPolicy Bypass -File C:\ftmo2\scripts\export-live-trading-effective-config.ps1 `
  -RepoRoot C:\ftmo2 -Out C:\live-trading\tmp\effective-ftmo2-$stamp.json
```

Then wait for one tick and read the heartbeat the page reads:

```powershell
Start-Sleep -Seconds 360
Get-Content C:\ftmo2\tmp\live-trading-trader-status.json -Raw
```

Passing: `status` is a normal tick (`nothing_to_place`, `placed`, `planned` …), `caps.max_per_day` is `null`,
`caps.capped` is `false`, `caps.entries_today` is a number, and `account.login_masked` is still `***841`. A tick that
reports `refused` with an identity message is a rollback, not a retry.

### 3d. Lane 1, the same steps

```powershell
git -C C:\live-trading\runtime rev-parse HEAD          # rollback point
git -C C:\live-trading\runtime status --porcelain
git -C C:\live-trading\runtime checkout live-trading/l2l-blind-20261114 -- scripts/run-live-trading-trader.js scripts/register-live-trading-trader-task.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File C:\live-trading\runtime\scripts\register-live-trading-trader-task.ps1 `
  -Show -Lane ftmo-1 -RepoRoot C:\live-trading\runtime -Published C:\live-trading\publisher -MaxPerDay 0
# then the same backup, registration (-Arm), wrapper read and one-tick heartbeat read as 3c, registering with
#   -Lane ftmo-1 and -Terminal "C:\Program Files\FTMO Global Markets MT5 Terminal"
```

Lane 1's deployed wrapper also carries `--max-open 1` and `--expire-minutes 30`. Read it first —
`Get-Content C:\live-trading\runtime\tmp\live-trading-trader-run.cmd` — and copy every flag off it into the `-Show`
line, including `-MaxOpen 1 -ExpireMinutes 30`, so the re-registration does not silently drop a hand cap that is
currently in force. The `-Show` output is the comparison: it must differ from the old wrapper in the daily cap and in
nothing else.


## 4. Rollback

Rollback is one registration with the old number, and the state file is untouched either way — a cap is a gate, not a
ledger:

```powershell
# The task back to a cap of four, with every other flag exactly as before.
powershell -NoProfile -ExecutionPolicy Bypass -File C:\ftmo2\scripts\register-live-trading-trader-task.ps1 `
  -Lane ftmo-2 -RepoRoot C:\ftmo2 -Published C:\live-trading\publisher `
  -Magic 20261005 -Grid half -RMultiple 3 -ExpectIdentity C:\live-trading\state\lane-ftmo2-identity.json `
  -MaxPerDay 4 -Arm
Get-Content C:\ftmo2\tmp\live-trading-trader-run.cmd            # --max-per-day 4 is back

# Or restore the exact bytes and definition that were live before the switch:
Copy-Item C:\live-trading\tmp\wrapper-ftmo2-<stamp>.cmd C:\ftmo2\tmp\live-trading-trader-run.cmd -Force
Register-ScheduledTask -TaskName LiveTradingTraderTick-ftmo2 -Xml (Get-Content C:\live-trading\tmp\task-ftmo2-<stamp>.xml -Raw)
git -C C:\ftmo2 checkout <rollback HEAD> -- scripts/run-live-trading-trader.js scripts/register-live-trading-trader-task.ps1
```

`-MaxPerDay 4` is the way back for a lane that should keep the old count; `-MaxPerDay 0` is the way forward. A ticket
already working keeps working across either, and no placement is undone.

## 5. After the switch

- The page's Cap row reads "no daily entry cap — N entries today" for the lane, from its own heartbeat.
- The run log carries `caps.max_per_day: null` and `rule.taken_today`, so the count is still auditable per Prague day.
- The first uncapped day is the evidence that matters: a fifth entry, if the market offers one. Until it happens, the
  proof is the decision path in §2 and nothing more.
- The deviation rollout (`--require-deviation` on the two called lanes) is a **separate** registration with its own
  reviewed page; do not fold it into this switch, and do not re-register lane 1 and lane 2 in the same run.

