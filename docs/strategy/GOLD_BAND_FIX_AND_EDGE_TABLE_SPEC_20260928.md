# Gold: declared-band measurement mode + factor edge table — exact specification

> **Reading order changed 2026-09-28.** The readable version is now
> `docs/strategy/GOLD_VIX_BOTH_AND_FACTOR_TABLE_PLAN_20260928.md` (short plan, four decisions, both VIX
> streams). This file is kept as the **mechanical appendix** to that plan — registry rows, code line
> numbers, the measurement command, the JSON shapes and the test list. Where the two disagree, the short
> plan wins and this file gets fixed. Section 9 of this file (the fifteen decisions D1–D15) is superseded by
> the plan's five decisions D1–D5. The plan was revised again on 2026-09-28 to lead with two stages — first
> "if a move happens", then "which way" — and that framing lives in the plan's sections 2–4; this appendix
> stays the mechanical detail for the two lanes.

Advisory recommendation from worker `strategy` (`strategy-advisory-001`), 2026-09-28.
Advisory only: this is a proposal for the coordinator, not an applied change. Every claim below was
re-measured on 2026-09-28 in this worker's checkout and is cited with its absolute path and, where
it is a number, the artifact it came from. Nothing in this document is a prediction, an accuracy
claim, a signal or a trading result; all intervals involved are already spent.

Proposed bounded assignments (see "Handoff" for why it is two writers):

- `gold-declared-band-measurement-026` — measurement lane, in the `gold-research` worktree.
- `dashboard-gold-factor-edge-page-001` — page lane; the coordinator should renumber this to the
  dashboard lane's own next free id if that lane numbers differently.

## 1. User decisions already recorded (2026-09-28)

1. Use the logic document's own numbers: VIX above 25 / below 16, and DXY move threshold 0.30%.
2. Deliver a **ranked factor-state to forward-move table**, in the dashboard, under the Gold
   Backtester submenu.
