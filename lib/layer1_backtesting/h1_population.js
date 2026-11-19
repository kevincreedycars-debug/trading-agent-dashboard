/**
 * Reconcile the published H1 population before any candidate claims a denominator.
 *
 * Three figures circulated together and looked contradictory: "675 priced control mornings", "145
 * Friday mornings without outcomes" and "725 run-v1 sessions". They are not three counts of the same
 * thing. This module reads the committed run-v1 artefact and states, per figure, what it counts and
 * what it must never be used as:
 *
 *   725 = scheduled session rows, 145 per weekday (Monday to Friday).
 *   566 = rows where all four market outcomes exist; 568 = rows with at least three; 725 = rows with at
 *         least one, because 155 Fridays carry BTC/USD only.
 *   675 = rows where the control model had at least one market move that was not flat (the screen's
 *         `four_markets` cell marks a row `scored` on that test), not "priced mornings".
 *   685 = the `four_markets.usable_sessions` figure published in run-v1 and quoted as "685 of 725 sessions
 *         priced". It is NOT reproducible from the committed sessions: nothing in the artefact records
 *         the rule, and the only defensible totals are 566 (all four) and 568 (at least three).
 *   360 = the DXY.cash lane's priced sessions; 284 = its directional denominator (141 hits, 143 misses).
 *   439 = the EUR/USD denominator behind the 49.43% control figure.
 *   145 = Friday rows, which have no EUR/USD, XAU/USD or NAS100 outcome because the 05:00 London
 *         endpoint falls on Saturday; BTC/USD has all 145.
 *
 * Research only. It reads committed artefacts and never re-prices anything.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SCHEMA_VERSION = "h1-population-v1";
const RUN_PATH = "data/usd-layer1-backtester/run-v1.json";
const MARKETS = Object.freeze(["EURUSD", "XAUUSD", "BTCUSD", "NAS100"]);
const WEEKDAY_NAMES = Object.freeze({
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
});

const WEEKDAY_SENTENCE =
  "The session date is the local calendar date whose 05:00 London cutoff opens the window; the outcome " +
  "endpoint is 05:00 London on the next local date, which is Saturday for a Friday session.";

function weekdayOf(date) {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(ms)) throw new Error(`unparseable session date ${date}`);
  return new Date(ms).getUTCDay();
}

function emptyRow() {
  return { present: 0, missing: 0, scored: 0, flat: 0, no_call: 0, no_outcome: 0 };
}

/**
 * Bucket a session exactly as the published per-market `overall` block does: a NO_CALL morning is
 * `no_call` whether or not the market priced it, an uncalled morning without a price is `no_outcome`,
 * and a price with a call is either scored (hit/miss) or flat.
 */
function countOutcome(acc, { present, result, directional }) {
  if (!directional) acc.no_call += 1;
  else if (!present) acc.no_outcome += 1;
  else if (result === "hit" || result === "miss") acc.scored += 1;
  else acc.flat += 1;
}


/**
 * @param {object} options
 * @param {object} options.run the committed run-v1 panel.
 * @param {object} [options.screen] the committed screen, used only to quote its own counts.
 * @returns {object} the reconciliation artefact.
 */
