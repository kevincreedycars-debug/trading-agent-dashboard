"use strict";

/**
 * Inputs recovered from the cached one-hour tapes (research only).
 *
 * Three of the ten factors with no staged input need an intraday tape that the as-of frame does not carry.
 * The checkout does hold one such tape: the cached EUR/USD H1 provider series, which runs from 2024-01-01 to
 * 2026-04-29. This module reads it at the 05:00 London cutoff and derives the three quantities those chains
 * name, so the audit can say "measured" instead of "no input".
 *
 * Two rules hold everywhere here:
 *
 * 1. No bar that closes after the cutoff is ever read. A bar is usable only when its close is at or before the
 *    cutoff, which is checked on every date and counted, not assumed.
 * 2. A recovered value is a measurement, not a vote. The 2026-11-04 adjudication blocks all three chains (no
 *    verified DXY endpoint, no evaluable target, a range bound rejected as a hard future bound), so nothing
 *    here is wired into a mechanism. `research_status` and `sign` travel with every value.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const inputs = require("./inputs");

const HOUR_MS = 3600000;

/**
 * How old the cutoff bar may be before the tape is treated as not covering that morning.
 *
 * A bar opening at 04:00 closes at 05:00 exactly, so the normal read has no age at all. The tolerance exists
 * for the hour that follows a venue holiday, where the last bar can close an hour early. Anything older is a
 * missing value: the tape simply does not reach that date, and borrowing the last available price would put a
 * months-old quote into a "05:00 reading".
 */
const MAX_BAR_AGE_MINUTES = 60;

/** The volatility measure is the last 120 hourly bars, which is about five trading days at 24 hours a day. */
const VOLATILITY_BARS = 120;

/** The one tape with a verified cut-off read in this checkout, and the price caches the run already reads. */
const TAPES = Object.freeze({
  eurusd: Object.freeze({
    key: "eurusd",
    label: "EUR/USD one-hour mid",
    instrument: "EUR_USD",
    file: "backtester/tmp/oanda_eur_usd_h1.csv",
    role: "recovery tape for the three FX chains"
  }),
  gold: Object.freeze({
    key: "gold",
    label: "Gold one-hour mid",
    instrument: "XAU_USD",
    file: "backtester/tmp/oanda_xau_usd_h1.csv",
    role: "price leg of the frozen gold mechanism"
  }),
  nasdaq100: Object.freeze({
    key: "nasdaq100",
    label: "NAS100 one-hour mid",
    instrument: "NAS100_USD",
    file: "backtester/tmp/oanda_nas100_usd_h1.csv",
    role: "price leg of the frozen equity mechanism"
  })
});

/**
 * The windows the three chains are measured on. Every number is stated here, once, so a reader can check the
 * measurement without reading the arithmetic.
 */
const WINDOWS = Object.freeze({
  overnight_hours: 12,
  overnight_start_local: "17:00 Europe/London, the evening before the cutoff",
  momentum_sessions: Object.freeze([1, 5]),
  volatility_bars: 120,
  volatility_reference_sessions: 60,
  regime_high_ratio: 1.25,
  regime_low_ratio: 0.8,
  bar_close_rule: "a bar counts only when its close is at or before the 05:00 London cutoff",
  convention_note:
    "the 12-hour overnight window, the 120-hour volatility window and the 1.25/0.8 regime ratios are declared " +
    "conventions, not fitted values; no research document fixes them, so they are recorded as developer " +
    "assumptions and nothing downstream reads them as a threshold"
});

