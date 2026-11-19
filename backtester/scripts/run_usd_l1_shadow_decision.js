"use strict";

/**
 * One shadow morning for the USD Layer 1 engine (research only).
 *
 * The n8n workflow calls this after the 05:00 London collection has been sealed. It verifies the seal, reads the
 * readings and votes the collector staged, and asks `engine_v1.decide` for the answer - the same function the
 * backtester calls. Nothing here writes to the warehouse, the dashboard or `data/`: the record goes to stdout and
 * the exit code is non-zero unless the morning was `allowed`, so the workflow cannot mistake a refusal for a call.
 *
 * The sealed payloads themselves are raw provider bytes. Turning them into book inputs is the collector's job and
 * is not reimplemented here: a seal without a `readings` block is reported as an unstaged morning, which the
 * engine blocks by construction rather than filling in.
 *
 * Usage:
 *   node backtester/scripts/run_usd_l1_shadow_decision.js --sealed <sealed.json> [--votes <votes.json>]
 */

const fs = require("node:fs");
const path = require("node:path");

const engine = require("../lib/usd_layer1_backtester/engine_v1");
const collection = require("../lib/usd_layer1_backtester/collection");

const ROOT = path.join(__dirname, "..", "..");
const DEFAULT_DIR = path.join(ROOT, "backtester", "tmp", "usd-session-collections");

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function londonToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, filePath), "utf8"));
}

function defaultSealedPath(date) {
  return path.join(DEFAULT_DIR, `${date}.json`);
}

/** The session shape the engine reads, assembled only from what the sealed snapshot actually staged. */
function sessionFrom(sealed) {
  const readings = sealed && sealed.readings ? sealed.readings : null;
  return {
    date: sealed.session_date,
    cutoff_at_utc: sealed.cutoff_at_utc,
    inputs: (readings && readings.values) || {},
    saved_inputs: {},
    audit_values: {},
    input_meta: (readings && readings.input_meta) || []
  };
}

function run(args = {}, options = {}) {
  const today = options.today || londonToday();
  const sealedPath = args.sealed && args.sealed !== true ? String(args.sealed) : defaultSealedPath(today);
  if (!fs.existsSync(path.resolve(ROOT, sealedPath)) && !fs.existsSync(sealedPath)) {
    return {
      status: "no_seal",
      date: today,
      reason: `no sealed collection at ${path.relative(ROOT, sealedPath)}, so there is nothing to decide`,
      decision: null
    };
  }
  const filePath = fs.existsSync(sealedPath) ? sealedPath : path.resolve(ROOT, sealedPath);
  const sealed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const seal = collection.verify(sealed);
  const votes = args.votes && args.votes !== true ? readJson(String(args.votes)) : sealed.votes || {};
  const session = sessionFrom(sealed);
  const decided = engine.decide({
    date: sealed.session_date,
    cutoff_at_utc: sealed.cutoff_at_utc,
    session,
    votes,
    gateOpen: sealed.gate ? sealed.gate.open === true : null,
    gateStatus: sealed.gate ? sealed.gate.status || null : "undefined",
    events: sealed.events || {},
    calendar_staged: sealed.calendar_staged === true,
    source: "shadow"
  });
  return {
    status: seal.ok && decided.outcome === engine.OUTCOMES.ALLOWED ? "allowed" : "refused",
    date: sealed.session_date,
    sealed_at_utc: sealed.sealed_at_utc || null,
    seal,
    staged: {
      readings: Object.keys(session.inputs).length,
      print_stamps: session.input_meta.length,
      votes: Object.keys(votes).length
    },
    engine_version: engine.VERSION,
    book_version: engine.BOOK_VERSION,
    reason: seal.ok
      ? decided.outcome === engine.OUTCOMES.ALLOWED
        ? `${decided.direction} band ${decided.band}`
        : `engine ${decided.outcome}: ${decided.fired_rules.map((rule) => rule.rule_id).join(", ") || "no rule fired"}`
      : `seal not usable: ${seal.late_items.length} late items, status ${seal.status}`,
    decision: decided
  };
}

if (require.main === module) {
  const args = parseArgs(process.argv);
  const record = run(args);
  const { decision, ...headline } = record;
  console.log(JSON.stringify(decision ? { ...headline, outcome: decision.outcome, direction: decision.direction, band: decision.band, trade: decision.trade, fired_rules: decision.fired_rules } : headline, null, 2));
  if (record.status !== "allowed") process.exitCode = 1;
}

module.exports = { ROOT, DEFAULT_DIR, parseArgs, londonToday, sessionFrom, run };
