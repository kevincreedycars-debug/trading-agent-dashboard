#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { parseArgs } = require("../lib/historical_common");
const {
  CHECKER_PATHS,
  LAYER1_CONFIGS,
  LAYER2_CONFIGS,
  buildAlignmentStats,
  buildFactorProfile,
  buildNeutralStats,
  buildStateStats,
  buildWeightMismatch,
  classifyCombinationReliability,
  classifyOutcomeDirection,
  classifySampleSize,
  computeComparablePctMove,
  derivePairCallDirection,
  factorDefinitionIndex,
  invertDirection,
  interpretCombinationReliability,
  normalizeDirection,
  roundNumber,
  signalFromFactorComparison,
  strongestFactorBy,
  toNumber,
  weightFromFactorComparison
} = require("../lib/factor_edge_lab");

const DEFAULT_OUTPUT = path.resolve(__dirname, "../../data/factor-edge-lab.json");
const VERSION = "phase2-factor-edge-lab-v1";
const PRIMARY_METRIC = "ex_flat_wr";
const TIMEFRAME = "24H";
const ADR_L2L_BLOCKER = "Checked-in data/adr-reach-research.json does not expose full per-prediction factor-joinable rows; only summaries and samples are exported, so factor-level ADR/L2L joins are unavailable from repo-local artifacts alone.";
const COMBINATION_CONFIG = Object.freeze({
  two_factor: Object.freeze({
    size: 2,
    minimum_sample_count: 12,
    exploratory_sample_count: 6
  }),
  three_factor: Object.freeze({
    size: 3,
    minimum_sample_count: 18,
    exploratory_sample_count: 8
  })
});
const RELIABLE_FACTOR_SAMPLE_MIN = 30;
const RELIABLE_COMBINATION_SAMPLE_MIN = 12;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function checkerRowsByAsset() {
  return Object.fromEntries(Object.entries(CHECKER_PATHS).map(([assetCode, filePath]) => [assetCode, readJson(filePath)]));
}

function minDate(values) {
  return values.length ? values.slice().sort()[0] : null;
}

function maxDate(values) {
  return values.length ? values.slice().sort()[values.length - 1] : null;
}

function comparableDirectionFromPctMove(pctMove, marketKey) {
  const direction = classifyOutcomeDirection(pctMove, marketKey);
  return direction === "BULLISH" || direction === "BEARISH" || direction === "FLAT" ? direction : null;
}

function createAdrL2lUnavailableBlock() {
  return {
    available: false,
    blocker: ADR_L2L_BLOCKER
  };
}

function topItems(items = [], scoreSelector, limit = 3, minimumScore = null) {
  return items
    .map((item) => ({ item, score: scoreSelector(item) }))
    .filter((entry) => Number.isFinite(entry.score) && (minimumScore === null || entry.score >= minimumScore))
    .sort((left, right) => (
      right.score - left.score
      || String(left.item.factor_id || left.item.factor_ids?.join("|") || "").localeCompare(String(right.item.factor_id || right.item.factor_ids?.join("|") || ""))
    ))
    .slice(0, limit)
    .map((entry) => entry.item);
}

function buildLowSampleWarning({
  singleFactors = [],
  combinationGroups = []
}) {
  const insufficientFactors = singleFactors.filter((factor) => (factor.weight_mismatch?.directional_sample || 0) < RELIABLE_FACTOR_SAMPLE_MIN).length;
  const exploratoryCombinations = combinationGroups.reduce((sum, group) => sum + (group?.exploratory_combination_count || 0), 0);
  const unavailableCombinations = combinationGroups.reduce((sum, group) => sum + (group?.unavailable_low_sample_count || 0), 0);

  return {
    insufficient_single_factor_count: insufficientFactors,
    exploratory_combination_count: exploratoryCombinations,
    unavailable_combination_count: unavailableCombinations,
    label: insufficientFactors || exploratoryCombinations || unavailableCombinations
      ? "low_sample_review_caution"
      : "sample_coverage_acceptable"
  };
}

function classifyFactorReviewLabel(factor) {
  const sample = factor.weight_mismatch?.directional_sample || 0;
  const reliability = factor.weight_mismatch?.combined_factor_reliability_pct;
  const originalWeight = factor.original_weight;
  const interpretation = factor.weight_mismatch?.suggested_interpretation || factor.suggested_interpretation;

  if (sample < RELIABLE_FACTOR_SAMPLE_MIN || !Number.isFinite(reliability)) return "insufficient_evidence";
  if (interpretation === "low_weight_but_strong_realised_evidence" || interpretation === "asymmetric_directional_factor") return "contradiction_edge_possible_hidden_predictor";
  if (interpretation === "high_weight_but_negative_realised_evidence" || reliability < 48) return "candidate_reduce_weight";
  if (reliability >= 65 && Number.isFinite(originalWeight) && originalWeight <= 10) return "candidate_increase_weight";
  if (reliability >= 58 && Number.isFinite(originalWeight) && originalWeight <= 14) return "candidate_increase_weight";
  if (reliability >= 52) return "confirmation_only_factor";
  return "insufficient_evidence";
}

