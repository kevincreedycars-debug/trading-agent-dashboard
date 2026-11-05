// The task that puts the daily slot on the clock is scripts/register-orchestrator-refresh-task.ps1, and it had a bug
// no reading of the file caught: the `if ($Test)` block was never closed, so every statement after it - the action,
// the principal, the Register-ScheduledTask call itself - sat inside the dry-run branch. `-Test` worked, `-Show`
// printed nothing, and a plain run registered nothing and exited 0, which is why the host's carry-over said the task
// "was not registered yet" while the command that registers it appeared to succeed. These tests hold the shape and
// the three modes apart so the swallow cannot come back.
const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

const repoRoot = path.join(__dirname, "..");
const registerPath = path.join(repoRoot, "scripts", "register-orchestrator-refresh-task.ps1");
const triggerPath = path.join(repoRoot, "scripts", "trigger-orchestrator-refresh.ps1");
const windowsOnly = { skip: process.platform !== "win32" };

function runPowerShell(args) {
  return new Promise((resolve) => {
    const child = spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", ...args], { cwd: repoRoot });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

// The register script is a builder of scheduler objects, and the failure here was in its statement tree rather than
// in anything it printed: this reads the tree and reports where the `$Test` guard ends and where the call that
// actually registers the task sits.
async function statementShape() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "register-shape-"));
  const probe = path.join(dir, "shape.ps1");
  fs.writeFileSync(probe, [
    "param([string] $Path)",
    "$ast = [System.Management.Automation.Language.Parser]::ParseFile($Path, [ref]$null, [ref]$null)",
    "$guard = $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.IfStatementAst] }, $false) |",
    "  Where-Object { $_.Clauses[0].Item1.Extent.Text -match '^\\$Test' } | Select-Object -First 1",
    "$call = $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.CommandAst] -and",
    "  $n.GetCommandName() -eq 'Register-ScheduledTask' }, $true) | Select-Object -First 1",
    "if (-not $guard) { throw 'no $Test guard found' }",
    "if (-not $call) { throw 'no Register-ScheduledTask call found' }",
    "$inside = $false",
    "$node = $call.Parent",
    "while ($node) { if ($node -eq $guard) { $inside = $true }; $node = $node.Parent }",
    "[pscustomobject]@{ guard_end = $guard.Extent.EndLineNumber; call_line = $call.Extent.StartLineNumber; call_inside_guard = $inside } |",
    "  ConvertTo-Json -Compress"
  ].join("\r\n"), "utf8");
  const result = await runPowerShell(["-File", probe, "-Path", registerPath]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout.trim());
}

function controlFile(url) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "register-control-"));
  const file = path.join(dir, "workflow-control.json");
  fs.writeFileSync(file, JSON.stringify({ enabled: true, webhook_url: url }), "utf8");
  return file;
}

async function taskExists(name) {
  const result = await runPowerShell(["-Command",
    `if (Get-ScheduledTask -TaskName '${name}' -ErrorAction SilentlyContinue) { 'yes' } else { 'no' }`]);
  return result.stdout.trim() === "yes";
}

test("the registration survives the -Test guard instead of sitting inside it", windowsOnly, async () => {
  const shape = await statementShape();
  assert.equal(shape.call_inside_guard, false,
    "Register-ScheduledTask is nested inside if ($Test), so a plain run registers nothing and exits 0");
  assert.ok(shape.guard_end < shape.call_line,
    `the -Test guard ends at line ${shape.guard_end}, past the registration at line ${shape.call_line}`);
});

test("-Show prints the definition it would register and registers nothing", windowsOnly, async () => {
  const taskName = "LiveTradingRefresh0600";
  const existed = await taskExists(taskName);
  const result = await runPowerShell(["-File", registerPath, "-Show", "-Trigger", triggerPath]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /task_name\s+= LiveTradingRefresh0600/);
  assert.match(result.stdout, /trigger\s+= .*trigger-orchestrator-refresh\.ps1/);
  assert.match(result.stdout, /principal\s+= SYSTEM \/ ServiceAccount \/ Highest/);
  assert.match(result.stdout, /when\s+= daily at 06:00/);
  assert.match(result.stdout, /settings\s+= StartWhenAvailable, IgnoreNew/);
  if (!existed) {
    assert.equal(await taskExists(taskName), false, "-Show registered the task it was only meant to describe");
  }
});

test("-Test runs the slot's own dry pass and posts nothing", windowsOnly, async () => {
  const posts = [];
  const server = http.createServer((request, response) => {
    posts.push(request.url);
    response.writeHead(202, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  try {
    const control = controlFile(`http://127.0.0.1:${server.address().port}/webhook`);
    const result = await runPowerShell(["-File", registerPath, "-Test", "-Trigger", triggerPath, "-ControlPath", control]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /trigger_path\s+= .*trigger-orchestrator-refresh\.ps1/);
    assert.match(result.stdout, /control_path\s+= .*workflow-control\.json/);
    assert.match(result.stdout, /What if: Performing the operation/);
    assert.match(result.stdout, /enabled=True/);
    assert.deepEqual(posts, [], "the dry pass called the webhook");
  } finally {
    await new Promise((done) => server.close(done));
  }
});
