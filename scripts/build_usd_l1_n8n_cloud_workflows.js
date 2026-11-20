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
const CHILD = {
  challenger: path.join(OUT, "usd-l1-challenger-v0.cloud.workflow.json"),
  challenger_v1: path.join(OUT, "usd-l1-challenger-v1.cloud.workflow.json")
};
const PARENT = path.join(OUT, "usd-l1-paired-controller.cloud.workflow.json");
const META = path.join(OUT, "usd-l1-cloud-workflows.manifest.json");
const IDS = {
  controller: "backtester/lib/usd_layer1_backtester/backtest_controller.js",
  contracts: "backtester/lib/usd_layer1_backtester/contracts.js",
  challenger: "backtester/lib/usd_layer1_backtester/challenger.js",
  challenger_v1: "backtester/lib/usd_layer1_backtester/challenger_v1.js",
  votes: "lib/usd_l1_votes.js",
  session: "backtester/lib/usd_session_engine_interface.js",
  current: "backtester/lib/usd_layer1_backtester/current_model.js"
};
const BUNDLE_VERSION = "usd-l1-cloud-runtime-v1";
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
  const pins = { challenger: null, challenger_v1: null, webhookCredentialId: null };
  const meta = readJsonIfPresent(META);
  for (const child of (meta && meta.children) || []) {
    if (child.model === "challenger" && child.workflow_id) pins.challenger = child.workflow_id;
    if (child.model === "challenger_v1" && child.workflow_id) pins.challenger_v1 = child.workflow_id;
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
  [IDS.challenger, read(IDS.challenger)],
  [IDS.challenger_v1, read(IDS.challenger_v1)],
  [IDS.votes, read(IDS.votes)],
  [IDS.session, read(IDS.session)],
  [IDS.current, CURRENT_STUB, true]
].map(([id, source, stub]) => ({ id, source, stub: Boolean(stub) }));

const SOURCE_FILES = MODULES.map((m) => ({ path: m.id, sha256: sha256(m.source), stub: m.stub }));
const BUNDLE_SHA256 = sha256(JSON.stringify(SOURCE_FILES));

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
    .replace("__SOURCE_FILES__", JSON.stringify(SOURCE_FILES, null, 2))
    .replace("__MODULES__", moduleFunctions())
    .replace("__CONTROLLER_ID__", IDS.controller);
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

