const fs = require('node:fs');
const { hash } = require('./lib/btc_rate_limit_repair');
const { WORKFLOW_ID, planUsdGatewayRepair } = require('./lib/usd_gateway_repair');
async function run(args = process.argv.slice(2)) {
  const [executionId, mode] = args;
  if (!/^\d+$/.test(executionId || '') || args.length > 2 || (mode && mode !== '--apply')) throw Error('Usage: EXECUTION_ID [--apply]');
  if (!process.env.N8N_BASE_URL || !process.env.N8N_API_KEY) throw Error('Use the scoped credential runner.');
  const base = new URL(process.env.N8N_BASE_URL);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw Error('Plain HTTPS base required.');
  const api = async (route, payload) => {
    const r = await fetch(base.href.replace(/\/$/, '') + '/api/v1' + route, {
      method: payload ? 'PUT' : 'GET', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY, 'content-type': 'application/json' },
      ...(payload ? { body: JSON.stringify(payload) } : {}) });
    if (!r.ok) throw Error('n8n HTTP ' + r.status + '; response omitted.');
    return r.json();
  };
  const route = '/workflows/' + WORKFLOW_ID;
  const workflow = await api(route), execution = await api('/executions/' + executionId + '?includeData=true');
  const plan = planUsdGatewayRepair(workflow, execution);
  if (mode !== '--apply') return { mode: 'read-only', ...plan.summary };
  if (hash(await api(route)) !== hash(workflow)) throw Error('Concurrent workflow change; update refused.');
  fs.mkdirSync('tmp/n8n-backups', { recursive: true });
  const backup = 'tmp/n8n-backups/usd-gateway-' + Date.now() + '.json';
  fs.writeFileSync(backup, JSON.stringify(workflow), { flag: 'wx' });
  await api(route, plan.payload);
  const saved = await api(route);
  for (const version of [saved, saved.activeVersion]) if (!version || hash(version.nodes) !== hash(plan.payload.nodes) ||
      hash(version.connections) !== hash(plan.payload.connections)) throw Error('Saved/active verification failed; inspect backup.');
  return { mode: 'applied', ...plan.summary, backup, activeVerified: true };
}
if (require.main === module) run().then(r => console.log(JSON.stringify(r))).catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { run };
