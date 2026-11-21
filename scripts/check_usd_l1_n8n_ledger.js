#!/usr/bin/env node
"use strict";

/**
 * Re-merge every committed record capture and compare the result with the ledger (research only).
 *
 * The capture directory also holds one technical-failure transcript (an invalid date). That is an attempt,
 * not a record ingest, so it is excluded here and stays in the ledger's `attempts` list.
 */

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const N8N = path.join(ROOT, "data", "usd-layer1-backtester", "n8n");

const captures = fs.readdirSync(N8N)
  .filter((name) => /^(sweep|batch)-.*\.json$/.test(name))
  .filter((name) => !name.includes("invalid-date"))
  .sort();

const args = [path.join(ROOT, "scripts", "persist_usd_l1_n8n_runs.js")];
for (const name of captures) args.push("--capture", path.join(N8N, name));
args.push("--check");

const result = childProcess.spawnSync(process.execPath, args, { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status === null ? 1 : result.status);
