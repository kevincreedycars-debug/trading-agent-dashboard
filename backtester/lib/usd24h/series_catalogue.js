"use strict";

/**
 * Declared input catalogue for the USD 24-hour research dataset.
 *
 * Every series carries its own availability lag, expressed in whole business days. The lag is the
 * declared reconstruction of when a value became usable at the daily cutoff, not an authentic
 * publication timestamp: FRED daily market series are published after the US close on the
 * observation date, the broad dollar index is published with a longer lag, and the local intraday
 * gold cache is usable at the first cutoff after the candle completes. Nothing here is a vintage:
 * a revised value is read, which is a declared limitation of this dataset.
 */

const RESEARCH_WINDOW = Object.freeze({
  warmup_start: "2023-04-03",
  start: "2024-01-02",
  end: "2026-04-30"
});

const LOCAL_GOLD_CACHE = "backtester/tmp/gold-hourly-extended-20260918/candles.json";

const SERIES = Object.freeze([
  {
    key: "dxy_level",
    role: "outcome_instrument_and_feature",
    provider: "fred",
    provider_series: "DTWEXBGS",
    frequency: "daily",
    units: "index",
    availability_lag_business_days: 2,
    note: "Nominal broad US dollar index, the series the live collector stores as dxy_level. The outcome contract reproduces the archived one (2024-01-02 open 119.2686)."
  },
  {
    key: "dxy_level_lag1",
    role: "feature_variant",
    provider: "fred",
    provider_series: "DTWEXBGS",
    frequency: "daily",
    units: "index",
    availability_lag_business_days: 1,
    note: "Same series as dxy_level with a one-business-day lag. The live collector reads the latest available value at run time, which is usually one or two business days old, so this variant bounds the faster reading. It is never used for outcomes."
  },
  {
    key: "vix_level",
    role: "feature",
    provider: "fred",
    provider_series: "VIXCLS",
    frequency: "daily",
    units: "index",
    availability_lag_business_days: 1,
    note: "CBOE VIX close."
  },
  {
    key: "us_2y_yield",
    role: "feature",
    provider: "fred",
    provider_series: "DGS2",
    frequency: "daily",
    units: "percent",
    availability_lag_business_days: 1,
    note: "Treasury 2Y constant maturity."
  },
  {
    key: "us_3m_yield",
    role: "feature",
    provider: "fred",
    provider_series: "DGS3MO",
    frequency: "daily",
    units: "percent",
    availability_lag_business_days: 1,
    note: "Treasury 3M constant maturity; front-end policy sensitivity."
  },
  {
    key: "us_10y_yield",
    role: "feature",
    provider: "fred",
    provider_series: "DGS10",
    frequency: "daily",
    units: "percent",
    availability_lag_business_days: 1,
    note: "Treasury 10Y constant maturity."
  },
  {
    key: "us_10y_real_yield",
    role: "feature",
    provider: "fred",
    provider_series: "DFII10",
    frequency: "daily",
    units: "percent",
    availability_lag_business_days: 1,
    note: "10Y TIPS real yield."
  },
  {
    key: "us_5y_real_yield",
    role: "feature",
    provider: "fred",
    provider_series: "DFII5",
    frequency: "daily",
    units: "percent",
    availability_lag_business_days: 1,
    note: "5Y TIPS real yield."
  },
  {
    key: "us_10y_breakeven",
    role: "feature",
    provider: "fred",
    provider_series: "T10YIE",
    frequency: "daily",
    units: "percent",
    availability_lag_business_days: 1,
    note: "10Y breakeven inflation compensation."
  },
  {
    key: "policy_rate_effr",
    role: "feature",
    provider: "fred",
    provider_series: "EFFR",
    frequency: "daily",
    units: "percent",
    availability_lag_business_days: 1,
    note: "Effective federal funds rate; the realised policy stance, not an expectation."
  },
  {
    key: "sofr",
    role: "feature",
    provider: "fred",
    provider_series: "SOFR",
    frequency: "daily",
    units: "percent",
    availability_lag_business_days: 1,
    note: "Secured overnight financing rate."
  },
  {
    key: "credit_spread_hy",
    role: "feature",
    provider: "fred",
    provider_series: "BAMLH0A0HYM2",
    frequency: "daily",
    units: "percent",
    availability_lag_business_days: 1,
    note: "US high-yield option-adjusted spread; risk-condition input."
  },
  {
    key: "nq_level",
    role: "feature",
    provider: "fred",
    provider_series: "NASDAQ100",
    frequency: "daily",
    units: "index",
    availability_lag_business_days: 1,
    note: "Nasdaq-100 index level; stands in for the collector's QQQ quote."
  },
  {
    key: "sp500_level",
    role: "feature",
    provider: "fred",
    provider_series: "SP500",
    frequency: "daily",
    units: "index",
    availability_lag_business_days: 1,
    note: "S&P 500 index level; breadth and drawdown context."
  },
  {
    key: "eurusd",
    role: "feature",
    provider: "fred",
    provider_series: "DEXUSEU",
    frequency: "daily",
    units: "usd_per_eur",
    availability_lag_business_days: 1,
    note: "Daily USD/EUR reference rate."
  },
  {
    key: "usdjpy",
    role: "feature",
    provider: "fred",
    provider_series: "DEXJPUS",
    frequency: "daily",
    units: "jpy_per_usd",
    availability_lag_business_days: 1,
    note: "Daily JPY/USD reference rate; funding-currency context."
  },
  {
    key: "wti_spot",
    role: "feature",
    provider: "fred",
    provider_series: "DCOILWTICO",
    frequency: "daily",
    units: "usd_per_barrel",
    availability_lag_business_days: 2,
    note: "WTI spot; energy and global-growth context."
  },
  {
    key: "de_2y_yield",
    role: "feature",
    provider: "bundesbank",
    provider_series: "BBSSY/D.REN.EUR.A610.000000WT0202.A",
    frequency: "daily",
    units: "percent",
    availability_lag_business_days: 1,
    note: "German 2Y Schatz yield, the family the live collector reads from the Bundesbank API. Rebuilds the US-DE 2Y spread."
  },
  {
    key: "de_10y_yield_monthly",
    role: "context_only",
    provider: "fred",
    provider_series: "IRLTLT01DEM156N",
    frequency: "monthly",
    units: "percent",
    availability_lag_business_days: 45,
    note: "German 10Y long-term rate, monthly and revised. Context only, never a daily rule input."
  },
  {
    key: "gold_spot_intraday",
    role: "feature",
    provider: "local_cache",
    provider_series: LOCAL_GOLD_CACHE,
    frequency: "hourly",
    units: "usd_per_oz",
    availability_lag_business_days: 0,
    note: "Mid-price XAUUSD hourly candles previously acquired into the ignored local cache. The feature engine reads only candles that completed before the cutoff."
  },
  {
    key: "gold_futures_daily",
    role: "cross_check",
    provider: "yahoo",
    provider_series: "GC=F",
    frequency: "daily",
    units: "usd_per_oz",
    availability_lag_business_days: 1,
    note: "COMEX gold futures daily close, used only to cross-check the local intraday gold cache."
  }
]);

function seriesByKey(key) {
  const found = SERIES.find((entry) => entry.key === key);
  if (!found) throw new Error(`Unknown USD research series: ${key}`);
  return found;
}

module.exports = {
  LOCAL_GOLD_CACHE,
  RESEARCH_WINDOW,
  SERIES,
  seriesByKey
};
