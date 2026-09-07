// Isolated GBP Layer 1 onboarding contract helper (DeepSeek workstream).
// Does NOT import any backtester/Codex code. Mirrors the rules documented in
// logic/agent_gbp_direction.md and the draft workflow code nodes under
// exports/gbp_collector.json and exports/gbp_layer1_agent.json.
"use strict";

const LOGIC_DOCUMENT = "agent_gbp_direction.md";
const LOGIC_DOCUMENT_VERSION = "0.1_research_baseline";
const COLLECTOR_VERSION = "gbp_collector_draft_v0_1";

// Must stay identical to the logic-document factor table, the deterministic gate
// code node, and backtester/replay/gbp/gbp_replay_core.js LIVE_24H_FACTOR_WEIGHTS.
const GBP_FACTOR_WEIGHTS = Object.freeze({
  F1: 20,
  F2: 16,
  F3: 20,
  F4: 12,
  F5: 8,
  F6: 10,
  F7: 6,
  F8: 4,
  F9: 2,
  F10: 2
});

const SNAPSHOT_FIELD_BY_FACTOR = Object.freeze({
  F1: "boe_bias",
  F2: "uk_2y_d5_bps",
  F3: "us_uk_2y_spread_d5_bps",
  F4: "latest_uk_event",
  F5: "uk_composite_pmi",
  F6: "gbpusd_d1_pct",
  F7: "dxy_d1_pct",
  F8: "vix_level",
  F9: "global_growth_regime",
  F10: "uk_stress_flag"
});

// Minimum market data a snapshot must carry before any GBP Layer 1 classification
// may be attempted. Fundamentals beyond this set may be absent (scored NEUTRAL).
const CORE_REQUIRED_FIELDS = Object.freeze(["snapshot_date", "run_time_et", "gbpusd_price"]);

const FUNDAMENTAL_FIELDS = Object.freeze([
  "uk_2y_yield",
  "uk_2y_d5_bps",
  "us_uk_2y_spread",
  "us_uk_2y_spread_d5_bps",
  "boe_bias",
  "latest_uk_event",
  "uk_composite_pmi",
  "uk_composite_pmi_direction",
  "uk_stress_flag"
]);

// Provider evidence recorded 2026-09-05 (see docs/DEEPSEEK_LAYER1_PROGRESS.md).
const PROVIDER_AVAILABILITY = Object.freeze({
  gbpusd_price: { status: "available", source: "Coinbase GBP-USD spot" },
  gbpusd_d1_pct: { status: "available", source: "Coinbase spot + previous market_snapshots" },
  vix_level: { status: "available", source: "FRED VIXCLS" },
  dxy_d1_pct: { status: "available", source: "FRED DTWEXBGS (broad-dollar proxy); column naming open" },
  us_2y_yield: { status: "available", source: "FRED DGS2" },
  uk_10y_yield: { status: "available", source: "FRED IRLTLT01GBM156N (10Y context only)" },
  uk_2y_yield: { status: "unavailable", source: "no repo-verified UK 2Y daily provider" },
  uk_2y_d5_bps: { status: "unavailable", source: "depends on UK 2Y" },
  us_uk_2y_spread_d5_bps: { status: "unavailable", source: "depends on UK 2Y" },
  boe_bias: { status: "unavailable", source: "UK economic events coverage not available" },
  latest_uk_event: { status: "unavailable", source: "UK economic events coverage not available" },
  uk_composite_pmi: { status: "unavailable", source: "no verified UK PMI source" },
  uk_composite_pmi_direction: { status: "unavailable", source: "depends on UK PMI source" },
  uk_stress_flag: { status: "unavailable", source: "no repo-verified UK stress proxy" },
  global_growth_regime: { status: "available", source: "shared NQ 20d history when present" }
});

const STALE_AGE_HOURS = 26;

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function numberOf(value) {
  if (!hasValue(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// UTC-based helper mirroring the draft input-pack staleness rule: the expected
// latest GBP trading date is the most recent weekday strictly before `now`'s UTC
// day, so a Monday run accepts a Friday snapshot.
function latestGbpTradingDateOnOrBeforePreviousDay(date) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() - 1);
  let guard = 0;
  while ((d.getUTCDay() === 0 || d.getUTCDay() === 6) && guard < 5) {
    d.setUTCDate(d.getUTCDate() - 1);
    guard += 1;
  }
  return d.toISOString().slice(0, 10);
}

function etWeekday(date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(date);
}

function isGbpMarketClosed(now) {
  const weekday = etWeekday(now);
  return weekday === "Sat" || weekday === "Sun";
}

function isStaleSnapshot(row, now) {
  if (!row.run_time_et) return false;
  const runTime = new Date(row.run_time_et).getTime();
  if (!Number.isFinite(runTime)) return false;
  const ageHours = (now.getTime() - runTime) / 3600000;
  const latestExpected = latestGbpTradingDateOnOrBeforePreviousDay(now);
  return ageHours > STALE_AGE_HOURS && String(row.snapshot_date || "") < latestExpected;
}

function isUsableSnapshot(row) {
  if (!row || typeof row !== "object") return false;
  return CORE_REQUIRED_FIELDS.every((key) => hasValue(row[key]));
}

// Assessment used by the contract tests. `now` defaults to the current time but
// should be injected for deterministic weekday/staleness assertions.
function assessSnapshot(row, now = new Date()) {
  const missingCore = [];
  for (const key of CORE_REQUIRED_FIELDS) {
    if (!hasValue(row && row[key])) missingCore.push(key);
  }

  const missingFundamentals = [];
  for (const key of FUNDAMENTAL_FIELDS) {
    if (!hasValue(row && row[key])) missingFundamentals.push(key);
  }

  const usable = isUsableSnapshot(row);
  const stale = usable ? isStaleSnapshot(row, now) : false;
  const marketClosed = isGbpMarketClosed(now);

  return {
    usable,
    stale,
    marketClosed,
    missingCore,
    missingFundamentals,
    staleReason: stale ? `run_time_et older than ${STALE_AGE_HOURS}h and snapshot_date older than latest GBP trading date` : null,
    usableReason: usable ? null : "GBP snapshot must carry snapshot_date, run_time_et and gbpusd_price"
  };
}

module.exports = {
  LOGIC_DOCUMENT,
  LOGIC_DOCUMENT_VERSION,
  COLLECTOR_VERSION,
  GBP_FACTOR_WEIGHTS,
  SNAPSHOT_FIELD_BY_FACTOR,
  CORE_REQUIRED_FIELDS,
  FUNDAMENTAL_FIELDS,
  PROVIDER_AVAILABILITY,
  STALE_AGE_HOURS,
  hasValue,
  numberOf,
  latestGbpTradingDateOnOrBeforePreviousDay,
  isGbpMarketClosed,
  isStaleSnapshot,
  isUsableSnapshot,
  assessSnapshot
};
