const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const { loadExportedWorkflow, runUsdDeterministicChain } = require("../lib/usd_live_code_harness");
const {
  dashboardContractCheck,
  projectDashboard,
  projectLiveCodeRow,
  projectReplayOutput,
  replayHashPayload
} = require("../lib/usd_decision_projections");
const {
  FACTOR_WEIGHTS,
  LIVE_24H_FACTOR_WEIGHTS,
  buildReplayOutput,
  parseLogicVersion
} = require("../replay/usd/usd_replay_core");

const casesFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../fixtures/usd_live_replay_harness_cases.json"), "utf8")
);
const baseline = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../fixtures/usd_live_replay_harness_baseline.json"), "utf8")
);
const baselineById = new Map(baseline.cases.map((entry) => [entry.id, entry]));
const loaded = loadExportedWorkflow();
const logicDocumentVersion = parseLogicVersion();

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function resolveSnapshot(caseId, byId = new Map(casesFixture.cases.map((entry) => [entry.id, entry]))) {
  const entry = byId.get(caseId);
  const base = entry.based_on ? byId.get(entry.based_on) : entry;
  const snapshot = JSON.parse(JSON.stringify(base.snapshot));
  for (const [key, value] of Object.entries(entry.snapshot_patch || {})) snapshot[key] = value;
  for (const key of entry.snapshot_remove || []) delete snapshot[key];
  return snapshot;
}

function runCase(caseId) {
  const entry = casesFixture.cases.find((candidate) => candidate.id === caseId);
  const snapshot = resolveSnapshot(caseId);
  const live = runUsdDeterministicChain(loaded.workflow, snapshot, { modelReport: entry.model_report || {} });
  const replayOutput = buildReplayOutput(snapshot, logicDocumentVersion);
  return {
    entry,
    snapshot,
    live,
    replayOutput,
    liveProjection: projectLiveCodeRow(live.row, live.inputPack),
    replayProjection: projectReplayOutput(replayOutput),
    dashboardProjection: projectDashboard(live.row)
  };
}

function factorSignal(projection, id) {
  return projection.factor_contributions.find((factor) => factor.id === id)?.signal ?? null;
}

test("harness runs the exported live USD code nodes, not a copy of the logic", () => {
  const workflow = loaded.workflow;
  const buildNode = workflow.nodes.find((node) => node.name === "Build USD Input Pack");
  const calculateNode = workflow.nodes.find((node) => node.name === "Calculate USD Conviction");
  assert.ok(buildNode, "Build USD Input Pack must exist in the export");
  assert.ok(calculateNode, "Calculate USD Conviction must exist in the export");
  assert.equal(loaded.source, "live_export");
  assert.ok(buildNode.parameters.jsCode.includes("$input.all()"));
  assert.ok(calculateNode.parameters.jsCode.includes("TIMEFRAME_WEIGHTS"));
});

test("every frozen case reproduces the recorded baseline exactly", () => {
  for (const entry of casesFixture.cases) {
    const recorded = baselineById.get(entry.id);
    assert.ok(recorded, `baseline missing case ${entry.id}`);
    const outcome = runCase(entry.id);
    assert.equal(sha256(outcome.live.row), recorded.live_code_row_sha256, `live code row changed for ${entry.id}`);
    assert.equal(
      sha256(replayHashPayload(outcome.replayOutput)),
      recorded.replay_output_sha256,
      `replay output changed for ${entry.id}`
    );
    assert.deepEqual(outcome.liveProjection, recorded.live_code, `live projection changed for ${entry.id}`);
    assert.deepEqual(outcome.replayProjection, recorded.replay_live_path, `replay projection changed for ${entry.id}`);
    assert.deepEqual(outcome.dashboardProjection, recorded.dashboard, `dashboard projection changed for ${entry.id}`);
  }
});

