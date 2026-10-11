"use strict";

/**
 * Canonical projections of one USD 24h decision, so three implementations can be compared
 * dimension by dimension instead of field by field:
 *
 *   live_code  - deterministic code nodes of the exported live workflow
 *   replay     - backtester/replay/usd/usd_replay_core.js (buildReplayOutput)
 *   dashboard  - backtester/lib/headline_confidence.js applied to the live code row
 *
 * Direction, factor contributions, coverage, participation and every confidence quantity are kept
 * apart. Nothing is averaged: a value an implementation does not publish is reported as null.
 */

const { computeHeadlineConfidenceFromRow } = require("./headline_confidence");

const FACTORS = [
  { id: "F1", label: "F1 VIX" },
  { id: "F2", label: "F2 US 2Y Yield Delta" },
  { id: "F3", label: "F3 US-DE 2Y Spread Delta" },
  { id: "F4", label: "F4 US 10Y Real Yield Delta" },
  { id: "F5", label: "F5 DXY Delta" },
  { id: "F6", label: "F6 Gold Delta" },
  { id: "F7", label: "F7 US Economic Surprise" },
  { id: "F8", label: "F8 Fed Bias" },
  { id: "F9", label: "F9 Dollar Smile" },
  { id: "F10", label: "F10 Equity Regime" }
];

const DIMENSIONS = ["direction", "factor_contributions", "coverage", "participation", "confidence_quantities"];

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function factorEntries(source, keyFor) {
  const breakdown = source || {};
  return FACTORS.map(({ id, label }) => {
    const entry = breakdown[keyFor(id, label)];
    return {
      id,
      label,
      signal: entry?.signal ?? null,
      weight: numberOrNull(entry?.weight),
      reason_is_missing_input: /missing/i.test(String(entry?.reason || ""))
    };
  });
}

function countSignals(entries) {
  const directional = (entry) => entry.signal === "BULLISH" || entry.signal === "BEARISH";
  return {
    active_factor_count: entries.filter(directional).length,
    neutral_factor_count: entries.filter((entry) => !directional(entry)).length,
    missing_evidence_factor_count: entries.filter((entry) => entry.reason_is_missing_input).length
  };
}

function projectLiveCodeRow(row, inputPack) {
  // The calculate node returns the 24h model inside full_output; timeframe_models is also read
  // directly so the projection works against either shape.
  const timeframe = (row.full_output?.timeframe_models || row.timeframe_models || {})["24h"] || {};
  const convictionModel = timeframe.conviction_model || {};
  const factors = factorEntries(timeframe.factor_breakdown || row.factor_breakdown, (id) => id);
  return {
    arm: "live_code",
    direction: { direction_24h: row.direction_24h ?? null },
    factor_contributions: factors,
    coverage: {
      active_weight: numberOrNull(timeframe.weighted_score?.active_weight),
      neutral_weight: numberOrNull(timeframe.weighted_score?.neutral_weight),
      ...countSignals(factors),
      declared_missing_inputs: inputPack?.snapshot_selection?.missing_required_inputs_for_usd ?? []
    },
    participation: {
      active_weight: numberOrNull(timeframe.weighted_score?.active_weight),
      participation_pct: numberOrNull(convictionModel.active_participation_pct),
      dashboard_participation_pct: null
    },
    confidence_quantities: {
      bull_case_pct: numberOrNull(convictionModel.bullish_argument_pct),
      bear_case_pct: numberOrNull(convictionModel.bearish_argument_pct),
      net_edge_pct: numberOrNull(convictionModel.net_edge_pct),
      winning_side_conviction_pct: numberOrNull(row.conviction_24h),
      headline_confidence_pct: null,
      strength_bucket_from_net_edge: convictionModel.verdict_strength ?? null,
      strength_bucket_from_headline: null
    }
  };
}

