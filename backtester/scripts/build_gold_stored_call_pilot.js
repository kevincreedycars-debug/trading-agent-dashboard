#!/usr/bin/env node
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {buildGoldTimestampedReport}=require('../lib/gold_timestamped_evaluation');
const {buildGoldChronologicalFactors}=require('../lib/gold_chronological_factors');
const {summarizePilotRows:summarize,buildGoldPilotDiagnostics}=require('../lib/gold_pilot_diagnostics');

function run(args=process.argv.slice(2)) {
  if(args.length!==3) throw new Error('Usage: node backtester/scripts/build_gold_stored_call_pilot.js DATASET.json ANALYSIS_PROTOCOL.json NEW_REPORT.json');
  const output=path.resolve(args[2]);
  if(fs.existsSync(output)) throw new Error('Use a new report path to preserve earlier results.');
  const raw=fs.readFileSync(args[0]), planRaw=fs.readFileSync(args[1]);
  const dataset=JSON.parse(raw),plan=JSON.parse(planRaw);
  if(!plan.id || !plan.recorded_at || JSON.stringify(plan.coverage_policies)!==JSON.stringify(['contiguous','exact_endpoints'])) throw new Error('Explicit contiguous and endpoint analysis protocol required.');
  const strict=buildGoldTimestampedReport({...dataset,config:{...dataset.config,coverage_policy:'contiguous'}});
  const endpointDataset={...dataset,config:{...dataset.config,coverage_policy:'exact_endpoints'}};
  const endpoints=buildGoldTimestampedReport(endpointDataset);
  const chronological=buildGoldChronologicalFactors(endpointDataset,plan);
  const diagnostics=buildGoldPilotDiagnostics(dataset,endpoints,plan);
  const report={version:'gold-stored-call-pilot-v2',generated_at:new Date().toISOString(),research_only:true,
    data_kind:dataset.data_kind,source_dataset_sha256:crypto.createHash('sha256').update(raw).digest('hex'),
    analysis_protocol_sha256:crypto.createHash('sha256').update(planRaw).digest('hex'),analysis_protocol:plan,
    protocol:dataset.protocol,candles:dataset.candles.length,
    strict_summary:summarize(strict.rows),endpoint_summary:summarize(endpoints.rows),
    earliest_per_snapshot_summary:diagnostics.earliest_per_snapshot,
    interpretation:'Recorded Gold 24H directions compared with OANDA next-minute-after-storage to 24 elapsed-hour endpoints. Storage is not authenticated dashboard publication. Endpoint results do not validate the trade path.',
    executable_trade_validated:false,untouched_holdout_claimed:false,weight_changes_proposed:false,
    diagnostics,strict,endpoints,chronological};
  fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({output,strict:report.strict_summary,endpoints:report.endpoint_summary,
    strict_reasons:strict.reason_counts,endpoint_reasons:endpoints.reason_counts,chronological:chronological.coverage},null,2));
  return report;
}
if(require.main===module) {try {run();} catch(error) {console.error(error.message);process.exitCode=1;}}
module.exports={run,summarize};
