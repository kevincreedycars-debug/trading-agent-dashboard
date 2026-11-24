#!/usr/bin/env node
"use strict";

/**
 * Spend exactly one n8n Cloud execution on the deployed USD Layer 1 pair and keep what came back.
 *
 *   node scripts/capture_usd_l1_fresh_call.js --date 2024-01-10
 *   node scripts/capture_usd_l1_fresh_call.js --date 2024-01-10 --keep-active
 *
 * The proof in `prove_usd_l1_fresh_call.js` establishes, locally, that the child computes its call from
 * the morning's cutoff inputs. This script supplies the other half: one call made by the deployed pair,
 * with the parent and child execution ids written down, so a reader can open them in the n8n UI.
 *
 * The parent's webhook is the only trigger, so the workflow is activated for the length of one request and
 * deactivated again - the state the evidence trail records it in. `--keep-active` leaves it up for a
 * follow-up call and says so in the written record.
 *
 * Secrets: N8N_BASE_URL, N8N_API_KEY and USD_L1_WEBHOOK_TOKEN are read from the process environment or from
 * the encrypted local store. Nothing secret is written to the repository, the capture or the console.
 *
 * Research only. It activates, calls and deactivates the controller; it never touches a broker or account.
 */

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");

const sweepLib = require("../lib/backtesting_n8n_sweep");
const registry = require("../backtester/lib/usd_layer1_backtester/model_registry");

