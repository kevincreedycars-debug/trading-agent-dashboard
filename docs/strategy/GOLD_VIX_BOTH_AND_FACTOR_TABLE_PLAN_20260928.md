# Gold: first does it move, then which way — short plan (both VIX streams kept)

Advisory recommendation from worker `strategy` (`strategy-advisory-001`), 2026-09-28. Every number below
was read on 2026-09-28 from files named in-line with read-only commands. Nothing here is a prediction, an
accuracy claim, a signal or a trading result; every interval involved is already spent.

Mechanical detail for the two implementation lanes lives in
`docs/strategy/GOLD_BAND_FIX_AND_EDGE_TABLE_SPEC_20260928.md` (registry rows, code line numbers, the run
command, the JSON shapes). **This file is the readable version and it decides; the other file is the
appendix.** If the two ever disagree, this one wins and the other gets fixed. **Sections 2–4 answer the split
this revision adds — first "if a move happens", then "which way" — and sections 5–8 keep the VIX and table
design from the previous revision.**

**Revised 2026-09-29 after batches 1-4 of the intent sheet (18 of 50 answered).** Four things changed and nothing
else did: the session floor is the user's own **0.80% of price in the call's direction**, published beside its L2L
form; the **order** is now movement first and direction second, read on the moved subset (D1); the horizon is now a
**ladder of 1, 2, 3 and 5 sessions** rather than a single week, measured in §3, because the user wants to know
whether a call is a 24-hour event or sets the tone for several days; and **no row is ever dropped for being thin or
rare** (questions 9 and 12). The user also asked for every table to be complete - "just fill the gaps so we have
all data clear" - so no cell is left blank where a number exists.

**Revised again 2026-09-29 after batch 5 (23 of 50 answered).** This revision adds no new measurement and moves no
number. Five of seven questions came back as answers and two as a request for plain English: each factor's reading is
the **two-light** form with **one short reason line underneath it** (question 11), the four stage-2 rules are now the
user's own declarations rather than the plan's defaults (questions 18-21: direction only where the movement stage
showed something, the side only and never how far, the same sign in every year, both accepted bars kept), and
questions 22 and 23 - whether the ten factors that already have a written sentence are checked first, and whether the
twenty with no sentence get their meaning agreed before any outcome is read - are re-asked in plainer words with
their defaults (yes) standing, so the order of the work is the only thing waiting. The user then asked to hold
overnight, so nothing further is sent tonight.

**Revised again 2026-09-30 after batch 8 (40 of 50 answered).** Seven questions came back - the rest of the sample
group and the first two of the tradability group - and they change the **claims** this deliverable makes rather than
any number it holds. No new measurement was taken for this revision and nothing already measured moves.
(1) **The movement ranges are the user's already-stated pair** (answer 36: *"it should be the previously stated
direction ranges, l2l and 0.5l2l"*), so the stage-1 milestone is **0.50 L2L (ADR20 x 0.25)** and **L2L (ADR20 x
0.50)** with the fixed 0.80% and 0.30% rows kept as labelled sensitivities - nothing new is declared and nothing is
fitted. (2) **The forward-looking framing is withdrawn** (answers 37 and 38): this work is not a forecast, so no
page, row, limit or comment carries a holdout, a sealed window or a "re-check when it opens" step, and a printed
date range is a scope statement about which archive was read. (3) **No dealing cost is subtracted and no trading
result exists** (answer 40: *"this is pureply a data corrleation exercise nothing else"*), and the flags are not
traded now (answer 39) - their stated purpose is to **reassemble the daily-call logic from this work later**, which
is a separate future step. (4) **The work has to be visible on the live dashboard while it is still being edited**
(the user's own instruction, quoted in §12): a draft page is prepared here and published by the dashboard lane, and
it may never carry a forecast, a holdout or a trading result.

**Revised 2026-09-30 after batches 9 and 10 (50 of 50 answered - the question round is closed).** The last ten
answers decide **when a count starts, what the page carries and in what order the work happens**, and nothing else.
(1) **The count starts at the next session's open** (answer 41) and may use nothing from the day it measures (42): a
Friday state begins at Monday's open. (2) **A second, during-session stream is added** - the request inside answer 42,
*"can we do both pre session and during session?"*: a state that only appears inside the session is timed from the bar
that first shows it and measured to that session's close, with the next session's close printed beside it, kept
separately labelled and never pooled or averaged with the before-session count, because the two windows differ in
length and overlap; the state uses only what was available at the trigger bar; the same-day overlaps count once in
`looks_counted`; and no new data is needed, because the trigger uses the hourly series the accepted report itself
used. Two details of it are with the user, defaults standing: the trigger reads the accepted hourly bars, and its
headline window ends at that session's close. (3) **The deliverable is the full page beside the accuracy panel**
(answer 49), not the minimum version appended to the scorecard page, carrying no direction claim (43) and never
calling a ranked row the winner (45). (4) **The order of work is fixed** (answers 47 and 50): the movement screen is
built first, and the direction layer is rebuilt only after the movement layer is agreed. (5) **The answers are
recorded as decisions before any lane starts** (48) - this paragraph, the answer sheet, the appendix and the draft
page are that record. No number already measured moves with any of it, and no lane's scope grows: the during-session
stream is one more labelled block inside the same measurement lane, not a new lane.

## 1. What you asked for

1. Simplify the plan.
2. **Keep both VIX streams** — the absolute level bands *and* the change states — and see which of them
   show the kind of correlation we care about.
3. **Split the question in two: first "if a move happens", then "why up or down"** — and rebuild the
   analysis engine once those two are on solid ground.

All three are answered below. The simplification is real, not cosmetic: the VIX-change half turns out to be
mostly answerable **from a file that already exists**, so it costs no new run; the "does it move" half has
never been asked and the data for it is already measured and unused; and the decision list drops from
fifteen questions to five.

## 2. The answer in one screen

Four bullets, every number measured on 2026-09-28:

- **Which way: tested, empty.** Of 51 states, 25 carry a declared direction, 20 have no rule in the document
  at all, and 6 are declared NEUTRAL — so 26 were never testable. None of the 25 is reliable: 25 of 25 are
  `no_information` on the session, 24 of 25 on the week, the last `unstable_across_years`. 20 of the 25 lean
  the document's way, but only from −2.54pp to +5.46pp, and the accepted gate needs 5pp with the same sign in
  every year.

- **Best row = noise floor.** The largest row, F9, is +4.70pp on the session and +5.46pp on the week against
  its own drift — z 2.05 and z 2.40. If nothing were real, 25 rows on two horizons would still throw up about
  **2.3 rows** that size by chance. One did. That is the noise floor, not a candidate.

- **"If a move happens": never tested.** The test sorts every anchor into up or down and has no flat bucket:
  across the 25 rows `exact_zero` totals **0 on the session and 0 on the week**, and the baselines are exact
  complements (55.81% / 44.19%). A three-cent day counts the same as a 3% day, so the archive has never asked
  whether a factor is followed by a move.

- **The test is small, so "if" goes first.** One standard error is ~2.3pp at ~470 anchors per state: a true
  3pp edge passes the gate ~6% of the time, a real 5pp edge ~28%, only ~8pp reliably (77%). So the verdict is
  "nothing large showed up", not "nothing is there". The movement numbers stage 1 needs already exist and were
  never used (147,465 each of `median`, `q1`, `q3`), which makes asking "if" close to free.

## 3. Stage 1 — "if a move happens": the part we can read today

**The move size is already measured and unused.** The accepted report defines and stores it: its
`outcome_definition.magnitude` reads "counts, median, first quartile and third quartile of the realized
return percentage per state", and a scan of the 95,842,994-byte report counts 147,465 `median`, 147,465
`q1` and 147,465 `q3` fields. No cut has used them. So stage 1 can begin with **no new run**: for every
state, compare its realized-return spread (q1, q3, and the distance between them) with the cohort's, on both
horizons. A state whose spread is wider is a state in which gold moves more while it is on.

**What is missing is a floor, and it has to be drawn, not found.** The report stores no per-anchor return,
so "how often does a move cross a floor" needs either the floor declared before a re-run or a join from the
anchors to the price series. The data cannot supply the floor on its own: with zero `exact_zero` outcomes
there is no "no move" bucket to discover, only a line to draw. (The series the accepted report itself used
is available for such a join: `backtester/tmp/gold-hourly-extended-20260918/candles.json`, XAU_USD, hourly
from 2023-01-02.)

**The floor is now the user's, declared on 2026-09-29, and it is written in two units at once.** They asked
for "minimum 0.8% movement in the direction of the call during the 24hr session" — so the session floor is
**0.80% of price, in the direction of the call**, and beside it the same floor in the archive's own L2L units:
**1.00 L2L = 0.50 x ADR20**, which is **0.7236%** of the session open at gold's median ADR20 (1.4472%, 570
gold call sessions, 2024-01-04 to 2026-04-30, `data/l2l-trading-day-directional-v1.json`). The two differ by
1.11x. Both are published, together with **0.50 L2L** (0.3618% of price) and the plan's earlier 0.30% as fixed
sensitivity rows, under a single `looks_counted` for the whole sweep.

