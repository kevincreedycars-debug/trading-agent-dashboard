# Gold backtest data: what exists, why it reads as useless, and four ways to make it useful

Advisory read by worker `strategy` (`strategy-advisory-001`), 2026-10-03, at the user's instruction
(*"return to the gold backtest data and analysis, it's still useless data for me"*).

Advisory only. This is a proposal for the coordinator and the user, not an applied change, and nothing
here is a prediction, an accuracy claim, a signal or a trading result. Every interval used was already
spent before this read; the prospective window sealed until `2027-03-25T15:00:00Z` was not read, no new
data was gathered, no Layer 1 logic was touched and no page, number or production file was changed.

Everything below was re-measured today in this worktree or read read-only from `origin/main`. Where a
figure came from an earlier measurement by this lane, the date is given with it.

## 1. What the user can see today, surface by surface

**A. `gold-backtest-outcomes.html`** (served blob 19,186 bytes). A census of the 28 measured factors'
combinations: 4,956 candidates declared and evaluated, 2,745 reported, 704 below the declared
20-observation floor, 1,507 that never matched an anchor, 4,782,540 attempts, 441,781 matched anchors,
441,319 observations, median 74 observations per candidate (q1 0, q3 156), direction split 245,784 up /
195,535 down. Its own quoted verdict: *"the 2023-2026 archive can describe this space, but it cannot
support choosing from it"*. Its stated route to a different answer: the sealed prospective window, or a
new licensed dataset with declared vintages.

**B. `gold-direction-scorecard.html`** (served blob 143,102 bytes). 965 daily anchors (964 with an
outcome), 5,115 event rows, 28 variables declared and measured, 25 states scored, 7 of 10 declared
factors readable, `min_n` 100, edge bar 5pp, threshold 60%. Baseline: gold closed up 55.81% of 24h
anchors (51.54 / 59.16 / 60.15 / 50.83 by year) and 58.23% of weeks (68.58% in 2025). Result: **25 of 25
session verdicts `no_information`, 24 of 25 on the week, one `unstable_across_years`**; 1 row reached the
60% rate on each horizon; 20 states sat on the right side of their own drift, 5 on the wrong side.

**C. `gold-backtesting.html`** (served blob 292,270 bytes). The stored-call pilot, 154 stored calls:
**0 evaluable** under the strict contiguous-endpoint read; on the endpoint read 97 evaluable, 45 right,
37 wrong, 13 flat, 2 no-call, i.e. 54.88% excluding flat against 52.44% for always-bullish on the same 82
scored calls. The page also carries the production defect in its own banner: the live Gold collector
reads 25 unordered history rows, so recent inputs cannot be recovered by sorting.

**D. `gold-factor-wip.html`** (served blob 24,398 bytes, the live draft). The plainest of the four:
570 archived gold call sessions, 2024-01-04 to 2026-04-30; 56.84% of those days closed up; **97.89% of
days clear the 0.50 L2L range either way**; on one-sided days the call named the side 45.63% of the time
while always saying "up" was right 61.13%; the call was right at the close 46.32%. Median day range
(ADR20) 1.4472% of the session open, full L2L 0.7236%, 0.50 L2L 0.3618%, median close-to-close move
0.6701%. The page's own conclusion: at 0.50 L2L "will it move" is certain and useless for sorting days.

**E. The backtester app's Gold window** (`data/backtester-checker-gold-24h-2024-2026.json`). 608 rows,
**608 pass, 0 fail, 608 exact matches**, comparing 15 stored fields (direction, conviction, confidence,
strength bucket, bull/bear case, net edge, participation, weights, factor scores, evaluation result and
reason, flat threshold). It is a replay-parity check: it re-derives what the live agent already said and
confirms the app reproduces it. It contains no trade, no entry, no exit, no P&L and no edge.

## 2. Why it reads as useless, and it is four measured reasons

1. **The direction question cannot be settled on this archive at any diligence level.** 80% power to see
   a 3pp edge needs about **2,100 anchors per state** and a 5pp edge about **774**; the archive holds 965
   anchors in total, roughly 470 per state, and one standard error is already ~2.3pp. A true 3pp edge
   passes the accepted gate about 6% of the time (measured 2026-09-28). So every one of the 25 states
   returning `no_information` is arithmetic, not a finding about gold.
