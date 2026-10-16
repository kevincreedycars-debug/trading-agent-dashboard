const test = require("node:test");
const assert = require("node:assert/strict");

const {
  SESSION_CONTRACT,
  SessionContractError,
  resolveSession,
  instantForLocalTime,
  assertAsOf,
  buildAsOfSnapshot,
  buildTraceRecord
} = require("../lib/usd_session_engine_interface");

/**
 * Session-target contract for the USD session study (docs/research/usd-session/v1/session_contract_v1.json).
 * The two zones are independent; nothing may be derived from a fixed hour count.
 */

const day = (iso) => Date.parse(`${iso}T00:00:00Z`);

test("the contract names both zones and both local times", () => {
  assert.equal(SESSION_CONTRACT.cutoff_local, "05:00");
  assert.equal(SESSION_CONTRACT.cutoff_zone, "Europe/London");
  assert.equal(SESSION_CONTRACT.endpoint_local, "17:00");
  assert.equal(SESSION_CONTRACT.endpoint_zone, "America/New_York");
});

test("mid-October resolves to BST and EDT with a 17-hour window", () => {
  const session = resolveSession(day("2026-10-13"));
  assert.equal(session.cutoff_at_utc, "2026-10-13T04:00:00.000Z");
  assert.equal(session.cutoff_offset_abbrev, "BST");
  assert.equal(session.endpoint_at_utc, "2026-10-13T21:00:00.000Z");
  assert.equal(session.endpoint_offset_abbrev, "EDT");
  assert.equal(session.window_hours, 17);
});

test("mid-January resolves to GMT and EST with a 17-hour window", () => {
  const session = resolveSession(day("2026-01-20"));
  assert.equal(session.cutoff_at_utc, "2026-01-20T05:00:00.000Z");
  assert.equal(session.cutoff_offset_abbrev, "GMT");
  assert.equal(session.endpoint_at_utc, "2026-01-20T22:00:00.000Z");
  assert.equal(session.endpoint_offset_abbrev, "EST");
  assert.equal(session.window_hours, 17);
});

test("the mismatch between US and EU changeover gives a 16-hour window", () => {
  // 2026-03-23: London is still on GMT (BST starts 2026-03-29) while New York is already on EDT.
  const session = resolveSession(day("2026-03-23"));
  assert.equal(session.cutoff_offset_abbrev, "GMT");
  assert.equal(session.endpoint_offset_abbrev, "EDT");
  assert.equal(session.window_hours, 16);
});

test("the autumn mismatch also gives a 16-hour window", () => {
  // 2026-10-27: London has fallen back to GMT (2026-10-25) while New York is still on EDT until 2026-11-01.
  const session = resolveSession(day("2026-10-27"));
  assert.equal(session.cutoff_at_utc, "2026-10-27T05:00:00.000Z");
  assert.equal(session.cutoff_offset_abbrev, "GMT");
  assert.equal(session.endpoint_offset_abbrev, "EDT");
  assert.equal(session.window_hours, 16);
});

test("once New York has also changed, the window returns to 17 hours", () => {
  const session = resolveSession(day("2026-11-03"));
  assert.equal(session.cutoff_at_utc, "2026-11-03T05:00:00.000Z");
  assert.equal(session.endpoint_at_utc, "2026-11-03T22:00:00.000Z");
  assert.equal(session.cutoff_offset_abbrev, "GMT");
  assert.equal(session.endpoint_offset_abbrev, "EST");
  assert.equal(session.window_hours, 17);
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
  assert.equal(trace.engine_version, "usd-session-engine-interface-v1");
  assert.match(trace.note, /interface placeholder/);
  assert.equal(trace.session.window_hours, 17);
});

test("instantForLocalTime round-trips through the offset", () => {
  const instant = instantForLocalTime(day("2026-01-20"), 5, 0, "Europe/London");
  assert.equal(new Date(instant).toISOString(), "2026-01-20T05:00:00.000Z");
});
