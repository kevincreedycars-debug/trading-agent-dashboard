# Are the live Layer 1 calls reliable, and is the re-weighting attempt any better? What the archive we hold says

Written 2026-10-04, as the follow-up to `WEIGHT_BALANCE_CHECK_20261004.md`. The user asked, after the weight question was
answered, whether the live Layer 1 calls being made each day are "actually somewhat reliable", and whether the attempt to
work out if the weighting needs rebalancing is "actually not statistically better than the original model". Both are
asked of the archive, so both are answered from artifacts already on disk, by name and date, with no new measurement and
no live system touched.

**The one-line answer.** On the project's own measurements the live Layer 1 calls are about a coin flip and, on the
session definition, slightly worse than one: 47.65% correct on the designated session's open-to-close direction across
2,493 calls (95% interval 45.70-49.62), against 53.19% for simply calling "up" every day, with bearish calls
underperforming at 42.96% and confidence not tracking accuracy - and the project's own verdict file already says these
calls "are not validated predictors of the designated trading session's closing direction". The re-weighting attempt is
not shown to be better: the one comparison on record reports +39.6 percentage points for gold, but it measures the gain
against an original side that reads 18.4% and cannot be reconciled with any other measurement of the same calls, and the
re-weighted side reads 58.0%, which is the same as gold's unconditional up-drift on that window - so the one improvement
number in existence is a number against a broken baseline, not a demonstrated gain, and no weight set has ever been
scored on data it was not chosen from.

Careful wording matters here, so: **"not demonstrably reliable" is not "proven worthless"**, and **"no gain shown" is
not "a gain disproved"**. What the archive supports is narrower than either camp would like. The calls carry no measured
directional skill over the base rate; they have never been tested with risk rules, targets or stops attached; and the
archive's usable evaluation sample is already spent.

## 1. Test A - session direction, the harshest and largest measurement

From the verdict file and its session-close comparison, all Layer 1, all five assets:

- Layer 1 directional accuracy **47.65%** (1,188 correct of 2,493; 95% interval by Wilson 45.70-49.62; -2.35pp against
  a 50% line and **-5.5pp against the majority-direction baseline of 53.19%**, which is what calling "up" every day
  would have scored).
- Bullish calls **50.69%** correct; **bearish calls 42.96%**. The system's down-calls lose more often than they win by
  roughly one call in six.
- By asset (exploratory slices, each carrying the file's own multiple-testing warning): EUR 46.14% (n 570, interval
  42.09-50.25, base 50.18); **GOLD 46.32%** (n 570, interval 42.26-50.42, **base 56.84**); NQ 51.96% (n 560, interval
  47.83-56.07, base 57.32); BTC 46.66% (n 793, interval 43.21-50.14, base 50.19).
- Gold's two directions split hard: **bearish gold calls 40.00%** (120 of 300; interval 34.62-45.64) against bullish
  gold calls 53.33% (144 of 270). The gold bearish interval's upper end sits below gold's own 60% down-frequency on that
  window, so the down-calls were not merely unskilled, they were leaning against the drift.
- By chronological fold, Layer 1: TRAIN 49.95% (n 1,089, base 54.18), **VALIDATION 43.84%** (n 796, interval
  40.43-47.31, base 54.52 - the whole interval below base), FINAL_TEST 48.52% (n 608, interval 44.57-52.49, base 50.33).
  No fold reaches its own base rate.
- Confidence does not order accuracy: the file records `layer1AccuracyMonotonicNonDecreasing: false` and
  `layer2ImprovementAbsent` with matched prediction count 1,592, **net improvement 0**, improved 0, worsened 0.
- The file's plain-English final conclusion, verbatim: *"The current Layer 1 and Layer 2 calls are not validated
  predictors of the designated trading session's closing direction."*

## 2. Test B - the panel the user actually sees, and it is kinder

The confidence-band artifact is built on the following-24-hours checker contract, not the session contract, which is why
its numbers run higher. Pooled Layer 1, all bands, all five markets:

