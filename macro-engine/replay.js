"use strict";

const { admitEvent } = require("./event-store");

function assertChronological(records = []) {
  for (let index = 1; index < records.length; index += 1) {
    if (Date.parse(records[index - 1].at) > Date.parse(records[index].at)) {
      throw new Error("replay input must be chronological");
    }
  }
}

function runReplay(records = [], handlers = {}) {
  assertChronological(records);
  const state = { events: [], observations: [], decisions: [], calls: [] };
  for (const record of records) {
    if (record.kind === "event") {
      const result = admitEvent(state.events, record.event);
      state.events = result.history;
      state.decisions.push({ at: record.at, kind: "event", outcome: result.outcome, eventId: result.event.eventId });
      if (result.outcome !== "REJECTED_OUT_OF_ORDER" && handlers.onEvent) handlers.onEvent(result.event, state);
      continue;
    }
    if (record.kind === "observation") {
      state.observations.push(Object.freeze({ ...record.observation, observedAt: record.at }));
      if (handlers.onObservation) handlers.onObservation(record.observation, state, record.at);
      continue;
    }
    throw new Error(`unsupported replay record kind: ${record.kind}`);
  }
  return Object.freeze({ ...state, events: [...state.events], observations: [...state.observations], decisions: [...state.decisions], calls: [...state.calls] });
}

module.exports = { assertChronological, runReplay };
