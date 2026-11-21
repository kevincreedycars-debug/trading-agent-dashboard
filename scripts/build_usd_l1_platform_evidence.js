#!/usr/bin/env node
"use strict";

/**
 * Build the platform-evidence artefacts that a reader checks instead of trusting a caption (research only).
 *
 * Four files are written from committed inputs only:
 *   - `spec-check-v1.json`      the independent specification check, hand examples and corruption probes;
 *   - `input-retrieval-v1.json` per model, per key: declared source, clock counts, receipts and
 *                               reconstruction digests over the committed panel;
 *   - `coverage-v1.json`        per model, per validation mode and per configuration: mornings covered,
 *                               completed runs, refusals and receipted refusals kept apart;
 *   - `morning-traces-v1.json`  a handful of mornings explained from source to outcome.
 *
 * `--check` recomputes everything and compares it with the committed files without writing. The generated
 * timestamp is the panel's own timestamp, so a rerun reproduces byte for byte.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data", "usd-layer1-backtester");
const registry = require(path.join(ROOT, "backtester", "lib", "usd_layer1_backtester", "model_registry"));
const ledgerLib = require(path.join(ROOT, "lib", "backtesting_n8n_run_ledger"));
const specCheck = require(path.join(ROOT, "lib", "layer1_backtesting", "spec_check"));
const inputRetrieval = require(path.join(ROOT, "lib", "layer1_backtesting", "input_retrieval"));
const morningTrace = require(path.join(ROOT, "lib", "backtesting_morning_trace"));

const CHECK = process.argv.includes("--check");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function equal(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

const dataset = readJson(path.join(DATA, "run-v1.json"));
const ledger = readJson(path.join(DATA, "n8n", "run-ledger-v1.json"));
const session = dataset.sessions.find((entry) => entry.date === "2024-01-10") || dataset.sessions[0];
const generatedAt = dataset.generated_at || null;

const artefacts = {
  "spec-check-v1.json": specCheck.runSpecCheck({ session, generatedAt }),
  "input-retrieval-v1.json": inputRetrieval.buildRetrievalArtefact({ dataset, registry, generatedAt }),
  "coverage-v1.json": Object.assign(ledgerLib.coverageReport(ledger, {
    panelDates: dataset.sessions.map((entry) => entry.date),
    models: registry.MODEL_IDS
  }), {
    schema_version: "usd-l1-coverage-v1",
    generated_at: generatedAt,
    dataset: {
      path: "data/usd-layer1-backtester/run-v1.json",
      run_version: dataset.run && dataset.run.run_version ? dataset.run.run_version : null
    }
  }),
  "morning-traces-v1.json": morningTrace.buildTraceArtefact({ ledger, dataset, generatedAt })
};

let failures = 0;
for (const [name, value] of Object.entries(artefacts)) {
  const file = path.join(DATA, name);
  if (CHECK) {
    if (!fs.existsSync(file)) {
      failures += 1;
      console.error(`${name}: missing`);
      continue;
    }
    const stored = readJson(file);
    if (!equal(stored, value)) {
      failures += 1;
      console.error(`${name}: does not reproduce`);
      continue;
    }
    console.log(`${name}: reproduces`);
    continue;
  }
  writeJson(file, value);
  console.log(`${name}: written`);
}

const summary = {
  spec_check: {
    verdict: artefacts["spec-check-v1.json"].verdict,
    hand_examples: `${artefacts["spec-check-v1.json"].hand_examples.passed}/${artefacts["spec-check-v1.json"].hand_examples.cases}`,
    corrupted_calls: `${artefacts["spec-check-v1.json"].corrupted_calls.detected}/${artefacts["spec-check-v1.json"].corrupted_calls.cases}`,
    corrupted_tables: `${artefacts["spec-check-v1.json"].corrupted_tables.detected}/${artefacts["spec-check-v1.json"].corrupted_tables.cases}`,
    corrupted_inputs: `${artefacts["spec-check-v1.json"].corrupted_inputs.detected}/${artefacts["spec-check-v1.json"].corrupted_inputs.cases}`,
    gate: `${artefacts["spec-check-v1.json"].gate.detected}/${artefacts["spec-check-v1.json"].gate.cases}`
  },
  input_retrieval: Object.fromEntries(Object.entries(artefacts["input-retrieval-v1.json"].models).map(([key, model]) => [key, {
    keys: model.keys.length,
    present: model.totals.key_values_present,
    contemporaneous: model.totals.contemporaneous,
    reconstructed: model.totals.reconstructed,
    claim: model.availability_claim
  }])),
  coverage: Object.fromEntries(Object.entries(artefacts["coverage-v1.json"].by_model).map(([key, model]) => [key, {
    panel_mornings: model.panel_mornings_available,
    covered: model.panel_mornings,
    completed: model.completed,
    refused: model.refused,
    receipted_refusals: model.receipted_refusals
  }])),
  traces: artefacts["morning-traces-v1.json"].mornings.map((morning) => ({
    date: morning.date,
    model: morning.model,
    why: morning.why,
    reproduced: morning.reproduced
  }))
};

console.log(JSON.stringify(summary, null, 2));
if (CHECK && failures > 0) process.exit(1);
