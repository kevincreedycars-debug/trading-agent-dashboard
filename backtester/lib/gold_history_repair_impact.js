const {storageTimestamp,storageTimestampNanos}=require('./gold_stored_call_evidence');
const {validDate}=require('./gold_evidence_audit');
const {normalizeMarketPrice,computePctChange}=require('./outcome_evaluation');
const {buildReplayOutput}=require('../replay/gold/gold_replay_core');

function priorSnapshotReference(history,current,lookbackDays=60) {
  if(!validDate(current?.snapshot_date) || storageTimestamp(current?.created_at)===null ||
    !Number.isSafeInteger(lookbackDays) || lookbackDays<=0) throw new Error('Valid current snapshot date, storage time and positive lookback days required.');
  const cutoff=storageTimestampNanos(current.created_at);
  const lower=new Date(Date.parse(current.snapshot_date+'T00:00:00Z')-lookbackDays*86400000).toISOString().slice(0,10);
  const prior=history.filter(row=>validDate(row?.snapshot_date) && row.snapshot_date<current.snapshot_date && row.snapshot_date>=lower &&
    storageTimestampNanos(row.created_at)!==null && storageTimestampNanos(row.created_at)<=cutoff &&
    storageTimestampNanos(row.run_time_et)!==null && storageTimestampNanos(row.run_time_et)<=cutoff);
  prior.sort((a,b)=>b.snapshot_date.localeCompare(a.snapshot_date) || Number(storageTimestampNanos(b.run_time_et)-storageTimestampNanos(a.run_time_et)) || String(b.id).localeCompare(String(a.id)));
  const reference=prior[0];
  if(!reference) return {reference:null,pct_change:null,reason:'prior_snapshot_unavailable'};
  const price=normalizeMarketPrice(reference.gold_price);
  return {reference,pct_change:computePctChange(price,current.gold_price),
    reason:price===null ? 'prior_price_missing' : normalizeMarketPrice(current.gold_price)===null ? 'current_price_missing' : null};
}

function buildGoldHistoryRepairImpact(bundle,inputs,history) {
  const snapshotMap=new Map(inputs.snapshots.map(row=>[row.id,row]));
  if(snapshotMap.size!==inputs.snapshots.length || snapshotMap.has(undefined)) throw new Error('Snapshot input ids must be unique.');
  const ids=new Set();for(const row of history){if(!row?.id || ids.has(row.id)) throw new Error('History ids must be unique.');ids.add(row.id);}
  const rows=bundle.outputs.map(output=>{
    const current=snapshotMap.get(output.snapshot_id);
    if(!current)return {prediction_id:output.id,evaluable:false,reason:'snapshot_input_missing'};
    const reference=priorSnapshotReference(history,current);
    if(reference.reason || reference.pct_change===null)return {prediction_id:output.id,evaluable:false,reason:reference.reason || 'return_invalid'};
    const original=buildReplayOutput(current,output.logic_document_version || 'unknown');
    // Only repair F5's one-day source input. Do not optimize weights or evaluate outcome improvement.
    const repaired=buildReplayOutput({...current,gold_d1_pct:reference.pct_change},output.logic_document_version || 'unknown');
    return {prediction_id:output.id,snapshot_id:current.id,evaluable:true,original_gold_d1_pct:current.gold_d1_pct,
      counterfactual_gold_snapshot_day_pct:reference.pct_change,reference_snapshot_id:reference.reference.id,
      reference_snapshot_date:reference.reference.snapshot_date,reference_created_at:reference.reference.created_at,
      original_f5:original.factor_breakdown.F5.signal,counterfactual_f5:repaired.factor_breakdown.F5.signal,
      original_direction:original.direction_24h,counterfactual_direction:repaired.direction_24h,
      stored_direction:output.call_24h_direction};
  });
  const evaluable=rows.filter(row=>row.evaluable);
  return {version:'gold-history-repair-impact-v1',research_only:true,counterfactual:true,
    outputs:rows.length,evaluable:evaluable.length,rejected:rows.length-evaluable.length,
    f5_signal_changes:evaluable.filter(row=>row.original_f5!==row.counterfactual_f5).length,
    direction_changes:evaluable.filter(row=>row.original_direction!==row.counterfactual_direction).length,
    outcome_improvement_tested:false,weights_changed:false,historical_outputs_rewritten:false,
    methodology:'Replace only gold_d1_pct with percent change from the latest prior snapshot date stored by the current snapshot storage-time cutoff, bounded to 60 calendar days; replay unchanged weights.',
    limitations:['This is a counterfactual input-impact diagnostic, not a replacement historical call or an estimate of improved performance.',
      'Prior snapshot day is not an authenticated daily market close or a trading-day calendar.',
      'Storage times are availability proxies and the current warehouse is not an immutable historical log.',
      'Other source defects and shorter-history fallbacks are not repaired by this diagnostic.'],rows};
}
module.exports={priorSnapshotReference,buildGoldHistoryRepairImpact};
