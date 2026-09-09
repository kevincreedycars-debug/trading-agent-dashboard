const test=require('node:test');
const assert=require('node:assert/strict');
const {buildGoldPilotDiagnostics,summarizePilotRows}=require('../lib/gold_pilot_diagnostics');
test('constant-direction baselines use exactly the scored calls',()=>{
 const r=summarizePilotRows([{result:'CORRECT',evaluable:true,market_outcome_direction:'BEARISH'},
 {result:'WRONG',evaluable:true,market_outcome_direction:'BULLISH'},
 {result:'NO_CALL',evaluable:true,market_outcome_direction:'BULLISH'},
 {result:'FLAT',evaluable:true,market_outcome_direction:'FLAT'},{result:'NOT_EVALUABLE',evaluable:false}]);
 assert.equal(r.baseline_same_scored_calls.samples,2);assert.equal(r.directional_accuracy_ex_flat_pct,50);
 assert.equal(r.baseline_same_scored_calls.always_bullish_accuracy_pct,50);assert.equal(r.not_evaluable,1);
});
test('nonoverlap and earliest snapshot selection never replace a rejected call with a successful later call',()=>{
 const dataset={calls:[{prediction_id:'early',source_snapshot_id:'s1',call_time:'2024-01-08T10:00:00Z',horizon_end:'2024-01-08T12:00:00Z'},
 {prediction_id:'later',source_snapshot_id:'s1',call_time:'2024-01-08T11:00:00Z',horizon_end:'2024-01-08T13:00:00Z'},
 {prediction_id:'next',source_snapshot_id:'s2',call_time:'2024-01-08T12:00:00Z',horizon_end:'2024-01-08T14:00:00Z'}]};
 const evaluation={rows:[{prediction_id:'early',result:'NOT_EVALUABLE',evaluable:false},
 {prediction_id:'later',result:'CORRECT',evaluable:true,market_outcome_direction:'BULLISH'},
 {prediction_id:'next',result:'WRONG',evaluable:true,market_outcome_direction:'BEARISH'}]};
 const r=buildGoldPilotDiagnostics(dataset,evaluation,{split_at:'2024-01-08T12:00:00Z',embargo_ms:0});
 assert.deepEqual(r.nonoverlapping_schedule.selected_prediction_ids,['early','next']);
 assert.equal(r.nonoverlapping_schedule.not_evaluable,1);assert.equal(r.earliest_per_snapshot.correct,0);
 assert.equal(r.training.not_evaluable,1);assert.equal(r.validation.wrong,1);
 evaluation.rows.reverse();assert.throws(()=>buildGoldPilotDiagnostics(dataset,evaluation,{}),/align/);
});


test('snapshot selection uses absolute decisions, deterministic ties and retains invalid horizons', () => {
 const calls = [
  {prediction_id:'later',source_snapshot_id:'s1',call_time:'2024-01-08T09:00:00-05:00',horizon_end:'2024-01-08T15:00:00Z'},
  {prediction_id:'early',source_snapshot_id:'s1',call_time:'2024-01-08T13:00:00Z',horizon_end:'invalid'},
  {prediction_id:'z',source_snapshot_id:'s2',call_time:'2024-01-08T14:00:00Z',horizon_end:'2024-01-08T15:00:00Z'},
  {prediction_id:'a',source_snapshot_id:'s2',call_time:'2024-01-08T09:00:00-05:00',horizon_end:'2024-01-08T15:00:00Z'},
  {prediction_id:'bad',source_snapshot_id:'s3',call_time:'invalid'},
  {prediction_id:'unlinked',call_time:'2024-01-08T14:00:00Z'}
 ];
 const evaluate = calls => buildGoldPilotDiagnostics({calls}, {rows:calls.map(call=>({prediction_id:call.prediction_id,
  result:call.prediction_id==='later' ? 'CORRECT' : 'NOT_EVALUABLE',evaluable:call.prediction_id==='later'}))},
  {split_at:'2024-01-08T14:00:00Z',embargo_ms:0}).earliest_per_snapshot;
 const result = evaluate(calls);
 assert.deepEqual(result.selected_prediction_ids,['early','a']);
 assert.deepEqual(result.selected_source_indices,[1,3]);
 assert.equal(result.not_evaluable,2);
 assert.equal(result.calls + result.excluded.length,calls.length);
 assert.deepEqual(result.excluded.map(row=>row.reason),['later_or_tied_snapshot_call','later_or_tied_snapshot_call','decision_timestamp_invalid','snapshot_id_missing']);
 assert.deepEqual(evaluate([...calls].reverse()).selected_prediction_ids,result.selected_prediction_ids);
});
