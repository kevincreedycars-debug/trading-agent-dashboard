const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const script=fs.readFileSync(path.join(root,'backtester/assets/backtest-engine-v2.js'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'backtester/assets/backtest-engine-v2.manifest.json'),'utf8'));
function harness(){
 const context={document:{readyState:'loading',addEventListener(){}},console};
 vm.createContext(context);
 vm.runInContext(script.replace('  // --- Boot','  globalThis.probe={VIEW,CONNECTIONS,FLOW,viewState,stepState,readiness};\n  // --- Boot'),context);
 const p=context.probe;p.FLOW.manifest=manifest;
 for(const [key,value] of Object.entries(manifest.sources))p.FLOW.sources[key]=JSON.parse(fs.readFileSync(path.join(root,value.url.split('?')[0]),'utf8').replace(/^\uFEFF/,''));
 return p;
}
test('approved three groups, ten visual nodes and every technical component remains reachable',()=>{
 const p=harness();assert.equal(p.VIEW.length,10);
 assert.deepEqual([...new Set(p.VIEW.map(v=>v.band))],['inputs','core','compare']);
 for(const n of manifest.nodes)assert.ok(p.VIEW.some(v=>v.members.includes(n.id)),n.id);
});
test('all nine connections resolve, with separate outcomes and blocked branches',()=>{
 const p=harness();assert.equal(p.CONNECTIONS.length,9);
 for(const [a,b] of p.CONNECTIONS)for(const id of [a,b])assert.ok(p.VIEW.some(v=>v.id===id));
 assert.ok(p.CONNECTIONS.some(e=>e[0]==='prices'&&e[1]==='matrix'));
 assert.ok(!p.CONNECTIONS.some(e=>e[0]==='prices'&&e[1]==='call'));
});
test('group badges never upgrade the underlying evidence',()=>{
 const p=harness(),rank=['blocked','stale','pending','unknown','complete'];
 for(const v of p.VIEW){const states=v.members.map(id=>p.stepState(manifest.nodes.find(n=>n.id===id)).state);assert.equal(p.viewState(v),rank.find(s=>states.includes(s))||'unknown');}
});
test('failed evidence cannot retain a complete readiness claim',()=>{
 const p=harness();p.FLOW.failed=Object.keys(manifest.sources);p.FLOW.sources={};
 for(const v of p.VIEW)assert.notEqual(p.viewState(v),'complete');
});
test('deployed, software, data and research remain separate evidence dimensions',()=>{
 const p=harness();assert.deepEqual(manifest.dimensions.map(d=>d.key),['software','deployed','data','research']);
 const fresh=manifest.nodes.find(n=>n.id==='freshcall');
 assert.equal(p.readiness(fresh.readiness.deployed,p.FLOW.sources),'complete');
 assert.notEqual(p.readiness(fresh.readiness.research,p.FLOW.sources),'complete');
});
