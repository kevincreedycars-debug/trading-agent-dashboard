// File transport only. Never executes worker-supplied commands, paths or Git actions.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const LIMIT = 128 * 1024;
const slug = /^[a-z0-9][a-z0-9-]{0,95}$/;
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function requireValue(ok, message) { if (!ok) throw new Error(message); }
function string(value, label) {
  requireValue(typeof value === 'string' && value.trim().length > 0, `${label} must be a nonempty string`);
}
function readJson(file) {
  requireValue(fs.statSync(file).size <= LIMIT, `File exceeds ${LIMIT} bytes: ${file}`);
  const bytes = fs.readFileSync(file);
  return { value: JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')), sha256: digest(bytes) };
}
function createMailbox(root = ROOT) {
  const registry = readJson(path.join(root, 'docs/orchestration/projects.json')).value;
  const workers = new Map(registry.workers.map(w => [w.id, w]));
  const mailbox = path.join(root, '.local/orchestration');
  // Reject junctions/symlinks in mailbox components; worker IDs cannot supply paths.
  function safePath(...parts) {
    let cursor = root;
    for (const part of ['.local', 'orchestration', ...parts]) {
      cursor = path.join(cursor, part);
      if (fs.existsSync(cursor)) requireValue(!fs.lstatSync(cursor).isSymbolicLink(), `Mailbox link refused: ${cursor}`);
    }
    return cursor;
  }
  function envelope(data) {
    requireValue(data && typeof data === 'object' && !Array.isArray(data), 'Expected JSON object');
    requireValue(data.schema_version === 1, 'schema_version must be 1');
    for (const key of ['worker_id', 'assignment_id', 'submission_id']) {
      requireValue(typeof data[key] === 'string' && slug.test(data[key]), `Invalid ${key}`);
    }
    requireValue(workers.has(data.worker_id), 'Unknown worker_id');
    return workers.get(data.worker_id);
  }
  function submission(data, current = true) {
    const worker = envelope(data);
    if (current) requireValue(data.assignment_id === worker.assignment_id, 'Assignment is not current');
    requireValue(['ready_for_review', 'status_report', 'blocked'].includes(data.status), 'Invalid submission status');
    for (const key of ['summary', 'worktree', 'branch', 'base_commit', 'head_commit', 'production_changes']) string(data[key], key);
    for (const key of ['commits', 'changed_files', 'dirty_files', 'artifacts', 'blockers', 'questions']) {
      requireValue(Array.isArray(data[key]) && data[key].every(v => typeof v === 'string'), `${key} must be a string array`);
    }
    requireValue(Array.isArray(data.tests) && data.tests.length > 0, 'tests must disclose results or why not run');
    for (const test of data.tests) { string(test.command, 'test.command'); string(test.result, 'test.result'); }
    // A blocked report must be able to disclose a path/branch mismatch.
    if (data.status !== 'blocked') {
      requireValue(data.worktree.replaceAll('\\', '/').replace(/\/$/, '').toLowerCase() === worker.path.toLowerCase(), 'Worktree does not match register');
      requireValue(data.branch === worker.branch, 'Branch does not match register');
    }
    return worker;
  }
  function publish(kind, data) {
    const directory = safePath(kind, data.worker_id);
    fs.mkdirSync(directory, { recursive: true });
    const destination = safePath(kind, data.worker_id, `${data.submission_id}.json`);
    const bytes = JSON.stringify(data, null, 2) + '\n';
    requireValue(Buffer.byteLength(bytes) <= LIMIT, 'Submission/reply too large');
    const temporary = path.join(directory, `.${crypto.randomUUID()}.tmp`);
    fs.writeFileSync(temporary, bytes, { flag: 'wx' });
    try {
      // Atomic publication with exclusive destination: duplicate IDs cannot replace a report.
      fs.linkSync(temporary, destination);
    } finally { fs.unlinkSync(temporary); }
    return { path: destination, sha256: digest(bytes) };
  }
  function submit(data) { submission(data); return publish('inbox', data); }
  function validateReply(data, report, hash) {
    envelope(data);
    requireValue(data.worker_id === report.worker_id && data.assignment_id === report.assignment_id && data.submission_id === report.submission_id, 'Reply identity mismatch');
    requireValue(data.submission_sha256 === hash, 'Submission hash mismatch');
    requireValue(['accepted', 'changes_requested', 'blocked', 'acknowledged'].includes(data.decision), 'Invalid decision');
    string(data.instructions, 'instructions');
  }
  function reply(data) {
    envelope(data);
    const report = readJson(safePath('inbox', data.worker_id, `${data.submission_id}.json`));
    submission(report.value, false);
    validateReply(data, report.value, report.sha256);
    return publish('replies', data);
  }
  function check(workerId) {
    if (workerId) requireValue(workers.has(workerId), 'Unknown worker_id');
    const results = [], errors = [];
    for (const worker of workers.values()) {
      if (workerId && worker.id !== workerId) continue;
      let directory;
      try { directory = safePath('inbox', worker.id); }
      catch (error) { errors.push({ worker_id: worker.id, error: error.message }); continue; }
      if (!fs.existsSync(directory)) continue;
      for (const file of fs.readdirSync(directory).filter(f => f.endsWith('.json')).sort()) {
        try {
          requireValue(slug.test(file.slice(0, -5)), 'Invalid report filename');
          const reportPath = safePath('inbox', worker.id, file);
          const { value: report, sha256 } = readJson(reportPath);
          submission(report, false);
          requireValue(report.worker_id === worker.id && `${report.submission_id}.json` === file, 'Report filename/worker mismatch');
          const replyPath = safePath('replies', worker.id, file);
          let response = null;
          if (fs.existsSync(replyPath)) {
            response = readJson(replyPath).value;
            validateReply(response, report, sha256);
          }
          results.push({ worker_id: worker.id, assignment_id: report.assignment_id,
            submission_id: report.submission_id, summary: report.summary, sha256,
            state: response ? response.decision : 'pending_review',
            stale_assignment: report.assignment_id !== worker.assignment_id,
            submission_path: reportPath, reply_path: response ? replyPath : null });
        } catch (error) { errors.push({ worker_id: worker.id, file, error: error.message }); }
      }
    }
    return { mode: registry.mode, mailbox, pending: results.filter(r => r.state === 'pending_review').length,
      workers: registry.workers.filter(w => !workerId || w.id === workerId).map(w => ({ id: w.id, status: w.status, assignment_id: w.assignment_id, assignment_path: path.join(root, w.assignment) })),
      submissions: results, errors };
  }
  return { submit, reply, check };
}
if (require.main === module) {
  try {
    const [command, option, argument, ...extra] = process.argv.slice(2);
    requireValue(extra.length === 0, 'Unexpected arguments');
    const mailbox = createMailbox();
    let result;
    if (command === 'check' && (!option || (option === '--worker' && argument))) result = mailbox.check(argument);
    else if (['submit', 'reply'].includes(command) && option === '--file' && argument) result = mailbox[command](readJson(path.resolve(argument)).value);
    else throw new Error('Usage: coordination.js check [--worker ID] | submit --file FILE | reply --file FILE');
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (result.errors?.length) process.exitCode = 1;
  } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}
module.exports = { createMailbox };
