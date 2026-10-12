const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {ENGINE_BY_EXPORT_FILE, GUARD_LINES, LAYER1_ENGINES, inspectHelper, planLayer1NullConversionRepair,
  repairExportFileText, repairLayer1Source} = require('../scripts/lib/layer1_null_conversion_repair');
const {assertPayloadCoversWorkflow} = require('../scripts/lib/layer1_live_deployment');

const UNGUARDED = ['function n(v) {', '  const x = Number(v);', '  return Number.isFinite(x) ? x : null;', '}'].join('\n');
const helper = source => new Function(source + '\nreturn n;')();
const legacyHelper = helper(UNGUARDED);
const repairedHelper = helper(repairLayer1Source(UNGUARDED).source);
// Engine exports with a local n(v) helper. gbp is a draft with its own gate node and no helper;
// silver and wti have a live agent but no repository export at all.
const EXPORTS = Object.entries(ENGINE_BY_EXPORT_FILE).filter(([, engine]) => engine !== 'gbp');
const PUBLISHED_COPY = {usd: 'unguarded', gold: 'unguarded', nq: 'unguarded', eur: 'guarded', btc: 'guarded'};

test('an unavailable input stops converting to a finite zero, a real zero and a negative reading still convert', () => {
  assert.equal(legacyHelper(null), 0, 'recorded defect: unavailable input became a finite zero');
  assert.equal(legacyHelper(''), 0);
  for (const unavailable of [null, undefined, '', '   ', 'N/A', 'no data']) {
    assert.equal(repairedHelper(unavailable), null, `${JSON.stringify(unavailable)} must stay unavailable`);
  }
  for (const real of [0, -3, 17.5, '0', '-0.5']) {
    assert.equal(repairedHelper(real), legacyHelper(real), `${real} is real evidence and must keep converting`);
  }
  assert.equal(repairedHelper(0), 0);
  assert.equal(repairedHelper(-3), -3);
});

test('the check is inserted once, ahead of the conversion, and a second pass changes nothing', () => {
  const once = repairLayer1Source(UNGUARDED);
  assert.equal(once.status, 'repaired');
  assert.deepEqual(once.source.split('\n'),
    ['function n(v) {', ...GUARD_LINES, '  const x = Number(v);', '  return Number.isFinite(x) ? x : null;', '}']);
  const twice = repairLayer1Source(once.source);
  assert.equal(twice.status, 'already_guarded');
  assert.equal(twice.source, once.source);
  assert.equal(repairLayer1Source('return $input.all();').status, 'no_helper');
  assert.equal(repairLayer1Source('function n(v) {\n  if (hasValue(v)) return null;\n  const x = Number(v);\n}').status, 'already_guarded');
  assert.throws(() => repairLayer1Source('function n(v) {\n  const x = Number(v);'));
});

test('all eight engines are named, and no committed export still converts an unavailable input to zero', () => {
  assert.deepEqual(Object.keys(LAYER1_ENGINES).sort(), ['btc', 'eur', 'gbp', 'gold', 'nq', 'silver', 'usd', 'wti']);
  for (const [file, engine] of EXPORTS) {
    const text = fs.readFileSync(path.resolve(file), 'utf8');
    const workflow = JSON.parse(text);
    const plan = planLayer1NullConversionRepair(workflow);
    const node = plan.nodes.find(entry => inspectHelper(entry.before).present);
    assert.ok(node, `${engine} must carry a local n(v) helper`);
    assert.equal(inspectHelper(node.before).guarded, true, `${file} draft still converts an unavailable input to zero`);
    assert.equal(plan.summary.alreadyApplied, true, `${file} draft must already be repaired`);
    assert.equal(repairExportFileText(text).applied.length, 0, 'reapplying the repair must be a no-op');
    const published = workflow.activeVersion?.nodes?.find(candidate => candidate.name === node.name);
    if (!published) continue;
    assert.equal(inspectHelper(published.parameters.jsCode).guarded, PUBLISHED_COPY[engine] === 'guarded',
      `${file} published copy must stay exactly as the live workflow wrote it`);
  }
  const gbp = planLayer1NullConversionRepair(JSON.parse(fs.readFileSync(path.resolve(LAYER1_ENGINES.gbp.exportFile), 'utf8')));
  assert.deepEqual(gbp.summary.repaired, []);
  assert.equal(gbp.summary.codeNodes, gbp.summary.withoutHelper.length);
  assert.equal(LAYER1_ENGINES.silver.exportFile, null);
  assert.equal(LAYER1_ENGINES.wti.exportFile, null);
});

