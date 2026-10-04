# Is the ten-factor weighting balanced? What the archive we hold can and cannot say

Written 2026-10-04 for the user's question, asked after reading the live page's line "The directions above are the
agent's declared expectations, written by the system, not findings from the data":

> from this bit how do we find if the weighting is balanced correctly from the actual data we now have?

**Answer in one line: the question is measurable, it has been measured twice with today's weights, and the archive we
hold cannot answer it - 18 of the 100 weight points cannot be tested at all with the readings as the report cuts them,
all of the 82 that can are inside the noise band, and the only ordering evidence that exists runs the wrong way.**

"Balanced" needs one definition before anything is measured. There are three different questions hiding in it, and they
have different answers:

1. **Does each factor move gold the way the document declares, and by how much?** Measurable now. Answer: yes in sign,
   no in size - every factor's realised edge is inside the noise band.
2. **Does the size of each factor's weight match the size of its realised effect?** Measurable in principle, and this is
   the real question. Answer: the data, such as it is, orders the factors the other way round, but by too little to be
   significant either way.
3. **Would different weights make the calls better?** This is the decisive test and it is **not** built against today's
   weights. One stale run exists and is described in section 5 with its defect.

## 1. The method, and why it is the only honest one

The archive we hold re-cuts already-consumed intervals. It can tell us which way gold moved while a reading was on. It
cannot tell us what a different weighting would have done unless the whole call is re-run under those weights on the
same anchors and scored - and any set of weights chosen by looking at these same anchors is fitted to them, which is why
the third question needs held-back data rather than more arithmetic on the same ones.

The measurement that exists is the accepted single-variable report, cut against each factor's declared direction. It is
re-run below, read-only, on the accepted bytes; it changes nothing it reads.

## 2. Test 1 - each factor's weight against its measured edge, re-run today

- Scorer: `backtester/scripts/report_gold_factor_direction_check.js` (canonical, unmodified, run read-only).
- Input: `.local/worktrees/gold-research/backtester/tmp/ivr-coverage-019-20260925-r2/individual-variable-report.json`,
  95,842,994 bytes, sha256 `ffcd9cbc3b16fc08449b7fa305188f9ad77358422a4fc1ea0f222e9d01e5c6b6` - the same accepted report
  the live Direction tab and the live "What moves gold" page are built from.
- Parameters: cohort `daily_snapshot_anchors`, group `all_computed`, minimum n 100, minimum year n 20, interest band
  5pp, interesting hit rate 60%.
- This turn's outputs (not copied from the September document): `tmp/dircheck-20261004.json` (159,014 bytes),
  `tmp/dircheck-20261004.md` (12,258 bytes), generated `2026-10-04T13:32:09.755Z`.
- Baselines, gold unconditional: session 55.81% up (n 964); week 58.23% up (n 960). The edge is the factor's hit rate
  minus that side's own unconditioned rate, so a factor that is merely on the drift side of gold scores nothing.

| Factor | Declared weight | Rows scored | Session n | Session hit | Session edge | Week n | Week hit | Week edge | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| F1 Real Yield Direction | 22 | 4 | 1864 | 50.80% | +1.17pp | 1857 | 48.68% | -0.80pp | no_information / no_information |
| F2 DXY Direction | 18 | 6 | 2892 | 50.69% | +0.35pp | 2880 | 50.31% | -0.16pp | no_information / no_information |
| F3 Fed Bias | 14 | 2 | 964 | 51.56% | +1.16pp | 960 | 52.29% | +1.76pp | no_information / no_information |
| F4 US 2Y Yield Trend | 8 | 4 | 1873 | 52.54% | +2.57pp | 1865 | 50.35% | +0.36pp | no_information / no_information |
| F5 Gold Own Price Delta | 8 | 6 | 2860 | 51.64% | +0.60pp | 2848 | 50.98% | -0.51pp | no_information / no_information |
| F6 Risk Regime / VIX | 10 | 0 | - | - | not scoreable | - | - | not scoreable | not declared for a VIX change; the document's rule is an absolute band |
| F7 US Economic Surprise | 6 | 0 | - | - | not scoreable | - | - | not scoreable | sign convention per event family not established; release cohort only |
| F8 Inflation Signal | 6 | 2 | 940 | 48.40% | -1.61pp | 936 | 47.97% | -2.01pp | no_information / no_information (leans the wrong way) |
| F9 Safe Haven Demand | 6 | 1 | 471 | 60.51% | +4.70pp | 471 | 63.69% | +5.46pp | no_information / unstable_across_years |
| F10 Liquidity / Growth | 2 | 0 | - | - | not scoreable | - | - | not scoreable | the report's level split is not the document's regime label |

