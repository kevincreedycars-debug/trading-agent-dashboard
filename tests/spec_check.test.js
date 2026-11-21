"use strict";

// Guards the independent specification check: a second hand transcription, hand-calculated examples, and
// deliberately corrupted inputs and calculations that must be caught rather than accepted.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "..");
const specCheck = require(path.join(ROOT, "lib", "layer1_backtesting", "spec_check"));
const dataset = require(path.join(ROOT, "data", "usd-layer1-backtester", "run-v1.json"));

const session = dataset.sessions.find((entry) => entry.date === "2024-01-10");

test("the hand transcription matches the frozen model table", () => {
  const comparison = specCheck.compareModelTable();
  assert.deepEqual(comparison.differences, []);
  assert.equal(comparison.matches, true);
  assert.equal(specCheck.SPEC.mechanisms.length, 9);
  assert.equal(specCheck.SPEC.total_weight, 7);
});

test("every hand-calculated example is reproduced by the model", () => {
  const result = specCheck.runHandExamples();
  assert.equal(result.cases, 5);
  assert.equal(result.passed, 5, JSON.stringify(result.failures, null, 2));
  for (const example of specCheck.HAND_EXAMPLES) {
    assert.ok(example.arithmetic.length > 20);
    const call = specCheck.modelCall(example.values);
    const comparison = specCheck.verifyCall(example.values, call);
    assert.equal(comparison.ok, true, JSON.stringify(comparison.differences));
  }
});

test("corrupted calculations are detected, not replayed", () => {
  const calls = specCheck.runCallCorruptions();
  assert.equal(calls.cases, 5);
  assert.equal(calls.detected, 5, JSON.stringify(calls.failures));
  const tables = specCheck.runTableCorruptions();
  assert.equal(tables.detected, tables.cases, JSON.stringify(tables.failures));
  assert.ok(tables.cases >= 3);
});

test("corrupted inputs are refused or recorded as missing", () => {
  const inputs = specCheck.runInputCorruptions();
  assert.equal(inputs.detected, inputs.cases, JSON.stringify(inputs.failures));
  const gate = specCheck.runGateCorruptions(session);
  assert.equal(gate.cases, 3);
  assert.equal(gate.detected, gate.cases, JSON.stringify(gate.failures));
});

test("the committed spec-check artefact reproduces and passes", () => {
  const computed = specCheck.runSpecCheck({ session, generatedAt: dataset.generated_at });
  assert.equal(computed.verdict, "pass");
  const committed = fs.readFileSync(path.join(ROOT, "data", "usd-layer1-backtester", "spec-check-v1.json"), "utf8").replace(/^\uFEFF/, "");
  assert.equal(committed, `${JSON.stringify(computed, null, 2)}\n`, "regenerate with node scripts/build_usd_l1_platform_evidence.js");
});
