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

**Status:** 23 of 50 answered on 2026-09-29. The answered set is 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
15, 16, 17, 18, 19, 20, 21, 27 and 33. Batch 5 (11, 18, 19, 20, 21, 22, 23) closed **five**: **11** came back as
*"Okay lets go with the light but an explanation of why its yes/no briefly underneath"*, so the per-factor output
is a two-light display with one short line of why underneath; **18** *"yes makes sense"*; **19** *"okay"*; **20**
*"yes every year"*; **21** *"okay"*. The last two, **22** and **23**, came back as requests for plain English
rather than as answers - *"what do you mean written rule? Explain this part simply"* and *"Again what do you mean
unwritten factors"* - so both phrases are retired from the ask and the pair is re-stated in plainer words in batch
6; the section "Written rule / no written rule, in plain words" below is that restatement. Batch 4 produced a
measurement: the user rewrote the horizon question from "is 5 sessions the secondary horizon" into **"24h, 48h,
3d, 5d"** to find out "is it a 24h impact or does it set the tone for a few days", so the ladder is now measured
and is in the "Horizon ladder, measured" section below. An earlier version of this line said **16 of 50**, which
double-counted questions 2 and 33; the figure ran 14 until batch 4 and is 23 now. The user also asked to **hold
overnight** at the end of batch 5 - *"for now hold here for tonight, we will continue here again tomorrow"* - so
nothing further goes out tonight and batch 6 is sent on the next session.

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
| 8 | q1-to-q3 spread as the headline measure, with the share above the floor beside it | yes | batch 2, 3 | **answered, and it changes which number comes first** - after asking what "headline" and "floor" meant, the user said: *"Yes its the 0.5l2l and l2l directional movement happened that we are interested in primarily, then we want to see if the directional call was correct for the l2l that occured"*. So the first number is the **movement that happened**, read at **0.50 L2L and L2L** and counted in either direction; only then is the call's direction checked against the move that occurred. The 0.80% declared on 2026-09-29 is the *current-chart instance* of 0.50 L2L (0.80 / 1.68 = 0.48), so the two declarations agree. Measured on 2026-09-29 (`tmp/l2l-scan7-20260929.js`, cross-checked against the archive's own `reachedHalfAdr20` / `reachedFullAdr20`): a 0.50 L2L move happened either way in **97.89%** of sessions and an L2L move in **75.26%**; the call's own direction reached 0.50 L2L in **64.04%** and L2L in **38.42%**. The conditional read the user asked for is the one that matters: among sessions where the move happened on **one side only** (n 355 at 0.50 L2L, n 393 at L2L), the call's direction was the side that moved **45.63%** and **46.56%** of the time, against **61.13%** and **56.23%** for always saying up on the same rows. Stage 2 therefore stays conditional, and today's answer under this criterion is not a small edge but a deficit |
| 9 | Drop a state that has fewer than 100 anchors | yes | batch 2, 3 | **no** - "No if its relevant we always need to be aware of its impact on the market". This reverses the default: a thin state is **never dropped and never hidden**. Every state is listed with its day count, and one with too few days to judge is printed unscored with "few days" beside it so its market context stays visible. The `n >= 100` bar survives only as a *labelling and scoring* gate - it decides whether the row can carry an interest flag or clear the 60% gate, and it decides nothing about whether the row is shown |

## B. What you want out of it (10-13)

