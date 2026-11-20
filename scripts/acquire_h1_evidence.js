/**
 * Acquire the H1 evidence inputs, then hand them to the importer.
 *
 * Usage:
 *   node scripts/acquire_h1_evidence.js --status
 *   node scripts/acquire_h1_evidence.js --keys vix,front,real,qqq --import
 *   node scripts/acquire_h1_evidence.js --keys broad --offline
 *
 * What it does, in order:
 *   1. downloads the exact source file for each requested input into `backtester/tmp/h1-raw/` (untracked)
 *      and writes a manifest with the URL, HTTP status, byte count and sha256 of every file it read;
 *   2. parses the raw files into dated observations, each stamped with a reconstructed publication
 *      clock taken from the publisher's own stated release time;
 *   3. writes one staging bundle per input to `backtester/tmp/h1-<input>-v1.json`;
 *   4. validates the bundle with the same validator the importer uses, and, with `--import`, writes it
 *      to `data/usd-layer1-backtester/h1-v1/<input>.json` through `scripts/import_h1_evidence.js`.
 *
 * A source that cannot be read is reported and skipped. Nothing is filled, bridged or guessed, and a
 * bundle that fails validation is never written.
 *
 * Research only. Nothing here reads or writes a production path.
 */
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { CONTRACTS } = require("../lib/layer1_backtesting/h1_coverage");
const { validateBundle, MIN_OPERANDS } = require("../lib/layer1_backtesting/h1_evidence");
const {
  SOURCES,
  CLOCK_POLICY,
  buildBundle,
  fetchPlan,
  loadSessions,
  observationsFromRaw,
} = require("../lib/layer1_backtesting/h1_acquire");
const { importOne } = require("./import_h1_evidence");

const ROOT = path.resolve(__dirname, "..");
const RAW_ROOT = "backtester/tmp/h1-raw";
const MANIFEST_DIR = "data/usd-layer1-backtester/h1-v1";
const STAGE_DIR = "backtester/tmp";
const DEFAULT_KEYS = ["vix", "front", "real", "qqq", "broad"];

function parseArgs(argv) {
  const args = { keys: null, offline: false, import: false, status: false, check: false, quiet: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--keys") args.keys = String(argv[++index] || "").split(",").map((key) => key.trim()).filter(Boolean);
    else if (value === "--offline") args.offline = true;
    else if (value === "--import") args.import = true;
    else if (value === "--status") args.status = true;
    else if (value === "--check") args.check = true;
    else if (value === "--quiet") args.quiet = true;
    else if (value === "--help" || value === "-h") args.help = true;
    else throw new Error(`unknown argument ${value}`);
  }
  return args;
}

function usage() {
  return [
    "node scripts/acquire_h1_evidence.js --status",
    "node scripts/acquire_h1_evidence.js --keys <a,b> [--import] [--offline] [--check]",
    "",
    `keys: ${Object.keys(SOURCES).join(", ")}`,
    `raw files: ${RAW_ROOT}/<key>/ (untracked)`,
    `manifests: ${MANIFEST_DIR}/raw-<key>.json`,
    `staging bundles: ${STAGE_DIR}/h1-<key>-v1.json`,
  ].join("\n");
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function readManifest(key) {
  const file = path.join(ROOT, MANIFEST_DIR, `raw-${key}.json`);
  if (!fs.existsSync(file)) return { input: key, files: [] };
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return { input: key, files: [] };
  }
}

