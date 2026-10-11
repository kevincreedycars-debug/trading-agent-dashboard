"use strict";

/**
 * Executes the deterministic code nodes of the exported USD Layer 1 workflow locally.
 *
 * The exported JSON is the source of truth: no logic is copied into this file, so a change in
 * the live workflow changes what this harness runs. The model step is intentionally not
 * executed - the deterministic node consumes `market_inputs` and overwrites the model verdict -
 * and that claim is asserted by the harness tests rather than assumed.
 */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const DEFAULT_LIVE_WORKFLOW_PATH = path.resolve(
  __dirname,
  "../../docs/review/usd-24h-ruleset-v1/live-exports/USD_Layer_1_Agent.json"
);
const FALLBACK_WORKFLOW_PATH = path.resolve(__dirname, "../../exports/usd_layer1_agent.json");

const INPUT_VALIDATION_CHECKS = [
  ["de_2y_yield", "Germany 2Y yield"],
  ["us_de_2y_spread", "US-DE 2Y spread"],
  ["us_de_2y_spread_d5_bps", "US-DE 2Y spread 5d bps"],
  ["fed_bias", "Fed bias"],
  ["latest_us_event", "latest US event"]
];

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function resolveWorkflowPath(explicitPath) {
  const candidate = explicitPath ? path.resolve(explicitPath) : DEFAULT_LIVE_WORKFLOW_PATH;
  if (fs.existsSync(candidate)) return { path: candidate, source: "live_export" };
  if (!explicitPath && fs.existsSync(FALLBACK_WORKFLOW_PATH)) {
    return { path: FALLBACK_WORKFLOW_PATH, source: "repository_snapshot" };
  }
  throw new Error(`No USD workflow export found at ${candidate}`);
}

function loadExportedWorkflow(explicitPath) {
  const resolved = resolveWorkflowPath(explicitPath);
  const workflow = JSON.parse(fs.readFileSync(resolved.path, "utf8"));
  return { workflow, path: resolved.path, source: resolved.source };
}

function codeNodeSource(workflow, nodeName) {
  const node = (workflow.nodes || []).find((candidate) => candidate.name === nodeName);
  if (!node || !node.parameters || typeof node.parameters.jsCode !== "string") {
    throw new Error(`Code node "${nodeName}" not found in workflow "${workflow.name}"`);
  }
  return node.parameters.jsCode;
}

function runCodeNode(jsCode, items, options = {}) {
  const resolved = items.map((json) => ({ json }));
  const namedNodes = options.namedNodes || {};
  const sandbox = {
    $input: {
      all: () => resolved,
      first: () => resolved[0],
      last: () => resolved[resolved.length - 1],
      item: resolved[0]
    },
    $json: resolved[0] ? resolved[0].json : undefined,
    $items: () => resolved,
    items: resolved,
    $(nodeName) {
      if (!(nodeName in namedNodes)) {
        throw new Error(`Code node requested "$('${nodeName}')", which the harness does not provide`);
      }
      const entries = (namedNodes[nodeName] || []).map((json) => ({ json }));
      return {
        all: () => entries,
        first: () => entries[0],
        last: () => entries[entries.length - 1],
        item: entries[0]
      };
    },
    $node: { name: options.nodeName || "harness", type: "n8n-nodes-base.code" },
    $execution: { id: "harness", mode: "test" },
    $workflow: { id: "harness", name: "harness" },
    $env: {},
    Buffer,
    console: { log() {}, warn() {}, error() {} }
  };

  const context = vm.createContext(sandbox);
  const script = new vm.Script(`(function(){\n${jsCode}\n})()`, { filename: options.nodeName || "code-node.js" });
  const output = script.runInContext(context, { timeout: options.timeoutMs || 10000 });
  if (!Array.isArray(output)) {
    throw new Error(`Code node "${options.nodeName}" did not return an item array`);
  }
  // The workflow writes these items to Supabase, so they are JSON by contract. Round-tripping
  // also moves the values into the host realm, which keeps deep-equality checks meaningful.
  return JSON.parse(JSON.stringify(output.map((entry) => entry.json)));
}

function parseInputValidationWarnings(marketInputs) {
  return INPUT_VALIDATION_CHECKS.filter(([key]) => !hasValue(marketInputs[key])).map(([, label]) => `Missing ${label}`);
}

function runUsdDeterministicChain(workflow, snapshotRow, options = {}) {
  const modelReport = options.modelReport || {};
  const packJson = runCodeNode(codeNodeSource(workflow, "Build USD Input Pack"), [snapshotRow], {
    nodeName: "Build USD Input Pack"
  })[0];
  const marketInputs = packJson.available_inputs || {};
  const deterministicItem = {
    snapshot_id: packJson.snapshot_id ?? null,
    agent_name: "USD",
    layer: 1,
    run_time_et: packJson.run_time_et ?? null,
    snapshot_date: packJson.snapshot_date ?? null,
    market_inputs: marketInputs,
    snapshot_selection: packJson.snapshot_selection ?? null,
    model_reported_warnings: modelReport.risk_flags || modelReport.warnings || [],
    input_validation_warnings: parseInputValidationWarnings(marketInputs),
    warnings: parseInputValidationWarnings(marketInputs),
    full_output: { ...modelReport },
    raw_agent_output: { ...modelReport },
    logic_document: "agent_usd_direction.md",
    logic_document_version: modelReport.logic_document_version || "v2_basic_engine"
  };
  const row = runCodeNode(codeNodeSource(workflow, "Calculate USD Conviction"), [deterministicItem], {
    nodeName: "Calculate USD Conviction"
  })[0];
  return { inputPack: packJson, deterministicItem, row };
}

module.exports = {
  DEFAULT_LIVE_WORKFLOW_PATH,
  FALLBACK_WORKFLOW_PATH,
  INPUT_VALIDATION_CHECKS,
  codeNodeSource,
  loadExportedWorkflow,
  parseInputValidationWarnings,
  runCodeNode,
  runUsdDeterministicChain
};
