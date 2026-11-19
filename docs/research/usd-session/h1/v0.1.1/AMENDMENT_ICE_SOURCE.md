# H1 `ice` source amendment · v0.1.1 `H1-A01`

18 November 2026 · research only · supersedes the ICE-licensing requirement for the H1 `ice` input

The owner decided that **no ICE licence is required**: reuse the DXY dataset the project already
acquired, amend H1's DXY input to that verified source, and record every difference in calculation and
sampling. This memo does that, checks the data before importing it, and lists only the gaps that
genuinely remain.

`USD-L1-25F-H1-v0.1.0` is preserved byte for byte. Nothing in the frozen package, its `SHA256SUMS`,
`expected.json`, `models.js`, `inputs.json` or `RULEBOOK.md` was edited: `node verify.js` still exits 0.
The amendment is applied in code by `lib/layer1_backtesting/h1_source_amendments.js`, which also refuses
to apply if the supplied `inputs.json` row for `ice` ever stops matching what the amendment claims to
replace.

## 1. The dataset: what it is, who provides it, and what it covers

| Property | Value | Evidence |
|---|---|---|
| Provider | FTMO Global Markets Ltd · server `FTMO-Server` · terminal build 6231 | `backtester/tmp/ftmo_dxy_cash_h1.provenance.json` |
| Instrument | `DXY.cash`, described by the broker as "Dollar Index, Spot CFD", 3 digits, USD base | same |
| Instrument kind | `broker_cfd` · **`is_official_cash_dxy: false`** | same |
| File | `backtester/tmp/ftmo_dxy_cash_h1.csv`, 770,380 bytes, columns `timestamp,server_timestamp,open,high,low,close,volume` | 10,052 bars |
| SHA-256 | `c68757cbbfb202c35cc477e71a22cb7649b54758321cd9aa138e4231bde40d5f` | re-hashed this session; the evidence builder refuses to run on a mismatch |
| Rows | 10,052 one-hour bars | `readHourlySeries` |
| Coverage | first bar `2024-12-10T13:00Z`, last bar `2026-11-11T20:00Z` (bar-opening instants, UTC) | same |
| Export | `2026-11-11T20:50:59Z`, exporter `backtester/scripts/export_ftmo_dxy_cash.py` | same |
| Timestamps | terminal stamps bars in **server** time; the exporter converts to UTC (UTC+2 outside US DST, UTC+3 inside) and proves the shift against the UTC EUR/USD tape | four recorded clock checks, winter 2025, summer 2025, winter 2025-11, summer 2026: `observed_shift_hours` equals `expected_shift_hours` in all four, corr −0.967 … −0.977 |

What it is not: the ICE cash index (no official settlement print, broker hours, broker spread) and not
FRED `DTWEXBGS`. Both facts are published on every record via `sampling.source_kind` and
`sampling.official_index`.

## 2. The amendment

| Field | v0.1.0, supplied | v0.1.1 `H1-A01`, applied |
|---|---|---|
| Source | `ICE` | `FTMO Global Markets Ltd` |
| Instrument | `US Dollar Index spot` | `DXY.cash (spot CFD on the dollar index basket)` |
| Transform | previous eligible London 05:00 fixing to current 05:00, simple return in percent | previous eligible London 05:00 price to current 05:00, simple return in percent |
| Freshness (hours) | `0` | `0` — **unchanged** |
| Previous-eligible cap | implied by "eligible" | 4 calendar days, published as `max_lookback_days` |

The freshness window was **not** relaxed. The amended observation is the close of the one-hour bar that
**ends** at the 05:00 London cutoff, so `observed_at_utc` equals the cutoff by construction and age is
exactly zero. A morning without its own 05:00 bar is blocked; it is never covered by a stale print.

## 3. Differences in calculation and sampling

1. **Source identity.** A broker spot CFD quote stream replaces the official ICE spot print. Levels are
   not comparable across the two instruments; only the simple return is used.
2. **Sampling.** The observation is the close of a completed one-hour bar, not a single official fixing.
   The bar's last tick is the 05:00:00 London price.
3. **Bar convention.** This input reads the bar that **ends** at the cutoff (04:00–05:00 London). Test 1's
   DXY lane reads the bar that **opens** at the cutoff (05:00–06:00 London) at both endpoints, because an
   outcome may be measured after the fact. The two lanes are shifted by one hour and must never be quoted
   as one series. This is the one place where the amendment deliberately diverges from test 1's arithmetic,
   and it diverges in the only direction that is leak-free at a 05:00 decision.
