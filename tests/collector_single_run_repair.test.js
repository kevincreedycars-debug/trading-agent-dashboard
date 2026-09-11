const {test} = require('node:test');
const assert = require('node:assert/strict');
const {COLLECTORS, ENTRY, planCollectorSingleRunRepair} = require('../scripts/lib/collector_single_run_repair');
function fixture(id = COLLECTORS.usd) {
  const nodes = [{id: 'trigger', name: 'Start', type: 'n8n-nodes-base.executeWorkflowTrigger'},
    {id: 'entry', name: ENTRY, type: 'n8n-nodes-base.httpRequest', parameters: {url: 'https://api.stlouisfed.org/fred/series/observations?series_id=DGS2&api_key=synthetic', options: {}}},
    {id: 'downstream', name: 'Normalize', type: 'n8n-nodes-base.code', parameters: {jsCode: 'return $input.all();'}}];
  const connections = {Start: {main: [[{node: ENTRY, type: 'main', index: 0}]]}};
  return {id, name: 'Collector', nodes, connections, settings: {}, activeVersion: structuredClone({nodes, connections})};
}
test('all five collectors preserve every setting except initial request executeOnce', () => {
  for (const id of Object.values(COLLECTORS)) {
    const w = fixture(id); const original = structuredClone(w); const {payload} = planCollectorSingleRunRepair(w);
    assert.deepEqual(w, original);
    const expected = structuredClone(w.nodes); expected[1].executeOnce = true;
    assert.deepEqual(payload, {name: w.name, nodes: expected, connections: w.connections, settings: w.settings});
    assert.equal(payload.nodes[1].onError, undefined);
  }
});
test('refuses unreviewed topology, per-item requests, different provider and active draft drift', () => {
  for (const mutate of [w => w.id = 'other', w => w.connections.Start.main[0].push({node:'Other'}),
    w => w.nodes[1].parameters.url += '&x={{$json.id}}', w => w.nodes[1].parameters.method = 'POST',
    w => w.nodes[1].parameters.url = 'https://example.com/', w => w.activeVersion.nodes[2].parameters.jsCode = 'changed']) {
    const w = fixture(); mutate(w); assert.throws(() => planCollectorSingleRunRepair(w));
  }
});
test('reapplying reports no change', () => {
  const w = fixture(); w.nodes[1].executeOnce = w.activeVersion.nodes[1].executeOnce = true;
  const plan = planCollectorSingleRunRepair(w); assert.equal(plan.summary.alreadyApplied, true); assert.deepEqual(plan.payload.nodes, w.nodes);
});
