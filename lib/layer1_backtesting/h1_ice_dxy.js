/**
 * Build the H1 `ice` evidence file from the DXY.cash tape this project already holds.
 *
 * The question is narrow: for each published morning, is there a 05:00 London price on the session
 * date, and a most recent preceding 05:00 London price inside the amended lookback, both taken from the
 * source's own completed bars? A session that has both becomes one evidence record with two dated
 * operands. A session that lacks either is reported as missing with its reason and is not written at
 * all: nothing is borrowed from a neighbouring hour and nothing is interpolated.
 *
 * The observation instant is the close of the one-hour bar that ENDS at the cutoff. That choice is what
 * makes the input admissible at 05:00: a bar that opens at the cutoff only completes an hour later.
 *
 * Research only. It reads the exported tape and the committed run-v1 artefact; it writes nothing.
 */
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const inputs = require("../../backtester/lib/usd_layer1_backtester/inputs");
const { loadSeries } = require("../../backtester/lib/usd_layer1_backtester/dxy_series");
const { ICE_AMENDMENT, amendContract } = require("./h1_source_amendments");

const RUN_PATH = "data/usd-layer1-backtester/run-v1.json";
const HOUR_MS = 3600000;

/** The vintage every record carries: the export identity of the tape the value came from. */
const VINTAGE =
  `ftmo-dxy-cash-h1 export ${ICE_AMENDMENT.instrument.exported_at} · sha256 ${ICE_AMENDMENT.instrument.sha256}`;

function round(value, places = 6) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 24 * HOUR_MS).toISOString().slice(0, 10);
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/**
 * The close of the bar that ends at `boundaryIso`, or null when no bar covers that hour.
 *
 * Zero tolerance by design: a bar that opens and closes earlier is a stale print, not this boundary's
 * price.
 */
function priceEndingAt(series, boundaryIso) {
  if (!series) return { price: null, bar: null, reason: "series not cached" };
  const boundary = Date.parse(boundaryIso);
  if (!Number.isFinite(boundary)) return { price: null, bar: null, reason: "unparseable boundary" };
  const bar = new Date(boundary - HOUR_MS).toISOString();
  const price = series.closes.get(bar);
  if (!Number.isFinite(price)) return { price: null, bar: null, reason: `no one-hour bar ends at ${boundaryIso}` };
  return { price, bar, close_at_utc: boundaryIso, reason: null };
}

/** The 05:00 London instant of a local calendar date, resolved from the calendar and not a fixed offset. */
function boundaryFor(date) {
  return inputs.sessionEndpoints(date).cutoff_at_utc;
}

function contract() {
  return amendContract("ice", ICE_AMENDMENT.replaces);
}

/**
 * @param {object} options
 * @param {object[]} options.sessions run-v1 sessions: `{ date, cutoff_at_utc, endpoint_at_utc }`
 * @param {object} options.series the tape from `loadSeries`
 * @param {number} [options.maxLookbackDays] the amended cap, from `H1-A01`
 * @returns {{records: object[], report: object}}
 */
