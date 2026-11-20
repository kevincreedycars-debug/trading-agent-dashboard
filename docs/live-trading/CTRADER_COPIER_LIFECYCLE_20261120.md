# The cTrader copier's trade lifecycle, 20 November 2026

## What this covers

The copier began as market copies plus a close. It now follows the whole life of a source trade: a resting source
order, an amendment, a partial close, and the destination's own answers. This note records what each path does,
what has been proved about it, and what has not. The dashboard tab, the document and the schedule are described in
`docs/live-trading/CTRADER_COPIER_DASHBOARD_20261119.md`; this note is the relay side of it.

## The defect it started from

`ProtoOAOrder` carries three different prices and the copier was sending one of them in the wrong field:

| Field | Number | What it is |
| --- | --- | --- |
| `price` | 4 | the order's own entry |
| `stopPrice` | 6 | the trigger of a stop order, never protection |
| `stopLoss` | 8 | the protective stop |

The copier sent a pending copy's protection as `stopPrice`, so a limit copy would have arrived with its entry one
stop away from where the source entered. Fixed in the transport (`buildPendingOrder`, `buildAmendOrder`), the
adapter (`sendPendingOrder`, `amendOrder`) and the copier's `place`, where the source entry is now `price` and the
protection is `stopLoss`; the expiry alone decides good-till-date versus good-till-cancel. This is the one defect
in the set that a fixture can describe but only the broker can confirm: a wrong field shows up as a wrong entry
price, not as an error.

## What the copier does now

Positions, unchanged in shape and stricter in step:

- a source position is copied once, sized through the destination's own contract (source lots times source contract
  size, divided by the destination's units per lot, floored to its step);
- the source's stop and target are compared with the destination's on every poll and only a difference is amended,
  through the adapter's position amendment, which sends absolute prices;
- a partial close at the source closes only the difference between the destination's own volume and the share of
  the source still open; the new baseline is written as `source_volume`, and for `CLOSE_SETTLE_MS` (20s) the
  destination position is held in `close_unknown` so a second poll cannot measure the same difference and close
  twice. A source volume that grows is refused (`source_volume_increased`) rather than topped up.

Resting orders, new:

- the probe reads `orders_get` beside `positions_get`, and a working source order is copied as a working
  destination order at the source's own entry with its protection and expiry, under the client order id
  `lim-<ticket>`;
- a source amendment amends the copy in place and the row states `amend_confirmed: false` until the next
  destination read shows the broker holds the new prices;
- a source cancellation cancels the copy and moves the mapping to history with `close_reason:
  source_order_gone`;
- a copy the destination cancels while the source still holds the order is recorded (`order_left_book`) and
  re-placed once under `lim-<ticket>-a1`, not twice;
- a copy that fills is followed through the position it became: the alias block maps the source order ticket to the
  destination position ticket, so the fill is never mistaken for a second trade.

Unknown answers, unchanged in principle and now covering orders:

- a send the broker does not answer is a claim in `pending`, resolved on the next poll by client order id, never
  resent; the claim survives a restart because it lives in the mapping store;
- a claim the broker answers with a position or a working order becomes the mapping; a claim the source has since
  closed is dropped; a claim the broker never answers expires into a retry under a new client order id.


## What is proved, and how

Through `node --test`, on fixtures and a fake client:

- transport `CTRADER_TRANSPORT_20261114.test.js` — 42 tests, including the limit copy's absolute entry and stop,
  the expiry's time in force, the refusal of a pending copy on the market side of the book, an amendment carrying
  only the field that moved, a protection move sent as `stopLoss`, a cancel by the broker's own order id, and an
  order row carrying the link to the position it filled into;
- adapter `CTRADER_ADAPTER_20261114.test.js` — 37 tests, including `sendPendingOrder`, `amendOrder` (a moved stop as
  `stopLoss`, the resting entry untouched, an uncertain amendment unknown), `cancelOrder`, `getOrder` /
  `findOrderByRequestId`, `amendPositionSltp`, and a close that names no volume taking the position's own size;
- copier `CTRADER_COPIER_20261119.test.js` — 46 tests, including nine lifecycle regressions: a working order copied
  at its own entry, an unsupported kind and a wrong-side entry refused, an unknown place claimed by client order
  id, an accepted order with no id claimed across a restart, a moved entry and stop amended in place and confirmed
  on the next read, a cancelled source order cancelled on the destination, a claimed order that filled followed by
  alias, a destination-cancelled copy re-placed once, and a partial close taken once with the new baseline stated.

**None of those paths has run against the live account yet.** No resting source order has been placed, no copy has
been amended, cancelled or partially closed at the source since these paths existed, and no order claim has been
answered by the broker for real. The dashboard's verification matrix therefore reads `tested` for the four lifecycle
rows. The rows above them are data-driven rather than declared: a copy row can only say `broker_observed` while a
copy is open in the read, so on the 09:10Z document of 20 November, with nothing open, "Copying a filled FTMO-1
position" reads `awaiting_live_proof` and size and stop read `tested`, while "Full close after a source exit" keeps
`broker_observed` from the closed mapping and the account's own deal for `62272218`. A local pass is not a live proof,
and the matrix says so rather than promoting a fixture.

