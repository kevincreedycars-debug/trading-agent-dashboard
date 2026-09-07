#!/usr/bin/env node
const fs=require('node:fs');
const crypto=require('node:crypto');
const {buildGoldHistoryRepairImpact}=require('../lib/gold_history_repair_impact');
function run(args=process.argv.slice(2)) {
 if(args.length!==4) throw new Error('Usage: node backtester/scripts/build_gold_history_repair_impact.js STORED_CALLS.json SNAPSHOT_INPUTS.json SNAPSHOT_HISTORY.json NEW_REPORT.json');
 if(fs.existsSync(args[3]))throw new Error('Use a new report path.');
 const raw=args.slice(0,3).map(p=>fs.readFileSync(p));
 const report=buildGoldHistoryRepairImpact(JSON.parse(raw[0]),JSON.parse(raw[1]),JSON.parse(raw[2]).snapshots);
 const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
 Object.assign(report,{source_calls_sha256:hash(raw[0]),snapshot_inputs_sha256:hash(raw[1]),snapshot_history_sha256:hash(raw[2])});
 fs.writeFileSync(args[3],JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({outputs:report.outputs,evaluable:report.evaluable,f5_signal_changes:report.f5_signal_changes,direction_changes:report.direction_changes},null,2));return report;
}
if(require.main===module){try{run();}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={run};
