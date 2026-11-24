# Readiness reconciliation, 2026-11-23

The market x test matrix has 24 combinations (one primary market, seven additional, three tests each).
This note reconciles what each cell's status actually means now that the archived ladder and the
bid/ask tape have both been examined per session. It replaces the earlier shorthand in which every L2L
cell without a committed tape was labelled "no bid/ask tape", which was true of the committed M5 archive
and untrue of the tick replay.

## The three axes

A combination is only as available as its three axes, and each fails separately:

| axis | what it is | where it lives |
| --- | --- | --- |
| levels | an L2L ladder marked **before** the session it prices | `data/usd-layer1-backtester/level-snapshots/l2l-levels-2026-10-04T16-14-19Z.json` (sha256 `a5dc10a3…`, git `5262f8d2`, stamped `2026-10-04T16:14:19Z`) |
| tape | a 5-minute path with **both** sides of the book | `.local/tmp/l2l-ticks-sweep/<market>/<date>.json`, streamed from ticks, 05:00 London to 05:00 London; not in the repository, hash and endpoint close carried in `l2l-tick-sweep-v2.json` |
| shared session | a session that has both, and starts after the ladder's stamp | the six sessions `2026-10-05 … 2026-10-12` for four markets |

The committed M5 archive (`m5-archive-status.json`) is a **different** dataset: mid-price only, three
sessions `2026-11-04 … 2026-11-06`, and no ladder marked before them. It can never make an L2L cell
ready, and it is not the tape the L2L cells are waiting for.

## Why the six archived sessions are still not "scored"

For `EURUSD`, `XAUUSD`, `NAS100` and `BTCUSD`, the six sessions carry 22 archived levels each and a
bid/ask tape covering the whole 24-hour window. They are **measured**: `l2l-tick-sweep-v2.json` prices
them with both sides of the book. They are not **scored** by the run's candle lane, for three reasons
that are properties of this checkout rather than of the market:

1. the tape is not committed — only its sha256, window, bar count and endpoint close are. A reader can
   audit the endpoint prices but cannot re-stream the tape without broker access;
2. the ladder is a single hand-marked grid, the same lines for all six sessions, so it proves format and
   eligibility, not that the trader had those lines on each morning;
3. the run's L2L tests read the configured M5 lane, not the tick replay's per-session tape.

So the honest status is `measured_tick_replay` — a measurement, from a named artefact, that is neither a
blocked cell nor a scored one.

## The 24 combinations

| market | role | directional accuracy | original L2L 5R | 0.5 L2L 3R |
| --- | --- | --- | --- | --- |
| DXY | primary | `proxy_scored` (broker `DXY.cash`, 205 sessions) | `blocked` — no 5-minute tape, no level ladder | `blocked` — same |
| EURUSD | additional | `scored` (challenger, 314 sessions) | `measured_tick_replay` (6 of 6 sessions) | `measured_tick_replay` (6 of 6) |
| XAUUSD | additional | `scored` | `measured_tick_replay` (6 of 6) | `measured_tick_replay` (6 of 6) |
| XAGUSD | additional | `blocked` — no cached one-hour series | `blocked` — no 5-minute tape, no level ladder | `blocked` — same |
| NAS100 | additional | `scored` | `measured_tick_replay` (6 of 6) | `measured_tick_replay` (6 of 6) |
| BTCUSD | additional | `scored` | `measured_tick_replay` (6 of 6) | `measured_tick_replay` (6 of 6) |
| WTIUSD | additional | `blocked` — no cached one-hour series | `blocked` — no 5-minute tape, no level ladder | `blocked` — same |
| GBPUSD | additional | `blocked` — no cached one-hour series | `blocked` — no 5-minute tape, no level ladder | `blocked` — same |

Counts as they travel in the run artefact and the screen payload:

| status | combinations |
| --- | --- |
| `scored` | 4 |
| `proxy_scored` | 1 |
| `measured_tick_replay` | 8 |
| `blocked` | 11 |
| total | 24 |

No cell is rendered as a zero. A blocked cell names the dataset it is missing; a measured cell names
the artefact it was measured from; a scored cell names the denominator.

## Per-session detail, the six sessions the snapshot can price

Every market below has 22 archived levels applied to each session. The tape column is the streamed
bid/ask M5 tape; `gaps` counts holes larger than one bar inside the window (all four markets carry the
same single weekend gap, and the last bar of each tape is strictly before its 05:00 endpoint).

