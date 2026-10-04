'use strict';
// Operator tool for the one-shot task start. The mailbox bridge never opens a Cline task on its
// own; it only does so when one of these request files exists, and it consumes the file exactly
// once and writes a report beside it. Arming is per worker and deliberately manual.
const fs = require('node:fs');
const path = require('node:path');
const {workerEvent, startRequest} = require('../tools/agent-mailbox-bridge/core');
const {createMailbox} = require('./coordination');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, '.local', 'orchestration', 'start-task');
const fileFor = id => path.join(DIR, id + '.json');
function registered(id) {
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/orchestration/projects.json'), 'utf8'));
  const worker = [...(registry.coordinator ? [registry.coordinator] : []), ...registry.workers].find(w => w.id === id);
  if (!worker) throw new Error('Unknown worker ' + id);
  return worker;
}
function arm(ids, requestedBy) {
  fs.mkdirSync(DIR, {recursive: true});
  return ids.map(id => {
    const worker = registered(id);
    if (fs.existsSync(fileFor(id))) return {worker: id, armed: false, reason: 'a request is already filed'};
    let event = null, failure = '';
    try { event = workerEvent(ROOT, worker, createMailbox(ROOT).check(id)); } catch(e) { failure = e.message; }
    if (!event) return {worker: id, armed: false,
      reason: failure || 'no wake is due: pending review, a reported working state or nothing awaiting this worker'};
    fs.writeFileSync(fileFor(id), JSON.stringify({worker_id: id, prompt: event.prompt, event_key: event.key,
      requested_by: String(requestedBy).slice(0, 120), created_at: new Date().toISOString()}, null, 2) + '\n', {flag: 'wx'});
    return {worker: id, armed: true, event_key: event.key, prompt_bytes: event.prompt.length};
  });
}
function status(ids) {
  const list = ids.length ? ids : (fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)) : []);
  return list.map(id => {
    const outcome = path.join(DIR, id + '.report.json');
    const report = fs.existsSync(outcome) ? JSON.parse(fs.readFileSync(outcome, 'utf8')) : null;
    return {worker: id, request_filed: fs.existsSync(fileFor(id)),
      earlier_request_consumed: fs.existsSync(path.join(DIR, id + '.consumed.json')),
      last_outcome: report && {state: report.state, detail: report.detail, finished_at: report.finished_at}};
  });
}
function disarm(ids) {
  return ids.map(id => {
    if (!fs.existsSync(fileFor(id))) return {worker: id, disarmed: false, reason: 'no unread request is filed'};
    fs.unlinkSync(fileFor(id));
    return {worker: id, disarmed: true};
  });
}
if (require.main === module) {
  try {
    const [command, ...ids] = process.argv.slice(2);
    if (command === 'arm' && ids.length) console.log(JSON.stringify({command, results: arm(ids, 'harness lane ' + new Date().toISOString())}, null, 2));
    else if (command === 'status') console.log(JSON.stringify({command, results: status(ids)}, null, 2));
    else if (command === 'disarm' && ids.length) console.log(JSON.stringify({command, results: disarm(ids)}, null, 2));
    else if (command === 'check' && ids.length) console.log(JSON.stringify({command, results: ids.map(id => {
      const request = startRequest(ROOT, registered(id));
      return {worker: id, readable_request: request ? {prompt_bytes: request.prompt.length, requested_by: request.requested_by, created_at: request.created_at} : null};
    })}, null, 2));
    else throw new Error('Usage: mailbox-start-task.js arm WORKER... | status [WORKER...] | check WORKER... | disarm WORKER...');
  } catch(e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = {arm, status, disarm};
