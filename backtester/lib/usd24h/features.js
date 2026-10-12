"use strict";

/**
 * As-of feature construction for the USD 24-hour dataset.
 *
 * The only lookups allowed are `asOf*` calls, and each one refuses an observation that is not yet
 * usable at the row's cutoff, so a feature can never read a same-day close that the live pipeline
 * could not have seen at 09:30 ET. Prices used for outcomes are handled separately in outcomes.js.
 */

const { buildUtcDateFromNyParts } = require("../timeframe_windows");
const { loadCachedSeries } = require("./acquire");
const { SERIES } = require("./series_catalogue");

const DECLARED_CALL_TIME_ET = "09:30:00";

function businessDaysBetween(fromDate, toDate) {
  if (fromDate === toDate) return 0;
  const start = Date.parse(`${fromDate}T00:00:00Z`);
  const end = Date.parse(`${toDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  let count = 0;
  for (let cursor = start + 86400000; cursor <= end; cursor += 86400000) {
    const day = new Date(cursor).getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

function cutoffInstantUtc(dateLiteral) {
  return buildUtcDateFromNyParts(dateLiteral, DECLARED_CALL_TIME_ET).toISOString();
}

function buildSeriesStore(options = {}) {
  const store = new Map();
  for (const entry of SERIES) {
    store.set(entry.key, loadCachedSeries(entry.key, options));
  }
  return store;
}

/** Last observation of `key` that was usable `lag` business days before the row date. */
function asOf(store, key, dateLiteral) {
  const series = store.get(key);
  if (!series) throw new Error(`Series "${key}" is not in the store`);
  const lag = series.entry.availability_lag_business_days;
  const observations = series.observations;
  for (let index = observations.length - 1; index >= 0; index -= 1) {
    const observation = observations[index];
    if (observation.date > dateLiteral) continue;
    const elapsed = businessDaysBetween(observation.date, dateLiteral);
    if (elapsed === null) continue;
    if (elapsed >= lag) return observation;
  }
  return null;
}

/** Usable observations of `key` up to the row date, newest first, capped at `count`. */
function history(store, key, dateLiteral, count) {
  const series = store.get(key);
  const lag = series.entry.availability_lag_business_days;
  const usable = [];
  for (let index = series.observations.length - 1; index >= 0 && usable.length < count; index -= 1) {
    const observation = series.observations[index];
    if (observation.date > dateLiteral) continue;
    const elapsed = businessDaysBetween(observation.date, dateLiteral);
    if (elapsed !== null && elapsed >= lag) usable.push(observation);
  }
  return usable;
}

/** Intraday lookup: newest candle of `key` that completed strictly before the cutoff instant. */
function asOfInstant(store, key, dateLiteral) {
  const series = store.get(key);
  if (!series) throw new Error(`Series "${key}" is not in the store`);
  const cutoff = cutoffInstantUtc(dateLiteral);
  const observations = series.observations;
  for (let index = observations.length - 1; index >= 0; index -= 1) {
    const observation = observations[index];
    if (observation.date > dateLiteral) continue;
    const stamp = observation.time || `${observation.date}T00:00:00.000Z`;
    if (stamp < cutoff) return observation;
  }
  return null;
}

function historyInstant(store, key, dateLiteral, count) {
  const series = store.get(key);
  const cutoff = cutoffInstantUtc(dateLiteral);
  const usable = [];
  for (let index = series.observations.length - 1; index >= 0 && usable.length < count; index -= 1) {
    const observation = series.observations[index];
    if (observation.date > dateLiteral) continue;
    const stamp = observation.time || `${observation.date}T00:00:00.000Z`;
    if (stamp < cutoff) usable.push(observation);
  }
  return usable;
}

function percentChange(current, previous) {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function bps(current, previous) {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  return (current - previous) * 100;
}

function mean(values) {
  const usable = values.filter((value) => Number.isFinite(value));
  if (!usable.length) return null;
  return usable.reduce((total, value) => total + value, 0) / usable.length;
}

function stdev(values) {
  const usable = values.filter((value) => Number.isFinite(value));
  if (usable.length < 2) return null;
  const average = mean(usable);
  const variance = usable.reduce((total, value) => total + (value - average) ** 2, 0) / (usable.length - 1);
  return Math.sqrt(variance);
}

/** Share of the supplied window at or below the current value, in percent. */
function percentileRank(values, current) {
  const usable = values.filter((value) => Number.isFinite(value));
  if (!usable.length || !Number.isFinite(current)) return null;
  const below = usable.filter((value) => value <= current).length;
  return Number(((below / usable.length) * 100).toFixed(2));
}

/** Same as priceBlock but for the hourly gold cache, using the cutoff instant rather than a date. */
function intradayPriceBlock(store, key, dateLiteral, missingInputs) {
  const observations = historyInstant(store, key, dateLiteral, 21);
  if (!observations.length) {
    missingInputs.push(key);
    return { level: null, latest_time: null, observation_count: 0 };
  }
  const level = observations[0].value;
  const prior = (steps) => (observations.length > steps ? observations[steps].value : null);
  const returns = [];
  for (let index = 0; index + 1 < observations.length && index < 20; index += 1) {
    returns.push(percentChange(observations[index].value, observations[index + 1].value));
  }
  return {
    level,
    ret_1d: percentChange(level, prior(8)),
    ret_5d: percentChange(level, prior(20)),
    vol20_pct: stdev(returns),
    latest_time: observations[0].time || `${observations[0].date}T00:00:00.000Z`,
    observation_count: observations.length
  };
}

function buildFeatureRow(store, dateLiteral) {
  const missingInputs = [];
  const provenance = {};

  const level = (key) => {
    const observation = asOf(store, key, dateLiteral);
    if (!observation) {
      missingInputs.push(key);
      return null;
    }
    provenance[key] = observation.date;
    return observation.value;
  };

  const changeBps = (key, steps) => {
    const observations = history(store, key, dateLiteral, steps + 1);
    if (observations.length <= steps) {
      if (!observations.length) missingInputs.push(key);
      return null;
    }
    provenance[key] = observations[0].date;
    return bps(observations[0].value, observations[steps].value);
  };

  const usd = priceBlock(store, "dxy_level", dateLiteral, missingInputs);
  if (usd.latest_date) provenance.dxy_level = usd.latest_date;
  const usdLag1 = priceBlock(store, "dxy_level_lag1", dateLiteral, missingInputs);
  if (usdLag1.latest_date) provenance.dxy_level_lag1 = usdLag1.latest_date;

  const vix = priceBlock(store, "vix_level", dateLiteral, missingInputs);
  if (vix.latest_date) provenance.vix_level = vix.latest_date;
  const vixHistory = history(store, "vix_level", dateLiteral, 252).map((observation) => observation.value);

  const gold = intradayPriceBlock(store, "gold_spot_intraday", dateLiteral, missingInputs);
  if (gold.latest_time) provenance.gold_spot_intraday = gold.latest_time;

  const nq = priceBlock(store, "nq_level", dateLiteral, missingInputs);
  if (nq.latest_date) provenance.nq_level = nq.latest_date;
  const sp500 = priceBlock(store, "sp500_level", dateLiteral, missingInputs);
  if (sp500.latest_date) provenance.sp500_level = sp500.latest_date;
  const eurusd = priceBlock(store, "eurusd", dateLiteral, missingInputs);
  if (eurusd.latest_date) provenance.eurusd = eurusd.latest_date;
  const usdjpy = priceBlock(store, "usdjpy", dateLiteral, missingInputs);
  if (usdjpy.latest_date) provenance.usdjpy = usdjpy.latest_date;
  const wti = priceBlock(store, "wti_spot", dateLiteral, missingInputs);
  if (wti.latest_date) provenance.wti_spot = wti.latest_date;
  const credit = priceBlock(store, "credit_spread_hy", dateLiteral, missingInputs);
  if (credit.latest_date) provenance.credit_spread_hy = credit.latest_date;

  const us2y = level("us_2y_yield");
  const us3m = level("us_3m_yield");
  const us10y = level("us_10y_yield");
  const us10yReal = level("us_10y_real_yield");
  const breakeven = level("us_10y_breakeven");
  const effr = level("policy_rate_effr");
  const sofr = level("sofr");
  const de2y = level("de_2y_yield");

  const usDe2ySpread = Number.isFinite(us2y) && Number.isFinite(de2y) ? (us2y - de2y) * 100 : null;
  const usDe2ySpreadChg5d = (() => {
    const usRow = changeBps("us_2y_yield", 5);
    const deRow = changeBps("de_2y_yield", 5);
    return usRow === null || deRow === null ? null : usRow - deRow;
  })();
  const us2yChg5d = changeBps("us_2y_yield", 5);
  const us2yChg20d = changeBps("us_2y_yield", 20);

  return {
    snapshot_date: dateLiteral,
    cutoff_at_utc: cutoffInstantUtc(dateLiteral),
    features: {
      usd_level: usd.level,
      usd_ret_1d: usd.ret_1d,
      usd_ret_5d: usd.ret_5d,
      usd_ret_20d: usd.ret_20d,
      usd_ma20_dist_pct: usd.ma20_dist_pct,
      usd_vol20_pct: usd.vol20_pct,
      usd_range_pos20_pct: usd.range_pos20_pct,
      usd_lag1_level: usdLag1.level,
      usd_lag1_ret_1d: usdLag1.ret_1d,
      usd_lag1_ret_5d: usdLag1.ret_5d,
      usd_lag1_ret_20d: usdLag1.ret_20d,
      usd_lag1_ma20_dist_pct: usdLag1.ma20_dist_pct,
      vix_level: vix.level,
      vix_ret_1d: vix.ret_1d,
      vix_ret_5d: vix.ret_5d,
      vix_pctile_252: percentileRank(vixHistory, vix.level),
      us_2y_yield: us2y,
      us_2y_chg_5d_bps: us2yChg5d,
      us_2y_chg_20d_bps: us2yChg20d,
      us_3m_yield: us3m,
      us_3m_chg_5d_bps: changeBps("us_3m_yield", 5),
      us_3m_chg_20d_bps: changeBps("us_3m_yield", 20),
      us_10y_yield: us10y,
      us_10y_chg_5d_bps: changeBps("us_10y_yield", 5),
      us_2y_minus_3m_bps: Number.isFinite(us2y) && Number.isFinite(us3m) ? (us2y - us3m) * 100 : null,
      us_10y_minus_2y_bps: Number.isFinite(us10y) && Number.isFinite(us2y) ? (us10y - us2y) * 100 : null,
      us_10y_real_yield: us10yReal,
      us_10y_real_chg_5d_bps: changeBps("us_10y_real_yield", 5),
      us_10y_real_chg_20d_bps: changeBps("us_10y_real_yield", 20),
      us_5y_real_chg_5d_bps: changeBps("us_5y_real_yield", 5),
      us_10y_breakeven: breakeven,
      us_10y_breakeven_chg_5d_bps: changeBps("us_10y_breakeven", 5),
      policy_rate_effr: effr,
      sofr_minus_effr_bps: Number.isFinite(sofr) && Number.isFinite(effr) ? (sofr - effr) * 100 : null,
      effr_minus_3m_bps: Number.isFinite(effr) && Number.isFinite(us3m) ? (effr - us3m) * 100 : null,
      policy_repricing_5d_bps: us2yChg5d === null ? null : -us2yChg5d,
      policy_repricing_20d_bps: us2yChg20d === null ? null : -us2yChg20d,
      de_2y_yield: de2y,
      de_2y_chg_5d_bps: changeBps("de_2y_yield", 5),
      us_de_2y_spread_bps: usDe2ySpread,
      us_de_2y_spread_chg_5d_bps: usDe2ySpreadChg5d,
      credit_spread_hy: credit.level,
      credit_spread_chg_5d_bps: changeBps("credit_spread_hy", 5),
      nq_ret_1d: nq.ret_1d,
      nq_ret_5d: nq.ret_5d,
      nq_vol20_pct: nq.vol20_pct,
      sp500_ret_1d: sp500.ret_1d,
      sp500_ret_5d: sp500.ret_5d,
      sp500_range_pos20_pct: sp500.range_pos20_pct,
      gold_level: gold.level,
      gold_ret_1d: gold.ret_1d,
      gold_ret_5d: gold.ret_5d,
      gold_vol20_pct: gold.vol20_pct,
      eurusd_ret_1d: eurusd.ret_1d,
      eurusd_ret_5d: eurusd.ret_5d,
      usdjpy_ret_5d: usdjpy.ret_5d,
      wti_ret_5d: wti.ret_5d
    },
    provenance,
    missing_inputs: Array.from(new Set(missingInputs)).sort()
  };
}

module.exports = {
  DECLARED_CALL_TIME_ET,
  asOf,
  asOfInstant,
  buildFeatureRow,
  buildSeriesStore,
  businessDaysBetween,
  cutoffInstantUtc,
  history,
  historyInstant,
  intradayPriceBlock,
  mean,
  percentChange,
  percentileRank,
  priceBlock,
  stdev
};

/**
 * Level, lookback returns, distance from the 20-observation mean, realised volatility and range
 * position for one price series. Uses at most 21 usable observations, all of them dated on or
 * before the row date under the series' declared availability lag.
 */
function priceBlock(store, key, dateLiteral, missingInputs) {
  const observations = history(store, key, dateLiteral, 21);
  if (!observations.length) {
    missingInputs.push(key);
    return { level: null, latest_date: null, observation_count: 0 };
  }
  const level = observations[0].value;
  const prior = (steps) => (observations.length > steps ? observations[steps].value : null);
  const returns = [];
  for (let index = 0; index + 1 < observations.length && index < 20; index += 1) {
    returns.push(percentChange(observations[index].value, observations[index + 1].value));
  }
  const window = observations.slice(0, 20).map((observation) => observation.value);
  const windowLow = window.length ? Math.min(...window) : null;
  const windowHigh = window.length ? Math.max(...window) : null;
  const rangePosition = windowLow !== null && windowHigh !== null && windowHigh > windowLow
    ? ((level - windowLow) / (windowHigh - windowLow)) * 100
    : null;
  return {
    level,
    ret_1d: percentChange(level, prior(1)),
    ret_5d: percentChange(level, prior(5)),
    ret_20d: percentChange(level, prior(20)),
    ma20_dist_pct: percentChange(level, mean(window)),
    vol20_pct: stdev(returns),
    range_pos20_pct: rangePosition,
    observation_count: observations.length,
    latest_date: observations[0].date
  };
}
