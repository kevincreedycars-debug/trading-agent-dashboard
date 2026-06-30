const fs = require("fs");
const path = require("path");

const LOGIC_DOCUMENT = "agent_gold_direction.md";
const LIVE_24H_FACTOR_WEIGHTS = Object.freeze({
  F1: 26,
  F2: 22,
  F3: 12,
  F4: 10,
  F5: 10,
  F6: 8,
  F7: 8,
  F8: 2,
  F9: 1,
  F10: 1
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

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value || "");
  }
}

function parseLogicVersion() {
  const logicPath = path.resolve(__dirname, "../../../logic/agent_gold_direction.md");
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

function build24hFactors(snapshot) {
  const realYieldDelta = toNumber(snapshot.us_10y_real_yield_d5_bps);
  const dxyDelta = toNumber(snapshot.dxy_d1) !== null
    ? toNumber(snapshot.dxy_d1)
    : toNumber(snapshot.dxy_d5);
  const goldDelta = toNumber(snapshot.gold_d1_pct) !== null
    ? toNumber(snapshot.gold_d1_pct)
    : toNumber(snapshot.gold_d5_pct);
  const us2yDelta = toNumber(snapshot.us_2y_d5_bps);
  const vix = toNumber(snapshot.vix_level);
  const fed = String(snapshot.fed_bias || "").toLowerCase();
  const growth = String(snapshot.global_growth_regime || snapshot.growth_regime || "").toLowerCase();
  const geopoliticalFlag = snapshot.geopolitical_risk_flag === true || snapshot.geopolitical_risk_flag === "true";
  const riskText = String(snapshot.risk_headline_context || (geopoliticalFlag ? "stress" : "")).toLowerCase();
  const latestUsEvent = snapshot.latest_us_event ?? null;
  const latestUsEventText = safeJson(latestUsEvent).toLowerCase();

  const factors = {};

  factors.F1 = (() => {
    if (realYieldDelta === null) {
      return makeFactor("NEUTRAL", "Missing real yield delta", "Missing input", LIVE_24H_FACTOR_WEIGHTS.F1);
    }
    if (realYieldDelta <= -5) {
      return makeFactor("BULLISH", `Real yield ${realYieldDelta}bps`, "Falling real yields support Gold", LIVE_24H_FACTOR_WEIGHTS.F1);
    }
    if (realYieldDelta >= 5) {
      return makeFactor("BEARISH", `Real yield ${realYieldDelta}bps`, "Rising real yields pressure Gold", LIVE_24H_FACTOR_WEIGHTS.F1);
    }
    return makeFactor("NEUTRAL", `Real yield ${realYieldDelta}bps`, "Real yield move below threshold", LIVE_24H_FACTOR_WEIGHTS.F1);
  })();

  factors.F2 = (() => {
    if (dxyDelta === null) {
      return makeFactor("NEUTRAL", "Missing DXY delta", "Missing input", LIVE_24H_FACTOR_WEIGHTS.F2);
    }
    if (dxyDelta <= -0.15) {
      return makeFactor("BULLISH", `DXY ${dxyDelta}%`, "Dollar weakness supports Gold", LIVE_24H_FACTOR_WEIGHTS.F2);
    }
    if (dxyDelta >= 0.15) {
      return makeFactor("BEARISH", `DXY ${dxyDelta}%`, "Dollar strength pressures Gold", LIVE_24H_FACTOR_WEIGHTS.F2);
    }
    return makeFactor("NEUTRAL", `DXY ${dxyDelta}%`, "DXY move below threshold", LIVE_24H_FACTOR_WEIGHTS.F2);
  })();

  factors.F3 = (() => {
    if (!fed || fed === "unknown") {
      return makeFactor("NEUTRAL", "Fed bias unknown", "Missing input", LIVE_24H_FACTOR_WEIGHTS.F3);
    }
    if (fed.includes("dovish")) {
      return makeFactor("BULLISH", `Fed bias ${fed}`, "Dovish Fed supports Gold through lower real-yield and liquidity expectations", LIVE_24H_FACTOR_WEIGHTS.F3);
    }
    if (fed.includes("hawkish")) {
      return makeFactor("BEARISH", `Fed bias ${fed}`, "Hawkish Fed pressures Gold through higher real-yield and policy-rate expectations", LIVE_24H_FACTOR_WEIGHTS.F3);
    }
    return makeFactor("NEUTRAL", `Fed bias ${fed}`, "No clear Fed impulse", LIVE_24H_FACTOR_WEIGHTS.F3);
  })();

  factors.F4 = (() => {
    if (us2yDelta === null) {
      return makeFactor("NEUTRAL", "Missing US 2Y delta", "Missing input", LIVE_24H_FACTOR_WEIGHTS.F4);
    }
    if (us2yDelta <= -5) {
      return makeFactor("BULLISH", `US 2Y ${us2yDelta}bps`, "Falling front-end yields support Gold", LIVE_24H_FACTOR_WEIGHTS.F4);
    }
    if (us2yDelta >= 5) {
      return makeFactor("BEARISH", `US 2Y ${us2yDelta}bps`, "Rising front-end yields pressure Gold", LIVE_24H_FACTOR_WEIGHTS.F4);
    }
    return makeFactor("NEUTRAL", `US 2Y ${us2yDelta}bps`, "US 2Y move below threshold", LIVE_24H_FACTOR_WEIGHTS.F4);
  })();

  factors.F5 = (() => {
    if (goldDelta === null) {
      return makeFactor("NEUTRAL", "Missing Gold delta", "Missing input", LIVE_24H_FACTOR_WEIGHTS.F5);
    }
    if (goldDelta >= 0.3) {
      return makeFactor("BULLISH", `Gold ${goldDelta}%`, "Gold own-price trend confirms upside pressure", LIVE_24H_FACTOR_WEIGHTS.F5);
    }
    if (goldDelta <= -0.3) {
      return makeFactor("BEARISH", `Gold ${goldDelta}%`, "Gold own-price trend confirms downside pressure", LIVE_24H_FACTOR_WEIGHTS.F5);
    }
    return makeFactor("NEUTRAL", `Gold ${goldDelta}%`, "Gold price move below threshold", LIVE_24H_FACTOR_WEIGHTS.F5);
  })();

  factors.F6 = (() => {
    if (vix === null) {
      return makeFactor("NEUTRAL", "Missing VIX", "Missing input", LIVE_24H_FACTOR_WEIGHTS.F6);
    }
    if (vix > 25) {
      return makeFactor("BULLISH", `VIX ${vix}`, "Risk-off conditions support Gold safe-haven demand", LIVE_24H_FACTOR_WEIGHTS.F6);
    }
    if (vix < 16) {
      return makeFactor("BEARISH", `VIX ${vix}`, "Risk-on conditions reduce defensive Gold demand", LIVE_24H_FACTOR_WEIGHTS.F6);
    }
    return makeFactor("NEUTRAL", `VIX ${vix}`, "Neutral risk regime", LIVE_24H_FACTOR_WEIGHTS.F6);
  })();

  factors.F7 = (() => {
    if (!latestUsEvent || latestUsEventText === "{}") {
      return makeFactor("NEUTRAL", "No recent US event", "No confirmed US economic surprise", LIVE_24H_FACTOR_WEIGHTS.F7);
    }
    if (
      latestUsEventText.includes("negative") ||
      latestUsEventText.includes("miss") ||
      latestUsEventText.includes("bearish")
    ) {
      return makeFactor("BULLISH", safeJson(latestUsEvent), "Negative US surprise supports Gold through lower yield and Fed repricing risk", LIVE_24H_FACTOR_WEIGHTS.F7);
    }
    if (
      latestUsEventText.includes("positive") ||
      latestUsEventText.includes("beat") ||
      latestUsEventText.includes("bullish")
    ) {
      return makeFactor("BEARISH", safeJson(latestUsEvent), "Positive US surprise pressures Gold through higher yield and Fed repricing risk", LIVE_24H_FACTOR_WEIGHTS.F7);
    }
    return makeFactor("NEUTRAL", safeJson(latestUsEvent), "No clear Gold signal from latest US event", LIVE_24H_FACTOR_WEIGHTS.F7);
  })();

  factors.F8 = makeFactor(
    "NEUTRAL",
    "Inflation signal unavailable",
    "Collector does not currently provide a top-level inflation_signal column",
    LIVE_24H_FACTOR_WEIGHTS.F8
  );

  factors.F9 = (() => {
    if (
      riskText.includes("safe_haven") ||
      riskText.includes("stress") ||
      riskText.includes("crisis") ||
      riskText.includes("risk_active")
    ) {
      return makeFactor("BULLISH", riskText, "Safe-haven demand supports Gold", LIVE_24H_FACTOR_WEIGHTS.F9);
    }
    return makeFactor("NEUTRAL", riskText || "normal", "No active safe-haven demand signal", LIVE_24H_FACTOR_WEIGHTS.F9);
  })();

  factors.F10 = (() => {
    if (growth.includes("weakening") || growth.includes("contraction")) {
      return makeFactor("BULLISH", growth, "Weakening growth supports Gold through defensive demand and lower yield expectations", LIVE_24H_FACTOR_WEIGHTS.F10);
    }
    if (growth.includes("supportive") || growth.includes("expansion")) {
      return makeFactor("BEARISH", growth, "Supportive growth reduces defensive Gold demand and can lift yields", LIVE_24H_FACTOR_WEIGHTS.F10);
    }
    return makeFactor("NEUTRAL", growth || "neutral", "No clear growth or liquidity signal", LIVE_24H_FACTOR_WEIGHTS.F10);
  })();

  return factors;
}

function score24h(snapshot) {
  const factors = build24hFactors(snapshot);
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
  const participation = active;
  const bullishArgument = active > 0 ? Math.round((bullish / active) * 100) : 0;
  const bearishArgument = active > 0 ? Math.round((bearish / active) * 100) : 0;
  const neutralPct = Math.round(neutral);
  const netEdge = bullishArgument - bearishArgument;

  const baseDirection =
    bullish > bearish ? "BULLISH" :
    bearish > bullish ? "BEARISH" :
    "NO_CLEAR_BIAS";

  const absEdge = Math.abs(netEdge);
  const weightMargin = Math.abs(bullish - bearish);
  const direction =
    baseDirection === "NO_CLEAR_BIAS"
      ? "NO_CLEAR_BIAS"
      : active < 50 || weightMargin < 15 || absEdge < 20
        ? `${baseDirection}_LEAN`
        : baseDirection;

  const winningArgument =
    baseDirection === "BULLISH"
      ? bullishArgument
      : baseDirection === "BEARISH"
        ? bearishArgument
        : 0;

  const participationCap = Math.min(participation, 80);
  const conviction =
    baseDirection === "NO_CLEAR_BIAS"
      ? 0
      : Math.round(winningArgument * (participationCap / 100));

  const strength =
    absEdge >= 40 && participation >= 70 ? "VERY_STRONG" :
    absEdge >= 25 && participation >= 50 ? "STRONG" :
    absEdge >= 15 ? "MODERATE" :
    "WEAK";

  const reason = `24h deterministic Gold score: bull case ${bullishArgument}%, bear case ${bearishArgument}%, directional participation ${participation}%, neutral/inactive ${neutralPct}%, net edge ${netEdge > 0 ? "+" : ""}${netEdge}. Real yields and DXY remain the highest-priority Gold drivers.`;

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
      weight_margin: weightMargin
    },
    conviction_model: {
      net_edge: netEdge,
      bear_case: bearishArgument,
      bull_case: bullishArgument,
      neutral_pct: neutralPct,
      net_edge_pct: netEdge,
      winning_side: baseDirection,
      participation,
      weighted_edge: Math.abs(netEdge) / 100,
      raw_conviction: conviction,
      agreement_boost: 0,
      base_conviction: conviction,
      conflict_penalty: 0,
      final_conviction: conviction,
      verdict_strength: strength,
      participation_cap: participationCap,
      bearish_argument_pct: bearishArgument,
      bullish_argument_pct: bullishArgument,
      missing_input_penalty: 0,
      final_conviction_logic: reason,
      active_participation_pct: participation,
      directional_participation: participation,
      neutral_evidence_pct: neutralPct,
      directional_participation_pct: participation,
      bull_case_weight: bullish,
      bear_case_weight: bearish,
      neutral_weight: neutral,
      weighted_score: {
        bullish_weight: bullish,
        bearish_weight: bearish,
        neutral_weight: neutral,
        active_weight: active,
        weight_margin: weightMargin
      },
      alignment: Math.max(bullishArgument, bearishArgument)
    },
    warnings: []
  };
}