| # | Yes/no question | Default | Asked | Your answer |
| --- | --- | --- | --- | --- |
| 10 | "A move is coming" is enough, direction is a separate second step | yes | batch 1 | **no** - "both, i want to see any edge we can find": the movement stage and the direction stage are both wanted. Direction is not optional, and the two stages stay separate so the direction answer is read after the movement answer |
| 11 | A simple on/off flag per factor, not a score or a ranking | yes | batch 4, 5 | **yes, the light - but with a reason line under it** - *"Okay lets go with the light but an explanation of why its yes/no briefly underneath"*. So each factor gets one of the two lights (worth watching today / nothing here today) and, underneath it, **one short line in plain words saying why** - for example "moved 0.6% more than a normal day, on 112 days". No score out of 100, no ordered list of best to worst, no winner. The reason line is short by design: it carries the size of the move and the day count, it does not carry a direction claim and it never says a factor "works". This is the shape the user's earlier answers already implied (nothing dropped, every number printed with its own day count) and it is what the page has to render per factor |
| 12 | Prefer factors that fire rarely but strongly over often with a small edge | rare + strong | batch 4 | **no, keep both** - "Yes keep both even if rare its still something to factor into the analysis agent". There is no rarity filter and no preference rule: a state that fires ten times a year is kept, printed with its own small day count, and fed to the analysis agent exactly like a common one. This is the same instruction as question 9 (nothing is dropped) and question 13 (any edge counts), now stated a third time, so rarity is never a reason to omit or to demote a row |
| 13 | You would act on an edge smaller than 5pp | no | batch 1, 3, 4 | **yes** - *"Not sure why we are asking this, we want to find anything that giuves us an adge so yes?"*. The bar is **5 days in 100** (not 0.05%, not 5% of price) and the user will act on it. Their "anything that gives us an edge" also fixes the reporting rule for smaller gaps, tied to question 9: a gap below the bar is still **printed**, flagged as indistinguishable from chance on today's sample, and never hidden. The caveat that travels with this answer: 5pp needs about 774 anchors for 80% power and the archive has about 470, so a 5pp row here is *reportable and worth watching, not confirmable* - which is what D5 (the hourly rebuild) is for |

## C. Horizon (14-17)

| # | Yes/no question | Default | Asked | Your answer |
| --- | --- | --- | --- | --- |
| 14 | Session (1 day) is the primary horizon | yes | batch 1 | **yes** - "im mainly interested in the current 24h session as I would run the agents in the morning then trade throughout the day". The process detail matters: the flag must exist *before* the session it applies to, which makes 39 (intend to trade), 41 and 42 live rather than hypothetical |
| 15 | Week (5 sessions) is the secondary horizon | yes | batch 4 | **rewritten by the user, and answered as a ladder** - "24h, 48h, 3d, 5d we are just trying to understand is it a 24h impact or does it set the tone for a few days so we can safely treade in that direction". So the secondary horizon is no longer a single 5-session number: the horizon set is **1, 2, 3 and 5 sessions**, and the question it answers is whether a call is a same-day event or sets the tone for several days. The ladder is measured - see "Horizon ladder, measured" below. The measured answer is that the *movement* is certain at every length while the *direction* is not: the floor is reached in the call's direction 64.04% at 1 session rising to 82.63% at 5 (mechanical - more time, more chance), and the call is no better at 5 sessions than at 1 at naming the side |
| 16 | Publish a 1/3/5-day sweep as one sensitivity line with one `looks_counted` | yes | batch 4 | **yes**, and the sweep is now the user's own ladder, so it is **1/2/3/5 sessions** (four windows, not three). Confirmed: one line, one `looks_counted` covering the whole sweep - the count is states x 4 windows x the floor variants, and it rises by a third against the plan's earlier 1/3/5 version. Nothing here is presented as independent evidence |
| 17 | Disclose overlapping horizons rather than avoid them | yes | batch 4 | **yes, "yes fine"**. Overlap is disclosed, not avoided: the four windows share the same anchors and each is a strict extension of the one before it, so a 5-session number can never be read as four independent confirmations. The mechanics are already measured and are in the ladder section: of the calls whose direction reached 0.5 L2L inside the window, the share still on the correct side at the window's end falls 68.49% (1 session) -> 67.13% -> 59.33% -> **55.20%** (5 sessions), i.e. the longer the window the more of the move is handed back before it closes |

## D. Direction, stage 2 (18-21)

| # | Yes/no question | Default | Asked | Your answer |
| --- | --- | --- | --- | --- |
| 18 | Ask direction only for states that pass the movement stage | yes | batch 5 | **yes** - *"yes makes sense"*. Direction is asked only where the movement stage showed something; a state that does not change how much gold moves cannot change which way it moves on average. Confirms §4 of the plan as written |
| 19 | Up or down only, no "how far up" | yes | batch 5 | **yes** - *"okay"*. Stage 2 answers one question, the side; the distance is already answered by stage 1, so no row carries a how-far claim and no target, stop or path is read into it |
| 20 | A direction claim needs the same sign in every year | yes | batch 5 | **yes, and it is emphatic** - *"yes every year"*. One sign, every year, with n >= 20 in the year; a factor that leans the right way pooled but flips in one year fails. This is the guard that the fixed-0.80% rows already fail (32.40% / 38.43% / 62.82% across 2024-2026) while the L2L form holds (39.60% / 37.19% / 38.46%) |
| 21 | Keep the accepted 60% hit-rate gate alongside the 5pp gap | yes | batch 5 | **yes** - *"okay"*. Both bars stay, verbatim from the accepted scorecard: `hit_rate_pct >= 60` **and** `n >= 100`, with the 5pp gap against the cohort's own share used on the movement stage where a share is the honest unit. Neither bar is a reason to hide a row (question 9) |

