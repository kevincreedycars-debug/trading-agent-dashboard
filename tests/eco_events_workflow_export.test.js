const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const workflowPath = path.join(__dirname, "..", "exports", "eco_events_collector.json");

function assertRollingWindowLookup(workflow) {
  const node = workflow.nodes.find((candidate) => candidate.name === "Supabase | Get Existing Economic Events");
  assert.ok(node, "existing-events lookup must exist");
  assert.deepEqual(node.parameters.filters.conditions.map(({ keyName, condition }) => ({ keyName, condition })), [
    { keyName: "event_date", condition: "gte" },
    { keyName: "event_date", condition: "lte" }
  ]);
}

test("Eco Events checks the complete incoming date window before creating rows", () => {
  const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf8"));
  assertRollingWindowLookup(workflow);
  assertRollingWindowLookup(workflow.activeVersion);
});