4. **Previous-eligible interval.** 24 h on a normal weekday, 71–73 h across a weekend (DST shift included),
   48 h across a 25 December / 1 January boundary, 96 h across Good Friday → Easter Monday. Every record
   publishes its own `sampling.gap_hours`, so a three-day return is never presented as a one-day return.
5. **Missing bars.** No bar exists on a weekend, exchange-holiday or broker-closed 05:00 boundary. Such a
   morning is absent from the evidence file. Nothing is borrowed from a neighbouring hour, interpolated or
   filled forward.
6. **Clock.** `observed_at_utc` = `published_at_utc` = the bar-completion instant = the cutoff.
   `received_at_utc` is `null`: a retrospective export is a **completion clock, not a receipt**. The
   historical-reconstruction lane is therefore reachable and the sealed lane is not.
7. **Quote quality.** Broker spreads, broker hours and three-decimal quoting replace an official settlement
   print.

Consequence for the frozen model: the `ice` row's input changes instrument. The arithmetic, the sign, the
threshold and the weight are untouched. H1 remains unscored, because eight other inputs still block.

## 4. Checks run before importing

The builder (`node scripts/build_h1_ice_evidence.js`) answers, for every one of the 725 published
mornings, whether the tape carries **both** required observations. Only mornings that pass become records.

| Check | Result |
|---|---|
| Sessions examined | 725 (2024-01-02 → 2026-10-12) |
| Records written | **455** (`data/usd-layer1-backtester/h1-v1/ice.json`, valid · 455 records) |
| Sessions excluded | **270**, each with a recorded reason |
| `observed == published` on every record | true |
| Two operands on every record | true |
| Largest previous-eligible gap | 96 h (cap 4 days, never exceeded) |
| Freshness window used | 0 h, unchanged from v0.1.0 |

The 270 exclusions are fully accounted for:

| Reason | Count | Detail |
|---|---|---|
| Before the tape's first usable 05:00 bar | 246 | sessions 2024-01-02 → 2024-12-10; the tape starts 2024-12-10 13:00Z, so 2024-12-11 has no *previous* eligible print inside the cap, and 2024-12-12 is the first record |
| The archive's 2025-06 hole | 17 | the tape jumps `2025-06-06T20:00Z` → `2025-07-01T00:00Z`, a **580-hour** hole; every morning 2025-06-09 … 2025-07-01 is unpriceable |
| Exchange holidays with no 05:00 bar | 6 | 25 Dec 2024, 1 Jan 2025, 18 Apr 2025 (Good Friday), 25 Dec 2025, 1 Jan 2026, 3 Apr 2026 (Good Friday) |
| First day of the tape | 1 | 2024-12-11: current bar exists, no previous eligible print inside the cap |

In-window coverage is therefore 455 of 479 sessions (95.0%). Whole-sample coverage is 455 of 725 (62.8%).

**The 580-hour hole is a genuine defect in the acquired dataset.** It is not a weekend, not a DST shift
and not our exclusion rule: 24 consecutive days carry no bar at all. It is reported rather than patched,
and those 17 mornings stay blocked. Refreshing the export is the only fix, and a refresh cannot recover
history the broker no longer serves — the hole must be re-checked against any new export before those
mornings are claimed.

Weekend and DST handling is visible in the record set rather than asserted: 359 records span 24 h, 87 span
72 h (Friday → Monday), 2 span 71 h and 1 spans 73 h (both across a DST switch), 4 span 48 h (26 Dec and
2 Jan, where the holiday itself has no 05:00 bar), and 2 span 96 h (Easter Monday).

## 5. What genuinely remains for this input

1. **270 mornings with no 05:00 bar** — 246 before the tape begins, 17 inside the June hole, 6 exchange
   holidays, 1 first day. No document fills these: they are absences in the source.
2. **No receipt on any of the 455 records** — the sealed live replay lane needs `published <= received <=
   cutoff` with a receipt recorded at the time. The fix is forward-looking: collect the `DXY.cash` 05:00
   bar close live at the cutoff and record the receipt. That is a collector, not a licence.
3. That is all. **ICE is not requested and is not required for the H1 `ice` input.**

## 6. What this does *not* change

