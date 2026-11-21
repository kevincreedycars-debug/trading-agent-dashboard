#!/usr/bin/env node
"use strict";

/**
 * Prove that a test-module selection changes execution, not just metadata (research only).
 *
 * The script uploads the generated Cloud workflows, then posts the same morning twice to the paired
 * controller: once with test 2 selected and once with tests 3 and 4 selected. It writes both responses to
 * `data/usd-layer1-backtester/n8n/test-selection-verification-20261121.json` and checks that
 *   - the four-market selection returns four market results;
 *   - the path selection returns no market result and records both path modules as blocked on history;
 *   - the two experiment configurations name their selection and differ.
 *
 * Secrets are read from the encrypted local store and never printed. `--upload` updates the workflows; a run
 * without it only posts. The parent workflow stays deactivated: the webhook is the controlled entry point.
 */

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "data", "usd-layer1-backtester", "n8n", "test-selection-verification-20261121.json");
const PARENT = path.join(ROOT, "automation", "n8n", "usd-l1-paired-controller.cloud.workflow.json");
const MANIFEST = path.join(ROOT, "automation", "n8n", "usd-l1-cloud-workflows.manifest.json");
const UPLOAD = process.argv.includes("--upload");

function secret(name) {
  const output = childProcess.execFileSync("powershell", [
    "-NoProfile", "-ExecutionPolicy", "Bypass",
    "-File", path.join(ROOT, "scripts", "local-credentials", "get-secret.ps1"),
    "-Name", name
  ], { encoding: "utf8" });
  const value = String(output).trim();
  if (!value) throw new Error(`${name} is not available in the local credential store`);
  return value;
}

async function api(baseUrl, apiKey, method, route, body) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1${route}`, {
    method,
    headers: { "X-N8N-API-KEY": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${route} failed: HTTP ${response.status} ${String(text).slice(0, 300)}`);
  try {
    return text ? JSON.parse(text) : null;
  } catch (error) {
    return null;
  }
}

