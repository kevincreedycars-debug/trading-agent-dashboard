const test=require('node:test'),assert=require('node:assert/strict');
const {codexRecords,clineRecords,claudeRecords,dayOf}=require('../scripts/token-usage');
test('Codex cumulative counters become deltas; cache/reasoning are not added twice',()=>{
 const event=(timestamp,total)=>JSON.stringify({timestamp,type:'event_msg',payload:{type:'token_count',info:{total_token_usage:{input_tokens:total-10,output_tokens:10,total_tokens:total,cached_input_tokens:40,reasoning_output_tokens:5}}}});
 const a=event('2026-09-19T22:00:00Z',100),b=event('2026-09-20T10:00:00Z',160),c=event('2026-09-20T10:10:00Z',200);
 const rows=codexRecords([a,b,b,c,'{"partial"'].join('\n'),'2026-09-20');assert.equal(rows.reduce((s,r)=>s+r.total,0),100);assert.equal(rows.length,2);
});
test('Cline separates cache input, keeps final request record and uses provider metadata',()=>{
 const ts=Date.parse('2026-09-20T10:00Z');const row=n=>({ts,say:'api_req_started',text:JSON.stringify({tokensIn:10,tokensOut:n,cacheReads:100,cacheWrites:20})});
 const result=clineRecords(JSON.stringify([row(1),row(5)]),'2026-09-20',{model_usage:[{ts:ts-1,model_provider_id:'deepseek'}]});assert.equal(result.length,1);assert.equal(result[0].total,135);assert.equal(result[0].cached,100);assert.equal(result[0].provider,'Cline / deepseek');assert.match(result[0].project,/Unmapped/);
});
test('Claude streaming repeats do not multiply message usage',()=>{const row=n=>JSON.stringify({timestamp:'2026-09-20T10:00Z',type:'assistant',message:{id:'one',usage:{input_tokens:10,cache_read_input_tokens:100,cache_creation_input_tokens:20,output_tokens:n}}});const result=claudeRecords([row(1),row(4)].join('\n'),'2026-09-20');assert.equal(result.length,1);assert.equal(result[0].total,134);});
test('today follows London DST rather than UTC midnight',()=>{assert.equal(dayOf('2026-09-19T23:30Z'),'2026-09-20');});
