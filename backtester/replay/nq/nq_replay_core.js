const fs = require("fs");
const path = require("path");
const {
  computeHeadlineConfidenceData,
  deriveConfidenceStrength
} = require("../../lib/headline_confidence");

const LOGIC_DOCUMENT = "agent_nq_direction.md";
const TIMEFRAME_WEIGHTS = Object.freeze({
  "24h": {
    F1: 20, F2: 14, F3: 12, F4: 6, F5: 14,
    F6: 12, F7: 8, F8: 10, F9: 2, F10: 2
  },
  "3d": {
    F1: 18, F2: 14, F3: 12, F4: 7, F5: 16,
    F6: 14, F7: 7, F8: 7, F9: 3, F10: 2
  },
  current_week: {
    F1: 16, F2: 12, F3: 12, F4: 8, F5: 18,
    F6: 16, F7: 6, F8: 6, F9: 4, F10: 2
  },
  next_week: {
    F1: 14, F2: 8, F3: 12, F4: 8, F5: 20,
    F6: 20, F7: 5, F8: 5, F9: 5, F10: 3
  },
  current_month: {
    F1: 12, F2: 6, F3: 12, F4: 8, F5: 22,
    F6: 20, F7: 5, F8: 6, F9: 5, F10: 4
  }
});
const FACTOR_MISSING_INPUT_KEYS = Object.freeze({
  F1: ["vix_level"],
  F2: ["vix_d1", "vix_d5"],
  F3: ["dxy_d1", "dxy_d5", "dxy_d20"],
  F4: ["us_10y_d5_bps", "us_10y_d20_bps"],
  F5: ["us_10y_real_yield_d5_bps", "us_10y_real_yield_d20_bps"],
  F6: ["fed_bias"],
  F7: [],
  F8: ["nq_d1_pct", "nq_d5_pct", "nq_d20_pct"],
  F9: ["btc_d1_pct", "btc_d5_pct", "btc_d20_pct"],
  F10: ["gold_d1_pct", "gold_d5_pct", "gold_d20_pct"]
});

function n(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function makeFactor(signal, evidence, reason) {
  return { signal, evidence, reason };
}

function pctLabel(value) {
  const numeric = n(value);
  return numeric === null ? "missing" : `${Math.round(numeric * 100) / 100}`;
}

function parseLogicVersion() {
  const logicPath = path.resolve(__dirname, "../../../logic/agent_nq_direction.md");
  const text = fs.readFileSync(logicPath, "utf8");
  const explicitMachineVersion = text.match(/"logic_document_version":\s*"([^"]+)"/);
  if (explicitMachineVersion) {
    return explicitMachineVersion[1];
  }

  const headlineVersion = text.match(/\*\*Version:\*\*\s*([^\r\n]+)/i);
  if (headlineVersion) {
    return String(headlineVersion[1]).trim();
  }

  return "unknown";
}

function chooseDelta(timeframe, d1, d5, d20) {
  if (timeframe === "24h" && n(d1) !== null) return d1;
  if ((timeframe === "next_week" || timeframe === "current_month") && n(d20) !== null) return d20;
  if (n(d5) !== null) return d5;
  if (n(d1) !== null) return d1;
  return null;
}

function chooseRateDelta(timeframe, d5, d20) {
  if (timeframe === "24h") return 0;
  if ((timeframe === "next_week" || timeframe === "current_month") && n(d20) !== null) return d20;
  if (n(d5) !== null) return d5;
  return 0;
}

function chooseConfirmationDelta(timeframe, d1, d5, d20) {
  if (timeframe === "24h") {
    if (n(d5) !== null) return d5;
    if (n(d20) !== null) return d20;
    return null;
  }

  return 0;
}

function latestEventSignal(inputs) {
  const event = inputs.latest_us_event;
  const text = JSON.stringify(event || {}).toLowerCase();

  if (!event) {
    return makeFactor("NEUTRAL", "No recent US event", "No confirmed US economic surprise");
  }

  if (text.includes("bullish") || text.includes("positive") || text.includes("beat")) {
    return makeFactor("BULLISH", JSON.stringify(event), "Positive US surprise supports NQ through growth/liquidity confidence");
  }

  if (text.includes("bearish") || text.includes("negative") || text.includes("miss")) {
    return makeFactor("BEARISH", JSON.stringify(event), "Negative US surprise pressures NQ through growth risk");
  }

  return makeFactor("NEUTRAL", JSON.stringify(event), "No clear NQ economic surprise signal");
}

