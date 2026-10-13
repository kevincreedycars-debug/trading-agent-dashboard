"use strict";

/**
 * Target-independent macro series for the USD session programme (research only, 2026-10-13).
 *
 * "Target-independent" means none of these series is the label. They are acquired and aligned to the
 * 05:00 Europe/London cutoff so later feature work has an honest as-of frame to build on. Nothing here
 * chooses a sign, a threshold or a rule, and nothing here scores anything.
 *
 * The publication timing on each entry is what was actually checked on 2026-10-13, with the page it was
 * checked on. Where the publication time could not be checked, the entry says so instead of guessing and
 * the mechanical alignment falls back to a declared business-day lag that is labelled an assumption.
 * That distinction matters: a value existing in a file is not the same thing as a value published by the
 * cutoff.
 */

const MACRO_WINDOW = Object.freeze({
  warmup_start: "2023-10-02",
  start: "2024-01-02",
  end: "2026-10-12"
});

const PUBLICATION = Object.freeze({
  h10_weekly_monday: {
    release: "Federal Reserve H.10 Foreign Exchange Rates",
    schedule: "Mondays at 16:15 America/New_York, carrying daily bilateral exchange rates and the U.S. dollar indexes for the previous business week; if the Monday is a Federal Reserve holiday the release moves to the following business day",
    verified_from: "https://www.federalreserve.gov/releases/h10/",
    verified_on: "2026-10-13",
    alignment: "h10_weekly_monday",
    timing_verified: true
  },
  h15_daily: {
    release: "Federal Reserve H.15 Selected Interest Rates",
    schedule: "the page confirms a daily release, but the exact publication time was NOT captured in this cycle, so the alignment uses a declared one-business-day lag and the timing must be re-verified before any live use",
    verified_from: "https://www.federalreserve.gov/releases/h15/",
    verified_on: "2026-10-13 (frequency only)",
    alignment: "business_days",
    declared_lag_business_days: 1,
    timing_verified: false
  },
  market_close_daily: {
    release: "provider close on the observation date, redistributed by FRED",
    schedule: "the value is that date's close and is not knowable before it; the redistribution lag was not measured in this cycle, so the alignment uses a declared one-business-day lag",
    verified_from: "https://fred.stlouisfed.org/",
    verified_on: "2026-10-13 (redistribution only)",
    alignment: "business_days",
    declared_lag_business_days: 1,
    timing_verified: false
  },
  policy_rate_daily: {
    release: "Federal Reserve Bank of New York reference rate",
    schedule: "published on the next business day for the prior business day; the publication time was not captured in this cycle, so the alignment uses a declared one-business-day lag",
    verified_from: "https://fred.stlouisfed.org/",
    verified_on: "2026-10-13 (series identity only)",
    alignment: "business_days",
    declared_lag_business_days: 1,
    timing_verified: false
  }
});

const REVISION_NOTE_VERIFIED = "FRED shows \"All data are subject to revision\" on this series page";
const REVISION_NOTE_ASSUMED = "the FRED revision note was not read on this series page in this cycle; FRED showed it on every page that was read";

function fred({ key, provider_series, group, units, publication, revision_note, revision_verified, note }) {
  return {
    key,
    role: "feature",
    provider: "fred",
    provider_series,
    frequency: "daily",
    units,
    group,
    publication,
    revision_note,
    revision_verified: revision_verified === true,
    note
  };
}

