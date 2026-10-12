#!/usr/bin/env node
"use strict";

/**
 * Chronological selection for the USD 24-hour ruleset.
 *
 * The filters, the ranking key and the evidence classification are declared here and applied in that
 * order, so the holdout is read once by a procedure that was fixed before it was read. The output is
 * the versioned candidate configuration plus the full selection table.
 *
 * Usage:
 *   node backtester/scripts/select_usd_24h_ruleset.js [--dataset=PATH] [--registry=PATH] [--baselines=PATH] [--config=PATH] [--out=PATH]
 */

const fs = require("node:fs");
const path = require("node:path");

const { parseArgs } = require("../lib/historical_common");
const { sha256 } = require("../lib/usd24h/acquire");
const { buildSearchSpace, callsForConfig, devTunedWeights, loadDataset } = require("../lib/usd24h/experiments");
const { fitLogistic } = require("../lib/usd24h/challenger");
const { scoreArm, scoreProbabilityArm } = require("../lib/usd24h/metrics");
const { RULES } = require("../lib/usd24h/rules");
const { SPLITS, rowsInPeriod } = require("../lib/usd24h/splits");

const DEFAULT_DATASET = path.resolve(__dirname, "../../data/usd-24h-research-dataset.json");
const DEFAULT_REGISTRY = path.resolve(__dirname, "../../data/usd-24h-experiment-registry.json");
const DEFAULT_BASELINES = path.resolve(__dirname, "../../data/usd-24h-baseline-comparison.json");
const DEFAULT_CONFIG = path.resolve(__dirname, "../../config/usd_24h_ruleset_v2.json");
const DEFAULT_OUT = path.resolve(__dirname, "../../data/usd-24h-selection.json");

/** Declared selection filters. A configuration must pass all of them to be a "selected" candidate. */
const SELECTION_FILTERS = Object.freeze({
  min_validation_directional_coverage_pct: 60,
  min_validation_decided: 100,
  min_validation_lower_bound_pct: 48,
  min_validation_stable_quarter_accuracy_pct: 40,
  max_abs_dev_validation_gap_pct: 12
});

/**
 * Second declared tier, used only when nothing passes the filters above. It still refuses arms whose
 * validation sample is too small to rank, which is what stops a two-dozen-call arm from winning the
 * table on a noisy point estimate.
 */
const REDUCED_FILTERS = Object.freeze({
  min_validation_directional_coverage_pct: 40,
  min_validation_decided: 60,
  min_validation_lower_bound_pct: 45,
  max_abs_dev_validation_gap_pct: 20
});

const EVIDENCE_RULES = Object.freeze({
  improvement_demonstrated: "holdout ex-flat accuracy lower bound above the engine arm's holdout point estimate, holdout point estimate at or above 55 percent, and at least 100 decided holdout calls",
  uncertain: "the winner's holdout lower bound does not clear the engine arm, or the decided sample is smaller than 100",
  not_supported: "the winner's holdout point estimate is at or below the engine arm's"
});

function passesFilters(result) {
  const validation = result.metrics.validation;
  const dev = result.metrics.dev;
  const gap = dev.ex_flat_accuracy_pct === null || validation.ex_flat_accuracy_pct === null
    ? null
    : Math.abs(dev.ex_flat_accuracy_pct - validation.ex_flat_accuracy_pct);
  return {
    validation_directional_coverage_pct: validation.directional_coverage_pct,
    validation_decided: validation.correct + validation.wrong,
    validation_lower_bound_pct: validation.ex_flat_accuracy_ci_95.low,
    validation_min_stable_quarter_accuracy_pct: validation.min_stable_quarter_accuracy_pct,
    dev_validation_gap_pct: gap === null ? null : Number(gap.toFixed(2)),
    passes: validation.directional_coverage_pct !== null &&
      validation.directional_coverage_pct >= SELECTION_FILTERS.min_validation_directional_coverage_pct &&
      (validation.correct + validation.wrong) >= SELECTION_FILTERS.min_validation_decided &&
      validation.ex_flat_accuracy_ci_95.low !== null &&
      validation.ex_flat_accuracy_ci_95.low >= SELECTION_FILTERS.min_validation_lower_bound_pct &&
      validation.min_stable_quarter_accuracy_pct !== null &&
      validation.min_stable_quarter_accuracy_pct >= SELECTION_FILTERS.min_validation_stable_quarter_accuracy_pct &&
      gap !== null &&
      gap <= SELECTION_FILTERS.max_abs_dev_validation_gap_pct
  };
}