const ROOT = path.resolve(__dirname, "..");
const N8N_DIR = path.join(ROOT, "data", "usd-layer1-backtester", "n8n");
const MANIFEST_PATH = path.join(ROOT, "automation", "n8n", "usd-l1-cloud-workflows.manifest.json");
const LIVE_PATH = path.join(N8N_DIR, "fresh-call-live-v1.json");
const API_SCRIPT = path.join(ROOT, "scripts", "n8n_api_call.ps1");
const HEADER_NAME = "X-USD-L1-Token";
const DEFAULT_DATASET_URL =
  "https://raw.githubusercontent.com/kevincreedycars-debug/trading-agent-dashboard/main/data/usd-layer1-backtester/run-v1.json";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function parseArgs(argv) {
  const args = {
    date: "2024-01-10",
    models: null,
    validation: "structural",
    datasetUrl: DEFAULT_DATASET_URL,
    keepActive: false,
    timeout: 240000
  };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--keep-active") args.keepActive = true;
    else if (token === "--date") args.date = argv[(index += 1)];
    else if (token === "--models") args.models = argv[(index += 1)];
    else if (token === "--validation") args.validation = argv[(index += 1)];
    else if (token === "--dataset-url") args.datasetUrl = argv[(index += 1)];
    else if (token === "--timeout") args.timeout = Number(argv[(index += 1)]);
    else throw new Error(`unknown argument ${token}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error("--date must be YYYY-MM-DD");
  return args;
}

/** A secret from the environment, or from the encrypted local store. Never from a repository file. */
function readSecret(name) {
  if (process.env[name] && String(process.env[name]).trim()) return String(process.env[name]).trim();
  const script = path.join(ROOT, "scripts", "local-credentials", "get-secret.ps1");
  if (!fs.existsSync(script)) throw new Error(`${name} is not in the environment and the local credential helper is missing`);
  const output = childProcess.execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-Name", name], {
    encoding: "utf8",
    windowsHide: true
  });
  const value = String(output).trim();
  if (!value) throw new Error(`${name} is not present in the local credential store`);
  return value;
}

/** The n8n public API, through the one script this repository uses for it. */
function api(action, { id = null, output = null } = {}) {
  const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", API_SCRIPT, "-Action", action];
  if (id) args.push("-Id", String(id));
  if (output) args.push("-OutputFile", output);
  const stdout = childProcess.execFileSync("powershell", args, { encoding: "utf8", windowsHide: true });
  if (output) return readJson(output);
  return JSON.parse(stdout);
}

function postJson(url, headers, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === "https:" ? https : http;
    const payload = JSON.stringify(body);
    const request = client.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || undefined,
        path: `${target.pathname}${target.search}`,
        method: "POST",
        headers: Object.assign(
          { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), Accept: "application/json" },
          headers
        )
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve({ status: response.statusCode || 0, text: Buffer.concat(chunks).toString("utf8") }));
      }
    );
    request.setTimeout(timeoutMs, () => request.destroy(new Error(`request timed out after ${timeoutMs} ms`)));
    request.on("error", reject);
    request.write(payload);
    request.end();
  });
}

/** The deployed workflow's id, taken from the instance rather than hardcoded in this file. */
function workflowByName(name) {
  const temp = path.join(N8N_DIR, ".workflows.tmp.json");
  const listed = api("ListWorkflows", { output: temp });
  fs.rmSync(temp, { force: true });
  const found = (listed.data || []).find((entry) => entry.name === name);
  if (!found) throw new Error(`the n8n instance has no workflow named "${name}"`);
  return found;
}

/** The calls a captured record carries, flattened so they can be compared one by one. */
function callsFrom(record, models) {
  return models.map((model) => {
    const entry = (record.models || {})[model] || {};
    const decision = entry.decision || {};
    const call = decision.call || {};
    return {
      date: decision.date || record.date || null,
      model,
      status: decision.status || null,
      validation_accepted: decision.validation ? decision.validation.accepted : null,
      direction: call.direction === undefined ? null : call.direction,
      direction_label: call.direction_label === undefined ? null : call.direction_label,
      conviction: call.conviction === undefined ? null : call.conviction,
      reason: call.reason === undefined ? null : call.reason,
      results: decision.results || null,
      child_execution_id: entry.execution_id || null,
      child_execution_url: entry.execution_url || null,
      child_workflow_id: entry.workflow_id || null
    };
  });
}

async function main(argv) {
  const args = parseArgs(argv);
  const manifest = readJson(MANIFEST_PATH);
  const models = args.models
    ? args.models.split(",").map((entry) => entry.trim()).filter(Boolean)
    : manifest.parent.default_selection.slice();
  for (const model of models) {
    const entry = registry.getModel(model);
    if (!entry || !entry.cloud) throw new Error(`${model} is not a Cloud model in the registry`);
  }

  const base = readSecret("N8N_BASE_URL").replace(/\/+$/, "");
  const token = readSecret("USD_L1_WEBHOOK_TOKEN");
  const found = workflowByName(manifest.parent.name);
  const wasActive = found.active === true;
  let activated = false;

  try {
    // The webhook is the only trigger, so the workflow has to be up for the length of this one request.
    if (!wasActive) {
      api("ActivateWorkflow", { id: found.id });
      activated = true;
    }
    const body = sweepLib.requestBody({ dates: [args.date], models, validation: args.validation, datasetUrl: args.datasetUrl });
    const response = await postJson(`${base}/webhook/${manifest.parent.webhook_path}`, { [HEADER_NAME]: token }, body, args.timeout);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`the webhook returned HTTP ${response.status}: ${String(response.text).slice(0, 300)}`);
    }
    const parsed = sweepLib.parseResponse(response.text);
    if (parsed.failures.length > 0) {
      throw new Error(`the controller reported ${parsed.failures.length} failed record(s): ${JSON.stringify(parsed.failures)}`);
    }
    if (parsed.records.length !== 1) throw new Error(`expected one record for ${args.date}, received ${parsed.records.length}`);
    const record = parsed.records[0];
    const execution = record.n8n || {};
    if (!execution.execution_id) throw new Error("the response carried no n8n execution id, so the capture would not be inspectable");

    fs.mkdirSync(N8N_DIR, { recursive: true });
    const capturePath = path.join(N8N_DIR, `execution-${execution.execution_id}-fresh-call.json`);
    const captureText = `${JSON.stringify(record, null, 2)}\n`;
    fs.writeFileSync(capturePath, captureText, "utf8");

    const live = {
      schema_version: "usd-l1-fresh-call-live-v1",
      captured_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      research_only: true,
      instance: { base_url: base },
      workflow: {
        id: found.id,
        name: found.name,
        url: `${base}/workflow/${found.id}`,
        was_active: wasActive,
        activated_for_capture: activated,
        deactivated_after_capture: false
      },
      request: { dates: [args.date], models, validation: args.validation, dataset_url: args.datasetUrl },
      http: { status: response.status, bytes: Buffer.byteLength(response.text) },
      execution: {
        id: String(execution.execution_id),
        url: execution.execution_url || `${base}/execution/${execution.execution_id}`,
        workflow_id: execution.workflow_id || found.id,
        workflow_name: execution.workflow_name || found.name
      },
      calls: callsFrom(record, models),
      capture_file: rel(capturePath),
      capture_sha256: crypto.createHash("sha256").update(Buffer.from(captureText, "utf8")).digest("hex"),
      read_it_back: [
        "this file carries the instance, both workflow ids, the parent execution url and each child execution url",
        liveCaptureHint()
      ]
    };
    fs.writeFileSync(LIVE_PATH, `${JSON.stringify(live, null, 1)}\n`, "utf8");
    console.log(JSON.stringify({
      captured_at: live.captured_at,
      execution_id: live.execution.id,
      execution_url: live.execution.url,
      workflow_url: live.workflow.url,
      capture_file: live.capture_file,
      written: rel(LIVE_PATH),
      calls: live.calls.map((entry) => ({
        model: entry.model,
        direction: entry.direction,
        conviction: entry.conviction,
        child_execution_id: entry.child_execution_id
      }))
    }, null, 1));
    return live;
  } finally {
    if (activated && !args.keepActive) {
      api("DeactivateWorkflow", { id: found.id });
      if (fs.existsSync(LIVE_PATH)) {
        const written = readJson(LIVE_PATH);
        written.workflow.deactivated_after_capture = true;
        fs.writeFileSync(LIVE_PATH, `${JSON.stringify(written, null, 1)}\n`, "utf8");
      }
    }
  }
}

function liveCaptureHint() {
  return "node scripts/prove_usd_l1_fresh_call.js --check compares these calls with a local recomputation of the same morning";
}

if (require.main === module) {
  main(process.argv).catch((error) => {
    console.error(String(error && error.message ? error.message : error));
    process.exit(1);
  });
}

module.exports = { parseArgs, callsFrom, postJson, LIVE_PATH, DEFAULT_DATASET_URL };

