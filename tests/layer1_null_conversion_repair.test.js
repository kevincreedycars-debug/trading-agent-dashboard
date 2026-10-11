const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {ENGINE_BY_EXPORT_FILE, GUARD_LINES, LAYER1_ENGINES, inspectHelper, planLayer1NullConversionRepair,
  repairExportFileText, repairLayer1Source} = require('../scripts/lib/layer1_null_conversion_repair');

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
