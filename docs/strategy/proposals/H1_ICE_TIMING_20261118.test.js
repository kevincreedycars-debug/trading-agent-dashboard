// Acceptance tests for the v0.1.1 ICE timing proposal (review finding H1R-03). Two things are proven here:
//
//   1. the proposed rule behaves as written (stored records, each with its expected verdict), and
//   2. the *unmodified* v0.1.0 package refuses every real-world ICE record - a receipt four seconds after the
//      05:00 stamp, and a fixing from the previous business day - while accepting only a synthetic row whose
//      three clocks sit exactly on the cutoff. That is the defect the proposal corrects, shown against shipped
//      code rather than described in prose.
//
// The v0.1.0 package is only read here; a guard test fails if it is edited in place instead of versioned.
//
//   node --test docs/strategy/proposals/H1_ICE_TIMING_20261118.test.js
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  CODE,
  ICE_CONTRACT,
  MAX_AGE_HOURS,
  PROPOSALS,
  assessIceFixing,
  isFiveOClockLondon,
  londonStamp,
} = require("./H1_ICE_TIMING_20261118.js");

const rootDir = path.resolve(__dirname, "../../..");
// This worktree does not carry the frozen package, so the test reads the canonical checkout when the local one
// is absent. `H1_PACKAGE_DIR` overrides both, which is how the same suite would be pointed at a v0.1.1 package.
const LOCAL_PACKAGE = path.join(rootDir, "backtester", "packages", "USD-L1-25F-H1-v0.1.0");
const CANONICAL_PACKAGE = "D:/trading-agent-dashboard-codex/backtester/packages/USD-L1-25F-H1-v0.1.0";
const packageDir = process.env.H1_PACKAGE_DIR
  || (fs.existsSync(path.join(LOCAL_PACKAGE, "engine.js")) ? LOCAL_PACKAGE : CANONICAL_PACKAGE);
const { run } = require(path.join(packageDir, "engine.js"));
const { candidate } = require(path.join(packageDir, "models.js"));
const spec = require(path.join(packageDir, "inputs.json"));

const WINTER_CUTOFF = "2026-11-17T05:00:00Z"; // 05:00 London in GMT
const SUMMER_CUTOFF = "2026-07-15T04:00:00Z"; // 05:00 London in BST

// A stored row as the proposal expects it: two real fixings, the publisher's release stamp and the receipt.
function record(overrides = {}) {
  const base = {
    source: "ICE",
    instrument: "US Dollar Index spot",
    published_at_utc: "2026-11-16T05:00:00Z",
    received_at_utc: "2026-11-16T05:00:04Z",
    latest: { fixing_at_utc: "2026-11-16T05:00:00Z", value: 100.9 },
    previous: { fixing_at_utc: "2026-11-13T05:00:00Z", value: 100 },
  };
  return {
    ...base,
    ...overrides,
    latest: { ...base.latest, ...(overrides.latest || {}) },
    previous: { ...base.previous, ...(overrides.previous || {}) },
  };
}

test("the 05:00 London stamp is read from the tz database, not from a fixed offset", () => {
  assert.equal(londonStamp("2026-11-16T05:00:00Z"), "05:00:00"); // GMT
  assert.equal(londonStamp("2026-07-14T04:00:00Z"), "05:00:00"); // BST: 05:00 London is 04:00Z
  assert.equal(londonStamp("2026-07-14T05:00:00Z"), "06:00:00"); // the naive stamp is an hour late in summer
  assert.equal(isFiveOClockLondon("2026-07-14T04:00:00.000Z"), true);
  assert.equal(isFiveOClockLondon("2026-11-16T04:30:00Z"), false);
  assert.equal(londonStamp(null), null);
});

test("a fixing received seconds after the stamp but before the cutoff is eligible", () => {
  const result = assessIceFixing(record(), { cutoff_at_utc: WINTER_CUTOFF });
  assert.equal(result.code, CODE.ok);
  assert.equal(result.ok, true);
  assert.ok(Math.abs(result.value_pct - 0.9) < 1e-9, `value ${result.value_pct}`);
  assert.equal(result.age_hours, 24);
});

test("a receipt exactly at the 05:00 stamp is also eligible: the rule asks for 'at or before', not 'exactly'", () => {
  const result = assessIceFixing(record({ received_at_utc: "2026-11-16T05:00:00Z" }), { cutoff_at_utc: WINTER_CUTOFF });
  assert.equal(result.code, CODE.ok);
});

test("the receipt may not land after the cutoff, by one second or by half an hour", () => {
  for (const received of ["2026-11-17T05:00:01Z", "2026-11-17T05:30:00Z"]) {
    assert.equal(assessIceFixing(record({ received_at_utc: received }), { cutoff_at_utc: WINTER_CUTOFF }).code, CODE.receiptLate);
  }
});

