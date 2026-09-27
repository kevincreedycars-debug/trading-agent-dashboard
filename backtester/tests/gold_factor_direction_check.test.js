const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  VERSION,
  parseArgs,
  share,
  subtract,
  assertExpectations,
  buildExpectationIndex,
  buildDirectionCheck,
  poolBlocks,
  scoreHorizon,
  summarise,
  verdictFor,
  formatRows,
  formatRollup,
  formatMarkdown
} = require("../scripts/report_gold_factor_direction_check");

const REGISTRY_PATH = path.join(__dirname, "..", "registries", "gold_factor_direction_expectations.v1.json");

const PARAMETERS = {
  cohort: "daily_snapshot_anchors",
  group: "all_computed",
  primary_horizon: "h24_post_event",
  week_horizon: "d5_trading_days_post_event",
  horizons: ["h24_post_event", "d5_trading_days_post_event"],
  min_n: 100,
  min_year_n: 20,
  edge_pp: 5,
  threshold_pct: 60
};

function registryFixture() {
  return {
    version: "fixture-registry",
    factors: [
      { key: "F1", label: "Real Yield Direction", weight: 22 },
      { key: "F7", label: "US Economic Surprise", weight: 6 }
    ],
    states: [
      { variable: "us_10y_real_yield_d5_bps", state: "positive", factor: "F1", expected_direction: "BEARISH", provenance: "declared", rule_ref: "FACTOR 1", rule_text: "Real yield rising 5bps+ = BEARISH", caveats: ["threshold_not_applied"] },
      { variable: "us_10y_real_yield_d5_bps", state: "negative", factor: "F1", expected_direction: "BULLISH", provenance: "declared", rule_ref: "FACTOR 1", rule_text: "Real yield falling 5bps+ = BULLISH", caveats: [] },
      { variable: "us_10y_real_yield_d5_bps", state: "exact_zero", factor: "F1", expected_direction: "NEUTRAL", provenance: "declared", rule_ref: "FACTOR 1", rule_text: "Otherwise = NEUTRAL", caveats: [] },
      { variable: "us_10y_real_yield", state: "above_own_median", factor: "F1", expected_direction: null, provenance: "not_declared", reason: "level_band_not_declared" }
    ],
    state_patterns: [
      { variable: "event_surprise", state_suffix: "|positive", factor: "F7", expected_direction: "BEARISH", provenance: "declared", rule_ref: "FACTOR 7", rule_text: "Positive surprise = BEARISH", caveats: ["family_scoped_sign"] }
    ],
    unmeasured_document_inputs: [{ document_input: "latest_us_event", factor: "F7", report_status: "not_measured", reason: "fixture" }]
  };
}

function state(name, n, positive, negative, years) {
  return {
    state: name,
    n,
    direction: { positive, negative, exact_zero: n - positive - negative },
    magnitude_pct: { n, median: 0.1 },
    year_breakdown: years,
    small_sample: n < 20
  };
}

function reportFixture() {
  const year = (value, n, positive) => ({ year: value, n, direction: { positive, negative: n - positive, exact_zero: 0 } });
  const horizons = {
    h24_post_event: { groups: { all_computed: { states: [
      state("positive", 200, 130, 70, [year(2024, 100, 65), year(2025, 100, 65)]),
      state("negative", 300, 150, 150, [year(2024, 150, 70), year(2025, 150, 90)]),
      state("exact_zero", 40, 20, 20, [year(2025, 40, 20)]),
      state("unavailable", 1, 1, 0, [])
    ] } } },
    d5_trading_days_post_event: { groups: { all_computed: { states: [
      state("positive", 200, 150, 50, [year(2024, 100, 75), year(2025, 100, 75)]),
      state("negative", 300, 150, 150, [year(2024, 150, 75), year(2025, 150, 75)]),
      state("unavailable", 1, 1, 0, [])
    ] } } }
  };
  return {
    minimum_observations: 20,
    baselines: {
      daily_snapshot_anchors: {
        h24_post_event: { groups: { all_computed: { n: 500, direction: { positive: 280, negative: 220, exact_zero: 0 }, year_breakdown: [year(2024, 250, 140), year(2025, 250, 140)] } } },
        d5_trading_days_post_event: { groups: { all_computed: { n: 500, direction: { positive: 300, negative: 200, exact_zero: 0 }, year_breakdown: [year(2024, 250, 150), year(2025, 250, 150)] } } }
      }
    },
    variables: [
      { id: "us_10y_real_yield_d5_bps", cohorts: { daily_snapshot_anchors: { status: "measured", horizons } } },
      { id: "us_10y_real_yield", cohorts: { daily_snapshot_anchors: { status: "measured", horizons: {
        h24_post_event: { groups: { all_computed: { states: [state("above_own_median", 250, 160, 90, [year(2024, 125, 80), year(2025, 125, 80)])] } } },
        d5_trading_days_post_event: { groups: { all_computed: { states: [state("above_own_median", 250, 160, 90, [year(2024, 125, 80), year(2025, 125, 80)])] } } }
      } } } },
      { id: "event_surprise", cohorts: { daily_snapshot_anchors: { status: "not_applicable_to_cohort" } } }
    ]
  };
}


