const {
  roundNumber,
  normalizeDirection,
  signalFromFactorComparison,
  weightFromFactorComparison
} = require("./factor_edge_lab");

const RELIABLE_FACTOR_SAMPLE_MIN = 30;
const MIN_DIRECTIONAL_WEIGHT = 20;
const MIN_DIRECTIONAL_PARTICIPATION_PCT = 18;
const MIN_MARGIN_WEIGHT = 4;
const MIN_DOMINANT_SHARE_PCT = 54;

function metricAvailable(value) {
  return value !== null && value !== undefined && value !== "";
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function computePairSupportAdjustment(pairSupport = {}) {
  const reliability = Number(pairSupport?.average_reliability_pct);
  const sample = Number(pairSupport?.directional_sample);
  if (!Number.isFinite(reliability) || sample < RELIABLE_FACTOR_SAMPLE_MIN) {
    return { score: 0, note: "pair-side evidence unavailable" };
  }

  if (reliability >= 60) return { score: 1, note: "pair-side evidence supportive" };
  if (reliability <= 48) return { score: -1, note: "pair-side evidence weak" };
  return { score: 0, note: "pair-side evidence mixed" };
}

function computeCombinationAdjustment(comboSupport = {}) {
  const positive = Number(comboSupport?.positive_count || 0);
  const negative = Number(comboSupport?.negative_count || 0);
  if (!positive && !negative) {
    return { score: 0, note: "no usable combination signal" };
  }

  const net = positive - negative;
  if (net >= 2) return { score: 1, note: "multiple supportive combinations" };
  if (net <= -2) return { score: -1, note: "multiple weak combinations" };
  return { score: 0, note: "combination evidence mixed" };
}

function classifyWeightReason({
  reviewLabel,
  directionalSample,
  agreeWrPct,
  contraWrPct,
  contraSample,
  reliabilityPct,
  baselineExFlatWrPct,
  flatRatePct,
  score
}) {
  if (directionalSample < RELIABLE_FACTOR_SAMPLE_MIN || !Number.isFinite(reliabilityPct)) {
    return "insufficient_evidence";
  }

  const contradictionGap = Number.isFinite(contraWrPct) && Number.isFinite(agreeWrPct) ? contraWrPct - agreeWrPct : null;
  if (
    reviewLabel === "contradiction_edge_possible_hidden_predictor"
    || (Number.isFinite(contradictionGap) && contradictionGap >= 7 && contraSample >= 15)
  ) {
    return "contradiction_edge";
  }

  if (score >= 2 && Number.isFinite(agreeWrPct) && Number.isFinite(baselineExFlatWrPct) && agreeWrPct >= baselineExFlatWrPct + 4) {
    return "increase_candidate";
  }

  if (
    score <= -2
    || (Number.isFinite(flatRatePct) && flatRatePct >= 45)
    || (Number.isFinite(agreeWrPct) && Number.isFinite(baselineExFlatWrPct) && agreeWrPct <= baselineExFlatWrPct - 4)
  ) {
    return "reduce_candidate";
  }

  if (reviewLabel === "confirmation_only_factor") return "confirmation_only";
  if (Math.abs(score) <= 1) return "unchanged";
  return score > 0 ? "confirmation_only" : "unchanged";
}

function multiplierFromReason(reasonLabel, score) {
  if (reasonLabel === "insufficient_evidence") return 1;
  if (reasonLabel === "contradiction_edge") return score <= -3 ? 0.82 : 0.9;
  if (reasonLabel === "reduce_candidate") return score <= -4 ? 0.82 : 0.9;
  if (reasonLabel === "increase_candidate") return score >= 4 ? 1.18 : 1.1;
  if (reasonLabel === "confirmation_only") return 1.03;
  return 1;
}

function buildFactorScore({
  factorRow,
  baselineExFlatWrPct,
  pairSupport,
  combinationSupport
}) {
  const directionalSample = Number(factorRow?.weight_mismatch?.directional_sample || 0);
  const reliabilityPct = Number(factorRow?.weight_mismatch?.combined_factor_reliability_pct);
  const agreeWrPct = Number(factorRow?.alignment_with_final_call?.agrees_with_final_call?.ex_flat_wr_pct);
  const agreeSample = Number(factorRow?.alignment_with_final_call?.agrees_with_final_call?.sample_count || 0);
  const contraWrPct = Number(factorRow?.alignment_with_final_call?.contradicts_final_call?.ex_flat_wr_pct);
  const contraSample = Number(factorRow?.alignment_with_final_call?.contradicts_final_call?.sample_count || 0);
  const flatRatePct = Number(factorRow?.factor_profile?.flat_rate_pct);
  const pairAdjustment = computePairSupportAdjustment(pairSupport);
  const comboAdjustment = computeCombinationAdjustment(combinationSupport);

  let score = 0;

  if (directionalSample < RELIABLE_FACTOR_SAMPLE_MIN || !Number.isFinite(reliabilityPct)) {
    return {
      score,
      pairAdjustment,
      comboAdjustment,
      directionalSample,
      reliabilityPct,
      agreeWrPct,
      agreeSample,
      contraWrPct,
      contraSample,
      flatRatePct,
      reasonLabel: "insufficient_evidence",
      multiplier: 1,
      rationale: "Directional sample or reliability evidence is too weak to justify reweighting."
    };
  }

  if (Number.isFinite(agreeWrPct) && Number.isFinite(baselineExFlatWrPct)) {
    if (agreeWrPct >= baselineExFlatWrPct + 8) score += 2;
    else if (agreeWrPct >= baselineExFlatWrPct + 4) score += 1;
    else if (agreeWrPct <= baselineExFlatWrPct - 8) score -= 2;
    else if (agreeWrPct <= baselineExFlatWrPct - 4) score -= 1;
  }

  if (Number.isFinite(reliabilityPct)) {
    if (reliabilityPct >= 65) score += 2;
    else if (reliabilityPct >= 58) score += 1;
    else if (reliabilityPct < 48) score -= 2;
    else if (reliabilityPct < 52) score -= 1;
  }

  if (Number.isFinite(contraWrPct) && Number.isFinite(agreeWrPct) && contraSample >= 15) {
    if (contraWrPct >= agreeWrPct + 8) score -= 2;
    else if (contraWrPct >= agreeWrPct + 4) score -= 1;
  }

  if (Number.isFinite(flatRatePct)) {
    if (flatRatePct >= 45) score -= 2;
    else if (flatRatePct >= 35) score -= 1;
    else if (flatRatePct <= 20) score += 1;
  }

  if (factorRow?.review_label === "candidate_increase_weight") score += 1;
  if (factorRow?.review_label === "candidate_reduce_weight") score -= 1;

  score += pairAdjustment.score;
  score += comboAdjustment.score;

  const reasonLabel = classifyWeightReason({
    reviewLabel: factorRow?.review_label,
    directionalSample,
    agreeWrPct,
    contraWrPct,
    contraSample,
    reliabilityPct,
    baselineExFlatWrPct,
    flatRatePct,
    score
  });
  const multiplier = multiplierFromReason(reasonLabel, score);

  const rationaleParts = [
    Number.isFinite(agreeWrPct) && Number.isFinite(baselineExFlatWrPct)
      ? `agree ex-flat ${agreeWrPct}% vs asset baseline ${baselineExFlatWrPct}%`
      : "agree ex-flat unavailable",
    Number.isFinite(contraWrPct)
      ? `contra ex-flat ${contraWrPct}% (${contraSample} samples)`
      : "contra ex-flat unavailable",
    Number.isFinite(reliabilityPct)
      ? `combined reliability ${reliabilityPct}%`
      : "combined reliability unavailable",
    Number.isFinite(flatRatePct)
      ? `flat rate ${flatRatePct}%`
      : "flat rate unavailable",
    pairAdjustment.note,
    comboAdjustment.note
  ];

  return {
    score,
    pairAdjustment,
    comboAdjustment,
    directionalSample,
    reliabilityPct,
    agreeWrPct,
    agreeSample,
    contraWrPct,
    contraSample,
    flatRatePct,
    reasonLabel,
    multiplier,
    rationale: rationaleParts.join(" | ")
  };
}

function normalizeShadowWeights(weightRows = []) {
  const originalTotal = weightRows.reduce((sum, row) => sum + (Number(row.original_weight) || 0), 0);
  const provisionalTotal = weightRows.reduce((sum, row) => sum + (Number(row.provisional_shadow_weight) || 0), 0);
  if (!originalTotal || !provisionalTotal) {
    return weightRows.map((row) => ({
      ...row,
      shadow_weight: row.original_weight,
      row_multiplier: 1,
      change_pct: 0
    }));
  }

  return weightRows.map((row) => {
    const normalizedShadowWeight = (Number(row.provisional_shadow_weight) || 0) * (originalTotal / provisionalTotal);
    const shadowWeight = roundNumber(normalizedShadowWeight, 2);
    const originalWeight = Number(row.original_weight) || 0;
    const rowMultiplier = originalWeight > 0 ? normalizedShadowWeight / originalWeight : 1;
    const changePct = originalWeight > 0
      ? roundNumber(((normalizedShadowWeight - originalWeight) / originalWeight) * 100, 1)
      : 0;

    return {
      ...row,
      shadow_weight: shadowWeight,
      row_multiplier: roundNumber(rowMultiplier, 4),
      change_pct: changePct
    };
  });
}

function buildShadowWeightPlan({
  factorRows = [],
  baselineExFlatWrPct = null,
  pairSupportByFactor = new Map(),
  combinationSupportByFactor = new Map()
}) {
  const provisionalRows = factorRows.map((factorRow) => {
    const factorKey = String(factorRow.factor_id || "");
    const pairSupport = pairSupportByFactor.get(factorKey) || null;
    const combinationSupport = combinationSupportByFactor.get(factorKey) || null;
    const score = buildFactorScore({
      factorRow,
      baselineExFlatWrPct,
      pairSupport,
      combinationSupport
    });
    const originalWeight = Number(factorRow.original_weight || factorRow?.weight_mismatch?.original_factor_weight || 0);

    return {
      factor_id: factorRow.factor_id,
      factor_name: factorRow.factor_name,
      original_weight: originalWeight,
      provisional_shadow_weight: roundNumber(originalWeight * score.multiplier, 4),
      reason_label: score.reasonLabel,
      review_label: factorRow.review_label || "not_available",
      suggested_interpretation: factorRow.suggested_interpretation || factorRow?.weight_mismatch?.suggested_interpretation || "not_available",
      directional_sample: score.directionalSample,
      agree_ex_flat_wr_pct: metricAvailable(score.agreeWrPct) ? roundNumber(score.agreeWrPct, 1) : null,
      agree_sample_count: score.agreeSample,
      contradiction_ex_flat_wr_pct: metricAvailable(score.contraWrPct) ? roundNumber(score.contraWrPct, 1) : null,
      contradiction_sample_count: score.contraSample,
      combined_reliability_pct: metricAvailable(score.reliabilityPct) ? roundNumber(score.reliabilityPct, 1) : null,
      flat_rate_pct: metricAvailable(score.flatRatePct) ? roundNumber(score.flatRatePct, 1) : null,
      pair_side_adjustment: score.pairAdjustment.note,
      combination_adjustment: score.comboAdjustment.note,
      score: score.score,
      rationale: score.rationale
    };
  });

  return normalizeShadowWeights(provisionalRows)
    .sort((left, right) => (
      Math.abs(right.change_pct || 0) - Math.abs(left.change_pct || 0)
      || String(left.factor_id || "").localeCompare(String(right.factor_id || ""))
    ));
}

function sumWeightedSignals(factorComparisons = [], weightPlanLookup = new Map()) {
  return factorComparisons.reduce((state, factorComparison) => {
    const factorKey = String(factorComparison?.factor_key || "");
    const signal = normalizeDirection(signalFromFactorComparison(factorComparison));
    const storedWeight = weightFromFactorComparison(factorComparison);
    const plan = weightPlanLookup.get(factorKey) || null;
    const adjustedWeight = Number.isFinite(storedWeight)
      ? storedWeight * (Number(plan?.row_multiplier) || 1)
      : 0;

    if (signal === "BULLISH") state.bullish_weight += adjustedWeight;
    else if (signal === "BEARISH") state.bearish_weight += adjustedWeight;
    else state.neutral_weight += adjustedWeight;

    return state;
  }, {
    bullish_weight: 0,
    bearish_weight: 0,
    neutral_weight: 0
  });
}

function classifyShadowDirection(weighted = {}) {
  const bullishWeight = Number(weighted.bullish_weight || 0);
  const bearishWeight = Number(weighted.bearish_weight || 0);
  const neutralWeight = Number(weighted.neutral_weight || 0);
  const activeDirectionalWeight = bullishWeight + bearishWeight;
  const totalWeight = activeDirectionalWeight + neutralWeight;

  if (activeDirectionalWeight < MIN_DIRECTIONAL_WEIGHT) return null;
  if (totalWeight <= 0) return null;

  const margin = Math.abs(bullishWeight - bearishWeight);
  const dominantSharePct = Math.max(bullishWeight, bearishWeight) / activeDirectionalWeight * 100;
  const directionalParticipationPct = activeDirectionalWeight / totalWeight * 100;

  if (margin < MIN_MARGIN_WEIGHT) return null;
  if (dominantSharePct < MIN_DOMINANT_SHARE_PCT) return null;
  if (directionalParticipationPct < MIN_DIRECTIONAL_PARTICIPATION_PCT) return null;
  if (margin < 8 && dominantSharePct < 58) return null;

  if (bullishWeight > bearishWeight) return "BULLISH";
  if (bearishWeight > bullishWeight) return "BEARISH";
  return null;
}

function classifyShadowResult(direction, outcomeDirection) {
  if (!direction) return "NO_CALL";
  if (outcomeDirection === "FLAT") return "FLAT";
  if (outcomeDirection !== "BULLISH" && outcomeDirection !== "BEARISH") return "NOT_EVALUABLE";
  return direction === outcomeDirection ? "CORRECT" : "WRONG";
}

function summarizeShadowRows(rows = []) {
  const summary = rows.reduce((state, row) => {
    state.sample_count += 1;
    if (row.result === "NO_CALL") {
      state.no_call_count += 1;
      return state;
    }
    if (row.result === "NOT_EVALUABLE") {
      state.not_evaluable_count += 1;
      return state;
    }

    state.directional_call_count += 1;
    if (row.result === "CORRECT") state.wins += 1;
    else if (row.result === "WRONG") state.losses += 1;
    else if (row.result === "FLAT") state.flats += 1;
    return state;
  }, {
    sample_count: 0,
    directional_call_count: 0,
    wins: 0,
    losses: 0,
    flats: 0,
    no_call_count: 0,
    not_evaluable_count: 0
  });

  const exFlatDenominator = summary.wins + summary.losses;
  summary.ex_flat_wr_pct = exFlatDenominator ? roundNumber((summary.wins / exFlatDenominator) * 100, 1) : null;
  summary.flat_rate_pct = summary.directional_call_count ? roundNumber((summary.flats / summary.directional_call_count) * 100, 1) : null;
  return summary;
}

function buildComparisonStatus(originalSummary = {}, shadowSummary = {}) {
  const exFlatChangePctPoints = metricAvailable(originalSummary.ex_flat_wr_pct) && metricAvailable(shadowSummary.ex_flat_wr_pct)
    ? roundNumber(shadowSummary.ex_flat_wr_pct - originalSummary.ex_flat_wr_pct, 1)
    : null;
  const flatRateChangePctPoints = metricAvailable(originalSummary.flat_rate_pct) && metricAvailable(shadowSummary.flat_rate_pct)
    ? roundNumber(shadowSummary.flat_rate_pct - originalSummary.flat_rate_pct, 1)
    : null;
  const directionalWinsDelta = (shadowSummary.wins || 0) - (originalSummary.wins || 0);
  const directionalLossesDelta = (shadowSummary.losses || 0) - (originalSummary.losses || 0);
  const directionalCallsDelta = (shadowSummary.directional_call_count || 0) - (originalSummary.directional_call_count || 0);

  const enoughShadowSample = (shadowSummary.wins || 0) + (shadowSummary.losses || 0) >= RELIABLE_FACTOR_SAMPLE_MIN;
  let status = "WARN";
  let headline = "mixed_or_small_sample";

  if (enoughShadowSample && Number.isFinite(exFlatChangePctPoints) && exFlatChangePctPoints >= 3 && directionalWinsDelta >= 0) {
    status = "PASS";
    headline = "shadow_logic_improves_directional_accuracy";
  } else if (enoughShadowSample && Number.isFinite(exFlatChangePctPoints) && exFlatChangePctPoints <= -3 && directionalLossesDelta > 0) {
    status = "FAIL";
    headline = "shadow_logic_degrades_directional_accuracy";
  }

  return {
    status,
    headline,
    ex_flat_change_pct_points: exFlatChangePctPoints,
    flat_rate_change_pct_points: flatRateChangePctPoints,
    directional_wins_delta: directionalWinsDelta,
    directional_losses_delta: directionalLossesDelta,
    directional_calls_delta: directionalCallsDelta
  };
}

function sampleWarning(summary = {}) {
  const directionalSample = (summary.wins || 0) + (summary.losses || 0);
  if (directionalSample < 15) {
    return {
      label: "very_low_sample",
      detail: "Shadow directional sample is too small for a strong conclusion."
    };
  }
  if (directionalSample < RELIABLE_FACTOR_SAMPLE_MIN) {
    return {
      label: "low_sample",
      detail: "Shadow directional sample is still below the main reliability gate."
    };
  }
  return {
    label: "sample_coverage_acceptable",
    detail: "Shadow directional sample passed the main reliability gate."
  };
}

module.exports = {
  RELIABLE_FACTOR_SAMPLE_MIN,
  buildShadowWeightPlan,
  buildComparisonStatus,
  classifyShadowDirection,
  classifyShadowResult,
  sampleWarning,
  summarizeShadowRows,
  sumWeightedSignals
};
