const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const contract = require("./helpers/silverSnapshotContract");

const root = path.join(__dirname, "..", "..", "..");
const load = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const node = (workflow, name) => workflow.nodes.find((item) => item.name === name);

function closed(workflow) {
  const names = new Set(workflow.nodes.map((item) => item.name));
  for (const [source, outputs] of Object.entries(workflow.connections)) {
    assert.ok(names.has(source), `${source} must exist as a node`);
    for (const list of outputs.main || []) {
      for (const edge of list) {
        assert.ok(names.has(edge.node), `${edge.node} must exist as a node`);
        assert.equal(edge.type, "main");
      }
    }
  }
}

const collector = load("exports/silver_collector.json");
const agent = load("exports/silver_layer1_agent.json");

test("SILVER exports are inactive drafts with closed graphs and unique node names", () => {
  for (const workflow of [collector, agent]) {
    assert.equal(workflow.active, false);
    assert.ok(workflow.nodes.length > 0);
    assert.equal(new Set(workflow.nodes.map((item) => item.name)).size, workflow.nodes.length);
    closed(workflow);
  }
});

test("collector republishes the shared superset so no other agent can be starved", () => {
  const code = node(collector, "Normalise Market Snapshot").parameters.jsCode;
  for (const key of contract.SHARED_SUPERSET_FIELDS) {
    assert.ok(code.includes(`${key}:`), `shared field ${key} must be written by the SILVER collector`);
  }
});

test("collector writes the silver-specific factor inputs", () => {
  const code = node(collector, "Normalise Market Snapshot").parameters.jsCode;
  for (const key of contract.SILVER_SPECIFIC_FIELDS) {
    assert.ok(code.includes(`${key}:`), `silver field ${key} must be written`);
  }
  assert.ok(code.includes("silver_v1_economic_events_weighted_inputs"));
});

test("collector uses the verified spot and FRED providers", () => {
  const urls = collector.nodes
    .filter((item) => item.type === "n8n-nodes-base.httpRequest")
    .map((item) => String(item.parameters.url));
  assert.ok(urls.some((url) => url === "https://api.coinbase.com/v2/prices/XAG-USD/spot"));
  assert.ok(urls.some((url) => url.includes("XAU-USD/spot")));
  assert.ok(urls.some((url) => url.includes("series_id=PCOPPUSDM")));
  assert.ok(urls.some((url) => url.includes("series_id=INDPRO")));
  assert.ok(urls.some((url) => url.includes("series_id=DFII10")));
  assert.ok(urls.some((url) => url.includes("series_id=DTWEXBGS")));
  assert.ok(urls.some((url) => url.includes("series_id=VIXCLS")));
  assert.ok(urls.some((url) => url.includes("finnhub.io")));
});

test("collector has exactly one market_snapshots write and keeps the history read", () => {
  const supabase = collector.nodes.filter((item) => item.type === "n8n-nodes-base.supabase");
  const writes = supabase.filter((item) => item.parameters.dataToSend === "autoMapInputData");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].parameters.tableId, "market_snapshots");
  assert.ok(supabase.some((item) => item.parameters.operation === "getAll"
    && item.parameters.tableId === "market_snapshots"));
});

test("agent reads the shared snapshot table and writes agent_outputs", () => {
  const supabase = agent.nodes.filter((item) => item.type === "n8n-nodes-base.supabase");
  const reads = supabase.filter((item) => item.parameters.operation === "getAll");
  assert.equal(reads.length, 1);
  assert.equal(reads[0].parameters.tableId, "market_snapshots");
  const writes = supabase.filter((item) => item.parameters.dataToSend === "autoMapInputData");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].parameters.tableId, "agent_outputs");
});

test("agent follows the live shared-table contract instead of an asset column", () => {
  const code = node(agent, "Build SILVER Input Pack").parameters.jsCode;
  assert.ok(code.includes("snapshot_date && r.run_time_et"));
  assert.ok(!code.includes("asset ==="), "the live market_snapshots table has no asset column");
});

test("agent carries the reviewed logic document inline and reads the silver bridge", () => {
  const logicNode = node(agent, "Get SILVER Logic Document");
  assert.equal(logicNode.type, "n8n-nodes-base.code");
  assert.ok(logicNode.parameters.jsCode.includes("logic/agent_silver_direction.md"));
  assert.ok(logicNode.parameters.jsCode.includes("1.0_weighted_engine"));
  const pack = node(agent, "Build SILVER Input Pack").parameters.jsCode;
  assert.ok(pack.includes("snapshot.raw_payload && snapshot.raw_payload.silver"),
    "the agent must read the raw_payload.silver bridge");
});

