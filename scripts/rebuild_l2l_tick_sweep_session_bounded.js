#!/usr/bin/env node
"use strict";

/**
 * Rebuild the L2L tick sweep inside the corrected 05:00 London session (research only).
 *
 *   node scripts/rebuild_l2l_tick_sweep_session_bounded.js
 *   node scripts/rebuild_l2l_tick_sweep_session_bounded.js --check
 *
 * The published sweep walked one continuous tape, so limits survived the session that placed them and
 * positions were carried past the following 05:00 London. `l2l-tick-sweep-v2.json` keeps v1's decisions
 * and re-prices them inside their own session; this script produces it, and `--check` proves the committed
 * file still follows from the committed v1 plus the local tapes.
 *
 * What this script will not do is pretend the correction is free: it prints what moved (cancelled fills,
 * endpoint closes, accounts whose balance changed) so the change can be read as a measurement rather than
 * a tidy-up. It refuses to write if v1 itself cannot be reproduced from its own audit.
 *
 * The tapes are local evidence and are not in the repository; each one's hash, window and endpoint close
 * are copied into the artefact so the endpoint prices can be audited without them.
 *
 * This script reads files only. It never calls a broker, never places an order and never touches a
 * production path.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const bounds = require("../backtester/lib/usd_layer1_backtester/tick_sweep_bounds");

const ROOT = path.resolve(__dirname, "..");
const V1_PATH = "data/usd-layer1-backtester/l2l-tick-sweep-v1.json";
const V2_PATH = "data/usd-layer1-backtester/l2l-tick-sweep-v2.json";
const RECORD_PATH = "data/usd-layer1-backtester/l2l-tick-sweep-v1-supersession.json";
const DEFAULT_TAPE_ROOT = ".local/tmp/l2l-ticks-sweep";

function parseArgs(argv) {
  const args = { check: false, tapeRoot: DEFAULT_TAPE_ROOT, out: V2_PATH };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--check") args.check = true;
    else if (token === "--tape-root") args.tapeRoot = argv[(index += 1)];
    else if (token === "--out") args.out = argv[(index += 1)];
    else throw new Error(`unknown argument ${token}`);
  }
  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function display(relative) {
  return relative.split(path.sep).join("/");
}

/** The record a reader opens first: what replaced what, why, and what moved. */
function buildRecord({ sweep, v2, v1Buf, v2Buf, tapeRoot }) {
  const movedAccounts = v2.accounts
    .map((account) => {
      const prior = (sweep.accounts || []).find((row) => row.symbol === account.symbol && row.account === account.account);
      if (!prior || Math.abs(prior.ending_balance - account.ending_balance) <= 0.005) return null;
      return {
        symbol: account.symbol,
        account: account.account,
        ending_balance_v1: prior.ending_balance,
        ending_balance_v2: account.ending_balance,
        delta: Math.round((account.ending_balance - prior.ending_balance) * 100) / 100
      };
    })
    .filter(Boolean);

  const perSymbol = v2.per_symbol.map((block) => {
    const sum = (pick) => block.models.reduce((total, model) => total + pick(model.geometries.full) + pick(model.geometries.half), 0);
    return {
      symbol: block.symbol,
      sessions: block.usable_sessions.length,
      fills: sum((geometry) => geometry.fills),
      session_end_closes: sum((geometry) => geometry.session_end || 0),
      cancelled_at_session_end: sum((geometry) => geometry.cancelled_at_session_end || 0),
      r_gross: Math.round(sum((geometry) => geometry.r_gross) * 10000) / 10000,
      sessions_with_a_cancelled_fill: block.sessions_with_a_cancelled_fill
    };
  });

  return {
    schema_version: "l2l-tick-sweep-supersession-v1",
    created_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    superseded: {
      schema: sweep.schema,
      path: V1_PATH,
      bytes: v1Buf.length,
      sha256: sha256(v1Buf),
      generated_at_utc: sweep.generated_at_utc,
      sessions_streamed: sweep.totals.sessions_streamed,
      totals: {
        fills: sweep.totals.fills,
        targets: sweep.totals.targets,
        stops: sweep.totals.stops,
        working: sweep.totals.working
      }
    },
    current: {
      schema: v2.schema,
      path: V2_PATH,
      bytes: v2Buf.length,
      sha256: sha256(v2Buf),
      generated_at_utc: v2.generated_at_utc,
      totals: {
        fills: v2.totals.fills,
        targets: v2.totals.targets,
        stops: v2.totals.stops,
        session_end: v2.totals.session_end,
        working: v2.totals.working,
        fills_cancelled_at_session_end: v2.totals.fills_cancelled_at_session_end
      },
      moved: v2.horizon.moved
    },
    why_a_new_version_instead_of_an_edit:
      "v1 is the record of what the lane measured on 2026-11-12 and is kept byte for byte. v2 changes exactly one " +
      "thing - the horizon each recorded decision is priced inside - so the two files can be compared and the " +
      "correction audited. Editing v1 in place would have removed the evidence of what the earlier figure rested on.",
    what_changed: [
      "a fill stamped outside the 05:00-to-05:00 window of its own session is cancelled at that endpoint and reported as cancelled_at_session_end; it is not counted as a trade",
      "a position with no exit inside its window is closed at the last M5 bar inside it, on the side of the book that would have paid it, and its exit reason becomes session_end",
      "every other trade keeps the price, the instant and the R it was recorded with",
      "totals carry session_end and fills_cancelled_at_session_end beside targets and stops, so no exit reason hides inside another",
      "each symbol block and account carries its own count of cancelled fills and endpoint closes",
      "the artefact carries the session window, tape hash, bar count and endpoint close for every session it priced"
    ],
    what_did_not_change: {
      decisions:
        "the ladder, the calls, the level that triggered each order, the order's entry, stop and target, and the set of fills v1 recorded",
      sizing: "one percent of the running balance risked per fill, lots rounded down to the instrument's own step",
      tapes: "the same six sessions per market, streamed 05:00 London to 05:00 London",
      bars_check: sweep.bars_check,
      per_symbol: perSymbol
    },
    accounts_whose_balance_moved: movedAccounts,
    deliberately_not_done: [
      "no decision was re-derived: a slot freed by an earlier 05:00 close was not re-filled, because v1 recorded only the orders that filled",
      "no new session was streamed and no market was added; the tapes are the ones v1 already used",
      "the tapes remain local evidence: the artefact carries their hashes and endpoint closes, not their bytes",
      "nothing here is claimed as predictive advantage: this is a correction to how an existing measurement was priced"
    ],
    reproduction: {
      command: "node scripts/rebuild_l2l_tick_sweep_session_bounded.js --check",
      tape_root: display(tapeRoot),
      rule:
        "v1 is reproduced from its own audit before any bound is applied; a reproduction that misses v1's totals, accounts or model summaries refuses to write"
    }
  };
}

