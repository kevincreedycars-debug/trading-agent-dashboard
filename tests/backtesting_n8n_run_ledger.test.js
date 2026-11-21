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

test("a record that declares a model it did not return is rejected instead of half-saved", () => {
  const record = JSON.parse(JSON.stringify(byKey("structural|2024-01-10")));
  record.selection = ["challenger", "challenger_v1"];
  delete record.models.challenger_v1;
  assert.throws(() => ledger.normaliseRecord(record), /declares the model challenger_v1/);
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
  assert.equal(rows.find((row) => row.date === "2024-01-10").calls.find((call) => call.key === "challenger").scored, 4);
});

// --- arbitrary model sets, experiment identity and separated claims -------------------------------

const controller = require("../backtester/lib/usd_layer1_backtester/backtest_controller");
const registry = require("../backtester/lib/usd_layer1_backtester/model_registry");

function availabilityFor(decision) {
  const validation = decision.validation || {};
  const inputs = validation.inputs || {};
  const receipted = validation.receipted || {};
  return {
    cutoff_at_utc: validation.cutoff_at_utc || null,
    contract_cutoff_at_utc: validation.contract_cutoff_at_utc || null,
    structural_accepted: validation.structural_accepted === undefined ? validation.accepted : validation.structural_accepted,
    accepted: validation.accepted === true,
    reasons: (validation.reasons || []).map((reason) => reason.code),
    declared_inputs: inputs.declared === undefined ? null : inputs.declared,
    present_inputs: inputs.present === undefined ? null : inputs.present,
    missing_inputs: inputs.missing === undefined ? null : inputs.missing,
    missing_keys: inputs.missing_keys || [],
    stamped_before_cutoff: inputs.stamped_before_cutoff === undefined ? null : inputs.stamped_before_cutoff,
    receipted_complete: receipted.complete === true,
    unclocked_keys: receipted.unclocked_keys || []
  };
}

/**
 * Assemble the record the generated Cloud parent returns, without calling n8n: the same controller, the
 * same selection and the same identity fields. `bundle` and `tests` are knobs so a changed configuration
 * can be exercised deliberately.
 */
function cloudRecord(date, models, { validation = "structural", executionBase = 9000, bundle = "a".repeat(64), tests = null } = {}) {
  const calls = {};
  const gates = {};
  models.forEach((key, index) => {
    const entry = registry.requireModel(key);
    const run = controller.runBacktest({ dataset, model: key, dates: [date], validationMode: validation, includeDecisions: true });
    const decision = run.decisions[0];
    calls[key] = {
      identity: entry.identity,
      label: entry.label,
      role: entry.role,
      kind: entry.kind,
      fixture: entry.fixtures === true,
      model_version: decision.model_version,
      workflow_id: `workflow-${key}`,
      workflow_name: `USD Layer 1 - ${entry.label} (Cloud adapter)`,
      execution_id: String(executionBase + index),
      execution_url: `https://example.test/execution/${executionBase + index}`,
      decision
    };
    gates[key] = availabilityFor(decision);
  });
  const first = calls[models[0]].decision;
  const research = models.filter((key) => registry.requireModel(key).kind === "research");
  const directions = research.map((key) => calls[key].decision.call.direction);
  return {
    schema_version: "usd-l1-n8n-cloud-execution-v2",
    generated_at: "2026-11-21T09:00:00.000Z",
    date,
    validation_mode: validation,
    selection: models.slice(),
    registry: { version: registry.REGISTRY_VERSION, fingerprint: "registry-fingerprint" },
    dataset: { path: "data/usd-layer1-backtester/run-v1.json", run_version: dataset.run.run_version, generated_at: dataset.generated_at },
    models: calls,
    input_availability: gates[models[0]],
    input_availability_by_model: gates,
    comparison: {
      models: models.reduce((map, key) => {
        map[key] = calls[key].decision.call.direction;
        return map;
      }, {}),
      research_models: research,
      same_direction: research.length > 1 ? new Set(directions).size === 1 : null
    },
    identity: {
      schema_version: "usd-l1-experiment-identity-v1",
      selection: models.slice(),
      models: models.reduce((map, key) => {
        const entry = registry.requireModel(key);
        map[key] = {
          identity: entry.identity,
          version: entry.version,
          role: entry.role,
          kind: entry.kind,
          source: entry.source,
          input_contract_version: entry.input_contract.contract_version
        };
        return map;
      }, {}),
      code: { bundle_version: "usd-l1-cloud-runtime-v2", bundle_sha256: bundle, controller_version: controller.CONTROLLER_VERSION },
      input: {
        dataset_path: "data/usd-layer1-backtester/run-v1.json",
        dataset_run_version: dataset.run.run_version,
        dates: [date],
        date_count: 1
      },
      cutoff: { cutoff_at_utc: first.validation.cutoff_at_utc || null, contract_cutoff_at_utc: first.validation.contract_cutoff_at_utc || null },
      validation_policy: { mode: validation, gate: "structural or receipted as declared" },
      test_configuration: { tests }
    },
    n8n: {
      execution_id: String(executionBase + 99),
      execution_url: `https://example.test/execution/${executionBase + 99}`,
      workflow_id: "workflow-parent",
      workflow_name: "USD Layer 1 - paired controller (Cloud)"
    }
  };
}