test("args, shares and point differences are computed without guessing", () => {
  assert.deepEqual(parseArgs(["--report", "a.json", "--min-n=100"]), { report: "a.json", "min-n": "100" });
  assert.throws(() => parseArgs(["nope"]), /Unknown argument/);
  assert.equal(share(70, 200), 35);
  assert.equal(share(1, 0), null);
  assert.equal(subtract(35, 44), -9);
  assert.equal(subtract(null, 44), null);
  assert.equal(VERSION, "gold-factor-direction-check-v1");
});

test("the registry must state a rule for every direction it scores", () => {
  assert.equal(assertExpectations(registryFixture()), true);
  const unknownFactor = registryFixture();
  unknownFactor.states[0].factor = "F9";
  assert.throws(() => assertExpectations(unknownFactor), /Unknown factor/);
  const duplicate = registryFixture();
  duplicate.states.push({ ...duplicate.states[0] });
  assert.throws(() => assertExpectations(duplicate), /Duplicate expectation/);
  const scoredButNotDeclared = registryFixture();
  scoredButNotDeclared.states[3].provenance = "not_declared";
  scoredButNotDeclared.states[3].expected_direction = "BEARISH";
  assert.throws(() => assertExpectations(scoredButNotDeclared), /cannot carry a direction/);
  const noQuote = registryFixture();
  delete noQuote.states[0].rule_text;
  assert.throws(() => assertExpectations(noQuote), /quote its rule/);
  const noReason = registryFixture();
  delete noReason.states[3].reason;
  assert.throws(() => assertExpectations(noReason), /must state a reason/);
  const ambiguousPattern = registryFixture();
  ambiguousPattern.state_patterns[0].state = "positive";
  assert.throws(() => assertExpectations(ambiguousPattern), /exactly one of state or state_suffix/);
});

test("an expectation is matched by state first and by declared suffix second", () => {
  const index = buildExpectationIndex(registryFixture());
  assert.equal(index.lookup("us_10y_real_yield_d5_bps", "positive").matched_by, "state");
  assert.equal(index.lookup("us_10y_real_yield_d5_bps", "positive").entry.expected_direction, "BEARISH");
  const pattern = index.lookup("event_surprise", "some-family|positive");
  assert.equal(pattern.matched_by, "state_suffix");
  assert.equal(pattern.entry.expected_direction, "BEARISH");
  assert.equal(index.lookup("event_surprise", "some-family|exact_zero").entry, null);
  assert.equal(index.lookup("nothing_declared", "positive").matched_by, "unmapped");
  assert.equal(index.factorOf("F1").label, "Real Yield Direction");
});

test("a scored state reports the hit rate, the side's own baseline and the edge", () => {
  const cell = { horizon: "h24_post_event", state: state("positive", 200, 130, 70, [
    { year: 2024, n: 100, direction: { positive: 65, negative: 35, exact_zero: 0 } },
    { year: 2025, n: 100, direction: { positive: 65, negative: 35, exact_zero: 0 } }
  ]) };
  const baseline = { positive_rate_pct: 56, negative_rate_pct: 44, by_year: {
    2024: { n: 250, positive_rate_pct: 56, negative_rate_pct: 44 },
    2025: { n: 250, positive_rate_pct: 56, negative_rate_pct: 44 }
  } };
  const bearish = scoreHorizon(cell, "BEARISH", baseline, PARAMETERS);
  assert.equal(bearish.hit_rate_pct, 35);
  assert.equal(bearish.expected_count, 70);
  assert.equal(bearish.resolved, 200);
  assert.equal(bearish.benchmark_pct, 44);
  assert.equal(bearish.drift_edge_pp, -9);
  assert.equal(bearish.coin_edge_pp, -15);
  assert.equal(bearish.years_same_edge_sign, true);
  assert.equal(bearish.clears_majority_threshold, false);
  const bullish = scoreHorizon(cell, "BULLISH", baseline, PARAMETERS);
  assert.equal(bullish.hit_rate_pct, 65);
  assert.equal(bullish.benchmark_pct, 56);
  assert.equal(bullish.drift_edge_pp, 9);
});