function classifyCombinationReviewLabel(combination) {
  const sample = combination.sample_count || 0;
  const reliabilityLabel = combination.reliability_label;
  const reliability = combination.ex_flat_wr_pct;

  if (reliabilityLabel === "unavailable_low_sample" || sample < RELIABLE_COMBINATION_SAMPLE_MIN) return "insufficient_evidence";
  if (String(reliabilityLabel).startsWith("exploratory")) return "insufficient_evidence";
  if (reliabilityLabel === "negative_evidence") return "candidate_reduce_weight";
  if (reliabilityLabel === "strong_positive_evidence" || (reliabilityLabel === "moderate_positive_evidence" && reliability >= 58)) return "candidate_increase_weight";
  if (reliabilityLabel === "weak_positive_evidence" || reliabilityLabel === "no_edge") return "confirmation_only_factor";
  return "insufficient_evidence";
}

function labelFactorForReview(factor) {
  return {
    ...factor,
    review_label: classifyFactorReviewLabel(factor)
  };
}

function labelCombinationForReview(combination) {
  return {
    ...combination,
    review_label: classifyCombinationReviewLabel(combination)
  };
}

function pairEdgeCarrierLabel(pairSideAnalysis = {}) {
  const baseScore = pairSideAnalysis.base_side?.summary?.average_combined_factor_reliability_pct;
  const usdScore = pairSideAnalysis.quote_usd_side?.summary?.average_combined_factor_reliability_pct;
  if (!Number.isFinite(baseScore) || !Number.isFinite(usdScore)) return "mixed_or_insufficient_side_evidence";
  if (baseScore >= usdScore + 4) return "mostly_base_side";
  if (usdScore >= baseScore + 4) return "mostly_usd_side";
  return "mixed";
}

function buildTopEvidenceSummary({
  factors = [],
  combinationAnalysis = null,
  pairSideAnalysis = null,
  baseSideCombinations = null,
  usdSideCombinations = null
}) {
  const strongestReliableSingleFactors = topItems(
    factors.filter((factor) => factor.review_label === "candidate_increase_weight" || factor.review_label === "confirmation_only_factor"),
    (factor) => factor.weight_mismatch?.combined_factor_reliability_pct,
    3,
    52
  );
  const weakestFailingFactors = topItems(
    factors.filter((factor) => factor.review_label === "candidate_reduce_weight" || factor.review_label === "contradiction_edge_possible_hidden_predictor"),
    (factor) => {
      const reliability = factor.weight_mismatch?.combined_factor_reliability_pct;
      if (factor.review_label === "contradiction_edge_possible_hidden_predictor") {
        return Number.isFinite(reliability) ? 100 - reliability + 25 : 25;
      }
      return Number.isFinite(reliability) ? 100 - reliability : 0;
    },
    3
  );

  const reviewWarnings = buildLowSampleWarning({
    singleFactors: factors,
    combinationGroups: [
      combinationAnalysis?.two_factor,
      combinationAnalysis?.three_factor,
      baseSideCombinations?.two_factor,
      baseSideCombinations?.three_factor,
      usdSideCombinations?.two_factor,
      usdSideCombinations?.three_factor
    ].filter(Boolean)
  });

  const combinationCandidates = [
    ...(combinationAnalysis?.two_factor?.combinations || []),
    ...(combinationAnalysis?.three_factor?.combinations || []),
    ...(baseSideCombinations?.two_factor?.combinations || []),
    ...(baseSideCombinations?.three_factor?.combinations || []),
    ...(usdSideCombinations?.two_factor?.combinations || []),
    ...(usdSideCombinations?.three_factor?.combinations || [])
  ];

  const strongestReliableCombinations = topItems(
    combinationCandidates.filter((combination) => combination.review_label === "candidate_increase_weight" || combination.review_label === "confirmation_only_factor"),
    (combination) => combination.ex_flat_wr_pct,
    3,
    52
  );

  return {
    strongest_reliable_single_factors: strongestReliableSingleFactors,
    weakest_failing_factors: weakestFailingFactors,
    strongest_reliable_combinations: strongestReliableCombinations,
    low_sample_warning: reviewWarnings,
    layer2_edge_balance: pairSideAnalysis ? pairEdgeCarrierLabel(pairSideAnalysis) : null
  };
}