- **Weight points testable: 82 of 100. Untestable: 18** - F6 (10), F7 (6), F10 (2). The heaviest untestable item is
  also the middle of the ten: a tenth of the model cannot be checked against the report as the report cuts variables.
- **25 of 25 scored rows are `no_information` on the session; 24 of 25 on the week, and the twenty-fifth (F9) is
  `unstable_across_years`.** Exactly one row in 25 reaches the 60% the system calls interesting, where chance alone
  would put about two and a half among rows tested.
- Noise scale, so the numbers are read at the right size: with n around 1,900 and p near one half, the standard error of
  a hit rate is roughly 1.1pp, so the 5pp band is about four standard errors. A factor would have to show a real edge of
  a few percentage points before this archive could see it - and the declared weight spread of 22 down to 2 implies a
  spread of real effects far wider than anything measured here.

## 3. Test 2 - does the ordering of the weights match the ordering of the effects?

The tightest reading of "balanced correctly" is that the factors with the most weight are the factors with the most
measured effect. On the seven factors that can be scored at all, the rank comparison runs backwards:

| Compared | Value |
| --- | ---: |
| Spearman rank correlation, weight against size of session edge | -0.64 |
| Spearman rank correlation, weight against size of week edge | -0.54 |
| Weight order (heaviest first) | F1 22, F2 18, F3 14, F4 8, F5 8, F8 6, F9 6 |
| Session edge order (largest first) | F9 +4.70, F4 +2.57, F1 +1.17, F3 +1.16, F5 +0.60, F2 +0.35, F8 -1.61 |
| Week edge order (largest first) | F9 +5.46, F3 +1.76, F4 +0.36, F2 -0.16, F5 -0.51, F1 -0.80, F8 -2.01 |

Two honest qualifications, both of which weaken the finding rather than the answer:

- With seven factors, a rank correlation of this size is not statistically meaningful; the critical value near p=0.05
  is about 0.71 in magnitude. What can be said is that the data give no support to the declared ordering, not that the
  declared ordering is proven wrong.
- The heaviest three (F1 22, F2 18, F3 14 = 54 of 100 points) score +1.17, +0.35 and +1.16pp on the session and
  -0.80, -0.16 and +1.76pp on the week. More than half the model's weight sits on three readings with the flattest
  measured edges in the table.

## 4. Test 3 - the overlap problem, which no re-weighting can fix