## E. Which factors (22-28)

| # | Yes/no question | Default | Asked | Your answer |
| --- | --- | --- | --- | --- |
| 22 | Test the 10 declared factors before the 20 undeclared variables | yes | batch 5, 6 | **asked what the phrase means** - *"what do you mean written rule? Explain this part simply"*. The ask is re-stated without the phrase in batch 6 as: the ten factors that already have a rule written down for them get checked first, because those rules can be checked against the archive the same day. Default stands until answered: **yes, written-down rules first, in any order within each group** |
| 23 | Write new rules for the 20 undeclared variables before reading any outcome | yes | batch 5, 6 | **asked what the phrase means** - *"Again what do you mean unwritten factors"*. Re-stated in batch 6 as: for the twenty that have no rule written anywhere, agree what each one should mean *before* looking at what price did, otherwise the rule is only a description of the past that has already happened. Default stands until answered: **yes, agree the rule first, then read the outcome** |
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
| 33 | Re-test any survivor out of sample before acting on it | yes | batch 1, 3 | **no, not yet** - "No not yet, we are trying to fit anything we are just observing the data and then confirm what price did and did not do" (read as *"we are not trying to fit anything"*). This is the sharper answer of the pair: the current stage is **description, not fitting**. Nothing is estimated from outcomes - the floor is the user's own fixed 0.8% and no threshold, weight or window is tuned - so there is no fitted object for an unseen-data test to check. The out-of-sample requirement stays on the books and attaches to a **declared rule** (a rule stated before its outcome is read, such as the undeclared-variable rules in question 23), not to an observation table. Deferred by user instruction, to be re-raised if and when a rule is declared |
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
| D1, the "if" stage | 1-9, 10, 11, 12, 15-17, 18-21, 36 |
| D2, the VIX change stream | 29-31 |
| D3, the size of the deliverable | 43-46, 49 |
| D4, the F9 rebuild | 32 |
| D5, the rebuild's sample size | 33-35, 38 |

The horizon ladder (questions 15-17) also feeds D5, because 48h and 3d exist in no accepted artifact: a declared
1/2/3/5-session window set is part of what that rebuild has to produce, and every extra window is an extra look in
the single `looks_counted`.

## Answer log

| Date | Batch | Questions asked | Answers received |
| --- | --- | --- | --- |
| 2026-09-29 | 1 | 1, 2, 10, 13, 14, 27, 33 | 7 replies. Usable: 1 both measures, 10 both stages, 14 session primary with a morning-flag process, 27 all 28 in scope. Restatements requested and given: 2 (floor), 13 (5pp vs 0.8%), 33 (out of sample). Also declared: 0.80% in the direction of the call within the session, which replaces the 0.30% session default |
| 2026-09-29 | 2 | 3-9 | 7 replies, 5 usable (3, 4, 5, 6, 7). 4 count both directions; 5 publish the no-move bucket; 6 floor as a percentage of price; 7 the floor is the same every year. 2 was settled here: "push ahead but clarify that the real L2L size is actually 1.68% at present on the charts I use". 8 and 9 came back as not understood |
| 2026-09-29 | 3 | 8, 9, 13, 33 (restatements) | 4 replies, and all four are now answered. **9: "no"** - a relevant state is never dropped, its market impact must stay visible. **33: "no, not yet"** - nothing is being fitted at this stage, the work is observing the data and confirming what price did and did not do. **8: yes**, and it moved the primary measure to the **0.50 L2L and L2L movement that happened**, with the directional read taken afterwards on that movement. **13: yes** - "we want to find anything that giuves us an adge". The reply also asked whether this is simply tracking correlation, which it is; the answer and its three guards are recorded in the section below |
| 2026-09-29 | 4 | 11, 12, 15, 16, 17 | 5 replies, 4 of them answers: **12 "Yes keep both even if rare its still something to factor into the analysis agent"** (no rarity filter, nothing dropped for firing rarely), **15 rewritten by the user** into the horizon ladder "24h, 48h, 3d, 5d ... is it a 24h impact or does it set the tone for a few days so we can safely treade in that direction", **16 "Yes"** (the sweep stays one line with one `looks_counted`, now over four windows), **17 "Yes fine"** (overlap disclosed, not avoided). **11 came back as "Simplify this question I dont know what you mean"** and is re-asked in plainer words in batch 5. The extra request in the same reply - "just fill the gaps so we have all data clear" - is logged as the completeness rule below |
| 2026-09-29 | 5 | 11, 18, 19, 20, 21, 22, 23 | 5 answers and 2 requests for plain English. **11: the light, with a reason line under it** (*"Okay lets go with the light but an explanation of why its yes/no briefly underneath"*) - the two lights stay, and one short why sits underneath each one. **18: "yes makes sense"**, **19: "okay"**, **20: "yes every year"**, **21: "okay"** - the four direction-stage defaults are confirmed as the user's own answers, so stage 2 is asked only on states that moved, answers the side only, must hold its sign in every year, and keeps both accepted bars. **22 and 23: not understood** - *"what do you mean written rule? Explain this part simply"* and *"Again what do you mean unwritten factors"* - so the words *written rule* and *unwritten* are retired and the pair goes back in batch 6 in the plainer wording recorded in the "in plain words" section below. The same message ends the day: *"for now hold here for tonight, we will continue here again tomorrow"*, so the batch-6 send waits |