**The user's own L2L figure, 2026-09-29, and it settles the unit question.** They reported L2L **1.68%** "at
present on the charts I use". L2L is a rolling number wherever it is drawn — 0.50 × ADR20 over the most recent
20 sessions — so a chart value and a period median are different statistics. The 0.7236% above is the
**period** median (median ADR20 1.4472% across the 570 sessions); read by year the same rows give ADR20 1.32%
(2024), 1.43% (2025) and **3.12% (2026)**, so the chart-current L2L is 0.66%, 0.71% and **1.56%**, and **1.83%**
on the final 20 sessions (2026-04-01 to 04-30). Their **1.68% implies ADR20 3.36%** and matches that recent band,
so their chart is consistent with this archive. It also means their 0.80% is **0.48 L2L today** (0.80 / 1.68), so
their original "that is 0.5 l2l" was right for the current regime, and the 1.11x figure is only right against the
whole-period median. **Print L2L with its window.**

**Why both units, measured.** The share of gold sessions whose favourable excursion reaches the floor is
32.40% (2024), 38.43% (2025) and 62.82% (2026, n 78) when the floor is a *fixed* 0.80% of price — a 30pp
swing, because gold's median ADR20 went from 1.32% to 3.12% over the same period. Written as 1.00 L2L the same
floor gives 39.60%, 37.19% and 38.46%, flat within 2.4pp, and 0.50 L2L gives 63.60%, 64.88% and 62.82%. A
fixed percentage of price is a different bet each year on this instrument, and the year-sign test would then
flag a volatility regime as instability in the factor. The user's level is honoured; the L2L row is the one
that can be re-tested. On today's chart values the same three rows read as the floor at **0.48 L2L** (0.80% of
price against L2L 1.68%), **1.00 L2L** (1.68%) and **0.50 L2L** (0.84%) — so the user's fixed 0.80% *is* the
0.5 L2L row in the current regime, which is the other reason both units are printed rather than one.

**The user's batch-3 answer reorders the floors, and it is now the ruling one.** Asked to confirm the two-unit
default in plain words they answered: *"Yes its the 0.5l2l and l2l directional movement happened that we are
interested in primarily, then we want to see if the directional call was correct for the l2l that occured"*. So
the published floor set is ordered **0.50 L2L (ADR20 x 0.25; 0.3618% at the period median, 0.84% on today's
chart) first, L2L (ADR20 x 0.50; 0.7236% and 1.68%) second**, both counted in *either* direction as the movement
that happened, with the fixed **0.80%** kept as the chart-current instance of 0.50 L2L and **0.30%** kept as the
fixed sensitivity row. The structural change is in stage 2: the direction question is asked **after** the
movement and **conditioned on it** - "was the call's direction the move that occurred" - so direction is read on
the sessions that reached the floor, never on all sessions. D1 had said "ask if before which way"; the user has
now said the same thing with "if" spelled out as 0.50 L2L and L2L. Their answer also removes the last of the
jargon: the words *headline* and *floor* are retired from user-facing wording entirely, replaced by "the one
number in large text" and "the smallest move we count as a move".

**Association, not cause - and the user has been told so in those words.** They asked whether this is simply
tracking correlation. It is, and §6 states it explicitly: every published number is an association between a
state observable *before* the session and what price did *during* it, compared with the cohort's own rate on the
same rows, and no row claims the state caused the move. An association earns a table row when it survives three
guards - cohort baseline rather than 50%, per-year sign, and the overlap matrix that stops correlated factors
being counted as independent confirmations - and one arithmetic limit: about 470 daily anchors can *show* a 5pp
gap but cannot *confirm* it (about 774 are needed for 80% power on that size), which is the case for D5.

