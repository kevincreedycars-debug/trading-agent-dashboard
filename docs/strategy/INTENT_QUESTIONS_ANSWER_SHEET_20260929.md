# Intent questions - canonical answer sheet (2026-09-29)

Worker `strategy`, assignment `strategy-advisory-001`. This file is the single numbering authority for the
questions that decide **what this project should measure**. It exists because the chat list and
`CONVERSATION_NOTES.md` drifted into two different numberings of the same fifty questions, which would have
made the user's answers ambiguous. Numbers here govern; anything numbered in the notes or in an earlier chat
message is superseded.

**How to answer**

- Reply `all defaults` and every row below takes its default.
- Or list only the numbers you disagree with, for example `3 no, 12 often, 27 no`.
- Questions are put to you at most seven at a time, in numbering order, skipping anything already asked.

**Status:** 14 of 50 answered on 2026-09-29. Batch 1 (1, 2, 10, 13, 14, 27, 33): 4 usable (1, 10, 14, 27) and 3
that asked for plainer wording (2, 13, 33). Batch 2 (3-9): **3, 4, 5, 6 and 7 answered**, 2 confirmed as "push
ahead" with the user's own L2L correction, and **8 and 9 came back as not understood** - both are re-asked in
plainer words in batch 3 together with 13 and 33. Next fresh numbers after that: 11, 12, 15.

**Two of these answers changed the plan.** The user wants **both** stages and **all 28** variables, and they
declared a movement size of their own: **0.80% of price, in the direction of the call, within the 24-hour
session**. So the session floor is no longer the plan's 0.30% default. The "Gold L2L facts" section below
shows that 0.80% is **1.11x gold's own standard L2L distance (0.7236%)**, *not* 0.5 L2L (0.3618%), and that a
floor written as a fixed percentage of price drifts 32%→63% across years on gold while the same floor written
in L2L units stays flat within 2.4pp.

**The user's L2L correction, 2026-09-29 — and they are right about it.** They said "the real L2L size is
actually 1.68% at present on the charts I use". L2L is a *rolling* figure wherever it is drawn on a chart:
0.50 × ADR20 over the most recent 20 sessions, so its value moves with the regime. Every L2L number in this
document is the **period median** (median ADR20 1.4472% over the 570 gold sessions, so 0.7236%), which is a
different statistic from today's chart value. Read by year on the same rows the median ADR20 is 1.32% (2024),
1.43% (2025) and **3.12% (2026)**, so the chart-current L2L is 0.66%, 0.71% and **1.56%**; on the final 20
sessions (2026-04-01 to 2026-04-30) it is **1.83%** (ADR20 3.65%). The user's **1.68% implies ADR20 3.36%** and
sits inside that recent 1.56%–1.83% band, so their chart agrees with the archive once the window is matched. It
also means their first statement — that 0.80% "is 0.5 l2l" — was **correct for the current charts**
(0.80 / 1.68 = 0.48 L2L), and the 1.11x figure recorded earlier in this file was measured against the whole-period
median instead of today's rolling value. Both statements are kept, each labelled with its window.

## A. What counts as a move (1-9)

