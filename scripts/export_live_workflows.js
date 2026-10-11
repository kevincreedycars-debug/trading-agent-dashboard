#!/usr/bin/env node
/**
 * Read-only export of every workflow in the live n8n workspace.
 *
 * GET only: this script never creates, updates, activates or deletes anything, and never
 * executes a workflow. It exists so that deployment identity (repository export versus the
 * workflow that is actually running) can be recorded with ids, versions, timestamps and hashes.
 *
 * Raw output goes to an ignored local folder (tmp/live/exports-<timestamp>/). The raw copies
 * may still contain credential bindings, so they are never committed as-is; run
 * scripts/scrub_live_workflow_exports.js to produce the sanitized, committable copies.
 *
 * Usage (credentials come from the local CLIXML store):
 *   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-with-credentials.ps1 `
 *     -Scope n8n -Command node -Arguments scripts\export_live_workflows.js
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const baseUrl = String(process.env.N8N_BASE_URL || "").replace(/\/+$/, "");
const apiKey = process.env.N8N_API_KEY;

if (!baseUrl || !apiKey) {
  throw new Error("N8N_BASE_URL and N8N_API_KEY are required (use scripts/run-with-credentials.ps1 -Scope n8n).");
}

function argumentValue(prefix, fallback) {
  const hit = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

const outDir = path.resolve(
  __dirname,
  "..",
  argumentValue("--out=", path.join("tmp", "live", `exports-${timestampSlug()}`).split(path.sep).join(path.sep))
);

// Ordered so the first match wins; used only to label exports, never to filter them.
const ENGINE_PATTERNS = [
  { engine: "USD", role: "collector", pattern: /usd.*collector/i },
  { engine: "USD", role: "agent", pattern: /usd.*(layer ?1|agent)/i },
  { engine: "EUR", role: "collector", pattern: /eur.*collector/i },
  { engine: "EUR", role: "agent", pattern: /eur.*(layer ?1|agent)/i },
  { engine: "GOLD", role: "collector", pattern: /gold.*collector/i },
  { engine: "GOLD", role: "agent", pattern: /gold.*(layer ?1|agent)/i },
  { engine: "SILVER", role: "collector", pattern: /silver.*collector/i },
  { engine: "SILVER", role: "agent", pattern: /silver.*(layer ?1|agent)/i },
  { engine: "NQ", role: "collector", pattern: /(nq|nasdaq).*collector/i },
  { engine: "NQ", role: "agent", pattern: /(nq|nasdaq).*(layer ?1|agent)/i },
  { engine: "BTC", role: "collector", pattern: /btc.*collector/i },
  { engine: "BTC", role: "agent", pattern: /btc.*(layer ?1|agent)/i },
  { engine: "WTI", role: "collector", pattern: /(wti|oil).*collector/i },
  { engine: "WTI", role: "agent", pattern: /(wti|oil).*(layer ?1|agent)/i },
  { engine: "GBP", role: "collector", pattern: /gbp.*collector/i },
  { engine: "GBP", role: "agent", pattern: /gbp.*(layer ?1|agent)/i },
  { engine: "SHARED", role: "orchestrator", pattern: /master|orchestrat/i },
  { engine: "SHARED", role: "dashboard_writer", pattern: /dashboard.*writ/i },
  { engine: "SHARED", role: "events", pattern: /eco|event/i },
  { engine: "SHARED", role: "layer2", pattern: /layer ?2|trade.*select/i }
];

function classify(name) {
  const hit = ENGINE_PATTERNS.find((entry) => entry.pattern.test(String(name || "")));
  return hit ? { engine: hit.engine, role: hit.role } : { engine: "UNCLASSIFIED", role: "other" };
}

async function n8nGet(pathname) {
  const response = await fetch(`${baseUrl}/api/v1${pathname}`, {
    method: "GET",
    headers: { "X-N8N-API-KEY": apiKey, accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`n8n API ${response.status} ${response.statusText} for ${pathname}`);
  }
  return response.json();
}

async function listWorkflows() {
  const collected = [];
  let cursor = null;
  do {
    const query = `/workflows?limit=250${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const page = await n8nGet(query);
    collected.push(...(page.data || []));
    cursor = page.nextCursor || null;
  } while (cursor);
  return collected;
}

function unwrapValue(value) {
  if (value && typeof value === "object" && !Array.isArray(value) && "value" in value) {
    return {
      value: value.value ?? null,
      name_hint: value.cachedResultName ?? null
    };
  }
  return { value: value ?? null, name_hint: null };
}

function routingReferences(workflow) {
  const references = [];
  for (const node of workflow.nodes || []) {
    const type = String(node.type || "");
    const parameters = node.parameters || {};
    if (type.includes("executeWorkflow")) {
      const target = unwrapValue(parameters.workflowId);
      references.push({
        node: node.name,
        type,
        kind: "executeWorkflow",
        target_workflow_id: target.value,
        target_workflow_name_hint: target.name_hint
      });
    } else if (type.includes("webhook")) {
      references.push({
        node: node.name,
        type,
        kind: "webhook",
        webhook_path: parameters.path ?? null,
        http_method: parameters.httpMethod ?? null
      });
    } else if (type.includes("supabase")) {
      references.push({
        node: node.name,
        type,
        kind: "supabase",
        table: parameters.tableId ?? null,
        operation: parameters.operation ?? null
      });
    } else if (type.includes("github")) {
      const owner = unwrapValue(parameters.owner);
      const repository = unwrapValue(parameters.repository);
      const filePath = unwrapValue(parameters.filePath);
      references.push({
        node: node.name,
        type,
        kind: "github",
        owner: owner.value,
        repository: repository.value,
        file_path: filePath.value
      });
    } else if (type.includes("schedule") || type.includes("cron")) {
      references.push({
        node: node.name,
        type,
        kind: "schedule",
        cron_expression: parameters.rule?.interval?.[0]?.expression ?? parameters.cronExpression ?? null
      });
    }
  }
  return references;
}

function safeFileName(workflow) {
  const base = String(workflow.name || workflow.id || "workflow").replace(/[^A-Za-z0-9._-]+/g, "_");
  return `${base}.json`;
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const listed = await listWorkflows();
  const manifest = {
    exported_at: new Date().toISOString(),
    base_url: baseUrl,
    api: "n8n public API v1, GET only",
    script: "scripts/export_live_workflows.js",
    out_dir: path.relative(path.resolve(__dirname, ".."), outDir).split(path.sep).join("/"),
    workflow_count: listed.length,
    workflows: []
  };

  for (const listedWorkflow of listed) {
    const workflow = await n8nGet(`/workflows/${encodeURIComponent(listedWorkflow.id)}`);
    const fileName = safeFileName(workflow);
    const bytes = Buffer.from(`${JSON.stringify(workflow, null, 2)}\n`, "utf8");
    fs.writeFileSync(path.join(outDir, fileName), bytes);

    const classification = classify(workflow.name);
    manifest.workflows.push({
      file: fileName,
      id: workflow.id,
      name: workflow.name,
      engine: classification.engine,
      role: classification.role,
      active: Boolean(workflow.active),
      is_archived: Boolean(workflow.isArchived),
      version_id: workflow.versionId ?? null,
      version_counter: workflow.versionCounter ?? null,
      trigger_count: workflow.triggerCount ?? null,
      created_at: workflow.createdAt ?? null,
      updated_at: workflow.updatedAt ?? null,
      project_id: workflow.shared?.[0]?.projectId ?? null,
      node_count: (workflow.nodes || []).length,
      node_names: (workflow.nodes || []).map((node) => node.name),
      code_nodes: (workflow.nodes || [])
        .filter((node) => node.parameters && typeof node.parameters.jsCode === "string")
        .map((node) => ({
          name: node.name,
          js_code_sha256: sha256(Buffer.from(node.parameters.jsCode, "utf8")),
          js_code_bytes: Buffer.byteLength(node.parameters.jsCode, "utf8")
        })),
      credential_bindings: (workflow.nodes || [])
        .filter((node) => node.credentials && Object.keys(node.credentials).length)
        .map((node) => ({ node: node.name, names: Object.keys(node.credentials) })),
      routing: routingReferences(workflow),
      sha256: sha256(bytes),
      bytes: bytes.length
    });
  }

  manifest.workflows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  fs.writeFileSync(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`Exported ${manifest.workflows.length} workflows (GET only) to ${manifest.out_dir}`);
  for (const entry of manifest.workflows) {
    console.log(
      `${String(entry.engine).padEnd(12)} ${String(entry.role).padEnd(17)} ${String(entry.id).padEnd(20)} ` +
      `v${entry.version_counter} ${entry.sha256.slice(0, 12)} ${entry.name}`
    );
  }
}

main().catch((error) => {
  console.error(`Export failed: ${error.message}`);
  process.exitCode = 1;
});


