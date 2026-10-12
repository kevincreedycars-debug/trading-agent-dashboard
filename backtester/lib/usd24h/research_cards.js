"use strict";

/**
 * Research-card evidence for the USD 24-hour study.
 *
 * Each family is measured against the same forward window, and every input is additionally correlated
 * with the window that has just closed. That contrast is the point of the cards: an input that tracks
 * the move it is built from has explained the past, while only a non-trivial forward relation is
 * prospective evidence.
 */

const FAMILIES = Object.freeze([
  {
    id: "dxy_momentum",
    label: "Dollar index momentum",
    features: [
      { key: "usd_ret_1d", label: "one-day dollar return" },
      { key: "usd_ret_5d", label: "five-day dollar return" },
      { key: "usd_ret_20d", label: "twenty-day dollar return" },
      { key: "usd_ma20_dist_pct", label: "distance from the 20-observation mean" },
      { key: "usd_lag1_ret_1d", label: "one-day dollar return, one-lag series" },
      { key: "usd_lag1_ret_5d", label: "five-day dollar return, one-lag series" }
    ],
    data_requirements: [
      "Daily dollar index values with a declared availability lag (FRED DTWEXBGS is used at two and one business days).",
      "At least 21 usable observations before the cutoff to form the 20-observation window."
    ],
    missing_inputs: ["true intraday dollar quotes: the collector reads a daily FRED series, so no same-morning dollar print exists"]
  },
  {
    id: "vix_risk",
    label: "VIX and risk conditions",
    features: [
      { key: "vix_level", label: "VIX level" },
      { key: "vix_ret_1d", label: "one-day VIX change" },
      { key: "vix_ret_5d", label: "five-day VIX change" },
      { key: "vix_pctile_252", label: "VIX percentile over 252 observations" },
      { key: "credit_spread_chg_5d_bps", label: "five-day high-yield spread change" }
    ],
    data_requirements: [
      "VIXCLS and BAMLH0A0HYM2 daily closes with a one-business-day lag.",
      "A 252-observation history before each cutoff for the percentile form."
    ],
    missing_inputs: ["no option-implied dollar skew and no intraday volatility term structure"]
  },
  {
    id: "relative_rates",
    label: "Relative interest rates",
    features: [
      { key: "us_2y_chg_5d_bps", label: "US 2Y change, five days" },
      { key: "us_de_2y_spread_bps", label: "US minus German 2Y level" },
      { key: "us_de_2y_spread_chg_5d_bps", label: "US minus German 2Y change, five days" },
      { key: "de_2y_chg_5d_bps", label: "German 2Y change, five days" },
      { key: "us_10y_chg_5d_bps", label: "US 10Y change, five days" }
    ],
    data_requirements: [
      "DGS2, DGS10 and the German 2Y Schatz series, each with a declared lag.",
      "Consistent quote conventions across the two countries."
    ],
    missing_inputs: ["ECB and Fed meeting-date conditioning, and the option-implied policy path"]
  },
  {
    id: "real_yields",
    label: "Real yields",
    features: [
      { key: "us_10y_real_chg_5d_bps", label: "10Y TIPS real yield change, five days" },
      { key: "us_10y_real_chg_20d_bps", label: "10Y TIPS real yield change, twenty days" },
      { key: "us_5y_real_chg_5d_bps", label: "5Y TIPS real yield change, five days" },
      { key: "us_10y_breakeven_chg_5d_bps", label: "10Y breakeven change, five days" }
    ],
    data_requirements: ["DFII10, DFII5 and T10YIE daily closes with a declared lag."],
    missing_inputs: ["foreign real yields, so only the US leg of a real-rate differential exists here"]
  },
  {
    id: "fed_repricing",
    label: "Fed repricing",
    features: [
      { key: "policy_repricing_5d_bps", label: "inverse US 2Y change, five days" },
      { key: "policy_repricing_20d_bps", label: "inverse US 2Y change, twenty days" },
      { key: "effr_minus_3m_bps", label: "effective rate minus 3M bill" },
      { key: "sofr_minus_effr_bps", label: "SOFR minus effective rate" },
      { key: "us_3m_chg_5d_bps", label: "US 3M change, five days" }
    ],
    data_requirements: [
      "EFFR, SOFR, DGS3MO and DGS2 with a declared lag.",
      "A meeting-by-meeting implied policy path to measure repricing directly rather than through yields."
    ],
    missing_inputs: [
      "fed funds and SOFR futures implied paths are not available from a free source, so every rule here is a yield-based proxy",
      "meeting dates and statement text are absent"
    ]
  },
  {
    id: "economic_surprises",
    label: "Economic surprises",
    features: [],
    data_requirements: [
      "Actual value at first release, the pre-release consensus and the observation's publication timestamp.",
      "An event-age rule applied at the cutoff, not after the fact.",
      "A scheduled calendar of release dates and times in the same timezone convention as the cutoff."
    ],
    missing_inputs: [
      "consensus values and first-release actuals sit behind paid feeds (Finnhub calendar, RapidAPI ForexFactory) that this repository cannot read",
      "ALFRED vintage CSV returns HTTP 404 without an API key, so no vintage reconstruction is possible either",
      "the Fed-bias field is derived from the same paid calendar, so it is left null rather than proxied"
    ],
    rules_status: "declared but not evaluable"
  },
  {
    id: "cross_asset",
    label: "Cross-asset relationships",
    features: [
      { key: "gold_ret_1d", label: "gold return, previous session" },
      { key: "gold_ret_5d", label: "gold return, five days" },
      { key: "gold_vol20_pct", label: "gold realised volatility" },
      { key: "nq_ret_5d", label: "Nasdaq-100 return, five days" },
      { key: "eurusd_ret_5d", label: "EURUSD return, five days" },
      { key: "wti_ret_5d", label: "WTI return, five days" }
    ],
    data_requirements: [
      "Intraday gold history that resolves the 09:30 ET cutoff (local OANDA hourly cache).",
      "Daily equity, FX and energy closes with a declared lag."
    ],
    missing_inputs: [
      "gold comes from a local cache of a previously acquired vendor file rather than a fresh download",
      "the dollar index already contains EUR, so the EURUSD rule is a confirmation input, not independent evidence"
    ]
  }
]);

