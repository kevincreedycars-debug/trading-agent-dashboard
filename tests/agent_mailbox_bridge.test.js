'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {workerEvent,deliverOnce,startRequest,finishStartRequest,recordTaskStart}=require('../tools/agent-mailbox-bridge/core');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'mailbox-bridge-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'docs/orchestration/assignments'),{recursive:true});fs.writeFileSync(path.join(root,'docs/orchestration/assignments/gold.md'),'Do assigned work');const worker={id:'gold',assignment_id:'a-1',assignment:'docs/orchestration/assignments/gold.md',status:'instructions_published_awaiting_worker',path:root};return{root,worker,scan:{errors:[],submissions:[]}};}
test('new assignment produces fixed scoped prompt, pending review and busy worker suppress it',t=>{const f=fixture(t);const event=workerEvent(f.root,f.worker,f.scan);assert.match(event.prompt,/Automatic mailbox notification for gold/);assert.equal(event.kind,'assignment');f.scan.submissions=[{worker_id:'gold',assignment_id:'a-1',state:'pending_review'}];assert.equal(workerEvent(f.root,f.worker,f.scan),null);f.scan.submissions=[];fs.mkdirSync(path.join(f.root,'.local/orchestration/activity'),{recursive:true});fs.writeFileSync(path.join(f.root,'.local/orchestration/activity/gold.json'),JSON.stringify({worker_id:'gold',assignment_id:'old',state:'working',updated_at:'2020-01-01T00:00:00Z'}));assert.equal(workerEvent(f.root,f.worker,f.scan),null);});
test('errors and assignment path escape fail closed',t=>{const f=fixture(t);assert.throws(()=>workerEvent(f.root,f.worker,{errors:['bad'],submissions:[]}));f.worker.assignment='../elsewhere';assert.throws(()=>workerEvent(f.root,f.worker,f.scan),/outside/);});
test('concurrent deliveries and restarts invoke adapter once',async t=>{const f=fixture(t),dir=path.join(f.root,'dispatch'),event=workerEvent(f.root,f.worker,f.scan);let count=0;const send=async()=>{count++;await new Promise(r=>setTimeout(r,20));};await Promise.all([deliverOnce(dir,event,send),deliverOnce(dir,event,send)]);await deliverOnce(dir,event,send);assert.equal(count,1);assert.equal((await deliverOnce(dir,event,send)).state,'sent_unconfirmed');});
test('ambiguous failed send never retries automatically',async t=>{const f=fixture(t),dir=path.join(f.root,'dispatch'),event=workerEvent(f.root,f.worker,f.scan);let count=0;const send=async()=>{count++;throw new Error('connection lost');};assert.equal((await deliverOnce(dir,event,send)).state,'delivery_error');await deliverOnce(dir,event,send);assert.equal(count,1);});
test('distinct wakes are uncapped while duplicates and ambiguous sends are never repeated',async t=>{const f=fixture(t),dir=path.join(f.root,'dispatch');let sent=0;for(let i=0;i<40;i++){const r=await deliverOnce(dir,{key:'k'+i,prompt:'test'},async()=>{sent++;});assert.equal(r.state,'sent_unconfirmed');}assert.equal(sent,40);const again=await deliverOnce(dir,{key:'k0',prompt:'test'},async()=>{sent++;});assert.equal(again.state,'sent_unconfirmed');assert.equal(sent,40);});
function extensionHarness({saved, auto=false, trusted=true, workerPath='D:/worker', currentPath='D:/worker', request=null, startApi=true, startThrows=false}={}) {
 const vm=require('node:vm'),commands=new Map(),health=[],reports=[];let sent=0,created=0,interval,requestUsed=false,lastPrompt=null;
 const disposable={dispose(){}};const worker={id:'gold',path:workerPath,assignment_id:'one',mailbox_auto_connect:auto};
 const api={isActive:true,exports:{sendMessage:async()=>{sent++;}},activate:async()=>{}};
 if(startApi) api.exports.startNewTask=async prompt=>{created++;lastPrompt=prompt;if(startThrows) throw new Error('start refused');};
 const vscode={StatusBarAlignment:{Left:1},workspace:{isTrusted:trusted,workspaceFolders:[{uri:{fsPath:currentPath}}]},extensions:{getExtension:()=>api},window:{createOutputChannel:()=>({...disposable,appendLine(){},show(){}}),createStatusBarItem:()=>({...disposable,show(){}}),showInformationMessage(){},showErrorMessage(){}},commands:{registerCommand:(id,fn)=>{commands.set(id,fn);return disposable;},executeCommand:async()=>{}}};
 const module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../tools/agent-mailbox-bridge/extension.js'),'utf8'),{module,process:{pid:123},setInterval:fn=>{interval=fn;return 1;},clearInterval(){},require:n=>n==='vscode'?vscode:n==='node:path'?path:n==='node:fs'?{mkdirSync(){},writeFileSync:(f,s)=>health.push(JSON.parse(s)),renameSync(){}}:n==='./core'?{normalize:x=>x,read:()=>({workers:[worker]}),workerEvent:()=>({key:'event',prompt:'Check inbox'}),deliverOnce:async(d,e,send)=>{await send(e.prompt);return{state:'sent_unconfirmed'};},startRequest:()=>{if(!request||requestUsed)return null;requestUsed=true;return request;},finishStartRequest:(r,report)=>{reports.push(report);return report;},recordTaskStart:()=>{}}:{createMailbox:()=>({check:()=>({errors:[],submissions:[]})})}});
 const context={subscriptions:[],workspaceState:{get:()=>saved,update:async(k,v)=>{saved=v;}}};
 return {activate:()=>module.exports.activate(context),commands,health,reports,api,tick:()=>interval(),counts:()=>({sent,created}),prompt:()=>lastPrompt,saved:()=>saved};
}
test('unconfigured worker requires connect; binding persists and never starts a task',async()=>{
 const h=extensionHarness();await h.activate();assert.equal(h.counts().sent,0);
 await h.commands.get('tradingMailbox.connect')();assert.deepEqual(h.counts(),{sent:1,created:0});assert.equal(h.saved(),'gold');
 assert.equal(h.health.at(-1).state,'sent_unconfirmed');
});
test('dedicated registered worker auto-connects and reconnects after reload',async()=>{
 for(const options of [{auto:true},{saved:'gold'}]) {const h=extensionHarness(options);await h.activate();assert.deepEqual(h.counts(),{sent:1,created:0});}
});
test('explicit disconnect survives reload and defeats registry auto-connect',async()=>{
 const h=extensionHarness({auto:true});await h.activate();await h.commands.get('tradingMailbox.disconnect')();await h.tick();assert.equal(h.counts().sent,1);
 const reload=extensionHarness({auto:true,saved:h.saved()});await reload.activate();assert.equal(reload.counts().sent,0);assert.equal(reload.health.at(-1).state,'disconnected');
});
test('wrong workspace, mismatched saved binding and untrusted workspace cannot auto-send',async()=>{
 for(const options of [{auto:true,currentPath:'D:/other'},{saved:'other'},{auto:true,trusted:false}]) {const h=extensionHarness(options);await h.activate();assert.equal(h.counts().sent,0);}
});
test('connection failures publish held status without claiming delivery',async()=>{
 const h=extensionHarness({auto:true});h.api.activate=async()=>{throw new Error('Cline unavailable');};await h.activate();assert.equal(h.counts().sent,0);assert.equal(h.health.at(-1).state,'held');
});
test('start request is absent by default, validated, and consumed exactly once',t=>{
 const f=fixture(t);assert.equal(startRequest(f.root,f.worker),null);
 const dir=path.join(f.root,'.local/orchestration/start-task');fs.mkdirSync(dir,{recursive:true});
 const file=path.join(dir,'gold.json'),write=value=>fs.writeFileSync(file,JSON.stringify(value)),prompt='y'.repeat(60);
 write({worker_id:'other',prompt,created_at:new Date().toISOString()});assert.throws(()=>startRequest(f.root,f.worker),/different worker/);
 write({worker_id:'gold',prompt:'too short',created_at:new Date().toISOString()});assert.throws(()=>startRequest(f.root,f.worker),/out of range/);
 write({worker_id:'gold',prompt,created_at:'not-a-date'});assert.throws(()=>startRequest(f.root,f.worker),/created_at/);
 write({worker_id:'gold',prompt,created_at:new Date(Date.now()-3*60*60*1000).toISOString()});assert.throws(()=>startRequest(f.root,f.worker),/older than two hours/);
 write({worker_id:'gold',prompt,created_at:new Date().toISOString(),requested_by:'harness lane'});
 const request=startRequest(f.root,f.worker);assert.equal(request.prompt,prompt);assert.equal(request.requested_by,'harness lane');
 const report=finishStartRequest(request,{state:'started',detail:''});
 assert.equal(report.state,'started');assert.equal(startRequest(f.root,f.worker),null);
 assert.ok(fs.existsSync(path.join(dir,'gold.consumed.json')));
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'gold.report.json'),'utf8')).worker_id,'gold');
});
test('a task start refreshes the wake record instead of being suppressed by an earlier one',t=>{
 const f=fixture(t),dir=path.join(f.root,'dispatch'),event=workerEvent(f.root,f.worker,f.scan);
 fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,require('node:crypto').createHash('sha256').update(event.key).digest('hex')+'.json'),JSON.stringify({key:event.key,state:'delivery_error'}));
 const record=recordTaskStart(dir,event);assert.equal(record.state,'sent_unconfirmed');assert.equal(record.task_start,true);
 assert.equal(recordTaskStart(dir,null),null);
});
test('a start request opens one task, then normal mailbox wakes resume',async()=>{
 const request={file:'D:/x/gold.json',worker_id:'gold',prompt:'Automatic mailbox notification for gold. Read your assignment.',created_at:new Date().toISOString(),requested_by:'harness'};
 const h=extensionHarness({auto:true,request});await h.activate();
 assert.deepEqual(h.counts(),{sent:0,created:1});
 assert.equal(h.prompt(),request.prompt);
 assert.equal(h.reports.at(-1).state,'started');
 assert.equal(h.health.at(-1).state,'task_started');
 await h.tick();assert.deepEqual(h.counts(),{sent:1,created:1});
});
test('an unavailable or failing start is consumed without a blind send fallback',async()=>{
 const request={file:'D:/x/gold.json',worker_id:'gold',prompt:'Automatic mailbox notification for gold. Read your assignment.',created_at:new Date().toISOString(),requested_by:'harness'};
 const h=extensionHarness({auto:true,request,startApi:false});await h.activate();
 assert.deepEqual(h.counts(),{sent:0,created:0});assert.equal(h.reports.at(-1).state,'unsupported');assert.equal(h.health.at(-1).state,'held');
 const g=extensionHarness({auto:true,request,startThrows:true});await g.activate();
 assert.equal(g.reports.at(-1).state,'error');assert.equal(g.reports.at(-1).detail,'start refused');
});
