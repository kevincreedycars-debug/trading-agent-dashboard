# Gold: local evidence and timestamped backtesting

These tools run offline. They do not fetch credentials, publish calls, write to the warehouse, change weights, or activate workflows.

The separate read-only acquisition commands added on 6 September fetch stored calls and OANDA candles using existing process credentials. The first [stored-call pilot and input defect investigation](gold_stored_call_pilot_20260906.md) is now available. It uses storage-time proxies and does not qualify raw-feature release times or executable trades. The original offline tools below remain offline.

## Review the existing evidence

```powershell
node backtester/scripts/build_gold_evidence_audit.js data/backtester-checker-gold-24h-2024-2026.json data/gold-evidence-audit.json gold-backtesting.html
```

Open `gold-backtesting.html` with VS Code Live Preview or directly in a browser. It embeds its audit data and needs no server or network. Filter the factor table by year or factor ID, and expand pair agreement and evidence lineage.

The initial local audit covers 608 saved rows: result labels agree under the legacy evaluation assumptions; 45 rows have missing prices and 563 have evaluable price outcomes. Source-price timestamps are absent, so **none of these rows is qualified as timestamp-aligned evidence**. The saved artifact is preserved. The JSON report records its SHA-256 and row-level issues.

Legacy “following 24hrs” means a call-date reference price to the next weekday close. The Gold runner uses a snapshot price or daily close, not a verified 09:30 fill. Weekday arithmetic is not an exchange holiday calendar. Do not treat numerical checker parity as proof of causal timing, directional edge, or executable profit.

## Timestamped input contract

The legacy Gold snapshot builder also selects events through `23:59:59Z` on the snapshot date and stores same-date series values. Those inputs are not proven available for an assumed morning call. The tools below provide a separate path; the legacy snapshots are not silently retimed or rewritten.

Use a JSON object with `data_kind`, `config`, `calls`, and `candles`. See `backtester/fixtures/gold_timestamped.synthetic.json` for a complete **synthetic contract example**, not historical market evidence.

Configuration:

- `candle_interval_ms`: explicit positive integer candle duration.
- `price_basis`: `bid`, `ask`, or `mid`; every selected candle must match.
- `flat_threshold_pct`: explicit non-negative percentage-point threshold. Choosing a value does not establish calibration.

Each call:

- Unique `prediction_id`; `market` exactly `XAUUSD`.
- `direction`: `BULLISH`, `BEARISH`, `BULLISH_LEAN`, `BEARISH_LEAN`, or `NO_CLEAR_BIAS`.
- `call_time`: actual decision/publication timestamp used for the experiment, with seconds and an explicit `Z` or UTC offset.
- `horizon_end`: explicit outcome endpoint, after the call. No assumed “24H” mapping.
- `inputs_available_at`: latest permitted feature-availability time, no later than the call.
- Non-empty `features`: unique `name`, non-null scalar `value`, and `available_at` for each. Every availability time must be at or before both the input cutoff and the call. Use actual availability, not the economic observation date.
- For factor analysis, use `F1` through `F10` with `BULLISH`, `BEARISH`, or `NEUTRAL` values. Other raw features may be recorded but are not interpreted as factor votes. Missing factors remain missing.

Each candle:

- `market: "XAUUSD"`, explicit `open_time` and `close_time`, numeric positive `open`, `high`, `low`, `close`.
- Consistent OHLC bounds, `price_basis`, and a non-empty `source` identifying the actual feed/export.
- Candle times must describe the true interval boundaries. Supply timezone-aware timestamps; do not label broker-local timestamps as UTC without conversion.

The current strict policy requires a candle opening exactly at the call and a candle closing exactly at the horizon, with contiguous uniform-duration candles between them. Intrabar calls, gaps, market breaks, duplicate/overlapping candles, or missing endpoints are rejected. This intentionally cannot interpolate a 09:30 entry from a 09:00 hourly open. Use compatible finer-resolution data. Closed sessions need a future explicit session-calendar policy; do not fill their gaps with invented candles.

The validator checks supplied metadata consistency. It cannot independently verify that a source or availability claim is authentic. It evaluates price direction on one price basis; it does not model bid/ask switching, spreads, commissions, slippage, stops, targets, or fills.

### Explicit delayed entry and endpoint-only diagnostics

The default remains entry exactly at `call_time` with contiguous candles. Two opt-in settings support the stored-call research path:

