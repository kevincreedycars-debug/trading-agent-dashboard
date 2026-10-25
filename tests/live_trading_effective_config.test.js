const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// The effective settings of the live loop live in four places at once - the wrapper the scheduler runs, the
// task definition, the lanes file and the heartbeat - and only the first of them says whether the loop may
// place. On 2026-10-24 the wrapper lost --confirm-live, --max-open 1 and --expire-minutes 30 and nothing that
// read the repository could tell. These tests hold the read-back that makes such a change visible, and the
// comparison that refuses to call a moved state path a difference in behaviour without the operator saying so.
const repoRoot = path.join(__dirname, "..");
const scriptPath = path.join(repoRoot, "scripts", "export-live-trading-effective-config.ps1");
const scriptSource = fs.readFileSync(scriptPath, "utf8");
const windowsOnly = { skip: process.platform !== "win32" };

function write(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "live-trading-effective-"));
  write(path.join(dir, "config", "live-trading-lanes.json"), JSON.stringify({
    schema_version: 1,
    publish: { min_interval_seconds: 540, state: "tmp/live-trading-publish-state.json" },
    lanes: [{
      id: "ftmo-1",
      label: "FTMO account 1",
      root: ".",
      feed: "data/live-trading.json",
      published: "data/live-trading.json",
      trader_status: "tmp/live-trading-trader-status.json",
      status_published: "data/live-trading-trader.ftmo-1.json",
      account_login_masked: "***614",
      account_server: "FTMO-Server"
    }]
  }, null, 2));
  write(path.join(dir, "tmp", "live-trading-trader-status.json"), JSON.stringify({
    schema_version: "live-trading-trader-status-v1",
    lane: "ftmo-1",
    host: { computer: "PC-PRODUCTION", platform: "win32", checkout: "live-trading" },
    written_at_utc: "2026-10-25T20:55:02Z",
    armed: true,
    status: "nothing_to_place",
    account: { login_masked: "***614", server: "FTMO-Server" }
  }, null, 2));
  write(path.join(dir, "tmp", "live-trading-trader-run.cmd"), wrapperLines(dir).join("\r\n") + "\r\n");
  write(path.join(dir, "tmp", "live-trading-trader-state.json"), "{}\n");
  write(path.join(dir, "tmp", "live-trading-orders.log"), "{}\n");
  write(path.join(dir, "tmp", "live-trading-trader.log"), "{}\n");
  return dir;
}

function wrapperLines(dir, { maxOpen = 1 } = {}) {
  return [
    "@echo off",
    'cd /d "' + dir + '"',
    '"C:\\Program Files\\nodejs\\node.exe" "' + path.join(dir, "scripts", "run-live-trading-trader.js") + '" --once --align --settle-seconds 90 --confirm-live --quiet --python "C:\\Python313\\python.exe" ' +
      '--state "' + path.join(dir, "tmp", "live-trading-trader-state.json") + '" --log "' + path.join(dir, "tmp", "live-trading-trader.log") + '" ' +
      '--lock "' + path.join(dir, "tmp", "live-trading-trader.lock") + '" --journal "' + path.join(dir, "tmp", "live-trading-orders.log") + '" ' +
      ' --lane "ftmo-1" --expire-minutes 30 --max-open ' + maxOpen + ' --max-per-day 4 --terminal "C:\\Program Files\\FTMO Global Markets MT5 Terminal"',
    "exit /b %ERRORLEVEL%"
  ];
}

function run(args, options = {}) {
  const result = spawnSync("powershell", [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...args
  ], { encoding: "utf8", timeout: 60000, ...options });
  return result;
}

// The script must be a reader: no wrapper write, no task registration, no state write. The one file it creates
// is the document it was asked for. This is asserted on the source because a read-only promise is exactly what
// the 2026-10-24 incident broke, and the tests below then prove it against a real run.
test("the read-back script only reads: it writes no wrapper, registers no task and edits no state", () => {
  assert.equal(/Register-ScheduledTask|Unregister-ScheduledTask|Set-ScheduledTask|Start-ScheduledTask/.test(scriptSource), false);
  assert.equal(/Set-Content|Add-Content|Out-File/.test(scriptSource), false);
  assert.equal(/\bCopy-Item\b|\bMove-Item\b|\bRemove-Item\b/.test(scriptSource), false);
  for (const field of [
    "armed", "max_open", "max_per_day", "expire_minutes", "settle_seconds", "align",
    "lane", "account_login_masked", "state", "journal", "log", "lock", "confirm-live"
  ]) {
    assert.ok(scriptSource.includes(field), `the read-back must name ${field}`);
  }
  assert.match(scriptSource, /Export-ScheduledTask/, "the task definition is read, not assumed");
  assert.match(scriptSource, /evidence_only\s*=\s*\$true/, "the heartbeat is labelled as evidence of a run");
  assert.match(scriptSource, /relocated_paths/, "a moved path is reported separately from a behaviour change");
});

