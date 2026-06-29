#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  assertDateRange,
  fetchAllRows,
  maxDate,
  minDate,
  parseArgs,
  requireEnv,
  upsertRows
} = require("../../lib/historical_common");

const DEFAULT_START = "2024-01-02";
const DEFAULT_END = "2026-04-30";
const SNAPSHOT_TABLE = "historical_eur_market_snapshots";
const LOGIC_DOCUMENT = "agent_eur_direction.md";
const COLLECTOR_VERSION = "eur_historical_snapshot_builder_v1";
const SNAPSHOT_SCHEMA_VERSION = "v1";
const RECONSTRUCTION_LOGIC_VERSION = "eur_historical_reconstruction_v1";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseLogicVersion() {
  const logicPath = path.resolve(__dirname, "../../../logic/agent_eur_direction.md");
  const text = fs.readFileSync(logicPath, "utf8");
  const explicitMachineVersion = text.match(/"logic_document_version":\s*"([^"]+)"/);
  if (explicitMachineVersion) {
    return explicitMachineVersion[1];
  }

  const headlineVersion = text.match(/Version:\s*([^\r\n]+)/i);
  if (headlineVersion) {
    return String(headlineVersion[1]).trim();
  }

  return "unknown";
}

function shiftDateLiteral(dateLiteral, days) {
  const date = new Date(`${dateLiteral}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildSeriesMap(rows, valueField = "value_numeric") {
  const byDate = new Map();
  const ordered = rows
    .map((row) => ({
      observation_date: row.observation_date,
      value: toNumber(row[valueField]),
      row
    }))
    .filter((row) => row.observation_date && row.value !== null)
    .sort((left, right) => left.observation_date.localeCompare(right.observation_date));

  ordered.forEach((entry, index) => {
    byDate.set(entry.observation_date, {
      ...entry,
      index
    });
  });

  return { ordered, byDate };
}

function previousValue(seriesState, currentDate, offset) {
  const current = seriesState.byDate.get(currentDate);
  if (!current) return null;
  const prior = seriesState.ordered[current.index - offset];
  return prior ? prior.value : null;
}

function percentDelta(current, previous) {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function bpsDelta(current, previous) {
  if (current === null || previous === null) return null;
  return (current - previous) * 100;
}

function deriveEquitiesRegime(vixLevel) {
  if (vixLevel === null) return null;
  if (vixLevel < 16) return "risk_on";
  if (vixLevel > 25) return "risk_off";
  return "neutral";
}

function deriveCoverageStatus(missingKeys, requiredKeys) {
  const missingRequired = requiredKeys.filter((key) => missingKeys.includes(key));
  if (!missingRequired.length) return "collected";
  if (missingRequired.length === requiredKeys.length) return "missing";
  return "partial";
}

function listCandidateDates(seriesCollection, startDate, endDate) {
  const dateSet = new Set();
  for (const seriesState of Object.values(seriesCollection)) {
    for (const entry of seriesState.ordered) {
      if (entry.observation_date >= startDate && entry.observation_date <= endDate) {
        dateSet.add(entry.observation_date);
      }
    }
  }
  return Array.from(dateSet).sort();
}

function deriveLatestEvent(snapshotDate, events) {
  const cutoff = `${snapshotDate}T23:59:59Z`;
  let latest = null;
  for (const event of events) {
    if (event.event_time <= cutoff) {
      latest = event;
    } else {
      break;
    }
  }
  return latest;
}

function computeEventAgeHours(snapshotDate, eventTime) {
  if (!eventTime) return null;
  const snapshotTs = new Date(`${snapshotDate}T23:59:59Z`).getTime();
  const eventTs = new Date(eventTime).getTime();
  const deltaHours = (snapshotTs - eventTs) / (1000 * 60 * 60);
  return deltaHours >= 0 ? deltaHours : null;
}

function deriveEcbBias(completedEvents) {
  let ecbBiasScore = 0;
  const ecbBiasReasons = [];

  for (const event of completedEvents.slice(0, 8)) {
    const importance = String(event.importance || "").toLowerCase();
    const weight = importance.includes("high") ? 2 : 1;
    const signal = String(event.currency_signal || "").toUpperCase();

    if (signal === "BULLISH") {
      ecbBiasScore += weight;
      ecbBiasReasons.push(`${event.event_name} beat forecast`);
    }

    if (signal === "BEARISH") {
      ecbBiasScore -= weight;
      ecbBiasReasons.push(`${event.event_name} missed forecast`);
    }
  }

  let ecbBias = "neutral";
  if (ecbBiasScore >= 2) ecbBias = "hawkish";
  if (ecbBiasScore <= -2) ecbBias = "dovish";

  return { ecbBias, ecbBiasScore, ecbBiasReasons };
}

function derivePmiInputs(snapshotDate, eurEvents) {
  const completedPmi = eurEvents
    .filter((event) => event.event_time <= `${snapshotDate}T23:59:59Z`)
    .filter((event) => String(event.event_name || "").toLowerCase().includes("pmi"))
    .filter((event) => toNumber(event.actual_numeric) !== null)
    .sort((left, right) => {
      const timeDiff = right.event_time.localeCompare(left.event_time);
      if (timeDiff !== 0) return timeDiff;
      return String(left.event_name || "").localeCompare(String(right.event_name || ""));
    });

  const latest = completedPmi[0] || null;
  const actual = toNumber(latest?.actual_numeric);
  const previous = toNumber(latest?.previous_numeric);

  let direction = null;
  if (actual !== null && previous !== null) {
    if (actual > previous) direction = "improving";
    else if (actual < previous) direction = "deteriorating";
    else direction = "stable";
  }

  return {
    latest,
    actual,
    direction,
    eventCount: completedPmi.length
  };
}

function buildSnapshotRow(snapshotDate, context) {
  const warnings = [];
  const missingSeries = [];

  function current(seriesKey) {
    const value = context.series[seriesKey]?.byDate.get(snapshotDate)?.value ?? null;
    if (value === null) {
      missingSeries.push(seriesKey);
    }
    return value;
  }

  const rawUs2y = current("us_2y_yield");
  const rawUs10y = current("us_10y_yield");
  const rawUs10yReal = current("us_10y_real_yield");
  const rawDe2y = current("de_2y_yield");
  const rawDe10y = current("de_10y_yield");
  const rawIt10y = current("it_10y_yield");
  const rawVix = current("vix_level");
  const rawDxy = current("dxy_level");
  const rawGold = current("gold_spot_usd");
  const rawQqq = current("qqq_nq_proxy");
  const rawEurusd = current("eurusd");

  const vixD1 = rawVix === null ? null : rawVix - previousValue(context.series.vix_level, snapshotDate, 1);
  const vixD5 = rawVix === null ? null : rawVix - previousValue(context.series.vix_level, snapshotDate, 5);
  const dxyD1 = percentDelta(rawDxy, previousValue(context.series.dxy_level, snapshotDate, 1));
  const dxyD5 = percentDelta(rawDxy, previousValue(context.series.dxy_level, snapshotDate, 5));
  const dxyD20 = percentDelta(rawDxy, previousValue(context.series.dxy_level, snapshotDate, 20));
  const us2yD5 = bpsDelta(rawUs2y, previousValue(context.series.us_2y_yield, snapshotDate, 5));
  const us2yD20 = bpsDelta(rawUs2y, previousValue(context.series.us_2y_yield, snapshotDate, 20));
  const us10yD5 = bpsDelta(rawUs10y, previousValue(context.series.us_10y_yield, snapshotDate, 5));
  const us10yD20 = bpsDelta(rawUs10y, previousValue(context.series.us_10y_yield, snapshotDate, 20));
  const us10yRealD5 = bpsDelta(rawUs10yReal, previousValue(context.series.us_10y_real_yield, snapshotDate, 5));
  const us10yRealD20 = bpsDelta(rawUs10yReal, previousValue(context.series.us_10y_real_yield, snapshotDate, 20));
  const de2yD5 = bpsDelta(rawDe2y, previousValue(context.series.de_2y_yield, snapshotDate, 5));
  const de2yD20 = bpsDelta(rawDe2y, previousValue(context.series.de_2y_yield, snapshotDate, 20));
  const de10yD5 = bpsDelta(rawDe10y, previousValue(context.series.de_10y_yield, snapshotDate, 5));
  const de10yD20 = bpsDelta(rawDe10y, previousValue(context.series.de_10y_yield, snapshotDate, 20));
  const it10yD5 = bpsDelta(rawIt10y, previousValue(context.series.it_10y_yield, snapshotDate, 5));
  const it10yD20 = bpsDelta(rawIt10y, previousValue(context.series.it_10y_yield, snapshotDate, 20));
  const goldD1 = percentDelta(rawGold, previousValue(context.series.gold_spot_usd, snapshotDate, 1));
  const goldD5 = percentDelta(rawGold, previousValue(context.series.gold_spot_usd, snapshotDate, 5));
  const goldD20 = percentDelta(rawGold, previousValue(context.series.gold_spot_usd, snapshotDate, 20));
  const nqD1 = percentDelta(rawQqq, previousValue(context.series.qqq_nq_proxy, snapshotDate, 1));
  const nqD5 = percentDelta(rawQqq, previousValue(context.series.qqq_nq_proxy, snapshotDate, 5));
  const nqD20 = percentDelta(rawQqq, previousValue(context.series.qqq_nq_proxy, snapshotDate, 20));
  const eurusdD1 = percentDelta(rawEurusd, previousValue(context.series.eurusd, snapshotDate, 1));
  const eurusdD5 = percentDelta(rawEurusd, previousValue(context.series.eurusd, snapshotDate, 5));
  const eurusdD20 = percentDelta(rawEurusd, previousValue(context.series.eurusd, snapshotDate, 20));

  const usDe2ySpread = rawUs2y !== null && rawDe2y !== null ? rawUs2y - rawDe2y : null;
  const previousUsDe2ySpread5 = (() => {
    const prevUs2y = previousValue(context.series.us_2y_yield, snapshotDate, 5);
    const prevDe2y = previousValue(context.series.de_2y_yield, snapshotDate, 5);
    if (prevUs2y === null || prevDe2y === null) return null;
    return prevUs2y - prevDe2y;
  })();
  const previousUsDe2ySpread20 = (() => {
    const prevUs2y = previousValue(context.series.us_2y_yield, snapshotDate, 20);
    const prevDe2y = previousValue(context.series.de_2y_yield, snapshotDate, 20);
    if (prevUs2y === null || prevDe2y === null) return null;
    return prevUs2y - prevDe2y;
  })();
  const usDe2ySpreadD5 = bpsDelta(usDe2ySpread, previousUsDe2ySpread5);
  const usDe2ySpreadD20 = bpsDelta(usDe2ySpread, previousUsDe2ySpread20);

  const usDe10ySpread = rawUs10y !== null && rawDe10y !== null ? rawUs10y - rawDe10y : null;
  const previousUsDe10ySpread5 = (() => {
    const prevUs10y = previousValue(context.series.us_10y_yield, snapshotDate, 5);
    const prevDe10y = previousValue(context.series.de_10y_yield, snapshotDate, 5);
    if (prevUs10y === null || prevDe10y === null) return null;
    return prevUs10y - prevDe10y;
  })();
  const previousUsDe10ySpread20 = (() => {
    const prevUs10y = previousValue(context.series.us_10y_yield, snapshotDate, 20);
    const prevDe10y = previousValue(context.series.de_10y_yield, snapshotDate, 20);
    if (prevUs10y === null || prevDe10y === null) return null;
    return prevUs10y - prevDe10y;
  })();
  const usDe10ySpreadD5 = bpsDelta(usDe10ySpread, previousUsDe10ySpread5);
  const usDe10ySpreadD20 = bpsDelta(usDe10ySpread, previousUsDe10ySpread20);

  const itDe10ySpread = rawIt10y !== null && rawDe10y !== null ? rawIt10y - rawDe10y : null;
  const previousItDe10ySpread5 = (() => {
    const prevIt10y = previousValue(context.series.it_10y_yield, snapshotDate, 5);
    const prevDe10y = previousValue(context.series.de_10y_yield, snapshotDate, 5);
    if (prevIt10y === null || prevDe10y === null) return null;
    return prevIt10y - prevDe10y;
  })();
  const previousItDe10ySpread20 = (() => {
    const prevIt10y = previousValue(context.series.it_10y_yield, snapshotDate, 20);
    const prevDe10y = previousValue(context.series.de_10y_yield, snapshotDate, 20);
    if (prevIt10y === null || prevDe10y === null) return null;
    return prevIt10y - prevDe10y;
  })();
  const itDe10ySpreadD5 = bpsDelta(itDe10ySpread, previousItDe10ySpread5);
  const itDe10ySpreadD20 = bpsDelta(itDe10ySpread, previousItDe10ySpread20);

  const completedEurEvents = context.eurEvents.filter((event) => event.event_time <= `${snapshotDate}T23:59:59Z`);
  const latestEzEvent = deriveLatestEvent(snapshotDate, completedEurEvents);
  const latestEzEventAgeHours = latestEzEvent ? computeEventAgeHours(snapshotDate, latestEzEvent.event_time) : null;
  const { ecbBias, ecbBiasScore, ecbBiasReasons } = deriveEcbBias(
    completedEurEvents
      .slice()
      .sort((left, right) => right.event_time.localeCompare(left.event_time))
  );
  const pmiInputs = derivePmiInputs(snapshotDate, context.eurEvents);

  const ezStressFlag =
    itDe10ySpreadD5 !== null && itDe10ySpreadD5 > 15 ? "elevated" :
    itDe10ySpreadD5 !== null && itDe10ySpreadD5 < -15 ? "easing" :
    itDe10ySpreadD5 !== null ? "neutral" :
    null;

  const globalGrowthRegime =
    nqD20 !== null && nqD20 > 5 ? "expanding" :
    nqD20 !== null && nqD20 < -5 ? "contracting" :
    "neutral";
  const chinaGrowthSignal =
    globalGrowthRegime === "expanding" ? "positive" :
    globalGrowthRegime === "contracting" ? "negative" :
    "neutral";

  const coverageRequiredKeys = [
    "us_2y_yield",
    "vix_level",
    "de_2y_yield",
    "gold_spot_usd",
    "qqq_nq_proxy"
  ];

  if (missingSeries.length) {
    warnings.push(...missingSeries.map((key) => `missing_${key}`));
  }
  if (rawEurusd === null) warnings.push("missing_eurusd_historical_series");
  if (!context.eurEvents.length) warnings.push("historical_eur_events_missing");
  if (!pmiInputs.eventCount) warnings.push("historical_eur_pmi_missing");

  const marketCoverageStatus = deriveCoverageStatus(Array.from(new Set(missingSeries)), coverageRequiredKeys);
  const eventCoverageStatus = context.eurEvents.length ? "collected" : "missing";
  const pmiCoverageStatus = pmiInputs.eventCount ? "collected" : "missing";
  const sourceStatus = marketCoverageStatus === "collected" && eventCoverageStatus === "collected" && pmiCoverageStatus === "collected"
    ? "collected"
    : marketCoverageStatus === "missing"
      ? "missing"
      : "partial";

  const reconstructable24h = [
    rawVix,
    de2yD5,
    usDe2ySpreadD5,
    pmiInputs.actual,
    eurusdD1,
    goldD1,
    ezStressFlag,
    globalGrowthRegime
  ].some((value) => value !== null && value !== undefined);

  return {
    asset_code: "EUR",
    observation_time: `${snapshotDate}T00:00:00Z`,
    snapshot_date: snapshotDate,
    snapshot_timezone: "UTC",
    snapshot_mode: "historical_reconstruction",

    raw_us_2y_yield: rawUs2y,
    raw_us_10y_yield: rawUs10y,
    raw_us_10y_real_yield: rawUs10yReal,
    raw_de_2y_yield: rawDe2y,
    raw_de_10y_yield: rawDe10y,
    raw_it_10y_yield: rawIt10y,
    raw_vix_level: rawVix,
    raw_dxy_level: rawDxy,
    raw_gold_price: rawGold,
    raw_nq_price: rawQqq,
    raw_eurusd_price: rawEurusd,

    vix_level: rawVix,
    vix_d1: vixD1,
    vix_d5: vixD5,

    dxy_level: rawDxy,
    dxy_d1: dxyD1,
    dxy_d5: dxyD5,
    dxy_d20: dxyD20,

    us_2y_yield: rawUs2y,
    us_2y_d5_bps: us2yD5,
    us_2y_d20_bps: us2yD20,

    us_10y_yield: rawUs10y,
    us_10y_d5_bps: us10yD5,
    us_10y_d20_bps: us10yD20,

    us_10y_real_yield: rawUs10yReal,
    us_10y_real_yield_d5_bps: us10yRealD5,
    us_10y_real_yield_d20_bps: us10yRealD20,

    de_2y_yield: rawDe2y,
    de_2y_d5_bps: de2yD5,
    de_2y_d20_bps: de2yD20,

    de_10y_yield: rawDe10y,
    de_10y_d5_bps: de10yD5,
    de_10y_d20_bps: de10yD20,

    it_10y_yield: rawIt10y,
    it_10y_d5_bps: it10yD5,
    it_10y_d20_bps: it10yD20,

    us_de_2y_spread: usDe2ySpread,
    us_de_2y_spread_d5_bps: usDe2ySpreadD5,
    us_de_2y_spread_d20_bps: usDe2ySpreadD20,

    us_de_10y_spread: usDe10ySpread,
    us_de_10y_spread_d5_bps: usDe10ySpreadD5,
    us_de_10y_spread_d20_bps: usDe10ySpreadD20,

    it_de_10y_spread: itDe10ySpread,
    it_de_10y_spread_d5_bps: itDe10ySpreadD5,
    it_de_10y_spread_d20_bps: itDe10ySpreadD20,

    eurusd_price: rawEurusd,
    eurusd_d1_pct: eurusdD1,
    eurusd_d5_pct: eurusdD5,
    eurusd_d20_pct: eurusdD20,

    gold_price: rawGold,
    gold_d1_pct: goldD1,
    gold_d5_pct: goldD5,
    gold_d20_pct: goldD20,

    nq_price: rawQqq,
    nq_d1_pct: nqD1,
    nq_d5_pct: nqD5,
    nq_d20_pct: nqD20,

    latest_ez_event: latestEzEvent || null,
    latest_ez_event_event: latestEzEvent?.event_name || null,
    latest_ez_event_time: latestEzEvent?.event_time || null,
    latest_ez_event_actual: toNumber(latestEzEvent?.actual_numeric),
    latest_ez_event_forecast: toNumber(latestEzEvent?.forecast_numeric),
    latest_ez_event_previous: toNumber(latestEzEvent?.previous_numeric),
    latest_ez_event_surprise: latestEzEvent?.surprise_direction || null,
    latest_ez_event_eur_signal: latestEzEvent?.currency_signal || null,
    latest_ez_event_impact: latestEzEvent?.importance || null,
    latest_ez_event_source: latestEzEvent?.vendor_event_id || latestEzEvent?.event_name || null,
    latest_ez_event_age_hours: latestEzEventAgeHours,

    ecb_bias: ecbBias,
    ecb_bias_score: ecbBiasScore,
    ecb_bias_reasons: ecbBiasReasons,

    ez_composite_pmi: pmiInputs.actual,
    ez_composite_pmi_direction: pmiInputs.direction,
    latest_ez_pmi_event: pmiInputs.latest || null,

    equities_regime: deriveEquitiesRegime(rawVix),
    global_growth_regime: globalGrowthRegime,
    china_growth_signal: chinaGrowthSignal,
    ez_stress_flag: ezStressFlag,

    collector_version: COLLECTOR_VERSION,
    snapshot_schema_version: SNAPSHOT_SCHEMA_VERSION,
    reconstruction_logic_version: RECONSTRUCTION_LOGIC_VERSION,
    logic_document: LOGIC_DOCUMENT,
    logic_document_version: context.logicDocumentVersion,
    source_bundle_version: "historical_warehouse_v1",
    source_vendor_manifest: {},
    reconstruction_notes: "Daily observation-date reconstruction for the current EUR production logic.",

    source_status: sourceStatus,
    event_coverage_status: eventCoverageStatus,
    market_data_coverage_status: marketCoverageStatus,
    pmi_coverage_status: pmiCoverageStatus,
    missing_inputs: Array.from(new Set(missingSeries)),
    missing_raw_series: Array.from(new Set(missingSeries)),
    history_rows_used: {
      us_2y_yield: context.series.us_2y_yield.byDate.has(snapshotDate) ? 1 : 0,
      us_10y_yield: context.series.us_10y_yield.byDate.has(snapshotDate) ? 1 : 0,
      us_10y_real_yield: context.series.us_10y_real_yield.byDate.has(snapshotDate) ? 1 : 0,
      de_2y_yield: context.series.de_2y_yield.byDate.has(snapshotDate) ? 1 : 0,
      de_10y_yield: context.series.de_10y_yield.byDate.has(snapshotDate) ? 1 : 0,
      it_10y_yield: context.series.it_10y_yield.byDate.has(snapshotDate) ? 1 : 0,
      vix_level: context.series.vix_level.byDate.has(snapshotDate) ? 1 : 0,
      dxy_level: context.series.dxy_level.byDate.has(snapshotDate) ? 1 : 0,
      gold_spot_usd: context.series.gold_spot_usd.byDate.has(snapshotDate) ? 1 : 0,
      qqq_nq_proxy: context.series.qqq_nq_proxy.byDate.has(snapshotDate) ? 1 : 0,
      eurusd: context.series.eurusd.byDate.has(snapshotDate) ? 1 : 0
    },
    warnings: Array.from(new Set(warnings)),
    quality_notes: Array.from(new Set(warnings)),
    is_reconstructable_following_24hrs: reconstructable24h,
    raw_event_payload: latestEzEvent || {},
    raw_market_payload: {
      pmi_event_count_visible: pmiInputs.eventCount,
      eur_event_count_visible: completedEurEvents.length
    }
  };
}

async function loadMacroSeries(supabaseUrl, serviceRoleKey, startDate, endDate) {
  const fetchStartDate = shiftDateLiteral(startDate, -60);
  const keys = [
    "us_2y_yield",
    "us_10y_yield",
    "us_10y_real_yield",
    "vix_level",
    "dxy_level",
    "de_2y_yield",
    "de_10y_yield",
    "it_10y_yield"
  ];

  const rows = await fetchAllRows(
    supabaseUrl,
    serviceRoleKey,
    "historical_macro_series",
    (url) => {
      url.searchParams.set("select", "series_key,observation_date,value_numeric");
      url.searchParams.set("series_key", `in.(${keys.join(",")})`);
      url.searchParams.set("observation_date", `gte.${fetchStartDate}`);
      url.searchParams.append("observation_date", `lte.${endDate}`);
      url.searchParams.set("order", "observation_date.asc");
    }
  );

  return keys.reduce((accumulator, key) => {
    accumulator[key] = buildSeriesMap(rows.filter((row) => row.series_key === key));
    return accumulator;
  }, {});
}

async function loadPriceSeries(supabaseUrl, serviceRoleKey, startDate, endDate) {
  const fetchStartDate = shiftDateLiteral(startDate, -60);
  const keys = ["gold_spot_usd", "qqq_nq_proxy", "eurusd"];

  const rows = await fetchAllRows(
    supabaseUrl,
    serviceRoleKey,
    "historical_price_series",
    (url) => {
      url.searchParams.set("select", "instrument_key,observation_date,close");
      url.searchParams.set("instrument_key", `in.(${keys.join(",")})`);
      url.searchParams.set("interval", "eq.daily");
      url.searchParams.set("observation_date", `gte.${fetchStartDate}`);
      url.searchParams.append("observation_date", `lte.${endDate}`);
      url.searchParams.set("order", "observation_date.asc");
    }
  );

  return keys.reduce((accumulator, key) => {
    accumulator[key] = buildSeriesMap(
      rows
        .filter((row) => row.instrument_key === key)
        .map((row) => ({
          observation_date: row.observation_date,
          value_numeric: row.close
        }))
    );
    return accumulator;
  }, {});
}

async function loadEconomicEvents(supabaseUrl, serviceRoleKey, startDate, endDate) {
  const lookbackStart = shiftDateLiteral(startDate, -30);
  return fetchAllRows(
    supabaseUrl,
    serviceRoleKey,
    "historical_economic_events",
    (url) => {
      url.searchParams.set(
        "select",
        "event_name,event_time,event_date,actual_numeric,forecast_numeric,previous_numeric,importance,surprise_direction,currency_signal,vendor_event_id"
      );
      url.searchParams.set("currency", "eq.EUR");
      url.searchParams.set("event_date", `gte.${lookbackStart}`);
      url.searchParams.append("event_date", `lte.${endDate}`);
      url.searchParams.set("order", "event_time.asc");
    }
  );
}

async function loadExistingSnapshotDates(supabaseUrl, serviceRoleKey, startDate, endDate) {
  const rows = await fetchAllRows(
    supabaseUrl,
    serviceRoleKey,
    SNAPSHOT_TABLE,
    (url) => {
      url.searchParams.set("select", "snapshot_date");
      url.searchParams.set("snapshot_date", `gte.${startDate}`);
      url.searchParams.append("snapshot_date", `lte.${endDate}`);
      url.searchParams.set("order", "snapshot_date.asc");
    }
  );

  return new Set(rows.map((row) => row.snapshot_date));
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const startDate = args.start || DEFAULT_START;
  const endDate = args.end || DEFAULT_END;

  assertDateRange(startDate, endDate);

  const supabaseUrl = requireEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const logicDocumentVersion = parseLogicVersion();

  const macroSeries = await loadMacroSeries(supabaseUrl, serviceRoleKey, startDate, endDate);
  const priceSeries = await loadPriceSeries(supabaseUrl, serviceRoleKey, startDate, endDate);
  const eurEvents = await loadEconomicEvents(supabaseUrl, serviceRoleKey, startDate, endDate);
  const existingSnapshotDates = await loadExistingSnapshotDates(supabaseUrl, serviceRoleKey, startDate, endDate);

  const series = {
    ...macroSeries,
    ...priceSeries
  };

  const candidateDates = listCandidateDates(series, startDate, endDate);
  const rows = [];
  let rowsSkipped = 0;
  const missingSeriesSummary = new Set();

  for (const snapshotDate of candidateDates) {
    const row = buildSnapshotRow(snapshotDate, {
      eurEvents,
      logicDocumentVersion,
      series
    });

    const noCoreData = (
      row.raw_us_2y_yield === null &&
      row.raw_de_2y_yield === null &&
      row.raw_vix_level === null &&
      row.raw_gold_price === null &&
      row.raw_nq_price === null
    );

    if (noCoreData) {
      rowsSkipped += 1;
      continue;
    }

    row.missing_raw_series.forEach((key) => missingSeriesSummary.add(key));
    rows.push(row);
  }

  const submitted = await upsertRows(
    supabaseUrl,
    serviceRoleKey,
    SNAPSHOT_TABLE,
    rows,
    ["asset_code", "observation_time"]
  );

  const rowsCreated = rows.filter((row) => !existingSnapshotDates.has(row.snapshot_date)).length;
  const rowsUpdated = rows.length - rowsCreated;

  const summary = {
    rows_created: rowsCreated,
    rows_updated: rowsUpdated,
    rows_skipped: rowsSkipped,
    missing_series: Array.from(missingSeriesSummary).sort(),
    date_range: {
      start: minDate(rows.map((row) => row.snapshot_date)) || startDate,
      end: maxDate(rows.map((row) => row.snapshot_date)) || endDate
    },
    sample_snapshot: rows[0]
      ? {
          snapshot_date: rows[0].snapshot_date,
          de_2y_yield: rows[0].de_2y_yield,
          de_2y_d5_bps: rows[0].de_2y_d5_bps,
          us_de_2y_spread_d5_bps: rows[0].us_de_2y_spread_d5_bps,
          eurusd_price: rows[0].eurusd_price,
          eurusd_d1_pct: rows[0].eurusd_d1_pct,
          ez_composite_pmi: rows[0].ez_composite_pmi,
          ecb_bias: rows[0].ecb_bias,
          warnings: rows[0].warnings
        }
      : null,
    submitted_rows: submitted
  };

  console.log(JSON.stringify(summary, null, 2));
}

module.exports = {
  buildSnapshotRow,
  buildSeriesMap,
  deriveCoverageStatus,
  deriveEquitiesRegime,
  listCandidateDates,
  previousValue,
  run,
  shiftDateLiteral,
  toNumber
};

if (require.main === module) {
  run().catch((error) => {
    console.error("EUR historical snapshot build failed.");
    console.error(error.stack || error.message || String(error));
    process.exit(1);
  });
}