test('the export-text applier rewrites the draft only, keeps every other byte and refuses an unexpected file', () => {
  const jsCode = UNGUARDED + '\nreturn $input.all();';
  const node = {parameters: {jsCode}, type: 'n8n-nodes-base.code', typeVersion: 2, position: [0, 0], id: 'calc', name: 'Calculate Synthetic Conviction'};
  const other = {parameters: {jsCode: 'return $input.all();'}, type: 'n8n-nodes-base.code', typeVersion: 2, position: [1, 1], id: 'other', name: 'Build Synthetic Input Pack'};
  const workflow = {id: 'synthetic', name: 'Synthetic Layer 1 Agent', nodes: [node, other],
    connections: {calc: {main: [[{node: 'other', type: 'main', index: 0}]]}}, settings: {},
    activeVersion: {workflowId: 'synthetic', nodes: [{...node}], connections: {}}};
  const text = JSON.stringify(workflow, null, 2).replace(/\n/g, '\r\n');
  const repaired = repairExportFileText(text);
  assert.deepEqual(repaired.applied, ['Calculate Synthetic Conviction']);
  assert.equal(repaired.summary.recordedActiveVersionUntouched, true);
  const parsed = JSON.parse(repaired.text);
  assert.deepEqual(parsed.nodes[0].parameters.jsCode.split('\n').slice(0, 4),
    [UNGUARDED.split('\n')[0], ...GUARD_LINES, '  const x = Number(v);']);
  assert.equal(parsed.nodes[1].parameters.jsCode, 'return $input.all();');
  assert.deepEqual(parsed.activeVersion, workflow.activeVersion);
  assert.deepEqual(parsed.connections, workflow.connections);
  const guardBlock = GUARD_LINES.join('\n') + '\n';
  assert.equal(repaired.text.length - text.length, JSON.stringify(guardBlock).length - 2,
    'only the escaped guard block is added');
  const literal = value => JSON.stringify(value);
  assert.equal(repaired.text.split(literal(jsCode)).join(literal(parsed.nodes[0].parameters.jsCode)),
    text.split(literal(jsCode)).join(literal(parsed.nodes[0].parameters.jsCode)),
    'bytes outside the repaired jsCode literal must not move');
  const again = repairExportFileText(repaired.text);
  assert.deepEqual(again.applied, []);
  assert.equal(again.text, repaired.text);
  const malformed = text.split(literal(jsCode)).join(literal('function n(v) {\n  const x = Number(v);'));
  assert.throws(() => repairExportFileText(malformed), /Malformed n\(v\) helper/);
});

