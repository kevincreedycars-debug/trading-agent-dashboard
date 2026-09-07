#!/usr/bin/env node

const fs = require("fs");
const {
  EVIDENCE_PATH,
  OUTPUT_PATH,
  buildAudit,
  buildEvidence,
  validateAudit
} = require("../lib/l2l_signal_construction_audit");

function main() {
  const audit = buildAudit();
  const evidence = buildEvidence(audit);
  const errors = validateAudit(audit);

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  fs.writeFileSync(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    status: errors.length ? "FAIL" : "PASS",
    output_path: OUTPUT_PATH,
    evidence_path: EVIDENCE_PATH,
    best_explained_by: audit.bestExplainedBy,
    layer1_direction_mismatches: audit.reproduction.layer1DirectionalArtifact.directionMismatchCount,
    layer2_direction_mismatches: audit.reproduction.layer2DirectionalArtifact.directionMismatchCount,
    errors
  }, null, 2));

  if (errors.length) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
