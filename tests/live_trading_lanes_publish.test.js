// Contract tests for the two-lane publisher: the one place both FTMO accounts' artifacts are allowed onto the
// branch Pages serves. The gates themselves live in publish-live-trading-feed.js and are tested there; what is
// asserted here is what this file adds - the lanes file's own shape, the identity check that stops one account's
// read being published under the other's name, and the fact that both artifacts leave in one commit.
//
// Nothing here touches the real remote, the real checkout or the real repository's history: git is a recorded
// stand-in, the clock is injected, and the lanes and their artifacts are written into a temp directory.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const lanes = require("../scripts/publish-live-trading-lanes.js");

const root = path.resolve(__dirname, "..");
const committedFeedPath = path.join(root, "data", "live-trading.json");
const NOW_MS = Date.parse("2026-10-24T15:00:00.000Z");

// The fixture is the committed artifact with its own clock moved, so a real read-only snapshot is what the gates
// above this file see rather than a hand-built object that could pass here and fail on the page.
function laneFeed({ generatedAtMs = NOW_MS, loginMasked = null, server = null } = {}) {
  const feed = JSON.parse(fs.readFileSync(committedFeedPath, "utf8"));
  feed.generated_at_utc = new Date(generatedAtMs).toISOString();
  feed.stale_after_seconds = 900;
  if (loginMasked !== null && feed.account && typeof feed.account === "object") feed.account.login_masked = loginMasked;
  if (server !== null && feed.account && typeof feed.account === "object") feed.account.server = server;
  return feed;
}

// Two lanes in two directories, each with its own snapshot, and a lanes file that points at them. `root` is
// absolute here because a test's temp directory is not nested under the checkout the way the VPS lanes are.
function workspace({ laneOne = {}, laneTwo = {}, overrides = () => ({}) } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "live-trading-lanes-"));
  const checkout = path.join(dir, "publish-checkout");
  fs.mkdirSync(path.join(checkout, "data"), { recursive: true });

  const makeLane = (name, feedOptions) => {
    const rootDir = path.join(dir, name);
    fs.mkdirSync(path.join(rootDir, "data"), { recursive: true });
    const artifact = path.join(rootDir, "data", "live-trading.json");
    fs.writeFileSync(artifact, JSON.stringify(laneFeed(feedOptions), null, 2));
    return { rootDir, artifact };
  };
  const first = makeLane("ftmo1", laneOne);
  const second = makeLane("ftmo2", laneTwo);

  const config = {
    schema_version: 1,
    publish: { min_interval_seconds: 600, state: path.join(dir, "publish-state.json") },
    lanes: [
      {
        id: "ftmo-1",
        label: "FTMO account 1",
        root: first.rootDir,
        feed: "data/live-trading.json",
        published: "data/live-trading.json",
        account_login_masked: null,
        account_server: null,
        ...overrides("ftmo-1")
      },
      {
        id: "ftmo-2",
        label: "FTMO account 2",
        root: second.rootDir,
        feed: "data/live-trading.json",
        published: "data/live-trading.account2.json",
        account_login_masked: null,
        account_server: null,
        ...overrides("ftmo-2")
      }
    ]
  };
  const configPath = path.join(dir, "lanes.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  return { dir, checkout, configPath, config, state: config.publish.state, first, second };
}

function optionsFor(space, overrides = {}) {
  return {
    config: space.configPath,
    checkout: space.checkout,
    remote: "origin",
    branch: "main",
    minIntervalSeconds: null,
    state: null,
    force: false,
    dryRun: false,
    json: false,
    help: false,
    ...overrides
  };
}

