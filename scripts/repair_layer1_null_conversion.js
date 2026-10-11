const fs = require('node:fs');
const path = require('node:path');
const {hash} = require('./lib/btc_rate_limit_repair');
const {LAYER1_ENGINES, repairExportFileText, planLayer1NullConversionRepair} = require('./lib/layer1_null_conversion_repair');

// Offline mode repairs the repository exports only. Live mode is a separate, explicitly authorised
// operation and needs the scoped credential runner (N8N_BASE_URL + N8N_API_KEY).
function offline(engineList, apply) {
  const engines = engineList.length ? engineList : Object.keys(LAYER1_ENGINES).filter(k => LAYER1_ENGINES[k].exportFile);
  const report = [];
  for (const engine of engines) {
    const entry = LAYER1_ENGINES[engine];
    if (!entry) throw Error(`Unknown engine "${engine}".`);
    if (!entry.exportFile) { report.push({engine, status: 'no_repository_export', workflowId: entry.workflowId}); continue; }
    const file = path.resolve(entry.exportFile);
    const text = fs.readFileSync(file, 'utf8');
    const plan = planLayer1NullConversionRepair(JSON.parse(text));
    const repaired = repairExportFileText(text);
    if (apply && repaired.applied.length) fs.writeFileSync(file, repaired.text, 'utf8');
    report.push({engine, file: entry.exportFile, mode: apply ? 'applied' : 'read-only', ...repaired.summary,
      textUnchanged: repaired.text === text, bytesAdded: repaired.text.length - text.length,
      rewrittenFiles: apply && repaired.applied.length ? 1 : 0});
  }
  return {mode: apply ? 'applied' : 'read-only', engines: report};
}

async function live(engine, apply) {
  const entry = LAYER1_ENGINES[engine];
  if (!entry) throw Error(`Unknown engine "${engine}".`);
  if (!process.env.N8N_BASE_URL || !process.env.N8N_API_KEY) throw Error('Use the scoped credential runner.');
  const base = new URL(process.env.N8N_BASE_URL);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw Error('Expected plain HTTPS base URL.');
  const api = async (payload) => {
    const r = await fetch(base.href.replace(/\/$/, '') + '/api/v1/workflows/' + entry.workflowId, {
      method: payload ? 'PUT' : 'GET', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: {'X-N8N-API-KEY': process.env.N8N_API_KEY, 'content-type': 'application/json'},
      ...(payload ? {body: JSON.stringify(payload)} : {})});
    if (!r.ok) throw Error('n8n API HTTP ' + r.status + '; response omitted.');
    return r.json();
  };
  const workflow = await api();
  const plan = planLayer1NullConversionRepair(workflow);
  if (!apply || plan.summary.alreadyApplied) return {engine, mode: 'read-only', ...plan.summary};
  if (hash(await api()) !== hash(workflow)) throw Error('Concurrent workflow change; refusing update.');
  fs.mkdirSync('tmp/n8n-backups', {recursive: true});
  const backup = `tmp/n8n-backups/${engine}-layer1-null-conversion-${Date.now()}.json`;
  fs.writeFileSync(backup, JSON.stringify(workflow, null, 2), {flag: 'wx'});
  await api(plan.payload);
  const saved = await api();
  for (const version of [saved, saved.activeVersion]) {
    if (!version || hash(version.nodes) !== hash(plan.payload.nodes) || hash(version.connections) !== hash(plan.payload.connections)) {
      throw Error('Saved/active verification failed; inspect backup before further changes.');
    }
  }
  return {engine, mode: 'applied', ...plan.summary, backup, activeVerified: true};
}

async function run() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const liveIdx = args.indexOf('--live');
  const enginesIdx = args.indexOf('--engines');
  const engines = enginesIdx >= 0 ? String(args[enginesIdx + 1] || '').split(',').filter(Boolean) : [];
  if (liveIdx >= 0) {
    if (!args[liveIdx + 1] || args.length > (apply ? 4 : 3)) throw Error('Usage: node scripts/repair_layer1_null_conversion.js --live usd|eur|gbp|gold|nq|btc|silver|wti [--apply]');
    return live(args[liveIdx + 1], apply);
  }
  if (args.length > (apply ? 3 : 2) || args.some(a => a !== '--apply' && a !== '--engines' && a !== String(args[enginesIdx + 1]))) {
    throw Error('Usage: node scripts/repair_layer1_null_conversion.js [--apply] [--engines usd,eur,gold,nq,btc,gbp]');
  }
  return offline(engines, apply);
}

if (require.main === module) run().then(r => console.log(JSON.stringify(r, null, 2))).catch(e => {console.error(e.message); process.exitCode = 1;});