- **Test 1's official lane** still has no official index series, so it still reports 0 scored and stays
  labelled. The amendment supplies an H1 *input*, not a test 1 *answer*: a broker CFD's 05:00 print cannot
  be published as the official index's answer. The 49.65% broker control keeps its own name and its own
  denominator.
- **H1 remains unscored.** 455 mornings now satisfy `ice`; eight inputs satisfy none, so 0 of 725 mornings
  is ready in either evidence lane. `node scripts/build_backtesting_screen.js` publishes
  `ready 0 / blocked 725` unchanged.
- **No threshold, sign, weight, band or trade rule moved.**


## 7. The other eight inputs: status and what the checkout already holds

"Continue acquiring" was checked against the local archives before any further request was written. Only
what exists is listed; nothing below was imported.

| Input | Contract | What is in the checkout | Verdict |
|---|---|---|---|
| `vix` | Cboe VIX spot close | ALFRED vintage archive `backtester/tmp/gold-fred-vintages-20260912/VIXCLS.json` (696 values, realtime 2024-01-02 → 2026-09-10); a date-level availability bound supports six prior prints on **719 of 725** mornings | Acquirable, but VIXCLS is FRED's alias for the Cboe close: it needs its own source amendment (like this one) and a derived 16:15 ET publication clock before import |
| `front` | Federal Reserve H.15 · DGS2 | same directory, `DGS2.json` (673 values, realtime 2024-01-03 → 2026-09-11); date-level bound supports six prints on **718 of 725** | Identity-correct: the contract already names the Fed. Not imported, because the export is date-only, so an importer must derive the H.15 16:15 ET release clock and publish that rule on every record |
| `real` | H.15 · DFII10 | `DFII10.json` (673 values, same window); **718 of 725** | As `front` |
| `broad` | H.10 · DTWEXBGS | `DTWEXBGS.json` (1,189 values, realtime 2024-01-08 → 2026-09-08); **714 of 725** | As `front`, with the H.10 Monday 16:15 ET release rule |
| `spread` | H.15 DGS2 − Bundesbank BBSIS 2.0y | `bundesbank-de-2y.csv` and `bundesbank-de-2y-observations.json` (daily Svensson 2.0y, retrieved 2026-11-13, source sha256 `fa7a184d…`) | Both legs are present; the two publication clocks must be reconciled and the common-interval rule stated |
| `gold` | LBMA Gold Price PM USD | nothing: the legacy field is derived from an OANDA XAU/USD quote | **Genuine gap.** An LBMA auction history is the only admissible source |
| `qqq` | Nasdaq official QQQ close | nothing: the legacy field is the Nasdaq-100 index | **Genuine gap.** Official QQQ closes are the only admissible source |
| `calendar` | BLS + BEA + Fed schedules | FOMC statements only (`data/usd-layer1-backtester/event-calendar-v1.json`) | **Genuine gap** for CPI, Employment Situation, advance GDP, Personal Income and Outlays |

The honest split is: `ice` is closed; four inputs are acquirable from local archives once a publication
clock is derived (`vix` also needs its own source decision); three are genuine data gaps. The next
acquisition step is `front`, because its contract identity already matches the archive and its publication
rule is the least ambiguous of the four.

## 8. Reproduction

```text
node scripts/build_h1_ice_evidence.js                   # verify sha256, rebuild the 455-record bundle
node scripts/import_h1_evidence.js --input ice --file backtester/tmp/h1-ice-dxy-cash-v1.json
node scripts/import_h1_evidence.js --check              # ice: valid · 455 records
node scripts/build_backtesting_screen.js                # rebuild the published payload
node scripts/build_backtesting_screen.js --check        # reproduces
node --test tests/h1_evidence.test.js tests/backtesting_screen.test.js tests/layer1_morning_run.test.js
cd backtester/packages/USD-L1-25F-H1-v0.1.0; node verify.js   # v0.1.0 unchanged, exit 0
```

The export itself lives in the git-ignored local cache (`backtester/tmp/`). The committed
`data/usd-layer1-backtester/h1-v1/ice.json` is the pinned artefact: it carries the tape's sha256, its bar
count and its first/last bar, so the values can be audited against any future export. On a checkout without
the tape the builder stops with "the DXY.cash tape is not present" rather than rebuilding from something
else.

Acceptance: `ice` reports `eligible 455 / blocked 270 / code partial_evidence`; every other input reports
`eligible 0`; `h1.coverage.ready` is `0`; `h1.coverage.gaps` still lists all nine inputs, because the
amended input still owes 270 mornings.