// A stand-in for git: it records every command and answers the handful the publisher issues. `remoteFeeds` maps
// a published path to the JSON the served branch carries for it, so one lane can be current while the other is
// new; a path that is absent is answered the way git answers a file the branch does not carry.
function fakeGit({ remoteFeeds = {}, pushResults = [0] } = {}) {
  const calls = [];
  let pushIndex = 0;
  const exec = (command, args) => {
    calls.push({ command, args });
    if (command !== "git") return { status: 127, stdout: "", stderr: `${command} is not git` };
    const joined = args.join(" ");
    if (joined.includes("--git-common-dir")) return { status: 0, stdout: "D:/canonical/.git", stderr: "" };
    if (args[0] === "worktree") return { status: 0, stdout: "", stderr: "" };
    if (args.includes("fetch")) return { status: 0, stdout: "", stderr: "" };
    if (args.includes("show")) {
      const spec = args[args.length - 1];
      const entry = Object.entries(remoteFeeds).find(([relative]) => spec.endsWith(relative));
      if (!entry) {
        return { status: 128, stdout: "", stderr: `fatal: path '${spec}' does not exist in 'origin/main'` };
      }
      return { status: 0, stdout: JSON.stringify(entry[1], null, 2), stderr: "" };
    }
    if (args.includes("checkout") && args.includes("--detach")) return { status: 0, stdout: "", stderr: "" };
    if (args.includes("add")) return { status: 0, stdout: "", stderr: "" };
    if (args.includes("commit")) return { status: 0, stdout: "[main abc123] publish", stderr: "" };
    if (args.includes("rev-parse")) return { status: 0, stdout: "abc123def456", stderr: "" };
    if (args.includes("push")) {
      const status = pushResults[Math.min(pushIndex, pushResults.length - 1)];
      pushIndex += 1;
      return status === 0
        ? { status: 0, stdout: "", stderr: "To https://example.invalid/repo.git\n   8a976e3..abc123d  HEAD -> main" }
        : { status: 1, stdout: "", stderr: "! [rejected]        HEAD -> main (fetch first)" };
    }
    return { status: 0, stdout: "", stderr: "" };
  };
  return { exec, calls, pushes: () => pushIndex };
}

function gitCalls(calls) {
  return calls.map((call) => call.args.join(" "));
}

// main() reports through stdout and stderr; the assertions below care about the exit code, so the streams are
// borrowed and put back rather than left noisy in the test log.
function captureStdio(fn) {
  const original = { out: process.stdout.write, err: process.stderr.write };
  let out = "";
  let err = "";
  process.stdout.write = (chunk) => {
    out += chunk;
    return true;
  };
  process.stderr.write = (chunk) => {
    err += chunk;
    return true;
  };
  try {
    return { code: fn(), out, err };
  } finally {
    process.stdout.write = original.out;
    process.stderr.write = original.err;
  }
}

const deps = (git) => ({ exec: git.exec, now: () => NOW_MS });

test("the lanes file is read with its own defaults, so a lane that names only an id still has a file", () => {
  const space = workspace({
    overrides: (id) => (id === "ftmo-1" ? { feed: undefined, published: undefined } : {})
  });
  const file = lanes.loadLanes(space.configPath);

  assert.equal(file.lanes.length, 2);
  assert.equal(file.lanes[0].feed, "data/live-trading.json");
  assert.equal(file.lanes[0].published, "data/live-trading.json");
  assert.equal(file.lanes[0].root, space.first.rootDir);
  assert.equal(file.minIntervalSeconds, 600);
  assert.equal(file.state, space.state);
});

test("two lanes may not share an id, publish to one file, or come without an id", () => {
  const shared = workspace();
  const config = JSON.parse(fs.readFileSync(shared.configPath, "utf8"));
  config.lanes[1].id = "ftmo-1";
  fs.writeFileSync(shared.configPath, JSON.stringify(config));
  assert.throws(() => lanes.loadLanes(shared.configPath), /two lanes share the id ftmo-1/);

  const sameTarget = workspace();
  const sameTargetConfig = JSON.parse(fs.readFileSync(sameTarget.configPath, "utf8"));
  sameTargetConfig.lanes[1].published = "data/live-trading.json";
  fs.writeFileSync(sameTarget.configPath, JSON.stringify(sameTargetConfig));
  assert.throws(() => lanes.loadLanes(sameTarget.configPath), /two lanes publish to data\/live-trading.json/);

  const unnamed = workspace();
  const unnamedConfig = JSON.parse(fs.readFileSync(unnamed.configPath, "utf8"));
  delete unnamedConfig.lanes[0].id;
  fs.writeFileSync(unnamed.configPath, JSON.stringify(unnamedConfig));
  assert.throws(() => lanes.loadLanes(unnamed.configPath), /lane 1 .* has no id/);

  const missing = path.join(os.tmpdir(), "live-trading-lanes-does-not-exist.json");
  assert.throws(() => lanes.loadLanes(missing), /could not be read/);
});

