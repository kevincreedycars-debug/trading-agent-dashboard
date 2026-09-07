#!/usr/bin/env node
"use strict";

const fs = require("fs");
const { OUTPUT_PATH, buildBaselineStudy } = require("../lib/eur_h1_ta_directional_baseline");

const study = buildBaselineStudy();
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(study, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: "PASS",
  outputPath: OUTPUT_PATH,
  validation: study.validation.accuracyPct,
  validationBaseline: study.validation.alwaysBullishBaselinePct,
  finalTest: study.finalTest.accuracyPct,
  finalTestBaseline: study.finalTest.alwaysBullishBaselinePct,
  readyForDashboard: study.conclusion.readyForDashboard
}, null, 2));
