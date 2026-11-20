"use strict";

// Guards the durable n8n run ledger: a paired record is keyed by validation mode and morning, verified
// against the committed panel and the local controller, and merged idempotently so a resumed batch cannot
// double-count a morning. The records used here are the four real Cloud executions already committed as
// transcripts. Research only: every case reads files and recomputes locally.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ledger = require("../lib/backtesting_n8n_run_ledger");

const ROOT = path.join(__dirname, "..");
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/^\uFEFF/, ""));
const dataset = readJson("data/usd-layer1-backtester/run-v1.json");
const transcripts = [
  "data/usd-layer1-backtester/n8n/execution-5471-structural.json",
  "data/usd-layer1-backtester/n8n/execution-5474-receipted.json",
  "data/usd-layer1-backtester/n8n/execution-5477-missing-date.json",
  "data/usd-layer1-backtester/n8n/execution-5480-missing-inputs.json"
].map(readJson);
const byKey = (key) => transcripts.find((record) => ledger.normaliseRecord(record).key === key);

test("a paired record is keyed by the validation mode and the morning", () => {
  const structural = ledger.normaliseRecord(byKey("structural|2024-01-10"));
  assert.equal(structural.key, "structural|2024-01-10");
  assert.equal(structural.outcome, "allowed");
  assert.equal(structural.calls.challenger.identity, "usd-layer1-challenger-v0");
  assert.equal(structural.calls.challenger_v1.identity, "usd-layer1-challenger-v1");
  assert.notEqual(structural.executions.challenger.id, structural.executions.challenger_v1.id);

  const receipted = ledger.normaliseRecord(byKey("receipted|2024-01-10"));
  assert.equal(receipted.outcome, "blocked");
  assert.equal(receipted.gate.receipted_complete, false);
  assert.equal(receipted.calls.challenger.results, null);

  assert.throws(() => ledger.recordKey({ date: "2024-1-10", validation_mode: "structural" }), /YYYY-MM-DD/);
  assert.throws(() => ledger.recordKey({ date: "2024-01-10", validation_mode: "lenient" }), /structural or receipted/);
});

test("every committed Cloud record independently re-verifies against the panel", () => {
  for (const record of transcripts) {
    const row = ledger.normaliseRecord(record);
    const verification = ledger.verifyRecord(row, dataset);
    assert.deepEqual(verification.mismatches, [], row.key + " did not re-verify: " + verification.checks
      .filter((check) => !check.ok).map((check) => check.detail).join("; "));
    assert.equal(verification.verified, true);
    assert.ok(verification.checks.some((check) => check.name === "local_replay_challenger"));
    assert.ok(verification.checks.some((check) => check.name === "outcome_arithmetic_challenger"));
    assert.ok(verification.checks.some((check) => check.name === "execution_links"));
  }
});

test("a tampered direction or outcome never passes verification", () => {
  const record = JSON.parse(JSON.stringify(byKey("structural|2024-01-10")));
  record.models.challenger.decision.call.direction = "BEARISH";
  record.models.challenger.decision.results.EURUSD = "miss";
  const row = ledger.normaliseRecord(record);
  const verification = ledger.verifyRecord(row, dataset);
  assert.equal(verification.verified, false);
  const fields = verification.mismatches.map((mismatch) => mismatch.field);
  assert.ok(fields.includes("direction"), "a changed call is caught by the local replay");
  assert.ok(fields.includes("results"), "a changed hit/miss is caught by the outcome arithmetic");
});

test("a record with a missing child is rejected instead of half-saved", () => {
  const record = JSON.parse(JSON.stringify(byKey("structural|2024-01-10")));
  delete record.models.challenger_v1;
  assert.throws(() => ledger.normaliseRecord(record), /missing the challenger_v1 child/);
});

