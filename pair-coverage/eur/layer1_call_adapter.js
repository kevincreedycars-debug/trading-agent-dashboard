// Isolated adapter: real Layer 1 output -> normalized pair-vote call.
//
// Two live shapes exist and both are supported so the pair layer can be driven
// from either source without re-deriving semantics:
//
//   1. Supabase `agent_outputs` rows - the shape the live Layer 2 n8n code node
//      consumes. Field precedence mirrors `assetCall()` in
//      `exports/layer2_trade_selection_agent.json` exactly.
//   2. `data/layer1.json` agents - the shape the dashboard consumes via
//      `getCall(agent, "24h")` in `script.js`.
//
// Pure: no I/O, no Supabase, no dashboard state.

const { normalizeDirection, clampConviction } = require("./layer2_pair_adapter");

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function parseMaybeJson(value, fallback = {}) {
  if (!hasValue(value)) return fallback;
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch (error) {
    return fallback;
  }
}

// Mirrors `assetCall()` in the live Layer 2 code node.
function callFromAgentOutputRow(row) {
  const output = parseMaybeJson(row?.full_output, parseMaybeJson(row?.raw_agent_output, {}));
  const todayCall = output.today_call || {};
  return {
    direction: normalizeDirection(
      todayCall.direction || row?.call_24h_direction || row?.direction_24h || output.direction_24h
    ),
    conviction: clampConviction(
      todayCall.confidence ?? row?.call_24h_conviction ?? row?.conviction_24h ?? output.conviction_24h
    )
  };
}

// Mirrors `getCall(agent, "24h")` plus the direction/conviction fields the
// dashboard pair loop reads in `deriveLiveLayer2Dashboard()`.
function callFromLayer1Agent(agent) {
  const call = agent?.calls?.["24h"] || {};
  return {
    direction: normalizeDirection(call.direction),
    conviction: clampConviction(call.conviction ?? call.confidence)
  };
}

function timestampOf(row) {
  const value = Date.parse(row?.created_at || row?.generated_at || row?.run_time_et || "");
  return Number.isFinite(value) ? value : 0;
}

// Mirrors `latestFor(agent)`: newest `layer === 1` row per agent wins.
function latestLayer1RowPerAgent(rows = []) {
  const latest = new Map();
  for (const row of rows) {
    if (Number(row?.layer) !== 1) continue;
    const agent = row?.agent_name;
    if (!agent) continue;
    const current = latest.get(agent);
    if (!current || timestampOf(row) > timestampOf(current)) latest.set(agent, row);
  }
  return latest;
}

function callsFromAgentOutputRows(rows = []) {
  const calls = {};
  for (const [agent, row] of latestLayer1RowPerAgent(rows)) {
    calls[agent] = callFromAgentOutputRow(row);
  }
  return calls;
}

function callsFromLayer1Dashboard(layer1Data = {}) {
  const calls = {};
  for (const agent of layer1Data.agents || []) {
    if (!agent?.agent) continue;
    calls[agent.agent] = callFromLayer1Agent(agent);
  }
  return calls;
}

module.exports = {
  hasValue,
  parseMaybeJson,
  callFromAgentOutputRow,
  callFromLayer1Agent,
  latestLayer1RowPerAgent,
  callsFromAgentOutputRows,
  callsFromLayer1Dashboard
};
