"use strict";

/**
 * Session-target and as-of-cutoff interfaces for the USD session engine (research only, 2026-10-13).
 *
 * This file is an interface contract, not the engine. It exists so that every later implementation of a
 * historical or prospective run resolves the two endpoints and the as-of rule in one place, and so a
 * leakage mistake is caught by construction rather than by review.
 *
 * The two time zones are handled separately, as the brief requires. Offsets are derived from declared
 * transition instants, never from a fixed hour count, because London and New York change on different dates.
 *
 * Nothing here reads the network, the warehouse, the dispatcher or a production path.
 */

const SESSION_CONTRACT = Object.freeze({
  cutoff_local: "05:00",
  cutoff_zone: "Europe/London",
  endpoint_local: "17:00",
  endpoint_zone: "America/New_York"
});

/**
 * Declared daylight-saving transitions from the official rules (last Sunday of March/October for the EU,
 * second Sunday of March / first Sunday of November for the US). Extend by year; a missing year throws
 * rather than guessing an offset.
 */
const ZONE_TRANSITIONS = Object.freeze({
  "Europe/London": {
    spring_forward_utc: { 2023: "2023-03-26T01:00:00Z", 2024: "2024-03-31T01:00:00Z", 2025: "2025-03-30T01:00:00Z", 2026: "2026-03-29T01:00:00Z", 2027: "2027-03-28T01:00:00Z" },
    fall_back_utc: { 2023: "2023-10-29T01:00:00Z", 2024: "2024-10-27T01:00:00Z", 2025: "2025-10-26T01:00:00Z", 2026: "2026-10-25T01:00:00Z", 2027: "2027-10-31T01:00:00Z" },
    standard_offset_minutes: 0,
    summer_offset_minutes: 60,
    standard_abbrev: "GMT",
    summer_abbrev: "BST"
  },
  "America/New_York": {
    spring_forward_utc: { 2023: "2023-03-12T07:00:00Z", 2024: "2024-03-10T07:00:00Z", 2025: "2025-03-09T07:00:00Z", 2026: "2026-03-08T07:00:00Z", 2027: "2027-03-14T07:00:00Z" },
    fall_back_utc: { 2023: "2023-11-05T06:00:00Z", 2024: "2024-11-03T06:00:00Z", 2025: "2025-11-02T06:00:00Z", 2026: "2026-11-01T06:00:00Z", 2027: "2027-11-07T06:00:00Z" },
    standard_offset_minutes: -300,
    summer_offset_minutes: -240,
    standard_abbrev: "EST",
    summer_abbrev: "EDT"
  }
});

class SessionContractError extends Error {
  constructor(message) {
    super(message);
    this.name = "SessionContractError";
  }
}

function offsetMinutesAt(instantUtcMs, zone) {
  const zoneRule = ZONE_TRANSITIONS[zone];
  if (!zoneRule) throw new SessionContractError(`unknown zone ${zone}`);
  const utcYear = new Date(instantUtcMs).getUTCFullYear();
  const spring = zoneRule.spring_forward_utc[utcYear];
  const fall = zoneRule.fall_back_utc[utcYear];
  if (!spring || !fall) {
    throw new SessionContractError(`no declared DST transition for ${zone} in ${utcYear}`);
  }
  const isSummer = instantUtcMs >= Date.parse(spring) && instantUtcMs < Date.parse(fall);
  return {
    offset_minutes: isSummer ? zoneRule.summer_offset_minutes : zoneRule.standard_offset_minutes,
    abbrev: isSummer ? zoneRule.summer_abbrev : zoneRule.standard_abbrev
  };
}

const HOUR_MS = 3600 * 1000;

