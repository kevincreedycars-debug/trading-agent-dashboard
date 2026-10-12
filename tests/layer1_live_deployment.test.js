const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {PUBLISHING_MODELS, VOLATILE_NODE_KEYS, assertPayloadCoversWorkflow, assertPublishedCopyMatchesPayload,
  compareNodeLists, deploymentPreflight, detectPublishingModel, executingVersionOf, verifyExecutingVersion,
  verifySavedWorkflow} = require('../scripts/lib/layer1_live_deployment');
const {ENGINE_BY_EXPORT_FILE, LAYER1_ENGINES, planLayer1NullConversionRepair} =
  require('../scripts/lib/layer1_null_conversion_repair');
const {createLiveClient, live, run} = require('../scripts/repair_layer1_null_conversion');

// The recorded read-only GET of the live USD agent: 9 nodes, one version id for draft and executing copy.
const LIVE_USD = path.resolve('docs/review/usd-24h-ruleset-v1/live-exports/USD_Layer_1_Agent.json');
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const liveUsd = read(LIVE_USD);
const plan = planLayer1NullConversionRepair(liveUsd);
const payload = plan.payload;
const before = executingVersionOf(liveUsd, 'draft_published');

const savedAs = (workflow, nodes, connections = workflow.connections) =>
  ({...workflow, nodes, connections});
const publishedAt = (workflow, versionId, nodes = payload.nodes) =>
  ({...workflow, versionId, activeVersionId: versionId, versionCounter: workflow.versionCounter + 1,
    activeVersion: {...workflow.activeVersion, versionId, nodes, connections: payload.connections}});
const draftAt = (workflow, versionId, nodes = payload.nodes) =>
  ({...workflow, versionId, nodes, connections: payload.connections});

test('the recorded USD response is measured as draft_published and names the version it executes', () => {
  const detected = detectPublishingModel(liveUsd);
  assert.equal(detected.model, 'draft_published');
  assert.deepEqual(Object.keys(detected.evidence), ['has_active_version_object', 'has_active_version_id',
    'draft_version_id', 'active_version_id', 'version_counter', 'publish_history_entries', 'published_copy_nodes']);
  assert.equal(detected.evidence.active_version_id, 'aa275379-ea06-452c-97c9-238b41aed7bc');
  assert.equal(detected.evidence.published_copy_nodes, 9);
  assert.equal(detected.evidence.publish_history_entries, 1);
  assert.equal(before.executing_version_id, detected.evidence.active_version_id);
  assert.equal(before.version_counter, 154);
  assert.equal(before.active, true);
  assert.match(before.nodes_sha256, /^[0-9a-f]{64}$/);

  const single = detectPublishingModel({nodes: liveUsd.nodes, connections: liveUsd.connections, versionId: 'v1'});
  assert.equal(single.model, 'single_version');
  assert.equal(single.evidence.has_active_version_object, false);
  assert.equal(single.evidence.published_copy_nodes, null);
  assert.equal(executingVersionOf({nodes: liveUsd.nodes, versionId: 'v1'}, 'single_version').executing_version_id, 'v1');
  assert.deepEqual(PUBLISHING_MODELS, ['draft_published', 'single_version']);
});

test('the live USD plan is preflighted before any write and refuses a guessed publishing model', () => {
  const report = deploymentPreflight({engine: 'usd', workflow: liveUsd, plan, expectedPublishing: 'draft_published'});
  assert.equal(report.nodes_in_workflow, 9);
  assert.equal(report.nodes_in_payload, 9);
  assert.equal(report.non_code_nodes_in_payload, 5);
  assert.equal(report.connections_preserved, true);
  assert.equal(report.already_applied, false);
  assert.deepEqual(report.intended_code_changes, ['Calculate USD Conviction']);
  assert.equal(report.executing_version.executing_version_id, 'aa275379-ea06-452c-97c9-238b41aed7bc');
  assert.throws(() => deploymentPreflight({engine: 'usd', workflow: liveUsd, plan, expectedPublishing: 'single_version'}),
    /the instance is draft_published but the run expected single_version/);
  assert.throws(() => deploymentPreflight({engine: 'usd', workflow: liveUsd, plan, expectedPublishing: 'guess'}),
    /Unknown expected publishing model "guess"/);
  assert.throws(() => deploymentPreflight({engine: 'usd', workflow: liveUsd, plan: {summary: {repaired: []}}}),
    /has no deployment payload/);
});

