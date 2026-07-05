#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { assertDateRange, parseArgs } = require("../../lib/historical_common");

const BINANCE_KLINES_URL = "https://api.binance.com/api/v3/klines";
const INTERVAL_MS = {
  "1d": 24 * 60 * 60 * 1000,
  "1h": 60 * 60 * 1000
};
const PAGE_LIMIT = 1000;

function toMillis(dateValue) {
  return Date.parse(`${dateValue}T00:00:00Z`);
}

function normalizeKline(entry, symbol) {
  const openTime = Number(entry?.[0]);
  const timestamp = Number.isFinite(openTime) ? new Date(openTime).toISOString() : "";
  return {
    instrument: symbol,
    timestamp,
    date: timestamp.slice(0, 10),
    open: Number(entry?.[1]),
    high: Number(entry?.[2]),
    low: Number(entry?.[3]),
    close: Number(entry?.[4]),
    source: "Binance Spot klines",
    complete: true
  };
}

async function fetchKlines(symbol, interval, startTime, endTime) {
  const url = new URL(BINANCE_KLINES_URL);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("startTime", String(startTime));
  url.searchParams.set("endTime", String(endTime));
  url.searchParams.set("limit", String(PAGE_LIMIT));

  const response = await fetch(url.toString());
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status} for ${url}\n${body}`);
  }

  return response.json();
}

async function downloadKlines(symbol, interval, startDate, endDate) {
  const rows = [];
  const stepMs = INTERVAL_MS[interval];
  if (!stepMs) {
    throw new Error(`Unsupported interval: ${interval}`);
  }

  const inclusiveEnd = toMillis(endDate) + (24 * 60 * 60 * 1000) - 1;
  for (let cursor = toMillis(startDate); cursor <= inclusiveEnd;) {
    const page = await fetchKlines(symbol, interval, cursor, inclusiveEnd);
    if (!Array.isArray(page) || !page.length) {
      break;
    }

    rows.push(...page.map((entry) => normalizeKline(entry, symbol)));
    const lastOpenTime = Number(page[page.length - 1]?.[0]);
    if (!Number.isFinite(lastOpenTime)) {
      break;
    }

    const nextCursor = lastOpenTime + stepMs;
    if (nextCursor <= cursor) {
      break;
    }
    cursor = nextCursor;
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
  const symbol = String(args.symbol || "BTCUSDT").trim().toUpperCase();
  const interval = String(args.interval || "1d").trim().toLowerCase();
  const startDate = String(args.start || "").trim();
  const endDate = String(args.end || "").trim();
  const outPath = String(args.out || "").trim();

  if (!startDate || !endDate || !outPath) {
    throw new Error("Usage: --symbol=BTCUSDT --interval=1d|1h --start=2024-01-01 --end=2026-07-04 --out=backtester/tmp/binance_btcusdt_daily.csv");
  }

  assertDateRange(startDate, endDate);
  const rows = await downloadKlines(symbol, interval, startDate, endDate);
  const resolvedOut = path.resolve(outPath);
  fs.writeFileSync(resolvedOut, toCsv(rows), "utf8");

  console.log(JSON.stringify({
    symbol,
    interval,
    endpoint: BINANCE_KLINES_URL,
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
