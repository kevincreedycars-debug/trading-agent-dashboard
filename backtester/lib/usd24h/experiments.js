"use strict";

/**
 * Experiment definitions and the local comparison runner.
 *
 * One dataset is loaded once; every configuration is scored from it, so no experiment performs a
 * download or a model call. Single-rule arms come first, then family arms, then the composite
 * weightings, threshold and conditioning variants, and finally the regularised logistic challenger.
 */

const crypto = require("node:crypto");
const { fork } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { fitLogistic, predictLogistic, directionFromProbability } = require("./challenger");
const { scoreArm, scoreProbabilityArm } = require("./metrics");
const { DEFAULT_GATES, RULES, evaluateRuleSet, ruleVote } = require("./rules");
const { PERIOD_ORDER, rowsInPeriod } = require("./splits");

const CHALLENGER_FEATURES = Object.freeze([
  "usd_ret_1d",
  "usd_ret_5d",
  "usd_ma20_dist_pct",
  "usd_vol20_pct",
  "vix_level",
  "vix_ret_5d",
  "vix_pctile_252",
  "us_2y_chg_5d_bps",
  "us_10y_chg_5d_bps",
  "us_de_2y_spread_chg_5d_bps",
  "de_2y_chg_5d_bps",
  "us_10y_real_chg_5d_bps",
  "credit_spread_chg_5d_bps",
  "nq_ret_5d",
  "gold_ret_5d",
  "eurusd_ret_5d",
  "wti_ret_5d"
]);

const SINGLE_RULE_GATES = Object.freeze({
  min_coverage_pct: 0,
  min_participation_pct: 0,
  min_absolute_score_points: 0,
  min_winning_families: 1,
  require_no_critical_conflict: false
});

const ENGINE_ALIGNED_WEIGHTS = Object.freeze({
  // Live 24h vector: F5 14, F1 10, F9 1, F3 10, F4 10, F8 12, F6 4, F10 1. F2 14 and F7 24 are not
  // reproduced here: F2 is the same 2Y change already carried by the Fed-repricing family, and F7's
  // input is unavailable, so neither consumes directional budget.
  usd_mom_1d_cont: 7,
  usd_mom_5d_cont: 7,
  usd_mom_5d_fade: 0,
  usd_trend_ma20_cont: 4,
  risk_vix_level_haven: 8,
  risk_vix_chg_5d: 2,
  risk_vix_pctile: 1,
  risk_credit_spread_chg: 3,
  rel_us_2y_chg5d: 5,
  rel_us_de_2y_spread_chg5d: 5,
  rel_de_2y_chg5d: 3,
  rel_us_10y_chg5d: 2,
  real_10y_chg5d: 5,
  real_10y_chg20d: 3,
  real_5y_chg5d: 2,
  real_breakeven_chg5d: 1,
  fed_dovish_repricing_5d: 6,
  fed_repricing_20d: 4,
  fed_effr_minus_3m: 2,
  fed_funding_stress: 1,
  xasset_gold_5d_inverse: 4,
  xasset_equity_5d_regime: 1,
  xasset_eurusd_confirm: 2,
  xasset_wti_5d_growth: 1
});

function candidateRules() {
  return RULES.filter((rule) => rule.status === "candidate");
}

function rulesForFamily(family) {
  return candidateRules().filter((rule) => rule.family === family);
}

function ruleSetsEqualWeights(rules) {
  const weights = {};
  for (const rule of rules) weights[rule.id] = rule.weight;
  return weights;
}

function configHash(config) {
  const stable = JSON.stringify(config, Object.keys(config).sort());
  return crypto.createHash("sha256").update(stable).digest("hex");
}

function withThreshold(rule, factor) {
  const scale = (condition) => ({ ...condition, threshold: Number((condition.threshold * factor).toFixed(4)) });
  return {
    ...rule,
    id: `${rule.id}_t${factor}x`,
    bullish: scale(rule.bullish),
    bearish: scale(rule.bearish),
    rationale: `${rule.rationale} Threshold multiplied by ${factor}.`
  };
}

function withCondition(rule, condition, suffix) {
  return {
    ...rule,
    id: `${rule.id}_${suffix}`,
    condition,
    rationale: `${rule.rationale} Gated on ${condition.feature} ${condition.comparator} ${condition.threshold}.`
  };
}