test('a payload built from the changed code nodes alone is refused before the write', () => {
  const codeNodes = payload.nodes.filter(node => typeof node.parameters?.jsCode === 'string');
  assert.equal(codeNodes.length, 4, 'the USD agent has 4 code nodes');
  const incident = {nodes: codeNodes, connections: payload.connections};
  const sentNames = new Set(codeNodes.map(node => node.name));
  const orphaned = Object.values(payload.connections)
    .flatMap(groups => groups.main.flat()).map(target => target.node).filter(name => !sentNames.has(name));
  assert.ok(orphaned.length > 0, 'the recorded defect left connections pointing at absent nodes');
  for (const target of orphaned.slice(0, 3)) {
    assert.ok(!sentNames.has(target), `${target} is referenced but was not sent`);
  }
  assert.throws(() => assertPayloadCoversWorkflow(liveUsd, incident), /carries 4 of 9 nodes/);
  assert.throws(() => assertPayloadCoversWorkflow(liveUsd, incident), /replaces the whole body, so every node and the whole connection map must be sent/);
  assert.throws(() => deploymentPreflight({engine: 'usd', workflow: liveUsd,
    plan: {...plan, payload: incident, payload_code_changes: ['Calculate USD Conviction']}}), /carries 4 of 9 nodes/);

  // Nine entries are not enough on their own: a duplicated node and a shifted one are both caught.
  const duplicated = [...payload.nodes.slice(0, 8), payload.nodes[0]];
  assert.throws(() => assertPayloadCoversWorkflow(liveUsd, savedAs(payload, duplicated)), /appears twice/);
  const extraCopy = {nodes: [...payload.nodes, payload.nodes[8]], connections: payload.connections};
  assert.throws(() => assertPayloadCoversWorkflow(liveUsd, extraCopy), /carries 10 of 9 nodes/);
  const noConnections = {nodes: payload.nodes, connections: {}};
  assert.throws(() => assertPayloadCoversWorkflow(liveUsd, noConnections), /does not keep the workflow connections/);
});

test('a saved workflow that lost, reordered or altered a node is refused', () => {
  const verified = verifySavedWorkflow(payload, payload);
  assert.equal(verified.verified, true);
  assert.equal(verified.nodes_verified, 9);
  assert.equal(verified.code_nodes_verified, 4);
  assert.equal(verified.connections_preserved, true);
  assert.deepEqual(verified.volatile_keys_ignored, []);

  assert.throws(() => verifySavedWorkflow(payload, savedAs(payload, payload.nodes.slice(0, 8))),
    /carries 8 nodes instead of 9/);
  const swapped = [payload.nodes[1], payload.nodes[0], ...payload.nodes.slice(2)];
  assert.throws(() => verifySavedWorkflow(payload, savedAs(payload, swapped)), /instead of/);
  const retyped = payload.nodes.map((node, index) => index === 2 ? {...node, type: 'n8n-nodes-base.httpRequest'} : node);
  assert.throws(() => verifySavedWorkflow(payload, savedAs(payload, retyped)), /instead of/);
  const retabled = payload.nodes.map((node, index) => index === 2
    ? {...node, parameters: {...node.parameters, tableId: 'agent_inputs_backup'}} : node);
  assert.throws(() => verifySavedWorkflow(payload, savedAs(payload, retabled)),
    /changed outside the intended edit|changed the node order/);
  assert.throws(() => verifySavedWorkflow(payload, savedAs(payload, payload.nodes.slice().reverse())), /instead of/);

  // A key the API adds back on its own is recorded, not treated as a failed update.
  const withWebhook = payload.nodes.map((node, index) => index === 0 ? {...node, webhookId: 'abc-123'} : node);
  const tolerated = verifySavedWorkflow(payload, savedAs(payload, withWebhook));
  assert.equal(tolerated.verified, true);
  assert.deepEqual(tolerated.volatile_keys_ignored, [`${payload.nodes[0].name} (${payload.nodes[0].id}).webhookId`]);
  assert.deepEqual(VOLATILE_NODE_KEYS, ['webhookId']);

  const comparison = compareNodeLists(payload.nodes, payload.nodes.map(node => ({...node, webhookId: 'x'})), 'The saved workflow');
  assert.equal(comparison.equal, true);
  assert.equal(comparison.volatile_keys_ignored.length, 9);

  // Nodes without ids (the older gbp draft) still compare by order, name and content.
  const idless = {nodes: payload.nodes.map(({id, ...rest}) => rest), connections: payload.connections};
  assert.equal(assertPayloadCoversWorkflow(idless, {...idless, nodes: idless.nodes.slice()}).node_order_preserved, true);
  assert.equal(verifySavedWorkflow({nodes: idless.nodes, connections: payload.connections}, idless).verified, true);
});

