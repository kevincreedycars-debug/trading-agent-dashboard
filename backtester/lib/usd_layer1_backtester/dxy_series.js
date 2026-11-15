"use strict";

/**
 * The broker CFD series for the DXY question (research only).
 *
 * Test 1 asks for official ICE cash DXY. That licence does not exist in this checkout, but the FTMO
 * terminal on this machine carries `DXY.cash`, which the broker describes as "Dollar Index, Spot CFD".
 * It is a different instrument: a broker CFD on the dollar index basket, with broker hours, broker
 * spreads and no official settlement print. So it is not substituted into test 1. It is measured,
 * labelled with its own name everywhere, and reported as a separate lane beside the blocked official one.
 *
 * The export in `backtester/scripts/export_ftmo_dxy_cash.py` already converted the terminal's server
 * clock to UTC and proved the offset against the UTC EUR/USD tape (UTC+2 winter, UTC+3 summer, US DST
 * dates). This module therefore reads UTC bars and never re-derives a timezone.
 */

const path = require("node:path");

const inputs = require("./inputs");
const outcomes = require("./outcomes");

/** Everything the panel and the artefact must say about the instrument, in one place. */
const INSTRUMENT = Object.freeze({
  id: "dxy_cash_broker_cfd",
  symbol: "DXY.cash",
  label: "DXY.cash (FTMO spot CFD)",
  provider: "FTMO Global Markets Ltd",
  provider_server: "FTMO-Server",
  terminal: "FTMO Global Markets MT5 Terminal",
  description: "Dollar Index, Spot CFD",
  kind: "broker_cfd",
  is_official_cash_dxy: false,
  quote_convention: "index points",
  digits: 3,
  usd_bullish_predicts: "UP",
  series_file: "backtester/tmp/ftmo_dxy_cash_h1.csv",
  exporter: "backtester/scripts/export_ftmo_dxy_cash.py",
  clock_rule:
    "the terminal stamps bars in server time; the exporter converts to UTC with the US daylight-saving " +
    "dates (UTC+2 outside, UTC+3 inside) and refuses to write unless the shift reproduces against the " +
    "UTC EUR/USD tape",
  what_it_is_not:
    "not the ICE cash index (no official settlement print, broker hours and broker spread) and not FRED " +
    "DTWEXBGS (a lagged broad trade-weighted index)",
  why_it_can_be_scored_here:
    "its hourly bars are quoted continuously across both 05:00 London endpoints, so the same " +
    "05:00-to-next-05:00 question can be put to a real, named, non-official instrument",
  why_it_cannot_replace_the_official_series:
    "a broker CFD's 05:00 print is one broker's quote rather than the licensed index, so a figure from it " +
    "cannot be reported as test 1's answer; the official lane stays blocked and this lane is labelled"
});

/**
 * The window this lane is declared to score.
 *
 * The instrument's own history begins on 2024-12-10: `D1` and `H1` both start there (server clock) and the
 * tick tape starts with them - a 10:00 probe on 2024-12-11 returns 1,967 two-sided `DXY.cash` ticks, while
 * probes on 2024-12-04, 2024-11-06, 2024-06, 2024-02, 2023 and 2022 return none
 * (`.local/tmp/dxy-scan/probe_dxy_boundary.py`, read-only).
 *
 * An earlier note in this project dated the tick start to 2025-01-08. That was the first *sampled* anchor at
 * which ticks appeared, not the start of the tape: the anchors either side were 2024-02 and 2025-01, a ten
 * month gap, and the instrument serves ticks from its first bar in between. The window is set to the tape's
 * own start so that no priced session is excluded on the strength of a sampling gap.
 *
 * The two endpoints are unchanged: a session is scored when its 05:00 London bar and the 05:00 London bar
 * that follows it both exist on the tape. Only the window is declared, and it is published with every figure.
 */