/** Reduced-tier check, applied only when no configuration passes the full filters. */
function passesReducedFilters(result) {
  const validation = result.metrics.validation;
  const dev = result.metrics.dev;
  const gap = dev.ex_flat_accuracy_pct === null || validation.ex_flat_accuracy_pct === null
    ? null
    : Math.abs(dev.ex_flat_accuracy_pct - validation.ex_flat_accuracy_pct);
  return {
    validation_directional_coverage_pct: validation.directional_coverage_pct,
    validation_decided: validation.correct + validation.wrong,
    validation_lower_bound_pct: validation.ex_flat_accuracy_ci_95.low,
    dev_validation_gap_pct: gap === null ? null : Number(gap.toFixed(2)),
    passes: validation.directional_coverage_pct !== null &&
      validation.directional_coverage_pct >= REDUCED_FILTERS.min_validation_directional_coverage_pct &&
      (validation.correct + validation.wrong) >= REDUCED_FILTERS.min_validation_decided &&
      validation.ex_flat_accuracy_ci_95.low !== null &&
      validation.ex_flat_accuracy_ci_95.low >= REDUCED_FILTERS.min_validation_lower_bound_pct &&
      gap !== null &&
      gap <= REDUCED_FILTERS.max_abs_dev_validation_gap_pct
  };
}

/** Platt scaling on development probabilities only. */
function fitPlatt(probabilities, devRows) {
  const usable = devRows
    .map((row) => ({ p: probabilities.get(row.snapshot_date), y: row.outcome.market_outcome_direction }))
    .filter((entry) => entry.p !== null && entry.p !== undefined && entry.y !== "FLAT" && row_outcome_defined(entry.y))
    .map((entry) => ({ x: Math.log(entry.p / (1 - entry.p)), y: entry.y === "BULLISH" ? 1 : 0 }));
  if (!usable.length) return null;
  let a = 1;
  let b = 0;
  const learningRate = 0.05;
  for (let step = 0; step < 2000; step += 1) {
    let gradientA = 0;
    let gradientB = 0;
    for (const entry of usable) {
      const predicted = 1 / (1 + Math.exp(-(a * entry.x + b)));
      const error = predicted - entry.y;
      gradientA += error * entry.x;
      gradientB += error;
    }
    a -= (learningRate * gradientA) / usable.length;
    b -= (learningRate * gradientB) / usable.length;
  }
  return { a, b, fitted_rows: usable.length };
}

function row_outcome_defined(direction) {
  return direction === "BULLISH" || direction === "BEARISH";
}

function applyPlatt(model, probability) {
  if (!model || probability === null || probability === undefined) return null;
  const x = Math.log(probability / (1 - probability));
  return 1 / (1 + Math.exp(-(model.a * x + model.b)));
}

/** Constant base-rate Brier score on the supplied rows, the honest calibration floor. */
function baseRateBrier(rows) {
  const decided = rows.filter((row) => row.outcome.evaluable && row.outcome.market_outcome_direction !== "FLAT");
  if (!decided.length) return null;
  const upShare = decided.filter((row) => row.outcome.market_outcome_direction === "BULLISH").length / decided.length;
  return Number((upShare * (1 - upShare)).toFixed(4));
}

function buildConfigById(configId) {
  const config = buildSearchSpace().find((entry) => entry.id === configId);
  if (!config) throw new Error(`Unknown configuration: ${configId}`);
  return config;
}

/** Re-derives the selected arm's calls, resolving development-tuned weights the same way the runner does. */
function evaluateSelectedArm(config, dataset) {
  const weights = config.weights === "dev_tuned" ? devTunedWeights(config, dataset.rows) : config.weights;
  return callsForConfig({ ...config, weights: weights || null }, dataset.rows);
}

