const baseUrl = process.env.N8N_BASE_URL;
const apiKey = process.env.N8N_API_KEY;

if (!baseUrl || !apiKey) {
  throw new Error("N8N_BASE_URL and N8N_API_KEY are required.");
}

async function main() {
  const apiBase = `${baseUrl.replace(/\/$/, "")}/api/v1`;
  const headers = { "X-N8N-API-KEY": apiKey, accept: "application/json" };
  const response = await fetch(`${apiBase}/executions?limit=100`, { headers });
  if (!response.ok) throw new Error(`n8n API ${response.status}`);

  const payload = await response.json();
  const executions = Array.isArray(payload) ? payload : payload.data || [];
  const workflowsResponse = await fetch(`${apiBase}/workflows?limit=250`, { headers });
  if (!workflowsResponse.ok) throw new Error(`n8n workflow API ${workflowsResponse.status}`);
  const workflowsPayload = await workflowsResponse.json();
  const workflows = Array.isArray(workflowsPayload) ? workflowsPayload : workflowsPayload.data || [];
  const workflowNames = new Map(workflows.map((workflow) => [workflow.id, workflow.name]));

  console.log(JSON.stringify(executions
    .slice(0, 25)
    .map((execution) => ({
      id: execution.id,
      workflowId: execution.workflowId,
      workflowName: workflowNames.get(execution.workflowId) || "unknown",
      status: execution.status,
      startedAt: execution.startedAt,
      stoppedAt: execution.stoppedAt
    })), null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
