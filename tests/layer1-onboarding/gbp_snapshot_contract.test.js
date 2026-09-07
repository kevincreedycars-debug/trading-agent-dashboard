const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  GBP_FACTOR_WEIGHTS,
  SNAPSHOT_FIELD_BY_FACTOR,
  CORE_REQUIRED_FIELDS,
  FUNDAMENTAL_FIELDS,
  PROVIDER_AVAILABILITY,
  assessSnapshot,
  isUsableSnapshot,
  isStaleSnapshot,
  isGbpMarketClosed
} = require("./helpers/gbpSnapshotContract");

const fixtureDir = path.join(__dirname, "fixtures");
const load = (name) => JSON.parse(fs.readFileSync(path.join(fixtureDir, name), "utf8"));

// Deterministic "now" timestamps (all 2026-09-02T14:00Z is Wednesday 10:00 ET,
// 2026-09-04T14:00Z is Friday 10:00 ET, 2026-09-06T14:00Z is Sunday, 2026-09-07T12:00Z is Monday 08:00 ET).
const WED_AFTERNOON = new Date("2026-09-02T14:00:00.000Z");
const FRI_AFTERNOON = new Date("2026-09-04T14:00:00.000Z");
const SUN_AFTERNOON = new Date("2026-09-06T14:00:00.000Z");
const MON_MORNING = new Date("2026-09-07T12:00:00.000Z");

test("contract weight table sums to 100 and covers F1..F10", () => {
  const total = Object.values(GBP_FACTOR_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  assert.equal(total, 100);
  assert.deepEqual(Object.keys(GBP_FACTOR_WEIGHTS), ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10"]);
});

test("factor field map covers exactly the ten logic-document factors", () => {
  assert.equal(Object.keys(SNAPSHOT_FIELD_BY_FACTOR).length, 10);
  assert.equal(SNAPSHOT_FIELD_BY_FACTOR.F1, "boe_bias");
  assert.equal(SNAPSHOT_FIELD_BY_FACTOR.F6, "gbpusd_d1_pct");
  assert.equal(SNAPSHOT_FIELD_BY_FACTOR.F10, "uk_stress_flag");
});

test("complete GBP snapshot is usable, fresh and not weekend-suppressed", () => {
  const row = load("gbp-snapshot.complete.json");
  assert.equal(isUsableSnapshot(row), true);
  const assessment = assessSnapshot(row, FRI_AFTERNOON);
  assert.equal(assessment.usable, true);
  assert.equal(assessment.stale, false);
  assert.equal(assessment.marketClosed, false);
  assert.deepEqual(assessment.missingCore, []);
});

test("missing GBP/USD price makes the snapshot unusable (fail closed)", () => {
  const row = load("gbp-snapshot.missing-core.json");
  assert.equal(isUsableSnapshot(row), false);
  const assessment = assessSnapshot(row, FRI_AFTERNOON);
  assert.equal(assessment.usable, false);
  assert.ok(assessment.missingCore.includes("gbpusd_price"));
});

test("empty snapshot is unusable and reports every core field", () => {
  const row = load("gbp-snapshot.empty.json");
  const assessment = assessSnapshot(row, FRI_AFTERNOON);
  assert.equal(assessment.usable, false);
  assert.deepEqual(assessment.missingCore.sort(), [...CORE_REQUIRED_FIELDS].sort());
});

test("stale snapshot handling: an old snapshot_date is stale on a later trading day", () => {
  const row = load("gbp-snapshot.stale.json"); // Wednesday 2026-09-02
  assert.equal(isUsableSnapshot(row), true);
  const assessment = assessSnapshot(row, FRI_AFTERNOON); // evaluated Friday 2026-09-04
  assert.equal(assessment.stale, true);
  assert.ok(assessment.staleReason.includes("26"));
});

test("weekend rule: a Friday snapshot is NOT stale when evaluated Monday morning", () => {
  const row = load("gbp-snapshot.complete.json"); // Friday 2026-09-04
  assert.equal(isStaleSnapshot(row, MON_MORNING), false);
  const assessment = assessSnapshot(row, MON_MORNING);
  assert.equal(assessment.stale, false);
  assert.equal(assessment.marketClosed, false);
});

test("weekend rule: Sunday closure suppresses the 24H market window", () => {
  assert.equal(isGbpMarketClosed(SUN_AFTERNOON), true);
  const assessment = assessSnapshot(load("gbp-snapshot.complete.json"), SUN_AFTERNOON);
  assert.equal(assessment.marketClosed, true);
});

test("unavailable fundamentals are reported missing but do not block usability", () => {
  const row = load("gbp-snapshot.complete.json");
  const assessment = assessSnapshot(row, FRI_AFTERNOON);
  assert.equal(assessment.usable, true);
  for (const key of FUNDAMENTAL_FIELDS) {
    if (row[key] === null || row[key] === undefined) {
      assert.ok(assessment.missingFundamentals.includes(key), `expected ${key} in missingFundamentals`);
    }
  }
});

test("asset independence: non-GBP snapshot keys never appear as GBP missing inputs", () => {
  const row = {
    ...load("gbp-snapshot.complete.json"),
    eurusd_price: 1.08,
    de_2y_d5_bps: 4,
    btc_d1_pct: 1.1,
    gold_d5_pct: 0.3,
    nq_d20_pct: 6
  };
  const assessment = assessSnapshot(row, FRI_AFTERNOON);
  const gbpKeys = new Set([...CORE_REQUIRED_FIELDS, ...FUNDAMENTAL_FIELDS, ...Object.values(SNAPSHOT_FIELD_BY_FACTOR)]);
  for (const missing of [...assessment.missingCore, ...assessment.missingFundamentals]) {
    assert.ok(gbpKeys.has(missing), `non-GBP key surfaced: ${missing}`);
  }
});

test("provider availability matrix matches the documented draft status", () => {
  assert.equal(PROVIDER_AVAILABILITY.uk_2y_d5_bps.status, "unavailable");
  assert.equal(PROVIDER_AVAILABILITY.us_uk_2y_spread_d5_bps.status, "unavailable");
  assert.equal(PROVIDER_AVAILABILITY.boe_bias.status, "unavailable");
  assert.equal(PROVIDER_AVAILABILITY.latest_uk_event.status, "unavailable");
  assert.equal(PROVIDER_AVAILABILITY.uk_composite_pmi.status, "unavailable");
  assert.equal(PROVIDER_AVAILABILITY.uk_stress_flag.status, "unavailable");
  assert.equal(PROVIDER_AVAILABILITY.gbpusd_price.status, "available");
  assert.equal(PROVIDER_AVAILABILITY.vix_level.status, "available");
});
