#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { prepareGoldStoredCalls } = require('../lib/gold_stored_call_evidence');

async function readRows(table, query) {
  const rows = [];
  for (let offset=0;;offset+=500) {
    const url = new URL('/rest/v1/'+table,process.env.SUPABASE_URL);
    for (const [key,value] of Object.entries({...query,order:query.order || 'id.asc',offset,limit:500})) url.searchParams.set(key,String(value));
    const response = await fetch(url,{headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY},signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error(`Read-only ${table} request failed: HTTP ${response.status}`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error('Expected row array.');
    rows.push(...page);
    if (page.length<500) break;
  }
  return rows;
}
async function run(args=process.argv.slice(2)) {
  if (args.length!==2) throw new Error('Usage: node backtester/scripts/export_gold_stored_calls.js PROTOCOL.json NEW_OUTPUT_DIRECTORY');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase environment variables required.');
  const protocol = JSON.parse(fs.readFileSync(args[0],'utf8'));
  prepareGoldStoredCalls({outputs:[],snapshots:[]},protocol);
  const directory = path.resolve(args[1]);
  if (fs.existsSync(directory)) throw new Error('Use a new output directory to preserve previous evidence.');
  const asOf = new Date().toISOString();
  const outputs = await readRows('agent_outputs',{agent_name:'eq.GOLD',created_at:`lte.${asOf}`,
    select:'id,snapshot_id,agent_name,layer,created_at,run_time_et,call_24h_direction,factor_breakdown,logic_document_version'});
  const ids=[...new Set(outputs.map(row=>row.snapshot_id).filter(Boolean))];
  const snapshots=[];
  for (let i=0;i<ids.length;i+=50) {
    snapshots.push(...await readRows('market_snapshots',{id:`in.(${ids.slice(i,i+50).join(',')})`,
      select:'id,created_at,run_time_et,snapshot_date,collector_version,source_status,us_10y_real_yield_d5_bps,dxy_d1,dxy_d5,gold_d1_pct,gold_d5_pct,gold_price,us_2y_d5_bps,vix_level,fed_bias,global_growth_regime,geopolitical_risk_flag,latest_us_event'}));
  }
  const bundle={retrieved_at:asOf,outputs,snapshots};
  const raw=JSON.stringify(bundle,null,2)+'\n';
  const sha=crypto.createHash('sha256').update(raw).digest('hex');
  const {audit,dataset}=prepareGoldStoredCalls(bundle,protocol);
  audit.source_sha256=sha; dataset.source_sha256=sha;
  fs.mkdirSync(directory,{recursive:true});
  for(const [name,value] of Object.entries({'stored-calls.json':raw,
    'snapshot-inputs.json':JSON.stringify({retrieved_at:asOf,snapshots},null,2)+'\n',
    'audit.json':JSON.stringify(audit,null,2)+'\n','dataset.json':JSON.stringify(dataset,null,2)+'\n'})) fs.writeFileSync(path.join(directory,name),value,{flag:'wx'});
  console.log(JSON.stringify({directory,...audit},null,2));
}
if(require.main===module) run().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={run,readRows};
