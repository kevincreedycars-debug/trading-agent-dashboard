const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const migration = require("../scripts/prepare-live-trading-migration.js");

// The migration bundle is the one copy of an account's history a second host is allowed to start from, so what
// these tests hold is what has to be true before anything is restored: the bytes are hashed and re-hashed, the
// state cannot be absent, a credential refuses the bundle rather than riding along in it, and a copied
// heartbeat is labelled as history instead of being presented as a running loop.
const NOW = Date.parse("2026-10-25T21:00:00Z");

function write(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

// A checkout shaped like the PC's: the state, journal, run log, heartbeat, wrapper and publish state a lane
// writes, one snapshot that is described but not copied, and the lanes file that names them all.
function fixture(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "live-trading-bundle-"));
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
  write(path.join(dir, "package.json"), JSON.stringify({ name: "trading-agent-dashboard", version: "1.0.0" }));
  write(path.join(dir, "data", "live-trading.json"), JSON.stringify({
    schema_version: "live-trading-v1",
    generated_at_utc: "2026-10-25T20:55:00Z",
    account: { login_masked: "***614", server: "FTMO-Server" }
  }));
  write(path.join(dir, "tmp", "live-trading-trader-state.json"), JSON.stringify({
    schema_version: "live-trading-trader-state-v1",
    cycles: [{ pair: "XAUUSD", placed_at_utc: "2026-10-24T18:00:00Z" }],
    hand: { cancels: [], closes: [], moves: [] }
  }, null, 2));
  write(path.join(dir, "tmp", "live-trading-orders.log"), '{"action":"status","at_utc":"2026-10-25T20:50:00Z"}\n');
  write(path.join(dir, "tmp", "live-trading-trader.log"), '{"status":"nothing_to_place","at_utc":"2026-10-25T20:55:00Z"}\n');
  write(path.join(dir, "tmp", "live-trading-trader-status.json"), JSON.stringify({
    schema_version: "live-trading-trader-status-v1",
    lane: "ftmo-1",
    host: { computer: "PC-PRODUCTION", platform: "win32", checkout: "live-trading" },
    expected_interval_seconds: 300,
    at_utc: "2026-10-25T20:55:00Z",
    written_at_utc: "2026-10-25T20:55:02Z",
    armed: true,
    status: "nothing_to_place",
    account: { login_masked: "***614", server: "FTMO-Server" }
  }, null, 2));
  write(path.join(dir, "tmp", "live-trading-trader-run.cmd"), [
    "@echo off",
    'cd /d "' + dir + '"',
    '"C:\\Program Files\\nodejs\\node.exe" "' + path.join(dir, "scripts", "run-live-trading-trader.js") + '" --once --align --settle-seconds 90 --confirm-live --max-open 1 --expire-minutes 30 --max-per-day 4'
  ].join("\r\n") + "\r\n");
  write(path.join(dir, "tmp", "live-trading-publish-state.json"), JSON.stringify({ last_publish_at_utc: "2026-10-25T20:53:00Z" }));
  for (const [relative, contents] of Object.entries(overrides)) write(path.join(dir, relative), contents);
  return { dir, out: path.join(dir, ".local", "bundle") };
}

const deps = () => ({ now: () => NOW, exec: () => ({ status: 1, stdout: "", stderr: "" }) });

function prepareBundle(space, options = {}) {
  const prepared = migration.prepare(
    { lane: "ftmo-1", checkout: space.dir, out: space.out, dryRun: false, force: false, ...options },
    deps()
  );
  assert.equal(prepared.code, 0, prepared.reason);
  const manifest = migration.writeBundle(prepared, { dryRun: false, ...options }, deps());
  return { prepared, manifest };
}

