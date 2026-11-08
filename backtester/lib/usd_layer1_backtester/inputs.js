"use strict";

/**
 * Snapshot builder for the USD Layer 1 backtester (research only).
 *
 * One snapshot per 05:00 Europe/London cutoff. Every value carries where it came from, the date of the
 * print that produced it and how many business days stale that print was, so the panel can answer
 * "what did we know at 05:00?" instead of "what would a later revision have said?".
 *
 * The macro values come from the aligned as-of frame that `npm run macro-inventory` writes; the gold
 * and NAS100 prices are read from the cached one-hour provider series at the same cutoff. Nothing here
 * reads the network, the warehouse, the dispatcher or a production path.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const { resolveSession } = require("../usd_session_engine_interface");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const FRAME_PATH = path.join(REPO_ROOT, "backtester", "tmp", "usdsession-macro-asof-frame.json");
const INVENTORY_PATH = path.join(REPO_ROOT, "data", "research", "usd-session", "macro-data-inventory.json");
const CACHE_DIR = path.join(REPO_ROOT, "backtester", "tmp");

/** Frame series the models read. */
const FRAME_SERIES = Object.freeze([
  "vix_level",
  "us_2y_yield",
  "us_3m_yield",
  "us_10y_yield",
  "us_5y_real_yield",
  "us_10y_real_yield",
  "us_5y_breakeven",
  "us_10y_breakeven",
  "credit_spread_hy",
  "policy_rate_effr",
  "sofr",
  "sp500_level",
  "nasdaq100_level",
  "wti_spot",
  "eurusd",
  "usdjpy",
  "usdgbp",
  "usdcad",
  "usdchf",
  "usdsek",
  "broad_dollar",
  "afe_dollar"
]);

/** Inputs no cached series in this checkout can supply, with the reason kept in the artefact. */
const ABSENT_INPUTS = Object.freeze([
  Object.freeze({
    key: "us_de_2y_spread",
    needed_by: "current model F3 (US/Germany 2-year rate differential delta)",
    reason:
      "the German 2-year series lives in the warehouse and no 05:00 cache of it exists in this checkout, so " +
      "F3 is scored NEUTRAL with the input named, never guessed"
  }),
  Object.freeze({
    key: "fed_bias",
    needed_by: "current model F8 (Fed bias delta)",
    reason:
      "no historical Fed-bias snapshots exist at the 05:00 cutoff; the warehouse builder leaves the field null " +
      "for every row"
  }),
  Object.freeze({
    key: "latest_us_event",
    needed_by: "current model F7 (US economic surprise direction)",
    reason: "no committed US economic-event history reaches the 05:00 cutoff with surprise scores"
  }),
  Object.freeze({
    key: "official_cash_dxy",
    needed_by: "current model F5 as written, and test 1 outright",
    reason:
      "only FRED DTWEXBGS is cached; it is a lagged broad index, not the ICE cash DXY, so it is used as a " +
      "declared substitute for F5's motor and not at all for test 1"
  })
]);

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function describeFile(file, role) {
  const absolute = path.resolve(file);
  const buffer = fs.readFileSync(absolute);
  return {
    path: path.relative(REPO_ROOT, absolute).replace(/\\/g, "/"),
    role,
    bytes: buffer.length,
    sha256: sha256(buffer)
  };
}

function readFrame(file = FRAME_PATH) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `the 05:00 macro as-of frame is missing at ${path.relative(REPO_ROOT, file)}; rebuild it with ` +
        "`npm run macro-inventory` before running the backtester"
    );
  }
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(parsed.rows) || !parsed.rows.length) throw new Error("the macro as-of frame carries no rows");
  return parsed;
}

/** The inventory is committed evidence; it is read so the artefact can quote the declared as-of rule. */
function readInventory(file = INVENTORY_PATH) {
  if (!fs.existsSync(file)) return null;
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  return {
    generated_at: parsed.generated_at || null,
    window: parsed.window || null,
    cutoff: parsed.cutoff || null,
    provenance: parsed.provenance || null,
    series_count: Array.isArray(parsed.series) ? parsed.series.length : 0,
    asof_frame: parsed.asof_frame || null
  };
}

/**
 * Read a cached one-hour series. The timestamp column is the bar's opening instant in UTC, so the close
 * of the bar opening at the cutoff hour is the price at the cutoff.
 */
function readHourlySeries(file) {
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute)) return null;
  const text = fs.readFileSync(absolute, "utf8");
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length);
  const header = lines[0].split(",").map((name) => name.trim().toLowerCase());
  const timestampIndex = header.indexOf("timestamp");
  const closeIndex = header.indexOf("close");
  if (timestampIndex < 0 || closeIndex < 0) throw new Error(`${absolute} has no timestamp/close columns`);
  const closes = new Map();
  for (const line of lines.slice(1)) {
    const cells = line.split(",");
    const stamp = cells[timestampIndex];
    const close = Number(cells[closeIndex]);
    if (!stamp || !Number.isFinite(close)) continue;
    const ms = Date.parse(stamp);
    if (!Number.isFinite(ms)) continue;
    closes.set(new Date(Math.floor(ms / 3600000) * 3600000).toISOString(), close);
  }
  const stamps = Array.from(closes.keys()).sort();
  return {
    closes,
    first: stamps[0] || null,
    last: stamps[stamps.length - 1] || null,
    bars: stamps.length,
    file: path.relative(REPO_ROOT, absolute).replace(/\\/g, "/")
  };
}

/**
 * Price at the hour beginning at `instantIso`. A bar must open at that hour or within the declared
 * tolerance before it; a wider gap means the market was shut, and the price is reported as missing
 * rather than borrowed from another session.
 */
function priceAtHour(series, instantIso, toleranceMinutes = 60) {
  if (!series) return { price: null, reason: "series not cached" };
  const target = Date.parse(instantIso);
  if (!Number.isFinite(target)) return { price: null, reason: "unparseable instant" };
  for (let offset = 0; offset <= toleranceMinutes; offset += 60) {
    const stamp = new Date(target - offset * 60000).toISOString();
    const price = series.closes.get(stamp);
    if (Number.isFinite(price)) return { price, bar: stamp, lag_minutes: offset };
  }
  return { price: null, reason: `no bar opens within ${toleranceMinutes} minutes of ${instantIso}` };
}

/** Session endpoints for a local calendar date, resolved independently (never by a fixed hour count). */
function sessionEndpoints(dateLocal) {
  const dayMs = Date.parse(`${dateLocal}T00:00:00Z`);
  if (!Number.isFinite(dayMs)) throw new Error(`unparseable session date ${dateLocal}`);
  const session = resolveSession(dayMs);
  return {
    date: dateLocal,
    cutoff_at_utc: session.cutoff_at_utc,
    endpoint_at_utc: session.endpoint_at_utc,
    cutoff_offset_abbrev: session.cutoff_offset_abbrev,
    endpoint_offset_abbrev: session.endpoint_offset_abbrev,
    window_hours: session.window_hours,
    session_starts_weekday: session.session_starts_weekday
  };
}

module.exports = {
  REPO_ROOT,
  FRAME_PATH,
  INVENTORY_PATH,
  CACHE_DIR,
  FRAME_SERIES,
  ABSENT_INPUTS,
  sha256,
  describeFile,
  readFrame,
  readInventory,
  readHourlySeries,
  priceAtHour,
  sessionEndpoints
};
