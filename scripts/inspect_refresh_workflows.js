const baseUrl = process.env.N8N_BASE_URL;
const apiKey = process.env.N8N_API_KEY;
const workflowIds = ["X75RKU34ikiM5RMU", "850DrjzCKKX9fDzD"];

if (!baseUrl || !apiKey) throw new Error("N8N_BASE_URL and N8N_API_KEY are required.");

async function getWorkflow(id) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/workflows/${id}`, {
    headers: { "X-N8N-API-KEY": apiKey, accept: "application/json" }
  });
  if (!response.ok) throw new Error(`n8n API ${response.status} for ${id}`);
  return response.json();
}

const workflows = await Promise.all(workflowIds.map(getWorkflow));
console.log(JSON.stringify(workflows.map((workflow) => ({
  id: workflow.id,
  name: workflow.name,
  active: Boolean(workflow.active),
  agentOutputReads: (workflow.nodes || [])
    .filter((node) => node.type === "n8n-nodes-base.supabase" && node.parameters?.tableId === "agent_outputs")
    .map((node) => ({ name: node.name, limit: node.parameters.limit, orderBy: node.parameters.orderBy }))
})), null, 2));