**Horizon ladder (user, 2026-09-29, batch 4, question 15).** The user replaced the single week horizon with a
ladder and said why: *"24h, 48h, 3d, 5d we are just trying to understand is it a 24h impact or does it set the
tone for a few days so we can safely treade in that direction"*. So the horizon set is **1, 2, 3 and 5 sessions**,
each measured from the row's own session open for *w* times that row's own session length (5 sessions is 5
sessions of open market, never 120 clock hours), and the ladder has been read on the hourly series the accepted
report itself used. The 1-session column reproduces the archive's own fields exactly (64.04% and 38.42%, asserted
in the scan), so the longer columns are the same measurement with a longer window.

The answer is that **the movement is same-day and the direction never arrives**: a 0.50 L2L move happens in 97.89%
of sessions and in 99.82% of five-session windows, so the floor cannot sort days at any length; the call's own
direction reaches it 64.04% -> 82.63% across the ladder, which is the arithmetic of more time, not of a stronger
signal; on the one-sided windows the call names the side **45.63% at 1 session and 44.32% at 5**, while always
saying up on those same rows goes 61.13% -> **67.05%**, so the gap widens from 15.5pp to 22.7pp; at the close the
call's side wins 46.32% at 1 session and 45.79% at 5 against 56.84% and 65.09% for up; and of the calls whose
direction did reach the floor, 68.49% were still on that side at the one-session close but only **55.20%** at the
five-session close. Per year the one-sided match stays in the same band at every window (2024 ~48%, 2025
40.29% -> 36.99%, 2026 ~53-57%). So there is no multi-day tone here to trade: the pattern is a same-day extension
that fades, holding longer makes the calls look worse, and no window rescues direction. The wall-clock reading
(24h/48h/3d/5d as the user said it, weekends inside the window) gives the same answer and is disclosed as the
sensitivity; the open-hours ladder is the published form. Full numbers, method and limits: the sheet's
"Horizon ladder, measured" section, scan `tmp/l2l-scan8-20260929.js`.

**Week floor, and its L2L form.** 1.00% stays the plan's fixed week floor until the user says otherwise, and its
L2L form is *not* proposed: a multi-session extension is not a fixed multiple of the 1-session range, and inventing
that multiple is exactly what this section refuses to do. The ladder changes which rows exist, not how the floor is
written. **48h and 3d exist in no accepted artifact** - the archive measures one session per row - so the four
windows above are a lane-1 deliverable with a re-declared horizon, not something the current archive can publish.

**Same bar as everywhere else.** A stage-1 state is interesting only if `n >= 100`, the gap against the
cohort's own share is at least 5pp, and the sign holds in every year with n >= 20. No new threshold is
introduced anywhere.

