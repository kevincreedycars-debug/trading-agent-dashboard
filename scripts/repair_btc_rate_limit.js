const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { WORKFLOW_ID, hash, planBtcRateLimitRepair } = require('./lib/btc_rate_limit_repair');

async function run(args = process.argv.slice(2), environment = process.env, fetcher = fetch) {
  if (args.length < 1 || args.length > 2 || !/^[a-zA-Z0-9_-]+$/.test(args[0]) ||
    (args[1] !== undefined && args[1] !== '--apply')) throw new Error('Usage: node scripts/repair_btc_rate_limit.js FAILED_BTC_EXECUTION_ID [--apply]');
  if (!environment.N8N_BASE_URL || !environment.N8N_API_KEY) throw new Error('N8N_BASE_URL and N8N_API_KEY are required; no live changes were made.');
  const base = new URL(environment.N8N_BASE_URL);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new Error('A plain HTTPS n8n base URL is required.');
  const request = async (route, payload) => {
    const response = await fetcher(`${base.href.replace(/\/$/, '')}/api/v1${route}`, {
      method: payload ? 'PUT' : 'GET', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { accept: 'application/json', 'content-type': 'application/json', 'X-N8N-API-KEY': environment.N8N_API_KEY },
      ...(payload ? { body: JSON.stringify(payload) } : {})
    });
    if (!response.ok) throw new Error(`n8n API HTTP ${response.status}; response body omitted to protect credentials.`);
    return response.json();
  };
  const loaded = await Promise.allSettled([request(`/workflows/${WORKFLOW_ID}`), request(`/executions/${args[0]}?includeData=true`)]);
  for (const result of loaded) if (result.status === 'rejected') throw result.reason;
  const [workflow, execution] = loaded.map(result => result.value);
  if (String(execution.id) !== args[0]) throw new Error('Execution ID mismatch.');
  const plan = planBtcRateLimitRepair(workflow, execution);
  if (args[1] !== '--apply') return { mode: 'dry-run', ...plan.summary };
  const latest = await request(`/workflows/${WORKFLOW_ID}`);
  if (hash(latest) !== hash(workflow)) throw new Error('Workflow changed during review; refusing update.');
  const directory = path.resolve(__dirname, '../tmp/n8n-backups');
  fs.mkdirSync(directory, { recursive: true });
  const backup = path.join(directory, `btc-rate-limit-${Date.now()}-${crypto.randomUUID()}.json`);
  fs.writeFileSync(backup, JSON.stringify(workflow, null, 2) + '\n', { flag: 'wx' });
  await request(`/workflows/${WORKFLOW_ID}`, plan.payload);
  const saved = await request(`/workflows/${WORKFLOW_ID}`);
  if (hash(saved.nodes) !== hash(plan.payload.nodes) || hash(saved.connections) !== hash(workflow.connections)) {
    throw new Error('Saved workflow differs from the intended patch; inspect the preserved backup before further writes.');
  }
  return { mode: 'applied', ...plan.summary, backup,
    active_version_contains_patch: saved.activeVersion?.nodes ? hash(saved.activeVersion.nodes) === hash(plan.payload.nodes) : null };
}
if (require.main === module) run().then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { run };
