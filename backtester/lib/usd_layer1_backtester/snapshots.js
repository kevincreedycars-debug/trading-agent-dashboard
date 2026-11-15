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
const recoveredInputs = require("./recovered_inputs");

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
 * US 2Y minus German 2Y, in percentage points.
 *
 * Both legs are percent per annum, so no scaling is applied before the subtraction; the change is published in
 * basis points by `bps`. A missing leg makes the spread null, never a one-sided number.
 */
function spread(us, de) {
  if (!Number.isFinite(us) || !Number.isFinite(de)) return null;
  return round(us - de, 4);
}

/**
 * Build the snapshot list.
 *
 * @param {object} options
 * @param {object} options.frame parsed as-of frame (`rows` with `date` and `values`).
 * @param {object} options.series `{ gold, nasdaq100 }` hourly series, any of which may be null.
 * @param {number} [options.lookback] business-day lookback for the derived changes.
 * @param {number} [options.cutoffHour] 5 for the session itself, 7 or 9 for the refresh study. The daily
 *   macro values are unchanged at every hour, because no FRED or central-bank release in this frame lands
 *   between 05:00 and 09:00 London; only the two intraday legs (gold and NAS100) are re-read later.
 * @param {object|null} [options.recoveredTape] the EUR/USD hourly tape used for the three recovered FX chains.
 *   Omit to read the cached tape; pass `null` to build snapshots without any recovered input (the tests do
 *   this to prove the frozen models never see one).
 */
function buildSnapshots({ frame, series = {}, lookback = 5, cutoffHour = 5, recoveredTape }) {
  const rows = frame.rows.filter((row) => row && row.date && row.values);
  const snapshots = [];
  /** Every value object built so far, so a lookback reads the same clock the snapshot reads. */
  const history = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const endpoints = sessionEndpoints(row.date, cutoffHour);
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
      de_2y_yield: value(row, "de_2y_yield"),
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

  const finals = snapshots.map((entry) => finalise(entry, series));
  const recovered = buildRecoveredMap({ snapshots: finals, tape: recoveredTape });
  return finals.map((snapshot) => attachRecovered(snapshot, recovered));
}

/** Build the recovered rows once for the whole list; sequential by nature, so it is never per-row. */
function buildRecoveredMap({ snapshots, tape }) {
  if (tape === null) return { map: new Map(), meta: null };
  const built = recoveredInputs.buildRecoveredSeries(tape === undefined ? { snapshots } : { snapshots, tape });
  return { map: new Map(built.rows.map((row) => [row.date, row])), meta: built };
}

/**
 * Attach the recovered hourly inputs to one snapshot.
 *
 * The three FX chains have no series in the as-of frame; their values are measured from the cached EUR/USD
 * hourly tape by `recovered_inputs.js` and added here with their own provenance, so the audit can report a
 * measured value and the research's blocked use of it in the same row. Nothing is added to `missing`: a
 * recovered value never stands in for a series the models read.
 */
function attachRecovered(snapshot, recovered) {
  const row = recovered && recovered.map ? recovered.map.get(snapshot.date) : null;
  if (!row) return snapshot;
  const values = Object.assign({}, snapshot.values);
  const extra = [];
  for (const feature of recoveredInputs.FEATURES) {
    const value = row.values[feature.key];
    if (!Number.isFinite(value)) continue;
    values[feature.key] = value;
    extra.push({
      key: feature.key,
      value,
      source: recoveredInputs.TAPES.eurusd.file,
      print_date: row.cutoff_bar_close_at ? String(row.cutoff_bar_close_at).slice(0, 10) : snapshot.date,
      staleness_business_days: 0,
      availability: "usable",
      recovered: true,
      recovered_from: recoveredInputs.TAPES.eurusd.file,
      bar_close_at: row.cutoff_bar_close_at,
      units: feature.units,
      window: feature.window
    });
  }
  if (!extra.length) return snapshot;
  return Object.assign({}, snapshot, {
    values,
    inputs: snapshot.inputs.concat(extra),
    recovered: {
      values_present: extra.map((entry) => entry.key),
      volatility_regime: row.regime,
      cutoff_bar_close_at: row.cutoff_bar_close_at,
      bars_overnight: row.overnight_bars,
      bars_volatility: row.volatility_bars
    }
  });
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
    de_2y_d5_bps: bps(was("de_2y_yield"), now.de_2y_yield),
    // The frozen front-end rule reads a change in the two-country differential, not a single-country level.
    // Both legs come from the same cutoff and the same T-1 as-of selection, so the change compares like with
    // like; when either leg is absent the spread is null rather than half-filled.
    us_de_2y_spread: spread(now.us_2y_yield, now.de_2y_yield),
    us_de_2y_spread_d5_bps: bps(spread(was("us_2y_yield"), was("de_2y_yield")), spread(now.us_2y_yield, now.de_2y_yield)),
    relative_front_end_d5_bps: bps(spread(was("us_2y_yield"), was("de_2y_yield")), spread(now.us_2y_yield, now.de_2y_yield)),
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
    usdjpy_d1_pct: pctChange(wasLast("usdjpy"), now.usdjpy),
    usdchf_d1_pct: pctChange(wasLast("usdchf"), now.usdchf),
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
    if (key === "de_2y_yield") return "Bundesbank BBSIS daily 2Y spot (observation date, usable from the next day)";
    return `macro as-of frame at ${row.cutoff_offset || "GMT"} ${String(endpoints.cutoff_hour).padStart(2, "0")}:00`;
  };

  // A joined series carries its own observation date, so the panel quotes the print the cutoff actually saw
  // instead of the session date that merely inherited it.
  const printDates = row.print_dates || {};

  const inputs = Object.keys(now).map((key) => {
    const isPrice = key === "gold_price" || key === "nasdaq100_price";
    return {
      key,
      value: Number.isFinite(now[key]) ? now[key] : null,
      source: priceSource(key),
      print_date: isPrice ? (key === "gold_price" ? gold.bar : nasdaq.bar) || null : printDates[key] || row.date,
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
    cutoff_hour: endpoints.cutoff_hour,
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
