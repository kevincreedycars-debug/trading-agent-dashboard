const {buildReplayOutput}=require('../replay/gold/gold_replay_core');
const {normalizeMarketPrice}=require('./outcome_evaluation');

function auditGoldSnapshotLineage(bundle,inputBundle) {
  if(!Array.isArray(bundle?.outputs) || !Array.isArray(inputBundle?.snapshots)) throw new Error('Stored outputs and snapshot inputs required.');
  const snapshots=new Map();
  for(const snapshot of inputBundle.snapshots) {
    if(!snapshot?.id || snapshots.has(snapshot.id)) throw new Error('Snapshot input ids must be unique.');
    snapshots.set(snapshot.id,snapshot);
  }
  const mismatches=[],missing=[];
  for(const output of bundle.outputs) {
    const snapshot=snapshots.get(output.snapshot_id);
    if(!snapshot) {missing.push(output.id);continue;}
    const replay=buildReplayOutput(snapshot,output.logic_document_version || 'unknown');
    const factorMismatches=Array.from({length:10},(_,i)=>`F${i+1}`).filter(f=>output.factor_breakdown?.[f]?.signal!==replay.factor_breakdown[f]?.signal);
    if(output.call_24h_direction!==replay.direction_24h || factorMismatches.length) mismatches.push({prediction_id:output.id,
      stored_direction:output.call_24h_direction,replayed_direction:replay.direction_24h,factor_mismatches:factorMismatches});
  }
  const references=new Map();
  for(const snapshot of snapshots.values()) {
    const price=normalizeMarketPrice(snapshot.gold_price),delta=snapshot.gold_d1_pct;
    if(price===null || typeof delta!=='number' || !Number.isFinite(delta) || delta<=-100) continue;
    const implied=price/(1+delta/100);
    if(!Number.isFinite(implied)) continue;
    const key=implied.toFixed(6);
    if(!references.has(key)) references.set(key,[]);
    references.get(key).push(snapshot);
  }
  return {version:'gold-snapshot-lineage-audit-v1',research_only:true,outputs:bundle.outputs.length,
    linked_snapshot_inputs:snapshots.size,replayed_outputs:bundle.outputs.length-missing.length,
    replay_mismatches:mismatches.length,mismatches,missing_snapshot_prediction_ids:missing,
    implied_d1_reference_groups:[...references].map(([price,rows])=>{
      const dates=rows.map(row=>row.snapshot_date).sort();
      return {implied_reference_price:Number(price),snapshots:rows.length,first_snapshot_date:dates[0],last_snapshot_date:dates.at(-1),
        snapshot_ids:rows.map(row=>row.id).sort()};
    }).sort((a,b)=>b.snapshots-a.snapshots || a.implied_reference_price-b.implied_reference_price),
    interpretation:'Replay parity tests recorded directions/signals against the retrieved linked inputs. Implied prior price = current price / (1 + stored d1 percent / 100). A persistent reference is a diagnostic, not a corrected history.',
    raw_feature_release_times_verified:false,historical_snapshots_rewritten:false};
}
module.exports={auditGoldSnapshotLineage};
