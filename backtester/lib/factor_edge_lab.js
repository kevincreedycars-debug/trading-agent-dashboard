const path = require("path");
const { classifyMarketOutcome } = require("./outcome_direction");

const CHECKER_PATHS = Object.freeze({
  USD: path.resolve(__dirname, "../../data/backtester-checker-usd-24h-2024-01.json"),
  EUR: path.resolve(__dirname, "../../data/backtester-checker-eur-24h-2024-2026.json"),
  GOLD: path.resolve(__dirname, "../../data/backtester-checker-gold-24h-2024-2026.json"),
  NQ: path.resolve(__dirname, "../../data/backtester-checker-nq-24h-2024-2026.json"),
  BTC: path.resolve(__dirname, "../../data/backtester-checker-btc-24h-2024-2026.json")
});

const LAYER1_CONFIGS = Object.freeze([
  { assetCode: "USD", assetLabel: "USD", marketKey: "DXY" },
  { assetCode: "EUR", assetLabel: "EUR", marketKey: "EURUSD" },
  { assetCode: "GOLD", assetLabel: "Gold", marketKey: "XAUUSD" },
  { assetCode: "NQ", assetLabel: "NQ", marketKey: "QQQ_NQ_PROXY" },
  { assetCode: "BTC", assetLabel: "BTC", marketKey: "BTCUSD" }
]);

const LAYER2_CONFIGS = Object.freeze([
  { targetAssetCode: "EUR", pairCode: "EUR_USD", pairLabel: "EUR/USD", marketKey: "EURUSD" },
  { targetAssetCode: "GOLD", pairCode: "XAU_USD", pairLabel: "XAU/USD", marketKey: "XAUUSD" },
  { targetAssetCode: "NQ", pairCode: "NQ_USD", pairLabel: "NQ/USD", marketKey: "QQQ_NQ_PROXY" },
  { targetAssetCode: "BTC", pairCode: "BTC_USD", pairLabel: "BTC/USD", marketKey: "BTCUSD" }
]);

