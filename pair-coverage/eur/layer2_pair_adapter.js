const { EUR_PAIR_INVENTORY } = require("./pair_inventory");

// Isolated, pure Layer 2 producer draft for EUR-related pairs.
//
// This mirrors the live `layer2_trade_selection_agent` code node exactly
// (direction normalization, conviction clamp, LOW_CONVICTION_THRESHOLD = 60,
// combined confidence = round((base + quote) / 2), avoid reasons, ranking and
// the `dashboard_meta` / `trade_opportunities` / `avoid_today` output shape),
// with one generalization: the quote asset is per-pair instead of the literal
// `USD`. For USD-quoted pairs the output is unchanged.
//
// It performs no I/O and does not read Supabase, GitHub or dashboard state.
// It exists so Codex can lift the generalized logic into the shared producer
// without the EUR workstream editing shared or live files.

const LOW_CONVICTION_THRESHOLD = 60;
const DASHBOARD_SOURCE = "layer_2_trade_selection_agent";

// Mirror of the live workflow's non-directional sentinels.
const NON_DIRECTIONAL_SENTINELS = [
  "PENDING",
  "NO_24H_CALL",
  "NO_CLEAR_BIAS",
  "NEUTRAL",
  "MARKET_CLOSED",
  ""
];

const EUR_LAYER2_PAIRS = Object.freeze(
  EUR_PAIR_INVENTORY.map((pair) => ({
    pairCode: pair.pairCode,
    instrument: pair.pairLabel,
    base: pair.baseAsset,
    quote: pair.quoteAsset
  }))
);

// Active workstream scope: the six EUR crosses that are not EUR/USD.
// EUR/USD stays in EUR_LAYER2_PAIRS only as the byte-parity reference for the
// live USD-quoted behaviour.
const EUR_CROSS_PAIRS = Object.freeze(
  EUR_LAYER2_PAIRS.filter((pair) => pair.pairCode !== "EUR_USD")
);

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function clampConviction(value, min = 0, max = 100) {
  const numeric = toNumber(value);
  if (numeric === null) return null;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function normalizeDirection(value) {
  const raw = String(value || "PENDING").trim().toUpperCase().replace(/\s+/g, "_");
  if (NON_DIRECTIONAL_SENTINELS.includes(raw)) return "NO_CLEAR_BIAS";
  if (raw.includes("BULLISH") || raw.includes("LONG")) return "BULLISH";
  if (raw.includes("BEARISH") || raw.includes("SHORT")) return "BEARISH";
  return "NO_CLEAR_BIAS";
}

function normalizeCall(call) {
  return {
    direction: normalizeDirection(call?.direction),
    conviction: clampConviction(call?.conviction)
  };
}

function pairAvoidReason(base, quote, quoteLabel) {
  if (base.conviction === null || quote.conviction === null) {
    return "Missing 24H conviction from one or both Layer 1 assets.";
  }
  if (base.direction === "NO_CLEAR_BIAS" || quote.direction === "NO_CLEAR_BIAS") {
    return "One or both assets have no clear 24H bias.";
  }
  if (base.conviction < LOW_CONVICTION_THRESHOLD || quote.conviction < LOW_CONVICTION_THRESHOLD) {
    return "Mixed or low conviction 24H signals.";
  }
  if (base.direction === quote.direction) {
    return "Both assets point in the same 24H direction, so there is no clear relative edge.";
  }
  return quoteLabel ? null : "Mixed 24H signals.";
}

function buildLayer2PairOpportunity(pair, calls) {
  const base = normalizeCall(calls[pair.base]);
  const quote = normalizeCall(calls[pair.quote]);
  const quoteLabel = pair.quote;

  const avoidReason = pairAvoidReason(base, quote, quoteLabel);
  if (avoidReason) return { avoid: { instrument: pair.instrument, reason: avoidReason } };

  const confidence = clampConviction(((base.conviction ?? 0) + (quote.conviction ?? 0)) / 2);

  if (base.direction === "BULLISH" && quote.direction === "BEARISH") {
    return {
      opportunity: {
        instrument: pair.instrument,
        direction: "BUY",
        confidence,
        reason: `${pair.base} is independently bullish while ${quoteLabel} is independently bearish during today's session.`
      }
    };
  }

  if (base.direction === "BEARISH" && quote.direction === "BULLISH") {
    return {
      opportunity: {
        instrument: pair.instrument,
        direction: "SELL",
        confidence,
        reason: `${quoteLabel} is independently bullish while ${pair.base} is independently bearish during today's session.`
      }
    };
  }

  return { avoid: { instrument: pair.instrument, reason: "Mixed 24H signals." } };
}

function buildLayer2PairDashboard(input = {}) {
  const pairs = Array.isArray(input.pairs) && input.pairs.length ? input.pairs : EUR_LAYER2_PAIRS;
  const calls = input.calls || {};
  const trade_opportunities = [];
  const avoid_today = [];

  for (const pair of pairs) {
    const result = buildLayer2PairOpportunity(pair, calls);
    if (result.opportunity) trade_opportunities.push(result.opportunity);
    if (result.avoid) avoid_today.push(result.avoid);
  }

  trade_opportunities
    .sort((a, b) => Number(b.confidence ?? 0) - Number(a.confidence ?? 0))
    .forEach((opportunity, index) => {
      opportunity.rank = index + 1;
    });

  return {
    dashboard_meta: {
      last_updated_et: input.generatedAt || new Date().toISOString(),
      source: DASHBOARD_SOURCE
    },
    trade_opportunities,
    avoid_today
  };
}

module.exports = {
  LOW_CONVICTION_THRESHOLD,
  DASHBOARD_SOURCE,
  EUR_LAYER2_PAIRS,
  EUR_CROSS_PAIRS,
  normalizeDirection,
  clampConviction,
  buildLayer2PairOpportunity,
  buildLayer2PairDashboard
};