// A machine can hold two checkouts: the one a lane's cadence trades in and the one that publishes. The committed
// lanes file cannot say which is which, because its roots are relative to whichever checkout reads them, so a host
// names the moved lane beside the file it ships with. These three tests hold that answer: it moves the read, it
// leaves the shared file alone, and a bad line refuses rather than resolving somewhere unexpected.
test("a lane root named on this machine moves the read without touching the shared lanes file", () => {
  const space = workspace();
  const moved = path.join(space.dir, "runtime-tree");
  fs.mkdirSync(path.join(moved, "data"), { recursive: true });
  const localPath = path.join(space.dir, "live-trading-lanes.local.json");
  fs.writeFileSync(localPath, JSON.stringify({ lane_roots: { "ftmo-1": moved } }, null, 2));

  const file = lanes.loadLanes(space.configPath);

  assert.equal(file.lanes[0].root, moved);
  assert.equal(file.lanes[1].root, space.second.rootDir, "a lane not named here keeps its own root");
  assert.equal(file.rootOverrides.present, true);
  assert.equal(file.rootOverrides.path, localPath);
  assert.deepEqual(file.rootOverrides.lanes, ["ftmo-1"]);
  assert.equal(
    JSON.parse(fs.readFileSync(space.configPath, "utf8")).lanes[0].root,
    space.first.rootDir,
    "the shared file the PC and the host both read is not rewritten"
  );
});

test("with no machine-local file every root is the shared file's own, as before", () => {
  const space = workspace();
  const file = lanes.loadLanes(space.configPath);

  assert.equal(file.lanes[0].root, space.first.rootDir);
  assert.equal(file.rootOverrides.present, false);
  assert.deepEqual(file.rootOverrides.lanes, []);
});

test("the publisher reads the snapshot from the machine-local root, not from the shared one", () => {
  const space = workspace();
  const moved = path.join(space.dir, "runtime-tree");
  fs.mkdirSync(path.join(moved, "data"), { recursive: true });
  const movedAt = NOW_MS - 30000;
  fs.writeFileSync(
    path.join(moved, "data", "live-trading.json"),
    JSON.stringify(laneFeed({ generatedAtMs: movedAt }), null, 2)
  );
  fs.writeFileSync(
    path.join(space.dir, "live-trading-lanes.local.json"),
    JSON.stringify({ lane_roots: { "ftmo-1": moved } }, null, 2)
  );
  const git = fakeGit();

  const result = lanes.publishLanes(optionsFor(space), deps(git));

  assert.equal(result.action, "published");
  assert.match(result.lanes[0].artifact, /runtime-tree/);
  const published = JSON.parse(fs.readFileSync(path.join(space.checkout, "data", "live-trading.json"), "utf8"));
  assert.equal(published.generated_at_utc, new Date(movedAt).toISOString());
});

test("a machine-local root that is relative, empty or names an unknown lane is a refusal", () => {
  const write = (space, body) =>
    fs.writeFileSync(path.join(space.dir, "live-trading-lanes.local.json"), JSON.stringify(body));

  const relative = workspace();
  write(relative, { lane_roots: { "ftmo-1": path.join("..", "runtime") } });
  assert.throws(() => lanes.loadLanes(relative.configPath), /not absolute/);

  const empty = workspace();
  write(empty, { lane_roots: { "ftmo-1": "   " } });
  assert.throws(() => lanes.loadLanes(empty.configPath), /gives lane ftmo-1 no path/);

  const stale = workspace();
  write(stale, { lane_roots: { "ftmo-9": path.join(stale.dir, "elsewhere") } });
  assert.throws(() => lanes.loadLanes(stale.configPath), /names lane ftmo-9, which .* does not/);

  const shapeless = workspace();
  write(shapeless, { roots: {} });
  assert.throws(() => lanes.loadLanes(shapeless.configPath), /must carry a lane_roots object/);
});

test("a lane with no configured identity publishes and says the check did not run", () => {
  const lane = { id: "ftmo-1", label: "FTMO account 1", account_login_masked: null, account_server: null };
  const check = lanes.identityCheck(lane, { account: { login_masked: "***614", server: "FTMO-Server" } });

  assert.equal(check.ok, true);
  assert.equal(check.configured, false);
  assert.equal(check.account_login_masked, "***614");
  assert.equal(check.reason, null);
});

