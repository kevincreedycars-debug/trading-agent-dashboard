// The one file that lets a restarted relay finish what it started: what was sent, which position it became, and
// the deadline the exit is owed at.
//
// The test harness closes the position in its own process, so a crash, a lost socket or a reboot between the send
// and the close would otherwise leave a live position with nobody watching it. This journal is written before the
// send, updated when the broker names the position, and updated again when the position is seen closed. A second
// process - the guard - reads it, and closes anything the journal still shows as open. It never sends an entry.
//
// The file holds identifiers and numbers, never a token: the vault stays the only place a credential lives.
// Writes are a temporary file and a rename, so a crash cannot leave a half-written journal that reads as "no
// exposure".
"use strict";

const crypto = require("node:crypto");

const JOURNAL_VERSION = 1;
const STATES = Object.freeze({
  intent: "intent", // a send was attempted; the broker may or may not have acted
  sent: "sent", // the broker answered with an order or a position id
  open: "open", // a fill was read, so the position exists and the deadline is set
  closed: "closed", // the position was seen closed, or read as absent, after a close
  uncertain: "uncertain" // something could not be established; a human has to look
});

function codedError(code, message, extra) {
  const err = new Error(message);
  err.code = code;
  if (extra) Object.assign(err, extra);
  return err;
}

function assertJournalPath(path) {
  const name = String(path || "").split(/[\\/]/).pop().toLowerCase();
  if (!name) throw codedError("journal_path_missing", "a journal path is required");
  if (name === "tokens.json" || name === "credentials.env" || name.endsWith(".env")) {
    throw codedError("plaintext_path_refused", `"${name}" is a credential file name, not a journal`);
  }
  return path;
}

function parseEntry(text, path) {
  let entry;
  try {
    entry = JSON.parse(text);
  } catch (err) {
    throw codedError("journal_corrupt", `the journal at ${path} is not JSON`, { cause: err });
  }
  if (!entry || entry.version !== JOURNAL_VERSION) {
    throw codedError("journal_version_unsupported", `the journal at ${path} is version ${entry && entry.version}`);
  }
  return entry;
}

function readJournal({ path, fs } = {}) {
  assertJournalPath(path);
  if (!fs || typeof fs.readFileSync !== "function") throw new TypeError("readJournal needs fs");
  let text;
  try {
    text = fs.readFileSync(path, "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") return null;
    throw err;
  }
  const entry = parseEntry(text, path);
  // An empty document is how the run clears the file before a fresh attempt.
  return entry.state ? entry : null;
}

