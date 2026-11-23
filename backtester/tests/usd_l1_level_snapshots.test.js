"use strict";

// The level-snapshot archive and the eligibility rule that reads it.
//
// The rule under test is the one that stops history being back-dated: a session may be priced only by the
// latest archived snapshot whose stamp (and, where recorded, whose git commit) precedes that session's
// 05:00 London start. A freshly marked ladder therefore cannot establish an old session, no matter who
// approves it.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const levelProvenance = require("../lib/usd_layer1_backtester/level_provenance");
const levelSnapshots = require("../lib/usd_layer1_backtester/level_snapshots");

const ROOT = path.resolve(__dirname, "../..");
const SNAPSHOT_SHA = "a5dc10a32e0ccb50a0eb816b649d1e6cb0dd35a647c04c1e6f03dfb4b4793704";

const sessionsBetween = (start, end) => {
  const dates = [];
  for (let cursor = Date.parse(`${start}T00:00:00Z`); cursor <= Date.parse(`${end}T00:00:00Z`); cursor += 86400000) {
    const date = new Date(cursor);
    const weekday = date.getUTCDay();
    if (weekday >= 1 && weekday <= 5) dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
};

test("the committed archive is present, hash-verified and carries its git evidence", () => {
  const archive = levelSnapshots.loadArchive({ rootDir: ROOT });
  assert.equal(archive.available, true);
  assert.equal(archive.index_path, "data/usd-layer1-backtester/level-snapshots/index.json");
  assert.deepEqual(archive.problems, []);
  assert.equal(archive.snapshots.length, 1);
  const snapshot = archive.snapshots[0];
  assert.equal(snapshot.file, "l2l-levels-2026-10-04T16-14-19Z.json");
  assert.equal(snapshot.verified_sha256, SNAPSHOT_SHA);
  assert.equal(snapshot.generated_at_utc, "2026-10-04T16:14:19Z");
  assert.equal(snapshot.git_commit, "5262f8d28d87062897aa981eecb848e02bf1b6aa");
  assert.equal(snapshot.git_commit_at_utc, "2026-10-04T19:02:52Z");
  assert.equal(snapshot.origin, "archived snapshot");
  assert.deepEqual(snapshot.levels_per_instrument, { EURUSD: 22, XAUUSD: 22, "US100.cash": 22, BTCUSD: 22 });
});

test("a session is priced only by a snapshot that existed before its start", () => {
  const archive = levelSnapshots.loadArchive({ rootDir: ROOT });
  const ordered = levelSnapshots.orderSnapshots(archive.snapshots);
  const start = (date) => levelProvenance.sessionStartMs(date);
  assert.equal(levelSnapshots.snapshotInForce(ordered, start("2026-10-05")).file, archive.snapshots[0].file);
  assert.equal(levelSnapshots.snapshotInForce(ordered, start("2026-10-04")), null);
  assert.equal(levelSnapshots.snapshotInForce(ordered, start("2026-10-02")), null);

  const early = {
    file: "future.json",
    generated_at_utc: "2026-11-23T16:20:57.042Z",
    git_commit_at_utc: null,
    origin: "working file"
  };
  assert.equal(levelSnapshots.snapshotInForce(levelSnapshots.orderSnapshots([early]), start("2026-10-05")), null);
  assert.equal(levelSnapshots.snapshotInForce(levelSnapshots.orderSnapshots([early]), start("2026-11-24")).file, "future.json");
});

test("the archived snapshot prices the six sessions and the live file prices none", () => {
  const archive = levelSnapshots.loadArchive({ rootDir: ROOT });
  const live = levelProvenance.readLadder(path.join(ROOT, "data", "l2l-levels.json"));
  const dates = sessionsBetween("2026-10-05", "2026-10-12");
  assert.deepEqual(dates, [
    "2026-10-05",
    "2026-10-06",
    "2026-10-07",
    "2026-10-08",
    "2026-10-09",
    "2026-10-12"
  ]);
  const provenance = levelProvenance.buildLevelProvenance({
    ladder: live,
    source: "data/l2l-levels.json",
    dates,
    archive
  });
  assert.equal(provenance.mode, "snapshot_pinned");
  assert.equal(provenance.totals.sessions_eligible_for_all_four, 6);
  for (const lane of levelProvenance.LANES) {
    const instrument = provenance.instruments.find((entry) => entry.key === lane.key);
    assert.equal(instrument.sessions_eligible, 6, `${lane.key} must be priced on all six sessions`);
    assert.equal(instrument.snapshot_file, archive.snapshots[0].file);
  }
  assert.equal(provenance.live_file_cannot_establish_history.sessions_it_can_price_in_this_run, 0);
  assert.equal(provenance.snapshots.find((entry) => entry.origin === "working file").sessions_used.length, 0);
  assert.match(provenance.eligibility_rule, /cannot back-date history/);
});
test("a snapshot edited after the fact is refused, not used", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "usd-l1-snap-"));
  try {
    const file = path.join(dir, "tampered.json");
    const original = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, "data", "usd-layer1-backtester", "level-snapshots", "l2l-levels-2026-10-04T16-14-19Z.json"),
        "utf8"
      )
    );
    original.instruments[0].levels[0].price = original.instruments[0].levels[0].price + 1;
    fs.writeFileSync(file, JSON.stringify(original), "utf8");
    const index = path.join(dir, "index.json");
    fs.writeFileSync(
      index,
      JSON.stringify({
        schema_version: "usd-l1-level-snapshots-v1",
        rule: "test",
        snapshots: [
          {
            file: "tampered.json",
            sha256: SNAPSHOT_SHA,
            generated_at_utc: "2026-10-04T16:14:19Z",
            levels_per_instrument: { EURUSD: 22, XAUUSD: 22, "US100.cash": 22, BTCUSD: 22 }
          }
        ]
      }),
      "utf8"
    );
    const archive = levelSnapshots.loadArchive({ rootDir: dir, indexFile: index });
    assert.equal(archive.snapshots.length, 0);
    assert.equal(archive.problems.length, 1);
    assert.match(archive.problems[0].reason, /does not match the indexed/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
