# L2L coverage on the published branch: ten full levels each side of price

2026-11-21. This is the deployed half of the coverage work: the scheduled publisher now maintains the L2L
ladder it publishes, so every lane and the page read a grid that reaches at least ten full levels strictly
above the current price and ten strictly below it, for EURUSD, XAUUSD, US100.cash and BTCUSD.

It follows the audit in `BTCUSD_NO_TRADES_AUDIT_20261121.md`: BTCUSD spent a fortnight below the lowest
generated line, so a reading had no next line to aim a target at and the page said nothing. Depth is no longer
a number somebody picks. It follows from where price is.

## 1. The rule

- **Measurement.** The anchor pair and the spacing come from the ladder's own recorded provenance
  (`anchor_high`, `anchor_low`, `spacing_price`), because those numbers produced the prices already published.
  A file with no generated lines is measured from its two hand-marked seeds. A file whose generated lines
  disagree with each other is refused rather than re-measured.
- **Counts are strict.** A line exactly at price is neither above nor below it. Covered means
  `above >= 10 && below >= 10` over the full lines.
- **Generation is additive and deterministic.** Every existing level keeps its price, label, `marked_at_utc`
  and provenance. Missing steps are appended beyond the outermost line on the side that is short, snapped onto
  the instrument's point grid, and a second run over the output adds nothing.
- **Identity.** A generated line is `role: derived`, `label: "derived <price>"`, `marked_by: "automatic L2L
  coverage"`, and carries `available_at_utc` - the instant it became tradable. Its `note` states the step, the
  distance and the anchors, so the price can be reproduced from the file alone.
- **Nothing is removed.** Retention is structural: the writer only appends. A price a reader still references
  is reported if it is missing, never invented.
- **Caps are honest failures.** The writer stops at 60 steps each way and reports the symbol and a reason
  rather than inventing a line.
- **Midpoints are not ladder.** FTMO 2's half grid is derived at read time and never stored, so its floor is
  judged on the full lines like the other two accounts'.

## 2. Where it runs, and why there

`scripts/publish-live-trading-lanes.js` runs the coverage plan on every publish cycle:

1. It reads the ladder from the publisher checkout - the file the previous publish committed and this run will
   replace.
2. It runs `planCoverage` once per enabled lane's snapshot. The three terminals quote slightly different
   prices, and the writer only ever adds, so the last plan covers whatever the earlier ones did not: no lane is
   served a grid that stops short of its own price.
3. It writes the result to `tmp/l2l-levels.publish.json` and hands it to `publish-live-trading-feed.js` as an
   extra. The publisher resets its checkout to `origin/main` before it copies anything in, which is why the
   file is staged outside the checkout - an extension written into the working tree would be thrown away by
   that reset.
4. The ladder is committed and pushed in the same commit as the lane snapshots, lane document and heartbeats.

The ordering that matters is this: generation happens before publication, and publication is what every lane's
trader reads (`--published <checkout>`). The ladder a lane reads on a tick is one the publisher had already
extended for that lane's own price, and it is always at least as deep as the last committed one, because
nothing is ever removed. A quiet cycle writes the same bytes and the publish reports `unchanged`; a price that
gaps is met on the next cycle, which is one publish interval.

A ladder that fails the levels validator is refused rather than published: a grid the chart cannot read is
worse than no new grid. A ladder that cannot be extended for one asset (a cap, an unreadable price) is reported
in the run's `levels.coverage` rows with the symbol and the reason, and the snapshot still publishes - one
short asset does not stop the other three being served.

`config/live-trading-lanes.json` carries the switch:

```json
"publish": { "min_interval_seconds": 600, "state": "...", "summary": "...", "levels": "data/l2l-levels.json" }
```

Without the `levels` key the publisher carries no ladder, and nothing else about the run changes.

## 3. The writer's own command line

`scripts/ensure-l2l-coverage.js` is the same arithmetic for a person at a checkout:

```
node scripts/ensure-l2l-coverage.js                    report at the snapshot's prices, write nothing
node scripts/ensure-l2l-coverage.js --write            extend the file where a side is short
node scripts/ensure-l2l-coverage.js --prices BTCUSD=60012.5,EURUSD=1.09655
node scripts/l2l-levels-tool.js --check data/l2l-levels.json
```

It writes atomically (a fully written neighbour renamed into place), validates before writing, and appends one
JSON line per run to `tmp/l2l-coverage.log`.

## 4. What this release does not include

- **The trader's in-memory plan and its heartbeat `coverage` block.** Those were written on a worker branch
  whose live-trading files had drifted behind `main`, and the three lane checkouts run three different
  revisions of that code. Porting the hook into each of them changes trading code on a live lane, which is not
  a change to make as part of a ladder fix. The coverage guarantee does not depend on it: the ladder is
  covered before it is published, and every lane reads the published ladder.
- **The dashboard's lane coverage chip.** Same reason: it lives in `script.js`, which has moved on `main` since
  that branch. The page draws the extended ladder today; the chip that would name a short asset is a separate
  change.
- **The freshness refusal in `lib/l2l_strategy.js`.** Generated lines carry `available_at_utc`, so the fact is
  in the file, but the reading rule on `main` does not yet refuse a crossing that happened before a line
  existed. Until it does, a newly generated line can be crossed by a candle that closed before it was written.
  This is recorded as open, not as done.

## 5. Tests

`tests/l2l_coverage.test.js` (13 cases): the floor, price below and above the published range, a gap many steps
wide and the cap, a price exactly on a line, idempotence and restart, the half grid and the floor, target
selection, all four instruments at the feed's own prices, atomic and validated writes, retention of a
referenced price, the CLI's price syntax, and a failure that names the asset and the reason while the other
three stay covered.

`tests/live_trading_lanes_publish.test.js` gains the publish case: a ladder reduced to its seeds is extended
for both lanes' prices, keeps every seed at its own price, adds only unique lines on the same grid, and rides
in the same commit as the snapshots.

`tests/l2l_levels.test.js` accepts the third writer's name in the committed artifact.

## 6. Deployment record

Filled in on the host; see section 7 below once the lanes have been observed.
