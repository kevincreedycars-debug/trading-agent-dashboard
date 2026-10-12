"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { asOf, businessDaysBetween, history } = require("../lib/usd24h/features");
const { buildOutcome, nextAvailableDate } = require("../lib/usd24h/outcomes");
const { DEFAULT_GATES, evaluateRuleSet, ruleVote } = require("../lib/usd24h/rules");
const { scoreArm, wilsonInterval } = require("../lib/usd24h/metrics");
const { directionFromProbability, fitLogistic, predictLogistic } = require("../lib/usd24h/challenger");
const { PERIOD_ORDER, SPLITS, periodOf, rowsInPeriod } = require("../lib/usd24h/splits");
const { runConfig } = require("../lib/usd24h/experiments");
const { candidateCall, probabilityFromModel, shadowCompare } = require("../lib/usd24h/shadow_candidate");
const { featurePairs, pearson, quarterSignStability } = require("../lib/usd24h/research_cards");

const DATASET_PATH = path.resolve(__dirname, "../../data/usd-24h-research-dataset.json");
const CONFIG_PATH = path.resolve(__dirname, "../../config/usd_24h_ruleset_v2.json");

function seriesStore(key, lag, observations) {
  const store = new Map();
  store.set(key, { entry: { key, availability_lag_business_days: lag }, observations });
  return store;
}

function observation(date, value) {
  return { date, value };
}

test("as-of selection refuses a same-day observation under a one-business-day lag", () => {
  const store = seriesStore("vix_level", 1, [
    observation("2024-01-04", 14),
    observation("2024-01-05", 15),
    observation("2024-01-08", 16)
  ]);
  // Monday 2024-01-08 with lag 1 may only read Friday 2024-01-05.
  assert.equal(asOf(store, "vix_level", "2024-01-08").date, "2024-01-05");
  assert.equal(asOf(store, "vix_level", "2024-01-09").date, "2024-01-08");
  assert.equal(history(store, "vix_level", "2024-01-08", 5)[0].date, "2024-01-05");
  assert.equal(businessDaysBetween("2024-01-05", "2024-01-08"), 1);
});

test("a longer availability lag can never read a fresher observation than a shorter one", () => {
  const observations = [observation("2024-01-04", 101), observation("2024-01-05", 102), observation("2024-01-08", 103)];
  const fast = seriesStore("dxy_level_lag1", 1, observations);
  const slow = seriesStore("dxy_level", 2, observations);
  // Monday: the one-lag series may use Friday, the two-lag series may only use Thursday.
  assert.equal(asOf(fast, "dxy_level_lag1", "2024-01-08").date, "2024-01-05");
  assert.equal(asOf(slow, "dxy_level", "2024-01-08").date, "2024-01-04");
  // Tuesday: the one-lag series catches up to Monday, the two-lag series moves to Friday.
  assert.equal(asOf(fast, "dxy_level_lag1", "2024-01-09").date, "2024-01-08");
  assert.equal(asOf(slow, "dxy_level", "2024-01-09").date, "2024-01-05");
  // A lag longer than the stored history returns nothing rather than reusing the row date.
  assert.equal(asOf(seriesStore("dxy_level", 3, [observation("2024-01-08", 103)]), "dxy_level", "2024-01-09"), null);
});

test("the outcome window is the next session close and the flat band is 0.1pp", () => {
  const prices = new Map([
    ["2024-01-02", 119.2686],
    ["2024-01-03", 119.6958],
    ["2024-01-05", 119.3880],
    ["2024-01-08", 119.5]
  ]);
  const tuesday = buildOutcome("2024-01-02", prices);
  assert.equal(tuesday.scheduled_close_date, "2024-01-03");
  assert.equal(tuesday.open_price, 119.2686);
  assert.equal(tuesday.close_price, 119.6958);
  assert.equal(tuesday.pct_change, 0.358183);
  assert.equal(tuesday.market_outcome_direction, "BULLISH");
  assert.equal(tuesday.flat_threshold, 0.1);
  assert.ok(tuesday.measured_elapsed_hours > 24, "the following-24hrs window is a session close, not 24 elapsed hours");

  const friday = buildOutcome("2024-01-05", prices);
  assert.equal(friday.scheduled_close_date, "2024-01-08");
  assert.ok(friday.measured_elapsed_hours > 48, "a Friday call closes on Monday");
});