function summarisePopulation({ run, screen = null } = {}) {
  if (!run || !Array.isArray(run.sessions)) throw new Error("run-v1 sessions are required");

  const weekdays = {};
  const markets = {};
  for (const market of MARKETS) {
    markets[market] = { ...emptyRow(), missing_by_weekday: {}, reason: {} };
  }
  const fridays = { sessions: 0, markets: {}, control_directional_calls: 0, scored_rows: 0 };
  for (const market of MARKETS) fridays.markets[market] = { present: 0, scored: 0, flat: 0 };
  const control = { directional_calls: 0, no_call: 0, scored_rows: 0 };
  const joint = { all_four_present: 0, one_to_three_present: 0, none_present: 0, any_present: 0 };
  const presentCounts = {};
  const missingSamples = Object.fromEntries(MARKETS.map((market) => [market, []]));

  for (const session of run.sessions) {
    const weekday = weekdayOf(session.date);
    weekdays[weekday] = (weekdays[weekday] || 0) + 1;
    const results = (session.results && session.results.current) || {};
    const direction = (session.models && session.models.current && session.models.current.direction) || "NO_CALL";
    const directional = direction !== "NO_CALL";
    if (directional) control.directional_calls += 1;
    else control.no_call += 1;

    let present = 0;
    let anyScored = false;
    for (const market of MARKETS) {
      const outcome = session.outcomes && session.outcomes[market];
      const row = markets[market];
      const priced = Boolean(outcome && outcome.present);
      countOutcome(row, { present: priced, result: results[market], directional });
      if (priced) {
        row.present += 1;
        present += 1;
        if (directional && (results[market] === "hit" || results[market] === "miss")) anyScored = true;
      } else {
        row.missing += 1;
        const reason = (outcome && outcome.reason) || "no outcome stored";
        row.reason[reason] = (row.reason[reason] || 0) + 1;
        row.missing_by_weekday[weekday] = (row.missing_by_weekday[weekday] || 0) + 1;
        if (missingSamples[market].length < 5) missingSamples[market].push({ date: session.date, weekday, reason });
      }
      if (weekday === 5) {
        const cell = fridays.markets[market];
        if (priced) {
          cell.present += 1;
          if (directional && (results[market] === "hit" || results[market] === "miss")) cell.scored += 1;
          if (directional && results[market] === "flat") cell.flat += 1;
        }
      }
    }
    presentCounts[present] = (presentCounts[present] || 0) + 1;
    if (present === MARKETS.length) joint.all_four_present += 1;
    else if (present === 0) joint.none_present += 1;
    else joint.one_to_three_present += 1;
    if (present > 0) joint.any_present += 1;
    if (anyScored) control.scored_rows += 1;
    if (weekday === 5) {
      fridays.sessions += 1;
      if (directional) fridays.control_directional_calls += 1;
      if (anyScored) fridays.scored_rows += 1;
    }
  }

  for (const market of MARKETS) markets[market].missing_sample = missingSamples[market];

  return {
    schema_version: SCHEMA_VERSION,
    as_of: run.generated_at || null,
    source: { path: RUN_PATH, sessions: run.sessions.length },
    rows: {
      scheduled: run.sessions.length,
      first: run.sessions[0] ? run.sessions[0].date : null,
      last: run.sessions.length ? run.sessions[run.sessions.length - 1].date : null,
      weekdays,
      note: WEEKDAY_SENTENCE,
    },
    markets,
    joint: { ...joint, present_counts: presentCounts },
    fridays,
    control,
    tests: testDenominators(run, screen),
    published_counts: publishedCountChecks({ run, joint, presentCounts }),
    reconciliation: reconciliationStatements({ run, joint, control, fridays, markets, presentCounts }),
    statement:
      "675 is a count of mornings where the control had at least one non-flat market outcome. It is not a " +
      "price count and not any market's denominator. 685 is a published label the sessions do not reproduce. " +
      "The only auditable denominators are the per-market ones, and the 145 Friday rows contribute to BTC/USD only.",
  };
}


/** Pull the denominators the published tests actually used, straight from run-v1. */
function testDenominators(run, screen) {
  const dxy = (run.tests && run.tests.dxy_direction_broker_cfd) || null;
  const four = (run.tests && run.tests.four_markets) || null;
  const perMarket = {};
  const markets = (four && four.models && four.models.current && four.models.current.markets) || {};
  for (const market of MARKETS) {
    const overall = (markets[market] && markets[market].overall) || null;
    perMarket[market] = overall
      ? {
          scored: overall.scored,
          hits: overall.hits,
          misses: overall.misses,
          flat: overall.flat,
          no_call: overall.no_call,
          no_outcome: overall.no_outcome,
          accuracy_pct: overall.accuracy_pct,
          lower_bound_pct: overall.lower_bound_pct,
          rows_checked: overall.scored + overall.flat + overall.no_call + overall.no_outcome,
        }
      : null;
  }
  const definitions = (screen && screen.tests && screen.tests.definitions) || [];
  const fourDefinition = definitions.find((definition) => definition.id === "four_markets") || null;
  return {
    dxy_broker_cfd: dxy
      ? {
          instrument: dxy.instrument || null,
          sessions_with_price: dxy.usable_sessions,
          awaiting_prices_sessions: dxy.awaiting_prices_sessions,
          directional_denominator: dxy.models.current.overall.scored,
          calls_made: dxy.models.current.calls_made,
          paired_sessions: dxy.models.current.paired_sessions,
          overall: dxy.models.current.overall,
        }
      : null,
    four_markets: {
      usable_sessions: four ? four.usable_sessions : null,
      sessions_with_any_outcome: four ? four.sessions_with_any_outcome : null,
      per_market: perMarket,
      screen_counts: fourDefinition ? fourDefinition.counts : null,
    },
  };
}

/** Published aggregate counts, each checked against what the committed sessions actually contain. */
function publishedCountChecks({ run, joint, presentCounts }) {
  const four = (run.tests && run.tests.four_markets) || {};
  const atLeastThree = (presentCounts[3] || 0) + (presentCounts[4] || 0);
  return {
    four_markets_usable_sessions: {
      published: four.usable_sessions === undefined ? null : four.usable_sessions,
      measured_all_four_present: joint.all_four_present,
      measured_at_least_three_present: atLeastThree,
      reproduces: four.usable_sessions === joint.all_four_present,
      note:
        "`usable_sessions` is published as 685 and quoted in docs/strategy/BACKTEST_AUDIT.md as \"685 of 725 " +
        "sessions priced\". The committed sessions do not reproduce it: 566 carry all four outcomes and 568 " +
        "carry at least three. Nothing in the artefact records the rule behind 685, so it must not be used " +
        "as a denominator; the per-market counts above are the auditable figures.",
    },
    four_markets_sessions_with_any_outcome: {
      published: four.sessions_with_any_outcome === undefined ? null : four.sessions_with_any_outcome,
      measured: joint.any_present,
      reproduces: four.sessions_with_any_outcome === joint.any_present,
    },
    present_market_counts: presentCounts,
  };
}

