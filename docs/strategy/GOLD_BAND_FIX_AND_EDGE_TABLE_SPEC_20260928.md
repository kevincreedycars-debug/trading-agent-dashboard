# Gold: declared-band measurement mode + factor edge table — exact specification

> **Reading order changed 2026-09-28.** The readable version is now
> `docs/strategy/GOLD_VIX_BOTH_AND_FACTOR_TABLE_PLAN_20260928.md` (short plan, four decisions, both VIX
> streams). This file is kept as the **mechanical appendix** to that plan — registry rows, code line
> numbers, the measurement command, the JSON shapes and the test list. Where the two disagree, the short
> plan wins and this file gets fixed. Section 9 of this file (the fifteen decisions D1–D15) is superseded by
> the plan's five decisions D1–D5. The plan was revised again on 2026-09-28 to lead with two stages — first
> "if a move happens", then "which way" — and that framing lives in the plan's sections 2–4; this appendix
> stays the mechanical detail for the two lanes.
>
> **Revised again 2026-09-29 (through batch 5 of the question round).** Five more answers came back from the
> user, and they change shapes in this appendix rather than only wording, so read this block before
> implementing anything below. Section 1.2 states what arrived; sections 5.3, 7 and 10 now carry the
> mechanics of it.
>
> - the movement stage is measured at the user's declared **0.50 L2L (ADR20 x 0.25)** and **L2L (ADR20 x 0.50)** — the
>   pair restated by answer 36 — with the fixed 0.80% of gold's own price (the chart-current instance of 0.50 L2L)
>   and the 0.30% row kept as labelled sensitivities under the same `looks_counted`, gating nothing new; and
>   the per-year sign
>   rule has teeth on it (measured in the plan's §3: the fixed 0.80% rows run 32.40% / 38.43% / 62.82% across 2024–2026 and
>   fail; the L2L form runs 39.60% / 37.19% / 38.46% and holds);
> - every row prints the user's ladder in one row — rung 1 (24 h), rung 2 (two sessions), rung 3 (three
>   sessions) and rung 5 (five trading days, the accepted "week" number) — with the wall-clock reading the
>   user said out loud (48 h, 3 days, weekends inside the window) printed beside it as a disclosed
>   sensitivity, and **one `looks_counted`** over all of it: never four verdicts, never four separate looks.
>   The archive measures one session per row, so rungs 2 and 3 exist in no accepted artifact and are a lane-1
>   deliverable with a re-declared horizon (§7 rule 1, §10 test 6);
> - **no row is ever dropped** for being thin, rare, empty or failing; it is printed with its raw split and
>   its flag (§5.3, §7 rules 9–10);
> - what the user actually reads per factor is **one light with one short plain reason line underneath** —
>   the size of the move and how many days it covers — with no direction, no score out of 100 and no ranking
>   (§7 rule 8, §8);
> - direction is asked **only for states that passed the movement stage**, and answered as a side only,
>   never as how far (§7 rules 8–9);
> - the four stage-2 rules are now the user's own declarations rather than defaults: direction only on a
>   moved state; side only; the same sign in every year at `n >= 20`; and both accepted bars kept side by
>   side (`hit_rate_pct >= 60` **and** `n >= 100`);
> - questions 22 and 23 were re-stated in plain words and stand on a **yes** default: test the ten rules the
>   document already states before the twenty readings it never defines, and give those twenty a written
>   meaning before any outcome is read.
>
> The readable, authoritative version of all of it is the plan's §3, §8, §11 and §12 and rows 11 and 18–23 of
> `docs/strategy/INTENT_QUESTIONS_ANSWER_SHEET_20260929.md`; this appendix carries only the mechanical
> consequences.
>
> **Revised again 2026-09-30 (batch 8, questions 34-40).** Four of the seven replies revise this appendix rather
> than confirm a default, and every one of them is about the **claims** the lanes may make - no figure already
> measured moves, and no new measurement was taken here.
>
> - the movement stage is measured at the user's already-stated **0.50 L2L (ADR20 x 0.25)** and **L2L (ADR20 x
>   0.50)** (answer 36); nothing new is declared, and the fixed 0.80% and 0.30% rows stay published as labelled
>   sensitivities that gate nothing;
> - **the forward-looking material is withdrawn** (answers 37 and 38): D14 no longer claims a prospective or sealed
>   window, no lane holds rows back for a future evaluation, and a printed date range is a scope statement only;
> - **no trading result is computed** (answers 39 and 40, new decision D16): no spread or slippage, no
>   cost-adjusted figure, no P&L, no entry, stop or target, and no row may be labelled a signal;
> - **a draft live page is added** (the user's own instruction, new decision D17): the work in progress has to be
>   visible on the live dashboard now, marked as a draft and refreshed as answers land - see
>   `docs/strategy/DASHBOARD_LIVE_DRAFT_PAGE_REQUEST.md`;
> - 34 and 35 confirm the sizing and the hourly route as defaults, so lane 1 keeps the shape it already has.
>
> **Revised again 2026-09-30 (batches 9 and 10, questions 41-50; the round is closed).** The last ten answers add one
> mechanical rule and confirm the rest. No figure already measured moves, and no input directory is added.
>
> - **the count starts at the next session's open** after the state is seen (answer 41) and no count may use a price
>   from the day it measures (42) - a Friday state begins at Monday's open, so every row's outcome window starts at the
>   next session's open rather than at the session the state was seen in;
> - **a during-session block is added** (the request inside answer 42, new decision D18): states that only appear
>   inside the session are timed from the bar that first shows them and measured to that session's close, with the next
>   session's close printed beside it; the block is separately labelled, is never pooled or averaged with the
>   before-session rows, uses only what was available at the trigger bar, and counts its same-day overlaps once in
>   `looks_counted`; the trigger reuses the accepted hourly series, so no new input is added;
> - **the deliverable is the full page** (49) beside the accuracy panel, with no direction claim (43) and no ranked
>   winner (45);
> - **the order is fixed** (47, 50): the movement stage is built first, and the direction layer is rebuilt only after
>   the movement layer is agreed;
> - **41-50 are recorded as decisions before any lane starts** (48); the during-session block sits inside lane 1's
>   existing scope rather than becoming a lane of its own.

Advisory recommendation from worker `strategy` (`strategy-advisory-001`), 2026-09-28.
Advisory only: this is a proposal for the coordinator, not an applied change. Every claim below was
re-measured on 2026-09-28 in this worker's checkout and is cited with its absolute path and, where
it is a number, the artifact it came from. Nothing in this document is a prediction, an accuracy
claim, a signal or a trading result; all intervals involved are already spent.

Proposed bounded assignments (see "Handoff" for why it is two writers):

- `gold-declared-band-measurement-026` — measurement lane, in the `gold-research` worktree.
- `dashboard-gold-factor-edge-page-001` — page lane; the coordinator should renumber this to the
  dashboard lane's own next free id if that lane numbers differently.
- `dashboard-gold-factor-wip-page-001` — the **draft live page** the user asked for on 2026-09-30 (*"please put it
  live even thjough we are editing it"*): publish the prepared page, link it from the top bar, mark it a draft and
  refresh it as answers land. Independent of lanes 1 and 2, claiming nothing they do not; the page file and the
  request are `docs/strategy/WORK_IN_PROGRESS_GOLD_FACTOR_TABLES.html` and
  `docs/strategy/DASHBOARD_LIVE_DRAFT_PAGE_REQUEST.md`, and the rule is D17. The user then instructed on 2026-09-30 that
  the copy prepared now be handed over for publication **without waiting for the question set to close**, and that each
  later change to the page be reported to the coordinator as it happens; the copy handed over (bytes, lines and hash),
  and that reporting rule, are in §7 of the request.

## 1. User decisions already recorded (2026-09-28, extended 2026-09-29 in §1.2)

1. Use the logic document's own numbers: VIX above 25 / below 16, and DXY move threshold 0.30%.
2. Deliver a **ranked factor-state to forward-move table**, in the dashboard, under the Gold
   Backtester submenu.
3. Plain code and table lookups only. No LLM call, no token spend, no model in the loop.
4. The bar is **60% directional significance**.
5. Use the existing 2023–2026 dataset only. No new data acquisition.
6. A new dashboard page beside the existing accuracy panel.

**1.2 What the user declared afterwards (2026-09-29, batches 1–5), and where each item lands.** These are
declarations, not defaults: no lane may soften one without asking the user again.

| Item | Declaration, as the user gave it | Mechanical consequence in this appendix |
| --- | --- | --- |
| Movement unit and threshold | 0.80% of gold's own price, with its L2L form published beside it | The stage-1 gate is computed in the same pass as the states and stored on the anchor record, so stage 1 and stage 2 cannot drift apart; the readable version is the plan's §3 and its D1 |
| Per-year sign rule on the unit | the floor must keep the same sign in every year | Applied to the gate itself, not only to scored rows: the fixed 0.80% form fails it, its L2L form holds it |
| Windows | the user's ladder printed together: 24 h / 48 h / 3 days / 5 days as they said it, published as the open-hours ladder 1/2/3/5 sessions with the wall-clock reading beside it as a disclosed sensitivity | §7 rule 1 (rung order, the re-declared horizon for rungs 2–3, the wall-clock twin) and §10 test 6 |
| Looks | one look across all of it, never one look per rung and never per reading | §7 rule 1 (`looks_counted` is a single integer per row) and §10 test 6 |
| No dropping | thin, rare and empty readings stay visible | §5.3 and §7 rules 9–10, §10 test 7 |
| Factor summary | one light per factor plus one short plain reason line (move size and day count) | §7 rule 8 and §8 page furniture |
| Stage 1 answer | never given a direction | §7 rule 8 |
| Stage 2 answer | only for a moved state; side only, never how far | §7 rule 8 |
| Bars | both accepted bars kept and shown together: `hit_rate_pct >= 60` and `n >= 100` | §7 rules 4–5 and D10 |
| Completeness | every reading the document mentions appears somewhere | §5.3, §7 rule 10, §10 test 7 |
| Questions 22 and 23 (asked again, standing default yes) | test the ten readings the document already describes before the twenty it never describes; give those twenty a written meaning before reading any outcome | §4 rows 1, 4, 9, 12–15 and 17–22 (the twenty `not_declared` rows); §9 D1–D2 |

## 2. What is actually wrong (one paragraph)

The live Layer 1 document (`logic/agent_gold_direction.md`, v2.0) declares its rules in **absolute
bands and magnitude thresholds**: VIX above 25 is BULLISH, VIX below 16 is BEARISH, a DXY move bigger
than 0.30% is BULLISH/BEARISH, a yield move of 5bps or more is BULLISH/BEARISH. The accepted
single-variable report measures **level variables as a median split of their own distribution**
(above/below own median) and **change variables as the sign of the change with no threshold**. So
the document's bands cannot be tested against the report's vocabulary, and the direction check had to
print those states unscored. That is a **vocabulary and contract gap that both sides already declare
in writing** — it is not missing analysis and it is not an untested corner of the archive. The fix is
one declared registry revision plus one new measurement run, using raw files that are still on disk,
followed by a table that scores the document's own bands.

## 3. Evidence measured on 2026-09-28

**3.1 The document's own rules, with weights.**

| Factor | Weight | Document rule (verbatim, as quoted in the expectations registry) | Band type |
| --- | ---: | --- | --- |
| F1 Real Yield Direction | 22 | "Real yield rising 5bps+ = BEARISH"; "Real yield falling 5bps+ = BULLISH"; "Otherwise = NEUTRAL" | magnitude threshold, 5 bps |
| F2 DXY Direction | 18 | "DXY rising >0.30% = BEARISH"; "DXY falling >0.30% = BULLISH"; "Otherwise = NEUTRAL" | magnitude threshold, 0.30% |
| F3 Fed Bias | 14 | "More hawkish = BEARISH"; "More dovish = BULLISH"; "Neutral = NEUTRAL" | categorical |
| F4 US 2Y Yield Trend | 8 | "2Y rising >5bps = BEARISH"; "2Y falling >5bps = BULLISH"; "Otherwise = NEUTRAL" | magnitude threshold, 5 bps |
| F5 Gold Own Price Delta | 8 | "Gold rising strongly = BULLISH"; "Gold falling strongly = BEARISH"; "Otherwise = NEUTRAL" | magnitude **unnamed** |
| F6 Risk Regime / VIX | 10 | "VIX >25 = BULLISH"; "VIX <16 = BEARISH"; "16-25 = NEUTRAL" | **absolute level band** |
| F7 US Economic Surprise | 6 | "Positive surprise = BEARISH"; "Negative surprise = BULLISH"; "No major surprise = NEUTRAL" | sign |
| F8 Inflation Signal | 6 | "Hot inflation with dovish expectations = BULLISH"; "Disinflation trend = BEARISH"; "Unclear = NEUTRAL" | two-input condition |
| F9 Safe Haven Demand | 6 | "Geopolitical stress = BULLISH"; "Financial stress = BULLISH"; "Calm conditions = NEUTRAL" | categorical regime |
| F10 Liquidity / Growth Regime | 2 | "Liquidity expansion = BULLISH"; "Liquidity contraction = BEARISH"; "Otherwise = NEUTRAL" | categorical regime |

Source: `backtester/registries/gold_factor_direction_expectations.v1.json` (lines 51–77), which quotes
`logic/agent_gold_direction.md` v2.0.

**3.2 The measurement side declares the mismatch itself.** In the accepted registry
(`.local/worktrees/gold-research/backtester/registries/gold_individual_variable_report.v2.json`,
block `variable_state_strata.median_split_revision_8`), verbatim:

> "The level variables added in revision 8 (usd_broad_index_level, risk_headline_context,
> equities_regime, growth_regime) use exactly this declared median split. The state labels above are
> the measured states; the live agent's categorical regime names are not reproduced and **no
> threshold, band or tercile is introduced**."

And in the expectations registry, the caveats that carry the cost of it:
`threshold_is_absolute_band` ("The document's rule uses absolute bands (VIX above 25, below 16). The
report splits each level at the variable's own median, which is not that band and cannot be recovered
from the report."), `threshold_not_applied`, `level_band_not_declared`, `regime_label_not_reproduced`.

**3.3 The code that forces the median split.** In
`.local/worktrees/gold-research/backtester/lib/gold_individual_variable_report.js`:

- line 773–776, `medianSplitState(raw, median)` returns `at_or_below_own_median` / `above_own_median`;
- line 1042, `const levelVariable = ['fred_level','hourly_level','external_level'].includes(variable.measurement.kind)`;
- line 1060, `const levelMedian = levelVariable ? magnitudeStats(raws).median : null;`
- line 1064, `return levelVariable ? medianSplitState(state.raw, levelMedian) : state.state;`
- line 1104, `stratification: levelVariable ? 'median_split_of_own_distribution' : variable.measurement.strata`.

So for a level variable the registry's own `strata` field is **ignored** and the median split is
forced. `vix_level` is declared `{"kind":"fred_level","series_id":"VIXCLS","strata":"median_split"}`,
which is why the document's 25/16 band never reaches a report cell.

**3.4 How many states this costs, exactly.** From `data/gold-direction-scorecard-20260927.json`
(schema `gold-direction-scorecard-v1`, generated `2026-09-27T20:19:18.416Z`):

- `coverage`: 28 declared / 28 measured variables, 965 daily anchors of which 964 carry a computed
  outcome, 5,115 event rows, **25 states scored**, **20 states printed unscored**, 6 states declared
  NEUTRAL, 11 availability labels, 7 factors with at least one scored state;
- the 20 unscored, by reason: `level_band_not_declared` **8**, `change_rule_absent` **6**,
  `threshold_is_absolute_band` **2**, `regime_label_not_reproduced` **4**;
- the 6 NEUTRAL-declared states are the two `us_10y_real_yield_*_bps` and two `us_2y_*bps` `exact_zero`
  states plus `inflation_signal:exact_zero` and `risk_headline_context:at_or_below_own_median`;
- 26 = 20 + 6, which is the "26 states that cannot be scored" figure.

The two `threshold_is_absolute_band` rows are precisely the VIX band: `vix_level:above_own_median`
(n 481 on the session) and `vix_level:at_or_below_own_median` (n 483).

**3.5 Why the one row above 60% is not the evidence it looks like.** The whole table has exactly one
row clearing 60% (`summary.session_rows_at_or_above_threshold_pct = 1`,
`week_rows_at_or_above_threshold_pct = 1`), and it is the F9 Safe Haven row:

| variable | state | expectation | provenance | session | week | per-year |
| --- | --- | --- | --- | --- | --- | --- |
| `risk_headline_context` | `above_own_median` | BULLISH | **interpreted** (`interpreted_regime_mapping`) | 60.51% (285/471), edge **+4.70pp** vs 55.81% | 63.69% (300/471), edge **+5.46pp** vs 58.23% | session: 2023 −1.54pp, 2024 −0.18pp, 2025 +6.52pp, 2026 +15.84pp; week 2024 −0.94pp |

`years_same_edge_sign` is false on both horizons, the week verdict is `unstable_across_years`, and the
direction mapping is a reading of "geopolitical stress" onto "above its own median news sentiment",
which the document does not state. The document's F9 input is not that index at all — the registry
records the live field as "derived from VIX above 25 and war, geopolitical, conflict or sanction event
names". **The declared-band fix therefore tests F9's real input better than the row that presently
looks like the best finding in the table.**

**3.6 The report cannot be re-cut — the fix needs a run, but not new data.** The accepted report
`.local/worktrees/gold-research/backtester/tmp/ivr-coverage-019-20260925-r2/individual-variable-report.json`
is 95,842,994 bytes, generated `2026-09-25T14:44:33.370Z`, version `gold-individual-variable-report-v1`,
and contains **zero occurrences of the field `"values"`**: it stores states and counts, never the raw
variable value at an anchor. A declared-band table therefore cannot be derived from the accepted
report; the band has to be computed from the raw inputs again. Those inputs are still on disk, at the
exact directories recorded in the accepted run's own `run.command`:

| Input | Path | Present | Contents |
| --- | --- | --- | --- |
| FRED / external series | `.local/worktrees/gold-research/backtester/tmp/gold-019-sources-20260925/series` | yes | 10 files, 2,778,424 bytes (incl. `VIXCLS.json`, 1,010 observations, 2022-11-01 to 2026-09-11) |
| Hourly candles | `backtester/tmp/gold-hourly-extended-20260918` | yes | 17 files, 12,099,758 bytes |
| Event archive | `backtester/tmp/gold-calendar-extended-20260918` | yes | 2 files, 3,456,639 bytes |

Correction to an earlier note of this worker: the series directory is in the **gold-research worktree**,
not in the canonical checkout's `backtester/tmp`. The 019 FRED copy is not in canonical. Also, the
report's own library and registry (`gold_individual_variable_report.js`, the builder script and
`gold_individual_variable_report.v2.json`) exist **only** in the gold-research worktree and not in
canonical, so this work belongs to that lane or to a declared move of those files.

**3.7 Feasibility of the VIX band on this archive (approximate, scratch).** Reading `VIXCLS.json`
directly and taking all Monday–Friday observations from 2023-01-03 to 2026-09-21 (954 observations,
no availability rule applied): **41 (4.3%) above 25**, **400 (41.9%) below 16**, **513 (53.8%)
between 16 and 25**. This is an approximation computed in this worker's scratch, not through the
declared strictly-before availability rule; the real count must come from the measurement run. Its
purpose is to set expectations before the run: the document's "VIX >25 = BULLISH" leg will land at
roughly **40 anchors**, i.e. below the 100-observation reliability floor, so it will be labelled thin
by construction. The "<16" and "16–25" legs land at roughly 400 and 510 anchors and will be testable.

## 4. Deliverable A — the declared-band register (one new registry file)

New file: `backtester/registries/gold_individual_variable_report.v3.json`, a **copy of v2 plus a
declared stratum per variable**. The accepted v2 file and the accepted report stay byte-identical and
are never edited; v2 stays the authority for every already-accepted artifact. Each row below is quoted
from `logic/agent_gold_direction.md`; where the document declares nothing, the row says so and the
state is printed unscored rather than given an invented direction.

| # | Variable | Proposed declared stratum | Band or reason |
| ---: | --- | --- | --- |
| 1 | `us_10y_real_yield` | `not_declared` | doc's F1 rule is a change rule; no level rule [D1] |
| 2 | `us_10y_real_yield_d5_bps` | `magnitude_band`, 5 bps | "rising 5bps+ / falling 5bps+" |
| 3 | `us_10y_real_yield_d20_bps` | `magnitude_band`, 5 bps | same rule, 20-observation leg |
| 4 | `usd_broad_index_level` | `not_declared` | F2 is a change rule [D1] |
| 5 | `usd_broad_index_d1` | `magnitude_band`, 0.30% | ">0.30%", with the existing `proxy_series` caveat (DTWEXBGS is not ICE DXY) |
| 6 | `usd_broad_index_d5` | `magnitude_band`, 0.30% | same |
| 7 | `usd_broad_index_d20` | `magnitude_band`, 0.30% | same |
| 8 | `fed_bias` | `policy_stance` (unchanged) | already categorical and already scored |
| 9 | `us_2y_yield` | `not_declared` | F4 is a change rule [D1] |
| 10 | `us_2y_d5_bps` | `magnitude_band`, 5 bps | "rising >5bps / falling >5bps" |
| 11 | `us_2y_d20_bps` | `magnitude_band`, 5 bps | same |
| 12 | `gold_price` | `not_declared` | F5 is a change rule [D1] |
| 13 | `gold_d1_pct` | `sign_of_change` retained, labelled `doc_magnitude_unnamed` | F5 says "rising strongly" with no number [D3] |
| 14 | `gold_d5_pct` | as row 13 | as row 13 |
| 15 | `gold_d20_pct` | as row 13 | as row 13 |
| 16 | `vix_level` | **`absolute_band` >25 / <16 / 16–25** | the fix: the document's own numbers |
| 17 | `vix_d1` | `not_declared` | F6 declares no change rule [D4] |
| 18 | `vix_d5` | `not_declared` | as row 17 |
| 19 | `inflation_signal` | `not_declared` | F8 is a two-input condition ("hot inflation **with dovish expectations**"); the measured variable is the 20-observation change in the 5-year breakeven alone [D5] |
| 20 | `risk_headline_context` | `not_declared` | F9's stress/calm is not the news-sentiment index; the live field is VIX>25 plus event names [D6] |
| 21 | `equities_regime` | `not_declared` | "liquidity expansion/contraction" is not measurable from a level [D7] |
| 22 | `growth_regime` | `not_declared` | as row 21 |
| 23–28 | `event_type`, `event_actual`, `event_consensus`, `event_previous_as_released`, `event_surprise`, `event_age_hours` | unchanged | event cohort only; family-scoped sign; field presence; age buckets; no numeric band declared anywhere in the doc |

**What this buys, counted.** Eight variables currently carry a document threshold that the report
discards: the seven change variables in rows 2–3, 5–7, 10–11 plus `vix_level` in row 16. Under the new
register those become **24 declared-band states** (8 variables × 3 legs: above / inside / below), of
which 21 legs are new and 3 replace the two forced median states of `vix_level`. Every other row
either keeps its current stratum (row 8, rows 23–28) or is honestly printed unscored with a stated
reason instead of being given an invented direction (rows 1, 4, 9, 12–15, 17–22). The document's own
band is measured for the first time on 8 variables; the number of unscored states does not fall to
zero, and it should not, because for 12 of the 28 variables the document genuinely declares nothing
this archive can test.

## 5. Deliverable B — the declared-band measurement mode

**5.1 Three new strata kinds, declared in v3 before any outcome is read.**

| Stratum | Declared state labels | Comparison, exactly as the document words it |
| --- | --- | --- |
| `absolute_band` | `above_25`, `below_16`, `inside_16_25` | strictly `> 25` → above; strictly `< 16` → below; otherwise inside. The boundary values `25.00` and `16.00` land in `inside_16_25`, because the document writes "VIX >25" and "VIX <16", not "≥". [D9] |
| `magnitude_band` | `at_least_5bps_up`, `at_least_5bps_down`, `inside_5bps` (real yield, 2Y) and `at_least_0_30pct_up`, `at_least_0_30pct_down`, `inside_0_30pct` (dollar) | F1 writes "5bps+", which is inclusive at exactly 5.00 bps; F4 writes "rising >5bps" and F2 writes ">0.30%", which are exclusive. Apply each factor's own wording and record it in the registry rather than normalising them. [D9] |
| `not_declared` | unchanged state labels | printed unscored with reason `doc_declares_no_band`; never given a direction |

Raw value rounding: none. Compare the raw decimal as stored in the source file; the registry records
the unit and both bounds. No interpolation, no last-observation carry-forward beyond the existing
declared availability rule, and `unavailable` remains `unavailable`.

**5.2 Code change, exactly where.** In
`.local/worktrees/gold-research/backtester/lib/gold_individual_variable_report.js`:

- `variableStateIndex` (line 1039 onward): stop deriving the stratum from `kind` alone. Read the
  variable's declared `strata` (`median_split` | `absolute_band` | `magnitude_band` | `sign` |
  `policy_stance` | `not_declared` | …) and compute the state from it. `median_split` stays available
  as an explicit declared value so any variable that genuinely wants its own-median split declares it.
