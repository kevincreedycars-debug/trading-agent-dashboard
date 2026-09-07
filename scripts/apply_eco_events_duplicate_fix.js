const fs = require("node:fs");
const path = require("node:path");

const workflowId = "UaSliyR8qlSVIfmk";
const expectedName = "Eco Events Collector";
const root = path.join(__dirname, "..");
const exportPath = path.join(root, "exports", "eco_events_collector.json");
const backupDirectory = path.join(root, "tmp", "n8n-backups");

function fail(message) { throw new Error(message); }

function assertRollingWindowLookup(workflow) {
  const node = workflow.nodes.find((candidate) => candidate.name === "Supabase | Get Existing Economic Events");
  const conditions = node?.parameters?.filters?.conditions || [];
  if (conditions.length !== 2 || conditions[0]?.condition !== "gte" || conditions[1]?.condition !== "lte") {
    fail("Eco Events must check existing records across the complete rolling date window.");
  }
}

async function request(url, apiKey, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { accept: "application/json", "content-type": "application/json", "X-N8N-API-KEY": apiKey, ...(init.headers || {}) }
  });
  const body = await response.text();
  if (!response.ok) fail(`n8n API ${response.status}: ${body.slice(0, 500)}`);
  return body ? JSON.parse(body) : null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const baseUrl = process.env.N8N_BASE_URL;
  const apiKey = process.env.N8N_API_KEY;
  if (!baseUrl || !apiKey) fail("N8N_BASE_URL and N8N_API_KEY are required.");

  const desired = JSON.parse(fs.readFileSync(exportPath, "utf8"));
  assertRollingWindowLookup(desired);
  const url = `${baseUrl.replace(/\/$/, "")}/api/v1/workflows/${workflowId}`;
  const live = await request(url, apiKey);
  if (live.id !== workflowId || live.name !== expectedName) fail("Refusing to update an unexpected workflow.");

  if (!apply) {
    assertRollingWindowLookup(live);
    console.log(JSON.stringify({ mode: "dry-run", workflowId, name: live.name, active: Boolean(live.active) }));
    return;
  }

  fs.mkdirSync(backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDirectory, `eco-events-${timestamp}.json`);
  fs.writeFileSync(backupPath, `${JSON.stringify(live, null, 2)}\n`, "utf8");

  const updated = await request(url, apiKey, {
    method: "PUT",
    body: JSON.stringify({ name: live.name, nodes: desired.nodes, connections: desired.connections, settings: live.settings || {} })
  });
  assertRollingWindowLookup(updated);
  console.log(JSON.stringify({ mode: "applied", workflowId, name: updated.name, backupPath }));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
