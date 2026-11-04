// The daily slot is scripts/trigger-orchestrator-refresh.ps1, and what it is worth hangs on three behaviours that a
// reader of the file cannot see: a failed run is retried, a retry stops when a run succeeds, and a slot that cannot
// get a run through says so with a non-zero exit instead of reporting a quiet morning. The 2026-11-04 06:00 UTC run
// failed at "USD Collector" with a 502 and nothing read the outcome, so these tests are run against a real local
// listener rather than asserted from the script's text.
const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

const repoRoot = path.join(__dirname, "..");
const scriptPath = path.join(repoRoot, "scripts", "trigger-orchestrator-refresh.ps1");
const previousStamp = "2026-11-03T06:06:37.560Z";
const windowsOnly = { skip: process.platform !== "win32" };

// A stand-in for the two HTTP surfaces the slot touches: the webhook the page calls, and the status file the flow
// commits. Each POST consumes the next queued outcome, and the stamp moves a beat later than the 202, the way the
// real one does - a run finishes minutes after the call is acknowledged.
function startStub({ outcomes, postStatus = 202 }) {
  const state = {
    posts: 0,
    respond: postStatus,
    status: {
      status: "success",
      last_run_started_at: previousStamp,
      last_run_finished_at: previousStamp,
      triggered_by: "dashboard_or_manual",
      failed_step: null,
      message: "Manual Refresh Complete"
    }
  };
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method === "POST" && url.pathname === "/webhook") {
      state.posts += 1;
      request.resume();
      request.on("end", () => {
        if (state.respond !== 202) {
          response.writeHead(state.respond);
          response.end("bad gateway");
          return;
        }
        const outcome = outcomes[Math.min(state.posts, outcomes.length) - 1] || { status: "failed" };
        setTimeout(() => {
          state.status = {
            status: outcome.status,
            last_run_started_at: `2026-11-04T06:0${state.posts}:00.000Z`,
            last_run_finished_at: `2026-11-04T06:0${state.posts}:00.500Z`,
            triggered_by: "dashboard_or_manual",
            failed_step: outcome.failed_step || null,
            message: outcome.status === "success" ? "Manual Refresh Complete" : "Master Orchestrator finished with errors.",
            error: outcome.status === "success" ? null : { step: outcome.failed_step, reason: outcome.reason || "Bad gateway" }
          };
        }, 150);
        response.writeHead(202, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: true }));
      });
      return;
    }
    if (url.pathname === "/status.json") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(state.status));
      return;
    }
    response.writeHead(404);
    response.end("not found");
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({
        state,
        statusUrl: `http://127.0.0.1:${port}/status.json`,
        webhookUrl: `http://127.0.0.1:${port}/webhook`,
        close: () => new Promise((done) => server.close(done))
      });
    });
  });
}