| # | Yes/no question | Default | Asked | Your answer |
| --- | --- | --- | --- | --- |
| 1 | Measure a move close-to-close, not intraday high-to-low | yes | batch 1 | **both** - "we also want to see if l2l and 0.5 l2l is found": keep close-to-close *and* add the path-based L2L and 0.5 L2L reach rows (`data/l2l-trading-day-directional-v1.json` already measures both) |
| 2 | Fix the minimum size in advance (0.30% session / 1.00% week) instead of fitting it | yes | batch 1 | **asked for a plainer restatement** - "not sure, explain the question better". The user separately declared **0.80% in the direction of the call within the session**, which is the size this row is about, so the floor becomes theirs; confirmed in batch 2 with "Okay fine, push ahead but clarify that the real L2L size is actually 1.68% at present on the charts I use" - their L2L is the rolling chart value and they are right about it (see "The user's L2L correction" above) |
| 3 | Report the size of the move too, not only the yes/no | yes | batch 2 | **yes** - "0.5% isnt drift thats meaningful directional movement I would say, 3% days rarely happen on gold ever, where have you got these targets from?". The two examples in the question were mine and one was badly chosen, so here is the measurement. On the same 570 gold sessions a move of 0.5% or more **close-to-close** happens in **59.12%** of sessions (34.91% up, 24.21% down), so the user is right that 0.5% is not drift. A move of 3% or more close-to-close happens in **3.86%**, so they are right there too. The "3%" in the question was the **intraday range** in the recent regime (range ≥ 3%: 6.14% of sessions all period, **25.64% in 2026**), not a close. The size row stands and both definitions get reported |
| 4 | Count a move in either direction, ignoring the sign | yes | batch 2 | **yes** - "Yes count them all we are loking for directional move data then will discern if what the data shows is typically up/down in whichever direction". Both directions counted on the way in; the up/down reading is the separate stage-2 step, in that order |
| 5 | Publish "no move" as its own bucket, so the three counts sum to the total | yes | batch 2 | **yes**, with a refinement from the user: "the 0.8% is on XAU/USD right, most days move that much even if they dont close that much". Confirmed XAU/USD, and measured: **74.39%** of sessions reach 0.80% from the open in one direction or the other, so only **25.61%** are a *path* no-move, while only **41.58%** close beyond 0.80%, so **58.42%** are a *close* no-move. The bucket is therefore published twice and labelled with which definition it is |
| 6 | Floor as a percentage of price, not a dollar amount | yes | batch 2 | **yes** - "Yes as percentage of price" |
| 7 | Same floor every year, no per-year tuning | yes | batch 2 | **yes** - "Yes as the l2l model is fixed percentage ranges". Read as: the floor is fixed in advance and never fitted per year; the L2L unit exists precisely so the *same* bet is read in each year's own ranges |
| 8 | q1-to-q3 spread as the headline measure, with the share above the floor beside it | yes | batch 2 | **not understood** - "Dont undertsand this question". Re-asked in batch 3 in plain words: we show the middle half of past moves (how big a normal day is) and, beside it, how many days clear the floor |
| 9 | Drop a state that has fewer than 100 anchors | yes | batch 2 | **not understood** - "dont understand, please simplify". Re-asked in batch 3 in plain words: a state is a day a factor was switched on; if it has only a handful of days we do not score it, we print "too few days" |

## B. What you want out of it (10-13)

| # | Yes/no question | Default | Asked | Your answer |
| --- | --- | --- | --- | --- |
| 10 | "A move is coming" is enough, direction is a separate second step | yes | batch 1 | **no** - "both, i want to see any edge we can find": the movement stage and the direction stage are both wanted. Direction is not optional, and the two stages stay separate so the direction answer is read after the movement answer |
| 11 | A simple on/off flag per factor, not a score or a ranking | yes | | |
| 12 | Prefer factors that fire rarely but strongly over often with a small edge | rare + strong | | |
| 13 | You would act on an edge smaller than 5pp | no | batch 1 | **not answered, question restated** - the reply read "5pp" as 5% of price ("thats huge on gold"). It means 5 *percentage points of frequency*: a state that delivers the move 44% of the time where the cohort delivers 39% is +5pp. Re-asked in batch 3 |

## C. Horizon (14-17)

| # | Yes/no question | Default | Asked | Your answer |
| --- | --- | --- | --- | --- |
| 14 | Session (1 day) is the primary horizon | yes | batch 1 | **yes** - "im mainly interested in the current 24h session as I would run the agents in the morning then trade throughout the day". The process detail matters: the flag must exist *before* the session it applies to, which makes 39 (intend to trade), 41 and 42 live rather than hypothetical |
| 15 | Week (5 sessions) is the secondary horizon | yes | | |
| 16 | Publish a 1/3/5-day sweep as one sensitivity line with one `looks_counted` | yes | | |
| 17 | Disclose overlapping horizons rather than avoid them | yes | | |