test("a lane whose snapshot belongs to another account is refused rather than published under its name", () => {
  const lane = {
    id: "ftmo-1",
    label: "FTMO account 1",
    account_login_masked: "***614",
    account_server: "FTMO-Server"
  };
  const otherAccount = lanes.identityCheck(lane, { account: { login_masked: "***907", server: "FTMO-Server" } });
  assert.equal(otherAccount.ok, false);
  assert.match(otherAccount.reason, /account \*\*\*907.*\*\*\*614/);

  const otherServer = lanes.identityCheck(lane, { account: { login_masked: "***614", server: "FTMO-Server-2" } });
  assert.equal(otherServer.ok, false);
  assert.match(otherServer.reason, /server FTMO-Server-2.*FTMO-Server/);

  const matching = lanes.identityCheck(lane, { account: { login_masked: "***614", server: "FTMO-Server" } });
  assert.equal(matching.ok, true);
  assert.equal(matching.configured, true);
});

test("both lanes leave in one commit and one push, each written to its own published path", () => {
  const space = workspace();
  const git = fakeGit();

  const result = lanes.publishLanes(optionsFor(space), deps(git));

  assert.equal(result.action, "published");
  assert.equal(result.published, true);
  assert.equal(git.pushes(), 1);
  assert.deepEqual(result.pending_targets, ["data/live-trading.json", "data/live-trading.account2.json"]);
  assert.deepEqual(
    result.lanes.map((lane) => lane.id),
    ["ftmo-1", "ftmo-2"]
  );

  const adds = gitCalls(git.calls).filter((call) => call.startsWith("git add") || call.includes(" add "));
  assert.ok(adds.length >= 1, "the publisher stages the artifacts");
  const commits = gitCalls(git.calls).filter((call) => call.includes("commit"));
  assert.equal(commits.length, 1, "one commit carries both lanes");

  // The published copies on the served branch, written by the publisher into the checkout it resets.
  const publishedFirst = JSON.parse(fs.readFileSync(path.join(space.checkout, "data", "live-trading.json"), "utf8"));
  const publishedSecond = JSON.parse(
    fs.readFileSync(path.join(space.checkout, "data", "live-trading.account2.json"), "utf8")
  );
  assert.equal(publishedFirst.generated_at_utc, new Date(NOW_MS).toISOString());
  assert.equal(publishedSecond.generated_at_utc, new Date(NOW_MS).toISOString());
});


// The page can say which machine is trading only if the heartbeat's host travels with the commit. The publisher
// copies the artifact as it is and also states the host and the cadence in the lane's row, so a device that
// cannot read the artifact still sees which host wrote it.
test("a heartbeat's host and cadence travel with the lanes document", () => {
  const space = workspace();
  const written = new Date(NOW_MS - 30_000).toISOString();
  fs.mkdirSync(path.join(space.first.rootDir, "tmp"), { recursive: true });
  fs.writeFileSync(
    path.join(space.first.rootDir, "tmp", "live-trading-trader-status.json"),
    JSON.stringify({
      schema_version: "live-trading-trader-status-v1",
      lane: "ftmo-1",
      host: { computer: "PC-PRODUCTION", platform: "win32", checkout: "live-trading" },
      expected_interval_seconds: 300,
      at_utc: written,
      written_at_utc: written,
      armed: true,
      status: "nothing_to_place",
      account: { login_masked: null, server: null }
    }, null, 2)
  );
  const git = fakeGit();

  const result = lanes.publishLanes(optionsFor(space), deps(git));

  assert.equal(result.action, "published");
  const row = result.lanes.find((lane) => lane.id === "ftmo-1");
  assert.equal(row.trader_status.host, "PC-PRODUCTION", "the lane row names the host that wrote the heartbeat");
  assert.equal(row.trader_status.expected_interval_seconds, 300, "the lane row carries the cadence the page judges staleness on");
  assert.equal(row.trader_status.at_utc, written);
  assert.equal(row.trader_status.written_at_utc, written);
  assert.equal(row.trader_status.armed, true);
  // The artifact itself is copied unchanged, so the host block a reader opens is the loop's own.
  const copy = JSON.parse(fs.readFileSync(
    path.join(space.checkout, "data", "live-trading-trader.ftmo-1.json"),
    "utf8"
  ));
  assert.equal(copy.host.computer, "PC-PRODUCTION");
});

