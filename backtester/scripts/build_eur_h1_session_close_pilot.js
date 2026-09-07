#!/usr/bin/env node
"use strict";

const fs = require("fs");
const { DEFAULT_INPUT_PATH, DEFAULT_OUTPUT_PATH, buildEurH1Pilot } = require("../lib/eur_h1_session_close_pilot");
const { validateSessionCloseDataset } = require("../lib/l2l_session_close_dataset_builder");

const dataset = buildEurH1Pilot(DEFAULT_INPUT_PATH);
const errors = validateSessionCloseDataset(dataset);
if (errors.length) throw new Error(errors.join(" "));
fs.writeFileSync(DEFAULT_OUTPUT_PATH, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: "PASS",
  outputPath: DEFAULT_OUTPUT_PATH,
  coverage: dataset.coverage,
  sourceExcludedRecordCount: dataset.sourceAudit.sourceExcludedRecordCount,
  dashboardModelUpdated: dataset.meta.dashboardModelUpdated
}, null, 2));