## D. Direction, stage 2 (18-21)

| # | Yes/no question | Default | Asked | Your answer |
| --- | --- | --- | --- | --- |
| 18 | Ask direction only for states that pass the movement stage | yes | | |
| 19 | Up or down only, no "how far up" | yes | | |
| 20 | A direction claim needs the same sign in every year | yes | | |
| 21 | Keep the accepted 60% hit-rate gate alongside the 5pp gap | yes | | |

## E. Which factors (22-28)

| # | Yes/no question | Default | Asked | Your answer |
| --- | --- | --- | --- | --- |
| 22 | Test the 10 declared factors before the 20 undeclared variables | yes | | |
| 23 | Write new rules for the 20 undeclared variables before reading any outcome | yes | | |
| 24 | Keep NEUTRAL states out of every hit rate | yes | | |
| 25 | Keep the DTWEXBGS-not-DXY caveat on every dollar row | yes | | |
| 26 | Keep the document's own boundaries verbatim (VIX 25.00/16.00, >0.30%, 5bps+) | yes | | |
| 27 | All 28 variables in scope, not only the declared 10 | yes | batch 1 | **yes** - "the variables are just being tracked then to see if there is an outcome that is predictable". Confirmed as recorded, with the one limit in the "No written rule" section below: the 20 states with no usable written statement can be published as raw context but can never carry a hit rate |
| 28 | Pairs, weighting, composites and models stay out for now | yes | | |

## F. VIX (29-32)

| # | Yes/no question | Default | Asked | Your answer |
| --- | --- | --- | --- | --- |
| 29 | Keep both VIX streams (level bands and change states) | yes | | |
| 30 | Publish the VIX change legs as raw context with no direction | yes | | |
| 31 | Keep the 1/2/5 and 2/5/10 threshold sweep, with `looks_counted` | yes | | |
| 32 | Rebuild F9 `risk_headline_context` as a declared rule (VIX>25 or war/geopolitical/conflict/sanction names) | yes | | |

## G. Sample and confirmation (33-38)

| # | Yes/no question | Default | Asked | Your answer |
| --- | --- | --- | --- | --- |
| 33 | Re-test any survivor out of sample before acting on it | yes | batch 1 | **not answered** - "not sure I understand the question". Explained in the batch-1 reply and re-asked in batch 3 |
| 34 | Size the rebuild for a 3pp effect, about 2,100 anchors per state | yes | | |
| 35 | Allow hourly entries to reach that sample, horizon re-declared, overlap disclosed | yes | | |
| 36 | Accept a declared floor, since the data has no "no move" bucket to find one in | yes | | |
| 37 | Leave the sealed prospective window untouched until 2027-03-25T15:00:00Z | yes | | |
| 38 | Re-check survivors on that window when it opens | yes | | |

## H. Tradability - answer this group only if you intend to trade the flags (39-42)

| # | Yes/no question | Default | Asked | Your answer |
| --- | --- | --- | --- | --- |
| 39 | You intend to trade these flags | answer matters | | |
| 40 | Subtract spread and slippage before any claim | yes if 39 is yes | | |
| 41 | Start the outcome at the next session open after the flag is observed | yes | | |
| 42 | The flag is available before the session it applies to, with no look-ahead | yes | | |

## I. Deliverable and process (43-50)

| # | Yes/no question | Default | Asked | Your answer |
| --- | --- | --- | --- | --- |
| 43 | One page listing every factor with raw movement numbers and no direction claim | yes | | |
| 44 | Every published number carries its n and the floor that produced it | yes | | |
| 45 | A ranked list is never presented as a winner | yes | | |
| 46 | The page states the number of looks examined | yes | | |
| 47 | Rebuild the direction layer only after the movement layer is agreed | yes | | |
| 48 | Record these answers as decisions before any lane starts | yes | | |
| 49 | Full new page beside the accuracy panel, rather than the minimum version appended to the scorecard page | full page | | |
| 50 | Answer D1 first: the movement screen before anything else | yes | | |

