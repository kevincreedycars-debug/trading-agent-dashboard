const test = require("node:test");
const assert = require("node:assert/strict");

const {
  SESSION_CONTRACT,
  SessionContractError,
  isSessionStart,
  resolveSession,
  instantForLocalTime,
  assertAsOf,
  buildAsOfSnapshot,
  buildTraceRecord
} = require("../lib/usd_session_engine_interface");

/**
 * Session-target contract for the USD session study (docs/research/usd-session/v1/session_contract_v1.json).
 * Both ends are Europe/London wall-clock times one local day apart; nothing may be derived from a fixed
 * hour count.
 */

const day = (iso) => Date.parse(`${iso}T00:00:00Z`);

test("the contract names both London endpoints one local day apart", () => {
  assert.equal(SESSION_CONTRACT.cutoff_local, "05:00");
  assert.equal(SESSION_CONTRACT.cutoff_zone, "Europe/London");
  assert.equal(SESSION_CONTRACT.endpoint_local, "05:00");
  assert.equal(SESSION_CONTRACT.endpoint_zone, "Europe/London");
  assert.equal(SESSION_CONTRACT.endpoint_day_offset, 1);
  assert.equal(SESSION_CONTRACT.nominal_hours, 24);
});

test("mid-October resolves to BST at both ends with a 24-hour window", () => {
  const session = resolveSession(day("2026-10-13"));
  assert.equal(session.cutoff_at_utc, "2026-10-13T04:00:00.000Z");
  assert.equal(session.cutoff_offset_abbrev, "BST");
  assert.equal(session.endpoint_at_utc, "2026-10-14T04:00:00.000Z");
  assert.equal(session.endpoint_offset_abbrev, "BST");
  assert.equal(session.window_hours, 24);
  assert.equal(session.nominal_hours, 24);
  assert.equal(session.session_starts_weekday, true);
});

test("mid-January resolves to GMT at both ends with a 24-hour window", () => {
  const session = resolveSession(day("2026-01-20"));
  assert.equal(session.cutoff_at_utc, "2026-01-20T05:00:00.000Z");
  assert.equal(session.cutoff_offset_abbrev, "GMT");
  assert.equal(session.endpoint_at_utc, "2026-01-21T05:00:00.000Z");
  assert.equal(session.endpoint_offset_abbrev, "GMT");
  assert.equal(session.window_hours, 24);
});

test("the US and EU changeover dates no longer change the window", () => {
  // 2026-03-23: London is still on GMT while New York is already on EDT; 2026-10-27: the reverse.
  // Neither zone pair touches the session, because both ends are London timestamps.
  assert.equal(resolveSession(day("2026-03-23")).window_hours, 24);
  assert.equal(resolveSession(day("2026-10-27")).window_hours, 24);
});

test("the Saturday start that contains the London spring change is 23 hours and is not a session", () => {
  // London springs forward at 01:00Z on Sunday 2026-03-29, inside 05:00 Saturday to 05:00 Sunday.
  const session = resolveSession(day("2026-03-28"));
  assert.equal(session.cutoff_at_utc, "2026-03-28T05:00:00.000Z");
  assert.equal(session.cutoff_offset_abbrev, "GMT");
  assert.equal(session.endpoint_at_utc, "2026-03-29T04:00:00.000Z");
  assert.equal(session.endpoint_offset_abbrev, "BST");
  assert.equal(session.window_hours, 23);
  assert.equal(session.session_starts_weekday, false);
});

test("the Saturday start that contains the London autumn change is 25 hours and is not a session", () => {
  // London falls back at 01:00Z on Sunday 2026-10-25, inside 05:00 Saturday to 05:00 Sunday.
  const session = resolveSession(day("2026-10-24"));
  assert.equal(session.cutoff_at_utc, "2026-10-24T04:00:00.000Z");
  assert.equal(session.cutoff_offset_abbrev, "BST");
  assert.equal(session.endpoint_at_utc, "2026-10-25T05:00:00.000Z");
  assert.equal(session.endpoint_offset_abbrev, "GMT");
  assert.equal(session.window_hours, 25);
  assert.equal(session.session_starts_weekday, false);
});

test("the session that starts on the changeover Sunday is a normal 24 hours", () => {
  assert.equal(resolveSession(day("2026-03-29")).window_hours, 24);
  assert.equal(resolveSession(day("2026-03-29")).session_starts_weekday, false);
  assert.equal(resolveSession(day("2026-10-25")).window_hours, 24);
  assert.equal(resolveSession(day("2026-10-26")).window_hours, 24);
});

