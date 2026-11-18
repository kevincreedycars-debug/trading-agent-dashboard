/**
 * H1 evidence records: historical reconstruction and sealed live replay are different gates.
 *
 * The supplied rulebook (RULEBOOK.md, rule 1 and the data-requirements table) says historical
 * reconstruction must retain the original point-in-time source evidence for every operand, with a
 * nullable receipt. Live proof additionally requires a sealed receipt by the cutoff. This module
 * implements that distinction. It never invents a receipt and it never treats a newly collected
 * timestamp as a historical one.
 *
 * A record bundle lives at data/usd-layer1-backtester/h1-v1/<input>.json and carries the exact
 * source, instrument and transform it was taken from. The coverage audit refuses a bundle whose
 * identity differs from the supplied inputs.json.
 *
 * Research only. Nothing here reads the network or a production path.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const EVIDENCE_DIR = "data/usd-layer1-backtester/h1-v1";
const SCHEMA_VERSION = "h1-evidence-v1";

const MODES = {
  HISTORICAL: "historical_reconstruction",
  SEALED: "sealed_live_replay",
};

const REQUIRED_RELEASE_TYPES = [
  "CPI",
  "Employment Situation",
  "advance GDP",
  "Personal Income and Outlays",
  "FOMC policy decision",
];

/**
 * The minimum operand count for each transform. Five completed intervals need six observations
 * (the current print and five earlier prints). ICE needs the previous and current eligible 05:00
 * fixing. VIX is a latest-completed-close feature. The calendar needs all five release families.
 */