test("the read-back parses the wrapper, the lane and the heartbeat into one document", windowsOnly, () => {
  const dir = fixture();
  const outPath = path.join(dir, "effective.json");
  const result = run(["-RepoRoot", dir, "-TaskName", "LiveTradingEffectiveConfigProbe", "-Out", outPath]);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const document = JSON.parse(fs.readFileSync(outPath, "utf8").replace(/^\uFEFF/, ""));
  assert.equal(document.schema_version, "live-trading-effective-config-v1");
  assert.equal(document.lane.id, "ftmo-1");
  assert.equal(document.behaviour.armed, true, "the arming is read out of the wrapper, not out of a file's defaults");
  assert.equal(document.behaviour.max_open, 1);
  assert.equal(document.behaviour.max_per_day, 4);
  assert.equal(document.behaviour.expire_minutes, 30);
  assert.equal(document.behaviour.settle_seconds, 90);
  assert.equal(document.behaviour.align, true);
  assert.equal(document.behaviour.lane, "ftmo-1");
  assert.equal(document.behaviour.account_login_masked, "***614");
  assert.equal(document.behaviour.lanes_login_masked, "***614");
  assert.equal(document.location.state, path.join(dir, "tmp", "live-trading-trader-state.json"));
  assert.match(document.wrapper.sha256, /^[a-f0-9]{64}$/);
  assert.equal(document.heartbeat.evidence_only, true);
  assert.equal(document.heartbeat.armed, true);
  assert.equal(document.heartbeat.host_computer, "PC-PRODUCTION");

  // Nothing else appeared in the checkout, and the wrapper is byte-for-byte what it was.
  const wrapper = fs.readFileSync(path.join(dir, "tmp", "live-trading-trader-run.cmd"), "utf8");
  assert.equal(wrapper.includes("--max-open 1"), true);
  assert.deepEqual(
    fs.readdirSync(path.join(dir, "tmp")).sort(),
    ["live-trading-orders.log", "live-trading-trader-run.cmd", "live-trading-trader-state.json", "live-trading-trader-status.json", "live-trading-trader.log"]
  );
});


test("reading the same machine twice is identical, and a changed cap is a stated behaviour difference", windowsOnly, () => {
  const dir = fixture();
  const outPath = path.join(dir, "effective.json");
  assert.equal(run(["-RepoRoot", dir, "-TaskName", "LiveTradingEffectiveConfigProbe", "-Out", outPath]).status, 0);

  const identical = run(["-RepoRoot", dir, "-TaskName", "LiveTradingEffectiveConfigProbe", "-Compare", outPath]);
  assert.equal(identical.status, 0, identical.stdout);
  assert.match(identical.stdout, /compare_scope\s+= same_host/);
  assert.match(identical.stdout, /result\s+= identical/);

  // Change only the cap in the wrapper: the comparison must name it and exit non-zero, because a cap that moved
  // is a different live behaviour however the task name and the log line still read.
  write(path.join(dir, "tmp", "live-trading-trader-run.cmd"), wrapperLines(dir, { maxOpen: 2 }).join("\r\n") + "\r\n");
  const changed = run(["-RepoRoot", dir, "-TaskName", "LiveTradingEffectiveConfigProbe", "-Compare", outPath]);
  assert.equal(changed.status, 1);
  assert.match(changed.stdout, /difference_behaviour = max_open: 1 -> 2/);
  assert.match(changed.stdout, /difference_wrapper/);
  assert.match(changed.stdout, /result\s+= behaviour_differences/);
});

test("a different host's paths are relocated, not silently accepted as the same behaviour", windowsOnly, () => {
  const dir = fixture();
  const outPath = path.join(dir, "effective.json");
  assert.equal(run(["-RepoRoot", dir, "-TaskName", "LiveTradingEffectiveConfigProbe", "-Out", outPath]).status, 0);

  const document = JSON.parse(fs.readFileSync(outPath, "utf8"));
  document.host.computer = "VPS-PORTSMOUTH";
  document.location.state = "C:\\live-trading\\tmp\\live-trading-trader-state.json";
  document.location.journal = "C:\\live-trading\\tmp\\live-trading-orders.log";
  document.location.log = "C:\\live-trading\\tmp\\live-trading-trader.log";
  document.location.lock = "C:\\live-trading\\tmp\\live-trading-trader.lock";
  const movedPath = path.join(dir, "effective-other-host.json");
  fs.writeFileSync(movedPath, JSON.stringify(document, null, 2));

  const strict = run(["-RepoRoot", dir, "-TaskName", "LiveTradingEffectiveConfigProbe", "-Compare", movedPath]);
  assert.equal(strict.status, 1, "a moved path is a claim a person makes, not one the script assumes");
  assert.match(strict.stdout, /compare_scope\s+= cross_host/);
  assert.match(strict.stdout, /path_relocated\s+= state:/);
  assert.match(strict.stdout, /result\s+= relocated_paths/);
  assert.match(strict.stdout, /hashes_skipped/);

  const accepted = run(["-RepoRoot", dir, "-TaskName", "LiveTradingEffectiveConfigProbe", "-Compare", movedPath, "-AllowRelocatedPaths"]);
  assert.equal(accepted.status, 0, accepted.stdout);
  assert.match(accepted.stdout, /result\s+= identical/);
});