2. **The best-looking row is the noise floor.** The largest row is +4.70pp on the session and +5.46pp on
   the week against its own drift (z 2.05 and 2.40). With nothing real at all, 25 rows across two
   horizons would still throw up about 2.3 rows of that size by chance. One did.
3. **The movement stage answers "yes" almost always.** At the user's own 0.50 L2L range, 97.89% of days
   move that far in one direction or the other (99.82% over five sessions), and 36.38% of them touch the
   range both ways; at full L2L 75.26% of days move either way. A test whose answer is "yes" 97.89% of
   the time cannot sort days, and the direction half that follows it scores *below* the drift: 45.63%
   against always-up's 61.13% at one session, 44.32% against 67.05% at five.
4. **The only call-level record is small and its input is still defective.** 154 stored calls, none
   evaluable under the strict read, 97 on endpoints, so accuracy rests on 82 scored calls — an interval
   of roughly ±11pp. Underneath it, the offline-validated Gold history patch
   (`backtester/drafts/gold_collector_history_query_patch.json`, unchanged since 2026-09-09) has never
   been installed: `docs/GOLD_HISTORY_PATCH_VALIDATION.md` still reads "installed n8n validation and
   production application remain outstanding", and `docs/CURRENT_STATE.md` still lists the 25-row
   unordered read as a live production input defect. Any forward record written today inherits it.

## 3. What is usable today, in the user's own units

All read from the 570 archived gold call sessions (2024-01-04 to 2026-04-30), re-run today with
`tmp/l2l-scan8-20260929.js` against the 21,871 complete hourly XAU/USD bars from 2023-01-02 to
2026-09-11. Descriptive base rates on spent intervals, not findings and not forecasts:

| Plain question | Answer | Sample |
| --- | --- | --- |
| How far does gold usually travel in a day? | median range 1.4472% of the session open (ADR20) | 570 sessions |
| Same in the units the factor tables use | full L2L 0.7236%, half of it 0.3618% | 570 sessions |
| How far does it usually close away from where it opened? | median 0.6701%, direction ignored | 570 sessions |
| Which way does it usually close? | up 56.84% of days | 570 sessions |
| Does a half-range move happen at all? | 97.89% of days, either direction | 558 rows |
| Does the live call name the side that moved? | 45.63% on one-sided days | 355 rows |
| What does always saying "up" score on those rows? | 61.13% | same 355 rows |
| Does the call's own direction reach half the range? | 64.04% of days | 570 rows |
| Is a full-range move one-sided? | 51.52% up-only / 40.09% down-only / 8.39% both | 429 rows |
| Does the side survive the week? | 68.49% of day-one floor-reachers still on side at 1 session, 55.20% at 5 | 570 rows |

The one hard finding is uncomfortable but it is the most useful sentence on the list: **the gold calls do
not beat the drift.** At the close the call is right 46.32% of the time while gold closed up 56.84% of
the same days, and the loss sits almost entirely in the bearish half — 300 bearish calls right 40.00%,
against 53.33% for the 270 bullish calls (measured 2026-09-28 on the same 570 sessions). "The bearish
half is broken" is a more actionable statement than "gold is unpredictable".

## 4. Four routes to data the user can actually use, in the order I would take them

**R1 — the movement table by factor state: designed, agreed, never run.** This is the user's own first
stage from the 2026-09-28 to 2026-09-30 question round (answers 8, 10, 18, 47, 50): *first does it move*,
measured at their own two ranges (0.50 L2L and full L2L), printed on the 1/2/3/5-session ladder as one
look, nothing dropped, every row carrying its own day count. It is answerable **from data already on
disk, with no new run**: the accepted individual-variable report
(`.local/worktrees/gold-research/backtester/tmp/ivr-coverage-019-20260925-r2/individual-variable-report.json`,
95,842,994 bytes, re-counted today) stores **147,465 each of the `median`, `q1` and `q3` fields** per
state and horizon and **148,920 `exact_zero` fields**, and no accepted cut has ever used them. The floor
a "how often does it move" count needs is drawn, not found, and the user drew it on 2026-09-29. What it
produces: for every declared factor state, whether gold's realised spread while that state is on is wider
or narrower than the cohort's — the only question this archive can still answer about a factor. What it
needs: the coordinator to open the lane (provisional id `gold-declared-band-measurement-026`, never
registered) and the user's go-ahead; an advisory worker cannot open one.