Batches continue in numbering order, at most seven at a time, skipping anything already asked. Batch 4 closed four
of the five questions it asked: **12** (rare and common states are equally kept), **15** (the horizon set is
1/2/3/5 sessions, measured, and the movement is same-day while the direction never appears), **16** (one line, one
`looks_counted`, now four windows) and **17** (overlap disclosed). **11** came back as "Simplify this question I
dont know what you mean" and is re-asked in plainer words with **18, 19, 20, 21, 22, 23** in batch 5. The same
reply carried a standing completeness instruction - **"just fill the gaps so we have all data clear"** - which is
now the rule for every table: no blank cell, no ellipsis, no omitted window and no "not measured" row where the
number exists; a thin number is printed with its own day count instead of being left out, which is question 9's
instruction applied to the shape of the table rather than to one row. Two lanes are still waiting on D1-D5;
D1's default is no longer "movement screen
then a 0.30% floor" but "movement screen, then the 0.50 L2L and L2L movement that happened, then the direction
read on that movement", with the fixed 0.80% and 0.30% kept as sensitivity rows. Question 33's answer removes
nothing from D5 - it says the *stage we are in* is observation, so the out-of-sample check binds a future declared
rule rather than today's tables.

Batch 5 closed five of its seven questions and sent two back for rewording. **11** is now the user's own design:
the two lights stay, with **one short line of why underneath each** - the light says whether the factor is worth
watching today, the line says what the size of the move and the day count were, in plain words, with no direction
claim in it. **18** and **19** settle the shape of stage 2 (direction asked only on states that passed the movement
stage, and only up or down, never how far), **20** makes the per-year sign rule the user's own (*"yes every year"*),
and **21** keeps the accepted 60% hit-rate bar beside the 5pp gap. That is **23 of 50** answered (1-21, 27, 33).
**22** and **23** came back not as answers but as a request to drop the jargon - *"what do you mean written rule?
Explain this part simply"* and *"Again what do you mean unwritten factors"*. Both phrases are retired from the ask,
the meaning is written out in the "in plain words" section below, and batch 6 asks the pair again in those words.
Nothing else about those two questions changes, and their defaults stand until the user answers. The user then
paused the round: *"for now hold here for tonight, we will continue here again tomorrow"*.

**Correction recorded here, because a filed submission carries the wrong count.** The submissions `-014` and
`-015` and the earlier version of the status line above said **16 of 50** answered. The correct figure is **14**
(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 14, 27, 33): question 2 was counted twice, once for being asked in batch 1
and once for being answered in batch 2, and question 33 was counted twice for the same reason. Filed submissions
are not rewritten; the correction is carried forward in `-016`.

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

## Written rule / no written rule, in plain words (answer to reply 6, and the batch-6 ask)

The user asked twice what these phrases mean - *"what do you mean written rule? Explain this part simply"* and
*"Again what do you mean unwritten factors"* - so the phrases are retired from the ask. Here is the whole idea in
ordinary words.

