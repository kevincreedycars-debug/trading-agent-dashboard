const fs = require("fs");
const path = require("path");
const { computeHeadlineConfidenceData, deriveConfidenceStrength } = require("../../lib/headline_confidence");

const LOGIC_DOCUMENT = "agent_gbp_direction.md";
const LIVE_24H_FACTOR_WEIGHTS = Object.freeze({ F1: 20, F2: 16, F3: 20, F4: 12, F5: 8, F6: 10, F7: 6, F8: 4, F9: 2, F10: 2 });

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function makeFactor(signal, evidence, reason, weight) {
  return { signal, evidence, reason, weight };
}

function eventSignal(event) {
  const text = JSON.stringify(event || {}).toLowerCase();
  if (/bullish|positive|beat/.test(text)) return "BULLISH";
  if (/bearish|negative|miss/.test(text)) return "BEARISH";
  return "NEUTRAL";
}

function parseLogicVersion() {
  const text = fs.readFileSync(path.resolve(__dirname, "../../../logic/agent_gbp_direction.md"), "utf8");
  return text.match(/Version:\s*([^\r\n]+)/i)?.[1]?.trim() || "unknown";
}

function build24hFactors(snapshot = {}) {
  const missingInputs = [];
  const missing = (key, evidence) => {
    missingInputs.push(key);
    return makeFactor("NEUTRAL", evidence, "Missing input", LIVE_24H_FACTOR_WEIGHTS[key]);
  };
  const factors = {};
  const boe = String(snapshot.boe_bias || "").toLowerCase();
  const uk2yDelta = numberOrNull(snapshot.uk_2y_d5_bps);
  const spreadDelta = numberOrNull(snapshot.us_uk_2y_spread_d5_bps);
  const pmi = numberOrNull(snapshot.uk_composite_pmi);
  const pmiDirection = String(snapshot.uk_composite_pmi_direction || "").toLowerCase();
  const gbpDelta = numberOrNull(snapshot.gbpusd_d1_pct);
  const dxyDelta = numberOrNull(snapshot.dxy_d1_pct);
  const vix = numberOrNull(snapshot.vix_level);
  const growth = String(snapshot.global_growth_regime || "").toLowerCase();
  const stress = String(snapshot.uk_stress_flag || "").toLowerCase();

  factors.F1 = !boe || boe === "unknown"
    ? missing("F1", "BoE bias unavailable")
    : boe.includes("hawkish")
      ? makeFactor("BULLISH", `BoE bias ${boe}`, "Hawkish BoE bias supports GBP", LIVE_24H_FACTOR_WEIGHTS.F1)
      : boe.includes("dovish")
        ? makeFactor("BEARISH", `BoE bias ${boe}`, "Dovish BoE bias pressures GBP", LIVE_24H_FACTOR_WEIGHTS.F1)
        : makeFactor("NEUTRAL", `BoE bias ${boe}`, "No clear BoE impulse", LIVE_24H_FACTOR_WEIGHTS.F1);
  factors.F2 = uk2yDelta === null
    ? missing("F2", "UK 2Y delta unavailable")
    : uk2yDelta >= 5
      ? makeFactor("BULLISH", `UK 2Y delta ${uk2yDelta} bps`, "Rising UK front-end yields support GBP", LIVE_24H_FACTOR_WEIGHTS.F2)
      : uk2yDelta <= -5
        ? makeFactor("BEARISH", `UK 2Y delta ${uk2yDelta} bps`, "Falling UK front-end yields pressure GBP", LIVE_24H_FACTOR_WEIGHTS.F2)
        : makeFactor("NEUTRAL", `UK 2Y delta ${uk2yDelta} bps`, "UK 2Y move below threshold", LIVE_24H_FACTOR_WEIGHTS.F2);
  factors.F3 = spreadDelta === null
    ? missing("F3", "US-UK 2Y spread delta unavailable")
    : spreadDelta <= -5
      ? makeFactor("BULLISH", `US-UK 2Y spread delta ${spreadDelta} bps`, "Narrowing US-UK spread supports GBP", LIVE_24H_FACTOR_WEIGHTS.F3)
      : spreadDelta >= 5
        ? makeFactor("BEARISH", `US-UK 2Y spread delta ${spreadDelta} bps`, "Widening US-UK spread pressures GBP", LIVE_24H_FACTOR_WEIGHTS.F3)
        : makeFactor("NEUTRAL", `US-UK 2Y spread delta ${spreadDelta} bps`, "Spread move below threshold", LIVE_24H_FACTOR_WEIGHTS.F3);
  const ukEvent = snapshot.latest_uk_event;
  factors.F4 = ukEvent === null || ukEvent === undefined
    ? missing("F4", "No recent UK event")
    : makeFactor(eventSignal(ukEvent), JSON.stringify(ukEvent), "UK economic surprise classification", LIVE_24H_FACTOR_WEIGHTS.F4);
  factors.F5 = pmi === null && !pmiDirection
    ? missing("F5", "UK PMI unavailable")
    : (pmi !== null && pmi > 50 && /rising|improving/.test(pmiDirection)) || /improving/.test(pmiDirection)
      ? makeFactor("BULLISH", `UK PMI ${pmi ?? "unknown"} ${pmiDirection}`.trim(), "Improving UK PMI supports GBP", LIVE_24H_FACTOR_WEIGHTS.F5)
      : (pmi !== null && pmi < 50) || /falling|deteriorating/.test(pmiDirection)
        ? makeFactor("BEARISH", `UK PMI ${pmi ?? "unknown"} ${pmiDirection}`.trim(), "Weak UK PMI pressures GBP", LIVE_24H_FACTOR_WEIGHTS.F5)
        : makeFactor("NEUTRAL", `UK PMI ${pmi ?? "unknown"} ${pmiDirection}`.trim(), "UK PMI trend not decisive", LIVE_24H_FACTOR_WEIGHTS.F5);
  factors.F6 = gbpDelta === null
    ? missing("F6", "GBPUSD delta unavailable")
    : gbpDelta >= 0.2
      ? makeFactor("BULLISH", `GBPUSD delta ${gbpDelta}%`, "GBP own-price delta confirms strength", LIVE_24H_FACTOR_WEIGHTS.F6)
      : gbpDelta <= -0.2
        ? makeFactor("BEARISH", `GBPUSD delta ${gbpDelta}%`, "GBP own-price delta confirms weakness", LIVE_24H_FACTOR_WEIGHTS.F6)
        : makeFactor("NEUTRAL", `GBPUSD delta ${gbpDelta}%`, "GBP own-price move below threshold", LIVE_24H_FACTOR_WEIGHTS.F6);
  factors.F7 = dxyDelta === null
    ? missing("F7", "DXY delta unavailable")
    : dxyDelta <= -0.2
      ? makeFactor("BULLISH", `DXY delta ${dxyDelta}%`, "Dollar weakness supports GBP", LIVE_24H_FACTOR_WEIGHTS.F7)
      : dxyDelta >= 0.2
        ? makeFactor("BEARISH", `DXY delta ${dxyDelta}%`, "Dollar strength pressures GBP", LIVE_24H_FACTOR_WEIGHTS.F7)
        : makeFactor("NEUTRAL", `DXY delta ${dxyDelta}%`, "DXY move below threshold", LIVE_24H_FACTOR_WEIGHTS.F7);
  factors.F8 = vix === null
    ? missing("F8", "VIX unavailable")
    : vix < 16
      ? makeFactor("BULLISH", `VIX ${vix}`, "Risk-on regime supports GBP", LIVE_24H_FACTOR_WEIGHTS.F8)
      : vix > 25
        ? makeFactor("BEARISH", `VIX ${vix}`, "Risk-off regime pressures GBP", LIVE_24H_FACTOR_WEIGHTS.F8)
        : makeFactor("NEUTRAL", `VIX ${vix}`, "Neutral risk regime", LIVE_24H_FACTOR_WEIGHTS.F8);
  factors.F9 = !growth || growth === "unknown"
    ? missing("F9", "Global growth unavailable")
    : /expanding|improving|risk_on/.test(growth)
      ? makeFactor("BULLISH", `Growth regime ${growth}`, "Global growth supports GBP", LIVE_24H_FACTOR_WEIGHTS.F9)
      : /contracting|deteriorating|risk_off/.test(growth)
        ? makeFactor("BEARISH", `Growth regime ${growth}`, "Global growth pressures GBP", LIVE_24H_FACTOR_WEIGHTS.F9)
        : makeFactor("NEUTRAL", `Growth regime ${growth}`, "Global growth mixed", LIVE_24H_FACTOR_WEIGHTS.F9);
  factors.F10 = !stress || stress === "unknown"
    ? missing("F10", "UK stress unavailable")
    : ["active", "true", "elevated", "stress", "risk"].includes(stress)
      ? makeFactor("BEARISH", `UK stress ${stress}`, "UK stress is bearish GBP", LIVE_24H_FACTOR_WEIGHTS.F10)
      : makeFactor("NEUTRAL", `UK stress ${stress}`, "No active UK stress signal", LIVE_24H_FACTOR_WEIGHTS.F10);

  return { factors, missingInputs: Array.from(new Set(missingInputs)) };
}