const FACTOR_DEFINITIONS = Object.freeze({
  USD: Object.freeze([
    { factorId: "F1 VIX", factorName: "VIX", originalWeight: 10 },
    { factorId: "F2 US 2Y Yield Delta", factorName: "US 2Y Yield Delta", originalWeight: 18 },
    { factorId: "F3 US-DE 2Y Spread Delta", factorName: "US-DE 2Y Spread Delta", originalWeight: 20 },
    { factorId: "F4 US 10Y Real Yield Delta", factorName: "US 10Y Real Yield Delta", originalWeight: 14 },
    { factorId: "F5 DXY Delta", factorName: "DXY Delta", originalWeight: 14 },
    { factorId: "F6 Gold Delta", factorName: "Gold Delta", originalWeight: 10 },
    { factorId: "F7 US Economic Surprise", factorName: "US Economic Surprise", originalWeight: 6 },
    { factorId: "F8 Fed Bias", factorName: "Fed Bias", originalWeight: 8 },
    { factorId: "F9 Dollar Smile", factorName: "Dollar Smile", originalWeight: 8 },
    { factorId: "F10 Equity Regime", factorName: "Equity Regime", originalWeight: 2 }
  ]),
  EUR: Object.freeze([
    { factorId: "F1", factorName: "ECB Bias", originalWeight: 20 },
    { factorId: "F2", factorName: "Germany 2Y Yield Delta", originalWeight: 18 },
    { factorId: "F3", factorName: "US-DE 2Y Spread Delta", originalWeight: 20 },
    { factorId: "F4", factorName: "Eurozone Economic Surprise", originalWeight: 14 },
    { factorId: "F5", factorName: "Eurozone PMI Trend", originalWeight: 4 },
    { factorId: "F6", factorName: "EUR Own Price Delta", originalWeight: 12 },
    { factorId: "F7", factorName: "Gold Confirmation", originalWeight: 4 },
    { factorId: "F8", factorName: "Eurozone Stress", originalWeight: 4 },
    { factorId: "F9", factorName: "Global Growth Regime", originalWeight: 2 },
    { factorId: "F10", factorName: "VIX Risk Regime", originalWeight: 2 }
  ]),
  GOLD: Object.freeze([
    { factorId: "F1", factorName: "US 10Y Real Yield Delta", originalWeight: 26 },
    { factorId: "F2", factorName: "DXY Delta", originalWeight: 22 },
    { factorId: "F3", factorName: "Fed Bias", originalWeight: 12 },
    { factorId: "F4", factorName: "US 2Y Yield Delta", originalWeight: 10 },
    { factorId: "F5", factorName: "Gold Own Price Delta", originalWeight: 10 },
    { factorId: "F6", factorName: "VIX Risk Regime", originalWeight: 8 },
    { factorId: "F7", factorName: "US Economic Surprise", originalWeight: 8 },
    { factorId: "F8", factorName: "Inflation Signal", originalWeight: 2 },
    { factorId: "F9", factorName: "Safe-Haven Demand", originalWeight: 1 },
    { factorId: "F10", factorName: "Growth Regime", originalWeight: 1 }
  ]),
  NQ: Object.freeze([
    { factorId: "F1", factorName: "VIX Level and Risk Regime", originalWeight: 20 },
    { factorId: "F2", factorName: "VIX Delta", originalWeight: 14 },
    { factorId: "F3", factorName: "DXY / USD Pressure", originalWeight: 12 },
    { factorId: "F4", factorName: "US 10Y Nominal Yield Delta", originalWeight: 6 },
    { factorId: "F5", factorName: "US 10Y Real Yield Delta", originalWeight: 14 },
    { factorId: "F6", factorName: "Fed Bias / Liquidity", originalWeight: 12 },
    { factorId: "F7", factorName: "US Economic Surprise Direction", originalWeight: 8 },
    { factorId: "F8", factorName: "NQ Own Price Delta", originalWeight: 10 },
    { factorId: "F9", factorName: "BTC Confirmation", originalWeight: 2 },
    { factorId: "F10", factorName: "Gold Defensive Flow Confirmation", originalWeight: 2 }
  ]),
  BTC: Object.freeze([
    { factorId: "F1 BTC Own Price Delta", factorName: "BTC Own Price Delta", originalWeight: 16 },
    { factorId: "F2 DXY / USD Pressure", factorName: "DXY / USD Pressure", originalWeight: 14 },
    { factorId: "F3 US 10Y Real Yield Delta", factorName: "US 10Y Real Yield Delta", originalWeight: 10 },
    { factorId: "F4 Fed Bias / Policy Liquidity", factorName: "Fed Bias / Policy Liquidity", originalWeight: 10 },
    { factorId: "F5 VIX Level and Risk Regime", factorName: "VIX Level and Risk Regime", originalWeight: 16 },
    { factorId: "F6 NQ / High-Beta Risk Confirmation", factorName: "NQ / High-Beta Risk Confirmation", originalWeight: 14 },
    { factorId: "F7 US Economic Surprise Direction", factorName: "US Economic Surprise Direction", originalWeight: 6 },
    { factorId: "F8 BTC ETF / Institutional Flow", factorName: "BTC ETF / Institutional Flow", originalWeight: 8 },
    { factorId: "F9 Stablecoin / Crypto Liquidity", factorName: "Stablecoin / Crypto Liquidity", originalWeight: 3 },
    { factorId: "F10 BTC Dominance / Crypto Structure", factorName: "BTC Dominance / Crypto Structure", originalWeight: 3 }
  ])
});

function roundNumber(value, digits = 1) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeDirection(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized.includes("BULLISH")) return "BULLISH";
  if (normalized.includes("BEARISH")) return "BEARISH";
  return null;
}

