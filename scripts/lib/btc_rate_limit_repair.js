const crypto = require('node:crypto');
const WORKFLOW_ID = 'AE3Vv7ILPPiZwZHN';
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const hash = value => crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const normalizedHttpNode = node => node && ({ ...node, parameters: { curlImport: '', method: 'GET',
  authentication: 'none', provideSslCertificates: false, sendQuery: false, sendHeaders: false,
  sendBody: false, infoMessage: '', ...node.parameters } });

function planBtcRateLimitRepair(workflow, execution) {
  if (workflow?.id !== WORKFLOW_ID || workflow.name !== 'Data Collector - BTC' ||
    execution?.workflowId !== WORKFLOW_ID || execution.status !== 'error') {
    throw new Error('A failed BTC collector execution and matching live workflow are required.');
  }
  const result = execution.data?.resultData;
  const error = result?.error;
  const name = error?.node?.name;
  if (!name || (result.lastNodeExecuted && result.lastNodeExecuted !== name)) {
    throw new Error('Failed HTTP node identity is absent or ambiguous.');
  }
  const message = [error.message, error.description, error.cause?.message].filter(value => typeof value === 'string').join(' ');
  const status = error.httpCode ?? error.statusCode ?? error.cause?.statusCode;
  if (status !== undefined ? String(status) !== '429' : !/too many requests|rate.limit/i.test(message)) {
    throw new Error('Execution does not establish a rate-limit failure.');
  }
  const matches = workflow.nodes.filter(node => node.name === name);
  if (matches.length !== 1 || matches[0].type !== 'n8n-nodes-base.httpRequest' ||
    (matches[0].parameters.method || 'GET') !== 'GET') throw new Error('Only the identified read-only HTTP GET node may be repaired.');
  const node = matches[0];
  if (node.name !== 'HTTP Request | BTC Market Data - CoinGecko' ||
    node.parameters.url !== 'https://api.coingecko.com/api/v3/global') {
    throw new Error('This repair is restricted to the confirmed optional CoinGecko global input.');
  }
  const executed = execution.workflowData?.nodes?.find(item => item.id === node.id);
  if (!executed || hash(normalizedHttpNode(executed)) !== hash(normalizedHttpNode(node))) throw new Error('Live node differs from execution snapshot; review drift before applying.');
  if (workflow.activeVersion?.nodes) {
    const active = workflow.activeVersion.nodes.find(item => item.id === node.id);
    if (!active || hash(active) !== hash(node)) throw new Error('Active and editable node versions differ; publication needs explicit review.');
  }
  if (node.retryOnFail) throw new Error('Failed node already retries; provider-specific cooldown or request pacing is required.');
  const headers = error.context?.response?.headers ?? error.cause?.response?.headers ?? error.response?.headers ?? {};
  const retryAfter = Object.entries(headers).find(([key]) => key.toLowerCase() === 'retry-after')?.[1];
  if (retryAfter !== undefined && (!/^\d+$/.test(String(retryAfter)) || Number(retryAfter) > 5)) {
    throw new Error('Provider Retry-After exceeds the bounded retry delay or is date-based; honor that cooldown with a provider-specific repair.');
  }
  const updatedNode = { ...node, retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    onError: 'continueRegularOutput' };
  const nodes = workflow.nodes.map(item => item.id === node.id ? updatedNode : item);
  return { payload: { name: workflow.name, nodes, connections: workflow.connections, settings: workflow.settings || {} },
    summary: { workflow_id: WORKFLOW_ID, execution_id: execution.id, node_id: node.id, node_name: node.name,
      change: { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000, onError: 'continueRegularOutput' },
      provider_failure_remains_missing_input: true, live_recovery_verified: false,
      limitation: 'Persistent CoinGecko failure leaves dominance/market-cap inputs absent and the snapshot partial; it does not invent replacement values.' } };
}

module.exports = { WORKFLOW_ID, hash, planBtcRateLimitRepair };
