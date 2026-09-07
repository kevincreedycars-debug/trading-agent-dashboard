# Gold stored-call pilot — 6 September 2026

## Finding that changes the next priority

The active `Data Collector - GOLD` workflow reads `market_snapshots` with `getAll`, `limit: 25`, and no ordering or date filter. On 6 September, a read-only reproduction returned rows from **6–9 June**. The collector sorts only after those 25 rows are returned, making the 9 June Gold price **4266.066004573223** its newest reference.

Of 147 distinct snapshots linked to the exported Gold calls, **143 imply the same 4266.066005 reference price** in `gold_d1_pct` from 10 June through 6 September. The relationship is computed as `gold_price / (1 + gold_d1_pct / 100)`, grouped to six decimals. This explains why the apparent daily Gold trend can remain large and active across many days. It is not a valid daily-return history.

All **154 stored outputs reproduce their recorded ten factor signals and directions** when the existing Gold replay is run against their linked snapshot inputs. That establishes replay parity, not input quality. Do not use the pilot to calibrate weights before correcting and validating collection.

A separate counterfactual replaces only the stale Gold one-day input with the latest prior-date snapshot price stored by each snapshot's availability cutoff. With unchanged weights, **97 of 154 F5 signals and 19 final direction labels change**. This measures the defect's decision impact; no improvement in outcomes was tested and no historical output was rewritten. Same-day and later-arriving records, including microsecond ordering, are excluded. The prior snapshot date is still not an authenticated daily close.

Read-only n8n inspection confirmed production workflow `0z71FpOfKdL72hgW`, name `Data Collector - GOLD`, active, last updated `2026-06-18T19:44:31.835Z`. The normal Master Orchestrator (`X75RKU34ikiM5RMU`) calls this workflow. Two TEST Gold collector variants also exist, one active; the active TEST collector is called by the TEST isolated orchestrator. All three collectors have subworkflow triggers, with no schedule trigger observed. TEST workflow ownership/use remains an operator question. No workflow was changed or executed.

## Reviewable repair

The local [history query patch](../drafts/gold_collector_history_query_patch.json) changes only the history node parameters. It requests all paginated rows within the preceding 60 calendar days, orders by date/time/id at the server, and selects only the fields used for snapshot history. The existing per-date normalization and credentials remain in place.

A read-only equivalent query returned **543 rows across 49 dates**, newest **5 September**, with Gold price **4430.051698703324**. The old unordered limit returned **9 June** as its newest row. This verifies the database query, not an n8n import or execution. The patch remains unapplied.