test("publication after the cutoff blocks, and so does a receipt that precedes publication", () => {
  assert.equal(
    assessIceFixing(record({ published_at_utc: "2026-11-17T05:00:02Z", received_at_utc: "2026-11-17T05:00:03Z" }), { cutoff_at_utc: WINTER_CUTOFF }).code,
    CODE.publicationLate,
  );
  assert.equal(
    assessIceFixing(record({ received_at_utc: "2026-11-16T04:59:59Z" }), { cutoff_at_utc: WINTER_CUTOFF }).code,
    CODE.receiptBeforePublication,
  );
  assert.equal(
    assessIceFixing(record({ published_at_utc: "2026-11-16T04:59:59Z" }), { cutoff_at_utc: WINTER_CUTOFF }).code,
    CODE.observationAfterPublication,
  );
});

test("only a 05:00 London fixing is the declared instrument", () => {
  assert.equal(
    assessIceFixing(record({ latest: { fixing_at_utc: "2026-11-16T04:30:00Z" } }), { cutoff_at_utc: WINTER_CUTOFF }).code,
    CODE.notFiveOClock,
  );
  // A summer 04:00Z fixing is 05:00 London and passes; a summer 05:00Z print is 06:00 London and does not.
  const summerRow = record({
    published_at_utc: "2026-07-14T04:00:00Z",
    received_at_utc: "2026-07-14T04:00:04Z",
    latest: { fixing_at_utc: "2026-07-14T04:00:00Z", value: 100.9 },
    previous: { fixing_at_utc: "2026-07-13T04:00:00Z", value: 100 },
  });
  assert.equal(assessIceFixing(summerRow, { cutoff_at_utc: SUMMER_CUTOFF }).code, CODE.ok);
  const summerRowWrong = record({
    published_at_utc: "2026-07-14T05:00:00Z",
    received_at_utc: "2026-07-14T05:00:04Z",
    latest: { fixing_at_utc: "2026-07-14T05:00:00Z", value: 100.9 },
    previous: { fixing_at_utc: "2026-07-13T05:00:00Z", value: 100 },
  });
  assert.equal(assessIceFixing(summerRowWrong, { cutoff_at_utc: SUMMER_CUTOFF }).code, CODE.notFiveOClock,
    "a 05:00Z stamp in a summer session is 06:00 London");
});

test("a repeated fixing is refused rather than read as a flat 0.00 per cent", () => {
  const repeated = record({ previous: { fixing_at_utc: "2026-11-16T05:00:00Z", value: 100.9 } });
  const result = assessIceFixing(repeated, { cutoff_at_utc: WINTER_CUTOFF });
  assert.equal(result.code, CODE.sameFixing);
  assert.equal(result.value_pct, null);
});

test("a broker proxy, a missing row, a null clock and a missing value all block", () => {
  assert.equal(assessIceFixing(record({ source: "CFD" }), { cutoff_at_utc: WINTER_CUTOFF }).code, CODE.sourceMismatch);
  assert.equal(assessIceFixing(record({ instrument: "DXY.cash" }), { cutoff_at_utc: WINTER_CUTOFF }).code, CODE.sourceMismatch);
  assert.equal(assessIceFixing(null, { cutoff_at_utc: WINTER_CUTOFF }).code, CODE.missing);
  assert.equal(assessIceFixing(record({ received_at_utc: null }), { cutoff_at_utc: WINTER_CUTOFF }).code, CODE.unclocked);
  assert.equal(assessIceFixing(record(), {}).code, CODE.unclocked);
  assert.equal(assessIceFixing(record({ latest: { value: null } }), { cutoff_at_utc: WINTER_CUTOFF }).code, CODE.missingValue);
  assert.equal(assessIceFixing(record({ latest: { value: 0 } }), { cutoff_at_utc: WINTER_CUTOFF }).code, CODE.missingValue);
  assert.equal(assessIceFixing(record({ previous: { value: Number.NaN } }), { cutoff_at_utc: WINTER_CUTOFF }).code, CODE.missingValue);
  assert.equal(assessIceFixing(record(), { cutoff_at_utc: WINTER_CUTOFF, option: "C" }).code, CODE.unknownOption);
});

test("the 24-hour option would exclude every Monday; the 96-hour default does not", () => {
  // 2026-11-13 is a Friday. A Monday 05:00 cutoff is 72 hours after the last eligible 05:00 fixing.
  const monday = record({
    published_at_utc: "2026-11-13T05:00:00Z",
    received_at_utc: "2026-11-13T05:00:04Z",
    latest: { fixing_at_utc: "2026-11-13T05:00:00Z", value: 100.9 },
    previous: { fixing_at_utc: "2026-11-12T05:00:00Z", value: 100 },
  });
  const cutoff = "2026-11-16T05:00:00Z";
  assert.equal(assessIceFixing(monday, { cutoff_at_utc: cutoff, option: "A" }).code, CODE.stale);
  assert.equal(assessIceFixing(monday, { cutoff_at_utc: cutoff, option: "B" }).code, CODE.ok);
  assert.equal(assessIceFixing(monday, { cutoff_at_utc: cutoff }).code, CODE.ok, "the default is option B");
  // 96 hours is the boundary; one hour more is stale.
  assert.equal(assessIceFixing(monday, { cutoff_at_utc: "2026-11-17T05:00:00Z" }).code, CODE.ok);
  assert.equal(assessIceFixing(monday, { cutoff_at_utc: "2026-11-17T06:00:00Z" }).code, CODE.stale);
  assert.deepEqual({ ...MAX_AGE_HOURS }, { A: 24, B: 96 });
});

