const fs = require("node:fs");
const path = require("node:path");

const workflowId = "850DrjzCKKX9fDzD";
const expectedName = "Dashboard Writer - Layer 1";
const backupDirectory = path.join(__dirname, "..", "tmp", "n8n-backups");

function assertBoundedReads(workflow) {
  const reads = workflow.nodes.filter((node) => node.type === "n8n-nodes-base.supabase" && node.parameters?.tableId === "agent_outputs");
  if (reads.length !== 5 || reads.some((node) => node.parameters.limit !== 20 || node.parameters.orderBy !== "created_at.desc")) {
    throw new Error("Dashboard Writer must use five bounded newest-first agent-output reads.");
  }
}

async function request(url, apiKey, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { accept: "application/json", "content-type": "application/json", "X-N8N-API-KEY": apiKey, ...(init.headers || {}) }
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`n8n API ${response.status}: ${body.slice(0, 500)}`);
  return body ? JSON.parse(body) : null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const baseUrl = process.env.N8N_BASE_URL;
  const apiKey = process.env.N8N_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("N8N_BASE_URL and N8N_API_KEY are required.");

  const url = `${baseUrl.replace(/\/$/, "")}/api/v1/workflows/${workflowId}`;
  const live = await request(url, apiKey);
  if (live.id !== workflowId || live.name !== expectedName) throw new Error("Refusing to update an unexpected workflow.");

  const nodes = live.nodes.map((node) => node.type === "n8n-nodes-base.supabase" && node.parameters?.tableId === "agent_outputs"
    ? { ...node, parameters: { ...node.parameters, limit: 20 } }
    : node);
  const desired = { ...live, nodes };

  if (!apply) {
    assertBoundedReads(desired);
    console.log(JSON.stringify({ mode: "dry-run", workflowId, active: Boolean(live.active) }));
    return;
  }

  fs.mkdirSync(backupDirectory, { recursive: true });
  const backupPath = path.join(backupDirectory, `dashboard-writer-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(backupPath, `${JSON.stringify(live, null, 2)}\n`, "utf8");
  const updated = await request(url, apiKey, {
    method: "PUT",
    body: JSON.stringify({ name: live.name, nodes, connections: live.connections, settings: live.settings || {} })
  });
  assertBoundedReads(updated);
  console.log(JSON.stringify({ mode: "applied", workflowId, active: Boolean(updated.active), backupPath }));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
