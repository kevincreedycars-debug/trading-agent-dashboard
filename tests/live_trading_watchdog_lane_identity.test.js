// The watchdog asks one question - is the lane's terminal still there - and until a second lane existed that question
// could be answered by a process name. It cannot any more: two lanes run two copies of terminal64.exe, so
// `Get-Process -Name terminal64` called a dead lane-1 terminal alive whenever lane 2 was up, and would have called
// lane 2's death a lane-1 fault. These tests hold the path-based answer apart from the name-based one, and hold the
// case where a path cannot be read - it must report and act on nothing, because a wrong reboot ends both sessions.
const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");
const watchdogPath = path.join(repoRoot, "scripts", "run-live-trading-watchdog.ps1");
const windowsOnly = { skip: process.platform !== "win32" };

const lane1 = "C:\\Program Files\\FTMO Global Markets MT5 Terminal\\terminal64.exe";
const lane2 = "C:\\Program Files\\FTMO Global Markets MT5 Terminal 2\\terminal64.exe";

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

// The three functions are lifted out of the file by name and evaluated on their own, so the scenarios below run the
// real decision code rather than a copy of it, and nothing in the script's body runs.
const PROBE_HEAD = [
  "param([string] $Path, [string] $Lane1, [string] $Lane2)",
  "$parseErrors = $null",
  "$ast = [System.Management.Automation.Language.Parser]::ParseFile($Path, [ref]$null, [ref]$parseErrors)",
  "if ($parseErrors -and $parseErrors.Count -gt 0) { throw ('parse errors: ' + (($parseErrors | ForEach-Object { $_.Message }) -join '; ')) }",
  "foreach ($name in @('Get-TerminalCandidate','Resolve-TerminalLiveness','Resolve-WatchdogDecision')) {",
  "  $fn = $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name }, $true) | Select-Object -First 1",
  "  if (-not $fn) { throw ('no function ' + $name + ' in ' + $Path) }",
  "  Invoke-Expression $fn.Extent.Text",
  "}",
  "function Cand([int] $id, [int] $session, $path) { [pscustomobject]@{ Id = $id; SessionId = $session; Path = $path } }",
  "$now = [datetime]::Parse('2026-11-09T19:00:00Z').ToUniversalTime()",
  "function Decide($liveness, [int] $signedOn, $lastReboot) {",
  "  return (Resolve-WatchdogDecision -Liveness $liveness -SignedOnCount $signedOn -LastRebootUtc $lastReboot -RebootCooldownMinutes 30 -Now $now).Action",
  "}",
  "function Report($liveness, [int] $signedOn, $lastReboot) {",
  "  return [pscustomobject]@{",
  "    state = $liveness.State",
  "    matched = @($liveness.Matched | ForEach-Object { $_.Id })",
  "    others = @($liveness.Others | ForEach-Object { $_.Id })",
  "    unreadable = @($liveness.Unreadable | ForEach-Object { $_.Id })",
  "    action = (Decide $liveness $signedOn $lastReboot)",
  "  }",
  "}",
  "function Look($candidates, [string] $wanted) {",
  "  return (Resolve-TerminalLiveness -Candidates $candidates -TerminalPath $wanted)",
  "}"
].join("\r\n");

