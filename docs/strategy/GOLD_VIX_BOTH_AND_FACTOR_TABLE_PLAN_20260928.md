# Gold: both VIX streams + the factor to forward-move table — short plan

Advisory recommendation from worker `strategy` (`strategy-advisory-001`), 2026-09-28. Every number below
was read on 2026-09-28 from files named in-line with read-only commands. Nothing here is a prediction, an
accuracy claim, a signal or a trading result; every interval involved is already spent.

Mechanical detail for the two implementation lanes lives in
`docs/strategy/GOLD_BAND_FIX_AND_EDGE_TABLE_SPEC_20260928.md` (registry rows, code line numbers, the run
command, the JSON shapes). **This file is the readable version and it decides; the other file is the
appendix.** If the two ever disagree, this one wins and the other gets fixed.

## 1. What you asked for

1. Simplify the plan.
2. **Keep both VIX streams** — the absolute level bands *and* the change states — and see which of them
   show the kind of correlation we care about.

Both are answered below. The simplification is real, not cosmetic: the VIX-change half turns out to be
mostly answerable **from a file that already exists**, so it costs no new run, and the decision list drops
from fifteen questions to four.

## 2. The VIX streams, and which of them we can already read

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

## 3. Where the "correlations we care about" bar is

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

## 4. Design: both streams, one table, three row types

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

**One project precedent, for honesty.** `logic/agent_usd_direction.md` (line 154) does carry a VIX-change
rule — "VIX rising sharply over 1d or 5d = BULLISH modifier" — but that is the USD document and "sharply" is
unnamed there too. Gold's change stream therefore has no declared number anywhere; if a direction is ever
wanted for it, it must be declared as **new** and tested out of sample, not read back out of this archive.

**Not proposed.** No combination, no pair, no weighting, no composite score, no model, no LLM call, no new
data source, no Layer 1 edit. Pairs stay closed until the single factors are settled; that stays deferred.

## 5. The table and the page

One artifact (`data/gold-factor-edge-<YYYYMMDD>.json`, schema `gold-factor-edge-v1`) and one page, with
three row blocks in this order: (A) rows that clear the interest bar — expected to be empty; (B) all other
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

## 6. Four decisions

Fifteen became four. Everything else that was open is now a stated default in §7 and needs no answer.

| # | Question | Recommended default | Alternative |
| --- | --- | --- | --- |
| D1 | What to do with the VIX change stream | Both streams, as designed in §4: level bands scored, change legs published as raw context (B1) plus the declared 1/2/5 and 2/5/10 sweep with `looks_counted` (B2), no direction invented | Reject B2 (context only, the minimum version), or drop the change stream back to unscored |
| D2 | Size of the deliverable | Full version: new page beside the accuracy panel, linked from the two Gold Backtest pages | Minimum version in §5: block C appended to the existing scorecard page, no new template, no nav edits |
| D3 | F9 `risk_headline_context` | Rebuild it as a declared rule the way the live field is built (VIX>25 **or** war/geopolitical/conflict/sanction event names), because today's only bar-clearing row is an `interpreted` mapping with an unstable sign | Leave the `interpreted` row as the accepted artifact has it and publish it with its caveats |
| D4 | The interest bar | Keep the existing implementation unchanged: `hit_rate_pct >= 60` **and** `n >= 100`, plus the six conditions in §3 | Strict `> 60` — changes no existing row, since none sits at exactly 60.00% |

Defaults are conservative: they invent no direction, remove no coverage and change no accepted artifact. If
no answer arrives, D1–D4 defaults are what the two lanes implement.

## 7. Defaults that need no answer

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

## 8. Tests the lanes must write (five, one line each)

1. `gold_declared_band_state.test.js` — boundary cases 25.01 / 25.00 / 24.99 and 16.01 / 16.00 / 15.99 land
   in the right legs; F1 5.00 inclusive, F4 5.00 exclusive, F2 0.30% exclusive.
2. `gold_individual_variable_report_band.test.js` — the band register is declared before the run, the report
   refuses to overwrite, its content hash is stable, and the registry's sha256 is recorded in provenance.
3. `gold_factor_edge_table.test.js` — the bar, the `thin` flag at n<100, NEUTRAL excluded from every hit
   rate, `looks_counted` correct, drift arithmetic reproducing 60.51 − 55.81 = 4.70 from the accepted
   scorecard, and deterministic row order.
4. `gold_factor_edge_page.test.js` — one placeholder replaced once, the embedded JSON parses, no `fetch`, no
   external script, no model endpoint.
5. Byte-level regression — `data/gold-direction-scorecard-20260927.json`,
   `gold_factor_direction_expectations.v1.json`, `gold_individual_variable_report.v2.json` and the accepted
   019 report are unchanged afterwards.

## 9. Handoff, limits, provenance

**Order, two lanes, one writer per worktree.** Lane 1 `gold-declared-band-measurement-026`, in the
gold-research worktree: the v3 register (both VIX streams declared, thresholds written down before any
outcome is read), the report mode change, the run into a new output directory, expectations v2, tests 1, 2
and 5, and a one-page summary of the raw splits with no direction claim. Lane 2
`dashboard-gold-factor-edge-page-001`, only after lane 1 is accepted: the table builder, the artifact, the
template, the page and the two nav entries, tests 3, 4 and 5. No network, no credential, no new data, no
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

**Provenance.** Read-only on 2026-09-28: `logic/agent_gold_direction.md` (F6 inputs, lines 279–295),
`logic/agent_usd_direction.md` (line 154), `data/gold-direction-scorecard-20260927.json` (`rows`,
`unscored`, `baselines`, `summary`, `factors`), `VIXCLS.json` (97,074 bytes) for the sizing estimate, and a
streaming scan of the 95,842,994-byte 019 report for the missing-`values` finding. The only program written
is the ignored scratch reader `tmp/inspect-report-20260928.js`. Tests were **not run**: this checkout is
scoped to advisory notes and owns no executable lane; the five tests above belong to the two lanes.
