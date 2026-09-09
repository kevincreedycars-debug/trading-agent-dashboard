const { EUR_PAIR_INVENTORY } = require("./pair_inventory");

const inventoryByCode = new Map(EUR_PAIR_INVENTORY.map((pair) => [pair.pairCode, pair]));

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function validIso(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function direction(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return ["BULLISH", "BEARISH", "NO_CLEAR_BIAS"].includes(normalized) ? normalized : null;
}

function assessSignal(signal, expectedAsset, asOf) {
  const reasons = [];
  if (!signal || signal.assetCode !== expectedAsset) reasons.push("wrong_asset");
  if (!signal?.sourceCallId) reasons.push("missing_source_call_id");
  if (!direction(signal?.direction)) reasons.push("unsupported_direction");
  if (finiteNumber(signal?.conviction) === null || signal.conviction < 0 || signal.conviction > 100) reasons.push("invalid_conviction");
  if (signal?.horizonHours !== 24) reasons.push("mismatched_horizon");
  if (!validIso(signal?.decisionAt) || Date.parse(signal.decisionAt) > asOf) reasons.push("invalid_decision_time");
  if (!validIso(signal?.availableAt) || Date.parse(signal.availableAt) > asOf) reasons.push("future_available");
  if (!validIso(signal?.expiresAt) || Date.parse(signal.expiresAt) <= asOf) reasons.push("expired");
  return reasons;
}

function assessPriceEvidence(evidence, pair, asOf) {
  const reasons = [];
  if (!evidence || !evidence.feedId || !evidence.instrument || !evidence.units) reasons.push("missing_price_identity");
  if (evidence?.orientation !== `${pair.baseAsset}/${pair.quoteAsset}`) reasons.push("wrong_price_orientation");
  if (!validIso(evidence?.observedAt) || Date.parse(evidence.observedAt) > asOf) reasons.push("invalid_price_time");
  if (evidence?.sourceType === "synthetic") {
    if (!Array.isArray(evidence.legs) || evidence.legs.length !== 2) reasons.push("synthetic_legs_required");
    if (!evidence?.timestampAligned) reasons.push("synthetic_timestamps_not_aligned");
    if (!evidence?.executionLimitations) reasons.push("synthetic_execution_limits_required");
  }
  if (!["direct", "synthetic"].includes(evidence?.sourceType)) reasons.push("unsupported_price_source");
  return reasons;
}

function derivePairDecision(baseDirection, quoteDirection) {
  if (baseDirection === "NO_CLEAR_BIAS" || quoteDirection === "NO_CLEAR_BIAS") return "NO_CLEAR_BIAS";
  if (baseDirection === quoteDirection) return "NO_CLEAR_BIAS";
  return baseDirection === "BULLISH" ? "BUY" : "SELL";
}

function assessEurPairReadiness(input = {}) {
  const pair = inventoryByCode.get(input.pairCode);
  const asOf = Date.parse(input.asOf || "");
  const reasons = [];
  if (!pair) reasons.push("unsupported_pair");
  if (!Number.isFinite(asOf)) reasons.push("invalid_as_of");
  if (!pair || !Number.isFinite(asOf)) return { ready: false, tradable: false, decision: null, reasons };

  reasons.push(...assessSignal(input.baseSignal, pair.baseAsset, asOf));
  reasons.push(...assessSignal(input.quoteSignal, pair.quoteAsset, asOf));
  reasons.push(...assessPriceEvidence(input.priceEvidence, pair, asOf));
  const ready = reasons.length === 0;
  const decision = ready ? derivePairDecision(input.baseSignal.direction, input.quoteSignal.direction) : null;
  return {
    pairCode: pair.pairCode,
    pairLabel: pair.pairLabel,
    ready,
    tradable: ready && decision !== "NO_CLEAR_BIAS",
    decision,
    combinedConviction: ready ? Math.min(input.baseSignal.conviction, input.quoteSignal.conviction) : null,
    reasons: [...new Set(reasons)]
  };
}

module.exports = { assessEurPairReadiness, derivePairDecision };