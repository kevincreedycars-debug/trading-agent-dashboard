const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { GBP_FACTOR_WEIGHTS } = require("./helpers/gbpSnapshotContract");

const repoRoot = path.join(__dirname, "..", "..");
const load = (rel) => JSON.parse(fs.readFileSync(path.join(repoRoot, rel), "utf8"));
const readText = (rel) => fs.readFileSync(path.join(repoRoot, rel), "utf8");

const collector = load("exports/gbp_collector.json");
const agent = load("exports/gbp_layer1_agent.json");
const logicDoc = readText("logic/agent_gbp_direction.md");

const FRED_PLACEHOLDER = "FRED_API_KEY_PLACEHOLDER_DO_NOT_COMMIT_REAL_KEY";
const KNOWN_LEAKED_KEYS = [
  "09f21c24ed25f7a25791b32e1cee3138", // FRED key embedded in the legacy EUR collector export
  "2IN3KKFU7553XNYS", // Alpha Vantage key embedded in the legacy EUR collector export
  "d808mnpr01qq9ln30cd0d808mnpr01qq9ln30cdg" // Finnhub token embedded in the legacy EUR collector export
];

function nodeByName(workflow, name) {
  return workflow.nodes.find((node) => node.name === name);
}

function assertConnectionsClosed(workflow) {
  const names = new Set(workflow.nodes.map((node) => node.name));
  for (const [source, outputs] of Object.entries(workflow.connections || {})) {
    assert.ok(names.has(source), `connection source missing node: ${source}`);
    for (const outputList of outputs.main || []) {
      for (const output of outputList) {
        assert.ok(names.has(output.node), `connection target missing node: ${output.node}`);
        assert.equal(output.type, "main");
      }
    }
  }
}

function allText(workflow) {
  return JSON.stringify(workflow);
}

test("GBP drafts are review-only (inactive) n8n-shaped workflows with closed connections", () => {
  for (const workflow of [collector, agent]) {
    assert.equal(workflow.active, false);
    assert.equal(workflow.isArchived, false);
    assert.ok(Array.isArray(workflow.nodes) && workflow.nodes.length > 0);
    for (const node of workflow.nodes) {
      assert.ok(typeof node.name === "string" && node.name.length > 0);
      assert.ok(typeof node.type === "string" && node.type.length > 0);
      assert.ok(node.parameters && typeof node.parameters === "object");
    }
    assertConnectionsClosed(workflow);
  }
});

test("GBP collector draft has the required trigger, providers, gates and single write target", () => {
  for (const expected of [
    "When Executed by Another Workflow",
    "HTTP Request | US 2Y Treasury Yield - FRED API",
    "HTTP Request | VIX - FRED Api",
    "HTTP Request | DXY - FRED Dollar Index - FRED API",
    "HTTP Request | UK 10Y Benchmark Yield - FRED api",
    "HTTP Request | GBP/USD - Coinbase",
    "Supabase | Get Previous Market Snapshots",
    "Code | Build GBP Snapshot Row",
    "Code | Evaluate GBP Snapshot Usability",
    "Create a row"
  ]) {
    assert.ok(nodeByName(collector, expected), `collector missing node: ${expected}`);
  }
  assert.equal(nodeByName(collector, "When Executed by Another Workflow").type, "n8n-nodes-base.executeWorkflowTrigger");

  const supabaseNodes = collector.nodes.filter((node) => node.type === "n8n-nodes-base.supabase");
  const writes = supabaseNodes.filter((node) => node.parameters.dataToSend === "autoMapInputData");
  const reads = supabaseNodes.filter((node) => node.parameters.operation === "getAll");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].parameters.tableId, "market_snapshots");
  assert.equal(reads.length, 1);
  assert.equal(reads[0].parameters.tableId, "market_snapshots");
});

test("GBP agent draft is isolated to its own logic doc, market_snapshots reads and agent_outputs write", () => {
  for (const expected of [
    "When Executed by Another Workflow",
    "Supabase Get Many",
    "Code | Build GBP Input Pack",
    "Get GBP Logic Document",
    "Code | Combine GBP logic & market snapshot",
    "Message a model",
    "Code | Parse GBP Agent Output",
    "Code | Deterministic GBP 24H Verdict Gate",
    "Create a row"
  ]) {
    assert.ok(nodeByName(agent, expected), `agent missing node: ${expected}`);
  }

  const logicNode = nodeByName(agent, "Get GBP Logic Document");
  assert.equal(logicNode.type, "n8n-nodes-base.github");
  assert.equal(logicNode.parameters.filePath, "logic/agent_gbp_direction.md");
  assert.equal(logicNode.parameters.resource, "file");

  const supabaseNodes = agent.nodes.filter((node) => node.type === "n8n-nodes-base.supabase");
  assert.equal(supabaseNodes.length, 2);
  const reads = supabaseNodes.filter((node) => node.parameters.operation === "getAll");
  const writes = supabaseNodes.filter((node) => node.parameters.dataToSend === "autoMapInputData");
  assert.equal(reads.length, 1);
  assert.equal(reads[0].parameters.tableId, "market_snapshots");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].parameters.tableId, "agent_outputs");

  // Layer 1 isolation: the draft must not read other agent outputs or use other
  // agents' node names. ("Layer 2 event-adjusted calls" is allowed only inside
  // the model prompt as a prohibition instruction.)
  for (const node of agent.nodes) {
    for (const bannedPrefix of ["EUR Layer", "USD Layer", "Gold Layer", "NQ Layer", "BTC Layer"]) {
      assert.ok(!node.name.startsWith(bannedPrefix), `agent node name uses another asset scope: ${node.name}`);
    }
    if (node.type === "n8n-nodes-base.supabase") {
      const isRead = node.parameters.operation === "getAll";
      if (isRead) {
        assert.notEqual(node.parameters.tableId, "agent_outputs", "agent draft must not read agent_outputs");
      }
    }
  }
  const codeNodes = agent.nodes.filter((node) => node.type === "n8n-nodes-base.code");
  for (const codeNode of codeNodes) {
    const crossReferences = codeNode.parameters.jsCode.match(/\$\("([^"]+)"\)/g) || [];
    for (const reference of crossReferences) {
      const target = reference.replace(/\$\("|"\)$/g, "");
      assert.ok(
        ["Build GBP Input Pack", "Get GBP Logic Document", "Supabase Get Many"].includes(target),
        `code node ${codeNode.name} references unexpected node: ${target}`
      );
    }
  }
});

