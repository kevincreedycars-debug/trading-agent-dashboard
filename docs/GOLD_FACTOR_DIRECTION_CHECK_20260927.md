# Gold factor direction check on the consumed intervals, 2026-09-27

The factor-tone cut asked whether a state's reading sat above the cohort's own baseline. This cut asks the
question the user actually posed: for each factor output, which way *should* Gold have gone, and which way did it
go? It is read-only over already-consumed 2023-2026 intervals. No prediction, accuracy, timing, profitability or
trading edge is claimed, no new data was gathered, no Layer 1 logic was changed and the sealed prospective window
was not read.

- Scorer: `backtester/scripts/report_gold_factor_direction_check.js` (tests: `backtester/tests/gold_factor_direction_check.test.js`).
- Expectations: `backtester/registries/gold_factor_direction_expectations.v1.json`, written from
  `logic/agent_gold_direction.md` (v2.0, weights F1 22, F2 18, F3 14, F4 8, F5 8, F6 10, F7 6, F8 6, F9 6, F10 2).
- Local evidence: `tmp/gold-factor-direction-check-20260927.json`, `tmp/gold-factor-direction-check-20260927.md`,
  `tmp/gold-factor-direction-check-20260927.txt`. Source: the accepted
  `ivr-coverage-019-20260925-r2/individual-variable-report.json`.

## Method

- Scope: the daily cohort (`daily_snapshot_anchors`), the `all_computed` endpoint group, the session
  (`h24_post_event`) and the week (`d5_trading_days_post_event`), all 28 measured variables.
- Each report state was mapped to the direction the Layer 1 document declares for it. Three provenances:
  **declared** (the document states it for a state with the same meaning, quoted verbatim in the registry),
  **interpreted** (the document's condition had to be read onto the report's label, so it is reported separately),
  and **not declared** (the document makes no directional statement that covers the state, so it is printed and
  not scored).
- Hit rate = the expected side's count divided by the state's directional outcomes (positive + negative; exact zero
  is excluded, as the report declares it is not an economic flat band).
- Benchmark = the same side's unconditioned rate for the same cohort and horizon. A bullish call that scores 55.81%
  on the session has told you nothing, because that is what the session did anyway. The **edge** is the hit rate
  minus that side's own rate.
- Verdicts: `reliable` and `inverted` require n of at least 100, an edge of at least 5pp in magnitude and the same
  edge sign in every year with at least 20 observations; `no_information` means the edge is inside the 5pp band;
  `unstable_across_years` means the edge is large but changes sign by year; `small_sample` means n is below 100.
- Levels are deliberately left unscored. The document's rules are change rules (5bps, 0.30%) or absolute bands
  (VIX 25/16), and the report splits each level at the variable's own median, which is neither. Inventing a
  direction for those states would have produced a table of its author's opinions rather than the document's rules.

**The result in one line: of 25 states that carry a declared direction, none is `reliable`. 25 of 25 are
`no_information` on the session, 24 of 25 on the week, and the twenty-fifth is unstable by year.** 20 of the 25
point the right way relative to their own side's drift, but the edges run between -2.54pp and +5.46pp, which is the
size of noise on this archive.

## The scored states, one row per factor output

Columns: the factor and its weight in the document, the variable and the state that the factor is reading, the
direction the document says that reading implies, then for the session and the week the realized up/down split, the
hit rate (expected side over directional outcomes) and the edge against that side's own unconditioned rate. "Years
stable" is the number of usable years and whether the edge holds its sign in all of them.

