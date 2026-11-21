"use strict";

// Guards the generated Cloud controller behind the Backtesting tab's Layer 1 map: the checked-in bundle is
// the deterministic build of the pinned sources, every registered Cloud model has a child pinned to it,
// the parent is generated from the registry rather than a hardcoded pair, and the committed evidence is
// the record of real executions. Research only: every guard reads files. No workflow is activated,
// executed or edited by this suite.

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const builder = require("../scripts/build_usd_l1_n8n_cloud_workflows");
const map = require("../lib/backtesting_n8n_map");
const registry = require("../backtester/lib/usd_layer1_backtester/model_registry");
const ledgerLib = require("../lib/backtesting_n8n_run_ledger");

const ROOT = path.join(__dirname, "..");
const MANIFEST_PATH = "automation/n8n/usd-l1-cloud-workflows.manifest.json";
const EVIDENCE_PATH = "data/usd-layer1-backtester/n8n-execution-evidence-v1.json";
const COMBINE_NODE = "Compare the selected models";

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/^\uFEFF/, "");
const readJson = (rel) => JSON.parse(read(rel));
const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");
const lf = (text) => text.replace(/\r\n/g, "\n");
const crlf = (text) => lf(text).replace(/\n/g, "\r\n");

function nodeNamed(workflow, name) {
  const found = workflow.nodes.find((node) => node.name === name);
  assert.ok(found, workflow.name + " has no node named " + name);
  return found;
}

const manifest = readJson(MANIFEST_PATH);
const evidence = readJson(EVIDENCE_PATH);
const parent = readJson(manifest.parent.file);
const children = manifest.children.map((child) => Object.assign({}, child, { workflow: readJson(child.file) }));
const cloudModels = registry.ENTRIES.filter((entry) => entry.cloud);
const runNodeName = (label) => "Run " + label;

test("the checked-in Cloud bundle is the deterministic build of the pinned sources", () => {
  const onDisk = read(manifest.bundle_path);
  // Endings are a checkout property: the published bundle was built in a CRLF checkout, so compare the
  // code with the hashes masked and verify each hash by value below.
  const codeOnly = (text) => lf(text).replace(/[0-9a-f]{64}/g, "<sha256>");
  assert.equal(codeOnly(builder.buildBundle()), codeOnly(onDisk),
    "automation/n8n/usd-l1-cloud-runtime.js is stale - regenerate with node scripts/build_usd_l1_n8n_cloud_workflows.js");

  assert.equal(manifest.schema_version, "usd-l1-cloud-workflows-v2");
  assert.equal(manifest.bundle_version, builder.BUNDLE_VERSION);
  assert.equal(manifest.bundle_sha256, sha256(JSON.stringify(manifest.source_files)));
  assert.equal(manifest.bundle_bytes, fs.statSync(path.join(ROOT, manifest.bundle_path)).size);
  assert.equal(manifest.registry.schema_version, registry.REGISTRY_VERSION);
  assert.equal(manifest.registry.models.length, registry.ENTRIES.length);
  assert.equal(manifest.parent.default_selection.join(","), registry.DEFAULT_SELECTION.join(","));

  for (const source of manifest.source_files) {
    if (source.stub) {
      assert.equal(source.path, "backtester/lib/usd_layer1_backtester/current_model.js");
      assert.match(onDisk, /the current adapter is not available in the n8n Cloud runtime/,
        "the stubbed control adapter is what the bundle carries instead of the production adapter");
      continue;
    }
    const text = read(source.path);
    const hashes = [sha256(text), sha256(lf(text)), sha256(crlf(text))];
    assert.ok(hashes.includes(source.sha256), `${source.path} hash does not match the checked-in source`);
  }
});

test("every registered Cloud model has a child pinned to exactly that model", () => {
  assert.deepEqual(children.map((child) => child.model), cloudModels.map((entry) => entry.key));
  assert.equal(manifest.registry.default_selection.includes("fixture_constant"), false,
    "a fixture is never part of the default research selection");
  assert.equal(registry.getModel("fixture_constant").role, "fixture");
  assert.equal(registry.getModel("fixture_constant").kind, "fixture");

  for (const child of children) {
    const entry = registry.requireModel(child.model);
    assert.equal(child.identity, entry.identity);
    assert.equal(child.name, `USD Layer 1 - ${entry.label} (Cloud adapter)`);
    const evalNode = child.workflow.nodes.find((node) => node.type === "n8n-nodes-base.code");
    assert.match(evalNode.parameters.jsCode, new RegExp(`const __pinnedModel = "${child.model}"`));
    assert.match(evalNode.parameters.jsCode, /module\.exports : globalThis\.UsdL1CloudRuntime/);
    assert.equal(child.workflow.nodes.filter((node) => node.type === "n8n-nodes-base.executeWorkflowTrigger").length, 1);
    assert.equal(child.workflow.nodes.filter((node) => node.type.includes("schedule")).length, 0);
  }
});