## Which plan decision each group feeds

| Plan decision (section 9 of the plan) | Questions that decide it |
| --- | --- |
| D1, the "if" stage | 1-9, 10, 36 |
| D2, the VIX change stream | 29-31 |
| D3, the size of the deliverable | 43-46, 49 |
| D4, the F9 rebuild | 32 |
| D5, the rebuild's sample size | 33-35, 38 |

## Answer log

| Date | Batch | Questions asked | Answers received |
| --- | --- | --- | --- |
| 2026-09-29 | 1 | 1, 2, 10, 13, 14, 27, 33 | 7 replies. Usable: 1 both measures, 10 both stages, 14 session primary with a morning-flag process, 27 all 28 in scope. Restatements requested and given: 2 (floor), 13 (5pp vs 0.8%), 33 (out of sample). Also declared: 0.80% in the direction of the call within the session, which replaces the 0.30% session default |
| 2026-09-29 | 2 | 3-9 | asked, pending |

The three restatements (2, 13, 33) are re-asked in batch 3. Batches continue in numbering order, at most seven
at a time, skipping anything already asked. Two lanes are still waiting on D1-D5; D1's default is no longer
"movement screen then a 0.30% floor" but "movement screen then the user's declared 0.80% / 1.00-L2L floor",
with the direction stage kept in scope.

## Batch 1 (2026-09-29) - the replies verbatim, in canonical order

1. "Both, i want to see any edge we can find" -> question 10. Both stages stay in scope; direction is not
   optional.
2. "both, we also want to see if l2l and 0.5 l2l is found" -> question 1. Close-to-close *and* the path-based
   L2L and 0.5 L2L measures. Both are already computed in the archive (see the L2L section below), so this
   costs no new run.
3. "not sure, explain the question better" -> question 2, the pre-declared floor. Restated; re-asked in
   batch 3.
4. "Yes im mainly interested in the current 24h session as I would run the agents in the morning then trade
   throughout the day" -> question 14. Session primary, and the flag has to exist before the session starts
   (questions 41 and 42), which also implies question 39 is yes and puts costs (question 40) in play.
5. "what do you mean no written rules. The variables are just being tracked then to see if there is an outcome
   that is predictable." -> question 27. All 28 variables in scope. The phrase is explained in the next
   section; it does not contradict the user's reading.
6. "5pp? as in 5 percentage points, thats huge on gold. I am really looking for minimum 0.8% movement in the
   direction of the call during the 24hr session (that is 0.5 l2l)" -> question 13, restated. The 0.80% is a
   *size* declaration, so it belongs to question 2; "5pp" is a *frequency* bar (44% of sessions instead of
   39%), not 5% of price.
7. "Not sure I understand the question." -> question 33, the out-of-sample re-test. Restated; re-asked in
   batch 3.

## "No written rule" - what the phrase means (answer to reply 5)

The user's reading is right in substance: the undeclared variables *are* tracked, and tracking them to see
whether an outcome is predictable is exactly what the accepted report does. The narrower point is what a
finished table can print for them. Of the 51 declared states in
`data/gold-direction-scorecard-20260927.json`: **25** carry a written direction, **6** are declared NEUTRAL,
and **20** have no usable written statement - `level_band_not_declared` 8, `change_rule_absent` 6,
`threshold_is_absolute_band` 2, `regime_label_not_reproduced` 4. For those 20 the table can print "gold rose
57% of the time while this state was on" (raw context, no direction) but never "the factor was right 57% of
the time", and they can never enter the 60% hit-rate gate. Two of the four reasons are fixable without the
user - the VIX 25.00/16.00 band *is* written in the document and is simply not reproduced by the report's
median split, and the same is true of the four regime labels. The remaining two need a number: 8 level bands
the document never declares, and 6 change rules with no rule at all.

