#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { buildSessionCloseDataset, validateSessionCloseDataset } = require("../lib/l2l_session_close_dataset_builder");

function optionValue(args, option) {
  const index = args.indexOf(option);
  return index >= 0 ? args[index + 1] : null;
}

function main() {
  const args = process.argv.slice(2);
  const inputPath = optionValue(args, "--input");
  const outputPath = optionValue(args, "--output");
  if (!inputPath || !outputPath) {
    throw new Error("Usage: node backtester/scripts/build_l2l_session_close_dataset.js --input <timestamped-records.json> --output <dataset.json>");
  }

  const input = JSON.parse(fs.readFileSync(path.resolve(inputPath), "utf8"));
  const records = Array.isArray(input) ? input : input.records;
  const dataset = buildSessionCloseDataset(records, input.source || {});
  const errors = validateSessionCloseDataset(dataset);
  if (errors.length) throw new Error(errors.join(" "));

  fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: "PASS", outputPath: path.resolve(outputPath), coverage: dataset.coverage }, null, 2));
}

if (require.main === module) main();
