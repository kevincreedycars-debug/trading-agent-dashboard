const { hash, normalizedHttpNode } = require('./btc_rate_limit_repair');
const WORKFLOW_ID = 'P1E4ZWtbDetYz1P5';
const NODE_NAME = 'HTTP Request | US 2Y Treasury Yield - FRED API';
function planUsdGatewayRepair(workflow, execution) {
  if (workflow?.id !== WORKFLOW_ID || workflow.name !== 'Data Collector - USD' ||
      execution?.workflowId !== WORKFLOW_ID || execution.status !== 'error') throw Error('Matching USD workflow and failed execution required.');
  const result = execution.data?.resultData;
  if (result?.lastNodeExecuted !== NODE_NAME || result.error?.node?.name !== NODE_NAME || String(result.error.httpCode) !== '502') throw Error('Expected first FRED request HTTP 502.');
  const matches = workflow.nodes.filter(node => node.name === NODE_NAME);
  if (matches.length !== 1) throw Error('Unique FRED entry node required.');
  const node = matches[0], url = new URL(node.parameters.url);
  if (node.type !== 'n8n-nodes-base.httpRequest' || (node.parameters.method || 'GET') !== 'GET' ||
      url.origin !== 'https://api.stlouisfed.org' || url.pathname !== '/fred/series/observations' ||
      url.searchParams.get('series_id') !== 'DGS2' || node.executeOnce !== true || node.continueOnFail ||
      (node.onError && node.onError !== 'stopWorkflow')) throw Error('Expected single-run, fail-closed FRED DGS2 GET.');
  const active = workflow.activeVersion?.nodes?.find(item => item.id === node.id);
  if (!workflow.active || !active || hash(workflow.nodes) !== hash(workflow.activeVersion.nodes) ||
      hash(workflow.connections) !== hash(workflow.activeVersion.connections)) throw Error('Active/editable workflow drift.');
  const executed = execution.workflowData?.nodes?.find(item => item.id === node.id);
  if (!executed || hash(normalizedHttpNode(executed)) !== hash(normalizedHttpNode(node))) throw Error('Execution/live node drift.');
  if (node.retryOnFail) throw Error('Node already retries; investigate before changing policy.');
  const nodes = workflow.nodes.map(item => item.id === node.id ? { ...item, retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 } : item);
  return { payload: { name: workflow.name, nodes, connections: workflow.connections, settings: workflow.settings || {} },
    summary: { workflow_id: WORKFLOW_ID, execution_id: execution.id, node_name: NODE_NAME,
      retryOnFail: true, maxTries: 3, waitBetweenTries: 5000, persistent_failure: 'stopWorkflow', executeOnce: true } };
}
module.exports = { WORKFLOW_ID, NODE_NAME, planUsdGatewayRepair };