test("collector keeps the silver fields in raw_payload and not in typed columns", () => {
  const code = node(collector, "Normalise Market Snapshot").parameters.jsCode;
  assert.ok(/raw_payload: \{\s*silver: silverPayload,/.test(code));
  const rowBlock = code.match(/const row = \{([\s\S]*?)\n  data_quality: \{/)[1];
  const typedSilver = [...rowBlock.matchAll(/^\s{2}([a-zA-Z_0-9]+):/gm)]
    .map((match) => match[1])
    .filter((key) => /^(silver_|copper_|industrial_|gold_silver_)/.test(key));
  assert.deepEqual(typedSilver, [], "silver fields must not be written as typed columns before the migration");
});

test("agent emits the Layer 2 consumption contract, not a bare classification", () => {
  const text = JSON.stringify(agent);
  for (const field of ["agent_name", "direction_24h", "conviction_24h", "call_24h_direction",
    "call_24h_conviction", "call_24h_reason", "full_output", "raw_agent_output",
    "factor_breakdown", "weighted_score", "conviction_model", "reasoning_summary"]) {
    assert.ok(text.includes(`${field}:`), `agent output must include ${field}`);
  }
  assert.ok(text.includes("1.0_weighted_engine"));
});

test("the logic document, the helper and the embedded gate weights all agree", () => {
  const logic = read("logic/agent_silver_direction.md");
  const rows = [...logic.matchAll(/^\|\s*(F\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/gm)];
  assert.equal(rows.length, 10, "logic document must publish the ten-factor timeframe table");

  const fromLogic = {};
  for (const row of rows) {
    fromLogic[row[1]] = [Number(row[2]), Number(row[3]), Number(row[4]), Number(row[5]), Number(row[6])];
  }

  const order = ["24h", "3d", "current_week", "next_week", "current_month"];
  for (const [index, timeframe] of order.entries()) {
    for (const [factor, values] of Object.entries(fromLogic)) {
      assert.equal(values[index], contract.SILVER_TIMEFRAME_WEIGHTS[timeframe][factor],
        `${factor} ${timeframe} weight must match between the logic document and the helper`);
    }
  }

  const gate = node(agent, "Calculate SILVER Conviction").parameters.jsCode;
  const block = gate.match(/const TIMEFRAME_WEIGHTS = \{([\s\S]*?)\n\};/);
  assert.ok(block, "gate must define TIMEFRAME_WEIGHTS");
  for (const timeframe of order) {
    const line = block[1].split("\n").find((text) => text.includes(`"${timeframe}":`));
    assert.ok(line, `gate must define "${timeframe}"`);
    for (const [factor, expected] of Object.entries(contract.SILVER_TIMEFRAME_WEIGHTS[timeframe])) {
      assert.ok(new RegExp(`${factor}:\\s*${expected}\\b`).test(line),
        `gate ${timeframe} ${factor} must be ${expected}`);
    }
  }
});

test("the SILVER collector is a strict superset of the proven Gold collector row", () => {
  const gold = load("exports/gold_collector.json");
  const goldCode = node(gold, "Normalise Market Snapshot").parameters.jsCode;
  const rowBlock = goldCode.match(/const row = \{([\s\S]*?)\n  data_quality: \{/);
  assert.ok(rowBlock, "gold row block must be readable");
  const goldKeys = [...rowBlock[1].matchAll(/^\s{2}([a-z_0-9]+):/gm)].map((match) => match[1]);
  assert.ok(goldKeys.length > 30, `expected a large gold superset, found ${goldKeys.length}`);

  const silverCode = node(collector, "Normalise Market Snapshot").parameters.jsCode;
  const missing = goldKeys.filter((key) => !silverCode.includes(`  ${key}:`));
  assert.deepEqual(missing, [], "the SILVER collector must not drop any shared Gold field");
});

test("drafts contain no real credential material and use environment references", () => {
  const text = JSON.stringify([collector, agent]);
  assert.ok(text.includes("$env.FRED_API_KEY"));
  assert.ok(text.includes("$env.FINNHUB_API_KEY"));
  assert.ok(text.includes("$env.ALPHA_VANTAGE_API_KEY"));
  assert.doesNotMatch(text, /2IN3KKFU7553XNYS|09f21c24ed25f7a25791b32e1cee3138|d808mnpr01qq9ln30cd0/);
});
