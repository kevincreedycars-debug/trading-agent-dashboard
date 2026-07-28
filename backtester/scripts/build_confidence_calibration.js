#!/usr/bin/env node

const path = require("path");
const { writeConfidenceCalibrationArtifact } = require("../lib/confidence_calibration");

const DEFAULT_OUTPUT = path.resolve(__dirname, "../../data/confidence-calibration.json");

function parseOutputPath(argv = []) {
  const outputFlagIndex = argv.findIndex((value) => value === "--output");
  if (outputFlagIndex >= 0 && argv[outputFlagIndex + 1]) {
    return path.resolve(process.cwd(), argv[outputFlagIndex + 1]);
  }
  return DEFAULT_OUTPUT;
}

function main() {
  const outputPath = parseOutputPath(process.argv.slice(2));
  const payload = writeConfidenceCalibrationArtifact(outputPath);
  const layer1Buckets = payload.layer1?.pooled?.bucket_rows?.length || 0;
  const layer2Buckets = payload.layer2?.pooled?.bucket_rows?.length || 0;
  console.log(`Wrote confidence calibration artifact to ${outputPath}`);
  console.log(`Layer 1 pooled buckets: ${layer1Buckets}`);
  console.log(`Layer 2 pooled buckets: ${layer2Buckets}`);
}

main();
