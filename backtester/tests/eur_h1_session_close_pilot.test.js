"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildFeatureSet, isHourlyContiguous } = require("../lib/eur_h1_session_close_pilot");

function candle(hour, close) {
  return { timestamp: `2026-05-01T${String(hour).padStart(2, "0")}:00:00.000Z`, open: close - 0.001, high: close + 0.002, low: close - 0.002, close, complete: true };
}

test("technical features are timestamped at the close of the latest completed bar", () => {
  const history = Array.from({ length: 25 }, (_, index) => candle(index, 1.1 + index * 0.001));
  const features = buildFeatureSet(history);
  assert.equal(features.length, 6);
  assert.equal(features[0].availableAtUtc, "2026-05-02T01:00:00.000Z");
  assert.equal(features[0].name, "eurusd_h1_return_1h_pct");
  assert.ok(features.every((feature) => Number.isFinite(feature.value)));
});

test("contiguity check rejects a missing hourly candle", () => {
  assert.equal(isHourlyContiguous([candle(0, 1.1), candle(2, 1.11)]), false);
});
