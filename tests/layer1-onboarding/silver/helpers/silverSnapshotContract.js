"use strict";

// SILVER Layer 1 contract helper.
//
// The live platform uses ONE shared `market_snapshots` table with no asset
// column: every collector writes the same superset row and every Layer 1 agent
// reads the newest row. This helper encodes that contract so the SILVER draft
// cannot silently diverge from it.

const LOGIC_DOCUMENT = "agent_silver_direction.md";
const LOGIC_DOCUMENT_VERSION = "1.0_weighted_engine";
const COLLECTOR_VERSION = "silver_v1_economic_events_weighted_inputs";

// Weights are duplicated from the logic document/code on purpose so a test can
// prove all three stay in step.
const SILVER_TIMEFRAME_WEIGHTS = Object.freeze({
  "24h": Object.freeze({ F1: 24, F2: 18, F3: 10, F4: 12, F5: 12, F6: 8, F7: 6, F8: 5, F9: 4, F10: 1 }),
  "3d": Object.freeze({ F1: 22, F2: 18, F3: 10, F4: 12, F5: 12, F6: 8, F7: 6, F8: 6, F9: 5, F10: 1 }),
  current_week: Object.freeze({ F1: 20, F2: 17, F3: 10, F4: 12, F5: 12, F6: 8, F7: 6, F8: 7, F9: 7, F10: 1 }),
  next_week: Object.freeze({ F1: 18, F2: 16, F3: 11, F4: 11, F5: 12, F6: 7, F7: 5, F8: 9, F9: 10, F10: 1 }),
  current_month: Object.freeze({ F1: 16, F2: 15, F3: 11, F4: 10, F5: 12, F6: 6, F7: 4, F8: 11, F9: 14, F10: 1 })
});

const SILVER_FACTOR_WEIGHTS = SILVER_TIMEFRAME_WEIGHTS["24h"];

const SILVER_FACTOR_INPUTS = Object.freeze({
  F1: "us_10y_real_yield_d5_bps",
  F2: "dxy_d1",
  F3: "fed_bias",
  F4: "silver_d1_pct",
  F5: "gold_silver_ratio_d5_pct",
  F6: "vix_level",
  F7: "latest_us_event",
  F8: "industrial_demand_regime",
  F9: "global_growth_regime",
  F10: "silver_supply_event"
});

// Fields this collector must keep publishing even though SILVER does not use
// them, because the other five Layer 1 agents read the newest shared row and
// would be starved if the SILVER writer were the last collector in the sequence.
// This list is exactly the set the live Gold collector already publishes, which
// is the proven-safe superset, plus global_growth_regime which Gold also writes.
const SHARED_SUPERSET_FIELDS = Object.freeze([
  "gold_price", "gold_d1_pct", "gold_d5_pct", "gold_d20_pct",
  "nq_price", "nq_d1_pct", "nq_d5_pct", "nq_d20_pct",
  "btc_price", "btc_d1_pct", "btc_d5_pct", "btc_d20_pct",
  "btc_dominance", "btc_dominance_d5", "btc_dominance_d20",
  "crypto_fear_greed", "total_crypto_market_cap",
  "total_crypto_market_cap_d5_pct", "total_crypto_market_cap_d20_pct",
  "btc_etf_net_flow_1d_usd", "btc_etf_net_flow_5d_usd", "btc_etf_net_flow_20d_usd",
  "stablecoin_supply", "stablecoin_supply_d5_pct", "stablecoin_supply_d20_pct",
  "vix_level", "vix_d1", "vix_d5",
  "dxy_level", "dxy_d1", "dxy_d5", "dxy_d20",
  "us_2y_yield", "us_2y_d5_bps", "us_2y_d20_bps",
  "de_2y_yield", "de_2y_d5_bps", "us_de_2y_spread", "us_de_2y_spread_d5_bps",
  "us_10y_yield", "us_10y_d5_bps",
  "us_10y_real_yield", "us_10y_real_yield_d5_bps", "us_10y_real_yield_d20_bps",
  "spx_d1_pct", "equities_regime",
  "latest_us_event", "latest_ez_event", "upcoming_events", "fed_bias", "ecb_bias",
  "global_growth_regime", "ez_stress_flag", "geopolitical_risk_flag"
]);