test("a bundle carries the lane's state, journal, log, heartbeat, wrapper and config, each hashed", () => {
  const space = fixture();
  const { prepared, manifest } = prepareBundle(space);

  const roles = manifest.files.map((file) => file.role).sort();
  assert.deepEqual(roles, ["heartbeat", "journal", "lanes_config", "publish_state", "run_log", "state", "wrapper"]);
  assert.equal(manifest.lane, "ftmo-1");
  assert.equal(manifest.schema_version, migration.SCHEMA_VERSION);
  assert.equal(manifest.credentials.included, false);
  assert.deepEqual(manifest.restore_order, migration.RESTORE_ORDER);
  assert.equal(manifest.repo.commit, null, "a checkout with no git is recorded as unknown rather than guessed");
  assert.equal(manifest.version.package, "1.0.0");

  for (const file of manifest.files) {
    const bytes = fs.readFileSync(path.join(space.out, file.bundle_path));
    assert.equal(bytes.length, file.bytes);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), file.sha256);
  }
  // The snapshot is described by hash and time so the host knows what it replaces, and deliberately not copied.
  assert.equal(manifest.snapshot.copied, false);
  assert.equal(manifest.snapshot.generated_at_utc, "2026-10-25T20:55:00Z");
  assert.equal(prepared.files.length, 7);
});

test("the copied heartbeat is labelled as history and names the host that wrote it", () => {
  const space = fixture();
  const { manifest } = prepareBundle(space);

  assert.equal(manifest.heartbeat.present, true);
  assert.equal(manifest.heartbeat.is_historical_evidence, true);
  assert.equal(manifest.heartbeat.armed, true, "the record keeps what it said, and the label is what keeps it honest");
  assert.equal(manifest.heartbeat.host, "PC-PRODUCTION");
  assert.equal(manifest.heartbeat.written_at_utc, "2026-10-25T20:55:02Z");
  assert.match(manifest.heartbeat.note, /not evidence that a loop is running now/);
});

test("a heartbeat with no host in it is not given one by the bundle", () => {
  const space = fixture({
    "tmp/live-trading-trader-status.json": JSON.stringify({
      lane: "ftmo-1",
      written_at_utc: "2026-10-25T20:55:02Z",
      armed: true,
      status: "nothing_to_place"
    })
  });
  const { manifest } = prepareBundle(space);
  assert.equal(manifest.heartbeat.host, null);
  assert.equal(manifest.heartbeat.is_historical_evidence, true);
});

test("a lane with no state is refused rather than bundled as a fresh start", () => {
  const space = fixture();
  fs.rmSync(path.join(space.dir, "tmp", "live-trading-trader-state.json"));
  const result = migration.prepare(
    { lane: "ftmo-1", checkout: space.dir, out: space.out, dryRun: false, force: false },
    deps()
  );
  assert.equal(result.code, 1);
  assert.match(result.reason, /nothing to migrate/);
  assert.match(result.reason, /live-trading-trader-state\.json/);
  assert.equal(fs.existsSync(space.out), false, "a refused bundle writes nothing");
});

test("a missing optional file is recorded, not invented and not fatal", () => {
  const space = fixture();
  fs.rmSync(path.join(space.dir, "tmp", "live-trading-trader.log"));
  const { manifest } = prepareBundle(space);
  const missing = manifest.missing.map((file) => file.role);
  assert.deepEqual(missing, ["run_log"]);
  assert.equal(manifest.missing[0].required, false);
  assert.equal(manifest.missing[0].bundle_path, "log/live-trading-trader.log");
});

test("a credential in a file refuses the whole bundle", () => {
  const space = fixture({
    "tmp/live-trading-trader-state.json": JSON.stringify({
      cycles: [],
      mt5: { login: 12345678, password: "s3cret-investor-pw" }
    })
  });
  const result = migration.prepare(
    { lane: "ftmo-1", checkout: space.dir, out: space.out, dryRun: false, force: false },
    deps()
  );
  assert.equal(result.code, 1);
  assert.match(result.reason, /credential pattern/);
  assert.equal(fs.existsSync(space.out), false, "nothing is written from a refused run");
});

test("a dry run reads and hashes but writes nothing at all", () => {
  const space = fixture();
  const result = migration.prepare(
    { lane: "ftmo-1", checkout: space.dir, out: space.out, dryRun: true, force: false },
    deps()
  );
  assert.equal(result.code, 0);
  assert.equal(result.files.length, 7);
  assert.equal(fs.existsSync(space.out), false);
});


