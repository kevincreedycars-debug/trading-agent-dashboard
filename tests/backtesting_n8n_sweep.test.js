"use strict";

// Guards the sweep planner: bounded requests, an explicit model selection, and a response classifier that
// never turns a technical failure into a morning result. Research only: no network call is made here.

const assert = require("node:assert/strict");
const test = require("node:test");

const sweep = require("../lib/backtesting_n8n_sweep");
const registry = require("../backtester/lib/usd_layer1_backtester/model_registry");

test("a sweep is split into bounded, ordered, de-duplicated requests", () => {
  const dates = ["2024-01-03", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"];
  assert.deepEqual(sweep.chunkDates(dates, 2), [
    ["2024-01-02", "2024-01-03"],
    ["2024-01-04", "2024-01-05"]
  ]);
  assert.deepEqual(sweep.chunkDates([], 10), []);
  assert.throws(() => sweep.chunkDates(dates, 0), /positive integer/);
  assert.throws(() => sweep.chunkDates(dates, 41), /must not exceed 40/);
  const big = Array.from({ length: 45 }, (_value, index) => `2024-02-${String(index + 1).padStart(2, "0")}`);
  const chunks = sweep.chunkDates(big, 40);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].length, 40);
  assert.equal(chunks[1].length, 5);
});

test("the request body names only registered Cloud models and a declared validation label", () => {
  const body = sweep.requestBody({ dates: ["2024-01-10"], models: ["challenger", "fixture_constant"], validation: "structural" });
  assert.deepEqual(body.dates, ["2024-01-10"]);
  assert.deepEqual(body.models, ["challenger", "fixture_constant"]);
  assert.equal(body.validation, "structural");
  assert.equal(body.tests, undefined);

  const defaults = sweep.requestBody({ dates: ["2024-01-10"] });
  assert.deepEqual(defaults.models, registry.DEFAULT_SELECTION.slice());

  assert.throws(() => sweep.requestBody({ dates: ["2024-01-10"], models: ["current"] }), /available in the n8n Cloud runtime/);
  assert.throws(() => sweep.requestBody({ dates: ["2024-01-10"], models: ["not_a_model"] }), /unknown Layer 1 model/);
  assert.throws(() => sweep.requestBody({ dates: [], models: ["challenger"] }), /at least one morning/);
  assert.throws(() => sweep.requestBody({ dates: ["2024-01-10"], validation: "lenient" }), /structural or receipted/);
  assert.deepEqual(sweep.requestBody({ dates: ["2024-01-10"], tests: "a, b" }).tests, ["a", "b"]);
});

test("a technical failure is not a morning result", () => {
  const response = [
    { schema_version: "usd-l1-n8n-cloud-execution-v2", date: "2024-01-10" },
    { schema_version: "usd-l1-n8n-technical-failure-v1", date: "2024-01-11", missing: ["challenger_v1"], n8n: { execution_id: 42 } }
  ];
  const parsed = sweep.parseResponse(JSON.stringify(response));
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.failures.length, 1);
  assert.deepEqual(parsed.failures[0].missing, ["challenger_v1"]);
  assert.equal(parsed.failures[0].execution_id, "42");
  assert.deepEqual(sweep.coveredDates(parsed.records), ["2024-01-10"]);

  assert.throws(() => sweep.parseResponse("not json"), /did not return JSON/);
});
