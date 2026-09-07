#!/usr/bin/env node
const fs=require('node:fs');
const crypto=require('node:crypto');
const {auditGoldSnapshotLineage}=require('../lib/gold_snapshot_lineage_audit');
function run(args=process.argv.slice(2)) {
 if(args.length!==3)throw new Error('Usage: node backtester/scripts/build_gold_snapshot_lineage_audit.js STORED_CALLS.json SNAPSHOT_INPUTS.json NEW_REPORT.json');
 if(fs.existsSync(args[2]))throw new Error('Use a new report path.');
 const source=fs.readFileSync(args[0]),inputs=fs.readFileSync(args[1]);
 const report=auditGoldSnapshotLineage(JSON.parse(source),JSON.parse(inputs));
 report.source_sha256=crypto.createHash('sha256').update(source).digest('hex');
 report.snapshot_inputs_sha256=crypto.createHash('sha256').update(inputs).digest('hex');
 fs.writeFileSync(args[2],JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({outputs:report.outputs,replay_mismatches:report.replay_mismatches,
  reference_groups:report.implied_d1_reference_groups.map(({snapshot_ids,...row})=>row)},null,2));return report;
}
if(require.main===module){try{run();}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={run};
