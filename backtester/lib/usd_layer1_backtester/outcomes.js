"use strict";

/**
 * Session outcomes for the four markets (research only).
 *
 * A session runs from its 05:00 London cutoff to 05:00 London the next local date. The open is the close
 * of the one-hour bar opening at the cutoff and the close is the close of the bar opening at the next
 * cutoff, so both endpoints resolve differently for each date and neither is inferred from a daily bar
 * (a daily bar closes at 17:00 New York, which is a different question).
 *
 * The flat band is measured on the absolute move over development dates only, then frozen for the unseen
 * dates, so a model can never be credited for a session that barely moved.
 */

const { MARKETS, FLAT_BAND } = require("./contracts");
const { priceAtHour } = require("./inputs");

function percentile(values, share) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * (share / 100);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function round(value, decimals) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Read the open and close of every session for every market.
 *
 * @param {object} options
 * @param {Array} options.sessions `{ date, cutoff_at_utc, endpoint_at_utc }`
 * @param {object} options.seriesByMarket `{ EURUSD: series, ... }` hourly series, any of which may be null.
 * @returns {object} `{ date: { MARKET: { open, close, move_pct, present, reason } } }`
 */
function readSessionMoves({ sessions, seriesByMarket }) {
  const moves = {};
  for (const session of sessions) {
    const perMarket = {};
    for (const market of MARKETS) {
      const series = seriesByMarket[market.key] || null;
      if (!series) {
        perMarket[market.key] = {
          open: null,
          close: null,
          move_pct: null,
          present: false,
          reason: `${market.outcome_series} is not cached in this checkout`
        };
        continue;
      }
      const open = priceAtHour(series, session.cutoff_at_utc);
      const close = priceAtHour(series, session.endpoint_at_utc);
      if (!Number.isFinite(open.price) || !Number.isFinite(close.price)) {
        perMarket[market.key] = {
          open: open.price,
          close: close.price,
          move_pct: null,
          present: false,
          reason: !Number.isFinite(open.price)
            ? `no opening bar: ${open.reason}`
            : `no closing bar: ${close.reason}`
        };
        continue;
      }
      perMarket[market.key] = {
        open: open.price,
        open_bar: open.bar,
        close: close.price,
        close_bar: close.bar,
        move_pct: round(((close.price / open.price) - 1) * 100, 4),
        present: true,
        reason: null
      };
    }
    moves[session.date] = perMarket;
  }
  return moves;
}

/**
 * Freeze the flat band per market from development-window moves only.
 *
 * @param {object} moves the `readSessionMoves` map.
 * @param {string[]} developmentDates the dates declared as development.
 * @returns {object} `{ MARKET: { flat_band_pct, sample, rule } }`
 */
function freezeFlatBands(moves, developmentDates) {
  const bands = {};
  for (const market of MARKETS) {
    const magnitudes = developmentDates
      .map((date) => (moves[date] && moves[date][market.key] ? moves[date][market.key].move_pct : null))
      .filter((value) => Number.isFinite(value))
      .map((value) => Math.abs(value));
    const band = percentile(magnitudes, FLAT_BAND.percentile);
    bands[market.key] = {
      flat_band_pct: Number.isFinite(band) ? round(band, FLAT_BAND.decimals) : null,
      sample: magnitudes.length,
      rule: FLAT_BAND.rule,
      frozen: "computed from development dates only and applied unchanged to every later date in this run"
    };
  }
  return bands;
}

/**
 * Classify each session move as UP, DOWN or FLAT against the frozen band.
 *
 * @returns {object} the moves map with `direction` and `flat_band_pct` added per market.
 */
function classifyMoves(moves, bands) {
  const classified = {};
  for (const [date, perMarket] of Object.entries(moves)) {
    classified[date] = {};
    for (const market of MARKETS) {
      const entry = perMarket[market.key];
      const band = bands[market.key] ? bands[market.key].flat_band_pct : null;
      if (!entry || !entry.present || !Number.isFinite(entry.move_pct) || !Number.isFinite(band)) {
        classified[date][market.key] = {
          ...entry,
          direction: null,
          flat_band_pct: band,
          scored: false
        };
        continue;
      }
      const magnitude = Math.abs(entry.move_pct);
      const direction = magnitude <= band ? "FLAT" : (entry.move_pct > 0 ? "UP" : "DOWN");
      classified[date][market.key] = {
        ...entry,
        direction,
        flat_band_pct: band,
        scored: direction !== "FLAT"
      };
    }
  }
  return classified;
}

/**
 * Did the market do what a USD call predicted? A USD-bullish call predicts the market falls, because the
 * call is a dollar call and the other four series are quoted against it.
 */
function callOutcome({ callDirection, marketDirection, market }) {
  if (!callDirection || callDirection === "NO_CALL" || !marketDirection) return "unscored";
  if (marketDirection === "FLAT") return "flat";
  const predicted = callDirection === "BULLISH" ? market.usd_bullish_predicts : (market.usd_bullish_predicts === "DOWN" ? "UP" : "DOWN");
  return marketDirection === predicted ? "hit" : "miss";
}

module.exports = {
  percentile,
  round,
  readSessionMoves,
  freezeFlatBands,
  classifyMoves,
  callOutcome
};
