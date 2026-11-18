/**
 * Import H1 evidence without inventing it.
 *
 * Usage:
 *   node scripts/import_h1_evidence.js --input vix --file path/to/vix.csv
 *   node scripts/import_h1_evidence.js --input ice --file path/to/ice.json
 *   node scripts/import_h1_evidence.js --check
 *
 * The CSV columns are:
 *   session_date,value,observed_at_utc,published_at_utc,received_at_utc,vintage,original,operands
 *
 * `operands` is a JSON array. Every operand needs value, observed_at_utc and vintage; calendar
 * operands also need type. `received_at_utc` is left empty for historical reconstruction. The
 * importer never fills it and never turns a publication time into a receipt.
 *
 * Research only. It writes only data/usd-layer1-backtester/h1-v1/<input>.json.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { CONTRACTS, INPUT_ORDER } = require("../lib/layer1_backtesting/h1_coverage");
const { EVIDENCE_DIR, loadEvidence, validateBundle, bundleFromCsv } = require("../lib/layer1_backtesting/h1_evidence");

const ROOT = path.resolve(__dirname, "..");
const KEYS = INPUT_ORDER.slice();

function parseArgs(argv) {
  const args = { check: false, input: null, file: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--check") args.check = true;
    else if (value === "--input") args.input = argv[++index];
    else if (value === "--file") args.file = argv[++index];
    else if (value === "--help" || value === "-h") args.help = true;
    else throw new Error(`unknown argument ${value}`);
  }
  return args;
}

function usage() {
  return [
    "node scripts/import_h1_evidence.js --input <key> --file <csv|json>",
    "node scripts/import_h1_evidence.js --check",
    "",
    `keys: ${KEYS.join(", ")}`,
    "CSV: session_date,value,observed_at_utc,published_at_utc,received_at_utc,vintage,original,operands",
    "operands: JSON array of {value, observed_at_utc, vintage[, type]}",
  ].join("\n");
}

function checkAll() {
  const bundles = loadEvidence({ root: ROOT, keys: KEYS, contracts: CONTRACTS });
  let present = 0;
  let invalid = 0;
  for (const key of KEYS) {
    const bundle = bundles[key];
    if (!bundle.present) {
      console.log(`${key}: no evidence file (${bundle.path})`);
      continue;
    }
    present += 1;
    if (!bundle.valid) invalid += 1;
    console.log(`${key}: ${bundle.valid ? "valid" : "INVALID"} · ${bundle.records.size} record(s) · ${bundle.path}`);
    for (const error of bundle.errors.slice(0, 5)) console.log(`  ${error}`);
  }
  if (!present) console.log("No H1 evidence files are present. Nothing was inferred from the legacy archive.");
  return invalid === 0;
}

function importOne({ input, file }) {
  if (!KEYS.includes(input)) throw new Error(`--input must be one of ${KEYS.join(", ")}`);
  if (!file) throw new Error("--file is required");
  const absolute = path.resolve(process.cwd(), file);
  if (!fs.existsSync(absolute)) throw new Error(`file not found: ${absolute}`);
  const text = fs.readFileSync(absolute, "utf8");
  const contract = CONTRACTS[input];
  const raw = /\.json$/i.test(absolute) ? JSON.parse(text) : bundleFromCsv(text, { key: input, contract });
  const checked = validateBundle(raw, input, contract, { file: absolute });
  if (!checked.valid) {
    console.error(`Refused: ${checked.errors.length} validation error(s). Nothing was written.`);
    for (const error of checked.errors.slice(0, 20)) console.error(`  ${error}`);
    return false;
  }
  const target = path.join(ROOT, EVIDENCE_DIR, `${input}.json`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const bundle = Array.isArray(raw) ? { schema_version: "h1-evidence-v1", input, ...contract, records: raw } : raw;
  fs.writeFileSync(target, `${JSON.stringify({ ...bundle, input, source: contract.source, instrument: contract.instrument, transform: contract.transform }, null, 2)}\n`);
  console.log(`Wrote ${checked.records.size} record(s) to ${EVIDENCE_DIR}/${input}.json`);
  console.log("Next: node scripts/build_backtesting_screen.js");
  return true;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }
  if (args.check) return checkAll() ? 0 : 1;
  if (!args.input) {
    console.error(usage());
    return 2;
  }
  return importOne(args) ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { parseArgs, checkAll, importOne };
