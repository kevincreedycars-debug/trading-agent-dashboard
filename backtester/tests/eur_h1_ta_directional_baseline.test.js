"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { fitLogisticRegression, predictProbability } = require("../lib/eur_h1_ta_directional_baseline");

function record(value, bullish) {
  return {
    label: bullish ? "BULLISH" : "BEARISH",
    features: [{ name: "momentum", value }]
  };
}

test("fixed logistic baseline learns a separable pre-session feature", () => {
  const records = [record(-3, false), record(-2, false), record(-1, false), record(1, true), record(2, true), record(3, true)];
  const model = fitLogisticRegression(records, ["momentum"]);
  assert.ok(predictProbability(model, record(2.5, true)) > 0.5);
  assert.ok(predictProbability(model, record(-2.5, false)) < 0.5);
});