function reconciliationStatements({ run, joint, control, fridays, markets, presentCounts }) {
  const total = run.sessions.length;
  const perWeekday = run.sessions.reduce((acc, session) => {
    const weekday = weekdayOf(session.date);
    acc[weekday] = (acc[weekday] || 0) + 1;
    return acc;
  }, {});
  return [
    {
      figure: total,
      meaning: "scheduled sessions, one per local calendar date in the run window",
      not_meaning: "mornings with a complete four-market outcome panel",
      evidence: `run-v1 sessions by weekday: ${Object.entries(perWeekday)
        .map(([weekday, count]) => `${WEEKDAY_NAMES[weekday]} ${count}`)
        .join(", ")}`,
    },
    {
      figure: joint.all_four_present,
      meaning: "sessions where EUR/USD, XAU/USD, BTC/USD and NAS100 all carry a 05:00-to-05:00 outcome",
      not_meaning: "the number of sessions either test scores; each market keeps its own denominator",
      evidence: `run-v1 sessions[].outcomes[*].present (present-market counts: ${JSON.stringify(
        presentCounts
      )}; 155 sessions carry BTC/USD alone)`,
    },
    {
      figure: 685,
      meaning: "the value published as `four_markets.usable_sessions` and quoted as \"685 of 725 sessions priced\"",
      not_meaning:
        "a measured count. The committed sessions reproduce neither 685 nor any rule that yields it: " +
        `${joint.all_four_present} carry all four outcomes and ${(presentCounts[3] || 0) + (presentCounts[4] || 0)} ` +
        "carry at least three. Use the per-market denominators instead",
      evidence: "run-v1.tests.four_markets.usable_sessions versus run-v1.sessions[].outcomes",
      unresolved: true,
    },
    {
      figure: control.scored_rows,
      meaning:
        "mornings where the control model had at least one market outcome that was not flat, which is the " +
        "condition the screen's four_markets cell reports as `scored`",
      not_meaning: "priced mornings, or the denominator behind any accuracy percentage",
      evidence: "lib/layer1_backtesting/screen.js cellFor() testId four_markets",
    },
    {
      figure: control.directional_calls,
      meaning: "mornings where the control returned BULLISH or BEARISH rather than NO_CALL",
      not_meaning: "mornings with a price at both endpoints",
      evidence: "run-v1 sessions[].models.current.direction",
    },
    {
      figure: fridays.sessions,
      meaning:
        "Friday sessions. Their 05:00 London endpoint is Saturday 05:00, when EUR/USD, XAU/USD and NAS100 " +
        "are closed, so those three markets have no outcome on any Friday.",
      not_meaning: "a session-level failure: BTC/USD prices every one of them",
      evidence: `run-v1 outcomes by market: EURUSD ${markets.EURUSD.present}/${total} present, XAUUSD ${
        markets.XAUUSD.present
      }/${total}, BTCUSD ${markets.BTCUSD.present}/${total}, NAS100 ${markets.NAS100.present}/${total}`,
    },
    {
      figure: fridays.sessions * 3,
      meaning: "the missing Friday outcomes across EUR/USD, XAU/USD and NAS100 (145 sessions each)",
      not_meaning: "a missing endpoint for BTC/USD or a missing morning for the control model",
      evidence: "run-v1 sessions[].outcomes[*].present by weekday",
    },
    dxyLaneStatement(run),
  ];
}

/** The broker DXY lane's own denominator, quoted from run-v1 rather than recomputed. */
function dxyLaneStatement(run) {
  const dxy = (run.tests && run.tests.dxy_direction_broker_cfd) || null;
  const overall = dxy && dxy.models && dxy.models.current && dxy.models.current.overall ? dxy.models.current.overall : null;
  if (!overall) {
    return {
      figure: null,
      meaning: "the DXY.cash lane",
      not_meaning: "scored: run-v1 carries no dxy_direction_broker_cfd block",
      evidence: "run-v1.tests",
    };
  }
  return {
    figure: overall.scored,
    meaning:
      `the DXY.cash lane's directional denominator: of ${dxy.usable_sessions} sessions whose two 05:00 London ` +
      `endpoints the broker tape prices, the control made a directional call on ${overall.scored} (${overall.hits} ` +
      `hits, ${overall.misses} misses, ${overall.flat} flat, ${overall.no_call} no-call)`,
    not_meaning: "a claim about the official ICE dollar index, which this lane does not use",
    evidence: "run-v1.tests.dxy_direction_broker_cfd.models.current.overall",
  };
}

function readRun({ root }) {
  return JSON.parse(fs.readFileSync(path.join(root, RUN_PATH), "utf8"));
}

module.exports = {
  SCHEMA_VERSION,
  RUN_PATH,
  MARKETS,
  WEEKDAY_NAMES,
  WEEKDAY_SENTENCE,
  weekdayOf,
  summarisePopulation,
  readRun,
};