- `stateOf` (line 1064): replace `levelVariable ? medianSplitState(...) : state.state` with a switch
  over the declared stratum; `medianSplitState` (line 773) stays for `median_split` variables so the
  accepted numbers remain reproducible.
- Line 1104 `stratification`: report the declared stratum name, not the derived one, and add
  `declared_band: { unit, lower, upper, inclusive_lower, inclusive_upper }` to the variable block.
- `build_gold_individual_variable_report.js`: accept `--registry=<path>` and default to the existing
  v2 file, so the accepted behaviour is unchanged unless the flag is passed.

**5.3 Invariants that must not move.** Declared-before-outcomes (the v3 registry is committed in its
own commit before the run, and its sha256 is recorded in the report's provenance, exactly as the 019
batch did); strictly-before price availability; endpoint groups never pooled; per-cohort denominators;
min n 20 with the `small_sample` flag; year breakdown 2023/2024/2025/2026; every attempt reported
including empty and unavailable rows; report written once into a new output directory and refusing
overwrite; deterministic content hash.

**5.3.1 Added 2026-09-29 with the user's answers** — four invariants that were previously habits and are now
declared:

- **Completeness.** No row is dropped, hidden or merged because it is thin, rare, empty or failing. Every
  state in the v3 register appears exactly once across the three page blocks with its raw split, its `n`
  and its flags; the only permitted absence is a state that does not exist in this archive, and then the
  row is printed `unavailable` with the reason.