test("the generated runtime accepts any registered Cloud model and refuses the rest", () => {
  const runtime = require(path.join(ROOT, "automation/n8n/usd-l1-cloud-runtime.js"));
  const dataset = readJson("data/usd-layer1-backtester/run-v1.json");
  const session = dataset.sessions.find((entry) => entry.date === "2024-01-09");
  const meta = {
    path: "data/usd-layer1-backtester/run-v1.json",
    schema_version: dataset.schema_version,
    run_version: dataset.run.run_version,
    generated_at: dataset.generated_at,
    input_source_legend: dataset.input_source_legend
  };
  for (const entry of cloudModels) {
    const result = runtime.evaluateOne({
      date: session.date,
      model: entry.key,
      validation: "structural",
      session,
      dataset_meta: meta
    });
    assert.equal(result.model, entry.key);
    assert.equal(result.model_entry.identity, entry.identity);
    assert.equal(result.model_entry.role, entry.role);
    assert.equal(result.bundle_version, builder.BUNDLE_VERSION);
    assert.ok(result.decision.call);
  }
  assert.throws(() => runtime.evaluateOne({
    date: session.date,
    model: "current",
    validation: "structural",
    session,
    dataset_meta: meta
  }), /not available in the n8n Cloud runtime/);
  assert.throws(() => runtime.evaluateOne({
    date: session.date,
    model: "not_registered",
    validation: "structural",
    session,
    dataset_meta: meta
  }), /not in the generated registry/);
});

