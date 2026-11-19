/**
 * Build the H1 `ice` evidence bundle from the archived DXY.cash tape (amendment `H1-A01`).
 *
 * Usage:
 *   node scripts/build_h1_ice_evidence.js
 *   node scripts/build_h1_ice_evidence.js --out backtester/tmp/h1-ice-dxy-cash-v1.json
 *   node scripts/build_h1_ice_evidence.js --print-summary
 *
 * This writes a staging file only. Nothing reaches `data/usd-layer1-backtester/h1-v1/` until the importer
 * validates it:
 *   node scripts/import_h1_evidence.js --input ice --file backtester/tmp/h1-ice-dxy-cash-v1.json
 *
 * Research only.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { buildBundle } = require("../lib/layer1_backtesting/h1_ice_dxy");

const ROOT = path.resolve(__dirname, "..");
const OUT_PATH = "backtester/tmp/h1-ice-dxy-cash-v1.json";

function parseArgs(argv) {
  const args = { out: OUT_PATH, printSummary: false, quiet: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") args.out = argv[++index];
    else if (value === "--print-summary") args.printSummary = true;
    else if (value === "--quiet") args.quiet = true;
    else if (value === "--help" || value === "-h") args.help = true;
    else throw new Error(`unknown argument ${value}`);
  }
  return args;
}

function usage() {
  return [
    "node scripts/build_h1_ice_evidence.js [--out <file>] [--print-summary] [--quiet]",
    "",
    `default out: ${OUT_PATH}`,
    "then: node scripts/import_h1_evidence.js --input ice --file <file>",
  ].join("\n");
}

function summary(bundle) {
  const { report, provenance, amendment } = bundle;
  const lines = [
    `amendment ${amendment.id} (${amendment.version}) · preserves ${amendment.preserves}`,
    `source ${bundle.source} · ${bundle.instrument}`,
    `tape ${provenance.series_file} · sha256 ${provenance.tape_sha256_verified}`,
    `bars ${provenance.bars} · ${provenance.first_bar_utc} to ${provenance.last_bar_utc} (bar opening instants, UTC)`,
    `sessions ${report.sessions} · records ${report.records} · excluded ${report.excluded}`,
    `gaps ${JSON.stringify(report.interval_hours)} · max ${report.max_gap_hours}h · cap ${report.max_lookback_days} days`,
    `records ${report.first_record} to ${report.last_record}`,
    `observed==published on every record: ${report.observed_equals_published} · two operands on every record: ${report.operands_complete}`,
  ];
  for (const [reason, count] of Object.entries(report.excluded_by_reason)) {
    lines.push(`excluded ${reason}: ${count}`);
  }
  return lines.join("\n");
}

function build({ out = OUT_PATH, quiet = false } = {}) {
  const bundle = buildBundle({ root: ROOT });
  const target = path.resolve(ROOT, out);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(bundle, null, 2)}\n`);
  if (!quiet) {
    console.log(summary(bundle));
    console.log(`wrote ${bundle.records.length} record(s) to ${path.relative(ROOT, target).replace(/\\/g, "/")}`);
    console.log("next: node scripts/import_h1_evidence.js --input ice --file " + out);
  }
  return { bundle, target };
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }
  const { bundle, target } = build({ out: args.out, quiet: args.quiet });
  if (args.printSummary) {
    console.log(summary(bundle));
    console.log(path.relative(ROOT, target).replace(/\\/g, "/"));
  }
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { OUT_PATH, parseArgs, build, summary, main };
