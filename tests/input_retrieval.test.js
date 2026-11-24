"use strict";

// Guards model-owned input retrieval: reconstruction is disclosed, a receipt needs a capture taken at or
// before the cutoff that matches the replayed value, and a conflict is never resolved silently.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "..");
const retrieval = require(path.join(ROOT, "lib", "layer1_backtesting", "input_retrieval"));
const registry = require(path.join(ROOT, "backtester", "lib", "usd_layer1_backtester", "model_registry"));
const dataset = require(path.join(ROOT, "data", "usd-layer1-backtester", "run-v1.json"));

const entry = registry.requireModel("challenger_v1");
const contract = entry.input_contract;
const fullSession = dataset.sessions.find((session) => entry.input_keys.every((key) => Number.isFinite(session.saved_inputs[key])));
const n8nFixture = require(path.join(ROOT, "data", "usd-layer1-backtester", "n8n", "execution-5471-structural.json"));

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "usd-l1-captures-"));
}

function captureDoc(session, overrides = {}) {
  const capturedAt = new Date(Date.parse(session.cutoff_at_utc) - 3600000).toISOString();
  return {
    schema_version: retrieval.CAPTURE_SCHEMA,
    fixture: false,
    date: session.date,
    cutoff_at_utc: session.cutoff_at_utc,
    captured_at: capturedAt,
    entries: entry.input_keys.map((key) => ({
      key,
      value: session.saved_inputs[key],
      provider: "fred",
      series: "declared",
      publication_at: null,
      receipt_id: `receipt-${key}`,
      captured_at: capturedAt
    })),
    ...overrides
  };
}

test("the committed panel is a reconstruction and carries no receipt", () => {
  assert.ok(fullSession, "the panel must contain a fully populated morning for this check");
  const morning = retrieval.retrieveMorning({ date: fullSession.date, session: fullSession, contract });
  assert.equal(morning.keys.length, entry.input_keys.length);
  assert.equal(morning.summary.reconstructed, morning.keys.length);
  assert.equal(morning.summary.contemporaneous, 0);
  assert.equal(morning.summary.claim, "availability_not_established");
  for (const key of morning.keys) {
    assert.equal(key.receipt, null);
    assert.match(key.statement, /not a contemporaneous capture/);
    assert.match(key.reconstruction_digest, /^[0-9a-f]{64}$/);
  }
  const source = morning.keys.find((key) => key.key === "vix_level");
  assert.equal(source.source.provider, "fred");
  assert.equal(source.source.series, "VIXCLS");
  const derived = morning.keys.find((key) => key.key === "vix_d5_chg");
  assert.deepEqual(derived.source.parents, ["vix_level"]);
  assert.match(derived.source.transform, /five-business-day/);
});

test("a capture at or before the cutoff that matches the value becomes the only receipt", () => {
  const dir = tempDir();
  fs.writeFileSync(path.join(dir, "capture.json"), JSON.stringify(captureDoc(fullSession)));
  const corpus = retrieval.loadCaptures({ dir });
  const morning = retrieval.retrieveMorning({ date: fullSession.date, session: fullSession, contract, captures: corpus });
  assert.equal(morning.summary.contemporaneous, morning.keys.length);
  assert.equal(morning.summary.claim, "contemporaneous_availability_established");
  const first = morning.keys[0];
  assert.equal(first.mode, "contemporaneous_capture");
  assert.equal(first.receipt.receipt_id, `receipt-${first.key}`);
  assert.equal(first.capture_state, "usable");
});

test("a capture after the cutoff is unusable and never back-dated", () => {
  const dir = tempDir();
  const doc = captureDoc(fullSession);
  doc.captured_at = new Date(Date.parse(fullSession.cutoff_at_utc) + 60000).toISOString();
  for (const row of doc.entries) row.captured_at = doc.captured_at;
  fs.writeFileSync(path.join(dir, "late.json"), JSON.stringify(doc));
  const morning = retrieval.retrieveMorning({
    date: fullSession.date,
    session: fullSession,
    contract,
    captures: retrieval.loadCaptures({ dir })
  });
  assert.equal(morning.summary.contemporaneous, 0);
  assert.equal(morning.summary.after_cutoff_captures, morning.keys.length);
  assert.equal(morning.keys[0].receipt, null);
  assert.equal(morning.keys[0].mode, "reconstructed_panel");
});