- **54.39% directional accuracy** (2,132 correct of 3,920 evaluated directional calls across 6,362 calls; 15 rows carry
  no historical calls at all). Against the majority-direction base of the same window (bullish share 53.19%) that is
  about **+1.2pp**, well inside the noise of 3,920 calls (standard error about 0.8pp).
- **Gold alone: 56.31%** (446 of 792 directional calls, 1,186 calls) - against the gold up-drift measured elsewhere at
  55.81% (session, n 964) and 58.23% (week, n 960) in the accepted report. Gold's live calls land on top of gold's
  base rate.
- The confidence curve does not rise with confidence above the 60s, which is what "confident" would have to mean to be
  useful: BOTH-direction pooled rows read 30-39 **51.0%** (n 398), 40-49 50.1% (n 395), 50-59 56.8% (n 220),
  60-69 **59.6%** (n 374), 70-79 **52.9%** (n 140), 80-89 57.8% (n 232), 90-100 90.9% (n 11). Gold's own BOTH rows
  wander the same way: 30-39 55.1% (n 69), 40-49 46.0% (n 63), 50-59 40.0% (n 35), 60-69 55.7% (n 88), 70-79 73.7%
  (n 38), 80-89 61.7% (n 81). A band that reads 40% in one column and 74% in the next, on tens of calls, is a sample
  being read, not a confidence level being confirmed.
- Evidence labels travel with the rows and should travel with any quote of them: fewer than 10 evaluated directional
  calls is "very limited", 10-29 "limited", 30-99 "reasonable", 100+ "substantial", and under 30 is explicitly
  "insufficient_for_primary_emphasis".

Two artifacts, two honest answers: **about 47.7% on the session, about 54.4% on the next 24 hours, against base rates
of about 53-57% that either way the calls do not beat.**


## 3. "Reliable" splits into four questions, and the archive answers three

Reliability in this project can mean at least four different things, measured by four different artifacts on four
different windows. Confusing them is how the same system can look 47% and 97% at once.

1. **Direction, on the designated session's open-to-close** (`data/l2l-trading-day-directional-v1.json`, generated
   2026-08-15T16:47:04.959Z; verdict summary `data/l2l-directional-research-verdict-v1.json`, generated
   2026-08-15T18:42:25.793Z). Population 4,085 eligible rows, 2,493 Layer 1 and 1,592 Layer 2, with cross-layer
   duplicate prediction ids flagged in the file as not independent evidence. Folds: TRAIN 2024-01-03 to 2024-12-31,
   VALIDATION 2025-01-01 to 2025-09-30, FINAL_TEST 2025-10-01 to 2026-04-30, the last sealed from parameter selection
   and marked `final_test_consumed: true`.
2. **Direction, on the following 24 hours by confidence band** (`data/confidence-band-delivery.json`, generated
   2026-07-28T19:35:10.154Z, horizon "following 24hrs", 330 rows over five Layer 1 markets and four Layer 2 pairs).
   This is the artifact behind the panel the user sees.
3. **Whether a call's direction was right at all, on stored live gold outputs** (the gold stored-call pilot,
   `backtester/docs/gold_stored_call_pilot_20260906.md` and `data/gold-stored-call-pilot-20260906.json`): only 154
   stored outputs, 7 June to 6 September 2026, and the pilot's headline is an input defect, not an accuracy number.
4. **Whether a different weighting would do better** (`data/phase-2-shadow-backtest.json`, generated
   2026-07-07T11:26:43.687Z). That is the re-weighting attempt itself, answered in section 5.

The 97% and 70-72% figures that circulate are the excursion/reach metric, and the verdict file's own
`prohibitedFutureClaims` list forbids describing them as directional accuracy, as a win rate, or as evidence the call
can be relied on for the trading day. Any answer to the user that leans on 97% is quoting the wrong metric.
## 4. Test C - do the calls actually made each day get scored?