- A call may supply `entry_time` with `config.entry_policy: "next_interval_open_after_call"` and a positive integer `max_entry_delay_ms`. Entry must equal the next global interval boundary after the normalized call time, remain within the delay bound, and precede the horizon. Feature availability is still checked against the original decision cutoff, never against the later entry. The stored-call adapter preserves original microseconds and rounds availability upward before choosing the next minute.
- `config.coverage_policy: "exact_endpoints"` permits interior gaps for a price-direction comparison only. Entry and horizon candles remain exact; duplicate/overlapping candles, malformed OHLC, incomplete candles, mixed feeds and missing endpoints are rejected. Reports expose gap count, missing duration and `observed_path_complete`; they always retain `executable_trade_validated: false`. Gaps are not filled or declared scheduled closures.

Batch evaluation indexes candle timestamps once and selects each call's window. Tests compare indexed results with direct evaluation, including malformed archives, outside-window bad prices and overlaps. A malformed market/timestamp archive falls back to the direct path to preserve rejection behavior.

## Run the new path

```powershell
node backtester/scripts/evaluate_gold_timestamped.js backtester/fixtures/gold_timestamped.synthetic.json tmp/gold-synthetic-direction.json
node backtester/scripts/build_gold_chronological_factors.js backtester/fixtures/gold_timestamped.synthetic.json tmp/gold-synthetic-factors.json 2024-01-08T15:00:00Z 0
```

Replace the example file and split with real exported evidence when available. Output paths must differ from input paths. Reports retain a source hash and the input's `data_kind` label.

The factor tool requires an explicit split timestamp and embargo in milliseconds. Training calls must finish at or before the split; validation calls must start at or after split plus embargo. All other calls are excluded. It reports both partitions for all ten factors and 45 factor pairs, with coverage, flats, and directional accuracy. No ranking or weight optimization is performed.

Changing validation outcomes does not change training statistics. This separation does not make already-viewed historical data a fresh holdout. Overlapping calls inside either partition can remain dependent. No statistical significance or untouched-holdout claim is made.

## Prepare inputs known at the call

For versioned feature histories, run:

```powershell
node backtester/scripts/build_gold_asof_dataset.js INPUT_FEATURE_HISTORY.json OUTPUT_TIMESTAMPED_DATASET.json
```

The input retains the same `config`, `calls`, `candles`, and `data_kind`, and adds:

```json
{
  "feature_contract": [
    { "name": "F1", "required": true, "max_age_ms": 7200000 }
  ],
  "feature_records": [
    {
      "name": "F1", "value": "BULLISH",
      "observed_at": "2024-01-08T13:00:00Z",
      "available_at": "2024-01-08T13:30:00Z",
      "source": "synthetic-format-example-only"
    }
  ]
}
```

For each call and feature, selection uses the latest observation already available at the decision, then the latest revision of that observation available at the decision. Future releases and later revisions cannot affect earlier calls. Maximum age is measured from `observed_at`, not the revision timestamp. Required/optional status and maximum ages must be chosen explicitly; the example's two-hour age is not a recommended market setting.

If the scheduled call supplies an earlier `inputs_available_at`, selection respects that cutoff instead of advancing it to the decision. Invalid or future cutoffs fail the build. The output records `feature_selection_cutoff`, and upstream `input_rejections` survive selection. These two behaviors have regression tests that failed before the 6 September corrections.

The builder replaces prefilled call features with selected records and records their provenance. Missing optional features remain absent. Missing required or ambiguous records produce `input_rejections`, which prevent the evaluator from scoring that call. Invalid source rows fail the build rather than disappearing from the audit. Output can be passed directly to both timestamped and chronological commands.

This builder selects supplied inputs; it does not derive factor signals from raw data, regenerate the call direction, or verify that a supplied prediction came from those factors. Historical factor signals and call lineage still need authentic evidence. The existing Gold replay logic remains unchanged.

Chronological pair diagnostics also report Pearson correlation of factor votes encoded bullish=1, neutral=0 and bearish=-1, omitting missing votes. Correlation is null for constant or insufficient series. This describes shared movement; it does not justify a weight change or independent-trial assumption.

## Still needed for executable testing

Actual Gold call/feature timestamps and price provenance are needed to run the strict path on real evidence. Trade-level validation additionally requires a frozen entry rule, contemporaneous L2L/0.5 L2L levels, stop/adverse boundary, bid/ask and spread data, and enough price resolution to determine target/stop ordering. Neither these tools nor the synthetic example establish that stage as complete.
