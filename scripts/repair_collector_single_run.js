const fs = require('node:fs');
const {hash} = require('./lib/btc_rate_limit_repair');
const {COLLECTORS, planCollectorSingleRunRepair} = require('./lib/collector_single_run_repair');
async function run() {
  const [asset, mode] = process.argv.slice(2);
  if (!COLLECTORS[asset] || (mode && mode !== '--apply') || process.argv.length > 4) throw Error('Usage: node scripts/repair_collector_single_run.js usd|eur|gold|nq|btc [--apply]');
  if (!process.env.N8N_BASE_URL || !process.env.N8N_API_KEY) throw Error('Use the scoped credential runner.');
  const base = new URL(process.env.N8N_BASE_URL);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw Error('Expected plain HTTPS base URL.');
  const api = async (payload) => {
    const r = await fetch(base.href.replace(/\/$/, '')+'/api/v1/workflows/'+COLLECTORS[asset], {
      method: payload ? 'PUT' : 'GET', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: {'X-N8N-API-KEY': process.env.N8N_API_KEY, 'content-type': 'application/json'},
      ...(payload ? {body: JSON.stringify(payload)} : {})});
    if (!r.ok) throw Error('n8n API HTTP '+r.status+'; response omitted.');
    return r.json();
  };
  const workflow = await api();
  const plan = planCollectorSingleRunRepair(workflow);
  if (mode !== '--apply' || plan.summary.alreadyApplied) return {mode: 'read-only', ...plan.summary};
  if (hash(await api()) !== hash(workflow)) throw Error('Concurrent workflow change; refusing update.');
  fs.mkdirSync('tmp/n8n-backups', {recursive: true});
  const backup = `tmp/n8n-backups/${asset}-single-run-${Date.now()}.json`;
  fs.writeFileSync(backup, JSON.stringify(workflow, null, 2), {flag: 'wx'});
  await api(plan.payload);
  const saved = await api();
  for (const version of [saved, saved.activeVersion]) {
    if (!version || hash(version.nodes) !== hash(plan.payload.nodes) || hash(version.connections) !== hash(plan.payload.connections)) {
      throw Error('Saved/active verification failed; inspect backup before further changes.');
    }
  }
  return {mode: 'applied', ...plan.summary, backup, activeVerified: true};
}
if (require.main === module) run().then(r => console.log(JSON.stringify(r))).catch(e => {console.error(e.message); process.exitCode=1;});