test("a missing scheduled close is recorded as a delayed endpoint, never as a same-day value", () => {
  const prices = new Map([
    ["2024-01-16", 120.1],
    ["2024-01-18", 120.4]
  ]);
  const outcome = buildOutcome("2024-01-16", prices);
  assert.equal(outcome.scheduled_close_date, "2024-01-17");
  assert.equal(outcome.close_date_used, "2024-01-18");
  assert.equal(outcome.endpoint_status, "delayed_offset_endpoint");
  assert.equal(nextAvailableDate(prices, "2024-01-17", 3), "2024-01-18");
  assert.equal(nextAvailableDate(prices, "2024-01-19", 3), null);
});

test("a rule abstains on a missing input and on a failed condition rather than voting zero", () => {
  const rule = {
    id: "test_rule",
    family: "test",
    feature: "vix_level",
    bullish: { comparator: "gte", threshold: 25 },
    bearish: { comparator: "lte", threshold: 16 },
    weight: 10,
    condition: null,
    status: "candidate"
  };
  assert.equal(ruleVote(rule, { vix_level: 30 }).vote, "BULLISH");
  assert.equal(ruleVote(rule, { vix_level: 12 }).vote, "BEARISH");
  assert.equal(ruleVote(rule, { vix_level: 20 }).vote, "NEUTRAL");
  assert.equal(ruleVote(rule, { vix_level: null }).vote, null);
  assert.equal(ruleVote({ ...rule, status: "not_evaluable" }, { vix_level: 30 }).vote, null);
  const gated = { ...rule, condition: { feature: "usd_vol20_pct", comparator: "gte", threshold: 1 } };
  assert.equal(ruleVote(gated, { vix_level: 30, usd_vol20_pct: 0.2 }).vote, null);
  assert.equal(ruleVote(gated, { vix_level: 30, usd_vol20_pct: 1.5 }).vote, "BULLISH");
});

test("the voting gates separate data coverage from participation and block a tie", () => {
  const rules = [
    { id: "a", family: "one", feature: "f1", bullish: { comparator: "gte", threshold: 1 }, bearish: { comparator: "lte", threshold: -1 }, weight: 10, condition: null, status: "candidate" },
    { id: "b", family: "two", feature: "f2", bullish: { comparator: "gte", threshold: 1 }, bearish: { comparator: "lte", threshold: -1 }, weight: 10, condition: null, status: "candidate" },
    { id: "c", family: "three", feature: "f3", bullish: { comparator: "gte", threshold: 1 }, bearish: { comparator: "lte", threshold: -1 }, weight: 10, condition: null, status: "candidate" },
    { id: "d", family: "four", feature: "f4", bullish: { comparator: "gte", threshold: 1 }, bearish: { comparator: "lte", threshold: -1 }, weight: 10, condition: null, status: "not_evaluable" }
  ];
  const ruleSet = { rules, weights: {}, gates: { ...DEFAULT_GATES } };

  const conflict = evaluateRuleSet(ruleSet, { f1: 2, f2: -2, f3: 2, f4: 2 });
  assert.equal(conflict.direction, "NO_CLEAR_BIAS");
  assert.equal(conflict.direction_reason, "critical_conflict", "twenty points against ten is a critical conflict");
  assert.equal(conflict.coverage_pct, 75, "an unavailable rule costs input coverage, not participation");
  assert.equal(conflict.participation_pct, 75);
  assert.equal(conflict.blocked_weight, 10);

  const agreed = evaluateRuleSet(ruleSet, { f1: 2, f2: 2, f3: 2, f4: 2 });
  assert.equal(agreed.direction, "BULLISH");
  assert.equal(agreed.winning_families, 3);

  const tooFew = evaluateRuleSet({ rules, weights: {}, gates: { ...DEFAULT_GATES, min_winning_families: 4 } }, { f1: 2, f2: 2, f3: 2, f4: 2 });
  assert.equal(tooFew.direction, "NO_CLEAR_BIAS");
  assert.equal(tooFew.direction_reason, "too_few_winning_families");

  const thinCoverage = evaluateRuleSet({ rules, weights: {}, gates: { ...DEFAULT_GATES, min_coverage_pct: 90 } }, { f1: 2, f2: 2, f3: 2, f4: 2 });
  assert.equal(thinCoverage.direction, "NO_CLEAR_BIAS");
  assert.equal(thinCoverage.direction_reason, "insufficient_input_coverage");
});

