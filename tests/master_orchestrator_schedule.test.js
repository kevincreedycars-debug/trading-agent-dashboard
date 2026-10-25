// The daily orchestrator trigger is one workflow file, and the guards in it are the whole reason it is safe to
// leave a machine starting decisions on its own: a clock in New York rather than UTC, one call a day, no overlap,
// and nothing written back. These assertions keep those properties from being dropped in a later tidy-up.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const workflowPath = path.join(root, ".github", "workflows", "master-orchestrator-daily.yml");
const workflow = fs.readFileSync(workflowPath, "utf8");
const control = JSON.parse(fs.readFileSync(path.join(root, "data", "workflow-control.json"), "utf8"));
const orchestratorExport = fs.readFileSync(path.join(root, "exports", "master_orchestrator.json"), "utf8");

function occurrences(text, needle) {
  return text.split(needle).length - 1;
}

test("the trigger wakes every hour and decides the 07:00 New York run in New York time", () => {
  // An hourly wake is what makes daylight saving a non-question: a cron that named 11:00 UTC would run at 06:00
  // New York for half the year. The decision is taken by the job, on a clock the job sets.
  assert.match(workflow, /schedule:\s*\n\s*- cron: "\d+ \* \* \* \*"/, "the schedule is hourly");
  assert.match(workflow, /TZ: America\/New_York/, "the job's clock is New York, so date and hour follow daylight saving");
  assert.match(workflow, /local_hour=\$\(\(10#\$\(date \+%H\)\)\)/, "the hour is read from that clock");
  assert.match(workflow, /local_hour" -lt 7/, "nothing before 07:00 New York");
  assert.match(workflow, /local_hour" -ge 11/, "a slot that arrives at 11:00 New York or later is not a reason to run");
});

test("one call a day, one at a time", () => {
  assert.match(workflow, /concurrency:\s*\n\s*group: master-orchestrator-daily\s*\n\s*cancel-in-progress: false/,
    "a second slot waits, and cannot cancel a run that is half done");
  assert.match(workflow, /today already has a successful run of this job/,
    "a success earlier in the New York day turns every later slot away");
  assert.match(workflow, /a run of this job is still in flight/,
    "a run still going turns a second slot away rather than overlapping the orchestrator");
  // Force is the one hand override, and it may bend only the clock: a duplicate or an overlap stands.
  const duplicateGuard = workflow.indexOf("today already has a successful run");
  const forceGate = workflow.indexOf('"${FORCE:-false}" = "true"');
  const earlyGate = workflow.indexOf('local_hour" -lt 7');
  assert.ok(duplicateGuard > 0 && forceGate > duplicateGuard && earlyGate > forceGate,
    "force is reached after the day's guards and before the clock, so it cannot cause a duplicate or an overlap");
  // A dry run proves the guards without calling anything, so it must not be the success that ends the day.
  assert.match(workflow, /run-name: orchestrator daily \$\{\{ inputs\.dry_run == 'true' && 'dry' \|\| 'live' \}\}/,
    "the run names itself dry or live, the only thing a later slot can read back");
  assert.match(workflow, /select\(\.displayTitle \| startswith\("orchestrator daily live"\)\)/,
    "and only live runs count towards the day, by a name no unnamed run can imitate");
  // One POST in the whole file: the trigger is a single place, not scattered through the steps.
  assert.equal(occurrences(workflow, "-X POST"), 1);
  assert.match(workflow, /if: steps\.decide\.outputs\.decision == 'trigger' && steps\.decide\.outputs\.dry_run != 'true' && steps\.decide\.outputs\.enabled == 'true'/,
    "the call only happens on a trigger decision, outside a dry run, with the control file switched on");
});

test("the trigger calls the webhook the dashboard calls, and writes nothing of its own", () => {
  const webhook = new URL(control.webhook_url);
  const webhookPath = webhook.pathname.split("/").filter(Boolean).pop();
  assert.ok(orchestratorExport.includes(webhookPath),
    "the webhook path is the one the exported orchestrator workflow exposes");
  assert.match(workflow, /contents: read/, "the job reads the repository");
  assert.doesNotMatch(workflow, /contents: write/, "and writes nothing, so it cannot collide with a publisher");
  assert.doesNotMatch(workflow, /actions\/checkout/, "no clone: the control file and the status file come from the API");
  assert.match(workflow, /"Accept: application\/vnd\.github\.raw"[\s\S]*data\/workflow-status\.json/,
    "the run is confirmed from the committed status file, not from a cached page");
  assert.match(workflow, /GH_REPO: \$\{\{ github\.repository \}\}/,
    "every gh call names its repository, because the job has no clone to infer it from");
  // `date -u -d 'today 00:00'` reads that midnight as UTC, which would cut the run list eight hours early in
  // summer and put yesterday evening's run inside today. The epoch is taken on the local clock first.
  assert.doesNotMatch(workflow, /since=\$\(date -u -d 'today/, "the local midnight is not parsed as UTC");
  assert.match(workflow, /since=\$\(date -u -d "@\$\(date -d 'today 00:00' \+%s\)"/,
    "the cut is the New York midnight, printed in UTC");
});

test("a dispatch defaults to asking without calling", () => {
  // The one way a person can start this by hand must not be able to start an orchestrator run by accident.
  assert.match(workflow, /dry_run:\s*\n\s*description: [^\n]*\n\s*type: boolean\s*\n\s*default: true/);
  assert.match(workflow, /force:\s*\n\s*description: [^\n]*\n\s*type: boolean\s*\n\s*default: false/);
});
