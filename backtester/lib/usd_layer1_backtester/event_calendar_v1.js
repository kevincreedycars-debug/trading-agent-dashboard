"use strict";

/**
 * The staged event calendar behind the 05:00 London cutoff.
 *
 * Scope, stated before anything is counted: this calendar holds the release instants of the FOMC policy
 * statements already archived in `f8-fomc-statements-v1.json`, and nothing else. Those instants are knowable
 * in advance - the FOMC publishes its meeting calendar a year ahead and each archived statement prints its
 * own release time - so they can answer, for a historical morning, "was a known release due between this
 * cutoff and its endpoint?" without borrowing a later print.
 *
 * The data does not hold, and this module does not pretend to hold, any other release: no CPI, no employment
 * situation, no PCE, no retail sales, no ISM, no GDP, no auctions, no speeches. A morning that comes back
 * `checked_no_event_due` has been checked against FOMC statements only. It is not evidence that nothing else
 * was due, and it must never be read as one.
 *
 * The distinction the fail-safe needs is kept in the status, not in prose:
 *   - `checked_no_event_due`  the calendar was read and no staged release falls inside the window;
 *   - `event_due_in_window`   a staged release falls inside the window, so the outcome is event-contaminated;
 *   - `source_unavailable`    the calendar could not be read at all: a failed check, which caps the call.
 *
 * The label of a statement (hawkish / dovish / neutral) is deliberately absent here. F8 owns the label and the
 * calendar owns the clock, so a calendar read can never smuggle a vote into a decision.
 */

const fs = require("node:fs");
const path = require("node:path");

const f8 = require("./f8_fed_bias");

const CALENDAR_RELATIVE = "data/usd-layer1-backtester/event-calendar-v1.json";
const SCHEMA_VERSION = "usd-l1-event-calendar-v1";
const VERSION = "usd-l1-event-calendar-v1";
const FROZEN_ON = "2026-11-14";
const DEFAULT_ROOT = path.resolve(__dirname, "..", "..", "..");

const REFRESH_RELATIVE = "data/economic-event-refresh.json";
const SOURCE_RELATIVE = "data/economic-events-source.json";

/**
 * The release types the calendar would need to answer the question in full. They are named so the page can say
 * what is missing instead of leaving a reader to assume an empty result means an empty week.
 */
const NOT_STAGED = Object.freeze([
  "CPI",
  "employment situation (non-farm payrolls, unemployment rate)",
  "PCE price index",
  "retail sales",
  "ISM manufacturing and services",
  "GDP",
  "Treasury auctions",
  "Fed speeches and testimony",
  "central-bank decisions outside the FOMC statement"
]);

const STATUS_LABELS = Object.freeze({
  checked_no_event_due: "Checked; no staged release between cutoff and endpoint",
  event_due_in_window: "A staged release falls inside the window",
  source_unavailable: "Calendar could not be read"
});

function sha256(text) {
  return require("node:crypto").createHash("sha256").update(text).digest("hex");
}