const PROBE_BODY = [
  "$out = [ordered]@{}",
  // both terminals up: lane 1 is the match, lane 2 is named as a different process, nothing to do
  "$out.both_running = Report (Look @((Cand 100 1 $Lane1), (Cand 200 1 $Lane2)) $Lane1) 1 $null",
  // lane 1 gone, lane 2 up: the case the name-only check could not see
  "$out.lane1_missing_lane2_running = Report (Look @((Cand 200 1 $Lane2)) $Lane1) 1 $null",
  // no terminal of that name at all
  "$out.no_terminal_signed_on = Report (Look @() $Lane1) 1 $null",
  "$out.no_terminal_nobody_signed_on = Report (Look @() $Lane1) 0 $null",
  // a terminal-shaped process whose path cannot be read: the answer is unknown, and it acts on nothing
  "$out.path_unreadable_only = Report (Look @((Cand 300 1 $null)) $Lane1) 1 $null",
  "$out.path_unreadable_nobody_signed_on = Report (Look @((Cand 300 1 $null)) $Lane1) 0 $null",
  // a match outranks an unreadable sibling: lane 1 is provably alive
  "$out.running_with_unreadable_sibling = Report (Look @((Cand 100 1 $Lane1), (Cand 300 1 $null)) $Lane1) 1 $null",
  // the same executable in another case, with a trailing separator
  "$out.path_case_and_slash = Report (Look @((Cand 100 1 ($Lane1.ToUpperInvariant() + '\\'))) $Lane1) 1 $null",
  // no lane path configured: nothing to compare against, so nothing may be started either
  "$out.no_lane_path = Report (Look @((Cand 100 1 $Lane1)) '') 1 $null",
  // the reboot cooldown still holds when nobody is signed on
  "$out.missing_inside_cooldown = Report (Look @() $Lane1) 0 $now.AddMinutes(-5)",
  "$out.missing_past_cooldown = Report (Look @() $Lane1) 0 $now.AddMinutes(-45)",
  // and the reasons, which are what the log line carries
  "$out.reasons = [pscustomobject]@{",
  "  unknown = (Resolve-WatchdogDecision -Liveness (Look @((Cand 300 1 $null)) $Lane1) -SignedOnCount 1 -LastRebootUtc $null -RebootCooldownMinutes 30 -Now $now).Reason",
  "  no_path = (Resolve-WatchdogDecision -Liveness (Look @((Cand 100 1 $Lane1)) '') -SignedOnCount 1 -LastRebootUtc $null -RebootCooldownMinutes 30 -Now $now).Reason",
  "}",
  "[pscustomobject]$out | ConvertTo-Json -Depth 6 -Compress"
].join("\r\n");

const PROBE = PROBE_HEAD + "\r\n" + PROBE_BODY;

async function scenarios() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "watchdog-lane-"));
  const probe = path.join(dir, "probe.ps1");
  fs.writeFileSync(probe, PROBE, "utf8");
  const result = await runPowerShell(["-File", probe, "-Path", watchdogPath, "-Lane1", lane1, "-Lane2", lane2]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout.trim());
}

test("lane 1 is the one executable, so a live lane 2 cannot stand in for it", windowsOnly, async () => {
  const found = await scenarios();
  assert.equal(found.both_running.state, "running");
  assert.deepEqual(found.both_running.matched, [100], "the match must be the process at lane 1's path");
  assert.deepEqual(found.both_running.others, [200], "the second terminal is a different process, not the lane");
  assert.equal(found.both_running.action, "none");

  assert.equal(found.lane1_missing_lane2_running.state, "missing",
    "with lane 2 up and lane 1 gone the state must be missing; a name-only check would still say running");
  assert.deepEqual(found.lane1_missing_lane2_running.matched, []);
  assert.deepEqual(found.lane1_missing_lane2_running.others, [200]);
  assert.equal(found.lane1_missing_lane2_running.action, "start-task");

  assert.equal(found.running_with_unreadable_sibling.state, "running", "a path match is proof even beside an unreadable one");
  assert.equal(found.running_with_unreadable_sibling.action, "none");
  assert.deepEqual(found.running_with_unreadable_sibling.unreadable, [300]);

  assert.equal(found.path_case_and_slash.state, "running", "Windows paths compare without case and without a trailing separator");
});

test("with no terminal at all the old recovery still runs, cooldown included", windowsOnly, async () => {
  const found = await scenarios();
  assert.equal(found.no_terminal_signed_on.state, "missing");
  assert.equal(found.no_terminal_signed_on.action, "start-task");
  assert.equal(found.no_terminal_nobody_signed_on.action, "reboot");
  assert.equal(found.missing_inside_cooldown.action, "hold");
  assert.equal(found.missing_past_cooldown.action, "reboot");
});

test("a terminal whose path cannot be read is reported and recovers nothing", windowsOnly, async () => {
  const found = await scenarios();
  assert.equal(found.path_unreadable_only.state, "unknown");
  assert.equal(found.path_unreadable_only.action, "report-only",
    "an unreadable path must never reach the startup task or the reboot");
  assert.equal(found.path_unreadable_nobody_signed_on.action, "report-only",
    "signing on cannot turn an unknown into a reason to act");
  assert.deepEqual(found.path_unreadable_only.unreadable, [300]);
  assert.match(found.reasons.unknown, /cannot be read/);
  assert.equal(found.no_lane_path.action, "report-only", "an empty lane path leaves nothing to compare, so nothing is started");
  assert.match(found.reasons.no_path, /no lane terminal path/);
});

