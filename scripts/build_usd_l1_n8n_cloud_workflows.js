#!/usr/bin/env node
"use strict";

/**
 * Generate the Cloud-safe USD Layer 1 n8n workflows (research only).
 * n8n Cloud has no Execute Command node, so the controller and the two frozen challenger adapters
 * are bundled into Code nodes. The source files are hashed and the bundle is tested against the Node
 * controller. See automation/n8n/templates/ for the readable n8n glue.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "automation", "n8n");
const TPL = path.join(OUT, "templates");
const BUNDLE = path.join(OUT, "usd-l1-cloud-runtime.js");
const registry = require("../backtester/lib/usd_layer1_backtester/model_registry");
const CHILD_FILES = Object.fromEntries(registry.ENTRIES
  .filter((modelEntry) => modelEntry.cloud)
  .map((modelEntry) => [modelEntry.key, path.join(OUT, `usd-l1-${modelEntry.key.replace(/_/g, "-")}.cloud.workflow.json`)]));
const PARENT = path.join(OUT, "usd-l1-paired-controller.cloud.workflow.json");
const META = path.join(OUT, "usd-l1-cloud-workflows.manifest.json");
const IDS = {
  controller: "backtester/lib/usd_layer1_backtester/backtest_controller.js",
  contracts: "backtester/lib/usd_layer1_backtester/contracts.js",
  registry: "backtester/lib/usd_layer1_backtester/model_registry.js",
  fixture: "backtester/lib/usd_layer1_backtester/fixture_constant.js",
  challenger: "backtester/lib/usd_layer1_backtester/challenger.js",
  challenger_v1: "backtester/lib/usd_layer1_backtester/challenger_v1.js",
  test_modules: "lib/layer1_backtesting/test_modules.js",
  votes: "lib/usd_l1_votes.js",
  session: "backtester/lib/usd_session_engine_interface.js",
  current: "backtester/lib/usd_layer1_backtester/current_model.js"
};
const BUNDLE_VERSION = "usd-l1-cloud-runtime-v3";
/** Stable hash of the registry document that is injected into the parent workflow. */
function registryDocument() {
  const doc = registry.publicRegistry();
  return Object.assign(doc, { fingerprint: sha256(JSON.stringify(doc)) });
}
const CURRENT_STUB = `"use strict";

// The production-control adapter depends on the replay core's filesystem/Supabase helpers. It is
// deliberately not bundled. The two Cloud children use the frozen challengers only.
module.exports = {
  evaluate() {
    throw new Error("the current adapter is not available in the n8n Cloud runtime; use challenger or challenger_v1");
  }
};
`;

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/^\uFEFF/, "");
}
function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}
function indent(text, spaces) {
  return text.split(/\r?\n/).map((line) => " ".repeat(spaces) + line).join("\n");
}
function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}
// A plain rebuild must not lose the ids the workflows were imported under. Environment variables win,
// then the ids already recorded in the checked-in manifest, then the parent's own webhook credential.
function readJsonIfPresent(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}
function pinnedIds() {
  const pins = { workflows: {}, webhookCredentialId: null };
  const meta = readJsonIfPresent(META);
  for (const child of (meta && meta.children) || []) {
    if (child.model && child.workflow_id) pins.workflows[child.model] = child.workflow_id;
  }
  const parent = readJsonIfPresent(PARENT);
  const webhook = ((parent && parent.nodes) || []).find((node) => node.type === "n8n-nodes-base.webhook");
  const credential = webhook && webhook.credentials && webhook.credentials.httpHeaderAuth;
  if (credential && credential.id) pins.webhookCredentialId = credential.id;
  return pins;
}
function template(name) {
  return read(`automation/n8n/templates/${name}`);
}

const MODULES = [
  [IDS.controller, read(IDS.controller)],
  [IDS.contracts, read(IDS.contracts)],
  [IDS.registry, read(IDS.registry)],
  [IDS.fixture, read(IDS.fixture)],
  [IDS.challenger, read(IDS.challenger)],
  [IDS.challenger_v1, read(IDS.challenger_v1)],
  [IDS.test_modules, read(IDS.test_modules)],
  [IDS.votes, read(IDS.votes)],
  [IDS.session, read(IDS.session)],
  [IDS.current, CURRENT_STUB, true]
].map(([id, source, stub]) => ({ id, source, stub: Boolean(stub) }));

