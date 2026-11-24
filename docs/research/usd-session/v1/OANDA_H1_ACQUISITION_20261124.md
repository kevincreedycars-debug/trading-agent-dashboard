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

The 156 sessions without both endpoints are **Fridays**: a Friday session ends at 05:00 London on Saturday,
when the market is shut, so the provider has no bar there. The backtester prices an endpoint from the bar
opening at that hour and tolerates one hour of lag, so a Friday session is reported `no_outcome` rather than
priced from a stale Friday close. That is the existing behaviour for every market, not something these series
introduce; it is why the published artefact scores 439 of 725 EURUSD sessions rather than all of them.

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
2. a documented download step — the command above — with the record stating that the score is reproducible
   only by someone who runs it.

Until one of those exists, the matrix keeps reporting these three markets as blocked on the published
artefact, and this note is the evidence that the data is now in hand locally.

## What this does not do

- It does not make any L2L combination ready: those two tests need an archived level ladder marked before
  the session and a bid/ask M5 tape, neither of which this acquires.
- It does not reconcile the WTI instrument: `WTICO_USD` is the provider's WTI contract, while the execution
  venue trades `USOIL`. A cross-venue result would need its own mapping and is not claimed.
- It does not claim any direction, hit rate or edge. Acquiring a series is not a result.
