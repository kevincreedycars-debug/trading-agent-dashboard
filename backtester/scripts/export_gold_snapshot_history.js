#!/usr/bin/env node
const fs=require('node:fs');
const crypto=require('node:crypto');
const {parseTimestamp}=require('../lib/gold_timestamped_evaluation');
const {readRows}=require('./export_gold_stored_calls');
async function run(args=process.argv.slice(2)) {
 if(args.length!==2 || parseTimestamp(args[0])===null)throw new Error('Usage: node backtester/scripts/export_gold_snapshot_history.js AS_OF_ISO NEW_OUTPUT.json');
 if(fs.existsSync(args[1]))throw new Error('Use a new output path.');
 if(!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Supabase environment variables required.');
 const snapshots=await readRows('market_snapshots',{created_at:'lte.'+args[0],select:'id,created_at,run_time_et,snapshot_date,gold_price'});
 const raw=JSON.stringify({retrieved_at:new Date().toISOString(),storage_cutoff:args[0],snapshots},null,2)+'\n';
 fs.writeFileSync(args[1],raw,{flag:'wx'});
 console.log(JSON.stringify({snapshots:snapshots.length,sha256:crypto.createHash('sha256').update(raw).digest('hex')}));
}
if(require.main===module)run().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={run};
