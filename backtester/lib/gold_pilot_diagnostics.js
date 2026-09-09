const {parseTimestamp}=require('./gold_timestamped_evaluation');

function summarizePilotRows(rows) {
  const count=result=>rows.filter(row=>row.result===result).length;
  const correct=count('CORRECT'),wrong=count('WRONG');
  const scored=rows.filter(row=>['CORRECT','WRONG'].includes(row.result));
  const bullish=scored.filter(row=>row.market_outcome_direction==='BULLISH').length;
  return {calls:rows.length,evaluable:rows.filter(row=>row.evaluable).length,correct,wrong,
    flat:count('FLAT'),no_call:count('NO_CALL'),not_evaluable:count('NOT_EVALUABLE'),
    directional_accuracy_ex_flat_pct:scored.length ? 100*correct/scored.length : null,
    baseline_same_scored_calls:{samples:scored.length,always_bullish_correct:bullish,always_bearish_correct:scored.length-bullish,
      always_bullish_accuracy_pct:scored.length ? 100*bullish/scored.length : null,
      always_bearish_accuracy_pct:scored.length ? 100*(scored.length-bullish)/scored.length : null}};
}

function buildGoldPilotDiagnostics(dataset,evaluation,plan) {
  if(dataset.calls.length!==evaluation.rows.length || dataset.calls.some((call,i)=>call.prediction_id!==evaluation.rows[i].prediction_id)) throw new Error('Evaluation rows must align with source calls.');
  const split=parseTimestamp(plan.split_at),validationStart=split+plan.embargo_ms;
  const entries=dataset.calls.map((call,i)=>({call,index:i,row:evaluation.rows[i],start:parseTimestamp(call.call_time),end:parseTimestamp(call.horizon_end)}));
  const summarize=items=>summarizePilotRows(items.map(item=>item.row));
  const groups=(keyOf)=>{
    const map=new Map();
    for(const item of entries) {const key=keyOf(item);if(!map.has(key)) map.set(key,[]);map.get(key).push(item);}
    return [...map.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([key,items])=>({key,...summarize(items)}));
  };
  // Select using source timestamps only, before considering outcome availability.
  const ordered=entries.filter(item=>item.start!==null && item.end!==null && item.end>item.start)
    .sort((a,b)=>a.start-b.start || String(a.call.prediction_id).localeCompare(String(b.call.prediction_id)));
  let occupiedUntil=-Infinity;
  const selected=[],excluded=[];
  for(const item of ordered) {
    if(item.start<occupiedUntil) excluded.push(item.call.prediction_id);
    else {selected.push(item);occupiedUntil=item.end;}
  }
  const firstBySnapshot=new Map();
  // Horizon validity and outcome must not replace an earlier recorded decision.
  const snapshotOrdered=entries.filter(item=>item.start!==null)
    .sort((a,b)=>a.start-b.start || (String(a.call.prediction_id)<String(b.call.prediction_id) ? -1 :
      String(a.call.prediction_id)>String(b.call.prediction_id) ? 1 : a.index-b.index));
  for(const item of snapshotOrdered) if(item.call.source_snapshot_id && !firstBySnapshot.has(item.call.source_snapshot_id)) firstBySnapshot.set(item.call.source_snapshot_id,item);
  const snapshotSelected=[...firstBySnapshot.values()];
  const selectedIndices=new Set(snapshotSelected.map(item=>item.index));
  return {overall:summarize(entries),
    training:summarize(entries.filter(item=>item.end!==null && item.end<=split)),
    validation:summarize(entries.filter(item=>item.start!==null && item.start>=validationStart)),
    earliest_per_snapshot:{...summarize(snapshotSelected),
      selection_version:'gold-earliest-snapshot-v2',
      selected_prediction_ids:snapshotSelected.map(item=>item.call.prediction_id),
      selected_source_indices:snapshotSelected.map(item=>item.index),
      excluded:entries.filter(item=>!selectedIndices.has(item.index)).map(item=>({source_index:item.index,
        prediction_id:item.call.prediction_id,reason:!item.call.source_snapshot_id ? 'snapshot_id_missing' :
          item.start===null ? 'decision_timestamp_invalid' : 'later_or_tied_snapshot_call'})),
      selection:'Earliest parsed decision per snapshot; ties use prediction ID code-unit order then source index. Invalid decisions excluded; invalid horizons and rejected outcomes retained.'},
    nonoverlapping_schedule:{...summarize(selected),selected_prediction_ids:selected.map(item=>item.call.prediction_id),
      overlapping_calls_excluded:excluded.length,excluded_prediction_ids:excluded,
      selection:'Greedy earliest source decision, retaining unavailable outcomes; skip decisions before retained horizon. This does not prove independent market trials.'},
    by_storage_month:groups(item=>item.call.call_time?.slice(0,7) || 'invalid'),
    by_call_direction:groups(item=>String(item.call.direction)),
    path:{endpoint_evaluable_with_interior_gaps:evaluation.rows.filter(row=>row.evaluable && row.observed_path_complete===false).length,
      interpretation:'Interior gaps remain unclassified; endpoint accuracy does not establish target/stop sequencing.'},
    limitations:['Cohort checks are descriptive and were added after the initial aggregate was observed; they are not new holdout trials.',
      'Constant-direction baselines use the same CORRECT/WRONG subset; flats, no-calls and rejected calls are excluded from both.',
      'Earliest-snapshot and nonoverlap selection occur before outcome filtering; rejected selected calls are not replaced.']};
}
module.exports={summarizePilotRows,buildGoldPilotDiagnostics};