Not with any artifact that survives. The stored-call pilot opened 154 stored GOLD Layer 1 outputs, 7 June to 6 September
2026, 77 storage dates, and its finding is that the collection was broken: the active collector read
`market_snapshots` with `getAll`, `limit: 25` and no ordering, so of 147 distinct snapshots linked to the exported calls,
**143 imply the same 4266.066005 reference price** in `gold_d1_pct` from 10 June through 6 September. The apparent daily
gold trend was not a daily-return history. The pilot's own words: all 154 outputs reproduce their recorded signals
(replay parity, not input quality), and **"Do not use the pilot to calibrate weights before correcting and validating
collection."** Replacing only the stale gold one-day input changed **97 of 154 F5 signals and 19 final direction
labels** - the defect moved live calls, and no improvement in outcomes was tested because none could be.

So the honest coverage story: the session artifact scores calls up to 2026-04-30; the panel artifact scores calls up to
2026-07-28; the stored gold outputs run to 6 September on partly-defective inputs. **No artifact in the archive scores
the calls being made today**, and the session artifact's final fold is already consumed, so there is no clean held-back
sample left inside it to score today's calls against even retrospectively.

## 5. Test D - the re-weighting attempt, and the two things wrong with its one good number

`data/phase-2-shadow-backtest.json` (generated 2026-07-07T11:26:43.687Z, version phase2-shadow-backtest-v1, Layer 1
24H, five assets) is the attempt to answer "should the weights change". Its own method is stated plainly: it reuses
stored checker factor signals, applies evidence-based multipliers only to factors clearing a 30-row directional gate,
re-normalises to the original per-asset total weight, and will not issue a shadow call unless the directional weight
clears a minimum gate.

Its gold rows: original logic 608 samples, 563 directional calls, 76 wins, 338 losses, 149 flats, **ex-flat win rate
18.4%**; shadow logic 395 calls, 170 wins, 123 losses, 102 flats, 178 no-calls, **ex-flat 58.0%**; comparison status
`PASS`, headline `shadow_logic_improves_directional_accuracy`, **`ex_flat_change_pct_points: 39.6`**, 94 more wins,
215 fewer losses, 168 fewer calls. Across all five assets the file reports 2 improved, 0 degraded, 3 mixed, average
ex-flat change 23 percentage points.

Two things stop that being an answer.

1. **The baseline it improves on cannot be true.** 18.4% for the original gold logic over 563 calls is not reconcilable
   with the same calls measured anywhere else: 46.32% on the session contract (n 570), 56.31% on the 24-hour contract
   (n 792), or gold's own 60% down-frequency. Nothing in the archive produces 18.4%. Either the win definition differs in
   a way the file does not state, or the original arm is mis-scored; until that is settled the +39.6pp is a gap between
   two unknown quantities, not a gain. The same file's own factor text measures agreement at 56.3% against an "asset
   baseline" of 18.4%, which is internally odd on its face: a baseline should be the unconditional rate, and for gold
   that is in the 56-58% range.
2. **The re-weighted number is the base rate.** 58.0% on the gold shadow arm versus gold's unconditional up-drift of
   56.84% (session contract) and 58.23% (week, accepted report). A model that reads 58.0% and a coin that says "up"
   every day and reads the same are not distinguishable here. And the shadow arm got there by declining to call 178
   times, so its improvement partly comes from choosing when not to speak - a legitimate design, but it means the
   headline compares different populations of days, not the same days answered better.

On top of both: the file contains **no interval, no significance test and no paired test** - searching its methodology
for confidence, Wilson, significance, p-value or test terms returns nothing - and the methodology lists its known
limitations without mentioning the baseline question. Five assets, 2 improved and 0 degraded, is also the kind of
result multiple testing produces from noise; the file's own research framing says its metrics are context only and do
not qualify live calls.

