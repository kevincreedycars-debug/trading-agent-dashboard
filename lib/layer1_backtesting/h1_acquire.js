/**
 * Acquire the H1 evidence inputs from the agency that publishes them.
 *
 * This module is the acquisition half of the H1 evidence contract. It knows, for each of the eight
 * missing inputs, which series the supplied `inputs.json` asks for, where that series can be read from,
 * what the publisher says about *when* it is released, and how to turn the raw response into
 * `h1-evidence-v1` records. It never invents a value: a series that cannot be read stays absent, and a
 * record that cannot be given a publication clock before the cutoff is not written at all.
 *
 * The clock rule is the whole point. A historical reconstruction has no receipt, so `published_at_utc`
 * is reconstructed from the publisher's own stated release time (for example the H.15 release at
 * 16:15 ET on the observation date). Every record carries the rule that produced its clock, the margin
 * in hours between that clock and the 05:00 London cutoff, and `received_at_utc: null`. A reconstructed
 * clock is never described as a receipt, and the margin is published so a late print is visible rather
 * than hidden.
 *
 * Research only. Nothing here reads a production path, and nothing here writes into `data/` unless the
 * caller asks it to.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { MIN_OPERANDS } = require("./h1_evidence");

const RAW_DIR = "data/usd-layer1-backtester/h1-v1/raw";
const RUN_FILE = "data/usd-layer1-backtester/run-v1.json";
const HOUR = 3600000;

/* ------------------------------------------------------------------------------------------------
 * Clock reconstruction
 * --------------------------------------------------------------------------------------------- */

/** Minutes east of UTC for a wall-clock instant in `timeZone`. */
function tzOffsetMinutes(utcMs, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type) => Number(parts.find((part) => part.type === type).value);
  const hour = get("hour") % 24;
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  return Math.round((asUtc - utcMs) / 60000);
}

/**
 * A wall-clock time in a named zone, as UTC milliseconds. Iterating twice settles the daylight-saving
 * offset at the boundary.
 */
function zonedToUtc({ year, month, day, hour = 0, minute = 0 }, timeZone) {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  let guess = naive;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = naive - tzOffsetMinutes(guess, timeZone) * 60000;
    if (next === guess) break;
    guess = next;
  }
  return guess;
}