**What "already written down" means.** Some of the 28 tracked things come with a sentence in the project's own
documents that says what they should mean for gold. One of them reads, in effect: *"VIX above 25 - expect gold up;
below 16 - expect gold down; between 16 and 25 - no view"*. That sentence was written down by the project **before**
anyone ran the numbers, so checking it against what price actually did is a fair test. That is the entire meaning of
"written rule": somebody already said what the thing is meant to say.

**What "not written down" means.** Other things are only *tracked*: the number is collected every day and no
document anywhere says whether a high reading should mean up or down. For example one tracks which of the last 5, 10
or 20 sessions gold rose in most often, and another tracks how far today's price sits above its own 50-day average -
the data exists, the direction sentence does not. Of the 51 states the report declares, **25** have that sentence,
**6** are declared "no view", and **20** have none at all (8 level bands with no threshold declared, 6 change rules
with no rule, 2 that sit on an absolute dollar band, 4 regime labels the report makes up itself). That is the entire
meaning of "unwritten": tracked, but nobody has said what it should mean. Those twenty can still be shown as context
("gold rose 57% of the time while this was on") but they can never be called right or wrong and can never pass the
60% bar, which is exactly what question 23 is about.

**The two questions, asked again in those words (batch 6).**
- **22 - check the ten that already have a written sentence first?** Reason: those ten can be checked against the
  archive straight away, so the first honest answer arrives the same day; the other twenty still get their context
  printed in the same run, just without a right/wrong verdict. Default if no reply: **yes**.
- **23 - for the twenty with no sentence, agree what each should mean before looking at what price did?** Reason: if
  we look at price first and then write the sentence, the sentence only describes the past that already happened - it
  will always look good and it will tell us nothing about tomorrow. Default if no reply: **yes**.



The user asked: *"understood on the factor side so we are looking for something thats 5% more right than normal
movement? IUs that what you mean? If so arent we simply tracking correlation?"* Three answers, in order.

**Yes, it is correlation, and it is stated as correlation.** What the tables measure is whether a state that is
known *before* the session starts lines up with what price did *during* it. No row claims the state caused the
move, and no wording in the deliverable will imply it. The useful question is not "is this correlation" but
"which correlation would still hold up on days we have not seen yet", and that is what the guards below test.