function withReversedDirection(rule) {
  return {
    ...rule,
    id: `${rule.id}_reversed`,
    bullish: rule.bearish,
    bearish: rule.bullish,
    rationale: `${rule.rationale} Direction reversed as an explicit counter-hypothesis.`
  };
}

/** Declares every configuration that this study is allowed to try, with its provenance. */
function buildSearchSpace() {
  const configs = [];
  const candidates = candidateRules();

  configs.push({
    id: "baseline_always_bullish",
    kind: "static",
    description: "Majority-direction benchmark: every evaluable day called bullish.",
    params: { direction: "BULLISH" }
  });
  configs.push({
    id: "baseline_always_bearish",
    kind: "static",
    description: "Minority-direction benchmark: every evaluable day called bearish.",
    params: { direction: "BEARISH" }
  });
  for (const [feature, label] of [["usd_ret_1d", "one-day"], ["usd_ret_5d", "five-day"], ["usd_ret_20d", "twenty-day"]]) {
    configs.push({
      id: `baseline_momentum_${feature}`,
      kind: "static_feature",
      description: `${label} dollar momentum benchmark: follow the trailing return's sign.`,
      params: { feature, invert: false }
    });
    configs.push({
      id: `baseline_contrarian_${feature}`,
      kind: "static_feature",
      description: `${label} dollar mean-reversion benchmark: fade the trailing return's sign.`,
      params: { feature, invert: true }
    });
  }

  for (const rule of candidates) {
    configs.push({
      id: `single_${rule.id}`,
      kind: "rule_set",
      description: `Single-rule arm: ${rule.rationale}`,
      rules: [rule],
      weights: {},
      gates: { ...SINGLE_RULE_GATES },
      params: { family: rule.family, stage: "individual_factors" }
    });
  }

  const families = Array.from(new Set(candidates.map((rule) => rule.family)));
  for (const family of families) {
    const rules = rulesForFamily(family);
    configs.push({
      id: `family_${family}`,
      kind: "rule_set",
      description: `Family arm: ${family} rules on their declared weights.`,
      rules,
      weights: ruleSetsEqualWeights(rules),
      gates: { ...SINGLE_RULE_GATES },
      params: { family, stage: "within_family" }
    });
  }

  configs.push({
    id: "composite_equal_weights",
    kind: "rule_set",
    description: "All evaluable candidate rules on their declared weights with the full gates.",
    rules: candidates,
    weights: ruleSetsEqualWeights(candidates),
    gates: { ...DEFAULT_GATES },
    params: { stage: "combinations" }
  });
  configs.push({
    id: "composite_engine_aligned_weights",
    kind: "rule_set",
    description: "Same rules, weights redistributed to follow the live 24h factor budget by family.",
    rules: candidates,
    weights: { ...ENGINE_ALIGNED_WEIGHTS },
    gates: { ...DEFAULT_GATES },
    params: { stage: "combinations" }
  });
  configs.push({
    id: "composite_dev_tuned_weights",
    kind: "rule_set",
    description: "Weights set from development-period single-rule lift only, never from later periods.",
    rules: candidates,
    weights: "dev_tuned",
    gates: { ...DEFAULT_GATES },
    params: { stage: "combinations", tuning: "dev_single_rule_lift" }
  });
  for (const [id, weightsLabel] of [
    ["composite_engine_weights_fade", "fade"],
    ["composite_engine_weights_no_fade", "no_fade"]
  ]) {
    const rules = weightsLabel === "fade"
      ? candidates.map((rule) => (rule.id === "usd_mom_5d_cont" ? withReversedDirection(rule) : rule))
      : candidates.filter((rule) => rule.id !== "usd_mom_5d_fade");
    configs.push({
      id,
      kind: "rule_set",
      description: weightsLabel === "fade"
        ? "Engine-aligned weights with the five-day momentum rule replaced by its fade version."
        : "Engine-aligned weights with the fade rule removed from the budget entirely.",
      rules,
      weights: { ...ENGINE_ALIGNED_WEIGHTS },
      gates: { ...DEFAULT_GATES },
      params: { stage: "combinations" }
    });
  }
  const thriftyRules = [
    "usd_mom_1d_cont",
    "usd_mom_5d_cont",
    "rel_us_2y_chg5d",
    "rel_us_de_2y_spread_chg5d",
    "real_10y_chg5d",
    "xasset_gold_5d_inverse"
  ];
  for (const ruleId of thriftyRules) {
    const rule = candidates.find((entry) => entry.id === ruleId);
    for (const factor of [0.5, 2]) {
      configs.push({
        id: `single_${ruleId}_t${factor}x`,
        kind: "rule_set",
        description: `Threshold sensitivity: ${ruleId} with its trigger multiplied by ${factor}.`,
        rules: [withThreshold(rule, factor)],
        weights: {},
        gates: { ...SINGLE_RULE_GATES },
        params: { stage: "thresholds_and_lookbacks", base_rule: ruleId, threshold_factor: factor }
      });
      configs.push({
        id: `composite_engine_weights_${ruleId}_t${factor}x`,
        kind: "rule_set",
        description: `Composite with ${ruleId} re-thresholded at ${factor}x, all other weights unchanged.`,
        rules: candidates.map((entry) => (entry.id === ruleId ? withThreshold(entry, factor) : entry)),
        weights: { ...ENGINE_ALIGNED_WEIGHTS },
        gates: { ...DEFAULT_GATES },
        params: { stage: "thresholds_and_lookbacks", base_rule: ruleId, threshold_factor: factor }
      });
    }
  }

  for (const ruleId of ["rel_us_2y_chg5d", "rel_us_de_2y_spread_chg5d", "xasset_gold_5d_inverse", "real_10y_chg5d"]) {
    const rule = candidates.find((entry) => entry.id === ruleId);
    configs.push({
      id: `single_${ruleId}_reversed`,
      kind: "rule_set",
      description: `Counter-hypothesis: ${ruleId} with its direction reversed.`,
      rules: [withReversedDirection(rule)],
      weights: {},
      gates: { ...SINGLE_RULE_GATES },
      params: { stage: "counter_hypotheses", base_rule: ruleId }
    });
  }

  // Availability sensitivity: the same momentum hypotheses read from a one-lag dollar series.
  const lagVariants = [
    { base: "usd_mom_1d_cont", feature: "usd_lag1_ret_1d", suffix: "lag1" },
    { base: "usd_mom_1d_cont", feature: "usd_lag1_ret_1d", suffix: "lag1_fade", invert: true },
    { base: "usd_mom_5d_cont", feature: "usd_lag1_ret_5d", suffix: "lag1" },
    { base: "usd_mom_5d_cont", feature: "usd_lag1_ret_5d", suffix: "lag1_fade", invert: true },
    { base: "usd_trend_ma20_cont", feature: "usd_lag1_ma20_dist_pct", suffix: "lag1" }
  ];
  for (const variant of lagVariants) {
    const rule = candidates.find((entry) => entry.id === variant.base);
    const swapped = variant.invert
      ? withReversedDirection({ ...rule, feature: variant.feature, id: `${variant.base}_${variant.suffix}` })
      : { ...rule, feature: variant.feature, id: `${variant.base}_${variant.suffix}` };
    configs.push({
      id: `single_${swapped.id}`,
      kind: "rule_set",
      description: `Availability sensitivity: ${variant.base} re-read from the one-business-day-lag dollar series (${variant.invert ? "direction reversed" : "same direction"}).`,
      rules: [swapped],
      weights: {},
      gates: { ...SINGLE_RULE_GATES },
      params: { stage: "availability_sensitivity", base_rule: variant.base, feature_variant: variant.feature }
    });
    configs.push({
      id: `composite_engine_weights_${swapped.id}`,
      kind: "rule_set",
      description: `Composite with the momentum rule re-read from the one-lag dollar series.`,
      rules: candidates.map((entry) => (entry.id === variant.base ? swapped : entry)),
      weights: { ...ENGINE_ALIGNED_WEIGHTS },
      gates: { ...DEFAULT_GATES },
      params: { stage: "availability_sensitivity", base_rule: variant.base, feature_variant: variant.feature }
    });
  }

  const conditioned = [
    { ruleId: "rel_us_2y_chg5d", condition: { feature: "usd_vol20_pct", comparator: "lte", threshold: 0.5 }, suffix: "cond_lowvol" },
    { ruleId: "rel_us_2y_chg5d", condition: { feature: "usd_vol20_pct", comparator: "gte", threshold: 0.5 }, suffix: "cond_highvol" },
    { ruleId: "xasset_gold_5d_inverse", condition: { feature: "vix_level", comparator: "gte", threshold: 20 }, suffix: "cond_hi_vix" },
    { ruleId: "risk_credit_spread_chg", condition: { feature: "vix_level", comparator: "lte", threshold: 20 }, suffix: "cond_low_vix" }
  ];
  for (const entry of conditioned) {
    const rule = candidates.find((candidate) => candidate.id === entry.ruleId);
    configs.push({
      id: `single_${entry.ruleId}_${entry.suffix}`,
      kind: "rule_set",
      description: `Conditional variant: ${entry.ruleId} gated on ${entry.condition.feature} ${entry.condition.comparator} ${entry.condition.threshold}.`,
      rules: [withCondition(rule, entry.condition, entry.suffix)],
      weights: {},
      gates: { ...SINGLE_RULE_GATES },
      params: { stage: "conditional_rules", base_rule: entry.ruleId, condition: entry.condition }
    });
  }
  for (const entry of conditioned.slice(0, 2)) {
    const rule = candidates.find((candidate) => candidate.id === entry.ruleId);
    configs.push({
      id: `composite_engine_weights_${entry.ruleId}_${entry.suffix}`,
      kind: "rule_set",
      description: `Composite with ${entry.ruleId} gated on ${entry.condition.feature} ${entry.condition.comparator} ${entry.condition.threshold}.`,
      rules: candidates.map((candidate) => (candidate.id === entry.ruleId ? withCondition(candidate, entry.condition, entry.suffix) : candidate)),
      weights: { ...ENGINE_ALIGNED_WEIGHTS },
      gates: { ...DEFAULT_GATES },
      params: { stage: "conditional_rules", base_rule: entry.ruleId, condition: entry.condition }
    });
  }

  for (const [id, gates] of [
    ["composite_engine_aligned_weights_reduced_gates", { min_coverage_pct: 40, min_participation_pct: 10, min_absolute_score_points: 4, min_winning_families: 1, require_no_critical_conflict: false }],
    ["composite_equal_weights_reduced_gates", { min_coverage_pct: 40, min_participation_pct: 10, min_absolute_score_points: 4, min_winning_families: 1, require_no_critical_conflict: false }]
  ]) {
    const weights = id.includes("engine_aligned") ? { ...ENGINE_ALIGNED_WEIGHTS } : ruleSetsEqualWeights(candidates);
    configs.push({
      id,
      kind: "rule_set",
      description: "Composite with the directional gates relaxed, kept separate so a coverage-driven no-call is not read as a modelling result.",
      rules: candidates,
      weights,
      gates,
      params: { stage: "gates_sensitivity" }
    });
  }

  for (const lambda of [0.03, 0.1, 0.3]) {
    configs.push({
      id: `challenger_logistic_l2_${lambda}`,
      kind: "challenger",
      description: `L2 logistic challenger (lambda ${lambda}) on ${CHALLENGER_FEATURES.length} standardised features, fitted on development rows only.`,
      params: { lambda, threshold: 0.5, features: CHALLENGER_FEATURES, stage: "statistical_challenger" }
    });
  }
  configs.push({
    id: "challenger_logistic_l2_0.1_threshold_dev_tuned",
    kind: "challenger",
    description: "Same challenger with its probability threshold chosen on the development period only.",
    params: { lambda: 0.1, threshold: "dev_tuned", features: CHALLENGER_FEATURES, stage: "statistical_challenger" }
  });

  return configs;
}

