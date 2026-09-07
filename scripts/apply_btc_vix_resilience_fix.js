const fs = require("node:fs");
const path = require("node:path");
const workflowId = "AE3Vv7ILPPiZwZHN";
const expectedName = "Data Collector - BTC";
const baseUrl = process.env.N8N_BASE_URL;
const apiKey = process.env.N8N_API_KEY;
if (!baseUrl || !apiKey) throw new Error("N8N_BASE_URL and N8N_API_KEY are required.");

async function request(url, init = {}) {
  const response = await fetch(url, { ...init, headers: { accept: "application/json", "content-type": "application/json", "X-N8N-API-KEY": apiKey, ...(init.headers || {}) } });
  const text = await response.text();
  if (!response.ok) throw new Error(`n8n API ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const apiBase = `${baseUrl.replace(/\/$/, "")}/api/v1`;
  const live = await request(`${apiBase}/workflows/${workflowId}`);
  if (live.name !== expectedName) throw new Error("Refusing to update an unexpected workflow.");
  const nodes = live.nodes.map((node) => node.name === "HTTP Request | VIX - FRED Api"
    ? { ...node, retryOnFail: true, maxTries: 3, waitBetweenTries: 5000, onError: "continueRegularOutput" }
    : node);
  const vix = nodes.find((node) => node.name === "HTTP Request | VIX - FRED Api");
  if (vix?.onError !== "continueRegularOutput") throw new Error("VIX resilience update was not constructed.");
  const backupDirectory = path.join(__dirname, "..", "tmp", "n8n-backups");
  fs.mkdirSync(backupDirectory, { recursive: true });
  const backupPath = path.join(backupDirectory, `btc-layer1-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(backupPath, `${JSON.stringify(live, null, 2)}\n`, "utf8");
  const updated = await request(`${apiBase}/workflows/${workflowId}`, { method: "PUT", body: JSON.stringify({ name: live.name, nodes, connections: live.connections, settings: live.settings || {} }) });
  if (updated.nodes.find((node) => node.name === "HTTP Request | VIX - FRED Api")?.onError !== "continueRegularOutput") throw new Error("n8n did not retain the VIX resilience update.");
  console.log(JSON.stringify({ workflowId, name: updated.name, backupPath }));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