test("the parent is generated from the registry: one chained pair per Cloud model, no fixed pair", () => {
  const config = nodeNamed(parent, "Run configuration").parameters.jsCode;
  assert.match(config, /const REGISTRY = \{/);
  assert.match(config, /body\.models/);
  assert.match(config, /REGISTRY\.default_selection/);
  assert.match(config, /REGISTRY\.max_selection/);
  assert.match(config, /registered but not available in the Cloud runtime/);
  assert.match(config, /body\.dates/);
  assert.match(config, /at most 40/);
  assert.match(config, /dates\.length === 1 \? dates\[0\] : null/);

  const combine = nodeNamed(parent, COMBINE_NODE).parameters.jsCode;
  assert.match(combine, /const REGISTRY = \{/);
  assert.match(combine, /const MODEL_NODES = \{/);
  assert.match(combine, /config\.models/);
  assert.match(combine, /usd-l1-n8n-technical-failure-v1/);
  assert.match(combine, /usd-l1-n8n-cloud-execution-v2/);
  assert.match(combine, /usd-l1-experiment-identity-v1/);
  assert.match(combine, /fixtures_excluded/);

  const executeNodes = parent.nodes.filter((node) => node.type === "n8n-nodes-base.executeWorkflow");
  assert.deepEqual(executeNodes.map((node) => node.name), cloudModels.map((entry) => runNodeName(entry.label)));
  assert.deepEqual(executeNodes.map((node) => node.parameters.workflowId.value), children.map((child) => child.workflow_id));
  assert.equal(parent.nodes.filter((node) => node.type === "n8n-nodes-base.merge").length, 0,
    "the branches are chained, so no merge node can stall on an unselected model");
  assert.equal(parent.nodes.filter((node) => node.type.includes("schedule")).length, 0);
  assert.equal(parent.nodes.filter((node) => node.type === "n8n-nodes-base.executeCommand").length, 0);

  // The chain runs every registered model in registry order and ends at the combiner.
  let previous = "Select one saved morning";
  for (const entry of cloudModels) {
    const bindName = `Bind ${entry.label}`;
    assert.deepEqual(parent.connections[previous].main[0].map((link) => link.node), [bindName]);
    previous = runNodeName(entry.label);
  }
  assert.deepEqual(parent.connections[previous].main[0].map((link) => link.node), [COMBINE_NODE]);
  assert.equal(nodeNamed(parent, "Controlled webhook run").parameters.authentication, "headerAuth");
  assert.ok(nodeNamed(parent, "Controlled webhook run").credentials.httpHeaderAuth.id);
});

test("the committed evidence reports the models that ran and keeps the claims apart", () => {
  const ledger = readJson("data/usd-layer1-backtester/n8n/run-ledger-v1.json");
  const summary = ledgerLib.summarise(ledger);
  const ranModels = Object.keys(summary.by_model);
  assert.deepEqual(evidence.identities.selected.map((entry) => entry.key), ranModels);
  assert.equal(evidence.execution_index.length, summary.records);
  assert.equal(evidence.sweep.report.records, summary.records);
  assert.equal(evidence.sweep.report.unique_dates, summary.unique_dates);
  assert.equal(evidence.sweep.report.model_calls, summary.model_calls);
  assert.equal(evidence.sweep.report.requested_dates, summary.unique_dates);

  assert.equal(evidence.claims.consistency.status, "established");
  assert.equal(evidence.claims.historical_availability.status, "not_established");
  assert.match(evidence.claims.historical_availability.statement, /replayed the committed panel/);
  assert.equal(evidence.claims.model_logic.status, "not_established");
  assert.equal(evidence.claims.coverage.status, "not_established");

  for (const entry of evidence.execution_index) {
    assert.ok(entry.parent_execution.id, entry.id);
    assert.ok(entry.models && Object.keys(entry.models).length > 0, entry.id);
  }
});

test("the map swaps models without changing the morning or the gate", () => {
  const first = evidence.execution_cases[0];
  const entry = map.selectCase(evidence, first.id);
  assert.equal(entry.id, first.id);

  const v0 = map.selectedCaseModel(entry, "challenger");
  const v1 = map.selectedCaseModel(entry, "challenger_v1");
  assert.equal(v0.identity, "usd-layer1-challenger-v0");
  assert.equal(v1.identity, "usd-layer1-challenger-v1");
  assert.notEqual(v0.execution_id, v1.execution_id);
  assert.deepEqual(v0.validation, v1.validation,
    "switching the version on the map does not move the input-availability gate");

  const rules0 = map.ruleRows(evidence, "challenger");
  const rules1 = map.ruleRows(evidence, "challenger_v1");
  assert.equal(rules0.length, rules1.length);
  assert.ok(rules0.length > 0);
  assert.deepEqual(rules0.map((rule) => rule.id), rules1.map((rule) => rule.id),
    "the two versions score the same inputs");
  assert.notDeepEqual(rules0.map((rule) => rule.weight), rules1.map((rule) => rule.weight),
    "the swap changes the frozen weighting, which is what the evidence is for");

  const graph0 = map.graph(evidence, first.id, "challenger");
  const graph1 = map.graph(evidence, first.id, "challenger_v1");
  const childOf = (graph) => graph.nodes.find((node) => node.id === "child");
  assert.match(childOf(graph0).summary, /usd-layer1-challenger-v0/);
  assert.match(childOf(graph1).summary, /usd-layer1-challenger-v1/);
  assert.equal(childOf(graph0).links[1].href, v0.execution_url);
  assert.equal(childOf(graph1).links[1].href, v1.execution_url);
  assert.equal(graph0.nodes.find((node) => node.id === "comparison").summary.split(" ")[0],
    "usd-layer1-challenger-v1");
  assert.equal(graph1.nodes.find((node) => node.id === "comparison").summary.split(" ")[0],
    "usd-layer1-challenger-v0");
  const transcript = graph1.nodes.find((node) => node.id === "execution").summary;
  assert.ok(transcript.includes(first.parent_execution.id));
  assert.ok(transcript.includes(v1.execution_id));
  assert.equal(graph1.nodes.filter((node) => node.id === "h1").length, 1);
  assert.equal(graph1.nodes.find((node) => node.id === "h1").status, "not_invoked");
  assert.equal(graph0.nodes.length, graph1.nodes.length);
  assert.deepEqual(graph0.edges.map((edge) => edge.from + "->" + edge.to),
    graph1.edges.map((edge) => edge.from + "->" + edge.to));
});

test("the map exposes the selected models and one node per recorded morning", () => {
  const options = map.modelOptions(evidence);
  assert.deepEqual(options.map((option) => option.key), evidence.identities.selected.map((entry) => entry.key));
  assert.ok(options.every((option) => option.role));
  const fixtureOption = options.find((option) => option.role === "fixture");
  if (fixtureOption) assert.match(fixtureOption.label, /FIXTURE \(not a research model\)/);

  const selection = map.selectionSummary(evidence);
  assert.deepEqual(selection.research_models, options.filter((option) => option.role !== "fixture").map((option) => option.key));
  assert.equal(selection.fixture_present, Boolean(fixtureOption));

  const dates = map.dateEvidence(evidence);
  const dateNodes = dates.nodes.filter((node) => node.kind === "date");
  assert.equal(dateNodes.length, evidence.execution_index.length);
  const modelNodes = dates.nodes.filter((node) => node.kind === "model" || node.kind === "fixture");
  assert.ok(modelNodes.length >= evidence.execution_index.length);
  assert.ok(modelNodes.every((node) => node.links && node.links.length === 2));
  assert.equal(dates.edges.length, modelNodes.length);
  const fixtureNode = modelNodes.find((node) => node.kind === "fixture");
  if (fixtureNode) assert.equal(fixtureNode.kind, "fixture");
});

test("every generated Code node is valid JavaScript", () => {
  // A generated node is only useful if n8n can parse it; this guard caught a real split-block defect
  // before it reached an execution.
  const workflows = [parent].concat(children.map((child) => child.workflow));
  for (const workflow of workflows) {
    for (const node of workflow.nodes.filter((entry) => entry.type === "n8n-nodes-base.code")) {
      assert.doesNotThrow(() => new Function(node.parameters.jsCode), `${workflow.name} -> ${node.name}`);
    }
  }
});
