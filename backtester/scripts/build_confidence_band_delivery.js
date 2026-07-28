#!/usr/bin/env node

const path = require("path");
const { writeConfidenceBandDeliveryArtifact } = require("../lib/confidence_band_delivery");

const DEFAULT_CALIBRATION = path.resolve(__dirname, "../../data/confidence-calibration.json");
const DEFAULT_OUTPUT = path.resolve(__dirname, "../../data/confidence-band-delivery.json");

function parseArgs(argv = []) {
  const result = {
    calibrationPath: DEFAULT_CALIBRATION,
    outputPath: DEFAULT_OUTPUT
  };

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--calibration" && argv[index + 1]) {
      result.calibrationPath = path.resolve(process.cwd(), argv[index + 1]);
      index += 1;
    } else if (argv[index] === "--output" && argv[index + 1]) {
      result.outputPath = path.resolve(process.cwd(), argv[index + 1]);
      index += 1;
    }
  }

  return result;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = writeConfidenceBandDeliveryArtifact(args.outputPath, {
    calibrationPath: args.calibrationPath
  });
  console.log(`Wrote confidence-band delivery artifact to ${args.outputPath}`);
  console.log(`Reference rows: ${payload.rows.length}`);
  console.log(`Fallback levels: ${payload.fallback_hierarchy.length}`);
}

main();
