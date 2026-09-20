'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createMailbox } = require('./coordination');
const { usageSnapshot } = require('./token-usage');
const ROOT = path.resolve(__dirname, '..');
const STALE_MS = 5 * 60 * 1000;
function read(file) {
  if (fs.statSync(file).size > 128 * 1024) throw new Error('Oversized coordination file');
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}
function snapshot(root = ROOT, now = Date.now()) {
  const registry = read(path.join(root, 'docs/orchestration/projects.json'));
  const scan = createMailbox(root).check();
  const events = [], errors = [...scan.errors.map(e => `${e.worker_id}: ${e.error}`)];
  const workers = registry.workers.map(w => {
    const submissions = scan.submissions.filter(s => s.worker_id === w.id);
    let latest = null;
    for (const s of submissions) {
      const report = read(s.submission_path);
      const reportAt = fs.statSync(s.submission_path).mtimeMs;
      const item = { id: 'submission:' + s.sha256, worker: w.id, title: 'Submission ready', detail: report.summary,
        time: new Date(reportAt).toISOString(), file: s.submission_path };
      events.push(item);
      let state = s.state === 'pending_review' ? (report.status === 'blocked' ? 'Blocked · needs review' : report.status === 'ready_for_review' ? 'Finished · awaiting review' : 'Status received · needs review') : s.state.replaceAll('_', ' ');
      let at = reportAt, detail = report.summary, file = s.submission_path;
      if (s.reply_path) {
        const reply = read(s.reply_path);
        at = fs.statSync(s.reply_path).mtimeMs; detail = reply.instructions; file = s.reply_path;
        events.push({ id: 'reply:' + s.sha256 + ':' + crypto.createHash('sha256').update(JSON.stringify(reply)).digest('hex'), worker:w.id,
          title:'Review: ' + reply.decision.replaceAll('_',' '), detail, time:new Date(at).toISOString(), file });
        if (reply.decision === 'accepted') state = 'Accepted · not deployment';
      }
      if (!latest || at > latest.at) latest = { at, state, detail, file };
    }
    let state = latest ? latest.state : 'No agent update', detail = latest ? latest.detail : w.next || w.status;
    let at = latest ? latest.at : null, file = latest ? latest.file : path.join(root,w.assignment);
    const heartbeatFile = path.join(root,'.local/orchestration/activity',w.id + '.json');
    if (fs.existsSync(heartbeatFile)) {
      try {
        const h = read(heartbeatFile), stamp = Date.parse(h.updated_at);
        if (h.worker_id !== w.id || h.assignment_id !== w.assignment_id || !Number.isFinite(stamp) || stamp > now + 60000 || typeof h.task !== 'string' || !['working','blocked','paused','stopped'].includes(h.state)) throw new Error('Invalid or outdated activity record');
        if (!at || stamp > at) {
          const stale = now - stamp > STALE_MS;
          state = stale ? 'No recent update' : h.state === 'working' ? 'Working · reported' : h.state;
          detail = h.task; at = stamp; file = heartbeatFile;
          if (h.state === 'blocked') events.push({id:'blocked:' + w.id + ':' + h.assignment_id + ':' + h.task, worker:w.id,title:'Worker blocked',detail,time:h.updated_at,file});
        }
      } catch (e) { errors.push(w.id + ': ' + e.message); }
    }
    return { id:w.id, state, task:detail, assignment:w.assignment_id, next:w.next || '',
      updated_at:at ? new Date(at).toISOString() : null, age_minutes:at ? Math.max(0,Math.floor((now-at)/60000)) : null,
      file, folder:w.path };
  });
  return { schema_version:1, scanned_at:new Date(now).toISOString(), controller:'Not configured · manual review', pending:scan.pending,
    errors, workers, events:events.sort((a,b)=>a.time.localeCompare(b.time)).slice(-200) };
}
function activity(root, workerId, state, task) {
  const registry=read(path.join(root,'docs/orchestration/projects.json'));
  const w=registry.workers.find(w=>w.id===workerId);
  if (!w || !['working','blocked','paused','stopped'].includes(state) || !task || task.length>2000) throw new Error('Expected registered worker, working|blocked|paused|stopped and task (1–2000 characters)');
  const directory=path.join(root,'.local/orchestration/activity');
  for (const p of [path.join(root,'.local'),path.join(root,'.local/orchestration'),directory]) if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink()) throw new Error('Activity link refused');
  fs.mkdirSync(directory,{recursive:true});
  const destination=path.join(directory,workerId+'.json');
  if(fs.existsSync(destination)&&fs.lstatSync(destination).isSymbolicLink()) throw new Error('Activity link refused');
  const temporary=path.join(directory,crypto.randomUUID()+'.tmp');
  fs.writeFileSync(temporary,JSON.stringify({worker_id:workerId,assignment_id:w.assignment_id,state,task,updated_at:new Date().toISOString()},null,2),{flag:'wx'});
  try { fs.renameSync(temporary,destination); } finally { if(fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  return {file:destination};
}
if(require.main===module) {
  try {
    const registry=read(path.join(ROOT,'docs/orchestration/projects.json'));
    if(path.resolve(registry.canonical_root).toLowerCase()!==ROOT.toLowerCase()) throw new Error('Use the canonical monitor-state.js by absolute path');
    const [command,...args]=process.argv.slice(2);
    if(command==='snapshot'&&args.length===0) console.log(JSON.stringify({...snapshot(),usage:usageSnapshot(ROOT)}));
    else if(command==='activity'&&args.length===3) console.log(JSON.stringify(activity(ROOT,...args)));
    else throw new Error('Usage: monitor-state.js snapshot | activity WORKER STATE "Task summary"');
  } catch(e) { console.error(e.message);process.exitCode=1; }
}
module.exports={snapshot,activity,STALE_MS};
