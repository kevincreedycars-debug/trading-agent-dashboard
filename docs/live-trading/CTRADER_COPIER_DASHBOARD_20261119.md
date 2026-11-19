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
| `ctrader-copier-dashboard` | every 10 minutes | `copier-dashboard.ps1`: snapshot, build, publish (publisher's own gate allows a publish every 20 minutes) |

Both run as `Administrator` with `LogonType Interactive` and `RunLevel Highest`, copied from the relay's existing
tasks because that account's DPAPI store holds the cTrader vault. `MultipleInstances = IgnoreNew` means a slow
poll is superseded rather than stacked, and the copier's own lock file is the second guard. A lock left by a dead
pid is taken over on the next run; the mapping store, not the lock, is the dedupe key. The poll interval is 60s
because Task Scheduler's floor is one minute: a source fill becomes a copy, and a source exit a close, within one
poll plus the probe and connection time (about 4s observed), so the destination lags the source by a minute at
worst and never waits for a hand. The 15s in-process loop remains available by hand but is not the scheduled mode.

The document is published every 20 minutes (`--min-interval-seconds 1200`) rather than every poll: the lanes
publisher already spends publishes on the same Pages site, and three builds an hour from here keeps the total
inside GitHub's documented soft limit. The tab states both cadences, and its stale window (30 minutes) is set
against the publish cadence while the heartbeat allowance (25 minutes) is set against it too — a heartbeat is
current as of the publish that carried it.

## Evidence collected on 19 November 2026

- First copies (20:11Z): source XAUUSD `309101669` -> cTrader `62272218` (0.01 sell, entry 3667.25, stop 3704.29)
  and EURUSD `309180633` -> `62272219` (0.01 sell, entry 1.09756, stop 1.09865). Mapping rows written, `pending`
  empty.
- The scheduled script run by hand at 21:05:46Z read 2 source positions, sent nothing (both already copied), wrote
  `status=ok`, `source.rows=2`, and released its lock.
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
fixtures), `not_sent` (no such path by design) and `awaiting_live_proof`. Copying, size conversion and the stop at
entry are broker-observed. Amendments, cancellation of a resting source order and partial closes are `not_sent`:
the copier does not amend, does not mirror resting orders and does not close partially; a source partial close
leaves the destination at its copied size and that difference stays visible rather than being papered over.

**The full close after a natural source exit remains unproved.** The close path is tested through the adapter
(symbol-aware volume scale, from the regression above), but no copier close has yet been observed on the broker.
It is kept `awaiting_live_proof` until a natural source exit produces a broker-confirmed close; no trade is forced
to produce one.

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

