/**
 * One decision engine for every Layer 1 backtest.
 *
 * The engine owns the part of a decision that must never differ between a control and a candidate:
 *
 *   1. the session contract (asset, session, version stamps);
 *   2. the data gate;
 *   3. a model-declared, ordered check chain;
 *   4. the outcome (blocked / abstained / allowed) derived from that chain;
 *   5. the policy arithmetic the model declares, and only when the morning is not blocked;
 *   6. an immutable decision record with a stable id and an input snapshot hash.
 *
 * A model supplies declarations, never a second engine: `gate`, `checkChain` and `policy` are functions the
 * model spec provides, and this file is their only caller. Research only: nothing here reads the network, the
 * warehouse or a production path.
 */
"use strict";

const crypto = require("node:crypto");

const ENGINE_VERSION = "layer1-decision-engine-v1";
const OUTCOMES = Object.freeze(["blocked", "abstained", "allowed"]);

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Hash a source file by its canonical text, not by the checkout's line endings.
 *
 * A payload checked in on one platform must reproduce on another. `core.autocrlf` can turn LF into CRLF
 * without changing a byte of meaning, so every source digest normalises CRLF to LF before hashing and
 * records the canonical byte length beside it.
 */
function canonicalText(text) {
  return String(text).replace(/\r\n/g, "\n");
}

function hashTextFile(buffer) {
  const text = canonicalText(buffer.toString("utf8"));
  return { bytes: Buffer.byteLength(text, "utf8"), sha256: sha256(text) };
}

/** The snapshot a decision was taken on. Both models replay the same morning, so they share this hash. */
function snapshotHash(session) {
  return sha256(
    stableStringify({
      date: session.date,
      cutoff_at_utc: session.cutoff_at_utc,
      inputs: session.inputs || null,
      saved_inputs: session.saved_inputs || null,
      audit_values: session.audit_values || null,
      input_meta: session.input_meta || null,
    })
  );
}

function assertModel(model) {
  if (!model || typeof model !== "object") throw new Error("engine: a model definition is required");
  for (const field of ["id", "label", "role", "asset", "version", "session"]) {
    if (!model[field]) throw new Error(`engine: model is missing ${field}`);
  }
  if (!["control", "candidate"].includes(model.role)) {
    throw new Error(`engine: model ${model.id} declares an unknown role ${model.role}`);
  }
  if (typeof model.gate !== "function") throw new Error(`engine: model ${model.id} declares no gate`);
  if (!Array.isArray(model.checkChain)) throw new Error(`engine: model ${model.id} declares no check chain`);
  if (typeof model.policy !== "function") throw new Error(`engine: model ${model.id} declares no policy`);
  const ids = new Set();
  for (const check of model.checkChain) {
    if (!check.id || !check.name) throw new Error(`engine: model ${model.id} has an unnamed check`);
    if (ids.has(check.id)) throw new Error(`engine: model ${model.id} repeats check ${check.id}`);
    if (!["block", "abstain"].includes(check.on_fail)) {
      throw new Error(`engine: check ${check.id} must declare on_fail block or abstain`);
    }
    if (typeof check.evaluate !== "function") throw new Error(`engine: check ${check.id} has no evaluate`);
    ids.add(check.id);
  }
}

function assertSession(model, session) {
  if (!session || typeof session !== "object") throw new Error("engine: a session is required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(session.date))) {
    throw new Error("engine: the session needs a YYYY-MM-DD date");
  }
  if (session.asset && session.asset !== model.asset) {
    throw new Error(`engine: session asset ${session.asset} does not match model asset ${model.asset}`);
  }
}

/**
 * Run one morning through one model. Pure: the same model and session always produce the same record.
 *
 * @param {object} model a declaration from lib/layer1_backtesting/models.js
 * @param {object} session the morning: date, cutoff, inputs and whatever facts the model's checks read
 * @returns {object} the decision record
 */