- **The ladder, one look.** The rungs (1, 2, 3 and 5 sessions) and their wall-clock twins are printed
  together for every row, and `looks_counted` is a single integer for the row, not one look per rung and not
  one look per reading. The user's rule is that looking across the ladder is still one look; charging the
  same evidence once per rung would make it look several times stronger than it is.
- **The per-year sign rule gates the claim.** It is no longer only a `year_warning` chip: a direction claim
  requires the same sign in every year at `n >= 20` per year, and a row that fails it may be shown but may
  not be described as holding.
- **The gate is the user's own floor** — the fixed 0.80% of gold's price, the chart-current instance of
  0.50 L2L, with the L2L form published beside it and both charged to one look — computed in the same pass as
  the states and carried on the anchor record, so the movement stage and the direction stage can never be
  computed from two different versions of "a move happened".

**5.4 The run.** From the gold-research worktree, a new output directory:

```powershell
node backtester/scripts/build_gold_individual_variable_report.js `
  backtester/tmp/gold-019-sources-20260925/series `
  D:/trading-agent-dashboard-codex/backtester/tmp/gold-hourly-extended-20260918 `
  D:/trading-agent-dashboard-codex/backtester/tmp/gold-calendar-extended-20260918 `
  backtester/tmp/ivr-band-026-20260928 --registry=backtester/registries/gold_individual_variable_report.v3.json
```