// spawn, not spawnSync: the listener answering the script is this process, and a blocked event loop would make every
// poll time out.
function runSlot(args) {
  return new Promise((resolve) => {
    const child = spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...args], {
      cwd: repoRoot
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

function workspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrator-slot-"));
  return {
    dir,
    control: path.join(dir, "workflow-control.json"),
    log: path.join(dir, "refresh-0600.log"),
    writeControl: (enabled) => fs.writeFileSync(path.join(dir, "workflow-control.json"),
      JSON.stringify({ enabled, webhook_url: "http://127.0.0.1:1/webhook" }))
  };
}

function loggedLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}


test("a run that failed is called again, and the slot ends green only on a success", windowsOnly, async () => {
  const stub = await startStub({
    outcomes: [
      { status: "failed", failed_step: "USD Collector", reason: "Bad gateway - the service failed to handle your request" },
      { status: "success" }
    ]
  });
  const space = workspace();
  space.writeControl(true);
  try {
    const result = await runSlot(["-ControlPath", space.control, "-StatusUrl", stub.statusUrl,
      "-WebhookUrl", stub.webhookUrl, "-MaxAttempts", "3", "-RetryDelaySeconds", "1", "-TimeoutSeconds", "10",
      "-PollSeconds", "1", "-Log", space.log]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(stub.state.posts, 2, "one call for the failed run, one for the retry");
    const lines = loggedLines(space.log);
    assert.equal(lines.length, 2, `two attempts, one line each: ${JSON.stringify(lines)}`);
    assert.equal(lines[0].action, "retry", "the failed run is named as a retry, not as the day's run");
    assert.equal(lines[0].failed_step, "USD Collector");
    assert.equal(lines[1].action, "success");
    assert.equal(lines[1].run_started_at, "2026-11-04T06:02:00.000Z", "the retry's own run is what is recorded");
  } finally {
    await stub.close();
  }
});

test("a morning that never succeeds exits non-zero, so the task result is not a quiet green", windowsOnly, async () => {
  const stub = await startStub({ outcomes: [{ status: "failed", failed_step: "USD Collector" }] });
  const space = workspace();
  space.writeControl(true);
  try {
    const result = await runSlot(["-ControlPath", space.control, "-StatusUrl", stub.statusUrl,
      "-WebhookUrl", stub.webhookUrl, "-MaxAttempts", "2", "-RetryDelaySeconds", "1", "-TimeoutSeconds", "6",
      "-PollSeconds", "1", "-Log", space.log]);
    assert.equal(result.status, 1, "a failed day must not report success");
    assert.equal(stub.state.posts, 2, "both attempts were used");
    const lines = loggedLines(space.log);
    assert.equal(lines.at(-1).action, "gave_up");
    assert.equal(lines.at(-1).status, "failed");
    assert.match(lines.at(-1).reason, /Bad gateway/);
  } finally {
    await stub.close();
  }
});

test("a webhook that answers 502 is retried, not mistaken for a run", windowsOnly, async () => {
  const stub = await startStub({ outcomes: [{ status: "success" }], postStatus: 502 });
  const space = workspace();
  space.writeControl(true);
  try {
    const result = await runSlot(["-ControlPath", space.control, "-StatusUrl", stub.statusUrl,
      "-WebhookUrl", stub.webhookUrl, "-MaxAttempts", "2", "-RetryDelaySeconds", "1", "-TimeoutSeconds", "2",
      "-PollSeconds", "1", "-Log", space.log]);
    assert.equal(result.status, 1);
    assert.equal(stub.state.posts, 2);
    const lines = loggedLines(space.log);
    assert.equal(lines.length, 2);
    assert.equal(lines[0].http, "502");
    assert.equal(lines[0].reason, "the webhook did not accept the call");
    assert.equal(lines.at(-1).action, "gave_up");
  } finally {
    await stub.close();
  }
});

test("-WhatIf reads the control file and spends nothing", windowsOnly, async () => {
  const stub = await startStub({ outcomes: [{ status: "success" }] });
  const space = workspace();
  space.writeControl(true);
  try {
    const result = await runSlot(["-ControlPath", space.control, "-StatusUrl", stub.statusUrl,
      "-WebhookUrl", stub.webhookUrl, "-Log", space.log, "-WhatIf"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(stub.state.posts, 0, "a dry pass must not call the orchestrator");
    assert.match(result.stdout, /webhook {7}= /, "the dry pass prints what it would do");
    assert.equal(fs.existsSync(space.log), false, "and writes no log line");
  } finally {
    await stub.close();
  }
});

test("the control file's off switch is obeyed before anything is called", windowsOnly, async () => {
  const stub = await startStub({ outcomes: [{ status: "success" }] });
  const space = workspace();
  space.writeControl(false);
  try {
    const result = await runSlot(["-ControlPath", space.control, "-StatusUrl", stub.statusUrl,
      "-WebhookUrl", stub.webhookUrl, "-MaxAttempts", "1", "-RetryDelaySeconds", "1", "-TimeoutSeconds", "2",
      "-PollSeconds", "1", "-Log", space.log]);
    assert.equal(result.status, 1, "switched off is a failure to report, not a quiet success");
    assert.equal(stub.state.posts, 0);
    assert.match(result.stdout, /switched off/);
    assert.equal(loggedLines(space.log)[0].action, "refused");
  } finally {
    await stub.close();
  }
});
