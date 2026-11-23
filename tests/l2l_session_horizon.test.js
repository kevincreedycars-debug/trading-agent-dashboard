"use strict";

// The session-horizon proof for outcome pricing and both execution simulations.
//
// The contract is 05:00 Europe/London to 05:00 Europe/London on the next local date. These cases show that
// the pricing reader and the two frozen L2L simulations stop at that endpoint, including the sessions either
// side of a London clock change, and that a bar belonging to the following session is counted and dropped
// rather than simulated. Synthetic tapes only: this is a statement about the engine's bound, not a measured
// trading result.

const assert = require("node:assert/strict");
const test = require("node:test");

const l2l = require("../lib/layer1_backtesting/l2l_simulation");
const outcomes = require("../backtester/lib/usd_layer1_backtester/outcomes");
const sessionInterface = require("../backtester/lib/usd_session_engine_interface");

const day = (date) => Date.parse(`${date}T00:00:00Z`);
const sessionFor = (date) => ({ date, ...sessionInterface.resolveSession(day(date)) });

/** A one-market list, so the reader is exercised without the cached four. */
const ONE_MARKET = [
  { key: "EURUSD", label: "EUR/USD", outcome_series: "synthetic.csv", usd_bullish_predicts: "DOWN" }
];

test("both ends of the session are 05:00 London on every weekday either side of a clock change", () => {
  const cases = [
    { date: "2026-03-27", cutoff: "2026-03-27T05:00:00.000Z", endpoint: "2026-03-28T05:00:00.000Z", from: "GMT", to: "GMT" },
    { date: "2026-03-30", cutoff: "2026-03-30T04:00:00.000Z", endpoint: "2026-03-31T04:00:00.000Z", from: "BST", to: "BST" },
    { date: "2026-10-23", cutoff: "2026-10-23T04:00:00.000Z", endpoint: "2026-10-24T04:00:00.000Z", from: "BST", to: "BST" },
    { date: "2026-10-26", cutoff: "2026-10-26T05:00:00.000Z", endpoint: "2026-10-27T05:00:00.000Z", from: "GMT", to: "GMT" },
    { date: "2027-03-26", cutoff: "2027-03-26T05:00:00.000Z", endpoint: "2027-03-27T05:00:00.000Z", from: "GMT", to: "GMT" },
    { date: "2027-03-29", cutoff: "2027-03-29T04:00:00.000Z", endpoint: "2027-03-30T04:00:00.000Z", from: "BST", to: "BST" }
  ];
  for (const entry of cases) {
    const session = sessionInterface.resolveSession(day(entry.date));
    assert.equal(session.cutoff_at_utc, entry.cutoff, `${entry.date} cutoff`);
    assert.equal(session.endpoint_at_utc, entry.endpoint, `${entry.date} endpoint`);
    assert.equal(session.window_hours, 24, `${entry.date} must be exactly 24 hours`);
    assert.equal(session.cutoff_offset_abbrev, entry.from);
    assert.equal(session.endpoint_offset_abbrev, entry.to);
    assert.equal(session.session_starts_weekday, true);
  }
});

test("the weekend start that contains the London change is not a session, and its window is not 24 hours", () => {
  const spring = sessionInterface.resolveSession(day("2026-03-28"));
  assert.equal(spring.window_hours, 23);
  assert.equal(spring.session_starts_weekday, false);
  const autumn = sessionInterface.resolveSession(day("2026-10-24"));
  assert.equal(autumn.window_hours, 25);
  assert.equal(autumn.session_starts_weekday, false);
  // Every eligible Monday-to-Friday start in 2026 is exactly 24 hours, which is the property the two
  // simulations depend on: a tape cut at the endpoint is exactly one session long.
  let checked = 0;
  for (let cursor = day("2026-01-01"); cursor <= day("2026-12-31"); cursor += 24 * 60 * 60 * 1000) {
    const date = new Date(cursor).toISOString().slice(0, 10);
    const session = sessionInterface.resolveSession(cursor);
    if (!session.session_starts_weekday) continue;
    checked += 1;
    assert.equal(session.window_hours, 24, `${date} is an eligible session and must be 24 hours`);
  }
  assert.equal(checked, 261);
});