async function findWorkflow(baseUrl, apiKey, name) {
  let cursor = null;
  let found = null;
  do {
    const query = `/workflows?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const page = await api(baseUrl, apiKey, "GET", query);
    for (const workflow of (page && page.data) || []) {
      if (workflow.name === name) found = workflow;
    }
    cursor = page && page.nextCursor ? page.nextCursor : null;
  } while (cursor && !found);
  return found;
}

function workflowBody(file) {
  const workflow = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  return {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings || {}
  };
}

async function main() {
  const baseUrl = secret("N8N_BASE_URL");
  const apiKey = secret("N8N_API_KEY");
  const token = secret("USD_L1_WEBHOOK_TOKEN");
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const results = { schema_version: "usd-l1-test-selection-verification-v1", base_url: baseUrl, uploaded: [], runs: [] };
  let parentWorkflowId = null;

  if (UPLOAD) {
    for (const child of manifest.children) {
      const file = path.join(ROOT, child.file);
      const updated = await api(baseUrl, apiKey, "PUT", `/workflows/${child.workflow_id}`, workflowBody(file));
      results.uploaded.push({ model: child.model, workflow_id: child.workflow_id, updated_at: updated && updated.updatedAt ? updated.updatedAt : null });
      console.log(`uploaded ${child.model} (${child.workflow_id})`);
    }
    const parentId = manifest.parent && manifest.parent.workflow_id ? manifest.parent.workflow_id : null;
    const parentRecord = parentId ? { id: parentId } : await findWorkflow(baseUrl, apiKey, "USD Layer 1 - paired controller (Cloud)");
    if (parentRecord && parentRecord.id) {
      await api(baseUrl, apiKey, "PUT", `/workflows/${parentRecord.id}`, workflowBody(PARENT));
      parentWorkflowId = parentRecord.id;
      results.uploaded.push({ model: "parent", workflow_id: parentRecord.id });
      console.log(`uploaded parent (${parentRecord.id})`);
    } else {
      console.log("parent workflow was not found by name; the children were updated and the webhook still forwards tests");
    }
  }
  if (!parentWorkflowId) {
    const found = await findWorkflow(baseUrl, apiKey, "USD Layer 1 - paired controller (Cloud)");
    if (found) parentWorkflowId = found.id;
  }

  const webhook = `${baseUrl.replace(/\/$/, "")}/webhook/usd-l1-paired-controller`;
  const postSelection = async (selection) => {
    let response = null;
    let text = "";
    for (let attempt = 0; attempt < 6; attempt += 1) {
      response = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-USD-L1-Token": token },
        body: JSON.stringify({ dates: ["2024-01-10"], models: ["challenger_v1"], tests: selection })
      });
      text = await response.text();
      if (response.status !== 404) break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    if (!response.ok) throw new Error(`webhook HTTP ${response.status}: ${text.slice(0, 300)}`);
    const parsed = JSON.parse(text);
    const record = Array.isArray(parsed) ? parsed[0] : parsed;
    const decision = record.models.challenger_v1.decision;
    results.runs.push({
      requested_tests: selection,
      date: record.date,
      parent_execution: record.n8n && record.n8n.execution_id ? record.n8n.execution_id : null,
      parent_execution_url: record.n8n && record.n8n.execution_url ? record.n8n.execution_url : null,
      child_execution: record.models.challenger_v1.execution_id || null,
      test_configuration: record.identity ? record.identity.test_configuration : null,
      result_keys: decision && decision.results ? Object.keys(decision.results) : [],
      module_states: decision && decision.tests ? decision.tests.states.map((state) => [state.id, state.state]) : [],
      status: decision ? decision.status : null,
      direction: decision && decision.call ? decision.call.direction : null
    });
    console.log(`posted tests=${selection.join(",")} -> ${results.runs[results.runs.length - 1].result_keys.length} market result(s)`);
  };
  // The production webhook only exists while the workflow is active. It is activated for these two calls
  // and deactivated again in the finally block, so no scheduled or listening path is left behind.
  if (parentWorkflowId) {
    await api(baseUrl, apiKey, "POST", `/workflows/${parentWorkflowId}/activate`);
    results.webhook_activated_for_run = true;
  }
  try {
    for (const selection of [["four_markets"], ["l2l_full_5r", "l2l_half_3r"]]) {
      await postSelection(selection);
    }
  } finally {
    if (parentWorkflowId) {
      await api(baseUrl, apiKey, "POST", `/workflows/${parentWorkflowId}/deactivate`);
      results.webhook_deactivated_after_run = true;
    }
  }
  return finish(results);
}

function finish(results) {
  const [market, paths] = results.runs;
  const modulesOf = (run) => {
    const configuration = run.test_configuration || {};
    if (Array.isArray(configuration.modules)) return configuration.modules;
    if (Array.isArray(configuration.tests)) return configuration.tests;
    return run.requested_tests || [];
  };
  results.checks = [
    {
      id: "market_selection_scores_four_markets",
      ok: market.result_keys.length === 4,
      detail: `tests=four_markets returned ${market.result_keys.join(", ")}`
    },
    {
      id: "path_selection_scores_no_market",
      ok: paths.result_keys.length === 0,
      detail: `tests=3,4 returned ${paths.result_keys.length} market result(s)`
    },
    {
      id: "path_modules_are_blocked_on_history",
      ok: paths.module_states.length === 2 && paths.module_states.every(([, state]) => state === "blocked_on_history"),
      detail: paths.module_states.map(([id, state]) => `${id}=${state}`).join(", ")
    },
    {
      id: "selection_is_recorded_as_the_experiment",
      ok: modulesOf(market).join() !== modulesOf(paths).join(),
      detail: `${modulesOf(market).join(",")} vs ${modulesOf(paths).join(",")}`
    }
  ];
  results.verdict = results.checks.every((check) => check.ok) ? "pass" : "fail";
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({
    verdict: results.verdict,
    checks: results.checks,
    file: path.relative(ROOT, OUT).replace(/\\/g, "/")
  }, null, 2));
  if (results.verdict !== "pass") process.exitCode = 1;
  return results;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { secret, api, workflowBody, finish };