## Gold L2L facts (read 2026-09-29, read-only, every interval already spent)

Definition chain, verbatim from the accepted artifacts: "Current standard L2L distance is ADR20 * 0.5 from the
existing L2L 1H Sequence Research builder" and "Half target distance is 0.5 * current standard, which equals
ADR20 * 0.25".

| Gold (XAU_USD), 570 LAYER_1 call sessions, 2024-01-04 to 2026-04-30 | Value |
| --- | ---: |
| median ADR20, as % of the session open | 1.4472% |
| standard L2L = ADR20 x 0.50 | **0.7236%** |
| 0.5 L2L = ADR20 x 0.25 | **0.3618%** |
| 0.5 L2L touched in the call's direction | 64.04% |
| standard L2L touched in the call's direction | 38.42% |
| standard L2L touched *and* still the call's way at the close | 32.11% (reached but reversed: 6.32%) |
| favourable excursion >= 0.80% of the session open | **39.12%** |
| favourable excursion >= 0.80% *and* call right at the close | 32.63% |
| adverse excursion >= 0.80% of the session open | 43.86% |
| call right at the session close | **46.32%** |
| gold closed up (always-bullish baseline on the same rows) | **56.84%** |
| accuracy, 270 bullish calls / 300 bearish calls | 53.33% / 40.00% |
| \|close-to-close\| >= 0.30% / >= 0.80%; no-move bucket at 0.80% | 73.86% / 41.58%; 58.42% |
| median \|close-to-close\| | 0.6701% |
| median range from the open (path, either direction) | 1.14% |
| ADR20 / L2L, period median vs chart-current | 1.4472% / 0.7236% vs **3.12% / 1.56%** (2026 rows) |
| ADR20 / L2L on the final 20 sessions (2026-04-01 to 04-30) | 3.65% / **1.83%** |
| user's chart L2L, 2026-09-29 | **1.68%** (implies ADR20 3.36%) |
| the user's 0.80% floor as a multiple of that current L2L | **0.48x** - their "0.5 l2l" reading was right for today's chart |
| the same 0.80% against the period-median L2L | 1.11x |
| sessions reaching 0.80% either way (path) vs closing beyond it (close) | 74.39% vs 41.58% |
| no-move bucket at 0.80%, path vs close | 25.61% vs 58.42% |

**Year stability, which is the argument for the L2L unit.** The share of sessions reaching the floor in the
call's direction, per year: at a *fixed* 0.80% of price, 32.40% (2024), 38.43% (2025), 62.82% (2026, n 78); as
1.00 L2L, 39.60%, 37.19%, 38.46%; as 0.50 L2L, 63.60%, 64.88%, 62.82%. Gold's median ADR20 went from 1.32% to
3.12% over the period, which is why the fixed number drifts: a fixed percentage of price is a different bet
each year on this instrument, while the L2L form is the same bet.

Provenance: `data/half-l2l-reach-research.json` sha256
`0d2955248066be6dff0741ae89fbe3e7de4ead6294c6bec16aa09a1aa452e9b8`,
`data/l2l-trading-day-directional-v1.json` sha256
`75a81e8429a1515de42b326fd29cb60ee81c24cc6e0d111a3cb954a9e6d41c59`, and
`data/l2l-directional-research-verdict-v1.json`, whose unchanged verdict is "The current Layer 1 and Layer 2
calls are not validated predictors of the designated trading session's closing direction". The reach figures
that verdict disclaims (96.99% half, 70.52% full) are the path-dependent original metric; the reconciled
figures are 64.04% and 38.42% above. Nothing in this section is a finding - the intervals are consumed, so
these are sizing facts and base rates only.

