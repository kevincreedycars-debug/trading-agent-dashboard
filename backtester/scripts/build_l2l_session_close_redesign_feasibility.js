#!/usr/bin/env node

const fs = require("fs");
const {
  EVIDENCE_PATH,
  OUTPUT_PATH,
  buildEvidence,
  buildFeasibilityStudy,
  validateStudy
} = require("../lib/l2l_session_close_redesign_feasibility");

function main() {
  const study = buildFeasibilityStudy();
  const evidence = buildEvidence(study);
  const errors = validateStudy(study);

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(study, null, 2)}\n`, "utf8");
  fs.writeFileSync(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    status: errors.length ? "FAIL" : "PASS",
    output_path: OUTPUT_PATH,
    evidence_path: EVIDENCE_PATH,
    result: study.conclusions.result,
    eligible_rows: study.population.eligibleRows,
    configured_read_only_environment_available: study.sourceCoverage.configuredReadOnlyEnvironmentAvailable,
    timing_defensible: study.lookaheadAudit.timingDefensible,
    errors
  }, null, 2));

  if (errors.length) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
