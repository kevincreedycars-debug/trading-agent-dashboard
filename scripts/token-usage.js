'use strict';
// Local usage counters only. Never reads credentials, sends requests or stores prompt text.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const ZONE='Europe/London';
const number=v=>Number.isFinite(v)&&v>=0?v:0;
function dayOf(time){const d=new Date(time);if(!Number.isFinite(d.getTime()))return null;return new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
function codexRecords(text,day){
  let cwd='Unmapped Codex session',id='',previous=null;const rows=[],seen=new Set();
  for(const line of text.split('\n')){if(!line.trim())continue;let x;try{x=JSON.parse(line);}catch{continue;}
    if(x.type==='session_meta'){cwd=x.payload?.cwd||cwd;id=x.payload?.id||id;}
    if(x.type!=='event_msg'||x.payload?.type!=='token_count')continue;
    const u=x.payload.info?.total_token_usage;if(!u)continue;
    const key=[id,x.timestamp,u.total_tokens,u.input_tokens,u.output_tokens].join(':');if(seen.has(key))continue;seen.add(key);
    const current={input:number(u.input_tokens),output:number(u.output_tokens),cached:number(u.cached_input_tokens),total:number(u.total_tokens)};
    if(!Number.isFinite(u.total_tokens))current.total=current.input+current.output;
    const reset=previous&&current.total<previous.total;
    const delta={};for(const k of Object.keys(current))delta[k]=Math.max(0,current[k]-(previous&&!reset?previous[k]:0));
    previous=current;
    if(dayOf(x.timestamp)===day)rows.push({provider:'Codex',project:cwd,id:key,time:x.timestamp,...delta});
  }return rows;
}
function clineRecords(text,day,metadata={}){
  const messages=JSON.parse(text),unique=new Map();if(!Array.isArray(messages))throw new Error('Unexpected Cline message schema');
  for(const m of messages){if(m.say!=='api_req_started'||dayOf(m.ts)!==day)continue;let u;try{u=JSON.parse(m.text);}catch{continue;}
    if(![u.tokensIn,u.tokensOut,u.cacheReads,u.cacheWrites].some(Number.isFinite))continue;
    const models=(metadata.model_usage||[]).filter(x=>x.ts<=m.ts).sort((a,b)=>b.ts-a.ts);
    const model=models[0]||{};const env=(metadata.environment_history||[]).filter(x=>x.ts<=m.ts).sort((a,b)=>b.ts-a.ts)[0]||{};
    const input=number(u.tokensIn)+number(u.cacheReads)+number(u.cacheWrites),output=number(u.tokensOut);
    unique.set(String(m.ts),{provider:'Cline / '+(model.model_provider_id||'unknown provider'),project:env.cwd||env.workspaceRoot||metadata.workspaceRoot||'Unmapped Cline task',id:String(m.ts),time:new Date(m.ts).toISOString(),input,output,cached:number(u.cacheReads),total:input+output});
  }return [...unique.values()];
}
function claudeRecords(text,day){const unique=new Map();for(const line of text.split('\n')){let x;try{x=JSON.parse(line);}catch{continue;}
  if(x.type!=='assistant'||!x.message?.usage||dayOf(x.timestamp)!==day)continue;const u=x.message.usage,id=x.message.id||x.requestId;if(!id)continue;
  const input=number(u.input_tokens)+number(u.cache_creation_input_tokens)+number(u.cache_read_input_tokens),output=number(u.output_tokens);
  const row={provider:'Claude Code',project:x.cwd||'Unmapped Claude session',id,time:x.timestamp,input,output,cached:number(u.cache_read_input_tokens),total:input+output};
  const old=unique.get(id);if(!old||row.total>=old.total)unique.set(id,row);
}return [...unique.values()];}
function filesBelow(directory,extension){if(!fs.existsSync(directory))return [];return fs.readdirSync(directory,{withFileTypes:true}).flatMap(e=>e.isSymbolicLink()?[]:e.isDirectory()?filesBelow(path.join(directory,e.name),extension):e.name.endsWith(extension)?[path.join(directory,e.name)]:[]);}
function usageSnapshot(root,now=Date.now(),sources){
  const cachePath=path.join(root,'.local/project-monitor/token-cache.json');const day=dayOf(now);let cache={files:{}};
  try{cache=JSON.parse(fs.readFileSync(cachePath,'utf8'));}catch{}
  if(!sources&&cache.day===day&&now-cache.scanned_ms<30000&&cache.result)return cache.result;
  if(!cache.files)cache.files={};
  const home=os.homedir(),appdata=process.env.APPDATA||path.join(home,'AppData/Roaming');
  sources=sources||[{name:'Codex',type:'codex',directories:[path.join(process.env.CODEX_HOME||path.join(home,'.codex'),'sessions'),path.join(process.env.CODEX_HOME||path.join(home,'.codex'),'archived_sessions')]},{name:'Cline / DeepSeek',type:'cline',directories:[path.join(appdata,'Code/User/globalStorage/saoudrizwan.claude-dev/tasks')]},{name:'Claude Code',type:'claude',directories:[path.join(home,'.claude/projects')]}];
  const rows=[],coverage=[],errors=[],dedup=new Set();
  for(const source of sources){let count=0;const available=source.directories.some(d=>fs.existsSync(d));
    try{for(const directory of source.directories)for(const file of filesBelow(directory,source.type==='cline'?'ui_messages.json':'.jsonl')){
      const stat=fs.statSync(file);if(stat.mtimeMs<now-48*3600000)continue;
      if(stat.size>256*1024*1024){errors.push(source.name+': oversized log skipped');continue;}
      let metadata={},extra='';if(source.type==='cline'){const meta=path.join(path.dirname(file),'task_metadata.json');if(fs.existsSync(meta)){metadata=JSON.parse(fs.readFileSync(meta,'utf8'));extra=String(fs.statSync(meta).mtimeMs);}}
      const signature=[day,stat.size,stat.mtimeMs,extra].join(':');let entry=cache.files[file];
      if(!entry||entry.signature!==signature){const text=fs.readFileSync(file,'utf8');const records=source.type==='codex'?codexRecords(text,day):source.type==='cline'?clineRecords(text,day,metadata):claudeRecords(text,day);entry={signature,records};cache.files[file]=entry;}
      for(const record of entry.records){const identity=source.type==='cline'?file+':'+record.id:source.type+':'+record.id;if(dedup.has(identity))continue;dedup.add(identity);rows.push(record);count++;}
    }}catch(e){errors.push(source.name+': '+(e.code||'usage log unavailable'));}
    coverage.push({source:source.name,status:!available?'Not found':count?'Recorded today':'No records today',records:count});
  }
  const projects=new Map();for(const r of rows){const key=r.provider+'|'+r.project.replaceAll('\\','/').toLowerCase();if(!projects.has(key))projects.set(key,{provider:r.provider,project:r.project,input:0,output:0,cached:0,total:0,records:0});const p=projects.get(key);for(const k of ['input','output','cached','total'])p[k]+=r[k];p.records++;}
  const totals={input:0,output:0,cached:0,total:0};for(const p of projects.values())for(const k of Object.keys(totals))totals[k]+=p[k];
  const result={day,timezone:ZONE,scanned_at:new Date(now).toISOString(),latest_record:rows.map(r=>r.time).sort().at(-1)||null,records:rows.length,...totals,projects:[...projects.values()].sort((a,b)=>b.total-a.total),coverage,errors,scope:'Today · all locally recorded projects',note:'Processed tokens include cached input; not balance, quota or billing. Logs can lag. Other tools/devices are not covered. Cline tasks without workspace metadata are unmapped.'};
  // Persist derived counters only, never source messages or credentials.
  try{fs.mkdirSync(path.dirname(cachePath),{recursive:true});fs.writeFileSync(cachePath,JSON.stringify({day,scanned_ms:now,files:cache.files,result}));}catch{}
  return result;
}
module.exports={dayOf,codexRecords,clineRecords,claudeRecords,usageSnapshot};