const MACRO_SERIES = Object.freeze([
  fred({
    key: "us_2y_yield", provider_series: "DGS2", group: "us_front_end", units: "percent",
    publication: PUBLICATION.h15_daily, revision_note: REVISION_NOTE_ASSUMED,
    note: "Treasury 2Y constant maturity, the live engine's F2 input."
  }),
  fred({
    key: "us_3m_yield", provider_series: "DGS3MO", group: "us_front_end", units: "percent",
    publication: PUBLICATION.h15_daily, revision_note: REVISION_NOTE_ASSUMED,
    note: "Treasury 3M constant maturity; the shortest published front-end point."
  }),
  fred({
    key: "us_10y_yield", provider_series: "DGS10", group: "us_curve", units: "percent",
    publication: PUBLICATION.h15_daily, revision_note: REVISION_NOTE_ASSUMED,
    note: "Treasury 10Y constant maturity; the collector acquires it but the engine never reads it."
  }),
  fred({
    key: "us_5y_real_yield", provider_series: "DFII5", group: "us_real_rates", units: "percent",
    publication: PUBLICATION.h15_daily, revision_note: REVISION_NOTE_ASSUMED,
    note: "5Y TIPS real yield."
  }),
  fred({
    key: "us_10y_real_yield", provider_series: "DFII10", group: "us_real_rates", units: "percent",
    publication: PUBLICATION.h15_daily, revision_note: REVISION_NOTE_ASSUMED,
    note: "10Y TIPS real yield, the live engine's F4 input."
  }),
  fred({
    key: "us_5y_breakeven", provider_series: "T5YIE", group: "inflation_compensation", units: "percent",
    publication: PUBLICATION.h15_daily, revision_note: REVISION_NOTE_ASSUMED,
    note: "5Y breakeven inflation rate."
  }),
  fred({
    key: "us_10y_breakeven", provider_series: "T10YIE", group: "inflation_compensation", units: "percent",
    publication: PUBLICATION.h15_daily, revision_note: REVISION_NOTE_ASSUMED,
    note: "10Y breakeven inflation rate."
  }),
  fred({
    key: "credit_spread_hy", provider_series: "BAMLH0A0HYM2", group: "credit", units: "percent",
    publication: PUBLICATION.market_close_daily, revision_note: REVISION_NOTE_ASSUMED,
    note: "US high-yield option-adjusted spread."
  }),
  fred({
    key: "vix_level", provider_series: "VIXCLS", group: "risk", units: "index",
    publication: PUBLICATION.market_close_daily, revision_note: REVISION_NOTE_ASSUMED,
    note: "CBOE VIX close, the live engine's F1 input."
  }),
  fred({
    key: "policy_rate_effr", provider_series: "EFFR", group: "policy", units: "percent",
    publication: PUBLICATION.policy_rate_daily, revision_note: REVISION_NOTE_ASSUMED,
    note: "Effective federal funds rate."
  }),
  fred({
    key: "sofr", provider_series: "SOFR", group: "policy", units: "percent",
    publication: PUBLICATION.policy_rate_daily, revision_note: REVISION_NOTE_ASSUMED,
    note: "Secured overnight financing rate; a money-market stress read."
  }),
  fred({
    key: "sp500_level", provider_series: "SP500", group: "equities", units: "index",
    publication: PUBLICATION.market_close_daily, revision_note: REVISION_NOTE_ASSUMED,
    note: "S&P 500 close."
  }),
  fred({
    key: "nasdaq100_level", provider_series: "NASDAQ100", group: "equities", units: "index",
    publication: PUBLICATION.market_close_daily, revision_note: REVISION_NOTE_ASSUMED,
    note: "Nasdaq-100 close; stands in for the collector's QQQ quote."
  }),
  fred({
    key: "wti_spot", provider_series: "DCOILWTICO", group: "commodities", units: "usd_per_barrel",
    publication: PUBLICATION.market_close_daily, revision_note: REVISION_NOTE_ASSUMED,
    note: "WTI spot; energy and global-growth context."
  }),
  fred({
    key: "eurusd", provider_series: "DEXUSEU", group: "fx_h10", units: "usd_per_eur",
    publication: PUBLICATION.h10_weekly_monday, revision_note: REVISION_NOTE_VERIFIED, revision_verified: true,
    note: "Noon buying rate in New York; one DXY leg, and the instrument of the named fallback target in target_source_assessment.md."
  }),
  fred({
    key: "usdjpy", provider_series: "DEXJPUS", group: "fx_h10", units: "jpy_per_usd",
    publication: PUBLICATION.h10_weekly_monday, revision_note: REVISION_NOTE_ASSUMED,
    note: "Noon buying rate; one DXY leg and the funding-currency read."
  }),
  fred({
    key: "usdgbp", provider_series: "DEXUSUK", group: "fx_h10", units: "usd_per_gbp",
    publication: PUBLICATION.h10_weekly_monday, revision_note: REVISION_NOTE_ASSUMED,
    note: "Noon buying rate; one DXY leg."
  }),
  fred({
    key: "usdcad", provider_series: "DEXCAUS", group: "fx_h10", units: "cad_per_usd",
    publication: PUBLICATION.h10_weekly_monday, revision_note: REVISION_NOTE_ASSUMED,
    note: "Noon buying rate; one DXY leg."
  }),
  fred({
    key: "usdchf", provider_series: "DEXSZUS", group: "fx_h10", units: "chf_per_usd",
    publication: PUBLICATION.h10_weekly_monday, revision_note: REVISION_NOTE_ASSUMED,
    note: "Noon buying rate; one DXY leg."
  }),
  fred({
    key: "usdsek", provider_series: "DEXSDUS", group: "fx_h10", units: "sek_per_usd",
    publication: PUBLICATION.h10_weekly_monday, revision_note: REVISION_NOTE_ASSUMED,
    note: "Noon buying rate; one DXY leg, and the leg no live collector path reaches today."
  }),
  fred({
    key: "broad_dollar", provider_series: "DTWEXBGS", group: "dollar_indexes", units: "index",
    publication: PUBLICATION.h10_weekly_monday, revision_note: REVISION_NOTE_VERIFIED, revision_verified: true,
    note: "Nominal broad U.S. dollar index, the series the live collector stores as dxy_level. Registered as a feature only: its weekly Monday release makes it unusable as a same-day intraday label."
  }),
  fred({
    key: "afe_dollar", provider_series: "DTWEXAFEGS", group: "dollar_indexes", units: "index",
    publication: PUBLICATION.h10_weekly_monday, revision_note: REVISION_NOTE_ASSUMED,
    note: "Nominal advanced foreign economies dollar index."
  })
]);

function macroSeriesByKey(key) {
  const found = MACRO_SERIES.find(entry => entry.key === key);
  if (!found) throw new Error(`Unknown macro series: ${key}`);
  return found;
}

module.exports = { MACRO_SERIES, MACRO_WINDOW, PUBLICATION, macroSeriesByKey };
