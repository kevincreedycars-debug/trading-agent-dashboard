"use strict";

/**
 * Acquisition and caching for the USD 24-hour research dataset.
 *
 * Every download is written once into an ignored cache directory and re-used afterwards, so the
 * numerical experiments never touch the network. Each cache entry records the exact request, the
 * observation count, the missing-value count and a sha256 of the cached bytes, so the dataset
 * manifest can be re-checked later.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { RESEARCH_WINDOW, seriesByKey } = require("./series_catalogue");

const DEFAULT_CACHE_DIR = path.resolve(__dirname, "../../tmp/usd-24h-research-cache");
const REPO_ROOT = path.resolve(__dirname, "../../..");
const USER_AGENT = "trading-agent-dashboard-codex-usd24h-research/1.0";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function toIsoDate(value) {
  return String(value).slice(0, 10);
}

function isBusinessDay(dateLiteral) {
  const day = new Date(`${dateLiteral}T00:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6;
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}: ${text.slice(0, 160)}`);
  }
  return text;
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

function fredUrl(seriesId, start, end) {
  return `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}&cosd=${start}&coed=${end}`;
}

function yahooUrl(symbol, start, end) {
  const period1 = Math.floor(Date.parse(`${start}T00:00:00Z`) / 1000);
  const period2 = Math.floor(Date.parse(`${end}T00:00:00Z`) / 1000) + 86400;
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d`;
}

function bundesbankUrl(seriesKey) {
  // The portal rejects long explicit period windows for this series (HTTP 404), and returns the
  // full daily history without them, so the window is applied locally instead.
  return `https://api.statistiken.bundesbank.de/rest/data/${seriesKey}?format=csv`;
}

function parseFredCsv(text) {
  const observations = [];
  const lines = String(text).trim().split(/\r?\n/);
  for (const line of lines.slice(1)) {
    const [rawDate, rawValue] = line.split(",");
    const dateLiteral = String(rawDate || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateLiteral)) continue;
    const valueText = String(rawValue ?? "").trim();
    const value = valueText === "" || valueText === "." ? null : Number(valueText);
    if (value !== null && !Number.isFinite(value)) continue;
    observations.push({ date: dateLiteral, value });
  }
  return observations;
}

function parseBundesbankCsv(text) {
  const observations = [];
  for (const line of String(text).split(/\r?\n/)) {
    // The response carries a metadata preamble, then one semicolon-separated row per period.
    const match = line.match(/^"?(\d{4}-\d{2}-\d{2})"?;(-?[\d.,]+)?/);
    if (!match) continue;
    const value = match[2] === undefined ? null : Number(String(match[2]).replace(",", "."));
    observations.push({ date: match[1], value: Number.isFinite(value) ? value : null });
  }
  return observations;
}

function parseYahooChart(payload) {
  const result = payload?.chart?.result?.[0];
  if (!result) return [];
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const observations = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const close = Number(closes[index]);
    if (!Number.isFinite(close)) continue;
    observations.push({ date: toIsoDate(new Date(timestamps[index] * 1000).toISOString()), value: close });
  }
  return observations;
}

function parseGoldIntradayCache(filePath) {
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const candles = Array.isArray(payload) ? payload : payload.candles || [];
  const observations = [];
  for (const candle of candles) {
    if (!candle || candle.complete === false) continue;
    const value = Number(candle.mid?.c ?? candle.mid?.o);
    if (!Number.isFinite(value)) continue;
    observations.push({
      date: toIsoDate(new Date(candle.time).toISOString()),
      time: new Date(candle.time).toISOString(),
      value
    });
  }
  return observations;
}

function summarize(observations) {
  const dates = observations.map((entry) => entry.date).sort();
  return {
    observation_count: observations.length,
    missing_values: observations.filter((entry) => entry.value === null).length,
    first_date: dates.length ? dates[0] : null,
    last_date: dates.length ? dates[dates.length - 1] : null
  };
}

async function download(entry, window) {
  if (entry.provider === "fred") {
    const url = fredUrl(entry.provider_series, window.warmup_start, window.end);
    return { url, observations: parseFredCsv(await fetchText(url)) };
  }
  if (entry.provider === "yahoo") {
    const url = yahooUrl(entry.provider_series, window.warmup_start, window.end);
    return { url, observations: parseYahooChart(await fetchJson(url)) };
  }
  if (entry.provider === "bundesbank") {
    const url = bundesbankUrl(entry.provider_series);
    const observations = parseBundesbankCsv(await fetchText(url))
      .filter((observation) => observation.date >= window.warmup_start && observation.date <= window.end);
    return { url, observations };
  }
  if (entry.provider === "local_cache") {
    const filePath = path.resolve(REPO_ROOT, entry.provider_series);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Local cache missing for ${entry.key}: ${filePath}`);
    }
    const observations = parseGoldIntradayCache(filePath)
      .filter((observation) => observation.date >= window.warmup_start && observation.date <= window.end);
    return { url: `local:${entry.provider_series}`, observations };
  }
  throw new Error(`Unsupported provider: ${entry.provider}`);
}

function cachePathFor(cacheDir, entry) {
  return path.join(cacheDir, `${entry.key}.json`);
}

/**
 * Download one catalogue entry unless it is already cached, and return the cache record.
 * `options.refresh` forces a re-download.
 */
async function acquireSeries(key, options = {}) {
  const cacheDir = ensureDir(options.cacheDir || DEFAULT_CACHE_DIR);
  const window = options.window || RESEARCH_WINDOW;
  const entry = seriesByKey(key);
  const target = cachePathFor(cacheDir, entry);

  if (!options.refresh && fs.existsSync(target)) {
    const cached = JSON.parse(fs.readFileSync(target, "utf8"));
    return { ...cached, ...summarize(cached.observations), cache_path: target, from_cache: true };
  }

  const { url, observations } = await download(entry, window);
  const record = {
    key: entry.key,
    provider: entry.provider,
    provider_series: entry.provider_series,
    frequency: entry.frequency,
    units: entry.units,
    availability_lag_business_days: entry.availability_lag_business_days,
    request_url: url,
    acquired_at: new Date().toISOString(),
    observations
  };
  const body = `${JSON.stringify(record, null, 2)}\n`;
  fs.writeFileSync(target, body, "utf8");
  return {
    ...record,
    ...summarize(observations),
    cache_sha256: sha256(body),
    cache_path: target,
    from_cache: false
  };
}

async function acquireAll(keys, options = {}) {
  const records = [];
  for (const key of keys) {
    records.push(await acquireSeries(key, options));
  }
  return records;
}

/** Loads a previously acquired series from cache; throws rather than downloading. */
function loadCachedSeries(key, options = {}) {
  const cacheDir = options.cacheDir || DEFAULT_CACHE_DIR;
  const entry = seriesByKey(key);
  const target = cachePathFor(cacheDir, entry);
  if (!fs.existsSync(target)) {
    throw new Error(`Series "${key}" is not cached at ${target}. Run the acquisition step first.`);
  }
  const payload = JSON.parse(fs.readFileSync(target, "utf8"));
  return {
    entry,
    observations: payload.observations
      .filter((observation) => observation.value !== null)
      .slice()
      .sort((left, right) => (left.date < right.date ? -1 : left.date > right.date ? 1 : 0))
  };
}

module.exports = {
  DEFAULT_CACHE_DIR,
  acquireAll,
  acquireSeries,
  cachePathFor,
  ensureDir,
  fredUrl,
  isBusinessDay,
  loadCachedSeries,
  parseBundesbankCsv,
  parseFredCsv,
  parseGoldIntradayCache,
  parseYahooChart,
  sha256,
  summarize
};