/**
 * Weights fitted on development rows only: proportional to the rule's absolute development-period
 * lift over a coin flip, and zero when that lift is negative. Direction is never fitted, so a rule
 * that is confidently wrong on development is dropped rather than flipped.
 */
function devTunedWeights(config, rows) {
  const devRows = rowsInPeriod(rows, "dev");
  const weights = {};
  for (const rule of config.rules) {
    const calls = new Map();
    for (const row of devRows) {
      const outcome = ruleVote(rule, row.features);
      if (outcome.vote === "BULLISH" || outcome.vote === "BEARISH") {
        calls.set(row.snapshot_date, { direction: outcome.vote });
      }
    }
    const metrics = scoreArm(devRows, calls);
    const lift = (metrics.ex_flat_accuracy_pct || 0) - 50;
    weights[rule.id] = Math.max(0, Number((lift / 2).toFixed(2)));
  }
  return weights;
}

function callsForStatic(config, rows) {
  const calls = new Map();
  for (const row of rows) calls.set(row.snapshot_date, { direction: config.params.direction });
  return { calls, probabilities: null, model: null };
}

function callsForFeature(config, rows) {
  const calls = new Map();
  for (const row of rows) {
    const value = row.features[config.params.feature];
    let direction = null;
    if (Number.isFinite(value)) {
      const raw = value >= 0 ? "BULLISH" : "BEARISH";
      direction = config.params.invert ? (raw === "BULLISH" ? "BEARISH" : "BULLISH") : raw;
    }
    calls.set(row.snapshot_date, { direction });
  }
  return { calls, probabilities: null, model: null };
}

