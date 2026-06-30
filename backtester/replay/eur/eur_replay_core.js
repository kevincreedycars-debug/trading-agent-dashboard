const fs = require("fs");
const path = require("path");
const {
  computeHeadlineConfidenceData,
  deriveConfidenceStrength
} = require("../../lib/headline_confidence");

const LOGIC_DOCUMENT = "agent_eur_direction.md";
const LIVE_24H_FACTOR_WEIGHTS = Object.freeze({
  F1: 20,
  F2: 18,
  F3: 20,
  F4: 14,
  F5: 4,
  F6: 12,
  F7: 4,
  F8: 4,
  F9: 2,
  F10: 2
});

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function toNumber(value) {
  if (!hasValue(value)) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function makeFactor(signal, evidence, reason, weight) {
  return { signal, evidence, reason, weight };
}

function pctLabel(value) {
  const numeric = toNumber(value);
  return numeric === null ? "missing" : `${Math.round(numeric * 100) / 100}`;
}

function deriveHeadlineConfidencePercent({
  bullCase,
  bearCase,
  participation,
  netEdge,
  missingInputsCount = 0
}) {
  return computeHeadlineConfidenceData({
    bullCase,
    bearCase,
    participation,
    netEdge,
    missingInputsCount
  }).value;
}

function parseLogicVersion() {
  const logicPath = path.resolve(__dirname, "../../../logic/agent_eur_direction.md");
  const text = fs.readFileSync(logicPath, "utf8");
  const explicitMachineVersion = text.match(/"logic_document_version":\s*"([^"]+)"/);
  if (explicitMachineVersion) {
    return explicitMachineVersion[1];
  }

  const headlineVersion = text.match(/Version:\s*([^\r\n]+)/i);
  if (headlineVersion) {
    return String(headlineVersion[1]).trim();
  }

  return "unknown";
}

function chooseDelta24h(d1, d5, d20) {
  if (toNumber(d1) !== null) return toNumber(d1);
  if (toNumber(d5) !== null) return toNumber(d5);
  if (toNumber(d20) !== null) return toNumber(d20);
  return null;
}