**Thin states are shown, never dropped** (user, 2026-09-29, batch 3: *"No if its relevant we always need to be
aware of its impact on the market"*). Every state is listed with its day count, and a state with too few days to
judge is printed unscored with "few days" beside it. The `n >= 100` bar decides only whether the row may carry
an interest flag or clear the 60% gate; it decides nothing about whether the row is shown. In plain words, which
is how it must be said to the user: `n` is how many past days the state covers, and "5pp" means **5 days in every
100**, not 0.05% of price — a factor that fires on up-closes 62 times in 100 where gold closes up 57 times in 100
is 5pp ahead of its baseline (the measured gold baseline is 324 of 570 sessions, 56.84%; 5% of price would be
about 227 dollars on the 4,540.13 open of the last archived session).

**Nothing here is fitted** (user, same day: *"we are trying to fit anything we are just observing the data and
then confirm what price did and did not do"*, read as *not* trying to fit). Stage 1 and stage 2 as specified are
description: the floor is the user's own fixed 0.80% (or its L2L translation), and no threshold, weight or window
is estimated from outcomes. The out-of-sample requirement of question 33 therefore attaches to a **declared
rule** — a rule written down before its outcome is read, as question 23 requires for the undeclared variables —
and not to an observation table. It is **deferred by user instruction**, to be re-raised if and when a rule is
declared.

## 4. Stage 2 — "which way", once a move is on the table

Direction is only worth asking about for states that pass stage 1: a factor that does not change how much
gold moves cannot change which way it moves on average. That is now the user's own instruction and not a default
(question 18, batch 5: *"yes makes sense"*), together with the other three stage-2 rules (question 19: the side
only, no "how far"; question 20: *"yes every year"*, the sign must hold in every year; question 21: keep the
accepted 60% bar beside the 5pp gap). Today stage 2 is the 25 rows above, and the answer
is empty. It stays published that way, with the z-accounting in §2 so that no reader mistakes a 2.4-sigma
cell for a finding.

**The user's own stage-2 criterion, measured once (2026-09-29, read-only).** Read exactly as they asked - the
movement that happened at 0.50 L2L and L2L, then the direction of that movement against the call - the archive
says: a 0.50 L2L move happened either way in **97.89%** of the 570 sessions and an L2L move in **75.26%**; the
call's own direction reached the floor 64.04% and 38.42% of the time (the archive's own `reachedHalfAdr20` and
`reachedFullAdr20`, reproduced exactly by the scan as a standing assertion); and among the sessions where the
move went **one side only**, that side was the call's direction **45.63%** (162/355) at 0.50 L2L and **46.56%**
(183/393) at L2L, against **61.13%** and **56.23%** for always saying "up" on the same rows. By year at 0.50 L2L
the same figure runs 47.88%, 40.29%, 52.94%. The criterion therefore does not rescue the calls: under it they sit
*below* the drift, which is the same conclusion as the close-based base rate above, reached by a different route.
Two side facts to carry: 0.50 L2L cannot sort days (only 2.11% of sessions fail to move that far), and 36.38% of
the sessions that do move that far touch the floor both ways - so stage 2 has to be read on the unambiguous
one-sided split, not on the reach count, and the published tables must print that split. Excluding both-sided
sessions is also why the one-sided figures cannot be compared with the unconditional 64.04% / 38.42%: they are
different universes, and the row that holds them has to say so.

**The same stage-2 criterion on the longer windows (question 15, read-only, scan `tmp/l2l-scan8-20260929.js`).**
The ladder does not rescue direction; it makes it look worse. On the one-sided windows the call names the side
45.63% at 1 session, 47.57% at 2, 45.66% at 3 and **44.32% at 5**, while always saying up on those same rows goes
61.13%, 61.42%, 64.38% and **67.05%**, so the gap widens from 15.5pp to 22.7pp. At the close the call's side wins
46.32% -> 45.79% against 56.84% -> 65.09% for up. And the move is handed back rather than carried: of the calls
whose direction reached 0.50 L2L, 68.49% were still on the right side at the 1-session close but only **55.20%** at
the 5-session close. Per year the one-sided match stays in the same band at every window. So a stage-2 row read at
5 sessions is the same empty answer as at 1, and the published 5-session rate must never be presented as a
confirmation of the 1-session one: four windows, one anchor, one look (question 17).

**What stage 2 would need to be answerable — the rebuild's real constraint.** 80% power to see a 3pp edge
needs about **2,100 anchors per state**; today there are about 470. A 5pp edge needs about 774. The same
archive holds roughly 23,000 hourly XAU_USD bars from 2023-01, so that sample can be had at hourly
granularity — but hourly entries with a 24-hour endpoint overlap each other, so the effective count sits
below the raw count and the horizon would have to be re-declared. The honest conclusion for the engine: the
direction layer cannot be rebuilt on 965 daily anchors, and a rebuild should fix its sample size and its
floor first, then measure.

**The gold base rate for stage 2 is measured, and it is not 50%.** On the same 570 gold call sessions the call
is right at the session close **46.32%** of the time while gold closed up **56.84%** of them, so an
always-bullish rule beat the calls by 10.5pp. The loss sits almost entirely in the bearish calls: 300 of the
570 calls were bearish and were right 40.00% of the time, against 53.33% for the 270 bullish calls and the
56.84% always-up rate. At the user's own 0.80% floor the unconditional figures are 39.12% of sessions reaching
0.80% in the call's direction, 43.86% reaching 0.80% against it, and 32.63% reaching it *and* still closing
the call's way. So a stage-2 claim has to beat 56.84%, not 50%, and a stage-1 claim has to beat 39.12%. These
are sizing facts read after the interval was spent, not findings, and they are also the reason the direction
layer's failure is better described as "the bearish half is broken" than as "gold is unpredictable".

## 5. The VIX streams, and which of them we can already read

The live Layer 1 document declares F6's inputs as `vix_level`, `vix_d1`, `vix_d5`
(`logic/agent_gold_direction.md`, lines 279–295) but writes rules for **the level only**: "VIX >25 =
BULLISH", "VIX <16 = BEARISH", "16-25 = NEUTRAL". So the document itself asks for both VIX streams and
only ever defined one. That is why the accepted direction check prints every VIX state unscored.

Only one VIX series exists in this archive — FRED `VIXCLS`, 97,074 bytes, in the 019 source set. "Both
streams" therefore means **two ways of using one series**, not two data sources.

**Stream A — the level band (the document's numbers).** Not readable anywhere today. The accepted report
has no raw values (a scan of the 95,842,994-byte report finds zero occurrences of the field `"values"`),
so the 25/16 bands need the new measurement run.

**Stream B — the change states.** Already readable, and here they are, taken from the accepted
`data/gold-direction-scorecard-20260927.json` `unscored` blocks (`session_raw`, `week_raw`). These are raw
gold-up rates with **no direction attached**, exactly as the accepted artifact publishes them:

| State (F6) | session n | session gold-up | week n | week gold-up |
| --- | ---: | ---: | ---: | ---: |
| `vix_d1` positive (VIX up over 1 obs) | 437 | 52.86% | 433 | **60.51%** |
| `vix_d1` negative | 523 | 58.32% | 523 | 56.60% |
| `vix_d1` exact zero | 4 | 50.00% | 4 | 25.00% |
| `vix_d5` positive | 456 | 59.21% | 453 | 59.82% |
| `vix_d5` negative | 507 | 52.86% | 506 | 56.92% |
| `vix_d5` exact zero | 1 | 0.00% | 1 | 0.00% |
| `vix_level` above own median (context only) | 481 | 56.96% | 481 | 58.84% |
| `vix_level` at or below own median | 483 | 54.66% | 479 | 57.62% |

Drift for reference: session 55.81% (n 964), week 58.23% (n 960).

**What this actually says, honestly.** On the session — the main number — **no VIX state clears 60%**; the
best is `vix_d5` positive at 59.21%, still under. The single row that touches the bar is `vix_d1` positive
at the **week** horizon at 60.51% (n 433), and that row must not be presented as a result: it is one of
twelve looks (six change legs across two horizons), it is a post-hoc read of an interval that was already
spent when the accepted report was published, and the same state's session number is 52.86% — *below* the
55.81% drift, i.e. the opposite of interesting on the horizon this project treats as primary. Its
magnitude is also a coincidence: 60.51% is also F9's session hit rate, from different counts (262 of 433
versus 285 of 471). Any future claim about this row needs a fresh read on rows the reader has not already seen, not
a re-captioning of this table. The forward-looking version of that idea - protecting a window and re-checking
survivors when it opens (questions 37 and 38) - is **withdrawn by the user's own answers**, because this work is not
a forecast; what remains is the plain rule that a *claim* waits for a declared rule, which is question 33.

## 6. Where the "correlations we care about" bar is

One bar, stated once, used everywhere (unchanged from the accepted scorecard's own parameters: `min_n`
100, `min_year_n` 20, `edge_pp` 5, `threshold_pct` 60):

A state is **interesting** only if all six hold — (1) the document declares a direction for it, (2) session
`hit_rate_pct >= 60`, (3) `n >= 100`, (4) `|drift_edge_pp| >= 5` against the same-horizon drift, (5)
`years_same_edge_sign` true, (6) `n >= 20` in at least two of 2023–2026. The table carries a
`clears_interest_bar` boolean per row so the page can show, without commentary, that **nothing clears it
today** — and will show that again whenever it runs. Rows without a declared direction can never clear it;
they are published as raw context instead, which is the honest shape for a rule that does not exist yet. (The
*reliability percentages* added 2026-09-30 by the user's answer to question 23 are published in that same block and
are labelled as observations of the archive: the bar is for declared rules only.)

Per-year drift, so the 60% figure cannot be read as a 60% expectation:
2023 51.54%, 2024 59.16%, 2025 60.15%, 2026 50.83% (session).

The same bar governs the movement stage with condition (2) replaced: instead of a 60% hit rate, a state needs
a 5pp gap against the cohort's own share of anchors above the declared floor. Everything else — n >= 100, the
year-sign test, no invented direction — is unchanged.

**What the bar is measuring, stated for the reader (the user asked, batch 3).** Every number in this table is an
**association**, not a cause: a state that is observable *before* the session, set against what price did
*during* it, compared with the cohort's own rate on the same rows. The table says "gold rose on 62 of these 100
sessions while this state was on, against 57 of 100 for the cohort", and never "this state pushed gold up". The
three conditions above are exactly the guards a raw correlation needs to pass before it is worth a row: the
comparison is the cohort's own drift and not 50% (condition 4 — gold closed up on 56.84% of the archived gold
sessions, so an always-bullish rule beats a coin flip without any factor at all), the sign has to hold in each
year rather than only pooled (condition 5, because gold's volatility regime moved ADR20 from 1.32% to 3.12%
across the period, which alone flips any fixed-percentage threshold), and the overlap matrix from §7 keeps
correlated factors from being presented as independent confirmations (28 variables on one instrument will agree
by construction). Condition 1 is there because a state with no written direction can carry a raw rate but can
never carry a claim.

