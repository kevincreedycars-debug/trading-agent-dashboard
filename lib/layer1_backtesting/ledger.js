/**
 * The decision ledger and the independent run audit.
 *
 * A morning's decision is saved once per model. A test never re-derives a decision; it references the stored
 * record by `decision_id`, so deleting or changing a record breaks the test visibly instead of silently moving a
 * number.
 *
 * The audit is deliberately separate from the engine: it re-reads the stored record, the session snapshot, the
 * model registration and the required-input set, and reports what does not line up. It is the check that a
 * published artefact cannot pass by agreeing with itself.
 *
 * Research only.
 */
"use strict";

const { snapshotHash, stableStringify } = require("./engine");

function decisionId(record) {
  return `${record.model.id}@${record.date}`;
}

function createLedger() {
  return { entries: new Map(), saves: 0, duplicates: 0, conflicts: 0 };
}

/**
 * Save one decision for one model and one morning.
 *
 * The first save wins. A second save of an identical record is a reference, not a write: it returns the stored
 * record with `duplicate: true`. A second save that disagrees throws, because silently replacing a decision is
 * exactly the failure the ledger exists to prevent.
 */
function saveDecision(ledger, record) {
  const id = decisionId(record);
  const existing = ledger.entries.get(id);
  if (existing) {
    if (stableStringify(existing) !== stableStringify(record)) {
      ledger.conflicts += 1;
      throw new Error(`ledger: conflicting decision for ${id}; the first save is immutable`);
    }
    ledger.duplicates += 1;
    return { id, duplicate: true, record: existing };
  }
  ledger.entries.set(id, record);
  ledger.saves += 1;
  return { id, duplicate: false, record };
}

function getDecision(ledger, modelId, date) {
  return ledger.entries.get(`${modelId}@${date}`) || null;
}

/**
 * A test row references the stored decision. The reference list is returned with any missing ids, so a test with
 * a dangling reference fails loudly.
 */
function referenceDecisions(ledger, { testId, modelId, dates }) {
  const rows = dates.map((date) => {
    const id = `${modelId}@${date}`;
    const record = ledger.entries.get(id) || null;
    return {
      test: testId,
      date,
      decision_id: id,
      saved: Boolean(record),
      outcome: record ? record.outcome : null,
      direction: record ? record.direction : null,
      trade_eligible: record ? record.trade_eligible : null,
    };
  });
  return { test: testId, model: modelId, rows, missing: rows.filter((row) => !row.saved).map((row) => row.decision_id) };
}

function isPresent(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.trim() !== "";
  return true;
}

function snapshotValues(session) {
  return { ...(session.saved_inputs || {}), ...(session.inputs || {}) };
}

function missingRequired(session, requiredFields) {
  const values = snapshotValues(session);
  return requiredFields.filter((field) => !isPresent(values[field]));
}

/**
 * Audit one stored record against the session, the registration and the required-input set.
 *
 * @param {object} options
 * @param {object} options.record the stored decision
 * @param {object} options.model the registered model declaration
 * @param {object} options.session the session the record was taken on
 * @param {string[]} options.requiredFields fields the executable trade rule says must be present
 * @param {"allowed"|null} [options.claim] an outcome the source artefact claims, when auditing a legacy morning
 */
function auditRecord({ record, model, session, requiredFields, claim }) {
  const findings = [];
  const add = (code, severity, message, extra) => findings.push({ code, severity, message, ...(extra || {}) });

  if (record.model.id !== model.id) {
    add("model_identity_mismatch", "error", `record names ${record.model.id}, registration is ${model.id}`);
  }
  if (record.model.version !== model.version || record.model.rulebook_version !== model.rulebook_version) {
    add("model_version_mismatch", "error", `record ${record.model.version} / ${record.model.rulebook_version}; registered ${model.version} / ${model.rulebook_version}`, {
      expected: `${model.version} / ${model.rulebook_version}`,
      found: `${record.model.version} / ${record.model.rulebook_version}`,
    });
  }
  if (session) {
    const expectedHash = snapshotHash(session);
    if (record.snapshot_sha256 !== expectedHash) {
      add("snapshot_drift", "error", "the stored record was not taken on the session snapshot supplied", {
        expected: expectedHash,
        found: record.snapshot_sha256,
      });
    }
    const missing = missingRequired(session, requiredFields || []);
    if (missing.length && (record.trade_eligible || record.outcome === "allowed" || (record.outcome === "abstained" && record.direction !== "NO_CALL"))) {
      const tradeRequired = record.trade_eligible && missing.length > 0;
      add(
        "missing_required_input",
        tradeRequired ? "error" : "warning",
        `${missing.length} required input${missing.length === 1 ? " is" : "s are"} absent from the snapshot under the declared field names on a ${record.outcome} morning`,
        { fields: missing }
      );
    }
  }
  if (record.trade_eligible && record.outcome !== "allowed") {
    add("trade_on_blocked_morning", "error", `a trade flag survives on a morning whose outcome is ${record.outcome}`);
  }
  if (claim && claim !== record.outcome) {
    add("claimed_outcome_mismatch", "error", `source claims ${claim}, engine record says ${record.outcome}`);
  }
  return { decision_id: decisionId(record), date: record.date, model_id: record.model.id, findings, clean: findings.length === 0 };
}

module.exports = {
  decisionId,
  createLedger,
  saveDecision,
  getDecision,
  referenceDecisions,
  auditRecord,
  missingRequired,
  snapshotValues,
};