test("merging is idempotent: a restart adds no second result for a morning", () => {
  const first = ledger.mergeLedger(null, {
    records: [byKey("structural|2024-01-02"), byKey("structural|2024-01-06")],
    dataset,
    capturedAt: "2026-11-21T09:00:00.000Z",
    label: "partial run"
  });
  assert.deepEqual(first.added.map((entry) => entry.key), ["structural|2024-01-02", "structural|2024-01-06"]);
  assert.deepEqual(first.duplicates, []);
  assert.equal(first.ledger.records.length, 2);
  assert.equal(first.ledger.updated_at, "2026-11-21T09:00:00.000Z");

  const plan = ledger.resumePlan(first.ledger, {
    dates: ["2024-01-02", "2024-01-06", "2024-01-10", "2024-01-11"],
    validation_mode: "structural"
  });
  assert.deepEqual(plan.complete, ["2024-01-02", "2024-01-06"]);
  assert.deepEqual(plan.missing, ["2024-01-10", "2024-01-11"]);
  assert.equal(plan.next_date, "2024-01-10");

  const restart = ledger.mergeLedger(first.ledger, {
    records: [
      byKey("structural|2024-01-02"),
      byKey("structural|2024-01-06"),
      byKey("structural|2024-01-10")
    ],
    dataset,
    capturedAt: "2026-11-21T09:05:00.000Z",
    label: "restart"
  });
  assert.deepEqual(restart.added.map((entry) => entry.key), ["structural|2024-01-10"]);
  assert.deepEqual(restart.duplicates.map((entry) => entry.key), ["structural|2024-01-02", "structural|2024-01-06"]);
  assert.equal(restart.ledger.records.length, 3);
  assert.equal(ledger.summarise(restart.ledger).duplicates_prevented, 2);

  const reingest = ledger.mergeLedger(restart.ledger, {
    records: [byKey("structural|2024-01-02"), byKey("structural|2024-01-06"), byKey("structural|2024-01-10")],
    dataset,
    capturedAt: "2026-11-21T09:10:00.000Z",
    label: "same capture again"
  });
  assert.deepEqual(reingest.added, []);
  assert.equal(reingest.ledger.records.length, 3);
  // The capture is unchanged, so the durable rows, the run list and the update stamp are unchanged:
  // only the first write wins and a replayed execution is recognised by its parent execution id.
  assert.deepEqual(reingest.ledger.records, restart.ledger.records);
  assert.deepEqual(reingest.ledger.runs, restart.ledger.runs);
  assert.equal(reingest.ledger.updated_at, restart.ledger.updated_at);
});

test("the receipted gate is a separate key, not an overwrite of the structural call", () => {
  const merged = ledger.mergeLedger(null, {
    records: [byKey("structural|2024-01-10"), byKey("receipted|2024-01-10")],
    dataset,
    capturedAt: "2026-11-21T09:00:00.000Z"
  });
  assert.equal(merged.ledger.records.length, 2);
  const summary = ledger.summarise(merged.ledger);
  assert.equal(summary.by_validation_mode.structural.allowed, 1);
  assert.equal(summary.by_validation_mode.receipted.blocked, 1);
  assert.deepEqual(summary.dates, ["2024-01-10"]);
  assert.equal(summary.records, 2);
});

test("the plan covers weekdays and names a morning the panel does not hold", () => {
  assert.deepEqual(ledger.planRange({ from: "2024-01-05", to: "2024-01-09" }),
    ["2024-01-05", "2024-01-08", "2024-01-09"]);
  assert.throws(() => ledger.planRange({ from: "2024-01-09", to: "2024-01-05" }), /before/);
  assert.throws(() => ledger.resumePlan(null, { dates: ["06/01/2024"] }), /YYYY-MM-DD/);
});

test("the dashboard view keeps refusals and unverified rows visible", () => {
  const merged = ledger.mergeLedger(null, {
    records: [
      byKey("structural|2024-01-10"),
      byKey("receipted|2024-01-10"),
      byKey("structural|2024-01-06"),
      byKey("structural|2024-01-02")
    ],
    dataset,
    capturedAt: "2026-11-21T09:00:00.000Z"
  });
  const rows = ledger.rowsForView(merged.ledger, "structural");
  assert.deepEqual(rows.map((row) => row.date), ["2024-01-02", "2024-01-06", "2024-01-10"]);
  assert.ok(rows.every((row) => row.verified));
  assert.equal(rows.find((row) => row.date === "2024-01-02").outcome, "abstained");
  assert.equal(rows.find((row) => row.date === "2024-01-06").outcome, "blocked");
  assert.equal(rows.find((row) => row.date === "2024-01-10").scored, 4);
});
