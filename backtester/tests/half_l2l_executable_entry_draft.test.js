const test = require("node:test");
const assert = require("node:assert/strict");

const {
  CHRONOLOGICAL_FOLDS,
  EXCLUSION_REASON_INCOMPLETE_SESSION,
  EXCLUSION_REASON_MISSING_SESSION,
  EXCLUSION_REASON_NO_ENTRY_CANDLE,
  IANA_TIME_ZONE,
  assignChronologicalFold,
  selectEntryCandle,
  zonedTimeToUtc
} = require("../lib/half_l2l_executable_entry_draft");

test("IANA timezone conversion handles standard time and DST by date", () => {
  assert.equal(zonedTimeToUtc("2024-01-05", "10:00:00", IANA_TIME_ZONE), "2024-01-05T15:00:00.000Z");
  assert.equal(zonedTimeToUtc("2024-07-05", "10:00:00", IANA_TIME_ZONE), "2024-07-05T14:00:00.000Z");
  assert.equal(zonedTimeToUtc("2025-03-10", "12:00:00", IANA_TIME_ZONE), "2025-03-10T16:00:00.000Z");
});

test("entry selection chooses the first candle opening at or after the proxy", () => {
  const candles = [
    { timestamp: "2024-01-05T14:00:00.000Z", open: 100, complete: true },
    { timestamp: "2024-01-05T15:00:00.000Z", open: 101, complete: true },
    { timestamp: "2024-01-05T16:00:00.000Z", open: 102, complete: true }
  ];

  const result = selectEntryCandle(candles, "2024-01-05T14:30:00.000Z", "2024-01-06T21:00:00.000Z");
  assert.equal(result.exclusionReason, null);
  assert.equal(result.entryCandle.timestamp, "2024-01-05T15:00:00.000Z");
  assert.equal(result.entryCandle.open, 101);
});

test("entry selection can use the candle that opens exactly at the proxy time", () => {
  const candles = [
    { timestamp: "2024-07-05T13:00:00.000Z", open: 100, complete: true },
    { timestamp: "2024-07-05T14:00:00.000Z", open: 105, complete: true }
  ];

  const result = selectEntryCandle(candles, "2024-07-05T14:00:00.000Z", "2024-07-08T20:00:00.000Z");
  assert.equal(result.exclusionReason, null);
  assert.equal(result.entryCandle.timestamp, "2024-07-05T14:00:00.000Z");
});

test("entry selection excludes rows when no same-day candle remains after the proxy", () => {
  const candles = [
    { timestamp: "2024-01-05T14:00:00.000Z", open: 100, complete: true },
    { timestamp: "2024-01-05T15:00:00.000Z", open: 101, complete: true }
  ];

  const result = selectEntryCandle(candles, "2024-01-05T16:30:00.000Z", "2024-01-06T21:00:00.000Z");
  assert.equal(result.entryCandle, null);
  assert.equal(result.exclusionReason, EXCLUSION_REASON_NO_ENTRY_CANDLE);
});

test("entry selection rejects missing or incomplete sessions before any outcome traversal", () => {
  assert.equal(
    selectEntryCandle([], "2024-01-05T15:00:00.000Z", "2024-01-06T21:00:00.000Z").exclusionReason,
    EXCLUSION_REASON_MISSING_SESSION
  );
  assert.equal(
    selectEntryCandle([{ timestamp: "2024-01-05T15:00:00.000Z", open: 101, complete: false }], "2024-01-05T15:00:00.000Z", "2024-01-06T21:00:00.000Z").exclusionReason,
    EXCLUSION_REASON_INCOMPLETE_SESSION
  );
});

test("chronological folds remain frozen to the approved ranges", () => {
  assert.deepEqual(CHRONOLOGICAL_FOLDS, [
    { key: "TRAIN", start: "2024-01-03", end: "2024-12-31", sealed_from_parameter_selection: false },
    { key: "VALIDATION", start: "2025-01-01", end: "2025-09-30", sealed_from_parameter_selection: false },
    { key: "FINAL_TEST", start: "2025-10-01", end: "2026-04-30", sealed_from_parameter_selection: true }
  ]);
  assert.equal(assignChronologicalFold("2024-06-17"), "TRAIN");
  assert.equal(assignChronologicalFold("2025-08-01"), "VALIDATION");
  assert.equal(assignChronologicalFold("2026-04-30"), "FINAL_TEST");
  assert.equal(assignChronologicalFold("2026-05-01"), null);
});