function invertDirection(direction) {
  if (direction === "BULLISH") return "BEARISH";
  if (direction === "BEARISH") return "BULLISH";
  return null;
}

function derivePairCallDirection(targetDirection, usdDirection) {
  if (!targetDirection || !usdDirection || targetDirection === usdDirection) return null;
  return targetDirection === "BULLISH" && usdDirection === "BEARISH" ? "BULLISH" : "BEARISH";
}

function classifySampleSize(totalObservations) {
  if (totalObservations < 10) return "very_low_sample";
  if (totalObservations < 30) return "low_sample";
  if (totalObservations < 100) return "usable_sample";
  return "strong_sample";
}

function classifyDirectionalReliability(exFlatWrPct, directionalSample) {
  if (!directionalSample) return "insufficient_directional_sample";
  if (exFlatWrPct >= 65) return "strong_positive_evidence";
  if (exFlatWrPct >= 58) return "moderate_positive_evidence";
  if (exFlatWrPct >= 52) return "weak_positive_evidence";
  if (exFlatWrPct >= 48) return "no_edge";
  return "negative_evidence";
}

function safeMedian(values) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function computeMoveStats(moves) {
  if (!moves.length) {
    return {
      averageRealisedMovePct: null,
      medianRealisedMovePct: null
    };
  }

  const average = moves.reduce((sum, value) => sum + value, 0) / moves.length;
  return {
    averageRealisedMovePct: roundNumber(average, 4),
    medianRealisedMovePct: roundNumber(safeMedian(moves), 4)
  };
}

function buildStateStats(observations, expectedDirection) {
  const priceMovedBullishCount = observations.filter((item) => item.outcomeDirection === "BULLISH").length;
  const priceMovedBearishCount = observations.filter((item) => item.outcomeDirection === "BEARISH").length;
  const flatCount = observations.filter((item) => item.outcomeDirection === "FLAT").length;
  const directionalSample = priceMovedBullishCount + priceMovedBearishCount;
  const wins = expectedDirection === "BULLISH" ? priceMovedBullishCount : priceMovedBearishCount;
  const losses = expectedDirection === "BULLISH" ? priceMovedBearishCount : priceMovedBullishCount;
  const exFlatWrPct = directionalSample ? roundNumber((wins / directionalSample) * 100, 1) : null;
  const flatRatePct = observations.length ? roundNumber((flatCount / observations.length) * 100, 1) : null;
  const moveStats = computeMoveStats(observations.map((item) => item.realisedMovePct).filter((item) => Number.isFinite(item)));

  return {
    total_observations: observations.length,
    sample_count: observations.length,
    price_moved_bullish_count: priceMovedBullishCount,
    price_moved_bearish_count: priceMovedBearishCount,
    flat_count: flatCount,
    ex_flat_wr_pct: exFlatWrPct,
    flat_rate_pct: flatRatePct,
    directional_sample: directionalSample,
    wins,
    losses,
    sample_size_label: classifySampleSize(observations.length),
    reliability_label: classifyDirectionalReliability(exFlatWrPct, directionalSample),
    directional_reliability_label: classifyDirectionalReliability(exFlatWrPct, directionalSample),
    average_realised_24h_move_pct: moveStats.averageRealisedMovePct,
    median_realised_24h_move_pct: moveStats.medianRealisedMovePct
  };
}

