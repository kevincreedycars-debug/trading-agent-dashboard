const fs = require("node:fs");
const path = require("node:path");

const workflows = [
  { id: "850DrjzCKKX9fDzD", name: "Dashboard Writer - Layer 1" },
  { id: "X75RKU34ikiM5RMU", name: "Master Orchestrator" }
];
const backupDirectory = path.join(__dirname, "..", "tmp", "n8n-backups");
const baseUrl = process.env.N8N_BASE_URL;
const apiKey = process.env.N8N_API_KEY;

if (!baseUrl || !apiKey) throw new Error("N8N_BASE_URL and N8N_API_KEY are required.");
const apiBase = `${baseUrl.replace(/\/$/, "")}/api/v1`;

async function request(pathname, init = {}) {
  const response = await fetch(`${apiBase}${pathname}`, {
    ...init,
    headers: { accept: "application/json", "content-type": "application/json", "X-N8N-API-KEY": apiKey, ...(init.headers || {}) }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`n8n API ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  fs.mkdirSync(backupDirectory, { recursive: true });
  const activated = [];
  for (const target of workflows) {
    const live = await request(`/workflows/${target.id}`);
    if (live.name !== target.name) throw new Error(`Refusing to activate unexpected workflow ${target.id}.`);
    const backupPath = path.join(backupDirectory, `${target.id}-before-reactivation-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(backupPath, `${JSON.stringify(live, null, 2)}\n`, "utf8");
    const updated = await request(`/workflows/${target.id}/activate`, { method: "POST" });
    if (!updated?.active) throw new Error(`${target.name} did not report active after reactivation.`);
    activated.push({ id: target.id, name: target.name, backupPath });
  }
  console.log(JSON.stringify({ activated }, null, 2));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
