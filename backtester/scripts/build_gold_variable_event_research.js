#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { buildGoldVariableEventResearchReport } = require("../lib/gold_variable_event_research");

function hashFile(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function run(args = process.argv.slice(2)) {
  if (args.length !== 5 || !/^\d+$/.test(args[4])) {
    throw new Error("Usage: node backtester/scripts/build_gold_variable_event_research.js DATASET.json REGISTRY.json OUTPUT.json SPLIT_ISO EMBARGO_MS");
  }
  const [inputArg, registryArg, outputArg, splitAt, embargoArg] = args;
  const input = path.resolve(inputArg);
  const registryPath = path.resolve(registryArg);
  const output = path.resolve(outputArg);
  if (new Set([input.toLowerCase(), registryPath.toLowerCase()]).has(output.toLowerCase())) {
    throw new Error("Output must not overwrite source evidence or the registry.");
  }
  const report = buildGoldVariableEventResearchReport(
    JSON.parse(fs.readFileSync(input, "utf8")),
    JSON.parse(fs.readFileSync(registryPath, "utf8")),
    { split_at: splitAt, embargo_ms: Number(embargoArg) }
  );
  report.source_sha256 = hashFile(input);
  report.registry_sha256 = hashFile(registryPath);
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output, coverage: report.coverage, upstream_evaluation: report.upstream_evaluation }, null, 2));
  return report;
}

if (require.main === module) run();
module.exports = { run };