**Amended 2026-09-30 by the user's answers to questions 23, 24 and 28-32.** Three declarative changes, none fitted, plus one clarification of the first.
(1) *The twenty with no written sentence now carry an assigned direction and a reliability percentage*, by the
user's own method (answer 23: *"you know what the factors are then we see what price did then we assign a
correlation"* - an up-implying factor that sees price up 70% of the time is *70% reliable*), so the earlier
precondition that their meaning be agreed before any outcome is read is **withdrawn**. The assigned direction is
written down with the date it was set, the percentage is printed beside the cohort's own rate on the same rows
(gold drifts up: 56.84%), the pair is labelled a **description of the archive**, it cannot clear condition (1), and
question 33's deferred out-of-sample step attaches to a declared rule read on rows the reader has not already seen -
and, by the user's batch-8 answers to 37 and 38, **not** to a window held back for a future test: that framing is
withdrawn because this work is not a forecast. (2) *NEUTRAL rows
get the cohort benchmark and a look*: a declared NEUTRAL state still never enters a hit rate, but its raw up/down
split now prints beside the same-cohort rate on the same row, it is charged to `looks_counted`, and a persistent
gap is the trigger to declare a rule for that band rather than a reason to drop it. The band `inside_16_25` is why
that matters: it holds the largest share of days, so a headline rate without its line would describe the minority
of sessions.

(3) *The F9 rebuild's trigger is chosen by printed sample size* (answer 32: *"Which ever gives us the most data we
can then refer back to"*). The union (VIX above 25 **or** an archived war / geopolitical / conflict / sanction
event), the VIX branch alone and the event-name branch alone are each measured on the same window with their own
day count printed on the same row; the state `safe_haven_stress` uses the candidate with the most observations; and
the candidates that lose stay on the page as counts, so the choice can be revisited from the same table rather than
rebuilt. The *assumption the document does not contain* flag stays on the `interpreted` news-tone row meanwhile.
The clarification of answer 23 changes no rule: the user is stating that the present goal is understanding how the
factors historically moved price, so the reliability percentage stays an account of past reactions rather than a
forecast, which is the label already attached to it.
**Added 2026-09-30 by the batch-8 answers (34-40):** that batch fits nothing either. 36 restates the movement pair
already in force, 37 and 38 withdraw the forward-looking items, 40 withdraws cost netting and any trading result,
and 39 states the purpose of the flags for a later stage. The only change to this section is that condition (1) is
now the only route to interest for a claimed rule, since no prospective test is claimed anywhere.

One limit is arithmetic, not methodological: about 470 daily anchors can *show* a 5pp gap
but cannot *confirm* it (about 774 are needed for 80% power on that size), so a bar-clearing table row today is
reportable and worth watching, not established — which is what the D5 rebuild is for.

## 7. Design: both streams, one table, four row blocks

**Stream A rows — level bands, scored.** `vix_level` gets the document's own numbers as its declared
stratum: `above_25` (>25 strictly), `below_16` (<16 strictly), `inside_16_25` (25.00 and 16.00 land here,
because the document writes ">25" and "<16", not ">="). `above_25` gets the document's BULLISH, `below_16`
gets BEARISH, `inside_16_25` is a declared NEUTRAL and never enters a hit rate; per the user's answer to question 24
(2026-09-30) its raw split prints beside the same-cohort rate on the same row and it counts in `looks_counted`, so
an edge inside the no-view band stays visible instead of disappearing. Sizing checked before the
run from `VIXCLS.json` itself (weekday observations 2023-01-03 to 2026-09-21, 954 of them): 41 above 25
(4.3%), 400 below 16 (41.9%), 513 inside. So `below_16` will be testable and `above_25` will be **thin by
construction** — roughly 40 anchors against a 100-observation floor, which the table must label rather than
discuss. The 41/400/513 figures are a scratch estimate and are *not* the run's numbers.

**Stream B1 rows — change states, raw context only.** `vix_d1` and `vix_d5` positive, negative and
exact-zero legs, printed as a raw up/down split with n and drift, with `expectation: null`, `provenance:
"not_declared"`, `clears_interest_bar: false` and a visible chip reading "no rule in the document: context
only". This is exactly the shape the accepted scorecard already publishes for these states; the table
re-publishes it beside the level bands so both VIX streams are readable in one place, which is the point of
the exercise.

**Stream B2 rows — the declared sweep, reported in full.** The document names no magnitude, so rather than
invent one, the thresholds are **written into the v3 registry before the run** as an explicitly labelled
exploratory sweep: for `vix_d1`, |change| >= 1, 2 and 5 index points; for `vix_d5`, |change| >= 2, 5 and 10;
each leg reported in **both** directions (VIX up beyond threshold and VIX down beyond threshold), each with
n, session and week gold-up rate and the drift. Two disclosure fields ship with the artifact: `exploratory:
true`, and `looks_counted`, the exact number of states and sweep variants the table examined, so nobody can
present the best cell as if it were the only one. A sweep row never carries a direction and never clears the
interest bar; it exists to answer "is there anything here worth declaring a rule about" and nothing else,
and it must be read expecting several cells to beat drift by chance. The change legs run n≈430–520, so
thresholds of 1 or 2 points cost few observations while 5 points on `vix_d1` thins quickly.

