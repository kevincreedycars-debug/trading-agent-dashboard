"use strict";

/**
 * The F8 Fed-bias archive reader.
 *
 * The archive is staged, not wired: no snapshot reads it yet, so it cannot change a historical call. This module
 * exists so the archive can be validated and queried with an as-of rule before that wiring happens. `labelAsOf`
 * takes the morning's actual cutoff instant, never the morning's date, so a 14:00 New York statement can never
 * be read by a 05:00 London decision on the same calendar day.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_ROOT = path.resolve(__dirname, "..", "..", "..");
const ARCHIVE_RELATIVE = "data/usd-layer1-backtester/f8-fomc-statements-v1.json";
const SCHEMA_VERSION = "usd-l1-f8-fed-statements-v1";

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function archivePath(rootDir = DEFAULT_ROOT) {
  return path.join(rootDir, ARCHIVE_RELATIVE);
}

function loadArchive({ rootDir = DEFAULT_ROOT } = {}) {
  const file = archivePath(rootDir);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/**
 * Validate what can be validated without a market: shape, order, hash, labels and the as-of rule.
 *
 * A failure here is a build problem. It does not say the labels are good; it says the archive is not internally
 * consistent enough to be read.
 */
function validateArchive(archive) {
  const problems = [];
  if (!archive || typeof archive !== "object") {
    return { ok: false, checks: {}, problems: ["archive is missing"] };
  }
  if (archive.schema_version !== SCHEMA_VERSION) problems.push("schema_version");
  const statements = Array.isArray(archive.statements) ? archive.statements : [];
  if (!statements.length) problems.push("statements is empty");
  const dates = statements.map((statement) => statement.date);
  if (new Set(dates).size !== dates.length) problems.push("duplicate statement dates");
  if (dates.some((date, index) => index > 0 && date <= dates[index - 1])) {
    problems.push("statements are not in chronological order");
  }
  if (
    statements.some(
      (statement) =>
        !statement.released_at_utc ||
        !statement.bias ||
        !statement.text ||
        !Number.isFinite(statement.score) ||
        !Number.isFinite(statement.direction)
    )
  ) {
    problems.push("a statement is missing its clock, text, bias, score or direction");
  }
  if (statements.some((statement) => !/FOMC statement/i.test(statement.title || ""))) {
    problems.push("a non-FOMC statement is in the archive");
  }
  if (statements.some((statement) => Number.isNaN(Date.parse(statement.released_at_utc)))) {
    problems.push("a release clock is not a valid instant");
  }
  const { content_sha256: contentHash, ...withoutHash } = archive;
  const hashMatches = contentHash === sha256(JSON.stringify(withoutHash));
  if (!hashMatches) problems.push("content_sha256 does not match the archive body");
  const validation = archive.validation || {};
  for (const key of [
    "every_statement_labelled",
    "every_statement_has_text",
    "every_statement_has_release_clock",
    "deterministic",
    "chronological"
  ]) {
    if (validation[key] !== true) problems.push(`validation.${key}`);
  }
  if (validation.known_text_check && validation.known_text_check.december_at_least_as_hawkish !== true) {
    problems.push("the known-text check does not hold");
  }
  return {
    ok: problems.length === 0,
    checks: {
      schema_version: archive.schema_version || null,
      statements: statements.length,
      unique_dates: new Set(dates).size,
      chronological: validation.chronological === true,
      deterministic: validation.deterministic === true,
      clock_complete: validation.every_statement_has_release_clock === true,
      hash_matches: hashMatches
    },
    problems
  };
}


/**
 * The label a morning could read: the latest statement whose release instant is at or before the cutoff.
 *
 * Returns `available: false` with a reason when no statement has been released yet. It never falls back to the
 * next statement and never uses the morning's calendar date as a proxy for the cutoff instant.
 */
function labelAsOf(archive, { cutoffUtc } = {}) {
  if (!archive || !Array.isArray(archive.statements)) {
    return { available: false, reason: "archive_missing" };
  }
  const cutoff = Date.parse(cutoffUtc);
  if (!Number.isFinite(cutoff)) return { available: false, reason: "cutoff_not_an_instant" };
  let selected = null;
  for (const statement of archive.statements) {
    if (Date.parse(statement.released_at_utc) <= cutoff) selected = statement;
    else break;
  }
  if (!selected) return { available: false, reason: "no_release_before_cutoff" };
  return {
    available: true,
    statement_date: selected.date,
    released_at_utc: selected.released_at_utc,
    age_calendar_days: Math.round((cutoff - Date.parse(selected.released_at_utc)) / 86400000),
    bias: selected.bias,
    score: selected.score,
    shift: selected.shift,
    direction: selected.direction,
    action: selected.action,
    action_size: selected.action_size,
    url: selected.url,
    title: selected.title
  };
}

/** The block the run artefact publishes. It is a status block, not a factor value. */
function summarise({ rootDir = DEFAULT_ROOT } = {}) {
  const archive = loadArchive({ rootDir });
  if (!archive) {
    return {
      status: "missing",
      archive_path: ARCHIVE_RELATIVE,
      version: null,
      statements: 0,
      problems: ["archive not built"]
    };
  }
  const validation = validateArchive(archive);
  const latest = archive.statements[archive.statements.length - 1] || null;
  return {
    status: archive.status || "staged_not_wired",
    archive_path: ARCHIVE_RELATIVE,
    version: archive.version,
    frozen_on: archive.frozen_on,
    statements: archive.statements.length,
    first_statement: archive.statements[0] ? archive.statements[0].date : null,
    latest_statement: latest
      ? {
          date: latest.date,
          released_at_utc: latest.released_at_utc,
          bias: latest.bias,
          shift: latest.shift,
          direction: latest.direction,
          score: latest.score
        }
      : null,
    label_counts: archive.validation ? archive.validation.label_counts : null,
    shift_counts: archive.validation ? archive.validation.shift_counts : null,
    clock_verified: archive.clock ? archive.clock.verified_for_every_statement : false,
    validation: { ok: validation.ok, checks: validation.checks, problems: validation.problems },
    content_sha256: archive.content_sha256,
    next_step:
      "join labelAsOf into the 05:00 snapshot builder, then re-run the validity gate; the archive alone does not change any morning's requirement count"
  };
}

module.exports = {
  ARCHIVE_RELATIVE,
  SCHEMA_VERSION,
  archivePath,
  loadArchive,
  validateArchive,
  labelAsOf,
  summarise,
  sha256
};
