"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createCallVersion, createEventRecord } = require("../contracts");
const { evaluateCallFreshness, transitionCall } = require("../lifecycle");
const { createNotificationDecision, isCompatibleLayer2Leg } = require("../decisions");
const { formatInZone } = require("../time");

function baselineCall(overrides = {}) {
  return createCallVersion({ callId: "usd-open-20260821", baselineCallId: "usd-open-20260821", callKind: "BASELINE", asset: "USD", direction: "BULLISH", actionStatus: "WAIT", callStatus: "ACTIVE", persistenceClass: "SESSION", generatedAt: "2026-08-21T07:00:00Z", sealedAt: "2026-08-21T07:00:00Z", nextReviewAt: "2026-08-21T12:00:00Z", hardExpiresAt: "2026-08-21T16:00:00Z", sourceRunId: "fixture-run", ...overrides });
}

test("event records require source and complete timestamp lineage", () => {
  assert.throws(() => createEventRecord({}), /publishedAt/);
  const event = createEventRecord({ eventId: "cpi-20260821", dedupeKey: "cpi-us-20260821", source: "fixture", rawReference: "fixture://cpi", publishedAt: "2026-08-21T12:30:00Z", receivedAt: "2026-08-21T12:30:01Z", processedAt: "2026-08-21T12:30:02Z" });
  assert.equal(event.dataStatus, "VALID");
});

test("baseline calls are immutable roots and expiry fails closed", () => {
  assert.throws(() => baselineCall({ baselineCallId: "different" }), /BASELINE/);
  const call = baselineCall();
  assert.equal(evaluateCallFreshness(call, "2026-08-21T12:00:00Z"), "WEAKENING");
  assert.equal(evaluateCallFreshness(call, "2026-08-21T16:00:00Z"), "EXPIRED");
  assert.equal(isCompatibleLayer2Leg(call, "2026-08-21T12:00:00Z"), false);
});

test("call transitions preserve baseline lineage and alert genuine reversals", () => {
  const current = transitionCall(baselineCall(), { at: "2026-08-21T12:31:00Z", callId: "usd-event-20260821-1", version: 1, status: "ACTIVE", sourceRunId: "event-run" });
  const reversed = createCallVersion({ ...current, callId: "usd-event-20260821-2", direction: "BEARISH", generatedAt: "2026-08-21T12:32:00Z", sealedAt: "2026-08-21T12:32:00Z" });
  const decision = createNotificationDecision({ previousCall: current, currentCall: reversed });
  assert.equal(reversed.baselineCallId, "usd-open-20260821");
  assert.equal(decision.severity, "REVERSAL");
  assert.equal(decision.notify, true);
});

test("IANA formatting handles UK and New York DST boundaries", () => {
  const timestamp = "2026-03-30T12:00:00Z";
  assert.match(formatInZone(timestamp, "Europe/London"), /13:00:00/);
  assert.match(formatInZone(timestamp, "America/New_York"), /08:00:00/);
});

test("IANA formatting handles the UK and US offset-mismatch week", () => {
  const timestamp = "2026-03-16T12:00:00Z";
  assert.match(formatInZone(timestamp, "Europe/London"), /12:00:00/);
  assert.match(formatInZone(timestamp, "America/New_York"), /08:00:00/);
});
