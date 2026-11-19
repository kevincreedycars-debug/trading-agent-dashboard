"use strict";

/**
 * CLI for the reusable USD Layer 1 backtest controller (research only).
 *
 * Usage:
 *   node backtester/scripts/run_usd_l1_backtest_controller.js --model challenger --date 2024-01-03 --decisions
 *   node backtester/scripts/run_usd_l1_backtest_controller.js --model challenger --from 2024-01-02 --to 2024-01-31
 *   node backtester/scripts/run_usd_l1_backtest_controller.js --compare current,challenger,challenger_v1
 *   node backtester/scripts/run_usd_l1_backtest_controller.js --parity
 *   node backtester/scripts/run_usd_l1_backtest_controller.js --list-dates --from 2024-01-02 --to 2024-01-31
 *
 * The process prints one JSON document on stdout and nothing else. A parity mismatch or a bad argument exits
 * non-zero, so an n8n IF node can branch on the exit status rather than parsing prose. Nothing here writes
 * unless `--out` is given, and nothing reads the network, the warehouse or a production path.
 */

const fs = require("node:fs");
const path = require("node:path");

const controller = require("../lib/usd_layer1_backtester/backtest_controller");

const ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_DATASET = "data/usd-layer1-backtester/run-v1.json";

function parseArgs(argv) {
  const args = { date: [] };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`unexpected argument: ${token}`);
    const key = token.slice(2);
    const next = argv[index + 1];
    const takesValue = ["dataset", "model", "compare", "date", "dates", "from", "to", "validation", "out"].includes(key);
    if (takesValue) {
      if (!next || next.startsWith("--")) throw new Error(`--${key} needs a value`);
      const value = next;
      index += 1;
      if (key === "date") args.date.push(value);
      else if (key === "dates") args.date.push(...value.split(",").map((entry) => entry.trim()).filter(Boolean));
      else args[key] = value;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function readDataset(relativeOrAbsolute) {
  const filePath = path.isAbsolute(relativeOrAbsolute) ? relativeOrAbsolute : path.resolve(ROOT, relativeOrAbsolute);
  if (!fs.existsSync(filePath)) throw new Error(`dataset not found: ${filePath}`);
  return { filePath, dataset: JSON.parse(fs.readFileSync(filePath, "utf8")) };
}

function displayPath(filePath) {
  const relative = path.relative(ROOT, filePath);
  return relative.startsWith("..") ? filePath : relative.split(path.sep).join("/");
}

function writeJson(relativeOrAbsolute, payload) {
  const filePath = path.isAbsolute(relativeOrAbsolute) ? relativeOrAbsolute : path.resolve(ROOT, relativeOrAbsolute);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return displayPath(filePath);
}

function usage() {
  return [
    "Usage: node backtester/scripts/run_usd_l1_backtest_controller.js [options]",
    "",
    "  --dataset <path>       run artefact (default data/usd-layer1-backtester/run-v1.json)",
    "  --model <id>           current | challenger | challenger_v1 (default current)",
    "  --date <YYYY-MM-DD>    repeatable; an absent date is reported as a blocked decision",
    "  --dates <a,b>          comma-separated dates",
    "  --from / --to          inclusive date range over the dataset's sessions",
    "  --validation <mode>    structural (default) | receipted",
    "  --compare <a,b>        run several models over the same mornings",
    "  --decisions            include the per-morning decisions in the output",
    "  --parity               re-run all three models and compare with the committed record",
    "  --list-dates           print the selected session dates only",
    "  --out <path>           also write the JSON document to this path"
  ].join("\n");
}

function main(argv = process.argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(JSON.stringify({ usage: usage() }, null, 2));
    return 0;
  }
  const datasetArg = args.dataset || DEFAULT_DATASET;
  const { filePath, dataset } = readDataset(datasetArg);
  const datasetPath = displayPath(filePath);
  const validationMode = args.validation || "structural";
  const dates = args.date.length > 0 ? args.date : null;

  if (args.parity) {
    const report = controller.checkParity(dataset);
    report.dataset.path = datasetPath;
    if (args.out) report.output = writeJson(args.out, report);
    console.log(JSON.stringify(report, null, 2));
    return report.ok ? 0 : 1;
  }

  if (args["list-dates"]) {
    const selected = controller.lookbackDates(dataset, { dates, from: args.from || null, to: args.to || null });
    const report = {
      controller_version: controller.CONTROLLER_VERSION,
      dataset: { path: datasetPath },
      from: args.from || null,
      to: args.to || null,
      dates: selected
    };
    if (args.out) report.output = writeJson(args.out, report);
    console.log(JSON.stringify(report, null, 2));
    return 0;
  }

  if (args.compare) {
    const models = args.compare.split(",").map((entry) => entry.trim()).filter(Boolean);
    const report = controller.compareBacktests({
      dataset,
      datasetPath,
      models,
      dates,
      from: args.from || null,
      to: args.to || null,
      validationMode,
      includeDecisions: args.decisions === true
    });
    if (args.out) report.output = writeJson(args.out, report);
    console.log(JSON.stringify(report, null, 2));
    return 0;
  }

  const report = controller.runBacktest({
    dataset,
    datasetPath,
    model: args.model || "current",
    dates,
    from: args.from || null,
    to: args.to || null,
    validationMode,
    includeDecisions: args.decisions === true
  });
  if (args.out) report.output = writeJson(args.out, report);
  console.log(JSON.stringify(report, null, 2));
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv);
  } catch (error) {
    console.error(JSON.stringify({ error: error.message }, null, 2));
    console.error(usage());
    process.exitCode = 2;
  }
}

module.exports = { ROOT, DEFAULT_DATASET, parseArgs, readDataset, main, usage };
