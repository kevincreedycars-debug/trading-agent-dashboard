const test = require('node:test');
const assert = require('node:assert/strict');
const { WORKFLOW_ID, NODE_NAME, planUsdGatewayRepair } = require('../scripts/lib/usd_gateway_repair');
function fixture() {
  const node = { id: 'fred', name: NODE_NAME, type: 'n8n-nodes-base.httpRequest', executeOnce: true,
    parameters: { url: 'https://api.stlouisfed.org/fred/series/observations?series_id=DGS2', options: {} } };
  const workflow = { id: WORKFLOW_ID, name: 'Data Collector - USD', active: true,
    nodes: [node, { id: 'other', name: 'Untouched' }], connections: { preserved: [] }, settings: { executionOrder: 'v1' } };
  workflow.activeVersion = structuredClone({ nodes: workflow.nodes, connections: workflow.connections });
  const execution = { id: 'test', workflowId: WORKFLOW_ID, status: 'error', workflowData: structuredClone(workflow),
    data: { resultData: { lastNodeExecuted: NODE_NAME, error: { node: { name: NODE_NAME }, httpCode: '502' } } } };
  return { workflow, execution };
}
test('USD gateway repair changes only bounded retry settings and preserves fatal errors and single execution', () => {
  const { workflow, execution } = fixture(), original = structuredClone(workflow);
  const plan = planUsdGatewayRepair(workflow, execution);
  assert.deepEqual(workflow, original);
  assert.deepEqual(plan.payload.nodes[0], { ...workflow.nodes[0], retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 });
  assert.deepEqual(plan.payload.nodes[1], workflow.nodes[1]);
  assert.deepEqual(plan.payload.connections, workflow.connections);
  assert.equal(plan.payload.nodes[0].onError, undefined);
});
test('repair rejects other failures, lost executeOnce, existing retries and active/execution drift', () => {
  for (const mutate of [
    f => { f.execution.data.resultData.error.httpCode = '429'; },
    f => { f.workflow.nodes[0].executeOnce = false; },
    f => { f.workflow.activeVersion.connections = {}; },
    f => { f.execution.workflowData.nodes[0].parameters.options = { timeout: 1 }; },
    f => { f.workflow.nodes[0].retryOnFail = true; f.workflow.activeVersion.nodes[0].retryOnFail = true; f.execution.workflowData.nodes[0].retryOnFail = true; },
    f => { f.workflow.nodes[0].onError = 'continueRegularOutput'; }
  ]) { const f = fixture(); mutate(f); assert.throws(() => planUsdGatewayRepair(f.workflow, f.execution)); }
});
