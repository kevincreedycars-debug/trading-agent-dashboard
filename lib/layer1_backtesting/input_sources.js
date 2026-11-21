"use strict";

/**
 * Declared sources for every input a registered model can read (research only).
 *
 * This file turns an input key into the source that produced it. The provider, series id, frequency and
 * declared publication lag come from the committed macro inventory
 * (`data/research/usd-session/macro-data-inventory.json`), which is the file that records what was verified
 * and what was not. Derived keys name their parents and the transform, so a five-day change is never
 * reported as if it had its own print.
 *
 * The point is to make retrieval a model-owned statement rather than a caption: the retrieval module asks
 * this file where a value comes from, and records that answer with every value it returns.
 *
 * Nothing here reads the network. Reading the committed inventory is a file read of checked-in evidence.
 */

const inventory = require("../../data/research/usd-session/macro-data-inventory.json");
const contracts = require("../../backtester/lib/usd_layer1_backtester/contracts");

const INVENTORY_PATH = "data/research/usd-session/macro-data-inventory.json";
const PROVENANCE_PATH = "data/usd-layer1-backtester/run-v1.json";

const BASE = new Map((inventory.series || []).map((series) => [series.key, series]));

/** Derived keys: the base series, the transform and, where a second series is needed, every parent. */
const DERIVED = Object.freeze({
  vix_d1_chg: { parents: ["vix_level"], transform: "one-business-day change in VIX points" },
  vix_d5_chg: { parents: ["vix_level"], transform: "five-business-day change in VIX points" },
  us_2y_d5_bps: { parents: ["us_2y_yield"], transform: "five-business-day change in basis points" },
  us_2y_d20_bps: { parents: ["us_2y_yield"], transform: "twenty-business-day change in basis points" },
  us_10y_d5_bps: { parents: ["us_10y_yield"], transform: "five-business-day change in basis points" },
  us_10y_real_d5_bps: { parents: ["us_10y_real_yield"], transform: "five-business-day change in basis points" },
  us_10y_real_d20_bps: { parents: ["us_10y_real_yield"], transform: "twenty-business-day change in basis points" },
  broad_dollar_d1_pct: { parents: ["broad_dollar"], transform: "one-business-day percentage change" },
  broad_dollar_d5_pct: { parents: ["broad_dollar"], transform: "five-business-day percentage change" },
  broad_dollar_d20_pct: { parents: ["broad_dollar"], transform: "twenty-business-day percentage change" },
  afe_dollar_d5_pct: { parents: ["afe_dollar"], transform: "five-business-day percentage change" },
  us_de_2y_spread: { parents: ["us_2y_yield", "de_2y_yield"], transform: "US 2Y minus German 2Y, in percentage points" },
  us_de_2y_spread_d5_bps: { parents: ["us_2y_yield", "de_2y_yield"], transform: "five-business-day change of the spread, in basis points" },
  usdjpy_d1_pct: { parents: ["usdjpy"], transform: "one-business-day percentage change" },
  usdjpy_d5_pct: { parents: ["usdjpy"], transform: "five-business-day percentage change" },
  usdchf_d1_pct: { parents: ["usdchf"], transform: "one-business-day percentage change" },
  eurusd_d5_pct: { parents: ["eurusd"], transform: "five-business-day percentage change" }
});

/** The prices read from cached provider candles, and the series each one comes from. */
const PRICE_SOURCES = Object.freeze({
  gold_price: { provider: "oanda", series: "oanda_xau_usd_h1.csv", transform: "cached one-hour close" },
  gold_d1_pct: { provider: "oanda", series: "oanda_xau_usd_h1.csv", transform: "one-business-day percentage change of the cached close" },
  gold_d5_pct: { provider: "oanda", series: "oanda_xau_usd_h1.csv", transform: "five-business-day percentage change of the cached close" },
  gold_d20_pct: { provider: "oanda", series: "oanda_xau_usd_h1.csv", transform: "twenty-business-day percentage change of the cached close" },
  nasdaq100_price: { provider: "oanda", series: "oanda_nas100_usd_h1.csv", transform: "cached one-hour close" },
  nasdaq100_d1_pct: { provider: "oanda", series: "oanda_nas100_usd_h1.csv", transform: "one-business-day percentage change of the cached close" },
  nasdaq100_d5_pct: { provider: "oanda", series: "oanda_nas100_usd_h1.csv", transform: "five-business-day percentage change of the cached close" },
  nasdaq100_d20_pct: { provider: "oanda", series: "oanda_nas100_usd_h1.csv", transform: "twenty-business-day percentage change of the cached close" }
});

