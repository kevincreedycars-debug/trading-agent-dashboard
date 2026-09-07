const test=require('node:test');
const assert=require('node:assert/strict');
const {buildReplayOutput}=require('../replay/gold/gold_replay_core');
const {auditGoldSnapshotLineage}=require('../lib/gold_snapshot_lineage_audit');
test('lineage audit detects a persistent implied anchor while retaining replay mismatches',()=>{
 const snapshots=[{id:'s1',snapshot_date:'2024-01-08',gold_price:2100,gold_d1_pct:5},
 {id:'s2',snapshot_date:'2024-02-08',gold_price:1900,gold_d1_pct:-5}];
 const outputs=snapshots.map(s=>{const r=buildReplayOutput(s,'synthetic');return {id:s.id,snapshot_id:s.id,call_24h_direction:r.direction_24h,factor_breakdown:r.factor_breakdown};});
 let audit=auditGoldSnapshotLineage({outputs},{snapshots});assert.equal(audit.replay_mismatches,0);
 assert.equal(audit.implied_d1_reference_groups.length,1);assert.equal(audit.implied_d1_reference_groups[0].implied_reference_price,2000);
 outputs[0].factor_breakdown.F5.signal='NEUTRAL';audit=auditGoldSnapshotLineage({outputs},{snapshots});
 assert.deepEqual(audit.mismatches[0].factor_mismatches,['F5']);assert.equal(audit.historical_snapshots_rewritten,false);
});
test('missing snapshot inputs cannot count as replayed',()=>{
 const audit=auditGoldSnapshotLineage({outputs:[{id:'a',snapshot_id:'missing'}]},{snapshots:[]});
 assert.equal(audit.replayed_outputs,0);assert.deepEqual(audit.missing_snapshot_prediction_ids,['a']);
});
