const fs = require('node:fs');
const path = require('node:path');
const {hash} = require('./lib/btc_rate_limit_repair');
const {LAYER1_ENGINES, repairExportFileText, planLayer1NullConversionRepair} = require('./lib/layer1_null_conversion_repair');
const {PUBLISHING_MODELS, deploymentPreflight, detectPublishingModel, draftViewOf, executingVersionOf,
  verifyExecutingVersion, verifyRestoredWorkflow, verifySavedWorkflow} = require('./lib/layer1_live_deployment');

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
//
// Three calls make up the whole live surface, and the read is the one that decides anything. A PUT
// answers with the body it stored, which on a draft_published instance is the draft rather than the
// version the instance executes, and a PUT that is rejected or times out says nothing at all about what
// the instance holds. Every write attempt is therefore followed by a read, verification is done on that
// read, and a write that failed is followed by a read before anything else is written.
function createLiveClient({baseUrl, apiKey, fetchImpl = fetch, timeoutMs = 30000}) {
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
    throw Error('Expected plain HTTPS base URL.');
  }
  const call = async (pathname, {method = 'GET', body} = {}) => {
    const r = await fetchImpl(base.href.replace(/\/$/, '') + pathname, {
      method, redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
      headers: {'X-N8N-API-KEY': apiKey, 'content-type': 'application/json'},
      ...(body ? {body: JSON.stringify(body)} : {})});
    if (!r.ok) throw Error(`n8n API HTTP ${r.status} on ${method} ${pathname}; response omitted.`);
    return r.status === 204 ? null : r.json();
  };
  return {
    readWorkflow: (id) => call('/api/v1/workflows/' + id),
    writeWorkflow: (id, payload) => call('/api/v1/workflows/' + id, {method: 'PUT', body: payload}),
    activateWorkflow: (id) => call('/api/v1/workflows/' + id + '/activate', {method: 'POST'})
  };
}

