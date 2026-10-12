#!/usr/bin/env node
"use strict";

/**
 * Builds the baseline comparison: the engine as deployed, the engine replayed on identical as-of
 * observations, the simple majority and momentum benchmarks, and the best arms from the experiment
 * registry, all scored on exactly the same rows and periods.
 *
 * Usage:
 *   node backtester/scripts/build_usd_24h_baseline_comparison.js [--dataset=PATH] [--registry=PATH] [--out=PATH]
 */

const fs = require("node:fs");
const path = require("node:path");

const { parseArgs } = require("../lib/historical_common");
const { sha256 } = require("../lib/usd24h/acquire");
const { archiveEngineCalls, archiveFactorParity, engineReplayedCalls } = require("../lib/usd24h/engine_arm");
const { loadDataset } = require("../lib/usd24h/experiments");
const { scoreArm } = require("../lib/usd24h/metrics");
const { PERIOD_ORDER, SPLITS, rowsInPeriod } = require("../lib/usd24h/splits");

const DEFAULT_DATASET = path.resolve(__dirname, "../../data/usd-24h-research-dataset.json");
const DEFAULT_REGISTRY = path.resolve(__dirname, "../../data/usd-24h-experiment-registry.json");
const DEFAULT_OUT = path.resolve(__dirname, "../../data/usd-24h-baseline-comparison.json");

const REGISTRY_ARMS = [
  "baseline_always_bullish",
  "baseline_momentum_usd_ret_1d",
  "baseline_momentum_usd_ret_5d",
  "baseline_contrarian_usd_ret_1d",
  "baseline_contrarian_usd_ret_5d",
  "composite_engine_aligned_weights",
  "composite_equal_weights",
  "challenger_logistic_l2_0.1",
  "single_rel_us_2y_chg5d",
  "single_risk_vix_level_haven",
  "single_xasset_gold_5d_inverse",
  "single_rel_us_de_2y_spread_chg5d"
];

function metricsForCalls(dataset, calls) {
  const metrics = {};
  for (const period of PERIOD_ORDER) {
    metrics[period] = scoreArm(rowsInPeriod(dataset.rows, period), calls);
  }
  return metrics;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const datasetPath = args.dataset ? path.resolve(args.dataset) : DEFAULT_DATASET;
  const registryPath = args.registry ? path.resolve(args.registry) : DEFAULT_REGISTRY;
  const outPath = args.out ? path.resolve(args.out) : DEFAULT_OUT;

  const dataset = loadDataset(datasetPath);
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

  const stored = archiveEngineCalls(dataset);
  const replayed = engineReplayedCalls(dataset);
  const factorParity = archiveFactorParity();

  const arms = {
    engine_stored_archive: {
      kind: "engine",
      source: "committed parity archive of the live workflow's stored calls",
      metrics: metricsForCalls(dataset, stored.calls)
    },
    engine_replayed_asof: {
      kind: "engine",
      source: "backtester/replay/usd/usd_replay_core.js on this dataset's as-of observations, with the event and Fed-bias families explicitly missing",
      blocked_input_days: replayed.blocked_input_days,
      logic_version: replayed.logic_version,
      metrics: metricsForCalls(dataset, replayed.calls)
    }
  };

  for (const id of REGISTRY_ARMS) {
    const result = registry.results.find((entry) => entry.config_id === id);
    if (!result) continue;
    arms[id] = {
      kind: result.kind,
      source: result.description,
      stage: result.stage,
      gates: result.gates,
      weights: result.weights,
      metrics: result.metrics
    };
  }

  const payload = {
    schema_version: "usd-24h-baseline-comparison-v1",
    generated_at: new Date().toISOString(),
    dataset_sha256: sha256(fs.readFileSync(datasetPath, "utf8")),
    registry_sha256: sha256(fs.readFileSync(registryPath, "utf8")),
    splits: SPLITS,
    parity: {
      dataset_vs_archive: stored.parity,
      factor_parity: factorParity
    },
    arms,
    notes: [
      "Every arm is scored on the same rows, the same flat band (0.1pp on the broad dollar index) and the same chronological periods.",
      "engine_stored_archive is the only arm that is a measurement of live behaviour; every other arm is a local computation.",
      "No arm in this file may be read as a trading edge: no spread, cost, fill or path evidence exists here."
    ]
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const line = (label, metrics) => {
    const parts = PERIOD_ORDER.map((period) => {
      const m = metrics[period];
      return `${period}: n=${m.directional_calls} acc=${m.ex_flat_accuracy_pct} [${m.ex_flat_accuracy_ci_95.low},${m.ex_flat_accuracy_ci_95.high}]`;
    });
    process.stdout.write(`${label.padEnd(34)} ${parts.join(" | ")}\n`);
  };
  for (const [id, arm] of Object.entries(arms)) line(id, arm.metrics);
  process.stdout.write(`matched_archive_rows=${stored.parity.matched_rows} open_exact=${stored.parity.open_price_exact_matches}\n`);
  process.stdout.write(`comparison: ${outPath}\n`);
}

main();