/** The value keys the three recovered chains are measured on, with the thing each one measures. */
const FEATURES = Object.freeze([
  Object.freeze({
    key: "fx_eurusd_momentum_1s_pct",
    label: "EUR/USD change since the previous 05:00 cutoff",
    units: "percent",
    window: "one session, cutoff to cutoff",
    factor_id: "fx.usd-session-momentum"
  }),
  Object.freeze({
    key: "fx_eurusd_momentum_5s_pct",
    label: "EUR/USD change over five sessions",
    units: "percent",
    window: "five sessions, cutoff to cutoff",
    factor_id: "fx.usd-session-momentum"
  }),
  Object.freeze({
    key: "fx_overnight_range_position",
    label: "Where the cutoff price sits inside the overnight range",
    units: "share of the range, 0 = low, 1 = high",
    window: "the 12 hours before the cutoff",
    factor_id: "fx.usd-overnight-range-position"
  }),
  Object.freeze({
    key: "fx_overnight_range_pips",
    label: "Width of the overnight range",
    units: "pips (0.0001)",
    window: "the 12 hours before the cutoff",
    factor_id: "fx.usd-overnight-range-position"
  }),
  Object.freeze({
    key: "fx_eurusd_volatility_120h_pct",
    label: "Standard deviation of the last 120 hourly log returns",
    units: "percent per hour",
    window: "the last 120 hourly bars before the cutoff",
    factor_id: "fx.usd-session-volatility-regime"
  }),
  Object.freeze({
    key: "fx_eurusd_volatility_ratio_60s",
    label: "That standard deviation divided by its own 60-session median",
    units: "ratio",
    window: "120 bars against the previous 60 cutoffs",
    factor_id: "fx.usd-session-volatility-regime"
  })
]);

/** Which recovered keys each of the three chains is measured on. */
const FEATURES_BY_FACTOR = Object.freeze({
  "fx.usd-session-momentum": Object.freeze(["fx_eurusd_momentum_1s_pct", "fx_eurusd_momentum_5s_pct"]),
  "fx.usd-overnight-range-position": Object.freeze(["fx_overnight_range_position", "fx_overnight_range_pips"]),
  "fx.usd-session-volatility-regime": Object.freeze(["fx_eurusd_volatility_120h_pct", "fx_eurusd_volatility_ratio_60s"])
});

/**
 * What the research says about each recovered chain, carried beside the measurement.
 *
 * A recovered input is not a licence to vote. Each row quotes the adjudication's own disposition so the panel can
 * show a measured value and a blocked use in the same line.
 */
const RESEARCH_STATUS = Object.freeze({
  "fx.usd-session-momentum": Object.freeze({
    disposition: "Blocked",
    sign: "unresolved",
    reason:
      "the chain needs a verified DXY endpoint and a frozen lookback; other-window FX momentum does not " +
      "establish the session's dollar direction, and the DXY label is unverified",
    proxy_note:
      "measured on EUR/USD only, because that is the single pair this checkout holds an hourly tape for; it is a " +
      "named proxy for the dollar path, never the label"
  }),
  "fx.usd-overnight-range-position": Object.freeze({
    disposition: "Blocked",
    sign: "unresolved",
    reason:
      "the candidate state survives, but treating a historical range as a hard bound on the next session is " +
      "rejected, and the range window has to be frozen before the cutoff",
    proxy_note: "measured on EUR/USD only; the chain is written for the dollar index"
  }),
  "fx.usd-session-volatility-regime": Object.freeze({
    disposition: "Blocked",
    sign: "unresolved",
    reason:
      "the chain is an abstention gate, and no abstention accuracy can be scored without an evaluable target " +
      "observation; the always-call and equal-coverage comparisons are specified but unmeasured",
    proxy_note: "measured on EUR/USD hourly returns; the chain is written for dollar realised volatility"
  })
});

/**
 * Read one cached hourly tape.
 *
 * The timestamps carry nanoseconds, which `Date.parse` truncates inconsistently across engines, so the stamp is
 * cut to whole seconds before parsing. A bar is keyed by its opening hour; high and low are kept for the range
 * measurement.
 */