function combinationKey(items = []) {
  return items
    .map((item) => `${item.factorId}::${item.expectedDirection}`)
    .sort()
    .join("||");
}

function chooseCombinations(items = [], size, start = 0, prefix = [], results = []) {
  if (prefix.length === size) {
    results.push(prefix.slice());
    return results;
  }

  for (let index = start; index <= items.length - (size - prefix.length); index += 1) {
    prefix.push(items[index]);
    chooseCombinations(items, size, index + 1, prefix, results);
    prefix.pop();
  }

  return results;
}

function summarizeCombinationBucket({
  factorItems,
  directionTested,
  observations,
  config
}) {
  const state = buildStateStats(observations, directionTested);
  const alignment = buildAlignmentStats(observations);
  const reliabilityLabel = classifyCombinationReliability({
    exFlatWrPct: state.ex_flat_wr_pct,
    directionalSample: state.directional_sample,
    sampleCount: state.sample_count,
    minimumSampleCount: config.minimum_sample_count,
    exploratorySampleCount: config.exploratory_sample_count
  });

  return {
    factor_ids: factorItems.map((item) => item.factorId),
    factor_names: factorItems.map((item) => item.factorName),
    factors: factorItems.map((item) => ({
      factor_id: item.factorId,
      factor_name: item.factorName,
      source_side: item.sourceSide,
      source_asset: item.sourceAsset,
      original_weight: item.originalWeight
    })),
    sample_count: state.sample_count,
    ex_flat_wr_pct: state.ex_flat_wr_pct,
    flat_count: state.flat_count,
    flat_rate_pct: state.flat_rate_pct,
    bullish_sample_count: observations.filter((item) => item.outcomeDirection === "BULLISH").length,
    bearish_sample_count: observations.filter((item) => item.outcomeDirection === "BEARISH").length,
    bullish_direction_tested: directionTested === "BULLISH",
    bearish_direction_tested: directionTested === "BEARISH",
    direction_tested: directionTested,
    agrees_with_final_call: {
      majority: alignment.agrees_with_final_call.sample_count > alignment.contradicts_final_call.sample_count,
      sample_count: alignment.agrees_with_final_call.sample_count,
      ex_flat_wr_pct: alignment.agrees_with_final_call.ex_flat_wr_pct,
      flat_count: alignment.agrees_with_final_call.flat_count,
      flat_rate_pct: alignment.agrees_with_final_call.flat_rate_pct
    },
    contradicts_final_call: {
      sample_count: alignment.contradicts_final_call.sample_count,
      ex_flat_wr_pct: alignment.contradicts_final_call.ex_flat_wr_pct,
      flat_count: alignment.contradicts_final_call.flat_count,
      flat_rate_pct: alignment.contradicts_final_call.flat_rate_pct
    },
    skipped_no_final_call_count: alignment.skipped_no_final_call_count,
    reliability_label: reliabilityLabel,
    interpretation: interpretCombinationReliability(reliabilityLabel),
    sample_size_label: classifySampleSize(state.sample_count),
    adr_l2l_factor_join: createAdrL2lUnavailableBlock()
  };
}

