#!/usr/bin/env node
/**
 * Read-only probe of one live n8n workflow's publishing metadata.
 *
 * GET only: it never creates, updates, activates, publishes, deletes or executes anything. It records
 * what the instance exposes read-only about the draft version, the executing version and the publish
 * history, so the layer 1 live deployment guardrails can be pointed at the measured model instead of a
 * guessed one.
 *
 * It cannot establish what a PUT would do to either version: that needs a write. The report therefore
 * records the limitation instead of guessing, and the caller stops at the measurement.
 *
 * Usage (credentials from the local CLIXML store):
 *   powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.trading-agent-dashboard\scripts\run-with-credentials.ps1" `
 *     -Scope n8n -Command node -Arguments scripts/inspect_live_workflow_publishing.js [workflowId]
 *
 * The default workflow id is the live USD Layer 1 Agent. Raw evidence is written under the ignored
 * tmp/live/ folder, never committed as-is.
 */
const fs = require("fs");
const path = require("path");

const baseUrl = String(process.env.N8N_BASE_URL || "").replace(/\/+$/, "");
const apiKey = process.env.N8N_API_KEY;
if (!baseUrl || !apiKey) {
  throw new Error("N8N_BASE_URL and N8N_API_KEY are required (use the scoped credential runner, scope n8n).");
}
const WORKFLOW_ID = process.argv[2] || "OCt1tB9yVMUgFTha";
const outDir = path.resolve(__dirname, "..", "tmp", "live",
  `publishing-inspection-${new Date().toISOString().replace(/[:.]/g, "-")}`);

async function get(pathname, withApiKey) {
  const response = await fetch(baseUrl + pathname, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(30000),
    headers: withApiKey ? {"X-N8N-API-KEY": apiKey} : {}
  });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = null; }
  return {pathname, with_api_key: withApiKey, status: response.status, ok: response.ok,
    content_type: response.headers.get("content-type"), bytes: Buffer.byteLength(text), body, text};
}

// Node bodies are opaque: the metadata that matters sits beside them, not inside them.
const OPAQUE = new Set(["nodes", "connections", "pinData", "staticData"]);
const shape = (value) => value === undefined ? "absent"
  : value === null ? null
  : typeof value !== "object" ? typeof value
  : Array.isArray(value) ? {array: value.length} : {object: Object.keys(value).sort()};

function versionShaped(body, keyPattern = /version|publish|draft|history|archived/i, max = 60) {
  const found = [];
  const walk = (value, at) => {
    if (found.length >= max || !value || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value)) {
      const where = at ? `${at}.${key}` : key;
      if (keyPattern.test(key)) found.push({path: where, value: shape(entry)});
      if (entry && typeof entry === "object" && !OPAQUE.has(key)) walk(entry, where);
    }
  };
  walk(body, "");
  return found;
}

function publishHistory(activeVersion) {
  const history = activeVersion?.workflowPublishHistory;
  if (!Array.isArray(history)) return {entries: null, sample: null};
  return {entries: history.length, sample: history.slice(0, 5).map((entry) => ({
    keys: Object.keys(entry || {}).sort(),
    id: entry?.id ?? null,
    versionId: entry?.versionId ?? null,
    createdAt: entry?.createdAt ?? entry?.created_at ?? null,
    event: entry?.event ?? entry?.eventType ?? null}))};
}

function metadata(workflow) {
  const w = workflow.body || {};
  const activeVersion = w.activeVersion || null;
  const hasCopy = Boolean(activeVersion && Array.isArray(activeVersion.nodes));
  return {
    top_level_keys: Object.keys(w).sort(),
    draft_version_id: w.versionId ?? null,
    version_counter: w.versionCounter ?? null,
    active_version_id: w.activeVersionId ?? null,
    active: w.active ?? null,
    is_archived: w.isArchived ?? null,
    created_at: w.createdAt ?? null,
    updated_at: w.updatedAt ?? null,
    node_count: Array.isArray(w.nodes) ? w.nodes.length : null,
    connection_sources: w.connections ? Object.keys(w.connections).length : null,
    settings: shape(w.settings),
    meta: shape(w.meta),
    tags: shape(w.tags),
    shared_roles: Array.isArray(w.shared)
      ? w.shared.map((entry) => ({role: entry?.role ?? null, workflowId: entry?.workflowId ?? null}))
      : shape(w.shared),
    has_active_version_object: hasCopy,
    active_version_keys: activeVersion ? Object.keys(activeVersion).sort() : null,
    active_version: activeVersion ? {
      workflow_id: activeVersion.workflowId ?? null,
      version_id: activeVersion.versionId ?? null,
      node_count: Array.isArray(activeVersion.nodes) ? activeVersion.nodes.length : null,
      connection_sources: activeVersion.connections ? Object.keys(activeVersion.connections).length : null,
      publish_history: publishHistory(activeVersion)
    } : null,
    publishing_model_read_only: hasCopy || typeof w.activeVersionId === "string" ? "draft_published" : "single_version",
    version_shaped_fields: versionShaped(w)
  };
}

async function main() {
  fs.mkdirSync(outDir, {recursive: true});
  const report = {probed_at: new Date().toISOString(), base_url: baseUrl, workflow_id: WORKFLOW_ID,
    method: "GET only", requests: [], published_metadata: null, instance_version_probes: [],
    limitation: "A GET cannot establish whether PUT /api/v1/workflows/{id} lands in the draft version or in " +
      "the executing version. Answering that needs a write, which this probe does not make."};

  const workflow = await get(`/api/v1/workflows/${WORKFLOW_ID}`, true);
  report.requests.push({pathname: workflow.pathname, with_api_key: true, status: workflow.status, bytes: workflow.bytes});
  if (workflow.text) fs.writeFileSync(path.join(outDir, "workflow-get.json"), workflow.text);
  report.published_metadata = workflow.ok && workflow.body ? metadata(workflow)
    : {error: `GET returned HTTP ${workflow.status}`};

  // The installed n8n version is not part of the public API; the UI REST surface is the only read-only
  // place that might name it, and it may refuse or omit it. Record the status either way, never infer one.
  for (const withApiKey of [false, true]) {
    const settings = await get("/rest/settings", withApiKey);
    report.requests.push({pathname: settings.pathname, with_api_key: withApiKey, status: settings.status, bytes: settings.bytes});
    report.instance_version_probes.push({pathname: "/rest/settings", with_api_key: withApiKey, status: settings.status,
      ok: settings.ok, top_level_keys: settings.body ? Object.keys(settings.body).sort() : null,
      version_shaped_fields: settings.ok ? versionShaped(settings.body ?? {}, /version/i) : []});
    if (settings.text && withApiKey) fs.writeFileSync(path.join(outDir, "settings-get.json"), settings.text);
  }

  fs.writeFileSync(path.join(outDir, "publishing-inspection.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nEvidence written to ${outDir} (ignored local folder).`);
}

main().catch((error) => { console.error(`Inspection failed: ${error.message}`); process.exit(1); });