function factorSignals(snapshot, timeframe) {
  const inputs = snapshot || {};
  const vix = n(inputs.vix_level);
  const vixDelta = timeframe === "24h" && n(inputs.vix_d1) !== null ? inputs.vix_d1 : inputs.vix_d5;
  const dxyDelta = chooseDelta(timeframe, inputs.dxy_d1, inputs.dxy_d5, inputs.dxy_d20);
  const nominal10yDelta = chooseRateDelta(timeframe, inputs.us_10y_d5_bps, inputs.us_10y_d20_bps);
  const real10yDelta = chooseRateDelta(timeframe, inputs.us_10y_real_yield_d5_bps, inputs.us_10y_real_yield_d20_bps);
  const nqDelta = timeframe === "24h" ? n(inputs.nq_d1_pct) : 0;
  const btcDelta = chooseConfirmationDelta(timeframe, inputs.btc_d1_pct, inputs.btc_d5_pct, inputs.btc_d20_pct);
  const goldDelta = chooseConfirmationDelta(timeframe, inputs.gold_d1_pct, inputs.gold_d5_pct, inputs.gold_d20_pct);
  const fed = String(inputs.fed_bias || "").toLowerCase();

  const signals = {};

  signals.F1 = (() => {
    if (vix === null) return makeFactor("NEUTRAL", "Missing VIX", "Missing input");
    if (vix > 30) return makeFactor("BEARISH", `VIX ${vix}`, "Crisis volatility regime is strongly bearish NQ");
    if (vix > 22) return makeFactor("BEARISH", `VIX ${vix}`, "Risk-off volatility regime is bearish NQ");
    if (vix < 16) return makeFactor("BULLISH", `VIX ${vix}`, "Low-volatility risk-on regime supports NQ");
    return makeFactor("NEUTRAL", `VIX ${vix}`, "Neutral VIX regime");
  })();

  signals.F2 = (() => {
    const delta = n(vixDelta);
    if (delta === null) return makeFactor("NEUTRAL", "Missing VIX delta", "Missing input");
    if (delta >= 2) return makeFactor("BEARISH", `VIX delta ${pctLabel(delta)}`, "Rising volatility pressures NQ");
    if (delta <= -2) return makeFactor("BULLISH", `VIX delta ${pctLabel(delta)}`, "Falling volatility supports NQ");
    return makeFactor("NEUTRAL", `VIX delta ${pctLabel(delta)}`, "Volatility change below threshold");
  })();

  signals.F3 = (() => {
    const delta = n(dxyDelta);
    if (delta === null) return makeFactor("NEUTRAL", "Missing DXY delta", "Missing input");

    const upThreshold = timeframe === "24h" ? 0.15 : 0.3;
    const downThreshold = timeframe === "24h" ? -0.15 : -0.3;

    if (delta >= upThreshold) {
      return makeFactor("BEARISH", `DXY delta ${pctLabel(delta)}%`, "Rising USD tightens financial conditions and pressures NQ");
    }
    if (delta <= downThreshold) {
      return makeFactor("BULLISH", `DXY delta ${pctLabel(delta)}%`, "Falling USD eases financial conditions and supports NQ");
    }

    return makeFactor("NEUTRAL", `DXY delta ${pctLabel(delta)}%`, "USD move below threshold");
  })();

  signals.F4 = (() => {
    const delta = n(nominal10yDelta);
    if (delta === null) return makeFactor("NEUTRAL", "Missing US 10Y nominal yield delta", "Missing input");
    return makeFactor("NEUTRAL", `US 10Y nominal delta ${pctLabel(delta)} bps`, "Nominal yield move below threshold");
  })();

  signals.F5 = (() => {
    const delta = n(real10yDelta);
    if (delta === null) return makeFactor("NEUTRAL", "Missing US 10Y real yield delta", "Missing input");
    if (delta >= 5) return makeFactor("BEARISH", `US 10Y real yield delta ${pctLabel(delta)} bps`, "Rising real yields are bearish long-duration growth equities");
    if (delta <= -5) return makeFactor("BULLISH", `US 10Y real yield delta ${pctLabel(delta)} bps`, "Falling real yields support long-duration growth equities");
    return makeFactor("NEUTRAL", `US 10Y real yield delta ${pctLabel(delta)} bps`, "Real yield move below threshold");
  })();

  signals.F6 = (() => {
    if (!fed || fed === "unknown") return makeFactor("NEUTRAL", "Fed bias unknown", "Missing input");
    if (fed.includes("hawkish")) return makeFactor("BEARISH", `Fed bias ${fed}`, "Hawkish Fed bias tightens liquidity and pressures NQ");
    if (fed.includes("dovish")) return makeFactor("BULLISH", `Fed bias ${fed}`, "Dovish Fed bias eases liquidity and supports NQ");
    return makeFactor("NEUTRAL", `Fed bias ${fed}`, "No clear Fed liquidity impulse");
  })();

  signals.F7 = latestEventSignal(inputs);

  signals.F8 = (() => {
    const delta = n(nqDelta);
    if (delta === null) return makeFactor("NEUTRAL", "Missing NQ price delta", "Missing input");

    const upThreshold = timeframe === "24h" ? 0.25 : 0.75;
    const downThreshold = timeframe === "24h" ? -0.25 : -0.75;

    if (delta >= upThreshold) return makeFactor("BULLISH", `NQ delta ${pctLabel(delta)}%`, "NQ own price action confirms bullish pressure");
    if (delta <= downThreshold) return makeFactor("BEARISH", `NQ delta ${pctLabel(delta)}%`, "NQ own price action confirms bearish pressure");
    return makeFactor("NEUTRAL", `NQ delta ${pctLabel(delta)}%`, "NQ price move below confirmation threshold");
  })();

  signals.F9 = (() => {
    const delta = n(btcDelta);
    if (delta === null) return makeFactor("NEUTRAL", "Missing BTC delta", "Missing input");

    const upThreshold = timeframe === "24h" ? 0.5 : 1.5;
    const downThreshold = timeframe === "24h" ? -0.5 : -1.5;

    if (delta >= upThreshold) return makeFactor("BULLISH", `BTC delta ${pctLabel(delta)}%`, "BTC strength confirms high-beta risk appetite");
    if (delta <= downThreshold) return makeFactor("BEARISH", `BTC delta ${pctLabel(delta)}%`, "BTC weakness warns of high-beta risk pressure");
    return makeFactor("NEUTRAL", `BTC delta ${pctLabel(delta)}%`, "BTC move below confirmation threshold");
  })();

  signals.F10 = (() => {
    const delta = n(goldDelta);
    if (delta === null) return makeFactor("NEUTRAL", "Missing gold delta", "Missing input");

    const upThreshold = timeframe === "24h" ? 0.3 : 0.75;
    const downThreshold = timeframe === "24h" ? -0.3 : -0.75;

    if (delta >= upThreshold && vix !== null && vix > 22) {
      return makeFactor("BEARISH", `Gold delta ${pctLabel(delta)}%, VIX ${vix}`, "Gold strength during risk-off confirms defensive flows away from NQ");
    }
    if (delta <= downThreshold && vix !== null && vix < 22) {
      return makeFactor("BULLISH", `Gold delta ${pctLabel(delta)}%, VIX ${vix}`, "Gold weakness outside risk-off supports risk appetite");
    }
    return makeFactor("NEUTRAL", `Gold delta ${pctLabel(delta)}%`, "Gold does not provide a clean defensive-flow signal");
  })();

  return signals;
}

