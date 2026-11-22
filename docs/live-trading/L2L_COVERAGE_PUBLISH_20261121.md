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

Deployed 2026-11-21 from `D:\trading-agent-dashboard-codex\.local\wt\l2l-coverage-main`, a worktree cut from
`origin/main`. Host: `VMI3697641` (158.220.87.240).

**Revision.** `376fd834` - "keep ten full L2L levels each side of price on the published branch" - pushed to
`origin/main` at about 21:43Z. Full local suite on that tree: 1015 tests, 2 failures, both pre-existing and
unrelated (`the committed candidate reproduces from run-v1...`, `the committed markdown equals a fresh render
of the stored artefacts`); the touched suites are green (`l2l_coverage` 13, `l2l_levels` 50,
`l2l_levels_store`, `live_trading_lanes_publish` 26, `live_trading_feed_publish`).

**Lane code was not moved.** The three checkouts still run the revisions they were pinned to before this
change: lane 1 `c5abd0ac`, lane 2 `f14f2ac7`, lane 3 `441c308f`. Coverage is a property of the ladder they all
read, not of their own code, and porting the branch that carries the trader-side hook would have changed
trading code on three live accounts.

**The ladder every lane reads.** `C:\live-trading\publisher\data\l2l-levels.json`, committed to `main` and
served at `https://kevincreedycars-debug.github.io/trading-agent-dashboard/data/l2l-levels.json`.

| account | checkout | ladder path it reads now | how |
| --- | --- | --- | --- |
| ftmo-1 | `C:\live-trading\runtime` | `C:\live-trading\publisher\data\l2l-levels.json` | already `--published C:\live-trading\publisher` |
| ftmo-2 | `C:\ftmo2` | `C:\live-trading\publisher\data\l2l-levels.json` | already `--published C:\live-trading\publisher` |
| ftmo-3 | `C:\ftmo3` | `C:\live-trading\publisher\data\l2l-levels.json` | repointed from `C:\live-trading\runtime` |

`C:\live-trading\runtime\data\l2l-levels.json` was the file lane 3 read. Nothing wrote it: its bytes were the
2026-11-02 copy from the checkout, byte-identical to the other two lanes' unused copies, and it never moved
with the published ladder. Repointing lane 3 at the publisher was therefore the whole fix - no local copy is
maintained anywhere now, so there is no synchronisation to drift.

The repoint is one token in the task's generated wrapper, backed up first:
`C:\ftmo3\tmp\live-trading-trader-run.cmd` (`--published "C:\live-trading\runtime"` ->
`--published "C:\live-trading\publisher"`, backup `live-trading-trader-run.cmd.bak-20261121T214813Z`, no other
byte changed). **A re-registration of lane 3 must pass `-Published C:\live-trading\publisher`** or it will
write the old path back.

**First publish cycle on the new code**, 2026-11-21T22:01:04Z, commit `e39b21b3`:
`action: published`, extras `data/live-trading-trader.ftmo-1.json`, `...ftmo-2.json`, `...ftmo-3.json`,
`data/l2l-levels.json`, `data/live-trading-lanes.json`; `levels.checked_at_utc 22:01:00.503Z`,
`levels.generated_at_utc 21:36:36.003Z`, `failures: []`. Per lane, at that lane's own snapshotted price:

| asset | anchors (high/low) | spacing | lines | generated range | ftmo-1 | ftmo-2 | ftmo-3 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EURUSD | 1.12729 / 1.12308 | 0.00421 | 28 | 1.05151 - 1.16939 | 18 up / 10 down | 18 / 10 | 18 / 10 |
| XAUUSD | 4211.99 / 4140.51 | 71.48 | 30 | 2782.39 - 4926.79 | 20 / 10 | 20 / 10 | 20 / 10 |
| US100.cash | 30774.61 / 30499.79 | 274.82 | 40 | 22530.01 - 33522.81 | 30 / 10 | 30 / 10 | 30 / 10 |
| BTCUSD | 84568.53 / 83113.66 | 1454.87 | 36 | 46741.91 - 99117.23 | 26 / 10 | 26 / 10 | 26 / 10 |

**Nothing moved.** Every price in the 22-line ladder `main` carried before the change is still there:
EURUSD +6, XAUUSD +8, US100.cash +18, BTCUSD +14 lines, **0 removed**, both seeds kept on all four.


**Large move, reported without writing.** In the publisher checkout,
`ensure-l2l-coverage.js --prices BTCUSD=52000,EURUSD=1.0200,XAUUSD=4300,US100.cash=21000`: it would add
EURUSD 16 below, BTCUSD 6 below, US100.cash 14 below, XAUUSD 1 above, land every asset at 10 or more a side,
and report no failures - the next cycle after a gap meets it, and the cap is nowhere near.

