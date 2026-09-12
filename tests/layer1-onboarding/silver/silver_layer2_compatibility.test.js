const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "..", "..");
const load = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const agent = load("exports/silver_layer1_agent.json");

const GATE = agent.nodes.find((item) => item.name === "Calculate SILVER Conviction").parameters.jsCode;
const runGate = new Function("$input", GATE);

const BASE_INPUTS = {
  silver_price: 64.49, silver_d1_pct: 1.4, silver_d5_pct: 3.2, silver_d20_pct: 5.1,
  gold_price: 4210.5, gold_d1_pct: 0.1, gold_d5_pct: 0.2, gold_d20_pct: 0.3,
  gold_silver_ratio: 65.3, gold_silver_ratio_d5_pct: -2.4, gold_silver_ratio_d20_pct: -3.1,
  dxy_level: 96.42, dxy_d1: -0.4, dxy_d5: -0.9, dxy_d20: -0.3,
  us_2y_yield: 3.62, us_2y_d5_bps: -6, us_2y_d20_bps: 4,
  us_10y_yield: 4.08, us_10y_d5_bps: -5, us_10y_d20_bps: 6,
  us_10y_real_yield: 1.61, us_10y_real_yield_d5_bps: -9, us_10y_real_yield_d20_bps: -7,
  vix_level: 14.5, vix_d1: 0.2, vix_d5: -0.4,
  copper_price: 13542.82, copper_3m_pct: 3.1,
  industrial_production_index: 102.99, industrial_production_3m_pct: 0.75,
  industrial_demand_regime: "expanding",
  silver_supply_event: null,
  latest_us_event: { event: "Core Inflation Rate MoM", surprise: "negative", usd_signal: "BEARISH" },
  fed_bias: "dovish",
  equities_regime: "neutral",
  global_growth_regime: "growth_improving",
  geopolitical_risk_flag: false
};

function gateRow(inputs) {
  const item = {
    snapshot_id: 4242,
    agent_name: "SILVER",
    layer: 1,
    snapshot_date: "2026-09-12",
    run_time_et: "2026-09-12T13:00:00.000Z",
    market_inputs: inputs
  };
  return runGate({ first: () => ({ json: item }) })[0].json;
}

// --- the live Layer 2 builder's extraction semantics, reproduced verbatim ---
function parseMaybeJson(value, fallback = {}) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch (e) { return fallback; }
}
function parseMaybeArray(value, fallback = []) {
  if (value === null || value === undefined || value === "") return fallback;
  if (Array.isArray(value)) return value;
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : fallback; }
  catch (e) { return [String(value)]; }
}
function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function clamp(value, min = 0, max = 100) {
  const n = toNumber(value);
  if (n === null) return null;
  return Math.max(min, Math.min(max, Math.round(n)));
}
function normalizeDirection(value) {
  const raw = String(value || "PENDING").trim().toUpperCase().replace(/\s+/g, "_");
  if (["PENDING", "NO_24H_CALL", "NO_CLEAR_BIAS", "NEUTRAL", "MARKET_CLOSED", ""].includes(raw)) return "NO_CLEAR_BIAS";
  if (raw.includes("BULLISH") || raw.includes("LONG")) return "BULLISH";
  if (raw.includes("BEARISH") || raw.includes("SHORT")) return "BEARISH";
  return "NO_CLEAR_BIAS";
}
function outputFromRow(row) {
  return parseMaybeJson(row.full_output, parseMaybeJson(row.raw_agent_output, {}));
}
function assetCall(rows, target) {
  const row = rows
    .filter((item) => item.agent_name === target && Number(item.layer) === 1)
    .filter((item) => {
      const output = outputFromRow(item);
      const todayCall = output.today_call || {};
      return item.call_24h_direction || item.direction_24h || output.direction_24h || todayCall.direction;
    })
    .sort((a, b) => new Date(b.created_at || b.run_time_et || 0) - new Date(a.created_at || a.run_time_et || 0))[0] || null;

  if (!row) return { agent: target, direction: "NO_CLEAR_BIAS", conviction: null, reason: "" };

  const output = outputFromRow(row);
  const todayCall = output.today_call || {};
  return {
    agent: target,
    direction: normalizeDirection(todayCall.direction || row.call_24h_direction || row.direction_24h || output.direction_24h),
    conviction: clamp(todayCall.confidence ?? row.call_24h_conviction ?? row.conviction_24h ?? output.conviction_24h),
    reason: todayCall.executive_summary || row.call_24h_reason || output.reason_24h || row.reasoning_summary || output.reasoning_summary || "",
    warnings: [
      ...parseMaybeArray(row.warnings),
      ...parseMaybeArray(output.risk_flags),
      ...parseMaybeArray(output.warnings),
      ...parseMaybeArray(todayCall.invalidation_risks)
    ].filter(Boolean)
  };
}
function pairDecision(rows, base, instrument, usdDirection, usdConviction) {
  const usd = { agent: "USD", direction: usdDirection, conviction: usdConviction };
  const call = assetCall(rows, base);
  const LOW_CONVICTION_THRESHOLD = 60;
  const confidence = clamp(((call.conviction ?? 0) + (usd.conviction ?? 0)) / 2);
  if (call.conviction === null || usd.conviction === null) return { instrument, verdict: "avoid" };
  if (call.direction === "NO_CLEAR_BIAS" || usd.direction === "NO_CLEAR_BIAS") return { instrument, verdict: "avoid" };
  if (call.conviction < LOW_CONVICTION_THRESHOLD || usd.conviction < LOW_CONVICTION_THRESHOLD) return { instrument, verdict: "avoid" };
  if (call.direction === usd.direction) return { instrument, verdict: "avoid" };
  if (call.direction === "BULLISH" && usd.direction === "BEARISH") return { instrument, verdict: "BUY", confidence, reason: call.reason };
  if (call.direction === "BEARISH" && usd.direction === "BULLISH") return { instrument, verdict: "SELL", confidence, reason: call.reason };
  return { instrument, verdict: "avoid" };
}