**Not "5% more right", "5 days in 100 more often than normal".** The comparison is a rate against a rate: gold
closed up on 56.84% of the archived sessions, so a state that closes up 62 days in 100 is 5 points ahead of that
baseline, and 5% of price (about 227 dollars on the last session's open) is a different unit that never enters
this comparison. The bar is stated in counts only, per question 13.

**Three guards, each aimed at a known way a raw correlation misleads.** (1) *The baseline is the cohort's own
rate, never 50%*: gold drifts up, so a factor that merely fires on the up days would otherwise look skilful - and
on the path side the baseline is just as high (a 0.50 L2L move happens either way on 97.89% of sessions, an L2L
move on 75.26%), which is why every share is printed beside the share the whole cohort gets on the same rows.
(2) *The sign has to hold in each year, not only pooled*: the fixed-0.80% rows show the failure directly, with
the reach-in-call-direction share running 32.40%, 38.43%, 62.82% across 2024-2026 while the L2L form runs 39.60%,
37.19%, 38.46% - a fixed percentage of price is a different bet each year, which is why the L2L unit is used.
(3) *Overlap is subtracted, not ignored*: 28 variables on one instrument will agree by construction, so the
correlation/overlap matrix from the accepted plan is what stops three correlated factors from being presented as
three independent confirmations. A fourth limit is arithmetic rather than methodological: about 470 daily anchors
can *show* a 5-point gap but cannot *confirm* it (about 774 are needed for 80% power on that size), which is the
case for D5 and the hourly rebuild.

**The direction read just measured is the counter-example, and it is worth keeping in view.** If "the L2L move
happened and the call was right" were an edge, the calls would beat the drift on the days a one-sided move
occurred. They do not: 45.63% at 0.50 L2L and 46.56% at L2L against 61.13% and 56.23% for always saying "up" on
the same rows. So this criterion, applied to the accepted calls, reads as a deficit rather than an edge - and the
same test is what will be applied to any state that *does* clear the bar, which is the point of running it first.

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

**The movement-then-direction read, batch 3 (scan `tmp/l2l-scan7-20260929.js`, read-only).** Sides are read from
the archive's own excursions, which are stated **relative to the call**: the figure marked *up* is
`maxFavourableExcursion` for a bullish call and `maxAdverseExcursion` for a bearish one. The mapping is verified in
the scan itself, because `favourable >= 0.50 L2L` has to reproduce `reachedHalfAdr20` (64.04%) and
`favourable >= L2L` has to reproduce `reachedFullAdr20` (38.42%); both assertions pass.

| Gold, movement that happened, then direction | 0.50 L2L (ADR20 x 0.25) | L2L (ADR20 x 0.50) | fixed 0.80% |
| --- | ---: | ---: | ---: |
| a move of that size happened, either direction | **97.89%** | **75.26%** | 74.39% |
| no move of that size | 2.11% | 24.74% | 25.61% |
| of the moved sessions, up only / down only / both sides | 38.89% / 24.73% / 36.38% | 51.52% / 40.09% / 8.39% | 52.12% / 36.32% / 11.56% |
| call's own direction reached the floor | 64.04% | 38.42% | 39.12% |
| among the moved sessions, the move went the call's way | 65.41% | 51.05% | 52.59% |
| one-sided sessions only: call matched the side that moved | **45.63%** (162/355) | **46.56%** (183/393) | 46.40% (174/375) |
| always saying up on those same rows | **61.13%** | 56.23% | 58.93% |
| call matched the side that moved, by year (one-sided) | 47.88% (79/165), 40.29% (56/139), 52.94% (27/51) | 48.55% (84/173), 42.69% (73/171), 53.06% (26/49) | - |
| reached the floor and then reversed by the close | 20.18% | 6.32% | 20.18% |

Two readings matter and pull in opposite directions. The movement stage is nearly always "yes" at 0.50 L2L
(97.89%), so 0.50 L2L is a floor that almost every session clears - it cannot sort the days. The direction stage is
the unexpected one: on the sessions where the move went one way only, the call's direction was right 45.63% (0.50
L2L) and 46.56% (L2L) of the time, while always saying "up" on those same rows would have been right 61.13% and
56.23% of the time. It is the same finding the accepted verdict already carries (call right at the close 46.32%
against 56.84% up-closes), now read through the user's own criterion, and it does not depend on the floor: at a
fixed 0.80% the calls score 46.40% against 58.93%. Sessions where both sides reached the floor are excluded from
the matched/missed count (a call is "right" either way once both sides have been touched) and are shown in the
split row instead. First-touch order is not recoverable from the archive, so "the side that moved" means the side
with the larger excursion, which is the only side ordering these fields support.

**Year stability, which is the argument for the L2L unit.** The share of sessions reaching the floor in the
call's direction, per year: at a *fixed* 0.80% of price, 32.40% (2024), 38.43% (2025), 62.82% (2026, n 78); as
1.00 L2L, 39.60%, 37.19%, 38.46%; as 0.50 L2L, 63.60%, 64.88%, 62.82%. Gold's median ADR20 went from 1.32% to
3.12% over the period, which is why the fixed number drifts: a fixed percentage of price is a different bet
each year on this instrument, while the L2L form is the same bet.

**Horizon ladder, measured (batch 4, question 15; scratch scan `tmp/l2l-scan8-20260929.js`, read-only).** The user
replaced "is 5 sessions the secondary horizon" with **"24h, 48h, 3d, 5d"**, asked because they want to know
"is it a 24h impact or does it set the tone for a few days so we can safely treade in that direction". So the
ladder is measured on the same 570 gold call sessions, window by window, using the hourly series the accepted
report itself used (canonical `backtester/tmp/gold-hourly-extended-20260918/candles.json`, 21,871 complete H1 mid
bars, 2023-01-02 to 2026-09-11). Each window runs from the row's own session open for *w* times that row's own
session length in hourly bars (median 23 bars per session), so 5 sessions is 5 sessions of market-open time and
never 120 clock hours - the plan's own rule for this horizon.

Alignment is asserted, not assumed: the hourly index is strictly ascending (PASS), `fullDistance = 0.50 x ADR20`
and `halfDistance = 0.25 x ADR20` on every row (PASS), and the **1-session column reproduces the archive's own
fields exactly** - `reachedHalfAdr20` 64.04% vs 64.04% and `reachedFullAdr20` 38.42% vs 38.42% (PASS). The longer
columns are the same measurement with a longer window.

