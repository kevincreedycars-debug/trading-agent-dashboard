#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  assertDateRange,
  parseArgs,
  readOptionalEnv,
  requireEnv
} = require("../../lib/historical_common");

const DEFAULT_BASE_URL = readOptionalEnv("OANDA_API_BASE_URL", "https://api-fxtrade.oanda.com");
const CHUNK_DAYS_BY_GRANULARITY = {
  D: 365,
  H1: 180
};
const NEW_YORK_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hour12: false
});

function toIsoDate(value) {
  return new Date(`${value}T00:00:00Z`).toISOString();
}

function plusDays(value, dayCount) {
  const next = new Date(`${value}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + dayCount);
  return next.toISOString().slice(0, 10);
}

async function fetchJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status} for ${url}\n${body}`);
  }

  return response.json();
}

function parseMidPrice(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function sessionDateFromOandaTimestamp(timestamp) {
  const parsed = new Date(timestamp);
  const parts = Object.fromEntries(NEW_YORK_PARTS.formatToParts(parsed).map((part) => [part.type, part.value]));
  const localDate = `${parts.year}-${parts.month}-${parts.day}`;
  const localHour = Number(parts.hour);

  if (!Number.isFinite(localHour)) {
    return String(timestamp || "").slice(0, 10);
  }

  if (localHour < 17) {
    return localDate;
  }

  const next = new Date(`${localDate}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function normalizeCandle(candle, instrument) {
  const timestamp = String(candle?.time || "").trim();
  return {
    instrument,
    timestamp,
    date: sessionDateFromOandaTimestamp(timestamp),
    open: parseMidPrice(candle?.mid?.o),
    high: parseMidPrice(candle?.mid?.h),
    low: parseMidPrice(candle?.mid?.l),
    close: parseMidPrice(candle?.mid?.c),
    source: "OANDA v20 candles",
    complete: Boolean(candle?.complete)
  };
}

async function listAccounts(baseUrl, token) {
  const payload = await fetchJson(`${baseUrl}/v3/accounts`, token);
  return Array.isArray(payload?.accounts) ? payload.accounts : [];
}

async function listInstruments(baseUrl, accountId, token) {
  const payload = await fetchJson(`${baseUrl}/v3/accounts/${accountId}/instruments`, token);
  return Array.isArray(payload?.instruments) ? payload.instruments : [];
}

async function downloadCandles(baseUrl, instrument, granularity, startDate, endDate, token) {
  const rows = [];
  const chunkDays = CHUNK_DAYS_BY_GRANULARITY[granularity] || 180;

  for (let cursor = startDate; cursor <= endDate; cursor = plusDays(cursor, chunkDays)) {
    const chunkEnd = plusDays(cursor, chunkDays - 1) < endDate ? plusDays(cursor, chunkDays - 1) : endDate;
    const url = new URL(`${baseUrl}/v3/instruments/${instrument}/candles`);
    url.searchParams.set("price", "M");
    url.searchParams.set("granularity", granularity);
    url.searchParams.set("from", toIsoDate(cursor));
    url.searchParams.set("to", toIsoDate(chunkEnd));

    const payload = await fetchJson(url.toString(), token);
    const candles = Array.isArray(payload?.candles) ? payload.candles : [];
    rows.push(...candles.map((candle) => normalizeCandle(candle, instrument)));

    if (chunkEnd >= endDate) break;
  }

  return rows
    .filter((row) =>
      row.date
      && row.timestamp
      && Number.isFinite(row.open)
      && Number.isFinite(row.high)
      && Number.isFinite(row.low)
      && Number.isFinite(row.close)
    )
    .sort((a, b) => `${a.date}|${a.timestamp}`.localeCompare(`${b.date}|${b.timestamp}`));
}

function toCsv(rows) {
  const header = "instrument,timestamp,date,open,high,low,close,source,complete";
  const lines = rows.map((row) => [
    row.instrument,
    row.timestamp,
    row.date,
    row.open,
    row.high,
    row.low,
    row.close,
    row.source,
    row.complete ? "true" : "false"
  ].join(","));
  return `${header}\n${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = requireEnv("OANDA_API_TOKEN");
  const baseUrl = args.base_url || DEFAULT_BASE_URL;

  if (args["list-accounts"] === "true") {
    const accounts = await listAccounts(baseUrl, token);
    console.log(JSON.stringify({
      count: accounts.length,
      accounts: accounts.map((account) => ({
        id: account.id,
        alias: account.alias || null
      }))
    }, null, 2));
    return;
  }

  if (args["list-instruments"] === "true") {
    const accountId = String(args["account-id"] || readOptionalEnv("OANDA_ACCOUNT_ID") || "").trim();
    if (!accountId) {
      throw new Error("Provide --account-id or OANDA_ACCOUNT_ID when using --list-instruments=true");
    }
    const instruments = await listInstruments(baseUrl, accountId, token);
    console.log(JSON.stringify({
      count: instruments.length,
      instruments: instruments.map((item) => item.name)
    }, null, 2));
    return;
  }

  const instrument = String(args.instrument || "").trim();
  const granularity = String(args.granularity || "D").trim().toUpperCase();
  const startDate = String(args.start || "").trim();
  const endDate = String(args.end || "").trim();
  const outPath = String(args.out || "").trim();

  if (!instrument || !startDate || !endDate || !outPath) {
    throw new Error("Usage: --instrument=EUR_USD --granularity=D|H1 --start=2024-01-01 --end=2026-07-04 --out=backtester/tmp/oanda_eur_usd_daily.csv");
  }

  assertDateRange(startDate, endDate);
  const rows = await downloadCandles(baseUrl, instrument, granularity, startDate, endDate, token);
  const resolvedOut = path.resolve(outPath);
  fs.writeFileSync(resolvedOut, toCsv(rows), "utf8");

  console.log(JSON.stringify({
    instrument,
    granularity,
    baseUrl,
    startDate,
    endDate,
    rowCount: rows.length,
    coverageStart: rows[0]?.timestamp || null,
    coverageEnd: rows[rows.length - 1]?.timestamp || null,
    outPath: resolvedOut
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
