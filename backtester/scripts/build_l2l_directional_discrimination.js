#!/usr/bin/env node

const fs = require("fs");
const {
  OUTPUT_PATH,
  buildDiscrimination,
  loadDirectionalArtifact,
  validateDiscrimination
} = require("../lib/l2l_directional_discrimination");

function main() {
  const artifact = loadDirectionalArtifact();
  const discrimination = buildDiscrimination(artifact);
  const errors = validateDiscrimination(discrimination);

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(discrimination, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    status: errors.length ? "FAIL" : "PASS",
    output_path: OUTPUT_PATH,
    conclusion: discrimination.conclusion,
    headline: discrimination.findings.headline,
    errors
  }, null, 2));

  if (errors.length) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