| Factor | W | Variable | Factor output | Expects Gold | Session up/down | Session hit | Session edge vs drift | Week up/down | Week hit | Week edge vs drift | Years stable | Verdict session / week |
| --- | ---: | --- | --- | --- | --- | --- | ---: | --- | --- | ---: | --- | --- |
| F1 Real Yield Direction | 22 | us_10y_real_yield_d20_bps | negative | BULLISH | 56.75% up / 43.25% down (n 437) | 56.75% (248/437) | +0.94pp vs 55.81% | 57.47% up / 42.53% down (n 435) | 57.47% (250/435) | -0.76pp vs 58.23% | 4/no - 4/no | no_information / no_information |
| F1 Real Yield Direction | 22 | us_10y_real_yield_d20_bps | positive | BEARISH | 54.99% up / 45.01% down (n 511) | 45.01% (230/511) | +0.82pp vs 44.19% | 58.63% up / 41.37% down (n 510) | 41.37% (211/510) | -0.4pp vs 41.77% | 4/no - 4/no | no_information / no_information |
| F1 Real Yield Direction | 22 | us_10y_real_yield_d5_bps | negative | BULLISH | 56.65% up / 43.35% down (n 436) | 56.65% (247/436) | +0.84pp vs 55.81% | 57.01% up / 42.99% down (n 435) | 57.01% (248/435) | -1.22pp vs 58.23% | 4/no - 4/no | no_information / no_information |
| F1 Real Yield Direction | 22 | us_10y_real_yield_d5_bps | positive | BEARISH | 53.75% up / 46.25% down (n 480) | 46.25% (222/480) | +2.06pp vs 44.19% | 59.12% up / 40.88% down (n 477) | 40.88% (195/477) | -0.89pp vs 41.77% | 4/no - 4/no | no_information / no_information |
| F2 DXY Direction | 18 | usd_broad_index_d1 | negative | BULLISH | 56.12% up / 43.88% down (n 515) | 56.12% (289/515) | +0.31pp vs 55.81% | 56.14% up / 43.86% down (n 513) | 56.14% (288/513) | -2.09pp vs 58.23% | 4/no - 4/no | no_information / no_information |
| F2 DXY Direction | 18 | usd_broad_index_d1 | positive | BEARISH | 55.46% up / 44.54% down (n 449) | 44.54% (200/449) | +0.35pp vs 44.19% | 60.63% up / 39.37% down (n 447) | 39.37% (176/447) | -2.4pp vs 41.77% | 4/no - 4/no | no_information / no_information |
| F2 DXY Direction | 18 | usd_broad_index_d20 | negative | BULLISH | 56.18% up / 43.82% down (n 518) | 56.18% (291/518) | +0.37pp vs 55.81% | 59.14% up / 40.86% down (n 514) | 59.14% (304/514) | +0.91pp vs 58.23% | 4/no - 4/no | no_information / no_information |
| F2 DXY Direction | 18 | usd_broad_index_d20 | positive | BEARISH | 55.38% up / 44.62% down (n 446) | 44.62% (199/446) | +0.43pp vs 44.19% | 57.17% up / 42.83% down (n 446) | 42.83% (191/446) | +1.06pp vs 41.77% | 4/no - 4/no | no_information / no_information |
| F2 DXY Direction | 18 | usd_broad_index_d5 | negative | BULLISH | 56.14% up / 43.86% down (n 497) | 56.14% (279/497) | +0.33pp vs 55.81% | 58.99% up / 41.01% down (n 495) | 58.99% (292/495) | +0.76pp vs 58.23% | 4/no - 4/no | no_information / no_information |
| F2 DXY Direction | 18 | usd_broad_index_d5 | positive | BEARISH | 55.46% up / 44.54% down (n 467) | 44.54% (208/467) | +0.35pp vs 44.19% | 57.42% up / 42.58% down (n 465) | 42.58% (198/465) | +0.81pp vs 41.77% | 4/no - 4/no | no_information / no_information |
| F3 Fed Bias | 14 | fed_bias | dovish | BULLISH | 56.89% up / 43.11% down (n 515) | 56.89% (293/515) | +1.08pp vs 55.81% | 59.88% up / 40.12% down (n 511) | 59.88% (306/511) | +1.65pp vs 58.23% | 3/no - 3/no | no_information / no_information |
| F3 Fed Bias | 14 | fed_bias | hawkish | BEARISH | 54.57% up / 45.43% down (n 449) | 45.43% (204/449) | +1.24pp vs 44.19% | 56.35% up / 43.65% down (n 449) | 43.65% (196/449) | +1.88pp vs 41.77% | 2/no - 2/no | no_information / no_information |
| F4 US 2Y Yield Trend | 8 | us_2y_d20_bps | negative | BULLISH | 58.1% up / 41.9% down (n 494) | 58.1% (287/494) | +2.29pp vs 55.81% | 58.91% up / 41.09% down (n 494) | 58.91% (291/494) | +0.68pp vs 58.23% | 4/no - 4/no | no_information / no_information |
| F4 US 2Y Yield Trend | 8 | us_2y_d20_bps | positive | BEARISH | 53.63% up / 46.37% down (n 455) | 46.37% (211/455) | +2.18pp vs 44.19% | 57.87% up / 42.13% down (n 451) | 42.13% (190/451) | +0.36pp vs 41.77% | 4/no - 4/no | no_information / no_information |
| F4 US 2Y Yield Trend | 8 | us_2y_d5_bps | negative | BULLISH | 59.27% up / 40.73% down (n 437) | 59.27% (259/437) | +3.46pp vs 55.81% | 57.67% up / 42.33% down (n 437) | 57.67% (252/437) | -0.56pp vs 58.23% | 4/no - 4/no | no_information / no_information |
| F4 US 2Y Yield Trend | 8 | us_2y_d5_bps | positive | BEARISH | 53.39% up / 46.61% down (n 487) | 46.61% (227/487) | +2.42pp vs 44.19% | 57.35% up / 42.65% down (n 483) | 42.65% (206/483) | +0.88pp vs 41.77% | 4/no - 4/no | no_information / no_information |
| F5 Gold Own Price Delta | 8 | gold_d1_pct | negative | BEARISH | 55.88% up / 44.12% down (n 442) | 44.12% (195/442) | -0.07pp vs 44.19% | 59.68% up / 40.32% down (n 439) | 40.32% (177/439) | -1.45pp vs 41.77% | 4/no - 4/no | no_information / no_information |
| F5 Gold Own Price Delta | 8 | gold_d1_pct | positive | BULLISH | 55.68% up / 44.32% down (n 519) | 55.68% (289/519) | -0.13pp vs 55.81% | 56.76% up / 43.24% down (n 518) | 56.76% (294/518) | -1.47pp vs 58.23% | 4/no - 4/yes | no_information / no_information |
| F5 Gold Own Price Delta | 8 | gold_d20_pct | negative | BEARISH | 55.69% up / 44.31% down (n 334) | 44.31% (148/334) | +0.12pp vs 44.19% | 57.83% up / 42.17% down (n 332) | 42.17% (140/332) | +0.4pp vs 41.77% | 4/no - 4/no | no_information / no_information |
| F5 Gold Own Price Delta | 8 | gold_d20_pct | positive | BULLISH | 55.26% up / 44.74% down (n 608) | 55.26% (336/608) | -0.55pp vs 55.81% | 57.59% up / 42.41% down (n 606) | 57.59% (349/606) | -0.64pp vs 58.23% | 4/yes - 4/no | no_information / no_information |
| F5 Gold Own Price Delta | 8 | gold_d5_pct | negative | BEARISH | 53.02% up / 46.98% down (n 398) | 46.98% (187/398) | +2.79pp vs 44.19% | 57.58% up / 42.42% down (n 396) | 42.42% (168/396) | +0.65pp vs 41.77% | 4/no - 4/no | no_information / no_information |
| F5 Gold Own Price Delta | 8 | gold_d5_pct | positive | BULLISH | 57.6% up / 42.4% down (n 559) | 57.6% (322/559) | +1.79pp vs 55.81% | 58.17% up / 41.83% down (n 557) | 58.17% (324/557) | -0.06pp vs 58.23% | 4/no - 4/no | no_information / no_information |
| F8 Inflation Signal | 6 | inflation_signal | negative | BEARISH | 57.36% up / 42.64% down (n 469) | 42.64% (200/469) | -1.55pp vs 44.19% | 60.77% up / 39.23% down (n 469) | 39.23% (184/469) | -2.54pp vs 41.77% | 4/no - 4/no | no_information / no_information |
| F8 Inflation Signal | 6 | inflation_signal | positive | BULLISH | 54.14% up / 45.86% down (n 471) | 54.14% (255/471) | -1.67pp vs 55.81% | 56.75% up / 43.25% down (n 467) | 56.75% (265/467) | -1.48pp vs 58.23% | 4/no - 4/no | no_information / no_information |
| F9 Safe Haven Demand | 6 | risk_headline_context | above_own_median | BULLISH | 60.51% up / 39.49% down (n 471) | 60.51% (285/471) | +4.7pp vs 55.81% | 63.69% up / 36.31% down (n 471) | 63.69% (300/471) | +5.46pp vs 58.23% | 4/no - 4/no | no_information / unstable_across_years |

