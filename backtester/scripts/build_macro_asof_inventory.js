#!/usr/bin/env node
"use strict";

/**
 * Target-independent macro data inventory, acquisition and as-of-cutoff feature preparation.
 *
 * Usage:
 *   node backtester/scripts/build_macro_asof_inventory.js [--refresh] [--offline] [--cache-dir=PATH]
 *
 * What it produces:
 *   - data/research/usd-session/macro-data-inventory.json     per-series publication timing, revisions,
 *                                                            missingness, staleness and availability
 *   - data/research/usd-session/macro-asof-frame-summary.json  what the as-of frame contains, and its hash
 *   - backtester/tmp/usdsession-macro-asof-frame.json          the frame itself (ignored, local evidence)
 *
 * What it deliberately does NOT do: no sign, no threshold, no rule, no candidate, no scored forecast. The
 * frame is an alignment of published values to the 05:00 Europe/London cutoff and nothing more.
 *
 * Raw responses stay in the ignored `backtester/tmp/usdsession-macro-cache/` directory, following the
 * acquisition convention of backtester/lib/usd24h/acquire.js, whose FRED parser and hashing are reused.
 */

const fs = require("node:fs");
const path = require("node:path");

const { ensureDir, fredUrl, parseFredCsv, sha256, summarize } = require("../lib/usd24h/acquire");
const { MACRO_SERIES, MACRO_WINDOW } = require("../lib/usdsession/macro_series");
const { instantForLocalTime, resolveSession } = require("../lib/usd_session_engine_interface");
const { parseArgs } = require("../lib/historical_common");

const REPO_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_CACHE_DIR = path.join(REPO_ROOT, "backtester", "tmp", "usdsession-macro-cache");
const INVENTORY_PATH = path.join(REPO_ROOT, "data", "research", "usd-session", "macro-data-inventory.json");
const FRAME_SUMMARY_PATH = path.join(REPO_ROOT, "data", "research", "usd-session", "macro-asof-frame-summary.json");
const FRAME_PATH = path.join(REPO_ROOT, "backtester", "tmp", "usdsession-macro-asof-frame.json");
const USER_AGENT = "trading-agent-dashboard-codex-usd-session-macro/1.0";

// Which of these series the live collector actually reaches today, extracted from
// docs/research/usd-session/v1/inventory.md section 2. This is what makes the live-versus-historical
// distinction concrete rather than decorative.
const LIVE_COLLECTOR_PATHS = Object.freeze({
  us_2y_yield: true,
  us_10y_yield: true,
  us_10y_real_yield: true,
  vix_level: true,
  broad_dollar: true
});

const DAY_MS = 86400000;