3. Plain code and table lookups only. No LLM call, no token spend, no model in the loop.
4. The bar is **60% directional significance**.
5. Use the existing 2023–2026 dataset only. No new data acquisition.
6. A new dashboard page beside the existing accuracy panel.

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
    "horizons": ["h24_post_event", "d5_trading_days_post_event"],
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
    "week": { },
    "session_verdict": "small_sample", "week_verdict": "small_sample",
    "year_warning": "thin sample: n is below 100" }],
  "neutral_rows": [ ], "unscored": [ ], "limits": [ ], "what_would_change_it": [ ],
  "sources": [ ]
}
```

**Table rules (they are the whole point of the page).**

1. One row per declared-band state; **session (24h) hit rate is the main number**, the 5-day week hit
   rate sits immediately beside it, so a state that only works at one horizon is visible as such.
2. **NEUTRAL legs never enter a hit rate.** `inside_16_25`, `inside_5bps`, `inside_0_30pct` and every
   document-declared NEUTRAL state are listed in `neutral_rows` with their raw up/down split and
   nothing else. A NEUTRAL state cannot be right or wrong, so it must not inflate or dilute a win rate.
3. Denominator is directional outcomes only: `hit_rate_pct = expected_count / (positive + negative)`,
   with `exact_zero` excluded, exactly as the accepted report declares.
4. **Every row carries its own drift benchmark** from the same cohort and horizon (session 55.81%,
   n 964; week 58.23%, n 960), plus `drift_edge_pp = hit_rate_pct - benchmark_pct`. A 60% session hit
   is only +4.19pp against what the session did anyway; the page must show both numbers or it is
   misleading by construction.
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
- the table is horizontally scrollable with the session columns first, and on narrow screens it stacks
  like the existing tables (the existing `table.wide` breakpoint pattern) rather than squashing numbers.

## 9. Open decisions, with the default this worker will build against

Each one is a real fork; the default is what the owner worker should implement if the user does not
answer, and every default is the conservative option (no invented direction, nothing removed).

| # | Decision | Default (conservative) | Alternative |
| --- | --- | --- | --- |
| D1 | Leave the 8 `level_band_not_declared` states and 4 `regime_label_not_reproduced` states unscored? | Yes: print them with the reason, no direction, no hit rate | Give them a direction — refused, that would be the author's opinion rather than the document's rule |
| D2 | Show those states at all? | Yes, in a separate `unscored` block with raw up/down splits only, clearly marked "the document declares no rule for this reading" | Hide them entirely |
| D3 | F5 "Gold rising strongly" has no magnitude in the document | Keep the sign states, label them `doc_magnitude_unnamed`, do not turn them into a band | Adopt 0.30% (F2's number) or 1.0% — either invents a threshold the document does not state |
| D4 | `vix_d1`, `vix_d5` (6 states, n≈437–523) have no declared rule | Unscored | Score as VIX-trend with `interpreted` provenance and a visible "not the document's rule" chip |
| D5 | F8 inflation: the document needs an inflation reading **and** dovish expectations | Unscored as a single variable | Declare the two-input rule `inflation_signal rising AND fed_bias dovish = BULLISH` — computable from two already-measured variables, but it is a pair, so per the agreed sequencing it waits until single factors are fixed |
| D6 | F9 safe haven | Leave `risk_headline_context` unscored and add a declared `safe_haven_stress` state built the way the live field is built: VIX above 25 (already row 16) or an archived event whose name is war / geopolitical / conflict / sanction. The event archive is already measured, so this is a declared rule over existing data | Keep the current `interpreted` news-sentiment mapping — the row that presently looks best, on an assumption the document does not contain |
| D7 | F10 liquidity/growth regime | Unscored: no liquidity variable is measured | Add one — that is new data, excluded by decision 5 |
| D8 | Where the page lives | Standalone `gold-factor-edge.html` linked from the Gold Backtest "Related pages" nav: satisfies "under the Gold Backtester submenu", touches no JavaScript, one writer | A new research sub-tab inside `index.html`/`script.js` beside Factor Edge Lab — deeper change in the dashboard lane |
| D9 | Boundary semantics | Exactly as the document words each rule: VIX 25.00 and 16.00 fall inside 16–25; F1 "5bps+" inclusive at 5.00; F2 ">0.30%" and F4 ">5bps" exclusive | Normalise every band to one convention — refused, it would silently restate the document |
| D10 | The 60% bar | Keep the existing implementation unchanged: `hit_rate_pct >= 60` **and** `n >= 100` | Strict `> 60` — changes no existing row, since no row sits at exactly 60.00% |
| D11 | Navigation surfaces | `gold-backtest-outcomes.html` and `gold-direction-scorecard.html` "Related pages" nav | Also add a topbar link in `index.html` |
| D12 | Show the old median/sign rows on the new page | No: the page carries declared-band rows only, and links to the existing scorecard page | Merge both tables on one page |
| D13 | Refresh policy | One frozen artifact with a stated as-of date, regenerated only when a new measurement run is accepted | Rebuild on every publish |
| D14 | Data window | 2023–2026 only, stated on the page, with the prospective window (first eligible anchor 2026-09-15T14:00:00Z, evaluation sealed until 2027-03-25T15:00:00Z) explicitly untouched | Read the sealed window — refused |
| D15 | Writer count | Two writers, sequenced: measurement lane first, page lane second, one writer per worktree | One writer doing both, if the coordinator prefers a single envelope |

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
   `59.9%` with `n 300` outranks a `52.0%` row by absolute edge; a NEUTRAL leg lands in `neutral_rows`
   and contributes nothing to any hit rate; the drift arithmetic reproduces the accepted scorecard's
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

## 11. Acceptance, handoff and limits

**Acceptance.** Input hashes recorded for the three directories in §3.6; the declaration committed
before the run, in its own commit; the 24 band states reconciled against the accepted report's own
anchor denominators (965 anchors, 964 with an outcome, 5,115 event rows); the edge artifact's
`baselines` block equal to the accepted scorecard's (session 55.81%, n 964; week 58.23%, n 960), because
a mismatch means the two tables are not comparable; the page saying in plain words that this is
exploratory, on spent intervals, and cannot choose; one writer per worktree; one unique submission
envelope per lane; pause at the review boundary.

**Handoff order.**

1. **Lane 1 — `gold-declared-band-measurement-026`** (the worker that owns the report library, i.e. the
   gold-research worktree, where `gold_individual_variable_report.js`, the builder and the v2 registry
   actually live; none of the three exists in canonical): deliverables A, B and C — the v3 register,
   the mode, the run, the expectations v2 — plus tests 1, 2 and 5 and a one-page summary that states the
   raw up/down splits of the 24 states with no direction claim.
2. **Lane 2 — `dashboard-gold-factor-edge-page-001`** (dashboard owner), only after lane 1 is accepted:
   deliverables D and E — the table builder, the artifact, the template, the page and the two nav
   entries — plus tests 3, 4 and 5.
3. Both lanes: no new data, no network, no credential, no change to Layer 1 logic, the frozen registry,
   the manifest, the capture lane, the scheduled task or the 130-anchor plan; nothing in the sealed
   prospective window is read; the combination circuit stays closed; factor **pairs** wait until the
   single factors have been fixed (that is decision D5).

**Limits, restated so the page can copy them.** Associations only, on intervals already spent. Every
state shares anchors with the others, one instant can feed several variables, and the two halves of a
band split are complements rather than independent trials, so counts are not independent trial counts.
The drift is 55.81% on the session and 58.23% on the week, which dominates any few-point factor lean.
The per-year test kills most of what survives the baseline test. The band register is a declared
reading of the document against the report's vocabulary, written after the accepted report existed; it
is not a pre-registration. No Layer 1 change is proposed here, no formula is fitted, and evaluation of
the prospective window stays sealed until `2027-03-25T15:00:00Z`.

**Provenance of this document.** Every count in §3 was read on 2026-09-28 from
`data/gold-direction-scorecard-20260927.json` and
`.local/worktrees/gold-research/backtester/tmp/ivr-coverage-019-20260925-r2/individual-variable-report.json`
using read-only commands; the only program this worker wrote for it is the ignored
scratch file `tmp/inspect-report-20260928.js` (streaming reader, no writes to any artifact). No
credential, no live system and no sealed-window value was read. Tests were **not run** because this
checkout is scoped to advisory notes and owns no executable lane.

