# H1 evidence acquisition — 2026-11-20

Research only. This note records what happened when the eight missing H1 evidence inputs were attacked
directly: which series each one needs, which agency actually publishes it, whether that agency answered,
what the audit now measures per input, what is still missing, and the two rules that fail on their own
terms. Nothing here weakens a threshold: where a rule cannot be met the input stays blocked and the
reason is named.

## 1. What changed in one line

Six of the nine inputs now carry imported evidence (`vix`, `front`, `real`, `broad`, `qqq`, and `ice`
under H1-A01). `gold`, `spread` and `calendar` are still absent, so **0 of 725 mornings are eligible**
and `earliest_eligible` stays `null`. The claim "no eligible morning" is unchanged; the reason is now
three inputs rather than nine, and every one of those three has a named source and a named next step.

## 2. The eight inputs

| Input | Series the contract asks for | Where it is recoverable | Historical availability evidence | Coverage now | Next action |
| --- | --- | --- | --- | --- | --- |
| `vix` | Cboe VIX spot close, latest completed close | `cdn.cboe.com` daily `VIX_History.csv` | every close back to 1990; the 2026-11-20 fetch returned 475,063 bytes and 9,320 daily closes | **725 of 725**, clocked and identified | none — the sealed lane still needs a receipt |
| `front` | H.15 DGS2, five completed intervals | Federal Reserve `datadownload` H.15 matrix, series `RIFLGFCY02_N.B` | one CSV per year; the fetch returned every business day from 2023-01-03 with the 2-year column present | **725 of 725** | none |
| `real` | DFII10, five completed intervals | U.S. Treasury *Daily Treasury Real Yield Curve*, 10 YR column | yearly CSVs for 2023-2026; the H.15 matrix fetched the same day carries **no** real-yield column | **725 of 725** under H1-A02 | owner sign-off on the amendment |
| `broad` | H.10 DTWEXBGS, five intervals, simple return | Federal Reserve H.10 weekly release pages, memo row `1) BROAD` | every weekly release is served at its own dated URL with its release date and five daily values; 153 pages read, 18 holiday Mondays resolved through the Tuesday release | **564 of 725** | decide the 192-hour freshness rule (§4) |
| `qqq` | Nasdaq official QQQ close, five intervals | Nasdaq quote API historical table | 725 official closes returned for the window on 2026-11-20 | **725 of 725** | none |
| `ice` | the dollar index at 05:00 London | archived DXY.cash hourly tape (H1-A01) | 10,052 bars from 2024-12-10 | **455 of 725**, only after the tape starts | extend the tape or collect live |
| `spread` | DGS2 minus Bundesbank Svensson 2.0-year | H.15 (readable) **and** the Bundesbank BBSIS CSV (readable, 233,452 bytes) | both operands answer; no Bundesbank release-time statement can be cited | **0 of 725** — no publication clock | cite a Bundesbank release time, or collect live with a receipt |
| `gold` | LBMA Gold Price PM USD, five fixings | `prices.lbma.org.uk/json/gold_pm.json` | **unreachable**: 403 with a 4,546-byte block page on every attempt (http and https, browser and non-browser user agent, with and without referer, HTTP/2 and HTTP/1.1) | **0 of 725** | obtain LBMA data access or a licensed feed |
| `calendar` | release count in `[cutoff, endpoint)` for five release families | BLS API and release archive, BEA schedule, Federal Reserve FOMC calendar — all readable | schedules are readable, but they are published months before the window they describe | **0 of 725** — the 24-hour freshness window cannot be met | decide the freshness rule (§4), then import |

## 3. How the acquisition works

`node scripts/acquire_h1_evidence.js --keys vix,front,real,qqq,broad --import` does four things and
nothing else:

1. reads the exact source file for each input into `backtester/tmp/h1-raw/` (untracked) and writes
   `data/usd-layer1-backtester/h1-v1/raw-<input>.json` with the URL, HTTP status, byte count and
   sha256 of every file it read;
2. parses the raw file into dated observations;
3. stamps every observation with two reconstructed clocks — the instant the value is determined, and
   the publisher's stated release time on the stated release day converted to UTC in the publisher's
   own zone — and records the rule id and the margin to the 05:00 London cutoff on every record;
4. writes a staging bundle and hands it to `scripts/import_h1_evidence.js`, which is the only path that
   writes into `data/`.

The clock policy is stated once, in `lib/layer1_backtesting/h1_acquire.js`:

- a historical record has no receipt, so `received_at_utc` is `null` on all 4,080 imported records;
- the publication clock is reconstructed from the publisher's stated release time, never a receipt;
- the margin between that clock and the cutoff is published per record, so a late print is visible;
- observed ≤ published ≤ cutoff is enforced when the record is built, not only when it is audited.

Recorded margins: 7.75 hours minimum (a same-day 16:15 ET print before a 05:00 London cutoff) and
79.75 hours for the daily inputs; 175.75 hours maximum for the broad dollar, whose weekly release is
the oldest evidence in the set.

### 3.1 The five clock rules