function mean(values) {
  const usable = values.filter((value) => Number.isFinite(value));
  if (!usable.length) return null;
  return usable.reduce((total, value) => total + value, 0) / usable.length;
}

function pearson(pairs) {
  const usable = pairs.filter(([left, right]) => Number.isFinite(left) && Number.isFinite(right));
  if (usable.length < 10) return { r: null, n: usable.length };
  const xs = usable.map(([left]) => left);
  const ys = usable.map(([, right]) => right);
  const meanX = mean(xs);
  const meanY = mean(ys);
  const covariance = usable.reduce((total, [x, y]) => total + (x - meanX) * (y - meanY), 0);
  const varianceX = xs.reduce((total, x) => total + (x - meanX) ** 2, 0);
  const varianceY = ys.reduce((total, y) => total + (y - meanY) ** 2, 0);
  if (varianceX === 0 || varianceY === 0) return { r: null, n: usable.length };
  return { r: Number((covariance / Math.sqrt(varianceX * varianceY)).toFixed(4)), n: usable.length };
}

/** Pairs of (feature, forward return) and (feature, return over the window that just closed). */
function featurePairs(rows, featureKey) {
  const forward = [];
  const trailing = [];
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const previous = rows[index - 1];
    const value = row.features[featureKey];
    if (!Number.isFinite(value)) continue;
    if (row.outcome.evaluable) forward.push([value, row.outcome.pct_change]);
    const priorDate = Date.parse(`${previous.snapshot_date}T00:00:00Z`);
    const rowDate = Date.parse(`${row.snapshot_date}T00:00:00Z`);
    // The trailing window counts only when the two rows are adjacent sessions.
    if (previous.outcome.evaluable && rowDate - priorDate <= 4 * 86400000) {
      trailing.push([value, previous.outcome.pct_change]);
    }
  }
  return { forward, trailing };
}

function tercileHitRates(rows, featureKey) {
  const pairs = rows
    .filter((row) => Number.isFinite(row.features[featureKey]) && row.outcome.evaluable && row.outcome.market_outcome_direction !== "FLAT")
    .map((row) => ({ value: row.features[featureKey], up: row.outcome.market_outcome_direction === "BULLISH" ? 1 : 0 }));
  if (pairs.length < 30) return null;
  const sorted = pairs.slice().sort((left, right) => left.value - right.value);
  const size = Math.floor(sorted.length / 3);
  const bottom = sorted.slice(0, size);
  const top = sorted.slice(sorted.length - size);
  return {
    bottom_tercile_up_share_pct: Number((mean(bottom.map((entry) => entry.up)) * 100).toFixed(2)),
    top_tercile_up_share_pct: Number((mean(top.map((entry) => entry.up)) * 100).toFixed(2)),
    bottom_tercile_n: bottom.length,
    top_tercile_n: top.length
  };
}

function quarterSignStability(rows, featureKey) {
  const byQuarter = new Map();
  for (const row of rows) {
    if (!Number.isFinite(row.features[featureKey]) || !row.outcome.evaluable) continue;
    const quarter = `${row.snapshot_date.slice(0, 4)}-Q${Math.floor((Number(row.snapshot_date.slice(5, 7)) - 1) / 3) + 1}`;
    if (!byQuarter.has(quarter)) byQuarter.set(quarter, []);
    byQuarter.get(quarter).push([row.features[featureKey], row.outcome.pct_change]);
  }
  const perQuarter = Array.from(byQuarter.entries())
    .map(([quarter, pairs]) => ({ quarter, r: pearson(pairs).r }))
    .filter((entry) => entry.r !== null);
  const positives = perQuarter.filter((entry) => entry.r > 0).length;
  return {
    quarters: perQuarter.length,
    positive_quarters: positives,
    negative_quarters: perQuarter.length - positives,
    detail: perQuarter
  };
}

module.exports = {
  FAMILIES,
  featurePairs,
  pearson,
  quarterSignStability,
  tercileHitRates
};
