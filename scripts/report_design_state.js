#!/usr/bin/env node
"use strict";

/**
 * Write the design lane's one-line monitor record.
 *
 *   node scripts/report_design_state.js --state working --task "integrating the v2 control room"
 *   node scripts/report_design_state.js --check
 *
 * Why this exists: the design lane's brief named `monitor-state.js`, which is not in this
 * repository and never was. The record it was meant to write does exist - every lane writes
 * `.local/orchestration/activity/<worker>.json` - so this script writes that same record, in the
 * same shape, atomically, and refuses anything it cannot represent honestly.
 *
 * It is local state only (`.local` is gitignored). It never edits a page, an artefact, a workflow,
 * a mailbox submission or a trading path.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const ACTIVITY_DIR = path.join(ROOT, ".local", "orchestration", "activity");
const WORKER = "dashboard-design";
const ASSIGNMENT = "dashboard-design-001";
const STATES = new Set(["working", "paused", "blocked", "finished"]);
const MAX_TASK = 500;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function parse(argv) {
  const args = { state: null, task: null, check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--check") args.check = true;
    else if (token === "--state") args.state = argv[++index] || null;
    else if (token === "--task") args.task = argv[++index] || null;
    else fail(`unknown argument: ${token}`);
  }
  return args;
}

function reportPath() {
  return path.join(ACTIVITY_DIR, `${WORKER}.json`);
}

function write(record) {
  fs.mkdirSync(ACTIVITY_DIR, { recursive: true });
  const bytes = `${JSON.stringify(record, null, 2)}\n`;
  const temporary = path.join(ACTIVITY_DIR, `.${crypto.randomUUID()}.tmp`);
  fs.writeFileSync(temporary, bytes, { flag: "wx" });
  try {
    fs.renameSync(temporary, reportPath());
  } catch (error) {
    fs.unlinkSync(temporary);
    throw error;
  }
  return bytes;
}

function main(argv) {
  const args = parse(argv);
  if (args.check) {
    const file = reportPath();
    if (!fs.existsSync(file)) fail(`no record at ${path.relative(ROOT, file)}`);
    process.stdout.write(fs.readFileSync(file, "utf8"));
    return 0;
  }
  if (!args.state || !STATES.has(args.state)) {
    fail(`--state must be one of ${Array.from(STATES).join(", ")}`);
  }
  const task = String(args.task || "").replace(/\s+/g, " ").trim();
  if (!task) fail("--task must say what the lane is doing, in one line");
  if (task.length > MAX_TASK) fail(`--task must be at most ${MAX_TASK} characters`);
  const record = {
    worker_id: WORKER,
    assignment_id: ASSIGNMENT,
    state: args.state,
    task,
    updated_at: new Date().toISOString()
  };
  const bytes = write(record);
  process.stdout.write(`wrote ${path.relative(ROOT, reportPath())} (${Buffer.byteLength(bytes)} bytes)\n`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { parse, write, reportPath, WORKER, ASSIGNMENT, STATES };