test("GBP drafts contain no real secret material (only the documented placeholder)", () => {
  for (const workflow of [collector, agent]) {
    const text = allText(workflow);
    for (const key of KNOWN_LEAKED_KEYS) {
      assert.ok(!text.includes(key), "draft contains a known leaked key fragment");
    }
    const apiKeyMatches = text.match(/api_key=([A-Za-z0-9_]+)/g) || [];
    for (const match of apiKeyMatches) {
      assert.equal(match, `api_key=${FRED_PLACEHOLDER}`);
    }
    const hexLike = text.match(/[0-9a-f]{32}/gi) || [];
    for (const candidate of hexLike) {
      assert.ok(!KNOWN_LEAKED_KEYS.includes(candidate.toLowerCase()), `32-char hex candidate in draft: ${candidate}`);
    }
  }
  assert.ok(allText(collector).includes(FRED_PLACEHOLDER));
});

test("deterministic 24H gate weights in the agent draft match the logic document factor table", () => {
  const gateCode = nodeByName(agent, "Code | Deterministic GBP 24H Verdict Gate").parameters.jsCode;

  const docWeights = {};
  for (const line of logicDoc.split(/\r?\n/)) {
    const match = line.match(/^\| (F\d+)\s+[^|]+\|\s*(\d+)\s*\|/);
    if (match) docWeights[match[1]] = Number(match[2]);
  }
  assert.deepEqual(docWeights, GBP_FACTOR_WEIGHTS);

  const gateWeights = {};
  for (const match of gateCode.matchAll(/F(\d+):\s*(\d+)/g)) {
    gateWeights[`F${match[1]}`] = Number(match[2]);
  }
  assert.deepEqual(gateWeights, GBP_FACTOR_WEIGHTS);
});

test("collector draft code writes the documented GBP snapshot fields and never fabricates fundamentals", () => {
  const buildCode = nodeByName(collector, "Code | Build GBP Snapshot Row").parameters.jsCode;
  for (const key of [
    "gbpusd_price",
    "gbpusd_d1_pct",
    "vix_level",
    "dxy_d1",
    "us_2y_yield",
    "uk_10y_yield",
    "uk_2y_yield",
    "uk_2y_d5_bps",
    "us_uk_2y_spread",
    "us_uk_2y_spread_d5_bps",
    "boe_bias",
    "latest_uk_event",
    "uk_composite_pmi",
    "uk_composite_pmi_direction",
    "uk_stress_flag",
    "global_growth_regime",
    "collector_version",
    "data_quality"
  ]) {
    assert.ok(buildCode.includes(key), `collector build code missing key: ${key}`);
  }
  for (const line of buildCode.split(/\r?\n/)) {
    assert.ok(!/boe_bias\s*[:=]\s*["'](hawkish|dovish)/i.test(line), "collector must not fabricate boe_bias");
  }
  const evaluateCode = nodeByName(collector, "Code | Evaluate GBP Snapshot Usability").parameters.jsCode;
  assert.ok(evaluateCode.includes("gbpusd_price"));
  assert.ok(evaluateCode.includes("return []"));
});

test("agent draft code enforces the GBP input and output contracts", () => {
  const inputPackCode = nodeByName(agent, "Code | Build GBP Input Pack").parameters.jsCode;
  assert.ok(inputPackCode.includes("isUsableGbpSnapshot"));
  assert.ok(inputPackCode.includes("isStaleGbpSnapshot"));
  assert.ok(inputPackCode.includes("No usable GBP market snapshot found"));
  assert.ok(inputPackCode.includes("available_inputs"));
  assert.ok(inputPackCode.includes("gbp_factor_map"));
  assert.ok(inputPackCode.includes("gbpusd_price"));

  const parseCode = nodeByName(agent, "Code | Parse GBP Agent Output").parameters.jsCode;
  assert.ok(parseCode.includes("agent_name: \"GBP\""));
  assert.ok(parseCode.includes("layer: 1"));
  assert.ok(parseCode.includes("call_24h_direction"));
  assert.ok(parseCode.includes("call_24h_conviction"));
  assert.ok(parseCode.includes("agent_gbp_direction.md"));
  assert.ok(/typeof raw === "object"/.test(parseCode), "parser must support object output");
  assert.ok(/JSON\.parse\(String\(raw\)\)/.test(parseCode), "parser must support string output");

  const gateCode = nodeByName(agent, "Code | Deterministic GBP 24H Verdict Gate").parameters.jsCode;
  assert.ok(gateCode.includes("NO_CLEAR_BIAS"));
  assert.ok(gateCode.includes("_LEAN"));
  assert.ok(gateCode.includes("weighted_score"));
});