// The v0.1.0 package, driven unchanged, for the tests below. The fixture builder copies verify.js: every input
// row carries the declared source, instrument and transform and a real clock, and only the ICE clocks vary.
const VALUES = { vix: 17, front: 8, spread: 7, real: 6, broad: 0.4, ice: 0.2, gold: -1.3, qqq: 1.1, calendar: 0 };

function packageFixture({ date = "2026-11-16", endDate = "2026-11-17", iceClocks }) {
  const fixture = { date, endDate, evidence: "synthetic fixture", inputs: {} };
  for (const [key, [source, instrument, transform]] of Object.entries(spec)) {
    const observed = key === "ice" ? iceClocks.observed : key === "calendar" ? `${date}T04:30:00Z` : "2026-11-13T20:00:00Z";
    const published = key === "ice" ? iceClocks.published : observed;
    const received = key === "ice" ? iceClocks.received : observed;
    fixture.inputs[key] = { source, instrument, transform, observed, published, received, original: true, value: VALUES[key] };
  }
  return fixture;
}

test("the package under review is the frozen v0.1.0 candidate", () => {
  assert.equal(spec.ice[3], 0, "the ICE maximum age must still be zero in v0.1.0");
  assert.equal(candidate.version, "USD-L1-25F-H1-v0.1.0");
  assert.equal(ICE_CONTRACT.default_option, "B");
  assert.match(ICE_CONTRACT.transform, /received at or before the cutoff/);
});

test("v0.1.0 accepts only the synthetic row whose three ICE clocks sit exactly on the cutoff", () => {
  const cutoff = "2026-11-16T05:00:00Z";
  const result = run(candidate, packageFixture({ iceClocks: { observed: cutoff, published: cutoff, received: cutoff } }));
  assert.equal(result.status, "directional", "the shipped fixture shape passes, which is the artefact under review");
  assert.equal(result.trace.factors.find((row) => row.source === "ice").value, 0.2);
});

test("v0.1.0 blocks both records a real collector can produce, and the proposal accepts both", () => {
  // A record collected four seconds after the 05:00 stamp is late against a cutoff of 05:00:00.000.
  const secondsLate = run(candidate, packageFixture({
    iceClocks: { observed: "2026-11-16T05:00:00Z", published: "2026-11-16T05:00:00Z", received: "2026-11-16T05:00:04Z" },
  }));
  assert.equal(secondsLate.status, "blocked");
  assert.ok(secondsLate.trace.includes("ice: invalid or late clock"), String(secondsLate.trace));

  // The previous business day's fixing is clocked honestly and still refused, because the cap is zero hours.
  const previousDay = run(candidate, packageFixture({
    iceClocks: { observed: "2026-11-13T05:00:00Z", published: "2026-11-13T05:00:00Z", received: "2026-11-13T05:00:04Z" },
  }));
  assert.equal(previousDay.status, "blocked");
  assert.ok(previousDay.trace.includes("ice: stale"), String(previousDay.trace));

  // The same two stored rows under the proposed rule, read at the morning after their fixing.
  const cutoff = "2026-11-17T05:00:00Z";
  assert.equal(assessIceFixing(record({ received_at_utc: "2026-11-16T05:00:04Z" }), { cutoff_at_utc: cutoff }).code, CODE.ok);
  const fridayRow = record({
    published_at_utc: "2026-11-13T05:00:00Z",
    received_at_utc: "2026-11-13T05:00:04Z",
    latest: { fixing_at_utc: "2026-11-13T05:00:00Z", value: 100.9 },
    previous: { fixing_at_utc: "2026-11-12T05:00:00Z", value: 100 },
  });
  assert.equal(assessIceFixing(fridayRow, { cutoff_at_utc: cutoff }).code, CODE.ok);
});

test("the mirror carries the same six entries as this module", () => {
  const mirror = JSON.parse(fs.readFileSync(path.join(__dirname, "H1_V0_1_1_PROPOSALS_20261118.json"), "utf8"));
  assert.equal(mirror.status, "proposed_not_applied");
  assert.equal(mirror.model.frozen_version, "USD-L1-25F-H1-v0.1.0");
  assert.equal(mirror.model.proposed_version, "USD-L1-25F-H1-v0.1.1");
  assert.deepEqual(mirror.proposals, JSON.parse(JSON.stringify(PROPOSALS)));
  assert.deepEqual(mirror.ice_contract.max_age_hours, { ...MAX_AGE_HOURS });
  assert.equal(mirror.ice_contract.default_option, "B");
  assert.deepEqual(mirror.proposals.map((entry) => entry.finding), ["H1R-03", "H1R-01", "H1R-02", "H1R-04", "H1R-06", "H1R-10"]);
});


