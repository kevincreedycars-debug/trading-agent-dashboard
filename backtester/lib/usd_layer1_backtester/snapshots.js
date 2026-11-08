"use strict";

/**
 * Assemble one 05:00 snapshot per session from the as-of frame and the cached one-hour series.
 *
 * The frame already carries the values that were published by 05:00 London, together with the stale
 * business days of each print. Everything this module derives (5-day changes, gold and NAS100 prices)
 * is computed from values inside that same frame window and the same cutoff clock, never from a later
 * revision and never from an instantaneous quote.
 */

const { sessionEndpoints, priceAtHour } = require("./inputs");

/** Change between two readings, in basis points. */
function bps(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.round((to - from) * 100 * 10000) / 10000;
}

/** Change between two readings in the series' own units, for index levels such as the VIX. */
function diff(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.round((to - from) * 10000) / 10000;
}

/** Change between two readings, in percent, rounded to four decimals. */
function pctChange(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null;
  return Math.round(((to / from) - 1) * 100 * 10000) / 10000;
}

function round(value, decimals = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Build the snapshot list.
 *
 * @param {object} options
 * @param {object} options.frame parsed as-of frame (`rows` with `date` and `values`).
 * @param {object} options.series `{ gold, nasdaq100 }` hourly series, any of which may be null.
 * @param {number} [options.lookback] business-day lookback for the derived changes.
 */
function buildSnapshots({ frame, series = {}, lookback = 5 }) {
  const rows = frame.rows.filter((row) => row && row.date && row.values);
  const snapshots = [];
  /** Every value object built so far, so a lookback reads the same clock the snapshot reads. */
  const history = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const endpoints = sessionEndpoints(row.date);
    if (!endpoints.session_starts_weekday) continue;

    const previous = index - lookback >= 0 ? history[index - lookback] : null;
    const prior1 = index - 1 >= 0 ? history[index - 1] : null;
    const prior20 = index - 20 >= 0 ? history[index - 20] : null;

    const value = (source, key) => {
      const raw = source && source.values ? source.values[key] : null;
      return Number.isFinite(raw) ? raw : null;
    };
    const staleness = (key) => {
      const raw = row.staleness_business_days ? row.staleness_business_days[key] : null;
      return Number.isFinite(raw) ? raw : null;
    };

    const gold = priceAtHour(series.gold || null, endpoints.cutoff_at_utc);
    const nasdaq = priceAtHour(series.nasdaq100 || null, endpoints.cutoff_at_utc);

    const now = {
      vix_level: value(row, "vix_level"),
      us_2y_yield: value(row, "us_2y_yield"),
      us_3m_yield: value(row, "us_3m_yield"),
      us_10y_yield: value(row, "us_10y_yield"),
      us_5y_real_yield: value(row, "us_5y_real_yield"),
      us_10y_real_yield: value(row, "us_10y_real_yield"),
      us_5y_breakeven: value(row, "us_5y_breakeven"),
      us_10y_breakeven: value(row, "us_10y_breakeven"),
      credit_spread_hy: value(row, "credit_spread_hy"),
      policy_rate_effr: value(row, "policy_rate_effr"),
      sofr: value(row, "sofr"),
      sp500_level: value(row, "sp500_level"),
      nasdaq100_level: value(row, "nasdaq100_level"),
      wti_spot: value(row, "wti_spot"),
      eurusd: value(row, "eurusd"),
      usdjpy: value(row, "usdjpy"),
      usdgbp: value(row, "usdgbp"),
      usdcad: value(row, "usdcad"),
      usdchf: value(row, "usdchf"),
      usdsek: value(row, "usdsek"),
      broad_dollar: value(row, "broad_dollar"),
      afe_dollar: value(row, "afe_dollar"),
      gold_price: gold.price,
      nasdaq100_price: nasdaq.price
    };
    history[index] = now;
    snapshots.push({ row, index, endpoints, previous, prior1, prior20, now, staleness, gold, nasdaq });
  }

  return snapshots.map((entry) => finalise(entry, series));
}

