#!/usr/bin/env node
"use strict";

/**
 * Run a bounded, resumable USD Layer 1 sweep through the n8n Cloud controller (research only).
 *
 *   node scripts/run_usd_l1_n8n_sweep.js --plan
 *   node scripts/run_usd_l1_n8n_sweep.js --run --from 2024-01-02 --to 2024-12-31 --chunk 20
 *   node scripts/run_usd_l1_n8n_sweep.js --report
 *
 * The ledger is the source of truth. Every request is planned from it, every response is persisted
 * atomically through the same merge/verify path as a manual capture, and a failed request is retained as an
 * attempt rather than becoming a result. A lock file stops two concurrent sweeps from writing at once.
 *
 * Secrets: N8N_BASE_URL and USD_L1_WEBHOOK_TOKEN are read from the process environment, or from the
 * encrypted local CLIXML store through scripts/local-credentials/get-secret.ps1. Nothing secret is written
 * to the repository, the ledger, the captures or the console.
 */

const childProcess = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");

const ledgerLib = require("../lib/backtesting_n8n_run_ledger");
const sweepLib = require("../lib/backtesting_n8n_sweep");
const registry = require("../backtester/lib/usd_layer1_backtester/model_registry");
const persist = require("./persist_usd_l1_n8n_runs");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_LEDGER = path.join(ROOT, persist.DEFAULT_LEDGER);
const DEFAULT_DATASET = path.join(ROOT, persist.DEFAULT_DATASET);
const N8N_DIR = path.join(ROOT, "data", "usd-layer1-backtester", "n8n");
const LOCK_PATH = path.join(N8N_DIR, ".sweep.lock");
const HEADER_NAME = "X-USD-L1-Token";
const WEBHOOK_PATH = "usd-l1-paired-controller";
const DEFAULT_DATASET_URL = "https://raw.githubusercontent.com/kevincreedycars-debug/trading-agent-dashboard/main/data/usd-layer1-backtester/run-v1.json";

function parseArgs(argv) {
  const args = { capture: [] };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`unexpected argument: ${token}`);
    const key = token.slice(2);
    const takesValue = ["from", "to", "dates", "models", "validation", "chunk", "max-chunks", "label", "ledger", "dataset", "timeout", "dataset-url"].includes(key);
    if (takesValue) {
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) throw new Error(`--${key} needs a value`);
      index += 1;
      args[key === "max-chunks" ? "maxChunks" : key === "dataset-url" ? "datasetUrl" : key] = next;
    } else {
      args[key] = true;
    }
  }
  return args;
}

/** A secret from the environment, or from the encrypted local store. Never from a repository file. */
function readSecret(name) {
  if (process.env[name] && String(process.env[name]).trim()) return String(process.env[name]).trim();
  const script = path.join(ROOT, "scripts", "local-credentials", "get-secret.ps1");
  if (!fs.existsSync(script)) throw new Error(`${name} is not in the environment and the local credential store helper is missing`);
  const output = childProcess.execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-Name", name], {
    encoding: "utf8",
    windowsHide: true
  });
  const value = String(output).trim();
  if (!value) throw new Error(`${name} is not present in the local credential store`);
  return value;
}

function postJson(url, headers, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === "https:" ? https : http;
    const payload = JSON.stringify(body);
    const request = client.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || undefined,
      path: `${target.pathname}${target.search}`,
      method: "POST",
      headers: Object.assign({
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        Accept: "application/json"
      }, headers)
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode || 0,
        text: Buffer.concat(chunks).toString("utf8")
      }));
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error(`request timed out after ${timeoutMs} ms`)));
    request.on("error", reject);
    request.write(payload);
    request.end();
  });
}

function acquireLock(label) {
  fs.mkdirSync(N8N_DIR, { recursive: true });
  try {
    const handle = fs.openSync(LOCK_PATH, "wx");
    fs.writeFileSync(handle, JSON.stringify({ pid: process.pid, at: new Date().toISOString(), label }, null, 2));
    fs.closeSync(handle);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const held = (() => {
      try {
        return JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
      } catch {
        return null;
      }
    })();
    throw new Error(`another sweep holds the lock (${held ? `pid ${held.pid} since ${held.at}` : "unreadable lock"}); remove ${path.relative(ROOT, LOCK_PATH)} only if no sweep is running`);
  }
}

function releaseLock() {
  try {
    fs.unlinkSync(LOCK_PATH);
  } catch {
    /* already gone */
  }
}

function writeLedgerAtomic(ledger) {
  persist.writeLedger(DEFAULT_LEDGER, ledger);
}

function planDates(args, dataset) {
  if (args.dates) return args.dates.split(",").map((entry) => entry.trim()).filter(Boolean);
  if (args.from || args.to) {
    const dates = (dataset.sessions || []).map((session) => session.date);
    const from = args.from || dates[0];
    const to = args.to || dates[dates.length - 1];
    return dates.filter((date) => date >= from && date <= to);
  }
  return (dataset.sessions || []).map((session) => session.date);
}


