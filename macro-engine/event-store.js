"use strict";

const { createEventRecord } = require("./contracts");

function compareEvents(left, right) {
  return Date.parse(left.processedAt) - Date.parse(right.processedAt)
    || Date.parse(left.receivedAt) - Date.parse(right.receivedAt)
    || left.eventId.localeCompare(right.eventId);
}

function admitEvent(history = [], input = {}) {
  const event = createEventRecord(input);
  const sameKey = history.filter((record) => record.dedupeKey === event.dedupeKey);
  const exact = sameKey.find((record) => record.rawReference === event.rawReference && record.publishedAt === event.publishedAt);
  if (exact) return Object.freeze({ outcome: "DUPLICATE", event: exact, history: [...history] });

  const latest = [...sameKey].sort(compareEvents).at(-1);
  if (latest && Date.parse(event.publishedAt) < Date.parse(latest.publishedAt)) {
    return Object.freeze({ outcome: "REJECTED_OUT_OF_ORDER", event, history: [...history] });
  }

  const admitted = latest
    ? createEventRecord({ ...event, revisionOfEventId: latest.eventId })
    : event;
  return Object.freeze({ outcome: latest ? "REVISION" : "ADMITTED", event: admitted, history: [...history, admitted].sort(compareEvents) });
}

module.exports = { admitEvent, compareEvents };
