"use strict";

const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const { summarisePopulation, readRun, weekdayOf } = require("../lib/layer1_backtesting/h1_population");

const ROOT = path.resolve(__dirname, "..");

/** A session row shaped like run-v1's, carrying only what the population summary reads. */
function session({ date, direction = "BULLISH", present = {}, results = {} }) {
  const outcomes = {};
  for (const market of ["EURUSD", "XAUUSD", "BTCUSD", "NAS100"]) {
    outcomes[market] = present[market]
      ? { direction: "DOWN", move_pct: -0.5, present: true, reason: null }
      : { direction: null, move_pct: null, present: false, reason: "no 05:00 bar at the endpoint" };
  }
  return {
    date,
    cutoff_at_utc: `${date}T05:00:00.000Z`,
    endpoint_at_utc: `${date}T05:00:00.000Z`,
    window_hours: 24,
    models: { current: { direction } },
    outcomes,
    results: { current: results },
  };
}

test("the session date is the local date whose 05:00 cutoff opens the window", () => {
  assert.equal(weekdayOf("2024-01-05"), 5); // Friday: its endpoint is Saturday 05:00
  assert.equal(weekdayOf("2024-01-06"), 6);
  assert.throws(() => weekdayOf("not-a-date"), /unparseable session date/);
});

test("a priced market with a call is scored or flat; an unpriced one is no_outcome", () => {
  const run = {
    sessions: [
      session({ date: "2024-01-02", present: { EURUSD: true }, results: { EURUSD: "miss" } }),
      session({ date: "2024-01-03", present: { EURUSD: true }, results: { EURUSD: "flat" } }),
      session({ date: "2024-01-04", present: {}, results: {} }),
    ],
  };
  const summary = summarisePopulation({ run });
  const eur = summary.markets.EURUSD;
  assert.equal(eur.present, 2);
  assert.equal(eur.missing, 1);
  assert.equal(eur.scored, 1);
  assert.equal(eur.flat, 1);
  assert.equal(eur.no_outcome, 1);
  assert.equal(eur.no_call, 0);
  assert.equal(summary.joint.present_counts[0], 1);
  assert.equal(summary.joint.present_counts[1], 2);
  assert.equal(summary.control.scored_rows, 1, "a scored row needs at least one non-flat market outcome; a flat one cannot carry it");
});

test("a NO_CALL morning is no_call whether or not the market priced", () => {
  const run = {
    sessions: [
      session({ date: "2024-01-02", direction: "NO_CALL", present: { BTCUSD: true }, results: { BTCUSD: "hit" } }),
      session({ date: "2024-01-03", direction: "NO_CALL", present: {}, results: {} }),
    ],
  };
  const summary = summarisePopulation({ run });
  assert.equal(summary.markets.BTCUSD.no_call, 2);
  assert.equal(summary.markets.BTCUSD.scored, 0);
  assert.equal(summary.control.no_call, 2);
  assert.equal(summary.control.directional_calls, 0);
  assert.equal(summary.control.scored_rows, 0, "an uncalled market cannot score a control row");
});

test("a Friday row counts once, and only for the markets that actually priced", () => {
  const run = {
    sessions: [
      session({ date: "2024-01-05", present: { BTCUSD: true }, results: { BTCUSD: "hit" } }),
      session({ date: "2024-01-08", present: { BTCUSD: true, EURUSD: true }, results: { BTCUSD: "miss", EURUSD: "miss" } }),
    ],
  };
  const summary = summarisePopulation({ run });
  assert.equal(summary.fridays.sessions, 1);
  assert.equal(summary.fridays.markets.BTCUSD.present, 1);
  assert.equal(summary.fridays.markets.BTCUSD.scored, 1);
  for (const market of ["EURUSD", "XAUUSD", "NAS100"]) {
    assert.equal(summary.fridays.markets[market].present, 0, `${market} has no Saturday 05:00 endpoint to price`);
  }
  assert.equal(summary.rows.weekdays[5], 1);
  assert.equal(summary.rows.weekdays[1], 1);
});

test("the committed run reconciles 725, 675, 685 and the 145 Fridays", () => {
  const run = readRun({ root: ROOT });
  const summary = summarisePopulation({ run });

  assert.equal(summary.rows.scheduled, 725);
  assert.deepEqual(summary.rows.weekdays, { 1: 145, 2: 145, 3: 145, 4: 145, 5: 145 });

  // 675 is the control's scored-row count, not a price count and not a denominator.
  assert.equal(summary.control.scored_rows, 675);
  assert.notEqual(summary.joint.all_four_present, 675);

  assert.equal(summary.joint.all_four_present, 566);
  assert.equal(summary.joint.present_counts[3] + summary.joint.present_counts[4], 568);
  assert.equal(summary.joint.any_present, 725);
  assert.equal(summary.joint.none_present, 0);

  assert.equal(summary.fridays.sessions, 145);
  for (const market of ["EURUSD", "XAUUSD", "NAS100"]) {
    assert.equal(summary.fridays.markets[market].present, 0);
  }
  assert.equal(summary.fridays.markets.BTCUSD.present, 145);

  // 685 is published but not reproducible, and the summary says so rather than quietly re-deriving it.
  const usable = summary.published_counts.four_markets_usable_sessions;
  assert.equal(usable.published, 685);
  assert.equal(usable.measured_all_four_present, 566);
  assert.equal(usable.measured_at_least_three_present, 568);
  assert.equal(usable.reproduces, false);
  assert.match(usable.note, /must not be used\s+as a denominator/);
  assert.equal(summary.published_counts.four_markets_sessions_with_any_outcome.reproduces, true);

  // The DXY lane's own figures come straight from the published block.
  assert.equal(summary.tests.dxy_broker_cfd.sessions_with_price, 360);
  assert.equal(summary.tests.dxy_broker_cfd.directional_denominator, 284);
  assert.equal(summary.tests.dxy_broker_cfd.overall.hits, 141);
  assert.equal(summary.tests.dxy_broker_cfd.overall.misses, 143);

  const figures = summary.reconciliation.map((entry) => entry.figure);
  assert.equal(figures.includes(725), true);
  assert.equal(figures.includes(675), true);
  assert.equal(figures.includes(145), true);
  assert.match(summary.statement, /685 is a published label the sessions do not reproduce/);
});