const MIN_OPERANDS = {
  vix: 1,
  front: 6,
  spread: 6,
  real: 6,
  broad: 6,
  ice: 2,
  gold: 6,
  qqq: 6,
  calendar: 5,
};

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function stamp(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function operandValid(operand) {
  return (
    operand &&
    typeof operand === "object" &&
    finite(operand.value) &&
    stamp(operand.observed_at_utc) !== null &&
    nonEmpty(operand.vintage) &&
    (operand.published_at_utc === undefined ||
      operand.published_at_utc === null ||
      stamp(operand.published_at_utc) !== null)
  );
}

function releaseTypesOf(record) {
  const fromRecord = Array.isArray(record.release_types) ? record.release_types : [];
  const fromOperands = (record.operands || []).map((operand) => operand.type).filter(Boolean);
  return [...new Set([...fromRecord, ...fromOperands])];
}

function hasRequiredReleaseTypes(record) {
  const present = new Set(releaseTypesOf(record));
  return REQUIRED_RELEASE_TYPES.every((type) => present.has(type));
}

/**
 * Normalise a bundle and validate every record. A bundle with one bad record is invalid: a single
 * malformed operand must not silently disappear from the denominator.
 */
function validateBundle(raw, key, contract, { file = null } = {}) {
  const errors = [];
  const records = new Map();
  const bundle = Array.isArray(raw) ? { records: raw } : raw;
  if (!bundle || typeof bundle !== "object") {
    return { valid: false, errors: ["bundle is not an object or an array"], records, path: file };
  }
  if (bundle.input !== undefined && bundle.input !== key) {
    errors.push(`bundle input ${bundle.input} is not ${key}`);
  }
  for (const field of ["source", "instrument", "transform"]) {
    if (bundle[field] !== undefined && bundle[field] !== contract[field]) {
      errors.push(`bundle ${field} ${JSON.stringify(bundle[field])} is not ${JSON.stringify(contract[field])}`);
    }
  }
  if (!Array.isArray(bundle.records)) {
    errors.push("bundle.records must be an array");
    return { valid: false, errors, records, path: file };
  }
  if (!bundle.records.length) errors.push("bundle carries no records");
  for (const [index, record] of bundle.records.entries()) {
    const where = `record ${index + 1}`;
    if (!record || typeof record !== "object") {
      errors.push(`${where}: not an object`);
      continue;
    }
    if (!nonEmpty(record.session_date)) errors.push(`${where}: session_date is required`);
    if (!finite(record.value)) errors.push(`${where}: value must be a finite number`);
    if (stamp(record.observed_at_utc) === null) errors.push(`${where}: observed_at_utc must be an ISO timestamp`);
    if (stamp(record.published_at_utc) === null) errors.push(`${where}: published_at_utc must be an ISO timestamp`);
    if (record.received_at_utc !== null && record.received_at_utc !== undefined && stamp(record.received_at_utc) === null) {
      errors.push(`${where}: received_at_utc must be an ISO timestamp or null`);
    }
    if (!nonEmpty(record.vintage)) errors.push(`${where}: vintage is required`);
    if (record.original !== true) errors.push(`${where}: original must be true`);
    for (const field of ["source", "instrument", "transform"]) {
      if (record[field] !== undefined && record[field] !== contract[field]) {
        errors.push(`${where}: ${field} differs from the declared contract`);
      }
    }
    const operands = Array.isArray(record.operands) ? record.operands : [];
    if (operands.length < MIN_OPERANDS[key]) {
      errors.push(`${where}: ${operands.length} operands, ${MIN_OPERANDS[key]} required`);
    }
    for (const [operandIndex, operand] of operands.entries()) {
      if (!operandValid(operand)) errors.push(`${where}: operand ${operandIndex + 1} is not a dated original observation`);
    }
    if (nonEmpty(record.session_date) && records.has(record.session_date)) {
      errors.push(`${where}: duplicate session_date ${record.session_date}`);
    } else if (nonEmpty(record.session_date)) {
      records.set(record.session_date, record);
    }
  }
  return { valid: errors.length === 0, errors, records, path: file };
}

/**
 * Load one bundle. A missing file is not an error: it means the input has no imported evidence.
 */
function loadBundle({ root, key, contract }) {
  const relative = `${EVIDENCE_DIR}/${key}.json`;
  const file = root ? path.join(root, relative) : null;
  if (!file || !fs.existsSync(file)) {
    return { present: false, valid: false, errors: [], records: new Map(), path: relative };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const checked = validateBundle(raw, key, contract, { file: relative });
    return { present: true, ...checked };
  } catch (error) {
    return { present: true, valid: false, errors: [`cannot read ${relative}: ${error.message}`], records: new Map(), path: relative };
  }
}

function loadEvidence({ root, keys, contracts }) {
  const out = {};
  for (const key of keys) out[key] = loadBundle({ root, key, contract: contracts[key] });
  return out;
}

/**
 * Evaluate one record against one session and one evidence mode.
 *
 * Historical reconstruction: original operands + observed/published by the cutoff. The receipt is
 * nullable by the supplied rulebook.
 * Sealed live replay: the same evidence plus a genuine receipt at or before the cutoff.
 */
function evaluateEvidence({ key, record, session, contract, mode = MODES.HISTORICAL, bundleValid = true }) {
  const cutoff = Date.parse(session.cutoff_at_utc);
  const observed = stamp(record.observed_at_utc);
  const published = stamp(record.published_at_utc);
  const received = record.received_at_utc === null || record.received_at_utc === undefined ? null : stamp(record.received_at_utc);
  const operands = Array.isArray(record.operands) ? record.operands : [];
  const minimum = MIN_OPERANDS[key];
  const present = record.session_date === session.date && finite(record.value);
  const original = bundleValid && record.original === true && operands.length >= minimum && operands.every(operandValid);
  const schedule_complete = key === "calendar" ? hasRequiredReleaseTypes(record) : true;
  const lookback =
    key === "vix"
      ? present
      : key === "ice"
        ? operands.length >= 2
        : key === "calendar"
          ? schedule_complete
          : operands.length >= minimum;
  const age_hours = Number.isFinite(observed) && Number.isFinite(cutoff) ? (cutoff - observed) / 3600000 : null;
  const fresh = age_hours !== null && age_hours >= 0 && age_hours <= contract.hours;
  const clocked =
    Number.isFinite(observed) &&
    Number.isFinite(published) &&
    Number.isFinite(cutoff) &&
    observed <= published &&
    published <= cutoff;
  const receipt =
    Number.isFinite(received) &&
    Number.isFinite(published) &&
    Number.isFinite(cutoff) &&
    published <= received &&
    received <= cutoff;
  const identity =
    original &&
    (record.source === undefined || record.source === contract.source) &&
    (record.instrument === undefined || record.instrument === contract.instrument) &&
    (record.transform === undefined || record.transform === contract.transform);
  const base = present && original && lookback && fresh && clocked && identity && schedule_complete;
  const sealedEligible = base && receipt;
  const eligible = mode === MODES.SEALED ? sealedEligible : base;
  let reason = null;
  if (!present) reason = "missing_value";
  else if (!original) reason = "unverified_original";
  else if (!lookback) reason = key === "calendar" ? "incomplete_calendar" : "incomplete_lookback";
  else if (!fresh) reason = "stale_or_unproven";
  else if (!clocked) reason = "unclocked";
  else if (!identity) reason = "identity_unverified";
  else if (!schedule_complete) reason = "incomplete_calendar";
  else if (mode === MODES.SEALED && !receipt) reason = "unverified_receipt";
  return {
    present,
    original,
    lookback,
    fresh,
    clocked,
    receipt,
    identity,
    schedule_complete,
    eligible,
    sealed_eligible: sealedEligible,
    evidence_mode: mode,
    age_hours,
    reason,
  };
}

/**
 * Parse a small CSV. The evidence import is deliberately one row per session and one JSON
 * `operands` column, so the raw lookback history cannot be dropped without the validator seeing it.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (character !== "\r") {
      cell += character;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => String(value).trim().length));
}

const CSV_COLUMNS = [
  "session_date",
  "value",
  "observed_at_utc",
  "published_at_utc",
  "received_at_utc",
  "vintage",
  "original",
  "operands",
];

/**
 * Convert CSV text to a bundle. `operands` is a JSON array of objects with value,
 * observed_at_utc and vintage (and type for the calendar).
 */
function bundleFromCsv(text, { key, contract }) {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error("CSV is empty");
  const header = rows.shift().map((value) => String(value).trim());
  for (const column of CSV_COLUMNS) {
    if (!header.includes(column)) throw new Error(`CSV is missing column ${column}`);
  }
  const records = rows.map((cells, index) => {
    const row = Object.fromEntries(header.map((column, position) => [column, cells[position] === undefined ? "" : cells[position]]));
    let operands;
    try {
      operands = JSON.parse(row.operands || "[]");
    } catch (error) {
      throw new Error(`row ${index + 2}: operands is not valid JSON: ${error.message}`);
    }
    return {
      session_date: row.session_date.trim(),
      value: Number(row.value),
      observed_at_utc: row.observed_at_utc.trim(),
      published_at_utc: row.published_at_utc.trim(),
      received_at_utc: row.received_at_utc.trim() || null,
      vintage: row.vintage.trim(),
      original: String(row.original).trim().toLowerCase() === "true",
      operands,
    };
  });
  return {
    schema_version: SCHEMA_VERSION,
    input: key,
    source: contract.source,
    instrument: contract.instrument,
    transform: contract.transform,
    records,
  };
}

module.exports = {
  EVIDENCE_DIR,
  SCHEMA_VERSION,
  MODES,
  REQUIRED_RELEASE_TYPES,
  MIN_OPERANDS,
  CSV_COLUMNS,
  loadBundle,
  loadEvidence,
  validateBundle,
  evaluateEvidence,
  parseCsv,
  bundleFromCsv,
};