| Gold, 0.50 L2L, n 570 per column | 1 session | 2 sessions | 3 sessions | 5 sessions |
| --- | ---: | ---: | ---: | ---: |
| a 0.50 L2L move happened, either direction | 97.89% | 99.82% | 99.82% | 99.82% |
| the call's own direction reached 0.50 L2L | 64.04% | 75.26% | 78.95% | 82.63% |
| the call's own direction reached a full L2L | 38.42% | 54.74% | 62.28% | 69.12% |
| one-sided windows only: the call named the side that moved | **45.63%** (162/355) | 47.57% | 45.66% | **44.32%** |
| always saying up on those same rows | 61.13% | 61.42% | 64.38% | **67.05%** |
| the window closed on the call's side | 46.32% | 51.40% | 48.07% | 45.79% |
| always-up close baseline on the same rows | 56.84% | 59.12% | 60.35% | 65.09% |
| of the calls that reached 0.50 L2L, closed the window beyond the floor | 48.49% | 48.95% | 47.56% | 47.13% |
| of those same calls, still on the correct side at the close | 68.49% | 67.13% | 59.33% | **55.20%** |

Read in the user's own words: **the move is the same-day part and it stays true; the direction is not there at
any length.** The floor is reached at a day 97.89% of the time and at five days 99.82% of the time, so "will it
move" is certain and useless as a signal at every window. Direction gets no better with time: on the one-sided
windows the call named the side 45.63% at one session and **44.32% at five**, while always saying up on those same
rows improved from 61.13% to 67.05%, so the gap widens from 15.5pp to 22.7pp. At the close it is the same story in
a different unit - the call's side wins 46.32% at one session, 45.79% at five, against 56.84% and 65.09% for up.
And the move is handed back rather than carried: of the calls that reached the floor, 68.49% were still on the
right side at the one-session close but only **55.20%** at the five-session close. There is no multi-day "tone"
in this data to trade - it is a same-day spike that fades, and holding longer makes the calls look worse while the
direction stays unknown. Per year, one-sided call match at 1 / 2 / 3 / 5 sessions: 2024 47.88% / 47.97% / 47.47% /
48.05%; 2025 40.29% / 43.14% / 40.23% / **36.99%**; 2026 52.94% / 57.14% / 54.55% / 53.85%.

**The wall-clock version, disclosed (it is how the user said it).** The same ladder measured as 24h / 48h / 72h /
120h of clock time from the session open, with the daily break and the weekend sitting inside the window, gives
0.50 L2L either way 97.89% / 99.47% / 99.65% / 100%, call-direction reach 64.04% / 72.81% / 74.74% / 80.53%, and
one-sided call match 45.63% / 46.67% / 45.80% / 45.05% against always-up 61.13% / 61.75% / 61.83% / 65.84%. It
answers the same way, and it is the version a trader lives through, but a weekend falls inside the later windows:
458 of the 570 five-session wall-clock windows contain fewer open hours than the label implies (median 69 hourly
bars of the 120 clock hours), so the open-hours ladder above is the one to publish and this one travels as its
sensitivity.

**Limits carried with the ladder.** (1) **48h and 3d do not exist in any accepted artifact** - the archive
measures one session per row - so a lane-1 run that declares the 1/2/3/5 windows is required before these rows
can ship; what is measured above is the hourly series joined to the same anchors, not a published artifact.
(2) The four columns overlap and each is a strict extension of the one before it, so they are four looks at one
anchor and never four independent confirmations (question 17). (3) The anchors stop at 2026-04-30 while the candle
series runs to 2026-09-11; no new anchors were created and no outcome was invented. (4) Mid prices, no spread, no
slippage, and a blocked move back to the open is not a stop, a target or a path.

Provenance: `data/half-l2l-reach-research.json` sha256
`0d2955248066be6dff0741ae89fbe3e7de4ead6294c6bec16aa09a1aa452e9b8`,
`data/l2l-trading-day-directional-v1.json` sha256
`75a81e8429a1515de42b326fd29cb60ee81c24cc6e0d111a3cb954a9e6d41c59`, and
`data/l2l-directional-research-verdict-v1.json`, whose unchanged verdict is "The current Layer 1 and Layer 2
calls are not validated predictors of the designated trading session's closing direction". The reach figures
that verdict disclaims (96.99% half, 70.52% full) are the path-dependent original metric; the reconciled
figures are 64.04% and 38.42% above. Nothing in this section is a finding - the intervals are consumed, so
these are sizing facts and base rates only.

