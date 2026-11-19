// Builds `data/live-ctrader-copier.json` from the three files the trading host already holds: the copier's
// health file, its mapping store, and one read of the cTrader account (written by copier-snapshot.js through
// the relay's own adapter). It reads files and writes one file; it opens no broker connection and calls no
// order function.
//
//   node scripts/build-live-ctrader-copier.js --snapshot ...\snapshot.json --health ...\health.json \
//     --state ...\mappings.json --symbol-map ...\symbols.json --out ...\dashboard.json
//
// A document that fails scripts/validate_live_ctrader_copier.js is not written at all, and the exit code says
// so: a caller that publishes whatever it finds would otherwise put an incomplete page live.
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const lib = require("../lib/live_ctrader_copier.js");
const { validateLiveCtraderCopier } = require("./validate_live_ctrader_copier.js");

const USAGE = [
  "Usage: node scripts/build-live-ctrader-copier.js --snapshot <file> --out <file> [options]",
  "",
  "  --health <file>             the copier's last health file (optional)",
  "  --state <file>              the copier's mapping store (optional)",
  "  --snapshot <file>           the destination account read (required)",
  "  --symbol-map <file>         JSON: {\"map\": {\"US100.cash\": \"<cTrader name>\", ...}} (optional)",
  "  --setup-tests <file>        JSON: {\"position_ids\": [\"...\"]} of standalone test closes (optional)",
  "  --out <file>                where the document is written (required)",
  "  --lane <id> --lane-label <text> --account-login-masked <text> --account-server <text>",
  "  --login <n> --probe <path>  destination login and the source probe path, as stated on the page",
  "  --window-days <n>           closed-trade window the snapshot was read over (default 30)",
  "  --stale-seconds <n>         how long the published document stays fresh (default 1800)",
  "  --heartbeat-stale-seconds <n>  how old the last poll may be (default 1500)",
  "  --schedule-cadence-seconds <n>  the copier task's cadence (default 60)",
  "  --now <iso>                 build time, for a test or a rebuild",
  "  --json                      print one JSON line instead of a sentence",
  "",
  "  Exit 0 when the document is written, 2 when an input is missing or the document fails validation."
].join("\n");

function parseArgs(argv) {
  const options = {
    lane: "ftmo-1",
    laneLabel: "FTMO account 1",
    accountLoginMasked: null,
    accountServer: null,
    login: null,
    probe: null,
    windowDays: lib.DEFAULT_WINDOW_DAYS,
    staleSeconds: lib.DOCUMENT_STALE_AFTER_SECONDS,
    heartbeatStaleSeconds: lib.HEARTBEAT_STALE_AFTER_SECONDS,
    cadenceSeconds: 60,
    json: false,
    help: false
  };
  const queue = argv.slice();
  const take = () => (queue.length ? queue.shift() : null);
  while (queue.length) {
    const arg = queue.shift();
    const value = () => take();
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--health") options.health = value();
    else if (arg === "--state") options.state = value();
    else if (arg === "--snapshot") options.snapshot = value();
    else if (arg === "--symbol-map") options.symbolMap = value();
    else if (arg === "--setup-tests") options.setupTests = value();
    else if (arg === "--out") options.out = value();
    else if (arg === "--lane") options.lane = value();
    else if (arg === "--lane-label") options.laneLabel = value();
    else if (arg === "--account-login-masked") options.accountLoginMasked = value();
    else if (arg === "--account-server") options.accountServer = value();
    else if (arg === "--login") options.login = Number(value());
    else if (arg === "--probe") options.probe = value();
    else if (arg === "--window-days") options.windowDays = Number(value());
    else if (arg === "--stale-seconds") options.staleSeconds = Number(value());
    else if (arg === "--heartbeat-stale-seconds") options.heartbeatStaleSeconds = Number(value());
    else if (arg === "--schedule-cadence-seconds") options.cadenceSeconds = Number(value());
    else if (arg === "--now") options.now = value();
    else throw Object.assign(new Error(`unknown argument ${arg}`), { code: "argument_unknown" });
  }
  return options;
}

function readJsonFile(file, { required = true } = {}) {
  if (!file) {
    if (required) throw Object.assign(new Error("a required input file was not named"), { code: "input_missing" });
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT" && !required) return null;
    throw Object.assign(new Error(`${file}: ${error.message}`), { code: "input_unreadable" });
  }
}

function buildFromFiles(options, { now = new Date() } = {}) {
  const snapshot = readJsonFile(options.snapshot);
  const health = readJsonFile(options.health, { required: false });
  const state = readJsonFile(options.state, { required: false });
  const mapFile = readJsonFile(options.symbolMap, { required: false });
  const setupFile = readJsonFile(options.setupTests, { required: false });
  const symbolMap = mapFile && mapFile.map && typeof mapFile.map === "object" ? mapFile.map : (mapFile || undefined);
  const setupTestIds = Array.isArray(setupFile)
    ? setupFile
    : setupFile && Array.isArray(setupFile.position_ids) ? setupFile.position_ids : [];
  return lib.buildDocument({
    health,
    state,
    snapshot,
    now,
    config: {
      lane: options.lane,
      laneLabel: options.laneLabel,
      accountLoginMasked: options.accountLoginMasked,
      accountServer: options.accountServer,
      login: options.login,
      probe: options.probe,
      windowDays: options.windowDays,
      documentStaleAfterSeconds: options.staleSeconds,
      heartbeatStaleAfterSeconds: options.heartbeatStaleSeconds,
      symbolMap,
      setupTestIds,
      schedule: {
        cadence_seconds: options.cadenceSeconds,
        description: `one --once poll every ${options.cadenceSeconds}s, run by Task Scheduler`,
        overlap_prevention: "the copier's own lock file plus Task Scheduler's IgnoreNew policy",
        restart_recovery: "a lock left by a dead pid is taken over on the next run; the mapping store is the dedupe key"
      }
    }
  });
}

function writeAtomically(file, value) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, file);
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  if (!options.snapshot) throw Object.assign(new Error("--snapshot is required"), { code: "snapshot_missing" });
  if (!options.out) throw Object.assign(new Error("--out is required"), { code: "out_missing" });
  const now = options.now ? new Date(options.now) : new Date();
  const document = buildFromFiles(options, { now });
  const problems = validateLiveCtraderCopier(document);
  if (problems.length) {
    if (options.json) process.stdout.write(`${JSON.stringify({ ok: false, problems })}\n`);
    else process.stdout.write(`refused: ${problems.length} problem(s): ${problems.slice(0, 5).join("; ")}\n`);
    return 2;
  }
  writeAtomically(options.out, document);
  const summary = {
    ok: true,
    out: options.out,
    generated_at_utc: document.generated_at_utc,
    open_positions: document.account.open_positions,
    mappings: document.mappings.length,
    differences: document.differences.count,
    closed_trades: document.account.closed_trades,
    heartbeat: document.copier.heartbeat.state
  };
  process.stdout.write(options.json ? `${JSON.stringify(summary)}\n` : `wrote ${options.out}: ${summary.mappings} mapping(s), ${summary.differences} difference(s)\n`);
  return 0;
}

module.exports = { parseArgs, buildFromFiles, writeAtomically, USAGE };

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`failed: ${error.code || "error"}: ${error.message}\n`);
    process.exitCode = error.code === "input_unreadable" || error.code === "input_missing" ? 2 : 1;
  }
}

