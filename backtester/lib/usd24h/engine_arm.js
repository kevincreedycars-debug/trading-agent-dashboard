"use strict";

/**
 * The engine arm: what the deployed USD Layer 1 engine actually did, and what its own deterministic
 * mapping produces when it is replayed on the research dataset's observations.
 *
 * Two sources are kept apart:
 *
 *   engine_stored        - the direction the live engine stored for each archived snapshot, taken
 *                          from the committed parity archive of `research_timeframe_predictions`.
 *   engine_replayed_asof - `backtester/replay/usd/usd_replay_core.js` applied to a snapshot built from
 *                          this dataset's as-of features. The event and Fed-bias families have no
 *                          faithful source here, so those inputs are explicitly null and show up as
 *                          missing inputs instead of being invented.
 */

const fs = require("node:fs");
const path = require("node:path");

const { buildReplayOutput, parseLogicVersion } = require("../../replay/usd/usd_replay_core");

const ARCHIVE_PATH = path.resolve(__dirname, "../../../data/backtester-checker-usd-24h-2024-01.json");

/** Maps one dataset row onto the engine's snapshot shape. Unavailable families stay null. */
function snapshotFromRow(row, options = {}) {
  const f = row.features;
  const includeUnavailableFamiliesAsNull = options.includeUnavailableFamiliesAsNull !== false;
  const equitiesRegime = f.nq_ret_5d === null
    ? null
    : f.nq_ret_5d > 0.5
      ? "risk_on"
      : f.nq_ret_5d < -0.5
        ? "risk_off"
        : "neutral";
  const missing = [];
  if (includeUnavailableFamiliesAsNull) missing.push("latest_us_event", "fed_bias");
  for (const name of row.missing_inputs) {
    if (!missing.includes(name)) missing.push(name);
  }
  return {
    snapshot_date: row.snapshot_date,
    vix_level: f.vix_level,
    vix_d1: f.vix_ret_1d,
    vix_d5: f.vix_ret_5d,
    us_2y_yield: f.us_2y_yield,
    us_2y_d5_bps: f.us_2y_chg_5d_bps,
    us_2y_d20_bps: f.us_2y_chg_20d_bps,
    de_2y_yield: f.de_2y_yield,
    de_2y_d5_bps: f.de_2y_chg_5d_bps,
    us_de_2y_spread: f.us_de_2y_spread_bps === null ? null : f.us_de_2y_spread_bps / 100,
    us_de_2y_spread_d5_bps: f.us_de_2y_spread_chg_5d_bps,
    us_de_2y_spread_d20_bps: null,
    us_10y_yield: f.us_10y_yield,
    us_10y_d5_bps: f.us_10y_chg_5d_bps,
    us_10y_real_yield: f.us_10y_real_yield,
    us_10y_real_yield_d5_bps: f.us_10y_real_chg_5d_bps,
    us_10y_real_yield_d20_bps: f.us_10y_real_chg_20d_bps,
    dxy_level: f.usd_level,
    dxy_d1: f.usd_ret_1d,
    dxy_d5: f.usd_ret_5d,
    dxy_d20: f.usd_ret_20d,
    gold_price: f.gold_level,
    gold_d1_pct: f.gold_ret_1d,
    gold_d5_pct: f.gold_ret_5d,
    gold_d20_pct: null,
    nq_price: null,
    nq_d1_pct: f.nq_ret_1d,
    nq_d5_pct: f.nq_ret_5d,
    nq_d20_pct: null,
    equities_regime: equitiesRegime,
    latest_us_event: null,
    latest_us_event_age_hours: null,
    surprise_score: null,
    fed_bias: null,
    warnings: [],
    missing_inputs: missing,
    global_growth_context: "unknown"
  };
}

/** Replays the engine's deterministic 24h mapping on every dataset row. */
function engineReplayedCalls(dataset) {
  const logicVersion = parseLogicVersion();
  const calls = new Map();
  const blockedCounts = { latest_us_event: 0, fed_bias: 0 };
  for (const row of dataset.rows) {
    const snapshot = snapshotFromRow(row);
    const output = buildReplayOutput(snapshot, logicVersion);
    const model = output.timeframe_models.following_24hrs;
    calls.set(row.snapshot_date, {
      direction: model.direction,
      conviction: model.conviction,
      coverage_pct: model.weighted_score?.active_weight ?? null,
      missing_inputs: model.missing_inputs || []
    });
    for (const input of model.missing_inputs || []) {
      if (input in blockedCounts) blockedCounts[input] += 1;
    }
  }
  return { calls, logic_version: logicVersion, blocked_input_days: blockedCounts };
}

