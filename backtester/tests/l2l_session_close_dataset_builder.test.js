"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildSessionCloseDataset,
  validateSessionCloseDataset
} = require("../lib/l2l_session_close_dataset_builder");

function record(overrides = {}) {
  return {
    recordId: "EUR-20260504",
    assetCode: "EUR",
    sessionStartTimeUtc: "2026-05-04T13:30:00Z",
    sessionEndTimeUtc: "2026-05-04T20:00:00Z",
    decisionTimeUtc: "2026-05-04T13:25:00Z",
    sessionOpenPrice: 1.12,
    sessionClosePrice: 1.11,
    features: [{ name: "eurusd_5m_return", value: 0.03, availableAtUtc: "2026-05-04T13:24:00Z" }],
    ...overrides
  };
}

test("builds a research-only dataset with accepted labels and an exclusion audit", () => {
  const dataset = buildSessionCloseDataset([
    record(),
    record({ recordId: "EUR-20260505", features: [{ name: "late_value", value: 1, availableAtUtc: "2026-05-04T13:26:00Z" }] })
  ], { description: "fixture" });

  assert.equal(dataset.meta.researchOnly, true);
  assert.equal(dataset.meta.dashboardModelUpdated, false);
  assert.equal(dataset.coverage.includedRecordCount, 1);
  assert.equal(dataset.coverage.excludedRecordCount, 1);
  assert.equal(dataset.included[0].label, "BEARISH");
  assert.equal(dataset.excluded[0].reason, "feature_not_available_pre_decision");
  assert.deepEqual(validateSessionCloseDataset(dataset), []);
});