test("session starts are Monday to Friday only", () => {
  assert.equal(isSessionStart(day("2026-10-12")), true); // Monday
  assert.equal(isSessionStart(day("2026-10-16")), true); // Friday
  assert.equal(isSessionStart(day("2026-10-17")), false); // Saturday
  assert.equal(isSessionStart(day("2026-10-18")), false); // Sunday
});

test("every Monday-to-Friday start in 2026 measures exactly 24 hours", () => {
  const start = day("2026-01-01");
  const sessions = [];
  for (let current = start; current < day("2027-01-01"); current += 24 * 3600 * 1000) {
    if (!isSessionStart(current)) continue;
    const session = resolveSession(current);
    sessions.push(session);
    assert.equal(session.window_hours, 24, `${new Date(current).toISOString().slice(0, 10)} must be 24 hours`);
    assert.ok(
      session.endpoint_at_utc > session.cutoff_at_utc,
      `${new Date(current).toISOString().slice(0, 10)} endpoint must follow the cutoff`
    );
  }
  assert.equal(sessions.length, 261);
});

test("the Friday session ends on the Saturday morning and covers Friday's US close", () => {
  const session = resolveSession(day("2026-10-16"));
  assert.equal(session.cutoff_at_utc, "2026-10-16T04:00:00.000Z");
  assert.equal(session.endpoint_at_utc, "2026-10-17T04:00:00.000Z");
  assert.equal(session.window_hours, 24);
});

test("an undeclared year throws instead of guessing an offset", () => {
  assert.throws(() => resolveSession(day("2031-06-02")), SessionContractError);
});

test("a value observed after the cutoff is refused", () => {
  const cutoffMs = Date.parse("2026-10-13T04:00:00Z");
  assert.throws(
    () => assertAsOf({ key: "us_2y_yield", value: 4.1, observed_at_utc: "2026-10-13T06:00:00Z" }, cutoffMs),
    /look-ahead refused/
  );
});

test("a value observed exactly at the cutoff is accepted", () => {
  const cutoffMs = Date.parse("2026-10-13T04:00:00Z");
  const observation = { key: "vix_level", value: 18.2, observed_at_utc: "2026-10-13T04:00:00Z" };
  assert.equal(assertAsOf(observation, cutoffMs), observation);
});

test("a snapshot carrying one late value fails as a whole", () => {
  assert.throws(
    () =>
      buildAsOfSnapshot({
        session_id: "USD-2026-10-13",
        day_utc: "2026-10-13T00:00:00Z",
        observations: [
          { key: "vix_level", value: 18.2, observed_at_utc: "2026-10-12T20:15:00Z" },
          { key: "release_outcome", value: "hot", observed_at_utc: "2026-10-13T12:30:00Z" }
        ]
      }),
    /release_outcome: observed at 2026-10-13T12:30:00Z after the cutoff/
  );
});

test("a well-formed snapshot keeps every observation and resolves the session", () => {
  const snapshot = buildAsOfSnapshot({
    session_id: "USD-2026-10-13",
    day_utc: "2026-10-13T00:00:00Z",
    observations: [
      { key: "vix_level", value: 18.2, observed_at_utc: "2026-10-12T20:15:00Z" },
      { key: "usd_level", value: 118.9, observed_at_utc: "2026-10-12T21:00:00Z" }
    ]
  });
  assert.equal(snapshot.observations.length, 2);
  assert.equal(snapshot.session.cutoff_at_utc, "2026-10-13T04:00:00.000Z");
});

test("an observation without an observed instant is refused rather than assumed", () => {
  assert.throws(
    () => assertAsOf({ key: "usd_level", value: 118.9 }, Date.parse("2026-10-13T04:00:00Z")),
    /needs observed_at_utc/
  );
});

test("the trace record states the engine is an interface, not an implementation", () => {
  const session = resolveSession(day("2026-10-13"));
  const trace = buildTraceRecord({ session, observations: [], factor_verdicts: [], combination: null, decision: null });
  assert.equal(trace.engine_version, "usd-session-engine-interface-v2");
  assert.match(trace.note, /interface placeholder/);
  assert.equal(trace.session.window_hours, 24);
});

test("instantForLocalTime round-trips through the offset", () => {
  const instant = instantForLocalTime(day("2026-01-20"), 5, 0, "Europe/London");
  assert.equal(new Date(instant).toISOString(), "2026-01-20T05:00:00.000Z");
});