function backupPath(engine, root = 'tmp/n8n-backups') {
  fs.mkdirSync(root, {recursive: true});
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${root}/${engine}-layer1-null-conversion-${stamp}.json`;
}

function workflowBody(workflow) {
  return {name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings: workflow.settings || {}};
}

async function live(engineList, options = {}) {
  const {apply, publish, expectedPublishing, backupRoot = 'tmp/n8n-backups', client = null,
    environment = process.env} = options;
  if (engineList.length > 1 && engineList[0] !== 'usd') {
    throw Error('A live sequence must start with USD: its executing version is verified before GOLD and NQ are touched.');
  }
  if (apply && !PUBLISHING_MODELS.includes(expectedPublishing)) {
    throw Error(`--apply needs --expect-publishing ${PUBLISHING_MODELS.join('|')}, measured by a read-only preflight run.`);
  }
  if (publish && !apply) throw Error('--publish belongs to an --apply run.');
  if (engineList.some(engine => !LAYER1_ENGINES[engine])) {
    throw Error(`Unknown engine: ${engineList.filter(engine => !LAYER1_ENGINES[engine]).join(', ')}.`);
  }
  let instance = client;
  if (!instance) {
    if (!environment.N8N_BASE_URL || !environment.N8N_API_KEY) throw Error('Use the scoped credential runner.');
    instance = createLiveClient({baseUrl: environment.N8N_BASE_URL, apiKey: environment.N8N_API_KEY});
  }
  const readWorkflow = (id) => instance.readWorkflow(id);
  const writeWorkflow = (id, payload) => instance.writeWorkflow(id, payload);
  // A rollback writes the backup back and then checks what the instance actually holds: the restored
  // draft and the copy the instance executes, both against the backup, because restoring the draft alone
  // can leave the executing version running the failed code. The state is read before the restore writes,
  // since a caller reaches here from a write that may never have moved anything; when the state cannot be
  // read at all the backup is written anyway, because the backup is the state that is wanted.
  const restore = async (workflowId, backupFile, reason, observed = null) => {
    const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    const body = workflowBody(backup);
    let state = observed;
    if (!state) {
      try {
        state = await readWorkflow(workflowId);
      } catch (error) {
        state = null;
      }
    }
    let alreadyBack = false;
    if (state) {
      try {
        alreadyBack = verifySavedWorkflow(body, draftViewOf(state, detectPublishingModel(state).model),
          {label: 'The workflow as read'}).verified;
      } catch (error) {
        alreadyBack = false;
      }
    }
    const problems = [];
    let restoreWritten = false;
    if (!alreadyBack) {
      try {
        await writeWorkflow(workflowId, body);
        restoreWritten = true;
      } catch (error) {
        problems.push(`The restore write failed: ${error.message}`);
      }
    }
    let verification = {rollback_verified: false, draft_verified: false, executing_copy_verified: false,
      executing_version_matches_backup: false, rollback_requires_publish: false, rollback_problems: []};
    try {
      verification = verifyRestoredWorkflow({backup, current: await readWorkflow(workflowId)});
    } catch (error) {
      problems.push(`The workflow could not be read back after the restore: ${error.message}`);
    }
    return {rolled_back: true, rollback_reason: reason, restore_written: restoreWritten, backup: backupFile,
      rollback_verified: verification.rollback_verified, draft_verified: verification.draft_verified,
      executing_copy_verified: verification.executing_copy_verified,
      executing_version_matches_backup: verification.executing_version_matches_backup,
      rollback_requires_publish: verification.rollback_requires_publish,
      rollback_problems: [...problems, ...verification.rollback_problems]};
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
    const backup = backupPath(engine, backupRoot);
    fs.writeFileSync(backup, JSON.stringify(workflow, null, 2), {flag: 'wx'});
    const before = executingVersionOf(workflow);

    let writeStatus = 'ok';
    let writeError = null;
    try {
      await writeWorkflow(entry.workflowId, plan.payload);
    } catch (error) {
      // The response is not evidence: a rejected or timed-out PUT may have landed, landed partly, or not
      // landed at all, so what follows is decided by a read rather than by the error.
      writeStatus = 'failed';
      writeError = error.message;
    }

    let observed;
    try {
      observed = await readWorkflow(entry.workflowId);
    } catch (error) {
      const rollback = await restore(entry.workflowId, backup, `the workflow could not be read back after the write: ${error.message}`);
      results.push({engine, mode: 'rolled_back', write_status: writeStatus, write_error: writeError,
        error: error.message, state_source: 'unverified', ...rollback});
      stopped = `the ${engine} workflow could not be read back after the write; no further engine was touched`;
      break;
    }

    const failUpdate = async (reason) => {
      const rollback = await restore(entry.workflowId, backup, reason, observed);
      const rejected = writeStatus === 'failed' && !rollback.restore_written;
      results.push({engine, mode: rejected ? 'rejected_by_instance' : 'rolled_back', write_status: writeStatus,
        write_error: writeError, error: reason, state_source: 'fresh_get', ...rollback});
      stopped = rejected
        ? `the ${engine} update was rejected and left the workflow as it was; no further engine was touched`
        : `the ${engine} update did not verify; the state was read, the backup was restored and no further engine was touched`;
    };

    const observedModel = detectPublishingModel(observed).model;
    let savedVerification;
    try {
      savedVerification = verifySavedWorkflow(plan.payload, draftViewOf(observed, observedModel),
        {label: `The saved ${engine} workflow`});
    } catch (error) {
      await failUpdate(`the saved workflow did not verify: ${error.message}`);
      break;
    }
    let execution;
    try {
      execution = verifyExecutingVersion({before, afterWorkflow: observed, payload: plan.payload, expectedPublishingModel: expectedPublishing});
    } catch (error) {
      await failUpdate(`verification failed: ${error.message}`);
      break;
    }
    results.push({engine, mode: writeStatus === 'ok' ? 'applied' : 'applied_after_failed_write', backup,
      write_status: writeStatus, write_error: writeError, state_source: 'fresh_get',
      nodes_verified: savedVerification.nodes_verified, ...preflight, execution});
    if (execution.requires_publish) {
      if (!publish) {
        results[results.length - 1].mode = 'draft_only_requires_publish';
        stopped = `the ${engine} draft moved but the executing version did not; publish it and re-verify before touching the next engine`;
        break;
      }
      try {
        await instance.activateWorkflow(entry.workflowId);
      } catch (error) {
        results[results.length - 1].mode = 'publish_failed';
        results[results.length - 1].publish_error = error.message;
        stopped = `the publish call for ${engine} failed; the executing version was not verified and no further engine was touched`;
        break;
      }
      const published = verifyExecutingVersion({before, afterWorkflow: await readWorkflow(entry.workflowId),
        payload: plan.payload, expectedPublishingModel: expectedPublishing});
      if (published.requires_publish) {
        results[results.length - 1].mode = 'publish_ineffective';
        results[results.length - 1].execution = published;
        stopped = `the ${engine} executing version still did not move after the publish call; check the publishing behaviour before the next engine`;
        break;
      }
      results[results.length - 1].mode = 'applied_after_publish';
      results[results.length - 1].execution = published;
    }
  }
  // The run-level mode never reads as a plain success once the sequence stopped: an engine that rolled
  // back or needs a publish leaves `stopped` set, and the report says so rather than claiming "applied".
  return {mode: apply ? (stopped ? 'stopped' : 'applied') : 'read-only',
    publishing_model_expected: expectedPublishing || null, engines: results, stopped};
}

async function run(args = process.argv.slice(2), environment = process.env, client = null) {
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
    return live(engineList, {apply, publish, expectedPublishing: valueOf('--expect-publishing'),
      environment, client});
  }
  if (publish || args.includes('--expect-publishing')) throw Error('--publish and --expect-publishing belong to --live mode.');
  if (args.length > (apply ? 3 : 2) || args.some(a => a !== '--apply' && a !== '--engines' && a !== String(args[enginesIdx + 1]))) {
    throw Error('Usage: node scripts/repair_layer1_null_conversion.js [--apply] [--engines usd,eur,gold,nq,btc,gbp]');
  }
  return offline(engines, apply);
}

if (require.main === module) run().then(r => console.log(JSON.stringify(r, null, 2))).catch(e => {console.error(e.message); process.exitCode = 1;});
module.exports = {backupPath, createLiveClient, live, offline, run, workflowBody};
