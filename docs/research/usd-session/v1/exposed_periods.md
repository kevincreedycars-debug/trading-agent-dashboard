# Record of already-exposed evaluation periods

The user's instruction: *"Establish exactly which data periods and results have already been examined. An
opened holdout cannot be described as unseen for this new study."* This file is that record, taken from the
artefacts of the 2026-10-12 USD 24-hour study, which is kept as a **separate, completed experiment**.

## 1. The 24-hour study's own splits (already read)

Source: `data/usd-24h-baseline-comparison.json` → `splits`, `data/usd-24h-research-dataset.json` → `window`.

| Split | Window | Rows | Status |
| --- | --- | --- | --- |
| Warm-up (features only) | 2023-04-03 → 2023-12-29 | cache only | used for lookbacks |
| Development | 2024-01-02 → 2025-03-31 | part of 584 | **read**: candidate selection and fitting |
| Validation | 2025-04-01 → 2025-10-31 | part of 584 | **read**: selection key and tier |
| Holdout ("untouched" for that study) | 2025-11-03 → 2026-04-30 | part of 584 | **opened once, on 2026-10-12**, for the final comparison |

Dataset coverage, measured: 584 rows, 583 evaluable, 1 not (no endpoint observation); BULLISH 209 / FLAT 182
/ BEARISH 192; endpoint arrived exactly on the scheduled date on 559 rows and late on 24 rows (a declared
delay fallback of up to 3 calendar days); elapsed hours min 30.5, median 30.5, max 102.5.

## 2. What was exposed by reading those results

Once §1 is read, the following are **not** unseen for any later study that shares the same rows:

- the level and sign of every arm's accuracy per period: deployed engine 55.00 / 44.21 / 52.78,
  replayed engine 52.22 / 50.55 / 48.57, always-bullish 54.84 / 48.08 / 50.00, five-day contrarian
  46.08 / 56.73 / 56.25, five-day momentum 53.92 / 43.27 / 43.75, twenty-day momentum 47.00 / 47.12 / 51.25;
- the identity of the winner (L2 logistic, lambda 0.03: 61.75 / 55.77 / **46.25**) and of every loser across
  93 recorded configurations, including the ones that only looked good on development;
- the direction and rough size of the forward relation for the seven families (momentum weak and
  sign-flipping, relative rates small but positive, real yields contradictory, cross-asset contradictory,
  economic surprises not evaluable);
- the conclusion that the best single robust direction in the sample is the **fade of the trailing five-day
  dollar move**, with a holdout lower bound of 45.34;
- the shadow comparison over 2025-11-03 → 2026-04-30 (123 rows, 84 disagreements, 24/26 split).

Anyone who has read `docs/review/usd-24h-ruleset-v1/USD_24H_IMPROVEMENT_RESULTS.md` holds all of it. A new
study must therefore treat the 24-hour archive as **burned for confirmation**, usable for mechanism
exploration, feature engineering and pipeline testing, and never again as an unseen holdout.

## 3. Periods the repository has already spent elsewhere

| Period | Where it was used | Still available as "unseen"? |
| --- | --- | --- |
| 2024-01-02 → 2026-04-30 (USD daily) | the 24-hour study above | no |
| 2024-01-01 → 2026-04-30 (EUR/USD hourly, XAU/USD hourly, NAS100 hourly OANDA caches) | Gold/EUR research bundles (`backtester/tmp/gold-*`) | the USD-session label on them has **not** been opened; the caches themselves have been read for other assets |
| 2024-01-02 → 2026-04-30 (`data/backtester-checker-usd-24h-2024-01.json`, the live archive) | archived live calls, 6,040 factor entries compared to replay | no, for 24-hour questions |
| to 2027-03-25 (Gold prospective window) | declared sealed for Gold | yes for Gold, irrelevant to USD except as an example of how to seal |

## 4. What remains genuinely unseen for the new session target

1. **The 05:00→05:00 London intraday label itself.** No artefact in this repository has ever computed the USD
   change from 05:00 Europe/London on one local date to 05:00 Europe/London on the next local date for any
   date. Nothing about that label's distribution, persistence, flat rate or factor relations has been read.
   That is the only untouched target, and it is untouched only until the first exploratory table is printed.
   The closed 24-hour study is **not** this label: its interval runs from the 09:30 ET snapshot to the next
   16:00 ET close, which measured against this window overlaps it for 14.5 hours (15.5 in the weeks when New
   York changes before London), leaves the session's first 9.5 hours (New York time 00:00 to 09:30) uncovered,
   and runs a median 16 hours past the session's endpoint.
2. **Prospective days after 2026-04-30**, which the caches do not yet hold. These are the truly sealed
   observations, and they arrive one day at a time.
3. **Live intraday pairs not present in the caches** (EUR/USD after 2026-04-30, any DXY print at all).

## 5. Rules this record imposes on the new study

- Freeze the target, eligibility, missing-quote policy, ties, splits and scoring **before** any candidate
  is scored, and declare them in `session_contract_v1.json` plus the frozen evaluation design document.
- Exploratory reading of the new label's own distribution (counts, flat share, autocorrelation) is a
  one-time cost: once printed it must be added here, dated, and the number of exploratory looks recorded.
- Reserve the **tail** of the new label's history (a declared block, e.g. from 2026-01-01) and the
  prospective days as the independent confirmation set, and do not open the reserved block until final
  selection. If that is judged too small, say so plainly and rely on prospective confirmation instead.
- Every table that scores the deployed engine on the new label must state the horizon mismatch: the
  deployed engine was asked 09:30 ET → next 16:00 ET, never 05:00 London → 05:00 London on the next local
  date. The superseded 07-nominal-hour overlap figure is corrected to 14.5 nominal hours (15.5 in the weeks
  when New York changes before London), with 9.5 hours of the session never covered by the study and a median
  16 hours of the study's interval beyond the session's endpoint.
- Nothing in this record authorises deploying, activating or publishing anything.