const SOURCE_FILES = MODULES.map((m) => ({ path: m.id, sha256: sha256(m.source), stub: m.stub }));
// The templates shape the workflow glue and the runtime's own entry point: `evaluateOne` is a template, not a
// module, so a change there would otherwise leave the identity untouched. They are hashed into the same list,
// which makes the source-set hash cover everything that can change what a deployed workflow computes.
const TEMPLATE_FILES = [
  "usd-l1-cloud-runtime.tmpl",
  "usd-l1-parent-config.js",
  "usd-l1-parent-select.js",
  "usd-l1-parent-bind.js",
  "usd-l1-parent-combine.js",
  "usd-l1-child-wrapper.js"
].map((name) => ({ path: `automation/n8n/templates/${name}`, sha256: sha256(template(name)), stub: false }));
const ALL_SOURCE_FILES = SOURCE_FILES.concat(TEMPLATE_FILES);
const BUNDLE_SHA256 = sha256(JSON.stringify(ALL_SOURCE_FILES));

function moduleFunctions() {
  return MODULES.map((m) => [
    `    ${JSON.stringify(m.id)}: function(module, exports, require) {`,
    indent(m.source, 6),
    "    }"
  ].join("\n")).join(",\n");
}

function buildBundle() {
  return template("usd-l1-cloud-runtime.tmpl")
    .replace("__BUNDLE_VERSION__", BUNDLE_VERSION)
    .replace("__BUNDLE_SHA256__", BUNDLE_SHA256)
    .replace("__SOURCE_FILES__", JSON.stringify(ALL_SOURCE_FILES, null, 2))
    .replace("__MODULES__", moduleFunctions())
    .replace("__CONTROLLER_ID__", IDS.controller)
    .replace("__REGISTRY_ID__", IDS.registry);
}

function childCode(model) {
  return `${fs.readFileSync(BUNDLE, "utf8")}\n${template("usd-l1-child-wrapper.js").replace(/__MODEL__/g, model)}`;
}

function childWorkflow({ name, model, version }) {
  const evalName = `Evaluate ${model} from the saved morning`;
  return {
    name,
    settings: { timezone: "Europe/London", executionTimeout: 120 },
    nodes: [
      {
        name: "When called by the paired controller",
        type: "n8n-nodes-base.executeWorkflowTrigger",
        typeVersion: 1.1,
        position: [-460, 0],
        parameters: { inputSource: "passthrough" },
        notes: "Receives { date, model, session, dataset_meta, validation } from the paired controller."
      },
      {
        name: evalName,
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [-200, 0],
        parameters: { jsCode: childCode(model) },
        notes: `Generated from the checked-in controller and ${version}. The bundle and source hashes are returned with every decision.`
      },
      {
        name: "Return one decision",
        type: "n8n-nodes-base.noOp",
        typeVersion: 1,
        position: [80, 0],
        parameters: {},
        notes: "One decision, its validation, its four outcome results and its summary. This child never selects dates and never aggregates."
      },
      {
        name: "Research only",
        type: "n8n-nodes-base.stickyNote",
        typeVersion: 1,
        position: [-460, 240],
        parameters: {
          content: "Research only. Replays one saved morning. Reads no provider, writes no warehouse row, places no order and publishes no live call. A green execution is reproduction and validation evidence, not performance or edge."
        }
      }
    ],
    connections: {
      "When called by the paired controller": { main: [[{ node: evalName, type: "main", index: 0 }]] },
      [evalName]: { main: [[{ node: "Return one decision", type: "main", index: 0 }]] }
    }
  };
}

