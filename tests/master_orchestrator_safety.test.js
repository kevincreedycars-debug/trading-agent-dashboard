const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  applyFailClosedEconomicEventPath,
  buildHealthNodeName,
  guardNodeName,
  publishHealthNodeName
} = require("../scripts/apply_master_economic_event_fail_closed");

const exportPath = path.resolve(__dirname, "..", "exports", "master_orchestrator.json");

function readWorkflow() {
  return JSON.parse(fs.readFileSync(exportPath, "utf8"));
}

test("master workflow routes economic-event failures away from collectors", () => {
  const workflow = readWorkflow();
  const source = workflow.nodes.find((node) => node.name === "Call '1. Economic Events Collector'");
  assert.equal(source.onError, "continueErrorOutput");
  assert.deepEqual(workflow.connections[source.name].main[0], [{ node: guardNodeName, type: "main", index: 0 }]);
  assert.deepEqual(workflow.connections[source.name].main[1], [{ node: buildHealthNodeName, type: "main", index: 0 }]);
  assert.deepEqual(workflow.connections[guardNodeName].main[0], [{ node: "USD Collector", type: "main", index: 0 }]);
  assert.deepEqual(workflow.connections[buildHealthNodeName].main[0], [{ node: publishHealthNodeName, type: "main", index: 0 }]);
});

test("master workflow patcher is idempotent", () => {
  const once = applyFailClosedEconomicEventPath(readWorkflow());
  const twice = applyFailClosedEconomicEventPath(once);
  assert.equal(twice.nodes.filter((node) => node.name === guardNodeName).length, 1);
  assert.equal(twice.nodes.filter((node) => node.name === buildHealthNodeName).length, 1);
  assert.equal(twice.nodes.filter((node) => node.name === publishHealthNodeName).length, 1);
});

test("generated n8n Code nodes are syntactically valid", () => {
  const workflow = readWorkflow();
  for (const name of [guardNodeName, buildHealthNodeName]) {
    const node = workflow.nodes.find((candidate) => candidate.name === name);
    assert.doesNotThrow(() => new Function(node.parameters.jsCode), `${name} contains invalid JavaScript`);
  }
});