function buildIceEvidence({ sessions, series, maxLookbackDays = ICE_AMENDMENT.max_lookback_days }) {
  const declared = contract();
  const records = [];
  const excluded = [];
  const intervals = [];

  for (const session of sessions) {
    const current = priceEndingAt(series, session.cutoff_at_utc);
    if (!Number.isFinite(current.price)) {
      excluded.push({ date: session.date, reason: "no_05:00_bar_on_session_date", detail: current.reason });
      continue;
    }
    let previous = null;
    for (let back = 1; back <= maxLookbackDays; back += 1) {
      const date = addDays(session.date, -back);
      const boundary = boundaryFor(date);
      const candidate = priceEndingAt(series, boundary);
      if (Number.isFinite(candidate.price)) {
        previous = { ...candidate, boundary, date, days_back: back };
        break;
      }
    }
    if (!previous) {
      excluded.push({
        date: session.date,
        reason: "no_previous_05:00_bar",
        detail: `no 05:00 bar in the previous ${maxLookbackDays} calendar days`,
      });
      continue;
    }
    const gapHours = (Date.parse(current.close_at_utc) - Date.parse(previous.boundary)) / HOUR_MS;
    if (!(gapHours > 0) || gapHours > maxLookbackDays * 24) {
      excluded.push({
        date: session.date,
        reason: "lookback_outside_cap",
        detail: `${gapHours} hours between the current and previous eligible 05:00 price`,
      });
      continue;
    }
    intervals.push(gapHours);
    records.push({
      session_date: session.date,
      value: round((current.price / previous.price - 1) * 100, 6),
      observed_at_utc: session.cutoff_at_utc,
      published_at_utc: session.cutoff_at_utc,
      received_at_utc: null,
      vintage: VINTAGE,
      original: true,
      source: declared.source,
      instrument: declared.instrument,
      transform: declared.transform,
      operands: [
        {
          value: previous.price,
          observed_at_utc: previous.boundary,
          published_at_utc: previous.boundary,
          vintage: VINTAGE,
        },
        {
          value: current.price,
          observed_at_utc: session.cutoff_at_utc,
          published_at_utc: session.cutoff_at_utc,
          vintage: VINTAGE,
        },
      ],
      sampling: {
        bar_minutes: 60,
        current_bar: "close of the bar ending at the 05:00 London cutoff",
        previous_bar_date: previous.date,
        lookback_days: previous.days_back,
        gap_hours: gapHours,
        source_kind: ICE_AMENDMENT.instrument.kind,
        official_index: ICE_AMENDMENT.instrument.is_official_cash_dxy,
      },
    });
  }

  const byReason = excluded.reduce((acc, entry) => {
    acc[entry.reason] = (acc[entry.reason] || 0) + 1;
    return acc;
  }, {});
  const histogram = intervals.reduce((acc, hours) => {
    const bucket = `${hours}h`;
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {});

  return {
    records,
    report: {
      sessions: sessions.length,
      records: records.length,
      excluded: excluded.length,
      excluded_by_reason: byReason,
      interval_hours: histogram,
      max_gap_hours: intervals.length ? Math.max(...intervals) : null,
      max_lookback_days: maxLookbackDays,
      first_record: records[0] ? records[0].session_date : null,
      last_record: records.length ? records[records.length - 1].session_date : null,
      observed_equals_published: records.every(
        (record) => Date.parse(record.observed_at_utc) === Date.parse(record.published_at_utc)
      ),
      operands_complete: records.every((record) => record.operands.length === 2),
      vintage: VINTAGE,
      excluded_sample: excluded.slice(0, 10),
    },
  };
}


/** The bundle the importer accepts, plus the provenance it must carry. */
function buildBundle({ root, series = null, maxLookbackDays } = {}) {
  const tapeFile = path.join(root, ICE_AMENDMENT.instrument.series_file);
  if (!fs.existsSync(tapeFile)) {
    throw new Error(
      `the ${ICE_AMENDMENT.instrument.symbol} tape is not present: ${ICE_AMENDMENT.instrument.series_file}`
    );
  }
  const digest = sha256File(tapeFile);
  if (digest !== ICE_AMENDMENT.instrument.sha256) {
    throw new Error(
      `the ${ICE_AMENDMENT.instrument.symbol} tape hashes to ${digest}, the pinned provenance says ${ICE_AMENDMENT.instrument.sha256}`
    );
  }
  const run = JSON.parse(fs.readFileSync(path.join(root, RUN_PATH), "utf8"));
  const tape = series || loadSeries(tapeFile);
  const { records, report } = buildIceEvidence({ sessions: run.sessions, series: tape, maxLookbackDays });
  const declared = contract();
  return {
    schema_version: "h1-evidence-v1",
    input: "ice",
    source: declared.source,
    instrument: declared.instrument,
    transform: declared.transform,
    amendment: {
      id: ICE_AMENDMENT.id,
      version: ICE_AMENDMENT.version,
      decided_on: ICE_AMENDMENT.decided_on,
      preserves: ICE_AMENDMENT.preserves,
      replaces: { ...ICE_AMENDMENT.replaces },
    },
    provenance: {
      ...ICE_AMENDMENT.instrument,
      tape_sha256_verified: digest,
      bars: tape ? tape.bars : 0,
      first_bar_utc: tape ? tape.first : null,
      last_bar_utc: tape ? tape.last : null,
      clock_basis:
        "the value is the close of the one-hour bar that ends at the 05:00 London cutoff; observed and published are " +
        "that same instant, and received_at_utc is null because a retrospective export is not a receipt",
    },
    report,
    records,
  };
}

module.exports = {
  RUN_PATH,
  VINTAGE,
  priceEndingAt,
  boundaryFor,
  buildIceEvidence,
  buildBundle,
};

