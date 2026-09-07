#!/usr/bin/env node

const fs = require("fs");
const {
  OUTPUT_PATH,
  buildReconciliation,
  validateReconciliation
} = require("../lib/l2l_excursion_definition_reconciliation");

function main() {
  const output = buildReconciliation();
  const errors = validateReconciliation(output);

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    status: errors.length ? "FAIL" : "PASS",
    output_path: OUTPUT_PATH,
    conclusion: output.conclusion,
    originalHeadlineReproduction: output.originalHeadlineReproduction,
    halfTransitionOverall: output.transitionMatrices.half.overall,
    fullTransitionOverall: output.transitionMatrices.full.overall,
    errors
  }, null, 2));

  if (errors.length) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