test("scoring discloses every denominator and never counts an unknown direction as a call", () => {
  const rows = [
    { snapshot_date: "2024-01-02", outcome: { evaluable: true, market_outcome_direction: "BULLISH", pct_change: 0.5 } },
    { snapshot_date: "2024-01-03", outcome: { evaluable: true, market_outcome_direction: "BEARISH", pct_change: -0.4 } },
    { snapshot_date: "2024-01-04", outcome: { evaluable: true, market_outcome_direction: "FLAT", pct_change: 0.05 } },
    { snapshot_date: "2024-01-05", outcome: { evaluable: false, market_outcome_direction: null, pct_change: null } }
  ];
  const metrics = scoreArm(rows, new Map([
    ["2024-01-02", { direction: "BULLISH" }],
    ["2024-01-03", { direction: "BULLISH" }],
    ["2024-01-04", { direction: "BULLISH" }],
    ["2024-01-05", { direction: "NOT_A_DIRECTION" }]
  ]));
  assert.equal(metrics.scheduled, 4);
  assert.equal(metrics.directional_calls, 3);
  assert.equal(metrics.correct, 1);
  assert.equal(metrics.wrong, 1);
  assert.equal(metrics.flat, 1);
  assert.equal(metrics.not_evaluable, 1);
  assert.equal(metrics.ex_flat_accuracy_pct, 50);
  assert.equal(metrics.accuracy_all_directional_calls_pct, 33.33);
  const interval = wilsonInterval(1, 2);
  assert.ok(interval.low < 50 && interval.high > 50);
});

test("the chronological periods partition the dataset with no gap or overlap", () => {
  const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, "utf8"));
  let seen = 0;
  for (const period of PERIOD_ORDER) {
    const rows = rowsInPeriod(dataset.rows, period);
    seen += rows.length;
    for (const row of rows) assert.equal(periodOf(row.snapshot_date), period);
  }
  assert.equal(seen, dataset.rows.length);
  assert.ok(SPLITS.dev.end < SPLITS.validation.start);
  assert.ok(SPLITS.validation.end < SPLITS.holdout.start);
});

test("the committed dataset never reads an observation that the cutoff could not have seen", () => {
  const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, "utf8"));
  const ordered = dataset.rows.map((row) => row.snapshot_date);
  assert.deepEqual(ordered, ordered.slice().sort(), "rows must be in chronological order");
  for (const row of dataset.rows) {
    for (const [key, date] of Object.entries(row.provenance)) {
      const observed = String(date).slice(0, 10);
      assert.ok(observed <= row.snapshot_date, `${key} observation ${observed} is later than the row date ${row.snapshot_date}`);
    }
    // The two dollar series used for features are lagged; neither may be same-day.
    assert.notEqual(row.provenance.dxy_level, row.snapshot_date);
    assert.notEqual(row.provenance.dxy_level_lag1, row.snapshot_date);
    assert.ok(row.outcome.open_price > 0);
    if (row.outcome.evaluable) {
      assert.ok(row.outcome.close_price > 0);
      assert.ok(row.outcome.measured_elapsed_hours >= 24);
    } else {
      assert.equal(row.outcome.endpoint_status, "unavailable");
      assert.equal(row.outcome.close_price, null);
    }
  }
  const first = dataset.rows[0];
  assert.equal(first.snapshot_date, "2024-01-02");
  assert.equal(first.outcome.open_price, 119.2686);
  assert.equal(first.outcome.market_outcome_direction, "BULLISH");
});

test("a configuration is deterministic and development-tuned weights never read later rows", () => {
  const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, "utf8"));
  const config = {
    id: "dev_tuned_probe",
    kind: "rule_set",
    description: "probe",
    rules: [
      { id: "r1", family: "one", feature: "usd_ret_5d", bullish: { comparator: "lte", threshold: -0.5 }, bearish: { comparator: "gte", threshold: 0.5 }, weight: 8, condition: null, status: "candidate" }
    ],
    weights: "dev_tuned",
    gates: { min_coverage_pct: 0, min_participation_pct: 0, min_absolute_score_points: 0, min_winning_families: 1, require_no_critical_conflict: false }
  };
  const firstRun = runConfig(config, dataset);
  const secondRun = runConfig(config, dataset);
  assert.deepEqual(firstRun.metrics, secondRun.metrics);
  assert.deepEqual(firstRun.weights, secondRun.weights);

  // Flipping every post-development outcome must not change the development-tuned weights.
  const tampered = {
    ...dataset,
    rows: dataset.rows.map((row) => (row.snapshot_date <= SPLITS.dev.end
      ? row
      : { ...row, outcome: { ...row.outcome, market_outcome_direction: row.outcome.market_outcome_direction === "BULLISH" ? "BEARISH" : "BULLISH" } }))
  };
  const tamperedRun = runConfig(config, tampered);
  assert.deepEqual(tamperedRun.weights, firstRun.weights);
});