test("frozen parity snapshot: live code and replay agree on direction, factor signals, coverage and participation", () => {
  const { liveProjection, replayProjection } = runCase("frozen_parity_snapshot");
  assert.equal(liveProjection.direction.direction_24h, "BULLISH");
  assert.deepEqual(
    liveProjection.factor_contributions.map((factor) => factor.signal),
    ["BEARISH", "BULLISH", "BULLISH", "BULLISH", "BULLISH", "BEARISH", "BULLISH", "BULLISH", "NEUTRAL", "BEARISH"]
  );
  assert.deepEqual(replayProjection.factor_contributions, liveProjection.factor_contributions);
  assert.equal(liveProjection.coverage.active_weight, replayProjection.coverage.active_weight);
  assert.equal(liveProjection.coverage.active_factor_count, 9);
  assert.equal(liveProjection.confidence_quantities.winning_side_conviction_pct, 85);
  assert.equal(liveProjection.confidence_quantities.net_edge_pct, 70);
});

test("live code 24h weights equal the declared live path and differ from the declared rulebook vector", () => {
  const { liveProjection } = runCase("frozen_parity_snapshot");
  const liveVector = liveProjection.factor_contributions.map((factor) => factor.weight);
  assert.deepEqual(liveVector, [10, 14, 10, 10, 14, 4, 24, 12, 1, 1]);
  assert.deepEqual(liveVector, Object.values(LIVE_24H_FACTOR_WEIGHTS));
  const rulebookVector = Object.values(FACTOR_WEIGHTS);
  const differing = liveVector.filter((weight, index) => weight !== rulebookVector[index]);
  assert.equal(differing.length, 8);
  assert.equal(FACTOR_WEIGHTS["F7 US Economic Surprise"], 3);
  assert.equal(FACTOR_WEIGHTS["F9 Dollar Smile"], 12);
});

test("a contradicting model report cannot change the deterministic verdict", () => {
  const frozen = runCase("frozen_parity_snapshot");
  const overridden = runCase("model_verdict_overridden");
  assert.equal(overridden.live.row.direction_24h, frozen.live.row.direction_24h);
  assert.equal(overridden.live.row.conviction_24h, frozen.live.row.conviction_24h);
  assert.deepEqual(overridden.live.row.factor_breakdown, frozen.live.row.factor_breakdown);
  assert.deepEqual(overridden.liveProjection.factor_contributions, frozen.liveProjection.factor_contributions);
  assert.notEqual(
    sha256(overridden.live.row),
    sha256(frozen.live.row),
    "full_output keeps the model payload, so the row hash must differ"
  );
});

test("stale events: neither the live code nor the replay 24h path ages the event input", () => {
  const { snapshot, liveProjection, replayProjection } = runCase("stale_event");
  assert.equal(snapshot.latest_us_event.age_hours, 200);
  assert.equal(factorSignal(liveProjection, "F7"), "BULLISH");
  assert.equal(factorSignal(replayProjection, "F7"), "BULLISH");
  assert.equal(liveProjection.factor_contributions.find((factor) => factor.id === "F7").weight, 24);
});

test("unchanged hawkish bias: only F8 is active, so direction rests on 12 of 100 points", () => {
  const { liveProjection, replayProjection } = runCase("unchanged_hawkish_bias");
  const activeFactors = liveProjection.factor_contributions.filter((factor) => factor.signal !== "NEUTRAL");
  assert.deepEqual(activeFactors.map((factor) => factor.id), ["F8"]);
  assert.equal(factorSignal(liveProjection, "F8"), "BULLISH");
  assert.equal(liveProjection.coverage.active_weight, 12);
  assert.equal(liveProjection.direction.direction_24h, "BULLISH");
  assert.equal(liveProjection.confidence_quantities.winning_side_conviction_pct, 100);
  assert.equal(replayProjection.confidence_quantities.headline_confidence_pct, 39);
  assert.equal(replayProjection.coverage.active_weight, 12);
});

test("sparse inputs: the replay headline and the dashboard headline disagree", () => {
  const { liveProjection, replayProjection, dashboardProjection } = runCase("sparse_inputs");
  assert.ok(liveProjection.coverage.active_weight < 99);
  assert.equal(liveProjection.confidence_quantities.winning_side_conviction_pct, 78);
  assert.equal(replayProjection.confidence_quantities.headline_confidence_pct, 60);
  assert.equal(dashboardProjection.with_conviction_model_lifted.headline_confidence_pct, 65);
  assert.notEqual(
    replayProjection.confidence_quantities.headline_confidence_pct,
    dashboardProjection.with_conviction_model_lifted.headline_confidence_pct
  );
});