test("outcome pricing reads the close at the following 05:00 London and never a later bar", () => {
  const session = sessionFor("2026-03-30");
  const series = {
    closes: new Map([
      ["2026-03-30T04:00:00.000Z", 100],
      ["2026-03-30T12:00:00.000Z", 101],
      ["2026-03-31T04:00:00.000Z", 90],
      // The next session's opening bar: a much larger move that must not be read as this session's close.
      ["2026-03-31T05:00:00.000Z", 500]
    ])
  };
  const moves = outcomes.readSessionMoves({
    sessions: [session],
    seriesByMarket: { EURUSD: series },
    markets: ONE_MARKET
  });
  const move = moves["2026-03-30"].EURUSD;
  assert.equal(move.present, true);
  assert.equal(move.open, 100);
  assert.equal(move.close, 90);
  assert.equal(move.open_bar, "2026-03-30T04:00:00.000Z");
  assert.equal(move.close_bar, "2026-03-31T04:00:00.000Z");
  assert.equal(move.move_pct, -10);
});

test("both execution simulations drop a bar stamped at the endpoint and close the position inside the session", () => {
  const session = sessionFor("2026-03-30");
  const candles = [
    { time_utc: "2026-03-30T04:00:00.000Z", open: 1.1, high: 1.1002, low: 1.0998, close: 1.1 },
    { time_utc: "2026-03-31T03:55:00.000Z", open: 1.1, high: 1.1005, low: 1.0995, close: 1.1002 },
    // The following session's first bar would reach the 5R target; it must not be simulated.
    { time_utc: "2026-03-31T04:00:00.000Z", open: 1.1002, high: 1.2, low: 1.1002, close: 1.2 }
  ];
  for (const rule of ["full_5r", "half_3r"]) {
    const path = l2l.simulateSessionPath({
      session,
      candles,
      direction: "long",
      entry: 1.1,
      stop: 1.099,
      rule
    });
    assert.equal(path.outcome, "open", `${rule}: a target printed after the endpoint is not a target`);
    assert.equal(path.closed_at_session_end, true);
    assert.equal(path.exit, 1.1002, `${rule}: closed at the last close inside the session`);
    assert.equal(path.session_bound.dropped_at_or_after_endpoint, 1);
    assert.equal(path.session_bound.candles_in_session, 2);
    assert.equal(path.session.endpoint_at_utc, "2026-03-31T04:00:00.000Z");
    assert.equal(path.session.window_hours, 24);
  }
});

test("a target reached inside the session still counts, so the bound does not suppress real hits", () => {
  const session = sessionFor("2026-03-30");
  const path = l2l.simulateSessionPath({
    session,
    candles: [
      { time_utc: "2026-03-30T04:00:00.000Z", open: 1.1, high: 1.1002, low: 1.0998, close: 1.1 },
      { time_utc: "2026-03-31T03:55:00.000Z", open: 1.1002, high: 1.106, low: 1.1001, close: 1.1055 },
      { time_utc: "2026-03-31T04:00:00.000Z", open: 1.1055, high: 1.2, low: 1.1055, close: 1.2 }
    ],
    direction: "long",
    entry: 1.1,
    stop: 1.099,
    rule: "full_5r"
  });
  assert.equal(path.outcome, "target");
  assert.equal(path.r_gross, 5);
  assert.equal(path.session_bound.dropped_at_or_after_endpoint, 1);
});

test("the session tape is cut by instant, not by a fixed hour count, and refuses a bad window", () => {
  const saturday = sessionInterface.resolveSession(day("2026-10-24"));
  const bounded = l2l.sessionTape({
    candles: [{ time_utc: "2026-10-24T04:00:00.000Z", open: 1, high: 1, low: 1, close: 1 }],
    cutoff_at_utc: saturday.cutoff_at_utc,
    endpoint_at_utc: saturday.endpoint_at_utc
  });
  assert.equal(bounded.window_hours, 25);
  assert.equal(bounded.candles.length, 1);
  assert.throws(
    () =>
      l2l.sessionTape({
        candles: [],
        cutoff_at_utc: "2026-03-31T04:00:00.000Z",
        endpoint_at_utc: "2026-03-30T04:00:00.000Z"
      }),
    /endpoint must be after its cutoff/
  );
});

