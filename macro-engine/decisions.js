"use strict";

const { ALERT_SEVERITIES } = require("./contracts");

function isCompatibleLayer2Leg(call, at) {
  return Boolean(call && call.callStatus === "ACTIVE" && call.dataFreshness === "VALID" && Date.parse(call.nextReviewAt) > Date.parse(at) && Date.parse(call.hardExpiresAt) > Date.parse(at));
}

function decideAlert(previousCall, currentCall) {
  if (!currentCall || currentCall.dataFreshness !== "VALID") return { severity: "DATA_RISK", notify: true, reason: "Required call data is stale, missing, or contradictory." };
  if (currentCall.callStatus === "INVALIDATED") return { severity: "INVALIDATION", notify: true, reason: "The active call crossed an invalidation condition." };
  if (previousCall && previousCall.direction !== currentCall.direction) return { severity: "REVERSAL", notify: true, reason: "The confirmed directional call changed." };
  if (previousCall && previousCall.actionStatus !== currentCall.actionStatus) return { severity: "MATERIAL", notify: true, reason: "The actionable trade status changed." };
  return { severity: "INFO", notify: false, reason: "Routine reassessment with no material call change." };
}

function createNotificationDecision(input = {}) {
  const decision = decideAlert(input.previousCall, input.currentCall);
  if (!ALERT_SEVERITIES.includes(decision.severity)) throw new Error("invalid alert severity");
  return Object.freeze({ ...decision, dedupeKey: `${input.currentCall?.callId || "missing"}:${decision.severity}`, callId: input.currentCall?.callId || null, eventIds: [...(input.currentCall?.triggerEventIds || [])] });
}

function shouldDispatchAlert(decision, history = [], at, cooldownMs = 300000) {
  if (!decision.notify) return { dispatch: false, reason: "quiet" };
  const duplicate = history.find((record) => record.dedupeKey === decision.dedupeKey && Date.parse(at) - Date.parse(record.createdAt) < cooldownMs);
  return duplicate
    ? { dispatch: false, reason: "duplicate_within_cooldown" }
    : { dispatch: true, reason: "material_change" };
}

module.exports = { createNotificationDecision, decideAlert, isCompatibleLayer2Leg, shouldDispatchAlert };
