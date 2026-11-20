"use strict";

// Guards the versioned Cloud pair behind the Backtesting tab's Layer 1 map: the checked-in runtime bundle
// is the deterministic build of the pinned sources, each child is pinned to exactly one model, the parent
// swaps in those two children by id, and the committed evidence is the record of those real executions.
// Research only: every guard reads files. No workflow is activated, executed or edited by this suite.

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const builder = require("../scripts/build_usd_l1_n8n_cloud_workflows");
const map = require("../lib/backtesting_n8n_map");

const ROOT = path.join(__dirname, "..");
const MANIFEST_PATH = "automation/n8n/usd-l1-cloud-workflows.manifest.json";
const EVIDENCE_PATH = "data/usd-layer1-backtester/n8n-execution-evidence-v1.json";
const COMBINE_NODE = "Compare the two decisions";
const MERGE_NODE = "Gather both child answers";
const BIND_TO_CALL = [
  ["Bind challenger v0", "Run Challenger v0"],
  ["Bind challenger v1", "Run Challenger v1"]
];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/^\uFEFF/, "");
const readJson = (rel) => JSON.parse(read(rel));
const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");
// Line endings are a checkout property, not pinned content: the builder reads bytes, so a CRLF working
// tree and an LF clone hold the same source. A hash is compared against the source text in the form the
// publishing checkout had it (CRLF) and in the LF form, so both checkouts recognise the pinned file.
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
const childFor = (model) => manifest.children.find((child) => child.model === model);