function build24hFactors(snapshot) {
  const missingInputs = [];
  const ecb = String(snapshot.ecb_bias || "").toLowerCase();
  const de2yDelta = chooseDelta24h(null, snapshot.de_2y_d5_bps, snapshot.de_2y_d20_bps);
  const spreadDelta = chooseDelta24h(null, snapshot.us_de_2y_spread_d5_bps, snapshot.us_de_2y_spread_d20_bps);
  const eurDelta = chooseDelta24h(snapshot.eurusd_d1_pct, snapshot.eurusd_d5_pct, snapshot.eurusd_d20_pct);
  const goldDelta = chooseDelta24h(snapshot.gold_d1_pct, snapshot.gold_d5_pct, snapshot.gold_d20_pct);
  const vix = toNumber(snapshot.vix_level);
  const pmi = toNumber(snapshot.ez_composite_pmi);
  const pmiDirection = String(snapshot.ez_composite_pmi_direction || "").toLowerCase();
  const stress = String(snapshot.ez_stress_flag || "").toLowerCase();
  const growth = String(snapshot.global_growth_regime || snapshot.china_growth_signal || "").toLowerCase();
  const latestEzEvent = snapshot.latest_ez_event ?? null;
  const latestEzEventText = JSON.stringify(latestEzEvent || {}).toLowerCase();

  const factors = {};

  factors.F1 = (() => {
    if (!ecb || ecb === "unknown") {
      missingInputs.push("ecb_bias");
      return makeFactor("NEUTRAL", "ECB bias unknown", "Missing input", LIVE_24H_FACTOR_WEIGHTS.F1);
    }
    if (ecb.includes("hawkish")) {
      return makeFactor("BULLISH", `ECB bias ${ecb}`, "Hawkish ECB bias supports EUR", LIVE_24H_FACTOR_WEIGHTS.F1);
    }
    if (ecb.includes("dovish")) {
      return makeFactor("BEARISH", `ECB bias ${ecb}`, "Dovish ECB bias pressures EUR", LIVE_24H_FACTOR_WEIGHTS.F1);
    }
    return makeFactor("NEUTRAL", `ECB bias ${ecb}`, "No clear ECB impulse", LIVE_24H_FACTOR_WEIGHTS.F1);
  })();

  factors.F2 = (() => {
    if (de2yDelta === null) {
      missingInputs.push("de_2y_d5_bps");
      return makeFactor("NEUTRAL", "Missing Germany 2Y delta", "Missing input", LIVE_24H_FACTOR_WEIGHTS.F2);
    }
    if (de2yDelta >= 5) {
      return makeFactor("BULLISH", `Germany 2Y delta ${pctLabel(de2yDelta)} bps`, "Rising German front-end yields support EUR", LIVE_24H_FACTOR_WEIGHTS.F2);
    }
    if (de2yDelta <= -5) {
      return makeFactor("BEARISH", `Germany 2Y delta ${pctLabel(de2yDelta)} bps`, "Falling German front-end yields pressure EUR", LIVE_24H_FACTOR_WEIGHTS.F2);
    }
    return makeFactor("NEUTRAL", `Germany 2Y delta ${pctLabel(de2yDelta)} bps`, "German 2Y move below threshold", LIVE_24H_FACTOR_WEIGHTS.F2);
  })();

  factors.F3 = (() => {
    if (spreadDelta === null) {
      missingInputs.push("us_de_2y_spread_d5_bps");
      return makeFactor("NEUTRAL", "Missing US-DE 2Y spread delta", "Missing input", LIVE_24H_FACTOR_WEIGHTS.F3);
    }
    if (spreadDelta <= -5) {
      return makeFactor("BULLISH", `US-DE 2Y spread delta ${pctLabel(spreadDelta)} bps`, "US-DE spread narrowing supports EUR", LIVE_24H_FACTOR_WEIGHTS.F3);
    }
    if (spreadDelta >= 5) {
      return makeFactor("BEARISH", `US-DE 2Y spread delta ${pctLabel(spreadDelta)} bps`, "US-DE spread widening pressures EUR", LIVE_24H_FACTOR_WEIGHTS.F3);
    }
    return makeFactor("NEUTRAL", `US-DE 2Y spread delta ${pctLabel(spreadDelta)} bps`, "Spread move below threshold", LIVE_24H_FACTOR_WEIGHTS.F3);
  })();

  factors.F4 = (() => {
    if (!latestEzEvent) {
      missingInputs.push("latest_ez_event");
      return makeFactor("NEUTRAL", "No recent Eurozone event", "No confirmed EZ economic surprise", LIVE_24H_FACTOR_WEIGHTS.F4);
    }
    if (latestEzEventText.includes("bullish") || latestEzEventText.includes("positive") || latestEzEventText.includes("beat")) {
      return makeFactor("BULLISH", JSON.stringify(latestEzEvent), "Positive Eurozone surprise supports EUR", LIVE_24H_FACTOR_WEIGHTS.F4);
    }
    if (latestEzEventText.includes("bearish") || latestEzEventText.includes("negative") || latestEzEventText.includes("miss")) {
      return makeFactor("BEARISH", JSON.stringify(latestEzEvent), "Negative Eurozone surprise pressures EUR", LIVE_24H_FACTOR_WEIGHTS.F4);
    }
    return makeFactor("NEUTRAL", JSON.stringify(latestEzEvent), "No clear EUR economic surprise signal", LIVE_24H_FACTOR_WEIGHTS.F4);
  })();

  factors.F5 = (() => {
    if (pmi === null && !pmiDirection) {
      missingInputs.push("ez_composite_pmi");
      return makeFactor("NEUTRAL", "Missing EZ PMI trend", "Missing input", LIVE_24H_FACTOR_WEIGHTS.F5);
    }
    if ((pmi !== null && pmi > 50 && pmiDirection.includes("rising")) || pmiDirection.includes("improving")) {
      return makeFactor("BULLISH", `EZ PMI ${pmi ?? "unknown"} ${pmiDirection}`.trim(), "Improving Eurozone PMI trend supports EUR", LIVE_24H_FACTOR_WEIGHTS.F5);
    }
    if ((pmi !== null && pmi < 50) || pmiDirection.includes("falling") || pmiDirection.includes("deteriorating")) {
      return makeFactor("BEARISH", `EZ PMI ${pmi ?? "unknown"} ${pmiDirection}`.trim(), "Weak or deteriorating Eurozone PMI trend pressures EUR", LIVE_24H_FACTOR_WEIGHTS.F5);
    }
    return makeFactor("NEUTRAL", `EZ PMI ${pmi ?? "unknown"} ${pmiDirection}`.trim(), "PMI trend not decisive", LIVE_24H_FACTOR_WEIGHTS.F5);
  })();

  factors.F6 = (() => {
    if (eurDelta === null) {
      missingInputs.push("eurusd_d1_pct");
      return makeFactor("NEUTRAL", "Missing EURUSD delta", "Missing input", LIVE_24H_FACTOR_WEIGHTS.F6);
    }
    if (eurDelta >= 0.2) {
      return makeFactor("BULLISH", `EURUSD delta ${pctLabel(eurDelta)}%`, "EUR own price delta confirms bullish pressure", LIVE_24H_FACTOR_WEIGHTS.F6);
    }
    if (eurDelta <= -0.2) {
      return makeFactor("BEARISH", `EURUSD delta ${pctLabel(eurDelta)}%`, "EUR own price delta confirms bearish pressure", LIVE_24H_FACTOR_WEIGHTS.F6);
    }
    return makeFactor("NEUTRAL", `EURUSD delta ${pctLabel(eurDelta)}%`, "EUR own price move below threshold", LIVE_24H_FACTOR_WEIGHTS.F6);
  })();

  factors.F7 = (() => {
    if (goldDelta === null) {
      missingInputs.push("gold_d1_pct");
      return makeFactor("NEUTRAL", "Missing gold delta", "Missing input", LIVE_24H_FACTOR_WEIGHTS.F7);
    }
    if (goldDelta >= 0.3) {
      return makeFactor("BULLISH", `Gold delta ${pctLabel(goldDelta)}%`, "Gold strength confirms anti-USD pressure supportive for EUR", LIVE_24H_FACTOR_WEIGHTS.F7);
    }
    if (goldDelta <= -0.3) {
      return makeFactor("BEARISH", `Gold delta ${pctLabel(goldDelta)}%`, "Gold weakness confirms USD strength pressure against EUR", LIVE_24H_FACTOR_WEIGHTS.F7);
    }
    return makeFactor("NEUTRAL", `Gold delta ${pctLabel(goldDelta)}%`, "Gold move below confirmation threshold", LIVE_24H_FACTOR_WEIGHTS.F7);
  })();

  factors.F8 = (() => {
    if (!stress || stress === "null" || stress === "unknown") {
      missingInputs.push("ez_stress_flag");
      return makeFactor("NEUTRAL", "EZ stress unavailable", "Missing or inactive stress input", LIVE_24H_FACTOR_WEIGHTS.F8);
    }
    if (stress.includes("active") || stress.includes("true") || stress.includes("elevated") || stress.includes("risk") || stress.includes("stress")) {
      return makeFactor("BEARISH", `EZ stress ${stress}`, "Eurozone stress is bearish EUR", LIVE_24H_FACTOR_WEIGHTS.F8);
    }
    return makeFactor("NEUTRAL", `EZ stress ${stress}`, "No active Eurozone stress signal", LIVE_24H_FACTOR_WEIGHTS.F8);
  })();

  factors.F9 = (() => {
    if (!growth || growth === "null" || growth === "unknown") {
      missingInputs.push("global_growth_regime");
      return makeFactor("NEUTRAL", "Global growth unavailable", "Missing input", LIVE_24H_FACTOR_WEIGHTS.F9);
    }
    if (growth.includes("expanding") || growth.includes("positive") || growth.includes("improving") || growth.includes("risk_on")) {
      return makeFactor("BULLISH", `Growth regime ${growth}`, "Global growth expansion supports EUR", LIVE_24H_FACTOR_WEIGHTS.F9);
    }
    if (growth.includes("contracting") || growth.includes("negative") || growth.includes("deteriorating") || growth.includes("risk_off")) {
      return makeFactor("BEARISH", `Growth regime ${growth}`, "Global growth deterioration pressures EUR", LIVE_24H_FACTOR_WEIGHTS.F9);
    }
    return makeFactor("NEUTRAL", `Growth regime ${growth}`, "Global growth signal mixed", LIVE_24H_FACTOR_WEIGHTS.F9);
  })();

  factors.F10 = (() => {
    if (vix === null) {
      missingInputs.push("vix_level");
      return makeFactor("NEUTRAL", "Missing VIX", "Missing input", LIVE_24H_FACTOR_WEIGHTS.F10);
    }
    if (vix < 16) {
      return makeFactor("BULLISH", `VIX ${vix}`, "Risk-on regime supports EUR versus safe-haven USD", LIVE_24H_FACTOR_WEIGHTS.F10);
    }
    if (vix > 25) {
      return makeFactor("BEARISH", `VIX ${vix}`, "Risk-off regime favours USD over EUR", LIVE_24H_FACTOR_WEIGHTS.F10);
    }
    return makeFactor("NEUTRAL", `VIX ${vix}`, "Neutral risk regime", LIVE_24H_FACTOR_WEIGHTS.F10);
  })();

  return {
    factors,
    missingInputs: Array.from(new Set(missingInputs))
  };
}