function buildCombinationAnalysis(scopeLabel, directionalRows = []) {
  const comboBuckets = new Map();

  for (const row of directionalRows) {
    const bullishItems = row.factorItems.filter((item) => item.expectedDirection === "BULLISH");
    const bearishItems = row.factorItems.filter((item) => item.expectedDirection === "BEARISH");

    for (const [analysisKey, config] of Object.entries(COMBINATION_CONFIG)) {
      for (const [directionTested, directionalItems] of [["BULLISH", bullishItems], ["BEARISH", bearishItems]]) {
        if (directionalItems.length < config.size) continue;

        for (const comboItems of chooseCombinations(directionalItems, config.size)) {
          const bucketKey = `${analysisKey}::${directionTested}::${combinationKey(comboItems)}`;
          if (!comboBuckets.has(bucketKey)) {
            comboBuckets.set(bucketKey, {
              analysisKey,
              config,
              directionTested,
              factorItems: comboItems.map((item) => ({
                factorId: item.factorId,
                factorName: item.factorName,
                sourceSide: item.sourceSide,
                sourceAsset: item.sourceAsset,
                originalWeight: item.originalWeight,
                expectedDirection: item.expectedDirection
              })),
              observations: []
            });
          }

          comboBuckets.get(bucketKey).observations.push({
            snapshotDate: row.snapshotDate,
            outcomeDirection: row.outcomeDirection,
            realisedMovePct: row.realisedMovePct,
            alignment: !row.finalCallDirection
              ? "unavailable"
              : row.finalCallDirection === directionTested ? "aligned" : "contradicted",
            alignmentOutcome: !row.finalCallDirection || row.outcomeDirection === "FLAT"
              ? row.outcomeDirection === "FLAT" ? "FLAT" : "UNAVAILABLE"
              : row.outcomeDirection === directionTested ? "WIN" : "LOSS"
          });
        }
      }
    }
  }

  const grouped = {
    two_factor: [],
    three_factor: []
  };

  for (const bucket of comboBuckets.values()) {
    grouped[bucket.analysisKey].push(labelCombinationForReview(summarizeCombinationBucket({
      factorItems: bucket.factorItems,
      directionTested: bucket.directionTested,
      observations: bucket.observations,
      config: bucket.config
    })));
  }

  return Object.fromEntries(Object.entries(COMBINATION_CONFIG).map(([analysisKey, config]) => {
    const combinations = grouped[analysisKey]
      .sort((left, right) => (
        (Number.isFinite(right.ex_flat_wr_pct) ? right.ex_flat_wr_pct : -1) - (Number.isFinite(left.ex_flat_wr_pct) ? left.ex_flat_wr_pct : -1)
        || (right.sample_count || 0) - (left.sample_count || 0)
        || String(left.factor_ids.join("|")).localeCompare(String(right.factor_ids.join("|")))
      ));
    const usableCount = combinations.filter((item) => !String(item.reliability_label).startsWith("exploratory") && item.reliability_label !== "unavailable_low_sample").length;
    const exploratoryCount = combinations.filter((item) => String(item.reliability_label).startsWith("exploratory")).length;
    const unavailableCount = combinations.filter((item) => item.reliability_label === "unavailable_low_sample").length;

    return [analysisKey, {
      scope: scopeLabel,
      combination_size: config.size,
      minimum_sample_count: config.minimum_sample_count,
      exploratory_sample_count: config.exploratory_sample_count,
      usable_combination_count: usableCount,
      exploratory_combination_count: exploratoryCount,
      unavailable_low_sample_count: unavailableCount,
      best_available_combination: combinations.find((item) => item.reliability_label !== "unavailable_low_sample") || null,
      combinations
    }];
  }));
}

function buildFactorEntry({
  factorId,
  factorName,
  originalWeight,
  sourceSide,
  sourceAsset,
  observations
}) {
  const bullishObservations = observations.filter((item) => item.factorState === "BULLISH");
  const bearishObservations = observations.filter((item) => item.factorState === "BEARISH");
  const neutralObservations = observations.filter((item) => item.factorState !== "BULLISH" && item.factorState !== "BEARISH");

  const bullishState = {
    ...buildStateStats(bullishObservations, sourceSide === "usd_side" ? "BEARISH" : "BULLISH"),
    adr_l2l_opportunity: createAdrL2lUnavailableBlock()
  };
  const bearishState = {
    ...buildStateStats(bearishObservations, sourceSide === "usd_side" ? "BULLISH" : "BEARISH"),
    adr_l2l_opportunity: createAdrL2lUnavailableBlock()
  };
  const neutralState = buildNeutralStats(neutralObservations);

  const directionalSample = bullishState.directional_sample + bearishState.directional_sample;
  const combinedWins = bullishState.wins + bearishState.wins;
  const combinedLosses = bullishState.losses + bearishState.losses;
  const combinedReliabilityPct = directionalSample ? roundNumber((combinedWins / directionalSample) * 100, 1) : null;
  const alignment = buildAlignmentStats(observations);
  const weightMismatch = buildWeightMismatch({
    originalWeight,
    bullishState,
    bearishState,
    combinedReliabilityPct,
    directionalSample
  });
  const factorProfile = buildFactorProfile({
    bullishState,
    bearishState,
    neutralState,
    suggestedInterpretation: weightMismatch.suggested_interpretation
  });

  return labelFactorForReview({
    factor_id: factorId,
    factor_name: factorName,
    source_side: sourceSide,
    source_asset: sourceAsset,
    original_weight: originalWeight,
    factor_profile: factorProfile,
    bullish_state: bullishState,
    bearish_state: bearishState,
    neutral_state: neutralState,
    alignment_with_final_call: alignment,
    weight_mismatch: weightMismatch,
    suggested_interpretation: weightMismatch.suggested_interpretation
  });
}