function collectMissingInputs(signals) {
  const missing = new Set();
  for (const [factorId, signal] of Object.entries(signals)) {
    if (signal?.reason !== "Missing input") continue;
    for (const inputKey of FACTOR_MISSING_INPUT_KEYS[factorId] || []) {
      missing.add(inputKey);
    }
  }
  return Array.from(missing);
}

function scoreTimeframe(snapshot, timeframe) {
  const weights = TIMEFRAME_WEIGHTS[timeframe];
  const signals = factorSignals(snapshot, timeframe);
  const missingInputs = collectMissingInputs(signals);

  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;

  const factorBreakdown = {};

  for (const [factorId, signal] of Object.entries(signals)) {
    const weight = weights[factorId] || 0;
    factorBreakdown[factorId] = {
      ...signal,
      weight
    };

    if (signal.signal === "BULLISH") {
      bullish += weight;
      bullishCount += 1;
    } else if (signal.signal === "BEARISH") {
      bearish += weight;
      bearishCount += 1;
    } else {
      neutral += weight;
      neutralCount += 1;
    }
  }

  const active = bullish + bearish;
  const bullishArgument = active > 0 ? Math.round((bullish / active) * 100) : 0;
  const bearishArgument = active > 0 ? Math.round((bearish / active) * 100) : 0;
  const neutralPct = Math.round(neutral);
  const directionalParticipationPct = Math.round(active);
  const netEdge = bullishArgument - bearishArgument;

  const baseDirection =
    bullish > bearish
      ? "BULLISH"
      : bearish > bullish
        ? "BEARISH"
        : "NO_CLEAR_BIAS";
  const absEdge = Math.abs(netEdge);
  const direction =
    baseDirection === "NO_CLEAR_BIAS"
      ? "NO_CLEAR_BIAS"
      : absEdge < 20
        ? `${baseDirection}_LEAN`
        : baseDirection;
  const conviction =
    baseDirection === "BULLISH"
      ? bullishArgument
      : baseDirection === "BEARISH"
        ? bearishArgument
        : 0;
  const strength =
    absEdge >= 40 ? "VERY_STRONG" :
    absEdge >= 25 ? "STRONG" :
    absEdge >= 15 ? "MODERATE" :
    "WEAK";
  const headlineConfidence = computeHeadlineConfidenceData({
    bullCase: bullishArgument,
    bearCase: bearishArgument,
    participation: directionalParticipationPct,
    netEdge,
    direction,
    missingInputsCount: missingInputs.length
  }).value;
  const confidenceStrength = deriveConfidenceStrength(headlineConfidence, netEdge, directionalParticipationPct, direction);
  const reason = `${timeframe} NQ deterministic score: bull case ${bullishArgument}%, bear case ${bearishArgument}%, neutral/inactive ${neutralPct}%, directional participation ${directionalParticipationPct}%, net edge ${netEdge > 0 ? "+" : ""}${netEdge}.`;

  return {
    direction,
    conviction,
    reason,
    factor_breakdown: factorBreakdown,
    score_bullish: bullishCount,
    score_bearish: bearishCount,
    score_neutral: neutralCount,
    missing_inputs: missingInputs,
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
      neutral_evidence_pct: neutralPct,
      neutral_pct: neutralPct,
      directional_participation_pct: directionalParticipationPct,
      active_participation_pct: directionalParticipationPct,
      winning_side: baseDirection,
      net_edge_pct: netEdge,
      final_conviction: conviction,
      final_confidence: headlineConfidence,
      headline_confidence_pct: headlineConfidence,
      verdict_strength: strength,
      confidence_strength: confidenceStrength,
      bull_case_weight: bullish,
      bear_case_weight: bearish,
      neutral_weight: neutral,
      final_conviction_logic: reason,
      weighted_edge: Math.abs(netEdge) / 100,
      raw_conviction: conviction,
      base_conviction: conviction,
      participation: directionalParticipationPct,
      participation_cap: directionalParticipationPct,
      conflict_penalty: 0,
      missing_input_penalty: 0,
      agreement_boost: 0,
      missing_inputs: missingInputs
    }
  };
}

