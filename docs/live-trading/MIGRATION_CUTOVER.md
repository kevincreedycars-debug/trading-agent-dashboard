# Moving a lane from the PC to the always-on host

This is the copy, the restore and the order to do them in. It is written to be followed at the terminal with the
PC trader running, because the moment that matters is the one where the PC stops and the host starts: two hosts
holding the same lane is the failure a file lock cannot prevent, and only a person can confirm the old one is
off.

## What is in the bundle, and what it is for

`scripts/prepare-live-trading-migration.js` writes one directory per lane. Its contents are the lane's memory
rather than the repository's: the repository can be cloned, but what the loop has already done cannot.

| file in the bundle | where it comes from | why it travels |
| --- | --- | --- |
| `state/live-trading-trader-state.json` | `tmp/live-trading-trader-state.json` | every ticket, put-back, cancel, close and stop move this lane has made; without it the host would re-enter trades the PC already placed |
| `journal/live-trading-orders.log` | `tmp/live-trading-orders.log` | one line per send and per read, the account's own record of what was asked of the terminal |
| `log/live-trading-trader.log` | `tmp/live-trading-trader.log` | the append-only run log, so the host's history starts where the PC's ends |
| `heartbeat/live-trading-trader-status.json` | the lane's `trader_status` file | the last thing a loop said about itself. **Historical evidence only** |
| `config/live-trading-trader-run.cmd` | `tmp/live-trading-trader-run.cmd` | the effective command line: the flags that decide whether the loop may place |
| `config/live-trading-lanes.json` | `config/live-trading-lanes.json` | the account identity the publisher holds this lane to |
| `publish/live-trading-publish-state.json` | the lanes file's `publish.state` | the publisher's clock, so a restored host does not treat its first tick as overdue |

`MANIFEST.json` records each file's bytes, SHA-256 and modification time, the checkout and commit it came from,
whether that working tree was dirty, the restore order, and a `heartbeat` block that says in words that the
copied heartbeat is history. `SHA256SUMS` is the same hashes in the portable form. No credential is in the
bundle: the MT5 login lives in the terminal's own profile and is typed on the host, and the script refuses to
copy any file whose bytes match a password, token or key pattern rather than redacting it.

The account's snapshot (`data/live-trading.json`) is **not** copied. It is described in the manifest by hash and
`generated_at_utc`, and the host's own producer replaces it: restoring an old snapshot would hand the loop bars
from another machine.

## The provisional bundle

Prepared 2026-10-25 from the PC's checkout (`workers/live-trading-20260929`) to
`.local/live-trading-migration/ftmo-1`, beside the checkout it was read from and git-ignored. It is provisional
by design: the PC keeps writing state and journal while it trades, so the copy taken at cutover is the one that
counts. Re-running into a directory that already holds a bundle is refused unless `--force` says the earlier one
is being replaced.

The copy present now (rebuild at 2026-10-25T21:12:44Z) holds **7 files, 0 missing**, made on `DESKTOP-UD0L47I`
from commit `4a88076e` with a dirty tree, with `state/live-trading-trader-state.json` at
`fea1d9fbd21caa30d90c73498884354f2e5ebf60fa98c17eba55ae170b2a7b14` (29,490 bytes). Its heartbeat is the
21:11:34.688Z run on that host - labelled historical in the manifest, because the loop that wrote it has already
exited. `--verify` passes on it.

```
node scripts/prepare-live-trading-migration.js --lane ftmo-1 --checkout <checkout> [--dry-run]
node scripts/prepare-live-trading-migration.js --verify <bundle-dir>
```

`--verify` re-hashes every file, re-reads `SHA256SUMS`, refuses any file the manifest does not name, and
re-scans for credentials. It exits 1 on the first problem and names the file.

## What is tested, and what is not

Tested on the PC, in `tests/live_trading_migration_bundle.test.js`:

- a bundle with all seven files writes, hashes and verifies; `--dry-run` writes nothing;
- a lane with no state is refused; a missing optional file is recorded rather than fatal;
- a planted password refuses the bundle and writes nothing;
- one changed byte, one extra file, or a manifest claiming `credentials.included: true` fails `--verify`;
- the copied heartbeat is labelled historical and keeps the host it was written on;
- a second run into the same directory is refused without `--force`, and a directory that is not a bundle is
  never written into.