function buildEntitySummary(factors, totalObservations) {
  return {
    total_observations: totalObservations,
    factor_count: factors.length,
    strongest_bullish_factor: strongestFactorBy(factors, (factor) => factor.bullish_state.ex_flat_wr_pct),
    strongest_bearish_factor: strongestFactorBy(factors, (factor) => factor.bearish_state.ex_flat_wr_pct),
    weakest_factor: strongestFactorBy(factors, (factor) => {
      const value = factor.weight_mismatch?.combined_factor_reliability_pct;
      return Number.isFinite(value) ? -value : Number.NEGATIVE_INFINITY;
    }),
    highest_sample_reliable_factor: strongestFactorBy(factors, (factor) => {
      const sample = factor.weight_mismatch?.directional_sample || 0;
      const reliability = factor.weight_mismatch?.combined_factor_reliability_pct;
      return sample >= 30 && Number.isFinite(reliability) && reliability >= 58 ? sample : Number.NEGATIVE_INFINITY;
    }),
    biggest_weight_mismatch: strongestFactorBy(factors, (factor) => {
      const mismatch = factor.weight_mismatch?.mismatch_vs_weight_points;
      return Number.isFinite(mismatch) ? Math.abs(mismatch) : Number.NEGATIVE_INFINITY;
    })
  };
}

function summarizeFactorSide(factors = []) {
  const relevantFactors = factors.filter((factor) => factor && factor.weight_mismatch);
  const reliabilityValues = relevantFactors
    .map((factor) => factor.weight_mismatch?.combined_factor_reliability_pct)
    .filter((value) => Number.isFinite(value));
  const directionalSamples = relevantFactors.reduce((sum, factor) => sum + (factor.weight_mismatch?.directional_sample || 0), 0);
  const carryingEdgeFactor = strongestFactorBy(relevantFactors, (factor) => {
    const reliability = factor.weight_mismatch?.combined_factor_reliability_pct;
    return Number.isFinite(reliability) ? reliability : Number.NEGATIVE_INFINITY;
  });
  const averageReliability = reliabilityValues.length
    ? roundNumber(reliabilityValues.reduce((sum, value) => sum + value, 0) / reliabilityValues.length, 1)
    : null;
  const edgeLabel = averageReliability === null
    ? "insufficient_directional_sample"
    : averageReliability >= 58
      ? "side_carrying_positive_edge"
      : averageReliability < 48
        ? "side_underperforming"
        : "mixed_or_marginal_edge";

  return {
    factor_count: relevantFactors.length,
    directional_sample_count: directionalSamples,
    average_combined_factor_reliability_pct: averageReliability,
    edge_label: edgeLabel,
    carrying_edge_factor: carryingEdgeFactor
  };
}

function buildLayer1Entity(config, checker) {
  const factorDefinitions = factorDefinitionIndex(config.assetCode);
  const factorObservationMap = new Map();
  const dateRange = [];
  const combinationRows = [];

  for (const row of checker.rows || []) {
    const snapshotDate = String(row.snapshot_date || "").trim();
    if (snapshotDate) dateRange.push(snapshotDate);

    const predictedDirection = normalizeDirection(row?.stored?.direction || row?.checker?.direction || "");
    const finalCallDirection = predictedDirection;
    const pctMove = computeComparablePctMove(row?.evaluation_inputs?.open_price, row?.evaluation_inputs?.close_price);
    const outcomeDirection = comparableDirectionFromPctMove(pctMove, config.marketKey);
    if (!outcomeDirection) continue;
    const rowFactorItems = [];

    for (const factorComparison of row.factor_comparisons || []) {
      const factorId = String(factorComparison.factor_key || "").trim();
      if (!factorId) continue;

      const definition = factorDefinitions.get(factorId) || {};
      const factorName = definition.factorName || factorId;
      const originalWeight = toNumber(definition.originalWeight) ?? weightFromFactorComparison(factorComparison);
      const factorState = signalFromFactorComparison(factorComparison);
      const expectedDirection = factorState === "BULLISH" || factorState === "BEARISH" ? factorState : null;
      const alignment = !expectedDirection || !finalCallDirection
        ? "unavailable"
        : expectedDirection === finalCallDirection ? "aligned" : "contradicted";
      const alignmentOutcome = !expectedDirection || !finalCallDirection || outcomeDirection === "FLAT"
        ? outcomeDirection === "FLAT" ? "FLAT" : "UNAVAILABLE"
        : expectedDirection === outcomeDirection ? "WIN" : "LOSS";

      const key = `${factorId}`;
      if (!factorObservationMap.has(key)) {
        factorObservationMap.set(key, {
          factorId,
          factorName,
          originalWeight,
          sourceSide: "asset",
          sourceAsset: config.assetLabel,
          observations: []
        });
      }

      factorObservationMap.get(key).observations.push({
        snapshotDate,
        factorState,
        finalCallDirection,
        alignment,
        alignmentOutcome,
        outcomeDirection,
        realisedMovePct: pctMove
      });

      if (expectedDirection) {
        rowFactorItems.push({
          factorId,
          factorName,
          originalWeight,
          sourceSide: "asset",
          sourceAsset: config.assetLabel,
          expectedDirection
        });
      }
    }

    combinationRows.push({
      snapshotDate,
      finalCallDirection,
      outcomeDirection,
      realisedMovePct: pctMove,
      factorItems: rowFactorItems
    });
  }

  const factors = Array.from(factorObservationMap.values())
    .sort((a, b) => String(a.factorId).localeCompare(String(b.factorId)))
    .map((entry) => buildFactorEntry(entry));

  const factorCombinations = buildCombinationAnalysis("layer1_asset", combinationRows);

  return {
    summary: buildEntitySummary(factors, checker.rows?.length || 0),
    date_range: {
      start: minDate(dateRange),
      end: maxDate(dateRange)
    },
    outcome_market: config.marketKey,
    adr_l2l_factor_join: createAdrL2lUnavailableBlock(),
    top_evidence_summary: buildTopEvidenceSummary({
      factors,
      combinationAnalysis: factorCombinations
    }),
    factor_combinations: factorCombinations,
    factors
  };
}

