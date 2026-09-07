"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { admitEvent } = require("../event-store");
const { runReplay } = require("../replay");
const { createNotificationDecision, shouldDispatchAlert } = require("../decisions");
const { reviseValidityWindow, transitionCall } = require("../lifecycle");
const { createCallVersion } = require("../contracts");

function activeCall(overrides = {}) {
  return createCallVersion({ callId: "usd-open", baselineCallId: "usd-open", callKind: "BASELINE", asset: "USD", direction: "BULLISH", actionStatus: "TRADE", callStatus: "ACTIVE", persistenceClass: "SESSION", generatedAt: "2026-03-30T11:00:00Z", sealedAt: "2026-03-30T11:00:00Z", nextReviewAt: "2026-03-30T12:45:00Z", hardExpiresAt: "2026-03-30T16:00:00Z", sourceRunId: "fixture", ...overrides });
}

test("event admission rejects duplicate and out-of-order events but retains revisions", () => {
  const initial = { eventId: "one", dedupeKey: "cpi", source: "fixture", rawReference: "fixture://one", publishedAt: "2026-03-30T12:30:00Z", receivedAt: "2026-03-30T12:30:01Z", processedAt: "2026-03-30T12:30:02Z" };
  const first = admitEvent([], initial);
  assert.equal(admitEvent(first.history, initial).outcome, "DUPLICATE");
  const revision = admitEvent(first.history, { ...initial, eventId: "two", rawReference: "fixture://two", publishedAt: "2026-03-30T12:31:00Z", receivedAt: "2026-03-30T12:31:01Z", processedAt: "2026-03-30T12:31:02Z" });
  assert.equal(revision.outcome, "REVISION");
  assert.equal(revision.event.revisionOfEventId, "one");
  assert.equal(admitEvent(revision.history, { ...initial, eventId: "old", rawReference: "fixture://old", receivedAt: "2026-03-30T12:29:01Z", processedAt: "2026-03-30T12:29:02Z" }).outcome, "REJECTED_OUT_OF_ORDER");
});

test("chronological replay preserves event lineage and unknown price shocks", () => {
  const records = JSON.parse(fs.readFileSync(path.join(__dirname, "../fixtures/event-replay.json"), "utf8"));
  const result = runReplay(records);
  assert.deepEqual(result.decisions.map((item) => item.outcome), ["ADMITTED", "REVISION"]);
  assert.equal(result.events.length, 2);
  assert.equal(result.events[1].revisionOfEventId, "us-cpi-initial");
  assert.equal(result.observations[0].cause, "UNKNOWN_CAUSE");
});

test("lifecycle rejects terminal resurrection and silent hard-expiry extension", () => {
  assert.throws(() => transitionCall(activeCall({ callStatus: "EXPIRED" }), { at: "2026-03-30T16:01:00Z", status: "ACTIVE" }), /cannot transition/);
  assert.throws(() => reviseValidityWindow(activeCall(), { hardExpiresAt: "2026-03-30T17:00:00Z" }), /explicit reassessment/);
  const shortened = reviseValidityWindow(activeCall(), { nextReviewAt: "2026-03-30T12:35:00Z", hardExpiresAt: "2026-03-30T14:00:00Z" });
  assert.equal(shortened.hardExpiresAt, "2026-03-30T14:00:00Z");
});

test("alerts remain quiet for routine updates and suppress duplicate material transitions", () => {
  const original = activeCall();
  const changed = createCallVersion({ ...original, callId: "usd-overlay", callKind: "EVENT_OVERLAY", actionStatus: "WAIT" });
  const decision = createNotificationDecision({ previousCall: original, currentCall: changed });
  const first = shouldDispatchAlert(decision, [], "2026-03-30T12:31:00Z");
  const duplicate = shouldDispatchAlert(decision, [{ dedupeKey: decision.dedupeKey, createdAt: "2026-03-30T12:31:00Z" }], "2026-03-30T12:33:00Z");
  assert.equal(first.dispatch, true);
  assert.equal(duplicate.reason, "duplicate_within_cooldown");
});