test('an update only counts as applied when the version the instance executes moved', () => {
  const applied = verifyExecutingVersion({before, afterWorkflow: publishedAt(liveUsd, 'bb-new'), payload,
    expectedPublishingModel: 'draft_published'});
  assert.equal(applied.status, 'applied_and_published');
  assert.equal(applied.executing_version_changed, true);
  assert.equal(applied.draft_version_changed, true);
  assert.equal(applied.published_copy_verified, true);
  assert.equal(applied.requires_publish, false);
  assert.equal(applied.executing_version_before, before.executing_version_id);
  assert.equal(applied.executing_version_after, 'bb-new');
  assert.equal(applied.version_counter_after, 155);

  // The draft moved, the executing version did not: the old published copy is deliberately not compared,
  // because it still holds the previous nodes.
  const draftOnly = verifyExecutingVersion({before, afterWorkflow: draftAt(liveUsd, 'cc-new'), payload});
  assert.equal(draftOnly.status, 'draft_only_requires_publish');
  assert.equal(draftOnly.executing_version_changed, false);
  assert.equal(draftOnly.draft_version_changed, true);
  assert.equal(draftOnly.draft_copy_verified, true);
  assert.equal(draftOnly.published_copy_verified, false);
  assert.equal(draftOnly.requires_publish, true);

  const untouched = verifyExecutingVersion({before, afterWorkflow: liveUsd, payload});
  assert.equal(untouched.status, 'unchanged');
  assert.equal(untouched.requires_publish, true);
  assert.equal(untouched.draft_copy_verified, false);

  // A publish that lost a node is still a failed update, so the caller can roll back.
  const lostOne = {...publishedAt(liveUsd, 'dd-new'), activeVersion: {...liveUsd.activeVersion,
    nodes: payload.nodes.slice(0, 8), connections: payload.connections}};
  assert.throws(() => verifyExecutingVersion({before, afterWorkflow: lostOne, payload}),
    /The executing version of the workflow does not match the payload/);
  assert.throws(() => assertPublishedCopyMatchesPayload({...liveUsd, activeVersion: undefined}, payload, 'draft_published'),
    /did not return the copy of the executing version/);
  assert.throws(() => verifyExecutingVersion({before, afterWorkflow: liveUsd, payload,
    expectedPublishingModel: 'single_version'}), /is draft_published but the run expected single_version/);
  assert.throws(() => verifyExecutingVersion({before, afterWorkflow: liveUsd, payload,
    expectedPublishingModel: 'guessed'}), /Unknown expected publishing model/);

  // One-object instance: the version id is the update, and the workflow itself is the executing copy.
  const single = {...liveUsd, versionId: 'sv-1'};
  delete single.activeVersion;
  delete single.activeVersionId;
  const singleBefore = executingVersionOf(single, 'single_version');
  const singleAfter = {...single, versionId: 'sv-2', nodes: payload.nodes, connections: payload.connections};
  const singleReport = verifyExecutingVersion({before: singleBefore, afterWorkflow: singleAfter, payload,
    expectedPublishingModel: 'single_version'});
  assert.equal(singleReport.status, 'applied_and_published');
  assert.equal(singleReport.published_copy_verified, true);
  assert.equal(singleReport.publishing_model, 'single_version');
  assert.throws(() => verifyExecutingVersion({before: singleBefore, afterWorkflow: single, payload}),
    /version did not change; the instance may have rejected the update/);
});

