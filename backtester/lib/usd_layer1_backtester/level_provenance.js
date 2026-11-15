"use strict";

/**
 * Where the L2L ladder came from, and which sessions it can honestly price (research only).
 *
 * Both line-to-line tests replay trades off `data/l2l-levels.json`. The question this module answers is not
 * "does the file parse" but "did those lines exist before the session was traded", because a ladder marked
 * once and reused across years would turn every replay into a worked tape.
 *
 * The answer, from the artifact and from every surviving copy of it:
 *
 *   * it is our strategy's own saved price ladder, not an MT5 depth-of-market snapshot;
 *   * every price in it was hand-marked on the live dashboard, or is arithmetic on two hand-marked seeds -
 *     the marking tool's README says so and the artifact carries `marked_by` to say which writer wrote it;
 *   * it is one grid per instrument, stamped once (2026-10-04T16:14:19Z; BTCUSD first at 2026-10-03T20:57:49Z)
 *     and never re-marked, so the original marks survive on exactly those dates and on no others.
 *
 * Therefore a session can be priced only if its 05:00 London start is later than the ladder's own stamp. The
 * module counts that per instrument rather than assuming it, and counts the sessions it excludes so the
 * excluded ones are visible beside the figure.
 */

const fs = require("node:fs");

/** The lane's labels, in dashboard order, each with the broker's own symbol for the same instrument. */
const LANES = Object.freeze([
  { key: "EURUSD", label: "EUR/USD", broker_symbol: "EURUSD" },
  { key: "XAUUSD", label: "Gold", broker_symbol: "XAUUSD" },
  { key: "NAS100", label: "NAS100", broker_symbol: "US100.cash" },
  { key: "BTCUSD", label: "BTC/USD", broker_symbol: "BTCUSD" }
]);

/** Europe/London is BST from 01:00 UTC on the last Sunday of March to 01:00 UTC on the last Sunday of October. */
function londonOffsetHours(instantMs) {
  const date = new Date(instantMs);
  const year = date.getUTCFullYear();
  const lastSunday = (month) => {
    const end = Date.UTC(year, month, 1) - 24 * 60 * 60 * 1000;
    return end - new Date(end).getUTCDay() * 24 * 60 * 60 * 1000;
  };
  const start = lastSunday(3) + 60 * 60 * 1000;
  const end = lastSunday(10) + 60 * 60 * 1000;
  return instantMs >= start && instantMs < end ? 1 : 0;
}

/** The UTC instant of 05:00 Europe/London on a `YYYY-MM-DD` session date. */
function sessionStartMs(date) {
  const naive = Date.parse(`${date}T05:00:00.000Z`);
  if (!Number.isFinite(naive)) return null;
  return naive - londonOffsetHours(naive + 60 * 60 * 1000) * 60 * 60 * 1000;
}

function findInstrument(ladder, keys) {
  const wanted = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
  for (const instrument of (ladder && ladder.instruments) || []) {
    if (wanted.includes(instrument.symbol)) return instrument;
  }
  return null;
}

function readLadder(file) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return null;
  }
}


/**
 * Per instrument: the levels, the hand-marking dates that survive, and the sessions the ladder can price.
 *
 * @param {object} options
 * @param {object|null} options.ladder the parsed ladder document
 * @param {string[]} options.dates the session dates the run processed
 * @param {string} [options.source] the path the ladder came from, for the artefact
 * @returns {object} the provenance block
 */
function buildLevelProvenance({ ladder, dates = [], source = null }) {
  if (!ladder) {
    return {
      available: false,
      source,
      reason:
        "data/l2l-levels.json is not present in this checkout, so the line-to-line tests have no ladder to " +
        "replay and no level can be traced to a marking date",
      instruments: [],
      totals: {
        sessions_with_usable_levels: { EURUSD: 0, XAUUSD: 0, NAS100: 0, BTCUSD: 0 },
        sessions_eligible_for_all_four: 0,
        sessions_eligible_for_all_four_list: []
      }
    };
  }

  const instruments = LANES.map((lane) => {
    const instrument = findInstrument(ladder, [lane.broker_symbol, lane.key]);
    const levels = instrument && Array.isArray(instrument.levels) ? instrument.levels : [];
    const seeds = levels.filter((level) => level.role === "seed");
    const markedAt = [...new Set(levels.map((level) => level.marked_at_utc).filter(Boolean))].sort();
    const markedMs = Date.parse(ladder.generated_at_utc || "") || null;
    const usable = levels.length
      ? dates.filter((date) => {
          const start = sessionStartMs(date);
          return Number.isFinite(start) && Number.isFinite(markedMs) && markedMs < start;
        })
      : [];
    const before = levels.length ? dates.filter((date) => !usable.includes(date)) : dates.slice();
    return {
      key: lane.key,
      label: lane.label,
      broker_symbol: instrument ? instrument.symbol : lane.broker_symbol,
      levels: levels.length,
      seeds: seeds.length,
      derived: levels.filter((level) => level.role === "derived").length,
      seed_prices: seeds.map((level) => level.price),
      marked_at_utc: markedAt,
      marking_dates: [...new Set(markedAt.map((stamp) => stamp.slice(0, 10)))].sort(),
      ladder_stamp_utc: ladder.generated_at_utc || null,
      first_eligible_session: usable.length ? usable[0] : null,
      usable_sessions: usable,
      sessions_before_the_marks: before.length,
      sessions_eligible: usable.length
    };
  });

  const keyed = Object.fromEntries(instruments.map((instrument) => [instrument.key, instrument]));
  const allFour = dates.filter((date) =>
    LANES.every((lane) => keyed[lane.key].usable_sessions.includes(date))
  );

  return {
    available: true,
    source,
    marked_by: ladder.marked_by || null,
    ladder_stamp_utc: ladder.generated_at_utc || null,
    what_it_is:
      "our strategy's own saved price ladder, hand-marked on the live dashboard and stored in " +
      "data/l2l-levels.json - not an MT5 depth-of-market snapshot (the terminal serves no historical depth)",
    reproduction:
      "every seed price was marked by hand; every other level is arithmetic on two hand-marked prices, so the " +
      "derived levels reproduce from the seeds alone and the seeds reproduce from nothing - which is why the " +
      "marking dates, not a generator, are what a replay has to be dated against",
    eligibility_rule:
      "a session may be priced by the ladder only when its 05:00 London start is later than the ladder's own " +
      "stamp, so the lines were already in the file when the session was traded",
    instruments,
    totals: {
      sessions_with_usable_levels: Object.fromEntries(
        instruments.map((instrument) => [instrument.key, instrument.sessions_eligible])
      ),
      sessions_eligible_for_all_four: allFour.length,
      sessions_eligible_for_all_four_list: allFour
    }
  };
}

module.exports = { LANES, londonOffsetHours, sessionStartMs, findInstrument, readLadder, buildLevelProvenance };
