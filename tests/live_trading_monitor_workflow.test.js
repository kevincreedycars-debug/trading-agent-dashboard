const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// External monitoring is the one claim in the handover that cannot be demonstrated by a local run: it only
// means anything if it runs somewhere other than the host it watches. That makes its definition worth pinning
// down as text - scheduled, read-only, credential-free, and failing the job rather than printing a warning.
const repoRoot = path.join(__dirname, "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "live-trading-monitor.yml");
const workflow = fs.readFileSync(workflowPath, "utf8");

test("the monitor is scheduled in the cloud rather than on the host", () => {
  assert.match(workflow, /^name: live-trading-monitor$/m);
  assert.match(workflow, /schedule:\s*\n\s*- cron: "\*\/15 \* \* \* \*"/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /runs-on: ubuntu-latest/);
});

test("the monitor reads the published URLs through the checked-in checker", () => {
  assert.match(workflow, /node scripts\/check-live-trading-publication\.js --json/);
  assert.match(workflow, /actions\/checkout@v4/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /node-version: "22"/);
});

test("the monitor cannot write, spend a credential or swallow a failure", () => {
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.equal(/secrets\.|GH_TOKEN|personal_access_token/i.test(workflow), false);
  assert.equal(/git push|gh api|contents: write/i.test(workflow), false);
  assert.equal(/continue-on-error/.test(workflow), false);
  // The exit code of the checker has to reach the job, or a stale lane is a green run with a sad summary.
  assert.match(workflow, /exit "\$status"/);
  assert.match(workflow, /\$GITHUB_STEP_SUMMARY/);
});