function readTape({ file, instrument } = {}) {
  const absolute = path.resolve(inputs.REPO_ROOT, file);
  if (!fs.existsSync(absolute)) return null;
  const buffer = fs.readFileSync(absolute);
  const lines = buffer.toString("utf8").split(/\r?\n/).filter((line) => line.trim().length);
  const header = lines[0].split(",").map((name) => name.trim().toLowerCase());
  const index = (name) => header.indexOf(name);
  const closeIndex = index("close");
  const highIndex = index("high");
  const lowIndex = index("low");
  const openIndex = index("open");
  const stampIndex = index("timestamp");
  if (closeIndex < 0 || stampIndex < 0) throw new Error(`${file} has no timestamp/close columns`);

  const bars = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(",");
    if (instrument && cells[0] && cells[0] !== instrument) continue;
    const stamp = String(cells[stampIndex] || "").trim();
    const close = Number(cells[closeIndex]);
    if (!stamp || !Number.isFinite(close)) continue;
    const ms = Date.parse(`${stamp.slice(0, 19)}Z`);
    if (!Number.isFinite(ms)) continue;
    const openMs = Math.floor(ms / HOUR_MS) * HOUR_MS;
    bars.push({
      openMs,
      closeMs: openMs + HOUR_MS,
      open: Number(cells[openIndex]),
      high: Number(cells[highIndex]),
      low: Number(cells[lowIndex]),
      close
    });
  }
  bars.sort((left, right) => left.openMs - right.openMs);
  return {
    file: path.relative(inputs.REPO_ROOT, absolute).replace(/\\/g, "/"),
    bytes: buffer.length,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    instrument: instrument || null,
    bars,
    first_bar: bars.length ? new Date(bars[0].openMs).toISOString() : null,
    last_bar: bars.length ? new Date(bars[bars.length - 1].closeMs).toISOString() : null,
    count: bars.length
  };
}

