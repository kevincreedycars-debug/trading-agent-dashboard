"use strict";

const ASSETS = Object.freeze(["USD", "EURUSD", "GOLD", "NQ", "BTC"]);
const DIRECTIONS = Object.freeze(["BULLISH", "BEARISH", "NEUTRAL"]);
const ACTION_STATUSES = Object.freeze(["TRADE", "WAIT", "NO_TRADE", "EXIT_REVIEW"]);
const CALL_STATUSES = Object.freeze(["ACTIVE", "WEAKENING", "INVALIDATED", "STALE", "EXPIRED", "UNAVAILABLE"]);
const PERSISTENCE_CLASSES = Object.freeze(["TRANSITORY", "SESSION", "MULTI_SESSION", "OPEN_ENDED_REVIEW"]);
const EVENT_DATA_STATUSES = Object.freeze(["VALID", "STALE", "MISSING", "CONTRADICTORY"]);
const ALERT_SEVERITIES = Object.freeze(["INFO", "WATCH", "MATERIAL", "REVERSAL", "INVALIDATION", "DATA_RISK"]);

function assertEnum(label, value, values) {
  if (!values.includes(value)) throw new Error(`${label} must be one of: ${values.join(", ")}`);
}

function assertTimestamp(label, value) {
  if (!value || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be an ISO-8601 timestamp`);
}

function createEventRecord(input = {}) {
  assertTimestamp("publishedAt", input.publishedAt);
  assertTimestamp("receivedAt", input.receivedAt);
  assertTimestamp("processedAt", input.processedAt);
  assertEnum("dataStatus", input.dataStatus || "VALID", EVENT_DATA_STATUSES);
  if (!input.eventId || !input.dedupeKey || !input.source || !input.rawReference) {
    throw new Error("eventId, dedupeKey, source, and rawReference are required");
  }
  return Object.freeze({
    eventId: input.eventId, eventType: input.eventType || "UNKNOWN_CAUSE", scheduled: Boolean(input.scheduled),
    source: input.source, sourceReliability: input.sourceReliability || "UNVERIFIED",
    publishedAt: input.publishedAt, receivedAt: input.receivedAt, processedAt: input.processedAt,
    jurisdictions: [...(input.jurisdictions || [])], affectedAssets: [...(input.affectedAssets || [])],
    consensus: input.consensus ?? null, actual: input.actual ?? null, policyDelta: input.policyDelta ?? null,
    surpriseScore: input.surpriseScore ?? null, rawReference: input.rawReference, dedupeKey: input.dedupeKey,
    revisionOfEventId: input.revisionOfEventId ?? null, dataStatus: input.dataStatus || "VALID"
  });
}

function createCallVersion(input = {}) {
  assertEnum("asset", input.asset, ASSETS);
  assertEnum("direction", input.direction, DIRECTIONS);
  assertEnum("actionStatus", input.actionStatus, ACTION_STATUSES);
  assertEnum("callStatus", input.callStatus, CALL_STATUSES);
  assertEnum("persistenceClass", input.persistenceClass, PERSISTENCE_CLASSES);
  assertTimestamp("generatedAt", input.generatedAt);
  assertTimestamp("sealedAt", input.sealedAt);
  assertTimestamp("nextReviewAt", input.nextReviewAt);
  assertTimestamp("hardExpiresAt", input.hardExpiresAt);
  if (!input.callId || !input.callKind || !input.baselineCallId || !input.sourceRunId) {
    throw new Error("callId, callKind, baselineCallId, and sourceRunId are required");
  }
  if (Date.parse(input.nextReviewAt) > Date.parse(input.hardExpiresAt)) throw new Error("nextReviewAt cannot be later than hardExpiresAt");
  if (input.callKind === "BASELINE" && input.baselineCallId !== input.callId) throw new Error("a BASELINE call must reference itself as baselineCallId");
  return Object.freeze({
    ...input, triggerEventIds: [...(input.triggerEventIds || [])], invalidationRules: [...(input.invalidationRules || [])],
    expectedValidUntil: input.expectedValidUntil ?? null, supersedesCallId: input.supersedesCallId ?? null,
    invalidatedAt: input.invalidatedAt ?? null, dataFreshness: input.dataFreshness || "VALID"
  });
}

module.exports = { ACTION_STATUSES, ALERT_SEVERITIES, ASSETS, CALL_STATUSES, DIRECTIONS, EVENT_DATA_STATUSES, PERSISTENCE_CLASSES, createCallVersion, createEventRecord };
