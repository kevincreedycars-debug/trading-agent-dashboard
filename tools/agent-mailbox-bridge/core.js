'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const normalize = p => path.resolve(p).replaceAll('\\', '/').toLowerCase();
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

function read(file) {
  if (fs.statSync(file).size > 128 * 1024) throw new Error('Oversized coordination file');
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

// Only canonical assignment and validated, hash-bound reply events are triggers.
// Report text is never executable code or interpolated into shell commands.
function workerEvent(root, worker, scan) {
  if (scan.errors.length) throw new Error('Mailbox validation failed; dispatch held');
  const current = scan.submissions.filter(s => s.worker_id === worker.id && s.assignment_id === worker.assignment_id);
  if (current.some(s => s.state === 'pending_review')) return null;
  const replies = current.filter(s => s.reply_path).map(s => ({
    kind: 'reply', id: hash(fs.readFileSync(s.reply_path)), at: fs.statSync(s.reply_path).mtimeMs
  })).sort((a,b) => b.at-a.at);
  const assignment = path.resolve(root, worker.assignment);
  if (!assignment.startsWith(path.resolve(root, 'docs', 'orchestration', 'assignments') + path.sep)) throw new Error('Assignment outside allowed directory');
  const event = replies[0] || (worker.status === 'instructions_published_awaiting_worker' ? {
    kind: 'assignment', id: hash(worker.assignment_id + ':' + fs.readFileSync(assignment)), at: fs.statSync(assignment).mtimeMs
  } : null);
  if (!event) return null;
  const activityFile = path.join(root, '.local/orchestration/activity', worker.id + '.json');
  if (fs.existsSync(activityFile)) {
    const activity = read(activityFile), at = Date.parse(activity.updated_at);
    if (activity.worker_id !== worker.id || !Number.isFinite(at) || at > Date.now()+60000) throw new Error('Invalid worker activity');
    // Do not interrupt work, even when its last report is overdue.
    if (activity.state === 'working') return null;
    if (activity.assignment_id === worker.assignment_id && at > event.at) return null;
  }
  return { ...event, key: worker.id + ':' + worker.assignment_id + ':' + event.kind + ':' + event.id,
    prompt: `Automatic mailbox notification for ${worker.id}. Your assigned worktree is ${worker.path}. If this conversation belongs to a different task or workspace, stop and report the mismatch. Read ${root.replaceAll('\\','/')}/docs/orchestration/README.md, run the canonical coordination.js check --worker ${worker.id}, and read your current assignment at ${assignment.replaceAll('\\','/')}. Follow only the current authorized assignment/reply. Do not repeat already completed work. Report actual activity, submit results through the mailbox, and pause when the assignment requires review. This notification does not approve pending tool permissions or authorize production changes.` };
}

async function deliverOnce(directory, event, send) {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, hash(event.key) + '.json');
  if (fs.existsSync(file)) return read(file);
  // No daily wake budget: the fixed guard is the immutable per-event record file below,
  // which makes delivery at most once per event key, plus the rule that an ambiguous
  // send is never retried automatically. The former 12-per-day cap was removed on
  // 2026-09-24 at the user's direction, so a stalled worker can be re-notified freely.
  const record = { key: event.key, state: 'attempting', attempted_at: new Date().toISOString() };
  try { fs.writeFileSync(file, JSON.stringify(record), { flag:'wx' }); }
  catch(e) { if(e.code==='EEXIST') return read(file); throw e; }
  // Persist before invoking the adapter. Ambiguous/crashed sends are never retried automatically.
  try { await send(event.prompt); record.state = 'sent_unconfirmed'; }
  catch(e) { record.state = 'delivery_error'; record.error = String(e.message).slice(0,500); }
  fs.writeFileSync(file, JSON.stringify(record,null,2)+'\n');
  return record;
}
module.exports = { normalize, read, workerEvent, deliverOnce };
