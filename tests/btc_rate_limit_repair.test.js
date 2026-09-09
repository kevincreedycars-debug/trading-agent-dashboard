const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { planBtcRateLimitRepair, WORKFLOW_ID } = require('../scripts/lib/btc_rate_limit_repair');
const { run } = require('../scripts/repair_btc_rate_limit');
const exported = require('../exports/btc_collector.json');
function fixture() {
  const workflow = structuredClone(exported);
  const node = workflow.nodes.find(node => node.name === 'HTTP Request | BTC Market Data - CoinGecko');
  for (const key of ['retryOnFail', 'maxTries', 'waitBetweenTries', 'onError']) delete node[key];
  workflow.activeVersion.nodes = structuredClone(workflow.nodes);
  return { workflow, execution: { id: 'synthetic', workflowId: WORKFLOW_ID, status: 'error',
    workflowData: { nodes: structuredClone(workflow.nodes) }, data: { resultData: { lastNodeExecuted: node.name,
      error: { httpCode: '429', message: 'The service is receiving too many requests from you', node: { name: node.name } } } } } };
}
test('rate-limit repair changes only the confirmed optional CoinGecko node', () => {
  const { workflow, execution } = fixture();
  const plan = planBtcRateLimitRepair(workflow, execution);
  assert.deepEqual(plan.payload.connections, workflow.connections);
  const changed = plan.payload.nodes.filter((node, i) => JSON.stringify(node) !== JSON.stringify(workflow.nodes[i]));
  assert.equal(changed.length, 1);
  assert.equal(changed[0].onError, 'continueRegularOutput');
  assert.equal(changed[0].maxTries, 3);
  assert.equal(changed[0].waitBetweenTries, 5000);
});
test('repair refuses wrong execution, changed node, non-429 failure and longer Retry-After', () => {
  for (const mutate of [
    f => f.execution.workflowId = 'other',
    f => f.execution.data.resultData.error.httpCode = '401',
    f => f.execution.workflowData.nodes.find(n => n.name.includes('CoinGecko')).parameters.url = 'https://example.invalid',
    f => f.execution.data.resultData.error.response = { headers: { 'Retry-After': '60' } },
    f => f.workflow.nodes.find(n => n.name.includes('CoinGecko')).retryOnFail = true
  ]) { const f = fixture(); mutate(f); assert.throws(() => planBtcRateLimitRepair(f.workflow, f.execution)); }
});
test('CoinGecko error output remains explicit missing data and does not discard BTC price', () => {
  for (const version of [exported, exported.activeVersion]) {
    const node = version.nodes.find(n => n.name.includes('CoinGecko'));
    assert.equal(node.onError, 'continueRegularOutput');
    const code = version.nodes.find(n => n.name === 'Normalise Market Snapshot').parameters.jsCode;
    const values = { [node.name]: { error: 'The service is receiving too many requests from you' },
      'HTTP Request | BTC - Coinbase': { data: { amount: '100000' } } };
    const rows = vm.runInNewContext(`(function(){${code}\n})()`, { $: name => ({
      first: () => ({ json: values[name] || {} }), all: () => [] }) }, { timeout: 1000 });
    assert.equal(rows[0].json.btc_price, 100000);
    assert.equal(rows[0].json.btc_dominance, null);
    assert.equal(rows[0].json.total_crypto_market_cap, null);
    assert.equal(rows[0].json.source_status, 'partial');
    assert.ok(rows[0].json.data_quality.missing.includes('btc_dominance'));
  }
});
test('repair command defaults to read-only and refuses drift before any update', async () => {
  const f = fixture(), methods = [];
  const env = { N8N_BASE_URL: 'https://example.invalid', N8N_API_KEY: 'synthetic-only' };
  const fetcher = async (url, init) => { methods.push(init.method); return { ok: true, json: async () =>
    url.includes('/executions/') ? f.execution : f.workflow }; };
  assert.equal((await run(['synthetic'], env, fetcher)).mode, 'dry-run');
  assert.deepEqual(methods, ['GET', 'GET']);
  let reads = 0;
  await assert.rejects(run(['synthetic', '--apply'], env, async (url, init) => {
    assert.equal(init.method, 'GET');
    return { ok: true, json: async () => url.includes('/executions/') ? f.execution :
      ++reads === 1 ? f.workflow : { ...f.workflow, updatedAt: 'changed' } };
  }), /changed during review/);
});
