"use strict";

/**
 * Per-morning factor access for the frozen rulebook (research only).
 *
 * The rulebook says what a morning may do with a reading; this module says whether the morning has one. For each
 * of the twenty-five rows it resolves the row's staged inputs to a print date and an age, compares that age with
 * the row's declared profile, and returns one of four states:
 *
 *   - `valid_unchanged` - every input a voting row needs is present inside its declared age, so the row may vote
 *     on this morning's reading;
 *   - `verified_absent` - the row has a clock and the clock says there is nothing to read (an event row with no
 *     release before the cutoff). This is knowledge, not a gap, and it is never filled from another session;
 *   - `missing_or_stale` - a needed input is absent, has no print clock, or is older than its profile allows;
 *   - `not_read` - the book never reads the row (excluded, counted elsewhere, calendar-only or unsourced), so the
 *     morning has no reading either way.
 *
 * The age test uses the rulebook's own profile, not the run's per-input freshness tolerance, so a replay that was
 * built with looser tolerances cannot make an old print look usable here. A derived series inherits the age of
 * its oldest leg; it has no print of its own and is never treated as fresher than the series it came from.
 *
 * Nothing here scores an outcome, fills a gap or trades. Access is permission to read, never evidence of edge.
 */

const rulebook = require("./factor_rulebook_v1");
const decision = require("./decision_rules_v1");

const VERSION = `${rulebook.VERSION}-access`;
const STATES = Object.freeze({
  VALID_UNCHANGED: "valid_unchanged",
  VERIFIED_ABSENT: "verified_absent",
  MISSING_OR_STALE: "missing_or_stale",
  NOT_READ: "not_read"
});
const INPUT_STATES = Object.freeze({
  FRESH: "fresh",
  STALE: "stale",
  ABSENT: "absent",
  UNCLOCKED: "unclocked"
});