// A heartbeat from a lane that was not deployed must never be invented, and a heartbeat with no host must not be
// given one by the publisher: the row says null rather than borrowing the publisher's own machine name.
test("a heartbeat with no host in it leaves the lane row's host null", () => {
  const space = workspace();
  fs.mkdirSync(path.join(space.first.rootDir, "tmp"), { recursive: true });
  fs.writeFileSync(
    path.join(space.first.rootDir, "tmp", "live-trading-trader-status.json"),
    JSON.stringify({ lane: "ftmo-1", written_at_utc: new Date(NOW_MS).toISOString(), armed: true, status: "nothing_to_place" })
  );
  const git = fakeGit();

  const result = lanes.publishLanes(optionsFor(space), deps(git));

  assert.equal(result.action, "published");
  const row = result.lanes.find((lane) => lane.id === "ftmo-1");
  assert.equal(row.trader_status.host, null, "the publisher must not stamp its own host on a heartbeat");
  assert.equal(row.trader_status.expected_interval_seconds, null);
  // A heartbeat that names no code is not an error: the row says null and the page states that the record is
  // silent about it, rather than inventing a version for a host nobody can ask.
  assert.equal(row.trader_status.code, null, "a heartbeat written before the code block leaves the row's code null");
});

// The version a heartbeat states travels in the lanes document too, not only in the artifact: the page's fallback
// for an unreadable artifact is this row, and a card that says "not stated" about a record that did state its code
// would be a small lie in the one place a reader goes to check the build.
test("the code a heartbeat states travels with the lanes document", () => {
  const space = workspace();
  const written = new Date(NOW_MS - 30_000).toISOString();
  fs.mkdirSync(path.join(space.first.rootDir, "tmp"), { recursive: true });
  fs.writeFileSync(
    path.join(space.first.rootDir, "tmp", "live-trading-trader-status.json"),
    JSON.stringify({
      lane: "ftmo-1",
      written_at_utc: written,
      armed: true,
      status: "nothing_to_place",
      code: {
        script: "scripts/run-live-trading-trader.js",
        sha256: "b6422a720f1117274560c226e6aa690a0ad3d6132d8643cae0152d9751c13580",
        git_blob: "f43ac5ea318fb5e8c87bf55a6a88b76cc1eb6958",
        checkout_head: "c5abd0ac",
        // Anything else in the block is dropped: the row carries the four fields a reader compares, not whatever a
        // future heartbeat happens to add.
        operator: "not for publication"
      }
    })
  );
  const git = fakeGit();

  const result = lanes.publishLanes(optionsFor(space), deps(git));

  assert.equal(result.action, "published");
  const row = result.lanes.find((lane) => lane.id === "ftmo-1");
  assert.deepEqual(row.trader_status.code, {
    script: "scripts/run-live-trading-trader.js",
    sha256: "b6422a720f1117274560c226e6aa690a0ad3d6132d8643cae0152d9751c13580",
    git_blob: "f43ac5ea318fb5e8c87bf55a6a88b76cc1eb6958",
    checkout_head: "c5abd0ac"
  });
  // The document the page reads is the summary, and the artifact beside it is copied as the loop wrote it.
  const document = JSON.parse(fs.readFileSync(path.join(space.checkout, "data", "live-trading-lanes.json"), "utf8"));
  assert.equal(document.lanes.find((lane) => lane.id === "ftmo-1").trader.code.git_blob, "f43ac5ea318fb5e8c87bf55a6a88b76cc1eb6958");
});

test("a heartbeat's code block with no readable digest is dropped rather than published as a version", () => {
  const space = workspace();
  fs.mkdirSync(path.join(space.first.rootDir, "tmp"), { recursive: true });
  fs.writeFileSync(
    path.join(space.first.rootDir, "tmp", "live-trading-trader-status.json"),
    JSON.stringify({
      lane: "ftmo-1",
      written_at_utc: new Date(NOW_MS).toISOString(),
      armed: true,
      status: "nothing_to_place",
      code: { script: "scripts/run-live-trading-trader.js", sha256: "not-a-digest", git_blob: null, checkout_head: null }
    })
  );
  const git = fakeGit();

  const result = lanes.publishLanes(optionsFor(space), deps(git));

  assert.equal(result.action, "published");
  const row = result.lanes.find((lane) => lane.id === "ftmo-1");
  assert.equal(row.trader_status.code, null, "a block with neither digest is no version at all");
});

test("a lane with no snapshot refuses the run before git is asked anything", () => {
  const space = workspace();
  fs.rmSync(space.second.artifact);
  const git = fakeGit();

  const result = lanes.publishLanes(optionsFor(space), deps(git));

  assert.equal(result.action, "refuse");
  assert.match(result.reason, /FTMO account 2 has no snapshot at/);
  assert.equal(result.lanes.at(-1).status, "missing");
  assert.equal(git.calls.length, 0, "nothing is fetched, staged or pushed for a lane that is not there");
});

