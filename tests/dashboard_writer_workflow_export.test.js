const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const workflowPath = path.join(__dirname, "..", "exports", "dashboard_writer.json");

function assertBoundedReads(workflow) {
  const reads = workflow.nodes.filter((node) => node.type === "n8n-nodes-base.supabase" && node.parameters?.tableId === "agent_outputs");
  assert.equal(reads.length, 5);
  for (const read of reads) {
    assert.equal(read.parameters.limit, 20);
    assert.equal(read.parameters.orderBy, "created_at.desc");
  }
}

test("Dashboard Writer bounds full-output history reads", () => {
  const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf8"));
  assertBoundedReads(workflow);
  assertBoundedReads(workflow.activeVersion);
});
