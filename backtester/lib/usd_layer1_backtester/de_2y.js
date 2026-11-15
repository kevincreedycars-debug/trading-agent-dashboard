"use strict";

/**
 * The German 2-year leg, aligned to the 05:00 Europe/London cutoff (research only, 2026-11-13).
 *
 * The as-of frame the replay reads carries US series only; `german_2y_source_20261113.md` chose the Bundesbank
 * BBSIS daily Svensson 2.0-year spot rate as the second leg, and `acquire_bundesbank_de_2y.js` stages it. This
 * module is the join: for each session date it selects the newest observation that is *strictly older* than the
 * session date, because the daily curve is published in the afternoon (CET) of the observation day and is
 * therefore not knowable at 05:00 London on that same date.
 *
 * Two properties are deliberate:
 *
 * 1. No observation dated D can be read on D. The gate is the date comparison, not a tolerance, so a missing
 *    prior print yields no value rather than a same-day quote the cutoff could not have seen.
 * 2. The observation date travels with the value. `staleness_business_days` is the weekday count from the print
 *    to the session date, so a Monday cutoff reading a Friday print shows 1, and a long holiday shows its age.
 *
 * Nothing here decides a sign or a weight: the differential and its change are inputs, and `rule_wiring.js`
 * owns the frozen vote.
 */

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const OBSERVATIONS_PATH = path.join(REPO_ROOT, "backtester", "tmp", "bundesbank-de-2y-observations.json");
const SUMMARY_PATH = path.join(REPO_ROOT, "data", "research", "usd-session", "de-2y-series-summary.json");
const KEY = "de_2y_yield";
const DAY_MS = 86400000;

/** Read the staged observations, or null when the acquisition has not been run in this checkout. */
function loadObservations(file = OBSERVATIONS_PATH) {
  if (!fs.existsSync(file)) return null;
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  const observations = (parsed.observations || [])
    .filter((entry) => entry && /^\d{4}-\d{2}-\d{2}$/.test(entry.date) && Number.isFinite(entry.value))
    .sort((left, right) => (left.date < right.date ? -1 : left.date > right.date ? 1 : 0));
  if (!observations.length) return null;
  return {
    series_id: parsed.series_id || null,
    units: parsed.units || "percent per annum",
    retrieved_at: parsed.retrieved_at || null,
    source_sha256: parsed.source_sha256 || null,
    observations
  };
}

/** Weekdays from the print date (exclusive) to the session date (inclusive), the frame's own staleness unit. */
function businessDaysBetween(printDate, sessionDate) {
  const from = Date.parse(`${printDate}T00:00:00Z`);
  const to = Date.parse(`${sessionDate}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0;
  let count = 0;
  for (let ms = from + DAY_MS; ms <= to; ms += DAY_MS) {
    const day = new Date(ms).getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

/** Newest observation strictly older than the session date, with its age in business days. */
function observationBefore(observations, sessionDate) {
  let low = 0;
  let high = observations.length - 1;
  let found = null;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (observations[middle].date < sessionDate) {
      found = observations[middle];
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found ? Object.assign({}, found, { staleness_business_days: businessDaysBetween(found.date, sessionDate) }) : null;
}

/**
 * Return a copy of the frame with the German leg joined onto every row.
 *
 * `print_dates` is added beside `staleness_business_days` so the panel can quote the observation date instead
 * of the session date, which is what makes the T-1 alignment inspectable rather than asserted.
 */
function attachToFrame(frame, staged = loadObservations()) {
  if (!frame || !Array.isArray(frame.rows)) throw new Error("attachToFrame needs the parsed as-of frame");
  if (!staged) return Object.assign({}, frame, { de_2y: { staged: false } });
  const rows = frame.rows.map((row) => {
    if (!row || !row.date) return row;
    const observation = observationBefore(staged.observations, row.date);
    const values = Object.assign({}, row.values);
    const staleness = Object.assign({}, row.staleness_business_days);
    const printDates = Object.assign({}, row.print_dates);
    if (observation) {
      values[KEY] = observation.value;
      staleness[KEY] = observation.staleness_business_days;
      printDates[KEY] = observation.date;
    } else {
      delete values[KEY];
      delete staleness[KEY];
    }
    return Object.assign({}, row, { values, staleness_business_days: staleness, print_dates: printDates });
  });
  const joined = rows.filter((row) => Number.isFinite(row.values && row.values[KEY])).length;
  return Object.assign({}, frame, {
    rows,
    de_2y: {
      staged: true,
      key: KEY,
      series_id: staged.series_id,
      units: staged.units,
      retrieved_at: staged.retrieved_at,
      source_sha256: staged.source_sha256,
      observations: staged.observations.length,
      sessions_with_a_value: joined
    }
  });
}

module.exports = {
  KEY,
  OBSERVATIONS_PATH,
  SUMMARY_PATH,
  loadObservations,
  observationBefore,
  businessDaysBetween,
  attachToFrame
};
