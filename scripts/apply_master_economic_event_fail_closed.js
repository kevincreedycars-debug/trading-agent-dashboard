const fs = require("node:fs");
const path = require("node:path");
const workflowPath = path.resolve(__dirname, "..", "exports", "master_orchestrator.json");
const sourceNodeName = "Call '1. Economic Events Collector'";
const guardNodeName = "Guard Economic Event Collector";
const buildHealthNodeName = "Build Input Health on Economic Event Failure";
const publishHealthNodeName = "Publish Input Health on Economic Event Failure";

function n8nGateCode() {
  return "return $input.all().map((item) => ({ json: { ...item.json, economic_event_gate: 'PASS', economic_event_error: null } }));";
}

function n8nFailureHealthCode() {
  return "const raw = $input.first()?.json || {};\nfunction serialise(value) { try { return typeof value === 'string' ? value : JSON.stringify(value); } catch (error) { return String(value); } }\nconst error = serialise(raw.error || raw.message || raw.reason || raw.cause || 'Economic event collector failed.');\nconst generatedAt = new Date().toISOString();\nconst affectedAgents = ['USD', 'EUR', 'GOLD', 'NQ', 'BTC'];\nconst issue = { input_id: 'economic_events', label: 'Economic events', category: 'economic_events', importance: 'critical', status: 'SOURCE_UNAVAILABLE', reason: error, recovery_action: 'Restore the economic-event collector, then run a controlled refresh.' };\nconst health = { schema_version: 1, generated_at: generatedAt, source_run_id: null, consistency_status: 'FAILED', consistency_warnings: ['economic_event_collector_failed'], overall_status: 'CRITICAL', affected_agent_count: affectedAgents.length, critical_issue_count: affectedAgents.length, missing_input_count: 0, stale_input_count: 0, placeholder_input_count: 0, source_failure_count: 1, last_full_health_at: null, sources: { economic_events: { source_id: 'economic_events', label: 'Economic events', execution_status: 'failed', data_status: 'SOURCE_UNAVAILABLE', source_collected_at: generatedAt, warning: error } }, source_groups: [{ source_id: 'economic_events', label: 'Economic events', status: 'SOURCE_UNAVAILABLE', warning: error, execution_status: 'failed', source_collected_at: generatedAt, affected_agents: affectedAgents, affected_inputs: [], recovery_state: 'unrecovered' }], agents: Object.fromEntries(affectedAgents.map((agent) => [agent, { overall_status: 'CRITICAL', issues: [{ ...issue, agent }] }])), issues: affectedAgents.map((agent) => ({ ...issue, agent })) };\nreturn [{ json: { file_content: JSON.stringify(health, null, 2), health } }];";
}

function ensureNode(workflow, node) {
  const index = workflow.nodes.findIndex((candidate) => candidate.name === node.name);
  if (index === -1) workflow.nodes.push(node);
  else workflow.nodes[index] = { ...workflow.nodes[index], ...node };
}

function applyFailClosedEconomicEventPath(workflow) {
  const sourceNode = workflow.nodes.find((node) => node.name === sourceNodeName);
  const statusNode = workflow.nodes.find((node) => node.name === "Build Workflow Status JSON");
  const publishStatusNode = workflow.nodes.find((node) => node.name === "Publish Workflow Status");
  if (!sourceNode || !statusNode || !publishStatusNode) {
    throw new Error("Master Orchestrator is missing a required workflow node.");
  }

  sourceNode.onError = "continueErrorOutput";

  ensureNode(workflow, {
    id: "guard-economic-event-collector",
    name: guardNodeName,
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [384, -112],
    parameters: { jsCode: n8nGateCode() }
  });
  ensureNode(workflow, {
    id: "build-input-health-economic-event-failure",
    name: buildHealthNodeName,
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [384, 688],
    parameters: { jsCode: n8nFailureHealthCode() }
  });
  ensureNode(workflow, {
    id: "publish-input-health-economic-event-failure",
    name: publishHealthNodeName,
    type: "n8n-nodes-base.github",
    typeVersion: 1.1,
    position: [592, 688],
    parameters: {
      ...publishStatusNode.parameters,
      filePath: "data/input-health.json",
      commitMessage: "Publish failed economic-event input health"
    },
    credentials: publishStatusNode.credentials
  });

  workflow.connections[sourceNodeName] = {
    main: [
      [{ node: guardNodeName, type: "main", index: 0 }],
      [{ node: buildHealthNodeName, type: "main", index: 0 }]
    ]
  };
  workflow.connections[guardNodeName] = {
    main: [[{ node: "USD Collector", type: "main", index: 0 }]]
  };
  workflow.connections[buildHealthNodeName] = {
    main: [[{ node: publishHealthNodeName, type: "main", index: 0 }]]
  };
  workflow.connections[publishHealthNodeName] = {
    main: [[{ node: "Build Workflow Status JSON", type: "main", index: 0 }]]
  };
  return workflow;
}

function writeWorkflow() {
  const raw = fs.readFileSync(workflowPath, "utf8");
  const newline = raw.includes("\r\n") ? "\r\n" : "\n";
  const workflow = applyFailClosedEconomicEventPath(JSON.parse(raw));
  fs.writeFileSync(workflowPath, `${JSON.stringify(workflow, null, 2).replace(/\n/g, newline)}${newline}`, "utf8");
}

if (require.main === module) writeWorkflow();

module.exports = {
  applyFailClosedEconomicEventPath,
  buildHealthNodeName,
  guardNodeName,
  publishHealthNodeName
};