/** The German 2Y leg of the spread is a Bundesbank series, declared separately from the FRED legs. */
const DE_2Y = Object.freeze({
  provider: "bundesbank",
  series: "BBSIS daily 2Y spot",
  frequency: "daily",
  units: "percent",
  publication: {
    release: "Bundesbank BBSIS daily yield curve",
    schedule: "observation dated on the value; the panel's own legend says it is usable from the next day",
    declared_lag_business_days: 1,
    timing_verified: false
  }
});

function publicationOf(series) {
  const publication = (series && series.publication) || {};
  return {
    release: publication.release || null,
    schedule: publication.schedule || null,
    declared_lag_business_days: publication.declared_lag_business_days === undefined
      ? null
      : publication.declared_lag_business_days,
    timing_verified: publication.timing_verified === true,
    verified_from: publication.verified_from || null,
    verified_on: publication.verified_on || null
  };
}

function fromInventory(key) {
  const series = BASE.get(key);
  if (!series) return null;
  return {
    key,
    provider: series.provider,
    series: series.provider_series,
    frequency: series.frequency,
    units: series.units,
    transform: "read directly",
    parents: [],
    publication: publicationOf(series),
    revision_note: series.revision_note || null,
    live_collector_path: series.live_collector_path === true,
    inventory_key: key
  };
}

function fromDerived(key, rule) {
  const parents = rule.parents.map((parent) => {
    if (parent === "de_2y_yield") return Object.assign({ key: "de_2y_yield" }, DE_2Y);
    const found = fromInventory(parent);
    return found || { key: parent, provider: "unknown", series: null, publication: publicationOf(null) };
  });
  const primary = parents[0] || {};
  return {
    key,
    provider: parents.map((parent) => parent.provider).filter(Boolean).join(" + "),
    series: parents.map((parent) => parent.series).filter(Boolean).join(" - "),
    frequency: primary.frequency || null,
    units: primary.units || null,
    transform: rule.transform,
    parents: parents.map((parent) => parent.key),
    publication: primary.publication || publicationOf(null),
    revision_note: "a derived value inherits the vintage of its oldest parent; it has no print of its own",
    live_collector_path: parents.every((parent) => parent.live_collector_path === true),
    inventory_key: parents.length === 1 ? parents[0].key : null
  };
}

function fromPrice(key, rule) {
  return {
    key,
    provider: rule.provider,
    series: rule.series,
    frequency: "one-hour candles",
    units: "quoted price",
    transform: rule.transform,
    parents: [],
    publication: {
      release: "provider candle cache",
      schedule:
        "the candle closes at the 05:00 London boundary; the cache records no acquisition timestamp, so the retrieval time is not a publication receipt",
      declared_lag_business_days: 0,
      timing_verified: false,
      verified_from: null,
      verified_on: null
    },
    revision_note: "a provider candle can be restated; no vintage of the cache is archived",
    live_collector_path: false,
    inventory_key: null
  };
}

/**
 * Where one input key comes from.
 *
 * An unknown key returns a declaration with `known: false` rather than throwing: the contract can still name
 * a key the source catalogue has not learned yet, and the retrieval record then says so instead of guessing.
 */
function sourceFor(key) {
  if (BASE.has(key)) return Object.assign({ known: true }, fromInventory(key));
  if (DERIVED[key]) return Object.assign({ known: true }, fromDerived(key, DERIVED[key]));
  if (PRICE_SOURCES[key]) return Object.assign({ known: true }, fromPrice(key, PRICE_SOURCES[key]));
  return {
    key,
    known: false,
    provider: null,
    series: null,
    frequency: null,
    units: null,
    transform: null,
    parents: [],
    publication: publicationOf(null),
    revision_note: null,
    live_collector_path: false,
    inventory_key: null,
    reason: "the declared source catalogue has no entry for this key"
  };
}

/** The catalogue for a model's declared keys, de-duplicated and in contract order. */
function catalogueFor(keys) {
  const seen = new Set();
  const rows = [];
  for (const key of keys || []) {
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(sourceFor(key));
  }
  return rows;
}

/** The committed market outcome series, used to show which prices the scoring lane reads. */
function outcomeSeries() {
  return contracts.MARKETS.map((market) => ({
    market: market.key,
    label: market.label,
    series: market.outcome_series,
    usd_bullish_predicts: market.usd_bullish_predicts
  }));
}

module.exports = {
  INVENTORY_PATH,
  PROVENANCE_PATH,
  DERIVED,
  PRICE_SOURCES,
  sourceFor,
  catalogueFor,
  outcomeSeries
};

module.exports = {
  INVENTORY_PATH,
  PROVENANCE_PATH,
  DERIVED,
  PRICE_SOURCES,
  sourceFor,
  catalogueFor,
  outcomeSeries
};
