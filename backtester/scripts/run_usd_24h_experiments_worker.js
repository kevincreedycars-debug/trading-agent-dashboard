#!/usr/bin/env node
"use strict";

/**
 * Experiment worker: scores a chunk of configurations against one cached dataset.
 *
 * Usage (called by the runner, not by hand):
 *   node backtester/scripts/run_usd_24h_experiments_worker.js DATASET.json CONFIGS.json OUT.json
 */

const fs = require("node:fs");

const { runConfig } = require("../lib/usd24h/experiments");

function main() {
  const [datasetPath, configsPath, outPath] = process.argv.slice(2);
  if (!datasetPath || !configsPath || !outPath) {
    throw new Error("Usage: run_usd_24h_experiments_worker.js DATASET.json CONFIGS.json OUT.json");
  }
  const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf8"));
  const configs = JSON.parse(fs.readFileSync(configsPath, "utf8"));
  const results = configs.map((config) => runConfig(config, dataset));
  fs.writeFileSync(outPath, `${JSON.stringify(results)}\n`, "utf8");
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
}
