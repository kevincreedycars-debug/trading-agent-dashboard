'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {workerEvent,deliverOnce}=require('../tools/agent-mailbox-bridge/core');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'mailbox-bridge-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'docs/orchestration/assignments'),{recursive:true});fs.writeFileSync(path.join(root,'docs/orchestration/assignments/gold.md'),'Do assigned work');const worker={id:'gold',assignment_id:'a-1',assignment:'docs/orchestration/assignments/gold.md',status:'instructions_published_awaiting_worker',path:root};return{root,worker,scan:{errors:[],submissions:[]}};}
test('new assignment produces fixed scoped prompt, pending review and busy worker suppress it',t=>{const f=fixture(t);const event=workerEvent(f.root,f.worker,f.scan);assert.match(event.prompt,/Automatic mailbox notification for gold/);assert.equal(event.kind,'assignment');f.scan.submissions=[{worker_id:'gold',assignment_id:'a-1',state:'pending_review'}];assert.equal(workerEvent(f.root,f.worker,f.scan),null);f.scan.submissions=[];fs.mkdirSync(path.join(f.root,'.local/orchestration/activity'),{recursive:true});fs.writeFileSync(path.join(f.root,'.local/orchestration/activity/gold.json'),JSON.stringify({worker_id:'gold',assignment_id:'old',state:'working',updated_at:'2020-01-01T00:00:00Z'}));assert.equal(workerEvent(f.root,f.worker,f.scan),null);});
test('errors and assignment path escape fail closed',t=>{const f=fixture(t);assert.throws(()=>workerEvent(f.root,f.worker,{errors:['bad'],submissions:[]}));f.worker.assignment='../elsewhere';assert.throws(()=>workerEvent(f.root,f.worker,f.scan),/outside/);});
test('concurrent deliveries and restarts invoke adapter once',async t=>{const f=fixture(t),dir=path.join(f.root,'dispatch'),event=workerEvent(f.root,f.worker,f.scan);let count=0;const send=async()=>{count++;await new Promise(r=>setTimeout(r,20));};await Promise.all([deliverOnce(dir,event,send),deliverOnce(dir,event,send)]);await deliverOnce(dir,event,send);assert.equal(count,1);assert.equal((await deliverOnce(dir,event,send)).state,'sent_unconfirmed');});
test('ambiguous failed send never retries automatically',async t=>{const f=fixture(t),dir=path.join(f.root,'dispatch'),event=workerEvent(f.root,f.worker,f.scan);let count=0;const send=async()=>{count++;throw new Error('connection lost');};assert.equal((await deliverOnce(dir,event,send)).state,'delivery_error');await deliverOnce(dir,event,send);assert.equal(count,1);});
test('wake attempt budget is bounded',async t=>{const f=fixture(t),dir=path.join(f.root,'dispatch');for(let i=0;i<12;i++)await deliverOnce(dir,{key:String(i),prompt:'test'},async()=>{});await assert.rejects(()=>deliverOnce(dir,{key:'13',prompt:'test'},async()=>{}),/Daily limit/);});
function extensionHarness({saved, auto=false, trusted=true, workerPath='D:/worker', currentPath='D:/worker'}={}) {
 const vm=require('node:vm'),commands=new Map(),health=[];let sent=0,created=0,interval;
 const disposable={dispose(){}};const worker={id:'gold',path:workerPath,assignment_id:'one',mailbox_auto_connect:auto};
 const api={isActive:true,exports:{sendMessage:async()=>{sent++;},startNewTask:()=>{created++;}},activate:async()=>{}};
 const vscode={StatusBarAlignment:{Left:1},workspace:{isTrusted:trusted,workspaceFolders:[{uri:{fsPath:currentPath}}]},extensions:{getExtension:()=>api},window:{createOutputChannel:()=>({...disposable,appendLine(){},show(){}}),createStatusBarItem:()=>({...disposable,show(){}}),showInformationMessage(){},showErrorMessage(){}},commands:{registerCommand:(id,fn)=>{commands.set(id,fn);return disposable;}}};
 const module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../tools/agent-mailbox-bridge/extension.js'),'utf8'),{module,process:{pid:123},setInterval:fn=>{interval=fn;return 1;},clearInterval(){},require:n=>n==='vscode'?vscode:n==='node:path'?path:n==='node:fs'?{mkdirSync(){},writeFileSync:(f,s)=>health.push(JSON.parse(s)),renameSync(){}}:n==='./core'?{normalize:x=>x,read:()=>({workers:[worker]}),workerEvent:()=>({key:'event',prompt:'Check inbox'}),deliverOnce:async(d,e,send)=>{await send(e.prompt);return{state:'sent_unconfirmed'};}}:{createMailbox:()=>({check:()=>({errors:[],submissions:[]})})}});
 const context={subscriptions:[],workspaceState:{get:()=>saved,update:async(k,v)=>{saved=v;}}};
 return {activate:()=>module.exports.activate(context),commands,health,api,tick:()=>interval(),counts:()=>({sent,created}),saved:()=>saved};
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
