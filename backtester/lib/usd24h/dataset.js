"use strict";

/**
 * Assembles the USD 24-hour research dataset: one row per prediction cutoff, features restricted to
 * information usable at that cutoff, and the future outcome kept in its own object.
 */

const { RESEARCH_WINDOW } = require("./series_catalogue");
const { buildFeatureRow, buildSeriesStore } = require("./features");
const { CALL_TIME_ET, OUTCOME_INSTRUMENT, OUTCOME_SERIES_KEY, buildOutcome, buildPriceIndex } = require("./outcomes");

function datasetDates(priceIndex, window) {
  return Array.from(priceIndex.keys())
    .filter((date) => date >= window.start && date <= window.end)
    .sort();
}

function summarizeCoverage(rows) {
  const evaluable = rows.filter((row) => row.outcome.evaluable);
  const endpointStatuses = {};
  const marketDirections = {};
  for (const row of rows) {
    endpointStatuses[row.outcome.endpoint_status] = (endpointStatuses[row.outcome.endpoint_status] || 0) + 1;
    if (row.outcome.evaluable) {
      const direction = row.outcome.market_outcome_direction;
      marketDirections[direction] = (marketDirections[direction] || 0) + 1;
    }
  }

  const missingByInput = {};
  for (const row of rows) {
    for (const input of row.missing_inputs) {
      missingByInput[input] = (missingByInput[input] || 0) + 1;
    }
  }

  const featureNames = rows.length ? Object.keys(rows[0].features) : [];
  const featureCompleteness = {};
  for (const name of featureNames) {
    const present = rows.filter((row) => row.features[name] !== null && row.features[name] !== undefined).length;
    featureCompleteness[name] = { present, share_pct: rows.length ? Number(((present / rows.length) * 100).toFixed(2)) : null };
  }

  const elapsed = evaluable.map((row) => row.outcome.measured_elapsed_hours).filter((value) => Number.isFinite(value));
  return {
    rows: rows.length,
    evaluable_rows: evaluable.length,
    not_evaluable_rows: rows.length - evaluable.length,
    endpoint_status_counts: endpointStatuses,
    market_outcome_direction_counts: marketDirections,
    missing_input_incidence: missingByInput,
    elapsed_hours: elapsed.length
      ? { min: Math.min(...elapsed), max: Math.max(...elapsed), median: elapsed.slice().sort((a, b) => a - b)[Math.floor(elapsed.length / 2)] }
      : null,
    feature_completeness: featureCompleteness
  };
}

/** Rounds feature values so the committed dataset does not imply precision the inputs do not have. */
function roundFeatures(features) {
  const rounded = {};
  for (const [key, value] of Object.entries(features)) {
    rounded[key] = typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(4)) : value;
  }
  return rounded;
}

function buildDataset(options = {}) {
  const window = options.window || RESEARCH_WINDOW;
  const store = buildSeriesStore(options);
  const priceIndex = buildPriceIndex(OUTCOME_SERIES_KEY, options);
  const dates = datasetDates(priceIndex, window);
  const rows = dates.map((dateLiteral) => {
    const featureRow = buildFeatureRow(store, dateLiteral);
    return {
      snapshot_date: featureRow.snapshot_date,
      cutoff_at_utc: featureRow.cutoff_at_utc,
      features: roundFeatures(featureRow.features),
      provenance: featureRow.provenance,
      missing_inputs: featureRow.missing_inputs,
      outcome: buildOutcome(dateLiteral, priceIndex)
    };
  });

  return {
    schema_version: "usd-24h-research-dataset-v1",
    window,
    call_time_et: CALL_TIME_ET,
    outcome_instrument: OUTCOME_INSTRUMENT,
    outcome_series: OUTCOME_SERIES_KEY,
    rows,
    coverage: summarizeCoverage(rows)
  };
}

module.exports = {
  buildDataset,
  datasetDates,
  summarizeCoverage
};
