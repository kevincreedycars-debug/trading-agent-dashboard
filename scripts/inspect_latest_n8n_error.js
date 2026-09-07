const baseUrl = process.env.N8N_BASE_URL;
const apiKey = process.env.N8N_API_KEY;

if (!baseUrl || !apiKey) throw new Error("N8N_BASE_URL and N8N_API_KEY are required.");

async function request(path) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1${path}`, {
    headers: { "X-N8N-API-KEY": apiKey, accept: "application/json" }
  });
  if (!response.ok) throw new Error(`n8n API ${response.status}`);
  return response.json();
}

function findError(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return null;
  seen.add(value);
  if (typeof value.message === "string" && value.message.trim()) {
    return {
      message: value.message,
      description: typeof value.description === "string" ? value.description : null,
      node: typeof value.node?.name === "string" ? value.node.name : null
    };
  }
  for (const child of Object.values(value)) {
    const found = findError(child, seen);
    if (found) return found;
  }
  return null;
}

async function main() {
  const list = await request("/executions?limit=100");
  const executions = Array.isArray(list) ? list : list.data || [];
  const latest = executions.find((execution) => ["error", "crashed"].includes(execution.status));
  if (!latest) throw new Error("No recent failed n8n execution was found.");

  const detail = await request(`/executions/${latest.id}?includeData=true`);
  console.log(JSON.stringify({
    executionId: latest.id,
    workflowId: latest.workflowId,
    startedAt: latest.startedAt,
    stoppedAt: latest.stoppedAt,
    error: findError(detail.data?.resultData || detail)
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