function score24h(snapshot = {}) {
  const { factors, missingInputs } = build24hFactors(snapshot);
  const totals = Object.values(factors).reduce((result, factor) => {
    result[factor.signal === "BULLISH" ? "bullish" : factor.signal === "BEARISH" ? "bearish" : "neutral"] += factor.weight;
    result[`${factor.signal.toLowerCase()}Count`] += 1;
    return result;
  }, { bullish: 0, bearish: 0, neutral: 0, bullishCount: 0, bearishCount: 0, neutralCount: 0 });
  const active = totals.bullish + totals.bearish;
  const bullishArgument = active ? Math.round((totals.bullish / active) * 100) : 0;
  const bearishArgument = active ? Math.round((totals.bearish / active) * 100) : 0;
  const netEdge = bullishArgument - bearishArgument;
  const winningSide = totals.bullish > totals.bearish ? "BULLISH" : totals.bearish > totals.bullish ? "BEARISH" : "NO_CLEAR_BIAS";
  const direction = winningSide === "NO_CLEAR_BIAS" ? winningSide : Math.abs(netEdge) < 20 ? `${winningSide}_LEAN` : winningSide;
  const confidence = winningSide === "BULLISH" ? bullishArgument : winningSide === "BEARISH" ? bearishArgument : 0;
  const headlineConfidence = computeHeadlineConfidenceData({ bullCase: bullishArgument, bearCase: bearishArgument, participation: active, netEdge, missingInputsCount: missingInputs.length }).value;
  const reason = `24h GBP research score: bull case ${bullishArgument}%, bear case ${bearishArgument}%, participation ${active}%, net edge ${netEdge >= 0 ? "+" : ""}${netEdge}.`;
  return {
    direction,
    conviction: confidence,
    reason,
    factor_breakdown: factors,
    missing_inputs: missingInputs,
    score_bullish: totals.bullishCount,
    score_bearish: totals.bearishCount,
    score_neutral: totals.neutralCount,
    weighted_score: { bullish_weight: totals.bullish, bearish_weight: totals.bearish, neutral_weight: totals.neutral, active_weight: active, weight_margin: Math.abs(totals.bullish - totals.bearish) },
    conviction_model: { bullish_argument_pct: bullishArgument, bearish_argument_pct: bearishArgument, neutral_evidence_pct: totals.neutral, directional_participation_pct: active, net_edge_pct: netEdge, winning_side: winningSide, final_conviction: confidence, headline_confidence_pct: headlineConfidence, confidence_strength: deriveConfidenceStrength(headlineConfidence, netEdge, active, direction) }
  };
}

function buildReplayOutput(snapshot, logicDocumentVersion = parseLogicVersion()) {
  const result = score24h(snapshot);
  return { asset: "GBP", layer: "layer_1_raw", logic_document: LOGIC_DOCUMENT, logic_document_version: logicDocumentVersion, direction_24h: result.direction, conviction_24h: result.conviction, reason_24h: result.reason, ...result, timeframe_models: { "24h": { ...result } } };
}

module.exports = { LIVE_24H_FACTOR_WEIGHTS, build24hFactors, buildReplayOutput, parseLogicVersion, score24h };