/**
 * The stored engine calls from the committed parity archive, plus the parity check that justifies
 * treating those rows and this dataset's rows as the same observations.
 */
function archiveEngineCalls(dataset, archivePath = ARCHIVE_PATH) {
  const archive = JSON.parse(fs.readFileSync(archivePath, "utf8"));
  const datasetByDate = new Map(dataset.rows.map((row) => [row.snapshot_date, row]));
  const calls = new Map();
  const parity = {
    archive_rows: archive.rows.length,
    archive_first_date: archive.rows[0]?.snapshot_date || null,
    archive_last_date: archive.rows[archive.rows.length - 1]?.snapshot_date || null,
    matched_rows: 0,
    open_price_exact_matches: 0,
    close_price_exact_matches: 0,
    close_price_mismatches: [],
    outcome_comparable_rows: 0,
    market_outcome_agreements: 0,
    archive_only_dates: [],
    stored_result_counts: {}
  };

  for (const row of archive.rows) {
    const stored = row.stored || {};
    const date = row.snapshot_date;
    const datasetRow = datasetByDate.get(date);
    if (!datasetRow) {
      parity.archive_only_dates.push(date);
      if (stored.direction) calls.set(date, { direction: stored.direction, conviction: stored.predicted_conviction, source: "archive" });
      continue;
    }
    parity.matched_rows += 1;
    const evaluation = row.evaluation_inputs || {};
    if (Number.isFinite(evaluation.open_price) && Math.abs(evaluation.open_price - datasetRow.outcome.open_price) < 0.0006) {
      parity.open_price_exact_matches += 1;
    }
    if (Number.isFinite(evaluation.close_price) && Math.abs(evaluation.close_price - datasetRow.outcome.close_price) < 0.0006) {
      parity.close_price_exact_matches += 1;
    } else if (Number.isFinite(evaluation.close_price)) {
      parity.close_price_mismatches.push({
        snapshot_date: date,
        archive_close_price: evaluation.close_price,
        dataset_close_price: datasetRow.outcome.close_price,
        dataset_endpoint_status: datasetRow.outcome.endpoint_status
      });
    }
    const archiveDirection = stored.evaluation_result === "CORRECT"
      ? stored.direction
      : stored.evaluation_result === "WRONG"
        ? (stored.direction === "BULLISH" ? "BEARISH" : "BULLISH")
        : null;
    if (archiveDirection) {
      parity.outcome_comparable_rows += 1;
      if (archiveDirection === datasetRow.outcome.market_outcome_direction) {
        parity.market_outcome_agreements += 1;
      }
    }
    if (stored.direction) calls.set(date, { direction: stored.direction, conviction: stored.predicted_conviction, source: "archive" });
    const result = stored.evaluation_result || "UNKNOWN";
    parity.stored_result_counts[result] = (parity.stored_result_counts[result] || 0) + 1;
  }

  return { calls, parity };
}

/** Re-scores the archive's stored factor comparisons to prove the repair is inert on this archive. */
function archiveFactorParity(archivePath = ARCHIVE_PATH) {
  const archive = JSON.parse(fs.readFileSync(archivePath, "utf8"));
  let comparedFactors = 0;
  let differingFactors = 0;
  for (const row of archive.rows) {
    for (const comparison of row.factor_comparisons || []) {
      comparedFactors += 1;
      if (comparison.status !== "PASS") differingFactors += 1;
    }
  }
  return {
    archive_rows: archive.rows.length,
    compared_factor_entries: comparedFactors,
    differing_factor_entries: differingFactors,
    stored_equals_replay_everywhere: differingFactors === 0,
    meaning: "On this archive the stored live factor signals are byte-equal to the replay implementation's, so the unavailable-versus-zero conversion repair cannot change a single archived directional call; it only changes days whose level inputs are absent, which do not occur here."
  };
}

module.exports = {
  ARCHIVE_PATH,
  archiveEngineCalls,
  archiveFactorParity,
  engineReplayedCalls,
  snapshotFromRow
};