function parentWorkflow({ children, webhookCredentialId }) {
  const registryDoc = registryDocument();
  const credentials = webhookCredentialId
    ? { httpHeaderAuth: { id: webhookCredentialId, name: "USD L1 paired controller webhook" } }
    : undefined;
  const modelNodes = children.reduce((map, child) => {
    map[child.key] = `Run ${child.label}`;
    return map;
  }, {});
  const combineName = "Compare the selected models";
  const returnName = "Return paired record";
  const RESPOND_NODE = "Respond with every record";
  const nodes = [
    {
      name: "Manual run - one historical date",
      type: "n8n-nodes-base.manualTrigger",
      typeVersion: 1,
      position: [-760, -120],
      parameters: {},
      notes: "Manual UI runs use the defaults in Run configuration. No schedule exists."
    },
    {
      name: "Controlled webhook run",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [-760, 120],
      parameters: {
        path: "usd-l1-paired-controller",
        httpMethod: "POST",
        responseMode: "responseNode",
        authentication: "headerAuth",
        options: {}
      },
      credentials,
      notes: "Controlled evidence runs only. Header-authenticated, no schedule, deactivated after the run."
    },
    {
      name: "Run configuration",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [-520, 0],
      parameters: {
        jsCode: template("usd-l1-parent-config.js").replace("__MODEL_REGISTRY__", JSON.stringify(registryDoc))
      },
      notes: "One morning or a bounded batch of up to 40 mornings, a validation label and any registered model selection. Defaults to the frozen research challengers on 2024-01-10."
    },
    {
      name: "Fetch committed panel",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [-280, 0],
      parameters: { url: "={{ $json.dataset_url }}", options: { timeout: 120000 } },
      notes: "Reads the same checked-in run-v1.json the local controller reads. No provider or warehouse read."
    },
    {
      name: "Select one saved morning",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [-40, 0],
      parameters: { jsCode: template("usd-l1-parent-select.js") },
      notes: "The dataset decides whether each morning exists. One item per requested date; a missing date is passed as a null session so every selected model returns an explicit block."
    }
  ];
  const connections = {
    "Manual run - one historical date": { main: [[{ node: "Run configuration", type: "main", index: 0 }]] },
    "Controlled webhook run": { main: [[{ node: "Run configuration", type: "main", index: 0 }]] },
    "Run configuration": { main: [[{ node: "Fetch committed panel", type: "main", index: 0 }]] },
    "Fetch committed panel": { main: [[{ node: "Select one saved morning", type: "main", index: 0 }]] }
  };

  // One bind-and-run pair per registered Cloud model, chained in registry order. The chain is deliberate:
  // every child has finished before the combiner reads it, and an unselected model emits no items so its
  // child workflow is never executed.
  let previous = "Select one saved morning";
  children.forEach((child, index) => {
    const bindName = `Bind ${child.label}`;
    const runName = `Run ${child.label}`;
    const x = 100 + index * 260;
    nodes.push({
      name: bindName,
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [x, -100 + index * 40],
      parameters: { jsCode: template("usd-l1-parent-bind.js").replace(/__MODEL__/g, child.key) },
      notes: `Selects ${child.identity} for every requested morning, and emits nothing when the run did not select it.`
    });
    nodes.push({
      name: runName,
      type: "n8n-nodes-base.executeWorkflow",
      typeVersion: 1.2,
      position: [x + 130, -100 + index * 40],
      parameters: {
        workflowId: {
          __rl: true,
          mode: "id",
          value: child.id,
          cachedResultName: child.name
        },
        mode: "each",
        options: { waitForSubWorkflow: true }
      },
      notes: `Separately versioned Layer 1 workflow pinned to ${child.identity}.`
    });
    connections[previous] = { main: [[{ node: bindName, type: "main", index: 0 }]] };
    connections[bindName] = { main: [[{ node: runName, type: "main", index: 0 }]] };
    previous = runName;
  });
  nodes.push({
    name: combineName,
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [100 + children.length * 260 + 60, 0],
    parameters: {
      jsCode: template("usd-l1-parent-combine.js")
        .replace("__MODEL_REGISTRY__", JSON.stringify(registryDoc))
        .replace("__MODEL_NODES__", JSON.stringify(modelNodes))
    },
    notes: "Reports exactly the selected models per morning, with their execution links and the experiment identity. It never re-scores a child result, never invents a missing one and never selects a winner from performance."
  });
  nodes.push({
    name: returnName,
    type: "n8n-nodes-base.noOp",
    typeVersion: 1,
    position: [100 + children.length * 260 + 200, 0],
    parameters: {},
    notes: "Carries every per-morning record to the responder. A response that returned only the first item would lose the rest of the batch."
  });
  nodes.push({
    name: RESPOND_NODE,
    type: "n8n-nodes-base.respondToWebhook",
    typeVersion: 1.1,
    position: [100 + children.length * 260 + 320, 0],
    parameters: {
      respondWith: "allIncomingItems",
      options: {}
    },
    notes: "Returns the whole batch as one JSON array. The default last-node response only returns the first item, which silently truncated a 20-morning request to one record."
  });
  nodes.push({
    name: "Research only",
    type: "n8n-nodes-base.stickyNote",
    typeVersion: 1,
    position: [-760, 300],
    parameters: {
      content: "Research only. Calls separately versioned frozen Layer 1 workflows through the same contract, driven by the model registry. Reads one committed historical panel, writes no warehouse row, places no order and publishes no live call. Manual and controlled-webhook triggers only; no schedule. A fixture model registered alongside the books is labelled a fixture and never pooled with them."
    }
  });
  connections[previous] = { main: [[{ node: combineName, type: "main", index: 0 }]] };
  connections[combineName] = { main: [[{ node: returnName, type: "main", index: 0 }]] };
  connections[returnName] = { main: [[{ node: RESPOND_NODE, type: "main", index: 0 }]] };
  return {
    name: "USD Layer 1 - paired controller (Cloud)",
    settings: { timezone: "Europe/London", executionTimeout: 300 },
    nodes,
    connections
  };
}