function writeJournal({ path, entry, fs, now = () => Date.now() } = {}) {
  assertJournalPath(path);
  if (!fs || typeof fs.writeFileSync !== "function") throw new TypeError("writeJournal needs fs");
  const record = {
    ...entry,
    version: JOURNAL_VERSION,
    updatedAtUtc: new Date(now()).toISOString()
  };
  const temporary = `${path}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporary, path);
  if (typeof fs.chmodSync === "function") fs.chmodSync(path, 0o600);
  return record;
}

// One journal, one entry, appended to as the run learns more. Every method writes and returns the new record, so
// the caller can log exactly what was persisted.
function createJournal({ path, fs, now = () => Date.now() } = {}) {
  assertJournalPath(path);
  if (!fs || typeof fs.writeFileSync !== "function") throw new TypeError("createJournal needs fs");

  function update(kind, patch, detail) {
    const current = readJournal({ path, fs }) || { events: [] };
    const atUtc = new Date(now()).toISOString();
    const events = Array.isArray(current.events) ? current.events.slice(-49) : [];
    events.push({ atUtc, kind, detail: detail === undefined ? null : detail });
    return writeJournal({ path, entry: { ...current, ...patch, events }, fs, now });
  }

  return {
    path,
    read() {
      return readJournal({ path, fs });
    },
    clear() {
      return writeJournal({ path, entry: { events: [] }, fs, now });
    },
    // Written before the send, so an order whose answer never arrives is still on record.
    beginIntent({ login, accountId, clientOrderId, side, volume, symbol, holdMs }) {
      return update(
        "intent",
        {
          state: STATES.intent,
          login: login === undefined ? null : login,
          accountId: accountId === undefined ? null : accountId,
          clientOrderId: clientOrderId ? String(clientOrderId) : null,
          symbol: symbol || null,
          side: side || null,
          volume: Number.isFinite(Number(volume)) ? Number(volume) : null,
          holdMs: Number.isFinite(Number(holdMs)) ? Number(holdMs) : null,
          positionId: null,
          orderId: null,
          fillTimeUtc: null,
          deadlineUtc: null,
          closeRequestedAtUtc: null,
          closedAtUtc: null,
          closePrice: null,
          status: null,
          startedAtUtc: new Date(now()).toISOString()
        },
        { clientOrderId: clientOrderId || null, volume: Number.isFinite(Number(volume)) ? Number(volume) : null }
      );
    },
    recordSent({ orderId, positionId }) {
      return update(
        "sent",
        {
          state: STATES.sent,
          orderId: orderId ? String(orderId) : null,
          positionId: positionId ? String(positionId) : null
        },
        { orderId: orderId || null, positionId: positionId || null }
      );
    },

    // The deadline is the broker's fill time plus the hold, exactly as the harness computes it, so a guard that
    // restarts mid-hold closes at the same moment the run would have.
    recordFill({ positionId, orderId, fillPrice, fillVolume, fillTimeUtc }) {
      const current = readJournal({ path, fs }) || {};
      const holdMs = Number.isFinite(Number(current.holdMs)) ? Number(current.holdMs) : 120000;
      const fillMs = Date.parse(fillTimeUtc || "");
      const deadlineUtc = Number.isFinite(fillMs) ? new Date(fillMs + holdMs).toISOString() : null;
      return update(
        "fill",
        {
          state: STATES.open,
          positionId: positionId ? String(positionId) : current.positionId || null,
          orderId: orderId ? String(orderId) : current.orderId || null,
          fillPrice: Number.isFinite(Number(fillPrice)) ? Number(fillPrice) : null,
          fillVolume: Number.isFinite(Number(fillVolume)) ? Number(fillVolume) : null,
          fillTimeUtc: fillTimeUtc || null,
          deadlineUtc
        },
        { positionId: positionId || null, fillTimeUtc: fillTimeUtc || null, deadlineUtc }
      );
    },
    recordCloseRequest({ reason }) {
      return update("close_requested", { closeRequestedAtUtc: new Date(now()).toISOString() }, { reason: reason || null });
    },
    recordClosed({ status, closePrice, closeTimeUtc, positionId }) {
      return update(
        "closed",
        {
          state: STATES.closed,
          status: status || "closed",
          positionId: positionId ? String(positionId) : null,
          closePrice: Number.isFinite(Number(closePrice)) ? Number(closePrice) : null,
          closedAtUtc: closeTimeUtc || new Date(now()).toISOString()
        },
        { status: status || "closed" }
      );
    },
    recordUncertain({ reason, positionId }) {
      return update(
        "uncertain",
        {
          state: STATES.uncertain,
          status: reason || "uncertain",
          positionId: positionId ? String(positionId) : null
        },
        { reason: reason || null }
      );
    }
  };
}

// What a fresh process should do with the record it finds. "close" is the only action that touches the broker,
// and it is only ever a close of a position the journal already names or an adoption of an order it can identify.
function planRecovery(entry, now = () => Date.now()) {
  if (!entry || !entry.state) return { action: "none", reason: "empty" };
  if (entry.state === STATES.closed) return { action: "none", reason: "already_closed", positionId: entry.positionId || null };
  if (entry.positionId) {
    const deadlineMs = Date.parse(entry.deadlineUtc || "");
    const overdueMs = Number.isFinite(deadlineMs) ? Math.max(0, now() - deadlineMs) : null;
    return { action: "close", reason: `state_${entry.state}`, positionId: String(entry.positionId), overdueMs };
  }
  if (entry.clientOrderId) {
    // Sent, but the broker's answer never reached the journal: adopt by the id that was sent, never resend.
    return { action: "adopt", reason: `state_${entry.state}`, clientOrderId: String(entry.clientOrderId) };
  }
  return { action: "escalate", reason: "no_identifier", state: entry.state };
}

module.exports = {
  JOURNAL_VERSION,
  STATES,
  codedError,
  assertJournalPath,
  readJournal,
  writeJournal,
  createJournal,
  planRecovery
};