## Factor rollup

Pooled across that factor's scored states, weighted by resolved outcomes. Pooling is dependent, so it summarises
the rows above rather than creating new trials.

| Factor | W | Variables | Rows | Pooled session hit | Pooled session edge vs drift | Pooled week hit | Pooled week edge vs drift | Verdict session / week |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| F1 Real Yield Direction | 22 | 2 | 4 | 50.8% (947/1864) | +1.17pp vs 49.63% | 48.68% (904/1857) | -0.8pp vs 49.48% | no_information / no_information |
| F2 DXY Direction | 18 | 3 | 6 | 50.69% (1466/2892) | +0.35pp vs 50.34% | 50.31% (1449/2880) | -0.16pp vs 50.47% | no_information / no_information |
| F3 Fed Bias | 14 | 1 | 2 | 51.56% (497/964) | +1.16pp vs 50.4% | 52.29% (502/960) | +1.76pp vs 50.53% | no_information / no_information |
| F4 US 2Y Yield Trend | 8 | 2 | 4 | 52.54% (984/1873) | +2.57pp vs 49.97% | 50.35% (939/1865) | +0.36pp vs 49.99% | no_information / no_information |
| F5 Gold Own Price Delta | 8 | 3 | 6 | 51.64% (1477/2860) | +0.6pp vs 51.04% | 50.98% (1452/2848) | -0.51pp vs 51.49% | no_information / no_information |
| F8 Inflation Signal | 6 | 1 | 2 | 48.4% (455/940) | -1.61pp vs 50.01% | 47.97% (449/936) | -2.01pp vs 49.98% | no_information / no_information |
| F9 Safe Haven Demand | 6 | 1 | 1 | 60.51% (285/471) | +4.7pp vs 55.81% | 63.69% (300/471) | +5.46pp vs 58.23% | no_information / unstable_across_years |

