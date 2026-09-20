'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createMailbox } = require('../scripts/coordination');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coordination-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'docs/orchestration'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/orchestration/projects.json'), JSON.stringify({ mode: 'manual-file-mailbox', workers: [{ id:'gold', assignment_id:'policy-001', path:'D:/worker', branch:'worker/gold', assignment:'assignment.md' }] }));
  const report = { schema_version:1, worker_id:'gold', assignment_id:'policy-001', submission_id:'report-001', status:'ready_for_review', summary:'Policy proposal', worktree:'D:/worker', branch:'worker/gold', base_commit:'abc', head_commit:'def', commits:[], changed_files:[], dirty_files:[], tests:[{command:'not run',result:'Documentation only'}], artifacts:[], blockers:[], questions:[], production_changes:'None' };
  return { root, report, mailbox:createMailbox(root) };
}
test('immutable submission, hash-bound reply, and review queue lifecycle', t => {
  const {report, mailbox} = fixture(t);
  const submitted = mailbox.submit(report);
  assert.equal(mailbox.check().pending, 1);
  assert.throws(() => mailbox.submit({...report, summary:'overwrite'}), /EEXIST/);
  assert.equal(JSON.parse(fs.readFileSync(submitted.path)).summary, 'Policy proposal');
  const reply = {schema_version:1, worker_id:'gold', assignment_id:'policy-001', submission_id:'report-001', submission_sha256:submitted.sha256, decision:'changes_requested', instructions:'Clarify DST exceptions'};
  assert.throws(() => mailbox.reply({...reply, submission_sha256:'wrong'}), /hash mismatch/);
  mailbox.reply(reply);
  assert.equal(mailbox.check('gold').pending, 0);
  assert.equal(mailbox.check().submissions[0].state, 'changes_requested');
  assert.throws(() => mailbox.reply(reply), /EEXIST/);
  fs.appendFileSync(submitted.path, ' ');
  assert.match(mailbox.check().errors[0].error, /hash mismatch/);
});
test('rejects traversal, unknown workers, stale assignments, and missing evidence fields', t => {
  const {report, mailbox} = fixture(t);
  for (const patch of [{submission_id:'../escape'}, {worker_id:'other'}, {assignment_id:'old'}, {tests:[]}, {dirty_files:null}, {branch:'main'}]) assert.throws(() => mailbox.submit({...report,...patch}));
  assert.equal(mailbox.check().pending, 0);
  assert.throws(() => mailbox.check('unknown'), /Unknown/);
  mailbox.submit({...report,status:'blocked',worktree:'D:/wrong',branch:'wrong',blockers:['Workspace mismatch']});
  assert.equal(mailbox.check().pending, 1);
});
test('malformed reports surface errors and interrupted temp files are not submissions', t => {
  const {root, mailbox} = fixture(t);
  const directory = path.join(root,'.local/orchestration/inbox/gold');
  fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(path.join(directory,'.interrupted.tmp'), '{');
  assert.equal(mailbox.check().errors.length,0);
  fs.writeFileSync(path.join(directory,'broken.json'), '{');
  assert.equal(mailbox.check().errors.length,1);
});
test('independent submission IDs coexist and retired assignments remain visible', t => {
  const {root, report, mailbox} = fixture(t);
  mailbox.submit(report);
  mailbox.submit({...report,submission_id:'report-002'});
  assert.equal(mailbox.check().pending,2);
  const file=path.join(root,'docs/orchestration/projects.json');
  const registry=JSON.parse(fs.readFileSync(file)); registry.workers[0].assignment_id='policy-002';
  fs.writeFileSync(file,JSON.stringify(registry));
  const scan=createMailbox(root).check();
  assert.equal(scan.pending,2);
  assert.ok(scan.submissions.every(s=>s.stale_assignment));
});
