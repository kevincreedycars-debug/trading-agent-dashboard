// The gate between the copier's builder and the published page.
//
// A document that fails any of these checks is refused rather than published, for the same reason the live
// feed's own validator exists: the tab states what it is given, so a document missing a mapping row, a heartbeat
// or one of the four instruments would draw a page that looks complete and is not. The checks are structural,
// not opinions about the trading, and every one of them names the field it objected to.
"use strict";

const lib = require("../lib/live_ctrader_copier.js");

const HEARTBEAT_STATES = new Set(["ok", "stale", "error", "killed", "missing"]);
const VERIFICATION_STATES = new Set(["broker_observed", "tested", "not_sent", "awaiting_live_proof"]);
const MAPPING_STATES = new Set(["open", "closed", "pending", "not_open"]);
const COPY_KINDS = new Set(["copy", "setup-test", "pre-copier", "unattributed"]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function validateLiveCtraderCopier(document) {
  const problems = [];
  if (!isPlainObject(document)) return ["the document is not an object"];
  if (document.schema_version !== lib.SCHEMA_VERSION) {
    problems.push(`schema_version is ${JSON.stringify(document.schema_version)}, expected ${lib.SCHEMA_VERSION}`);
  }
  if (!document.generated_at_utc || Number.isNaN(Date.parse(document.generated_at_utc))) {
    problems.push("generated_at_utc is missing or not a readable timestamp");
  }
  if (!isFiniteNumber(document.stale_after_seconds) || document.stale_after_seconds <= 0) {
    problems.push("stale_after_seconds must be a positive number");
  }
  if (document.read_only !== true) problems.push("read_only must be true");
  if (document.order_functions_called !== false) problems.push("order_functions_called must be false");

  const connection = document.connection;
  if (!isPlainObject(connection)) {
    problems.push("connection is missing");
  } else {
    if (typeof connection.connected !== "boolean") problems.push("connection.connected must be true or false");
    if (!connection.account_id) problems.push("connection.account_id is missing");
    if (!["demo", "live"].includes(connection.environment)) problems.push("connection.environment must be demo or live");
  }

  const account = document.account;
  if (!isPlainObject(account)) {
    problems.push("account is missing");
  } else {
    if (!isFiniteNumber(account.balance)) problems.push("account.balance must be a number");
    if (!isFiniteNumber(account.equity)) problems.push("account.equity must be a number");
    for (const field of ["open_positions", "pending_orders", "closed_trades"]) {
      if (!isNonNegativeInteger(account[field])) problems.push(`account.${field} must be a whole number`);
    }
  }

  const copier = document.copier;
  if (!isPlainObject(copier)) {
    problems.push("copier is missing");
  } else {
    if (!isPlainObject(copier.schedule) || !isFiniteNumber(copier.schedule.cadence_seconds) || copier.schedule.cadence_seconds <= 0) {
      problems.push("copier.schedule.cadence_seconds must be a positive number: the page states the cadence it reads");
    }
    if (!isPlainObject(copier.heartbeat) || !HEARTBEAT_STATES.has(copier.heartbeat.state)) {
      problems.push(`copier.heartbeat.state must be one of ${[...HEARTBEAT_STATES].join(", ")}`);
    }
  }

  if (!Array.isArray(document.mappings)) {
    problems.push("mappings must be an array");
  } else {
    document.mappings.forEach((row, index) => {
      const where = `mappings[${index}]`;
      if (!isPlainObject(row)) {
        problems.push(`${where} is not an object`);
        return;
      }
      if (!row.source_ticket) problems.push(`${where}.source_ticket is missing`);
      if (!MAPPING_STATES.has(row.status)) problems.push(`${where}.status is ${JSON.stringify(row.status)}`);
      if (!isFiniteNumber(row.volume_lots)) problems.push(`${where}.volume_lots must be a number`);
      if (!Number.isInteger(row.protocol_units) || row.protocol_units < 0) problems.push(`${where}.protocol_units must be a whole number`);
      if (!isFiniteNumber(row.base_units)) problems.push(`${where}.base_units must be a number`);
      if (!Object.prototype.hasOwnProperty.call(row, "expiry_utc")) problems.push(`${where}.expiry_utc must be stated, even when null`);
      if (row.side !== null && !["buy", "sell"].includes(row.side)) problems.push(`${where}.side is ${JSON.stringify(row.side)}`);
    });
  }

  if (!Array.isArray(document.verification) || !document.verification.length) {
    problems.push("verification must state at least one behaviour");
  } else {
    document.verification.forEach((row, index) => {
      const where = `verification[${index}]`;
      if (!row || typeof row.behaviour !== "string" || !row.behaviour) problems.push(`${where}.behaviour is missing`);
      if (!VERIFICATION_STATES.has(row?.state)) problems.push(`${where}.state is ${JSON.stringify(row?.state)}`);
      if (typeof row?.detail !== "string" || !row.detail) problems.push(`${where}.detail is missing`);
    });
  }

  const symbols = Array.isArray(document.symbols) ? document.symbols : null;
  if (!symbols) {
    problems.push("symbols must be an array");
  } else {
    const sources = new Set(symbols.map((row) => (row && row.source_symbol) || null));
    for (const source of lib.SOURCE_SYMBOLS) {
      if (!sources.has(source)) problems.push(`symbols carries no row for ${source}`);
    }
    symbols.forEach((row, index) => {
      const where = `symbols[${index}]`;
      if (!row || typeof row.source_symbol !== "string") problems.push(`${where}.source_symbol is missing`);
      if (row && row.mapped === true && !row.target_symbol) problems.push(`${where}.target_symbol is mapped but names no destination`);
      if (row && row.mapped === true && !(row.protocol_units_per_lot > 0)) {
        problems.push(`${where}.protocol_units_per_lot is missing: a mapped instrument must carry its contract`);
      }
    });
  }

  if (!Array.isArray(document.closed_trades)) {
    problems.push("closed_trades must be an array");
  } else {
    document.closed_trades.forEach((trade, index) => {
      const where = `closed_trades[${index}]`;
      if (!trade || trade.position_id === undefined || trade.position_id === null) problems.push(`${where}.position_id is missing`);
      if (!COPY_KINDS.has(trade?.copy_kind)) problems.push(`${where}.copy_kind is ${JSON.stringify(trade?.copy_kind)}`);
      if (!trade?.closed?.time_utc || Number.isNaN(Date.parse(trade.closed.time_utc))) problems.push(`${where}.closed.time_utc is not a timestamp`);
    });
  }

  if (!isPlainObject(document.differences) || !isNonNegativeInteger(document.differences.count)) {
    problems.push("differences.count must be a whole number");
  }
  if (!isPlainObject(document.setup_tests) || !isNonNegativeInteger(document.setup_tests.trades)) {
    problems.push("setup_tests.trades must be a whole number");
  }
  return problems;
}

module.exports = { validateLiveCtraderCopier, HEARTBEAT_STATES, VERIFICATION_STATES, MAPPING_STATES, COPY_KINDS };

