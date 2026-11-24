#!/usr/bin/env node
"use strict";

/**
 * Acquire the missing one-hour series for XAGUSD, WTIUSD and GBPUSD from OANDA (research only).
 *
 *   node scripts/acquire_oanda_h1_series.js [--from 2024-01-01] [--to 2026-11-24] [--check]
 *
 * The three markets the matrix reports as blocked are blocked on one dataset: no cached one-hour series
 * priced at both 05:00 London endpoints. EURUSD, XAUUSD and NAS100 already come from OANDA v20 candles, so
 * the same publisher is the approved source here rather than a new one.
 *
 * What this writes:
 *   * backtester/tmp/oanda_<market>_h1.csv  - the same schema the existing series use (instrument,
 *     timestamp, date, open, high, low, close, source, complete). That folder is gitignored: the rows are a
 *     licensed quote history kept locally, not redistributed in the repository.
 *   * data/usd-layer1-backtester/h1-v1/oanda-h1-acquisition-<stamp>.json - the provenance record: the exact
 *     request, the row counts, the file hashes, the 05:00 London boundary coverage against every session
 *     in the published artefact, the gaps, and the licence note. It is committed, so a reader can audit what
 *     was acquired without holding the data.
 *
 * It reads market data only. It never reads an account, never places or amends an order, and it refuses to
 * run without an explicit `--i-understand-this-is-read-only-market-data` acknowledgement.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data", "usd-layer1-backtester");
const OUT_DIR = path.join(ROOT, "backtester", "tmp");
const RECORD_DIR = path.join(DATA, "h1-v1");

/** market key -> the provider's instrument, and where the published matrix expects the file. */
const INSTRUMENTS = Object.freeze([
  { market: "XAGUSD", instrument: "XAG_USD", file: "oanda_xag_usd_h1.csv", broker_symbol: "XAGUSD" },
  { market: "WTIUSD", instrument: "WTICO_USD", file: "oanda_wti_usd_h1.csv", broker_symbol: "USOIL" },
  { market: "GBPUSD", instrument: "GBP_USD", file: "oanda_gbp_usd_h1.csv", broker_symbol: "GBPUSD" }
]);

const HOST = process.env.OANDA_HOST || "api-fxtrade.oanda.com";
const PAGE = 5000;

function parseArgs(argv) {
  const args = { from: "2024-01-01T00:00:00Z", to: null, check: false, acknowledge: false };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--from") args.from = `${argv[(index += 1)]}T00:00:00Z`;
    else if (token === "--to") args.to = `${argv[(index += 1)]}T00:00:00Z`;
    else if (token === "--check") args.check = true;
    else if (token === "--i-understand-this-is-read-only-market-data") args.acknowledge = true;
    else throw new Error(`unknown argument ${token}`);
  }
  if (!args.to) args.to = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  return args;
}

function secret(name) {
  return execFileSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(ROOT, "scripts/local-credentials/get-secret.ps1"), "-Name", name],
    { encoding: "utf8" }
  ).trim();
}

function get(url, token) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = https.get(
      { hostname: target.hostname, path: `${target.pathname}${target.search}`, headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if (response.statusCode !== 200) {
            reject(new Error(`GET ${target.pathname} -> ${response.statusCode}: ${text.slice(0, 300)}`));
            return;
          }
          resolve(JSON.parse(text));
        });
      }
    );
    request.on("error", reject);
    request.setTimeout(30000, () => request.destroy(new Error("request timed out")));
  });
}

/** The London date a UTC hour belongs to, in the 05:00-to-05:00 sense the workbook uses. */
function londonSessionDate(utcIso) {
  const stamp = Date.parse(utcIso);
  const probe = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date(stamp));
  const part = (type) => Number(probe.find((entry) => entry.type === type).value);
  const localMinutes = part("hour") * 60 + part("minute");
  const localDay = new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
  if (localMinutes < 5 * 60) localDay.setUTCDate(localDay.getUTCDate() - 1);
  return localDay.toISOString().slice(0, 10);
}