// The recorded deployment defect: the payload carried the code nodes only, so sending 4 of a 9-node
// engine's nodes dropped the other 5 - the trigger, both database nodes, the document call and the model
// call - and the guard that refuses that payload is checked here by node id.
test('the payload carries the whole mixed-node workflow, and only the intended jsCode moves', () => {
  const codeNode = (id, name) => ({parameters: {jsCode: 'return $input.all();'}, type: 'n8n-nodes-base.code', typeVersion: 2, position: [0, 0], id, name});
  const workflow = {
    id: 'synthetic', name: 'Synthetic Layer 1 Agent', settings: {executionOrder: 'v1'},
    nodes: [
      {parameters: {}, type: 'n8n-nodes-base.executeWorkflowTrigger', typeVersion: 1, position: [-200, 0], id: 'trigger', name: 'When Executed by Another Workflow'},
      {parameters: {operation: 'getAll', tableId: 'agent_inputs', limit: 5}, type: 'n8n-nodes-base.supabase', typeVersion: 1, position: [-100, 0], id: 'read', name: 'Get Synthetic Input Pack', credentials: {supabaseApi: {id: 'cred-1', name: 'Supabase account'}}},
      codeNode('pack', 'Build Synthetic Input Pack'),
      codeNode('combine', 'Combine md & market snapshot'),
      {parameters: {modelId: 'gpt-4o'}, type: 'n8n-nodes-base.openAi', typeVersion: 1, position: [200, 0], id: 'model', name: 'Message a model'},
      {...codeNode('calc', 'Calculate Synthetic Conviction'), parameters: {jsCode: UNGUARDED + '\nreturn $input.all();'}},
      codeNode('parse', 'Parse Synthetic Agent Output'),
      {parameters: {operation: 'getAll', tableId: 'logic_documents'}, type: 'n8n-nodes-base.supabase', typeVersion: 1, position: [300, 0], id: 'doc', name: 'Get Synthetic Logic Document'},
      {parameters: {operation: 'create', tableId: 'agent_outputs'}, type: 'n8n-nodes-base.supabase', typeVersion: 1, position: [400, 0], id: 'write', name: 'Create a row'}
    ],
    connections: {
      'When Executed by Another Workflow': {main: [[{node: 'Get Synthetic Input Pack', type: 'main', index: 0}]]},
      'Get Synthetic Input Pack': {main: [[{node: 'Build Synthetic Input Pack', type: 'main', index: 0}]]},
      'Build Synthetic Input Pack': {main: [[{node: 'Combine md & market snapshot', type: 'main', index: 0}]]},
      'Combine md & market snapshot': {main: [[{node: 'Message a model', type: 'main', index: 0}]]},
      'Message a model': {main: [[{node: 'Calculate Synthetic Conviction', type: 'main', index: 0}]]},
      'Calculate Synthetic Conviction': {main: [[{node: 'Parse Synthetic Agent Output', type: 'main', index: 0}]]},
      'Parse Synthetic Agent Output': {main: [[{node: 'Get Synthetic Logic Document', type: 'main', index: 0}]]},
      'Get Synthetic Logic Document': {main: [[{node: 'Create a row', type: 'main', index: 0}]]}
    }
  };
  const plan = planLayer1NullConversionRepair(workflow);
  assert.equal(plan.summary.nodesInWorkflow, 9);
  assert.equal(plan.summary.nodesInPayload, 9);
  assert.equal(plan.summary.codeNodes, 4);
  assert.equal(plan.summary.nonCodeNodesInPayload, 5);
  assert.equal(plan.summary.connectionsPreserved, true);
  assert.deepEqual(plan.summary.repaired, ['Calculate Synthetic Conviction']);
  assert.deepEqual(plan.payload_code_changes, ['Calculate Synthetic Conviction']);
  assert.deepEqual(plan.payload.nodes.map(node => node.id), workflow.nodes.map(node => node.id));
  assert.deepEqual(plan.payload.nodes.map(node => node.type), workflow.nodes.map(node => node.type));
  assert.deepEqual(plan.payload.connections, workflow.connections);
  assert.deepEqual(plan.payload.settings, workflow.settings);
  // The incident, node by node: the payload keeps all nine ids in workflow order, and the whole
  // connection map, source by source.
  assert.deepEqual(plan.payload.nodes.map(node => node.id),
    ['trigger', 'read', 'pack', 'combine', 'model', 'calc', 'parse', 'doc', 'write']);
  assert.deepEqual(Object.keys(plan.payload.connections),
    ['When Executed by Another Workflow', 'Get Synthetic Input Pack', 'Build Synthetic Input Pack',
      'Combine md & market snapshot', 'Message a model', 'Calculate Synthetic Conviction',
      'Parse Synthetic Agent Output', 'Get Synthetic Logic Document']);
  // What a code-only payload of this workflow would have kept, dropped and orphaned.
  const codeNodeIds = ['pack', 'combine', 'calc', 'parse'];
  const dropped = workflow.nodes.filter(node => !codeNodeIds.includes(node.id));
  assert.deepEqual(workflow.nodes.filter(node => codeNodeIds.includes(node.id)).map(node => node.id),
    codeNodeIds, 'the four code nodes are the four the incident payload kept');
  assert.deepEqual(dropped.map(node => node.id), ['trigger', 'read', 'model', 'doc', 'write']);
  assert.deepEqual(dropped.map(node => node.name), ['When Executed by Another Workflow',
    'Get Synthetic Input Pack', 'Message a model', 'Get Synthetic Logic Document', 'Create a row']);
  const connectionTargets = Object.values(workflow.connections)
    .flatMap(ports => (ports.main || []).flatMap(branch => branch.map(connection => connection.node)));
  for (const name of ['Get Synthetic Input Pack', 'Message a model', 'Get Synthetic Logic Document', 'Create a row']) {
    assert.ok(connectionTargets.includes(name), `${name} is still named as a connection target`);
  }
  assert.ok(!connectionTargets.includes('When Executed by Another Workflow'),
    'the trigger is a connection source, not a target');
  const codeOnly = {name: workflow.name, connections: workflow.connections, settings: workflow.settings,
    nodes: plan.payload.nodes.filter(node => codeNodeIds.includes(node.id))};
  assert.deepEqual(codeOnly.nodes.map(node => node.id), codeNodeIds);
  assert.throws(() => assertPayloadCoversWorkflow(workflow, codeOnly), /carries 4 of 9 nodes/,
    'the guard must refuse the payload that caused the recorded incident');
  for (const type of ['n8n-nodes-base.executeWorkflowTrigger', 'n8n-nodes-base.supabase', 'n8n-nodes-base.openAi']) {
    assert.ok(plan.payload.nodes.some(node => node.type === type), `${type} must survive into the payload`);
  }
  for (const node of workflow.nodes.filter(node => node.id !== 'calc')) {
    assert.deepEqual(plan.payload.nodes.find(sent => sent.id === node.id), node, `${node.name} must be sent unchanged`);
  }
  const sentCalc = plan.payload.nodes.find(node => node.id === 'calc');
  assert.deepEqual(sentCalc.parameters.jsCode.split('\n').slice(0, 4),
    [UNGUARDED.split('\n')[0], ...GUARD_LINES, '  const x = Number(v);']);
  assert.deepEqual(Object.keys(sentCalc), Object.keys(workflow.nodes[5]));
  assert.deepEqual({...sentCalc, parameters: {...sentCalc.parameters, jsCode: undefined}},
    {...workflow.nodes[5], parameters: {...workflow.nodes[5].parameters, jsCode: undefined}});
  assert.deepEqual(JSON.parse(JSON.stringify(plan.payload)).nodes.map(node => node.name), workflow.nodes.map(node => node.name));
});

