const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DIAGNOSES,
  classifyDiagnosis,
  deriveDirectionFromWeightedScore,
  deriveLayer2PairDirection,
  normalizeDirection
} = require("../lib/l2l_signal_construction_audit");

test("weighted score reproduction maps larger bullish or bearish totals to direction", () => {
  assert.equal(deriveDirectionFromWeightedScore({ bullish_weight: 60, bearish_weight: 40 }), "BULLISH");
  assert.equal(deriveDirectionFromWeightedScore({ bullish_weight: 10, bearish_weight: 90 }), "BEARISH");
  assert.equal(deriveDirectionFromWeightedScore({ bullish_weight: 10, bearish_weight: 10 }), null);
});

test("layer 2 pair direction requires opposite target and usd directions", () => {
  assert.equal(deriveLayer2PairDirection("BULLISH", "BEARISH"), "BULLISH");
  assert.equal(deriveLayer2PairDirection("BEARISH", "BULLISH"), "BEARISH");
  assert.equal(deriveLayer2PairDirection("BULLISH", "BULLISH"), null);
});

test("direction normalization handles prefixed and trade-style labels", () => {
  assert.equal(normalizeDirection("Bullish Lean"), "BULLISH");
  assert.equal(normalizeDirection("SELL"), "BEARISH");
});

test("diagnosis prefers horizon mismatch when mechanics reconcile but session question still fails", () => {
  const diagnosis = classifyDiagnosis({
    reproduction: {
      layer1Checkers: {
        byAsset: {
          EUR: { directionMismatchCount: 0, confidenceMismatchCount: 0 }
        }
      },
      layer1DirectionalArtifact: {
        missingJoinCount: 0,
        directionMismatchCount: 0,
        confidenceMismatchCount: 0
      },
      layer2DirectionalArtifact: {
        missingJoinCount: 0,
        directionMismatchCount: 0,
        confidenceMismatchCount: 0
      }
    },
    validatedDirectionalOutcome: {
      pathDependenceConclusion: "ORIGINAL_METRIC_PATH_DEPENDENT",
      sessionOpenDiscriminationConclusion: "BEARISH_ASYMMETRY_ONLY",
      layer1DirectionalAccuracyPct: 47.65,
      layer2DirectionalAccuracyPct: 47.99,
      layer1BaselinePct: 53.19,
      layer2BaselinePct: 53.45,
      layer1BearishAccuracyPct: 42,
      layer1BullishAccuracyPct: 50,
      layer2BearishAccuracyPct: 42,
      layer2BullishAccuracyPct: 51
    }
  });
  assert.equal(diagnosis, DIAGNOSES.HORIZON_MISMATCH);
});
