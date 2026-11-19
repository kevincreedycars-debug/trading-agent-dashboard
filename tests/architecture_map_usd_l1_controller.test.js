// Guards the Architecture tab's USD Layer 1 controller view against drift.
//
// The manifest is checked by the same validator the page uses, then the new view is tied back to real
// files and artifacts: every referenced evidence file must exist, the parity and comparison JSON must
// still carry the numbers the node text quotes, and the two n8n wrapper nodes must keep saying they are
// built but not imported. The last case reads script.js because a manifest-driven renderer can only
// reach the controller view when it is both in the Research view group and in the waterfall stages.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { validateManifest } = require("../scripts/validate_architecture_map.js");

const repoRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(repoRoot, "data", "architecture-map.json");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

const manifest = readJson("data/architecture-map.json");
const controllerView = manifest.views.find((view) => view.id === "usd-l1-controller");
const nodeById = new Map(manifest.nodes.map((node) => [node.id, node]));

test("the committed manifest passes the architecture validator", () => {
  assert.deepEqual(validateManifest(manifest), []);
  assert.ok(fs.existsSync(manifestPath));
  assert.match(manifest.metadata.version, /^2026-11-19-architecture-mirror-v2$/);
});

test("the controller view is complete and every referenced evidence file exists", () => {
  assert.ok(controllerView, "usd-l1-controller view is missing");

  const expectedNodes = [
    "usd_l1_backtester_panel",
    "usd_l1_backtest_controller",
    "usd_l1_controller_cli",
    "usd_l1_controller_evidence",
    "usd_l1_backtest_controller_workflow",
    "usd_l1_layer1_decision_workflow"
  ];
  assert.deepEqual([...controllerView.node_ids].sort(), [...expectedNodes].sort());
  assert.equal(controllerView.edge_ids.length, 6);
  assert.deepEqual([...controllerView.boundary_ids].sort(), ["n8n_runtime", "research_stack"]);

  for (const nodeId of expectedNodes) {
    const node = nodeById.get(nodeId);
    assert.ok(node, `${nodeId} is missing from nodes`);
    assert.ok(controllerView.layout.nodes[nodeId], `${nodeId} is missing layout coordinates`);
    assert.ok(node.files.length > 0, `${nodeId} names no evidence file`);
    for (const file of node.files) {
      assert.ok(fs.existsSync(path.join(repoRoot, file)), `${nodeId} references missing file ${file}`);
    }
  }
});

test("the controller and its CLI are verified by the parity artifact", () => {
  const controller = nodeById.get("usd_l1_backtest_controller");
  const cli = nodeById.get("usd_l1_controller_cli");
  assert.equal(controller.verification.status, "verified");
  assert.equal(cli.verification.status, "verified");

  const parity = readJson("data/usd-layer1-backtester/parity-v1.json");
  assert.equal(parity.controller_version, "usd-l1-backtest-controller-v1");
  assert.equal(parity.dataset.path, "data/usd-layer1-backtester/run-v1.json");
  assert.equal(parity.dataset.schema_version, "usd-layer1-backtester-panel-v1");
  assert.equal(parity.dataset.run_version, "usd-l1-backtester-r1");
  assert.equal(parity.dataset.sessions, 725);
  assert.equal(parity.ok, true);
  const panel = readJson("data/usd-layer1-backtester/run-v1.json");
  assert.equal(panel.sessions.length, parity.dataset.sessions);
  assert.equal(parity.checked, 2175);
  assert.equal(parity.decision_matches, 2175);
  assert.equal(parity.decision_mismatches, 0);
  assert.equal(parity.results_checked, 8700);
  assert.equal(parity.result_matches, 8700);
  assert.equal(parity.result_mismatches, 0);
  assert.match(controller.verification.evidence, /2,175\/2,175/);
  assert.match(controller.verification.evidence, /8,700\/8,700/);
});