No network call, no credential, no new source, no warehouse write; the three input directories are the
same bytes the accepted 019 run consumed (row counts and byte sizes in §3.6).

## 6. Deliverable C — extend the expectations registry

New file: `backtester/registries/gold_factor_direction_expectations.v2.json` (v1 stays byte-identical,
because `data/gold-direction-scorecard-20260927.json` cites its sha256). It is v1 plus one `states`
entry per new declared-band state, each with the document's own words in `rule_text` and
`provenance: "declared"`:

| New state | Factor | Expectation | `rule_text` |
| --- | --- | --- | --- |
| `vix_level:above_25` | F6 | BULLISH | "VIX >25 = BULLISH" |
| `vix_level:below_16` | F6 | BEARISH | "VIX <16 = BEARISH" |
| `vix_level:inside_16_25` | F6 | NEUTRAL | "16-25 = NEUTRAL" |
| `<var>:at_least_5bps_up` | F1 / F4 | BEARISH | "Real yield rising 5bps+ = BEARISH" / "2Y rising >5bps = BEARISH" |
| `<var>:at_least_5bps_down` | F1 / F4 | BULLISH | "Real yield falling 5bps+ = BULLISH" / "2Y falling >5bps = BULLISH" |
| `<var>:inside_5bps` | F1 / F4 | NEUTRAL | "Otherwise = NEUTRAL" |
| `<var>:at_least_0_30pct_up` | F2 | BEARISH | "DXY rising >0.30% = BEARISH" |
| `<var>:at_least_0_30pct_down` | F2 | BULLISH | "DXY falling >0.30% = BULLISH" |
| `<var>:inside_0_30pct` | F2 | NEUTRAL | "Otherwise = NEUTRAL" |

