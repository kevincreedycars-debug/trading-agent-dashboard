const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { FIELDS, buildGoldHistoryIsolation, validateGoldHistoryCapture } = require('../lib/gold_history_isolation');
const source = require('../../exports/gold_collector.json');
const patch = require('../drafts/gold_collector_history_query_patch.json');
const { run: build } = require('../scripts/build_gold_history_isolation');
const { run: verify } = require('../scripts/verify_gold_history_capture');

function fixture(count = 1001) {
  const { workflow: candidate, manifest } = buildGoldHistoryIsolation(source, patch, '2024-03-11');
  // All rows share a timestamp, so ID ordering must remain correct across page boundaries.
  const referenceRows = Array.from({ length: count }, (_, index) => ({
    ...Object.fromEntries(FIELDS.map(field => [field, null])), id: String(index).padStart(8, '0'),
    snapshot_date: '2024-03-10', run_time_et: '2024-03-10T12:00:00.000001Z', gold_price: 100 + index
  }));
  return { candidate, manifest, runtimeWorkflow: { ...structuredClone(candidate), id: 'synthetic-workflow' },
    referenceRows, capturedItems: [...referenceRows].reverse().map(json => ({ json: { ...json } })),
    execution: { id: 'synthetic-execution', runtime_version: 'synthetic-only', workflow_id: 'synthetic-workflow',
      mode: 'manual', status: 'success', observed_page_size: 1000 } };
}

test('builder excludes production graph, credentials and dynamic clock while retaining node version', () => {
  const data = fixture();
  assert.equal(data.candidate.nodes.length, 3);
  assert.equal(data.candidate.active, false);
  assert.equal(data.candidate.nodes[1].typeVersion, 1);
  assert.ok(!JSON.stringify(data.candidate).includes('credentials'));
  assert.ok(!JSON.stringify(data.candidate).includes('$now'));
  assert.match(data.manifest.resolved_query, /snapshot_date.gte.2024-01-11/);
  assert.equal(data.manifest.runtime_executed, false);
  assert.throws(() => buildGoldHistoryIsolation(source, patch, '2024-02-30'), /UTC/);
  const changed = structuredClone(source);
  changed.nodes.find(node => node.name === patch.node_name).parameters.limit = 100;
  assert.throws(() => buildGoldHistoryIsolation(changed, patch, '2024-03-11'), /drift/);
});

test('capture comparison reconciles exact-page, overflow and empty cases without runtime-authenticity claims', () => {
  for (const count of [0, 1000, 1001, 2000]) {
    const report = validateGoldHistoryCapture(fixture(count));
    assert.equal(report.rows, count);
    assert.equal(report.exceeds_observed_page_size, count > 1000);
    assert.equal(report.exact_page_multiple, count > 0 && count % 1000 === 0);
    assert.equal(report.installed_runtime_authenticated, false);
    assert.equal(report.production_applied, false);
  }
});

test('capture comparison rejects lost rows, boundary swaps, revisions, shape and timestamp corruption', () => {
  for (const mutate of [
    data => data.capturedItems.pop(),
    data => data.capturedItems.push(data.capturedItems[0]),
    data => [data.capturedItems[999], data.capturedItems[1000]] = [data.capturedItems[1000], data.capturedItems[999]],
    data => data.capturedItems[0].json.gold_price = 9999,
    data => delete data.capturedItems[0].json.btc_price,
    data => data.capturedItems[0].json.snapshot_date = '2024-03-11',
    data => data.capturedItems[0].json.run_time_et = 'invalid',
    data => data.execution.status = 'error'
  ]) { const data = fixture(); mutate(data); assert.throws(() => validateGoldHistoryCapture(data)); }
});

test('reference ordering respects offsets, submillisecond revisions and the inclusive lower date', () => {
  const data = fixture(4);
  Object.assign(data.referenceRows[0], { run_time_et: '2024-03-10T08:00:00-05:00' });
  Object.assign(data.referenceRows[1], { run_time_et: '2024-03-10T13:00:00.000001Z' });
  Object.assign(data.referenceRows[2], { run_time_et: '2024-03-10T13:00:00.000002Z' });
  Object.assign(data.referenceRows[3], { snapshot_date: '2024-01-11', run_time_et: '2024-01-11T13:00:00Z' });
  data.capturedItems = [2, 1, 0, 3].map(index => ({ json: { ...data.referenceRows[index] } }));
  assert.deepEqual(validateGoldHistoryCapture(data).selected_reference_ids, ['00000002', '00000003']);
  data.referenceRows[3].snapshot_date = '2024-01-10';
  assert.throws(() => validateGoldHistoryCapture(data), /outside query bounds/);
});

test('isolation rejects activation, writes, extra branches, pinning and execution identity drift', () => {
  for (const mutate of [
    data => data.runtimeWorkflow.active = true,
    data => data.runtimeWorkflow.nodes[1].parameters.operation = 'create',
    data => data.runtimeWorkflow.nodes.push({ name: 'Unexpected writer', type: 'n8n-nodes-base.httpRequest' }),
    data => data.runtimeWorkflow.nodes[2].parameters.jsCode = 'return [{json:{fake:true}}];',
    data => data.runtimeWorkflow.connections.Extra = { main: [] },
    data => data.runtimeWorkflow.pinData = { 'Capture history rows': [] },
    data => data.execution.workflow_id = 'production',
    data => data.execution.mode = 'trigger',
    data => data.manifest.candidate_object_sha256 = 'tampered'
  ]) { const data = fixture(1); mutate(data); assert.throws(() => validateGoldHistoryCapture(data)); }
  const bound = fixture(1);
  bound.runtimeWorkflow.nodes[1].credentials = { supabaseApi: { id: 'synthetic-reference', name: 'Synthetic only' } };
  assert.equal(validateGoldHistoryCapture(bound).rows, 1);
});

test('commands preserve source bytes and refuse overwrite or manifest drift', () => {
  const directory = fs.mkdtempSync(path.resolve(__dirname, '../tmp/gold-isolation-command-'));
  const sourcePath = path.resolve(__dirname, '../../exports/gold_collector.json');
  const patchPath = path.resolve(__dirname, '../drafts/gold_collector_history_query_patch.json');
  const output = path.join(directory, 'candidate');
  build([sourcePath, patchPath, '2024-03-11', output]);
  assert.throws(() => build([sourcePath, patchPath, '2024-03-11', output]), /EEXIST/);
  const data = fixture(2), files = ['runtimeWorkflow', 'referenceRows', 'capturedItems', 'execution'].map(key => {
    const file = path.join(directory, key + '.json'); fs.writeFileSync(file, JSON.stringify(data[key])); return file;
  });
  const manifestPath = path.join(output, 'manifest.json'), reportPath = path.join(directory, 'report.json');
  const args = [sourcePath, patchPath, manifestPath, ...files, reportPath];
  assert.equal(verify(args).rows, 2);
  assert.throws(() => verify(args), /EEXIST/);
  const manifest = JSON.parse(fs.readFileSync(manifestPath)); manifest.lower_date = '1900-01-01';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  assert.throws(() => verify([...args.slice(0, -1), path.join(directory, 'tampered.json')]), /Manifest drift/);
});
