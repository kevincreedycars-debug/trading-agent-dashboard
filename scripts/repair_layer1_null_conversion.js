const fs = require('node:fs');
const path = require('node:path');
const {hash} = require('./lib/btc_rate_limit_repair');
const {LAYER1_ENGINES, repairExportFileText, planLayer1NullConversionRepair} = require('./lib/layer1_null_conversion_repair');
const {PUBLISHING_MODELS, deploymentPreflight, executingVersionOf, verifyExecutingVersion, verifySavedWorkflow} = require('./lib/layer1_live_deployment');

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

// A workflow update replaces the whole workflow body, so the live path sends the complete payload
// planned from the workflow the instance currently holds. Every guard that can run before the write
// runs before it; a verification failure after the write restores the backup instead of leaving the
// instance half-updated.
function backupPath(engine) {
  fs.mkdirSync('tmp/n8n-backups', {recursive: true});
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `tmp/n8n-backups/${engine}-layer1-null-conversion-${stamp}.json`;
}

function workflowBody(workflow) {
  return {name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings: workflow.settings || {}};
}

async function live(engineList, {apply, publish, expectedPublishing}) {
  if (engineList.length > 1 && engineList[0] !== 'usd') {
    throw Error('A live sequence must start with USD: its executing version is verified before GOLD and NQ are touched.');
  }
  if (apply && !PUBLISHING_MODELS.includes(expectedPublishing)) {
    throw Error(`--apply needs --expect-publishing ${PUBLISHING_MODELS.join('|')}, measured by a read-only preflight run.`);
  }
  if (publish && !apply) throw Error('--publish belongs to an --apply run.');
  if (!process.env.N8N_BASE_URL || !process.env.N8N_API_KEY) throw Error('Use the scoped credential runner.');
  if (engineList.some(engine => !LAYER1_ENGINES[engine])) {
    throw Error(`Unknown engine: ${engineList.filter(engine => !LAYER1_ENGINES[engine]).join(', ')}.`);
  }
  const base = new URL(process.env.N8N_BASE_URL);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw Error('Expected plain HTTPS base URL.');
  const call = async (pathname, {method = 'GET', body} = {}) => {
    const r = await fetch(base.href.replace(/\/$/, '') + pathname, {
      method, redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: {'X-N8N-API-KEY': process.env.N8N_API_KEY, 'content-type': 'application/json'},
      ...(body ? {body: JSON.stringify(body)} : {})});
    if (!r.ok) throw Error(`n8n API HTTP ${r.status} on ${method} ${pathname}; response omitted.`);
    return r.status === 204 ? null : r.json();
  };
  const readWorkflow = (id) => call('/api/v1/workflows/' + id);
  const writeWorkflow = (id, payload) => call('/api/v1/workflows/' + id, {method: 'PUT', body: payload});
  const restore = async (workflowId, backup, reason) => {
    const saved = JSON.parse(fs.readFileSync(backup, 'utf8'));
    const body = workflowBody(saved);
    await writeWorkflow(workflowId, body);
    const verified = verifySavedWorkflow(body, await readWorkflow(workflowId), {label: 'The restored workflow'});
    return {rolled_back: true, rollback_reason: reason, rollback_verified: verified.verified, backup};
  };

  const results = [];
  let stopped = null;
  for (const engine of engineList) {
    const entry = LAYER1_ENGINES[engine];
    const workflow = await readWorkflow(entry.workflowId);
    const plan = planLayer1NullConversionRepair(workflow);
    const preflight = deploymentPreflight({engine, workflow, plan, expectedPublishing});
    if (!apply) { results.push({mode: 'read-only', ...preflight, repaired: plan.summary.repaired}); continue; }
    if (plan.summary.alreadyApplied) { results.push({mode: 'already_applied', ...preflight}); continue; }
    if (hash(await readWorkflow(entry.workflowId)) !== hash(workflow)) throw Error('Concurrent workflow change; refusing update.');
    const backup = backupPath(engine);
    fs.writeFileSync(backup, JSON.stringify(workflow, null, 2), {flag: 'wx'});
    const before = executingVersionOf(workflow);
    let saved;
    try {
      saved = await writeWorkflow(entry.workflowId, plan.payload);
    } catch (error) {
      results.push({engine, mode: 'rejected_by_instance', error: error.message, ...await restore(entry.workflowId, backup, `the instance rejected the update: ${error.message}`)});
      stopped = `the ${engine} update was rejected; no further engine was touched`;
      break;
    }
    let execution;
    try {
      const savedVerification = verifySavedWorkflow(plan.payload, saved, {label: `The saved ${engine} workflow`});
      execution = verifyExecutingVersion({before, afterWorkflow: saved, payload: plan.payload, expectedPublishingModel: expectedPublishing});
      results.push({engine, mode: 'applied', backup, nodes_verified: savedVerification.nodes_verified, ...preflight, execution});
    } catch (error) {
      const rollback = await restore(entry.workflowId, backup, `verification failed: ${error.message}`);
      results.push({engine, mode: 'rolled_back', error: error.message, ...rollback});
      stopped = `the ${engine} update did not verify; the backup was restored and no further engine was touched`;
      break;
    }
    if (execution.requires_publish) {
      if (!publish) {
        results[results.length - 1].mode = 'draft_only_requires_publish';
        stopped = `the ${engine} draft moved but the executing version did not; publish it and re-verify before touching the next engine`;
        break;
      }
      await call('/api/v1/workflows/' + entry.workflowId + '/activate', {method: 'POST'});
      const published = verifyExecutingVersion({before, afterWorkflow: await readWorkflow(entry.workflowId), payload: plan.payload, expectedPublishingModel: expectedPublishing});
      if (published.requires_publish) {
        stopped = `the ${engine} executing version still did not move after the publish call; check the publishing behaviour before the next engine`;
        break;
      }
      results[results.length - 1].mode = 'applied_after_publish';
      results[results.length - 1].execution = published;
    }
  }
  return {mode: apply ? 'applied' : 'read-only', publishing_model_expected: expectedPublishing || null, engines: results, stopped};
}