test('every layer 1 export plans a payload that covers its own workflow, gbp draft included', () => {
  const engines = Object.entries(ENGINE_BY_EXPORT_FILE);
  assert.ok(engines.length >= 5, 'the repository holds a local export for at least five engines');
  for (const [file, engine] of engines) {
    const workflow = read(path.resolve(LAYER1_ENGINES[engine].exportFile));
    const enginePlan = planLayer1NullConversionRepair(workflow);
    const coverage = assertPayloadCoversWorkflow(workflow, enginePlan.payload);
    assert.equal(coverage.nodes_in_workflow, workflow.nodes.length, `${file} covered`);
    assert.equal(coverage.nodes_in_payload, workflow.nodes.length, `${file} published`);
    assert.equal(coverage.non_code_nodes_in_payload, workflow.nodes.filter(
      node => typeof node.parameters?.jsCode !== 'string').length, `${file} mixed nodes`);
    assert.equal(coverage.connections_preserved, true, `${file} connections`);
    assert.equal(enginePlan.payload_code_changes.length, enginePlan.summary.repaired.length, `${file} changes`);
    const report = deploymentPreflight({engine, workflow, plan: enginePlan});
    assert.ok(PUBLISHING_MODELS.includes(report.publishing_model), `${file} measured model`);
    assert.equal(report.nodes_in_payload, workflow.nodes.length, `${file} preflight`);
    assert.equal(report.workflow_id, workflow.id ?? null);
  }
});