function score24h(snapshot) {
  const { factors, missingInputs } = build24hFactors(snapshot);
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;

  for (const factor of Object.values(factors)) {
    if (factor.signal === "BULLISH") {
      bullish += factor.weight;
      bullishCount += 1;
    } else if (factor.signal === "BEARISH") {
      bearish += factor.weight;
      bearishCount += 1;
    } else {
      neutral += factor.weight;
      neutralCount += 1;
    }
  }

  const active = bullish + bearish;
  const bullishArgument = active > 0 ? Math.round((bullish / active) * 100) : 0;
  const bearishArgument = active > 0 ? Math.round((bearish / active) * 100) : 0;
  const netEdge = bullishArgument - bearishArgument;
  const baseDirection =
    bullish > bearish ? "BULLISH" :
    bearish > bullish ? "BEARISH" :
    "NO_CLEAR_BIAS";
  const direction =
    baseDirection === "NO_CLEAR_BIAS" ? "NO_CLEAR_BIAS" :
    Math.abs(netEdge) < 20 ? `${baseDirection}_LEAN` :
    baseDirection;
  const conviction =
    baseDirection === "BULLISH" ? bullishArgument :
    baseDirection === "BEARISH" ? bearishArgument :
    0;
  const edgeStrength =
    Math.abs(netEdge) >= 40 ? "VERY_STRONG" :
    Math.abs(netEdge) >= 25 ? "STRONG" :
    Math.abs(netEdge) >= 15 ? "MODERATE" :
    "WEAK";
  const headlineConfidence = deriveHeadlineConfidencePercent({
    bullCase: bullishArgument,
    bearCase: bearishArgument,
    participation: Math.round(active),
    netEdge,
    missingInputsCount: missingInputs.length
  });
  const confidenceStrength = deriveConfidenceStrength(
    headlineConfidence,
    netEdge,
    Math.round(active),
    direction
  );
  const reason = `24h EUR deterministic score: bull case ${bullishArgument}%, bear case ${bearishArgument}%, neutral/inactive ${Math.round(neutral)}%, directional participation ${Math.round(active)}%, net edge ${netEdge > 0 ? "+" : ""}${netEdge}.`;

  return {
    direction,
    conviction,
    reason,
    factor_breakdown: factors,
    score_bullish: bullishCount,
    score_bearish: bearishCount,
    score_neutral: neutralCount,
    weighted_score: {
      bullish_weight: bullish,
      bearish_weight: bearish,
      neutral_weight: neutral,
      active_weight: active,
      weight_margin: Math.abs(bullish - bearish)
    },
    conviction_model: {
      bullish_argument_pct: bullishArgument,
      bearish_argument_pct: bearishArgument,
      neutral_evidence_pct: Math.round(neutral),
      neutral_pct: Math.round(neutral),
      directional_participation_pct: Math.round(active),
      active_participation_pct: Math.round(active),
      winning_side: baseDirection,
      net_edge_pct: netEdge,
      final_conviction: conviction,
      final_confidence: headlineConfidence,
      headline_confidence_pct: headlineConfidence,
      verdict_strength: edgeStrength,
      confidence_strength: confidenceStrength,
      bull_case_weight: bullish,
      bear_case_weight: bearish,
      neutral_weight: neutral,
      final_conviction_logic: reason,
      weighted_edge: Math.abs(netEdge) / 100,
      raw_conviction: conviction,
      base_conviction: conviction,
      participation: Math.round(active),
      participation_cap: Math.round(active),
      conflict_penalty: 0,
      missing_input_penalty: 0,
      agreement_boost: 0
    },
    missing_inputs: missingInputs,
    risk_flags: []
  };
}

