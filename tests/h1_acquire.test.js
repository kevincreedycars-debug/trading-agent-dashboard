/**
 * The acquisition half of H1: clocks, parsers and record construction.
 *
 * Every test here is offline. The fixtures are the smallest text that exercises one rule, so a parser
 * regression fails on the shape of the source rather than on the size of a download.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  etInstant,
  nextMonday,
  parseCboeHistory,
  parseFedMatrix,
  parseTreasuryCsv,
  parseNasdaqHistory,
  parseH10Weekly,
  mergeObservations,
  buildBundle,
  fetchPlan,
  SOURCES,
  CLOCK_POLICY,
} = require("../lib/layer1_backtesting/h1_acquire");
const { CONTRACTS } = require("../lib/layer1_backtesting/h1_coverage");
const { validateBundle } = require("../lib/layer1_backtesting/h1_evidence");

const WINTER = "2024-01-02";
const SUMMER = "2024-07-02";

test("a 16:15 ET clock follows daylight saving", () => {
  assert.equal(etInstant(WINTER, 16, 15), Date.parse("2024-01-02T21:15:00Z"));
  assert.equal(etInstant(SUMMER, 16, 15), Date.parse("2024-07-02T20:15:00Z"));
});

test("the H.10 release Monday is the first Monday strictly after the observation week", () => {
  assert.equal(nextMonday("2024-01-05"), "2024-01-08");
  assert.equal(nextMonday("2024-01-08"), "2024-01-15");
  assert.equal(nextMonday("2024-01-06"), "2024-01-08");
});

test("the Cboe history parser reads DATE and CLOSE and ignores an unparsable row", () => {
  const parsed = parseCboeHistory("DATE,OPEN,HIGH,LOW,CLOSE\n01/02/2024,13.0,14.0,12.5,13.20\nbad,1,2,3,4\n01/03/2024,13.2,13.9,12.9,13.35\n");
  assert.deepEqual(parsed, [
    { date: "2024-01-02", value: 13.2 },
    { date: "2024-01-03", value: 13.35 },
  ]);
});

test("the H.15 matrix parser selects the declared series and refuses a missing one", () => {
  const matrix = [
    '"Series Description","1-year","2-year"',
    '"Unique Identifier: ","RIFLGFCY01_N.B","RIFLGFCY02_N.B"',
    '"Time Period","RIFLGFCY01_N.B","RIFLGFCY02_N.B"',
    "2024-01-02,4.80,4.33",
    "2024-01-01,ND,ND",
    "2024-01-03,4.81,4.33",
  ].join("\n");
  assert.deepEqual(parseFedMatrix(matrix, "RIFLGFCY02_N.B"), [
    { date: "2024-01-02", value: 4.33 },
    { date: "2024-01-03", value: 4.33 },
  ]);
  assert.throws(() => parseFedMatrix(matrix, "RIFLGFCY10_N.B"), /is not in the header/);
});

test("the Treasury parser matches the column name case-insensitively", () => {
  const csv = 'Date,"5 YR","10 YR"\n12/30/2024,2.02,2.24\n12/31/2024,2.00,2.24\n';
  assert.deepEqual(parseTreasuryCsv(csv, "10 Yr"), [
    { date: "2024-12-30", value: 2.24 },
    { date: "2024-12-31", value: 2.24 },
  ]);
  assert.throws(() => parseTreasuryCsv(csv, "20 YR"), /is missing/);
});

test("the Nasdaq parser strips a currency sign and keeps the official close", () => {
  const json = JSON.stringify({
    data: { tradesTable: { rows: [{ date: "01/02/2024", close: "$401.24" }, { date: "01/03/2024", close: "402.10" }] } },
  });
  assert.deepEqual(parseNasdaqHistory(json), [
    { date: "2024-01-02", value: 401.24 },
    { date: "2024-01-03", value: 402.1 },
  ]);
});

test("the H.10 parser reads the BROAD row, the release date and a year rollover", () => {
  const page = `
    <div class="dates">Release Date: January 8, 2024 </div>
    <thead><tr>
      <th id="a1" colspan="1">COUNTRY</th><th id="a2">CURRENCY</th>
      <th id="a3"> Jan. 1 </th><th id="a4"> Jan. 2 </th><th id="a5"> Jan. 3 </th>
      <th id="a6"> Jan. 4 </th><th id="a7"> Jan. 5 </th>
    </tr></thead>
    <tr><th class="shadestub2" id="r1" headers="a1">1) BROAD </th>
      <td headers="a2 a1 r1">JAN06=100</td>
      <td headers="a3 a1 r1"> 120.1000</td><td headers="a4 a1 r1"> 120.2000</td>
      <td headers="a5 a1 r1"> 120.3000</td><td headers="a6 a1 r1"> ND</td>
      <td headers="a7 a1 r1"> 120.5000</td></tr>`;
  const parsed = parseH10Weekly(page);
  assert.equal(parsed.release_date, "2024-01-08");
  assert.deepEqual(parsed.observations, [
    { date: "2024-01-01", value: 120.1 },
    { date: "2024-01-02", value: 120.2 },
    { date: "2024-01-03", value: 120.3 },
    { date: "2024-01-05", value: 120.5 },
  ]);

  const rollover = page
    .replace("Release Date: January 8, 2024", "Release Date: January 2, 2024")
    .replace(" Jan. 1 ", " Dec. 27 ")
    .replace(" Jan. 2 ", " Dec. 28 ");
  const wrapped = parseH10Weekly(rollover);
  assert.equal(wrapped.release_date, "2024-01-02");
  assert.equal(wrapped.observations[0].date, "2023-12-27");
});

test("the first publication of a date wins over a later revision", () => {
  const merged = mergeObservations([
    { date: "2024-01-02", value: 1, published_ms: 10 },
    { date: "2024-01-02", value: 2, published_ms: 20 },
    { date: "2024-01-03", value: 3, published_ms: 5 },
  ]);
  assert.deepEqual(merged.map((item) => item.value), [1, 3]);
});

function sessionFixture(date, cutoff) {
  return { date, cutoff_at_utc: cutoff };
}

test("a record is written only when the full lookback was published before the cutoff", () => {
  const contract = CONTRACTS.front;
  const source = SOURCES.front;
  const observations = [];
  for (const date of ["2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05", "2024-01-08", "2024-01-09"]) {
    observations.push({
      date,
      value: Number(date.slice(-2)) / 10,
      observed_ms: Date.parse(`${date}T21:00:00Z`),
      published_ms: Date.parse(`${date}T21:15:00Z`),
      release: date,
      vintage: `first-publication:${date}`,
    });
  }
  const bundle = buildBundle({
    key: "front",
    contract,
    sessions: [sessionFixture("2024-01-09", "2024-01-09T05:00:00Z"), sessionFixture("2024-01-12", "2024-01-12T05:00:00Z")],
    observations,
  });
  // The first session has five observations published before its cutoff, one short of the six required.
  assert.equal(bundle.records.length, 1);
  assert.equal(bundle.report.blocked, 1);
  assert.equal(bundle.report.blocked_by_reason.incomplete_lookback, 1);
  const record = bundle.records[0];
  assert.equal(record.session_date, "2024-01-12");
  assert.equal(record.operands.length, 6);
  assert.equal(record.received_at_utc, null);
  assert.equal(bundle.report.receipts, 0);
  assert.ok(record.published_at_utc <= record.published_at_utc);
  assert.ok(Date.parse(record.published_at_utc) < Date.parse("2024-01-12T05:00:00Z"));
  assert.ok(record.publish_margin_hours > 0);
  const checked = validateBundle(bundle, "front", contract, { file: "test" });
  assert.deepEqual(checked.errors, []);
});

test("the five-interval transform is a change in basis points, not a level", () => {
  const contract = CONTRACTS.front;
  const observations = [4.0, 4.1, 4.2, 4.2, 4.3, 4.5].map((value, index) => ({
    date: `2024-05-0${index + 1}`,
    value,
    observed_ms: Date.parse(`2024-05-0${index + 1}T20:00:00Z`),
    published_ms: Date.parse(`2024-05-0${index + 1}T20:15:00Z`),
    release: `2024-05-0${index + 1}`,
    vintage: "first-publication",
  }));
  const bundle = buildBundle({
    key: "front",
    contract,
    sessions: [sessionFixture("2024-05-07", "2024-05-07T04:00:00Z")],
    observations,
  });
  assert.equal(bundle.records.length, 1);
  assert.equal(Math.round(bundle.records[0].value * 10) / 10, 50);
  assert.equal(bundle.records[0].interval_hours, 120);
});

test("a source that cannot be read keeps its provenance and its next action", () => {
  assert.equal(SOURCES.gold.reachable, false);
  assert.equal(SOURCES.gold.blocked.code, "http_403");
  assert.ok(SOURCES.gold.blocked.next_action.includes("LBMA"));
  assert.equal(SOURCES.spread.blocked.code, "unclocked_publication");
  assert.equal(SOURCES.calendar.blocked.code, "rule_defect_freshness");
  assert.ok(CLOCK_POLICY.rule.includes("reconstructed"));
});

test("the H.10 fetch plan walks weekly release dates and offers holiday fallbacks", () => {
  const plan = fetchPlan("broad", { from: "2024-01-01", to: "2024-01-31" });
  assert.ok(plan.length >= 4);
  for (const entry of plan) {
    assert.match(entry.url, /\/releases\/h10\/\d{8}\/$/);
    assert.equal(entry.altUrls.length, 2);
    assert.ok(entry.release);
  }
  assert.deepEqual(fetchPlan("gold").map((entry) => entry.file), ["lbma-gold-pm.json"]);
});
