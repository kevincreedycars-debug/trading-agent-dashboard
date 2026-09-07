#!/usr/bin/env node

const fs = require("fs");
const {
  OUTPUT_PATH,
  buildDiagnostics,
  loadDirectionalArtifact,
  validateDiagnostics
} = require("../lib/l2l_directional_failure_diagnostics");

function main() {
  const artifact = loadDirectionalArtifact();
  const diagnostics = buildDiagnostics(artifact);
  const errors = validateDiagnostics(diagnostics);

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(diagnostics, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    status: errors.length ? "FAIL" : "PASS",
    output_path: OUTPUT_PATH,
    classification: diagnostics.classification,
    layer1_accuracy_pct: diagnostics.preserved_result.layer1AccuracyPct,
    layer2_accuracy_pct: diagnostics.preserved_result.layer2AccuracyPct,
    layer2_net_improvement_pct: diagnostics.findings.broadSignalAssessment.layer2NetImprovementVsMatchedLayer1Pct,
    errors
  }, null, 2));

  if (errors.length) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
