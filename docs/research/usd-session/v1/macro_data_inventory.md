# Macro data inventory, acquisition and as-of-cutoff preparation (2026-10-13)

Task 1 of this cycle: the target-independent macro work, started without waiting for any frontier report and
without inventing a single economic rule. Nothing here chooses a sign, a threshold, a candidate or a score.

## 1. What was done

- A declared catalogue of 22 target-independent series, `backtester/lib/usdsession/macro_series.js`, each
  carrying its provider, series id, frequency, units, **publication schedule with the page it was verified
  on**, its revision note, and the alignment rule that turns it into a value observable at 05:00
  Europe/London.
- An acquisition and alignment command, `backtester/scripts/build_macro_asof_inventory.js`, which downloads
  each series once into the ignored `backtester/tmp/usdsession-macro-cache/`, hashes the cached bytes, and
  builds one as-of row per London business day.
- Two committed artefacts: `data/research/usd-session/macro-data-inventory.json` (per-series facts, timing,
  revisions, missingness, staleness, cache hash) and `data/research/usd-session/macro-asof-frame-summary.json`
  (what the frame contains, its hash, per-column missingness and staleness).
- The frame itself, 725 rows x 22 columns from 2024-01-02 to 2026-10-12, stays in local evidence at
  `backtester/tmp/usdsession-macro-asof-frame.json` (sha256 `511583e0f3e1...`). It is not committed, because it
  is an alignment artefact for the dataset build that still needs Reviewer B's approved design, not a frozen
  dataset.
- Reused rather than rebuilt: the FRED CSV fetch-and-cache convention, the FRED parser and the sha256 helper
  come from `backtester/lib/usd24h/acquire.js`; the cutoff instant and the DST rules come from
  `backtester/lib/usd_session_engine_interface.js` (whose transition table was extended to 2023, additively,
  so a 2023 warmup can resolve; its guard against an undeclared year is unchanged and still tested).

## 2. The measured finding that matters

Publication timing is not the same thing for every series, and the difference is large at a 05:00 London
cutoff. Measured over every London business day in the window:

| Family | Series | Staleness at the cutoff (business days, min / median / max) |
| --- | --- | --- |
| Federal Reserve **H.10** (bilateral rates and the dollar indexes, including the collector's `dxy_level`) | `DEXUSEU`, `DEXJPUS`, `DEXUSUK`, `DEXCAUS`, `DEXSZUS`, `DEXSDUS`, `DTWEXBGS`, `DTWEXAFEGS` | **2 / 4 / 6** |
| Federal Reserve **H.15** interest rates | `DGS2`, `DGS3MO`, `DGS10`, `DFII5`, `DFII10`, `T5YIE`, `T10YIE` | 1 / 1 / 2 |
| Market close series | `VIXCLS`, `SP500`, `NASDAQ100`, `SOFR`, `BAMLH0A0HYM2` | 1 / 1 / 2 |
| Energy | `DCOILWTICO` | 1 / 1 / 4 |

Why the H.10 family is so stale: the Federal Reserve states, on its own H.10 release page, that it "releases
daily bilateral exchange rates and U.S. dollar indexes for the previous business week" **on Mondays at
4:15 p.m.** (verified 2026-10-13 at `https://www.federalreserve.gov/releases/h10/`). So at a Monday morning
cutoff the newest published value predates the weekend, and on a Friday cutoff it is the previous Friday's
value: six business days old.

This corrects a claim carried in the first checkpoint: `inventory.md` and the closed study's manifest describe
`dxy_level` (`DTWEXBGS`) as having a "1-2 business-day" lag. That is the *FRED refresh* lag, not the
availability lag at the cutoff. The measured availability lag is 2 to 6 business days. The consequence is
concrete: any factor that reads the dollar index at the cutoff is reading a value published up to a week and a
half earlier, and the study's `dxy_level`-based features inherit that. The closed study's own numbers stand as
the answer to its own question; this note only fixes the description of the input.

## 3. Publication timing, revisions, missingness and availability, per series

`macro-data-inventory.json` carries, for every series: the release, the verified schedule and its source page,
whether the timing was actually verified (`publication.timing_verified`), the revision note and whether it was
read on that series' own page, the observation count, null values, missing-in-frame cells, first and last
observation dates, the largest calendar gap, the as-of rule in words, the staleness histogram and the hash of
the cached bytes.

Two honesty flags are recorded rather than smoothed over:

- **Timing verified: only the H.10 family.** For the H.15, market-close and policy-rate families the page
  confirms the frequency but the exact publication time was not captured in this cycle, so the alignment uses
  a declared one-business-day lag, labelled as an assumption in the file rather than presented as a schedule.
  This must be re-verified before any live use.
- **Revisions: latest published values only.** No vintage or first-print series is used anywhere in this
  work. FRED shows "All data are subject to revision" on the two series pages read in full (`DTWEXBGS`,
  `DEXUSEU`); for the other series the same note is assumed but was not read on that page, and the file says
  so per series.

Live versus historical availability is recorded per series as `live_collector_path`. Five of the 22 series
have a live collector path today (`DGS2`, `DGS10`, `DFII10`, `VIXCLS`, `DTWEXBGS`, all extracted from
`inventory.md` section 2); the other seventeen exist historically through FRED with no live path. That is the
gap any later implementation has to close explicitly.

## 4. What this does not do

- No rule, sign, threshold, weight, candidate or probability is defined here, and no forecast is scored.
- The frame is not an outcome dataset: it has no label, because the label instrument is still the open
  decision recorded in `target_source_assessment.md`.
- The H.10 staleness finding is evidence about the *description* of the live inputs. It does not by itself
  authorise a change to the live collector or to the closed study, and none was made.
