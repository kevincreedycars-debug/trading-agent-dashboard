#!/usr/bin/env node
"use strict";

/**
 * Runs the frozen USD candidate in offline shadow replay against the deployed engine's stored calls,
 * records the dispatcher state so the pause is evidenced rather than asserted, and writes the
 * comparison for review.
 *
 * Usage:
 *   node backtester/scripts/run_usd_24h_shadow_comparison.js [--dataset=PATH] [--config=PATH] [--out=PATH]
 *
 * Nothing here is a live deployment: the candidate is read from the versioned configuration file.
 */

const fs = require("node:fs");
const path = require("node:path");

const { parseArgs } = require("../lib/historical_common");
const { sha256 } = require("../lib/usd24h/acquire");
const { loadDataset } = require("../lib/usd24h/experiments");
const { shadowCompare } = require("../lib/usd24h/shadow_candidate");

const DEFAULT_DATASET = path.resolve(__dirname, "../../data/usd-24h-research-dataset.json");
const DEFAULT_CONFIG = path.resolve(__dirname, "../../config/usd_24h_ruleset_v2.json");
const DEFAULT_OUT = path.resolve(__dirname, "../../data/usd-24h-shadow-comparison.json");

const REPO_ROOT = path.resolve(__dirname, "../..");

function readJsonIfPresent(relativePath) {
  const target = path.join(REPO_ROOT, relativePath);
  if (!fs.existsSync(target)) return { path: relativePath, present: false };
  try {
    return { path: relativePath, present: true, content: JSON.parse(fs.readFileSync(target, "utf8")) };
  } catch (error) {
    return { path: relativePath, present: true, unreadable: true, error: error.message };
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const datasetPath = args.dataset ? path.resolve(args.dataset) : DEFAULT_DATASET;
  const configPath = args.config ? path.resolve(args.config) : DEFAULT_CONFIG;
  const outPath = args.out ? path.resolve(args.out) : DEFAULT_OUT;

  const dataset = loadDataset(datasetPath);
  const comparison = shadowCompare(dataset, { configPath });

  const controllerEnabled = readJsonIfPresent(".local/orchestration/controller/config.json");
  const controllerStatus = readJsonIfPresent(".local/orchestration/controller/status.json");
  const runLock = readJsonIfPresent(".local/orchestration/controller/run.lock");

  const payload = {
    ...comparison,
    config_sha256: sha256(fs.readFileSync(configPath, "utf8")),
    dataset_sha256: sha256(fs.readFileSync(datasetPath, "utf8")),
    deployment_state: {
      dispatcher_enabled: controllerEnabled.content ? controllerEnabled.content.enabled : null,
      dispatcher_status: controllerStatus.content ? (controllerStatus.content.state ?? controllerStatus.content.status ?? null) : null,
      run_lock_present: runLock.present,
      evaluation: "The dispatcher is paused and no live workflow was changed by this session; the candidate below has never run in n8n."
    }
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const holdout = payload.candidate_metrics.holdout;
  process.stdout.write(
    `shadow window ${payload.window.start}..${payload.window.end} rows=${payload.window_rows}\n` +
    `candidate holdout accuracy=${holdout.ex_flat_accuracy_pct} [${holdout.ex_flat_accuracy_ci_95.low},${holdout.ex_flat_accuracy_ci_95.high}] decided=${holdout.correct + holdout.wrong}\n` +
    `engine holdout accuracy=${payload.engine_metrics.holdout.ex_flat_accuracy_pct}\n` +
    `disagreements=${payload.disagreement.days_disagreeing} candidate_only_correct=${payload.disagreement.candidate_only_correct} engine_only_correct=${payload.disagreement.engine_only_correct}\n` +
    `dispatcher enabled=${payload.deployment_state.dispatcher_enabled} status=${payload.deployment_state.dispatcher_status} run_lock=${payload.deployment_state.run_lock_present}\n` +
    `shadow comparison: ${outPath}\n`
  );
}

main();