test("the verdict separates a rate from information about the rate", () => {
  const block = extra => ({ n: 200, resolved: 200, drift_edge_pp: 4, years_same_edge_sign: true, ...extra });
  assert.equal(verdictFor(null, PARAMETERS), "not_measured_in_cohort");
  assert.equal(verdictFor({ n: 0, resolved: 0 }, PARAMETERS), "no_directional_outcomes");
  assert.equal(verdictFor(block({ n: 50 }), PARAMETERS), "small_sample");
  assert.equal(verdictFor(block({ drift_edge_pp: 4.99 }), PARAMETERS), "no_information");
  assert.equal(verdictFor(block({ drift_edge_pp: -4.99 }), PARAMETERS), "no_information");
  assert.equal(verdictFor(block({ drift_edge_pp: 9, years_same_edge_sign: false }), PARAMETERS), "unstable_across_years");
  assert.equal(verdictFor(block({ drift_edge_pp: 9 }), PARAMETERS), "reliable");
  assert.equal(verdictFor(block({ drift_edge_pp: -9 }), PARAMETERS), "inverted");
});

test("the scored table joins the session and the week and keeps unscored states visible", () => {
  const check = buildDirectionCheck(reportFixture(), registryFixture(), PARAMETERS);
  assert.equal(check.rows.length, 2);
  const bearishRow = check.rows.find(row => row.state === "positive");
  assert.equal(bearishRow.factor_key, "F1");
  assert.equal(bearishRow.expectation, "BEARISH");
  assert.equal(bearishRow.provenance, "declared");
  assert.equal(bearishRow.session.hit_rate_pct, 35);
  assert.equal(bearishRow.session.drift_edge_pp, -9);
  assert.equal(bearishRow.week.hit_rate_pct, 25);
  assert.equal(bearishRow.week.drift_edge_pp, -15);
  assert.equal(bearishRow.session_verdict, "inverted");
  assert.equal(bearishRow.week_verdict, "inverted");
  const bullishRow = check.rows.find(row => row.state === "negative");
  assert.equal(bullishRow.expectation, "BULLISH");
  assert.equal(bullishRow.session.hit_rate_pct, 50);
  assert.equal(bullishRow.session.drift_edge_pp, -6);
  assert.equal(bullishRow.session_verdict, "unstable_across_years");
  assert.equal(bullishRow.week_verdict, "inverted");
  assert.equal(check.unscored.length, 2);
  assert.equal(check.unscored.some(row => row.state === "exact_zero" && row.expectation === "NEUTRAL"), true);
  assert.equal(check.unscored.some(row => row.reason === "level_band_not_declared"), true);
  assert.equal(check.unmapped.length, 0);
  assert.equal(check.availability_labels.length, 1);
  assert.equal(check.availability_labels[0].variable, "us_10y_real_yield_d5_bps");
  assert.equal(check.declared_but_absent.length, 0);
  assert.equal(check.declared_in_another_cohort.length, 1);
  assert.equal(check.declared_in_another_cohort[0].cohort_status, "not_applicable_to_cohort");
});

test("the factor rollup pools its scored states without inventing new trials", () => {
  const check = buildDirectionCheck(reportFixture(), registryFixture(), PARAMETERS);
  const factor = check.rollup[0];
  assert.equal(check.rollup.length, 1);
  assert.equal(factor.factor_key, "F1");
  assert.equal(factor.rows_scored, 2);
  assert.equal(factor.variables.length, 1);
  assert.equal(factor.session.expected_count, 220);
  assert.equal(factor.session.resolved, 500);
  assert.equal(factor.session.hit_rate_pct, 44);
  assert.equal(factor.session.benchmark_pct, 51.2);
  assert.equal(factor.session.drift_edge_pp, -7.2);
  assert.equal(factor.session_verdict, "inverted");
  assert.equal(factor.week.hit_rate_pct, 40);
  assert.equal(factor.week.benchmark_pct, 52);
  assert.equal(factor.week.drift_edge_pp, -12);
  assert.equal(factor.week_verdict, "inverted");
  const summary = summarise(check, PARAMETERS);
  assert.equal(summary.rows_scored, 2);
  assert.equal(summary.rows_declared, 2);
  assert.equal(summary.rows_unscored_no_declared_direction, 2);
  assert.equal(summary.rows_availability_labels, 1);
  assert.equal(summary.rows_unmapped_in_expectations, 0);
  assert.deepEqual(summary.session_verdicts, { inverted: 1, unstable_across_years: 1 });
  assert.deepEqual(summary.week_verdicts, { inverted: 2 });
  assert.equal(summary.session_rows_hit_rate_at_least_50, 1);
  assert.equal(summary.baselines.h24_post_event.positive_rate_pct, 56);
});