// Never available rather than "missing": there is no verified physical Silver
// supply or event feed, so these are expected to be null in every row.
const SILVER_ALWAYS_NULL_FIELDS = Object.freeze(["silver_supply_event"]);


const SILVER_SPECIFIC_FIELDS = Object.freeze([
  "silver_price", "silver_d1_pct", "silver_d5_pct", "silver_d20_pct",
  "gold_silver_ratio", "gold_silver_ratio_d5_pct", "gold_silver_ratio_d20_pct",
  "copper_price", "copper_3m_pct",
  "industrial_production_index", "industrial_production_3m_pct",
  "industrial_demand_regime", "silver_supply_event"
]);

const CORE_REQUIRED_FIELDS = Object.freeze(["snapshot_date", "run_time_et"]);
const STALE_AGE_HOURS = 26;

// Provider availability is now evidence-backed rather than assumed: the XAG/USD
// spot and every macro series below are the same providers already used live.
const PROVIDER_AVAILABILITY = Object.freeze({
  silver_price: { status: "verified", source: "Coinbase XAG-USD spot (same pattern as live XAU-USD)" },
  gold_price: { status: "verified", source: "Coinbase XAU-USD spot" },
  us_10y_real_yield: { status: "verified", source: "FRED DFII10" },
  dxy_level: { status: "verified", source: "FRED DTWEXBGS" },
  vix_level: { status: "verified", source: "FRED VIXCLS" },
  copper_price: { status: "verified", source: "FRED PCOPPUSDM (monthly)" },
  industrial_production_index: { status: "verified", source: "FRED INDPRO (monthly)" },
  fed_bias: { status: "verified", source: "Finnhub economic calendar + US eco derivation" },
  silver_supply_event: { status: "unavailable", source: "no verified physical supply or event feed" }
});

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function isUsableSharedRow(row) {
  return Boolean(row && CORE_REQUIRED_FIELDS.every((key) => hasValue(row[key])));
}

// A row can be usable and still carry no SILVER evidence (for example a row
// written by another collector). That is a real state and must be reported as
// such rather than scored as neutral silver evidence.
function hasSilverEvidence(row) {
  return Boolean(row && hasValue(row.silver_price));
}

function isStaleRow(row, now) {
  if (!row || !row.run_time_et) return false;
  const time = new Date(row.run_time_et).getTime();
  if (!Number.isFinite(time)) return false;
  return (new Date(now).getTime() - time) / 3600000 > STALE_AGE_HOURS;
}

function missingSupersetFields(row) {
  return SHARED_SUPERSET_FIELDS.filter((key) => !hasValue(row && row[key]));
}

function missingSilverFields(row) {
  return SILVER_SPECIFIC_FIELDS
    .filter((key) => !SILVER_ALWAYS_NULL_FIELDS.includes(key))
    .filter((key) => !hasValue(row && row[key]));
}

function assessSharedRow(row, now = new Date("2026-09-12T14:00:00.000Z")) {
  const missingCore = CORE_REQUIRED_FIELDS.filter((key) => !hasValue(row && row[key]));
  return {
    usable: isUsableSharedRow(row),
    stale: isUsableSharedRow(row) && isStaleRow(row, now),
    hasSilverEvidence: hasSilverEvidence(row),
    missingCore,
    missingSilverFields: missingSilverFields(row),
    missingSupersetFields: missingSupersetFields(row)
  };
}

module.exports = {
  LOGIC_DOCUMENT,
  LOGIC_DOCUMENT_VERSION,
  COLLECTOR_VERSION,
  SILVER_TIMEFRAME_WEIGHTS,
  SILVER_FACTOR_WEIGHTS,
  SILVER_FACTOR_INPUTS,
  SHARED_SUPERSET_FIELDS,
  SILVER_SPECIFIC_FIELDS,
  SILVER_ALWAYS_NULL_FIELDS,
  CORE_REQUIRED_FIELDS,
  STALE_AGE_HOURS,
  PROVIDER_AVAILABILITY,
  hasValue,
  isUsableSharedRow,
  hasSilverEvidence,
  isStaleRow,
  missingSupersetFields,
  missingSilverFields,
  assessSharedRow
};