/** The registry decides which children exist; nothing here names a model. */
function cloudChildren() {
  return registry.ENTRIES.filter((modelEntry) => modelEntry.cloud).map((modelEntry) => ({
    key: modelEntry.key,
    identity: modelEntry.identity,
    label: modelEntry.label,
    name: `USD Layer 1 - ${modelEntry.label} (Cloud adapter)`,
    version: modelEntry.version,
    file: CHILD_FILES[modelEntry.key]
  }));
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(BUNDLE, buildBundle(), "utf8");

  const children = cloudChildren();
  for (const child of children) {
    writeJson(child.file, childWorkflow({
      name: child.name,
      model: child.key,
      version: child.version,
      label: child.label
    }));
  }

  const pins = pinnedIds();
  const ENV_ALIASES = { challenger: "USD_L1_CHILD_V0_ID", challenger_v1: "USD_L1_CHILD_V1_ID" };
  const ids = {};
  for (const child of children) {
    const genericEnv = `USD_L1_CHILD_${child.key.toUpperCase()}_ID`;
    ids[child.key] = process.env[genericEnv]
      || (ENV_ALIASES[child.key] ? process.env[ENV_ALIASES[child.key]] : null)
      || pins.workflows[child.key]
      || `REPLACE_WITH_${child.key.toUpperCase()}_WORKFLOW_ID`;
  }
  const webhookCredentialId = process.env.USD_L1_WEBHOOK_CREDENTIAL_ID || pins.webhookCredentialId || null;
  writeJson(PARENT, parentWorkflow({
    children: children.map((child) => Object.assign({}, child, { id: ids[child.key] })),
    webhookCredentialId
  }));


  writeJson(META, {
    schema_version: "usd-l1-cloud-workflows-v2",
    bundle_version: BUNDLE_VERSION,
    bundle_path: path.relative(ROOT, BUNDLE).replace(/\\/g, "/"),
    bundle_sha256: BUNDLE_SHA256,
    bundle_bytes: fs.statSync(BUNDLE).size,
    source_files: ALL_SOURCE_FILES,
    registry: Object.assign(registryDocument(), {
      file: IDS.registry.replace(/\\/g, "/")
    }),
    children: children.map((child) => ({
      file: path.relative(ROOT, child.file).replace(/\\/g, "/"),
      name: child.name,
      model: child.key,
      identity: child.identity,
      role: registry.requireModel(child.key).role,
      kind: registry.requireModel(child.key).kind,
      version: child.version,
      workflow_id: ids[child.key]
    })),
    parent: {
      file: path.relative(ROOT, PARENT).replace(/\\/g, "/"),
      name: "USD Layer 1 - paired controller (Cloud)",
      webhook_path: "usd-l1-paired-controller",
      webhook_authentication: webhookCredentialId ? "headerAuth" : "missing-credential",
      default_selection: registry.DEFAULT_SELECTION.slice()
    },
    notes: [
      "Generated workflows contain no Execute Command node and no host command path.",
      "The production-control adapter is deliberately not bundled because its replay core reads local files and Supabase helpers.",
      "Children are generated from backtester/lib/usd_layer1_backtester/model_registry.js; adding a registered model needs no edit here.",
      "A registered fixture is a test double, is labelled a fixture in every artefact, and is never pooled with a research model.",
      "USD-L1-25F-H1-v0.1.0 is not one of these adapters and is never substituted for one."
    ]
  });

  console.log(JSON.stringify({
    bundle_sha256: BUNDLE_SHA256,
    bundle_bytes: fs.statSync(BUNDLE).size,
    registry_fingerprint: registryDocument().fingerprint,
    child_ids: ids,
    webhook_credential: webhookCredentialId ? "configured" : "missing",
    files: [BUNDLE].concat(children.map((child) => child.file), [PARENT, META]).map((file) => path.relative(ROOT, file).replace(/\\/g, "/"))
  }, null, 2));
}

if (require.main === module) main();

module.exports = {
  BUNDLE,
  CHILD_FILES,
  PARENT,
  META,
  BUNDLE_VERSION,
  BUNDLE_SHA256,
  SOURCE_FILES,
  ALL_SOURCE_FILES,
  cloudChildren,
  registryDocument,
  buildBundle
};