test("any registered selection is accepted, and a fixture is never read as a book", () => {
  const record = cloudRecord("2024-01-10", ["challenger", "challenger_v1", "fixture_constant"]);
  const row = ledger.normaliseRecord(record, { dataset });
  assert.deepEqual(row.selection, ["challenger", "challenger_v1", "fixture_constant"]);
  assert.equal(row.calls.fixture_constant.role, "fixture");
  assert.equal(row.calls.fixture_constant.fixture, true);
  assert.equal(row.calls.challenger_v1.role, "challenger");
  assert.equal(row.outcome, row.calls.challenger.status);
  assert.equal(row.model_outcomes.fixture_constant, row.calls.fixture_constant.status);
  assert.equal(row.executions.children.fixture_constant.id, "9002");
  assert.equal(row.executions.fixture_constant.id, "9002");

  const verified = ledger.verifyRecord(row, dataset);
  assert.equal(verified.verified, true, verified.mismatches.map((entry) => entry.check).join(","));

  // A one-model run is just as valid as a three-model run; the controller names no fixed pair.
  const single = ledger.normaliseRecord(cloudRecord("2024-01-10", ["fixture_constant"], { executionBase: 9100 }), { dataset });
  assert.deepEqual(single.selection, ["fixture_constant"]);
  assert.equal(single.comparison.same_direction, null);

  const missing = cloudRecord("2024-01-10", ["challenger", "challenger_v1"], { executionBase: 9150 });
  delete missing.models.challenger_v1;
  assert.throws(() => ledger.normaliseRecord(missing), /challenger_v1/);
});