test("the comparison artifact keeps the window and deltas quoted by the evidence node", () => {
  const evidence = nodeById.get("usd_l1_controller_evidence");
  assert.equal(evidence.verification.status, "verified");

  const compare = readJson("data/usd-layer1-backtester/compare-v1.json");
  assert.equal(compare.controller_version, "usd-l1-backtest-controller-v1");
  assert.equal(compare.baseline, "current");
  assert.deepEqual(compare.models, ["current", "challenger", "challenger_v1"]);
  assert.equal(compare.validation_mode, "structural");
  assert.deepEqual(compare.window, { from: "2024-01-02", to: "2026-10-12", requested_dates: 725 });
  assert.equal(compare.deltas.challenger.pooled, -0.0219);
  assert.equal(compare.deltas.challenger_v1.pooled, -0.02);
  assert.match(evidence.verification.evidence, /-0\.0219/);
  assert.match(evidence.verification.evidence, /-0\.0200/);
});

test("the n8n wrapper nodes claim a built artifact, not a live run", () => {
  const child = nodeById.get("usd_l1_layer1_decision_workflow");
  const parent = nodeById.get("usd_l1_backtest_controller_workflow");

  assert.equal(child.verification.status, "partially_verified");
  assert.equal(parent.verification.status, "partially_verified");
  assert.equal(child.kind, "n8n Research Workflow");
  assert.equal(parent.kind, "n8n Research Workflow");

  const childNotes = child.verification.notes.join(" ");
  const parentNotes = parent.verification.notes.join(" ");
  assert.match(childNotes, /built, not running/i);
  assert.match(parentNotes, /blocked on import/i);
  assert.match(parent.verification.evidence, /REPLACE_WITH_LAYER1_SUBWORKFLOW_ID/);
  assert.match(parentNotes, /unverified/i);

  for (const node of [child, parent]) {
    assert.doesNotMatch(JSON.stringify(node.verification), /live execution is verified|active in n8n/i);
  }

  const childWorkflow = readJson("automation/n8n/usd-l1-layer1-decision.workflow.json");
  const parentWorkflow = readJson("automation/n8n/usd-l1-backtest-controller.workflow.json");
  assert.equal(childWorkflow.active, false);
  assert.equal(parentWorkflow.active, false);

  const executableNodes = (workflow) =>
    workflow.nodes.filter((node) => node.type !== "n8n-nodes-base.stickyNote");
  assert.equal(executableNodes(childWorkflow).length, 5);
  assert.equal(executableNodes(parentWorkflow).length, 9);

  const childCommand = childWorkflow.nodes.find((node) => node.name === "Evaluate one morning")?.parameters?.command || "";
  assert.match(childCommand, /run_usd_l1_backtest_controller\.js/);
  for (const flag of ["--dataset", "--model", "--date", "--validation", "--decisions"]) {
    assert.ok(childCommand.includes(flag), `child command is missing ${flag}`);
  }

  const listDates = parentWorkflow.nodes.find((node) => node.name === "List session dates")?.parameters?.command || "";
  assert.match(listDates, /--list-dates/);

  const fanOut = parentWorkflow.nodes.find((node) => node.type === "n8n-nodes-base.executeWorkflow");
  assert.equal(fanOut.parameters.workflowId.value, "REPLACE_WITH_LAYER1_SUBWORKFLOW_ID");
  assert.equal(fanOut.parameters.mode, "each");
  assert.equal(fanOut.parameters.options.waitForSubWorkflow, true);
});

test("the manifest renderer registers the controller view and its stages", () => {
  const script = fs.readFileSync(path.join(repoRoot, "script.js"), "utf8");
  assert.match(script, /v=20261119-architecture-mirror-v2/);
  assert.match(script, /"adr-l2l-research", "usd-l1-controller"/);
  assert.match(script, /"usd-l1-controller": \{\s*stages: \[/);
  assert.match(script, /nodeIds: \["usd_l1_backtester_panel"\]/);
  assert.match(script, /nodeIds: \["usd_l1_backtest_controller_workflow", "usd_l1_layer1_decision_workflow"\]/);
});
