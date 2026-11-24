# One-hour series for XAGUSD, WTIUSD and GBPUSD, 2026-11-24

The three markets the matrix reports as blocked are blocked on one dataset: no cached one-hour series
priced at both 05:00 London endpoints. This note records the acquisition that closes that gap, what it
proves, and the decision it deliberately leaves to the owner.

## Source

| field | value |
| --- | --- |
| publisher | OANDA v20 REST, `api-fxtrade.oanda.com` (the same publisher the EURUSD, XAUUSD and NAS100 series come from) |
| endpoint | `GET /v3/instruments/{instrument}/candles`, `granularity=H1`, `price=M` |
| window | `2024-01-01T00:00:00Z` to `2026-11-24T00:00:00Z` |
| instruments | `XAG_USD` → XAGUSD, `WTICO_USD` → WTIUSD, `GBP_USD` → GBPUSD |
| authentication | bearer token from the local credential store; never printed, never written into a record |
| scope | market data only: no account, order, position or transaction endpoint was called |

## What was acquired

| market | rows | first bar | last bar | both 05:00 endpoints present | of sessions |
| --- | --- | --- | --- | --- | --- |
| XAGUSD | 17,149 | 2024-01-01T23:00Z | 2026-11-23T23:00Z | 569 | 725 |
| WTIUSD | 17,139 | 2024-01-01T23:00Z | 2026-11-23T23:00Z | 568 | 725 |
| GBPUSD | 18,026 | 2024-01-01T22:00Z | 2026-11-23T23:00Z | 572 | 725 |

Of the sessions without both endpoints, 145 in each file are **Fridays**: a Friday session ends at 05:00
London on Saturday, when the market is shut, so the provider has no bar there - Good Friday included, since
Good Friday is itself a Friday. Two further calendar effects account for the remainder, and neither is a gap
in the data:

- **the session ends on a day the market does not open** (7, 8 and 4 sessions): 2024-03-28, 2025-04-17 and
  2026-04-02, the eves of Good Friday; 2024-12-24, 2024-12-31, 2025-12-24 and 2025-12-31, Christmas Eve and
  New Year's Eve; and, for WTI only, 2025-11-27 (Thanksgiving), whose 05:00 London endpoint falls inside the
  holiday closure. The next 05:00 London falls on a day the market does not open, so there is no endpoint bar
  to price.
- **the session opens on a day the market does not open** (4 in each file): 2024-12-25, 2025-01-01,
  2025-12-25 and 2026-01-01, Christmas Day and New Year's Day, where the 05:00 London bar does not exist.
  Good Friday is shut as well, which is already inside the Friday count: no bar at all on 2024-03-29,
  2025-04-18 and 2026-04-03 in the XAG and WTI files, no opening bar on the WTI file's 2025-11-28 (the Friday
  after Thanksgiving), while the GBP file trades on Good Friday morning and loses only the Saturday endpoint.

That leaves 156, 157 and 153 of the 725 sessions without a fully priced pair, which is the same statement as
569, 568 and 572 holding both endpoints.

The backtester prices an endpoint from the bar opening at that hour and tolerates one hour of lag, so a
session missing either end is reported `no_outcome` rather than priced from a stale close. That is the
existing behaviour for every market, not something these series introduce; it is why the published artefact
scores 314 of 725 EURUSD sessions for the challenger rather than all of them.

The counts are reproducible from the record itself: `boundary_coverage` in
`data/usd-layer1-backtester/h1-v1/oanda-h1-acquisition-latest.json` reports 718/573/569, 717/572/568 and
721/576/572 cutoff/endpoint/both for the three markets, and re-reading the local files through the
backtester's own `priceAtHour` reproduces every one of those numbers - with its one-hour tolerance and with
the tolerance set to zero, because no session in these files is priced from a bar that does not sit on the
hour.

## Where the rows live, and why

`backtester/tmp/oanda_{xag,wti,gbp}_usd_h1.csv`, the same schema the existing series use
(`instrument,timestamp,date,open,high,low,close,source,complete`). That directory is gitignored: the rows are
a licensed quote history and are not redistributed in this repository.

The committed record `data/usd-layer1-backtester/h1-v1/oanda-h1-acquisition-latest.json` carries, per market,
the exact request, row count, first/last bar, the file's byte count and sha256, and the per-session endpoint
coverage above. `node scripts/acquire_oanda_h1_series.js --check` re-hashes the local files against it;
`--check` reports `reproduces` when they agree.

## The decision this leaves open

Publishing a *scored* direction result for these three markets needs one of two things, and both are an
owner decision rather than an engineering one:

1. a decision that the rows may be committed to the repository (licence and redistribution), so a reader can
   reproduce the score from the committed data; or
2. a documented download step - the command below - with the record stating that the score is reproducible
   only by someone who runs it.

```
node scripts/acquire_oanda_h1_series.js --from 2024-01-01 --to 2026-11-24 --i-understand-this-is-read-only-market-data
node scripts/acquire_oanda_h1_series.js --check
```

The first call reads `/v3/instruments/{instrument}/candles` and nothing else, writes the three CSVs under
`backtester/tmp/` and rewrites the acquisition record; it refuses to run without the acknowledgement flag,
so it cannot be mistaken for a trading action. The second re-hashes the local files against the record and
prints `reproduces`. Neither step scores anything; the direction test reads the CSVs when they are present
and reports the market blocked when they are not.

The move itself is reproducible without publishing anything:

```
node backtester/scripts/run_usd_layer1_backtest.js --out backtester/tmp/usd-session-research/run-with-h1.json
```

The runner refuses any target outside that scratch folder until `--publish` is asked for, so this writes a
second run beside the committed one. On 2026-11-24, with the CSVs present, it reported
`market_matrix.readiness.run_counts` as `scored` 7, `proxy_scored` 1, `measured_tick_replay` 8, `blocked` 8
and the three direction cells at 325, 330 and 317 sessions over 569, 568 and 572. The committed
`run-v1.json`, built without the series, carries 4 / 1 / 8 / 11 and reports those three cells blocked. The
only difference between the two runs is whether `backtester/tmp/oanda_{xag,wti,gbp}_usd_h1.csv` exists.

Until one of those exists, the matrix keeps reporting these three markets as blocked on the published
artefact, and this note is the evidence that the data is now in hand locally.

## What this does not do

- It does not make any L2L combination ready: those two tests need an archived level ladder marked before
  the session and a bid/ask M5 tape, neither of which this acquires.
- It does not reconcile the WTI instrument: `WTICO_USD` is the provider's WTI contract, while the execution
  venue trades `USOIL`. A cross-venue result would need its own mapping and is not claimed.
- It does not claim any direction, hit rate or edge. Acquiring a series is not a result.