function buildConfigPayload(winner, selection, dataset, registry) {
  const config = buildConfigById(winner.config_id);
  const selectedModel = winner.kind === "challenger"
    ? fitLogistic(rowsInPeriod(dataset.rows, "dev"), winner.params.features, { lambda: winner.params.lambda })
    : null;
  const ruleIds = winner.rules || [];
  const ruleDefinitions = ruleIds
    .map((id) => RULES.find((rule) => rule.id === id))
    .filter(Boolean)
    .map((rule) => ({
      id: rule.id,
      family: rule.family,
      feature: rule.feature,
      bullish: rule.bullish,
      bearish: rule.bearish,
      weight: winner.weights && Object.prototype.hasOwnProperty.call(winner.weights, rule.id) ? winner.weights[rule.id] : rule.weight,
      condition: rule.condition,
      status: rule.status,
      rationale: rule.rationale
    }));

  return {
    schema_version: "usd-24h-ruleset-v2",
    created_at: new Date().toISOString(),
    status: "CANDIDATE_SHADOW_ONLY",
    production_enabled: false,
    trade_eligible: false,
    scope: {
      asset: "USD",
      horizon: "following 24hrs",
      outcome_instrument: "FRED DTWEXBGS (the series the live collector stores as dxy_level)",
      daily_cutoff: "09:30 ET on each trading day",
      endpoint: "16:00 ET close of the next valid trading session",
      flat_band_percentage_points: 0.1,
      engines_modified: ["USD"],
      other_engines: "UNTOUCHED"
    },
    strength_labels: {
      engine_strength_label: selection.evidence_classification === "improvement_demonstrated" ? "DEMONSTRATED" : "NOT_DEMONSTRATED",
      headline_strength_label: selection.evidence_classification === "improvement_demonstrated"
        ? "SUPPORTED_ON_HOLDOUT"
        : selection.evidence_classification === "uncertain"
          ? "UNCERTAIN"
          : "NOT_SUPPORTED",
      note: "The engine label describes whether this asset's rules are evidenced better than the deployed engine; the headline label describes how much confidence a published call may carry. They are deliberately different names."
    },
    selected_config_id: winner.config_id,
    selected_from_filter_survivors: selection.selected_from_survivors,
    decision_arm: {
      kind: winner.kind,
      description: winner.description,
      parameters: config.params,
      weights: winner.weights,
      gates: winner.gates,
      threshold_used: winner.threshold_used
    },
    rules: ruleDefinitions,
    model_execution: selectedModel
      ? {
          feature_names: selectedModel.feature_names,
          standardisation_means: selectedModel.means,
          standardisation_standard_deviations: selectedModel.standard_deviations,
          coefficients: selectedModel.weights,
          intercept: selectedModel.intercept,
          decision_threshold: winner.threshold_used,
          fitted_rows: selectedModel.fitted_rows,
          fitted_period: "dev",
          excluded_flat_rows: selectedModel.excluded_flat_rows,
          direction_rule: "BULLISH when P(up) is at or above the threshold, BEARISH below it, NO_CLEAR_BIAS when a required feature is missing"
        }
      : null,
    probability: {
      field: "p_up_24h",
      published: selection.calibration.probability_published,
      reason: selection.calibration.reason,
      calibration_record: selection.calibration.probability_published ? selection.calibration : null
    },
    evidence: {
      selection_sha256: sha256(JSON.stringify(selection)),
      dataset_sha256: selection.dataset_sha256,
      registry_sha256: selection.registry_sha256,
      splits: selection.splits,
      metrics: winner.metrics,
      engine_comparison: selection.comparison_to_engine_holdout,
      evidence_classification: selection.evidence_classification,
      registry_size: registry.configurations_attempted
    },
    release_blockers: [
      "PROSPECTIVE_SHADOW_RESULT_PENDING",
      "EVENT_AND_FED_FAMILIES_UNAVAILABLE",
      "OPERATIONAL_PARITY_NOT_ESTABLISHED_FOR_NEW_INPUTS",
      "TRADING_EDGE_NOT_ASSESSED"
    ],
    note: "Candidate configuration, not a deployment artefact. It consumes only repository data, is not wired into the live workflow, and may only be published after the shadow comparison and a separate deployment authorisation."
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const datasetPath = args.dataset ? path.resolve(args.dataset) : DEFAULT_DATASET;
  const registryPath = args.registry ? path.resolve(args.registry) : DEFAULT_REGISTRY;
  const baselinesPath = args.baselines ? path.resolve(args.baselines) : DEFAULT_BASELINES;
  const configPath = args.config ? path.resolve(args.config) : DEFAULT_CONFIG;
  const outPath = args.out ? path.resolve(args.out) : DEFAULT_OUT;

  const dataset = loadDataset(datasetPath);
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const baselines = JSON.parse(fs.readFileSync(baselinesPath, "utf8"));
  const engineArm = baselines.arms.engine_stored_archive;

  // Benchmarks are reported but never selected: they exist to be beaten, not to become the ruleset.
  const candidatePool = registry.results.filter((result) => !String(result.config_id).startsWith("baseline_"));
  const benchmarkPool = registry.results.filter((result) => String(result.config_id).startsWith("baseline_"));
  const evaluated = candidatePool.map((result) => ({ result, filters: passesFilters(result) }));
  const survivors = evaluated.filter((entry) => entry.filters.passes);
  const reduced = evaluated.map((entry) => ({ ...entry, reduced_filters: passesReducedFilters(entry.result) }));
  const reducedSurvivors = reduced.filter((entry) => entry.reduced_filters.passes);
  const selectionTier = survivors.length ? "tier_1_full_filters" : reducedSurvivors.length ? "tier_2_reduced_filters" : "tier_3_rank_only_insufficient_sample";
  const ranked = (survivors.length ? survivors : reducedSurvivors.length ? reducedSurvivors : evaluated)
    .slice()
    .sort((left, right) => {
      const leftLower = left.result.metrics.validation.ex_flat_accuracy_ci_95.low ?? -1;
      const rightLower = right.result.metrics.validation.ex_flat_accuracy_ci_95.low ?? -1;
      if (rightLower !== leftLower) return rightLower - leftLower;
      const leftDecided = left.result.metrics.validation.correct + left.result.metrics.validation.wrong;
      const rightDecided = right.result.metrics.validation.correct + right.result.metrics.validation.wrong;
      return rightDecided - leftDecided;
    });

  const winner = ranked[0].result;
  const holdout = winner.metrics.holdout;
  const engineHoldout = engineArm.metrics.holdout;

  let evidence = "not_supported";
  if (holdout.ex_flat_accuracy_ci_95.low !== null &&
      holdout.ex_flat_accuracy_ci_95.low > (engineHoldout.ex_flat_accuracy_pct ?? 0) &&
      (holdout.ex_flat_accuracy_pct ?? 0) >= 55 &&
      (holdout.correct + holdout.wrong) >= 100) {
    evidence = "improvement_demonstrated";
  } else if ((holdout.ex_flat_accuracy_pct ?? 0) > (engineHoldout.ex_flat_accuracy_pct ?? 0)) {
    evidence = "uncertain";
  }

  // Probability publication is decided by calibration on validation, never by the direction result.
  let calibration = {
    probability_published: false,
    reason: "The selected arm publishes a direction only, so there is no probability to calibrate."
  };
  if (winner.kind === "challenger") {
    const armCalls = evaluateSelectedArm(buildConfigById(winner.config_id), dataset);
    const platt = fitPlatt(armCalls.probabilities, rowsInPeriod(dataset.rows, "dev"));
    const calibrated = new Map();
    for (const [date, probability] of armCalls.probabilities) calibrated.set(date, applyPlatt(platt, probability));
    const rawValidation = scoreProbabilityArm(rowsInPeriod(dataset.rows, "validation"), armCalls.probabilities);
    const calibratedValidation = scoreProbabilityArm(rowsInPeriod(dataset.rows, "validation"), calibrated);
    const baseRateValidation = baseRateBrier(rowsInPeriod(dataset.rows, "validation"));
    const publish = platt !== null &&
      calibratedValidation.brier_score !== null &&
      calibratedValidation.brier_score < rawValidation.brier_score &&
      calibratedValidation.brier_score < baseRateValidation;
    calibration = {
      probability_published: publish,
      method: publish ? "platt_scaling_fitted_on_development" : null,
      platt_model: platt,
      raw_validation: rawValidation,
      calibrated_validation: calibratedValidation,
      base_rate_brier_validation: baseRateValidation,
      reason: publish
        ? "Calibrated validation Brier score beats both the raw challenger and the constant base rate."
        : "Calibration does not beat the constant base rate on validation, so no probability is published."
    };
  }

  const selection = {
    schema_version: "usd-24h-selection-v1",
    generated_at: new Date().toISOString(),
    dataset_sha256: sha256(fs.readFileSync(datasetPath, "utf8")),
    registry_sha256: sha256(fs.readFileSync(registryPath, "utf8")),
    splits: SPLITS,
    selection_filters: SELECTION_FILTERS,
    reduced_filters: REDUCED_FILTERS,
    selection_tier: selectionTier,
    evidence_rules: EVIDENCE_RULES,
    configurations_evaluated: registry.results.length,
    candidate_pool_size: candidatePool.length,
    filter_pass_count: survivors.length,
    reduced_filter_pass_count: reducedSurvivors.length,
    ranking_key: "validation ex-flat accuracy Wilson lower bound, then validation decided count",
    top_10_by_declared_ranking: ranked.slice(0, 10).map((entry) => ({
      config_id: entry.result.config_id,
      passes_filters: entry.filters.passes,
      passes_reduced_filters: entry.reduced_filters ? entry.reduced_filters.passes : null,
      filters: entry.filters,
      dev: entry.result.metrics.dev.ex_flat_accuracy_pct,
      validation: entry.result.metrics.validation.ex_flat_accuracy_pct,
      validation_lower_bound: entry.result.metrics.validation.ex_flat_accuracy_ci_95.low,
      validation_decided: entry.result.metrics.validation.correct + entry.result.metrics.validation.wrong,
      holdout: entry.result.metrics.holdout.ex_flat_accuracy_pct,
      holdout_decided: entry.result.metrics.holdout.correct + entry.result.metrics.holdout.wrong
    })),
    selected_config_id: winner.config_id,
    selected_from_survivors: survivors.length > 0,
    selected_arm: {
      kind: winner.kind,
      description: winner.description,
      rules: winner.rules,
      weights: winner.weights,
      gates: winner.gates,
      threshold_used: winner.threshold_used,
      metrics: winner.metrics
    },
    evidence_classification: evidence,
    calibration,
    benchmark_arms: benchmarkPool.map((result) => ({
      config_id: result.config_id,
      dev: result.metrics.dev.ex_flat_accuracy_pct,
      validation: result.metrics.validation.ex_flat_accuracy_pct,
      holdout: result.metrics.holdout.ex_flat_accuracy_pct,
      holdout_coverage_pct: result.metrics.holdout.directional_coverage_pct
    })),
    benchmark_note: "Benchmarks are scored on the same rows as the candidates. The five-day contrarian benchmark is the strongest single arm in this run and is why improvement is not claimed: the candidate rules have to beat a benchmark that needs no research.",
    comparison_to_engine_holdout: {
      engine_id: "engine_stored_archive",
      engine_holdout_ex_flat_accuracy_pct: engineHoldout.ex_flat_accuracy_pct,
      engine_holdout_ci_95: engineHoldout.ex_flat_accuracy_ci_95,
      candidate_holdout_ex_flat_accuracy_pct: holdout.ex_flat_accuracy_pct,
      candidate_holdout_ci_95: holdout.ex_flat_accuracy_ci_95,
      candidate_holdout_decided: holdout.correct + holdout.wrong,
      target_60_percent_met: (holdout.ex_flat_accuracy_ci_95.low ?? 0) > 60
    }
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(selection, null, 2)}\n`, "utf8");

  const configPayload = buildConfigPayload(winner, selection, dataset, registry);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(configPayload, null, 2)}\n`, "utf8");

  process.stdout.write(`evaluated=${registry.results.length} survivors=${survivors.length} selected=${winner.config_id}\n`);
  process.stdout.write(`selected dev=${winner.metrics.dev.ex_flat_accuracy_pct} validation=${winner.metrics.validation.ex_flat_accuracy_pct} holdout=${holdout.ex_flat_accuracy_pct} decided=${holdout.correct + holdout.wrong}\n`);
  process.stdout.write(`evidence=${evidence} probability_published=${calibration.probability_published}\n`);
  process.stdout.write(`selection: ${outPath}\nconfig: ${configPath}\n`);
}

main();
