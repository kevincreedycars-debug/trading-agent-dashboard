const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const workflowPath = path.join(__dirname, "..", "exports", "layer2_trade_selection_agent.json");
const expectedAgents = ["USD", "EUR", "GOLD", "NQ", "BTC"];

function assertBoundedAgentReads(workflow) {
  const nodes = workflow.nodes.filter((node) => node.type === "n8n-nodes-base.supabase");

  assert.equal(nodes.length, expectedAgents.length);
  assert.deepEqual(
    nodes.map((node) => node.parameters.filters.conditions.find((condition) => condition.keyName === "agent_name")?.keyValue),
    expectedAgents
  );

  for (const node of nodes) {
    assert.equal(node.parameters.tableId, "agent_outputs");
    assert.equal(node.parameters.operation, "getAll");
    assert.equal(node.parameters.limit, 20);
    assert.equal(node.parameters.orderBy, "created_at.desc");
    assert.equal(node.parameters.matchType, "allFilters");
    assert.deepEqual(node.parameters.filters.conditions, [
      { keyName: "agent_name", condition: "eq", keyValue: node.parameters.filters.conditions[0].keyValue },
      { keyName: "layer", condition: "eq", keyValue: "1" }
    ]);
    assert.ok(workflow.connections[node.name], `${node.name} must feed the Layer 2 builder`);
  }
}

test("Layer 2 limits reads to recent Layer 1 outputs per agent", () => {
  const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf8"));

  assertBoundedAgentReads(workflow);
  assertBoundedAgentReads(workflow.activeVersion);
});

test("Layer 2 retries a GitHub file revision conflict before failing", () => {
  const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf8"));

  for (const version of [workflow, workflow.activeVersion]) {
    const write = version.nodes.find((node) => node.name === "Write data/layer2.json to GitHub");
    assert.ok(write, "Layer 2 must publish the dashboard data file");
    assert.equal(write.retryOnFail, true);
    assert.equal(write.maxTries, 4);
    assert.equal(write.waitBetweenTries, 5000);
  }
});