/** Compare a freshly built artefact with the committed one, ignoring only the stamps that move with the clock. */
function difference(committed, rebuilt) {
  const strip = (value) => {
    const copy = JSON.parse(JSON.stringify(value));
    delete copy.generated_at_utc;
    delete copy.created_at;
    return JSON.stringify(copy);
  };
  if (strip(committed) === strip(rebuilt)) return null;
  const left = strip(committed);
  const right = strip(rebuilt);
  let index = 0;
  while (index < left.length && index < right.length && left[index] === right[index]) index += 1;
  return `the committed file differs from the rebuild at character ${index}: committed ${JSON.stringify(
    left.slice(index, index + 120)
  )} vs rebuilt ${JSON.stringify(right.slice(index, index + 120))}`;
}

function main(argv) {
  const args = parseArgs(argv);
  const tapeRoot = path.resolve(ROOT, args.tapeRoot);
  const v1File = path.resolve(ROOT, V1_PATH);
  if (!fs.existsSync(v1File)) throw new Error(`the superseded sweep is missing: ${V1_PATH}`);
  const v1Buf = fs.readFileSync(v1File);
  const sweep = readJson(v1File);
  const tapes = bounds.loadTapes({ sweep, tapeRoot });
  const rebuilt = bounds.buildSweepV2({
    sweep,
    tapes,
    v1Sha256: sha256(v1Buf),
    source: V1_PATH
  });
  const v2Text = `${JSON.stringify(rebuilt, null, 1)}\n`;
  const v2Buf = Buffer.from(v2Text, "utf8");
  const record = buildRecord({ sweep, v2: rebuilt, v1Buf, v2Buf, tapeRoot });

  const summary = {
    action: args.check ? "check" : "write",
    sessions_priced: rebuilt.horizon.sessions.length,
    v1_totals: { fills: sweep.totals.fills, targets: sweep.totals.targets, stops: sweep.totals.stops, working: sweep.totals.working },
    v2_totals: {
      fills: rebuilt.totals.fills,
      targets: rebuilt.totals.targets,
      stops: rebuilt.totals.stops,
      session_end: rebuilt.totals.session_end,
      working: rebuilt.totals.working,
      cancelled_at_session_end: rebuilt.totals.fills_cancelled_at_session_end
    },
    moved: rebuilt.horizon.moved,
    accounts_moved: record.accounts_whose_balance_moved.length,
    v2_bytes: v2Buf.length,
    v2_sha256: sha256(v2Buf)
  };

  if (args.check) {
    const v2File = path.resolve(ROOT, V2_PATH);
    const recordFile = path.resolve(ROOT, RECORD_PATH);
    if (!fs.existsSync(v2File)) throw new Error(`${V2_PATH} does not exist; run the script without --check first`);
    const committedBuf = fs.readFileSync(v2File);
    const committed = readJson(v2File);
    const drift = difference(committed, rebuilt);
    if (drift) throw new Error(drift);
    if (!fs.existsSync(recordFile)) throw new Error(`${RECORD_PATH} is missing`);
    const committedRecord = readJson(recordFile);
    // The record's own hash and byte count describe the committed file, which carries its own run stamp, so
    // they are checked against that file rather than against the rebuild.
    if (committedRecord.current.sha256 !== sha256(committedBuf)) {
      throw new Error(`the record's current.sha256 does not match ${V2_PATH}`);
    }
    if (committedRecord.current.bytes !== committedBuf.length) {
      throw new Error(`the record's current.bytes does not match ${V2_PATH}`);
    }
    const withoutVolatile = (record) => {
      const copy = JSON.parse(JSON.stringify(record));
      delete copy.created_at;
      delete copy.current.generated_at_utc;
      delete copy.current.sha256;
      delete copy.current.bytes;
      return JSON.stringify(copy);
    };
    if (withoutVolatile(committedRecord) !== withoutVolatile(record)) {
      throw new Error("the supersession record no longer follows from the sweep it describes");
    }
    console.log(
      JSON.stringify(
        {
          ...summary,
          verdict: "the committed sweep and its supersession record follow from v1 and the local tapes",
          v2_sha256: sha256(committedBuf)
        },
        null,
        1
      )
    );
    return;
  }

  fs.writeFileSync(path.resolve(ROOT, args.out), v2Text, "utf8");
  fs.writeFileSync(path.resolve(ROOT, RECORD_PATH), `${JSON.stringify(record, null, 1)}\n`, "utf8");
  console.log(JSON.stringify(summary, null, 1));
}

if (require.main === module) {
  try {
    main(process.argv);
  } catch (error) {
    console.error(String(error && error.message ? error.message : error));
    process.exit(1);
  }
}

module.exports = { parseArgs, buildRecord, difference, main, V1_PATH, V2_PATH, RECORD_PATH };