**R2 — the calls scoreboard.** Up-calls against down-calls, by year, at the close and at the user's two
ranges, on the same 570 sessions. Every number is already measured; this is presentation, not research.
It gives the user the one thing no page shows in one place: how the agent's own two halves have done, and
whether the bearish loss is stable across years or driven by one.

**R3 — fix the Gold input before any forward record is trusted.** Apply the validated history patch and
close the 25-row defect. This is a production change and the coordinator's to sequence; it changes no
analysis, but every future observation, entry price and evaluation inherits the defect until it is done.
The user has asked repeatedly for data they can rely on, and this is the prerequisite.

**R4 — the forward record, declared now.** The archive cannot answer the direction question and more
diligence on it will not change that. The only route to an answer the user can act on is a record
starting now with the ten written rules declared first, the window and review date named, and the sample
size acknowledged: about 774 anchors per state for a 5pp edge and about 2,100 for 3pp, i.e. years at one
session a day, or a re-declared hourly horizon using the 23,000 hourly bars that exist, with the overlap
problem that brings. Recording is free; the discipline is declaring before looking.

## 5. What I do not recommend

- Another pass over direction on the same 965 anchors, however it is cut. At ~470 anchors per state the
  test cannot see the sizes that matter, and a passing row would be the noise floor again.
- Moving a threshold, a floor or a horizon until a row clears the bar. The declaration came first for a
  reason: a bar chosen after the result is not a bar.
- Reading the sealed prospective window early. It is sealed until `2027-03-25T15:00:00Z` and it is the one
  genuinely untouched evaluation set the project has.
- Treating the pilot's 54.88% endpoint accuracy as an edge. It is 82 scored calls, it sits inside its own
  error bar, and on the wider 570-session read the same calls lose to always-up by 10.5pp.
- Presenting the census pages as if they were results. They are correctly labelled and answer a question
  about the archive, not about gold.

## 6. Provenance, limits and how to reproduce

Read today, read-only: `git cat-file -s origin/main:<page>` for the five served blobs (19,186 / 143,102 /
292,270 / 24,398 / 5,733 bytes); the embedded JSON of each page via `tmp/page-data.js` and
`tmp/served-data.js`; `tmp/l2l-scan8-20260929.js` re-run today, exit 0, both of its internal assertions
PASS (hourly index strictly ascending; full L2L = ADR20 x 0.50 and 0.50 L2L = ADR20 x 0.25);
`tmp/count-report-fields.js` for the 147,465 / 147,465 / 147,465 and 148,920 field counts against the
95,842,994-byte accepted report; `data/backtester-checker-gold-24h-2024-2026.json` for the 608 of 608
exact matches; `docs/GOLD_HISTORY_PATCH_VALIDATION.md`, `docs/CURRENT_STATE.md` and
`backtester/drafts/gold_collector_history_query_patch.json` for the unapplied-collector status; and this
lane's own plan of 2026-09-28 with its 2026-09-29/30 revisions
(`docs/strategy/GOLD_VIX_BOTH_AND_FACTOR_TABLE_PLAN_20260928.md`, §2, §3 and §4) for the power, noise-floor
and per-side figures. Every plan figure quoted above that the scan reproduces was re-verified today; the
per-side call split (300 bearish / 270 bullish) is quoted from the 2026-09-28 measurement and is marked
as such rather than claimed as re-measured.

Limits: the intervals are spent, so nothing above is evidence about the future; the 570 sessions are calls
the agent already made, so it is not an untouched holdout; the 97 evaluable pilot calls are 154 stored
outputs read at next-minute entry, which is not authenticated publication timing; and no significance,
prediction, timing, profitability or deployment claim is made or implied anywhere in this document.