**Block D — the movement screen, read first.** Before any direction row is read, the table carries block D:
for every state, the realized-return q1, q3 and the q1-to-q3 distance on both horizons beside the cohort's
own, all of it from fields the accepted report already contains. Once lane 1 has run, block D gains the share
of anchors above the declared floor at 0.80% of price in the call's direction, at 1.00 L2L (0.50 x ADR20: 0.7236%
at the period median, **1.68% on the user's current chart**), at 0.50 L2L (0.3618% at the period median, 0.84%
on today's chart) and at 1.00%, each one read on the **1/2/3/5-session ladder of question 15** instead of on a
single week, with the plan's earlier 0.30% kept as one fixed sensitivity row and one `looks_counted` for the
whole sweep (states x 4 windows x floor variants, question 16). The **"no move" bucket is printed twice and labelled**, because the user's
own reading ("most days move that much even if they dont close that much") is measured and is exactly right: at
0.80%, **74.39%** of sessions reach 0.80% from the open in one direction or the other, so only **25.61%** are a
*path* no-move, while only **41.58%** close beyond 0.80%, so **58.42%** are a *close* no-move. Nothing in block D
carries a direction, and its states are marked with the same bar as stage 2 but a 5pp gap against the
cohort's own share instead of the 60% level.

**One project precedent, for honesty.** `logic/agent_usd_direction.md` (line 154) does carry a VIX-change
rule — "VIX rising sharply over 1d or 5d = BULLISH modifier" — but that is the USD document and "sharply" is
unnamed there too. Gold's change stream therefore has no declared number anywhere; if a direction is ever
wanted for it, it must be declared as **new** and tested out of sample, not read back out of this archive.

**Not proposed.** No combination, no pair, no weighting, no composite score, no model, no LLM call, no new
data source, no Layer 1 edit. Pairs stay closed until the single factors are settled; that stays deferred.

## 8. The table and the page

One artifact (`data/gold-factor-edge-<YYYYMMDD>.json`, schema `gold-factor-edge-v1`) and one page, with
four row blocks in this order: (D) the movement screen from §7, no direction column; (A) rows that clear
the interest bar — expected to be empty; (B) all other
scored declared-band rows, the hit rate on every window of the ladder (1, 2, 3 and 5 sessions) and the drift
edge on every row, complete for every state - no blank cell, no ellipsis, no omitted window (the user's own
"just fill the gaps so we have all data clear", 2026-09-29); (C) the VIX change rows (B1 context, then B2 sweep) with the direction column empty. Row
keys are reused from the accepted scorecard so a reader can move between the two pages, and the bar is that
scorecard's own, verbatim: `hit_rate_pct >= 60` **and** `n >= 100`.

Page furniture, mandatory: the two drift numbers, the per-year drift line, the four limits (associations
only, on spent intervals; shared anchors; complements are not independent trials; the register was written
after the accepted report existed and is not a pre-registration), the `looks_counted` figure, and one
sentence saying that a ranked table of spent intervals cannot choose. No direction, winner or edge word
anywhere on the page. Navigation follows the existing pattern (one embedded
`<script type="application/json">` block, no `fetch`, no external script), and the page is linked from the
"Related pages" nav of `gold-backtest-outcomes.html` and `gold-direction-scorecard.html`.

**One light per factor, with one plain line under it (question 11, answered 2026-09-29).** Each factor gets one of
two lights - *worth watching today* or *nothing here today* - and, directly underneath, **one short line in plain
words saying why**, carrying the size of the move and the day count and nothing else, for example "0.6% more than a
normal day, on 112 days". No score out of 100, no ordering of the factors best to worst, no winner, and the reason
line never states a direction or says a factor "works". A factor that cannot clear the bar still shows its light as
"nothing here today" with its day count in the line, per questions 9 and 12: the light is a reading, not a verdict,
and no row is ever removed for being thin or rare.

**Minimum version, if you want the smallest thing that answers the question.** Drop the new page and render
block C as a section appended to the existing `gold-direction-scorecard.html` (no new template, no nav
edits); drop the B2 sweep and keep B1 as the accepted artifact already publishes it; skip the expectations
v2 registry and inline the new state rules in the builder. That version is one measurement run plus one
builder patch in an existing page, and touches nothing else. It still answers "which VIX states show
anything" for every stream, because the B1 numbers already exist and the level bands come from the run
either way.

## 9. Five decisions

Fifteen became five. **D1 is new in this revision and is the one to answer first**, because it decides
whether we ask "if" before we ask "which way". Everything else that was open is now a stated default in §10
and needs no answer.

