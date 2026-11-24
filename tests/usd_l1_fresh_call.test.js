"use strict";

// Guards the fresh-call proof behind the Backtesting tab's Layer 1 map: the committed record is what the
// committed parent glue, the pinned Cloud bundle and run-v1.json produce, the payload the child receives
// carries no stored call, the call moves when an input moves, and the one captured Cloud execution agrees
// with the same morning recomputed here. Research only: every guard reads files. No workflow is activated,
// executed or edited by this suite.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const proof = require("../scripts/prove_usd_l1_fresh_call");

const ROOT = path.join(__dirname, "..");
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8").replace(/^\uFEFF/, ""));

const RECORD_PATH = "data/usd-layer1-backtester/n8n/fresh-call-v1.json";
const RECORD = readJson(RECORD_PATH);
const DATES = Array.from(new Set(RECORD.cases.map((entry) => entry.date))).sort();

test("the committed proof is what this checkout recomputes", () => {
  const rebuilt = proof.buildRecord({
    run: readJson("data/usd-layer1-backtester/run-v1.json"),
    dates: DATES,
    createdAt: RECORD.created_at
  });
  assert.equal(proof.comparable(rebuilt), proof.comparable(RECORD),
    "data/usd-layer1-backtester/n8n/fresh-call-v1.json is stale - regenerate with node scripts/prove_usd_l1_fresh_call.js --write");
  assert.equal(rebuilt.verdict.status, "recomputed_from_cutoff_inputs");
  assert.deepEqual(rebuilt.verdict.blocking, []);
});

test("the verdict states the checks that were made", () => {
  const verdict = RECORD.verdict;
  assert.equal(verdict.child_computes_call, true);
  assert.equal(verdict.payload_carried_no_prediction, true);
  assert.equal(verdict.scoring_recomputed_from_outcomes, true);
  assert.equal(verdict.call_changed_when_an_input_changed, true);
  assert.equal(RECORD.totals.cases, RECORD.cases.length);
  assert.equal(RECORD.totals.calls_matching_published, RECORD.cases.length);
  assert.ok(RECORD.totals.probes_that_moved_the_call > 0, "no input negation moved a call");
});

test("a row stripped of its stored call still carries the cutoff inputs, and outcomes when asked", () => {
  const session = readJson("data/usd-layer1-backtester/run-v1.json").sessions[0];
  const withoutCall = proof.stripSession(session, { keepOutcomes: false });
  assert.equal(withoutCall.models, undefined);
  assert.equal(withoutCall.results, undefined);
  assert.equal(withoutCall.outcomes, undefined);
  assert.equal(withoutCall.cutoff_at_utc, session.cutoff_at_utc);
  assert.deepEqual(withoutCall.saved_inputs, session.saved_inputs);
  assert.deepEqual(withoutCall.inputs, session.inputs);

  const withOutcomes = proof.stripSession(session, { keepOutcomes: true });
  assert.deepEqual(withOutcomes.outcomes, session.outcomes);
});

test("every child input the rehearsal built was free of a prediction field", () => {
  assert.ok(RECORD.payload_inspection.length > 0);
  for (const entry of RECORD.payload_inspection) {
    assert.deepEqual(entry.prediction_fields_present, [], `${entry.date} ${entry.model} carried a prediction field`);
    assert.ok(entry.session_keys.includes("saved_inputs"), "the child input did not carry the saved inputs");
    assert.ok(entry.session_keys.includes("cutoff_at_utc"), "the child input did not carry the cutoff");
    assert.ok(!entry.session_keys.includes("models"), "the child input still carried the per-model answers");
    assert.deepEqual(entry.not_scanned, proof.SCORING_TARGET_KEYS);
  }
});

test("the identity the record pins is the bundle the manifest pins", () => {
  const manifest = readJson("automation/n8n/usd-l1-cloud-workflows.manifest.json");
  assert.equal(RECORD.deployed_identity.bundle_sha256, manifest.bundle_sha256);
  assert.equal(RECORD.deployed_identity.bundle_version, manifest.bundle_version);
  assert.equal(RECORD.deployed_identity.parent_workflow_name, manifest.parent.name);
  assert.equal(RECORD.deployed_identity.parent_webhook_path, manifest.parent.webhook_path);
  assert.equal(RECORD.deployed_identity.parent_workflow_id, RECORD.live_call.workflow.id,
    "the parent id in the record is not the workflow the capture called");
  assert.deepEqual(
    RECORD.deployed_identity.child_workflows.map((entry) => entry.workflow_id),
    manifest.children.map((entry) => entry.workflow_id)
  );
  for (const entry of RECORD.cases) assert.equal(entry.bundle_sha256, manifest.bundle_sha256);
});

test("the captured Cloud call is the same call, from the same workflow, on the same morning", () => {
  const live = RECORD.live_call;
  assert.equal(live.status, "captured", "no Cloud execution is recorded; run scripts/capture_usd_l1_fresh_call.js");
  assert.equal(live.agrees_with_recomputation, true);
  assert.ok(live.execution && live.execution.id, "the capture carries no parent execution id");
  assert.match(live.execution.url, /^https:\/\/[^/]+\/execution\/\d+$/);
  assert.equal(live.workflow.deactivated_after_capture, true, "the controller must be left inactive after a capture");
  assert.equal(live.workflow.activated_for_capture, true);
  assert.ok(live.child_executions.length >= 2);
  for (const entry of live.child_executions) {
    assert.ok(entry.execution_id, `${entry.model} carried no child execution id`);
    assert.match(entry.execution_url, /^https:\/\/[^/]+\/execution\/\d+$/);
  }
  for (const call of live.calls) {
    assert.ok(call.recomputed, `${call.date} ${call.model} has no local recomputation to compare with`);
    assert.equal(call.agrees, true);
    assert.equal(call.live.direction, call.recomputed.direction);
    assert.equal(call.live.conviction, call.recomputed.conviction);
  }
  const capture = readJson(live.capture_file);
  assert.equal(String(capture.n8n.execution_id), live.execution.id, "the capture file is not the recorded execution");
  assert.deepEqual(Object.keys(capture.models).sort(), live.request.models.slice().sort());
  assert.equal(capture.date, live.request.dates[0]);
});


test("the payload scan names a stored call but not the realised outcome", () => {
  const hits = proof.findPredictionFields({
    date: "2024-01-10",
    direction: "BULLISH",
    nested: { conviction: 2, call: {} },
    outcomes: { EURUSD: { direction: "up", conviction: null } }
  });
  assert.deepEqual(hits.sort(), ["direction", "nested.call", "nested.conviction"]);
});