test("the real SILVER gate runs standalone and produces a directional Layer 2 row", () => {
  const row = gateRow(BASE_INPUTS);
  assert.equal(row.agent_name, "SILVER");
  assert.equal(row.layer, 1);
  assert.equal(row.direction_24h, "BULLISH");
  assert.ok(row.conviction_24h > 60, `expected strong conviction, got ${row.conviction_24h}`);
  assert.ok(row.full_output);
  assert.equal(row.full_output.asset, "SILVER");
  assert.equal(row.call_24h_direction, row.direction_24h);
  assert.equal(row.call_24h_conviction, row.conviction_24h);
  assert.ok(row.call_24h_reason.includes("deterministic Silver score"));
});

test("the live Layer 2 extractor can consume the SILVER row without adaptation", () => {
  const row = gateRow(BASE_INPUTS);
  const call = assetCall([row], "SILVER");
  assert.equal(call.agent, "SILVER");
  assert.equal(call.direction, "BULLISH");
  assert.equal(call.conviction, row.conviction_24h);
  assert.ok(call.reason.length > 0, "Layer 2 reason must not be empty");
});

test("SILVER plus an opposing USD produces an XAG/USD Layer 2 opportunity", () => {
  const row = gateRow(BASE_INPUTS);
  const decision = pairDecision([row], "SILVER", "XAG/USD", "BEARISH", 80);
  assert.equal(decision.verdict, "BUY");
  assert.ok(decision.confidence >= 60);
  assert.ok(decision.reason.includes("deterministic Silver score"));
});

test("a balanced SILVER verdict is handled without a false trade", () => {
  const row = gateRow({ ...BASE_INPUTS, silver_d1_pct: 0, silver_d5_pct: 0, silver_d20_pct: 0,
    dxy_d1: 0, dxy_d5: 0, dxy_d20: 0, us_10y_real_yield_d5_bps: 0,
    us_10y_real_yield_d20_bps: 0, gold_silver_ratio_d5_pct: 0, gold_silver_ratio_d20_pct: 0,
    fed_bias: "neutral", global_growth_regime: "neutral", industrial_demand_regime: "neutral",
    vix_level: 20, latest_us_event: null, copper_3m_pct: null, industrial_production_3m_pct: null });
  assert.equal(row.direction_24h, "NO_CLEAR_BIAS");
  assert.equal(row.conviction_24h, 0);
  const decision = pairDecision([row], "SILVER", "XAG/USD", "BEARISH", 80);
  assert.equal(decision.verdict, "avoid");
});

test("a missing 24H conviction makes the pair fail closed rather than guess", () => {
  const row = gateRow(BASE_INPUTS);
  const decision = pairDecision([row], "SILVER", "XAG/USD", "BEARISH", null);
  assert.equal(decision.verdict, "avoid");
});

test("the unavailable supply factor never invents a directional signal", () => {
  const row = gateRow(BASE_INPUTS);
  assert.equal(row.factor_breakdown.F10.signal, "NEUTRAL");
  assert.equal(row.factor_breakdown.F10.evidence, "No verified supply/event feed");
});
