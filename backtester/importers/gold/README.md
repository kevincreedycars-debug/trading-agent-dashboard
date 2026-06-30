# Gold Daily Historical Import

This importer loads daily gold history into the historical warehouse.

Target tables:

- `historical_source_manifests`
- `historical_price_series`

Default canonical targets:

- true spot: `instrument_key = 'xauusd_spot'`
- legacy proxy: `instrument_key = 'gold_spot_usd'`

If you use a proxy instead of spot, set `--instrument-key` explicitly so lineage stays clear. `gold_spot_usd` is legacy proxy lineage in this repo and is not accepted for the Gold release path.

## Required environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Source input

Provide either:

- `--file=path/to/gold_daily.csv`
- `--source-url=https://...`
- `--source=coinbase_xauusd_spot_daily`

Expected columns:

- `date`
- `close`

Optional columns:

- `open`
- `high`
- `low`
- `volume`
- `source_symbol`

## Run

```powershell
node backtester/importers/gold/import_gold_daily.js --file=gold_daily.csv --start=2018-01-01 --end=2024-12-31
```

Coinbase true spot example:

```powershell
node backtester/importers/gold/import_gold_daily.js --source=coinbase_xauusd_spot_daily --instrument-key=xauusd_spot --vendor-name=Coinbase --vendor-symbol=XAU-USD --start=2024-01-02 --end=2026-04-30
```

Proxy example:

```powershell
node backtester/importers/gold/import_gold_daily.js --file=gld_daily.csv --instrument-key=gld_proxy --vendor-name=Stooq
```