| # | Question | Recommended default | Alternative |
| --- | --- | --- | --- |
| D1 | **The "if" stage, and now its order (answered by the user, 2026-09-29)** | Run the free movement screen first (per-state realized-return q1/q3 spread, no new run), then measure the share of anchors with a **0.50 L2L and an L2L movement in either direction**, and read the direction of that movement against the call **on the sessions that moved** — the user's batch-3 answer to question 8: *"its the 0.5l2l and l2l directional movement happened that we are interested in primarily, then we want to see if the directional call was correct for the l2l that occured"*. The fixed **0.80%** (the chart-current instance of 0.50 L2L) and **0.30%** stay published as sensitivity rows under the same `looks_counted`, and the `n >= 100` / 5pp / per-year-sign conditions are guards on **labelling and scoring only** — never a reason to omit a row (question 9). The user confirmed **both stages stay in scope** (question 10) and **all 28 variables stay in scope** (question 27). Coordinator confirmation of the two-unit print is still pending, but the ordering is no longer open. The **window set is the user ladder, 1/2/3/5 sessions** (§3, question 15), read as one sweep under one looks_counted (question 16) with the overlap disclosed (question 17); no state is dropped for firing rarely (question 12), no cell is left blank where a number exists, and each factor's
two-light reading carries one plain reason line underneath it (question 11, *"an explanation of why its yes/no
briefly underneath"*). **Answer 36 (2026-09-30) confirms the pair this ordering uses**: the movement ranges are the
user's already-stated **0.50 L2L (ADR20 x 0.25)** and **L2L (ADR20 x 0.50)**, not a newly declared floor, and the
fixed 0.80% and 0.30% rows stay published as labelled sensitivities under the same `looks_counted` | Do only the
floor measurement and skip the free screen, or read direction on all sessions instead of the moved subset |
| D2 | What to do with the VIX change stream | Both streams, as designed in §7: level bands scored, change legs published as raw context (B1) plus the declared 1/2/5 and 2/5/10 sweep with `looks_counted` (B2), no direction invented | Reject B2 (context only, the minimum version), or drop the change stream back to unscored |
| D3 | Size of the deliverable | Full version: new page beside the accuracy panel, linked from the two Gold Backtest pages | Minimum version in §8: block C appended to the existing scorecard page, no new template, no nav edits |
| D4 | F9 `risk_headline_context` **(answered by the user, 2026-09-30: question 32)** | Rebuild it as a declared rule the way the live field is built (VIX>25 **or** war/geopolitical/conflict/sanction event names), because today's only bar-clearing row is an `interpreted` mapping with an unstable sign. The trigger is then **chosen by printed sample size**: every candidate (the union, VIX alone, the event-name branch alone) is measured on the same window with its own day count on the same row, the headline state uses the candidate with the most observations, and the candidates that lose stay visible as counts so the question can be referred back to - the user's *"Which ever gives us the most data we can then refer back to"* | Leave the `interpreted` row as the accepted artifact has it and publish it with its caveats (superseded for the headline state; that row keeps its "assumption the document does not contain" flag) |
| D5 | The rebuild's sample size **(34 and 35 answered 2026-09-30; 37 and 38 withdrawn)** | Decide it before rebuilding: state the size the effect needs (about 2,100 anchors per state for 3pp) and get it from hourly entries with a re-declared horizon, because 965 daily anchors cannot support direction claims below about 8pp. 34 confirms the sizing and 35 the hourly route; **37 and 38 are withdrawn as inapplicable**, because the user is not looking forward and says so twice, so the rebuild carries no sealed window and no "re-check when it opens" step | Keep daily anchors and accept that only large effects will ever be visible, or hold the direction layer until more daily history exists |

Defaults are conservative: they invent no direction, remove no coverage and change no accepted artifact. If
no answer arrives, D1–D5 defaults are what the two lanes implement.

## 10. Defaults that need no answer

Documented here so the plan is complete without fifteen questions:

- **Nothing is invented.** No magnitude is guessed for F5 ("Gold rising strongly", unnamed) or for the VIX
  change legs; the 12 of 28 variables the document genuinely does not cover stay unscored with a stated
  reason rather than a fabricated direction.
- **Boundary semantics stay exactly as the document words them.** VIX 25.00 and 16.00 fall inside 16–25;
  F1's "5bps+" is inclusive at 5.00, F2's ">0.30%" and F4's ">5bps" are exclusive. No normalisation.
- **Dollar rows keep the `proxy_series` caveat**: the measured series is FRED `DTWEXBGS`, not ICE DXY, so no
  dollar row may be described as a DXY test.
- **Pairs, weighting, composites, models, new data and Layer 1 edits stay out.**
- **Corrected provenance, carried forward:** the 019 FRED series (10 files) live in the gold-research
  worktree at `backtester/tmp/gold-019-sources-20260925/series`, not in canonical, and the report library,
  its builder and the v2 registry exist **only** there — which is why the measurement lane belongs in that
  worktree.
- **The interest bar does not change.** It stays the accepted scorecard's own: `hit_rate_pct >= 60` **and**
  `n >= 100`, plus the six conditions in §6. The movement stage uses the same bar with a 5pp gap against the
  cohort's own share instead of the 60% level, which is all a share can honestly support.
- **The move floor is declared, never fitted, and the declared pair is the user's own (amended 2026-09-30,
  answer 36).** The movement ranges are the already-stated **0.50 L2L (ADR20 x 0.25)** and **L2L (ADR20 x 0.50)** -
  answer 36: *"how would that make sense it should be the previously stated direction ranges, l2l and 0.5l2l"* - so
  nothing new is declared by this project. The session floor is the user's 0.80% of price in the call's
  direction (declared 2026-09-29) *and* its L2L form 1.00 L2L = 0.50 x ADR20 (0.7236% today), published with
  0.50 L2L (0.3618%), 0.30% and 1.00% rows and one `looks_counted`; none of these is a fact about gold, they are
  parameters. Answer 36 names no week floor, so the week floor stays at 1.00% as declared until the user says
  otherwise, and its L2L form still needs its own measurement before it is proposed.
- **The window set is the user's ladder (question 15, 2026-09-29): 1, 2, 3 and 5 sessions.** Every share and
  every hit rate is published on all four windows in one line, with the overlap disclosed and one `looks_counted`
  over the whole sweep. 48h and 3d appear in no accepted artifact, so lane 1 has to declare and produce them; the
  ladder is not four independent tests and one window never confirms another.
- **Nothing is dropped for being rare or thin** (questions 9 and 12). A state that fires on ten days a year is
  published with its ten days beside it, unscored where the bar is not met but never removed, because "even if
  rare its still something to factor into the analysis agent".
- **The per-factor output is the light plus one reason line** (question 11, answered 2026-09-29: *"Okay lets go with
  the light but an explanation of why its yes/no briefly underneath"*). Two lights only, one plain sentence of why
  underneath, no score out of 100 and no ordering best-to-worst. §8 carries the rendering rule.
- **The four stage-2 rules are the user's own as of 2026-09-29** (questions 18-21, answered *"yes makes sense"*,
  *"okay"*, *"yes every year"*, *"okay"*): direction is asked only where the movement stage showed something, it
  answers the side only and never "how far", its sign has to hold in every year with n >= 20 in the year, and both
  accepted bars (`hit_rate_pct >= 60` **and** `n >= 100`) stay exactly as the scorecard has them, with the 5pp gap
  against the cohort's own share on the movement stage. These were the plan's defaults; they are now declarations,
  so no lane may soften any of the four without the user.
- **Two questions that were open are now answered** (questions 22 and 23): whether the ten factors
  that already have a written direction sentence are checked first, and whether the twenty with no written sentence
  get their meaning agreed *before* any outcome is read. **Both came back on 2026-09-30: 22 is yes** - the ten with
  a written sentence are checked first - and **23 is no**, which withdraws the precondition and puts the user's own
  method in its place: implied direction from what the factor is, then the observed share, printed as a reliability
  percentage and labelled a description of the archive (see the amendment in section 6). Neither answer changes the
  shape or the order of lane 1's work. The plain-word restatement and the five replies verbatim are in the answer
  sheet.

## 11. Tests the lanes must write (six, one line each)

1. `gold_declared_band_state.test.js` — boundary cases 25.01 / 25.00 / 24.99 and 16.01 / 16.00 / 15.99 land
   in the right legs; F1 5.00 inclusive, F4 5.00 exclusive, F2 0.30% exclusive.
