#!/usr/bin/env node
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {goldDownloadWindows,normalizeGoldOandaPayload,combineGoldOandaPages}=require('../lib/gold_oanda_candles');
const hash=raw=>crypto.createHash('sha256').update(raw).digest('hex');

async function run(args=process.argv.slice(2)) {
  if(args.length!==2) throw new Error('Usage: node backtester/scripts/download_gold_timestamped_candles.js DATASET.json NEW_OUTPUT_DIRECTORY');
  if(!process.env.OANDA_API_TOKEN) throw new Error('OANDA_API_TOKEN required.');
  const raw=fs.readFileSync(args[0]);
  const dataset=JSON.parse(raw);
  if(dataset.config?.candle_interval_ms!==60000 || dataset.config?.price_basis!=='mid' || !Array.isArray(dataset.calls)) throw new Error('Expected one-minute mid-price dataset.');
  const directory=path.resolve(args[1]);
  if(fs.existsSync(directory)) throw new Error('Use a new output directory to preserve evidence.');
  const asOf=new Date().toISOString();
  const windows=goldDownloadWindows(dataset.calls,asOf);
  fs.mkdirSync(directory,{recursive:true});
  const manifest={version:'gold-oanda-acquisition-v1',started_at:asOf,source_dataset_sha256:hash(raw),
    endpoint:'https://api-fxtrade.oanda.com/v3/instruments/XAU_USD/candles',
    price:'MBA',granularity:'M1',smooth:false,requests:[],complete:false};
  const save=()=>fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  save();
  const pages=[];
  for(const [index,window] of windows.entries()) {
    const url=new URL(manifest.endpoint);
    for(const [key,value] of Object.entries({...window,price:'MBA',granularity:'M1',smooth:'false',includeFirst:'true'})) url.searchParams.set(key,value);
    const response=await fetch(url,{headers:{Authorization:'Bearer '+process.env.OANDA_API_TOKEN},signal:AbortSignal.timeout(30000)});
    if(!response.ok) throw new Error(`OANDA candle request ${index+1} failed: HTTP ${response.status}. Partial evidence retained.`);
    const body=await response.text();
    const payload=JSON.parse(body);
    for(const basis of ['mid','bid','ask']) normalizeGoldOandaPayload(payload,basis);
    const name=`oanda-${String(index+1).padStart(3,'0')}.json`;
    fs.writeFileSync(path.join(directory,name),body,{flag:'wx'});
    manifest.requests.push({...window,file:name,sha256:hash(body),retrieved_at:new Date().toISOString(),candles:payload.candles.length});
    save();pages.push(payload);
    console.log(JSON.stringify({request:index+1,total:windows.length,candles:payload.candles.length}));
  }
  const normalized=combineGoldOandaPages(pages);
  const result={...dataset,candles:normalized.candles,candle_acquisition:{source_dataset_sha256:hash(raw),as_of:asOf,
    source:'OANDA v20 XAU_USD M1',identical_boundary_duplicates:normalized.identical_boundary_duplicates,
    incomplete_candles_excluded:normalized.incomplete_candle_times.length}};
  const output=JSON.stringify(result)+'\n';
  fs.writeFileSync(path.join(directory,'dataset.json'),output,{flag:'wx'});
  manifest.complete=true;manifest.completed_at=new Date().toISOString();manifest.candles=normalized.candles.length;
  manifest.output_sha256=hash(output);save();
  console.log(JSON.stringify({directory,calls:dataset.calls.length,candles:manifest.candles,output_sha256:manifest.output_sha256},null,2));
}
if(require.main===module) run().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={run};
