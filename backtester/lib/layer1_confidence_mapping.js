"use strict";

/**
 * Layer 1 confidence-mapping contract.
 *
 * The dashboard-facing JSON produced behind `Build Layer 1 JSON` carries several percentages that are
 * not the same kind of quantity, and the current mapping lets one name mean all of them:
 *
 *   evidence share      - bull/bear/neutral split of the active factor weight (100 can be reached on
 *                         a single 14-point factor, so a share is not a strength and not a probability)
 *   heuristic strength  - the engine's own weighted verdict (final_conviction / the stored call
 *                         conviction) and the headline blend computed from shares, participation and
 *                         net edge, adjusted by warning penalties
 *   calibrated chance   - a probability that a specified outcome happens by a specified time, which
 *                         needs a validated calibration model and a named horizon
 *
 * Mapping rule: the three categories stay in three separate blocks, each block says what its basis
 * is, a heuristic is never published under a probability name, and `p_up_24h` stays null until a
 * calibration model exists. A quantity an engine does not publish is null, never 0: a share of no
 * active evidence is unavailable, and a missing input is unavailable rather than a zero reading.
 */

const { computeHeadlineConfidenceFromRow } = require("./headline_confidence");

const MAP_VERSION = "layer1-confidence-map-v1";
const CALIBRATION_STATUSES = ["uncalibrated", "qualified"];

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function missingFactors(factorBreakdown) {
  return Object.entries(factorBreakdown || {})
    .filter(([, entry]) => /missing/i.test(`${entry?.reason || ""} ${entry?.evidence || ""}`))
    .map(([id, entry]) => ({ id, label: String(entry?.evidence || entry?.reason || "unavailable input") }));
}

/**
 * Adapts a deterministic calculate-node row (the shape `Build Layer 1 JSON` reads before it nests
 * the 24h model under calls['24h']) to the published call shape this contract maps.
 */
function publishedCallFromRow(row, timeframe = "24h") {
  const models = row?.full_output?.timeframe_models || row?.timeframe_models || {};
  const model = models[timeframe] || {};
  return {
    direction: row?.direction_24h ?? null,
    conviction: row?.conviction_24h ?? null,
    conviction_model: model.conviction_model || row?.conviction_model || null,
    weighted_score: model.weighted_score || row?.weighted_score || null,
    factor_breakdown: model.factor_breakdown || row?.factor_breakdown || null
  };
}

function mapLayer1Confidence(publishedRow, timeframe = "24h") {
  const calls = publishedRow?.calls || {};
  const call = calls[timeframe] || calls[String(timeframe).toUpperCase()] || null;
  const model = call?.conviction_model || {};
  const participation = numberOrNull(
    model.active_participation_pct ?? model.directional_participation_pct ?? model.participation
  );
  const hasActiveEvidence = participation !== null && participation > 0;
  const bullCase = numberOrNull(model.bullish_argument_pct);
  const bearCase = numberOrNull(model.bearish_argument_pct);
  const netEdge = numberOrNull(model.net_edge_pct);
  const headline = computeHeadlineConfidenceFromRow(call || {});
  const unavailable = missingFactors(call?.factor_breakdown);
  const strengthLabel = model.verdict_strength ?? null;

  return {
    mapping_version: MAP_VERSION,
    agent: publishedRow?.agent ?? null,
    observed_at: publishedRow?.last_run_et ?? null,
    timeframe,
    direction: call?.direction ?? null,
    evidence_shares: {
      basis: "share_of_active_evidence_weight",
      bull_case_pct: hasActiveEvidence ? bullCase : null,
      bear_case_pct: hasActiveEvidence ? bearCase : null,
      neutral_evidence_pct: numberOrNull(model.neutral_evidence_pct ?? model.neutral_pct),
      directional_participation_pct: participation,
      net_edge_pct: hasActiveEvidence ? netEdge : null
    },
    heuristic_strength: {
      basis: "engine_weighted_score_and_headline_blend_not_calibrated",
      is_probability: false,
      node_final_conviction_pct: numberOrNull(model.final_conviction ?? call?.conviction),
      stored_call_conviction_pct: numberOrNull(call?.conviction),
      headline_blend_pct: numberOrNull(headline.value),
      strength_label: strengthLabel,
      strength_source:
        headline.strength && headline.strength === strengthLabel
          ? "engine_verdict_strength_override"
          : "derived_from_headline_blend"
    },
    calibrated_probability: {
      basis: "none_until_a_validated_model_exists",
      p_up_24h: null,
      calibration_version: null,
      status: "uncalibrated"
    },
    unavailable_evidence: {
      missing_factor_ids: unavailable.map((factor) => factor.id),
      missing_factor_labels: unavailable.map((factor) => factor.label),
      declared_missing_inputs: publishedRow?.missing_inputs ?? [],
      note: unavailable.length
        ? "these factors cast no vote because the input is unavailable, not because it is a zero reading"
        : "every factor carried a reading"
    },
    warnings: publishedRow?.warnings ?? []
  };
}