function parentWorkflow({ v0Id, v1Id, webhookCredentialId }) {
  const credentials = webhookCredentialId
    ? { httpHeaderAuth: { id: webhookCredentialId, name: "USD L1 paired controller webhook" } }
    : undefined;
  return {
    name: "USD Layer 1 - paired controller (Cloud)",
    settings: { timezone: "Europe/London", executionTimeout: 300 },
    nodes: [
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
          responseMode: "lastNode",
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
        parameters: { jsCode: template("usd-l1-parent-config.js") },
        notes: "One morning or a bounded batch of up to 40 mornings, one validation label. Defaults to both challenger versions on 2024-01-10."
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
        notes: "The dataset decides whether each morning exists. One item per requested date; a missing date is passed as a null session so both children return an explicit block."
      },
      {
        name: "Bind challenger v0",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [100, -100],
        parameters: {
          jsCode: "return $input.all().map((item) => ({ json: Object.assign({}, item.json, { model: \"challenger\" }) }));"
        },
        notes: "Binds this branch to usd-layer1-challenger-v0 before the child is called; one child run per requested morning."
      },
      {
        name: "Bind challenger v1",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [100, 100],
        parameters: {
          jsCode: "return $input.all().map((item) => ({ json: Object.assign({}, item.json, { model: \"challenger_v1\" }) }));"
        },
        notes: "Binds this branch to usd-layer1-challenger-v1 before the child is called; one child run per requested morning."
      },
      {
        name: "Run Challenger v0",
        type: "n8n-nodes-base.executeWorkflow",
        typeVersion: 1.2,
        position: [320, -100],
        parameters: {
          workflowId: {
            __rl: true,
            mode: "id",
            value: v0Id,
            cachedResultName: "USD Layer 1 - challenger v0 (Cloud adapter)"
          },
          mode: "each",
          options: { waitForSubWorkflow: true }
        },
        notes: "Separately versioned Layer 1 workflow pinned to usd-layer1-challenger-v0."
      },
      {
        name: "Run Challenger v1",
        type: "n8n-nodes-base.executeWorkflow",
        typeVersion: 1.2,
        position: [320, 100],
        parameters: {
          workflowId: {
            __rl: true,
            mode: "id",
            value: v1Id,
            cachedResultName: "USD Layer 1 - challenger v1 (Cloud adapter)"
          },
          mode: "each",
          options: { waitForSubWorkflow: true }
        },
        notes: "Separately versioned Layer 1 workflow pinned to usd-layer1-challenger-v1."
      },
      {
        name: "Gather both child answers",
        type: "n8n-nodes-base.merge",
        typeVersion: 3,
        position: [420, 0],
        parameters: { mode: "append", numberInputs: 2 },
        notes: "Waits for both versioned children before any pairing. The two branches never race into the combiner."
      },
      {
        name: "Compare the two decisions",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [640, 0],
        parameters: { jsCode: template("usd-l1-parent-combine.js") },
        notes: "Pairs the two child outputs per morning and returns one record per date. It never re-scores a child result, never invents a missing one and never selects a winner from performance."
      },
      {
        name: "Return paired record",
        type: "n8n-nodes-base.noOp",
        typeVersion: 1,
        position: [740, 0],
        parameters: {},
        notes: "Returns both execution links, the input-availability gate, both decisions, four results per model and separate reproduction labels."
      },
      {
        name: "Research only",
        type: "n8n-nodes-base.stickyNote",
        typeVersion: 1,
        position: [-760, 300],
        parameters: {
          content: "Research only. Calls two separately versioned frozen Layer 1 challenger workflows through the same contract. Reads one committed historical panel, writes no warehouse row, places no order and publishes no live call. Manual and controlled-webhook triggers only; no schedule."
        }
      }
    ],
    connections: {
      "Manual run - one historical date": { main: [[{ node: "Run configuration", type: "main", index: 0 }]] },
      "Controlled webhook run": { main: [[{ node: "Run configuration", type: "main", index: 0 }]] },
      "Run configuration": { main: [[{ node: "Fetch committed panel", type: "main", index: 0 }]] },
      "Fetch committed panel": { main: [[{ node: "Select one saved morning", type: "main", index: 0 }]] },
      "Select one saved morning": {
        main: [[
          { node: "Bind challenger v0", type: "main", index: 0 },
          { node: "Bind challenger v1", type: "main", index: 0 }
        ]]
      },
      "Bind challenger v0": { main: [[{ node: "Run Challenger v0", type: "main", index: 0 }]] },
      "Bind challenger v1": { main: [[{ node: "Run Challenger v1", type: "main", index: 0 }]] },
      "Run Challenger v0": { main: [[{ node: "Gather both child answers", type: "main", index: 0 }]] },
      "Run Challenger v1": { main: [[{ node: "Gather both child answers", type: "main", index: 1 }]] },
      "Gather both child answers": { main: [[{ node: "Compare the two decisions", type: "main", index: 0 }]] },
      "Compare the two decisions": { main: [[{ node: "Return paired record", type: "main", index: 0 }]] }
    }
  };
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(BUNDLE, buildBundle(), "utf8");

  const definitions = [
    {
      path: CHILD.challenger,
      workflow: childWorkflow({
        name: "USD Layer 1 - challenger v0 (Cloud adapter)",
        model: "challenger",
        version: "usd-layer1-challenger-v0"
      })
    },
    {
      path: CHILD.challenger_v1,
      workflow: childWorkflow({
        name: "USD Layer 1 - challenger v1 (Cloud adapter)",
        model: "challenger_v1",
        version: "usd-layer1-challenger-v1"
      })
    }
  ];
  for (const definition of definitions) writeJson(definition.path, definition.workflow);

  const pins = pinnedIds();
  const v0Id = process.env.USD_L1_CHILD_V0_ID || pins.challenger || "REPLACE_WITH_CHALLENGER_V0_WORKFLOW_ID";
  const v1Id = process.env.USD_L1_CHILD_V1_ID || pins.challenger_v1 || "REPLACE_WITH_CHALLENGER_V1_WORKFLOW_ID";
  const webhookCredentialId = process.env.USD_L1_WEBHOOK_CREDENTIAL_ID || pins.webhookCredentialId || null;
  writeJson(PARENT, parentWorkflow({ v0Id, v1Id, webhookCredentialId }));

  writeJson(META, {
    schema_version: "usd-l1-cloud-workflows-v1",
    bundle_version: BUNDLE_VERSION,
    bundle_path: path.relative(ROOT, BUNDLE).replace(/\\/g, "/"),
    bundle_sha256: BUNDLE_SHA256,
    bundle_bytes: fs.statSync(BUNDLE).size,
    source_files: SOURCE_FILES,
    children: [
      {
        file: path.relative(ROOT, CHILD.challenger).replace(/\\/g, "/"),
        name: "USD Layer 1 - challenger v0 (Cloud adapter)",
        model: "challenger",
        identity: "usd-layer1-challenger-v0",
        workflow_id: v0Id
      },
      {
        file: path.relative(ROOT, CHILD.challenger_v1).replace(/\\/g, "/"),
        name: "USD Layer 1 - challenger v1 (Cloud adapter)",
        model: "challenger_v1",
        identity: "usd-layer1-challenger-v1",
        workflow_id: v1Id
      }
    ],
    parent: {
      file: path.relative(ROOT, PARENT).replace(/\\/g, "/"),
      name: "USD Layer 1 - paired controller (Cloud)",
      webhook_path: "usd-l1-paired-controller",
      webhook_authentication: webhookCredentialId ? "headerAuth" : "missing-credential"
    },
    notes: [
      "Generated workflows contain no Execute Command node and no host command path.",
      "The production-control adapter is deliberately not bundled because its replay core reads local files and Supabase helpers.",
      "USD-L1-25F-H1-v0.1.0 is not one of these adapters and is never substituted for one."
    ]
  });

  console.log(JSON.stringify({
    bundle_sha256: BUNDLE_SHA256,
    bundle_bytes: fs.statSync(BUNDLE).size,
    child_ids: { challenger: v0Id, challenger_v1: v1Id },
    webhook_credential: webhookCredentialId ? "configured" : "missing",
    files: [BUNDLE, CHILD.challenger, CHILD.challenger_v1, PARENT, META].map((file) => path.relative(ROOT, file).replace(/\\/g, "/"))
  }, null, 2));
}

if (require.main === module) main();

module.exports = {
  BUNDLE,
  CHILD,
  PARENT,
  META,
  BUNDLE_VERSION,
  BUNDLE_SHA256,
  SOURCE_FILES,
  buildBundle
};


