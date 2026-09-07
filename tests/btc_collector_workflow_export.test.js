const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const workflowPath = path.join(__dirname, "..", "exports", "btc_collector.json");

function assertVixFailureIsExplicitlyPartial(workflow) {
  const node = workflow.nodes.find((candidate) => candidate.name === "HTTP Request | VIX - FRED Api");
  assert.equal(node.retryOnFail, true);
  assert.equal(node.maxTries, 3);
  assert.equal(node.waitBetweenTries, 5000);
  assert.equal(node.onError, "continueRegularOutput");
}

test("BTC collector tolerates transient VIX provider failures", () => {
  const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf8"));
  assertVixFailureIsExplicitlyPartial(workflow);
  assertVixFailureIsExplicitlyPartial(workflow.activeVersion);
});