function projectReplayOutput(replayOutput) {
  const timeframe = replayOutput.timeframe_models?.following_24hrs || {};
  const convictionModel = timeframe.conviction_model || {};
  const factors = factorEntries(replayOutput.factor_breakdown || timeframe.factor_breakdown, (id, label) => label);
  return {
    arm: "replay_live_path",
    direction: { direction_24h: replayOutput.direction_24h ?? null },
    factor_contributions: factors,
    coverage: {
      active_weight: numberOrNull(replayOutput.weighted_score?.active_weight),
      neutral_weight: numberOrNull(replayOutput.weighted_score?.neutral_weight),
      ...countSignals(factors),
      declared_missing_inputs: replayOutput.missing_inputs ?? []
    },
    participation: {
      active_weight: numberOrNull(replayOutput.weighted_score?.active_weight),
      participation_pct: numberOrNull(convictionModel.active_participation_pct),
      dashboard_participation_pct: null
    },
    confidence_quantities: {
      bull_case_pct: numberOrNull(convictionModel.bullish_argument_pct),
      bear_case_pct: numberOrNull(convictionModel.bearish_argument_pct),
      net_edge_pct: numberOrNull(convictionModel.net_edge_pct),
      winning_side_conviction_pct: numberOrNull(
        convictionModel.legacy_winning_side_conviction ?? convictionModel.base_conviction
      ),
      headline_confidence_pct: numberOrNull(replayOutput.conviction_24h),
      strength_bucket_from_net_edge: convictionModel.legacy_floor_strength ?? null,
      strength_bucket_from_headline: convictionModel.confidence_strength ?? null
    }
  };
}

function projectDashboard(liveCodeRow) {
  // The live workflow inserts its calculate output with dataToSend=autoMapInputData, so the row the
  // dashboard receives is the calculate output itself: conviction_model/weighted_score exist only
  // inside full_output. Both variants are reported instead of picking one silently.
  const fromCalculateRow = computeHeadlineConfidenceFromRow(liveCodeRow);
  const liftedRow = {
    ...liveCodeRow,
    conviction_model: liveCodeRow.full_output?.conviction_model ?? liveCodeRow.conviction_model ?? null
  };
  const lifted = computeHeadlineConfidenceFromRow(liftedRow);
  const nodeStrength = liveCodeRow.full_output?.conviction_model?.verdict_strength ?? null;
  const winningSide = numberOrNull(liveCodeRow.conviction_24h);
  const liftedHeadline = numberOrNull(lifted.value);

  return {
    arm: "dashboard",
    row_shape_note: "Calculate output row as written to agent_outputs (autoMapInputData); the writer publishes a different, nested shape.",
    from_calculate_row: {
      headline_confidence_pct: numberOrNull(fromCalculateRow.value),
      strength_bucket: fromCalculateRow.strength ?? null,
      bull_case_pct: null,
      bear_case_pct: null,
      participation_pct: numberOrNull(fromCalculateRow.participation),
      net_edge_pct: numberOrNull(fromCalculateRow.netEdge)
    },
    with_conviction_model_lifted: {
      headline_confidence_pct: liftedHeadline,
      strength_bucket: lifted.strength ?? null,
      strength_field_used: lifted.strength === nodeStrength ? "conviction_model.verdict_strength (override in the row)" : "derived_from_headline",
      node_verdict_strength: nodeStrength,
      bull_case_pct: numberOrNull(lifted.evidenceDominance) === null ? null : numberOrNull(liftedRow.conviction_model?.bullish_argument_pct),
      bear_case_pct: numberOrNull(liftedRow.conviction_model?.bearish_argument_pct),
      participation_pct: numberOrNull(lifted.participation),
      net_edge_pct: numberOrNull(lifted.netEdge)
    },
    headline_vs_node_winning_side: {
      node_winning_side_conviction_pct: winningSide,
      lifted_headline_confidence_pct: liftedHeadline,
      differs: winningSide !== null && liftedHeadline !== null ? winningSide !== liftedHeadline : null
    }
  };
}

function dashboardContractCheck(publishedRow, options = {}) {
  const call = publishedRow?.calls?.["24h"] || publishedRow?.calls?.["24H"] || null;
  if (!call) {
    return { available: false, reason: "published row has no calls['24h'] entry" };
  }
  const shaped = {
    direction: call.direction ?? null,
    conviction: call.conviction ?? null,
    conviction_model: call.conviction_model ?? null,
    weighted_score: call.weighted_score ?? null,
    factor_breakdown: call.factor_breakdown ?? null
  };
  const result = computeHeadlineConfidenceFromRow(shaped);
  const storedFinalConviction = numberOrNull(call.conviction_model?.final_conviction ?? call.conviction);
  const storedStrength = call.conviction_model?.verdict_strength ?? null;
  return {
    available: true,
    agent: publishedRow.agent ?? null,
    observed_at: publishedRow.last_run_et ?? null,
    stored_direction: call.direction ?? null,
    stored_final_conviction: storedFinalConviction,
    stored_verdict_strength: storedStrength,
    displayed_headline_confidence_pct: numberOrNull(result.value),
    derived_strength_from_headline: result.strength ?? null,
    strength_override_used: storedStrength || null,
    strength_override_matches_derived: storedStrength && result.strength ? storedStrength === result.strength : null,
    headline_matches_stored_final_conviction:
      numberOrNull(result.value) !== null && storedFinalConviction !== null
        ? numberOrNull(result.value) === storedFinalConviction
        : null,
    expected_shape_note: options.note || null
  };
}