// The live runner is exercised against a mocked draft_published instance: a draft the next write lands
// in, the version the instance executes, and a PUT that can land, land in the draft only, lose a node,
// be rejected or time out. Every read is served from that state, so the assertions are about what the
// runner did to the instance rather than about what an API response claimed.
//
// onWrite 'draft' saves the draft and leaves the executing version alone, 'publish' models an instance
// that publishes on save so both copies move, 'drop_node_draft' and 'drop_node_published' save a body
// with a node missing (the recorded PUT defect), 'no_restore_publish' publishes the failed update but
// leaves the restore as a draft write, which is how the failed code stays in the executing version, and
// the rejected and timed-out variants leave the state untouched or store the body before failing.
function mockedInstance(options = {}) {
  const behaviour = {onWrite: 'draft', onActivate: 'publish', onRead: 'serve', ...options};
  const state = {
    draft: {nodes: liveUsd.nodes, connections: liveUsd.connections, versionId: liveUsd.versionId},
    executing: {nodes: liveUsd.activeVersion.nodes, connections: liveUsd.activeVersion.connections,
      versionId: liveUsd.activeVersionId},
    versionCounter: liveUsd.versionCounter
  };
  const log = {reads: 0, writes: [], activates: 0};
  const view = () => ({
    ...liveUsd,
    nodes: state.draft.nodes,
    connections: state.draft.connections,
    versionId: state.draft.versionId,
    versionCounter: state.versionCounter,
    activeVersionId: state.executing.versionId,
    activeVersion: {...liveUsd.activeVersion, versionId: state.executing.versionId,
      nodes: state.executing.nodes, connections: state.executing.connections}
  });
  const land = (payload, {draft, executing}) => {
    const stored = Array.isArray(payload.nodes) ? payload.nodes : state.draft.nodes;
    state.draft = {nodes: draft && draft.short ? stored.slice(0, -1) : stored,
      connections: payload.connections, versionId: `draft-${log.writes.length}`};
    if (executing) {
      state.executing = {nodes: draft && draft.short ? stored.slice(0, -1) : stored,
        connections: payload.connections, versionId: `exec-write-${log.writes.length}`};
    }
    state.versionCounter += executing ? 2 : 1;
  };
  return {
    log, state, view,
    readWorkflow: async () => {
      log.reads += 1;
      if (behaviour.onRead === 'fail') throw new Error('The GET timed out.');
      if (behaviour.onRead === 'fail_after_write' && log.writes.length) {
        throw new Error('The GET timed out after the write.');
      }
      return view();
    },
    writeWorkflow: async (workflowId, payload) => {
      log.writes.push(payload);
      const attempt = log.writes.length;
      const first = attempt === 1;
      const mode = behaviour.onWrite === 'reject_restore' ? (first ? 'drop_node_published' : 'reject')
        : behaviour.onWrite === 'no_restore_publish' ? (first ? 'drop_node_published' : 'draft')
          : behaviour.onWrite;
      if (mode === 'reject') throw new Error(`n8n API HTTP 400 on PUT /api/v1/workflows/${workflowId}; response omitted.`);
      if (mode === 'timeout_without_landing') throw new Error('The PUT timed out.');
      if (mode === 'draft') land(payload, {executing: false});
      else if (mode === 'publish') land(payload, {executing: true});
      else if (mode === 'drop_node_draft') land(payload, {draft: {short: first}, executing: false});
      else if (mode === 'drop_node_published') land(payload, {draft: {short: first}, executing: true});
      else if (mode === 'timeout_after_landing') {
        land(payload, {executing: true});
        throw new Error('The PUT timed out after the instance stored it.');
      } else throw new Error(`Unknown mocked write behaviour ${mode}.`);
      return view();
    },
    activateWorkflow: async () => {
      log.activates += 1;
      if (behaviour.onActivate === 'fail') throw new Error('The publish call was rejected by the instance.');
      if (behaviour.onActivate !== 'noop') {
        state.executing = {nodes: state.draft.nodes, connections: state.draft.connections,
          versionId: `exec-publish-${log.activates}`};
        state.versionCounter += 1;
      }
      return view();
    }
  };
}
const tempBackups = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'layer1-live-runner-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  return root;
};
const liveRun = (client, engineList, options) => live(engineList, {client, apply: true,
  expectedPublishing: 'draft_published', ...options});


test('the runner verifies the update from a fresh read, not from the PUT response', async (t) => {
  const client = mockedInstance({onWrite: 'publish'});
  const result = await liveRun(client, ['usd'], {backupRoot: tempBackups(t)});
  assert.equal(result.mode, 'applied');
  assert.equal(result.stopped, null);
  assert.equal(result.engines.length, 1);
  const [usd] = result.engines;
  assert.equal(usd.mode, 'applied');
  assert.equal(usd.state_source, 'fresh_get');
  assert.equal(usd.write_status, 'ok');
  assert.equal(usd.nodes_verified, 9);
  assert.equal(usd.execution.status, 'applied_and_published');
  assert.equal(usd.execution.executing_version_changed, true);
  assert.equal(usd.execution.published_copy_verified, true);
  assert.equal(usd.execution.requires_publish, false);
  assert.equal(client.log.writes.length, 1);
  assert.equal(client.log.activates, 0);
  // The plan read, the concurrency read and the read-back the report is based on.
  assert.ok(client.log.reads >= 3, `expected a read-back, saw ${client.log.reads} reads`);
  assert.deepEqual(client.state.draft.nodes, payload.nodes);
  assert.deepEqual(client.state.executing.nodes, payload.nodes);
  assert.deepEqual(client.state.draft.connections, liveUsd.connections);
  // The backup is the workflow as read before the write, so a rollback restores the unrepaired body.
  assert.deepEqual(JSON.parse(fs.readFileSync(usd.backup, 'utf8')).nodes, liveUsd.nodes);
});