function dayStamp(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function utcMidnight(dateLiteral) {
  return Date.parse(`${dateLiteral}T00:00:00Z`);
}

function isWeekend(dateMs) {
  const day = new Date(dateMs).getUTCDay();
  return day === 0 || day === 6;
}

function shiftBusinessDays(dateLiteral, days) {
  let ms = utcMidnight(dateLiteral);
  let remaining = Math.abs(days);
  const step = days >= 0 ? 1 : -1;
  while (remaining > 0) {
    ms += step * DAY_MS;
    if (!isWeekend(ms)) remaining -= 1;
  }
  return dayStamp(ms);
}

function businessDaysBetween(fromLiteral, toLiteral) {
  if (!fromLiteral || !toLiteral) return null;
  let ms = utcMidnight(fromLiteral);
  const end = utcMidnight(toLiteral);
  if (end <= ms) return 0;
  let count = 0;
  while (ms < end) {
    ms += DAY_MS;
    if (!isWeekend(ms)) count += 1;
  }
  return count;
}

function businessDaysInWindow(startLiteral, endLiteral) {
  const days = [];
  for (let ms = utcMidnight(startLiteral); ms <= utcMidnight(endLiteral); ms += DAY_MS) {
    if (!isWeekend(ms)) days.push(dayStamp(ms));
  }
  return days;
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}: ${text.slice(0, 140)}`);
  return text;
}

function cachePathFor(cacheDir, entry) {
  return path.join(cacheDir, `${entry.key}.json`);
}

async function acquireMacroSeries(entry, options) {
  const cacheDir = ensureDir(options.cacheDir);
  const target = cachePathFor(cacheDir, entry);
  const url = fredUrl(entry.provider_series, MACRO_WINDOW.warmup_start, MACRO_WINDOW.end);
  if (!options.refresh && fs.existsSync(target)) {
    const cached = JSON.parse(fs.readFileSync(target, "utf8"));
    return { ...cached, cache_path: target, from_cache: true };
  }
  if (options.offline) {
    return { key: entry.key, unavailable_reason: `no cache at ${target} and --offline was passed`, request_url: url, cache_path: target, from_cache: false, observations: [] };
  }
  try {
    const observations = parseFredCsv(await fetchText(url));
    const record = {
      key: entry.key,
      provider: entry.provider,
      provider_series: entry.provider_series,
      request_url: url,
      acquired_at: new Date().toISOString(),
      observations
    };
    const body = `${JSON.stringify(record, null, 2)}\n`;
    fs.writeFileSync(target, body, "utf8");
    return { ...record, cache_sha256: sha256(body), cache_path: target, from_cache: false };
  } catch (error) {
    return { key: entry.key, unavailable_reason: String(error.message || error), request_url: url, cache_path: target, from_cache: false, observations: [] };
  }
}

function median(values) {
  if (!values.length) return null;
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** The most recent H.10 release instant (Monday 16:15 America/New_York) at or before the cutoff. */
function latestH10Release(cutoffMs) {
  const dayMs = utcMidnight(dayStamp(cutoffMs));
  const weekday = (new Date(dayMs).getUTCDay() + 6) % 7; // 0 = Monday
  let mondayMs = dayMs - weekday * DAY_MS;
  for (let step = 0; step < 8; step += 1) {
    const releaseMs = instantForLocalTime(mondayMs, 16, 15, "America/New_York");
    if (releaseMs <= cutoffMs) {
      return { monday: dayStamp(mondayMs), release_at_utc: new Date(releaseMs).toISOString() };
    }
    mondayMs -= 7 * DAY_MS;
  }
  throw new Error("no H.10 release instant found within eight weeks of the cutoff");
}

/**
 * The newest value published by the cutoff, and how stale it is, for one series on one date. Two
 * alignments only: the verified H.10 weekly one, and a declared business-day lag.
 */
function resolveAsOf(entry, cutoffMs, cutoffLocalDate, lookup) {
  let asOfDate = null;
  let rule = "";
  let releaseAt = null;
  if (entry.publication.alignment === "h10_weekly_monday") {
    const release = latestH10Release(cutoffMs);
    releaseAt = release.release_at_utc;
    asOfDate = dayStamp(utcMidnight(release.monday) - DAY_MS);
    rule = `newest value carried by the H.10 release of ${release.monday} at 16:15 ET, published for the previous business week`;
  } else {
    const lag = Number(entry.publication.declared_lag_business_days ?? 1);
    asOfDate = shiftBusinessDays(cutoffLocalDate, -lag);
    rule = `newest value on or before ${asOfDate}, a declared ${lag}-business-day lag whose publication time was not verified`;
  }
  const found = lookup(asOfDate);
  return {
    value: found ? found.value : null,
    observation_date: found ? found.date : null,
    as_of_date: asOfDate,
    staleness_business_days: found ? businessDaysBetween(found.date, cutoffLocalDate) : null,
    release_at_utc: releaseAt,
    rule
  };
}

function gapsFrom(observations) {
  const dates = observations.map(observation => observation.date).filter(Boolean).sort();
  let largestGapDays = 0;
  let largestGapFrom = null;
  for (let index = 1; index < dates.length; index += 1) {
    const gap = (utcMidnight(dates[index]) - utcMidnight(dates[index - 1])) / DAY_MS;
    if (gap > largestGapDays) {
      largestGapDays = gap;
      largestGapFrom = dates[index - 1];
    }
  }
  return { largest_gap_calendar_days: largestGapDays, largest_gap_from: largestGapFrom };
}

/** Cache lookup: the newest observation at or before the requested date. */
function makeLookup(observations) {
  const rows = observations
    .filter(observation => /^\d{4}-\d{2}-\d{2}$/.test(observation.date))
    .slice()
    .sort((left, right) => (left.date < right.date ? -1 : 1));
  return dateLiteral => {
    let found = null;
    for (const row of rows) {
      if (row.date <= dateLiteral) found = row;
      else break;
    }
    return found;
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const options = {
    cacheDir: args["cache-dir"] ? path.resolve(args["cache-dir"]) : DEFAULT_CACHE_DIR,
    refresh: args.refresh === "true",
    offline: args.offline === "true"
  };

  const acquired = [];
  const unavailable = [];
  const lookups = new Map();
  for (const entry of MACRO_SERIES) {
    const record = await acquireMacroSeries(entry, options);
    if (!record.observations.length) {
      unavailable.push({ key: entry.key, provider_series: entry.provider_series, reason: record.unavailable_reason || "no observations returned" });
      continue;
    }
    lookups.set(entry.key, makeLookup(record.observations));
    acquired.push({ entry, record });
  }

  const days = businessDaysInWindow(MACRO_WINDOW.start, MACRO_WINDOW.end);
  const frameRows = [];
  const stalenessByKey = new Map(acquired.map(({ entry }) => [entry.key, []]));

  for (const dateLiteral of days) {
    const session = resolveSession(utcMidnight(dateLiteral));
    const cutoffMs = Date.parse(session.cutoff_at_utc);
    const values = {};
    const staleness = {};
    for (const { entry } of acquired) {
      const resolved = resolveAsOf(entry, cutoffMs, dateLiteral, lookups.get(entry.key));
      values[entry.key] = resolved.value;
      staleness[entry.key] = resolved.staleness_business_days;
      if (resolved.staleness_business_days !== null) stalenessByKey.get(entry.key).push(resolved.staleness_business_days);
    }
    frameRows.push({
      date: dateLiteral,
      cutoff_at_utc: session.cutoff_at_utc,
      cutoff_offset: session.cutoff_offset_abbrev,
      window_hours: session.window_hours,
      values,
      staleness_business_days: staleness
    });
  }

  const lastCutoffMs = Date.parse(resolveSession(utcMidnight(MACRO_WINDOW.end)).cutoff_at_utc);
  const asOfRules = new Map(acquired.map(({ entry }) => [
    entry.key,
    resolveAsOf(entry, lastCutoffMs, MACRO_WINDOW.end, lookups.get(entry.key)).rule
  ]));
  const stalenessSummary = {};
  for (const { entry } of acquired) {
    const values = stalenessByKey.get(entry.key);
    stalenessSummary[entry.key] = {
      min: values.length ? Math.min(...values) : null,
      median: median(values),
      max: values.length ? Math.max(...values) : null,
      histogram: values.reduce((accumulator, value) => {
        accumulator[value] = (accumulator[value] || 0) + 1;
        return accumulator;
      }, {})
    };
  }

  const frame = {
    schema_version: "usd-session-macro-asof-frame-v1",
    generated_at: new Date().toISOString(),
    window: MACRO_WINDOW,
    cutoff: { local: "05:00", zone: "Europe/London" },
    note: "One row per London business day. Every value is the newest value published by that row's cutoff, chosen by the series' own publication rule. No sign, threshold or rule is applied anywhere in this file.",
    columns: acquired.map(({ entry }) => entry.key),
    rows: frameRows
  };
  const frameBody = `${JSON.stringify(frame, null, 2)}\n`;
  ensureDir(path.dirname(FRAME_PATH));
  fs.writeFileSync(FRAME_PATH, frameBody, "utf8");
  const frameSha = sha256(frameBody);

  const perColumnMissing = {};
  for (const { entry } of acquired) {
    perColumnMissing[entry.key] = frameRows.filter(row => row.values[entry.key] === null).length;
  }
  // INVENTORY_ANCHOR
  const inventory = {
    schema_version: "usd-session-macro-data-inventory-v1",
    generated_at: frame.generated_at,
    window: MACRO_WINDOW,
    cutoff: { local: "05:00", zone: "Europe/London", rule: "every value must have been published by the cutoff instant; a later revision may not be used as if it were the first print" },
    provenance: {
      provider: "Federal Reserve Economic Data (FRED), redistributing Federal Reserve, CBOE, ICE BofA and exchange closes",
      key_required: false,
      acquisition: "GET https://fred.stlouisfed.org/graph/fredgraph.csv for the declared window, parsed by parseFredCsv in backtester/lib/usd24h/acquire.js",
      cache_dir: path.relative(REPO_ROOT, options.cacheDir).replace(/\\/g, "/"),
      vintages: "latest-published values only. No vintage or first-print series is used, so a revised value is what is measured; the ALFRED vintage CSV needs a key and was not used."
    },
    series: acquired.map(({ entry, record }) => {
      const stats = summarize(record.observations);
      const expectedBusinessDays = businessDaysBetween(stats.first_date, stats.last_date);
      return {
        key: entry.key,
        group: entry.group,
        role: entry.role,
        provider: entry.provider,
        provider_series: entry.provider_series,
        frequency: entry.frequency,
        units: entry.units,
        publication: entry.publication,
        revision_note: entry.revision_note,
        revision_verified: entry.revision_verified,
        live_collector_path: LIVE_COLLECTOR_PATHS[entry.key] === true,
        availability: {
          as_of_rule: asOfRules.get(entry.key),
          staleness_business_days: {
            min: stalenessSummary[entry.key].min,
            median: stalenessSummary[entry.key].median,
            max: stalenessSummary[entry.key].max
          },
          staleness_histogram: stalenessSummary[entry.key].histogram
        },
        cached: {
          request_url: record.request_url,
          acquired_at: record.acquired_at || null,
          from_cache: record.from_cache === true,
          cache_file: path.relative(REPO_ROOT, record.cache_path).replace(/\\/g, "/"),
          cache_sha256: record.cache_sha256 || null
        },
        missingness: {
          observation_count: stats.observation_count,
          null_values: stats.missing_values,
          missing_in_frame: perColumnMissing[entry.key],
          first_date: stats.first_date,
          last_date: stats.last_date,
          expected_business_days_between_first_and_last: expectedBusinessDays,
          missing_business_days_against_calendar: expectedBusinessDays === null ? null : expectedBusinessDays + 1 - stats.observation_count,
          ...gapsFrom(record.observations)
        },
        note: entry.note
      };
    }),
    unavailable,
    asof_frame: {
      path: path.relative(REPO_ROOT, FRAME_PATH).replace(/\\/g, "/"),
      sha256: frameSha,
      rows: frameRows.length,
      columns: acquired.length,
      start: frameRows.length ? frameRows[0].date : null,
      end: frameRows.length ? frameRows[frameRows.length - 1].date : null,
      missing_cells: Object.values(perColumnMissing).reduce((total, value) => total + value, 0),
      note: "The frame itself is local evidence under backtester/tmp/ and is deliberately not committed: it is an alignment artefact for the later dataset build, not a dataset this programme has frozen."
    }
  };

  ensureDir(path.dirname(INVENTORY_PATH));
  fs.writeFileSync(INVENTORY_PATH, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
  fs.writeFileSync(FRAME_SUMMARY_PATH, `${JSON.stringify({
    schema_version: "usd-session-macro-asof-frame-summary-v1",
    generated_at: inventory.generated_at,
    window: MACRO_WINDOW,
    rows: frameRows.length,
    columns: acquired.length,
    start: inventory.asof_frame.start,
    end: inventory.asof_frame.end,
    per_column_missing: perColumnMissing,
    staleness_business_days: stalenessSummary,
    frame_path: inventory.asof_frame.path,
    frame_sha256: frameSha,
    inventory_path: path.relative(REPO_ROOT, INVENTORY_PATH).replace(/\\/g, "/")
  }, null, 2)}\n`, "utf8");

  for (const item of inventory.series) {
    const lag = item.availability.staleness_business_days;
    process.stdout.write(
      `${item.key.padEnd(20)} ${item.provider_series.padEnd(14)} n=${String(item.missingness.observation_count).padStart(5)} ` +
      `missing=${String(item.missingness.null_values).padStart(4)} ${item.missingness.first_date}..${item.missingness.last_date} ` +
      `staleness bd ${lag.min}/${lag.median}/${lag.max} live=${item.live_collector_path ? "yes" : "no"}\n`
    );
  }
  if (unavailable.length) {
    process.stdout.write(`unavailable: ${unavailable.map(entry => entry.key).join(", ")}\n`);
  }
  process.stdout.write(`frame: ${frameRows.length} rows x ${acquired.length} columns, sha256 ${frameSha.slice(0, 12)} at ${inventory.asof_frame.path}\n`);
  process.stdout.write(`inventory: ${path.relative(REPO_ROOT, INVENTORY_PATH)}\n`);
}

main().catch(error => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