**Restart / idempotence.** The 22:01 cycle was a fresh process on the newly checked-out code with the ladder
already covered: it wrote the same bytes, left `generated_at_utc` at the earlier value and reported each asset
`covered`. The suite's own restart case asserts the same thing from a cold start.

**Lanes at their next healthy tick.** All three `armed: true`; each reads
`../live-trading/publisher/data/l2l-levels.json`; `levels_generated_at_utc 2026-11-21T21:36:36.003Z`, so the
tick that followed the publish was already reading the extended ladder.

| lane | tick (UTC) | status | working order or position | lot |
| --- | --- | --- | --- | --- |
| ftmo-1 | 21:51:30 | send_failed (a removal did not land) | XAUUSD sell limit 3568.67, sl 3582.97, tp 3497.19 | 0.01 |
| ftmo-2 | 21:51:31 | send_failed (an exit did not land) | XAUUSD position from 3533.14, tp 3497.19 | 0.01 |
| ftmo-3 | 22:06:30 | nothing_to_place | EURUSD sell limit 1.09782, sl 1.09866, tp 1.09361 | 0.01 |

`send_failed` on lanes 1 and 2 is a cancelling/exit request the terminal did not confirm on that tick - the
order tool's own journal holds the terminal's answer - and it predates this change; no ticket was placed on
those ticks. Sizing is the broker minimum on every live order and position, unchanged by this work.

**FTMO 2's midpoints.** The half grid is derived from the same published file: 55 EURUSD, 59 XAUUSD, 79
US100.cash and 71 BTCUSD lines. Its open XAUUSD trade entered at the midpoint 3532.93 (filled at 3533.14) and
takes profit at 3497.19, a full line. Midpoints never enter the ten-a-side count, so lane 2's floor is judged
on the same 22/30/40/36 full lines as the other two accounts.

**The page.** The hosted ladder is served with `marked_by: "automatic L2L coverage"`,
`generated_at_utc: 2026-11-21T21:36:36.003Z`, and the generated lines carry `available_at_utc` and a note
naming the step, the distance and the anchors. The hosted lanes document names all three accounts, each
`armed: true`, each with its own code block and checkout head.

**One late correction, on the record.** The 21:50Z cycle ran the old code from the checkout before its reset
and published without the ladder extra. That is ordinary behaviour for a change landing on `main` while a
publisher is mid-cadence: the run that started before the push used the bytes it started with, and the next
cycle ran the new code. Nothing was lost - the committed ladder was already on `main` and already covered.

**A refused publish still checks the ladder.** The 22:10:56Z run was refused by the ten-minute gate
(`too_soon`, 578s since the last publish) and still reported `levels.checked_at_utc 22:10:56.492Z`, every asset
covered on every lane, no failures - because the coverage plan is computed before the cadence gate is read.
What it does not do is commit an extension from a run that publishes nothing; that waits for the next
publishing cycle, one interval later.

**Overnight, unattended.** The next cycle that found something to add was 2026-11-22T02:40:55.736Z: the writer
appended exactly one BTCUSD line below (low 46,741.91 -> 43,832.17) and stamped it `available_at_utc` with that
instant. At 09:20:56Z BTCUSD stood at 26 above / 11 below on lanes 1 and 3 and 27 / 10 on lane 2's own price,
and all three lanes' ticks at 09:26 read `levels_generated_at_utc 2026-11-22T02:40:55.736Z` - the loops picked
the new line up without being restarted. Nothing else moved because nothing else needed to: 21 November 2026
was a Saturday and the four prices were where they had closed.


## 7. Open items

- Lane code revisions unchanged, so the trader's in-memory coverage plan, the heartbeat `coverage` block, the
  dashboard chip and the `lib/l2l_strategy.js` freshness refusal are not deployed (section 4). Generated lines
  do carry `available_at_utc`, so the fact is in the file for whoever ports the rule next.
- Lane 3's registration must carry `-Published C:\live-trading\publisher` when it is next re-registered.
- `C:\live-trading\runtime\data\l2l-levels.json`, `C:\ftmo2\...` and `C:\ftmo3\...` are now unread copies. They
  can be deleted whenever someone is next in those checkouts; nothing reads them.
- Attaching the feed cadence's own `--extend-levels` step is no longer needed on any lane: the publisher is
  the one place the ladder is generated, and a second writer would only race it.

