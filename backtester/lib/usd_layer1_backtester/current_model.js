"use strict";

/**
 * The current USD model, replayed on the same 05:00 snapshot as the challenger (research only).
 *
 * Nothing about the current model is changed, re-fitted or re-weighted here. The production replay core
 * (`backtester/replay/usd/usd_replay_core.js`) scores the snapshot with its own factor rules and its own
 * conviction model; this module only shapes the input row and bands the conviction it returns, so the
 * comparison is between two readings of the same morning rather than between two hand-tuned outputs.
 */

const {
  buildReplayOutput,
  normalizeSnapshotPayload,
  parseLogicVersion
} = require("../../replay/usd/usd_replay_core");
const { CONVICTION, CURRENT_MODEL_VERSION } = require("./contracts");

/** The production snapshot builder's own regime rule, restated so it is visible in one place. */
function deriveEquitiesRegime(vixLevel) {
  if (!Number.isFinite(vixLevel)) return null;
  if (vixLevel < 16) return "risk_on";
  if (vixLevel > 25) return "risk_off";
  return "neutral";
}

/** Band the current model's own 0-100 conviction onto the shared 1-5 scale. */
function bandConviction(confidence) {
  if (!Number.isFinite(confidence)) return null;
  for (const band of CONVICTION.current_model_mapping.bands) {
    if (confidence >= band.min) return band.conviction;
  }
  return 1;
}

/** Plain direction for scoring: a lean still points somewhere, NO_CLEAR_BIAS does not. */
function baseDirection(label) {
  const text = String(label || "").toUpperCase();
  if (text.startsWith("BULLISH")) return "BULLISH";
  if (text.startsWith("BEARISH")) return "BEARISH";
  return "NO_CALL";
}

/** Shape one snapshot into the row the production replay core expects. */
function toReplayRow(snapshot) {
  const values = snapshot.values || {};
  return {
    snapshot_date: snapshot.date,
    us_2y_yield: values.us_2y_yield,
    us_2y_d5_bps: values.us_2y_d5_bps,
    us_2y_d20_bps: values.us_2y_d20_bps,
    us_de_2y_spread: null,
    us_de_2y_spread_d5_bps: null,
    us_10y_real_yield: values.us_10y_real_yield,
    us_10y_real_yield_d5_bps: values.us_10y_real_d5_bps,
    us_10y_real_yield_d20_bps: values.us_10y_real_d20_bps,
    us_10y_yield: values.us_10y_yield,
    us_10y_d5_bps: values.us_10y_d5_bps,
    vix_level: values.vix_level,
    vix_d1: values.vix_d1_chg,
    vix_d5: values.vix_d5_chg,
    dxy_level: values.broad_dollar,
    dxy_d1: values.broad_dollar_d1_pct,
    dxy_d5: values.broad_dollar_d5_pct,
    dxy_d20: values.broad_dollar_d20_pct,
    gold_price: values.gold_price,
    gold_d1_pct: values.gold_d1_pct,
    gold_d5_pct: values.gold_d5_pct,
    gold_d20_pct: values.gold_d20_pct,
    nq_price: values.nasdaq100_price,
    nq_d1_pct: values.nasdaq100_d1_pct,
    nq_d5_pct: values.nasdaq100_d5_pct,
    nq_d20_pct: values.nasdaq100_d20_pct,
    equities_regime: deriveEquitiesRegime(values.vix_level),
    latest_us_event: null,
    surprise_score: null,
    fed_bias: null,
    global_growth_context: null,
    warnings: [],
    missing_inputs: []
  };
}

/**
 * Score one snapshot with the current model.
 *
 * @param {object} snapshot a snapshot from `snapshots.buildSnapshots`.
 * @returns {object} the call record shared by both models: direction, raw score, conviction 1-5, the
 *   inputs actually used, the inputs that were missing, and a reason when no call is made.
 */
function evaluate(snapshot) {
  const logicDocumentVersion = parseLogicVersion();
  const row = toReplayRow(snapshot);
  const output = buildReplayOutput(normalizeSnapshotPayload(row), logicDocumentVersion);
  const timeframe = output.timeframe_models && output.timeframe_models.following_24hrs
    ? output.timeframe_models.following_24hrs
    : {};
  const weighted = timeframe.weighted_score || output.weighted_score || {};
  const missing = Array.isArray(output.missing_inputs) ? output.missing_inputs : [];
  const breakdown = timeframe.factor_breakdown || {};
  const factors = Object.keys(breakdown).map((name) => ({
    id: name,
    signal: breakdown[name].signal,
    weight: breakdown[name].weight,
    evidence: breakdown[name].evidence,
    reason: breakdown[name].reason
  }));
  const direction = baseDirection(output.direction_24h);

  const record = {
    model: "current",
    model_label: "Current USD model",
    version: CURRENT_MODEL_VERSION,
    logic_document_version: logicDocumentVersion,
    direction_label: output.direction_24h || null,
    direction,
    conviction: bandConviction(output.conviction_24h),
    conviction_raw: Number.isFinite(output.conviction_24h) ? output.conviction_24h : null,
    conviction_scale: "0-100 (the model's own scale, banded to 1-5)",
    raw_score: {
      bullish_weight: Number.isFinite(weighted.bullish_weight) ? weighted.bullish_weight : null,
      bearish_weight: Number.isFinite(weighted.bearish_weight) ? weighted.bearish_weight : null,
      active_weight: Number.isFinite(weighted.active_weight) ? weighted.active_weight : null,
      net_weight: Number.isFinite(weighted.bullish_weight) && Number.isFinite(weighted.bearish_weight)
        ? Math.round((weighted.bullish_weight - weighted.bearish_weight) * 10000) / 10000
        : null
    },
    factors,
    inputs_used: factors
      .filter((factor) => factor.signal && factor.signal !== "NEUTRAL")
      .map((factor) => factor.id),
    missing_inputs: missing,
    reason: direction === "NO_CALL"
      ? `the current model returned ${output.direction_24h || "no label"} on this snapshot`
      : `${output.direction_24h} at conviction ${output.conviction_24h} on the model's own 0-100 scale`
  };

  return record;
}

module.exports = {
  evaluate,
  toReplayRow,
  bandConviction,
  baseDirection,
  deriveEquitiesRegime
};
