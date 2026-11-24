#!/usr/bin/env node
"use strict";

/**
 * Persist captured n8n paired records into the durable run ledger (research only).
 *
 *   node scripts/persist_usd_l1_n8n_runs.js --capture backtester/tmp/run-1.json --label "batch 1"
 *   node scripts/persist_usd_l1_n8n_runs.js --status --from 2024-01-02 --to 2024-01-31
 *   node scripts/persist_usd_l1_n8n_runs.js --capture <file> --check
 *
 * A capture is the JSON the paired webhook returned: one paired record or an array of them. Records are
 * keyed by validation mode and morning, verified against the committed panel and the local controller,
 * and only unseen keys are appended, so re-running a range or re-ingesting a capture never duplicates a
 * morning. The write is atomic and is skipped when nothing changed, which is what makes a restart safe.
 *
 * This script reads files only. It never calls n8n, never activates a workflow and never touches a live
 * trading path.
 */

const fs = require("node:fs");
const path = require("node:path");

const ledgerLib = require("../lib/backtesting_n8n_run_ledger");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_LEDGER = "data/usd-layer1-backtester/n8n/run-ledger-v1.json";
const DEFAULT_DATASET = "data/usd-layer1-backtester/run-v1.json";

function parseArgs(argv) {
  const args = { capture: [] };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`unexpected argument: ${token}`);
    const key = token.slice(2);
    const takesValue = ["capture", "ledger", "dataset", "dates", "from", "to", "validation", "label", "captured-at"].includes(key);
    if (takesValue) {
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) throw new Error(`--${key} needs a value`);
      index += 1;
      if (key === "capture") args.capture.push(next);
      else args[key === "captured-at" ? "capturedAt" : key] = next;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function resolvePath(relativeOrAbsolute) {
  return path.isAbsolute(relativeOrAbsolute) ? relativeOrAbsolute : path.resolve(ROOT, relativeOrAbsolute);
}

function displayPath(filePath) {
  const relative = path.relative(ROOT, filePath);
  return relative.startsWith("..") ? filePath : relative.split(path.sep).join("/");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function readCapture(filePath) {
  const parsed = readJson(filePath);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.records)) return parsed.records;
  return [parsed];
}

function readLedger(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const ledger = readJson(filePath);
  if (ledger && ledger.schema_version !== ledgerLib.RUN_LEDGER_VERSION) {
    throw new Error(
      `ledger schema ${ledger.schema_version} cannot be extended in place; re-persist the committed captures with --rebuild to write ${ledgerLib.RUN_LEDGER_VERSION}`
    );
  }
  return ledger;
}

function writeLedger(filePath, ledger) {
  const text = `${JSON.stringify(ledger, null, 2)}\n`;
  const temporary = `${filePath}.tmp`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(temporary, text, "utf8");
  fs.renameSync(temporary, filePath);
  return text;
}

function planDates(args, ledger) {
  if (args.dates) {
    return args.dates.split(",").map((entry) => entry.trim()).filter(Boolean);
  }
  if (args.from || args.to) {
    return ledgerLib.planRange({ from: args.from, to: args.to });
  }
  if (ledger && ledger.records) {
    return ledgerLib.summarise(ledger).dates;
  }
  return [];
}

function usage() {
  return [
    "Usage: node scripts/persist_usd_l1_n8n_runs.js [options]",
    "",
    "  --capture <path>       paired webhook response (record or array); repeatable",
    "  --label <text>         label the ingest in the run history",
    "  --ledger <path>        ledger file (default " + DEFAULT_LEDGER + ")",
    "  --dataset <path>       committed panel used for verification (default " + DEFAULT_DATASET + ")",
    "  --captured-at <iso>    capture time recorded on new rows (default: now)",
    "  --status               print coverage and the restart plan only",
    "  --from / --to          plan range for --status",
    "  --dates <a,b>          explicit plan dates for --status",
    "  --validation <mode>    structural (default) | receipted",
    "  --rebuild              ignore the committed ledger and rebuild it from the captures (schema migration)",
    "  --compact              rewrite every row in its lean persisted form (drops detail held in captures)",
    "  --link-evidence        attach each row to the capture file that contains its parent execution",
    "  --check                re-merge the captures and fail if the committed ledger differs",
    "  --write                write the ledger (default when a capture is given and --check is absent)"
  ].join("\n");
}

