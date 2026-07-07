#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { parseArgs } = require("../lib/historical_common");
const {
  CHECKER_PATHS,
  LAYER1_CONFIGS,
  classifyOutcomeDirection,
  computeComparablePctMove,
  roundNumber
} = require("../lib/factor_edge_lab");
const {
  buildShadowWeightPlan,
  buildComparisonStatus,
  classifyShadowDirection,
  classifyShadowResult,
  sampleWarning,
  summarizeShadowRows,
  sumWeightedSignals
} = require("../lib/phase2_shadow_backtest");

const DEFAULT_FACTOR_EDGE = path.resolve(__dirname, "../../data/factor-edge-lab.json");
const DEFAULT_OUTPUT = path.resolve(__dirname, "../../data/phase-2-shadow-backtest.json");
const VERSION = "phase2-shadow-backtest-v1";
const TIMEFRAME = "24H";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function layer1EntityKey(config) {
  return config.assetCode === "GOLD" ? "Gold" : config.assetCode;
}

function buildPairSupportLookup(factorEdgePayload = {}) {
  const lookup = new Map();
  const layer2Entries = Object.values(factorEdgePayload.layer2 || {});

  for (const entity of layer2Entries) {
    for (const factor of entity.factors || []) {
      const key = `${String(factor.source_asset || "").toUpperCase()}__${String(factor.factor_id || "")}`;
      const existing = lookup.get(key) || {
        weighted_reliability_sum: 0,
        directional_sample: 0
      };
      const reliability = Number(factor.weight_mismatch?.combined_factor_reliability_pct);
      const sample = Number(factor.weight_mismatch?.directional_sample || 0);
      if (Number.isFinite(reliability) && sample > 0) {
        existing.weighted_reliability_sum += reliability * sample;
        existing.directional_sample += sample;
      }
      lookup.set(key, existing);
    }
  }

  for (const [key, value] of lookup.entries()) {
    lookup.set(key, {
      average_reliability_pct: value.directional_sample
        ? roundNumber(value.weighted_reliability_sum / value.directional_sample, 1)
        : null,
      directional_sample: value.directional_sample
    });
  }

  return lookup;
}

function buildCombinationSupportMap(entity = {}) {
  const support = new Map();

  const absorb = (group = {}) => {
    for (const combination of group.combinations || []) {
      if (!Array.isArray(combination.factors)) continue;
      const delta = combination.review_label === "candidate_increase_weight"
        ? { positive: 1, negative: 0 }
        : (combination.review_label === "candidate_reduce_weight"
          ? { positive: 0, negative: 1 }
          : null);
      if (!delta) continue;

      for (const factor of combination.factors) {
        const key = String(factor.factor_id || "");
        const existing = support.get(key) || { positive_count: 0, negative_count: 0 };
        existing.positive_count += delta.positive;
        existing.negative_count += delta.negative;
        support.set(key, existing);
      }
    }
  };

  absorb(entity.factor_combinations?.two_factor || {});
  absorb(entity.factor_combinations?.three_factor || {});

  return support;
}

function buildOriginalRows(checkerRows = [], marketKey) {
  return checkerRows.map((row) => {
    const pctMove = computeComparablePctMove(row?.evaluation_inputs?.open_price, row?.evaluation_inputs?.close_price);
    const outcomeDirection = classifyOutcomeDirection(pctMove, marketKey);
    const storedDirection = row?.stored?.direction === "NO_CALL" ? null : row?.stored?.direction;
    return {
      prediction_id: row.prediction_id,
      snapshot_date: row.snapshot_date,
      direction: storedDirection,
      outcome_direction: outcomeDirection,
      result: classifyShadowResult(storedDirection, outcomeDirection)
    };
  });
}

function buildShadowRows(checkerRows = [], marketKey, weightPlan = []) {
  const weightPlanLookup = new Map(weightPlan.map((row) => [String(row.factor_id || ""), row]));

  return checkerRows.map((row) => {
    const pctMove = computeComparablePctMove(row?.evaluation_inputs?.open_price, row?.evaluation_inputs?.close_price);
    const outcomeDirection = classifyOutcomeDirection(pctMove, marketKey);
    const weightedSignals = sumWeightedSignals(row.factor_comparisons || [], weightPlanLookup);
    const shadowDirection = classifyShadowDirection(weightedSignals);
    return {
      prediction_id: row.prediction_id,
      snapshot_date: row.snapshot_date,
      direction: shadowDirection,
      outcome_direction: outcomeDirection,
      result: classifyShadowResult(shadowDirection, outcomeDirection),
      weighted_signals: {
        bullish_weight: roundNumber(weightedSignals.bullish_weight, 2),
        bearish_weight: roundNumber(weightedSignals.bearish_weight, 2),
        neutral_weight: roundNumber(weightedSignals.neutral_weight, 2)
      }
    };
  });
}

function comparisonPreviewRows(originalRows = [], shadowRows = []) {
  const preview = [];
  const shadowById = new Map(shadowRows.map((row) => [row.prediction_id, row]));

  for (const originalRow of originalRows) {
    const shadowRow = shadowById.get(originalRow.prediction_id);
    if (!shadowRow) continue;
    if (shadowRow.direction === originalRow.direction && shadowRow.result === originalRow.result) continue;
    preview.push({
      snapshot_date: originalRow.snapshot_date,
      prediction_id: originalRow.prediction_id,
      original_direction: originalRow.direction || "NO_CALL",
      shadow_direction: shadowRow.direction || "NO_CALL",
      original_result: originalRow.result,
      shadow_result: shadowRow.result,
      outcome_direction: shadowRow.outcome_direction || "NOT_EVALUABLE"
    });
    if (preview.length >= 12) break;
  }

  return preview;
}

