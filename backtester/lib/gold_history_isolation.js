const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { validDate } = require('./gold_evidence_audit');
const { storageTimestampNanos } = require('./gold_stored_call_evidence');

const FIELDS = ['id', 'snapshot_date', 'run_time_et', 'gold_price', 'btc_price', 'nq_price',
  'btc_dominance', 'total_crypto_market_cap', 'stablecoin_supply'];
const READ_NAME = 'Supabase | Get Previous Market Snapshots';
const CAPTURE_CODE = 'return $input.all();';
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const hashObject = value => sha256(JSON.stringify(value));

function buildGoldHistoryIsolation(source, patch, cutoffDate) {
  if (!validDate(cutoffDate)) throw new Error('Explicit real UTC cutoff date required.');
  if (source?.name !== patch?.workflow_name || patch.node_name !== READ_NAME) throw new Error('Source workflow identity drift.');
  const matches = source.nodes?.filter(node => node.name === READ_NAME) || [];
  if (matches.length !== 1 || matches[0].type !== 'n8n-nodes-base.supabase' ||
    !Number.isFinite(matches[0].typeVersion)) throw new Error('Exactly one versioned Supabase history node required.');
  assert.deepEqual(matches[0].parameters, patch.expected_parameters, 'Source history parameters drifted; review a fresh diff.');
  // Explicitly bound the supported patch rather than executing arbitrary supplied expressions.
  const expectedExpression = "={{ 'and=(snapshot_date.lt.' + $now.toUTC().toISODate() + ',snapshot_date.gte.' + $now.toUTC().minus({ days: 60 }).toISODate() + ')&order=snapshot_date.desc,run_time_et.desc,id.desc&select=" + FIELDS.join(',') + "' }}";
  assert.deepEqual(patch.replacement_parameters, { operation: 'getAll', tableId: 'market_snapshots',
    returnAll: true, filterType: 'string', filterString: expectedExpression }, 'Unsupported patch drift.');
  const lowerDate = new Date(Date.parse(cutoffDate + 'T00:00:00Z') - 60 * 86400000).toISOString().slice(0, 10);
  const resolvedQuery = `and=(snapshot_date.lt.${cutoffDate},snapshot_date.gte.${lowerDate})&order=snapshot_date.desc,run_time_et.desc,id.desc&select=${FIELDS.join(',')}`;
  const workflow = { name: `Gold history isolation ${cutoffDate}`, active: false,
    nodes: [
      { id: 'gold-isolation-manual', name: 'Manual validation only', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [0, 0], parameters: {} },
      { id: 'gold-isolation-read', name: READ_NAME, type: matches[0].type, typeVersion: matches[0].typeVersion,
        position: [240, 0], parameters: { ...patch.replacement_parameters,
          filterString: `={{ ${JSON.stringify(resolvedQuery)} }}` } },
      { id: 'gold-isolation-capture', name: 'Capture history rows', type: 'n8n-nodes-base.code', typeVersion: 2,
        position: [480, 0], parameters: { mode: 'runOnceForAllItems', jsCode: CAPTURE_CODE } }
    ], connections: {
      'Manual validation only': { main: [[{ node: READ_NAME, type: 'main', index: 0 }]] },
      [READ_NAME]: { main: [[{ node: 'Capture history rows', type: 'main', index: 0 }]] }
    }, settings: { executionOrder: 'v1' } };
  const manifest = { version: 'gold-history-isolation-v1', cutoff_date: cutoffDate, lower_date: lowerDate,
    resolved_query: resolvedQuery, projected_fields: FIELDS, source_node_type_version: matches[0].typeVersion,
    source_object_sha256: hashObject(source), patch_object_sha256: hashObject(patch),
    candidate_object_sha256: hashObject(workflow), credentials_included: false,
    runtime_executed: false, production_applied: false,
    limitation: 'Fixed-date query harness; does not validate production $now evaluation or midnight-crossing normalization.' };
  return { workflow, manifest };
}

