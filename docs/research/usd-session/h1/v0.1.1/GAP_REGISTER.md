# H1 nine-gap register · after the v0.1.1 evidence-policy split

18 November 2026 · research only · coverage is not performance

The legacy archive is not empty. It is also not the H1 evidence contract. This register separates
what can be reused as a lead from what must be acquired as an original observation. It does not
count a named alias, a derived change or a proxy as the H1 operand.

Coverage after the split: **0 of 725 historical reconstructions ready; 0 of 725 sealed live
replays eligible.** The zero is a coverage fact, not a model result. H1 remains unscored.

**Decision 2026-11-18 — `H1-A01`, gap 6 closed as a data question.** The owner decided that no ICE
licence is required. The `ice` input is amended to the `DXY.cash` hourly tape the project already holds
(FTMO Global Markets Ltd, `broker_cfd`, sha256 `c68757cb…0d5f`), imported as 455 records covering 455 of
725 mornings. The fresh-zero-age rule is unchanged, because the amended observation is the close of the
bar that ends at the cutoff. Eight inputs still block every morning, so coverage stays 0 of 725. See
`AMENDMENT_ICE_SOURCE.md`. The row below records the gap as it stood before the amendment, then its
current state.

| # | Gap | Reusable legacy evidence | Remaining H1 requirement | Exact user action |
|---:|---|---|---|---|
| 1 | `vix` · Cboe VIX spot close | 717 of 725 mornings carry `vix_level`; 717 are named aliases, 0 are original Cboe observations. Eight mornings have no value. | Cboe official completed close, its publication time and the five-interval history where a change is used; observed and published by 05:00. | Provide the licensed Cboe VIX daily close history and its release timestamps, or authorise a collector that records them. Then run `node scripts/import_h1_evidence.js --input vix --file <file>`. |
| 2 | `front` · H.15 DGS2, five-observation change | 661 mornings carry `us_2y_d5_bps`; all are derived changes, 0 retain the six raw DGS2 observations. | Six DGS2 observations with ALFRED vintages, plus the publication time of the latest leg. | Provide the H.15/ALFRED DGS2 vintage extract. Import with `--input front`. |
| 3 | `spread` · DGS2 minus Bundesbank 2.0-year zero-coupon spot, five common observations | 661 mornings carry `us_de_2y_spread_d5_bps`; it is a derived alias, not the two original legs. | Six common-observation DGS2 and Bundesbank BBSIS 2.0-year zero-coupon observations, both vintaged; oldest latest leg within 96 hours. | Provide the Bundesbank BBSIS history and the matching H.15 DGS2 extract. Import with `--input spread`. |
| 4 | `real` · H.15 DFII10, five-observation change | 661 mornings carry `us_10y_real_d5_bps`; derived only. | Six DFII10 observations with vintages and the publication clock of the latest leg. | Provide the H.15/ALFRED DFII10 vintage extract. Import with `--input real`. |
| 5 | `broad` · H.10 DTWEXBGS, five-observation return | 690 mornings carry `broad_dollar_d5_pct`; derived only. | Six DTWEXBGS observations with vintages and the latest publication clock. | Provide the H.10/ALFRED DTWEXBGS vintage extract. Import with `--input broad`. |
| 6 | `ice` · amended to `DXY.cash` spot CFD, previous and current eligible 05:00 bar close | **Closed as a data question (`H1-A01`).** 455 of 725 mornings now carry two original, dated operands from the archived broker tape (95.0% of the 479 in-window sessions). 270 mornings have no 05:00 bar: 246 before the tape begins, 17 inside the archive's 580-hour 2025-06 hole, 6 exchange holidays, 1 first day. | A receipt at the cutoff for sealed live replay: `published <= received <= cutoff`, recorded live. No history can supply it. | Collect the `DXY.cash` 05:00 bar close live and stamp the receipt. Do **not** seek an ICE licence; import is already done (`data/usd-layer1-backtester/h1-v1/ice.json`). |
| 7 | `gold` · LBMA Gold Price PM USD, five-fixing return | 704 mornings carry `gold_d5_pct`, but it is derived from an OANDA XAU/USD quote, not the LBMA PM auction. It is an identity mismatch, not a reusable operand. | Six LBMA PM USD auction fixings with publication times and vintages. | Provide the LBMA Gold Price PM USD auction history. Import with `--input gold`. Do not relabel OANDA XAU/USD. |
| 8 | `qqq` · Nasdaq QQQ official close, five-close return | 704 mornings carry `nasdaq100_d5_pct`, derived from the Nasdaq-100 index, not the QQQ ETF close. Identity mismatch. | Six official QQQ closes, split-adjusted as known at each cutoff, with vintages. | Provide the Nasdaq official QQQ close history. Import with `--input qqq`. Do not substitute the Nasdaq-100 index. |
| 9 | `calendar` · BLS, BEA and Federal Reserve schedules | The staged calendar carries FOMC statements only. CPI, Employment Situation, advance GDP and Personal Income and Outlays are absent. | Complete archived schedules for all five release families, with release timestamps and a verified omission set for every session. | Provide complete BLS, BEA and Federal Reserve release archives for the five named families. Import with `--input calendar`. |

## What the legacy inventory does and does not buy

- It proves the archive has **present values** for seven of the nine inputs, which is useful for a
  gap estimate.
- It does not prove **original identity**, **lookback**, **freshness** or a **05:00 clock** for any
  input. Those are the four rungs that remain at zero.
- It contains two **wrong instruments** (`gold`, `qqq`). Those cannot be repaired by renaming.
- The `ice` gap is no longer a licensing gap: the archived `DXY.cash` tape is the amended source, and the
  only thing it cannot supply is a receipt. The four H.15/H.10 vintage extracts named in rows 1–5 exist in
  `backtester/tmp/gold-fred-vintages-20260912/`; each still needs a derived release clock before import.
- The legacy `0 of 725 clocked` count belongs to the old run-v1 gate. It is not H1 coverage and is
  not a substitute for this register.

## Import contract

Evidence lands at `data/usd-layer1-backtester/h1-v1/<input>.json`. The supported CSV columns are:

```text
session_date,value,observed_at_utc,published_at_utc,received_at_utc,vintage,original,operands
```

`operands` is a JSON array. Every operand needs `value`, `observed_at_utc` and `vintage`; calendar
operands also need `type`. `received_at_utc` is left empty for historical reconstruction. The
importer refuses a record with too few operands, a wrong source/instrument/transform, a future
publication or a malformed receipt. It never fills a timestamp.

```text
node scripts/import_h1_evidence.js --input <key> --file <csv|json>
node scripts/import_h1_evidence.js --check
node scripts/build_backtesting_screen.js
```