test("verification re-hashes every file and passes the bundle that was written", () => {
  const space = fixture();
  const { manifest } = prepareBundle(space);
  const result = migration.verify({ out: space.out });
  assert.equal(result.code, 0, result.problems.join("; "));
  assert.deepEqual(result.problems, []);
  assert.equal(result.manifest.lane, manifest.lane);
  assert.match(fs.readFileSync(path.join(space.out, "SHA256SUMS"), "utf8"), /^[a-f0-9]{64}  state\/live-trading-trader-state\.json$/m);
});

test("a single changed byte fails verification and names the file", () => {
  const space = fixture();
  prepareBundle(space);
  const journalPath = path.join(space.out, "journal", "live-trading-orders.log");
  fs.appendFileSync(journalPath, '{"action":"send","ticket":1}\n');
  const result = migration.verify({ out: space.out });
  assert.equal(result.code, 1);
  assert.ok(result.problems.some((problem) => problem.includes("journal/live-trading-orders.log") && problem.includes("sha256")));
});

test("a file the manifest does not know about fails verification", () => {
  const space = fixture();
  prepareBundle(space);
  fs.writeFileSync(path.join(space.out, "state", "extra.json"), "{}");
  const result = migration.verify({ out: space.out });
  assert.equal(result.code, 1);
  assert.deepEqual(result.problems, ["state/extra.json: not in the manifest"]);
});

test("a bundle that claims to hold credentials fails verification", () => {
  const space = fixture();
  prepareBundle(space);
  const manifestPath = path.join(space.out, "MANIFEST.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.credentials.included = true;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  const result = migration.verify({ out: space.out });
  assert.equal(result.code, 1);
  assert.ok(result.problems.some((problem) => problem.includes("credentials.included is not false")));
});

test("a bundle is not silently replaced, and a directory that is not a bundle is never written into", () => {
  const space = fixture();
  prepareBundle(space);
  const again = migration.prepare(
    { lane: "ftmo-1", checkout: space.dir, out: space.out, dryRun: false, force: false },
    deps()
  );
  assert.equal(again.code, 1);
  assert.match(again.reason, /already holds a bundle/);

  const notABundle = path.join(space.dir, "notes");
  fs.mkdirSync(notABundle, { recursive: true });
  const refused = migration.prepare(
    { lane: "ftmo-1", checkout: space.dir, out: notABundle, dryRun: false, force: true },
    deps()
  );
  assert.equal(refused.code, 1);
  assert.match(refused.reason, /does not hold a bundle/);

  const replaced = migration.prepare(
    { lane: "ftmo-1", checkout: space.dir, out: space.out, dryRun: false, force: true },
    deps()
  );
  assert.equal(replaced.code, 0, replaced.reason);
  assert.equal(fs.existsSync(path.join(space.out, "MANIFEST.json")), false, "a forced rebuild starts from nothing until the manifest is written");
});

test("the lane is resolved from the checkout when no id is given, and an unknown id is refused", () => {
  const space = fixture();
  const byRoot = migration.loadLane({
    checkoutRoot: space.dir,
    lanesPath: path.join(space.dir, "config", "live-trading-lanes.json"),
    laneId: null
  });
  assert.equal(byRoot.lane.id, "ftmo-1");
  assert.throws(() => migration.loadLane({
    checkoutRoot: space.dir,
    lanesPath: path.join(space.dir, "config", "live-trading-lanes.json"),
    laneId: "ftmo-2"
  }), /No lane ftmo-2/);
});

test("the command line refuses an unknown argument and needs a directory to verify", () => {
  assert.equal(migration.main(["--nonsense"]), 2);
  assert.equal(migration.main(["--verify"]), 2);
  assert.equal(migration.main(["--help"]), 0);
});

test("the bundle's own script publishes nothing: it writes files and never reaches a terminal or git", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "scripts", "prepare-live-trading-migration.js"), "utf8");
  assert.equal(/MetaTrader5|mt5|live-trading-order\.py/.test(source), false, "the bundle only reads files");
  assert.equal(/spawnSync\(\s*"git"/.test(source), false, "git is asked through the injected exec, not a bare spawn");
  assert.equal(/child_process"\);[\s\S]{0,80}\bexec\(/.test(source), false);
});

