"use strict";

const { CALL_STATUSES, createCallVersion } = require("./contracts");

const PERSISTENCE_MS = Object.freeze({ TRANSITORY: 3600000, SESSION: 28800000, MULTI_SESSION: 259200000, OPEN_ENDED_REVIEW: null });
const ALLOWED_TRANSITIONS = Object.freeze({
  ACTIVE: ["WEAKENING", "INVALIDATED", "STALE", "EXPIRED"],
  WEAKENING: ["ACTIVE", "INVALIDATED", "STALE", "EXPIRED"],
  STALE: ["ACTIVE", "INVALIDATED", "EXPIRED"],
  INVALIDATED: [],
  EXPIRED: [],
  UNAVAILABLE: ["ACTIVE", "STALE"]
});

function deriveValidityWindow({ generatedAt, persistenceClass, nextReviewAt, hardExpiresAt }) {
  const hardExpiry = Date.parse(hardExpiresAt);
  const nextReview = Date.parse(nextReviewAt);
  const duration = PERSISTENCE_MS[persistenceClass];
  if (!Number.isFinite(hardExpiry) || !Number.isFinite(nextReview) || duration === undefined) throw new Error("invalid validity window input");
  if (nextReview > hardExpiry) throw new Error("nextReviewAt cannot be later than hardExpiresAt");
  const expected = duration === null ? null : Math.min(Date.parse(generatedAt) + duration, hardExpiry);
  return Object.freeze({ nextReviewAt, expectedValidUntil: expected === null ? null : new Date(expected).toISOString(), hardExpiresAt });
}

function transitionCall(call, transition = {}) {
  if (!call || !CALL_STATUSES.includes(call.callStatus)) throw new Error("a valid call is required");
  const at = transition.at || new Date().toISOString();
  const targetStatus = transition.status || call.callStatus;
  if (!CALL_STATUSES.includes(targetStatus)) throw new Error("invalid target call status");
  if (targetStatus !== call.callStatus && !ALLOWED_TRANSITIONS[call.callStatus].includes(targetStatus)) {
    throw new Error(`cannot transition ${call.callStatus} to ${targetStatus}`);
  }
  if (Date.parse(at) < Date.parse(call.sealedAt)) throw new Error("transition cannot precede call sealing");
  return createCallVersion({
    ...call, callKind: transition.callKind || "EVENT_OVERLAY", callStatus: targetStatus, nextReviewAt: transition.nextReviewAt || call.nextReviewAt,
    expectedValidUntil: transition.expectedValidUntil === undefined ? call.expectedValidUntil : transition.expectedValidUntil,
    hardExpiresAt: transition.hardExpiresAt || call.hardExpiresAt,
    invalidatedAt: targetStatus === "INVALIDATED" ? at : call.invalidatedAt,
    supersedesCallId: call.callId, callId: transition.callId || `${call.callId}:v${transition.version || "next"}`,
    generatedAt: at, sealedAt: at, sourceRunId: transition.sourceRunId || call.sourceRunId
  });
}

function reviseValidityWindow(call, change = {}) {
  const nextReviewAt = change.nextReviewAt || call.nextReviewAt;
  const hardExpiresAt = change.hardExpiresAt || call.hardExpiresAt;
  const expectedValidUntil = change.expectedValidUntil === undefined ? call.expectedValidUntil : change.expectedValidUntil;
  if (Date.parse(nextReviewAt) > Date.parse(hardExpiresAt)) throw new Error("nextReviewAt cannot be later than hardExpiresAt");
  if (expectedValidUntil && Date.parse(expectedValidUntil) > Date.parse(hardExpiresAt)) {
    throw new Error("expectedValidUntil cannot be later than hardExpiresAt");
  }
  if (!change.allowExtension && Date.parse(hardExpiresAt) > Date.parse(call.hardExpiresAt)) {
    throw new Error("hard expiry may only extend through an explicit reassessment");
  }
  return Object.freeze({ nextReviewAt, expectedValidUntil, hardExpiresAt });
}

function evaluateCallFreshness(call, at) {
  const timestamp = Date.parse(at);
  if (timestamp >= Date.parse(call.hardExpiresAt)) return "EXPIRED";
  if (call.dataFreshness !== "VALID") return "STALE";
  if (timestamp >= Date.parse(call.nextReviewAt)) return "WEAKENING";
  return call.callStatus;
}

module.exports = { ALLOWED_TRANSITIONS, deriveValidityWindow, evaluateCallFreshness, reviseValidityWindow, transitionCall };