const SCORED_WINDOW = Object.freeze({
  first_session: "2024-12-10",
  boundary_source:
    ".local/tmp/dxy-scan/probe_dxy_boundary.py - the instrument's D1 and H1 history and its tick tape all " +
    "begin on 2024-12-10; a 2024-12-11 probe returns 1,967 two-sided ticks, probes at 2024-12-04 and earlier " +
    "return none",
  correction:
    "an earlier cycle reported the tick start as 2025-01-08; that was the first sampled anchor with ticks, " +
    "taken across a ten-month gap in the anchors, and the probes above supersede it",
  rule:
    "a session is scored when it starts on or after first_session and the tape prices both 05:00 London endpoints",
  what_is_excluded:
    "sessions before the instrument's first bar: the broker serves no bars and no ticks for them at all"
});

/**
 * Keep only the sessions inside the declared window, and say what was left out beside the count.
 *
 * @param {string[]} dates `YYYY-MM-DD` session dates.
 * @param {object} [window] the declared window.
 * @returns {{dates: string[], sessions_before_window: number, meta: object}}
 */
function scoredWindow(dates, window = SCORED_WINDOW) {
  const kept = dates.filter((date) => date >= window.first_session);
  const before = dates.length - kept.length;
  return {
    dates: kept,
    sessions_before_window: before,
    meta: {
      ...window,
      sessions_in_run: dates.length,
      sessions_in_window: kept.length,
      sessions_before_window: before
    }
  };
}

/**
 * Read the exported UTC tape.
 *
 * @param {string} [file] absolute path; defaults to the exported cache.
 * @returns {object|null} the same shape `inputs.readHourlySeries` returns, or null when absent.
 */
function loadSeries(file) {
  const absolute = file || path.join(inputs.REPO_ROOT, "backtester", "tmp", "ftmo_dxy_cash_h1.csv");
  return inputs.readHourlySeries(absolute);
}

/**
 * Price each session at both 05:00 London endpoints from the broker tape.
 *
 * The open is the close of the one-hour bar opening at the cutoff and the close is the close of the bar
 * opening at the next cutoff, exactly as the four markets are read, so the two lanes answer the same
 * question. A missing bar is reported as missing rather than borrowed from a neighbouring hour.
 *
 * @param {object} options
 * @param {Array} options.sessions `{ date, cutoff_at_utc, endpoint_at_utc }`
 * @param {object} options.series the tape from `loadSeries`.
 * @returns {object} `{ date: { open, close, move_pct, present, open_bar, close_bar, reason } }`
 */
function buildSessionPrices({ sessions, series }) {
  const prices = {};
  for (const session of sessions) {
    if (!series) {
      prices[session.date] = {
        open: null,
        close: null,
        move_pct: null,
        present: false,
        reason: `${INSTRUMENT.symbol} is not exported in this checkout`
      };
      continue;
    }
    const open = inputs.priceAtHour(series, session.cutoff_at_utc);
    const close = inputs.priceAtHour(series, session.endpoint_at_utc);
    if (!Number.isFinite(open.price) || !Number.isFinite(close.price)) {
      prices[session.date] = {
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
    prices[session.date] = {
      open: open.price,
      open_bar: open.bar,
      close: close.price,
      close_bar: close.bar,
      move_pct: outcomes.round(((close.price / open.price) - 1) * 100, 4),
      present: true,
      reason: null
    };
  }
  return prices;
}

/**
 * Freeze the flat band for this instrument from development dates only.
 *
 * The rule is the one the four markets use (20th percentile of the absolute session move, three
 * decimals). It is measured on the development dates that actually have a price, and the sample size is
 * reported beside it so a thin band cannot pass for a well-measured one.
 *
 * @param {object} prices the `buildSessionPrices` map.
 * @param {string[]} developmentDates the dates declared as development.
 */
function freezeFlatBand(prices, developmentDates) {
  const magnitudes = developmentDates
    .map((date) => (prices[date] && prices[date].present ? Math.abs(prices[date].move_pct) : null))
    .filter((value) => Number.isFinite(value));
  return {
    flat_band_pct: magnitudes.length ? outcomes.round(outcomes.percentile(magnitudes, 20), 3) : null,
    sample: magnitudes.length,
    rule: "20th percentile of the absolute 05:00-to-05:00 move over development dates, rounded to 3 decimals"
  };
}

module.exports = {
  INSTRUMENT,
  SCORED_WINDOW,
  scoredWindow,
  loadSeries,
  buildSessionPrices,
  freezeFlatBand
};