/** The instant a wall-clock local time denotes in a declared zone, on a given UTC day. */
function instantForLocalTime(dayUtcMs, hours, minutes, zone) {
  const zoneRule = ZONE_TRANSITIONS[zone];
  if (!zoneRule) throw new SessionContractError(`unknown zone ${zone}`);
  const firstGuess = dayUtcMs + hours * HOUR_MS + minutes * 60 * 1000;
  const guessOffset = offsetMinutesAt(firstGuess, zone).offset_minutes;
  let candidate = firstGuess - guessOffset * 60 * 1000;
  const settledOffset = offsetMinutesAt(candidate, zone).offset_minutes;
  if (settledOffset !== guessOffset) {
    candidate = firstGuess - settledOffset * 60 * 1000;
  }
  return candidate;
}

/**
 * Resolve one session's cutoff and endpoint.
 *
 * @param {number} dayUtcMs UTC midnight of the session's local date.
 * @returns {object} instants, offset abbreviations and the nominal window length.
 */
function resolveSession(dayUtcMs) {
  const cutoffMs = instantForLocalTime(dayUtcMs, 5, 0, SESSION_CONTRACT.cutoff_zone);
  const endpointMs = instantForLocalTime(dayUtcMs, 17, 0, SESSION_CONTRACT.endpoint_zone);
  return {
    cutoff_at_utc: new Date(cutoffMs).toISOString(),
    cutoff_offset_abbrev: offsetMinutesAt(cutoffMs, SESSION_CONTRACT.cutoff_zone).abbrev,
    endpoint_at_utc: new Date(endpointMs).toISOString(),
    endpoint_offset_abbrev: offsetMinutesAt(endpointMs, SESSION_CONTRACT.endpoint_zone).abbrev,
    window_hours: (endpointMs - cutoffMs) / HOUR_MS
  };
}

/**
 * Reject a value that could not have been known at the cutoff.
 *
 * @param {object} observation `{ key, value, observed_at_utc, source }`
 * @param {number} cutoffMs the session's cutoff instant in ms.
 * @returns {object} the accepted observation, or throws.
 */
function assertAsOf(observation, cutoffMs) {
  if (!observation || typeof observation !== "object") {
    throw new SessionContractError("observation must be an object");
  }
  const { key, observed_at_utc: observedAt } = observation;
  if (!key) throw new SessionContractError("observation needs a key");
  if (!observedAt) throw new SessionContractError(`${key}: observation needs observed_at_utc`);
  const observedMs = Date.parse(observedAt);
  if (!Number.isFinite(observedMs)) throw new SessionContractError(`${key}: unparseable observed_at_utc`);
  if (observedMs > cutoffMs) {
    throw new SessionContractError(
      `${key}: observed at ${observedAt} after the cutoff ${new Date(cutoffMs).toISOString()} - look-ahead refused`
    );
  }
  return observation;
}

/** Build the as-of snapshot the engine consumes, refusing every late value. */
function buildAsOfSnapshot({ session_id, day_utc, observations }) {
  if (!session_id) throw new SessionContractError("snapshot needs a session_id");
  if (!day_utc) throw new SessionContractError("snapshot needs a day_utc");
  const dayMs = Date.parse(day_utc);
  if (!Number.isFinite(dayMs)) throw new SessionContractError("unparseable day_utc");
  const session = resolveSession(dayMs);
  const cutoffMs = Date.parse(session.cutoff_at_utc);
  const accepted = (observations || []).map((observation) => assertAsOf(observation, cutoffMs));
  return { session_id, day_utc, session, observations: accepted };
}

/**
 * The trace a run must produce. The engine fills the calculation; the contract fixes the shape so an
 * auditable record exists for every historical and prospective session.
 */
function buildTraceRecord({ session, observations, factor_verdicts, combination, decision }) {
  return {
    session,
    observations: observations || [],
    factor_verdicts: factor_verdicts || [],
    combination: combination || null,
    decision: decision || null,
    engine_version: "usd-session-engine-interface-v1",
    note: "interface placeholder: the numeric engine is not implemented in this checkpoint"
  };
}

module.exports = {
  SESSION_CONTRACT,
  ZONE_TRANSITIONS,
  SessionContractError,
  offsetMinutesAt,
  instantForLocalTime,
  resolveSession,
  assertAsOf,
  buildAsOfSnapshot,
  buildTraceRecord
};