function buildLayer2Entity(config, allCheckers) {
  const targetChecker = allCheckers[config.targetAssetCode];
  const usdChecker = allCheckers.USD;
  const targetFactorDefinitions = factorDefinitionIndex(config.targetAssetCode);
  const usdFactorDefinitions = factorDefinitionIndex("USD");
  const targetRowsByDate = new Map((targetChecker.rows || []).map((row) => [String(row.snapshot_date || "").trim(), row]));
  const usdRowsByDate = new Map((usdChecker.rows || []).map((row) => [String(row.snapshot_date || "").trim(), row]));
  const matchedDates = Array.from(targetRowsByDate.keys()).filter((date) => usdRowsByDate.has(date)).sort();
  const factorObservationMap = new Map();
  const baseSideCombinationRows = [];
  const usdSideCombinationRows = [];

  for (const snapshotDate of matchedDates) {
    const targetRow = targetRowsByDate.get(snapshotDate);
    const usdRow = usdRowsByDate.get(snapshotDate);
    const targetDirection = normalizeDirection(targetRow?.stored?.direction || targetRow?.checker?.direction || "");
    const usdDirection = normalizeDirection(usdRow?.stored?.direction || usdRow?.checker?.direction || "");
    const finalPairCallDirection = derivePairCallDirection(targetDirection, usdDirection);
    const pctMove = computeComparablePctMove(targetRow?.evaluation_inputs?.open_price, targetRow?.evaluation_inputs?.close_price);
    const outcomeDirection = comparableDirectionFromPctMove(pctMove, config.marketKey);
    if (!outcomeDirection) continue;
    const baseRowFactorItems = [];
    const usdRowFactorItems = [];

    for (const factorComparison of targetRow.factor_comparisons || []) {
      const factorId = String(factorComparison.factor_key || "").trim();
      if (!factorId) continue;

      const definition = targetFactorDefinitions.get(factorId) || {};
      const factorName = definition.factorName || factorId;
      const originalWeight = toNumber(definition.originalWeight) ?? weightFromFactorComparison(factorComparison);
      const factorState = signalFromFactorComparison(factorComparison);
      const expectedDirection = factorState === "BULLISH" || factorState === "BEARISH" ? factorState : null;
      const alignment = !expectedDirection || !finalPairCallDirection
        ? "unavailable"
        : expectedDirection === finalPairCallDirection ? "aligned" : "contradicted";
      const alignmentOutcome = !expectedDirection || !finalPairCallDirection || outcomeDirection === "FLAT"
        ? outcomeDirection === "FLAT" ? "FLAT" : "UNAVAILABLE"
        : expectedDirection === outcomeDirection ? "WIN" : "LOSS";

      const key = `target_asset::${factorId}`;
      if (!factorObservationMap.has(key)) {
        factorObservationMap.set(key, {
          factorId,
          factorName,
          originalWeight,
          sourceSide: "target_asset",
          sourceAsset: config.targetAssetCode === "GOLD" ? "Gold" : config.targetAssetCode,
          observations: []
        });
      }

      factorObservationMap.get(key).observations.push({
        snapshotDate,
        factorState,
        finalCallDirection: finalPairCallDirection,
        alignment,
        alignmentOutcome,
        outcomeDirection,
        realisedMovePct: pctMove
      });

      if (expectedDirection) {
        baseRowFactorItems.push({
          factorId,
          factorName,
          originalWeight,
          sourceSide: "target_asset",
          sourceAsset: config.targetAssetCode === "GOLD" ? "Gold" : config.targetAssetCode,
          expectedDirection
        });
      }
    }

    for (const factorComparison of usdRow.factor_comparisons || []) {
      const factorId = String(factorComparison.factor_key || "").trim();
      if (!factorId) continue;

      const definition = usdFactorDefinitions.get(factorId) || {};
      const factorName = definition.factorName || factorId;
      const originalWeight = toNumber(definition.originalWeight) ?? weightFromFactorComparison(factorComparison);
      const factorState = signalFromFactorComparison(factorComparison);
      const expectedDirection = factorState === "BULLISH" || factorState === "BEARISH"
        ? invertDirection(factorState)
        : null;
      const alignment = !expectedDirection || !finalPairCallDirection
        ? "unavailable"
        : expectedDirection === finalPairCallDirection ? "aligned" : "contradicted";
      const alignmentOutcome = !expectedDirection || !finalPairCallDirection || outcomeDirection === "FLAT"
        ? outcomeDirection === "FLAT" ? "FLAT" : "UNAVAILABLE"
        : expectedDirection === outcomeDirection ? "WIN" : "LOSS";

      const key = `usd_side::${factorId}`;
      if (!factorObservationMap.has(key)) {
        factorObservationMap.set(key, {
          factorId,
          factorName,
          originalWeight,
          sourceSide: "usd_side",
          sourceAsset: "USD",
          observations: []
        });
      }

      factorObservationMap.get(key).observations.push({
        snapshotDate,
        factorState,
        finalCallDirection: finalPairCallDirection,
        alignment,
        alignmentOutcome,
        outcomeDirection,
        realisedMovePct: pctMove
      });

      if (expectedDirection) {
        usdRowFactorItems.push({
          factorId,
          factorName,
          originalWeight,
          sourceSide: "usd_side",
          sourceAsset: "USD",
          expectedDirection
        });
      }
    }

    baseSideCombinationRows.push({
      snapshotDate,
      finalCallDirection: finalPairCallDirection,
      outcomeDirection,
      realisedMovePct: pctMove,
      factorItems: baseRowFactorItems
    });
    usdSideCombinationRows.push({
      snapshotDate,
      finalCallDirection: finalPairCallDirection,
      outcomeDirection,
      realisedMovePct: pctMove,
      factorItems: usdRowFactorItems
    });
  }

  const factors = Array.from(factorObservationMap.values())
    .sort((a, b) => (
      String(a.sourceSide).localeCompare(String(b.sourceSide))
      || String(a.factorId).localeCompare(String(b.factorId))
    ))
    .map((entry) => buildFactorEntry(entry));

  const methodologyNote = config.pairCode === "NQ_USD"
    ? "Pair directional outcomes reuse the repo's existing NQ Phase 1 proxy semantics (QQQ_NQ_PROXY) because the checked-in directional checker does not expose a separate NQ/USD close-to-close evaluator."
    : "Pair directional outcomes reuse the checked-in target-side 24H evaluation market and invert USD-side factor expectations locally for research only.";
  const baseSideFactors = factors.filter((factor) => factor.source_side === "target_asset");
  const usdSideFactors = factors.filter((factor) => factor.source_side === "usd_side");
  const pairSideMapping = config.pairSideMapping || null;
  const pairSideAnalysis = {
    base_side: {
      ...(pairSideMapping?.base_side || {
        sideKey: "target_asset",
        label: "Base Side",
        sourceAsset: config.targetAssetCode,
        mapping: "direct",
        description: "Target-side factors are tested direct against pair movement."
      }),
      summary: summarizeFactorSide(baseSideFactors)
    },
    quote_usd_side: {
      ...(pairSideMapping?.quote_usd_side || {
        sideKey: "usd_side",
        label: "Quote/USD Side",
        sourceAsset: "USD",
        mapping: "inverse",
        description: "USD-side factors are tested inverse against pair movement."
      }),
      summary: summarizeFactorSide(usdSideFactors)
    }
  };

  const factorCombinations = {
    base_side: {
      ...(pairSideMapping?.base_side || {}),
      ...buildCombinationAnalysis("layer2_pair_side", baseSideCombinationRows)
    },
    quote_usd_side: {
      ...(pairSideMapping?.quote_usd_side || {}),
      ...buildCombinationAnalysis("layer2_pair_side", usdSideCombinationRows)
    },
    cross_side: {
      available: false,
      blocker: "Phase 2F keeps Layer 2 factor combinations side-separated. Cross-side factor combinations are not inferred without an explicit mapping contract."
    }
  };

  return {
    summary: buildEntitySummary(factors, matchedDates.length),
    date_range: {
      start: minDate(matchedDates),
      end: maxDate(matchedDates)
    },
    outcome_market: config.marketKey,
    matched_date_observations: matchedDates.length,
    methodology_note: methodologyNote,
    pair_side_analysis: pairSideAnalysis,
    adr_l2l_factor_join: createAdrL2lUnavailableBlock(),
    top_evidence_summary: buildTopEvidenceSummary({
      factors,
      pairSideAnalysis,
      baseSideCombinations: factorCombinations.base_side,
      usdSideCombinations: factorCombinations.quote_usd_side
    }),
    factor_combinations: factorCombinations,
    factors
  };
}