function callsForRuleSet(config, rows) {
  const calls = new Map();
  for (const row of rows) {
    const outcome = evaluateRuleSet(config, row.features);
    calls.set(row.snapshot_date, {
      direction: outcome.direction,
      coverage_pct: outcome.coverage_pct,
      participation_pct: outcome.participation_pct,
      net_edge_pct: outcome.net_edge_pct,
      bull_weight: outcome.bull_weight,
      bear_weight: outcome.bear_weight,
      reason: outcome.direction_reason
    });
  }
  return { calls, probabilities: null, model: null };
}

function callsForChallenger(config, rows) {
  const params = config.params;
  const model = fitLogistic(rowsInPeriod(rows, "dev"), params.features, {
    lambda: params.lambda,
    learning_rate: params.learning_rate,
    iterations: params.iterations
  });
  const probabilities = new Map();
  const calls = new Map();
  const development = rowsInPeriod(rows, "dev");
  const probabilityByDevelopmentRow = development.map((row) => ({ date: row.snapshot_date, probability: predictLogistic(model, row.features) }));

  let threshold = params.threshold;
  if (threshold === "dev_tuned") {
    // Choose the cut on development rows only, maximising ex-flat development accuracy.
    let best = { threshold: 0.5, accuracy: -1 };
    for (let candidate = 0.35; candidate <= 0.65001; candidate += 0.01) {
      const candidateCalls = new Map();
      for (const entry of probabilityByDevelopmentRow) {
        if (entry.probability === null) continue;
        candidateCalls.set(entry.date, { direction: directionFromProbability(entry.probability, candidate).direction });
      }
      const accuracy = scoreArm(development, candidateCalls).ex_flat_accuracy_pct ?? -1;
      if (accuracy > best.accuracy) best = { threshold: Number(candidate.toFixed(2)), accuracy };
    }
    threshold = best.threshold;
  }

  for (const row of rows) {
    const probability = predictLogistic(model, row.features);
    probabilities.set(row.snapshot_date, probability);
    const decision = probability === null
      ? { direction: "NO_CLEAR_BIAS" }
      : directionFromProbability(probability, threshold);
    calls.set(row.snapshot_date, { direction: decision.direction, probability, reason: decision.reason });
  }
  return { calls, probabilities, model, threshold_used: threshold };
}