## What each factor actually does

- **F1 Real Yield Direction (weight 22, the largest): correct sign, no edge.** Real-yield rising implies Gold down:
  it fell in 46.25% of those sessions against a 44.19% down-rate with no conditioning, an edge of +2.06pp. Real
  yield falling implied Gold up: 56.65% against 55.81%, an edge of +0.84pp. Pooled, the session edge is +1.17pp and
  the week edge is -0.80pp. The biggest driver in the model is directionally right and materially uninformative.
- **F2 DXY Direction (weight 18): indistinguishable from zero.** Dollar up implies Gold down at 44.54% against a
  44.19% down-rate; dollar down implies Gold up at 56.12% against 55.81%. Pooled +0.35pp session, -0.16pp week.
  Two caveats belong with that number rather than under the table: the report measures the FRED broad dollar index
  because the four `dxy_*` ids were retired, so this is a proxy, and the document's 0.30% threshold is not applied
  because the report declares no threshold.
- **F3 Fed Bias (weight 14): right sign, no edge.** Hawkish implies Gold down at 45.43% against 44.19%; dovish
  implies Gold up at 56.89% against 55.81%. Pooled +1.16pp session, +1.76pp week - the best of the three primary
  drivers on the week horizon and still far inside the band.
- **F4 US 2Y Yield Trend (weight 8): the largest single session reading among the rates.** 2Y falling implies Gold
  up at 59.27% (n=437), an edge of +3.46pp, and 2Y rising implies Gold down at 46.61%, +2.42pp. Pooled +2.57pp
  session, +0.36pp week. Under the 60% question this is the strongest yield reading in the archive and it is still
  short of the band.
