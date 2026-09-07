"use strict";

const CONTRACT_VERSION = "l2l-session-close-dataset-contract-v1";

const EXCLUSION_REASONS = Object.freeze({
  INVALID_SESSION_WINDOW: "invalid_session_window",
  INVALID_DECISION_TIME: "invalid_decision_time",
  DECISION_NOT_STRICTLY_PRE_SESSION: "decision_not_strictly_pre_session",
  MISSING_FEATURES: "missing_features",
  INVALID_FEATURE: "invalid_feature",
  MISSING_FEATURE_AVAILABILITY: "missing_feature_availability",
  FEATURE_NOT_AVAILABLE_PRE_DECISION: "feature_not_available_pre_decision",
  INVALID_OUTCOME: "invalid_outcome"
});

function parseUtcMillis(value) {
  if (typeof value !== "string" || !value.endsWith("Z")) return null;
  const millis = Date.parse(value);
  return Number.isFinite(millis) ? millis : null;
}

function assessSessionCloseRecord(record) {
  const sessionStartMillis = parseUtcMillis(record?.sessionStartTimeUtc);
  const sessionEndMillis = parseUtcMillis(record?.sessionEndTimeUtc);
  const decisionTimeMillis = parseUtcMillis(record?.decisionTimeUtc);

  if (sessionStartMillis == null || sessionEndMillis == null || sessionEndMillis <= sessionStartMillis) {
    return { eligible: false, reason: EXCLUSION_REASONS.INVALID_SESSION_WINDOW };
  }
  if (decisionTimeMillis == null) {
    return { eligible: false, reason: EXCLUSION_REASONS.INVALID_DECISION_TIME };
  }
  if (decisionTimeMillis >= sessionStartMillis) {
    return { eligible: false, reason: EXCLUSION_REASONS.DECISION_NOT_STRICTLY_PRE_SESSION };
  }
  if (!Array.isArray(record.features) || !record.features.length) {
    return { eligible: false, reason: EXCLUSION_REASONS.MISSING_FEATURES };
  }

  for (const feature of record.features) {
    if (!feature || typeof feature.name !== "string" || !feature.name || !("value" in feature)) {
      return { eligible: false, reason: EXCLUSION_REASONS.INVALID_FEATURE };
    }
    const availableAtMillis = parseUtcMillis(feature.availableAtUtc);
    if (availableAtMillis == null) {
      return { eligible: false, reason: EXCLUSION_REASONS.MISSING_FEATURE_AVAILABILITY, featureName: feature.name };
    }
    if (availableAtMillis > decisionTimeMillis) {
      return { eligible: false, reason: EXCLUSION_REASONS.FEATURE_NOT_AVAILABLE_PRE_DECISION, featureName: feature.name };
    }
  }

  if (!Number.isFinite(record.sessionOpenPrice) || !Number.isFinite(record.sessionClosePrice)) {
    return { eligible: false, reason: EXCLUSION_REASONS.INVALID_OUTCOME };
  }

  return {
    eligible: true,
    reason: null,
    label: record.sessionClosePrice > record.sessionOpenPrice
      ? "BULLISH"
      : record.sessionClosePrice < record.sessionOpenPrice ? "BEARISH" : "FLAT"
  };
}

function filterEligibleSessionCloseRecords(records) {
  return (Array.isArray(records) ? records : []).map((record) => ({
    record,
    assessment: assessSessionCloseRecord(record)
  }));
}

module.exports = {
  CONTRACT_VERSION,
  EXCLUSION_REASONS,
  assessSessionCloseRecord,
  filterEligibleSessionCloseRecords,
  parseUtcMillis
};
