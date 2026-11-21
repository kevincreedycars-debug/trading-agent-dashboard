"use strict";

// Guards the one-morning explainer: the chain runs from source through rule, gate, call, execution and
// outcome, it reproduces the stored record, and it never shows a receipt the retrieval layer did not have.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "..");
const trace = require(path.join(ROOT, "lib", "backtesting_morning_trace"));
const dataset = require(path.join(ROOT, "data", "usd-layer1-backtester", "run-v1.json"));
const ledger = require(path.join(ROOT, "data", "usd-layer1-backtester", "n8n", "run-ledger-v1.json"));

const row = ledger.records.find((entry) => entry.date === "2024-01-10" && entry.validation_mode === "structural" && entry.calls.challenger);
const session = dataset.sessions.find((entry) => entry.date === "2024-01-10");

test("one morning is explained from its sources to its outcome", () => {
  assert.ok(row, "the ledger must hold the 2024-01-10 structural record");
  const chain = trace.buildMorningTrace({ date: row.date, model: "challenger", row, session });
  assert.deepEqual(chain.steps.map((step) => step.id), [
    "sources",
    "inputs",
    "rules",
    "validation",
    "call",
    "execution",
    "outcome",
    "verification"
  ]);
  const sources = chain.steps.find((step) => step.id === "sources");
  assert.equal(sources.items.length, 9);
  assert.ok(sources.items.every((item) => item.receipt === null));
  assert.ok(sources.items.every((item) => item.reconstruction_digest));
  const rules = chain.steps.find((step) => step.id === "rules");
  assert.equal(rules.items.length, 9);
  assert.ok(rules.items.every((item) => item.vote === null || [-1, 0, 1].includes(item.vote)));
  assert.equal(chain.steps.find((step) => step.id === "call").items[0].direction, row.calls.challenger.direction);
  assert.equal(chain.steps.find((step) => step.id === "outcome").items.length, 4);
  assert.equal(chain.reproduced, true);
  assert.equal(chain.evidence.find((entry) => entry.label === "parent execution").url, row.executions.parent.url);
});

test("a morning the model refused still explains why", () => {
  const refused = ledger.records.find((entry) => entry.validation_mode === "receipted" && entry.calls.challenger && entry.calls.challenger.status === "blocked");
  assert.ok(refused, "the ledger must hold a receipted refusal");
  const refusedSession = dataset.sessions.find((entry) => entry.date === refused.date);
  const chain = trace.buildMorningTrace({ date: refused.date, model: "challenger", row: refused, session: refusedSession });
  const gate = chain.steps.find((step) => step.id === "validation");
  assert.match(gate.summary, /refused/);
  assert.ok(gate.items.some((item) => item.code === "receipted_incomplete"));
  const call = chain.steps.find((step) => step.id === "call");
  assert.match(call.summary, /^blocked:/);
  assert.equal(call.items[0].direction, refused.calls.challenger.direction === undefined ? null : refused.calls.challenger.direction);
  assert.equal(chain.steps.find((step) => step.id === "outcome").items.length, 0);
});

test("the committed trace artefact reproduces from the ledger and the panel", () => {
  const computed = trace.buildTraceArtefact({ ledger, dataset, generatedAt: dataset.generated_at });
  assert.ok(computed.mornings.length >= 3);
  assert.ok(computed.mornings.every((morning) => morning.steps.length >= 7));
  const committed = fs.readFileSync(path.join(ROOT, "data", "usd-layer1-backtester", "morning-traces-v1.json"), "utf8").replace(/^\uFEFF/, "");
  assert.equal(committed, `${JSON.stringify(computed, null, 2)}\n`, "regenerate with node scripts/build_usd_l1_platform_evidence.js");
});