function readJson(rootDir, relative) {
  const file = path.join(rootDir, relative);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function calendarPath(rootDir = DEFAULT_ROOT) {
  return path.join(rootDir, CALENDAR_RELATIVE);
}

/** Whole days between two calendar dates, in UTC. */
function calendarDays(fromDate, toDate) {
  const start = Date.parse(`${String(fromDate).slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${String(toDate).slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 86400000);
}

/** One calendar entry from one archived statement: the clock and where the clock came from, nothing else. */
function eventFromStatement(statement) {
  return {
    id: `fomc-statement-${statement.date}`,
    type: "fomc_statement",
    label: "FOMC policy statement",
    region: "US",
    impact: "high",
    date: statement.date,
    released_at_utc: statement.released_at_utc,
    release_time_text: statement.release_time_text || null,
    release_zone: statement.release_zone || null,
    timing_source: statement.url,
    scheduled_in_advance: true
  };
}

/**
 * The forward-looking collector's last state.
 *
 * A refresh that failed and a refresh that found nothing are different facts, and the panel has to be able to
 * tell them apart. The committed refresh records `SOURCE_UNAVAILABLE` with zero rows: a failed check.
 */
function forwardFeed(rootDir = DEFAULT_ROOT) {
  const refresh = readJson(rootDir, REFRESH_RELATIVE);
  const source = readJson(rootDir, SOURCE_RELATIVE);
  const status = refresh?.event_source?.source_status || source?.source?.source_status || "unknown";
  const rows = Number.isFinite(refresh?.summary?.total_events_in_scope)
    ? refresh.summary.total_events_in_scope
    : Array.isArray(source?.events) ? source.events.length : null;
  return {
    source_path: REFRESH_RELATIVE,
    second_source_path: SOURCE_RELATIVE,
    source_name: refresh?.event_source?.name || source?.source?.source_name || null,
    status,
    checked_at_utc: refresh?.generated_at || source?.generated_at || null,
    rows_in_scope: rows,
    warnings: Array.isArray(refresh?.summary?.data_quality_warnings) ? refresh.summary.data_quality_warnings : [],
    reading: status === "SOURCE_UNAVAILABLE"
      ? "the collector ran and the upstream source could not be read: a failed check with zero rows, not a calendar that was read and found empty"
      : "the collector's last recorded run is summarised above"
  };
}

function scopeBlock() {
  return {
    staged_types: ["fomc_statement"],
    not_staged: [...NOT_STAGED],
    complete: false,
    reading:
      "one high-impact event type is staged. A morning with no staged release has been checked against FOMC " +
      "statements only; it is not evidence that no other release was due."
  };
}

/**
 * Build the calendar from the archive. Deterministic: the same archive always produces the same bytes, and the
 * hash is taken over the body without it.
 */
function buildCalendar({ rootDir = DEFAULT_ROOT } = {}) {
  const archive = f8.loadArchive({ rootDir });
  if (!archive || !Array.isArray(archive.statements) || !archive.statements.length) {
    throw new Error(`no F8 statement archive at ${f8.ARCHIVE_RELATIVE}; the calendar cannot be built from nothing`);
  }
  const events = archive.statements
    .map(eventFromStatement)
    .sort((left, right) => left.released_at_utc.localeCompare(right.released_at_utc));

  const withoutClock = events.filter((event) => !Number.isFinite(Date.parse(event.released_at_utc)));
  const notUtc = events.filter((event) => !/Z$/.test(String(event.released_at_utc)));
  const outOfOrder = events.filter((event, index) => index > 0 && event.released_at_utc <= events[index - 1].released_at_utc);
  const nonFomc = events.filter((event) => event.type !== "fomc_statement");

  const withoutHash = {
    schema_version: SCHEMA_VERSION,
    version: VERSION,
    frozen_on: FROZEN_ON,
    status: "partial_staged",
    scope: scopeBlock(),
    timing_rule:
      "the release time printed on each archived statement, converted to UTC with the zone the statement prints; " +
      "the FOMC publishes its meeting calendar a year ahead, so the instant is known before the morning",
    known_before_cutoff: true,
    why_partial:
      "the only release archive in the checkout with a timestamp on every row is the FOMC statement archive. The " +
      "other release types have no staged source, so this calendar can answer the window question for one event " +
      "type and cannot answer it for the calendar as a whole.",
    forward_feed: forwardFeed(rootDir),
    events,
    validation: {
      events: events.length,
      every_event_has_clock: withoutClock.length === 0,
      every_clock_is_utc: notUtc.length === 0,
      strictly_increasing: outOfOrder.length === 0,
      one_event_type_only: nonFomc.length === 0,
      first_event: events[0]?.date || null,
      last_event: events[events.length - 1]?.date || null,
      derived_from: f8.ARCHIVE_RELATIVE,
      archive_clock_verified: archive.clock ? archive.clock.verified_for_every_statement === true : false,
      not_staged_count: NOT_STAGED.length,
      reading:
        "this validates the shape of the calendar, not its completeness. It proves every row has a UTC release " +
        "instant in order and that only FOMC statements are staged."
    },
    counts: {
      events: events.length,
      types: events.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {})
    }
  };
  return { ...withoutHash, content_sha256: sha256(JSON.stringify(withoutHash)) };
}

function loadCalendar({ rootDir = DEFAULT_ROOT } = {}) {
  return readJson(rootDir, CALENDAR_RELATIVE);
}

function validateCalendar(calendar) {
  const problems = [];
  if (!calendar || typeof calendar !== "object") {
    return { ok: false, checks: {}, problems: ["calendar is missing"] };
  }
  if (calendar.schema_version !== SCHEMA_VERSION) problems.push("schema_version");
  const events = Array.isArray(calendar.events) ? calendar.events : [];
  if (!events.length) problems.push("calendar has no events");
  for (const event of events) {
    if (event.type !== "fomc_statement") problems.push(`${event.id} is not an FOMC statement`);
    if (!Number.isFinite(Date.parse(event.released_at_utc))) problems.push(`${event.id} has no release clock`);
    if (!event.timing_source) problems.push(`${event.id} has no timing source`);
    if (event.scheduled_in_advance !== true) problems.push(`${event.id} is not marked as scheduled in advance`);
  }
  const ordered = events.every((event, index) => index === 0 || event.released_at_utc > events[index - 1].released_at_utc);
  if (!ordered) problems.push("events are not strictly increasing in release time");
  if (calendar.scope?.complete !== false) problems.push("the calendar claims to be complete");
  const { content_sha256: contentHash, ...withoutHash } = calendar;
  const hashMatches = contentHash === sha256(JSON.stringify(withoutHash));
  if (!hashMatches) problems.push("content_sha256 does not match the calendar body");
  return {
    ok: problems.length === 0,
    checks: {
      hash_matches: hashMatches,
      events: events.length,
      strictly_increasing: ordered,
      scope_declared_partial: calendar.scope?.complete === false
    },
    problems
  };
}

function brief(event) {
  if (!event) return null;
  return {
    id: event.id,
    type: event.type,
    label: event.label,
    date: event.date,
    released_at_utc: event.released_at_utc
  };
}

/**
 * Read the calendar as of one morning.
 *
 * The window is the traded window: from the 05:00 cutoff to its 05:00 endpoint. A release inside it is a
 * post-call release, which is exactly the case that must not be read as if the call had known about it.
 */
function windowAsOf(calendar, { cutoffUtc, endpointUtc } = {}) {
  const empty = {
    status: "source_unavailable",
    reason: "calendar_missing",
    events: [],
    events_in_window: 0,
    last_event: null,
    next_event: null,
    days_since_last: null,
    days_until_next: null,
    coverage: "partial",
    staged_types: [],
    not_staged: []
  };
  if (!calendar || !Array.isArray(calendar.events) || !calendar.events.length) return empty;
  const cutoff = Date.parse(cutoffUtc);
  if (!Number.isFinite(cutoff)) return { ...empty, reason: "cutoff_missing" };
  const endpoint = Date.parse(endpointUtc);
  const from = Number.isFinite(endpoint) ? endpoint : cutoff;
  const at = (event) => Date.parse(event.released_at_utc);
  const due = calendar.events.filter((event) => at(event) > cutoff && at(event) <= from);
  const before = calendar.events.filter((event) => at(event) <= cutoff);
  const after = calendar.events.filter((event) => at(event) > from);
  const last = before[before.length - 1] || null;
  const next = after[0] || null;
  return {
    status: due.length ? "event_due_in_window" : "checked_no_event_due",
    reason: null,
    checked_at_utc: cutoffUtc,
    window: { from_utc: cutoffUtc, to_utc: Number.isFinite(endpoint) ? endpointUtc : null },
    events: due.map(brief),
    events_in_window: due.length,
    last_event: brief(last),
    next_event: brief(next),
    days_since_last: last ? calendarDays(last.date, String(cutoffUtc).slice(0, 10)) : null,
    days_until_next: next ? calendarDays(String(cutoffUtc).slice(0, 10), next.date) : null,
    coverage: calendar.scope?.complete === true ? "complete" : "partial",
    staged_types: calendar.scope?.staged_types || [],
    not_staged: calendar.scope?.not_staged || []
  };
}

/** How far the staged releases reach, as a sentence the artefact can carry into the page unchanged. */
function spanSentence(calendar) {
  const events = Array.isArray(calendar?.events) ? calendar.events : [];
  if (!events.length) return "the staged calendar holds no events";
  return `the staged calendar holds ${events.length} FOMC statement releases from ${events[0].date} to ${events[events.length - 1].date}`;
}

/**
 * The per-morning read the audit publishes. Every session is checked, including the ones before the first
 * staged release, so "checked" and "unavailable" can never be confused with "no events existed".
 */
function summarise({ calendar, sessions = [] } = {}) {
  const base = {
    source: CALENDAR_RELATIVE,
    version: calendar?.version || null,
    content_sha256: calendar?.content_sha256 || null,
    scope: calendar?.scope || scopeBlock(),
    timing_rule: calendar?.timing_rule || null,
    forward_feed: calendar?.forward_feed || forwardFeed(),
    span: spanSentence(calendar),
    events: Array.isArray(calendar?.events) ? calendar.events.length : 0,
    first_event: calendar?.events?.[0]?.date || null,
    last_event: calendar?.events?.[calendar.events.length - 1]?.date || null
  };
  if (!calendar || !Array.isArray(calendar.events) || !calendar.events.length) {
    return {
      ...base,
      status: calendar ? "invalid" : "missing",
      mornings_checked: 0,
      statuses: { source_unavailable: sessions.length },
      mornings_with_event_in_window: 0,
      windows: [],
      reading: calendar
        ? "the staged calendar holds no events, so it cannot answer the window question for any morning"
        : `no calendar is staged at ${CALENDAR_RELATIVE}, so every morning is an unread calendar rather than an empty one`
    };
  }
  const statuses = {};
  const windows = [];
  for (const session of sessions) {
    const read = windowAsOf(calendar, { cutoffUtc: session.cutoff_at_utc, endpointUtc: session.endpoint_at_utc });
    statuses[read.status] = (statuses[read.status] || 0) + 1;
    if (read.events_in_window) {
      windows.push({
        date: session.date,
        cutoff_at_utc: session.cutoff_at_utc,
        endpoint_at_utc: session.endpoint_at_utc,
        events: read.events
      });
    }
  }
  return {
    ...base,
    status: "staged",
    mornings_checked: sessions.length,
    statuses,
    statuses_reading: Object.fromEntries(
      Object.entries(statuses).map(([key, value]) => [key, `${value} - ${STATUS_LABELS[key] || key}`])
    ),
    mornings_with_event_in_window: windows.length,
    windows,
    reading:
      `every one of the ${sessions.length} mornings reads the calendar at its own cutoff; ${windows.length} of them ` +
      "carry a staged FOMC release inside the traded window and are marked event-contaminated. No morning is treated " +
      "as having no events because the calendar was empty: the calendar is partial by scope, not by date."
  };
}

module.exports = {
  CALENDAR_RELATIVE,
  SCHEMA_VERSION,
  VERSION,
  FROZEN_ON,
  NOT_STAGED,
  STATUS_LABELS,
  REFRESH_RELATIVE,
  SOURCE_RELATIVE,
  calendarPath,
  calendarDays,
  eventFromStatement,
  forwardFeed,
  scopeBlock,
  buildCalendar,
  loadCalendar,
  validateCalendar,
  windowAsOf,
  spanSentence,
  summarise,
  sha256
};
