const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {readRows}=require('../scripts/export_gold_stored_calls');
const {run:download}=require('../scripts/download_gold_timestamped_candles');
const {run:pilot}=require('../scripts/build_gold_stored_call_pilot');
const root=path.resolve(__dirname,'../..');

test('read-only warehouse paging retains all rows and preserves explicit ordering',async()=>{
 const previousFetch=global.fetch,previousUrl=process.env.SUPABASE_URL,previousKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const requests=[];process.env.SUPABASE_URL='https://example.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';
 global.fetch=async(url,options)=>{requests.push({url:new URL(url),options});const offset=Number(new URL(url).searchParams.get('offset'));
   return {ok:true,json:async()=>offset===0?Array.from({length:500},(_,id)=>({id})):Array.from({length:43},(_,i)=>({id:500+i}))};};
 try {const rows=await readRows('market_snapshots',{order:'snapshot_date.desc,run_time_et.desc,id.desc'});
  assert.equal(rows.length,543);assert.equal(rows.at(-1).id,542);assert.equal(requests.length,2);
  assert.equal(requests[1].url.searchParams.get('offset'),'500');
  for(const request of requests){assert.equal(request.options.method,undefined);assert.equal(request.url.searchParams.get('order'),'snapshot_date.desc,run_time_et.desc,id.desc');}
 }finally{global.fetch=previousFetch;if(previousUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=previousUrl;
  if(previousKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=previousKey;}
});

test('draft history query selects the verified date window and server ordering without a row cap',()=>{
 const draft=require('../drafts/gold_collector_history_query_patch.json');
 const date=timestamp=>({toUTC(){return this;},toISODate(){return new Date(timestamp).toISOString().slice(0,10);},minus({days}){return date(timestamp-days*86400000);}});
 const expression=draft.replacement_parameters.filterString.slice(3,-2).trim();
 const result=vm.runInNewContext(expression,{$now:date(Date.parse('2026-09-06T12:00:00Z'))});
 const query=new URLSearchParams(result);
 assert.equal(query.get('and'),'(snapshot_date.lt.2026-09-06,snapshot_date.gte.2026-07-08)');
 assert.equal(query.get('order'),'snapshot_date.desc,run_time_et.desc,id.desc');
 assert.equal(draft.replacement_parameters.returnAll,true);assert.equal(query.has('limit'),false);
 assert.equal(draft.status,'LOCAL_REVIEW_ONLY_NOT_APPLIED');
});

test('acquisition keeps raw bid/ask/mid evidence and refuses to overwrite its source directory',async()=>{
 const directory=fs.mkdtempSync(path.join(root,'backtester/tmp/gold-acquisition-test-'));
 const source=path.join(directory,'source.json'),output=path.join(directory,'download');
 const dataset=structuredClone(require('../fixtures/gold_timestamped.synthetic.json'));
 dataset.calls=[{...dataset.calls[0],horizon_end:'2024-01-08T14:01:00Z'}];dataset.config.candle_interval_ms=60000;dataset.config.price_basis='mid';
 fs.writeFileSync(source,JSON.stringify(dataset));
 const rawPage={instrument:'XAU_USD',granularity:'M1',candles:[{time:'2024-01-08T14:00:00.000000000Z',complete:true,
  bid:{o:'1999',h:'2001',l:'1998',c:'2000'},mid:{o:'2000',h:'2002',l:'1999',c:'2001'},ask:{o:'2001',h:'2003',l:'2000',c:'2002'}}]};
 const oldFetch=global.fetch,oldToken=process.env.OANDA_API_TOKEN;process.env.OANDA_API_TOKEN='test-only';
 global.fetch=async(url,options)=>{assert.equal(new URL(url).searchParams.get('price'),'MBA');assert.equal(options.method,undefined);return {ok:true,text:async()=>JSON.stringify(rawPage)};};
 try{await download([source,output]);const manifest=JSON.parse(fs.readFileSync(path.join(output,'manifest.json')));
  assert.equal(manifest.complete,true);assert.equal(manifest.candles,1);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output,'oanda-001.json'))),rawPage);
  assert.equal(fs.readFileSync(path.join(output,'manifest.json'),'utf8').includes('test-only'),false);
  await assert.rejects(download([source,output]),/new output directory/);
 }finally{global.fetch=oldFetch;if(oldToken===undefined)delete process.env.OANDA_API_TOKEN;else process.env.OANDA_API_TOKEN=oldToken;}
});

test('pilot command emits both coverage policies and preserves existing reports',()=>{
 const directory=fs.mkdtempSync(path.join(root,'backtester/tmp/gold-pilot-test-'));
 const source=path.join(directory,'source.json'),planPath=path.join(directory,'plan.json'),output=path.join(directory,'pilot.json');
 const data=structuredClone(require('../fixtures/gold_timestamped.synthetic.json'));
 data.calls.forEach(call=>call.source_snapshot_id='shared');
 fs.writeFileSync(source,JSON.stringify(data));
 fs.writeFileSync(planPath,JSON.stringify({id:'test',recorded_at:'2024-01-01T00:00:00Z',coverage_policies:['contiguous','exact_endpoints'],split_at:'2024-01-08T15:00:00Z',embargo_ms:0}));
 const report=pilot([source,planPath,output]);assert.equal(report.strict_summary.evaluable,2);assert.equal(report.endpoint_summary.evaluable,2);
 assert.deepEqual(report.earliest_per_snapshot_summary,report.diagnostics.earliest_per_snapshot);
 assert.deepEqual(report.earliest_per_snapshot_summary.selected_prediction_ids,['synthetic-1']);
 assert.equal(report.untouched_holdout_claimed,false);assert.equal(report.chronological.pairs.length,45);
 assert.throws(()=>pilot([source,planPath,output]),/new report path/);
});