test('a draft-only update stops the sequence and the publish is verified by another read', async (t) => {
  const backupRoot = tempBackups(t);
  const draftOnly = mockedInstance();
  const stopped = await liveRun(draftOnly, ['usd', 'gold'], {backupRoot});
  assert.equal(stopped.mode, 'stopped', 'a run that stopped must not report itself as applied');
  assert.equal(stopped.engines.length, 1, 'the next engine must not be touched while the executing version is stale');
  assert.equal(stopped.engines[0].mode, 'draft_only_requires_publish');
  assert.equal(stopped.engines[0].execution.status, 'draft_only_requires_publish');
  assert.equal(stopped.engines[0].execution.draft_copy_verified, true);
  assert.equal(stopped.engines[0].execution.published_copy_verified, false);
  assert.equal(stopped.engines[0].execution.executing_version_changed, false);
  assert.match(stopped.stopped, /draft moved but the executing version did not/);
  assert.equal(draftOnly.log.writes.length, 1);
  assert.equal(draftOnly.log.activates, 0, 'a publish needs --publish');

  const publishing = mockedInstance();
  const published = await liveRun(publishing, ['usd'], {publish: true, backupRoot});
  assert.equal(published.engines[0].mode, 'applied_after_publish');
  assert.equal(published.engines[0].execution.status, 'applied_and_published');
  assert.equal(published.engines[0].execution.published_copy_verified, true);
  assert.equal(published.engines[0].execution.executing_version_changed, true);
  assert.equal(published.engines[0].execution.requires_publish, false);
  assert.equal(publishing.log.activates, 1);
  assert.equal(publishing.log.writes.length, 1);
  assert.ok(publishing.log.reads >= 4, `the executing version is re-read after the publish, saw ${publishing.log.reads}`);
  assert.deepEqual(publishing.state.executing.nodes, payload.nodes);

  const rejectedPublish = mockedInstance({onActivate: 'fail'});
  const failed = await liveRun(rejectedPublish, ['usd'], {publish: true, backupRoot});
  assert.equal(failed.engines[0].mode, 'publish_failed');
  assert.match(failed.engines[0].publish_error, /publish call was rejected/);
  assert.equal(failed.engines[0].rollback_verified, undefined, 'the draft holds the payload, so there is nothing to restore');
  assert.match(failed.stopped, /the publish call for usd failed/);

  const inertPublish = mockedInstance({onActivate: 'noop'});
  const ineffective = await liveRun(inertPublish, ['usd'], {publish: true, backupRoot});
  assert.equal(ineffective.engines[0].mode, 'publish_ineffective');
  assert.equal(ineffective.engines[0].execution.requires_publish, true);
  assert.match(ineffective.stopped, /still did not move after the publish call/);
});