test("pooling reports the weighted benchmark and tolerates a missing block", () => {
  const pooled = poolBlocks([
    { n: 10, resolved: 10, expected_count: 7, benchmark_pct: 50, years: [] },
    null
  ], "h24_post_event", PARAMETERS);
  assert.equal(pooled.hit_rate_pct, 70);
  assert.equal(pooled.benchmark_pct, 50);
  assert.equal(pooled.drift_edge_pp, 20);
  assert.equal(pooled.rows_pooled, 1);
  assert.equal(pooled.years_observed, 0);
  assert.equal(pooled.years_same_edge_sign, false);
  assert.equal(pooled.clears_majority_threshold, false);
  assert.equal(poolBlocks([], "h24_post_event", PARAMETERS), null);
});

test("the committed expectations map the logic document's rules onto the measured states", () => {
  const registry = require(REGISTRY_PATH);
  assert.equal(registry.version, "gold-factor-direction-expectations-v1");
  assert.equal(registry.research_only, true);
  assert.equal(assertExpectations(registry), true);
  assert.equal(registry.factors.length, 10);
  assert.equal(registry.factors.reduce((sum, factor) => sum + factor.weight, 0), 100);
  const index = buildExpectationIndex(registry);
  const direction = (variable, stateName) => index.lookup(variable, stateName).entry.expected_direction;
  assert.equal(direction("us_10y_real_yield_d5_bps", "positive"), "BEARISH");
  assert.equal(direction("us_10y_real_yield_d20_bps", "negative"), "BULLISH");
  assert.equal(direction("usd_broad_index_d1", "positive"), "BEARISH");
  assert.equal(direction("usd_broad_index_d5", "negative"), "BULLISH");
  assert.equal(direction("us_2y_d20_bps", "positive"), "BEARISH");
  assert.equal(direction("gold_d5_pct", "positive"), "BULLISH");
  assert.equal(direction("gold_d1_pct", "negative"), "BEARISH");
  assert.equal(direction("fed_bias", "hawkish"), "BEARISH");
  assert.equal(direction("fed_bias", "dovish"), "BULLISH");
  assert.equal(direction("inflation_signal", "positive"), "BULLISH");
  assert.equal(direction("risk_headline_context", "above_own_median"), "BULLISH");
  assert.equal(direction("risk_headline_context", "at_or_below_own_median"), "NEUTRAL");
  assert.equal(index.lookup("event_surprise", "some-family|positive").matched_by, "state_suffix");
  assert.equal(index.lookup("vix_level", "above_own_median").entry.expected_direction, null);
  assert.equal(index.lookup("vix_d5", "positive").entry.provenance, "not_declared");
  const levelStates = new Set(["above_own_median", "at_or_below_own_median"]);
  for (const entry of registry.states) {
    if (entry.provenance === "not_declared" || entry.factor === "F9") continue;
    assert.equal(levelStates.has(entry.state), false, `${entry.variable}|${entry.state} carries a direction on a level state`);
  }
  const mapped = new Set([
    ...registry.states.map(entry => entry.variable),
    ...registry.state_patterns.map(entry => entry.variable)
  ]);
  assert.equal(mapped.size, 28);
  assert.equal(registry.unmeasured_document_inputs.length, 5);
  assert.equal(registry.limits.length >= 3, true);
});

test("the printed table names the factor, its output, the expectation and the verdict", () => {
  const check = buildDirectionCheck(reportFixture(), registryFixture(), PARAMETERS);
  const lines = formatRows(check, PARAMETERS);
  assert.equal(lines[0].includes("gold-factor-direction-check-v1"), true);
  assert.equal(lines.some(line => line.includes("us_10y_real_yield_d5_bps") && line.includes("positive") && line.includes("inverted / inverted")), true);
  const rollup = formatRollup(check, PARAMETERS);
  assert.equal(rollup.some(line => line.includes("F1 Real Yield Direction")), true);
  const markdown = formatMarkdown(check, PARAMETERS);
  assert.equal(markdown.some(line => line.startsWith("| F1 Real Yield Direction | 22 |")), true);
  assert.equal(markdown.some(line => line.includes("level_band_not_declared")), true);
});
