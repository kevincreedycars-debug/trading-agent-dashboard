const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const contract = require("./helpers/silverSnapshotContract");

const dir = path.join(__dirname, "fixtures");
const load = (name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
const NOW = new Date("2026-09-12T14:00:00.000Z");

test("every SILVER timeframe weights the ten factors to exactly 100", () => {
  for (const [timeframe, weights] of Object.entries(contract.SILVER_TIMEFRAME_WEIGHTS)) {
    assert.equal(Object.values(weights).reduce((a, b) => a + b, 0), 100, `${timeframe} must total 100`);
    assert.equal(Object.keys(weights).length, 10, `${timeframe} must define ten factors`);
  }
});

test("complete shared row is usable and carries full silver and superset coverage", () => {
  const assessment = contract.assessSharedRow(load("silver-snapshot.complete.json"), NOW);
  assert.equal(assessment.usable, true);
  assert.equal(assessment.stale, false);
  assert.equal(assessment.hasSilverEvidence, true);
  assert.deepEqual(assessment.missingCore, []);
  assert.deepEqual(assessment.missingSilverFields, []);
  assert.deepEqual(assessment.missingSupersetFields, []);
});

test("empty input fails closed and reports every core field", () => {
  const assessment = contract.assessSharedRow(load("silver-snapshot.empty.json"), NOW);
  assert.equal(assessment.usable, false);
  assert.deepEqual(assessment.missingCore.sort(), [...contract.CORE_REQUIRED_FIELDS].sort());
});

test("a row with no silver evidence is usable but is not treated as silver evidence", () => {
  const row = load("silver-snapshot.no-silver-evidence.json");
  const assessment = contract.assessSharedRow(row, NOW);
  assert.equal(assessment.usable, true);
  assert.equal(assessment.hasSilverEvidence, false);
  assert.ok(assessment.missingSilverFields.includes("silver_price"));
  assert.deepEqual(assessment.missingSupersetFields, []);
});

test("the unavailable supply factor is excluded from missing-field noise but stays documented", () => {
  const assessment = contract.assessSharedRow(load("silver-snapshot.complete.json"), NOW);
  assert.ok(!assessment.missingSilverFields.includes("silver_supply_event"));
  assert.ok(contract.SILVER_ALWAYS_NULL_FIELDS.includes("silver_supply_event"));
  assert.equal(contract.PROVIDER_AVAILABILITY.silver_supply_event.status, "unavailable");
  assert.equal(load("silver-snapshot.complete.json").silver_supply_event, null);
});

test("an old row becomes stale past the 26 hour threshold", () => {
  const assessment = contract.assessSharedRow(load("silver-snapshot.stale.json"), NOW);
  assert.equal(assessment.usable, true);
  assert.equal(assessment.stale, true);
});

test("provider matrix records the verified shared providers and the one gap", () => {
  assert.equal(contract.PROVIDER_AVAILABILITY.silver_price.status, "verified");
  assert.equal(contract.PROVIDER_AVAILABILITY.copper_price.status, "verified");
  assert.equal(contract.PROVIDER_AVAILABILITY.industrial_production_index.status, "verified");
  assert.equal(contract.PROVIDER_AVAILABILITY.silver_supply_event.status, "unavailable");
});

test("the superset list covers everything the other Layer 1 agents read from the shared row", () => {
  for (const key of ["gold_price", "gold_d1_pct", "gold_d5_pct", "gold_d20_pct",
    "nq_price", "nq_d1_pct", "btc_price", "btc_d1_pct",
    "dxy_level", "dxy_d1", "dxy_d5", "dxy_d20", "vix_level", "vix_d1", "vix_d5",
    "us_2y_yield", "us_2y_d5_bps", "us_10y_yield", "us_10y_real_yield",
    "us_10y_real_yield_d5_bps", "latest_us_event", "fed_bias", "equities_regime",
    "global_growth_regime", "geopolitical_risk_flag"]) {
    assert.ok(contract.SHARED_SUPERSET_FIELDS.includes(key), `${key} must be in the shared superset`);
  }
});