function buildReplayOutput(snapshot, logicDocumentVersion = parseLogicVersion()) {
  const result24h = score24h(snapshot);
  return {
    asset: "EUR",
    layer: "layer_1_raw",
    logic_document: LOGIC_DOCUMENT,
    logic_document_version: logicDocumentVersion,
    direction_24h: result24h.direction,
    conviction_24h: result24h.conviction,
    reason_24h: result24h.reason,
    score_bullish: result24h.score_bullish,
    score_bearish: result24h.score_bearish,
    score_neutral: result24h.score_neutral,
    non_neutral_count: result24h.score_bullish + result24h.score_bearish,
    missing_inputs: result24h.missing_inputs,
    weighted_score: result24h.weighted_score,
    conviction_model: result24h.conviction_model,
    factor_breakdown: result24h.factor_breakdown,
    risk_flags: result24h.risk_flags,
    timeframe_models: {
      "24h": {
        reason: result24h.reason,
        direction: result24h.direction,
        conviction: result24h.conviction,
        score_bullish: result24h.score_bullish,
        score_bearish: result24h.score_bearish,
        score_neutral: result24h.score_neutral,
        weighted_score: result24h.weighted_score,
        conviction_model: result24h.conviction_model,
        factor_breakdown: result24h.factor_breakdown
      }
    }
  };
}

module.exports = {
  LIVE_24H_FACTOR_WEIGHTS,
  buildReplayOutput,
  parseLogicVersion
};