The 28 readings are not 28 independent inputs: the registry's own derivation line says twenty of them are levels or
transformations of five macro and price series. Every scored state also shares anchors with the others, and the two
halves of a median split are complements rather than independent trials. So the effective independent information is
well below ten factors' worth, and a weighting scheme that treats F1 and F4 (both yield, 30 of 100 points between them)
or F2 and F5 (dollar and gold's own price, 26 points) as separate voices is not adding information when it adds weight.
This is the part of "balanced" that more data will not settle: it is a design question, not a measurement question.

## 5. Test 4 - the two tools that already exist for this, and why neither answers today's question

Both are published artifacts in the repository, both are built for exactly this question, and **both are built on the
previous revision of the weights**, which is why they cannot be quoted as today's answer:

- `data/factor-edge-lab.json`, generated `2026-07-06T20:00:26.564Z`, gold, 24H, 2024-01-02 to 2026-04-30, 608
  observations. It carries per factor: its weight, the realised bullish and bearish hit rates, a combined reliability,
  and a mismatch figure against its weight with a review label. Its own summary lists
  `strongest_reliable_single_factors: []` - no reliable single factor for gold - names `F7 US Economic Surprise` as the
  biggest weight mismatch (score 92) on **7 directional observations**, names `F6 VIX Risk Regime` as the weakest
  (-39.7), and labels six of the ten factors `contradiction_edge_possible_hidden_predictor` with four
  `insufficient_evidence`.
- Its weights are the pre-revision set - F1 26, F2 22, F3 12, F4 10, F5 10, F6 8, F7 8, F8 2, F9 1, F10 1 - against
  today's F1 22, F2 18, F3 14, F4 8, F5 8, F6 10, F7 6, F8 6, F9 6, F10 2. Five of the ten weights differ, three of
  them by a factor of three or more (F8 2 to 6, F9 1 to 6, F10 1 to 2).
- `data/phase-2-shadow-backtest.json`, generated `2026-07-07T11:26:43.687Z`, same window. This is the actual
  re-weighting experiment: it re-runs the whole call under adjusted weights and compares with the original call on the
  same anchors. For gold it reports original 18.4% ex-flat on 563 directional calls (76 wins, 338 losses) against
  shadow 58.0% on 395 calls (170 wins, 123 losses), a headline improvement of +39.6pp, with weights moved F6 8 to 6.56,
  F1 26 to 23.4, F2 22 to 19.8, F4 10 to 9, F5 10 to 9 and the rest unchanged, and 12 rows changed.
- **The defect that must be stated before those numbers are used.** An original-side ex-flat rate of 18.4% cannot be
  reconciled with the September factor cut, where the declared directions are right more often than not (session hit
  rates of 50.8% to 60.5% across 25 scored rows). A weighted vote of readings that are individually about right should
  not lose four calls in five. So either the shadow run's "original" side does not encode the same rule as the
  direction check, or its scoring of the original side is wrong. Until that is re-derived, the +39.6pp is a number in a
  file, not the value of re-weighting.

## 6. Test 5 - the decisive test, which is not built

The question as asked - "is the weighting balanced correctly?" - is settled by comparing **weight sets** on the same
anchors, with the outcome hidden from the choice of weights, and then scoring on data not used to choose. That means
three runs of the whole call for gold:

1. the declared weights, 22/18/14/8/8/10/6/6/6/2;
2. equal weights across the ten factors;
3. a data-driven weighting, fitted on one part of the archive and scored on another.

If the declared weights beat equal weights out of sample, the weighting is doing work. If they do not, the weighting is
decoration and the honest thing to publish is equal weights plus the measured per-factor table. If the data-driven set
wins on the fitting half and loses on the scored half, that is the same answer with the fitting error visible.

What that test needs, and what blocks it today:

- **A run of the whole call with a settable weight vector for gold at today's weights.** The existing shadow machinery
  is built on the July weight set and the older checker window; it needs re-pointing at the current document and the
  019 report before its labels mean anything about today.
- **Held-back data.** Fitting weights on the anchors that produced the fitting is circular, and the prospective window
  (reading prohibited until `2027-03-25T15:00:00Z`) is the only clean held-back sample in existence. Until then any
  "better" weighting is a hypothesis.
- **The movement measurement lane**, `gold-declared-band-measurement-026`, whose activity record still shows a pause
  from 2026-09-25. The related movement table on the 1/2/3/5-session ladder in
  `docs/strategy/FACTOR_TABLE_SPEC_20261003.md` is specified and unbuilt for the same reason. Note that this tests a
  different question from the direction check: how far gold travels while a state is on, not which way it ends.

## 7. What this means in plain terms, and where the user can look

- The weight column on the live page is a statement of intended influence, written by the system. The archive we hold
  does not confirm it, and on the ordering evidence it weakly contradicts it. Nothing here proposes changing the
  weights: with every factor inside the noise band, a re-weighting now would be fitted to noise.
- The dashboard tab called **Factor Edge Lab** already shows per-factor weight-mismatch labels for gold. If the user
  opens it he should be told that those labels were computed on the pre-revision weights (F1 26, F2 22 ... F9 1) and the
  2024-2026 checker window, so they do not describe the weights printed on the "What moves gold" page.
- The **Direction** tab carries the current edge picture, which this turn's re-run reproduced exactly.

## 8. Provenance, boundaries and non-claims

- This turn's reads were read-only: the accepted 019 report (by hash above); the direction-scorer script and its
  expectations registry; `data/factor-edge-lab.json`; `data/phase-2-shadow-backtest.json`; and
  `logic/agent_gold_direction.md` section 4. The only writes are this document, one entry appended to
  `docs/strategy/CONVERSATION_NOTES.md`, the submission envelope, one commit and its push, and ignored `tmp/` scratch
  including this turn's scorer outputs.
- No page, stylesheet, script, template, builder, guard, generator, data artifact, number, register entry, assignment,
  lock, controller or bridge file was touched. The scorer was run with `--out` and `--markdown` pointed at this lane's
  own `tmp/`, both new files, and it writes nowhere else.
- No new measurement of market data was taken: the direction re-run re-cuts consumed intervals inside an accepted
  report, exactly as the 2026-09-27 cut did. No outcome, holdout or prospective observation was read; the sealed window
  (reading prohibited until `2027-03-25T15:00:00Z`) was untouched.
- No prediction, accuracy, timing, profitability or trading edge is claimed. The 18.4% original-side figure in section
  5 is described as an unreconciled number in a file, not as a result.