/** Builds the calls for one configuration. Nothing leaves this function except derived series. */
function callsForConfig(config, rows) {
  if (config.kind === "static") return callsForStatic(config, rows);
  if (config.kind === "static_feature") return callsForFeature(config, rows);
  if (config.kind === "challenger") return callsForChallenger(config, rows);
  if (config.kind === "rule_set") return callsForRuleSet(config, rows);
  throw new Error(`Unsupported configuration kind: ${config.kind}`);
}

/** Scores one configuration on every chronological period and returns a registry-friendly record. */
function runConfig(config, dataset) {
  const rows = dataset.rows;
  const weights = config.weights === "dev_tuned" ? devTunedWeights(config, rows) : config.weights;
  const effective = { ...config, weights: weights || null };
  const { calls, probabilities, model, threshold_used: thresholdUsed } = callsForConfig(effective, rows);

  const metrics = {};
  for (const period of PERIOD_ORDER) {
    metrics[period] = scoreArm(rowsInPeriod(rows, period), calls);
  }
  const probabilityMetrics = probabilities
    ? Object.fromEntries(PERIOD_ORDER.map((period) => [period, scoreProbabilityArm(rowsInPeriod(rows, period), probabilities)]))
    : null;

  return {
    config_id: config.id,
    kind: config.kind,
    description: config.description,
    stage: config.params?.stage || null,
    params: config.params || null,
    rules: (config.rules || []).map((rule) => rule.id),
    weights: effective.weights,
    gates: config.gates || null,
    config_sha256: configHash(config),
    threshold_used: thresholdUsed ?? null,
    model_summary: model
      ? {
          fitted_rows: model.fitted_rows,
          excluded_flat_rows: model.excluded_flat_rows,
          hyperparameters: model.hyperparameters,
          feature_coefficients: Object.fromEntries(model.feature_names.map((name, index) => [name, Number(model.weights[index].toFixed(4))]))
        }
      : null,
    metrics,
    probability_metrics: probabilityMetrics
  };
}

