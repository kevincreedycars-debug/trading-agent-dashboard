"use strict";

/**
 * Outcome attachment for the USD 24-hour dataset.
 *
 * The window comes from the repository's own Phase 1 contract (`getPhase1OutcomeWindow`): the call
 * is dated at 09:30 ET and the close is the **16:00 ET close of the next valid trading session**,
 * which is the definition the archived USD evaluation used. That is a nominal 24-hour horizon, not
 * 24 elapsed hours, and the dataset records the measured elapsed time so the difference is visible.
 * Outcome prices are the final published values of the same series (FRED DTWEXBGS) the production
 * snapshot stores, and are kept strictly separate from the as-of features.
 */

const { classifyMarketOutcome, getFlatThreshold, scoreEvaluationResult } = require("../outcome_direction");
const { buildUtcDateFromNyParts, getPhase1OutcomeWindow } = require("../timeframe_windows");
const { loadCachedSeries } = require("./acquire");

const OUTCOME_INSTRUMENT = "DXY";
const OUTCOME_SERIES_KEY = "dxy_level";
const CALL_TIME_ET = "09:30:00";
const MAX_DELAYED_ENDPOINT_DAYS = 3;

function buildPriceIndex(key = OUTCOME_SERIES_KEY, options = {}) {
  const series = loadCachedSeries(key, options);
  const index = new Map();
  for (const observation of series.observations) {
    index.set(observation.date, observation.value);
  }
  return index;
}

function nextAvailableDate(priceIndex, afterDate, maxDays) {
  const start = Date.parse(`${afterDate}T00:00:00Z`);
  for (let offset = 1; offset <= maxDays; offset += 1) {
    const candidate = new Date(start + offset * 86400000).toISOString().slice(0, 10);
    if (priceIndex.has(candidate)) return candidate;
  }
  return null;
}

function buildOutcome(dateLiteral, priceIndex) {
  const window = getPhase1OutcomeWindow({
    assetCode: "USD",
    timeframe: "following 24hrs",
    callDate: dateLiteral,
    callTimeEt: CALL_TIME_ET
  });
  if (!window.evaluable) {
    return {
      snapshot_date: dateLiteral,
      evaluable: false,
      not_evaluable_reason: window.not_evaluable_reason,
      endpoint_status: "not_evaluable_session"
    };
  }

  const openPrice = priceIndex.get(dateLiteral) ?? null;
  const scheduledCloseDate = String(window.close_time_et_local).slice(0, 10);
  let closeDate = scheduledCloseDate;
  let closePrice = priceIndex.get(scheduledCloseDate) ?? null;
  let endpointStatus = "next_session_close_exact_date";

  if (closePrice === null) {
    const delayedDate = nextAvailableDate(priceIndex, scheduledCloseDate, MAX_DELAYED_ENDPOINT_DAYS);
    if (delayedDate) {
      closeDate = delayedDate;
      closePrice = priceIndex.get(delayedDate);
      endpointStatus = "delayed_offset_endpoint";
    } else {
      endpointStatus = "unavailable";
    }
  }

  const hasPrices = openPrice !== null && closePrice !== null;
  const pctChange = hasPrices ? ((closePrice - openPrice) / openPrice) * 100 : null;
  const flatThreshold = getFlatThreshold(OUTCOME_INSTRUMENT);
  const classification = classifyMarketOutcome(pctChange, flatThreshold);
  const closeInstantUtc = buildUtcDateFromNyParts(closeDate, "16:00:00").toISOString();
  const elapsedHours = hasPrices
    ? Number(((Date.parse(closeInstantUtc) - Date.parse(window.open_time_et)) / 3600000).toFixed(2))
    : null;

  return {
    snapshot_date: dateLiteral,
    evaluable: hasPrices,
    instrument: OUTCOME_INSTRUMENT,
    market_series: OUTCOME_SERIES_KEY,
    call_time_et_local: window.call_time_et_local,
    call_time_utc: window.call_time_et,
    scheduled_close_date: scheduledCloseDate,
    close_date_used: closeDate,
    endpoint_status: endpointStatus,
    measured_elapsed_hours: elapsedHours,
    open_price: openPrice,
    close_price: closePrice,
    pct_change: pctChange === null ? null : Number(pctChange.toFixed(6)),
    flat_threshold: flatThreshold,
    market_outcome_direction: classification.market_outcome_direction,
    classification_reason: classification.result_reason
  };
}

/** Scores one arm's call against the attached outcome using the canonical result labels. */
function evaluateCall(outcome, direction, conviction = null) {
  const scored = scoreEvaluationResult({
    agentDirection: direction,
    marketOutcomeDirection: outcome.market_outcome_direction,
    notEvaluableReason: outcome.evaluable ? null : (outcome.not_evaluable_reason || "outcome_unavailable")
  });
  return {
    direction,
    conviction,
    result: scored.result,
    result_reason: scored.result_reason
  };
}

module.exports = {
  CALL_TIME_ET,
  MAX_DELAYED_ENDPOINT_DAYS,
  OUTCOME_INSTRUMENT,
  OUTCOME_SERIES_KEY,
  buildOutcome,
  buildPriceIndex,
  evaluateCall,
  nextAvailableDate
};
