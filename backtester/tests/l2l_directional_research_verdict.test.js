const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildEvidence,
  validateVerdict
} = require("../lib/l2l_directional_research_verdict");

test("verdict evidence preserves the same summary and conclusion", () => {
  const verdict = {
    meta: { generated_at: "2026-08-15T00:00:00.000Z" },
    sourceArtifacts: [{ path: "data/example.json", sha256: "abc" }],
    findings: { sample: true },
    finalConclusion: { validatedPredictorOfDesignatedSessionDirection: false }
  };
  const evidence = buildEvidence(verdict);
  assert.equal(evidence.preservedSummary.sample, true);
  assert.equal(evidence.finalConclusion.validatedPredictorOfDesignatedSessionDirection, false);
});

test("verdict validation rejects unexpected frozen population sizes", () => {
  const errors = validateVerdict({
    frozenPopulation: {
      eligibleRows: 1,
      layer1Rows: 2,
      layer2Rows: 3
    },
    findings: {
      sessionCloseDirectionalAccuracy: {
        layer1AccuracyPct: 40,
        layer2AccuracyPct: 40
      },
      originalExcursionMetric: {
        conclusion: "ORIGINAL_METRIC_PATH_DEPENDENT"
      }
    }
  });
  assert.equal(errors.length >= 3, true);
});