- **F5 Gold Own Price Delta (weight 8): momentum is the drift.** Gold up yesterday implies Gold up today at 55.68%
  against a 55.81% up-rate: minus 0.13pp. Pooled +0.60pp session, -0.51pp week, with three of its six states
  pointing the wrong way on the session. Whatever Gold's own move predicts, it is not a same-direction continuation.
- **F6 Risk Regime / VIX (weight 10): not scoreable in this cut.** The document's VIX rule is absolute bands
  (above 25 bullish, below 16 bearish); the report splits VIX at its own median, and the document declares no
  direction for a VIX change at all. Ten per cent of the model's weight cannot be tested against the report as cut.
- **F7 US Economic Surprise (weight 6): not scoreable in this cut.** Surprise signs are family-scoped in the report
  and the coverage registry declares that per-family direction conventions are not established; the pooled
  across-family row is labelled non-comparable. The variable is also measured only in the release cohort, which is a
  different question from "did the day end that way".
- **F8 Inflation Signal (weight 6): the only factor that leans the wrong way.** Rising inflation implied Gold up and
  scored 54.14% against 55.81%; falling inflation implied Gold down and scored 42.64% against 44.19%. Pooled
  -1.61pp session and -2.01pp week. Both halves are mildly inverted, and both are inside the band, so this reads as
  a weak counter-signal rather than a usable reversal.
- **F9 Safe Haven Demand (weight 6): the one reading worth a second look, and the weakest mapping.** Risk-headline
  context above its own median implies Gold up and scored 60.51% (285/471) on the session, +4.70pp, and 63.69%
  (300/471) on the week, +5.46pp. It is the only state above 60% at a usable count on either horizon. Three things
  keep it from being a finding: the mapping from the report's median split onto the document's stress/calm
  conditions is an interpretation rather than a quoted rule, the document forbids a bearish safe-haven score so the
  calm half is NEUTRAL and unscored rather than a verified opposite, and the week edge changes sign in at least one
  year, which is what the `unstable_across_years` verdict records.
- **F10 Liquidity / Growth Regime (weight 2): not scoreable.** The document's rule is written in categorical regime
  names (expansion, contraction); the report measures a median split of a level and does not reproduce those names.

## Reading for the standing question

- **Nothing here is a genuinely reliable factor at the session horizon.** Every one of the 25 scored states lands
  inside 5pp of what its own side scores with no conditioning, and the two that clear 60% at a usable count
  (risk-headline context above its own median, on both horizons) clear it because 55.81% and 58.23% were what the
  sessions and weeks did anyway.
- **The factors are not wrong, they are uninformative.** 20 of the 25 states point the way the document says they
  should, which is a better record than a coin flip, but the typical edge is under two points and no edge survives
  the year test. Direction agreement without a magnitude is not something to trade or to reweight.
- **The heaviest factors are not the strongest.** F1 (weight 22) and F2 (weight 18) carry 40% of the model's weight
  and deliver +1.17pp and +0.35pp on the session, while the largest single session reading comes from F4 (weight 8)
  at +2.57pp pooled. On this archive the weighting is not earning its shape.
- **The week horizon is not systematically better for a directional call.** Session and week verdicts agree in all
  25 rows at the `no_information` level, and where the numbers grow, they grow because the drift grows with them:
  the week baseline is 58.23% up, so a bullish week reading has to beat that, not beat 50%.