2. `gold_individual_variable_report_band.test.js` — the band register is declared before the run, the report
   refuses to overwrite, its content hash is stable, and the registry's sha256 is recorded in provenance.
3. `gold_factor_edge_table.test.js` — the bar, the `thin` flag at n<100, NEUTRAL excluded from every hit
   rate while still printed with its raw split, its `n` and the same-cohort benchmark beside it and charged to
   `looks_counted`, `looks_counted` correct, drift arithmetic reproducing 60.51 − 55.81 = 4.70 from the accepted
   scorecard, and deterministic row order.
4. `gold_factor_edge_page.test.js` — one placeholder replaced once, the embedded JSON parses, no `fetch`, no
   external script, no model endpoint.
5. `gold_move_share.test.js` — the share above the floor counts anchors on the right side of the boundary
   (`>=` floor, not `>`), the 0.80% and 1.00 L2L variants and the 0.50 L2L and 0.30% sensitivity rows are all
   published on all four ladder windows, the L2L row's threshold is recomputed from the same ADR20 the artifact
   stores (no constant), the 1-session column reproduces the archive's own `reachedHalfAdr20` (64.04%) and
   `reachedFullAdr20` (38.42%) exactly, `looks_counted` equals the states times windows times variants examined,
   and no stage-1 row carries a direction field.
6. Byte-level regression — `data/gold-direction-scorecard-20260927.json`,
   `gold_factor_direction_expectations.v1.json`, `gold_individual_variable_report.v2.json` and the accepted
   019 report are unchanged afterwards.

## 12. Handoff, limits, provenance

**Order, two lanes, one writer per worktree.** Lane 1 `gold-declared-band-measurement-026`, in the
gold-research worktree: the v3 register (both VIX streams declared, thresholds written down before any
outcome is read), the report mode change, the run into a new output directory, expectations v2, tests 1, 2, 5
and 6, and a one-page summary of the raw splits and the movement screen, with no direction claim. Lane 2
`dashboard-gold-factor-edge-page-001`, only after lane 1 is accepted: the table builder, the artifact, the
template, the page and the two nav entries, tests 3, 4 and 6. No network, no credential, no new data, no
Layer 1 change, no warehouse or scheduled-task action, and nothing past the accepted archive's own end date is read
(a scope boundary, not a holdout test - answers 37 and 38).

**One independent addition, asked for by the user on 2026-09-30.** *"I want to see this work on the dashboard so I
can confirm we are going in the right direction please put it live even thjough we are editing it."* A **draft page**
carrying this work in progress therefore has to be **live on the dashboard now**, published by the dashboard lane
behind a top-bar link and refreshed as each batch of answers lands. The page is prepared in this worker's checkout
(`docs/strategy/WORK_IN_PROGRESS_GOLD_FACTOR_TABLES.html`) and the publish request is
`docs/strategy/DASHBOARD_LIVE_DRAFT_PAGE_REQUEST.md` (one nav entry, draft marking, as-of date, and the rule that it
may never carry a forecast, a holdout or a trading result). It is independent of lanes 1 and 2, claims nothing they
do not, and blocks nothing: lanes 1 and 2 keep the order they already have. On 2026-09-30 the user added two standing
instructions: hand over the copy that exists now rather than waiting for the question set to close (*"we should have
enough to send to it to put on the live dashboard"*), and report every later change to the page to the coordinator as it
happens rather than in a bundle. The copy handed over, its size and hash, and the reporting rule are in §7 of the
publish request.

**Limits, so the page can copy them.** Associations only, on intervals already spent. Every state shares
anchors with the others, one instant can feed several variables, and the two halves of a band split are
complements rather than independent trials, so counts are not independent trial counts. The drift is 55.81%
session and 58.23% week, which dominates any few-point factor lean, and the per-year test kills most of what
survives the baseline test — a nominal 60% is a different thing in 2023 (drift 51.54%) than in 2025 (drift
60.15%). The VIX-up week row at 60.51% is a post-hoc read of twelve looks on spent data and is not a
finding. The band register is a declared reading of the document against the report's vocabulary, written
after the accepted report existed; it is not a pre-registration. No formula is fitted, no forecast is claimed and no
trading result is computed: the user has withdrawn the forward-looking framing (answers 37 and 38) and the cost
netting (answer 40), so no page, row or limit carries a prediction, a holdout, a P&L or a cost-adjusted figure.

**Not a trading exercise (answers 39 and 40).** Nothing here is a trade instruction: no spread or slippage is
subtracted, no cost-adjusted figure exists, and no entry, stop or target is produced. The user's stated purpose for
the flags is to **re-piece together the algorithm that makes the daily calls, from this work, later** - *"Not yet but
we will repiece together the algorithm we use to make the daily calls from this work"* - and that re-assembly is a
separate, future step rather than part of either lane. It also settles the shape of the page: a reading, never a
signal, and never a reason to act.

**Two limits that govern how every verdict may be read.** First, the direction test cannot see small
effects: one standard error is about 2.3pp at these state sizes, so a real 3pp edge passes the gate about 6%
of the time and even a 5pp edge only about 28%; `no_information` therefore means "nothing large", not
"nothing exists". Second, the archive has no flat bucket — `exact_zero` totals 0 on both horizons across the
25 rows — so "a move happened" is not a fact in the data but a line this project draws, and every share
always travels with the floor that produced it.

**Provenance.** Read-only on 2026-09-28: `logic/agent_gold_direction.md` (F6 inputs, lines 279–295),
`logic/agent_usd_direction.md` (line 154), `data/gold-direction-scorecard-20260927.json` (`rows`,
`unscored`, `baselines`, `summary`, `factors`), `VIXCLS.json` (97,074 bytes) for the sizing estimate, and a
streaming scan of the 95,842,994-byte 019 report, both for the missing-`values` finding and for the movement
fields it does carry (147,465 occurrences each of `median`, `q1`, `q3`), and
`backtester/tmp/gold-hourly-extended-20260918/candles.json` (XAU_USD, hourly, from 2023-01-02) for the join
option. The z-scores, the `exact_zero` totals (0 session, 0 week), the expected-by-chance row count (2.3) and
the power table were recomputed here from the accepted scorecard's own baselines. Scratch scripts written and
ignored: `tmp/inspect-report-20260928.js`, `tmp/scan-report-20260928.js`, `tmp/power-20260928.js`,
`tmp/plan-rework-20260928.js`. Tests were **not run**: this checkout is scoped to advisory notes and owns no
executable lane; the six tests above belong to the two lanes.
