#!/usr/bin/env node

const fs = require("fs");
const {
  EVIDENCE_PATH,
  OUTPUT_PATH,
  buildEvidence,
  buildVerdict,
  validateVerdict
} = require("../lib/l2l_directional_research_verdict");

function main() {
  const verdict = buildVerdict();
  const evidence = buildEvidence(verdict);
  const errors = validateVerdict(verdict);

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(verdict, null, 2)}\n`, "utf8");
  fs.writeFileSync(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    status: errors.length ? "FAIL" : "PASS",
    output_path: OUTPUT_PATH,
    evidence_path: EVIDENCE_PATH,
    layer1_accuracy_pct: verdict.findings.sessionCloseDirectionalAccuracy.layer1AccuracyPct,
    layer2_accuracy_pct: verdict.findings.sessionCloseDirectionalAccuracy.layer2AccuracyPct,
    errors
  }, null, 2));

  if (errors.length) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
