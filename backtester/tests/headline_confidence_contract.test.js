const test = require("node:test");
const assert = require("node:assert/strict");
const {
  computeHeadlineConfidenceData,
  computeHeadlineConfidenceFromRow,
  deriveConfidenceStrength
} = require("../lib/headline_confidence");

function bucketKey(confidence) {
  if (confidence >= 80) return "very_strong";
  if (confidence >= 65) return "strong";
  if (confidence >= 50) return "moderate";
  return "weak";
}

test("headline confidence can differ from conviction for EUR live-style inputs", () => {
  const result = computeHeadlineConfidenceData({
    bullCase: 0,
    bearCase: 100,
    participation: 36,
    netEdge: -100,
    direction: "BEARISH"
  });

  assert.equal(result.value, 68);
  assert.equal(deriveConfidenceStrength(result.value, -100, 36, "BEARISH"), "STRONG");
  assert.equal(bucketKey(result.value), "strong");
  assert.notEqual(result.value, 100);
});

test("headline confidence can exceed conviction for Gold live-style inputs", () => {
  const result = computeHeadlineConfidenceData({
    bullCase: 0,
    bearCase: 100,
    participation: 68,
    netEdge: -100,
    direction: "BEARISH"
  });

  assert.equal(result.value, 89);
  assert.equal(bucketKey(result.value), "very_strong");
  assert.notEqual(result.value, 68);
});

test("row helper prefers displayed-confidence semantics over conviction aliases", () => {
  const result = computeHeadlineConfidenceFromRow({
    predicted_direction: "BEARISH_LEAN",
    predicted_conviction: 42,
    agent_conviction: 42,
    bull_case_pct: 0,
    bear_case_pct: 100,
    participation_pct: 42,
    net_edge_pct: -100
  });

  assert.equal(result.value, 80);
  assert.equal(bucketKey(result.value), "very_strong");
});