function finite(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function valuesOf(session) {
  const out = {};
  const push = (source) => {
    for (const [key, value] of Object.entries(source || {})) {
      // A null in the run's derived map must not overwrite a stored level: keep the first usable value and only
      // fall through to a later source when nothing usable has been seen yet.
      if (finite(out[key]) !== null) continue;
      out[key] = value;
    }
  };
  push(session && session.inputs);
  push(session && session.saved_inputs);
  push(session && session.audit_values);
  return out;
}

/** `input_meta` tuples are `[key, printDate, staleness, freshness]`; only the first three matter here. */
function metaIndex(session) {
  const byKey = new Map();
  for (const entry of Array.isArray(session && session.input_meta) ? session.input_meta : []) {
    if (!Array.isArray(entry) || !entry[0]) continue;
    byKey.set(entry[0], {
      print_date: entry[1] || null,
      staleness: Number.isFinite(entry[2]) ? entry[2] : null
    });
  }
  return byKey;
}

/**
 * Resolve one staged input to a value, a print date and an age in business days. A derived series takes the age
 * of its oldest declared leg; a series with no stored print clock and no declared legs is unclocked, which is a
 * refusal rather than an assumption.
 */
function assessInput(context, key, depth = 0) {
  const { values, meta } = context;
  const value = finite(values[key]);
  const stored = meta.get(key);
  const maxAge = rulebook.maxAgeBusinessDays(key);
  const profile = rulebook.ageProfileFor(key);

  if (stored) {
    const staleness = stored.staleness;
    const state =
      value === null
        ? INPUT_STATES.ABSENT
        : staleness === null
          ? INPUT_STATES.UNCLOCKED
          : maxAge === null || staleness <= maxAge
            ? INPUT_STATES.FRESH
            : INPUT_STATES.STALE;
    return {
      key,
      value,
      state,
      print_date: stored.print_date,
      staleness_business_days: staleness,
      max_age_business_days: maxAge,
      profile_id: profile ? profile.profile_id : null,
      clock: "stored"
    };
  }

  const legs = profile && Array.isArray(profile.clock_from) ? profile.clock_from : [];
  if (legs.length && depth < 4) {
    const legsAssessed = legs.map((leg) => assessInput(context, leg, depth + 1));
    const aged = legsAssessed.filter((leg) => Number.isFinite(leg.staleness_business_days));
    const staleness = aged.length ? Math.max(...aged.map((leg) => leg.staleness_business_days)) : null;
    const oldestLeg = aged.sort((a, b) => b.staleness_business_days - a.staleness_business_days)[0] || null;
    const state =
      value === null
        ? INPUT_STATES.ABSENT
        : staleness === null
          ? INPUT_STATES.UNCLOCKED
          : maxAge === null || staleness <= maxAge
            ? INPUT_STATES.FRESH
            : INPUT_STATES.STALE;
    return {
      key,
      value,
      state,
      print_date: oldestLeg ? oldestLeg.print_date : null,
      staleness_business_days: staleness,
      max_age_business_days: maxAge,
      profile_id: profile ? profile.profile_id : null,
      clock: "legs",
      legs: legsAssessed
    };
  }

  return {
    key,
    value,
    state: value === null ? INPUT_STATES.ABSENT : INPUT_STATES.UNCLOCKED,
    print_date: null,
    staleness_business_days: null,
    max_age_business_days: maxAge,
    profile_id: profile ? profile.profile_id : null,
    clock: "none"
  };
}

function describeInputs(inputs) {
  const stale = inputs.filter((input) => input.state === INPUT_STATES.STALE).map((input) => input.key);
  const absent = inputs.filter((input) => input.state === INPUT_STATES.ABSENT).map((input) => input.key);
  const unclocked = inputs.filter((input) => input.state === INPUT_STATES.UNCLOCKED).map((input) => input.key);
  return { stale, absent, unclocked };
}

/**
 * One row on one morning. A row that the book never reads, or whose clock says nothing happened, is reported as
 * such; only a direction row in `valid_unchanged` may vote, and `may_vote` says so explicitly.
 */
function assessFactor(session, factorId, options = {}) {
  const row = rulebook.rowFor(factorId);
  if (!row) throw new Error(`factor ${factorId} is not in the rulebook`);
  const context = options.context || { values: valuesOf(session), meta: metaIndex(session) };
  const events = options.events || {};
  const inputs = row.inputs.map((key) => assessInput(context, key));
  const { stale, absent, unclocked } = describeInputs(inputs);
  const event = events[factorId] || null;
  const verdict = row.adjudication ? row.adjudication.treatment : null;

  let state;
  let reason;
  if (row.inputs.length) {
    if (stale.length || absent.length || unclocked.length) {
      state = STATES.MISSING_OR_STALE;
      reason = [stale.length ? `stale: ${stale.join(", ")}` : null, absent.length ? `absent: ${absent.join(", ")}` : null, unclocked.length ? `unclocked: ${unclocked.join(", ")}` : null]
        .filter(Boolean)
        .join("; ");
    } else {
      state = STATES.VALID_UNCHANGED;
      const oldest = Math.max(...inputs.map((input) => (Number.isFinite(input.staleness_business_days) ? input.staleness_business_days : 0)));
      reason = `every reading within its declared age (oldest ${oldest} business days)`;
    }
  } else if (row.role === "event_missing") {
    state = eventState(event);
    reason = state === STATES.VALID_UNCHANGED ? "an event reading is available before the cutoff" : "no source is staged, so there is nothing this morning could read";
  } else if (row.role === "calendar_window") {
    state = STATES.NOT_READ;
    reason = "no event calendar is staged; the row marks a window rather than a reading";
  } else {
    state = eventState(event);
    reason = event
      ? state === STATES.VALID_UNCHANGED
        ? "an event reading is available before the cutoff"
        : "the clock says no release before this morning's cutoff"
      : verdict === "excluded"
        ? "excluded by the adjudication: the book does not read it"
        : "the book does not read this row";
  }

  return Object.freeze({
    id: row.id,
    name: row.name,
    role: row.role,
    role_label: row.role_label,
    treatment: verdict,
    state,
    may_vote: row.role === "direction" && state === STATES.VALID_UNCHANGED,
    reason,
    inputs: Object.freeze(inputs),
    event: event ? Object.freeze({ ...event }) : null
  });
}

function eventState(event) {
  if (!event) return STATES.NOT_READ;
  return event.available === true ? STATES.VALID_UNCHANGED : STATES.VERIFIED_ABSENT;
}

/**
 * One morning: every row's state, the coverage it adds up to and the rows whose absence is an explicit blocker.
 * `signals_reachable` counts the decision signals whose owning direction row may vote, so a morning that has the
 * dollar vote but not the rates vote is described in the units the decision file actually spends.
 */
function assessMorning(session, options = {}) {
  const context = options.context || { values: valuesOf(session), meta: metaIndex(session) };
  const events = options.events || {};
  const factors = rulebook.ROWS.map((row) => assessFactor(session, row.id, { context, events }));
  const byId = new Map(factors.map((factor) => [factor.id, factor]));
  const voters = factors.filter((factor) => factor.role === "direction");
  const reachableSignals = new Set(
    voters
      .filter((factor) => factor.may_vote)
      .flatMap((factor) => rulebook.signalsFor(factor.id))
  );
  const familyOf = new Map(decision.SIGNALS.map((signal) => [signal.id, signal.family_id]));
  const reachableFamilies = new Set([...reachableSignals].map((signal) => familyOf.get(signal)).filter(Boolean));
  const stateCount = (state) => factors.filter((factor) => factor.state === state).length;

  return Object.freeze({
    date: session && session.date ? session.date : null,
    cutoff_at_utc: (session && session.cutoff_at_utc) || null,
    factors: Object.freeze(factors),
    coverage: Object.freeze({
      rows: factors.length,
      valid_unchanged: stateCount(STATES.VALID_UNCHANGED),
      verified_absent: stateCount(STATES.VERIFIED_ABSENT),
      missing_or_stale: stateCount(STATES.MISSING_OR_STALE),
      not_read: stateCount(STATES.NOT_READ),
      vote_rows: voters.length,
      vote_rows_valid: reachableSignals.size ? voters.filter((factor) => factor.may_vote).length : 0,
      signals_reachable: reachableSignals.size,
      signals_total: decision.SIGNALS.length,
      families_reachable: reachableFamilies.size,
      families_total: decision.FAMILIES.length
    }),
    gate: Object.freeze({
      input: byId.get("data.quality-gate-for-abstention") && byId.get("data.quality-gate-for-abstention").inputs[0]
        ? byId.get("data.quality-gate-for-abstention").inputs[0].key
        : null,
      state: byId.get("data.quality-gate-for-abstention") ? byId.get("data.quality-gate-for-abstention").state : null,
      row: byId.get("data.quality-gate-for-abstention") || null
    }),
    blockers: Object.freeze(
      voters
        .filter((factor) => !factor.may_vote)
        .map((factor) => Object.freeze({ id: factor.id, role: factor.role, state: factor.state, reason: factor.reason }))
    )
  });
}

/** Roll a run of mornings up per factor, so the page can say how often each row could be read at all. */
function summarise(mornings) {
  const list = Array.isArray(mornings) ? mornings : [];
  const totals = new Map();
  for (const morning of list) {
    for (const factor of morning.factors) {
      const entry = totals.get(factor.id) || {
        id: factor.id,
        name: factor.name,
        role: factor.role,
        states: { valid_unchanged: 0, verified_absent: 0, missing_or_stale: 0, not_read: 0 },
        voting_mornings: 0
      };
      entry.states[factor.state] = (entry.states[factor.state] || 0) + 1;
      if (factor.may_vote) entry.voting_mornings += 1;
      totals.set(factor.id, entry);
    }
  }
  const mean = (pick) => (list.length ? list.reduce((sum, morning) => sum + pick(morning), 0) / list.length : 0);
  return {
    version: VERSION,
    mornings: list.length,
    first_date: list.length ? list[0].date : null,
    last_date: list.length ? list[list.length - 1].date : null,
    by_factor: Object.freeze([...totals.values()]),
    coverage: Object.freeze({
      mean_rows_valid: mean((morning) => morning.coverage.valid_unchanged),
      mean_signals_reachable: mean((morning) => morning.coverage.signals_reachable),
      mean_families_reachable: mean((morning) => morning.coverage.families_reachable),
      mornings_with_all_voters: list.filter((morning) => morning.coverage.vote_rows_valid === morning.coverage.vote_rows).length,
      mornings_with_no_blockers: list.filter((morning) => morning.blockers.length === 0).length
    })
  };
}

module.exports = {
  VERSION,
  STATES,
  INPUT_STATES,
  assessInput: (session, key, options = {}) =>
    assessInput(options.context || { values: valuesOf(session), meta: metaIndex(session) }, key),
  assessFactor,
  assessMorning,
  summarise,
  metaIndex,
  valuesOf
};

