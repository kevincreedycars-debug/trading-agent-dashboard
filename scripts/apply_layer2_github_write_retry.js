const fs = require("node:fs");
const path = require("node:path");

const workflowId = "ZKGSuYcWb6EfgXBE";
const expectedName = "Layer 2 Trade Selection Agent";
const writeNodeName = "Write data/layer2.json to GitHub";
const backupDirectory = path.join(__dirname, "..", "tmp", "n8n-backups");

function assertWriteRetry(workflow) {
  const write = workflow.nodes.find((node) => node.name === writeNodeName);
  if (!write) throw new Error(`Missing ${writeNodeName}.`);
  if (write.retryOnFail !== true || write.maxTries !== 4 || write.waitBetweenTries !== 5000) {
    throw new Error("Layer 2 GitHub publication must retry four times with a five-second delay.");
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
  const apply = process.argv.includes("--apply") || process.env.N8N_APPLY === "1";
  const baseUrl = process.env.N8N_BASE_URL;
  const apiKey = process.env.N8N_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("N8N_BASE_URL and N8N_API_KEY are required.");

  const url = `${baseUrl.replace(/\/$/, "")}/api/v1/workflows/${workflowId}`;
  const live = await request(url, apiKey);
  if (live.id !== workflowId || live.name !== expectedName) throw new Error("Refusing to update an unexpected workflow.");

  const nodes = live.nodes.map((node) => node.name === writeNodeName
    ? { ...node, retryOnFail: true, maxTries: 4, waitBetweenTries: 5000 }
    : node);
  const desired = { ...live, nodes };
  assertWriteRetry(desired);

  if (!apply) {
    console.log(JSON.stringify({ mode: "dry-run", workflowId, active: Boolean(live.active) }));
    return;
  }

  fs.mkdirSync(backupDirectory, { recursive: true });
  const backupPath = path.join(backupDirectory, `layer2-github-write-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(backupPath, `${JSON.stringify(live, null, 2)}\n`, "utf8");
  const updated = await request(url, apiKey, {
    method: "PUT",
    body: JSON.stringify({ name: live.name, nodes, connections: live.connections, settings: live.settings || {} })
  });
  assertWriteRetry(updated);
  console.log(JSON.stringify({ mode: "applied", workflowId, active: Boolean(updated.active), backupPath }));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
