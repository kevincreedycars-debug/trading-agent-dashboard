const fs = require("node:fs");
const path = require("node:path");

const workflowId = "ZKGSuYcWb6EfgXBE";
const expectedName = "Layer 2 Trade Selection Agent";
const root = path.join(__dirname, "..");
const exportPath = path.join(root, "exports", "layer2_trade_selection_agent.json");
const backupDirectory = path.join(root, "tmp", "n8n-backups");

function fail(message) {
  throw new Error(message);
}

function getRequiredEnvironment(name) {
  const value = process.env[name];
  if (!value) fail(`Missing required environment variable: ${name}`);
  return value;
}

function workflowUrl(baseUrl) {
  return `${baseUrl.replace(/\/$/, "")}/api/v1/workflows/${workflowId}`;
}

function assertBoundedReads(workflow) {
  const agents = ["USD", "EUR", "GOLD", "NQ", "BTC"];
  const reads = workflow.nodes.filter((node) => node.type === "n8n-nodes-base.supabase");

  if (reads.length !== agents.length) fail(`Expected ${agents.length} Layer 2 Supabase reads; found ${reads.length}.`);

  for (const agent of agents) {
    const node = reads.find((candidate) => candidate.parameters?.filters?.conditions?.some(
      (condition) => condition.keyName === "agent_name" && condition.keyValue === agent
    ));
    if (!node) fail(`Missing bounded Layer 2 read for ${agent}.`);
    if (node.parameters.limit !== 20 || node.parameters.orderBy !== "created_at.desc") {
      fail(`${node.name} is not bounded and ordered for the newest output.`);
    }
  }
}

async function request(url, apiKey, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "X-N8N-API-KEY": apiKey,
      ...(init.headers || {})
    }
  });
  const body = await response.text();
  if (!response.ok) fail(`n8n API ${response.status}: ${body.slice(0, 500)}`);
  return body ? JSON.parse(body) : null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const baseUrl = getRequiredEnvironment("N8N_BASE_URL");
  const apiKey = getRequiredEnvironment("N8N_API_KEY");
  const desired = JSON.parse(fs.readFileSync(exportPath, "utf8"));
  assertBoundedReads(desired);

  const url = workflowUrl(baseUrl);
  const live = await request(url, apiKey);
  if (live.id !== workflowId || live.name !== expectedName) {
    fail(`Refusing to update unexpected workflow: ${live.id || "unknown"} ${live.name || "unknown"}.`);
  }

  if (!apply) {
    assertBoundedReads(live);
    console.log(JSON.stringify({ mode: "dry-run", workflowId, name: live.name, active: Boolean(live.active) }));
    return;
  }

  fs.mkdirSync(backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDirectory, `layer2-trade-selection-${timestamp}.json`);
  fs.writeFileSync(backupPath, `${JSON.stringify(live, null, 2)}\n`, "utf8");

  const payload = {
    name: live.name,
    nodes: desired.nodes,
    connections: desired.connections,
    settings: live.settings || {}
  };
  const updated = await request(url, apiKey, { method: "PUT", body: JSON.stringify(payload) });
  assertBoundedReads(updated);
  console.log(JSON.stringify({ mode: "applied", workflowId, name: updated.name, backupPath }));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