test('a failed update is rolled back and the rollback is verified on the executing copy', async (t) => {
  const backupRoot = tempBackups(t);
  // The instance published the update with a node missing, and its save-time publish does not fire for
  // the rollback body: the draft goes back to the backup while the executing version keeps the short one.
  const publishedShort = mockedInstance({onWrite: 'no_restore_publish'});
  const result = await liveRun(publishedShort, ['usd', 'gold'], {backupRoot});
  assert.equal(result.mode, 'stopped', 'a rolled-back run reports itself as stopped, not applied');
  assert.equal(result.engines.length, 1);
  const [usd] = result.engines;
  assert.equal(usd.mode, 'rolled_back');
  assert.match(usd.error, /carries 8 nodes instead of 9/);
  assert.equal(usd.restore_written, true);
  assert.equal(usd.draft_verified, true, 'the draft is back at the backup');
  assert.equal(usd.executing_copy_verified, false);
  assert.equal(usd.executing_version_matches_backup, false);
  assert.equal(usd.rollback_verified, false, 'a rollback is not verified while the executing version runs the failed code');
  assert.equal(usd.rollback_requires_publish, true);
  assert.ok(usd.rollback_problems.some(problem => /writing the draft does not restore the version the instance executes/.test(problem)));
  assert.ok(usd.rollback_problems.some(problem => /does not match the payload/.test(problem)));
  assert.match(result.stopped, /the state was read, the backup was restored/);
  assert.equal(publishedShort.log.writes.length, 2, 'the update and the restore');
  assert.deepEqual(publishedShort.state.draft.nodes, liveUsd.nodes);
  assert.deepEqual(JSON.parse(fs.readFileSync(usd.backup, 'utf8')).nodes, liveUsd.nodes);
  assert.equal(publishedShort.state.executing.nodes.length, 8, 'the mocked instance still executes the short version');

  // The same loss in the draft only: the restore is verified on both copies.
  const draftShort = mockedInstance({onWrite: 'drop_node_draft'});
  const recovered = await liveRun(draftShort, ['usd'], {backupRoot});
  assert.equal(recovered.engines[0].mode, 'rolled_back');
  assert.equal(recovered.engines[0].draft_verified, true);
  assert.equal(recovered.engines[0].executing_copy_verified, true);
  assert.equal(recovered.engines[0].executing_version_matches_backup, true);
  assert.equal(recovered.engines[0].rollback_verified, true);
  assert.equal(recovered.engines[0].rollback_requires_publish, false);
  assert.deepEqual(recovered.engines[0].rollback_problems, []);
  assert.deepEqual(draftShort.state.draft.nodes, liveUsd.nodes);

  // The restore write itself is rejected: the runner reports an unverified rollback instead of recovery.
  const stuck = mockedInstance({onWrite: 'reject_restore'});
  const unrestored = await liveRun(stuck, ['usd'], {backupRoot});
  assert.equal(unrestored.engines[0].mode, 'rolled_back');
  assert.equal(unrestored.engines[0].restore_written, false);
  assert.equal(unrestored.engines[0].draft_verified, false);
  assert.equal(unrestored.engines[0].rollback_verified, false);
  assert.ok(unrestored.engines[0].rollback_problems.some(problem => /restore write failed/.test(problem)));
  assert.equal(stuck.log.writes.length, 2);
});

test('a rejected or timed-out write is decided by a read, never by the error', async (t) => {
  const backupRoot = tempBackups(t);
  // Nothing landed: the read shows the workflow as the backup, so no restore write is needed.
  const rejected = mockedInstance({onWrite: 'reject'});
  const result = await liveRun(rejected, ['usd', 'gold'], {backupRoot});
  assert.equal(result.mode, 'stopped');
  assert.equal(result.engines.length, 1);
  assert.equal(result.engines[0].mode, 'rejected_by_instance');
  assert.equal(result.engines[0].state_source, 'fresh_get');
  assert.equal(result.engines[0].write_status, 'failed');
  assert.match(result.engines[0].write_error, /HTTP 400 on PUT/);
  assert.equal(result.engines[0].restore_written, false);
  assert.equal(result.engines[0].rollback_verified, true);
  assert.match(result.stopped, /rejected and left the workflow as it was/);
  assert.equal(rejected.log.writes.length, 1);
  assert.ok(rejected.log.reads >= 3, 'the state is read after the failed write');

  // The same failure, but the write landed: the read is what reports the update as applied.
  const landed = mockedInstance({onWrite: 'timeout_after_landing'});
  const applied = await liveRun(landed, ['usd'], {backupRoot});
  assert.equal(applied.mode, 'applied', 'the read showed the update landed, so the run completed');
  assert.equal(applied.engines[0].mode, 'applied_after_failed_write');
  assert.equal(applied.engines[0].write_status, 'failed');
  assert.match(applied.engines[0].write_error, /timed out/);
  assert.equal(applied.engines[0].execution.status, 'applied_and_published');
  assert.equal(applied.engines[0].execution.published_copy_verified, true);
  assert.equal(landed.log.writes.length, 1, 'the state the read showed is the payload, so nothing is restored');

  const nothingLanded = mockedInstance({onWrite: 'timeout_without_landing'});
  const rejectedOnly = await liveRun(nothingLanded, ['usd'], {backupRoot});
  assert.equal(rejectedOnly.engines[0].mode, 'rejected_by_instance');
  assert.equal(rejectedOnly.engines[0].restore_written, false);
  assert.equal(nothingLanded.state.draft.versionId, liveUsd.versionId);

  // No read, no verification: the runner restores the backup and says the rollback is unverified.
  const blind = mockedInstance({onWrite: 'publish', onRead: 'fail_after_write'});
  const unverified = await liveRun(blind, ['usd'], {backupRoot});
  assert.equal(unverified.engines.length, 1);
  assert.equal(unverified.engines[0].mode, 'rolled_back');
  assert.equal(unverified.engines[0].state_source, 'unverified', 'no read means no verdict about the instance');
  assert.match(unverified.engines[0].error, /GET timed out after the write/);
  assert.match(unverified.engines[0].rollback_reason, /could not be read back after the write/);
  assert.equal(unverified.engines[0].rollback_verified, false);
  assert.equal(unverified.engines[0].draft_verified, false);
  assert.ok(unverified.engines[0].rollback_problems.some(problem => /could not be read back after the restore/.test(problem)));
  assert.match(unverified.stopped, /could not be read back after the write/);
  assert.equal(blind.log.writes.length, 2, 'the update and the restore attempt');
});