function round(value, decimals = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** The last bar whose close is at or before `instantMs` and no older than the tolerance, or null. */
function closeAtOrBefore(tape, instantMs, maxAgeMinutes = MAX_BAR_AGE_MINUTES) {
  if (!tape || !tape.bars.length) return null;
  let found = null;
  for (const bar of tape.bars) {
    if (bar.closeMs > instantMs) break;
    found = bar;
  }
  if (!found) return null;
  return instantMs - found.closeMs <= maxAgeMinutes * 60000 ? found : null;
}

/** Bars that close inside `(fromMs, toMs]`; used for the overnight range and the volatility window. */
function barsClosedBetween(tape, fromMs, toMs) {
  if (!tape) return [];
  return tape.bars.filter((bar) => bar.closeMs > fromMs && bar.closeMs <= toMs);
}

function stdev(values) {
  if (values.length < 2) return null;
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function median(values) {
  if (!values.length) return null;
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** A window counts only when its newest bar closed inside the tolerance of the cutoff. */
function isFresh(bars, cutoffMs) {
  if (!bars.length) return false;
  return cutoffMs - bars[bars.length - 1].closeMs <= MAX_BAR_AGE_MINUTES * 60000;
}



/**
 * The recovered series, one row per session the frame knows about.
 *
 * The build is sequential on purpose: momentum is measured between two cutoffs, and the volatility ratio needs
 * the previous sixty sessions' own volatility, so every row is computed from the rows before it and from bars
 * that closed before its own cutoff. `lookahead_violations` counts any bar read after its cutoff and must stay
 * zero.
 */
function buildRecoveredSeries({ snapshots, tape = readTape(TAPES.eurusd) } = {}) {
  if (!Array.isArray(snapshots) || !snapshots.length) throw new Error("the recovery build needs the session snapshots");
  const rows = [];
  const prices = [];
  const volatilities = [];
  let lookaheadViolations = 0;
  let barsRead = 0;

  for (const snapshot of snapshots) {
    const cutoffMs = Date.parse(snapshot.cutoff_at_utc);
    const cutoffBar = closeAtOrBefore(tape, cutoffMs);
    if (cutoffBar && cutoffBar.closeMs > cutoffMs) lookaheadViolations += 1;
    const price = cutoffBar ? cutoffBar.close : null;
    prices.push(price);

    const overnight = barsClosedBetween(tape, cutoffMs - WINDOWS.overnight_hours * HOUR_MS, cutoffMs);
    const overnightFresh = isFresh(overnight, cutoffMs);
    let rangePosition = null;
    let rangePips = null;
    if (overnight.length >= 2 && overnightFresh && Number.isFinite(price)) {
      const high = Math.max(...overnight.map((bar) => bar.high));
      const low = Math.min(...overnight.map((bar) => bar.low));
      if (Number.isFinite(high) && Number.isFinite(low) && high > low) {
        rangePosition = round((price - low) / (high - low), 4);
        rangePips = round((high - low) / 0.0001, 1);
      }
      barsRead += overnight.length;
    }

    const volWindow = barsClosedBetween(tape, Number.NEGATIVE_INFINITY, cutoffMs).slice(-VOLATILITY_BARS);
    let volatility = null;
    if (volWindow.length === VOLATILITY_BARS && isFresh(volWindow, cutoffMs)) {
      const returns = [];
      for (let index = 1; index < volWindow.length; index += 1) {
        const previous = volWindow[index - 1].close;
        const current = volWindow[index].close;
        if (previous > 0 && current > 0) returns.push(Math.log(current / previous) * 100);
      }
      volatility = round(stdev(returns), 4);
      barsRead += volWindow.length;
    }
    volatilities.push(volatility);

    const position = prices.length - 1;
    const prior = (sessions) => (position - sessions >= 0 ? prices[position - sessions] : null);
    const pct = (from, to) =>
      Number.isFinite(from) && Number.isFinite(to) && from > 0 ? round((to / from - 1) * 100, 4) : null;

    const reference = volatilities
      .slice(Math.max(0, position - WINDOWS.volatility_reference_sessions), position)
      .filter(Number.isFinite);
    const referenceMedian = reference.length >= 20 ? median(reference) : null;
    const ratio =
      Number.isFinite(volatility) && Number.isFinite(referenceMedian) && referenceMedian > 0
        ? round(volatility / referenceMedian, 4)
        : null;

    const values = {
      fx_eurusd_momentum_1s_pct: pct(prior(1), price),
      fx_eurusd_momentum_5s_pct: pct(prior(5), price),
      fx_overnight_range_position: rangePosition,
      fx_overnight_range_pips: rangePips,
      fx_eurusd_volatility_120h_pct: volatility,
      fx_eurusd_volatility_ratio_60s: ratio
    };

    rows.push({
      date: snapshot.date,
      cutoff_at_utc: snapshot.cutoff_at_utc,
      price,
      cutoff_bar_close_at: cutoffBar ? new Date(cutoffBar.closeMs).toISOString() : null,
      overnight_bars: overnight.length,
      volatility_bars: volWindow.length,
      volatility_reference_sessions: reference.length,
      regime: Number.isFinite(ratio)
        ? ratio >= WINDOWS.regime_high_ratio
          ? "high"
          : ratio <= WINDOWS.regime_low_ratio
            ? "low"
            : "normal"
        : null,
      values
    });
  }

  return {
    rows,
    tape: tape
      ? {
          key: TAPES.eurusd.key,
          label: TAPES.eurusd.label,
          file: tape.file,
          bytes: tape.bytes,
          sha256: tape.sha256,
          bars: tape.count,
          first_bar: tape.first_bar,
          last_bar: tape.last_bar
        }
      : null,
    lookahead_violations: lookaheadViolations,
    bars_read: barsRead
  };
}

module.exports = {
  TAPES,
  WINDOWS,
  FEATURES,
  FEATURES_BY_FACTOR,
  RESEARCH_STATUS,
  readTape,
  buildRecoveredSeries,
  closeAtOrBefore,
  barsClosedBetween
};