/** Page the candles endpoint until the requested window is covered. */
async function fetchCandles({ instrument, from, to, token }) {
  const candles = [];
  let cursor = from;
  for (let page = 0; page < 40; page += 1) {
    const url =
      `https://${HOST}/v3/instruments/${instrument}/candles?granularity=H1&price=M` +
      `&from=${encodeURIComponent(cursor)}&count=${PAGE}&includeFirst=true`;
    const response = await get(url, token);
    const batch = Array.isArray(response.candles) ? response.candles : [];
    if (!batch.length) break;
    for (const candle of batch) {
      if (!candle.complete || !candle.mid) continue;
      if (Date.parse(candle.time) >= Date.parse(to)) continue;
      candles.push(candle);
    }
    const lastStamp = batch[batch.length - 1].time;
    const lastMs = Date.parse(lastStamp) + 3600000;
    if (!Number.isFinite(lastMs) || lastMs >= Date.parse(to)) break;
    cursor = new Date(lastMs).toISOString().replace(/\.\d{3}Z$/, "Z");
  }
  return candles;
}

function toCsv({ instrument, candles }) {
  const lines = ["instrument,timestamp,date,open,high,low,close,source,complete"];
  const seen = new Set();
  for (const candle of candles) {
    const stamp = new Date(candle.time).toISOString().replace(/\.\d{3}Z$/, ".000000000Z");
    if (seen.has(stamp)) continue;
    seen.add(stamp);
    lines.push(
      [
        instrument,
        stamp,
        londonSessionDate(candle.time),
        candle.mid.o,
        candle.mid.h,
        candle.mid.l,
        candle.mid.c,
        "OANDA v20 candles",
        "true"
      ].join(",")
    );
  }
  return `${lines.join("\n")}\n`;
}

