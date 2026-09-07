#!/usr/bin/env node

const fs = require("fs");
const {
  buildOutput,
  evaluateRow,
  loadIntradayContexts,
  loadSourceArtifact,
  OUTPUT_PATH,
  validateOutput
} = require("../lib/l2l_trading_day_directional");

function main() {
  const sourceArtifact = loadSourceArtifact();
  const eligibleRows = (sourceArtifact?.row_level?.all || []).filter((row) => row.status === "ELIGIBLE");
  const intradayContexts = loadIntradayContexts(sourceArtifact);
  const evaluatedRows = eligibleRows.map((row) => evaluateRow(row, intradayContexts));
  const output = buildOutput(sourceArtifact, evaluatedRows);
  const errors = validateOutput(output, sourceArtifact);

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    status: errors.length ? "FAIL" : "PASS",
    output_path: OUTPUT_PATH,
    overall_layer1: output.comparisons.overall.layer1,
    overall_layer2: output.comparisons.overall.layer2,
    errors
  }, null, 2));

  if (errors.length) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