**Answer to the second half of the user's question, stated exactly.** The re-weighting attempt is *not shown to be*
statistically better: no weight set in this archive has been scored on data it was not selected from, the one
improvement number rests on an unreconciled baseline, and its winning arm is indistinguishable from the drift. It is
also *not proven worse* - a fair test has never been run, because the fair test needs a sample nobody has yet. What is
safe to say is that the weighting question is **unmeasured**, and that the current weights are not the reason to trust
or distrust today's calls either way.

## 6. What this does and does not say

**Does say.** On the designated session, Layer 1's directional calls scored 47.65% over 2,493 calls with an interval
below the majority base; on the following 24 hours they scored 54.39% over 3,920 calls, about a point above a base rate
whose standard error is about 0.8pp; gold specifically lands on its own drift at 56.31%; bearish calls, and especially
bearish gold calls at 40.0%, are the weakest part; confidence bands do not order accuracy; and the one re-weighting
comparison on record cannot carry the weight put on it. The archive stores the defect that moved live gold calls for
three months.

**Does not say.** It does not say the system loses money - nothing in these artifacts has entry, stop, target, spread or
sizing attached, and a 47% directional hit rate can still be a sound process if the wins are bigger than the losses.
It does not say the weights are wrong, only that no test has decided. It does not say the diamond is worthless; it says
the measured edge over "always up" is inside noise on one horizon and negative on the other. And it does not authorise a
rewrite of live logic: the artifacts are downstream-only research, live systems are outside this worker's authority, and
the pilot explicitly forbids calibrating weights before collection is corrected and validated.

**The trap to avoid.** Quoting 97%/70-72% as accuracy, or quoting the +39.6pp as proof the new weights work, or quoting
54.39% as "reliable" without naming the base rate - each of those is the same error in a different costume: a rate
reported without the rate it has to beat.

## 7. What would settle it, and what it would cost

Three questions separate "is it reliable" from "is it worth acting on", and each has a bounded, cheap first step that
does not touch live logic:

1. **Reconcile the 18.4%.** Recompute the shadow file's original gold arm on the same day set with an explicit win
   definition, and print the unconditional up/down frequency beside it. This is arithmetic over stored inputs, costs
   nothing new, and either resurrects or retires the +39.6pp headline.
2. **Score the calls with risk attached, not just direction.** The missing piece is not another accuracy percentage; it
   is whether a call plus a stop and a target leaves anything behind. The reach and terminal-reversal fields already in
   the session artifact (`halfAdr20ReachRatePct`, `...ReachButTerminalReversalRatePct`, both in the 20-60% range) are
   the raw material, and they have never been combined with a cost assumption.
3. **Start a clean, dated observation period after collection is fixed.** The stored-call pilot's remaining gates say it
   already: validate the history repair, audit input semantics, then record authenticated publication and availability
   times and begin fresh observations with the bad inputs preserved rather than rewritten. Today's calls cannot be
   scored retrospectively, so the only way to ever answer "are today's calls reliable" is to start counting them now,
   with the date they were made and the inputs they were made on.

Until then this lane holds at **"not measurable at today's weights"**, with no new assignment requested and no live
file touched.

## 8. Boundaries and provenance

Read-only. This document was written from artifacts already on disk in the canonical checkout, referenced by absolute
path and generation timestamp above: `data/l2l-trading-day-directional-v1.json`,
`data/l2l-directional-research-verdict-v1.json`, `data/l2l-directional-discrimination-v1.json`,
`data/confidence-band-delivery.json`, `data/phase-2-shadow-backtest.json`,
`backtester/docs/gold_stored_call_pilot_20260906.md`. Nothing was recomputed except sums of published fields (the
pooled and gold totals, and the standard error, all three in section 2, each stated as such). No live system, live
call, weight, collector, dashboard file or other worker's worktree was read-modified or written. The sealed window
reading remains prohibited until 2027-03-25T15:00:00Z, and the movement lane `gold-declared-band-measurement-026`
remains paused since 2026-09-25. Filed as submission `20261004-strategy-live-call-reliability-and-rebalance-evidence-056`
with the companion weight-balance evidence `WEIGHT_BALANCE_CHECK_20261004.md`.

