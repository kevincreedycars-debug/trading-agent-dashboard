const test=require('node:test');
const assert=require('node:assert/strict');
const {priorSnapshotReference,buildGoldHistoryRepairImpact}=require('../lib/gold_history_repair_impact');
function current(){return {id:'current',snapshot_date:'2024-01-10',created_at:'2024-01-10T10:00:00.000001Z',gold_price:2010,gold_d1_pct:5};}
function row(id,date,price){return {id,snapshot_date:date,created_at:date+'T18:00:00Z',run_time_et:date+'T17:59:00Z',gold_price:price};}
test('history repair chooses the latest prior date, never an arbitrary limited old slice',()=>{
 const old=row('old','2023-12-01',1800),recent=row('recent','2024-01-09',2000);
 const history=[old,recent,...Array.from({length:30},(_,i)=>row('older'+i,'2023-11-01',1800))];
 const result=priorSnapshotReference(history,current());assert.equal(result.reference.id,'recent');assert.equal(result.pct_change,0.5);
 assert.equal(priorSnapshotReference(history.slice(2),current()).reason,'prior_snapshot_unavailable');
});
test('same-day and later-arriving historical rows cannot alter a prior reference, even within one millisecond',()=>{
 const recent=row('recent','2024-01-09',2000);const base=priorSnapshotReference([recent],current());
 const late={...recent,id:'late',run_time_et:'2024-01-10T09:59:00Z',created_at:'2024-01-10T10:00:00.000002Z',gold_price:1900};
 const sameDay={...row('today','2024-01-10',1900),created_at:'2024-01-10T09:00:00Z',run_time_et:'2024-01-10T08:59:00Z'};
 assert.deepEqual(priorSnapshotReference([late,sameDay,recent],current()),base);
});
test('missing newest prior price remains unavailable instead of choosing an older convenient price',()=>{
 const result=priorSnapshotReference([row('old','2024-01-08',2000),row('new','2024-01-09',null)],current());
 assert.equal(result.reason,'prior_price_missing');assert.equal(result.pct_change,null);
});
test('impact changes only the input hypothesis and retains original output values',()=>{
 const c=current();c.gold_price=2001;const outputs=[{id:'call',snapshot_id:c.id,call_24h_direction:'BULLISH'}];
 const before=structuredClone({outputs,c});
 const r=buildGoldHistoryRepairImpact({outputs},{snapshots:[c]},[row('prior','2024-01-09',2000)]);
 assert.equal(r.f5_signal_changes,1);assert.equal(r.rows[0].counterfactual_f5,'NEUTRAL');
 assert.equal(r.outcome_improvement_tested,false);assert.deepEqual({outputs,c},before);
});