function buildAlignmentStats(observations) {
  const aligned = observations.filter((item) => item.alignment === "aligned");
  const contradicted = observations.filter((item) => item.alignment === "contradicted");
  const alignedState = buildStateStats(aligned, "BULLISH");
  const contradictedState = buildStateStats(contradicted, "BULLISH");

  return {
    agrees_with_final_call: {
      sample_count: aligned.length,
      ex_flat_wr_pct: alignedState.ex_flat_wr_pct,
      flat_count: alignedState.flat_count,
      flat_rate_pct: alignedState.flat_rate_pct,
      wins: alignedState.wins,
      losses: alignedState.losses
    },
    contradicts_final_call: {
      sample_count: contradicted.length,
      ex_flat_wr_pct: contradictedState.ex_flat_wr_pct,
      flat_count: contradictedState.flat_count,
      flat_rate_pct: contradictedState.flat_rate_pct,
      wins: contradictedState.wins,
      losses: contradictedState.losses
    },
    times_factor_agreed_with_final_call: aligned.length,
    aligned_wins: aligned.filter((item) => item.alignmentOutcome === "WIN").length,
    aligned_losses: aligned.filter((item) => item.alignmentOutcome === "LOSS").length,
    aligned_flats: aligned.filter((item) => item.alignmentOutcome === "FLAT").length,
    aligned_ex_flat_wr_pct: alignedState.ex_flat_wr_pct,
    times_factor_contradicted_final_call: contradicted.length,
    contradicting_wins: contradicted.filter((item) => item.alignmentOutcome === "WIN").length,
    contradicting_losses: contradicted.filter((item) => item.alignmentOutcome === "LOSS").length,
    contradicting_flats: contradicted.filter((item) => item.alignmentOutcome === "FLAT").length,
    contradicting_ex_flat_wr_pct: contradictedState.ex_flat_wr_pct,
    skipped_no_final_call_count: observations.filter((item) => item.alignment === "unavailable").length
  };
}

function buildNeutralStats(observations) {
  return {
    total_observations: observations.length,
    neutral_no_signal_count: observations.length,
    sample_size_label: classifySampleSize(observations.length),
    note: "Includes neutral or non-directional factor states. These rows are excluded from directional reliability scoring."
  };
}

function buildFactorProfile({ bullishState, bearishState, neutralState, suggestedInterpretation }) {
  const totalObservations = (bullishState?.sample_count || 0) + (bearishState?.sample_count || 0) + (neutralState?.total_observations || 0);
  const flatCount = (bullishState?.flat_count || 0) + (bearishState?.flat_count || 0);
  const flatRatePct = totalObservations ? roundNumber((flatCount / totalObservations) * 100, 1) : null;
  const directionalSample = (bullishState?.directional_sample || 0) + (bearishState?.directional_sample || 0);
  const rankedStates = [
    { label: "bullish", value: bullishState?.ex_flat_wr_pct, reliabilityLabel: bullishState?.reliability_label },
    { label: "bearish", value: bearishState?.ex_flat_wr_pct, reliabilityLabel: bearishState?.reliability_label }
  ]
    .filter((item) => Number.isFinite(item.value))
    .sort((a, b) => b.value - a.value);
  const strongestStateLabel = rankedStates[0]?.label || null;
  const strongestReliabilityLabel = rankedStates[0]?.reliabilityLabel || "insufficient_directional_sample";

  return {
    bullish_sample_count: bullishState?.sample_count || 0,
    bearish_sample_count: bearishState?.sample_count || 0,
    neutral_no_signal_count: neutralState?.neutral_no_signal_count || 0,
    bullish_ex_flat_wr_pct: bullishState?.ex_flat_wr_pct ?? null,
    bearish_ex_flat_wr_pct: bearishState?.ex_flat_wr_pct ?? null,
    flat_count: flatCount,
    flat_rate_pct: flatRatePct,
    directional_sample_count: directionalSample,
    reliability_label: strongestReliabilityLabel,
    strongest_state_label: strongestStateLabel,
    suggested_interpretation: suggestedInterpretation || "insufficient_directional_sample"
  };
}

function computeComparablePctMove(openPrice, closePrice) {
  const open = toNumber(openPrice);
  const close = toNumber(closePrice);
  if (!Number.isFinite(open) || !Number.isFinite(close) || open === 0) return null;
  return ((close - open) / open) * 100;
}

function classifyOutcomeDirection(pctMove, marketKey) {
  const outcome = classifyMarketOutcome(pctMove, marketKey);
  return outcome.market_outcome_direction || null;
}