test("the checked-in Cloud bundle is the deterministic build of the pinned sources", () => {
  const onDisk = read(manifest.bundle_path);
  // The published bundle was built in a checkout whose template and library files carry CRLF line
  // endings; a checkout with LF endings builds the same code with the same source text but different
  // sha256 digits for that text. Compare the code with the hash values masked, and check the hashes
  // by value against the manifest below, so the guard says the same thing on either checkout. The
  // runtime file itself is pinned with `-text`, so its published byte count survives every checkout.
  const codeOnly = (text) => lf(text).replace(/[0-9a-f]{64}/g, "<sha256>");
  assert.equal(codeOnly(builder.buildBundle()), codeOnly(onDisk),
    "automation/n8n/usd-l1-cloud-runtime.js is stale - regenerate with node scripts/build_usd_l1_n8n_cloud_workflows.js");

  assert.equal(manifest.schema_version, "usd-l1-cloud-workflows-v1");
  assert.equal(manifest.bundle_version, builder.BUNDLE_VERSION);
  // `bundle_sha256` is the hash of the source manifest the publishing checkout produced, so it is
  // verified as manifest-to-manifest below and by value per file further down. The source text itself
  // is checkout-invariant: each file may hash with or without CRLF and still be the pinned file.
  assert.equal(manifest.bundle_sha256, sha256(JSON.stringify(manifest.source_files)),
    "the recorded hash is the hash of the source manifest");
  assert.equal(manifest.bundle_bytes, fs.statSync(path.join(ROOT, manifest.bundle_path)).size,
    "the published size is the size of the checked-in file (pinned with `-text` in .gitattributes)");
  assert.ok(onDisk.includes(manifest.bundle_sha256), "the bundle carries its own source-set hash");

  assert.deepEqual(builder.SOURCE_FILES.map((file) => ({ path: file.path, stub: file.stub })),
    manifest.source_files.map((file) => ({ path: file.path, stub: file.stub })));
  assert.equal(manifest.source_files.length, 7);
  for (const file of manifest.source_files) {
    assert.ok(fs.existsSync(path.join(ROOT, file.path)), file.path + " is pinned but missing");
    if (file.stub) continue;
    const source = read(file.path);
    assert.ok([sha256(source), sha256(crlf(source))].includes(file.sha256),
      file.path + " changed since the bundle was built; rebuild and re-run the evidence");
  }
  const stub = manifest.source_files.filter((file) => file.stub).map((file) => file.path);
  assert.deepEqual(stub, ["backtester/lib/usd_layer1_backtester/current_model.js"],
    "the production adapter is the one file deliberately not bundled");

  assert.match(onDisk, /usd-l1-cloud-runtime-v1/);
  assert.ok(!/__MODULES__|__SOURCE_FILES__|__BUNDLE_SHA256__|__CONTROLLER_ID__/.test(onDisk),
    "no template placeholder survives into the bundle");
  assert.doesNotMatch(onDisk, /require\(\s*["'](?:node:)?(?:child_process|fs|path)["']\s*\)/,
    "the Cloud runtime has no host filesystem or process access");
  assert.ok(!onDisk.includes("usd_l1_25f_h1"), "the H1 candidate is never bundled into a challenger child");
});

test("both children are one-model Cloud adapters that cannot start themselves", () => {
  assert.deepEqual(children.map((child) => child.model).sort(), ["challenger", "challenger_v1"]);
  const bundle = lf(read(manifest.bundle_path));

  for (const child of children) {
    const workflow = child.workflow;
    assert.equal(workflow.name, child.name);
    assert.equal(workflow.settings.executionTimeout, 120);

    assert.deepEqual(workflow.nodes.filter((node) => /trigger/i.test(node.type)).map((node) => node.type),
      ["n8n-nodes-base.executeWorkflowTrigger"],
      child.name + " is callable by the parent and starts no other way");
    for (const forbidden of ["n8n-nodes-base.scheduleTrigger", "n8n-nodes-base.webhook", "n8n-nodes-base.executeCommand"]) {
      assert.ok(!workflow.nodes.some((node) => node.type === forbidden), child.name + " must not carry " + forbidden);
    }

    const code = workflow.nodes.find((node) => node.type === "n8n-nodes-base.code");
    assert.ok(code, child.name + " has no evaluation node");
    assert.equal(code.name, "Evaluate " + child.model + " from the saved morning");
    assert.match(code.parameters.jsCode, new RegExp('__pinnedModel = "' + child.model + '"'),
      child.name + " pins exactly one model key");
    assert.match(code.parameters.jsCode, /this child is pinned to/,
      "a request for the other model is refused rather than silently re-scored");
    assert.ok(lf(code.parameters.jsCode).startsWith(bundle),
      child.name + " embeds the checked-in runtime bundle unchanged");
    assert.ok(lf(code.parameters.jsCode).includes(child.identity), child.name + " names its frozen identity");
    assert.match(code.notes, new RegExp(child.identity));

    assert.equal(workflow.nodes.filter((node) => node.type === "n8n-nodes-base.noOp").length, 1,
      child.name + " returns one decision and does not aggregate");
    assert.ok(!JSON.stringify(workflow).includes("executeCommand"),
      child.name + " has no host command path");
  }

  assert.notEqual(children[0].workflow_id, children[1].workflow_id,
    "the two versions are separate workflows, not one workflow with a switch");
  assert.notEqual(children[0].name, children[1].name);
});

test("the paired controller swaps two versioned children and schedules nothing", () => {
  assert.equal(parent.name, manifest.parent.name);
  assert.equal(parent.settings.executionTimeout, 300);

  assert.ok(!parent.nodes.some((node) => node.type === "n8n-nodes-base.executeCommand"));
  assert.ok(!parent.nodes.some((node) => node.type === "n8n-nodes-base.scheduleTrigger"),
    "no schedule exists on the paired controller");
  const triggers = parent.nodes
    .filter((node) => node.type === "n8n-nodes-base.webhook" || /Trigger$/.test(node.type))
    .map((node) => node.type)
    .sort();
  assert.deepEqual(triggers, ["n8n-nodes-base.manualTrigger", "n8n-nodes-base.webhook"]);

  const webhook = nodeNamed(parent, "Controlled webhook run");
  assert.equal(webhook.parameters.path, manifest.parent.webhook_path);
  assert.equal(webhook.parameters.httpMethod, "POST");
  assert.equal(webhook.parameters.authentication, "headerAuth");
  assert.equal(webhook.parameters.responseMode, "lastNode");
  assert.ok(webhook.credentials && webhook.credentials.httpHeaderAuth && webhook.credentials.httpHeaderAuth.id,
    "the evidence webhook carries a header-auth credential");
  assert.match(webhook.notes, /deactivated after the run/);
  assert.equal(manifest.parent.webhook_authentication, "headerAuth");

  const calls = parent.nodes.filter((node) => node.type === "n8n-nodes-base.executeWorkflow");
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((node) => node.parameters.workflowId.value),
    manifest.children.map((child) => child.workflow_id),
    "each branch calls its own versioned workflow id");
  assert.deepEqual(calls.map((node) => node.parameters.workflowId.cachedResultName),
    manifest.children.map((child) => child.name));
  for (const call of calls) {
    assert.equal(call.parameters.workflowId.mode, "id");
    assert.equal(call.parameters.mode, "each");
    assert.equal(call.parameters.options.waitForSubWorkflow, true,
      "a child must finish before the pair is combined");
  }

  const binds = parent.nodes.filter((node) => /^Bind challenger/.test(node.name));
  assert.deepEqual(binds.map((node) => (node.parameters.jsCode.match(/model: "(\w+)"/) || [])[1]).sort(),
    ["challenger", "challenger_v1"],
    "each branch binds its own model key before the child is called");
  for (const [bindName, callName] of BIND_TO_CALL) {
    assert.deepEqual(parent.connections[bindName].main[0].map((connection) => connection.node), [callName]);
    assert.equal(parent.connections[callName].main[0][0].node, MERGE_NODE);
  }
  const merge = nodeNamed(parent, MERGE_NODE);
  assert.equal(merge.type, "n8n-nodes-base.merge");
  assert.deepEqual(parent.connections[MERGE_NODE].main[0].map((connection) => connection.node), [COMBINE_NODE]);
  assert.deepEqual(merge.parameters, { mode: "append", numberInputs: 2 },
    "both children must finish before the combiner pairs them");

  const combine = nodeNamed(parent, COMBINE_NODE).parameters.jsCode;
  assert.ok(combine.includes("Run Challenger v0") && combine.includes("Run Challenger v1"),
    "the combiner reads both children by name");
  assert.match(combine, /same_direction/);
  assert.match(combine, /performance/i, "the combiner refuses to pick a winner from performance");

  const fetchPanel = nodeNamed(parent, "Fetch committed panel");
  assert.equal(fetchPanel.parameters.url, "={{ $json.dataset_url }}");
  const config = nodeNamed(parent, "Run configuration").parameters.jsCode;
  assert.ok(config.includes("run-v1.json"), "the panel is the committed run artefact, not a provider read");
  assert.ok(config.includes("structural") && config.includes("receipted"));
  assert.ok(!parent.nodes.some((node) => /supabase|oanda|alpha|fred/i.test(node.type)));

  assert.equal(parent.active, undefined, "the generated artefact does not activate itself");
});

test("the committed evidence is the real swap over the same saved mornings", () => {
  assert.equal(evidence.research_only, true);
  assert.equal(evidence.bundle.bundle_sha256, manifest.bundle_sha256,
    "the evidence was produced from this bundle, not a rebuilt one");
  assert.deepEqual(evidence.bundle.source_files, manifest.source_files);
  assert.equal(evidence.reproduction.cloud_bundle.bundle_sha256, manifest.bundle_sha256);
  assert.equal(evidence.reproduction.cloud_bundle.mismatches, 0);

  assert.equal(evidence.workflows.parent.webhook_deactivated_after_evidence, true);
  assert.equal(evidence.workflows.parent.active, false);
  assert.deepEqual(evidence.workflows.children.map((child) => child.id),
    manifest.children.map((child) => child.workflow_id));
  for (const child of evidence.workflows.children) {
    assert.equal(child.trigger, "execute-workflow trigger only; cannot self-start");
  }

  const cases = evidence.execution_cases;
  assert.ok(cases.length >= 3, "the swap is shown on more than one saved morning");
  assert.deepEqual([...new Set(cases.map((entry) => entry.outcome))].sort(),
    ["abstained", "allowed", "blocked"],
    "an allowed, a blocked and an abstained morning are all recorded");

  const executions = new Set();
  const rawFiles = new Set();
  for (const entry of cases) {
    assert.equal(entry.parent_execution.status, "success", entry.id + " parent run did not succeed");
    assert.equal(entry.parent_execution.workflow_id, evidence.workflows.parent.id);
    assert.equal(entry.outcome, entry.models.challenger.status,
      entry.id + " outcome is the recorded decision, not a winner selected from performance");
    assert.equal(entry.input_availability.accepted, entry.models.challenger.validation.accepted);
    assert.equal(typeof entry.raw_evidence, "string", entry.id + " must name its stored transcript");
    assert.match(entry.raw_evidence, /^data\/usd-layer1-backtester\/n8n\/execution-\d+-[a-z-]+\.json$/);
    const raw = readJson(entry.raw_evidence);
    assert.equal(raw.n8n.execution_id, entry.parent_execution.id);
    assert.equal(raw.n8n.workflow_id, entry.parent_execution.workflow_id);
    assert.equal(raw.date, entry.date);
    assert.equal(raw.validation_mode, entry.validation_mode);

    for (const model of ["challenger", "challenger_v1"]) {
      const child = childFor(model);
      const run = entry.models[model];
      assert.ok(run, entry.id + " has no " + model + " decision");
      assert.equal(run.workflow_id, child.workflow_id,
        entry.id + " " + model + " ran " + run.workflow_id + " instead of its own versioned child");
      assert.equal(run.identity, child.identity);
      assert.equal(run.execution_status, "success");
      assert.equal(run.execution_url, "https://silver17.app.n8n.cloud/execution/" + run.execution_id);
      assert.ok(!executions.has(run.execution_id), "one execution cannot stand for both models");
      executions.add(run.execution_id);
      assert.ok(["allowed", "blocked", "abstained"].includes(run.status));
      assert.ok(run.call && typeof run.call.direction === "string");
      assert.ok(read(entry.raw_evidence).includes(run.execution_id),
        entry.id + " " + model + " is absent from the stored transcript for execution " + run.execution_id);
    }

    assert.equal(entry.models.challenger.model_version, "usd-layer1-challenger-v0");
    assert.equal(entry.models.challenger_v1.model_version, "usd-layer1-challenger-v1");
    assert.notEqual(entry.models.challenger.execution_id, entry.models.challenger_v1.execution_id);
    assert.deepEqual(entry.models.challenger.validation, entry.models.challenger_v1.validation,
      entry.id + " gave the two children different input-availability gates");
    assert.equal(typeof entry.comparison.same_direction, "boolean");
    assert.match(entry.comparison.note, /not a performance claim/);

    for (const file of [entry.raw_evidence]) {
      assert.ok(fs.existsSync(path.join(ROOT, file)), file + " is named by the evidence but missing");
      rawFiles.add(file);
    }
  }
  assert.equal(rawFiles.size, cases.length, "each saved morning stores its own execution transcript");

  const options = map.modelOptions(evidence);
  assert.deepEqual(options.map((option) => option.key), map.MODELS);
  assert.deepEqual(options.map((option) => option.id),
    ["usd-layer1-challenger-v0", "usd-layer1-challenger-v1"]);
  assert.ok(!JSON.stringify(options).includes("usd_l1_25f_h1"),
    "the H1 candidate is excluded from the swap control");
  assert.equal(map.headline(evidence).h1, "not invoked");
});

test("the map swaps the model without changing the morning or the gate", () => {
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

test("the same controller accepts a bounded batch without changing the child contract", () => {
  const config = nodeNamed(parent, "Run configuration").parameters.jsCode;
  assert.match(config, /body\.dates/, "the webhook accepts a list of mornings");
  assert.match(config, /at most 40/, "a batch is bounded so one execution stays inspectable");
  assert.match(config, /dates\.length === 1 \? dates\[0\] : null/, "a single-date request keeps the original config shape");

  const select = nodeNamed(parent, "Select one saved morning").parameters.jsCode;
  assert.match(select, /config\.dates/, "selection reads the list, not one literal date");
  assert.match(select, /wanted\.map/, "one item per morning so each child execution stays visible");

  const combine = nodeNamed(parent, COMBINE_NODE).parameters.jsCode;
  assert.match(combine, /\.all\(\)/, "the combiner pairs every returned child answer");
  assert.match(combine, /usd-l1-n8n-technical-failure-v1/,
    "a missing child is recorded as a technical failure, never as a guessed call");
  assert.match(combine, /wanted\.length > 1/, "the batch block is only added for a multi-morning run");
  assert.match(combine, /requested_dates/);
  assert.match(combine, /performance/i);
});