**Updated at 13:40Z on 20 November.** The four rows are now promoted from evidence, not from the passage of time. The
rule is: a lifecycle row moves to `broker_observed` only when a health row for the poll that did it carries
`outcome: accepted`, or when the store kept the same answer (`sltp_utc` after an accepted stop amendment,
`order_kind` plus `target_order_id` after an accepted resting order, `last_partial_utc` after an accepted partial
close, or a history row with `close_outcome: cancelled`). A planned row, a dry run, a refusal, or a counter such as
`reconcile_orders.filled` is not an answer and promotes nothing. On that read the source had done two of the four for
real: two source limit orders were copied as broker orders earlier that day (`309462132` -> `178348935`,
`309464502` -> `178349950`, both `order_kind: limit` and both later filled), and a stop amendment on `#62308557` was
accepted by the broker at `13:17:23.525Z`. The 13:40Z publication therefore reads `broker_observed` for "Amending a
stop or target" and "Copying a resting source order", and `tested` for cancellation and partial close, which have not
happened. The full evidence is in `docs/live-trading/CTRADER_COPIER_DASHBOARD_20261119.md`.

## The publish gate

`scripts/publish-ctrader-copier.js` defaults to `--min-interval-seconds 540`, and `ctrader/copier/copier-dashboard.ps1`
passes the same number explicitly. The earlier 600s was the task's own interval, not a gate under it: the task fires
every ten minutes and its publish lands about thirty seconds into a run, so the next run arrived 565-600s after the
last publish and was refused, halving the cadence to twenty minutes. 540s sits under the interval and still refuses a
retry inside one run; it allows at most seven publishes an hour from this file, inside GitHub's documented soft limit
of ten for a branch-built site. A run with nothing new is refused by the engine's strictly-newer gate rather than
republished. The document's stale window (1800s) and the heartbeat allowance (1500s) are unchanged, so at a ten-minute
publish they mean three missed publishes and two and a half. The tab's freshness line no longer calls the 30-minute
window "the publish cadence", and the heartbeat's stale detail no longer calls 1500s a cadence either.


## Deploying it without disturbing the mappings

One surface, copied together, with the poll task stopped for the swap. The three relay files under
`ctrader/relay/src/` are the same files this repository now tracks (`6181af4b`): the deploy was a copy, not a pull,
because the host holds no checkout. `ctrader/relay/README.md` carries the copy order, the hash check and the rollback.

- `ctrader/relay/src/CTRADER_TRANSPORT_20261114.js`, `CTRADER_ADAPTER_20261114.js`,
  `CTRADER_COPIER_20261119.js` → `C:\ctrader-relay\`;
- `tools/mt5-bridge/live-trading-positions-probe.py` → `C:\ctrader-relay\live-trading-positions-probe.py` (its
  `orders_get` block is what the resting-order path reads);
- `ctrader/copier/copier-dashboard.ps1` → `C:\ctrader-relay\copier\copier-dashboard.ps1` (the 600s gate);
- `scripts/publish-ctrader-copier.js`, `scripts/build-live-ctrader-copier.js`, `lib/live_ctrader_copier.js` →
  `C:\ctrader-relay\copier-tools\`, with `script.js` in the publish checkout. In the event only the publish script and
  the lib differed: `build-live-ctrader-copier.js`, `validate_live_ctrader_copier.js` and
  `publish-live-trading-feed.js` already matched their repository copies by SHA-256, so they were left alone.

`C:\ProgramData\ctrader-relay\copier\mappings.json` needs no migration. Its rows keep their target ids and stay
open; a row written before `source_volume` existed has that field backfilled from the destination's own volume on
the next reconcile, so the partial-close path starts from the truth rather than refusing
(`source_volume_baseline_missing`) until the position closes. `pending`, `attempts`, `aliases` and `close_unknown`
are additive blocks in the same file; the older copier finds its own keys in a store the new one wrote and ignores
the rest. Nothing is re-sent on a restart: the mapping store, not the lock, is the dedupe key.

Order of work on the host, as carried out on 20 November 2026: the originals were copied to
`C:\ProgramData\ctrader-relay\backup-20261120\`, the `ctrader-copier-poll` task was disabled, the seven files were
copied and their SHA-256 read back and matched, the task was re-enabled and run once by hand, and the
`ctrader-copier-dashboard` task was then run and its `dashboard.out.txt` read. `health.json` reported
`copier-20261120.1`, status `ok`. A separate `--dry-run` was not needed in the end: the source read came back with no
positions and no orders, so the first real poll had nothing to send, and the dry run would have proved no more. The
task's next run is on its 60s schedule. Rollback is the backup folder; the store was not touched by the code swap.

## Observation gaps, stated rather than papered over

- No live witness exists for: a resting order's placement (and therefore the corrected field mapping), its
  amendment, a cancellation, a re-place after the destination cancels, a fill followed through an alias, a partial
  close, or a stop/target amendment on an open copy.
- The probe reads what the terminal holds, so a source order the terminal has not written yet is invisible for one
  poll; the copier copies what it reads and never infers an order from a plan.
- The publish gate change is a repository fact until the host's `copier-dashboard.ps1` is replaced: until then the
  host still publishes on the 1200s it passes explicitly.