function writeManifest(key, manifest) {
  const file = path.join(ROOT, MANIFEST_DIR, `raw-${key}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  return file;
}

/** Fetch one URL, or reuse the cached copy when it is already on disk. `offline` never goes to the network. */
async function fetchOne(entry, { key, offline = false }) {
  const dir = path.join(ROOT, RAW_ROOT, key);
  const target = path.join(dir, entry.file);
  if (fs.existsSync(target)) return { text: fs.readFileSync(target, "utf8"), cached: true, status: 200 };
  if (offline) return { text: null, status: 0 };
  fs.mkdirSync(dir, { recursive: true });
  for (const url of [entry.url, ...(entry.altUrls || [])]) {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
        accept: "*/*",
      },
    });
    const text = await response.text();
    if (!response.ok || !text.length) continue;
    fs.writeFileSync(target, text);
    return { text, status: response.status, cached: false, url };
  }
  return { text: null, status: 404 };
}

async function runPool(items, limit, worker) {
  const results = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

async function acquire(key, { offline, quiet }) {
  const source = SOURCES[key];
  if (!source) throw new Error(`unknown input ${key}`);
  if (source.blocked) {
    console.log(`${key}: blocked (${source.blocked.code}) - ${source.blocked.next_action}`);
    return { key, blocked: source.blocked.code };
  }
  const contract = CONTRACTS[key];
  const plan = fetchPlan(key);
  const results = await runPool(plan, 4, async (entry) => ({ entry, result: await fetchOne(entry, { key, offline }) }));
  const raw = [];
  const files = [];
  for (const { entry, result } of results) {
    const record = {
      url: result.url || entry.url,
      file: entry.file,
      ...(entry.release ? { release_date: entry.release } : {}),
      http_status: result.status,
      cached: result.cached === true,
    };
    if (result.text) {
      record.bytes = Buffer.byteLength(result.text);
      record.sha256 = sha256(result.text);
      raw.push({ text: result.text, release: entry.release || null });
    } else {
      record.error = `http ${result.status}`;
    }
    files.push(record);
  }
  writeManifest(key, {
    input: key,
    series: source.series,
    clock_rule: source.clock.id,
    clock_statement: source.clock.statement,
    clock_policy: CLOCK_POLICY,
    availability_evidence: source.availabilityEvidence,
    acquired_at: new Date().toISOString(),
    offline,
    files_read: files.filter((file) => !file.error).length,
    files_failed: files.filter((file) => file.error).length,
    files,
  });
  if (!raw.length) {
    console.log(`${key}: nothing readable (${files.length} file(s) failed)`);
    return { key, failed: true };
  }
  const sessions = loadSessions({ root: ROOT });
  const bundle = buildBundle({
    key,
    contract,
    sessions,
    observations: observationsFromRaw(key, raw),
    provenance: { raw_manifest: `${MANIFEST_DIR}/raw-${key}.json` },
  });
  const checked = validateBundle(bundle, key, contract, { file: `staged:${key}` });
  const stageFile = path.join(ROOT, STAGE_DIR, `h1-${key}-v1.json`);
  fs.writeFileSync(stageFile, `${JSON.stringify(bundle, null, 2)}\n`);
  if (!checked.valid) {
    console.error(`${key}: bundle REFUSED by the importer validator (${checked.errors.length} error(s))`);
    for (const error of checked.errors.slice(0, 10)) console.error(`  ${error}`);
    return { key, invalid: checked.errors.length };
  }
  if (!quiet) {
    console.log(
      `${key}: ${bundle.records.length}/${bundle.report.sessions} session record(s) from ` +
        `${bundle.provenance.observations} observation(s) (${bundle.provenance.first_observation} to ` +
        `${bundle.provenance.last_observation}) | lookback ${MIN_OPERANDS[key]} | publish margin ` +
        `${bundle.report.min_publish_margin_hours}h..${bundle.report.max_publish_margin_hours}h | receipts ` +
        `${bundle.report.receipts}`
    );
    console.log(`  staged ${path.relative(ROOT, stageFile).replace(/\\/g, "/")}`);
  }
  return { key, bundle, stageFile, valid: true };
}

function printStatus() {
  console.log("input    reachable  code                      series");
  for (const [key, source] of Object.entries(SOURCES)) {
    const reachable = source.reachable === true ? "yes" : source.reachable === "partial" ? "partial" : "no";
    const code = source.blocked ? source.blocked.code : "importable";
    console.log(`${key.padEnd(9)}${reachable.padEnd(11)}${code.padEnd(26)}${source.series}`);
  }
  const blocked = Object.entries(SOURCES).filter(([, source]) => source.blocked);
  if (blocked.length) {
    console.log("");
    for (const [key, source] of blocked) {
      console.log(`${key}: ${source.blocked.evidence}`);
      console.log(`  next: ${source.blocked.next_action}`);
    }
  }
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }
  if (args.status) {
    printStatus();
    return 0;
  }
  const keys = args.keys && args.keys.length ? args.keys : DEFAULT_KEYS;
  const outcomes = [];
  for (const key of keys) {
    const outcome = await acquire(key, { offline: args.offline, quiet: args.quiet });
    if (args.import && outcome.valid) {
      outcome.imported = importOne({ input: key, file: path.relative(ROOT, outcome.stageFile) });
    }
    outcomes.push(outcome);
  }
  const imported = outcomes.filter((outcome) => outcome.imported).map((outcome) => outcome.key);
  const notImported = outcomes.filter((outcome) => !outcome.imported).map((outcome) => outcome.key);
  console.log("");
  console.log(`imported: ${imported.length ? imported.join(", ") : "none"}`);
  console.log(`not imported: ${notImported.length ? notImported.join(", ") : "none"}`);
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    }
  );
}

module.exports = { parseArgs, acquire, printStatus, main, sha256, fetchOne, runPool };

