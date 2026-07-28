const test = require("node:test");
const assert = require("node:assert/strict");
const {
  TEN_POINT_BUCKETS,
  buildConfidenceCalibrationArtifact,
  classifyLayer1Direction
} = require("../lib/confidence_calibration");

test("confidence calibration artifact uses the exact ten-point buckets for pooled Layer 1 and Layer 2", () => {
  const artifact = buildConfidenceCalibrationArtifact();
  const expectedLabels = TEN_POINT_BUCKETS.map((bucket) => bucket.label);

  assert.deepEqual(
    artifact.layer1.pooled.bucket_rows.map((row) => row.bucket_label),
    expectedLabels
  );
  assert.deepEqual(
    artifact.layer2.pooled.bucket_rows.map((row) => row.bucket_label),
    expectedLabels
  );
});

test("confidence calibration artifact preserves verified production definitions", () => {
  const artifact = buildConfidenceCalibrationArtifact();

  assert.match(artifact.definitions_contract.participation_definition, /weighted share/i);
  assert.equal(
    artifact.definitions_contract.layer1_strength_thresholds.VERY_STRONG,
    "confidence >= 80, abs(net edge) >= 25, participation >= 50"
  );
  assert.equal(
    artifact.definitions_contract.layer2_strength_thresholds.STRONG,
    "combined confidence >= 65"
  );
  assert.match(artifact.definitions_contract.direction_mapping.layer1[0], /BULLISH_LEAN/i);
  assert.match(artifact.definitions_contract.direction_mapping.layer2[0], /BUY and SELL/i);
});

test("confidence calibration artifact exposes monotonic and reliability diagnostics", () => {
  const artifact = buildConfidenceCalibrationArtifact();
  const pooledLayer1 = artifact.layer1.pooled;
  const pooledLayer2 = artifact.layer2.pooled;

  assert.ok(["monotonic", "not_monotonic", "insufficient_data"].includes(pooledLayer1.monotonic_accuracy.label));
  assert.ok(["monotonic", "not_monotonic", "insufficient_data"].includes(pooledLayer2.monotonic_accuracy.label));
  assert.ok(pooledLayer1.reliability_summary.ordinal_conviction_label);
  assert.ok(pooledLayer2.reliability_summary.probability_label);
});

test("confidence calibration artifact exposes explicit lean-direction mapping", () => {
  assert.deepEqual(
    classifyLayer1Direction("BULLISH_LEAN"),
    {
      emitted_direction_class: "BULLISH_LEAN",
      delivery_direction: "BULLISH",
      normalized_direction_sign: "BULLISH"
    }
  );
  assert.deepEqual(
    classifyLayer1Direction("BEARISH_LEAN"),
    {
      emitted_direction_class: "BEARISH_LEAN",
      delivery_direction: "BEARISH",
      normalized_direction_sign: "BEARISH"
    }
  );

  const artifact = buildConfidenceCalibrationArtifact();
  assert.ok(Array.isArray(artifact.layer1.assets.EUR.direction_bucket_rows));
  assert.ok(artifact.layer1.assets.EUR.direction_bucket_rows.some((row) => row.direction === "BULLISH"));
  assert.ok(artifact.layer1.assets.EUR.direction_bucket_rows.some((row) => row.direction === "BEARISH"));
});