test("identical retries deduplicate while a changed configuration coexists", () => {
  const first = cloudRecord("2024-01-10", ["challenger", "challenger_v1"], { executionBase: 9200 });
  const retry = cloudRecord("2024-01-10", ["challenger", "challenger_v1"], { executionBase: 9300 });
  const merged = ledger.mergeLedger(null, { records: [first], dataset, capturedAt: "2026-11-21T09:00:00.000Z" });
  assert.equal(merged.ledger.records.length, 1);
  const replay = ledger.mergeLedger(merged.ledger, { records: [retry], dataset, capturedAt: "2026-11-21T10:00:00.000Z" });
  assert.equal(replay.ledger.records.length, 1);
  assert.equal(replay.duplicates.length, 1);
  assert.equal(replay.duplicates[0].reason, "identical configuration");
  assert.equal(replay.duplicates[0].kept_execution, "9299");

  const changedSelection = cloudRecord("2024-01-10", ["challenger", "challenger_v1", "fixture_constant"], { executionBase: 9400 });
  const coexistence = ledger.mergeLedger(replay.ledger, { records: [changedSelection], dataset, capturedAt: "2026-11-21T11:00:00.000Z" });
  assert.equal(coexistence.ledger.records.length, 2);
  assert.equal(coexistence.added.length, 1);
  const added = coexistence.ledger.records.find((row) => row.key !== "structural|2024-01-10");
  assert.match(added.key, /^structural\|2024-01-10#[0-9a-f]{8}$/);
  assert.equal(added.coexistence, true);
  assert.equal(added.duplicate_of, "structural|2024-01-10");
  assert.deepEqual(ledger.summarise(coexistence.ledger).by_validation_mode.structural.unique_dates, 1);

  const changedCode = cloudRecord("2024-01-10", ["challenger", "challenger_v1"], { executionBase: 9500, bundle: "c".repeat(64) });
  const third = ledger.mergeLedger(coexistence.ledger, { records: [changedCode], dataset, capturedAt: "2026-11-21T12:00:00.000Z" });
  assert.equal(third.ledger.records.length, 3);
  assert.equal(new Set(third.ledger.records.map((row) => row.configuration.fingerprint)).size, 3);

  const plan = ledger.resumePlan(third.ledger, { dates: ["2024-01-10"], validation_mode: "structural" });
  assert.deepEqual(plan.complete, ["2024-01-10"]);
  assert.deepEqual(plan.coexisting, ["2024-01-10"]);
  const configured = ledger.resumePlan(third.ledger, {
    dates: ["2024-01-10"],
    validation_mode: "structural",
    configuration: third.ledger.records[0].configuration.fingerprint
  });
  assert.deepEqual(configured.complete, ["2024-01-10"]);
});


test("consistency, historical availability and model logic are reported separately", () => {
  const row = ledger.normaliseRecord(cloudRecord("2024-01-10", ["challenger", "challenger_v1"]), { dataset });
  const verification = ledger.verifyRecord(row, dataset);
  assert.equal(verification.verified, true);
  assert.equal(verification.consistency_verified, true);
  assert.equal(verification.claims.consistency.status, "established");
  assert.equal(verification.claims.availability.status, "not_established");
  assert.match(verification.claims.availability.reason, /replayed the values saved in the committed panel/);
  assert.equal(verification.claims.logic.status, "not_established");
  assert.equal(verification.claims.coverage.status, "not_established");
  assert.ok(!verification.checks.some((check) => check.name === "local_replay_fixture_constant"));

  const tampered = ledger.normaliseRecord(cloudRecord("2024-01-10", ["challenger", "challenger_v1"]), { dataset });
  tampered.calls.challenger.direction = tampered.calls.challenger.direction === "BULLISH" ? "BEARISH" : "BULLISH";
  const broken = ledger.verifyRecord(tampered, dataset);
  assert.equal(broken.verified, false);
  assert.equal(broken.claims.consistency.status, "failed");
  assert.ok(broken.mismatches.some((entry) => entry.check === "local_replay_challenger"));
});

test("a failed request is retained without becoming a morning result", () => {
  const empty = ledger.emptyLedger();
  const attempt = {
    at: "2026-11-21T09:00:00.000Z",
    ok: false,
    label: "sweep chunk 1",
    requested: ["2024-01-02", "2024-01-03"],
    http_status: 502,
    error: "webhook returned 502"
  };
  const failed = ledger.recordAttempt(empty, attempt);
  assert.equal(failed.added, true);
  assert.equal(failed.ledger.records.length, 0);
  assert.equal(failed.ledger.attempts[0].requested.length, 2);
  const again = ledger.recordAttempt(failed.ledger, attempt);
  assert.equal(again.added, false);

  const report = ledger.sweepReport(failed.ledger, { dates: ["2024-01-02", "2024-01-03"], validation_mode: "structural" });
  assert.equal(report.requested_dates, 2);
  assert.equal(report.unique_dates, 0);
  assert.equal(report.records, 0);
  assert.equal(report.model_calls, 0);
  assert.equal(report.failed_attempts, 1);
  assert.deepEqual(report.plan.missing, ["2024-01-02", "2024-01-03"]);
});

test("coverage is counted per model, validation mode and configuration, and a receipted refusal is not a completed run", () => {
  const committed = readJson("data/usd-layer1-backtester/n8n/run-ledger-v1.json");
  const coverage = ledger.coverageReport(committed, { panelDates: dataset.sessions.map((session) => session.date) });
  assert.equal(coverage.panel_mornings, 725);
  const challenger = coverage.by_model.challenger;
  assert.equal(challenger.panel_mornings_available, 725);
  assert.equal(challenger.panel_mornings, 725);
  assert.equal(challenger.completed_dates, 725);
  assert.equal(challenger.by_validation_mode.receipted.completed, 0);
  assert.equal(challenger.by_validation_mode.receipted.receipted_refusals, challenger.by_validation_mode.receipted.refused);
  assert.equal(challenger.by_validation_mode.structural.refused, 1);
  assert.equal(challenger.by_validation_mode.structural.refused_absent, 1);
  const configurations = Object.values(challenger.by_configuration);
  assert.ok(configurations.length >= 3);
  const sweep = configurations.find((entry) => entry.records === 719);
  assert.ok(sweep, "the 725-morning sweep rows share one configuration signature");
  assert.equal(sweep.completed, 719);
  assert.match(sweep.date_from, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(configurations.every((entry) => entry.receipted_refusals <= entry.records));
  assert.match(challenger.statement, /per-morning rows of one sweep share a signature/);
  const fixture = coverage.by_model.fixture_constant;
  assert.equal(fixture.panel_mornings, 1);
  assert.equal(fixture.completed, 1);
});