/** Both 05:00 London endpoints for every session the published artefact scores, per market. */
function boundaryCoverage({ timestamps, sessions }) {
  const second = (value) => {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z") : null;
  };
  const present = new Set(timestamps.map(second).filter(Boolean));
  let cutoffPresent = 0;
  let endpointPresent = 0;
  let both = 0;
  const missing = [];
  for (const session of sessions) {
    const cutoff = second(session.cutoff_at_utc);
    const endpoint = second(session.endpoint_at_utc);
    const hasCutoff = present.has(cutoff);
    const hasEndpoint = present.has(endpoint);
    if (hasCutoff) cutoffPresent += 1;
    if (hasEndpoint) endpointPresent += 1;
    if (hasCutoff && hasEndpoint) both += 1;
    else if (missing.length < 10) missing.push({ date: session.date, cutoff: hasCutoff, endpoint: hasEndpoint });
  }
  return {
    sessions: sessions.length,
    cutoff_present: cutoffPresent,
    endpoint_present: endpointPresent,
    both_present: both,
    first_missing: missing
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

async function main(argv) {
  const args = parseArgs(argv);
  if (!args.check && !args.acknowledge) {
    throw new Error(
      "refused: this script reads a live account's market data. Re-run with " +
        "--i-understand-this-is-read-only-market-data. It reads /v3/instruments/{instrument}/candles only."
    );
  }
  const run = readJson(path.join(DATA, "run-v1.json"));
  const sessions = (run.sessions || []).map((session) => ({
    date: session.date,
    cutoff_at_utc: session.cutoff_at_utc,
    endpoint_at_utc: session.endpoint_at_utc
  }));
  if (!sessions.length || !sessions[0].cutoff_at_utc) throw new Error("the run artefact carries no session boundaries");

  const stamp = args.to.replace(/\.\d{3}Z$/, "Z");
  const recordPath = path.join(RECORD_DIR, `oanda-h1-acquisition-${stamp.replace(/:/g, "-")}.json`);
  if (args.check) {
    const latestFile = path.join(RECORD_DIR, "oanda-h1-acquisition-latest.json");
    if (!fs.existsSync(latestFile)) throw new Error("no committed acquisition record to check");
    const latest = readJson(latestFile);
    const problems = [];
    for (const entry of latest.markets) {
      const csv = path.join(OUT_DIR, entry.file);
      if (!fs.existsSync(csv)) {
        problems.push(`${entry.file} is not present locally`);
        continue;
      }
      const hash = crypto.createHash("sha256").update(fs.readFileSync(csv)).digest("hex");
      if (hash !== entry.csv_sha256) problems.push(`${entry.file} hashes to ${hash}, the record says ${entry.csv_sha256}`);
    }
    console.log(
      JSON.stringify(
        {
          check: problems.length ? "drift" : "reproduces",
          problems,
          record: "data/usd-layer1-backtester/h1-v1/oanda-h1-acquisition-latest.json"
        },
        null,
        1
      )
    );
    if (problems.length) process.exitCode = 1;
    return;
  }

  const token = secret("OANDA_API_TOKEN");
  const markets = [];
  for (const entry of INSTRUMENTS) {
    const candles = await fetchCandles({ instrument: entry.instrument, from: args.from, to: args.to, token });
    if (!candles.length) throw new Error(`${entry.instrument} returned no complete candles`);
    const csvText = toCsv({ instrument: entry.instrument, candles });
    const csvFile = path.join(OUT_DIR, entry.file);
    fs.writeFileSync(csvFile, csvText, "utf8");
    const timestamps = candles.map((candle) => new Date(candle.time).toISOString().replace(/\.\d{3}Z$/, "Z"));
    markets.push({
      market: entry.market,
      instrument: entry.instrument,
      broker_symbol: entry.broker_symbol,
      file: entry.file,
      rows: candles.length,
      first_utc: timestamps[0],
      last_utc: timestamps[timestamps.length - 1],
      csv_bytes: Buffer.byteLength(csvText),
      csv_sha256: crypto.createHash("sha256").update(csvText).digest("hex"),
      boundary_coverage: boundaryCoverage({ timestamps, sessions }),
      note:
        entry.market === "WTIUSD"
          ? "OANDA's WTICO_USD is the WTI contract the provider quotes; the execution venue's USOIL is a different instrument and has not been reconciled"
          : null
    });
    console.log(`${entry.market}: ${candles.length} complete H1 candles, ${timestamps[0]} .. ${timestamps[timestamps.length - 1]}`);
  }

  const record = {
    schema_version: "oanda-h1-acquisition-v1",
    created_at: stamp,
    research_only: true,
    source: {
      publisher: "OANDA v20 REST",
      host: HOST,
      endpoint: "/v3/instruments/{instrument}/candles",
      granularity: "H1",
      price: "M (mid)",
      from: args.from,
      to: args.to,
      authentication: "bearer token from the local credential store; never printed, never written here",
      read_only: "market data only: no account, no order, no position, no transaction endpoint was called"
    },
    what_this_unblocks: [
      "the directional accuracy test for XAGUSD, WTIUSD and GBPUSD, once the series are priced at both 05:00 London endpoints",
      "nothing else: the two L2L tests also need an archived ladder and a bid/ask tape, which this does not acquire"
    ],
    markets,
    sessions_checked: sessions.length,
    licence: {
      position: "the rows are a licensed quote history",
      handling: "written under backtester/tmp/, which git ignores; not redistributed in this repository",
      decision_needed:
        "publishing a scored result from these series needs either a decision that the rows may be committed, or a documented download step so a reader can reproduce it"
    },
    not_claimed: [
      "no direction, hit rate or edge is claimed for these markets by acquiring their series",
      "no L2L combination becomes ready: the ladder and the bid/ask tape are still missing",
      "the WTI series is the provider's contract, not the execution venue's USOIL, so a cross-venue result would need its own reconciliation"
    ],
    reproduce: `node scripts/acquire_oanda_h1_series.js --from ${args.from.slice(0, 10)} --to ${args.to.slice(0, 10)} --i-understand-this-is-read-only-market-data`
  };
  fs.mkdirSync(RECORD_DIR, { recursive: true });
  fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 1)}\n`, "utf8");
  fs.writeFileSync(path.join(RECORD_DIR, "oanda-h1-acquisition-latest.json"), `${JSON.stringify(record, null, 1)}\n`, "utf8");
  console.log(JSON.stringify({ record: path.relative(ROOT, recordPath).replace(/\\/g, "/"), markets: markets.map((entry) => ({ market: entry.market, rows: entry.rows, both_endpoints: entry.boundary_coverage.both_present })) }, null, 1));
}

if (require.main === module) {
  main(process.argv).catch((error) => {
    console.error(String(error && error.message ? error.message : error));
    process.exit(1);
  });
}

module.exports = { INSTRUMENTS, parseArgs, londonSessionDate, fetchCandles, toCsv, boundaryCoverage };