function buildAssetPayload(config, checkerPayload, factorEdgePayload, pairSupportLookup) {
  const entityKey = layer1EntityKey(config);
  const entity = factorEdgePayload.layer1?.[entityKey];
  if (!entity) {
    throw new Error(`Missing Factor Edge entity for ${config.assetCode}`);
  }

  const checkerRows = Array.isArray(checkerPayload?.rows) ? checkerPayload.rows : [];
  const originalRows = buildOriginalRows(checkerRows, config.marketKey);
  const originalSummary = summarizeShadowRows(originalRows);
  const combinationSupport = buildCombinationSupportMap(entity);
  const pairSupportByFactor = new Map(
    (entity.factors || []).map((factor) => {
      const key = `${String(factor.source_asset || "").toUpperCase()}__${String(factor.factor_id || "")}`;
      return [String(factor.factor_id || ""), pairSupportLookup.get(key) || null];
    })
  );
  const weightPlan = buildShadowWeightPlan({
    factorRows: entity.factors || [],
    baselineExFlatWrPct: originalSummary.ex_flat_wr_pct,
    pairSupportByFactor,
    combinationSupportByFactor: combinationSupport
  });
  const shadowRows = buildShadowRows(checkerRows, config.marketKey, weightPlan);
  const shadowSummary = summarizeShadowRows(shadowRows);
  const comparison = buildComparisonStatus(originalSummary, shadowSummary);

  return {
    asset_code: config.assetCode,
    asset_label: config.assetLabel,
    timeframe: TIMEFRAME,
    outcome_market: entity.outcome_market || config.marketKey,
    date_range: entity.date_range || checkerPayload?.meta?.date_range || {},
    sample_warning: sampleWarning(shadowSummary),
    original_logic: originalSummary,
    shadow_logic: shadowSummary,
    comparison,
    weight_changes: weightPlan,
    changed_row_preview: comparisonPreviewRows(originalRows, shadowRows)
  };
}

function buildPayload(options = {}) {
  const factorEdgePath = path.resolve(options.factorEdgePath || DEFAULT_FACTOR_EDGE);
  const factorEdgePayload = readJson(factorEdgePath);
  const checkerPayloads = Object.fromEntries(
    LAYER1_CONFIGS.map((config) => [config.assetCode, readJson(CHECKER_PATHS[config.assetCode])])
  );
  const pairSupportLookup = buildPairSupportLookup(factorEdgePayload);
  const assets = Object.fromEntries(
    LAYER1_CONFIGS.map((config) => [
      config.assetCode,
      buildAssetPayload(config, checkerPayloads[config.assetCode], factorEdgePayload, pairSupportLookup)
    ])
  );

  const comparisons = Object.values(assets).map((asset) => asset.comparison);
  const overall = {
    assets_compared: Object.keys(assets).length,
    improved_assets: comparisons.filter((item) => item.status === "PASS").length,
    degraded_assets: comparisons.filter((item) => item.status === "FAIL").length,
    mixed_or_warn_assets: comparisons.filter((item) => item.status === "WARN").length,
    average_ex_flat_change_pct_points: comparisons.length
      ? roundNumber(comparisons.reduce((sum, item) => sum + (Number(item.ex_flat_change_pct_points) || 0), 0) / comparisons.length, 1)
      : null
  };

  return {
    generated_at: new Date().toISOString(),
    version: VERSION,
    timeframe: TIMEFRAME,
    methodology: {
      scope: "Research-only shadow logic. Live Layer 1 logic, live Layer 2 logic, replay source-of-truth files, checker outputs, and existing Factor Edge evidence calculations remain untouched.",
      shadow_engine: "The shadow model reuses stored checker factor signals and checker evaluation inputs, then reapplies only the factor weights using conservative evidence-based multipliers.",
      weight_formula: [
        "Factors remain unchanged unless they clear the main 30-row directional evidence gate.",
        "Increase candidates require agreement ex-flat win rate above the asset baseline, acceptable flat behavior, and supportive reliability labels.",
        "Reduce candidates are triggered by underperformance versus the asset baseline, weak reliability, poor flat behavior, or stronger contradiction than agreement.",
        "Pair-side support and same-asset combination support can only nudge the score by one step each; they do not override weak single-factor evidence.",
        "After multiplier adjustments, shadow weights are renormalized back to the original per-asset total weight so the shadow model stays conservative."
      ],
      shadow_decision_gate: [
        "No shadow call is issued unless directional weight clears a minimum active-weight gate.",
        "Tiny weight margins and weak dominant-share splits remain no-call in the shadow model to avoid overstating improvement."
      ],
      known_limitations: [
        "Current Phase 2 shadow backtest is limited to Layer 1 24H because that is the checked-in checker scope available for like-for-like comparison.",
        "Pair-side evidence is used only as a small auxiliary adjustment sourced from checked-in Factor Edge Layer 2 pair-side summaries; it does not create a separate live or shadow Layer 2 engine in this phase."
      ]
    },
    overall,
    assets
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputPath = path.resolve(args.output || DEFAULT_OUTPUT);
  const payload = buildPayload({
    factorEdgePath: args.factor_edge || DEFAULT_FACTOR_EDGE
  });

  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    output_path: outputPath,
    version: payload.version,
    timeframe: payload.timeframe,
    assets_compared: payload.overall.assets_compared,
    improved_assets: payload.overall.improved_assets,
    degraded_assets: payload.overall.degraded_assets,
    mixed_or_warn_assets: payload.overall.mixed_or_warn_assets
  }, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error("Phase 2 shadow backtest build failed.");
    console.error(error.stack || error.message || String(error));
    process.exit(1);
  }
}

module.exports = {
  buildCombinationSupportMap,
  buildPairSupportLookup,
  buildPayload
};
