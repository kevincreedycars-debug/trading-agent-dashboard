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

**Week floor.** 1.00% week stays as the plan's default until the user says otherwise. Its L2L form is *not*
proposed yet: a 5-session extension is not a fixed multiple of the 1-session range, and inventing that
multiple is exactly what this section refuses to do.

**Same bar as everywhere else.** A stage-1 state is interesting only if `n >= 100`, the gap against the
cohort's own share is at least 5pp, and the sign holds in every year with n >= 20. No new threshold is
introduced anywhere.

## 4. Stage 2 — "which way", once a move is on the table

Direction is only worth asking about for states that pass stage 1: a factor that does not change how much
gold moves cannot change which way it moves on average. Today stage 2 is the 25 rows above, and the answer
is empty. It stays published that way, with the z-accounting in §2 so that no reader mistakes a 2.4-sigma
cell for a finding.

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
versus 285 of 471). Any future claim about this row needs a fresh out-of-sample read after the sealed
window opens, not a re-captioning of this table.

## 6. Where the "correlations we care about" bar is

One bar, stated once, used everywhere (unchanged from the accepted scorecard's own parameters: `min_n`
100, `min_year_n` 20, `edge_pp` 5, `threshold_pct` 60):

A state is **interesting** only if all six hold — (1) the document declares a direction for it, (2) session
`hit_rate_pct >= 60`, (3) `n >= 100`, (4) `|drift_edge_pp| >= 5` against the same-horizon drift, (5)
`years_same_edge_sign` true, (6) `n >= 20` in at least two of 2023–2026. The table carries a
`clears_interest_bar` boolean per row so the page can show, without commentary, that **nothing clears it
today** — and will show that again whenever it runs. Rows without a declared direction can never clear it;
they are published as raw context instead, which is the honest shape for a rule that does not exist yet.

Per-year drift, so the 60% figure cannot be read as a 60% expectation:
2023 51.54%, 2024 59.16%, 2025 60.15%, 2026 50.83% (session).

The same bar governs the movement stage with condition (2) replaced: instead of a 60% hit rate, a state needs
a 5pp gap against the cohort's own share of anchors above the declared floor. Everything else — n >= 100, the
year-sign test, no invented direction — is unchanged.

## 7. Design: both streams, one table, four row blocks

**Stream A rows — level bands, scored.** `vix_level` gets the document's own numbers as its declared
stratum: `above_25` (>25 strictly), `below_16` (<16 strictly), `inside_16_25` (25.00 and 16.00 land here,
because the document writes ">25" and "<16", not ">="). `above_25` gets the document's BULLISH, `below_16`
gets BEARISH, `inside_16_25` is a declared NEUTRAL and never enters a hit rate. Sizing checked before the
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
on today's chart) and at 1.00% (week), with the plan's earlier 0.30% kept as one fixed sensitivity row and one
`looks_counted` for the whole sweep. The **"no move" bucket is printed twice and labelled**, because the user's
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
scored declared-band rows, session hit rate as the main number with the week rate beside it and the drift
edge on every row; (C) the VIX change rows (B1 context, then B2 sweep) with the direction column empty. Row
keys are reused from the accepted scorecard so a reader can move between the two pages, and the bar is that
scorecard's own, verbatim: `hit_rate_pct >= 60` **and** `n >= 100`.

