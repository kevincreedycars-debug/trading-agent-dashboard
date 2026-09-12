const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  LOW_CONVICTION_THRESHOLD,
  EUR_CROSS_PAIRS
} = require("../../../pair-coverage/eur/layer2_pair_adapter");

const repoRoot = path.join(__dirname, "..", "..", "..");
const draftPath = "pair-coverage/eur/exports/eur_pair_layer2_agent.json";
const draft = JSON.parse(fs.readFileSync(path.join(repoRoot, draftPath), "utf8"));

const FRED_PLACEHOLDER_PREFIX = "FRED_API_KEY";
const KNOWN_LEAKED_KEYS = [
  "09f21c24ed25f7a25791b32e1cee3138",
  "2IN3KKFU7553XNYS",
  "d808mnpr01qq9ln30cd0d808mnpr01qq9ln30cdg"
];

const nodeByName = (name) => draft.nodes.find((node) => node.name === name);
const codeNode = nodeByName("Code | Build EUR Pair Layer 2 JSON");

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

test("the EUR pair draft is a review-only (inactive) n8n-shaped workflow with closed connections", () => {
  assert.equal(draft.active, false);
  assert.equal(draft.isArchived, false);
  assert.ok(Array.isArray(draft.nodes) && draft.nodes.length > 0);
  for (const node of draft.nodes) {
    assert.ok(typeof node.name === "string" && node.name.length > 0);
    assert.ok(typeof node.type === "string" && node.type.length > 0);
    assert.ok(node.parameters && typeof node.parameters === "object");
  }
  assertConnectionsClosed(draft);
});

test("reads exactly the seven needed Layer 1 legs and never writes back to Supabase", () => {
  const supabaseNodes = draft.nodes.filter((node) => node.type === "n8n-nodes-base.supabase");
  assert.equal(supabaseNodes.length, 7);

  const agents = [];
  for (const node of supabaseNodes) {
    assert.equal(node.parameters.tableId, "agent_outputs");
    assert.equal(node.parameters.operation, "getAll");
    assert.equal(node.parameters.orderBy, "created_at.desc");
    const conditions = node.parameters.filters.conditions;
    agents.push(conditions.find((condition) => condition.keyName === "agent_name").keyValue);
    assert.equal(conditions.find((condition) => condition.keyName === "layer").keyValue, 1);
  }
  assert.deepEqual(agents.sort(), ["BTC", "EUR", "GBP", "GOLD", "NQ", "SILVER", "WTI"]);
  assert.equal(
    draft.nodes.some((node) => node.parameters.dataToSend === "autoMapInputData"),
    false
  );
});

test("publishes only data/layer2.json and carries no credentials", () => {
  const githubNodes = draft.nodes.filter((node) => node.type === "n8n-nodes-base.github");
  assert.equal(githubNodes.length, 1);
  assert.equal(githubNodes[0].parameters.filePath, "data/layer2.json");
  assert.equal(githubNodes[0].parameters.operation, "edit");

  const text = JSON.stringify(draft);
  assert.equal(text.includes('"credentials"'), false, "draft must not embed credential bindings");
  assert.equal(text.includes("api_key="), false);
  assert.equal(text.includes(FRED_PLACEHOLDER_PREFIX), false);
  for (const leaked of KNOWN_LEAKED_KEYS) {
    assert.equal(text.includes(leaked), false, `leaked key present: ${leaked}`);
  }
});

test("every embedded code node compiles", () => {
  for (const node of draft.nodes) {
    if (node.type !== "n8n-nodes-base.code") continue;
    assert.doesNotThrow(() => new Function(node.parameters.jsCode), `${node.name} failed to compile`);
  }
});

test("the embedded pair list and threshold match the tested adapter module", () => {
  const jsCode = codeNode.parameters.jsCode;

  const embedded = [...jsCode.matchAll(
    /pairCode: "([A-Z_]+)", instrument: "([^"]+)", base: "([^"]+)", quote: "([^"]+)"/g
  )].map((match) => ({
    pairCode: match[1],
    instrument: match[2],
    base: match[3],
    quote: match[4]
  }));
  assert.deepEqual(embedded, EUR_CROSS_PAIRS);

  const threshold = jsCode.match(/LOW_CONVICTION_THRESHOLD = (\d+)/);
  assert.ok(threshold, "draft must declare LOW_CONVICTION_THRESHOLD");
  assert.equal(Number(threshold[1]), LOW_CONVICTION_THRESHOLD);
});

test("the embedded code is quote-agnostic and keeps the live avoid reasons", () => {
  const jsCode = codeNode.parameters.jsCode;

  assert.equal(jsCode.includes("USD"), false, "draft must not hardwire a USD quote");
  assert.ok(jsCode.includes("const quote = calls[pair.quote];"));
  assert.ok(jsCode.includes("quoteLabel"));
  for (const reason of [
    "Missing 24H conviction from one or both Layer 1 assets.",
    "One or both assets have no clear 24H bias.",
    "Mixed or low conviction 24H signals.",
    "Both assets point in the same 24H direction, so there is no clear relative edge."
  ]) {
    assert.ok(jsCode.includes(reason), `missing live avoid reason: ${reason}`);
  }
  for (const instrument of ["EUR/GBP", "XAU/EUR", "XAG/EUR", "WTI/EUR", "NQ/EUR", "BTC/EUR"]) {
    assert.ok(jsCode.includes(instrument), `missing instrument: ${instrument}`);
  }
});

test("the classifier matches the tested module's fall-closed semantics", () => {
  const jsCode = codeNode.parameters.jsCode;
  assert.ok(/BULLISH|LONG/.test(jsCode));
  assert.ok(/BEARISH|SHORT/.test(jsCode));
  assert.ok(jsCode.includes("NO_CLEAR_BIAS"));
  assert.ok(jsCode.includes("full_output"));
  assert.ok(jsCode.includes("raw_agent_output"));
  assert.ok(jsCode.includes("file_content"));
});
