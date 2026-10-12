"use strict";

/**
 * Offline shadow evaluation of the frozen USD candidate.
 *
 * The candidate is read from `config/usd_24h_ruleset_v2.json` and executed here exactly as the
 * versioned configuration describes it: a standardised logistic score with the recorded coefficients.
 * The comparison runs the candidate and the deployed engine's stored calls over the same untouched
 * holdout rows.
 *
 * This is not a live shadow deployment: no workflow, dispatcher, dashboard or database is touched.
 */

const fs = require("node:fs");
const path = require("node:path");

const { archiveEngineCalls } = require("./engine_arm");
const { scoreArm } = require("./metrics");
const { SPLITS, rowsInPeriod } = require("./splits");

const DEFAULT_CONFIG_PATH = path.resolve(__dirname, "../../../config/usd_24h_ruleset_v2.json");

function loadCandidateConfig(configPath = DEFAULT_CONFIG_PATH) {
  const resolved = path.resolve(configPath);
  return { path: resolved, config: JSON.parse(fs.readFileSync(resolved, "utf8")) };
}

function sigmoid(value) {
  if (value >= 0) {
    const z = Math.exp(-value);
    return 1 / (1 + z);
  }
  const z = Math.exp(value);
  return z / (1 + z);
}

/** Executes the versioned model block exactly as published. */
function probabilityFromModel(model, features) {
  const values = model.feature_names.map((name) => features[name]);
  if (values.some((value) => !Number.isFinite(value))) return null;
  const standardised = values.map((value, index) =>
    (value - model.standardisation_means[index]) / model.standardisation_standard_deviations[index]);
  const linear = standardised.reduce((total, value, index) => total + value * model.coefficients[index], model.intercept);
  return sigmoid(linear);
}

/** Candidate call for one row: direction plus the quantities a shadow record should carry. */
function candidateCall(config, row) {
  const model = config.model_execution;
  if (!model) return { direction: "NO_CLEAR_BIAS", reason: "candidate_has_no_model_block" };
  const probability = probabilityFromModel(model, row.features);
  if (probability === null) {
    return {
      direction: "NO_CLEAR_BIAS",
      reason: "missing_required_feature",
      required_features: model.feature_names
    };
  }
  const threshold = Number.isFinite(model.decision_threshold) ? model.decision_threshold : 0.5;
  return {
    direction: probability >= threshold ? "BULLISH" : "BEARISH",
    reason: probability >= threshold ? "probability_at_or_above_threshold" : "probability_below_threshold",
    probability_up_24h: Number(probability.toFixed(4)),
    probability_published: config.probability?.published === true,
    threshold_used: threshold
  };
}

/** Runs the candidate and the deployed engine over the shadow window and tabulates the comparison. */
function shadowCompare(dataset, options = {}) {
  const { path: configPath, config } = loadCandidateConfig(options.configPath);
  const window = options.window || SPLITS.holdout;
  const rows = dataset.rows.filter((row) => row.snapshot_date >= window.start && row.snapshot_date <= window.end);
  const engine = archiveEngineCalls(dataset).calls;

  const candidateCalls = new Map();
  const records = [];
  for (const row of rows) {
    const call = candidateCall(config, row);
    candidateCalls.set(row.snapshot_date, call);
    const engineCall = engine.get(row.snapshot_date) || { direction: null };
    const market = row.outcome.evaluable ? row.outcome.market_outcome_direction : null;
    const grade = (direction) => {
      if (!row.outcome.evaluable) return "NOT_EVALUABLE";
      if (!direction || direction === "NO_CLEAR_BIAS") return "NO_CALL";
      if (market === "FLAT") return "FLAT";
      return direction === market ? "CORRECT" : "WRONG";
    };
    records.push({
      snapshot_date: row.snapshot_date,
      market_outcome_direction: market,
      market_pct_change: row.outcome.pct_change,
      close_date_used: row.outcome.close_date_used,
      candidate_direction: call.direction,
      candidate_probability_up_24h: call.probability_up_24h ?? null,
      candidate_result: grade(call.direction),
      engine_direction: engineCall.direction || null,
      engine_result: grade(engineCall.direction || null),
      agreement: call.direction === engineCall.direction,
      candidate_reason: call.reason
    });
  }

  const candidateMetrics = {};
  const engineMetrics = {};
  for (const period of Object.keys(SPLITS)) {
    const periodRows = rowsInPeriod(dataset.rows, period);
    candidateMetrics[period] = scoreArm(periodRows, candidateCalls);
    engineMetrics[period] = scoreArm(periodRows, engine);
  }

  const disagreeing = records.filter((record) => record.agreement === false);
  const candidateOnlyCorrect = disagreeing.filter((record) => record.candidate_result === "CORRECT" && record.engine_result === "WRONG").length;
  const engineOnlyCorrect = disagreeing.filter((record) => record.engine_result === "CORRECT" && record.candidate_result === "WRONG").length;

  return {
    schema_version: "usd-24h-shadow-comparison-v1",
    generated_at: new Date().toISOString(),
    mode: "offline_shadow_replay",
    live_shadow_deployed: false,
    config_path: path.relative(path.resolve(__dirname, "../../.."), configPath).replace(/\\/g, "/"),
    config_status: config.status,
    window,
    window_rows: rows.length,
    candidate_metrics: candidateMetrics,
    engine_metrics: engineMetrics,
    disagreement: {
      days_disagreeing: disagreeing.length,
      candidate_only_correct: candidateOnlyCorrect,
      engine_only_correct: engineOnlyCorrect,
      margin_for_candidate: candidateOnlyCorrect - engineOnlyCorrect
    },
    records,
    boundaries: [
      "No live workflow, dispatcher, dashboard, database or credential was touched by this comparison.",
      "The candidate is executed from the versioned configuration file, not from n8n.",
      "Agreement counts are descriptive; the deciding evidence is the holdout accuracy and its interval."
    ]
  };
}

module.exports = {
  DEFAULT_CONFIG_PATH,
  candidateCall,
  loadCandidateConfig,
  probabilityFromModel,
  shadowCompare,
  sigmoid
};