function buildReplayOutput(snapshot, logicDocumentVersion = parseLogicVersion()) {
  const r24h = scoreTimeframe(snapshot, "24h");
  const r3d = scoreTimeframe(snapshot, "3d");
  const rWeek = scoreTimeframe(snapshot, "current_week");
  const rNextWeek = scoreTimeframe(snapshot, "next_week");
  const rMonth = scoreTimeframe(snapshot, "current_month");
  const aggregateMissingInputs = Array.from(new Set([
    ...r24h.missing_inputs,
    ...r3d.missing_inputs,
    ...rWeek.missing_inputs,
    ...rNextWeek.missing_inputs,
    ...rMonth.missing_inputs
  ]));

  return {
    asset: "NQ",
    agent_name: "NQ",
    logic_document: LOGIC_DOCUMENT,
    logic_document_version: logicDocumentVersion,
    direction_24h: r24h.direction,
    conviction_24h: r24h.conviction,
    reason_24h: r24h.reason,
    direction_3_day: r3d.direction,
    conviction_3_day: r3d.conviction,
    reason_3_day: r3d.reason,
    direction_current_week: rWeek.direction,
    conviction_current_week: rWeek.conviction,
    reason_current_week: rWeek.reason,
    direction_next_week: rNextWeek.direction,
    conviction_next_week: rNextWeek.conviction,
    reason_next_week: rNextWeek.reason,
    direction_current_month: rMonth.direction,
    conviction_current_month: rMonth.conviction,
    reason_current_month: rMonth.reason,
    weighted_score: r24h.weighted_score,
    conviction_model: r24h.conviction_model,
    factor_breakdown: r24h.factor_breakdown,
    score_bullish: r24h.score_bullish,
    score_bearish: r24h.score_bearish,
    score_neutral: r24h.score_neutral,
    non_neutral_count: r24h.score_bullish + r24h.score_bearish,
    missing_inputs: aggregateMissingInputs,
    warnings: [],
    timeframe_models: {
      "24h": r24h,
      "3d": r3d,
      current_week: rWeek,
      next_week: rNextWeek,
      current_month: rMonth
    },
    reasoning_summary: `NQ weighted verdicts calculated deterministically by timeframe. 24h ${r24h.direction} ${r24h.conviction}%, 3d ${r3d.direction} ${r3d.conviction}%, current week ${rWeek.direction} ${rWeek.conviction}%, next week ${rNextWeek.direction} ${rNextWeek.conviction}%, current month ${rMonth.direction} ${rMonth.conviction}%.`
  };
}

module.exports = {
  LOGIC_DOCUMENT,
  TIMEFRAME_WEIGHTS,
  buildReplayOutput,
  parseLogicVersion
};