| market | session | window (UTC) | hours | bars | gaps | levels | tape | shared |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EURUSD | 2026-10-05 | 04:00 → 04:00 | 24 | 286 | 1 | 22 | bid/ask | yes |
| EURUSD | 2026-10-06 | 04:00 → 04:00 | 24 | 286 | 1 | 22 | bid/ask | yes |
| EURUSD | 2026-10-07 | 04:00 → 04:00 | 24 | 286 | 1 | 22 | bid/ask | yes |
| EURUSD | 2026-10-08 | 04:00 → 04:00 | 24 | 284 | 1 | 22 | bid/ask | yes |
| EURUSD | 2026-10-09 | 04:00 → 04:00 | 24 | 203 | 1 | 22 | bid/ask | yes |
| EURUSD | 2026-10-12 | 04:00 → 04:00 | 24 | 286 | 1 | 22 | bid/ask | yes |
| XAUUSD | 2026-10-05 … 2026-10-12 | 04:00 → 04:00 | 24 | 273/273/273/273/202/273 | 1 each | 22 | bid/ask | yes |
| NAS100 | 2026-10-05 … 2026-10-12 | 04:00 → 04:00 | 24 | 273/273/273/273/202/273 | 1 each | 22 | bid/ask | yes |
| BTCUSD | 2026-10-05 … 2026-10-12 | 04:00 → 04:00 | 24 | 286 ×6 | 1 each | 22 | bid/ask | yes |

`2026-10-09` is the short session: the window runs to Saturday 05:00 London, which is 24 hours because
the session starts on a Friday. Its bar count is lower because the broker's tape thins after the New York
close, not because the window was cut.

## What each missing dataset needs

| market | directional accuracy | L2L 5R / 3R |
| --- | --- | --- |
| XAGUSD | approved H1 series priced at 05:00 London (venue and licence to be confirmed) | a pre-session ladder and a bid/ask M5 tape over shared sessions |
| WTIUSD | the same, with the contract-month convention stated | the same |
| GBPUSD | the same | the same |
| DXY | the official ICE cash index series (currently a labelled broker CFD proxy) | not planned: the primary market is the call, not an L2L lane |

## Dependency classes

- **Data availability** — XAGUSD/WTIUSD/GBPUSD one-hour series; bid/ask M5 tape and pre-session ladders
  for any market not in the 2026-10-04 snapshot.
- **Licence or source** — the official ICE cash DXY; gold's identity and licence; the ladder's marking
  vintage is accepted, not licensed.
- **Measured result, not a decision** — H1 remains 0/725 because its package is not in this checkout.
- **Not established** — no predictive advantage is claimed for any model, market or cell above.

## How the run carries this

`market_matrix.readiness.rows[]` carries, per test, `status`, `reason`, `blockers`, and a `sessions`
block (`levels`, `tape`, `shared`, `levels_dates`, `tape_dates`, `shared_dates`, `tape_bid_ask`,
`tape_source`). The screen payload copies those fields, so the Tests tab shows the same reconciliation
the artefact holds. The statuses are produced by `backtester/lib/usd_layer1_backtester/market_matrix.js`
and the tape evidence comes from `l2l-tick-sweep-v2.json` via `backtester/lib/usd_layer1_backtester/run.js`.

## Update, 2026-11-24: the three missing series exist, outside the repository

The XAGUSD, WTIUSD and GBPUSD one-hour series this note lists as missing were acquired on 2026-11-24 and
sit in `backtester/tmp/oanda_{xag,wti,gbp}_usd_h1.csv` (17,149 / 17,139 / 18,026 H1 rows), gitignored
because they are a licensed quote history rather than a free download. Run with them present, the same
build prices the three directional cells:

| market | sessions with both 05:00 endpoints | directional score | cells that stay blocked |
| --- | --- | --- | --- |
| XAGUSD | 569 | 325 | both L2L cells: no ladder, no tape |
| WTIUSD | 568 | 330 | both L2L cells: no ladder, no tape |
| GBPUSD | 572 | 317 | both L2L cells: no ladder, no tape |

That moves the counts above to `scored` 7, `proxy_scored` 1, `measured_tick_replay` 8, `blocked` 8 - but
only as a local measurement. The published artefact in this checkout still reports the three cells
blocked, and it should, until there is a licence decision that the rows may be committed or a documented
download step a reader can follow.

One property of the three files belongs to the calendar, not to the data: a Friday session ends at the
next 05:00 London, which is a Saturday, so no Friday morning has an endpoint bar and none of the 145
Friday sessions can be scored. Seven, eight and four further sessions end on Christmas Day, New Year's Day
or Good Friday (the WTI file also 2025-11-27, Thanksgiving); four sessions in each file open on Christmas
Day or New Year's Day; and Good Friday is shut outright in the XAG and WTI files. So neither end can be
priced, and the dates are listed in `OANDA_H1_ACQUISITION_20261124.md`. The 569, 568 and 572 above are what
remains, and any coverage figure for these markets has to say so before it is compared with a market that
prints on Saturday.