Not tested, and not claimed: that a restore produces a loop that trades correctly on the host. That is proved by
the host's first ticks and the read-back below, not by a hash.

## At cutover, in this order

The order is the safety property. Step 1 before step 2 makes the copy final; step 2 before step 5 makes the
restore trustworthy; step 7 is what makes step 8 safe.

1. **Stop the PC trader.** `Unregister-ScheduledTask -TaskName LiveTradingTraderTick019` (or
   `scripts/register-live-trading-trader-task.ps1 -Remove`), then confirm no `run-live-trading-trader.js` process
   is alive (`Get-CimInstance Win32_Process | Where-Object CommandLine -match 'run-live-trading-trader'`) and that
   the terminal's pending orders and positions are what they were before. A task that is disabled but still
   running is not stopped.
2. **Take the final copy** with the command above into a fresh directory, then `--verify` it on the PC. Record
   the manifest's `generated_at_utc`, the file count, and the state file's hash in the handoff.
3. **Reconcile the broker** before restoring anything: positions, pending orders, and the last day of deal
   history, read on the PC's terminal. The state file and the account must agree. A ticket on the account that
   the state does not know is a manual decision, not a restore step.
4. **Install the host** as `VPS_BUILD_RUNBOOK.md` says: Windows **Desktop Experience** (Server Core cannot run
   MT5), one terminal per lane, logged in by hand, Startup shortcut, **Algo Trading off** until step 8, and three
   `-Test` runs of the registration script (which now runs unarmed and against its own files).
5. **Restore the lane's files** in the manifest's `restore_order`, keeping the host's own paths from the lanes
   file. Copy the state and journal; do not copy the PC's heartbeat over one the host has written.
6. **Read back the effective configuration** and compare it with the PC's:
   `scripts/export-live-trading-effective-config.ps1 -Out <host>.json`, then `-Compare <pc>.json`. Behaviour
   fields - arming, `max_open`, `max_per_day`, `expire_minutes`, `settle_seconds`, alignment, lane, account
   identity - must match. Paths that moved are reported as `path_relocated` and need `-AllowRelocatedPaths` once
   the move is intended. Any behaviour difference is resolved, not defaulted.
7. **Confirm the PC cannot restart its trader by itself**: no scheduled task, no Startup shortcut that starts the
   loop, no terminal set to launch it, and the hidden launcher not registered as a service. Reboot the PC with
   nobody logged in and check no `run-live-trading-trader.js` exists afterwards.
8. **Arm only the host**, and only after step 7: register the host's task with `-Arm`, run one tick, and verify a
   **newly generated** heartbeat - a `written_at_utc` after the registration, the host's own computer name in
   `host.computer`, and `armed: true` in the same record. The page's account card must show the same host and a
   fresh heartbeat. A copied heartbeat is not this check.
9. **Move publishing last.** Remove the PC's `LiveTradingPublishLanes019` task before registering the host's, so
   one publisher exists at a time. The publisher's lock is per checkout, so it cannot arbitrate between hosts.
10. **Roll back** if any step fails after step 8: unregister the host's trader task, confirm the host's process
    exited, re-register the PC's task unarmed, restore the PC's state and journal from the bundle taken at step 2
    (verify first), then arm the PC. Publishing moves back in the mirror order: PC first, then remove the host's.

## Why a local lock is not enough

The trader's lock file stops two loops sharing **one** checkout. Two hosts run two checkout trees with two lock
files, two state files and two terminals, and neither one sees the other. Only step 7 makes step 8 safe, and "the
task on the PC is disabled" is a claim to check with `Get-ScheduledTask` and a process list, not a memory of
having done it.

## What the account card shows after the move

`data/live-trading-lanes.json` and `data/live-trading-trader.<lane>.json` are published in one commit by the one
publisher. Each card draws the lane state, the arming, the last heartbeat and its age, the last result, the
snapshot age and the trader host. A heartbeat older than three ticks is drawn as **stale**, with a sentence above
the rows saying the armed record is history - so an old `armed: true` cannot read as a healthy loop.

## What has to be true at the end

- one trader host, proved by the PC's reboot check and the host's own fresh heartbeat;
- one publisher, proved by which task is registered and by one commit per ten minutes;
- the host's effective configuration compared with the PC's, with every difference named and resolved;
- the state file the host loaded hashed and recorded in the handoff, with the bundle it came from kept until the
  first full trading day on the host has passed.