function partsOf(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || ""));
  if (!match) throw new Error(`not an ISO date: ${dateString}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function iso(ms) {
  return new Date(ms).toISOString();
}

function isoDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** `2024-03-26` at 16:15 New York, whatever UTC offset that day used. */
function etInstant(dateString, hour, minute) {
  return zonedToUtc({ ...partsOf(dateString), hour, minute }, "America/New_York");
}

/**
 * A wall-clock instant on a date in the publisher's own zone. The Bundesbank stamps its daily files in
 * Europe/Berlin, so a clock rule may not assume New York.
 */
function zonedInstant(dateString, hour, minute, timeZone = "America/New_York") {
  return zonedToUtc({ ...partsOf(dateString), hour, minute }, timeZone);
}

/** The first Monday strictly after `dateString`, as `YYYY-MM-DD`. */
function nextMonday(dateString) {
  const { year, month, day } = partsOf(dateString);
  const base = Date.UTC(year, month - 1, day);
  const weekday = new Date(base).getUTCDay();
  const ahead = ((8 - weekday) % 7) || 7;
  return isoDate(base + ahead * 24 * HOUR);
}

/* ------------------------------------------------------------------------------------------------
 * Parsers. Each one returns `[{ date: 'YYYY-MM-DD', value: number }]` and refuses to guess.
 * --------------------------------------------------------------------------------------------- */

/** Cboe `VIX_History.csv`: DATE,OPEN,HIGH,LOW,CLOSE with MM/DD/YYYY dates. */
function parseCboeHistory(text) {
  const rows = String(text).trim().split(/\r?\n/);
  const header = rows.shift().split(",").map((value) => value.trim().toUpperCase());
  const dateAt = header.indexOf("DATE");
  const closeAt = header.indexOf("CLOSE");
  if (dateAt < 0 || closeAt < 0) throw new Error("Cboe history: DATE or CLOSE column is missing");
  const out = [];
  for (const row of rows) {
    const cells = row.split(",");
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((cells[dateAt] || "").trim());
    if (!match) continue;
    const value = Number((cells[closeAt] || "").trim());
    if (!Number.isFinite(value)) continue;
    out.push({ date: `${match[3]}-${match[1]}-${match[2]}`, value });
  }
  return out;
}

/**
 * The Federal Reserve `datadownload` matrix: metadata rows, then a `Time Period` header row, then
 * `YYYY-MM-DD,value,...`. `seriesId` is the unique identifier printed on the header row, so a renamed
 * column cannot silently feed the wrong series. `ND` and empty cells are skipped, never filled.
 */
function parseFedMatrix(text, seriesId) {
  const rows = String(text).trim().split(/\r?\n/);
  const headerAt = rows.findIndex((row) => /^"?Time Period"?/i.test(row));
  if (headerAt < 0) throw new Error("Fed matrix: no Time Period header row");
  const header = rows[headerAt].split(",").map((value) => value.replace(/"/g, "").trim());
  const column = header.indexOf(seriesId);
  if (column < 0) throw new Error(`Fed matrix: series ${seriesId} is not in the header (${header.join(", ")})`);
  const out = [];
  for (const row of rows.slice(headerAt + 1)) {
    const cells = row.split(",");
    const date = (cells[0] || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const raw = (cells[column] || "").trim();
    if (!raw || raw.toUpperCase() === "ND") continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    out.push({ date, value });
  }
  return out;
}

/** A U.S. Treasury daily rate CSV: `Date,"1 Mo",...,"10 YR",...` with MM/DD/YYYY dates. */
function parseTreasuryCsv(text, columnName) {
  const rows = String(text).trim().split(/\r?\n/);
  const header = rows.shift().split(",").map((value) => value.replace(/"/g, "").trim());
  const wanted = String(columnName).toUpperCase();
  const column = header.findIndex((value) => value.toUpperCase() === wanted);
  if (column < 0) throw new Error(`Treasury CSV: column ${columnName} is missing (${header.join(", ")})`);
  const out = [];
  for (const row of rows) {
    const cells = row.split(",");
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((cells[0] || "").trim());
    if (!match) continue;
    const value = Number((cells[column] || "").trim());
    if (!Number.isFinite(value)) continue;
    out.push({ date: `${match[3]}-${match[1]}-${match[2]}`, value });
  }
  return out;
}

/**
 * The Bundesbank BBSIS CSV: a short metadata block (including a `last update` stamp in the publisher's own
 * zone), then `date,value,flags` rows with `.` for a day the curve was not produced. Only finite values are
 * returned; a holiday row is skipped, never filled.
 */
function parseBundesbankCsv(text) {
  const rows = String(text).trim().split(/\r?\n/);
  const out = [];
  let lastUpdate = null;
  for (const row of rows) {
    const cells = row.split(",").map((cell) => cell.replace(/^"|"$/g, "").trim());
    if (cells[0] === "last update" && cells[1]) lastUpdate = cells[1];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cells[0])) continue;
    const value = Number(cells[1]);
    if (!Number.isFinite(value)) continue;
    out.push({ date: cells[0], value });
  }
  if (!out.length) throw new Error("Bundesbank CSV: no dated values");
  return { observations: out, lastUpdate };
}

/** Nasdaq's quote API for QQQ: `data.tradesTable.rows[].{date,close}` with MM/DD/YYYY dates. */
function parseNasdaqHistory(text) {
  const payload = JSON.parse(text);
  const rows = payload && payload.data && payload.data.tradesTable && payload.data.tradesTable.rows;
  if (!Array.isArray(rows)) throw new Error("Nasdaq history: tradesTable.rows is missing");
  const out = [];
  for (const row of rows) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(row.date || "").trim());
    if (!match) continue;
    const value = Number(String(row.close || "").replace(/[$,]/g, "").trim());
    if (!Number.isFinite(value)) continue;
    out.push({ date: `${match[3]}-${match[1]}-${match[2]}`, value });
  }
  return out;
}

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * One H.10 weekly release page. The page carries the release date and a five-column table of daily
 * values; the `1) BROAD` row is the nominal broad dollar index (Jan 2006 = 100), which is the series
 * the supplied contract calls DTWEXBGS. The first published value is the one that was in hand, so a
 * later revision can never leak backwards.
 */
function parseH10Weekly(text) {
  const release = /Release Date:\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/.exec(String(text));
  if (!release) throw new Error("H.10 page: no release date");
  const month = MONTHS[release[1].slice(0, 3).toLowerCase()];
  if (!month) throw new Error(`H.10 page: unknown month ${release[1]}`);
  const releaseDate = `${release[3]}-${String(month).padStart(2, "0")}-${release[2].padStart(2, "0")}`;
  const releaseYear = Number(releaseDate.slice(0, 4));
  const columns = [...String(text).matchAll(/<th id="a([3-7])">\s*([A-Za-z]+)\.?\s*(\d{1,2})\s*<\/th>/g)];
  if (columns.length !== 5) throw new Error(`H.10 page ${releaseDate}: ${columns.length} date columns, 5 expected`);
  const row = /<th[^>]*>\s*1\)\s*BROAD\s*<\/th>((?:\s*<td[^>]*>[^<]*<\/td>){6})/i.exec(String(text));
  if (!row) throw new Error(`H.10 page ${releaseDate}: no BROAD row`);
  const cells = [...row[1].matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((cell) => cell[1].trim());
  const values = cells.slice(1);
  const out = [];
  columns.forEach((column, index) => {
    const columnMonth = MONTHS[column[2].slice(0, 3).toLowerCase()];
    const day = Number(column[3]);
    if (!columnMonth || !day) return;
    const year = columnMonth - month > 6 ? releaseYear - 1 : releaseYear;
    const value = Number(values[index]);
    if (!Number.isFinite(value)) return;
    out.push({ date: `${year}-${String(columnMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`, value });
  });
  return { release_date: releaseDate, observations: out };
}

/* ------------------------------------------------------------------------------------------------
 * The eight inputs that were missing, and what happened to each of them
 * --------------------------------------------------------------------------------------------- */

const CLOCK_POLICY = Object.freeze({
  basis: "publisher_stated_release_time",
  rule:
    "A historical record has no receipt. Its publication clock is reconstructed as the publisher's stated release " +
    "time on the stated release day, converted to UTC in the publisher's own time zone. The observed clock is the " +
    "instant the value is determined, which is never later than the reconstructed publication clock. Both clocks, " +
    "the rule id and the margin in hours to the 05:00 London cutoff are written onto every record.",
  receipt: "received_at_utc is null on every historical record. A reconstructed clock is not a receipt.",
  late_print:
    "The reconstruction assumes the stated release time was met. It cannot exclude a late print, which is why the " +
    "margin is published and late-print rejection stays an untested gate.",
});

const SOURCES = Object.freeze({
  vix: {
    input: "vix",
    required: "Cboe VIX spot close, index points, latest completed close",
    reachable: true,
    series: "Cboe VIX_History.csv (official daily OHLC)",
    fetch: [{ url: "https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv", file: "vix-history.csv" }],
    transform: "level",
    clock: {
      id: "cboe_eod_close",
      statement: "Cboe publishes the daily VIX close after the US cash close, usually 16:15 ET.",
      observed: [16, 15],
      published: [16, 15],
    },
    availabilityEvidence:
      "The daily history file carries every Cboe close from 1990; the 2026-11-20 fetch returned 475,063 bytes.",
  },
  front: {
    input: "front",
    required: "Federal Reserve H.15, DGS2, five completed observation intervals in bp",
    reachable: true,
    series: "H.15 datadownload matrix, series RIFLGFCY02_N.B (2-year constant maturity)",
    fetch: [
      {
        url:
          "https://www.federalreserve.gov/datadownload/Output.aspx?rel=H15&series=bf17364827e38702b42a58cf8eaa3f78" +
          "&lastobs=&from=01/01/{year}&to=12/31/{year}&filetype=csv&label=include&layout=seriescolumn",
        file: "h15-matrix-{year}.csv",
        perYear: [2023, 2024, 2025, 2026],
      },
    ],
    seriesId: "RIFLGFCY02_N.B",
    transform: "change_bp",
    clock: {
      id: "h15_same_day",
      statement: "The Federal Reserve publishes H.15 at 16:15 ET on the release day.",
      observed: [16, 0],
      published: [16, 15],
    },
    availabilityEvidence:
      "The H.15 daily matrix is served as one CSV per date range; the 2026-11-20 fetch returned every business day " +
      "from 2024-01-01 with the 2-year column present and no real-yield column at all.",
  },
  real: {
    input: "real",
    required: "10-year real yield (DFII10), five completed observation intervals in bp",
    reachable: true,
    series: "Treasury Daily Treasury Real Yield Curve Rates, 10 YR column",
    amendment: "H1-A02",
    fetch: [
      {
        url:
          "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/" +
          "{year}/all?type=daily_treasury_real_yield_curve&field_tdr_date_value={year}&page&_format=csv",
        file: "treasury-real-yield-{year}.csv",
        perYear: [2023, 2024, 2025, 2026],
      },
    ],
    column: "10 Yr",
    transform: "change_bp",
    clock: {
      id: "treasury_eod_close",
      statement:
        "The Treasury publishes the daily real yield curve after the 15:30 ET nominal curve; 16:15 ET is used as " +
        "the reconstructed clock, which is the later of the two and matches the H.15 release time.",
      observed: [16, 0],
      published: [16, 15],
    },
    availabilityEvidence:
      "Yearly CSVs are served by the Treasury for every year in the run window; the 2026-11-20 fetch returned the " +
      "10 YR column for 2024. H.15 itself publishes no real yield at all, which is what H1-A02 records.",
  },
  broad: {
    input: "broad",
    required: "Federal Reserve H.10, DTWEXBGS, five observation intervals, simple return in percent",
    reachable: true,
    series: "H.10 weekly release pages, memo row 1) BROAD (Jan 2006 = 100)",
    fetch: [{ url: "https://www.federalreserve.gov/releases/h10/{yyyymmdd}/", file: "h10-{yyyymmdd}.html", weekly: true }],
    transform: "return_pct",
    clock: {
      id: "h10_weekly_release",
      statement: "The Federal Reserve publishes H.10 on Monday at 16:15 ET, covering the previous business week.",
      observed: [16, 0],
      published: [16, 15],
    },
    availabilityEvidence:
      "Each weekly release page is served at its own dated URL and carries the release date plus five daily values; " +
      "reading the page published in the week that followed an observation keeps the first published value.",
  },
  qqq: {
    input: "qqq",
    required: "Nasdaq official QQQ close, five completed close intervals, split-adjusted, simple return in percent",
    reachable: true,
    series: "Nasdaq quote API historical table for QQQ",
    fetch: [
      {
        url: "https://api.nasdaq.com/api/quote/QQQ/historical?assetclass=etf&fromdate=2023-12-01&todate=2026-11-20&limit=9999",
        file: "nasdaq-qqq-history.json",
      },
    ],
    transform: "return_pct",
    clock: {
      id: "nasdaq_official_close",
      statement: "Nasdaq publishes the official QQQ closing price after the 16:00 ET close; 16:15 ET is used.",
      observed: [16, 0],
      published: [16, 15],
    },
    availabilityEvidence:
      "The Nasdaq table returned 725 rows for the requested window on 2026-11-20, each with an official close.",
  },
  gold: {
    input: "gold",
    required: "LBMA Gold Price PM USD, five completed fixings, simple return in percent",
    reachable: false,
    series: "LBMA Gold Price PM auction, USD",
    fetch: [{ url: "https://prices.lbma.org.uk/json/gold_pm.json", file: "lbma-gold-pm.json" }],
    transform: "return_pct",
    blocked: {
      code: "http_403",
      evidence:
        "Every request on 2026-11-20 returned 403 with a 4,546-byte block page: http and https, with and without a " +
        "browser user agent, with and without a referer, HTTP/2 and HTTP/1.1. A re-check at 13:01 UTC the same day " +
        "returned 403 again. The host sits behind a bot filter this " +
        "environment cannot pass. The HTML site itself answers (279,547 bytes on the 2026-11-20 fetch), so the block " +
        "is on the price host, not on the documentation.",
      clock_evidence:
        "LBMA states, on `About LBMA Daily Auction Prices`, that the gold auction is set twice daily at 10:30 and " +
        "15:00 London and that 'we publish prices with a delay to midnight London time on the day they are set'. " +
        "That is a citable publication bound: the 15:00 PM price is available by 00:00 London on the following day, " +
        "which is 5 hours after a 05:00 London cutoff. It is a bound, not a receipt, and it does not unlock the data.",
      next_action:
        "Access decision required (paid, licensed): the LBMA prices page read on 2026-11-20 states that the historical " +
        "tabulated data has moved to the MyLBMA Portal and that 'A licence from IBA is required in order to obtain, use " +
        "or redistribute real-time or historical benchmark data', with 'Not got a licence? Visit ICE to see your options " +
        "to purchase one.'. No free registered download is offered, so this is a purchase decision that cannot be " +
        "completed from this environment, and the earlier note that the history was free to registered users was wrong. " +
        "Either (a) the owner buys an IBA licence for the LBMA Gold Price PM history, downloads it from MyLBMA and " +
        "imports it, or (b) `gold` stays absent and blocks every morning. Do not substitute OANDA XAU/USD, which is what " +
        "the legacy panel used and what the identity rung refuses.",
    },
  },
  spread: {
    input: "spread",
    required: "H.15 DGS2 minus Bundesbank Svensson 2.0-year zero-coupon spot, five common intervals in bp",
    reachable: true,
    series: "H.15 RIFLGFCY02_N.B and Bundesbank BBSIS 2.0-year Svensson spot",
    fetch: [
      {
        url:
          "https://www.federalreserve.gov/datadownload/Output.aspx?rel=H15&series=bf17364827e38702b42a58cf8eaa3f78" +
          "&lastobs=&from=01/01/{year}&to=12/31/{year}&filetype=csv&label=include&layout=seriescolumn",
        file: "h15-matrix-{year}.csv",
        perYear: [2023, 2024, 2025, 2026],
      },
      {
        url:
          "https://api.statistiken.bundesbank.de/rest/download/BBSIS/" +
          "D.I.ZST.ZI.EUR.S1311.B.A604.R02XX.R.A.A._Z._Z.A?format=csv&lang=en",
        file: "bundesbank-bbsis-2y.csv",
      },
    ],
    transform: "change_bp",
    common: true,
    clock: {
      id: "bundesbank_end_of_next_day_bound",
      zone: "Europe/Berlin",
      statement:
        "The Bundesbank serves the daily Svensson curve with its own `last update` stamp: the file fetched on " +
        "2026-11-20 reads `last update,2026-11-19 12:22:17` and already carries the 2026-11-19 value, so the curve " +
        "is refreshed on the observation day itself. That single stamp is not proof of how the file behaved in " +
        "2024, and no Bundesbank release-time statement can be cited, so the reconstruction assumes nothing from it: " +
        "a value dated T is treated as available only at 23:59 Europe/Berlin on T+1. The assumption can never " +
        "outrun a next-morning refresh, it is 35.6 hours later than the only refresh this project has observed, " +
        "and the cost is one day of lag, not a missing session.",
      observed: [23, 0],
      published: [23, 59],
      published_lag_days: 1,
    },
    availabilityEvidence:
      "The BBSIS CSV is served without a key: 233,452 bytes on the 2026-11-20 fetch, 2 decimals, daily rows " +
      "from 1997 with `No value available` on non-business days. Its header carries the publisher's own " +
      "`last update` stamp, which is the only publication evidence the Bundesbank exposes on this endpoint. " +
      "The bound is a bound: a print later than 23:59 Europe/Berlin on the day after the observation is not " +
      "excluded, and only a live receipt could prove one.",
    clockEvidence: {
      kind: "conservative_bound",
      stated_by: "Bundesbank BBSIS CSV header `last update` field, read 2026-11-20",
      observed_update: "2026-11-19 12:22:17 (Europe/Berlin)",
      bound: "23:59 Europe/Berlin on the day after the observation date",
      lag_assumed_days: 1,
      margin_over_observed_update_hours: 35.62,
      receipt: "none - a bound is not a receipt",
    },
  },
  calendar: {
    input: "calendar",
    required:
      "scheduled release count in [cutoff, endpoint) for CPI, Employment Situation, advance GDP, " +
      "Personal Income and Outlays and FOMC decisions",
    reachable: "partial",
    series: "BLS CPI and Employment Situation schedules, BEA schedules, Federal Reserve FOMC calendar",
    fetch: [],
    transform: "count",
    blocked: {
      code: "rule_defect_freshness",
      evidence:
        "The schedule archive is readable (the BLS API, the BLS release archive, the BEA schedule and the Federal " +
        "Reserve FOMC calendar page all answered on 2026-11-20). The audit's 24-hour freshness window is measured " +
        "on the record's observed clock, and a release schedule is published weeks or months before the window it " +
        "describes, so a correct calendar cannot pass `fresh` as written.",
      next_action:
        "Decide the rule in a versioned candidate: freshness for `calendar` is measured on the schedule vintage " +
        "(published at or before the cutoff) instead of on its age, or the input needs a daily-confirmed schedule " +
        "snapshot. This is a rule decision, not a data gap, and it is not taken here.",
    },
  },
});

const TRANSFORMS = {
  level: (values) => values[values.length - 1],
  change_bp: (values) => (values[values.length - 1] - values[0]) * 100,
  return_pct: (values) => (values[values.length - 1] / values[0] - 1) * 100,
};

/* ------------------------------------------------------------------------------------------------
 * Observations and bundles
 * --------------------------------------------------------------------------------------------- */

/**
 * Stamp one parsed value with its determined and published clocks. `release` is the release identifier
 * (the publication day), which is what a reader needs to re-fetch the same number.
 */
function observation({ date, value }, source, release = null) {
  const clock = source.clock;
  const zone = clock.zone || "America/New_York";
  const observed = zonedInstant(date, clock.observed[0], clock.observed[1], zone);
  const releaseDate = release || date;
  const lag = clock.published_lag_days || 0;
  const publishedDate =
    lag > 0 ? new Date(Date.parse(`${releaseDate}T00:00:00Z`) + lag * 86400000).toISOString().slice(0, 10) : releaseDate;
  const published = zonedInstant(publishedDate, clock.published[0], clock.published[1], zone);
  if (published < observed) throw new Error(`${source.input}: ${date} publishes before it is observed`);
  return {
    date,
    value,
    observed_ms: observed,
    published_ms: published,
    release: release || date,
    vintage: `first-publication:${release || date}`,
  };
}

/** Sorted, de-duplicated observations. The first publication of a date wins; a later one never overwrites it. */
function mergeObservations(list) {
  const byDate = new Map();
  for (const item of list) {
    if (!Number.isFinite(item.value)) continue;
    const previous = byDate.get(item.date);
    if (previous && previous.published_ms <= item.published_ms) continue;
    byDate.set(item.date, item);
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Build one evidence bundle for one input.
 *
 * A session gets a record only when the required number of observations had been published before its
 * cutoff. The transform is applied to those observations in date order, never to a filled or bridged
 * series. The publish margin is written on every record so a late print is visible rather than hidden.
 */
function buildBundle({ key, contract, sessions, observations, provenance = {} }) {
  const source = SOURCES[key];
  if (!source) throw new Error(`no acquisition source for ${key}`);
  const needed = MIN_OPERANDS[key];
  const transform = TRANSFORMS[source.transform];
  const sorted = mergeObservations(observations);
  const records = [];
  const blocked = [];
  for (const session of sessions) {
    const cutoff = Date.parse(session.cutoff_at_utc);
    const available = sorted.filter((item) => item.published_ms <= cutoff);
    if (available.length < needed) {
      blocked.push({
        session_date: session.date,
        reason: available.length ? "incomplete_lookback" : "no_observation_before_cutoff",
        available: available.length,
        required: needed,
      });
      continue;
    }
    const window = available.slice(-needed);
    const dates = window.map((item) => item.date);
    if (new Set(dates).size !== dates.length) throw new Error(`${key}: duplicate observation date in ${session.date}`);
    const value = transform(window.map((item) => item.value));
    if (!Number.isFinite(value)) throw new Error(`${key}: ${session.date} produced a non-finite value`);
    const last = window[window.length - 1];
    const marginHours = (cutoff - last.published_ms) / HOUR;
    if (marginHours < 0) throw new Error(`${key}: ${session.date} would use a value published after the cutoff`);
    const newestPublished = available[available.length - 1].published_ms;
    records.push({
      session_date: session.date,
      value,
      observed_at_utc: iso(last.observed_ms),
      published_at_utc: iso(last.published_ms),
      received_at_utc: null,
      vintage: last.vintage,
      original: true,
      clock_rule: source.clock.id,
      // Asserted by construction and re-checked by the freshness rule: the newest release published at or
      // before the cutoff is the one this record carries. A bundle captured from an older snapshot fails here.
      release_is_latest_at_cutoff: newestPublished === last.published_ms,
      publish_margin_hours: Math.round(marginHours * 1000) / 1000,
      interval_hours: Math.round(((last.observed_ms - window[0].observed_ms) / HOUR) * 1000) / 1000,
      operands: window.map((item) => ({
        value: item.value,
        observed_at_utc: iso(item.observed_ms),
        published_at_utc: iso(item.published_ms),
        vintage: item.vintage,
      })),
    });
  }
  const first = sorted[0] || null;
  const lastObservation = sorted[sorted.length - 1] || null;
  const margins = records.map((record) => record.publish_margin_hours);
  return {
    schema_version: "h1-evidence-v1",
    input: key,
    source: contract.source,
    instrument: contract.instrument,
    transform: contract.transform,
    ...(source.amendment ? { amendment: { id: source.amendment } } : {}),
    provenance: {
      acquired_at: new Date().toISOString(),
      series: source.series,
      required: source.required,
      clock_policy: { ...CLOCK_POLICY, rule_id: source.clock.id, statement: source.clock.statement },
      availability_evidence: source.availabilityEvidence,
      observations: sorted.length,
      first_observation: first ? first.date : null,
      last_observation: lastObservation ? lastObservation.date : null,
      ...provenance,
    },
    report: {
      sessions: sessions.length,
      records: records.length,
      blocked: blocked.length,
      blocked_by_reason: blocked.reduce((acc, item) => ({ ...acc, [item.reason]: (acc[item.reason] || 0) + 1 }), {}),
      min_publish_margin_hours: margins.length ? Math.min(...margins) : null,
      max_publish_margin_hours: margins.length ? Math.max(...margins) : null,
      receipts: records.filter((record) => record.received_at_utc).length,
    },
    records,
  };
}

/**
 * The spread's two operands, stamped with their own publisher clocks: H.15 DGS2 at 16:15 ET on the
 * observation day, and the Bundesbank 2.0-year Svensson spot at the conservative end-of-day Berlin bound.
 * Files are told apart by name so the same manifest can carry both.
 */
function spreadSeries(raw) {
  const source = SOURCES.spread;
  const h15Clock = { id: "h15_same_day", zone: "America/New_York", observed: [16, 0], published: [16, 15] };
  const left = [];
  const right = [];
  let lastUpdate = null;
  for (const file of raw) {
    const name = String(file.file || "");
    if (name.startsWith("h15-")) {
      for (const item of parseFedMatrix(file.text, SOURCES.front.seriesId)) left.push(item);
    } else if (name.startsWith("bundesbank-")) {
      const parsed = parseBundesbankCsv(file.text);
      lastUpdate = parsed.lastUpdate || lastUpdate;
      for (const item of parsed.observations) right.push(item);
    }
  }
  if (!left.length) throw new Error("spread: the H.15 DGS2 side is missing");
  if (!right.length) throw new Error("spread: the Bundesbank side is missing");
  return {
    left: left.map((item) => observation(item, { input: "spread", clock: h15Clock })),
    right: right.map((item) => observation(item, source)),
    lastUpdate,
  };
}

/**
 * The declared `spread` transform is a change over five COMMON observation intervals, so the series is
 * built on dates both publishers produced, never on a filled or bridged calendar. A session gets a record
 * only when six common dates had been published by its cutoff; the record's clocks are the later of the
 * two operands' clocks, and the margin to the cutoff is published on every record.
 */
function buildSpreadBundle({ contract, sessions, series, provenance = {} }) {
  const source = SOURCES.spread;
  const left = mergeObservations(series.left);
  const right = mergeObservations(series.right);
  const rightByDate = new Map(right.map((item) => [item.date, item]));
  const needed = MIN_OPERANDS.spread;
  const records = [];
  const blocked = [];
  for (const session of sessions) {
    const cutoff = Date.parse(session.cutoff_at_utc);
    const common = left.filter(
      (item) => item.published_ms <= cutoff && rightByDate.has(item.date) && rightByDate.get(item.date).published_ms <= cutoff
    );
    if (common.length < needed) {
      blocked.push({
        session_date: session.date,
        reason: common.length ? "incomplete_lookback" : "no_common_observation_before_cutoff",
        available: common.length,
        required: needed,
      });
      continue;
    }
    const window = common.slice(-needed);
    const operands = window.map((item) => {
      const other = rightByDate.get(item.date);
      const published = Math.max(item.published_ms, other.published_ms);
      const observed = Math.max(item.observed_ms, other.observed_ms);
      return {
        date: item.date,
        value: item.value - other.value,
        observed_ms: observed,
        published_ms: published,
        vintage: `h15:${item.vintage}|bbk:${other.vintage}`,
      };
    });
    const value = (operands[operands.length - 1].value - operands[0].value) * 100;
    if (!Number.isFinite(value)) throw new Error(`spread: ${session.date} produced a non-finite value`);
    const last = operands[operands.length - 1];
    const marginHours = (cutoff - last.published_ms) / HOUR;
    if (marginHours < 0) throw new Error(`spread: ${session.date} would use a value published after the cutoff`);
    records.push({
      session_date: session.date,
      value,
      observed_at_utc: iso(last.observed_ms),
      published_at_utc: iso(last.published_ms),
      received_at_utc: null,
      vintage: `spread:${window[0].date}..${last.date}`,
      original: true,
      clock_rule: `${source.clock.id}+h15_same_day`,
      clock_kind: "conservative_bound",
      release_is_latest_at_cutoff: true,
      publish_margin_hours: Math.round(marginHours * 1000) / 1000,
      interval_hours: Math.round(((last.observed_ms - operands[0].observed_ms) / HOUR) * 1000) / 1000,
      operands: operands.map((operand) => ({
        value: operand.value,
        observed_at_utc: iso(operand.observed_ms),
        published_at_utc: iso(operand.published_ms),
        vintage: operand.vintage,
      })),
    });
  }
  const margins = records.map((record) => record.publish_margin_hours);
  const leftDates = new Set(left.map((item) => item.date));
  const commonCount = right.filter((item) => leftDates.has(item.date)).length;
  return {
    schema_version: "h1-evidence-v1",
    input: "spread",
    source: contract.source,
    instrument: contract.instrument,
    transform: contract.transform,
    provenance: {
      acquired_at: new Date().toISOString(),
      series: source.series,
      ...provenance,
      observations: Math.max(left.length, right.length),
      common_observations: commonCount,
      first_observation: left[0] ? left[0].date : null,
      last_observation: left[left.length - 1] ? left[left.length - 1].date : null,
      clock_rule: source.clock.id,
      clock_statement: source.clock.statement,
      clock_kind: "conservative_bound",
      clock_evidence: source.clockEvidence,
      bundesbank_last_update: series.lastUpdate,
      transform_note:
        "The spread is differenced on dates both publishers produced and only then changed over five intervals. " +
        "No date is filled, bridged or borrowed from one publisher alone.",
      receipts: 0,
    },
    report: {
      sessions: sessions.length,
      records: records.length,
      blocked: blocked.length,
      min_publish_margin_hours: margins.length ? Math.min(...margins) : null,
      max_publish_margin_hours: margins.length ? Math.max(...margins) : null,
      receipts: 0,
    },
    blocked_sessions: blocked,
    records,
  };
}

function loadSessions({ root, runFile = RUN_FILE } = {}) {
  const file = root ? path.join(root, runFile) : runFile;
  const run = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(run.sessions) || !run.sessions.length) throw new Error(`${runFile} has no sessions`);
  return run.sessions;
}

/** The fetch plan for one input, expanded for the dates it covers. */
function fetchPlan(key, { from = "2023-12-11", to = "2026-11-09" } = {}) {
  const source = SOURCES[key];
  if (!source || !source.fetch) return [];
  const plan = [];
  for (const entry of source.fetch) {
    if (entry.weekly) {
      const start = Date.parse(`${from}T00:00:00Z`);
      const end = Date.parse(`${to}T00:00:00Z`);
      for (let cursor = start; cursor <= end; cursor += 7 * 24 * HOUR) {
        const monday = nextMonday(isoDate(cursor - 7 * 24 * HOUR));
        const stamp = monday.replace(/-/g, "");
        const base = Date.parse(`${monday}T00:00:00Z`);
        plan.push({
          url: entry.url.replace("{yyyymmdd}", stamp),
          altUrls: [1, 2].map((ahead) =>
            entry.url.replace("{yyyymmdd}", isoDate(base + ahead * 24 * HOUR).replace(/-/g, ""))
          ),
          file: entry.file.replace("{yyyymmdd}", stamp),
          release: monday,
        });
      }
    } else if (entry.perYear) {
      for (const year of entry.perYear) {
        plan.push({ url: entry.url.replace(/\{year\}/g, String(year)), file: entry.file.replace("{year}", String(year)) });
      }
    } else {
      plan.push({ url: entry.url, file: entry.file });
    }
  }
  return plan;
}

/** Turn the fetched raw files for one input into stamped observations. */
function observationsFromRaw(key, raw) {
  const source = SOURCES[key];
  const items = [];
  if (key === "vix") {
    for (const { date, value } of parseCboeHistory(raw[0].text)) items.push({ date, value });
  } else if (key === "front") {
    for (const file of raw) {
      for (const { date, value } of parseFedMatrix(file.text, source.seriesId)) items.push({ date, value });
    }
  } else if (key === "real") {
    for (const file of raw) {
      for (const { date, value } of parseTreasuryCsv(file.text, source.column)) items.push({ date, value });
    }
  } else if (key === "qqq") {
    for (const { date, value } of parseNasdaqHistory(raw[0].text)) items.push({ date, value });
  } else if (key === "broad") {
    for (const file of raw) {
      let page;
      try {
        page = parseH10Weekly(file.text);
      } catch (error) {
        continue;
      }
      // The page's own release date is the publication clock. A release that slips to the Tuesday after a
      // holiday is still the first publication of that week's values.
      for (const item of page.observations) items.push({ date: item.date, value: item.value, release: page.release_date });
    }
  } else {
    throw new Error(`no parser for ${key}`);
  }
  return items.map((item) => observation(item, source, item.release || null));
}

module.exports = {
  RAW_DIR,
  RUN_FILE,
  CLOCK_POLICY,
  SOURCES,
  TRANSFORMS,
  tzOffsetMinutes,
  zonedToUtc,
  zonedInstant,
  etInstant,
  nextMonday,
  parseCboeHistory,
  parseFedMatrix,
  parseTreasuryCsv,
  parseBundesbankCsv,
  parseNasdaqHistory,
  parseH10Weekly,
  observation,
  mergeObservations,
  buildBundle,
  spreadSeries,
  buildSpreadBundle,
  loadSessions,
  fetchPlan,
  observationsFromRaw,
};