function usage() {
  return [
    "Usage: node scripts/run_usd_l1_n8n_sweep.js [--plan | --run | --report] [options]",
    "",
    "  --plan                 print the request plan from the ledger; no network call",
    "  --run                  execute the plan until it is complete or --max-chunks is reached",
    "  --report               print the ledger sweep report",
    "  --from / --to          restrict to mornings inside the panel window",
    "  --dates <a,b>          explicit mornings",
    "  --models <a,b>         registered model selection (default: the frozen research challengers)",
    "  --validation <mode>    structural (default) | receipted",
    "  --chunk <n>            mornings per request, at most 40 (default 20)",
    "  --max-chunks <n>       stop after n requests in this session",
    "  --label <text>         label written into the run history",
    "  --timeout <ms>         per-request timeout (default 240000)",
    "  --stop-on-error        stop at the first failed request instead of continuing",
    "  --dataset-url <url>    panel URL the workflow should fetch",
    "  --ledger / --dataset   override the committed files"
  ].join("\n");
}

function compactReport(report) {
  if (!report) return report;
  const plan = report.plan ? Object.assign({}, report.plan, {
    complete_count: (report.plan.complete || []).length,
    missing_count: (report.plan.missing || []).length,
    unverified_count: (report.plan.unverified || []).length,
    complete: undefined,
    missing: undefined,
    unverified: undefined,
    coexisting: undefined
  }) : null;
  return Object.assign({}, report, { plan });
}


function buildPlan({ args, ledger, dataset }) {

  const dates = planDates(args, dataset);
  const validation = args.validation || "structural";
  const models = args.models ? args.models.split(",").map((entry) => entry.trim()).filter(Boolean) : registry.DEFAULT_SELECTION.slice();
  const chunkSize = args.chunk ? Number(args.chunk) : sweepLib.DEFAULT_CHUNK;
  const plan = ledgerLib.resumePlan(ledger, { dates, validation_mode: validation, selection: models });
  const remaining = plan.missing.concat(plan.unverified).sort();
  const chunks = sweepLib.chunkDates(remaining, chunkSize).map((datesChunk) => sweepLib.requestBody({
    dates: datesChunk,
    models,
    validation,
    datasetUrl: args.datasetUrl || DEFAULT_DATASET_URL
  }));
  return {
    requested_dates: dates.length,
    already_complete: plan.complete.length,
    remaining: remaining.length,
    coexisting_dates: plan.coexisting,
    chunk_size: chunkSize,
    chunks: chunks.length,
    models,
    validation,
    next_chunk: chunks[0] || null
  };
}


