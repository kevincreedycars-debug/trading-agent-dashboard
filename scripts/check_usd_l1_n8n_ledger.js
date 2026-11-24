#!/usr/bin/env node
"use strict";

/**
 * Re-merge every committed record capture and compare the result with the ledger (research only).
 *
 * The capture directory also holds one technical-failure transcript (an invalid date). That is an attempt,
 * not a record ingest, so it is excluded here and stays in the ledger's `attempts` list.
 *
 * The ledger is evidence from the dataset those runs actually fetched, not from whatever `run-v1.json` says
 * today. On 2026-11-23 the artefact gained the market x test matrix and was republished, and the v1 build was
 * preserved byte for byte at `run-v1-superseded-20261114.json`. Verifying against the current file would
 * recompute every record's configuration digest and re-date the evidence, so the check is pinned to the
 * preserved dataset. New runs are persisted against the current file by `persist_usd_l1_n8n_runs.js`, which
 * keeps its own default; only this re-merge of old captures is pinned.
 */

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const N8N = path.join(ROOT, "data", "usd-layer1-backtester", "n8n");
const LEDGER_DATASET = path.join(ROOT, "data", "usd-layer1-backtester", "run-v1-superseded-20261114.json");

const captures = fs.readdirSync(N8N)
  .filter((name) => /^(sweep|batch)-.*\.json$/.test(name))
  .filter((name) => !name.includes("invalid-date"))
  .sort();

// One re-merge of every capture. `persist_usd_l1_n8n_runs.js` verifies each capture against the dataset it
// recorded fetching - the current artefact for a capture of this build, the preserved v1 file for an older
// one - so the ledger is reproducible from the committed captures in a single command.
const args = [path.join(ROOT, "scripts", "persist_usd_l1_n8n_runs.js")];
for (const name of captures) args.push("--capture", path.join(N8N, name));
args.push("--check");

const result = childProcess.spawnSync(process.execPath, args, { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status === null ? 1 : result.status);
