const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { MAP_VERSION, assertLayer1ConfidenceMapping, mapLayer1Confidence, publishedCallFromRow } = require("../lib/layer1_confidence_mapping");
const { computeHeadlineConfidenceFromRow } = require("../lib/headline_confidence");
const { loadExportedWorkflow, runUsdDeterministicChain } = require("../lib/usd_live_code_harness");
const { planLayer1NullConversionRepair } = require("../../scripts/lib/layer1_null_conversion_repair");

/**
 * Confidence-mapping contract for the JSON published behind `Build Layer 1 JSON`.
 * Evidence shares, heuristic strength and a calibrated probability are three different quantities and
 * must not be published under one name.
 */

const published = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../data/layer1.json"), "utf8"));
const publishedRow = (published.agents || []).find((entry) => String(entry.agent).toUpperCase() === "USD");
const mapping = mapLayer1Confidence(publishedRow);
const clone = () => JSON.parse(JSON.stringify(mapping));

const casesFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../fixtures/usd_live_replay_harness_cases.json"), "utf8")
);
const baseSnapshot = casesFixture.cases[0].snapshot;
const recordedLive = loadExportedWorkflow();
const repairedWorkflow = {
  ...recordedLive.workflow,
  nodes: planLayer1NullConversionRepair(recordedLive.workflow).payload.nodes
};

function mappingFor(row) {
  return mapLayer1Confidence({ agent: "USD", calls: { "24h": publishedCallFromRow(row) } });
}

function snapshotWithVix(value, options = {}) {
  const snapshot = JSON.parse(JSON.stringify(baseSnapshot));
  if (options.remove) delete snapshot.vix_level;
  else snapshot.vix_level = value;
  return snapshot;
}

test("evidence shares, heuristic strength and calibrated probability stay in three separate blocks", () => {
  assert.equal(assertLayer1ConfidenceMapping(mapping), true);
  assert.equal(mapping.mapping_version, MAP_VERSION);
  const blocks = ["evidence_shares", "heuristic_strength", "calibrated_probability"];
  assert.equal(new Set(blocks.map((block) => mapping[block].basis)).size, 3, "each block must state a different basis");
  const keys = blocks.map((block) => Object.keys(mapping[block]).filter((key) => key !== "basis")).flat();
  assert.equal(new Set(keys).size, keys.length, "one field must not appear in two categories");
});

test("the stored verdict and the headline blend are published as heuristics, never as a probability", () => {
  assert.equal(mapping.heuristic_strength.node_final_conviction_pct, 70);
  assert.equal(mapping.heuristic_strength.stored_call_conviction_pct, 70);
  assert.equal(mapping.heuristic_strength.headline_blend_pct, 58);
  assert.equal(mapping.heuristic_strength.headline_blend_pct, computeHeadlineConfidenceFromRow(publishedRow.calls["24h"]).value);
  assert.equal(mapping.heuristic_strength.strength_label, "VERY_STRONG");
  assert.equal(mapping.heuristic_strength.strength_source, "derived_from_headline_blend");
  assert.equal(mapping.heuristic_strength.is_probability, false);
  assert.equal(mapping.calibrated_probability.p_up_24h, null);
  assert.equal(mapping.calibrated_probability.calibration_version, null);
  assert.equal(mapping.calibrated_probability.status, "uncalibrated");
  assert.equal(mapping.evidence_shares.bull_case_pct, 70);
  assert.equal(mapping.evidence_shares.bear_case_pct, 30);
  assert.equal(mapping.evidence_shares.directional_participation_pct, 54);
  assert.equal(mapping.evidence_shares.net_edge_pct, 40);
  assert.equal(mapping.evidence_shares.neutral_evidence_pct, 46);
});

test("the validator refuses any mapping that mixes the three categories", () => {
  const withCalibration = clone();
  withCalibration.calibrated_probability = { basis: "x", p_up_24h: 0.58, calibration_version: "usd-24h-v1", status: "qualified" };
  assert.equal(assertLayer1ConfidenceMapping(withCalibration), true,
    "a named calibration model is the only way to publish a number");

  const noVersion = clone();
  noVersion.calibrated_probability.p_up_24h = 70;
  assert.throws(() => assertLayer1ConfidenceMapping(noVersion), /calibration_version/);

  const qualifiedOnly = clone();
  qualifiedOnly.calibrated_probability.status = "qualified";
  assert.throws(() => assertLayer1ConfidenceMapping(qualifiedOnly), /qualified requires/);

  const shareInProbability = clone();
  shareInProbability.calibrated_probability.evidence_share_pct = 70;
  assert.throws(() => assertLayer1ConfidenceMapping(shareInProbability), /must not carry evidence_share_pct/);

  const heuristicAsProbability = clone();
  heuristicAsProbability.heuristic_strength.confidence_pct = 58;
  assert.throws(() => assertLayer1ConfidenceMapping(heuristicAsProbability), /not a probability/);

  const strengthAsShare = clone();
  strengthAsShare.evidence_shares.strength_label = "VERY_STRONG";
  assert.throws(() => assertLayer1ConfidenceMapping(strengthAsShare), /not a strength/);

  const claimedProbability = clone();
  claimedProbability.heuristic_strength.is_probability = true;
  assert.throws(() => assertLayer1ConfidenceMapping(claimedProbability), /is_probability/);

  const zeroShare = clone();
  zeroShare.evidence_shares = { ...zeroShare.evidence_shares, bull_case_pct: 0, bear_case_pct: 0,
    directional_participation_pct: 0, net_edge_pct: 0 };
  assert.throws(() => assertLayer1ConfidenceMapping(zeroShare), /zero share/);

  const wrongVersion = clone();
  wrongVersion.mapping_version = "layer1-confidence-map-v0";
  assert.throws(() => assertLayer1ConfidenceMapping(wrongVersion), /mapping_version/);

  assert.throws(() => assertLayer1ConfidenceMapping({ mapping_version: MAP_VERSION }), /is missing/);
});

test("a missing input is mapped as unavailable evidence, while a real zero reading still counts as evidence", () => {
  const missing = snapshotWithVix(undefined, { remove: true });
  const legacy = mappingFor(runUsdDeterministicChain(recordedLive.workflow, missing, {}).row);
  const repaired = mappingFor(runUsdDeterministicChain(repairedWorkflow, missing, {}).row);

  assert.deepEqual(legacy.unavailable_evidence.missing_factor_ids, [],
    "recorded defect: the absent level was published as a real reading");
  assert.deepEqual(repaired.unavailable_evidence.missing_factor_ids, ["F1", "F10"]);
  assert.deepEqual(repaired.unavailable_evidence.missing_factor_labels, ["Missing VIX", "Missing NQ/VIX"]);
  assert.equal(repaired.evidence_shares.directional_participation_pct, 88);
  assert.equal(legacy.evidence_shares.directional_participation_pct, 99);
  assert.equal(assertLayer1ConfidenceMapping(repaired), true);
  assert.equal(repaired.calibrated_probability.p_up_24h, null);

  const zero = mappingFor(runUsdDeterministicChain(repairedWorkflow, snapshotWithVix(0), {}).row);
  assert.deepEqual(zero.unavailable_evidence.missing_factor_ids, [], "vix 0 is evidence, not an absent input");
  assert.equal(zero.evidence_shares.directional_participation_pct, 99);
  assert.equal(zero.heuristic_strength.is_probability, false);
  assert.equal(assertLayer1ConfidenceMapping(zero), true);
});