// The scenarios above are the decision; this is the body that acts on it. `schtasks.exe` and `shutdown.exe` must each
// sit in the one switch branch that names them, so no path through the file reaches them without that branch chosen.
async function actionShape() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "watchdog-shape-"));
  const probe = path.join(dir, "shape.ps1");
  fs.writeFileSync(probe, [
    "param([string] $Path)",
    "$ast = [System.Management.Automation.Language.Parser]::ParseFile($Path, [ref]$null, [ref]$null)",
    "function ClauseOf($ast, [string] $command) {",
    "  $call = $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.CommandAst] -and",
    "    $n.GetCommandName() -eq $command }, $true) | Select-Object -First 1",
    "  if (-not $call) { return 'absent' }",
    "  $node = $call.Parent",
    "  while ($node) {",
    "    if ($node -is [System.Management.Automation.Language.SwitchStatementAst]) {",
    "      foreach ($clause in $node.Clauses) {",
    "        if ($clause.Item2.Extent.Text.Contains($command)) {",
    "          $label = $clause.Item1.Extent.Text -replace '[\"'']', ''",
    "          return ($node.Condition.Extent.Text + '=' + $label)",
    "        }",
    "      }",
    "      return ('switch:' + $node.Condition.Extent.Text + '=unlabelled')",
    "    }",
    "    $node = $node.Parent",
    "  }",
    "  return 'outside-switch'",
    "}",
    "$reads = $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.CommandAst] -and",
    "  $n.GetCommandName() -eq 'Get-Process' }, $true) | Where-Object {",
    "  $_.CommandElements.Count -gt 2 -and $_.CommandElements[1].Extent.Text -eq '-Name' -and",
    "  $_.CommandElements[2].Extent.Text -eq '$TerminalProcess' }",
    "[pscustomobject]@{",
    "  start_task_clause = ClauseOf $ast 'schtasks.exe'",
    "  reboot_clause = ClauseOf $ast 'shutdown.exe'",
    "  terminal_process_reads = @($reads).Count",
    "} | ConvertTo-Json -Compress"
  ].join("\r\n"), "utf8");
  const result = await runPowerShell(["-File", probe, "-Path", watchdogPath]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout.trim());
}

test("the startup task and the reboot sit in their own decision branches", windowsOnly, async () => {
  const shape = await actionShape();
  assert.equal(shape.start_task_clause, "$decision.Action=start-task",
    `schtasks.exe is in ${shape.start_task_clause}, not in the start-task branch`);
  assert.equal(shape.reboot_clause, "$decision.Action=reboot",
    `shutdown.exe is in ${shape.reboot_clause}, not in the reboot branch`);
  assert.equal(shape.terminal_process_reads, 1,
    "the terminal is enumerated in exactly one place, so no branch can go back to the name-only question");
});

test("a running process that is not the lane's terminal is not mistaken for it", windowsOnly, async () => {
  // node is certainly running here - it is running this test - and its path is readable, so it stands in for
  // "some other terminal64 process": the wrong executable must land in others, never in a match.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "watchdog-live-"));
  const log = path.join(dir, "watchdog.log");
  const result = await runPowerShell(["-File", watchdogPath,
    "-TerminalProcess", "node",
    "-TerminalPath", "C:\\nowhere\\terminal64.exe",
    "-Log", log,
    "-RebootMarker", path.join(dir, "last-reboot.txt"),
    "-SnapshotMinutes", "0",
    "-HardenScript", path.join(dir, "no-harden.ps1"),
    "-RollbackFile", path.join(dir, "no-rollback.json"),
    "-WhatIfAction"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.doesNotMatch(result.stdout, /ok terminal running/, "a running node.exe was accepted as the lane's terminal");
  assert.match(result.stdout, /missing terminal|no startup task and no reboot/);
  const written = fs.readFileSync(log, "utf8");
  assert.doesNotMatch(written, /ok terminal running/);
  assert.match(written, /missing terminal|no startup task and no reboot/);
});