function factorDefinitionIndex(assetCode) {
  return new Map((FACTOR_DEFINITIONS[assetCode] || []).map((definition) => [definition.factorId, definition]));
}

function signalFromFactorComparison(factorComparison) {
  return String(factorComparison?.signal?.stored || factorComparison?.signal?.rerun || "").trim().toUpperCase();
}

function weightFromFactorComparison(factorComparison) {
  return toNumber(factorComparison?.weight?.stored) ?? toNumber(factorComparison?.weight?.rerun);
}

function buildWeightMismatch({
  originalWeight,
  bullishState,
  bearishState,
  combinedReliabilityPct,
  directionalSample
}) {
  const weightPct = Number.isFinite(originalWeight) ? originalWeight : null;
  const bullishPct = bullishState.ex_flat_wr_pct;
  const bearishPct = bearishState.ex_flat_wr_pct;
  const bestDirectionalPct = [bullishPct, bearishPct, combinedReliabilityPct].filter((value) => Number.isFinite(value));
  const strongestPct = bestDirectionalPct.length ? Math.max(...bestDirectionalPct) : null;
  const mismatchVsNeutral = strongestPct === null || weightPct === null ? null : roundNumber(strongestPct - weightPct, 1);
  let interpretation = "weight_and_realised_edge_are_broadly_consistent";

  if (!directionalSample) {
    interpretation = "insufficient_directional_sample";
  } else if (weightPct !== null && strongestPct !== null) {
    if (weightPct >= 14 && strongestPct < 48) interpretation = "high_weight_but_negative_realised_evidence";
    else if (weightPct <= 6 && strongestPct >= 65) interpretation = "low_weight_but_strong_realised_evidence";
    else if (Number.isFinite(bullishPct) && Number.isFinite(bearishPct) && Math.abs(bullishPct - bearishPct) >= 15) interpretation = "asymmetric_directional_factor";
    else if (combinedReliabilityPct !== null && combinedReliabilityPct < 48) interpretation = "factor_underperforms_historically";
    else if (combinedReliabilityPct !== null && combinedReliabilityPct >= 58) interpretation = "factor_supports_current_weighting";
  }

  return {
    original_factor_weight: weightPct,
    realised_bullish_ex_flat_wr_pct: bullishPct,
    realised_bearish_ex_flat_wr_pct: bearishPct,
    combined_factor_reliability_pct: combinedReliabilityPct,
    directional_sample: directionalSample,
    mismatch_vs_weight_points: mismatchVsNeutral,
    suggested_interpretation: interpretation
  };
}

function strongestFactorBy(entityFactors, selector) {
  const ranked = entityFactors
    .map((factor) => ({ factor, score: selector(factor) }))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => (
      b.score - a.score
      || (b.factor.weight_mismatch?.directional_sample || 0) - (a.factor.weight_mismatch?.directional_sample || 0)
      || String(a.factor.factor_id).localeCompare(String(b.factor.factor_id))
    ));

  if (!ranked.length) return null;
  return {
    factor_id: ranked[0].factor.factor_id,
    factor_name: ranked[0].factor.factor_name,
    score: ranked[0].score
  };
}

module.exports = {
  CHECKER_PATHS,
  FACTOR_DEFINITIONS,
  LAYER1_CONFIGS,
  LAYER2_CONFIGS,
  buildAlignmentStats,
  buildFactorProfile,
  buildNeutralStats,
  buildStateStats,
  buildWeightMismatch,
  classifyDirectionalReliability,
  classifyOutcomeDirection,
  classifySampleSize,
  computeComparablePctMove,
  derivePairCallDirection,
  factorDefinitionIndex,
  invertDirection,
  normalizeDirection,
  roundNumber,
  signalFromFactorComparison,
  strongestFactorBy,
  toNumber,
  weightFromFactorComparison
};