function assertLayer1ConfidenceMapping(mapping) {
  const problems = [];
  const fail = (message) => problems.push(message);
  for (const block of ["evidence_shares", "heuristic_strength", "calibrated_probability"]) {
    if (!mapping || typeof mapping[block] !== "object" || mapping[block] === null) fail(`${block} is missing`);
  }
  if (problems.length) throw new Error(`Layer 1 confidence mapping is invalid: ${problems.join("; ")}`);

  if (mapping.mapping_version !== MAP_VERSION) {
    fail(`mapping_version must be ${MAP_VERSION}, found ${JSON.stringify(mapping.mapping_version)}`);
  }

  const calibrated = mapping.calibrated_probability;
  const calibrationVersion = calibrated.calibration_version;
  const qualified = typeof calibrationVersion === "string" && calibrationVersion.trim() !== "";
  if (calibrated.p_up_24h !== null) {
    if (!qualified) fail("a calibrated probability must not be published without a calibration_version");
    else if (numberOrNull(calibrated.p_up_24h) === null) fail("calibrated p_up_24h must be null or a finite number");
  }
  if (!CALIBRATION_STATUSES.includes(calibrated.status)) fail(`status must be one of ${CALIBRATION_STATUSES.join(", ")}`);
  if (calibrated.status === "qualified" && !qualified) fail("status qualified requires a calibration_version");
  for (const key of Object.keys(calibrated)) {
    if (/share|evidence|conviction|strength/i.test(key)) fail(`calibrated_probability must not carry ${key}`);
  }
  for (const key of Object.keys(mapping.heuristic_strength)) {
    if (/^(confidence|probability|p_up)/i.test(key)) {
      fail(`heuristic_strength must not publish ${key}: a weighted score is not a probability`);
    }
  }
  for (const key of Object.keys(mapping.evidence_shares)) {
    if (/conviction|strength|confidence|probability/i.test(key)) {
      fail(`evidence_shares must not carry ${key}: a share of the evidence weight is not a strength`);
    }
  }
  if (mapping.heuristic_strength.is_probability !== false) fail("heuristic_strength.is_probability must be false");

  const participation = numberOrNull(mapping.evidence_shares.directional_participation_pct);
  if (participation === null || participation === 0) {
    for (const key of ["bull_case_pct", "bear_case_pct", "net_edge_pct"]) {
      if (mapping.evidence_shares[key] !== null) {
        fail(`evidence_shares.${key} must be null when there is no active evidence, not a zero share`);
      }
    }
  }
  const bullCase = numberOrNull(mapping.evidence_shares.bull_case_pct);
  if (bullCase !== null && bullCase < 0) fail("evidence shares must not be negative");

  const unavailable = mapping.unavailable_evidence || {};
  if (!Array.isArray(unavailable.missing_factor_ids)) fail("unavailable_evidence.missing_factor_ids must be a list");
  if (!Array.isArray(unavailable.missing_factor_labels)) fail("unavailable_evidence.missing_factor_labels must be a list");
  if (unavailable.missing_factor_ids?.length !== unavailable.missing_factor_labels?.length) {
    fail("every unavailable factor needs a label");
  }

  if (problems.length) throw new Error(`Layer 1 confidence mapping is invalid: ${problems.join("; ")}`);
  return true;
}

module.exports = {
  CALIBRATION_STATUSES,
  MAP_VERSION,
  assertLayer1ConfidenceMapping,
  mapLayer1Confidence,
  missingFactors,
  numberOrNull,
  publishedCallFromRow
};