function decide(model, session) {
  assertModel(model);
  assertSession(model, session);

  const gate = model.gate(session);
  const snapshot_sha256 = snapshotHash(session);

  const checks = model.checkChain.map((check) => {
    const result = check.evaluate(session, { gate }) || {};
    return {
      id: check.id,
      name: check.name,
      on_fail: check.on_fail,
      // `null` means "not evaluated" (for example, a check whose evidence gate is closed). Coercing it with
      // Boolean would turn that into a failure and manufacture a second, misleading reason for the block.
      passed: result.passed === undefined || result.passed === null ? null : Boolean(result.passed),
      detail: result.detail || null,
      offenders: Array.isArray(result.offenders) ? result.offenders.slice() : [],
      rule_ids: Array.isArray(result.rule_ids) ? result.rule_ids.slice() : [],
    };
  });

  const blocking = checks.filter((check) => check.passed === false && check.on_fail === "block");
  const abstaining = checks.filter((check) => check.passed === false && check.on_fail === "abstain");

  let outcome;
  if (gate.ready !== true || blocking.length) outcome = "blocked";
  else if (abstaining.length) outcome = "abstained";
  else outcome = "allowed";
  if (!OUTCOMES.includes(outcome)) throw new Error(`engine: impossible outcome ${outcome}`);

  let policy = {
    direction: "NO_CALL",
    conviction: null,
    band: null,
    trade: false,
    eligibility: { eligible: false, note: "no policy was run" },
    reasons: [],
  };
  if (outcome !== "blocked") policy = model.policy(session, { gate, checks });

  const reasons = [];
  for (const line of gate.reasons || []) reasons.push({ source: "gate", code: gate.code || "gate", text: line });
  for (const check of blocking.concat(abstaining)) {
    reasons.push({
      source: "check",
      code: check.id,
      text: check.detail || `${check.name} did not pass`,
      offenders: check.offenders,
    });
  }
  for (const line of policy.reasons || []) {
    reasons.push({ source: "policy", code: line.code || "policy", text: line.text || String(line) });
  }

  const record = {
    engine_version: ENGINE_VERSION,
    decision_id: `${model.asset}|${model.id}|${model.version}|${session.date}`,
    asset: model.asset,
    date: session.date,
    session: {
      contract: model.session,
      cutoff_at_utc: session.cutoff_at_utc || null,
      window_hours: session.window_hours === undefined ? null : session.window_hours,
    },
    model: {
      id: model.id,
      label: model.label,
      role: model.role,
      version: model.version,
      rulebook_version: model.rulebook_version || null,
      research_only: model.research_only !== false,
    },
    identity: model.identity ? model.identity(session) : { status: "not_declared", unresolved: [] },
    outcome,
    direction: policy.direction,
    conviction: policy.conviction === undefined ? null : policy.conviction,
    band: policy.band === undefined ? null : policy.band,
    // A blocked or abstained morning is never trade eligible, whatever the policy says.
    trade_eligible: outcome === "allowed" ? Boolean(policy.trade) : false,
    eligibility: policy.eligibility || { eligible: false, note: "not declared" },
    gate,
    checks,
    reasons,
    // The policy may expose its own arithmetic trace. A blocked morning has no policy trace: its trace is the
    // gate's ordered obstruction list, which is already in `gate.trace`.
    trace: policy.trace === undefined ? null : policy.trace,
    snapshot_sha256,
    evidence: model.evidence || [],
  };

  return deepFreeze(record);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

/**
 * Compare an engine record with a published decision.
 *
 * The engine is deliberately stricter than the published artefacts: it refuses to publish a direction, a band
 * or a trade flag on a blocked morning. `engine_stricter` marks exactly those cases so a run check can count
 * them instead of hiding them.
 */
function reconcile(record, published) {
  const fields = [];
  const add = (field, engineValue, publishedValue) => {
    // A field the artefact never published is not a disagreement: it is reported as unpublished and excluded
    // from the counts, so a model is never marked wrong for a figure that was never claimed.
    if (publishedValue === undefined) {
      fields.push({ field, engine: engineValue, published: null, status: "not_published" });
      return;
    }
    const same = JSON.stringify(engineValue) === JSON.stringify(publishedValue);
    let status = "match";
    if (!same) {
      const engineWithheld =
        record.outcome === "blocked" &&
        (engineValue === null || engineValue === "NO_CALL" || engineValue === false) &&
        publishedValue !== null &&
        publishedValue !== "NO_CALL" &&
        publishedValue !== false;
      status = engineWithheld ? "engine_stricter" : "mismatch";
    }
    fields.push({ field, engine: engineValue, published: publishedValue === undefined ? null : publishedValue, status });
  };
  add("outcome", record.outcome, published.outcome);
  add("direction", record.direction, published.direction);
  add("band", record.band, published.band);
  add("trade", record.trade_eligible, published.trade);
  const compared = fields.filter((field) => field.status !== "not_published");
  const stricter = compared.filter((field) => field.status === "engine_stricter").length;
  const mismatch = compared.filter((field) => field.status === "mismatch").length;
  return {
    decision_id: record.decision_id,
    date: record.date,
    model_id: record.model.id,
    matches: mismatch === 0,
    compared_fields: compared.length,
    unpublished_fields: fields.length - compared.length,
    mismatch_count: mismatch,
    stricter_count: stricter,
    fields,
  };
}

module.exports = {
  ENGINE_VERSION,
  OUTCOMES,
  decide,
  reconcile,
  snapshotHash,
  stableStringify,
  sha256,
  canonicalText,
  hashTextFile,
};