No v1 entry is edited, and no `not_declared` variable is given an expectation. The dollar rows keep the
`proxy_series` caveat, so no dollar result may be described as testing ICE DXY.

## 7. Deliverable D — the factor edge table artifact

New deterministic script `backtester/scripts/build_gold_factor_edge_table.js` (no LLM, no network),
output `data/gold-factor-edge-<YYYYMMDD>.json`, schema `gold-factor-edge-v1`. It consumes only the new
band report, `gold_factor_direction_expectations.v2.json` and the accepted baseline arithmetic, and it
reuses the existing helpers so the numbers are directly comparable with
`data/gold-direction-scorecard-20260927.json`:

- the hit rate, the drift benchmark, the per-year rows and the verdicts come from the same code paths
  as the accepted scorecard (`backtester/lib/gold_direction_scorecard.js` and the helper that defines
  `clears_majority_threshold`);
- the bar is the existing one, verbatim:
  `hit_rate_pct !== null && n >= min_n && hit_rate_pct >= threshold_pct`, with `min_n = 100` and
  `threshold_pct = 60` (`report_gold_factor_direction_check.js`, lines 204 and 387). Note for
  disclosure: the user's wording was "60%"; the existing implementation is `>= 60` with a 100-observation
  floor. Keeping it unchanged keeps the new page comparable with the existing one, and no state in the
  current table sits at exactly 60.00%, so the `>` versus `>=` choice cannot change any existing row.
  [D10]

Row shape, one row per declared-band state (same keys as the accepted scorecard so a reader can move
between the two pages):

```json
{
  "schema_version": "gold-factor-edge-v1",
  "research_only": true, "exploratory": true,
  "prediction_claimed": false, "accuracy_claimed": false, "trading_result_computed": false,
  "parameters": { "cohort": "daily_snapshot_anchors", "group": "all_computed",
    "horizons": ["h24_post_event", "two_sessions_post_event", "three_sessions_post_event",
                 "d5_trading_days_post_event"],
    "wall_clock_horizons": { "two_sessions_post_event": "h48_post_event",
                             "three_sessions_post_event": "d3_trading_days_post_event" },
    "looks_counted": 1,
    "min_n": 100, "min_year_n": 20, "edge_pp": 5, "threshold_pct": 60 },
  "baselines": { "session": { "n": 964, "positive_rate_pct": 55.81 },
                 "week":    { "n": 960, "positive_rate_pct": 58.23 } },
  "rows": [{
    "factor_key": "F6", "factor_label": "Risk Regime / VIX", "factor_weight": 10,
    "variable": "vix_level", "state": "above_25",
    "state_rule_verbatim": "VIX >25 = BULLISH", "stratum": "absolute_band",
    "band": { "unit": "index", "lower": 25, "inclusive_lower": false },
    "expectation": "BULLISH", "provenance": "declared",
    "session": { "horizon": "h24_post_event", "n": 0, "resolved": 0,
      "positive": 0, "negative": 0, "exact_zero": 0,
      "expected_side": "BULLISH", "expected_count": 0, "other_count": 0,
      "hit_rate_pct": null, "benchmark_pct": 55.81, "drift_edge_pp": null,
      "clears_majority_threshold": false, "small_sample": true, "thin": true,
      "years_observed": 0, "years_same_edge_sign": false, "years": [] },
    "two_sessions": { "wall_clock": { } },
    "three_sessions": { "wall_clock": { } },
    "week": { },
    "looks_counted": 1,
    "session_verdict": "small_sample", "two_sessions_verdict": "small_sample",
    "three_sessions_verdict": "small_sample", "week_verdict": "small_sample",
    "year_warning": "thin sample: n is below 100" }],
  "neutral_rows": [ ], "unscored": [ ], "limits": [ ], "what_would_change_it": [ ],
  "sources": [ ]
}
```

Window keys and aliases, so lane 2 does not have to invent a shape (added 2026-09-29): the four keys
`session`, `two_sessions`, `three_sessions`, `week` **are** the user's ladder in order — rung 1 (24 h), rung 2
(two sessions), rung 3 (three sessions), rung 5 (five trading days) — and each block has exactly the same
fields as the `session` block above (`horizon`, `n`, `resolved`, `positive`, `negative`, `exact_zero`,
`expected_side`, `expected_count`, `other_count`, `hit_rate_pct`, `benchmark_pct`, `drift_edge_pp`,
`clears_majority_threshold`, `small_sample`, `thin`, `years_observed`, `years_same_edge_sign`, `years`). The
published ladder is the open-hours one; each block also carries a `wall_clock` twin with the same fields for
the wall-clock reading the user said out loud (48 h for rung 2, 3 days for rung 3), and the twin is charged to
the **same** `looks_counted` — it is a disclosed sensitivity, not a second test. `session_verdict` and
`week_verdict` keep their accepted names so the new page and the accepted scorecard line up, with two
additions in the same form: `two_sessions_verdict` and `three_sessions_verdict`. `looks_counted` is `1` on
every row and `1` in `parameters`, because the user's rule is that the windows are one look; nothing in the
artifact, the page or the tests may count them as more. A rung whose benchmark is not reproducible carries
`"benchmark_pct": "not_reproduced"` and `drift_edge_pp: null` rather than a substitute number.

**Table rules (they are the whole point of the page).**

1. One row per declared-band state, and every row prints the user's ladder in the fixed order **rung 1 (24 h, one
   session), rung 2 (two sessions), rung 3 (three sessions), rung 5 (five trading days)**. Rung 1 is the
   accepted session number and rung 5 is the accepted "week" number; **rungs 2 and 3 exist in no accepted
   artifact** (the archive measures one session per row), so lane 1 re-declares the horizon for them before
   its run, in the v3 registry, and reports each rung with its own `n`, its own per-year rows and its own
   benchmark. The published form is the **open-hours ladder**; the wall-clock reading the user said out loud
   (48 h and 3 days after the anchor, weekends inside the window) is printed **beside** it as a disclosed
   sensitivity, because the plan measured that both readings give the same answer — one `wall_clock` twin per
   rung in the row, the same counts, under the same look. All rungs and both readings are charged as **one**
   `looks_counted`: a single integer for the row, never one look per rung, never one look per reading, and
   never four (or eight) verdicts. The user's rule is four windows, one look; charging the same evidence
   twice would make it look stronger than it is.
