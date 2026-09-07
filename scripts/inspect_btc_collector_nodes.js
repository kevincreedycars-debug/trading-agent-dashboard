const baseUrl = process.env.N8N_BASE_URL;
const apiKey = process.env.N8N_API_KEY;
const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/workflows/AE3Vv7ILPPiZwZHN`, { headers: { "X-N8N-API-KEY": apiKey, accept: "application/json" } });
if (!response.ok) throw new Error(`n8n API ${response.status}`);
const workflow = await response.json();
console.log(JSON.stringify((workflow.nodes || []).filter((node) => node.type === "n8n-nodes-base.httpRequest").map((node) => ({ id: node.id, name: node.name, url: node.parameters?.url })), null, 2));