test("conflicting factors: both arms land on the same lean with the same participation", () => {
  const { liveProjection, replayProjection } = runCase("conflicting_factors");
  assert.equal(liveProjection.direction.direction_24h, "BEARISH_LEAN");
  assert.equal(replayProjection.direction.direction_24h, "BEARISH_LEAN");
  assert.equal(liveProjection.confidence_quantities.net_edge_pct, -10);
  assert.equal(liveProjection.coverage.active_weight, 76);
  assert.equal(replayProjection.coverage.active_weight, 76);
});

test("lookback substitution: the live node falls back to DXY d1 while replay bookkeeping differs", () => {
  const { snapshot, liveProjection, replayProjection } = runCase("lookback_substitution");
  assert.equal(snapshot.dxy_d5, undefined);
  assert.equal(factorSignal(liveProjection, "F5"), "BULLISH");
  assert.equal(factorSignal(replayProjection, "F5"), "BULLISH");
  assert.deepEqual(liveProjection.coverage.declared_missing_inputs, ["dxy_d5"]);
  assert.notDeepEqual(replayProjection.coverage.declared_missing_inputs, liveProjection.coverage.declared_missing_inputs);
  assert.equal(liveProjection.confidence_quantities.winning_side_conviction_pct, 89);
});

test("every case is compared across all five dimensions and matches its recorded difference fingerprint", () => {
  const { compareArms } = require("../lib/usd_decision_projections");
  for (const entry of casesFixture.cases) {
    const recorded = baselineById.get(entry.id);
    const outcome = runCase(entry.id);
    const comparison = compareArms(
      { live_code: outcome.liveProjection, replay_live_path: outcome.replayProjection },
      { live_24h: LIVE_24H_FACTOR_WEIGHTS, rulebook: FACTOR_WEIGHTS }
    );
    assert.deepEqual(comparison.dimensions_compared, [
      "direction",
      "factor_contributions",
      "coverage",
      "participation",
      "confidence_quantities"
    ]);
    assert.deepEqual(
      comparison.differences.map((difference) => `${difference.dimension}.${difference.field}`),
      recorded.difference_fields,
      `difference fingerprint changed for ${entry.id}`
    );
    assert.equal(
      outcome.dashboardProjection.from_calculate_row.headline_confidence_pct,
      null,
      `a row without conviction_model must not publish a headline (${entry.id})`
    );
  }
});

test("missing vix_level: the live node scores the absent level as zero, replay reports it missing", () => {
  const { liveProjection, replayProjection, dashboardProjection } = runCase("missing_vix_level");
  assert.equal(factorSignal(liveProjection, "F1"), "BEARISH");
  assert.equal(factorSignal(replayProjection, "F1"), "NEUTRAL");
  assert.equal(factorSignal(liveProjection, "F10"), "BEARISH");
  assert.equal(factorSignal(replayProjection, "F10"), "NEUTRAL");
  assert.equal(liveProjection.coverage.active_weight, 99);
  assert.equal(replayProjection.coverage.active_weight, 88);
  assert.deepEqual(liveProjection.coverage.declared_missing_inputs, ["vix_level"]);
  assert.equal(liveProjection.coverage.missing_evidence_factor_count, 0);
  assert.equal(replayProjection.coverage.missing_evidence_factor_count, 2);
  assert.equal(replayProjection.confidence_quantities.headline_confidence_pct, 92);
  assert.equal(dashboardProjection.with_conviction_model_lifted.headline_confidence_pct, 87);
});

test("published dashboard row: the node verdict and the dashboard headline are different numbers", () => {
  const published = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../data/layer1.json"), "utf8"));
  const usdRow = (published.agents || []).find((entry) => String(entry.agent).toUpperCase() === "USD");
  assert.ok(usdRow, "published USD row must exist in data/layer1.json");
  const contract = dashboardContractCheck(usdRow);
  assert.equal(contract.available, true);
  assert.equal(contract.stored_final_conviction, 70);
  assert.equal(contract.stored_verdict_strength, "VERY_STRONG");
  assert.equal(contract.displayed_headline_confidence_pct, 58);
  assert.equal(contract.derived_strength_from_headline, "MODERATE");
  assert.equal(contract.strength_override_matches_derived, false);
  assert.equal(contract.headline_matches_stored_final_conviction, false);
});