test('the live runner needs credentials, a USD-first sequence and a measured publishing model', async (t) => {
  const env = {N8N_BASE_URL: 'https://example.invalid', N8N_API_KEY: 'synthetic-only'};
  await assert.rejects(run(['--live', 'usd', '--apply', '--expect-publishing', 'draft_published'], {}),
    /Use the scoped credential runner/);
  await assert.rejects(run(['--live', 'usd', '--apply'], env), /--apply needs --expect-publishing/);
  await assert.rejects(run(['--live', 'usd', '--apply', '--expect-publishing', 'guess'], env),
    /--apply needs --expect-publishing/);
  await assert.rejects(run(['--live', 'usd', '--publish'], env), /--publish belongs to an --apply run/);
  await assert.rejects(run(['--live', 'gold,usd', '--apply', '--expect-publishing', 'draft_published'], env),
    /must start with USD/);
  await assert.rejects(run(['--wat']), /Unknown flag/);

  const client = mockedInstance();
  const preflight = await run(['--live', 'usd'], env, client);
  assert.equal(preflight.mode, 'read-only');
  assert.equal(preflight.engines[0].mode, 'read-only');
  assert.deepEqual(preflight.engines[0].repaired, ['Calculate USD Conviction']);
  assert.equal(client.log.writes.length, 0, 'a read-only run never writes');
  assert.equal(client.log.activates, 0);

  const offline = await run(['--engines', 'usd']);
  assert.equal(offline.mode, 'read-only');
  assert.equal(offline.engines[0].mode, 'read-only');
  assert.equal(offline.engines[0].textUnchanged, true);
  assert.equal(offline.engines[0].rewrittenFiles, 0);

  assert.throws(() => createLiveClient({baseUrl: 'http://example.invalid', apiKey: 'synthetic-only'}),
    /Expected plain HTTPS base URL/);
  const seen = [];
  const http = createLiveClient({baseUrl: 'https://example.invalid/', apiKey: 'synthetic-only',
    fetchImpl: async (url, init) => {
      seen.push([init.method, url]);
      return {ok: false, status: 400, json: async () => ({secret: 'must not be read'})};
    }});
  await assert.rejects(http.writeWorkflow('w-1', {nodes: []}),
    /n8n API HTTP 400 on PUT \/api\/v1\/workflows\/w-1; response omitted/);
  assert.deepEqual(seen, [['PUT', 'https://example.invalid/api/v1/workflows/w-1']]);
  const activating = createLiveClient({baseUrl: 'https://example.invalid', apiKey: 'synthetic-only',
    fetchImpl: async () => ({ok: true, status: 204})});
  assert.equal(await activating.activateWorkflow('w-1'), null);
});



