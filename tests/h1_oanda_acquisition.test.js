// The three one-hour series acquired on 2026-11-24 are the last dataset between the published matrix and
// three scored direction cells. They are a licensed quote history held outside the repository, so this
// guard keeps three statements apart that are easy to run together: the rows exist and are reproducible
// from the committed record, they are not redistributed, and no published count includes them until the
// distribution decision lands.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const RECORD = "data/usd-layer1-backtester/h1-v1/oanda-h1-acquisition-latest.json";
const STAMPED = "data/usd-layer1-backtester/h1-v1/oanda-h1-acquisition-2026-11-24T00-00-00Z.json";
const READINESS = "data/usd-layer1-backtester/market-readiness-v1.json";
const MARKETS = ["XAGUSD", "WTIUSD", "GBPUSD"];

function read(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8").replace(/^\uFEFF/, ""));
}

const acquisition = read(RECORD);
const readiness = read(READINESS);
const held = new Map(acquisition.markets.map(entry => [entry.market, entry]));

test("the acquisition record is one file, stamped and copied", () => {
  assert.deepEqual(read(STAMPED), acquisition, "the timestamped copy and the latest record must be the same file");
  assert.equal(acquisition.research_only, true);
  assert.equal(acquisition.sessions_checked, 725);
  assert.deepEqual(acquisition.markets.map(entry => entry.market), MARKETS);
});

test("each series prices both 05:00 London endpoints on the sessions the record claims", () => {
  for (const market of MARKETS) {
    const entry = held.get(market);
    const coverage = entry.boundary_coverage;
    assert.equal(coverage.sessions, 725, `${market} must be measured over the artefact's 725 sessions`);
    assert.ok(coverage.both_present > 0 && coverage.both_present < coverage.sessions, `${market} must neither price nothing nor every session`);
    assert.ok(coverage.cutoff_present >= coverage.both_present, `${market}'s cutoff count must cover the paired count`);
    assert.ok(coverage.endpoint_present >= coverage.both_present, `${market}'s endpoint count must cover the paired count`);
    assert.ok(entry.rows > 10000, `${market} must carry its row count`);
    assert.match(entry.csv_sha256, /^[0-9a-f]{64}$/, `${market} must carry the hash of the file it measured`);
    for (const missing of coverage.first_missing) {
      assert.equal(new Date(`${missing.date}T00:00:00Z`).getUTCDay(), 5, `${market} ${missing.date} must be one of the Friday endpoints the note explains`);
      assert.equal(missing.cutoff, true, `${market} ${missing.date} must still have its cutoff bar`);
      assert.equal(missing.endpoint, false, `${market} ${missing.date} must be the missing endpoint, not the cutoff`);
    }
  }
});

test("the rows stay outside the repository, with the licence position stated", () => {
  assert.match(acquisition.licence.position, /licensed quote history/i);
  assert.match(acquisition.licence.handling, /not redistributed/i);
  assert.match(acquisition.licence.decision_needed, /documented download step/i);
  for (const market of MARKETS) {
    const entry = held.get(market);
    const tracked = execFileSync("git", ["ls-files", "--", `backtester/tmp/${entry.file}`], { cwd: ROOT, encoding: "utf8" }).trim();
    assert.equal(tracked, "", `${entry.file} must not be committed`);
    assert.equal(
      readiness.markets.find(cell => cell.key === market).direction.acquisition.licence,
      acquisition.licence.position,
      `${market} must publish the licence position, not a null in its place`
    );
  }
  assert.match(held.get("WTIUSD").note, /USOIL is a different instrument and has not been reconciled/i);
});

test("no published count includes the held series before the distribution decision", () => {
  assert.deepEqual(readiness.published.counts, {
    scored: 4,
    proxy_scored: 1,
    measured_tick_replay: 8,
    blocked: 11,
    ready: 0,
    proxy_ready: 0
  });
  for (const market of MARKETS) {
    const cell = readiness.markets.find(entry => entry.key === market);
    const record = held.get(market);
    assert.equal(cell.direction.status, "blocked");
    assert.equal(cell.direction.publication, "pending_data_distribution");
    assert.equal(cell.direction.scored_sessions, null, `${market} must publish no score before the decision`);
    for (const testKey of ["l2l_full_5r", "l2l_half_3r"]) {
      assert.equal(cell[testKey].status, "blocked");
      assert.deepEqual(cell[testKey].missing, ["bid/ask 5-minute tape", "pre-session level ladder"]);
    }
    assert.deepEqual(cell.direction.acquisition, {
      instrument: record.instrument,
      rows: record.rows,
      csv_sha256: record.csv_sha256,
      sessions: record.boundary_coverage.sessions,
      cutoff_present: record.boundary_coverage.cutoff_present,
      endpoint_present: record.boundary_coverage.endpoint_present,
      both_present: record.boundary_coverage.both_present,
      licence: acquisition.licence.position
    });
  }
  assert.equal(readiness.unpublished_research.published, false);
  assert.deepEqual(readiness.unpublished_research.counts, { scored: 7, proxy_scored: 1, measured_tick_replay: 8, blocked: 8 });
  assert.match(readiness.unpublished_research.note, /not live readiness/i);
  assert.equal(readiness.advantage.status, "not_established");
});