2. **NEUTRAL legs never enter a hit rate, and they are printed so they cannot hide.** `inside_16_25`,
   `inside_5bps`, `inside_0_30pct` and every document-declared NEUTRAL state are listed in `neutral_rows` with their
   raw up/down split. A NEUTRAL state cannot be right or wrong, so it must not inflate or dilute a win rate. **Added
   2026-09-30, per the user's answer to question 24:** each entry carries `state`, `n`, `positive`, `negative`,
   `exact_zero`, `up_share_pct` and **`benchmark_pct`** - the same-cohort rate the scored rows use, on the same
   window - so a reader can see what the excluded days did, and the state counts once in `looks_counted`. The reason
   is coverage, not symmetry: `inside_16_25` holds the largest share of days (the plan's scratch sizing: 513 of 954
   weekday VIX observations), so a headline rate without this line describes the minority of sessions. A gap between
   `up_share_pct` and `benchmark_pct` that persists across years is the trigger to **declare a rule for that band**,
   never a reason to drop the row.
3. Denominator is directional outcomes only: `hit_rate_pct = expected_count / (positive + negative)`,
   with `exact_zero` excluded, exactly as the accepted report declares.
4. **Every row carries its own drift benchmark** from the same cohort and window (session 55.81%,
   n 964; week 58.23%, n 960), plus `drift_edge_pp = hit_rate_pct - benchmark_pct`. A 60% session hit
   is only +4.19pp against what the session did anyway; the page must show both numbers or it is
   misleading by construction. With four rungs the row shows four benchmarks, and the wall-clock twins carry
   theirs: the two accepted ones are quoted verbatim (session 55.81%, n 964; week 58.23%, n 960, the latter
   being rung 5), and the rungs 2 and 3 benchmarks are recomputed by the same code path over the same cohort
   and anchors. If a rung's benchmark cannot be reproduced from the accepted arithmetic, that cell reads
   `not_reproduced` and no number is invented for it.
5. `thin` is `n < 100` and is shown as a chip in the row; a thin row is never described as a finding.
   The report's own `small_sample` flag is `n < 20` and is also carried through.
6. `year_warning` is derived, not editorialised: it is non-empty when any year's edge has the opposite
   sign to the row's overall edge, or when the row has fewer than `min_year_n = 20` observations in any
   year, or when the row has fewer than two years with enough observations. It names the years.
7. Rank order is deterministic and disclosed on the page: rows that clear the bar with a stable edge
   sign first, then rows that clear the bar with an unstable sign, then all remaining scored rows by
   absolute `drift_edge_pp` descending, then thin rows by n descending; ties broken by `n` descending
   then variable id. There is no composite score, no weighting and no "pick" — the table ranks
   measurements, and the page says in one line that a ranked table of spent intervals cannot choose.
8. **The line the user actually reads is one light plus one short plain reason, not a ranked cell** (answer of
   2026-09-29, question 11). The light is binary — *worth watching today* / *nothing here today* — and the
   line under it says only what moved and for how long, e.g. "gold moved 1.4% over the last 3 days". No
   direction word, no target, no score out of 100, no ordering and no winner; the light is not a prediction
   and the page must not imply it is. The ranked table stays behind the light for anyone who wants the
   counts. Wording rule: the reason line is allowed to state the size of the move and the number of days it
   covers, and nothing else derived from an outcome.
9. **Stage 1 and stage 2 are never mixed in one line.** Stage 1 asks only whether a move happened, against the
   user's floor (the fixed 0.80%, with its L2L form beside it, one look), and is printed with no direction
   attached. Stage 2 asks which way, only for
   states that passed stage 1, and answers with the side only — never how far, never a target, never a size.
   A state that fails stage 1 is printed as *nothing here today* with its reason line, and that is not a
   directional miss.
10. **Nothing is dropped for looking bad, and nothing is invented to look complete.** Every declared state
   appears on the page in exactly one of three blocks — cleared the bars, did not clear the bars, or the
   document defines no rule for it — and the union of the three equals the v3 register. A thin, rare, empty
   or failing row keeps its place, its raw up/down split, its `n` and its flag; a state that does not exist
   in this archive is printed `unavailable` with the reason rather than removed. Where a number cannot be
   reproduced the cell says so (rule 4) instead of carrying an estimate.

## 8. Deliverable E — the dashboard page

Follow the existing generated-page pattern exactly, because it is already in use on the same subject:

- new template `backtester/templates/gold-factor-edge.html`, built from the structure and styling of
  `backtester/templates/gold-direction-scorecard.html` (25,801 bytes) so the two pages look alike;
- one placeholder `__GOLD_FACTOR_EDGE_JSON__`, replaced by the builder, embedding the artifact in a
  `<script type="application/json" id="factor-edge-data">` block, which is how
  `gold-backtest-outcomes.html` (line 164, `id="outcomes-data"`) and `gold-direction-scorecard.html`
  (line 214, `id="scorecard-data"`) already work. No `fetch`, no runtime dependency, no network;
- output `gold-factor-edge.html` at the repository root, beside `gold-backtest-outcomes.html` and
  `gold-direction-scorecard.html`;
- navigation: add the page to the "Related pages" nav of `gold-backtest-outcomes.html` (lines 47–51)
  and of `gold-direction-scorecard.html` (line 60), so it is reachable from the Gold Backtest surface
  and sits beside the existing accuracy/scorecard panels. [D11]
- required page furniture, copied from the existing pages rather than invented: the
  "Research only · Exploratory" eyebrow, a read-this-first notice that this is an exploratory
  association census on spent intervals, the two drift baselines stated in the open, the full limits
  list, the sources with sha256, and a footer naming the run and the schema version;
- the light and its reason line, above the table (answers of 2026-09-29): one binary light per factor —
  *worth watching today* / *nothing here today* — with one short plain sentence underneath stating the size
  of the move and how many days it covers, e.g. "gold moved 1.4% over the last 3 days". No direction word,
  no target, no score out of 100, no ordering and no winner, and no sentence anywhere claiming the light
  predicts price. The ranked table stays underneath it for anyone who wants the counts;
- the table is horizontally scrollable with the ladder columns first, in the user's order (rung 1 = 24 h,
  rung 2 = two sessions / 48 h, rung 3 = three sessions / 3 days, rung 5 = five trading days), each rung with
  its wall-clock twin beside it, and on narrow screens it stacks like the existing tables (the existing
  `table.wide` breakpoint pattern) rather than squashing numbers.

## 9. Open decisions, with the default this worker will build against

Each one is a real fork; the default is what the owner worker should implement if the user does not
answer, and every default is the conservative option (no invented direction, nothing removed).

**Superseded again on 2026-09-29 (batch 5).** The plan's five decisions (its §3, §8 and §9) govern; the rows below
stay as the mechanical detail for whatever the plan does not cover. Four items that used to be defaults in
this list are now the user's declarations and may not be re-opened by a lane: the movement stage (0.80% of
gold's own price, with its L2L form beside it), the ladder of windows with one look, the per-year sign rule as a gate rather than a
warning, and the pair of accepted bars kept side by side. D1 and D2 below are also re-scoped by the answers to
questions 22 and 23: the twenty readings the document never defines still get their raw split printed, and
their written meaning is agreed **before** any outcome is read, so a lane may not read outcomes for them and
then write the rule that fits.

