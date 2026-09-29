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

**Status:** 0 of 50 answered. Batch 1 (canonical 1, 2, 10, 13, 14, 27, 33) was asked on 2026-09-29 and has no
answer yet. The next batch is canonical 3-9.

## A. What counts as a move (1-9)

| # | Yes/no question | Default | Asked | Your answer |
| --- | --- | --- | --- | --- |
| 1 | Measure a move close-to-close, not intraday high-to-low | yes | batch 1 | |
| 2 | Fix the minimum size in advance (0.30% session / 1.00% week) instead of fitting it | yes | batch 1 | |
| 3 | Report the size of the move too, not only the yes/no | yes | | |
| 4 | Count a move in either direction, ignoring the sign | yes | | |
| 5 | Publish "no move" as its own bucket, so the three counts sum to the total | yes | | |
| 6 | Floor as a percentage of price, not a dollar amount | yes | | |
| 7 | Same floor every year, no per-year tuning | yes | | |
| 8 | q1-to-q3 spread as the headline measure, with the share above the floor beside it | yes | | |
| 9 | Drop a state that has fewer than 100 anchors | yes | | |

## B. What you want out of it (10-13)

| # | Yes/no question | Default | Asked | Your answer |
| --- | --- | --- | --- | --- |
| 10 | "A move is coming" is enough, direction is a separate second step | yes | batch 1 | |
| 11 | A simple on/off flag per factor, not a score or a ranking | yes | | |
| 12 | Prefer factors that fire rarely but strongly over often with a small edge | rare + strong | | |
| 13 | You would act on an edge smaller than 5pp | no | batch 1 | |

## C. Horizon (14-17)

| # | Yes/no question | Default | Asked | Your answer |
| --- | --- | --- | --- | --- |
| 14 | Session (1 day) is the primary horizon | yes | batch 1 | |
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
| 27 | All 28 variables in scope, not only the declared 10 | yes | batch 1 | |
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
| 33 | Re-test any survivor out of sample before acting on it | yes | batch 1 | |
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
| 2026-09-29 | 1 | 1, 2, 10, 13, 14, 27, 33 | none yet |

No answer of any kind has been received, so the defaults in the plan stand: D1's default is the free movement
screen first, then the declared 0.30% / 1.00% floor. Answering this sheet is the only thing blocking the two
scoped lanes from starting.
