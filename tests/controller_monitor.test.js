const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {snapshot}=require('../scripts/monitor-state');
test('controller distinguishes watching, paused, offline and long active review',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'controller-monitor-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'docs/orchestration'),{recursive:true});fs.writeFileSync(path.join(root,'docs/orchestration/projects.json'),JSON.stringify({workers:[]}));
 const dir=path.join(root,'.local/orchestration/controller');fs.mkdirSync(dir,{recursive:true});
 const save=(name,value)=>fs.writeFileSync(path.join(dir,name),JSON.stringify(value));
 save('config.json',{enabled:true});save('status.json',{state:'watching',pid:process.pid,updated_at:new Date().toISOString()});
 assert.equal(snapshot(root).controller_state,'watching');
 save('config.json',{enabled:false});assert.equal(snapshot(root).controller_state,'paused');
 save('config.json',{enabled:true});save('status.json',{state:'reviewing',pid:process.pid,updated_at:new Date(0).toISOString()});
 assert.equal(snapshot(root).controller_state,'offline');save('run.lock',{pid:process.pid});assert.equal(snapshot(root).controller_state,'reviewing');
});