Page furniture, mandatory: the two drift numbers, the per-year drift line, the four limits (associations
only, on spent intervals; shared anchors; complements are not independent trials; the register was written
after the accepted report existed and is not a pre-registration), the `looks_counted` figure, and one
sentence saying that a ranked table of spent intervals cannot choose. No direction, winner or edge word
anywhere on the page. Navigation follows the existing pattern (one embedded
`<script type="application/json">` block, no `fetch`, no external script), and the page is linked from the
"Related pages" nav of `gold-backtest-outcomes.html` and `gold-direction-scorecard.html`.

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
| D1 | **The "if" stage (new; answer this one first)** | Run the free movement screen first (per-state realized-return q1/q3 spread, no new run), then measure the share of anchors above the **user's declared 0.80% floor in the direction of the call** *and* the same floor as **1.00 L2L = 0.50 x ADR20 (0.7236% today)**, publishing 0.50 L2L (0.3618%) and 0.30% as fixed sensitivity rows, under the same n>=100 / 5pp / year-sign bar. The user answered on 2026-09-29 that **both stages stay in scope** (question 10) and that **all 28 variables stay in scope** (question 27) | Do only the floor measurement and skip the free screen, or keep stage 1 out and treat the 25 direction rows as the whole answer |
| D2 | What to do with the VIX change stream | Both streams, as designed in §7: level bands scored, change legs published as raw context (B1) plus the declared 1/2/5 and 2/5/10 sweep with `looks_counted` (B2), no direction invented | Reject B2 (context only, the minimum version), or drop the change stream back to unscored |
| D3 | Size of the deliverable | Full version: new page beside the accuracy panel, linked from the two Gold Backtest pages | Minimum version in §8: block C appended to the existing scorecard page, no new template, no nav edits |
| D4 | F9 `risk_headline_context` | Rebuild it as a declared rule the way the live field is built (VIX>25 **or** war/geopolitical/conflict/sanction event names), because today's only bar-clearing row is an `interpreted` mapping with an unstable sign | Leave the `interpreted` row as the accepted artifact has it and publish it with its caveats |
| D5 | The rebuild's sample size | Decide it before rebuilding: state the size the effect needs (about 2,100 anchors per state for 3pp) and get it from hourly entries with a re-declared horizon, because 965 daily anchors cannot support direction claims below about 8pp | Keep daily anchors and accept that only large effects will ever be visible, or hold the direction layer until more daily history exists |

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
- **The move floor is declared, never fitted.** The session floor is the user's 0.80% of price in the call's
  direction (declared 2026-09-29) *and* its L2L form 1.00 L2L = 0.50 x ADR20 (0.7236% today), published with
  0.50 L2L (0.3618%), 0.30% and 1.00% - 2.00% week rows and one `looks_counted`; none of these is a fact about
  gold, they are parameters. The week floor stays at 1.00% until the user says otherwise, and its L2L form
  needs its own measurement before it is proposed.

## 11. Tests the lanes must write (six, one line each)

1. `gold_declared_band_state.test.js` — boundary cases 25.01 / 25.00 / 24.99 and 16.01 / 16.00 / 15.99 land
   in the right legs; F1 5.00 inclusive, F4 5.00 exclusive, F2 0.30% exclusive.
2. `gold_individual_variable_report_band.test.js` — the band register is declared before the run, the report
   refuses to overwrite, its content hash is stable, and the registry's sha256 is recorded in provenance.
3. `gold_factor_edge_table.test.js` — the bar, the `thin` flag at n<100, NEUTRAL excluded from every hit
   rate, `looks_counted` correct, drift arithmetic reproducing 60.51 − 55.81 = 4.70 from the accepted
   scorecard, and deterministic row order.
4. `gold_factor_edge_page.test.js` — one placeholder replaced once, the embedded JSON parses, no `fetch`, no
   external script, no model endpoint.
5. `gold_move_share.test.js` — the share above the floor counts anchors on the right side of the boundary
   (`>=` floor, not `>`), the 0.80% and 1.00 L2L variants and the 0.50 L2L and 0.30% sensitivity rows are all
   published, the L2L row's threshold is recomputed from the same ADR20 the artifact stores (no constant),
   `looks_counted` equals the states
   times variants examined, and no stage-1 row carries a direction field.
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
Layer 1 change, no warehouse or scheduled-task action, and nothing in the sealed prospective window is read.

**Limits, so the page can copy them.** Associations only, on intervals already spent. Every state shares
anchors with the others, one instant can feed several variables, and the two halves of a band split are
complements rather than independent trials, so counts are not independent trial counts. The drift is 55.81%
session and 58.23% week, which dominates any few-point factor lean, and the per-year test kills most of what
survives the baseline test — a nominal 60% is a different thing in 2023 (drift 51.54%) than in 2025 (drift
60.15%). The VIX-up week row at 60.51% is a post-hoc read of twelve looks on spent data and is not a
finding. The band register is a declared reading of the document against the report's vocabulary, written
after the accepted report existed; it is not a pre-registration. No formula is fitted, and the prospective
window stays sealed until `2027-03-25T15:00:00Z`.

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