test("the logistic challenger fits a separable training period and abstains on a missing feature", () => {
  const rows = [
    { snapshot_date: "2024-01-02", features: { x: 2 }, outcome: { evaluable: true, market_outcome_direction: "BULLISH" } },
    { snapshot_date: "2024-01-03", features: { x: 1.5 }, outcome: { evaluable: true, market_outcome_direction: "BULLISH" } },
    { snapshot_date: "2024-01-04", features: { x: -1.5 }, outcome: { evaluable: true, market_outcome_direction: "BEARISH" } },
    { snapshot_date: "2024-01-05", features: { x: -2 }, outcome: { evaluable: true, market_outcome_direction: "BEARISH" } },
    { snapshot_date: "2024-01-08", features: { x: 0.2 }, outcome: { evaluable: true, market_outcome_direction: "FLAT" } }
  ];
  const model = fitLogistic(rows, ["x"], { lambda: 0.01 });
  assert.equal(model.fitted_rows, 4, "flat rows are excluded from fitting");
  assert.equal(model.excluded_flat_rows, 1);
  assert.ok(model.weights[0] > 0);
  assert.ok(predictLogistic(model, { x: 2 }) > 0.5);
  assert.ok(predictLogistic(model, { x: -2 }) < 0.5);
  assert.equal(predictLogistic(model, { x: null }), null);
  assert.equal(directionFromProbability(null).direction, "NO_CLEAR_BIAS");
  assert.equal(directionFromProbability(0.6, 0.5).direction, "BULLISH");
});

test("the published candidate executes from its configuration file and abstains without its inputs", () => {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  assert.equal(config.status, "CANDIDATE_SHADOW_ONLY");
  assert.equal(config.production_enabled, false);
  assert.equal(config.probability.published, false, "no probability is published without a passing calibration");
  const model = config.model_execution;
  const features = {};
  model.feature_names.forEach((name, index) => { features[name] = model.standardisation_means[index]; });
  const probability = probabilityFromModel(model, features);
  assert.ok(probability > 0 && probability < 1);
  assert.ok(Math.abs(probability - 1 / (1 + Math.exp(-model.intercept))) < 1e-9, "at the means the score equals the intercept");

  const row = { snapshot_date: "2024-01-02", features: { ...features, [model.feature_names[0]]: null } };
  const call = candidateCall(config, row);
  assert.equal(call.direction, "NO_CLEAR_BIAS");
  assert.equal(call.reason, "missing_required_feature");
});

test("the shadow comparison is reproducible and states that nothing live was touched", () => {
  const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, "utf8"));
  const first = shadowCompare(dataset);
  const second = shadowCompare(dataset);
  assert.deepEqual(first.records, second.records);
  assert.deepEqual(first.candidate_metrics, second.candidate_metrics);
  assert.equal(first.live_shadow_deployed, false);
  assert.equal(first.mode, "offline_shadow_replay");
  assert.equal(first.records.length, first.window_rows);
  for (const record of first.records) {
    assert.ok(["CORRECT", "WRONG", "FLAT", "NO_CALL", "NOT_EVALUABLE"].includes(record.candidate_result));
    assert.ok(record.close_date_used >= record.snapshot_date);
  }
  assert.equal(first.candidate_metrics.holdout.directional_calls + first.candidate_metrics.holdout.no_clear_bias + first.candidate_metrics.holdout.not_evaluable, first.window_rows);
});

test("a shadow comparison reads its candidate from a supplied configuration file", () => {
  const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, "utf8"));
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const inverted = {
    ...config,
    model_execution: { ...config.model_execution, coefficients: config.model_execution.coefficients.map((value) => -value), intercept: -config.model_execution.intercept }
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "usd24h-shadow-"));
  const configPath = path.join(dir, "candidate.json");
  fs.writeFileSync(configPath, JSON.stringify(inverted), "utf8");
  const straight = shadowCompare(dataset);
  const flipped = shadowCompare(dataset, { configPath });
  const flippedDirections = flipped.records.map((record) => record.candidate_direction);
  const straightDirections = straight.records.map((record) => record.candidate_direction);
  assert.notDeepEqual(flippedDirections, straightDirections);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the timing contrast separates a feature's own window from the next one", () => {
  const rows = [];
  for (let index = 0; index < 14; index += 1) {
    const day = String(index + 2).padStart(2, "0");
    rows.push({
      snapshot_date: `2024-01-${day}`,
      features: { f: index },
      outcome: { evaluable: true, pct_change: index + 1 }
    });
  }
  const { forward, trailing } = featurePairs(rows, "f");
  assert.equal(forward.length, 13);
  assert.equal(trailing.length, 13);
  assert.equal(pearson(forward).r, 1, "a feature that rises with the forward return is perfectly correlated");
  assert.equal(pearson(trailing).r, 1);
  const stability = quarterSignStability(rows, "f");
  assert.equal(stability.quarters, 1);
  assert.equal(stability.positive_quarters, 1);
});