The current n8n [Supabase node implementation](https://raw.githubusercontent.com/n8n-io/n8n/master/packages/nodes-base/nodes/Supabase/Supabase.node.ts) supports string filters and paginated retrieval. Verify the installed runtime in isolation before deployment. Sixty calendar days is a bounded retrieval window, not a guarantee of twenty trading-day observations. Existing shorter-history fallback and snapshot-day versus trading-day semantics remain separate issues.

## Evidence acquired

- 154 stored GOLD Layer 1 outputs, 7 June–6 September 2026; 77 distinct storage dates.
- Ten factor signals per output; all snapshot links resolve to a row stored before the output, including microsecond ordering checks.
- 147 distinct linked snapshots; seven reused snapshot groups.
- 76,143 unique completed OANDA XAU_USD one-minute candles; 40 GET requests. Raw bid/ask/mid responses, request bounds, timestamps and SHA-256 hashes retained locally.
- No warehouse writes, workflow activation, prediction publication, credential changes or weight changes.

OANDA defines M1 as minute-aligned candles, `time` as the candle start, OHLC as first/highest/lowest/last prices in the interval, and `complete` as a candle whose end is no longer in the future. The adapter preserves these semantics and rejects malformed prices and conflicting duplicate pages. [OANDA candle definitions](https://developer.oanda.com/rest-live-v20/instrument-df/)

The OANDA instrument feed is explicitly separate from the Coinbase prices used by the legacy collector. This is a directional comparison on OANDA, not a reconciliation of both vendors or MT5 fill evidence.

## Experiment and results

The research protocol was recorded before downloading the matching candle archive: database storage time is the availability proxy; enter at the next minute boundary; evaluate 24 elapsed hours later; midpoint basis; 0.3 percentage-point flat threshold. Original microsecond storage timestamps are preserved, and availability rounds upward to a millisecond. The August 1 split and one-day embargo were recorded before computing aggregate outcomes. No untouched-holdout claim is made.

| Check | Result |
| --- | --- |
| Strict contiguous candle path | 0 of 154 evaluable |
| Exact entry and horizon endpoints | 97 of 154 evaluable |
| Endpoint result counts | 45 correct, 37 wrong, 13 flat, 2 no-call |
| Endpoint accuracy, excluding flat/no-call | 54.88% on 82 calls |
| Always bullish on the same 82 calls | 52.44% |
| Earlier-period accuracy | 68.00% on 50 directional calls |
| Later-period accuracy | 34.38% on 32 directional calls |
| Earliest call per snapshot | 53.16% on 79 directional calls; equals always-bullish baseline |
| Greedy nonoverlapping schedule | 58.33% on 24 directional calls; still small and not independent-trial evidence |

The 57 endpoint rejections comprise 18 missing exact horizon candles, 18 missing exact entry candles, and 21 windows with no candles. All 97 endpoint-evaluable windows contain interior gaps. OANDA documents a daily XAU/USD break and weekend closures, but these gaps were **not individually authenticated as scheduled closures** and are never filled. Endpoint-only direction evaluation does not validate stops, targets or path sequencing. [OANDA trading hours](https://www.oanda.com/uk-en/trading/hours-of-operation/)

The nonoverlap and earliest-snapshot diagnostics select source calls before considering outcome availability; a rejected selected call is not replaced by a successful later one. These cohort diagnostics were added after the initial aggregate was observed. All counts remain descriptive.

Chronological analysis covers all ten factors and 45 pairs, including signal correlation with bullish=1, neutral=0, bearish=-1. Constant factors have undefined correlation. F1 falls from 21/29 correct earlier to 1/6 later; F2 falls from 23/38 to 10/25. F8 and F9 have no active observations. Small or inactive samples do not support a weight change.

## Reproduction

Raw evidence is in ignored `backtester/tmp/`, not published in the dashboard. Credentials are supplied only through process environment variables; commands never print them. The existing encrypted local store was used for the read-only acquisition.

```powershell
node backtester/scripts/export_gold_stored_calls.js PROTOCOL.json NEW_EXPORT_DIRECTORY
node backtester/scripts/export_gold_snapshot_history.js AS_OF_ISO NEW_HISTORY.json
node backtester/scripts/download_gold_timestamped_candles.js DATASET.json NEW_CANDLE_DIRECTORY
node backtester/scripts/build_gold_stored_call_pilot.js DATASET.json ANALYSIS_PROTOCOL.json NEW_REPORT.json
node backtester/scripts/build_gold_snapshot_lineage_audit.js STORED_CALLS.json SNAPSHOT_INPUTS.json NEW_REPORT.json
node backtester/scripts/build_gold_history_repair_impact.js STORED_CALLS.json SNAPSHOT_INPUTS.json SNAPSHOT_HISTORY.json NEW_REPORT.json
```

Session inputs:

- `backtester/tmp/gold-stored-20260906/stored-calls.json`
- `backtester/tmp/gold-stored-20260906/snapshot-inputs.json`
- `backtester/tmp/gold-stored-20260906/analysis-protocol.json`
- `backtester/tmp/gold-stored-20260906/live-history-probe.json`
- `backtester/tmp/gold-stored-20260906/history-replacement-probe.json`
- `backtester/tmp/gold-stored-20260906/trigger-lineage-probe.json`
- `backtester/tmp/gold-oanda-20260906/dataset.json`
- `backtester/tmp/gold-oanda-20260906/manifest.json` and `oanda-001.json` through `oanda-040.json`

Reviewable summaries:

- `data/gold-stored-call-pilot-20260906.json`
- `data/gold-snapshot-lineage-audit-20260906.json`
- `data/gold-history-repair-impact-20260906.json`
- `data/gold-history-query-audit-20260906.json`
- `gold-backtesting.html`

Rebuild the combined local page:

```powershell
node backtester/scripts/build_gold_evidence_audit.js data/backtester-checker-gold-24h-2024-2026.json data/gold-evidence-audit.json gold-backtesting.html data/gold-stored-call-pilot-20260906.json data/gold-snapshot-lineage-audit-20260906.json
```

## Remaining gates

1. Validate the history repair in an isolated n8n execution, review active TEST collector ownership, then obtain production deployment authorization.
2. Audit input semantics and begin a fresh observation period after collection is corrected. Preserved bad inputs/results are not overwritten or silently retimed.
3. Record authenticated publication and raw-feature release/availability times. Database `created_at` proves only a supplied storage-time proxy; current rows are not an immutable historical log.
4. Supply contemporaneous L2L levels, explicit entry/target/stop rules and MT5-aligned spread/path/fill evidence for trade-level testing.
