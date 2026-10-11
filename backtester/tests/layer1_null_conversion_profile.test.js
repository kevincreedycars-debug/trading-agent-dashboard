const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { loadExportedWorkflow, runUsdDeterministicChain } = require("../lib/usd_live_code_harness");
const { projectLiveCodeRow, projectReplayOutput } = require("../lib/usd_decision_projections");
const { buildReplayOutput, parseLogicVersion } = require("../replay/usd/usd_replay_core");
const { planLayer1NullConversionRepair } = require("../../scripts/lib/layer1_null_conversion_repair");

/**
 * Repaired-profile test. The frozen USD live-versus-replay harness keeps running the recorded live
 * engine, so its baseline stays a record of what the deployed workflow does. This file runs the same
 * recorded engine with the unavailable-versus-zero repair applied in memory and checks the repaired
 * behaviour, without rewriting the frozen baseline or the published export evidence.
 */

const casesFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../fixtures/usd_live_replay_harness_cases.json"), "utf8")
);
const baseSnapshot = casesFixture.cases[0].snapshot;
const recordedLive = loadExportedWorkflow();
const repairPlan = planLayer1NullConversionRepair(recordedLive.workflow);
const repairedWorkflow = { ...recordedLive.workflow, nodes: repairPlan.payload.nodes };
const repositoryDraft = loadExportedWorkflow(path.resolve(__dirname, "../../exports/usd_layer1_agent.json"));

function snapshotWithVix(value, options = {}) {
  const snapshot = JSON.parse(JSON.stringify(baseSnapshot));
  if (options.remove) delete snapshot.vix_level;
  else snapshot.vix_level = value;
  return snapshot;
}

function run(workflow, snapshot) {
  return runUsdDeterministicChain(workflow, snapshot, {});
}

function timeframe(row, name = "24h") {
  return (row.full_output?.timeframe_models || row.timeframe_models || {})[name] || {};
}

function factors(row, name = "24h") {
  return timeframe(row, name).factor_breakdown || row.factor_breakdown || {};
}

function signals(row, timeframe = "24h") {
  return Object.fromEntries(Object.entries(factors(row, timeframe)).map(([id, entry]) => [id, entry.signal]));
}

function directionalIds(row, timeframe = "24h") {
  return Object.entries(factors(row, timeframe))
    .filter(([, entry]) => entry.signal === "BULLISH" || entry.signal === "BEARISH")
    .map(([id]) => id);
}

function missingYetVoting(row, timeframe = "24h") {
  return Object.entries(factors(row, timeframe))
    .filter(([, entry]) => /missing/i.test(String(entry.reason || "")) && entry.signal !== "NEUTRAL")
    .map(([id, entry]) => `${id}:${entry.signal}`);
}

test("the repair targets the recorded live engine and the repository draft is already repaired", () => {
  assert.equal(recordedLive.source, "live_export");
  assert.deepEqual(repairPlan.summary.repaired, ["Calculate USD Conviction"]);
  assert.equal(repairPlan.summary.alreadyApplied, false);
  const draftPlan = planLayer1NullConversionRepair(repositoryDraft.workflow);
  assert.equal(draftPlan.summary.alreadyApplied, true, "exports/usd_layer1_agent.json must carry the check");
  assert.equal(draftPlan.summary.repaired.length, 0);
});

test("with every input present the repaired engine returns the recorded verdicts unchanged", () => {
  const legacy = run(recordedLive.workflow, baseSnapshot).row;
  const repaired = run(repairedWorkflow, baseSnapshot).row;
  for (const field of ["direction_24h", "conviction_24h", "direction_3_day", "conviction_3_day",
    "direction_current_week", "conviction_current_week", "direction_next_week", "conviction_next_week",
    "direction_current_month", "conviction_current_month"]) {
    assert.equal(repaired[field], legacy[field], `${field} must not move when nothing is unavailable`);
  }
  for (const timeframe of ["24h", "3d", "current_week", "next_week", "current_month"]) {
    assert.deepEqual(signals(repaired, timeframe), signals(legacy, timeframe), `${timeframe} factors must not move`);
  }
  assert.deepEqual(missingYetVoting(repaired), []);
});