function buildPayload() {
  const checkers = checkerRowsByAsset();
  const layer1 = Object.fromEntries(LAYER1_CONFIGS.map((config) => [config.assetLabel, buildLayer1Entity(config, checkers[config.assetCode])]));
  const layer2 = Object.fromEntries(LAYER2_CONFIGS.map((config) => [config.pairLabel, buildLayer2Entity(config, checkers)]));

  const layer1Dates = Object.values(layer1).flatMap((entity) => [entity.date_range.start, entity.date_range.end].filter(Boolean));
  const layer2Dates = Object.values(layer2).flatMap((entity) => [entity.date_range.start, entity.date_range.end].filter(Boolean));

  return {
    generated_at: new Date().toISOString(),
    version: VERSION,
    timeframe: TIMEFRAME,
    primary_metric: PRIMARY_METRIC,
    date_range: {
      start: minDate([...layer1Dates, ...layer2Dates]),
      end: maxDate([...layer1Dates, ...layer2Dates])
    },
    methodology: {
      directional_outcome: "wins exclude flats from the primary ex-flat win-rate calculation",
      adr_l2l: "factor-level ADR/L2L opportunity reliability is marked unavailable unless a full per-prediction joinable export exists locally",
      layer2_mapping: {
        target_asset_factors: "target bullish -> pair bullish, target bearish -> pair bearish",
        usd_side_factors: "USD bullish -> pair bearish, USD bearish -> pair bullish",
        pair_call_alignment: "final pair call exists only when target and USD 24H calls are both directional and opposite"
      },
      pair_side_groups: {
        base_side: "Base-side factors are shown separately and are tested direct against pair movement.",
        quote_usd_side: "Quote/USD-side factors are shown separately and are tested inverse against pair movement unless an explicit checked-in rule says otherwise."
      },
      factor_combinations: {
        two_factor: `Two-factor combinations require at least ${COMBINATION_CONFIG.two_factor.minimum_sample_count} samples for non-exploratory treatment.`,
        three_factor: `Three-factor combinations require at least ${COMBINATION_CONFIG.three_factor.minimum_sample_count} samples for non-exploratory treatment.`,
        low_sample_handling: "Combination rows below the main minimum are labeled exploratory or unavailable rather than surfaced as strong edge.",
        layer2_scope: "Layer 2 pair combinations stay separated by base side and quote/USD side. Cross-side combinations are intentionally unavailable in this phase."
      },
      outcome_markets: {
        USD: "DXY",
        EUR: "EURUSD",
        Gold: "XAUUSD",
        NQ: "QQQ_NQ_PROXY",
        BTC: "BTCUSD",
        "EUR/USD": "EURUSD",
        "XAU/USD": "XAUUSD",
        "NQ/USD": "QQQ_NQ_PROXY",
        "BTC/USD": "BTCUSD"
      },
      known_limitations: [
        ADR_L2L_BLOCKER,
        "NQ/USD pair directional outcomes inherit the existing NQ proxy semantics because the repo's checked-in directional research does not expose a separate NQ/USD close-to-close evaluator."
      ]
    },
    layer1,
    layer2
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputPath = path.resolve(args.output || DEFAULT_OUTPUT);
  const payload = buildPayload();
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const layer1FactorCount = Object.values(payload.layer1).reduce((sum, entity) => sum + entity.factors.length, 0);
  const layer2FactorCount = Object.values(payload.layer2).reduce((sum, entity) => sum + entity.factors.length, 0);

  console.log(JSON.stringify({
    output_path: outputPath,
    version: payload.version,
    timeframe: payload.timeframe,
    layer1_entities: Object.keys(payload.layer1).length,
    layer2_entities: Object.keys(payload.layer2).length,
    layer1_factor_entries: layer1FactorCount,
    layer2_factor_entries: layer2FactorCount,
    adr_l2l_factor_join_available: false
  }, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error("Factor Edge Lab build failed.");
    console.error(error.stack || error.message || String(error));
    process.exit(1);
  }
}

module.exports = {
  buildCombinationAnalysis,
  buildTopEvidenceSummary,
  classifyCombinationReviewLabel,
  classifyFactorReviewLabel,
  buildPayload
};