/** Turn one gathered row into the snapshot the models read, with provenance attached to every input. */
function finalise(entry, series) {
  const { row, previous, prior1, prior20, now, staleness, gold, nasdaq, endpoints } = entry;
  const raw = (source, key) => {
    const candidate = source && source[key] !== undefined ? source[key] : null;
    return Number.isFinite(candidate) ? candidate : null;
  };
  const was = (key) => raw(previous, key);
  const wasLast = (key) => raw(prior1, key);
  const was20 = (key) => raw(prior20, key);

  const values = {
    ...now,
    vix_d1_chg: diff(wasLast("vix_level"), now.vix_level),
    vix_d5_chg: diff(was("vix_level"), now.vix_level),
    vix_d20_chg: diff(was20("vix_level"), now.vix_level),
    us_2y_d1_bps: bps(wasLast("us_2y_yield"), now.us_2y_yield),
    us_2y_d5_bps: bps(was("us_2y_yield"), now.us_2y_yield),
    us_2y_d20_bps: bps(was20("us_2y_yield"), now.us_2y_yield),
    us_3m_d5_bps: bps(was("us_3m_yield"), now.us_3m_yield),
    us_10y_d1_bps: bps(wasLast("us_10y_yield"), now.us_10y_yield),
    us_10y_d5_bps: bps(was("us_10y_yield"), now.us_10y_yield),
    us_10y_d20_bps: bps(was20("us_10y_yield"), now.us_10y_yield),
    us_10y_real_d1_bps: bps(wasLast("us_10y_real_yield"), now.us_10y_real_yield),
    us_10y_real_d5_bps: bps(was("us_10y_real_yield"), now.us_10y_real_yield),
    us_10y_real_d20_bps: bps(was20("us_10y_real_yield"), now.us_10y_real_yield),
    us_5y_real_d5_bps: bps(was("us_5y_real_yield"), now.us_5y_real_yield),
    us_10y_breakeven_d5_bps: bps(was("us_10y_breakeven"), now.us_10y_breakeven),
    credit_spread_d5_bps: bps(was("credit_spread_hy"), now.credit_spread_hy),
    broad_dollar_d1_pct: pctChange(wasLast("broad_dollar"), now.broad_dollar),
    broad_dollar_d5_pct: pctChange(was("broad_dollar"), now.broad_dollar),
    broad_dollar_d20_pct: pctChange(was20("broad_dollar"), now.broad_dollar),
    afe_dollar_d5_pct: pctChange(was("afe_dollar"), now.afe_dollar),
    eurusd_d5_pct: pctChange(was("eurusd"), now.eurusd),
    usdjpy_d5_pct: pctChange(was("usdjpy"), now.usdjpy),
    usdgbp_d5_pct: pctChange(was("usdgbp"), now.usdgbp),
    usdcad_d5_pct: pctChange(was("usdcad"), now.usdcad),
    sp500_d5_pct: pctChange(was("sp500_level"), now.sp500_level),
    nasdaq100_d1_pct: pctChange(wasLast("nasdaq100_price"), now.nasdaq100_price),
    nasdaq100_d5_pct: pctChange(was("nasdaq100_price"), now.nasdaq100_price),
    nasdaq100_d20_pct: pctChange(was20("nasdaq100_price"), now.nasdaq100_price),
    wti_d5_pct: pctChange(was("wti_spot"), now.wti_spot),
    gold_d1_pct: pctChange(wasLast("gold_price"), now.gold_price),
    gold_d5_pct: pctChange(was("gold_price"), now.gold_price),
    gold_d20_pct: pctChange(was20("gold_price"), now.gold_price),
    curve_10y_2y: Number.isFinite(now.us_10y_yield) && Number.isFinite(now.us_2y_yield)
      ? round(now.us_10y_yield - now.us_2y_yield, 4)
      : null
  };

  const priceSource = (key) => {
    if (key === "gold_price") return series.gold ? series.gold.file : "gold series not cached";
    if (key === "nasdaq100_price") return series.nasdaq100 ? series.nasdaq100.file : "NAS100 series not cached";
    return `macro as-of frame at ${row.cutoff_offset || "GMT"} 05:00`;
  };

  const inputs = Object.keys(now).map((key) => {
    const isPrice = key === "gold_price" || key === "nasdaq100_price";
    return {
      key,
      value: Number.isFinite(now[key]) ? now[key] : null,
      source: priceSource(key),
      print_date: isPrice ? (key === "gold_price" ? gold.bar : nasdaq.bar) || null : row.date,
      staleness_business_days: isPrice ? 0 : staleness(key),
      availability: Number.isFinite(now[key]) ? "usable" : "missing"
    };
  });

  const missing = inputs
    .filter((entryInput) => entryInput.availability === "missing")
    .map((entryInput) => ({
      key: entryInput.key,
      reason:
        entryInput.key === "gold_price" || entryInput.key === "nasdaq100_price"
          ? "the cached one-hour series has no bar at this cutoff"
          : "the as-of frame carries no value for this series on this date"
    }));

  return {
    date: row.date,
    cutoff_at_utc: endpoints.cutoff_at_utc,
    endpoint_at_utc: endpoints.endpoint_at_utc,
    cutoff_offset_abbrev: endpoints.cutoff_offset_abbrev,
    endpoint_offset_abbrev: endpoints.endpoint_offset_abbrev,
    window_hours: endpoints.window_hours,
    values,
    inputs,
    missing
  };
}

module.exports = { buildSnapshots, bps, pctChange, round };