test("a disabled lane is reported and skipped, so one account publishing is not held back by the other", () => {
  const space = workspace({ overrides: (id) => (id === "ftmo-2" ? { enabled: false } : {}) });
  // The disabled lane's artifact is removed as well: a lane that is off is not read at all, so its file may be one
  // that has never been written - which is exactly the state account 2 is in until its terminal exists.
  fs.rmSync(space.second.artifact);
  const git = fakeGit();

  const file = lanes.loadLanes(space.configPath);
  assert.equal(file.lanes[0].enabled, true, "enabled is the default and has to be written off");
  assert.equal(file.lanes[1].enabled, false);

  const result = lanes.publishLanes(optionsFor(space), deps(git));

  assert.equal(result.action, "published");
  assert.deepEqual(result.pending_targets, ["data/live-trading.json"]);
  assert.deepEqual(
    result.lanes.map((lane) => lane.id),
    ["ftmo-1", "ftmo-2"]
  );
  assert.equal(result.lanes.at(-1).status, "disabled");
  assert.match(result.lanes.at(-1).reason, /marks this lane disabled/);
  assert.equal(
    gitCalls(git.calls).some((call) => call.includes("live-trading.account2.json")),
    false,
    "the disabled lane's published path is never staged"
  );
});

test("a lanes file with every lane disabled refuses instead of reporting an empty publish", () => {
  const space = workspace({ overrides: () => ({ enabled: false }) });
  const git = fakeGit();

  const result = lanes.publishLanes(optionsFor(space), deps(git));

  assert.equal(result.action, "refuse");
  assert.match(result.reason, /every lane in .* is disabled/);
  assert.equal(result.lanes.length, 2);
  assert.equal(git.calls.length, 0);
});

test("a snapshot carrying another account refuses the run, and names both accounts", () => {
  const space = workspace({
    overrides: (id) =>
      id === "ftmo-2" ? { account_login_masked: "***907", account_server: "FTMO-Server" } : {}
  });
  const git = fakeGit();

  const result = lanes.publishLanes(optionsFor(space), deps(git));

  assert.equal(result.action, "refuse");
  assert.match(result.reason, /FTMO account 2 publishes the snapshot carrying account/);
  assert.equal(result.lanes.at(-1).status, "identity_mismatch");
  assert.equal(git.calls.length, 0);
});

test("a lane the branch already carries does not hold the new lane back", () => {
  const space = workspace();
  const current = laneFeed();
  const git = fakeGit({ remoteFeeds: { "data/live-trading.json": current } });

  const result = lanes.publishLanes(optionsFor(space), deps(git));

  assert.equal(result.action, "published");
  assert.deepEqual(result.pending_targets, ["data/live-trading.account2.json"]);
  assert.equal(result.artifacts[0].decision, "unchanged");
  assert.equal(result.artifacts[1].decision, "publish");
});

test("both lanes already on the branch is unchanged, not a second build", () => {
  const space = workspace();
  const current = laneFeed();
  const git = fakeGit({
    remoteFeeds: { "data/live-trading.json": current, "data/live-trading.account2.json": current }
  });

  const result = lanes.publishLanes(optionsFor(space), deps(git));

  assert.equal(result.action, "unchanged");
  assert.equal(result.reason, "the published copies already carry every lane's feed");
  assert.equal(git.pushes(), 0);
});

test("a lanes file that does not parse is a usage error, not a crash", () => {
  const space = workspace();
  fs.writeFileSync(space.configPath, "{ not json");

  const run = captureStdio(() => lanes.main(["--config", space.configPath], deps(fakeGit())));

  assert.equal(run.code, 2);
  assert.match(run.err, /could not be read/);
  assert.match(run.err, /Usage:/);
});

test("--dry-run runs every gate and every read, then stops before writing or pushing", () => {
  const space = workspace();
  const git = fakeGit();

  const run = captureStdio(() =>
    lanes.main(["--config", space.configPath, "--checkout", space.checkout, "--dry-run"], deps(git))
  );

  assert.equal(run.code, 0);
  const result = JSON.parse(run.out);
  assert.equal(result.action, "would_publish");
  assert.deepEqual(
    result.lanes.map((lane) => lane.id),
    ["ftmo-1", "ftmo-2"]
  );
  assert.equal(git.pushes(), 0);
  assert.equal(fs.existsSync(path.join(space.checkout, "data", "live-trading.account2.json")), false);
});