async function run() {
  const args = process.argv.slice(2);
  const known = new Set(['--apply', '--publish', '--live', '--expect-publishing', '--engines']);
  const unknown = args.filter(value => value.startsWith('--') && !known.has(value));
  if (unknown.length) throw Error(`Unknown flag(s): ${unknown.join(', ')}.`);
  const valueOf = (flag) => {
    const at = args.indexOf(flag);
    return at >= 0 ? args[at + 1] : undefined;
  };
  const apply = args.includes('--apply');
  const publish = args.includes('--publish');
  const enginesIdx = args.indexOf('--engines');
  const engines = enginesIdx >= 0 ? String(args[enginesIdx + 1] || '').split(',').filter(Boolean) : [];
  if (args.includes('--live')) {
    const engineList = String(valueOf('--live') || '').split(',').filter(Boolean);
    if (!engineList.length || engineList.some(engine => engine.startsWith('--'))) {
      throw Error('Usage: node scripts/repair_layer1_null_conversion.js --live usd[,gold,nq] [--apply --expect-publishing ' +
        PUBLISHING_MODELS.join('|') + '] [--publish]. A read-only run measures the publishing model; --apply requires it.');
    }
    return live(engineList, {apply, publish, expectedPublishing: valueOf('--expect-publishing')});
  }
  if (publish || args.includes('--expect-publishing')) throw Error('--publish and --expect-publishing belong to --live mode.');
  if (args.length > (apply ? 3 : 2) || args.some(a => a !== '--apply' && a !== '--engines' && a !== String(args[enginesIdx + 1]))) {
    throw Error('Usage: node scripts/repair_layer1_null_conversion.js [--apply] [--engines usd,eur,gold,nq,btc,gbp]');
  }
  return offline(engines, apply);
}

if (require.main === module) run().then(r => console.log(JSON.stringify(r, null, 2))).catch(e => {console.error(e.message); process.exitCode = 1;});
