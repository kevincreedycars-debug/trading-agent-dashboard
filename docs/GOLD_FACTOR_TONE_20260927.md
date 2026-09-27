# Gold factor tone on the consumed intervals, 2026-09-27

Exploratory description of what the 28 measured Gold factors do to Gold's direction, taken from the accepted
single-variable report on the already-consumed 2023-2026 intervals. It reads like the archive reads: it can
describe this space, it cannot support choosing from it. No prediction, accuracy, timing, profitability or
trading edge is claimed, no new data was gathered, no Layer 1 logic was changed and the sealed prospective
window was not read.

Extractor: `backtester/scripts/report_gold_factor_tone.js` (tests: `backtester/tests/gold_factor_tone.test.js`).
Local evidence: `tmp/gold-factor-tone-20260927b.json`. Source: the accepted
`ivr-coverage-019-20260925-r2/individual-variable-report.json`.

## Method

- Scope: the daily cohort (`daily_snapshot_anchors`), the `all_computed` endpoint group, the two sign-relevant
  horizons in question, `h24_post_event` (the session) and `d5_trading_days_post_event` (the week), and every
  variable state, 62 state rows in total.
- The threshold question is asked two ways, because the first way alone is misleading here: does a state point
  the same way more than 60% of the time, and does it sit meaningfully above the cohort's own baseline for the
  same horizon? The baseline matters because Gold rose in 55.81% of the 24-hour windows (n=964) and in 58.23%
  of the five-session windows (n=960) with no conditioning at all, so a 60% week reading is close to drift.
- Year stability: each state's per-year rate is compared with the same year's baseline rate, and a state counts
  as stable only when that excess keeps its sign in every year with at least 20 observations.
- Excess is stated in percentage points (pp) against the cohort baseline. The two halves of a median split are
  complements of each other, so a variable counted twice is still one reading.

## What the numbers say

- **Nothing sets a 24-hour tone that survives the baseline test.** Of 62 state rows, exactly two reach an
  absolute excess of five points or more, and both are the `exact_zero` state of a five-session change variable
  with the smallest usable counts (`us_10y_real_yield_d5_bps` 68.09% positive, n=47, +12.28pp;
  `us_2y_d5_bps` 46.15% positive, n=39, -9.66pp). Neither is stable across years, and the second reverses on
  the week horizon (74.36% positive, +16.13pp), which is what a small cell does rather than what a driver does.
- **At usable counts the biggest 24-hour lean is about five points, not fifteen.** With n of at least 100 the
  strongest session excess is `risk_headline_context` above its own median: 60.51% positive, n=471, +4.70pp,
  with its mirror half at -4.49pp. Second is `usd_broad_index_level` above its own median: 59.38%, n=480,
  +3.57pp. Both are one variable read twice, and neither is year-stable.
- **The week horizon carries more than the session horizon, but still only two variables.** Five state rows
  clear five points of week excess at n of at least 30: both halves of `usd_broad_index_level` (+7.40pp above
  its own median, 65.63% positive, n=480, mirror -7.40pp) and both halves of `risk_headline_context` (+5.46pp,
  63.69%, n=471, mirror -5.26pp), plus the small `us_2y_d5_bps` exact_zero cell described above. At n of at
  least 100 the same reading holds with four rows, which is the same two variables.
- **Almost none of it repeats year after year.** Exactly one week-horizon excess keeps its sign in every year
  with at least 20 observations: `risk_headline_context` at or below its own median, a bearish lean of -5.26pp
  on the week horizon. No session-horizon excess is stable in that sense. That single survivor is one half of
  one variable, and it is a lean rather than a 60% direction.
- **A bullish reading does not reliably set a bullish week.** 59 of 62 states keep the same majority sign at
  both horizons, but that mostly reflects the shared bullish drift; once the baseline is removed, 46 keep the
  same excess sign and 16 flip between the session and the week. Three states flip majority outright
  (`us_2y_d5_bps` exact_zero, `inflation_signal` exact_zero, `vix_d1` exact_zero), all small cells.
- **Reading the 60% question literally:** one state clears 60% same-direction at n of at least 100 on the
  session horizon (`risk_headline_context` above its own median, 60.51% positive) and eight do on the week
  horizon, but six of those eight sit within about three points of the week baseline, and the other two are the
  pair already named. The 60% is mostly the drift speaking rather than the factor.

## What this means for the standing questions

- "Which factors consistently cause price to move, and is it predictable above 60%?" On this archive the
  measurable answer is a lean of a few points in a handful of places, mostly on the week horizon, and almost
  none of it is stable across years. The dominant fact is Gold's own upward drift over the consumed interval
  rather than a factor signature, and the archive cannot separate the two beyond description.
- "Does the factor set the tone for the session or the week?" Where a lean exists it is larger on the week
  horizon than on the 24-hour horizon, and the direction often does not carry from one to the other at the
  baseline-adjusted level. Nothing here says a bullish factor outcome reliably produces a bullish session, and
  only a weak reading says it edges the week.
- Consequence for Layer 1: nothing in this cut is strong or stable enough to justify changing live direction
  logic, which matches the instruction to establish influence before adjusting it.

## Limits

- Association only, on intervals already spent: every state shares anchors with the others, so the counts are
  dependent and no significance claim is supported.
- Marginal one-variable readings only. They say nothing about combinations, and the combination circuit is
  closed with rev1, rev2 and rev3 spent and immutable.
- The rates come from the accepted report as it stands; that report's cell arithmetic was independently
  re-checked by `backtester/lib/gold_data_verifier.js` on 150 sampled cells with no disagreement.
- The archive cannot confirm what a provider sent, cannot support selection, and the evaluation window stays
  sealed until `2027-03-25T15:00:00Z`.

