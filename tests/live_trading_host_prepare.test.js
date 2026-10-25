const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// The host build is a sequence of steps a person performs once, and the risk is not that a step is missing
// from the runbook - it is that the host afterwards looks right while one field is wrong: a trader task that
// only runs when somebody is logged on, a second lane whose lock file is the first lane's, a heartbeat that
// was copied from the old PC. These tests hold the read-back that names those, and the rule that it changes
// nothing while reading.
const repoRoot = path.join(__dirname, "..");
const scriptPath = path.join(repoRoot, "scripts", "prepare-live-trading-host.ps1");
const probePath = path.join(repoRoot, "tools", "mt5-bridge", "live-trading-account-probe.py");
const scriptSource = fs.readFileSync(scriptPath, "utf8");
const probeSource = fs.readFileSync(probePath, "utf8");
const windowsOnly = { skip: process.platform !== "win32" };
// The probe test needs the interpreter the producer runs on; without it the test skips rather than pretends.
const pythonForProbe = [path.join("C:", "Python313", "python.exe")].find((candidate) => fs.existsSync(candidate));

function write(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function git(dir, args) {
  const result = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, `git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function initRepo(dir) {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, ["init", "-q"]);
  git(dir, ["-c", "user.email=fixture@example.com", "-c", "user.name=fixture", "commit", "-q", "--allow-empty", "-m", "fixture"]);
  return git(dir, ["rev-parse", "HEAD"]);
}

function wrapperText(dir, { state, log, lock, journal, terminal, armed = true }) {
  return [
    "@echo off",
    'cd /d "' + dir + '"',
    '"C:\\\\Program Files\\\\nodejs\\\\node.exe" "' + path.join(dir, "scripts", "run-live-trading-trader.js") + '" --once --quiet ' +
      (armed ? "--confirm-live " : "") +
      '--python "C:\\\\Python313\\\\python.exe" --state "' + state + '" --log "' + log + '" --lock "' + lock + '" --journal "' + journal + '" ' +
      '--lane "fixture" --terminal "' + terminal + '"',
    "exit /b %ERRORLEVEL%"
  ].join("\r\n") + "\r\n";
}

function run(args) {
  return spawnSync("powershell", [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...args
  ], { encoding: "utf8", timeout: 120000 });
}

function check(document, id) {
  const found = (document.checks || []).find((entry) => entry.id === id);
  assert.ok(found, `no check named ${id}; got ${(document.checks || []).map((entry) => entry.id).join(", ")}`);
  return found;
}

// Two lanes, two roots, two terminals, one commit - the layout the host is supposed to have. Each test then
// breaks exactly one thing, so the check that names it is the only one that moves.
function fixture({ sharedLock = false } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "live-trading-host-"));
  const publisher = path.join(base, "publisher");
  const laneA = path.join(base, "lane-a");
  const laneB = path.join(base, "lane-b");
  initRepo(publisher);
  const commit = initRepo(laneA);
  initRepo(laneB);

  const terminalA = path.join(base, "terminals", "terminal-a");
  const terminalB = path.join(base, "terminals", "terminal-b");
  fs.mkdirSync(terminalA, { recursive: true });
  fs.mkdirSync(terminalB, { recursive: true });

  const now = new Date().toISOString();
  const lanes = [
    { id: "lane-a", dir: laneA, terminal: terminalA },
    { id: "lane-b", dir: laneB, terminal: terminalB }
  ];
  for (const lane of lanes) {
    write(path.join(lane.dir, "tmp", "live-trading-trader-run.cmd"), wrapperText(lane.dir, {
      state: path.join(lane.dir, "tmp", "live-trading-trader-state.json"),
      log: path.join(lane.dir, "tmp", "live-trading-trader.log"),
      lock: sharedLock ? path.join(laneA, "tmp", "live-trading-trader.lock") : path.join(lane.dir, "tmp", "live-trading-trader.lock"),
      journal: path.join(lane.dir, "tmp", "live-trading-orders.log"),
      terminal: lane.terminal
    }));
    write(path.join(lane.dir, "data", "live-trading.json"), JSON.stringify({
      schema_version: "live-trading-feed-v4",
      generated_at_utc: now,
      instruments: [{ symbol: "EURUSD" }, { symbol: "XAUUSD" }]
    }, null, 2));
    write(path.join(lane.dir, "tmp", "live-trading-trader-status.json"), JSON.stringify({
      schema_version: "live-trading-trader-status-v1",
      lane: lane.id,
      // lane-a's heartbeat was written on this computer; lane-b's was written on the old PC and copied, which
      // is the state every migrated lane is in until its own first tick.
      host: { computer: lane.id === "lane-a" ? process.env.COMPUTERNAME : "OLD-PC", platform: "win32" },
      written_at_utc: now,
      expected_interval_seconds: 300,
      armed: true,
      status: "nothing_to_place",
      account: { login_masked: "***111", server: "FTMO-Server" }
    }, null, 2));
  }

  write(path.join(publisher, "config", "live-trading-lanes.json"), JSON.stringify({
    schema_version: 1,
    publish: { min_interval_seconds: 600, state: "tmp/publish-state.json" },
    lanes: lanes.map((lane, index) => ({
      id: lane.id,
      label: "Fixture lane " + lane.id,
      root: "../" + path.basename(lane.dir),
      feed: "data/live-trading.json",
      published: "data/live-trading.json",
      trader_status: "tmp/live-trading-trader-status.json",
      status_published: "data/live-trading-trader." + lane.id + ".json",
      account_login_masked: "***11" + (index + 1),
      account_server: "FTMO-Server",
      terminal: lane.terminal,
      tasks: { lane: "FixtureLane" + index, trader: "FixtureTrader" + index, startup: "FixtureStartup" + index }
    }))
  }, null, 2));

  return { base, publisher, laneA, laneB, commit };
}

function verify(fix, extra = []) {
  const outPath = path.join(fix.base, "verify.json");
  const result = run([
    "-Mode", "Verify",
    "-RuntimeRoot", fix.laneA,
    "-PublisherRoot", fix.publisher,
    "-Out", outPath,
    ...extra
  ]);
  const document = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, "utf8")) : null;
  return { result, document };
}


// A promise of read-only is worth asserting on the source as well as on a run: the 2026-10-24 incident was a
// line that looked like an inspection rewriting the wrapper, and a run only proves what that run happened to
// touch.
test("the prepare script registers no task, writes no wrapper and removes nothing", () => {
  assert.equal(/Register-ScheduledTask|Unregister-ScheduledTask|Set-ScheduledTask|Start-ScheduledTask|Stop-ScheduledTask/.test(scriptSource), false);
  assert.equal(/Set-Content|Add-Content|Out-File|Remove-Item|Copy-Item|Move-Item/.test(scriptSource), false);
  // The only write in the file is the document it was asked for, once per mode.
  assert.equal((scriptSource.match(/WriteAllText/g) || []).length, 2);
  assert.equal(/order_send|order_check|order_calc/.test(scriptSource), false);
});

test("the probe is read-only: it names no order function and closes the terminal it opened", () => {
  assert.equal(/order_send|order_check|order_calc|order_close|position_close/.test(probeSource), false);
  assert.equal(/mt5\.shutdown\(\)/.test(probeSource), true);
  assert.equal(/log\(|logging\.|print\(/.test(probeSource), true);
  // The login is masked with the same three digits the snapshot uses, never printed whole.
  assert.equal(probeSource.includes('"***" + str(login)[-3:]'), true);
});

test("plan mode prints the ten build steps in order and changes nothing", windowsOnly, () => {
  const fix = fixture();
  const wrapperHash = () => fs.readFileSync(path.join(fix.laneA, "tmp", "live-trading-trader-run.cmd"), "utf8");
  const before = wrapperHash();
  const outPath = path.join(fix.base, "plan.json");
  const result = run(["-Mode", "Plan", "-Out", outPath]);
  assert.equal(result.status, 0, result.stderr);
  const lines = result.stdout.split(/\r?\n/);
  const ordered = lines.filter((line) => /^\s*\d+\.\s/.test(line)).map((line) => Number(line.trim().match(/^(\d+)\./)[1]));
  assert.deepEqual(ordered, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(before, wrapperHash(), "plan mode rewrote the lane's wrapper");

  const document = JSON.parse(fs.readFileSync(outPath, "utf8"));
  assert.equal(document.schema_version, "live-trading-host-prepare-v1");
  assert.equal(document.mode, "Plan");
  assert.equal(document.steps.length, 10);
  assert.equal(document.checks.length, 0);
  assert.equal(document.result, "planned");
  assert.equal(fs.existsSync(path.join(fix.base, "verify.json")), false);
});

test("a shared lock file between two lanes is a blocking failure that names both lanes", windowsOnly, () => {
  const fix = fixture({ sharedLock: true });
  const { result, document } = verify(fix);
  assert.equal(result.status, 1);
  assert.equal(document.result, "blocked");
  const isolation = check(document, "lane_paths_isolated");
  assert.equal(isolation.ok, false);
  assert.equal(isolation.severity, "blocking");
  assert.match(isolation.detail, /lock/);
  assert.match(isolation.detail, /lane-a/);
  assert.match(isolation.detail, /lane-b/);
});

test("two lanes on separate paths, terminals and artifact names are isolated", windowsOnly, () => {
  const fix = fixture();
  const { document } = verify(fix);
  assert.equal(check(document, "lane_paths_isolated").ok, true);
  assert.equal(check(document, "lane_task_names_isolated").ok, true);
});

test("a heartbeat written on another computer is history, not health", windowsOnly, () => {
  const fix = fixture();
  const { document } = verify(fix);
  const ownHost = check(document, "lane_lane-a_heartbeat_written_here");
  assert.equal(ownHost.ok, true);
  const copied = check(document, "lane_lane-b_heartbeat_written_here");
  assert.equal(copied.ok, false);
  assert.equal(copied.severity, "blocking");
  assert.match(copied.detail, /OLD-PC/);
  assert.match(copied.detail, /history, not health/);
});

test("a parked lane is reported, and cannot fail the run", windowsOnly, () => {
  const fix = fixture();
  const lanesPath = path.join(fix.publisher, "config", "live-trading-lanes.json");
  const lanes = JSON.parse(fs.readFileSync(lanesPath, "utf8"));
  lanes.lanes[1].enabled = false;
  write(lanesPath, JSON.stringify(lanes, null, 2));
  const { document } = verify(fix);
  for (const id of ["lane_lane-b_root_present", "lane_lane-b_trader_task_registered", "lane_lane-b_heartbeat_written_here"]) {
    const entry = check(document, id);
    assert.equal(entry.severity, "advisory", `${id} must not be blocking while the lane is parked`);
  }
  assert.equal(check(document, "lane_lane-a_heartbeat_written_here").severity, "blocking");
});


test("a checkout is only pinned when the pinned commit is given, and then it must match HEAD", windowsOnly, () => {
  const fix = fixture();
  const unpinned = verify(fix).document;
  const withoutCommit = check(unpinned, "checkout_runtime_commit_pinned");
  assert.equal(withoutCommit.ok, false);
  assert.match(withoutCommit.detail, /nothing is pinned/);

  const pinned = verify(fix, ["-PinnedCommit", fix.commit]).document;
  assert.equal(check(pinned, "checkout_runtime_commit_pinned").ok, true);

  const wrong = verify(fix, ["-PinnedCommit", "0123456789abcdef"]).document;
  assert.equal(check(wrong, "checkout_runtime_commit_pinned").ok, false);
});

test("the exit code follows the checks: with the inapplicable ones ignored a clean fixture passes", windowsOnly, () => {
  const fix = fixture();
  const first = verify(fix);
  assert.equal(first.result.status, 1);
  const failing = first.document.checks.filter((entry) => !entry.ok && entry.severity === "blocking").map((entry) => entry.id);
  assert.ok(failing.length > 0, "the fixture is expected to fail something on a PC: autologon and RDP are host settings");

  const second = verify(fix, ["-IgnoreCheck", failing.join(",")]);
  assert.equal(second.result.status, 0, second.result.stdout);
  assert.equal(second.document.result, "host_ready");
  assert.equal(second.document.blocking_failures, 0);
  for (const id of failing) {
    const entry = check(second.document, id);
    assert.equal(entry.ok, false, "ignoring a check must not turn it into a pass");
    assert.match(entry.detail, /^ignored by -IgnoreCheck:/);
  }
});

test("the document counts exactly the blocking failures it lists", windowsOnly, () => {
  const fix = fixture({ sharedLock: true });
  const { document } = verify(fix);
  const counted = document.checks.filter((entry) => !entry.ok && entry.severity === "blocking").length;
  assert.equal(document.blocking_failures, counted);
  assert.equal(document.advisories, document.checks.filter((entry) => !entry.ok && entry.severity === "advisory").length);
  assert.equal(document.host.computer, process.env.COMPUTERNAME);
  assert.equal(document.paths.runtime_root.toLowerCase(), fix.laneA.toLowerCase());
});

test("the probe prints a machine-readable document, and a missing terminal is a document rather than a crash", { skip: !pythonForProbe }, () => {
  const python = pythonForProbe;
  const result = spawnSync(python, [
    probePath,
    "--path=" + path.join(os.tmpdir(), "definitely-not-a-terminal"),
    "--symbols=EURUSD"
  ], { encoding: "utf8", timeout: 60000 });
  const document = JSON.parse(result.stdout);
  assert.equal(document.schema_version, "live-trading-account-probe-v1");
  assert.equal(document.read_only, true);
  assert.equal(document.order_functions_called, false);
  assert.equal(typeof document.ok, "boolean");
  assert.equal(document.ok, false);
  assert.ok(document.error.message, "a failed probe says why");
  assert.equal(result.status, 1);
});