function loadDataset(datasetPath) {
  return JSON.parse(fs.readFileSync(datasetPath, "utf8"));
}

/**
 * Runs every configuration against one dataset. With more than one worker the configurations are
 * split across forked Node processes, so the numerical comparison is local, parallel and free of any
 * network or model call.
 */
async function runExperiments(configs, options = {}) {
  const datasetPath = path.resolve(options.datasetPath);
  const workerScript = path.resolve(options.workerScript || path.join(__dirname, "../../scripts/run_usd_24h_experiments_worker.js"));
  const workerCount = Math.max(1, Math.min(Number(options.workers || 1), configs.length));
  const startedAt = Date.now();

  if (workerCount === 1) {
    const dataset = loadDataset(datasetPath);
    return {
      results: configs.map((config) => runConfig(config, dataset)),
      worker_count: 1,
      duration_ms: Date.now() - startedAt
    };
  }

  const chunks = Array.from({ length: workerCount }, () => []);
  configs.forEach((config, index) => chunks[index % workerCount].push(config));
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "usd24h-experiments-"));
  const jobs = chunks
    .filter((chunk) => chunk.length)
    .map((chunk, index) => {
      const jobPath = path.join(tmpDir, `job-${index}.json`);
      const outPath = path.join(tmpDir, `out-${index}.json`);
      fs.writeFileSync(jobPath, JSON.stringify(chunk), "utf8");
      return { outPath, child: fork(workerScript, [datasetPath, jobPath, outPath], { stdio: ["ignore", "pipe", "pipe", "ipc"] }) };
    });

  const failures = [];
  await Promise.all(jobs.map((job) => new Promise((resolve, reject) => {
    let stderr = "";
    job.child.stderr.on("data", (data) => { stderr += String(data); });
    job.child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Experiment worker exited with code ${code}: ${stderr.slice(-400)}`));
    });
    job.child.on("error", reject);
  }))).catch((error) => { failures.push(error.message); });

  if (failures.length) throw new Error(failures.join("; "));

  const results = [];
  for (const job of jobs) {
    results.push(...JSON.parse(fs.readFileSync(job.outPath, "utf8")));
  }
  const order = new Map(configs.map((config, index) => [config.id, index]));
  results.sort((left, right) => (order.get(left.config_id) ?? 0) - (order.get(right.config_id) ?? 0));

  return { results, worker_count: workerCount, duration_ms: Date.now() - startedAt };
}

module.exports = {
  CHALLENGER_FEATURES,
  ENGINE_ALIGNED_WEIGHTS,
  SINGLE_RULE_GATES,
  buildSearchSpace,
  callsForConfig,
  candidateRules,
  configHash,
  devTunedWeights,
  loadDataset,
  ruleSetsEqualWeights,
  runConfig,
  runExperiments,
  withCondition,
  withReversedDirection,
  withThreshold
};
