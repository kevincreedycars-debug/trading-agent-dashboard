"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  EXCLUSION_REASONS,
  assessSessionCloseRecord
} = require("../lib/l2l_session_close_dataset_contract");

function validRecord() {
  return {
    sessionStartTimeUtc: "2026-05-04T13:30:00Z",
    sessionEndTimeUtc: "2026-05-04T20:00:00Z",
    decisionTimeUtc: "2026-05-04T13:25:00Z",
    sessionOpenPrice: 100,
    sessionClosePrice: 101,
    features: [
      { name: "us_2y_yield", value: 3.72, availableAtUtc: "2026-05-04T13:24:00Z" },
      { name: "scheduled_tier1_events", value: 1, availableAtUtc: "2026-05-04T13:20:00Z" }
    ]
  };
}

test("accepts a fully timestamped pre-session record and derives the close-direction label", () => {
  assert.deepEqual(assessSessionCloseRecord(validRecord()), {
    eligible: true,
    reason: null,
    label: "BULLISH"
  });
});

test("rejects a decision made at the session start", () => {
  const record = validRecord();
  record.decisionTimeUtc = record.sessionStartTimeUtc;
  assert.equal(assessSessionCloseRecord(record).reason, EXCLUSION_REASONS.DECISION_NOT_STRICTLY_PRE_SESSION);
});

test("rejects a feature with no availability timestamp", () => {
  const record = validRecord();
  delete record.features[0].availableAtUtc;
  assert.equal(assessSessionCloseRecord(record).reason, EXCLUSION_REASONS.MISSING_FEATURE_AVAILABILITY);
});

test("rejects a feature first available after the decision cutoff", () => {
  const record = validRecord();
  record.features[0].availableAtUtc = "2026-05-04T13:26:00Z";
  const result = assessSessionCloseRecord(record);
  assert.equal(result.reason, EXCLUSION_REASONS.FEATURE_NOT_AVAILABLE_PRE_DECISION);
  assert.equal(result.featureName, "us_2y_yield");
});
