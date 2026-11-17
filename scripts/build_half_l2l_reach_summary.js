#!/usr/bin/env node
/**
 * Build the small, committed half-distance reach summary.
 *
 * The full 35.3 MB `data/half-l2l-reach-research.json` is an archive artefact and is not on the published
 * branch. The Backtest sub-tab only reads `meta`, `source_audit`, `comparisons`, `monotonicity` and
 * `manual_review`, so this script copies exactly those five fields. It never recomputes a statistic.
 *
 * Usage:
 *   node scripts/build_half_l2l_reach_summary.js --source <path-to-full-artifact>
 *   node scripts/build_half_l2l_reach_summary.js --check --source <path-to-full-artifact>
 *   node scripts/build_half_l2l_reach_summary.js --print --source <path-to-full-artifact>
 *
 * The source hash is pinned so a different file cannot silently replace the reviewed reach archive.
 * Research only.
 */
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUT_PATH = "data/half-l2l-reach-summary.json";
const DEFAULT_SOURCE = "data/half-l2l-reach-research.json";
const EXPECTED_SOURCE_SHA256 = "b3cdd9b6e58a00e42ad20f2a2e0ab74e40c42a5d8aafcbf8c546a611c67db1f0";
const EXPECTED_SOURCE_BYTES = 35346210;
const EXPECTED_SUMMARY_SHA256 = "5d32f4ff4e9287121a75cd746549115f39e0b01afd4bdb078d03668f8c5e40fa";
const EXPECTED_VERSION = "half-l2l-reach-v2";
const FIELDS = ["meta", "source_audit", "comparisons", "monotonicity", "manual_review"];

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function parseArgs(argv) {
  const args = { check: false, print: false, source: DEFAULT_SOURCE };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--check") args.check = true;
    else if (argv[index] === "--print") args.print = true;
    else if (argv[index] === "--source") {
      args.source = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

function build(sourcePath) {
  const absolute = path.resolve(sourcePath);
  const buffer = fs.readFileSync(absolute);
  const digest = sha256(buffer);
  if (digest !== EXPECTED_SOURCE_SHA256 || buffer.length !== EXPECTED_SOURCE_BYTES) {
    throw new Error(
      `half-l2l summary: source does not match the reviewed archive (bytes ${buffer.length}, sha256 ${digest})`
    );
  }
  const full = JSON.parse(buffer.toString("utf8"));
  if (!full.meta || full.meta.version !== EXPECTED_VERSION) {
    throw new Error(`half-l2l summary: expected ${EXPECTED_VERSION}, found ${full.meta && full.meta.version}`);
  }
  if (!full.comparisons || !full.comparisons.overall) {
    throw new Error("half-l2l summary: the source has no comparisons.overall block");
  }
  const summary = {};
  for (const field of FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(full, field)) {
      throw new Error(`half-l2l summary: source is missing ${field}`);
    }
    summary[field] = full[field];
  }
  return {
    summary,
    text: `${JSON.stringify(summary, null, 2)}\n`,
    source: {
      path: sourcePath,
      bytes: buffer.length,
      sha256: digest,
      version: full.meta.version,
      generated_at: full.meta.generated_at,
    },
    row_level_bytes: JSON.stringify({ row_level: full.row_level }).length,
  };
}

function summary(built) {
  const overall = built.summary.comparisons.overall;
  const layer1 = overall.layer1.halfOfStandard;
  const layer2 = overall.layer2.halfOfStandard;
  return [
    `half-distance reach summary (${built.source.version})`,
    `source: ${built.source.path} (${built.source.bytes} bytes, sha256 ${built.source.sha256})`,
    `layer 1: ${layer1.hits}/${layer1.eligibleCalls} = ${layer1.hitRatePct}% (half distance)`,
    `layer 2: ${layer2.hits}/${layer2.eligibleCalls} = ${layer2.hitRatePct}% (half distance)`,
    `row_level omitted: ${built.row_level_bytes} bytes of per-call records remain in the archive`,
    `wrote fields: ${FIELDS.join(", ")}`,
  ].join("\n");
}

function main(argv) {
  const args = parseArgs(argv);
  const target = path.join(ROOT, OUT_PATH);
  if (args.check && !fs.existsSync(path.resolve(args.source))) {
    if (!fs.existsSync(target)) throw new Error(`missing ${OUT_PATH}; run the builder`);
    const text = fs.readFileSync(target, "utf8");
    const digest = sha256(text);
    if (digest !== EXPECTED_SUMMARY_SHA256) {
      throw new Error(`${OUT_PATH} sha256 ${digest} does not match the reviewed summary`);
    }
    const parsed = JSON.parse(text);
    if (Object.keys(parsed).sort().join(",") !== [...FIELDS].sort().join(",")) {
      throw new Error(`${OUT_PATH} does not contain exactly the five reviewed fields`);
    }
    process.stdout.write(`${OUT_PATH} reproduces from its pinned digest: ${digest}\n`);
    process.stdout.write("full source archive is absent; the committed summary and field set were verified\n");
    return 0;
  }
  const built = build(args.source);
  if (args.print) {
    process.stdout.write(`${summary(built)}\n`);
    return 0;
  }
  if (args.check) {
    if (!fs.existsSync(target)) throw new Error(`missing ${OUT_PATH}; run the builder`);
    if (fs.readFileSync(target, "utf8") !== built.text) {
      throw new Error(`${OUT_PATH} differs from a fresh build; rerun the builder`);
    }
    process.stdout.write(`${summary(built)}\n`);
    process.stdout.write(`${OUT_PATH} reproduces: ${sha256(built.text)}\n`);
    return 0;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, built.text, "utf8");
  process.stdout.write(`${summary(built)}\n`);
  process.stdout.write(`wrote ${OUT_PATH} (sha256 ${sha256(built.text)})\n`);
  return 0;
}

if (require.main === module) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  EXPECTED_SOURCE_BYTES,
  EXPECTED_SOURCE_SHA256,
  EXPECTED_SUMMARY_SHA256,
  EXPECTED_VERSION,
  FIELDS,
  OUT_PATH,
  build,
  main,
  summary,
};