test("a capture that disagrees with the panel is a conflict, not a receipt", () => {
  const dir = tempDir();
  const doc = captureDoc(fullSession);
  doc.entries[0].value = doc.entries[0].value + 1;
  fs.writeFileSync(path.join(dir, "conflict.json"), JSON.stringify(doc));
  const morning = retrieval.retrieveMorning({
    date: fullSession.date,
    session: fullSession,
    contract,
    captures: retrieval.loadCaptures({ dir })
  });
  const conflicted = morning.keys.find((key) => key.key === doc.entries[0].key);
  assert.equal(conflicted.capture_state, "value_conflict");
  assert.equal(conflicted.mode, "reconstructed_panel");
  assert.equal(conflicted.receipt, null);
  assert.equal(morning.summary.conflicts, 1);
});

test("a labelled fixture capture is ignored unless a caller explicitly allows it", () => {
  const dir = tempDir();
  fs.writeFileSync(path.join(dir, "fixture.json"), JSON.stringify(captureDoc(fullSession, { fixture: true })));
  const corpus = retrieval.loadCaptures({ dir });
  assert.equal(corpus.fixtures, 1);
  assert.equal(corpus.captures.size, 0);
  const ignored = retrieval.retrieveMorning({ date: fullSession.date, session: fullSession, contract, captures: corpus });
  assert.equal(ignored.summary.contemporaneous, 0);
  const allowed = retrieval.retrieveMorning({
    date: fullSession.date,
    session: fullSession,
    contract,
    captures: retrieval.loadCaptures({ dir, allowFixtures: true }),
    allowFixtures: true
  });
  assert.equal(allowed.summary.contemporaneous, allowed.keys.length);
});

test("the retrieval artefact reports an empty corpus as empty and never invents a receipt", () => {
  const artefact = retrieval.buildRetrievalArtefact({
    dataset,
    registry: { ENTRIES: [entry] },
    captures: { files: [], captures: new Map(), rejected: [], fixtures: 0, usable: 0 },
    generatedAt: dataset.generated_at
  });
  const model = artefact.models.challenger_v1;
  assert.equal(model.keys.length, entry.input_keys.length);
  assert.equal(model.totals.contemporaneous, 0);
  assert.equal(model.totals.reconstructed > 0, true);
  assert.equal(model.availability_claim, "not_established");
  assert.deepEqual(artefact.capture_corpus.files, []);
  assert.equal(model.mornings.panel, dataset.sessions.length);
  assert.match(model.statement, /Reconstruction is not retrieval/);
  assert.ok(model.keys.every((key) => key.source.known === true));
});

test("the committed artefact and the recorded n8n execution retrieve the same morning", () => {
  // The n8n capture is a record of the gate, not a copy of the panel's values: it says how many declared
  // keys were present, how many carried a clock before the cutoff, and whether any receipt completed the
  // set. Reading the production artifact through the same contract must reproduce those counts exactly.
  // That is the proof that retrieval is wired to the published morning rather than to a test-only shape.
  assert.equal(n8nFixture.date, fullSession.date);
  assert.equal(n8nFixture.dataset.run_version, dataset.run.run_version);
  for (const modelKey of ["challenger", "challenger_v1"]) {
    const model = registry.requireModel(modelKey);
    const recorded = n8nFixture.input_availability_by_model[modelKey];
    const morning = retrieval.retrieveMorning({
      date: fullSession.date,
      session: fullSession,
      contract: model.input_contract
    });
    assert.equal(morning.summary.keys, recorded.declared_inputs, `${modelKey}: every declared key is retrieved`);
    assert.equal(morning.summary.present, recorded.present_inputs, `${modelKey}: the present count matches the n8n gate`);
    assert.equal(morning.summary.missing, recorded.missing_inputs, `${modelKey}: the missing count matches the n8n gate`);
    assert.deepEqual(
      morning.keys.filter((key) => !key.present).map((key) => key.key),
      recorded.missing_keys,
      `${modelKey}: a missing key is named, not dropped`
    );
    assert.equal(morning.summary.timestamped, recorded.stamped_before_cutoff, `${modelKey}: the clock count matches the n8n gate`);
    assert.equal(morning.summary.contemporaneous, 0, `${modelKey}: the n8n record carries no receipt either`);
    assert.equal(recorded.receipted_complete, false, `${modelKey}: the recorded gate is not receipted`);
    assert.equal(morning.summary.claim, "availability_not_established", `${modelKey}: reconstruction is not availability`);
  }
});
