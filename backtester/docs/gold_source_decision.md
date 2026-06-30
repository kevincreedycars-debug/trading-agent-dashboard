# Gold Source Decision

## Status

Phase 4 decision: Gold release work uses true `XAU-USD` spot history from Coinbase.

## Accepted release source

- Live collectors already use Coinbase `XAU-USD` spot for current Gold pricing.
- Coinbase `v2/prices/XAU-USD/spot?date=YYYY-MM-DD` returns historical daily spot-scale values.
- This supports the required historical Gold release window without using an ETF proxy.

Accepted historical lineage:

- vendor: `Coinbase`
- source endpoint: `https://api.coinbase.com/v2/prices/XAU-USD/spot`
- historical mode: per-date `?date=YYYY-MM-DD`
- canonical release instrument key: `xauusd_spot`

## Legacy proxy status

- Legacy `gold_spot_usd` rows are GLD ETF proxy history.
- They are proxy-only and are not accepted for the Gold checker/dashboard release path.
- Do not treat `gold_spot_usd` as true XAU/USD.

## Next action

Use `xauusd_spot` for Gold historical snapshot builds, replay, evaluation, checker, and dashboard release work.

Keep GLD lineage documented as legacy proxy history only.