function vectorFromProjection(projection) {
  return FACTORS.map(({ id }) => projection.factor_contributions.find((entry) => entry.id === id)?.weight ?? null);
}

function declaredVector(weightsObject) {
  return FACTORS.map(({ label }) => (weightsObject && label in weightsObject ? weightsObject[label] : null));
}

function diffNumbers(dimension, field, left, right, differences, note) {
  if (left === right) return;
  differences.push({ dimension, field, live_code: left, replay_live_path: right, note: note || null });
}

function compareArms({ live_code: liveCode, replay_live_path: replay }, weights = {}) {
  const differences = [];

  diffNumbers("direction", "direction_24h", liveCode.direction.direction_24h, replay.direction.direction_24h, differences);

  for (const factor of FACTORS) {
    const liveFactor = liveCode.factor_contributions.find((entry) => entry.id === factor.id);
    const replayFactor = replay.factor_contributions.find((entry) => entry.id === factor.id);
    if (!liveFactor || !replayFactor) continue;
    diffNumbers("factor_contributions", `${factor.id}.signal`, liveFactor.signal, replayFactor.signal, differences, factor.label);
    diffNumbers("factor_contributions", `${factor.id}.weight`, liveFactor.weight, replayFactor.weight, differences, factor.label);
  }

  for (const field of ["active_weight", "neutral_weight", "active_factor_count", "neutral_factor_count", "missing_evidence_factor_count"]) {
    diffNumbers("coverage", field, liveCode.coverage[field], replay.coverage[field], differences);
  }
  for (const field of ["active_weight", "participation_pct"]) {
    diffNumbers("participation", field, liveCode.participation[field], replay.participation[field], differences);
  }
  for (const field of Object.keys(liveCode.confidence_quantities)) {
    diffNumbers("confidence_quantities", field, liveCode.confidence_quantities[field], replay.confidence_quantities[field], differences);
  }

  const liveCodeVector = vectorFromProjection(liveCode);
  const declaredLiveVector = declaredVector(weights.live_24h);
  const declaredRulebookVector = declaredVector(weights.rulebook);
  const vectorDifferences = {
    live_code_24h: liveCodeVector,
    declared_live_24h_path: declaredLiveVector,
    declared_rulebook: declaredRulebookVector,
    live_code_vs_declared_live: FACTORS.filter((_, index) => liveCodeVector[index] !== declaredLiveVector[index]).map((factor) => ({
      factor: factor.label,
      live_code: liveCodeVector[FACTORS.indexOf(factor)],
      declared_live: declaredLiveVector[FACTORS.indexOf(factor)]
    })),
    declared_live_vs_rulebook: FACTORS.filter((_, index) => declaredLiveVector[index] !== declaredRulebookVector[index]).map((factor) => ({
      factor: factor.label,
      declared_live: declaredLiveVector[FACTORS.indexOf(factor)],
      declared_rulebook: declaredRulebookVector[FACTORS.indexOf(factor)]
    }))
  };

  return { dimensions_compared: DIMENSIONS, differences, weight_vectors: vectorDifferences };
}

function replayHashPayload(replayOutput) {
  // buildReplayOutput stamps created_at on every run; it is the only volatile field.
  const { created_at: ignoredCreatedAt, ...stable } = replayOutput;
  return stable;
}

module.exports = {
  DIMENSIONS,
  FACTORS,
  compareArms,
  dashboardContractCheck,
  declaredVector,
  numberOrNull,
  projectDashboard,
  projectLiveCodeRow,
  projectReplayOutput,
  replayHashPayload,
  vectorFromProjection
};