| # | Decision | Default (conservative) | Alternative |
| --- | --- | --- | --- |
| D1 | Leave the 8 `level_band_not_declared` states and 4 `regime_label_not_reproduced` states unscored? | Yes: print them with the reason, no direction, no hit rate | Give them a direction — refused, that would be the author's opinion rather than the document's rule |
| D2 | Show those states at all? | Yes, in a separate `unscored` block with raw up/down splits only, clearly marked "the document declares no rule for this reading" | Hide them entirely |
| D3 | F5 "Gold rising strongly" has no magnitude in the document | Keep the sign states, label them `doc_magnitude_unnamed`, do not turn them into a band | Adopt 0.30% (F2's number) or 1.0% — either invents a threshold the document does not state |
| D4 | `vix_d1`, `vix_d5` (6 states, n≈437–523) have no declared rule | Unscored | Score as VIX-trend with `interpreted` provenance and a visible "not the document's rule" chip |
| D5 | F8 inflation: the document needs an inflation reading **and** dovish expectations | Unscored as a single variable | Declare the two-input rule `inflation_signal rising AND fed_bias dovish = BULLISH` — computable from two already-measured variables, but it is a pair, so per the agreed sequencing it waits until single factors are fixed |
| D6 | F9 safe haven | Leave `risk_headline_context` unscored and add a declared `safe_haven_stress` state built the way the live field is built: VIX above 25 (already row 16) or an archived event whose name is war / geopolitical / conflict / sanction. The event archive is already measured, so this is a declared rule over existing data. **Amended 2026-09-30 (question 32):** the trigger is chosen by printed sample size - every candidate definition (the union, VIX above 25 alone, the event-name branch alone) is measured on the same window with its own day count on the same row, the headline `safe_haven_stress` state uses the candidate with the most observations, and the candidates that lose stay on the page as counts so the choice can be referred back to | Keep the current `interpreted` news-sentiment mapping — the row that presently looks best, on an assumption the document does not contain |
| D7 | F10 liquidity/growth regime | Unscored: no liquidity variable is measured | Add one — that is new data, excluded by decision 5 |
| D8 | Where the page lives | Standalone `gold-factor-edge.html` linked from the Gold Backtest "Related pages" nav: satisfies "under the Gold Backtester submenu", touches no JavaScript, one writer | A new research sub-tab inside `index.html`/`script.js` beside Factor Edge Lab — deeper change in the dashboard lane |
| D9 | Boundary semantics | Exactly as the document words each rule: VIX 25.00 and 16.00 fall inside 16–25; F1 "5bps+" inclusive at 5.00; F2 ">0.30%" and F4 ">5bps" exclusive | Normalise every band to one convention — refused, it would silently restate the document |
| D10 | The 60% bar | Keep the existing implementation unchanged: `hit_rate_pct >= 60` **and** `n >= 100` | Strict `> 60` — changes no existing row, since no row sits at exactly 60.00% |
| D11 | Navigation surfaces | `gold-backtest-outcomes.html` and `gold-direction-scorecard.html` "Related pages" nav | Also add a topbar link in `index.html` |
| D12 | Show the old median/sign rows on the new page | No: the page carries declared-band rows only, and links to the existing scorecard page | Merge both tables on one page |
| D13 | Refresh policy | One frozen artifact with a stated as-of date, regenerated only when a new measurement run is accepted | Rebuild on every publish |
| D14 | Data window **(amended 2026-09-30, answers 37 and 38)** | 2023–2026 only, stated on the page as a **scope statement**: the archive read ends at its own last accepted anchor. The earlier prospective-window wording is **retired**, not restated — nothing in this work looks forward, so no page, row, limit or comment claims a holdout, a sealed window or a re-check when a window opens | Read data past the archive's own end date — refused as a scope boundary, not as a holdout test |
| D15 | Writer count | Two writers, sequenced: measurement lane first, page lane second, one writer per worktree; the draft live page (D17) is a third, small, independent envelope in the dashboard lane and is not sequenced behind them | One writer doing both, if the coordinator prefers a single envelope |
| D16 | Trading result and dealing cost **(39 and 40 answered 2026-09-30)** | **Neither lane computes a trading result.** The flags are not traded (*"Not yet but we will repiece together the algorithm we use to make the daily calls from this work"*), no spread or slippage is subtracted, and no cost-adjusted figure, P&L, entry, stop or target exists — *"this is pureply a data corrleation exercise nothing else"*. The user's stated later use is to reassemble the daily-call logic from what the factors are shown to have done | Compute a cost-adjusted or tradable variant — refused by the user |
| D17 | The draft live page (user instruction, 2026-09-30) | Publish the prepared page on the live dashboard behind one top-bar link, marked **work in progress**, carrying its as-of date and the three things it may never claim (forecast, holdout, trading result), refreshed each time a batch of answers lands | Wait until the measurement lanes finish — refused: the user asked for it live while it is still being edited |
| D18 | The during-session stream **(answer 42, 2026-09-30)** | Measure every state twice. The headline count uses states knowable **before** the session, with its window starting at the next session's open (answer 41). A **separately labelled during-session block** measures states that only appear inside the session: timed from the bar that first shows them, measured to that session's close, with the same window taken to the next session's close printed beside it. The two blocks are never pooled, averaged or compared as one rate, because their windows differ in length and overlap; the state uses only what was available at the trigger bar; same-day overlaps count once in `looks_counted`; and the trigger reuses the accepted hourly series, so no new data source or input directory is added | Mix the two blocks into one hit rate, or treat the during-session state as a new lane - both refused: the first would compare windows of different lengths, the second would widen the scope the user bounded with answers 34 and 35 |

## 10. Tests the owner worker must write and run (this worker could not run them)

This checkout is scoped to advisory notes, so **none of the tests below were run here** — they are the
acceptance gate for the two lanes, written out so they cannot be skipped.

1. `backtester/tests/gold_declared_band_state.test.js` — VIX band: `25.01 → above_25`, `25.00 →
   inside_16_25`, `24.99 → inside_16_25`, `16.01 → inside_16_25`, `16.00 → inside_16_25`, `15.99 →
   below_16`, `null → unavailable`. F1 inclusive: exactly `5.00 bps → at_least_5bps_up`, `−5.00 →
   at_least_5bps_down`, `4.99 → inside_5bps`. F4 exclusive: exactly `5.00 → inside_5bps`, `5.01 →
   at_least_5bps_up`. F2: exactly `0.30% → inside_0_30pct`, `0.3001 → at_least_0_30pct_up`. Regression:
   a `median_split` variable produces byte-identical labels to v2. `not_declared` produces no direction
   and reason `doc_declares_no_band`.
2. `backtester/tests/gold_individual_variable_report_band.test.js` — the v3 registry is proven to
   predate the run (declaration commit recorded); a missing band for a variable the document does
   declare fails loudly; an existing output directory is refused (existing behaviour preserved); two
   runs give the same content hash; the report records the v3 registry sha256 and the three input
   directories.
3. `backtester/tests/gold_factor_edge_table.test.js` — `61.0%` with `n 200` and stable years clears the
   bar, is not thin and ranks first; `60.0%` with `n 99` does not clear and carries `thin: true`;
   `59.9%` with `n 300` outranks a `52.0%` row by absolute edge; a NEUTRAL leg lands in `neutral_rows`, contributes nothing to any hit
   rate, and carries its `n`, its split, its `benchmark_pct` and its single place in `looks_counted`; the drift arithmetic reproduces the accepted scorecard's
   own row (`60.51 − 55.81 = 4.70`); `year_warning` fires when a year's edge has the opposite sign;
   ordering is deterministic under ties; the module imports nothing network-, model- or
   credential-related.
4. `backtester/tests/gold_factor_edge_page.test.js` — the builder replaces `__GOLD_FACTOR_EDGE_JSON__`
   exactly once and the embedded JSON parses; the page contains both baselines (55.81% and 58.23%), the
   limits list and the source hashes; both host pages link to the new page; the built page contains no
   `fetch(`, no external script and no model endpoint.
5. Regression, byte-level: `data/gold-direction-scorecard-20260927.json`,
   `backtester/registries/gold_factor_direction_expectations.v1.json`,
   `backtester/registries/gold_individual_variable_report.v2.json` and the accepted 019 report are all
   unchanged after both lanes finish.

Added 2026-09-29, from the user's answers; lane 1 owns test 6's data half, lane 2 owns its rendering half:

6. `backtester/tests/gold_factor_edge_windows.test.js` — on a fixture row all four rungs appear in the
   declared order under the keys `session`, `two_sessions`, `three_sessions`, `week` with the horizon names
   `h24_post_event`, `two_sessions_post_event`, `three_sessions_post_event`,
   `d5_trading_days_post_event`; each of rungs 2 and 3 carries its `wall_clock` twin and the twin's counts are
   charged to the same row `looks_counted`; `looks_counted` is the integer `1` in `parameters` and on every
   row, and no row carries per-rung look fields; the rung-1 and rung-5 blocks are byte-identical to the
   accepted scorecard's session and week rows for the same state; a rung whose benchmark cannot be reproduced
   prints `benchmark_pct: "not_reproduced"` and `drift_edge_pp: null` rather than a number; two runs over the
   same inputs give the same content hash, the same rung order and the same twin values.
7. `backtester/tests/gold_factor_edge_completeness.test.js` — the three blocks partition the v3 register
   exactly once and their union count equals the register count; a state with `n 0`, a state with `n 12` and
   a state that fails the bars all remain present with their raw split and their `thin` / `small_sample`
   flags; a fixture in which every row fails still renders one light per factor, and every light line
   contains a move size and a day count and no direction word, no target and no score out of 100; the built
   page count of light lines equals the factor count, so no factor is silently missing from the summary.

## 11. Acceptance, handoff and limits

**Acceptance.** Input hashes recorded for the three directories in §3.6; the declaration committed
before the run, in its own commit; the 24 band states reconciled against the accepted report's own
anchor denominators (965 anchors, 964 with an outcome, 5,115 event rows); the edge artifact's
`baselines` block equal to the accepted scorecard's (session 55.81%, n 964; week 58.23%, n 960), because
a mismatch means the two tables are not comparable; the page saying in plain words that this is
exploratory, on spent intervals, and cannot choose; the three page blocks covering the v3 register exactly
once with `looks_counted` = 1 on every row; and no light line carrying a direction word, a target or a score
out of 100; one writer per worktree; one unique submission
envelope per lane; pause at the review boundary.

**Handoff order.**

1. **Lane 1 — `gold-declared-band-measurement-026`** (the worker that owns the report library, i.e. the
   gold-research worktree, where `gold_individual_variable_report.js`, the builder and the v2 registry
   actually live; none of the three exists in canonical): deliverables A, B and C — the v3 register,
   the mode, the run, the expectations v2 — plus the movement gate at the user's declared **0.50 L2L and L2L**
   (answer 36), with the fixed 0.80% and 0.30% sensitivities and their per-year sign test beside it, computed in the same
   pass, the **rungs 2 and 3 definitions** (two sessions and three sessions, which exist in no accepted
   artifact, so this is new declared work) with their wall-clock twins and their own benchmarks, the raw
   up/down splits of the 24 band states at all four rungs and both readings, and tests 1, 2, 5 and 6 (the
   data half). One-page summary, no direction claim.
2. **Lane 2 — `dashboard-gold-factor-edge-page-001`** (dashboard owner), only after lane 1 is accepted:
   deliverables D and E — the table builder, the artifact, the template, the page and the two nav
   entries — plus the ladder columns with one `looks_counted`, the per-factor light and its one-line
   plain reason, the three-block completeness rule, tests 3, 4, 5, 6 (the rendering half) and 7.
3. Both lanes: no new data, no network, no credential, no change to Layer 1 logic, the frozen registry,
   the manifest, the capture lane, the scheduled task or the 130-anchor plan; nothing past the accepted
   archive's own end date is read (a scope boundary, not a holdout — answers 37 and 38); the combination
   circuit stays closed; factor **pairs** wait until the
   single factors have been fixed (that is decision D5).

**Limits, restated so the page can copy them.** Associations only, on intervals already spent. Every
state shares anchors with the others, one instant can feed several variables, and the two halves of a
band split are complements rather than independent trials, so counts are not independent trial counts.
The rungs of the ladder overlap — a state that moved within one session is inside the longer rungs too — and
the wall-clock twin is the same evidence read a second way, so the ladder plus its twin is **one** look and
may never be added, multiplied, or read as four independent tests.
The drift is 55.81% on the session and 58.23% on the week, which dominates any few-point factor lean.
The per-year test kills most of what survives the baseline test. The band register is a declared
reading of the document against the report's vocabulary, written after the accepted report existed; it
is not a pre-registration. No Layer 1 change is proposed here, no formula is fitted, no forecast is claimed
and no trading result is computed: the forward-looking items (37, 38), the dealing cost and any tradable
variant (39, 40) are withdrawn by the user's own answers of 2026-09-30.

**Provenance of this document.** Every count in §3 was read on 2026-09-28 from
`data/gold-direction-scorecard-20260927.json` and
`.local/worktrees/gold-research/backtester/tmp/ivr-coverage-019-20260925-r2/individual-variable-report.json`
using read-only commands; the only program this worker wrote for it is the ignored
scratch file `tmp/inspect-report-20260928.js` (streaming reader, no writes to any artifact). No
credential, no live system and no sealed-window value was read. Tests were **not run** because this
checkout is scoped to advisory notes and owns no executable lane.

**Revised 2026-09-29 (batch 5).** Sections 1.2, 5.3.1, 7, 8, 9, 10 and 11 were extended from the user's own
answers in batches 1–5 of the question round, as recorded verbatim in
`docs/strategy/INTENT_QUESTIONS_ANSWER_SHEET_20260929.md` (rows 11 and 18–23) and in the plan's §3, §8 and §12.
Nothing measured on 2026-09-28 was changed, and no new measurement was taken for this revision: the yearly
shares quoted in the header and in §1.2 come from the plan's own stage-1 scan of 2026-09-29, not from a run
by this worker. No credential, no live system and no sealed-window value was read for this revision, and no
test was run here.