| Rule id | Statement used | Consequence |
| --- | --- | --- |
| `cboe_eod_close` | Cboe publishes the daily VIX close after the US cash close, usually 16:15 ET | the prior session's close is always in hand at 05:00 London |
| `h15_same_day` | the Federal Reserve publishes H.15 at 16:15 ET on the release day | only the *previous* business day's print can be used at a 05:00 cutoff, which is what the builder does |
| `treasury_eod_close` | the Treasury publishes the real curve after 15:30 ET; 16:15 ET is the later of the two | as above |
| `nasdaq_official_close` | Nasdaq publishes the official close after 16:00 ET; 16:15 ET is used | as above |
| `h10_weekly_release` | H.10 is published on Monday at 16:15 ET, covering the previous business week | a Monday cutoff sees the release from the *previous* Monday, so the newest observation is 9 to 10 days old — see §4 |

### 3.2 The first published value wins

Evidence is assembled from the release that was in hand, not from a consolidated history that may
since have been revised. The H.10 walker reads the weekly page published in the week *after* an
observation, and `mergeObservations` keeps the earliest publication of each date, so a later revision
can never leak backwards. The Treasury, H.15, Cboe and Nasdaq files are first-publication series by
construction.

### 3.3 H1-A02 — the publisher of record for the real yield

The supplied `inputs.json` names the Federal Reserve H.15 and the instrument `DFII10`. H.15 publishes
eleven *nominal* constant-maturity yields and no real yield at all — the matrix fetched on 2026-11-20
is the evidence. `DFII10` is the Treasury's 10-year constant-maturity real yield, so the amendment
records the publisher of record and changes nothing else: same instrument, same transform, same
96-hour window. It is a labelling correction, not a substitution, and it is filed as
`proposed_pending_owner`, not as accepted.

## 4. Two rules that fail on their own terms

Neither is applied. Both are recorded here and in the audit's `next_data_action` so the owner decides.

**H.10 and the 192-hour window.** The `broad` input allows 192 hours of freshness. The H.10 release
cadence makes the newest observation 224 to 248 hours old at a Monday 05:00 cutoff, because the release
that lands on Monday morning is published at 16:15 ET — after the cutoff. 161 of 725 mornings are
blocked for this reason alone. The measured ladder shows `fresh 564 / clocked 725 / identity 725`:
nothing but the freshness rule is failing. Raising 192 to 240 would make those mornings eligible, which
is exactly why it is not done here: it is a threshold change and needs a decision, not a patch.

**Calendar freshness.** The `calendar` input measures freshness on the record's `observed` clock with a
24-hour window. A release schedule is published weeks or months before the window it describes, so no
correct calendar can pass. The transform ("scheduled release count in `[cutoff, endpoint)`, complete
archived schedules required") is answerable from the BLS/BEA/Fed archives today; the freshness rule is
what blocks it. The candidate is to measure that input's freshness on the schedule *vintage* (published
at or before the cutoff) rather than on its age. Again: a decision, not a patch.

## 5. The ladder after the acquisition

| Input | present | original | lookback | fresh | clocked | identity | eligible |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `vix` | 725 | 725 | 725 | 725 | 725 | 725 | **725** |
| `front` | 725 | 725 | 725 | 725 | 725 | 725 | **725** |
| `spread` | 661 | 0 | 0 | 0 | 0 | 0 | 0 |
| `real` | 725 | 725 | 725 | 725 | 725 | 725 | **725** |
| `broad` | 725 | 725 | 725 | 564 | 725 | 725 | **564** |
| `ice` | 455 | 455 | 455 | 455 | 455 | 455 | **455** |
| `gold` | 704 | 0 | 0 | 0 | 0 | 0 | 0 |
| `qqq` | 725 | 725 | 725 | 725 | 725 | 725 | **725** |
| `calendar` | 725 | 0 | 0 | 0 | 0 | 0 | 0 |

`present` still counts a legacy field, which is why `gold` shows 704 and `spread` 661 while neither has
a single original observation. Ready mornings remain **0 of 725** and `earliest_eligible` stays `null`:
a morning needs all nine inputs, and three are absent. The morning of 2024-03-26 now names four
blockers instead of nine — `spread`, `ice` (its tape starts on 2024-12-10), `gold` and `calendar`.

## 6. What is still unproven

- **No eligible morning.** 0 of 725, unchanged. Three inputs, one of them unreachable from this
  environment, and two rule decisions stand in the way.
- **No receipts.** Every historical record has `received_at_utc: null`. Sealed live replay is 0 of 725.
- **Late-print rejection is still untested.** The reconstructed clocks assume the stated release times
  were met; the margin is published so the assumption is visible, and nothing yet proves the gate would
  refuse a late print.
- **Predictive performance is untouched.** Pooled accuracy stays 51.93 / 49.74 / 49.93 per cent with
  every interval spanning 50. Acquiring inputs does not create an edge.

## 7. Reproduction

```
node scripts/acquire_h1_evidence.js --status
node scripts/acquire_h1_evidence.js --keys vix,front,real,qqq,broad --import
npm run h1:evidence:check
npm run screen:backtesting
npm run test:usd-session
```

`--offline` rebuilds from the cached raw files in `backtester/tmp/h1-raw/`; the sha256 of every file is
in `data/usd-layer1-backtester/h1-v1/raw-<input>.json`, so a re-fetch can be compared against what was
imported. `tests/h1_acquire.test.js` covers the clock arithmetic (including the daylight-saving
boundary), the five parsers, the first-publication rule, the lookback refusal and the H.10 holiday
fallbacks, all offline.


