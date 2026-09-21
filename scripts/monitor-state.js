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
function snapshot(root = ROOT, now = Date.now(), usage = null) {
  let controller = 'Not configured · manual review', controllerState = 'unconfigured';
  const controllerDir = path.join(root,'.local/orchestration/controller');
  try {
    if (fs.existsSync(path.join(controllerDir,'config.json'))) {
      const config = read(path.join(controllerDir,'config.json'));
      const status = read(path.join(controllerDir,'status.json'));
      let alive = false;
      if (Number.isInteger(status.pid) && status.pid > 0) { try { process.kill(status.pid,0); alive=true; } catch(e) { alive=e.code==='EPERM'; } }
      const reviewing = status.state==='reviewing' && fs.existsSync(path.join(controllerDir,'run.lock')) && read(path.join(controllerDir,'run.lock')).pid===status.pid;
      const fresh = now-Date.parse(status.updated_at)<30000;
      controllerState = !alive || (!fresh && !reviewing) ? 'offline' : reviewing ? 'reviewing' : !config.enabled ? 'paused' : status.state;
      controller = ({watching:'Auto coordinator watching for submissions',reviewing:'Background review running; avoid shared edits',paused:'Auto coordinator paused',offline:'Auto coordinator offline',waiting:'Auto review waiting for interactive coordinator',budget_limit:'Auto review daily limit reached',blocked:'Auto coordinator blocked',needs_attention:'Auto review needs attention'})[controllerState] || 'Auto coordinator: '+controllerState;
    }
  } catch(e) { controllerState='blocked'; controller='Auto coordinator status unavailable'; }
  const autoReview = ['watching','reviewing','waiting'].includes(controllerState);
  const registry = read(path.join(root, 'docs/orchestration/projects.json'));
  const scan = createMailbox(root).check();
  const events = [], errors = [...scan.errors.map(e => `${e.worker_id}: ${e.error}`)];
  const workers = [...(registry.coordinator ? [registry.coordinator] : []), ...registry.workers].map(w => {
    const submissions = scan.submissions.filter(s => s.worker_id === w.id);
    let latest = null, currentReply = null, pickupAt = 0;
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
        at = fs.statSync(s.reply_path).mtimeMs;
        if (s.assignment_id === w.assignment_id && (!currentReply || at > currentReply.at)) currentReply = { at, file:s.reply_path };
        detail = reply.instructions; file = s.reply_path;
        events.push({ id: 'reply:' + s.sha256 + ':' + crypto.createHash('sha256').update(JSON.stringify(reply)).digest('hex'), worker:w.id,
          title:'Review: ' + reply.decision.replaceAll('_',' '), detail, time:new Date(at).toISOString(), file });
        if (reply.decision === 'accepted') state = 'Accepted · not deployment';
      }
      if (!latest || at > latest.at) latest = { at, state, detail, file };
    }
    let state = latest ? latest.state : 'No agent update', detail = latest ? latest.detail : w.next || w.status;
    let at = latest ? latest.at : null, file = latest ? latest.file : path.join(root,w.assignment);
    let pickedUp = submissions.some(s => s.assignment_id === w.assignment_id);
    const heartbeatFile = path.join(root,'.local/orchestration/activity',w.id + '.json');
    if (fs.existsSync(heartbeatFile)) {
      try {
        const h = read(heartbeatFile), stamp = Date.parse(h.updated_at);
        if (h.assignment_id === w.assignment_id) {
        if (h.worker_id !== w.id || h.assignment_id !== w.assignment_id || !Number.isFinite(stamp) || stamp > now + 60000 || typeof h.task !== 'string' || !['working','blocked','paused','stopped'].includes(h.state)) throw new Error('Invalid or outdated activity record');
        pickedUp = true;
        pickupAt = stamp;
        if (!at || stamp > at) {
          const stale = now - stamp > STALE_MS;
          const pendingReview = submissions.some(s => s.assignment_id === w.assignment_id && s.state === 'pending_review');
          if (!(pendingReview && ['paused','stopped'].includes(h.state))) {
            state = stale && h.state === 'working' ? 'Working status unconfirmed' : h.state === 'working' ? 'Working · reported' : h.state;
            detail = h.task; file = heartbeatFile;
          }
          at = stamp;
          if (h.state === 'blocked') events.push({id:'blocked:' + w.id + ':' + h.assignment_id + ':' + h.task, worker:w.id,title:'Worker blocked',detail,time:h.updated_at,file});
        }
        }
      } catch (e) { errors.push(w.id + ': ' + e.message); }
    }
    let flow = 'idle', waiting_on = '';
    if (state.startsWith('Working') && state !== 'Working status unconfirmed') flow = 'working';
    else if (state === 'Working status unconfirmed') { flow = 'working_unconfirmed'; state = 'Working - last reported'; }
    else if (/awaiting review|needs review/i.test(state)) { flow = 'review'; waiting_on = 'central-orchestrator'; }
    else if (/blocked/i.test(state)) { flow = 'input'; waiting_on = 'user / coordinator'; }
    else if (/changes requested|paused|stopped/i.test(state)) { flow = 'waiting'; waiting_on = 'instruction / resume'; }
    if (!latest && !at) { state = 'Not started / no report'; }
    if (flow === 'waiting') state = 'Waiting for instruction';
    if (flow === 'input') state = 'Needs input';
    if (w.status === 'instructions_published_awaiting_worker' && !pickedUp) {
      flow = 'input'; waiting_on = 'YOU - prompt agent'; state = 'YOUR ACTION: wake agent';
      detail = 'Tell ' + w.id + ': Check your mailbox and start ' + w.assignment_id;
      events.push({id:'wake:' + w.id + ':' + w.assignment_id,worker:w.id,title:'YOUR ACTION: wake agent',detail,
        time:at ? new Date(at).toISOString() : new Date(fs.statSync(path.join(root,'docs/orchestration/projects.json')).mtimeMs).toISOString(),file:path.join(root,w.assignment)});
    }
    let action_target = '', action_prompt = '';
    const pendingReview = submissions.some(s => s.assignment_id === w.assignment_id && s.state === 'pending_review');
    if (pendingReview) { action_target = 'Central Orchestrator'; action_prompt = 'Check inboxes'; }
    else if (state === 'YOUR ACTION: wake agent' || (currentReply && latest && latest.file === currentReply.file && pickupAt <= currentReply.at)) {
      action_target = w.display_name || w.id; action_prompt = 'Check your inbox and follow the latest coordinator reply.';
      if (state === 'YOUR ACTION: wake agent') action_prompt = 'Check your inbox and read your current assignment.';
    }
    const normalize = p => String(p || '').replaceAll('\\','/').replace(/\/$/,'').toLowerCase();
    if (action_target && action_target!=='Central Orchestrator') {
      const dispatchDir=path.join(root,'.local/orchestration/dispatch',w.id);
      if (fs.existsSync(dispatchDir)) {
        try {
          const event=require('../tools/agent-mailbox-bridge/core').workerEvent(root,w,scan);
          const delivered=event && fs.readdirSync(dispatchDir).filter(f=>f.endsWith('.json')).map(f=>read(path.join(dispatchDir,f))).find(r=>r.key===event.key && r.state==='sent_unconfirmed');
          if (delivered) { state='Wake sent / pickup unconfirmed'; flow='waiting'; waiting_on='worker acknowledgement'; detail='Notification sent for '+w.assignment_id+'; check worker window if this persists'; action_target=''; action_prompt=''; }
        } catch(e) { errors.push(w.id+': dispatch status unavailable'); }
      }
    }
    if (pendingReview && autoReview) { action_target=''; action_prompt=''; waiting_on='automatic coordinator'; }
    if (w.id === 'central-orchestrator' && (controllerState==='reviewing' || (controllerState==='watching' && flow!=='working'))) {
      state=controllerState==='reviewing'?'Background review running':'Watching for submissions';
      detail=controller; flow=controllerState==='reviewing'?'working':'idle'; waiting_on=''; action_target=''; action_prompt='';
    }
    const logTimes = (usage?.projects || []).filter(p => normalize(p.project) === normalize(w.path))
      .map(p => Date.parse(p.latest_record)).filter(t => Number.isFinite(t) && t <= now + 60000);
    const logAt = logTimes.length ? Math.max(...logTimes) : null;
    const reportAt = at;
    let activity_source = 'agent report';
    if (logAt && (!at || logAt > at)) {
      at = logAt; activity_source = 'recorded session activity';
      if (flow === 'idle' && now - logAt <= STALE_MS) { state = 'Recent session activity'; flow = 'recent'; }
    }
    return { id:w.id, name:w.display_name || w.id, action_target, action_prompt, flow, waiting_on, activity_source, reported_at:reportAt ? new Date(reportAt).toISOString() : null, state, task:detail, assignment:w.assignment_id, next:w.next || '',
      updated_at:at ? new Date(at).toISOString() : null, age_minutes:at ? Math.max(0,Math.floor((now-at)/60000)) : null,
      file, folder:w.path };
  });
  return { schema_version:1, scanned_at:new Date(now).toISOString(), controller, controller_state:controllerState, pending:scan.pending,
    errors, workers, events:events.sort((a,b)=>a.time.localeCompare(b.time)).slice(-200) };
}
function activity(root, workerId, state, task) {
  const registry=read(path.join(root,'docs/orchestration/projects.json'));
  const w=[...(registry.coordinator ? [registry.coordinator] : []), ...registry.workers].find(w=>w.id===workerId);
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
    if(command==='snapshot'&&args.length===0) { const usage=usageSnapshot(ROOT); console.log(JSON.stringify({...snapshot(ROOT,Date.now(),usage),usage})); }
    else if(command==='activity'&&args.length===3) console.log(JSON.stringify(activity(ROOT,...args)));
    else throw new Error('Usage: monitor-state.js snapshot | activity WORKER STATE "Task summary"');
  } catch(e) { console.error(e.message);process.exitCode=1; }
}
module.exports={snapshot,activity,STALE_MS};