module.exports = { DEFAULT_LEDGER, DEFAULT_DATASET, parseArgs, readCapture, readLedger, writeLedger, planDates, usage };

function main(argv = process.argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(JSON.stringify({ usage: usage() }, null, 2));
    return 0;
  }
  const ledgerPath = resolvePath(args.ledger || DEFAULT_LEDGER);
  const datasetPath = resolvePath(args.dataset || DEFAULT_DATASET);
  const dataset = readJson(datasetPath);
  const existing = args.rebuild ? null : readLedger(ledgerPath);
  const validationMode = args.validation || "structural";
  const dates = planDates(args, existing);

  if (args.status) {
    const summary = existing ? ledgerLib.summarise(existing) : ledgerLib.summarise(ledgerLib.emptyLedger());
    const plan = dates.length > 0 ? ledgerLib.resumePlan(existing, { dates, validation_mode: validationMode }) : null;
    console.log(JSON.stringify({
      ledger: displayPath(ledgerPath),
      exists: Boolean(existing),
      summary,
      plan
    }, null, 2));
    return 0;
  }

  if (args["link-evidence"]) {
    if (!existing) throw new Error("no ledger to link");
    // Every captured response is on disk. Matching by parent execution id is exact, so no row is linked to
    // a file that does not contain it.
    const files = fs.readdirSync(path.join(ROOT, "data", "usd-layer1-backtester", "n8n"))
      .filter((name) => name.endsWith(".json") && (name.startsWith("sweep-") || name.startsWith("batch-") || name.startsWith("execution-")))
      .sort();
    const byExecution = new Map();
    for (const name of files) {
      const relative = `data/usd-layer1-backtester/n8n/${name}`;
      let records;
      try {
        records = readCapture(resolvePath(relative));
      } catch {
        continue;
      }
      for (const record of records) {
        const id = record && record.n8n && record.n8n.execution_id ? String(record.n8n.execution_id) : null;
        if (id && !byExecution.has(id)) byExecution.set(id, relative);
      }
    }
    let linked = 0;
    const records = existing.records.map((row) => {
      const id = row.executions && row.executions.parent ? row.executions.parent.id : null;
      const evidence = id ? byExecution.get(String(id)) : null;
      if (evidence && row.evidence !== evidence) {
        linked += 1;
        return Object.assign({}, row, { evidence });
      }
      return row;
    });
    const next = Object.assign({}, existing, { records });
    if (linked > 0) writeLedger(ledgerPath, next);
    console.log(JSON.stringify({
      ledger: displayPath(ledgerPath),
      linked,
      captured_executions: byExecution.size,
      rows: records.length,
      rows_without_evidence: records.filter((row) => !row.evidence).length
    }, null, 2));
    return 0;
  }

  if (args.compact) {
    if (!existing) throw new Error("no ledger to compact");
    const compacted = Object.assign({}, existing, {
      records: existing.records.map((row) => {
        // The snapshot digest needs the panel; recomputing it here keeps the fingerprint identical to the
        // one a fresh merge of the same capture would produce.
        const dates = row.identity && row.identity.input && Array.isArray(row.identity.input.dates) && row.identity.input.dates.length > 0
          ? row.identity.input.dates
          : [row.date];
        const withDigest = Object.assign({}, row, {
          input_snapshot_digest: row.input_snapshot_digest || ledgerLib.inputSnapshotDigest(dataset, dates)
        });
        return ledgerLib.compactRow(withDigest);
      })
    });
    const before = fs.statSync(ledgerPath).size;
    const text = `${JSON.stringify(compacted, null, 2)}\n`;
    const unchanged = text === fs.readFileSync(ledgerPath, "utf8").replace(/^\uFEFF/, "");
    if (!unchanged) writeLedger(ledgerPath, compacted);
    console.log(JSON.stringify({
      ledger: displayPath(ledgerPath),
      compacted: !unchanged,
      records: compacted.records.length,
      bytes_before: before,
      bytes_after: Buffer.byteLength(text),
      verification_failures: compacted.records.filter((row) => !row.verification || row.verification.verified !== true).length
    }, null, 2));
    return 0;
  }

  const captures = args.capture.map((file) => ({ file: displayPath(resolvePath(file)), records: readCapture(resolvePath(file)) }));
  if (captures.length === 0) {
    console.log(JSON.stringify({ usage: usage() }, null, 2));
    return 1;
  }
  /**
   * Which dataset a capture is verified against.
   *
   * A capture records the `generated_at` of the artefact it fetched. When the caller names no dataset, each
   * capture is replayed against the build it actually used: the current `run-v1.json` for a capture of this
   * build, the preserved v1 file for an older one. Replaying an old capture against the current artefact
   * would re-date the evidence, and replaying a new one against v1 would fail it - so neither is a default.
   */
  const CURRENT_DATASET_PATH = path.join(ROOT, "data", "usd-layer1-backtester", "run-v1.json");
  const PRESERVED_DATASET_PATH = path.join(ROOT, "data", "usd-layer1-backtester", "run-v1-superseded-20261114.json");
  const currentStamp = fs.existsSync(CURRENT_DATASET_PATH)
    ? JSON.parse(fs.readFileSync(CURRENT_DATASET_PATH, "utf8")).generated_at
    : null;
  const datasetFor = (capture) => {
    if (args.dataset) return dataset;
    const first = capture.records && capture.records[0];
    const stamp = first && first.dataset ? first.dataset.generated_at : null;
    return stamp && stamp === currentStamp ? dataset : readJson(PRESERVED_DATASET_PATH);
  };
  const recordsMerged = { added: [], duplicates: [], rejected: [], runs: [] };
  let working = existing;
  for (const capture of captures) {
    const merged = ledgerLib.mergeLedger(working, {
      records: capture.records,
      dataset: datasetFor(capture),
      capturedAt: args.capturedAt || new Date().toISOString(),
      label: captures.length === 1 ? (args.label || null) : `${args.label || "capture"} · ${path.basename(capture.file)}`
    });
    working = merged.ledger;
    recordsMerged.added.push(...merged.added);
    recordsMerged.duplicates.push(...merged.duplicates);
    recordsMerged.rejected.push(...merged.rejected);
    recordsMerged.runs.push(merged.run);
  }
  const merged = { ledger: working, added: recordsMerged.added, duplicates: recordsMerged.duplicates, rejected: recordsMerged.rejected, run: recordsMerged.runs };

  const nextText = `${JSON.stringify(merged.ledger, null, 2)}\n`;
  const currentText = fs.existsSync(ledgerPath) ? fs.readFileSync(ledgerPath, "utf8").replace(/^\uFEFF/, "") : null;
  const unchanged = currentText === nextText;

  const report = {
    ledger: displayPath(ledgerPath),
    rebuilt: Boolean(args.rebuild),
    configurations: Array.from(new Set(merged.ledger.records.map((row) => (row.configuration ? row.configuration.fingerprint : null)))),
    claims: {
      consistency_verified: merged.ledger.records.filter((row) => row.verification && row.verification.consistency_verified === true).length,
      availability_established: merged.ledger.records.filter((row) => row.verification && row.verification.claims && row.verification.claims.availability.status === "established").length,
      logic_established: merged.ledger.records.filter((row) => row.verification && row.verification.claims && row.verification.claims.logic.status === "established").length
    },
    captures: captures.map((capture) => ({ file: capture.file, records: capture.records.length })),
    added: merged.added,
    duplicates: merged.duplicates,
    rejected: merged.rejected,
    run: merged.run,
    unchanged,
    summary: ledgerLib.summarise(merged.ledger),
    verification_failures: merged.ledger.records
      .filter((row) => !row.verification || row.verification.verified !== true)
      .map((row) => ({
        key: row.key,
        mismatches: row.verification ? row.verification.mismatches : ["no verification recorded"]
      }))
  };

  if (args.check) {
    report.check = unchanged ? "ledger reproduces" : "ledger is stale - re-run without --check to persist the captured records";
    console.log(JSON.stringify(report, null, 2));
    return unchanged ? 0 : 1;
  }

  if (!unchanged) writeLedger(ledgerPath, merged.ledger);
  report.written = !unchanged;
  console.log(JSON.stringify(report, null, 2));
  return merged.rejected.length > 0 ? 1 : 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv);
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exitCode = 1;
  }
}

