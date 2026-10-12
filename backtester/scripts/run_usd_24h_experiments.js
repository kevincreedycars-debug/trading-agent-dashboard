#!/usr/bin/env node
"use strict";

/**
 * Runs the declared USD 24-hour experiment search space against the cached dataset and writes the
 * full registry of every configuration attempted, with per-period metrics.
 *
 * Usage:
 *   node backtester/scripts/run_usd_24h_experiments.js [--dataset=PATH] [--out=PATH] [--workers=N]
 *
 * The registry keeps every attempted configuration, including the ones that lose, so the selection
 * step can be audited rather than trusted.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { parseArgs } = require("../lib/historical_common");
const { sha256 } = require("../lib/usd24h/acquire");
const { buildSearchSpace, loadDataset, runExperiments } = require("../lib/usd24h/experiments");
const { PERIOD_ORDER, SPLITS } = require("../lib/usd24h/splits");

const DEFAULT_DATASET = path.resolve(__dirname, "../../data/usd-24h-research-dataset.json");
const DEFAULT_OUT = path.resolve(__dirname, "../../data/usd-24h-experiment-registry.json");

function rankForPeriod(result, period) {
  const metrics = result.metrics[period];
  return metrics.ex_flat_accuracy_ci_95?.low ?? -1;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const datasetPath = args.dataset ? path.resolve(args.dataset) : DEFAULT_DATASET;
  const outPath = args.out ? path.resolve(args.out) : DEFAULT_OUT;
  const workers = args.workers ? Number(args.workers) : Math.max(1, Math.min(4, os.cpus().length - 1));

  const dataset = loadDataset(datasetPath);
  const configs = buildSearchSpace();
  const { results, worker_count: workerCount, duration_ms: durationMs } = await runExperiments(configs, { datasetPath, workers });

  const ranked = {};
  for (const period of PERIOD_ORDER) {
    ranked[period] = results
      .map((result) => ({ config_id: result.config_id, stage: result.stage, rank_value: rankForPeriod(result, period) }))
      .sort((left, right) => right.rank_value - left.rank_value)
      .slice(0, 10);
  }

  const registry = {
    schema_version: "usd-24h-experiment-registry-v1",
    generated_at: new Date().toISOString(),
    dataset_path: path.relative(path.resolve(__dirname, "../.."), datasetPath).replace(/\\/g, "/"),
    dataset_sha256: sha256(fs.readFileSync(datasetPath, "utf8")),
    rows: dataset.rows.length,
    splits: SPLITS,
    worker_count: workerCount,
    duration_ms: durationMs,
    configurations_attempted: results.length,
    stages: Array.from(new Set(results.map((result) => result.stage))),
    leakage_notes: [
      "Rule thresholds and weights are declared, or fitted on development rows only.",
      "The challenger is fitted on development rows only and its threshold variant is tuned on development rows only.",
      "Validation and holdout metrics are produced from the same frozen configuration list, so they are comparable but not independent of the search."
    ],
    top_10_by_validation_lower_bound: ranked.validation,
    results
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

  process.stdout.write(`configurations=${results.length} workers=${workerCount} duration_ms=${durationMs}\n`);
  for (const entry of ranked.validation.slice(0, 5)) {
    process.stdout.write(`  validation ${entry.config_id} lower_bound=${entry.rank_value}\n`);
  }
  process.stdout.write(`registry: ${outPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