test('a real engine export survives the same planning: every node published, only the guard lines move', () => {
  for (const [, engine] of Object.entries(ENGINE_BY_EXPORT_FILE)) {
    const file = LAYER1_ENGINES[engine].exportFile;
    const workflow = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
    const plan = planLayer1NullConversionRepair(workflow);
    assert.equal(plan.summary.nodesInWorkflow, workflow.nodes.length, `${file} must plan from every node`);
    assert.equal(plan.summary.nodesInPayload, workflow.nodes.length, `${file} must publish every node`);
    assert.equal(plan.summary.connectionsPreserved, true, `${file} must keep its connections`);
    assert.deepEqual(plan.payload.nodes, workflow.nodes, `${file} is already repaired and must be sent back unchanged`);
    assert.deepEqual(plan.payload_code_changes, []);
  }
  // Rebuild the pre-repair state of the USD draft: strip the guard lines back out, then plan again.
  const workflow = JSON.parse(fs.readFileSync(path.resolve(LAYER1_ENGINES.usd.exportFile), 'utf8'));
  const guarded = workflow.nodes.find(node => node.parameters?.jsCode && inspectHelper(node.parameters.jsCode).guarded);
  const unguardedCode = guarded.parameters.jsCode.replace(GUARD_LINES.join('\n') + '\n', '');
  assert.notEqual(unguardedCode, guarded.parameters.jsCode);
  const unguarded = {...workflow, nodes: workflow.nodes.map(node =>
    node.name === guarded.name ? {...node, parameters: {...node.parameters, jsCode: unguardedCode}} : node)};
  const plan = planLayer1NullConversionRepair(unguarded);
  assert.equal(plan.summary.nodesInPayload, 9);
  assert.deepEqual(plan.summary.repaired, [guarded.name]);
  assert.deepEqual(plan.payload_code_changes, [guarded.name]);
  for (const node of unguarded.nodes.filter(node => node.name !== guarded.name)) {
    assert.deepEqual(plan.payload.nodes.find(sent => sent.id === node.id), node,
      `the repair must not touch ${node.name} in the payload`);
  }
  assert.deepEqual(plan.payload.connections, workflow.connections);
  assert.deepEqual(plan.payload.nodes.map(node => node.name), unguarded.nodes.map(node => node.name));
  // The same claim against the recorded live shape, node for node and connection for connection.
  assert.deepEqual(plan.payload.nodes.map(node => node.name),
    ['Build USD Input Pack', 'Message a model', 'Supabase Get Many', 'Create a row',
      'Combine md & market snapshot', 'Get USD Logic Document', 'Parse USD Agent Output',
      'Calculate USD Conviction', 'When Executed by Another Workflow']);
  assert.deepEqual(plan.payload.nodes.map(node => node.id),
    ['f80bde17-af43-466c-8fa9-c45ef676e014', 'fb21bdeb-296f-4ab6-b355-f055d14e00f2',
      'f4523568-0afd-488d-b1f0-e5c322f2cb98', 'a37d7474-9c5e-4b6b-a872-fe9d29960dba',
      '6db219f8-fe1e-486a-b3d9-a18a664b0951', '020bc927-93f7-4233-9eba-3a5843a044d5',
      '9c8aa188-3a7b-4dd4-a978-7307372123f7', 'e23175ee-9333-479d-a40e-4619c1a74fa3',
      '9532b00f-4ecb-49c4-a8f8-5125be04f259']);
  assert.deepEqual(Object.keys(plan.payload.connections),
    ['Build USD Input Pack', 'Supabase Get Many', 'Message a model', 'Combine md & market snapshot',
      'Get USD Logic Document', 'Parse USD Agent Output', 'Calculate USD Conviction',
      'When Executed by Another Workflow']);
  const usdCodeIds = ['f80bde17-af43-466c-8fa9-c45ef676e014', '6db219f8-fe1e-486a-b3d9-a18a664b0951',
    '9c8aa188-3a7b-4dd4-a978-7307372123f7', 'e23175ee-9333-479d-a40e-4619c1a74fa3'];
  const usdCodeNames = ['Build USD Input Pack', 'Combine md & market snapshot', 'Parse USD Agent Output',
    'Calculate USD Conviction'];
  assert.deepEqual(plan.payload.nodes.filter(node => usdCodeIds.includes(node.id)).map(node => node.name),
    ['Build USD Input Pack', 'Combine md & market snapshot', 'Parse USD Agent Output', 'Calculate USD Conviction']);
  assert.deepEqual(plan.payload.nodes.filter(node => !usdCodeIds.includes(node.id)).map(node => node.name),
    ['Message a model', 'Supabase Get Many', 'Create a row', 'Get USD Logic Document',
      'When Executed by Another Workflow'], 'sending the four code nodes of the live USD agent drops these five');
  const usdTargets = Object.values(plan.payload.connections)
    .flatMap(ports => (ports.main || []).flatMap(branch => branch.map(connection => connection.node)));
  assert.deepEqual(usdTargets.filter(name => !usdCodeNames.includes(name)),
    ['Get USD Logic Document', 'Message a model', 'Create a row', 'Supabase Get Many'],
    'the live USD connection map still targets four of the five nodes a code-only payload drops');
  assert.throws(() => assertPayloadCoversWorkflow(workflow,
    {...plan.payload, nodes: plan.payload.nodes.filter(node => usdCodeIds.includes(node.id))}),
    /carries 4 of 9 nodes/, 'a code-only payload of the live USD agent is refused');
});
