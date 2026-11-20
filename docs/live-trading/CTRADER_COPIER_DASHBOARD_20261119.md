# Live cTrader Copier tab and scheduled copier, 19 November 2026

## What was built

A dashboard tab named **Live cTrader Copier**, under the rail's **Live** group beside **Live Trading**, at
`index.html#live-ctrader-copier` on the published site
(`https://kevincreedycars-debug.github.io/trading-agent-dashboard/index.html`). It describes a copier that follows
FTMO-1's accepted orders onto cTrader login 7348195 (demo account 42585819); it generates no signal, holds no
broker connection and cannot trade. FTMO-1, FTMO-2 and FTMO-3 keep their own tabs and files.

The tab draws one document, `data/live-ctrader-copier.json`, produced on the trading host from:

- the copier's health file (`health.json`), which now also carries the source tickets its last poll read;
- the copier's mapping store (`mappings.json`), which now keeps a bounded `history` of closed copies;
- one read-only snapshot of the cTrader account (`snapshot.json`, written by `ctrader/copier/live-copier-snapshot.js`
  through the relay's own adapter and transport helpers).

Nothing on the page derives a size from a lot number alone. Each mapping row states three numbers: the lots the
copier sent, the protocol units cTrader carries, and the asset units themselves.

## The schedule

Two Windows tasks on the trading host, registered by `ctrader/copier/register-copier-tasks.ps1`:

| Task | Cadence | Action |
| --- | --- | --- |
| `ctrader-copier-poll` | every 1 minute | `copier-poll.ps1`: one `--once` copier poll with `--symbols` |
| `ctrader-copier-dashboard` | every 10 minutes | `copier-dashboard.ps1`: snapshot, build, publish (the publisher's own gate is the same 10 minutes) |

Both run as `Administrator` with `LogonType Interactive` and `RunLevel Highest`, copied from the relay's existing
tasks because that account's DPAPI store holds the cTrader vault. `MultipleInstances = IgnoreNew` means a slow
poll is superseded rather than stacked, and the copier's own lock file is the second guard. A lock left by a dead
pid is taken over on the next run; the mapping store, not the lock, is the dedupe key. The poll interval is 60s
because Task Scheduler's floor is one minute: a source fill becomes a copy, and a source exit a close, within one
poll plus the probe and connection time (about 4s observed), so the destination lags the source by a minute at
worst and never waits for a hand. The 15s in-process loop remains available by hand but is not the scheduled mode.

The document is published every 10 minutes (`--min-interval-seconds 600`), the cadence the dashboard task already
runs on, so a run that has a new read publishes rather than waiting for every other one; a run with nothing new is
refused by the engine's strictly-newer gate instead of republishing the same bytes. Six builds an hour from this
file sits inside GitHub's documented soft limit of ten an hour for a branch-built site, and the lanes publisher
shares that site while spending publishes of its own only when its files change. The gate was 1200s until
`copier-dashboard.ps1` was changed on 20 November 2026. The tab states both cadences, and its stale window (30
minutes) and heartbeat allowance (25 minutes) are unchanged by that: at a 10-minute publish they mean three missed
publishes and two and a half, and a heartbeat is current as of the publish that carried it.

## Evidence collected on 19 November 2026

- First copies (20:11Z): source XAUUSD `309101669` -> cTrader `62272218` (0.01 sell, entry 3667.25, stop 3704.29)
  and EURUSD `309180633` -> `62272219` (0.01 sell, entry 1.09756, stop 1.09865). Mapping rows written, `pending`
  empty.
- The scheduled script run by hand at 21:05:46Z read 2 source positions, sent nothing (both already copied), wrote
  `status=ok`, `source.rows=2`, and released its lock.
- Scheduled mode, observed: `ctrader-copier-poll` ran every minute from 21:43 to 21:48 with exit 0, health
  `status=ok`, one source position, and no lock left behind. `ctrader-copier-dashboard` ran at 21:50:18 with result
  0: snapshot, build and a publish correctly held back by the 20-minute cadence ("too_soon ... inside the 1200s
  cadence"). Its first run at 21:47 failed before doing anything because both tasks shared one redirect file; each
  task now appends to its own `*.task.out.txt`.
- The first natural source exit: XAUUSD `309101669` gone at ~21:39Z; the copier closed `62272218` at 3626.39 on
  2026-11-19T21:42:26.546Z, net +40.77 USD, and the mapping moved to history. Published to main as
  `bb0e839a`; the live page shows "Full close after a source exit — Broker observed".
- The FX-volume close regression was run through the deployed adapter with the real contracts:
  `EURUSD 0.01 lot -> 100,000 protocol units`, `XAUUSD 0.01 -> 100`, `BTCUSD 0.01 -> 1`,
  `US100.cash 0.01 -> 1`. All accepted; exit 0.
- The cTrader account lists the index as `US100.cash` (symbolId 335), so the deployed symbols file maps it by name.
  It holds 1 unit per lot and 100 protocol units per lot, step 0.01.
- The account read at 21:03:59Z: balance 23654.16 USD, equity 23662.67 USD (marked: balance plus the two open
  positions at the broker's reference prices), 2 open positions, 0 working orders, 11 closed positions in the
  30-day window — 2 of them standalone setup tests commented `btc-test-120s`, 9 closes from before the copier's
  first copy. No missing copies, no orphaned mappings, no unresolved sends.
- The tab passed two browser tests: the full desktop render and a 390x844 phone layout with no page-wide
  horizontal scroll (the wide tables scroll inside their own boxes).

## What the verification matrix says, and what it does not

The matrix separates `broker_observed` (the broker answered), `tested` (exercised through the adapter on
fixtures), `not_sent` (no such path by design) and `awaiting_live_proof`. The copy, size and stop rows are read from
the account rather than declared: they say `broker_observed` while a copy is open with its ticket and size quoted,
and fall back to `awaiting_live_proof` or `tested` when nothing is open. The full close after a source exit has been
`broker_observed` since 21:42:26Z, from its closed mapping and the account's own deal. Amendments, resting source
orders, their cancellation and partial closes read `tested` since 20 November 2026: the copier has all of those
paths and the adapter suite exercises them, but no source has done any of them on this account yet, so none is
claimed as observed. See `docs/live-trading/CTRADER_COPIER_LIFECYCLE_20261120.md` for what each path now does and
for the observation gaps that remain.

**The full close is now proved live, not just on fixtures.** The XAUUSD source ticket `309101669` exited
naturally at about 21:39Z; the copier closed cTrader `62272218` at `3626.39` on `2026-11-19T21:42:26.546Z` for a
net `+40.77 USD`, moved the mapping to the store's history, and the next broker read showed one open copy
(EURUSD) and no orphaned mapping. That first natural exit also found a real defect: the copier asked the adapter
to close without a volume, the transport refused an undefined size, and the copy stayed open for three polls. The
copier now states the size it opened, and the adapter treats a close with no volume as "all of it" by reading the
position's own volume; a position whose volume cannot be read is refused rather than sent. Both paths have tests.

## What the next publication showed

The 09:10:54Z document could not vouch for the deployed build: it was built before the first poll on the new copier.
The publication after it, `0ec6a041` at `2026-11-20T09:50:22.020Z`, does. It carries `copier-20261120.1`, and its
heartbeat is the 09:49:22.469Z poll - 60s old at build time, `state: ok` - with the source read at 09:49:22.410833Z
and no orders in it. Nothing had been sent, refused or closed by then.

Two facts worth keeping from that run:

- Publishes landed at 09:00:21, 09:10:54, 09:30:21 and 09:50:22 - every twenty minutes, not every ten. The gate is
  strict (`now - lastPublished < 600s` refuses), the task fires every ten minutes, and the poll's own offset puts the
  09:20 run about 565s after the 09:10 publish, so it is refused and the next one carries both intervals. The change
  moved the effective cadence from thirty minutes to twenty; six an hour is the ceiling the gate now allows, not the
  rate this task reaches.
- The published health block is the fixed projection written on 19 November: status, start and finish, polls, source,
  destination, reconcile, refusals, actions, closes, notes. The new `stops`, `pending_orders`, `order_checks` and
  `reconcile_orders` blocks are in `health.json` on the host and do not reach the document, so the tab cannot yet show
  a resting-order copy, an amend, a cancel or a partial close even when one happens. The matrix rows stay `tested`
  until the broker's own answer is visible in a read, which is the honest order of events.

No artificial order was placed to exercise those paths. Copying stays live and untouched; the account was flat at
09:53:22Z, with the poll `ok` and nothing in any of its action lists.

## Deployed on 20 November 2026

The lifecycle code went to the host over the key-only SSH door (`Administrator@158.220.87.240`), with the previous
files kept in `C:\ProgramData\ctrader-relay\backup-20261120\` first: `CTRADER_TRANSPORT_20261114.js` (993 lines, was
782), `CTRADER_ADAPTER_20261114.js` (935, was 691), `CTRADER_COPIER_20261119.js` (1847, was 984),
`live-trading-positions-probe.py` (165, was 155), `copier/copier-dashboard.ps1` (600s gate),
`copier-tools/lib/live_ctrader_copier.js` and `copier-tools/scripts/publish-ctrader-copier.js`. Each copied file's
SHA-256 was read back on the host and matches this repository's copy. `mappings.json` was not touched.

- `ctrader-copier-poll` was disabled for the swap and re-enabled after it. The first poll on the new code,
  09:10:23Z, printed `copier copier-20261120.1: poll 60s, LIVE sends` and `poll 1: ok source 0 position(s) open 0
  close 0 refused 0` - the FTMO account is flat, so nothing was copied and nothing was sent.
- `ctrader-copier-dashboard` at 09:10:52Z: snapshot (0 positions, 0 orders, 26 deals, balance 23693.99), build
  (2 mappings, 13 closed trades, heartbeat ok), publish `published` with `min_interval_seconds: 600` - the first run
  on the new gate - as `cbf177f4`, `82711848..cbf177f4 HEAD -> main`.
- The published `data/live-ctrader-copier.json` (09:10:54Z) carries the new rows: "Copying a resting source order",
  "Amending a stop or target after the copy", "Cancelling a resting source order" and "Partial close on the source"
  all read `tested`; "Full close after a source exit" reads `broker_observed`; with no copy open, "Copying a filled
  FTMO-1 position" reads `awaiting_live_proof` and size and stop read `tested`.
- The repository side was merged first (PR #16, `82711848`), so the publish checkout's `script.js` and `index.html`
  are the new wording and the moved asset version (`20261120-live-ctrader-copier-lifecycle`).

## Files

- `lib/live_ctrader_copier.js` — the data surface: conversions, deal pairing, attribution (copy / setup test /
  before the copier / unattributed), mapping rows, differences, verification, heartbeat, document builder.
- `scripts/validate_live_ctrader_copier.js` — the publish gate.
- `scripts/build-live-ctrader-copier.js` — reads the three inputs and writes the document atomically.
- `scripts/publish-ctrader-copier.js` — the live feed's own publisher engine with this document's validator.
- `ctrader/copier/live-copier-snapshot.js` — the read-only account snapshot.
- `ctrader/copier/fx-close-regression.js` — the close-path regression through the deployed adapter.
- `ctrader/copier/copier-poll.ps1`, `copier-dashboard.ps1`, `register-copier-tasks.ps1`, `symbols.json` — the
  scheduled mode and the source-to-destination map.
- `tests/live_ctrader_copier.test.js`, `tests/live_ctrader_copier.browser.test.js` — conversion, attribution,
  differences, verification, builder/validator, and the two browser renders.

## Operating notes

- Stop the copier by creating `C:\ProgramData\ctrader-relay\copier\STOP`; the next poll writes `status=killed` and
  sends nothing. Remove the file to resume.
- The copier's own log is `poll.log` (last 2000 lines) and `poll.out.txt` (the last poll's full output);
  `dashboard.out.txt` holds the last snapshot/build/publish run.
- The published state and publisher lock live beside the state file in
  `C:\ProgramData\ctrader-relay\copier\publish-state.json`.

## The two follow-ups, done on 20 November

The 09:50Z publication was vouchable but incomplete: the lifecycle blocks stayed on the host and the gate published
every twenty minutes. Both were fixed on the same day, deployed to the host, and checked against real publications
rather than a local run.

**What the document carries now.** `lib/live_ctrader_copier.js` keeps `stops`, `pending_orders.{placed,amended,cancelled,checked}`,
`order_checks` and `reconcile_orders` whole in `copier.health` instead of reducing them to counts, and each mapping row
carries `order_kind`, `target_order_id`, `sltp_utc` and `last_partial_utc` so an accepted lifecycle answer outlives
the poll that carried it. The verification matrix promotes a path to `broker_observed` only from a row whose
`outcome` is `accepted`, or from one of those stored records; a planned row, a dry run, a refusal, or a counter is not
an answer. The tab draws a new "Lifecycle actions in the last poll" table (what, ticket, instrument, outcome, the
broker's answer) plus chips for the four blocks, and its verification caption no longer claims the copier has no
amendment, cancel or partial-close path.

**What the source had actually done.** Between the 09:10Z deploy and 13:40Z the FTMO-1 lane placed two limit orders
that the copier copied as working cTrader orders - `309462132` -> `178348935` (EURUSD, filled into `#62308557`) and
`309464502` -> `178349950` (XAUUSD, filled into `#62309024`) - and the lane's trail moved the stop on `#62308557`,
which the broker accepted at `13:17:23.525Z`. The 13:40Z publication therefore reads `broker_observed` for "Amending a
stop or target" and "Copying a resting source order", with the order ids and the accepted amendment time in the
evidence column; cancellation and partial close remain `tested`, because neither has happened.

**The gate.** `scripts/publish-ctrader-copier.js` and `copier/copier-dashboard.ps1` now use 540s. Under the old 600s
the task's next run landed 565-600s after a publish and was refused, which is why the commits before this change are
twenty minutes apart (09:30, 09:50, 10:10 ... 13:10, 13:30). The first two automatic publications on the new gate:

| commit | published at | document generated | gap from the previous publish |
| --- | --- | --- | --- |
| `032c38c2` | 13:30:27Z | 13:30:22.637Z | 1200s (old gate) |
| `b7a7cb40` | 13:40:26Z | 13:40:23.619Z | 599s |
| `096fef1a` | 13:50:27Z | 13:50:23.520Z | 601s |
| `0590de13` | 14:00:26Z | 14:00:22.950Z | 599s |
| `5e2169d9` | 14:10:24Z | 14:10:22.750Z | 598s |

Four successive automatic runs between 13:40 and 14:10, 598-601 seconds apart, each with a fresh document - the
refusal on alternating runs is gone. The publish state on the host records `min_interval_seconds: 540` from the 13:40Z run, and 13:40Z's document is
the first built with the new lib.

**Deployed, with a rollback copy.** At 13:34Z the three files were copied over the previous ones, which were kept in
`C:\ProgramData\ctrader-relay\backup-20261120b\`; the lib was copied again at 13:49Z with the order-id addition and
its previous version kept beside the backup as `live_ctrader_copier.before-target-order-id.js`. Host SHA-256 equals
the working copy for each:

| file | SHA-256 |
| --- | --- |
| `ctrader/copier/copier-dashboard.ps1` | `63a572b676e60eb8f250de42aeff2a5e8b8074bb0111b512e3225fb77b7b4402` |
| `scripts/publish-ctrader-copier.js` | `bb3b2b733f095b31eaeb3fe42728a6f024e44fd2fee63773ef0707dd10199789` |
| `lib/live_ctrader_copier.js` | `738dcaf309d0e661bab42bfd686a0c09eab7e8efeba560fa0b00a96093520dcb` |

The mapping store was not touched, the poll task was not stopped (the changed files are read only by the ten-minute
dashboard task), and no order was sent by this change: it edits the document's shape and the publisher's gate, not
the copier's send path.

**Tests.** `tests/live_ctrader_copier.test.js` (15 tests) holds the projection and the promotion rule, including the
counter-only case that must stay `tested`; `tests/live_ctrader_copier.browser.test.js` (2 tests) holds the new table
and chips in a browser; the publish-gate test now asserts 540 against the task's 600 and the Pages floor.