function buildReplayOutput(snapshot, logicDocumentVersion = parseLogicVersion()) {
  const result24h = score24h(snapshot);
  return {
    asset: "GOLD",
    agent_name: "GOLD",
    logic_document: LOGIC_DOCUMENT,
    logic_document_version: logicDocumentVersion,
    direction_24h: result24h.direction,
    conviction_24h: result24h.conviction,
    reason_24h: result24h.reason,
    score_bullish: result24h.score_bullish,
    score_bearish: result24h.score_bearish,
    score_neutral: result24h.score_neutral,
    weighted_score: result24h.weighted_score,
    conviction_model: result24h.conviction_model,
    factor_breakdown: result24h.factor_breakdown,
    warnings: result24h.warnings,
    full_output: {
      asset: "GOLD",
      agent_name: "GOLD",
      logic_document: LOGIC_DOCUMENT,
      logic_document_version: logicDocumentVersion,
      direction_24h: result24h.direction,
      conviction_24h: result24h.conviction,
      reason_24h: result24h.reason,
      weighted_score: result24h.weighted_score,
      conviction_model: result24h.conviction_model,
      factor_breakdown: result24h.factor_breakdown,
      score_bullish: result24h.score_bullish,
      score_bearish: result24h.score_bearish,
      score_neutral: result24h.score_neutral,
      warnings: result24h.warnings
    },
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
