/**
 * Publish the H1 population reconciliation.
 *
 * Usage:
 *   node scripts/build_h1_population.js
 *   node scripts/build_h1_population.js --check
 *   node scripts/build_h1_population.js --out data/usd-layer1-backtester/h1-v1/population.json
 *
 * Writes data/usd-layer1-backtester/h1-v1/population.json and prints the figures it reconciled.
 *
 * Research only.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { summarisePopulation, readRun } = require("../lib/layer1_backtesting/h1_population");

const ROOT = path.resolve(__dirname, "..");
const OUT_PATH = "data/usd-layer1-backtester/h1-v1/population.json";
const SCREEN_PATH = "data/usd-layer1-backtester/backtesting-screen-v1.json";

function parseArgs(argv) {
  const args = { out: OUT_PATH, check: false, quiet: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") args.out = argv[++index];
    else if (value === "--check") args.check = true;
    else if (value === "--quiet") args.quiet = true;
    else if (value === "--help" || value === "-h") args.help = true;
    else throw new Error(`unknown argument ${value}`);
  }
  return args;
}

function loadJson(relative) {
  const file = path.join(ROOT, relative);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}

function build({ out = OUT_PATH } = {}) {
  const run = readRun({ root: ROOT });
  const screen = loadJson(SCREEN_PATH);
  const summary = summarisePopulation({ run, screen });
  const target = path.resolve(ROOT, out);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(summary, null, 2)}\n`);
  return { summary, target };
}

function summaryLines(summary) {
  const lines = [
    `sessions ${summary.rows.scheduled} · ${summary.rows.first} to ${summary.rows.last}`,
    `weekdays ${Object.entries(summary.rows.weekdays)
      .map(([weekday, count]) => `${weekday}:${count}`)
      .join(" ")}`,
    `all four outcomes ${summary.joint.all_four_present} · at least one ${summary.joint.any_present} · none ${summary.joint.none_present}`,
    `control directional calls ${summary.control.directional_calls} · rows with one non-flat outcome ${summary.control.scored_rows}`,
    `Fridays ${summary.fridays.sessions} · EURUSD ${summary.fridays.markets.EURUSD.present} · XAUUSD ${summary.fridays.markets.XAUUSD.present} · BTCUSD ${summary.fridays.markets.BTCUSD.present} · NAS100 ${summary.fridays.markets.NAS100.present}`,
  ];
  for (const market of ["EURUSD", "XAUUSD", "BTCUSD", "NAS100"]) {
    const row = summary.markets[market];
    lines.push(
      `${market} present ${row.present} · scored ${row.scored} · flat ${row.flat} · no_call ${row.no_call} · no_outcome ${row.no_outcome}`
    );
  }
  return lines;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log("node scripts/build_h1_population.js [--out <file>] [--check] [--quiet]");
    return 0;
  }
  const { summary, target } = build({ out: args.out });
  const relative = path.relative(ROOT, target).replace(/\\/g, "/");
  if (args.check) {
    const file = path.join(ROOT, args.out);
    if (!fs.existsSync(file)) {
      console.error(`${relative} is missing; run node scripts/build_h1_population.js`);
      return 1;
    }
    const committed = fs.readFileSync(file, "utf8");
    const fresh = `${JSON.stringify(summary, null, 2)}\n`;
    if (committed !== fresh) {
      console.error(`${relative} is stale; run node scripts/build_h1_population.js`);
      return 1;
    }
    console.log(`${relative} is current`);
    return 0;
  }
  if (!args.quiet) {
    for (const line of summaryLines(summary)) console.log(line);
    console.log(`wrote ${relative}`);
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

module.exports = { OUT_PATH, parseArgs, build, summaryLines, main };
