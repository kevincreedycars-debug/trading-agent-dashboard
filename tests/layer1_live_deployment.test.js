const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {PUBLISHING_MODELS, VOLATILE_NODE_KEYS, assertPayloadCoversWorkflow, assertPublishedCopyMatchesPayload,
  compareNodeLists, deploymentPreflight, detectPublishingModel, executingVersionOf, verifyExecutingVersion,
  verifySavedWorkflow} = require('../scripts/lib/layer1_live_deployment');
const {ENGINE_BY_EXPORT_FILE, LAYER1_ENGINES, planLayer1NullConversionRepair} =
  require('../scripts/lib/layer1_null_conversion_repair');

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
