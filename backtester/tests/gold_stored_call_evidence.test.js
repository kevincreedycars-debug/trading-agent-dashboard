const test=require('node:test');
const assert=require('node:assert/strict');
const {storageTimestamp,prepareGoldStoredCalls}=require('../lib/gold_stored_call_evidence');
const protocol={id:'synthetic-test',frozen_at:'2024-01-01T00:00:00Z',entry_policy:'next_minute_after_storage',horizon_ms:86400000,flat_threshold_pct:0.3};
function bundle() {return {outputs:[{id:'call1',agent_name:'GOLD',layer:1,snapshot_id:'s1',created_at:'2024-01-08T14:00:00.000001+00:00',
  call_24h_direction:'BEARISH',factor_breakdown:Object.fromEntries(Array.from({length:10},(_,i)=>[`F${i+1}`,{signal:'BEARISH'}]))}],
  snapshots:[{id:'s1',created_at:'2024-01-08T13:59:00Z'}]};}
test('microsecond storage times round availability upward and preserve original evidence',()=>{
  assert.equal(storageTimestamp('2024-01-08T14:00:00.000001Z'),Date.parse('2024-01-08T14:00:00.001Z'));
  assert.equal(storageTimestamp('2024-01-08T13:59:59.999999Z'),Date.parse('2024-01-08T14:00:00Z'));
  assert.equal(storageTimestamp('2024-02-30T13:00:00.123456Z'),null);
  const result=prepareGoldStoredCalls(bundle(),protocol);
  assert.equal(result.dataset.calls[0].entry_time,'2024-01-08T14:01:00.000Z');
  assert.equal(result.dataset.calls[0].call_time,'2024-01-08T14:00:00.001Z');
  assert.equal(result.dataset.calls[0].original_storage_timestamp,bundle().outputs[0].created_at);
  assert.equal(result.audit.actual_dashboard_publication_verified,false);
});
test('missing, ambiguous and future snapshots fail the stored-call input contract',()=>{
  for(const [change,reason] of [
    [b=>b.snapshots=[],'snapshot_missing'],
    [b=>b.snapshots.push({...b.snapshots[0]}),'snapshot_ambiguous'],
    [b=>b.snapshots[0].created_at='2024-01-08T14:01:00Z','snapshot_not_proven_stored_before_output']
  ]) {const b=bundle();change(b);assert.equal(prepareGoldStoredCalls(b,protocol).audit.issue_counts[reason],1);}
});
test('missing factors stay missing and other asset outputs cannot qualify',()=>{
  const b=bundle();delete b.outputs[0].factor_breakdown.F1;b.outputs[0].agent_name='EUR';
  const r=prepareGoldStoredCalls(b,protocol);
  assert.equal(r.audit.factor_coverage.F1,0);
  assert.equal(r.audit.issue_counts.not_gold_layer1,1);
  assert.equal(r.audit.calls_with_input_rejections,1);
});
test('protocol cannot silently choose entry, horizon or flat threshold',()=>{
  for(const field of ['id','frozen_at','entry_policy','horizon_ms','flat_threshold_pct']) {
    const p={...protocol};delete p[field];assert.throws(()=>prepareGoldStoredCalls(bundle(),p),/protocol/);
  }
});

test('rounding cannot conceal a snapshot stored microseconds after the output',()=>{
  const b=bundle();b.snapshots[0].created_at='2024-01-08T14:00:00.000002Z';
  assert.equal(prepareGoldStoredCalls(b,protocol).audit.issue_counts.snapshot_not_proven_stored_before_output,1);
});


test('normalized storage entry is explicit at millisecond, nanosecond and offset boundaries', () => {
  const { buildGoldTimestampedReport } = require('../lib/gold_timestamped_evaluation');
  for (const [raw, normalized, entry, delay] of [
    ['2024-01-08T13:59:59.999Z', '2024-01-08T13:59:59.999Z', '2024-01-08T14:00:00.000Z', 1],
    ['2024-01-08T13:59:59.999000001Z', '2024-01-08T14:00:00.000Z', '2024-01-08T14:01:00.000Z', 60000],
    ['2024-01-08T09:00:00-05:00', '2024-01-08T14:00:00.000Z', '2024-01-08T14:01:00.000Z', 60000],
    ['2024-01-08T14:00:00.000001Z', '2024-01-08T14:00:00.001Z', '2024-01-08T14:01:00.000Z', 59999]
  ]) {
    const b = bundle(); b.outputs[0].created_at = raw;
    const p = { ...protocol, entry_policy: 'next_minute_after_normalized_storage', horizon_ms: 60000 };
    const { dataset, audit } = prepareGoldStoredCalls(b, p);
    assert.equal(dataset.calls[0].call_time, normalized);
    assert.equal(dataset.calls[0].entry_time, entry);
    assert.equal(dataset.calls[0].horizon_end, new Date(Date.parse(entry) + 60000).toISOString());
    assert.equal(audit.entry_semantics.legacy_policy_alias, false);
    assert.deepEqual(prepareGoldStoredCalls(b, { ...p, entry_policy: 'next_minute_after_storage' }).dataset.calls, dataset.calls);
    dataset.candles = [{ market: 'XAUUSD', open_time: entry, close_time: dataset.calls[0].horizon_end,
      open: 100, high: 101, low: 99, close: 99, complete: true, price_basis: 'mid', source: 'synthetic-only' }];
    const report = buildGoldTimestampedReport(dataset);
    assert.equal(report.rows[0].result, 'CORRECT');
    assert.equal(report.rows[0].entry_delay_ms, delay);
    assert.deepEqual(report.entry_semantics, audit.entry_semantics);
    dataset.config.max_entry_delay_ms = delay - 1;
    assert.equal(buildGoldTimestampedReport(dataset).rows[0].evaluable, false);
  }
  assert.throws(() => prepareGoldStoredCalls(bundle(), { ...protocol, entry_policy: 'next_minute_after_raw_storage' }), /protocol/);
});
