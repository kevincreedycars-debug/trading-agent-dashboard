const test = require("node:test");
const assert = require("node:assert/strict");
const {
  callFromAgentOutputRow,
  callFromLayer1Agent,
  latestLayer1RowPerAgent,
  callsFromAgentOutputRows,
  callsFromLayer1Dashboard
} = require("../../../pair-coverage/eur/layer1_call_adapter");

test("reads the Supabase agent_outputs row shape the live Layer 2 node consumes", () => {
  const row = {
    agent_name: "EUR",
    layer: 1,
    created_at: "2026-09-11T06:00:00Z",
    full_output: JSON.stringify({
      today_call: { direction: "BULLISH_LEAN", confidence: 72 }
    })
  };
  assert.deepEqual(callFromAgentOutputRow(row), { direction: "BULLISH", conviction: 72 });
});

test("accepts object output and falls back through the live field precedence", () => {
  assert.deepEqual(
    callFromAgentOutputRow({ full_output: { direction_24h: "BEARISH", conviction_24h: 66 } }),
    { direction: "BEARISH", conviction: 66 }
  );
  assert.deepEqual(
    callFromAgentOutputRow({ raw_agent_output: '{"today_call":{"direction":"SHORT","confidence":61}}' }),
    { direction: "BEARISH", conviction: 61 }
  );
  assert.deepEqual(
    callFromAgentOutputRow({ call_24h_direction: "NO_24H_CALL", call_24h_conviction: null }),
    { direction: "NO_CLEAR_BIAS", conviction: null }
  );
  assert.deepEqual(callFromAgentOutputRow({}), { direction: "NO_CLEAR_BIAS", conviction: null });
});

test("reads the dashboard layer1.json agent shape", () => {
  assert.deepEqual(
    callFromLayer1Agent({ agent: "GOLD", calls: { "24h": { direction: "BEARISH", conviction: 66 } } }),
    { direction: "BEARISH", conviction: 66 }
  );
  assert.deepEqual(callFromLayer1Agent({ agent: "NQ", calls: {} }), {
    direction: "NO_CLEAR_BIAS",
    conviction: null
  });
});

test("keeps only the newest layer 1 row per agent", () => {
  const rows = [
    { agent_name: "EUR", layer: 1, created_at: "2026-09-11T05:00:00Z", call_24h_direction: "BEARISH", call_24h_conviction: 50 },
    { agent_name: "EUR", layer: 1, created_at: "2026-09-11T06:00:00Z", call_24h_direction: "BULLISH", call_24h_conviction: 72 },
    { agent_name: "EUR", layer: 2, created_at: "2026-09-11T07:00:00Z", call_24h_direction: "BEARISH", call_24h_conviction: 10 },
    { agent_name: "BTC", layer: 1, created_at: "2026-09-11T06:00:00Z", call_24h_direction: "BULLISH", call_24h_conviction: 63 }
  ];
  const latest = latestLayer1RowPerAgent(rows);
  assert.equal(latest.size, 2);
  assert.equal(latest.get("EUR").call_24h_conviction, 72);

  assert.deepEqual(callsFromAgentOutputRows(rows), {
    EUR: { direction: "BULLISH", conviction: 72 },
    BTC: { direction: "BULLISH", conviction: 63 }
  });
});

test("maps a full layer1.json document to per-asset calls", () => {
  const calls = callsFromLayer1Dashboard({
    agents: [
      { agent: "USD", calls: { "24h": { direction: "BULLISH", conviction: 70 } } },
      { agent: "EUR", calls: { "24h": { direction: "BULLISH", conviction: 70 } } },
      { agent: "GOLD", calls: { "24h": { direction: "BEARISH", conviction: 66 } } }
    ]
  });
  assert.deepEqual(calls, {
    USD: { direction: "BULLISH", conviction: 70 },
    EUR: { direction: "BULLISH", conviction: 70 },
    GOLD: { direction: "BEARISH", conviction: 66 }
  });
});