function assertIsolationGraph(actual, expected) {
  assert.deepEqual(expected.nodes?.map(node => node.type), ['n8n-nodes-base.manualTrigger',
    'n8n-nodes-base.supabase', 'n8n-nodes-base.code'], 'Candidate must contain only manual/read/capture nodes.');
  assert.equal(expected.nodes[1].parameters.operation, 'getAll');
  assert.equal(expected.nodes[1].parameters.tableId, 'market_snapshots');
  assert.equal(expected.nodes[2].parameters.jsCode, CAPTURE_CODE);
  if (actual?.active !== false) throw new Error('Isolation workflow must be inactive.');
  // Server-assigned workflow metadata is allowed; node behavior and graph must match exactly.
  const nodes = structuredClone(actual.nodes);
  if (!Array.isArray(nodes)) throw new Error('Isolation nodes missing.');
  for (const node of nodes) {
    if (node.name === READ_NAME && node.credentials !== undefined) {
      const credentials = node.credentials;
      if (Object.keys(credentials).length !== 1 || !credentials.supabaseApi ||
        Object.keys(credentials.supabaseApi).some(key => !['id', 'name'].includes(key))) throw new Error('Only a Supabase credential reference may be bound.');
      delete node.credentials;
    }
  }
  assert.deepEqual(nodes, expected.nodes, 'Isolation node drift or unexpected side-effect node.');
  assert.deepEqual(actual.connections, expected.connections, 'Isolation connections drift.');
  assert.deepEqual(actual.settings, expected.settings, 'Isolation settings drift.');
  if (actual.pinData && Object.keys(actual.pinData).length) throw new Error('Pinned rows are not runtime evidence.');
  if (actual.staticData && Object.keys(actual.staticData).length) throw new Error('Unexpected persistent workflow state.');
}

function compareDescending(a, b) {
  if (a.snapshot_date !== b.snapshot_date) return a.snapshot_date > b.snapshot_date ? -1 : 1;
  const left = storageTimestampNanos(a.run_time_et), right = storageTimestampNanos(b.run_time_et);
  if (left !== right) return left > right ? -1 : 1;
  return a.id === b.id ? 0 : a.id > b.id ? -1 : 1;
}

function validateGoldHistoryCapture({ candidate, manifest, runtimeWorkflow, referenceRows, capturedItems, execution }) {
  assert.equal(hashObject(candidate), manifest.candidate_object_sha256, 'Candidate manifest hash mismatch.');
  assertIsolationGraph(runtimeWorkflow, candidate);
  if (!execution || typeof execution.id !== 'string' || !execution.id.trim() ||
    typeof execution.runtime_version !== 'string' || !execution.runtime_version.trim() ||
    execution.workflow_id !== runtimeWorkflow.id || !runtimeWorkflow.id || execution.status !== 'success' ||
    execution.mode !== 'manual') throw new Error('Successful manual execution identity and runtime version required.');
  if (!Array.isArray(referenceRows) || !Array.isArray(capturedItems)) throw new Error('Reference rows and captured n8n items arrays required.');
  const checkRows = (rows, label) => {
    const ids = new Set();
    for (const row of rows) {
      if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw new Error(`${label}: missing or duplicate ID.`);
      ids.add(row.id);
      if (!validDate(row.snapshot_date) || row.snapshot_date < manifest.lower_date || row.snapshot_date >= manifest.cutoff_date ||
        storageTimestampNanos(row.run_time_et) === null) throw new Error(`${label}: invalid timestamp or outside query bounds.`);
      assert.deepEqual(Object.keys(row).sort(), [...FIELDS].sort(), `${label}: projected field shape mismatch.`);
    }
  };
  const captured = capturedItems.map(item => {
    if (!item || !item.json || typeof item.json !== 'object' || Array.isArray(item.json) || item.error) throw new Error('Invalid captured n8n item shape.');
    return item.json;
  });
  checkRows(referenceRows, 'reference'); checkRows(captured, 'capture');
  const ordered = [...referenceRows].sort(compareDescending);
  assert.deepEqual(captured, ordered, 'Captured rows differ from independent reference content/order.');
  const perDate = ordered.filter((row, index) => index === 0 || row.snapshot_date !== ordered[index - 1].snapshot_date);
  const pageSize = execution.observed_page_size;
  if (!Number.isSafeInteger(pageSize) || pageSize <= 0) throw new Error('Observed installed-node page size required.');
  return { version: 'gold-history-capture-comparison-v1', supplied_capture_matches_reference: true,
    rows: captured.length, distinct_dates: perDate.length,
    selected_reference_ids: perDate.map(row => row.id), execution_id: execution.id,
    candidate_object_sha256: manifest.candidate_object_sha256,
    reference_object_sha256: hashObject(referenceRows), capture_object_sha256: hashObject(capturedItems),
    exceeds_observed_page_size: captured.length > pageSize,
    exact_page_multiple: captured.length > 0 && captured.length % pageSize === 0,
    installed_runtime_authenticated: false, production_applied: false,
    remaining_gates: ['Authenticate supplied workflow/execution exports and independent reference source.',
      'Check page requests, exact-page and overflow cases, and boundary ties in installed runtime evidence.',
      'Validate production clock evaluation and midnight behavior separately.'] };
}

module.exports = { FIELDS, buildGoldHistoryIsolation, assertIsolationGraph, validateGoldHistoryCapture, hashObject, sha256 };