async function runSweep({ args, dataset, ledger, base, token }) {
  const validation = args.validation || "structural";
  const models = args.models ? args.models.split(",").map((entry) => entry.trim()).filter(Boolean) : registry.DEFAULT_SELECTION.slice();
  const chunkSize = args.chunk ? Number(args.chunk) : sweepLib.DEFAULT_CHUNK;
  const timeoutMs = args.timeout ? Number(args.timeout) : 240000;
  const maxChunks = args.maxChunks ? Number(args.maxChunks) : Infinity;
  const label = args.label || `sweep ${new Date().toISOString()}`;
  const url = `${base.replace(/\/+$/, "")}/webhook/${WEBHOOK_PATH}`;
  const dates = planDates(args, dataset);
  let working = ledger;
  let sent = 0;
  const results = [];

  for (let round = 0; round < 500 && sent < maxChunks; round += 1) {
    const plan = ledgerLib.resumePlan(working, { dates, validation_mode: validation, selection: models });
    const remaining = plan.missing.concat(plan.unverified).sort();
    if (remaining.length === 0) break;
    const datesChunk = remaining.slice(0, chunkSize);
    const body = sweepLib.requestBody({
      dates: datesChunk,
      models,
      validation,
      datasetUrl: args.datasetUrl || DEFAULT_DATASET_URL
    });
    const startedAt = new Date().toISOString();
    let response = null;
    let error = null;
    try {
      response = await postJson(url, { [HEADER_NAME]: token }, body, timeoutMs);
      if (response.status < 200 || response.status >= 300) {
        error = new Error(`webhook returned HTTP ${response.status}: ${String(response.text).slice(0, 300)}`);
      }
    } catch (caught) {
      error = caught;
    }
    sent += 1;

    if (error) {
      working = ledgerLib.recordAttempt(working, {
        at: startedAt,
        ok: false,
        label,
        requested: datesChunk,
        http_status: response ? response.status : null,
        error: error.message
      }).ledger;
      writeLedgerAtomic(working);
      results.push({ at: startedAt, requested: datesChunk.length, ok: false, error: error.message });
      if (args["stop-on-error"]) break;
      continue;
    }

    let parsed;
    try {
      parsed = sweepLib.parseResponse(response.text);
    } catch (caught) {
      working = ledgerLib.recordAttempt(working, {
        at: startedAt,
        ok: false,
        label,
        requested: datesChunk,
        http_status: response.status,
        error: caught.message,
        response_bytes: response.text.length
      }).ledger;
      writeLedgerAtomic(working);
      results.push({ at: startedAt, requested: datesChunk.length, ok: false, error: caught.message });
      if (args["stop-on-error"]) break;
      continue;
    }

    // The raw response is kept beside the ledger so a reviewer can read exactly what n8n returned.
    const captureIndex = working.runs.length + 1;
    const capturePath = path.join(N8N_DIR, `sweep-${String(captureIndex).padStart(3, "0")}-${datesChunk[0]}-${datesChunk[datesChunk.length - 1]}.json`);
    fs.mkdirSync(N8N_DIR, { recursive: true });
    fs.writeFileSync(capturePath, `${JSON.stringify(parsed.records, null, 2)}\n`, "utf8");

    const merged = ledgerLib.mergeLedger(working, {
      records: parsed.records,
      dataset,
      capturedAt: startedAt,
      label: `${label} · ${datesChunk[0]} to ${datesChunk[datesChunk.length - 1]}`,
      evidence: path.relative(ROOT, capturePath).split(path.sep).join("/")
    });
    working = merged.ledger;
    working = ledgerLib.recordAttempt(working, {
      at: startedAt,
      ok: true,
      label,
      requested: datesChunk,
      http_status: response.status,
      execution_id: merged.run.execution_id,
      response_bytes: response.text.length
    }).ledger;
    writeLedgerAtomic(working);
    // A response that answered only part of the request is a partial success: what came back is kept,
    // and the uncovered mornings are retained as a failed attempt so the next pass re-requests them.
    const covered = sweepLib.coveredDates(parsed.records);
    const uncovered = datesChunk.filter((date) => !covered.includes(date));
    if (uncovered.length > 0) {
      working = ledgerLib.recordAttempt(working, {
        at: startedAt,
        ok: false,
        label,
        requested: uncovered,
        http_status: response.status,
        error: `response covered ${covered.length} of ${datesChunk.length} requested mornings`
      }).ledger;
      writeLedgerAtomic(working);
    }
    results.push({
      at: startedAt,
      requested: datesChunk.length,
      ok: uncovered.length === 0,
      first: datesChunk[0],
      last: datesChunk[datesChunk.length - 1],
      execution_id: merged.run.execution_id,
      added: merged.added.length,
      duplicates: merged.duplicates.length,
      rejected: merged.rejected.length,
      technical_failures: parsed.failures.length,
      uncovered: uncovered.length,
      capture: path.relative(ROOT, capturePath).split(path.sep).join("/")
    });
    if (parsed.failures.length > 0) {
      working = ledgerLib.recordAttempt(working, {
        at: startedAt,
        ok: false,
        label,
        requested: parsed.failures.map((entry) => entry.date).filter(Boolean),
        error: `technical failure: ${parsed.failures.map((entry) => `${entry.date || "unknown"} missing ${entry.missing.join("+") || "child"}`).join("; ")}`
      }).ledger;
      writeLedgerAtomic(working);
    }
  }

  return { ledger: working, sent, results };
}


function main(argv = process.argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(JSON.stringify({ usage: usage() }, null, 2));
    return 0;
  }
  const dataset = JSON.parse(fs.readFileSync(DEFAULT_DATASET, "utf8").replace(/^\uFEFF/, ""));
  const ledger = fs.existsSync(DEFAULT_LEDGER)
    ? JSON.parse(fs.readFileSync(DEFAULT_LEDGER, "utf8").replace(/^\uFEFF/, ""))
    : ledgerLib.emptyLedger();

  if (args.report) {
    const dates = planDates(args, dataset);
    console.log(JSON.stringify({
      ledger: path.relative(ROOT, DEFAULT_LEDGER).split(path.sep).join("/"),
      report: compactReport(ledgerLib.sweepReport(ledger, { dates, validation_mode: args.validation || "structural" }))
    }, null, 2));
    return 0;
  }

  if (args.plan || !args.run) {
    const plan = buildPlan({ args, ledger, dataset });
    console.log(JSON.stringify({
      mode: "plan",
      ledger: path.relative(ROOT, DEFAULT_LEDGER).split(path.sep).join("/"),
      plan,
      note: "No network call was made. Run with --run to execute the plan."
    }, null, 2));
    return 0;
  }

  const base = readSecret("N8N_BASE_URL");
  const token = readSecret("USD_L1_WEBHOOK_TOKEN");
  acquireLock(args.label || "sweep");
  return runSweep({ args, dataset, ledger, base, token })
    .then(({ ledger: finalLedger, sent, results }) => {
      const report = compactReport(ledgerLib.sweepReport(finalLedger, {
        dates: planDates(args, dataset),
        validation_mode: args.validation || "structural",
        selection: args.models ? args.models.split(",").map((entry) => entry.trim()).filter(Boolean) : registry.DEFAULT_SELECTION.slice()
      }));
      console.log(JSON.stringify({ mode: "run", sent, results, report }, null, 2));
      const failed = results.filter((entry) => entry.ok !== true).length;
      return failed === 0 ? 0 : 1;
    })
    .catch((error) => {
      console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
      return 1;
    })
    .finally(() => releaseLock());
}

if (require.main === module) {
  Promise.resolve()
    .then(() => main(process.argv))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      releaseLock();
      console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
      process.exitCode = 1;
    });
}

module.exports = { parseArgs, buildPlan, planDates, usage };