test("--help writes the usage and touches nothing", () => {
  const run = captureStdio(() => lanes.main(["--help"], deps(fakeGit())));

  assert.equal(run.code, 0);
  assert.match(run.out, /publish-live-trading-lanes\.js/);
  assert.match(run.out, /--config <path>/);
});

test("an unknown argument is a usage error rather than a silent default", () => {
  const run = captureStdio(() => lanes.main(["--nope"], deps(fakeGit())));

  assert.equal(run.code, 2);
  assert.match(run.err, /Unknown argument: --nope/);
});

// The lanes file the publisher, the registration script and the trader's `--lane` all name is a configuration
// document, not a scratch file: a fresh clone that does not carry it cannot run the coordinated publisher at all,
// because `--config` defaults to it. So the shipped file is read here through the publisher's own loader, which is
// the only reading that decides what a run on a host would actually see.
test("the shipped lanes file is the publisher's own default and names both accounts", () => {
  assert.equal(lanes.DEFAULT_CONFIG, "config/live-trading-lanes.json");
  const configPath = path.join(root, lanes.DEFAULT_CONFIG);
  assert.equal(fs.existsSync(configPath), true, `${lanes.DEFAULT_CONFIG} has to travel with the code that reads it`);

  const config = lanes.loadLanes(configPath);

  assert.deepEqual(config.lanes.map((lane) => lane.id), ["ftmo-1", "ftmo-2"]);
  // Account 1 is the lane this checkout runs; account 2 is switched on now that its own terminal is installed and
  // signed in, and its row is what makes the publisher read that account's snapshot and refuse it if it is another
  // account. Switching it off again is the same one line, and a parked lane says so rather than failing as a
  // missing snapshot.
  assert.equal(config.lanes[0].enabled, true);
  assert.equal(config.lanes[1].enabled, true);
  // Each lane's snapshot and heartbeat land on their own paths beside the lanes document, which is what stops one
  // account's read being published under the other's name.
  assert.equal(config.lanes[0].published, "data/live-trading.json");
  assert.equal(config.lanes[1].published, "data/live-trading.account2.json");
  assert.deepEqual(
    config.lanes.map((lane) => lane.status_published),
    ["data/live-trading-trader.ftmo-1.json", "data/live-trading-trader.ftmo-2.json"]
  );
  assert.equal(config.lanes[0].root, ".");
  assert.equal(config.lanes[1].root, "../ftmo2");
  assert.equal(config.minIntervalSeconds, 600);
  assert.equal(config.state, "tmp/live-trading-publish-state.json");
  assert.equal(config.summary, "data/live-trading-lanes.json");
});

test("the shipped lanes file holds the masked identity and no credential", () => {
  const configPath = path.join(root, lanes.DEFAULT_CONFIG);
  const document = JSON.parse(fs.readFileSync(configPath, "utf8"));

  // The page already shows the masked login, so it is the one account fact this file may carry. Anything a person
  // could log in with - a password, a token, an investor login - has no place in a file that rides in a commit.
  for (const lane of document.lanes) {
    const keys = Object.keys(lane);
    assert.equal(
      keys.filter((key) => /pass|secret|token|investor|api[-_]?key/i.test(key)).length,
      0,
      `${lane.id} carries a credential-shaped key`
    );
    assert.equal(typeof lane.terminal, "string");
  }
  // Account 1 is configured, so it carries the masked login and server the page already shows and nothing more.
  assert.match(document.lanes[0].account_login_masked, /^\*{3}\d{3}$/);
  assert.match(document.lanes[0].account_server, /^FTMO-Server$/);
  // Account 2 now names its own account - the second FTMO login arrived on 2026-11-07 - and it is still only the
  // masked login the page shows plus the server, never the full number. Naming it here is what makes the publisher's
  // identity guard able to reject a snapshot taken from the wrong account rather than accept one silently.
  assert.match(document.lanes[1].account_login_masked, /^\*{3}\d{3}$/);
  assert.equal(document.lanes[1].account_server, "FTMO-Server3");
  assert.notEqual(document.lanes[1].account_login_masked, document.lanes[0].account_login_masked);
  assert.notEqual(document.lanes[1].account_server, document.lanes[0].account_server);
});

