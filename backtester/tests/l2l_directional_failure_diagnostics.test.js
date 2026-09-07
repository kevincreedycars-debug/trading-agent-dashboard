const test = require("node:test");
const assert = require("node:assert/strict");

const {
  CLASSIFICATIONS,
  buildConfidenceDiagnostics,
  buildMatchedLayerComparison,
  classifyMechanism,
  summariseRows,
  wilsonInterval
} = require("../lib/l2l_directional_failure_diagnostics");

function createRow(overrides = {}) {
  return {
    predictionId: "pred-1",
    layer: "LAYER_1",
    entityCode: "EUR",
    entityLabel: "EUR",
    underlyingAssetCode: "EUR",
    chronologicalFold: "TRAIN",
    weekdayKey: "MONDAY",
    callDirection: "BULLISH",
    terminalDirection: "BULLISH",
    classification: "CORRECT",
    strengthBucket: "WEAK",
    exactConfidenceBucketKey: "20_29",
    exactConfidenceBucketLabel: "20-29",
    openToCloseReturnAdr: 0.25,
    signedReturnAdrFromCallPerspective: 0.25,
    included: true,
    ...overrides
  };
}

test("row summaries compare accuracy with the unconditional directional baseline", () => {
  const rows = [
    createRow({ classification: "CORRECT", terminalDirection: "BULLISH" }),
    createRow({ predictionId: "pred-2", classification: "CORRECT", terminalDirection: "BULLISH" }),
    createRow({ predictionId: "pred-3", classification: "INCORRECT", terminalDirection: "BEARISH" })
  ];
  const summary = summariseRows(rows, { layer: "LAYER_1" });
  assert.equal(summary.accuracyPct, 66.67);
  assert.equal(summary.actualDistribution.majorityBaselinePct, 66.67);
  assert.equal(summary.excessAccuracyVsBaselinePct, 0);
  assert.equal(summary.inverseDirectionAccuracyPct, 33.33);
});

test("confidence monotonicity flags non-monotonic accuracy", () => {
  const rows = [];
  for (let index = 0; index < 25; index += 1) {
    rows.push(createRow({
      predictionId: `low-${index}`,
      exactConfidenceBucketKey: "20_29",
      exactConfidenceBucketLabel: "20-29",
      classification: "CORRECT"
    }));
    rows.push(createRow({
      predictionId: `mid-${index}`,
      exactConfidenceBucketKey: "30_39",
      exactConfidenceBucketLabel: "30-39",
      classification: "INCORRECT"
    }));
    rows.push(createRow({
      predictionId: `high-${index}`,
      exactConfidenceBucketKey: "40_49",
      exactConfidenceBucketLabel: "40-49",
      classification: index < 12 ? "CORRECT" : "INCORRECT"
    }));
  }
  const diagnostics = buildConfidenceDiagnostics(rows, "LAYER_1");
  assert.equal(diagnostics.monotonicity.accuracyMonotonicNonDecreasing, false);
});

test("matched Layer 2 comparison measures improvement without treating duplicates as independent evidence", () => {
  const layer1Rows = [
    createRow({ predictionId: "pred-1", classification: "INCORRECT" }),
    createRow({ predictionId: "pred-2", classification: "CORRECT", entityCode: "NQ", underlyingAssetCode: "NQ" })
  ];
  const layer2Rows = [
    createRow({ layer: "LAYER_2", predictionId: "pred-1", entityCode: "EUR_USD", underlyingAssetCode: "EUR", classification: "CORRECT" }),
    createRow({ layer: "LAYER_2", predictionId: "pred-2", entityCode: "NQ_USD", underlyingAssetCode: "NQ", classification: "INCORRECT" })
  ];
  const comparison = buildMatchedLayerComparison(layer1Rows, layer2Rows);
  assert.equal(comparison.matchedPredictionCount, 2);
  assert.equal(comparison.improvedCount, 1);
  assert.equal(comparison.worsenedCount, 1);
  assert.equal(comparison.netImprovementPct, 0);
});

test("classification falls back to no stable directional signal when both layers miss baseline and confidence is not monotonic", () => {
  const diagnostics = {
    rows: { layer1: [], layer2: [] },
    layers: {
      layer1: {
        overall: { excessAccuracyVsBaselinePct: -2 },
        direction: { directionSummaries: [
          { callDirection: "BULLISH", accuracyPct: 51 },
          { callDirection: "BEARISH", accuracyPct: 44, excessAccuracyVsBaselinePct: -6 }
        ] },
        confidence: { monotonicity: { accuracyMonotonicNonDecreasing: false } }
      },
      layer2: {
        overall: { excessAccuracyVsBaselinePct: -1.5 },
        direction: { directionSummaries: [
          { callDirection: "BULLISH", accuracyPct: 51.2 },
          { callDirection: "BEARISH", accuracyPct: 42.3, excessAccuracyVsBaselinePct: -8 }
        ] },
        confidence: { monotonicity: { accuracyMonotonicNonDecreasing: false } }
      }
    },
    layer2VersusLayer1: { netImprovementPct: -1 }
  };
  assert.equal(classifyMechanism(diagnostics), CLASSIFICATIONS.BEARISH_CALL_FAILURE_DOMINATES);
});

test("wilson interval remains bounded inside 0-100 pct", () => {
  const interval = wilsonInterval(48, 100);
  assert.equal(interval.lowPct >= 0, true);
  assert.equal(interval.highPct <= 100, true);
});