test("an unavailable vix casts no directional vote, while a real zero or a negative reading still casts one", () => {
  const unavailable = [undefined, null, "", "   ", "N/A", "no data"];
  for (const value of unavailable) {
    const snapshot = value === undefined ? snapshotWithVix(undefined, { remove: true }) : snapshotWithVix(value);
    const repaired = run(repairedWorkflow, snapshot).row;
    const legacy = run(recordedLive.workflow, snapshot).row;
    assert.equal(signals(repaired).F1, "NEUTRAL", `vix_level ${JSON.stringify(value)} must not vote`);
    assert.equal(signals(repaired).F9, "NEUTRAL", `vix_level ${JSON.stringify(value)} must not vote through F9`);
    assert.equal(signals(repaired).F10, "NEUTRAL", `vix_level ${JSON.stringify(value)} must not vote through F10`);
    assert.equal(factors(repaired).F1.reason, "Missing input");
    assert.deepEqual(missingYetVoting(repaired), []);
    assert.equal(timeframe(repaired).weighted_score.active_weight, 88);
    if (value === null || value === "" || value === "   " || value === undefined) {
      assert.equal(signals(legacy).F1, "BEARISH", "recorded defect: the absent level became a bearish vote");
    } else {

    }
  }
  for (const value of [0, -3, 40]) {
    const repaired = run(repairedWorkflow, snapshotWithVix(value)).row;
    const legacy = run(recordedLive.workflow, snapshotWithVix(value)).row;
    assert.equal(signals(repaired).F1, signals(legacy).F1, `vix_level ${value} is real evidence and must keep voting`);
    assert.equal(signals(repaired).F1, value < 16 ? "BEARISH" : "BULLISH");
    assert.equal(timeframe(repaired).weighted_score.active_weight, 99);
  }
});

test("the frozen missing_vix_level case closes the coverage gap against the replay engine", () => {
  const entry = casesFixture.cases.find((candidate) => candidate.id === "missing_vix_level");
  const snapshot = JSON.parse(JSON.stringify(baseSnapshot));
  for (const key of entry.snapshot_remove || []) delete snapshot[key];
  Object.assign(snapshot, entry.snapshot_patch || {});
  assert.equal(snapshot.vix_level, undefined);

  const legacyRun = run(recordedLive.workflow, snapshot);
  const repairedRun = run(repairedWorkflow, snapshot);
  const replay = projectReplayOutput(buildReplayOutput(snapshot, parseLogicVersion()));
  const legacyProjection = projectLiveCodeRow(legacyRun.row, legacyRun.inputPack);
  const repairedProjection = projectLiveCodeRow(repairedRun.row, repairedRun.inputPack);

  assert.deepEqual(repairedProjection.coverage.declared_missing_inputs, ["vix_level"]);
  assert.equal(legacyProjection.coverage.active_weight, 99);
  assert.equal(legacyProjection.coverage.missing_evidence_factor_count, 0);
  assert.equal(repairedProjection.coverage.active_weight, 88);
  assert.equal(repairedProjection.coverage.active_weight, replay.coverage.active_weight);
  assert.equal(repairedProjection.coverage.missing_evidence_factor_count, 2);
  assert.equal(repairedProjection.coverage.missing_evidence_factor_count, replay.coverage.missing_evidence_factor_count);
  assert.equal(repairedProjection.factor_contributions.find((factor) => factor.id === "F1").signal, "NEUTRAL");
  assert.equal(repairedProjection.factor_contributions.find((factor) => factor.id === "F1").reason_is_missing_input, true);
  assert.equal(legacyProjection.confidence_quantities.winning_side_conviction_pct, legacyRun.row.conviction_24h);
  assert.notEqual(repairedRun.row.conviction_24h, legacyRun.row.conviction_24h);
  assert.deepEqual(missingYetVoting(repairedRun.row), []);
  assert.equal(repairedRun.row.factor_breakdown.F1.evidence, "Missing VIX");
  assert.equal(directionalIds(repairedRun.row).includes("F1"), false);
  assert.equal(directionalIds(repairedRun.row).includes("F9"), false);
});

test("the published export evidence is left as the live workflow wrote it", () => {
  const published = JSON.parse(fs.readFileSync(recordedLive.path, "utf8"));
  const node = published.nodes.find((candidate) => candidate.name === "Calculate USD Conviction");
  assert.ok(node.parameters.jsCode.includes("function n(v) {\n  const x = Number(v);"),
    "the frozen live-export copy must stay the record of the deployed code");
  const recordedBaseline = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../fixtures/usd_live_replay_harness_baseline.json"), "utf8")
  );
  const recorded = recordedBaseline.cases.find((candidate) => candidate.id === "missing_vix_level");
  for (const field of ["factor_contributions.F1.signal", "factor_contributions.F10.signal",
    "coverage.active_weight", "coverage.missing_evidence_factor_count"]) {
    assert.ok(recorded.difference_fields.includes(field), `the frozen baseline must keep recording ${field}`);
  }
});

