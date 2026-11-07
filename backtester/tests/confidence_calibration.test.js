const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  TEN_POINT_BUCKETS,
  buildConfidenceCalibrationArtifact,
  classifyLayer1Direction
} = require("../lib/confidence_calibration");
const { CHECKER_PATHS } = require("../lib/factor_edge_lab");

// This artifact is built from the five Backtest Checker corpora, which are 56.7MB of the published tree and are
// frozen off it until the checker is used again (docs/live-trading/DAILY_ALERT_EMAILS_20261107.md, section 3). The
// cases below are the artifact's re-verification against that corpus and cannot run without it, so they read the
// local cache first - `npm run checker:corpus` fills `.local/checker-corpus` - and fall back to the published
// `data/` copy when the corpora are in the tree again. With neither present they say why they are skipped rather
// than failing a suite over a file this repository deliberately stopped publishing.
const CORPUS_CACHE_DIR = path.resolve(__dirname, "../../.local/checker-corpus");
const CORPUS_SKIP_REASON =
  "the checker corpora are frozen off the published tree; npm run checker:corpus fetches them into .local/checker-corpus";

function resolveCheckerPaths() {
  const resolved = {};
  for (const [asset, file] of Object.entries(CHECKER_PATHS)) {
    const cached = path.join(CORPUS_CACHE_DIR, path.basename(file));
    resolved[asset] = fs.existsSync(cached) ? cached : file;
  }
  return resolved;
}

const checkerPaths = resolveCheckerPaths();
const corpusSkip = Object.values(checkerPaths).every((file) => fs.existsSync(file))
  ? false
  : CORPUS_SKIP_REASON;

test("confidence calibration artifact uses the exact ten-point buckets for pooled Layer 1 and Layer 2", { skip: corpusSkip }, () => {
  const artifact = buildConfidenceCalibrationArtifact({ checkerPaths });
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

test("confidence calibration artifact preserves verified production definitions", { skip: corpusSkip }, () => {
  const artifact = buildConfidenceCalibrationArtifact({ checkerPaths });

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

test("confidence calibration artifact exposes monotonic and reliability diagnostics", { skip: corpusSkip }, () => {
  const artifact = buildConfidenceCalibrationArtifact({ checkerPaths });
  const pooledLayer1 = artifact.layer1.pooled;
  const pooledLayer2 = artifact.layer2.pooled;

  assert.ok(["monotonic", "not_monotonic", "insufficient_data"].includes(pooledLayer1.monotonic_accuracy.label));
  assert.ok(["monotonic", "not_monotonic", "insufficient_data"].includes(pooledLayer2.monotonic_accuracy.label));
  assert.ok(pooledLayer1.reliability_summary.ordinal_conviction_label);
  assert.ok(pooledLayer2.reliability_summary.probability_label);
});

test("confidence calibration artifact exposes explicit lean-direction mapping", { skip: corpusSkip }, () => {
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

  const artifact = buildConfidenceCalibrationArtifact({ checkerPaths });
  assert.ok(Array.isArray(artifact.layer1.assets.EUR.direction_bucket_rows));
  assert.ok(artifact.layer1.assets.EUR.direction_bucket_rows.some((row) => row.direction === "BULLISH"));
  assert.ok(artifact.layer1.assets.EUR.direction_bucket_rows.some((row) => row.direction === "BEARISH"));
});