- **Two fifths of the states cannot be scored at all.** 26 of the 62 daily-cohort states carry no direction in the
  Layer 1 document to test: every level or median split (real-yield level, dollar level, 2Y level, Gold price level,
  VIX level and both VIX changes, equities and growth regimes), every `exact_zero` state (the document's "otherwise
  = NEUTRAL"), and the event fields. That set includes `usd_broad_index_level` above its own median, which was the
  largest week reading in the tone cut (65.63% up, n=480) - a state the document simply makes no claim about.
- **Consequence for Layer 1: unchanged.** A model whose measured components each sit inside the noise band at this
  horizon is not a candidate for reweighting, and the honest next step is not a better chart of the same archive but
  a prospectively sealed test on data not yet spent.

## States with no declared direction to test

Printed with their own up/down rates so the reader can see them, and not scored, because the document states no
direction for them.

| Factor | Variable | Factor output | Provenance | Why unscored | Session up/down | Week up/down |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | us_10y_real_yield | above_own_median | not_declared | level_band_not_declared | 54.26% up / 45.74% down (n 470) | 61.16% up / 38.84% down (n 466) |
| F1 | us_10y_real_yield | at_or_below_own_median | not_declared | level_band_not_declared | 57.2% up / 42.8% down (n 493) | 55.38% up / 44.62% down (n 493) |
| F1 | us_10y_real_yield_d20_bps | exact_zero | declared | NEUTRAL | 53.33% up / 46.67% down (n 15) | 64.29% up / 35.71% down (n 14) |
| F1 | us_10y_real_yield_d5_bps | exact_zero | declared | NEUTRAL | 68.09% up / 31.91% down (n 47) | 59.57% up / 40.43% down (n 47) |
| F2 | usd_broad_index_level | above_own_median | not_declared | level_band_not_declared | 59.38% up / 40.63% down (n 480) | 65.63% up / 34.38% down (n 480) |
| F2 | usd_broad_index_level | at_or_below_own_median | not_declared | level_band_not_declared | 52.27% up / 47.73% down (n 484) | 50.83% up / 49.17% down (n 480) |
| F6 | vix_d1 | exact_zero | not_declared | change_rule_absent | 50% up / 50% down (n 4) | 25% up / 75% down (n 4) |
| F6 | vix_d1 | negative | not_declared | change_rule_absent | 58.32% up / 41.68% down (n 523) | 56.6% up / 43.4% down (n 523) |
| F6 | vix_d1 | positive | not_declared | change_rule_absent | 52.86% up / 47.14% down (n 437) | 60.51% up / 39.49% down (n 433) |
| F6 | vix_d5 | exact_zero | not_declared | change_rule_absent | 0% up / 100% down (n 1) | 0% up / 100% down (n 1) |
| F6 | vix_d5 | negative | not_declared | change_rule_absent | 52.86% up / 47.14% down (n 507) | 56.92% up / 43.08% down (n 506) |
| F6 | vix_d5 | positive | not_declared | change_rule_absent | 59.21% up / 40.79% down (n 456) | 59.82% up / 40.18% down (n 453) |
| F6 | vix_level | above_own_median | not_declared | threshold_is_absolute_band | 56.96% up / 43.04% down (n 481) | 58.84% up / 41.16% down (n 481) |
| F6 | vix_level | at_or_below_own_median | not_declared | threshold_is_absolute_band | 54.66% up / 45.34% down (n 483) | 57.62% up / 42.38% down (n 479) |
| F4 | us_2y_d20_bps | exact_zero | declared | NEUTRAL | 42.86% up / 57.14% down (n 14) | 42.86% up / 57.14% down (n 14) |
| F4 | us_2y_d5_bps | exact_zero | declared | NEUTRAL | 46.15% up / 53.85% down (n 39) | 74.36% up / 25.64% down (n 39) |
| F4 | us_2y_yield | above_own_median | not_declared | level_band_not_declared | 54.12% up / 45.88% down (n 473) | 55.86% up / 44.14% down (n 469) |
| F4 | us_2y_yield | at_or_below_own_median | not_declared | level_band_not_declared | 57.35% up / 42.65% down (n 490) | 60.41% up / 39.59% down (n 490) |
| F5 | gold_price | above_own_median | not_declared | level_band_not_declared | 55.72% up / 44.28% down (n 481) | 58.07% up / 41.93% down (n 477) |
| F5 | gold_price | at_or_below_own_median | not_declared | level_band_not_declared | 55.81% up / 44.19% down (n 482) | 58.3% up / 41.7% down (n 482) |
| F8 | inflation_signal | exact_zero | interpreted | NEUTRAL | 58.33% up / 41.67% down (n 24) | 37.5% up / 62.5% down (n 24) |
| F9 | risk_headline_context | at_or_below_own_median | interpreted | NEUTRAL | 51.32% up / 48.68% down (n 493) | 52.97% up / 47.03% down (n 489) |
| F10 | equities_regime | above_own_median | not_declared | regime_label_not_reproduced | 56.55% up / 43.45% down (n 481) | 59.54% up / 40.46% down (n 477) |
| F10 | equities_regime | at_or_below_own_median | not_declared | regime_label_not_reproduced | 55.07% up / 44.93% down (n 483) | 56.94% up / 43.06% down (n 483) |
| F10 | growth_regime | above_own_median | not_declared | regime_label_not_reproduced | 58.12% up / 41.88% down (n 468) | 61.11% up / 38.89% down (n 468) |
| F10 | growth_regime | at_or_below_own_median | not_declared | regime_label_not_reproduced | 53.53% up / 46.47% down (n 467) | 55.72% up / 44.28% down (n 463) |

Three smaller buckets, for completeness:

- **Declared but never observed on the anchor grid (7):** `fed_bias` neutral, and `exact_zero` for
  `usd_broad_index_d1`, `usd_broad_index_d5`, `usd_broad_index_d20`, `gold_d1_pct`, `gold_d5_pct`, `gold_d20_pct`.
  Those states carry the document's NEUTRAL expectation, so there is nothing to score.
- **Measured only in the release cohort (7):** `event_type`, `event_actual`, `event_consensus`,
  `event_previous_as_released`, `event_age_hours` and the two `event_surprise` sign patterns. A release-cohort cut
  answers "did price move after the release", which is a different question from the one asked here; the scorer
  accepts `--cohort event_releases` when that question is wanted.
- **Document inputs the report does not measure (5):** `dxy_level`, `dxy_d1`, `dxy_d5`, `dxy_d20` (retired ids) and
  `latest_us_event` (the report measures archived event identity instead).
- **Availability labels, not factor outputs (11):** the `unavailable` cells, where the variable had no
  strictly-available value at the anchor. They appear on the session and week horizons with n of 0 or 1 and are
  excluded from every count above.

## Limits

- Association only, on intervals already spent: every state shares anchors with the others, one instant can feed
  several variables, and the two halves of a median split are complements rather than independent trials. Counts are
  not independent trial counts.
- The expectations registry was written after the accepted report existed. It is a declared reading of
  `agent_gold_direction.md` against the report's state vocabulary, not a pre-registration, and it changes nothing
  about the report it reads.
- Where the document's rule carries a magnitude threshold, the scored state is the sign of the change, so a move the
  document would call neutral is scored as if it were outside the threshold. The scored set is therefore slightly
  broader than the document's own rule, which works against the model rather than for it.
- The report's cell arithmetic was independently re-checked by `backtester/lib/gold_data_verifier.js` on 150 sampled
  cells with no disagreement. This scorer re-cuts those cells; it does not re-measure anything.
- No Layer 1 change is proposed, the combination circuit stays closed, and the evaluation window stays sealed until
  `2027-03-25T15:00:00Z`.
