"use strict";

/**
 * Durable run ledger for the USD Layer 1 n8n backtester (research only).
 *
 * The n8n Cloud pair returns one paired record per morning. This module turns those records into a
 * restartable ledger: a record is keyed by the validation mode and the morning, so replaying a range,
 * re-ingesting a capture, or resuming after an interruption can never produce a second result for the
 * same morning. The first accepted record wins; a later attempt is counted, not appended.
 *
 * Every record is also checked against the committed panel and the local controller before it is saved
 * as a ledger row: the dataset join, a local replay of the same model over the same morning, the outcome
 * arithmetic, and the two child execution links. A failed check keeps the row visible with
 * `verified: false` instead of dropping it.
 *
 * Nothing here reads the network, the warehouse or a production path, and nothing here scores an edge.
 */

const crypto = require("node:crypto");

const RUN_LEDGER_VERSION = "usd-l1-n8n-run-ledger-v1";
const RECORD_SCHEMA = "usd-l1-n8n-cloud-execution-v1";
const MODEL_KEYS = Object.freeze(["challenger", "challenger_v1"]);
const VALIDATION_MODES = Object.freeze(["structural", "receipted"]);
const OUTCOMES = Object.freeze(["allowed", "abstained", "blocked"]);

function clone(value) {
  return JSON.parse(JSON.stringify(value === undefined ? null : value));
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

function isIsoDate(text) {
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const ms = Date.parse(`${text}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === text;
}

function recordKey({ date, validation_mode: validationMode } = {}) {
  if (!isIsoDate(date)) throw new Error(`record date must be YYYY-MM-DD, received ${JSON.stringify(date)}`);
  if (!VALIDATION_MODES.includes(validationMode)) {
    throw new Error(`record validation_mode must be structural or receipted, received ${JSON.stringify(validationMode)}`);
  }
  return `${validationMode}|${date}`;
}

function gateSummary(availability = {}) {
  return {
    accepted: availability.accepted === true,
    structural_accepted: availability.structural_accepted === true,
    reasons: Array.isArray(availability.reasons) ? clone(availability.reasons) : [],
    declared_inputs: availability.declared_inputs === undefined ? null : availability.declared_inputs,
    present_inputs: availability.present_inputs === undefined ? null : availability.present_inputs,
    missing_inputs: availability.missing_inputs === undefined ? null : availability.missing_inputs,
    missing_keys: clone(availability.missing_keys || []),
    stamped_before_cutoff: availability.stamped_before_cutoff === undefined ? null : availability.stamped_before_cutoff,
    receipted_complete: availability.receipted_complete === true,
    unclocked_keys: clone(availability.unclocked_keys || [])
  };
}

function callSummary(model) {
  const decision = model && model.decision;
  if (!decision) throw new Error("a paired record is missing a child decision");
  const call = decision.call || {};
  return {
    identity: model.identity || null,
    model: decision.model || null,
    model_version: decision.model_version || null,
    status: decision.status || null,
    direction: call.direction || null,
    conviction: call.conviction === undefined ? null : call.conviction,
    reason: call.reason || null,
    results: decision.results ? clone(decision.results) : null,
    outcomes: decision.outcomes ? clone(decision.outcomes) : null
  };
}

/** Shape one n8n paired record into a ledger row, without deciding whether it is correct. */
function normaliseRecord(record) {
  if (!record || typeof record !== "object") throw new Error("a paired record must be an object");
  if (record.schema_version && record.schema_version !== RECORD_SCHEMA) {
    throw new Error(`unexpected paired record schema ${record.schema_version}; expected ${RECORD_SCHEMA}`);
  }
  const key = recordKey(record);
  const models = record.models || {};
  for (const model of MODEL_KEYS) {
    if (!models[model]) throw new Error(`${key} is missing the ${model} child`);
  }
  const challenger = callSummary(models.challenger);
  const challengerV1 = callSummary(models.challenger_v1);
  const outcome = challenger.status;
  if (!OUTCOMES.includes(outcome)) throw new Error(`${key} carries an unknown outcome ${JSON.stringify(outcome)}`);
  return {
    key,
    date: record.date,
    validation_mode: record.validation_mode,
    outcome,
    calls: { challenger, challenger_v1: challengerV1 },
    gate: gateSummary(record.input_availability),
    comparison: record.comparison ? clone(record.comparison) : null,
    dataset: {
      path: record.dataset && record.dataset.path ? record.dataset.path : null,
      run_version: record.dataset ? record.dataset.run_version || null : null,
      generated_at: record.dataset ? record.dataset.generated_at || null : null
    },
    executions: {
      parent: {
        id: record.n8n && record.n8n.execution_id ? String(record.n8n.execution_id) : null,
        url: record.n8n && record.n8n.execution_url ? record.n8n.execution_url : null,
        workflow_id: record.n8n && record.n8n.workflow_id ? record.n8n.workflow_id : null
      },
      challenger: {
        id: models.challenger.execution_id ? String(models.challenger.execution_id) : null,
        url: models.challenger.execution_url || null,
        workflow_id: models.challenger.workflow_id || null
      },
      challenger_v1: {
        id: models.challenger_v1.execution_id ? String(models.challenger_v1.execution_id) : null,
        url: models.challenger_v1.execution_url || null,
        workflow_id: models.challenger_v1.workflow_id || null
      }
    }
  };
}

function sameJson(left, right) {
  return canonical(left) === canonical(right);
}

/**
 * Verify a ledger row against the committed panel and the local controller.
 *
 * `dataset` is the same `run-v1.json` the n8n parent fetches. A row whose date is absent from the panel
 * is replayed as the controller's own missing-date decision, so an absent date is a recorded refusal
 * rather than an unexplained block.
 */
function verifyRecord(row, dataset) {
  const controller = require("../backtester/lib/usd_layer1_backtester/backtest_controller");
  const sessions = Array.isArray(dataset && dataset.sessions) ? dataset.sessions : [];
  const session = sessions.find((entry) => entry && entry.date === row.date) || null;
  const checks = [];
  const mismatches = [];

  checks.push({
    name: "dataset_join",
    ok: true,
    detail: session
      ? `${row.date} is in the committed panel`
      : `${row.date} is absent from the committed panel; a not_in_dataset refusal is expected`
  });

  for (const model of MODEL_KEYS) {
    const recorded = row.calls[model];
    const local = controller.runBacktest({
      dataset,
      datasetPath: row.dataset.path,
      model,
      dates: [row.date],
      validationMode: row.validation_mode,
      includeDecisions: true
    });
    const decision = local.decisions[0];
    const localCall = decision.call || {};
    const localReasons = (decision.validation.reasons || []).map((reason) => reason.code).sort();
    const recordedReasons = (row.gate.reasons || []).slice().sort();
    const fields = [
      ["status", recorded.status, decision.status],
      ["direction", recorded.direction, localCall.direction],
      ["conviction", recorded.conviction, localCall.conviction === undefined ? null : localCall.conviction]
    ];
    const differences = fields.filter(([, recordedValue, localValue]) => !sameJson(recordedValue, localValue));
    if (!sameJson(recordedReasons, localReasons)) differences.push(["gate_reasons", recordedReasons, localReasons]);
    checks.push({
      name: `local_replay_${model}`,
      ok: differences.length === 0,
      detail: differences.length === 0
        ? `${row.date} ${model} matches the local controller (${decision.status}, ${localCall.direction || "NO_CALL"})`
        : `${row.date} ${model} differs from the local controller: ${differences
          .map(([field, recordedValue, localValue]) => `${field} ${JSON.stringify(recordedValue)} != ${JSON.stringify(localValue)}`)
          .join("; ")}`
    });
    for (const [field, recordedValue, localValue] of differences) {
      mismatches.push({ check: `local_replay_${model}`, field, recorded: recordedValue, local: localValue });
    }

    if (recorded.results) {
      const recomputed = controller.scoreCall(recorded.direction, session ? session.outcomes : null);
      const ok = sameJson(recorded.results, recomputed);
      checks.push({
        name: `outcome_arithmetic_${model}`,
        ok,
        detail: ok
          ? `${row.date} ${model} hit/miss/flat recomputes from the stored call and the panel`
          : `${row.date} ${model} stored results do not recompute from the stored call and the panel`
      });
      if (!ok) {
        mismatches.push({ check: `outcome_arithmetic_${model}`, field: "results", recorded: recorded.results, local: recomputed });
      }
    } else {
      const ok = recorded.status === "blocked";
      checks.push({
        name: `outcome_arithmetic_${model}`,
        ok,
        detail: ok
          ? `${row.date} ${model} is blocked and carries no result to score`
          : `${row.date} ${model} is ${recorded.status} but carries no result`
      });
      if (!ok) mismatches.push({ check: `outcome_arithmetic_${model}`, field: "results", recorded: null, local: "expected results" });
    }
  }

  const v0 = row.executions.challenger.id;
  const v1 = row.executions.challenger_v1.id;
  const linksOk = Boolean(v0 && v1 && v0 !== v1 && row.executions.parent.id);
  checks.push({
    name: "execution_links",
    ok: linksOk,
    detail: linksOk
      ? `parent ${row.executions.parent.id}, challenger ${v0}, challenger_v1 ${v1}`
      : "a paired record must carry a parent execution and two distinct child executions"
  });
  if (!linksOk) mismatches.push({ check: "execution_links", field: "executions", recorded: row.executions, local: "expected three ids" });

  const directionsAgree = row.calls.challenger.direction === row.calls.challenger_v1.direction;
  const gateOk = (row.gate.reasons || []).length > 0 || row.gate.declared_inputs !== null;
  checks.push({
    name: "gate_recorded",
    ok: gateOk,
    detail: gateOk
      ? `${row.date} ${row.validation_mode} gate: accepted=${row.gate.accepted}, ${row.gate.present_inputs}/${row.gate.declared_inputs} inputs present`
      : `${row.date} records no input-availability gate`
  });
  if (!gateOk) mismatches.push({ check: "gate_recorded", field: "gate", recorded: row.gate, local: "expected a recorded gate" });

  if (row.comparison && row.comparison.same_direction !== undefined) {
    const ok = row.comparison.same_direction === directionsAgree;
    checks.push({
      name: "comparison_consistency",
      ok,
      detail: ok
        ? `${row.date} same_direction=${directionsAgree} matches the two child calls`
        : `${row.date} comparison.same_direction disagrees with the two child calls`
    });
    if (!ok) mismatches.push({ check: "comparison_consistency", field: "same_direction", recorded: row.comparison.same_direction, local: directionsAgree });
  }

  return { verified: mismatches.length === 0, checks, mismatches };
}

function emptyLedger({ instance = null } = {}) {
  return {
    schema_version: RUN_LEDGER_VERSION,
    instance,
    dataset: { path: null, run_version: null, generated_at: null },
    updated_at: null,
    runs: [],
    records: []
  };
}

function sortRecords(records) {
  return records.slice().sort((left, right) => (left.date === right.date
    ? left.validation_mode.localeCompare(right.validation_mode)
    : left.date.localeCompare(right.date)));
}

function sortRuns(runs) {
  return runs.slice().sort((left, right) => String(left.run_id).localeCompare(String(right.run_id)));
}

/** A stable id for one ingest: the parent execution plus the keys it returned. */
function runIdFor({ executionId = null, keys = [] } = {}) {
  return sha256(canonical({ execution_id: executionId, keys: keys.slice().sort() })).slice(0, 16);
}

/**
 * Merge paired records into a ledger without duplicating a morning.
 *
 * Returns the merged ledger, the rows that were added, and the rows already present. `duplicates` is the
 * restart-recovery evidence: a second ingest of the same captures adds nothing and leaves the ledger
 * unchanged, so a resumed batch cannot double-count a morning.
 */
function mergeLedger(ledger, { records = [], dataset = null, capturedAt = null, label = null } = {}) {
  const base = ledger ? clone(ledger) : emptyLedger();
  if (base.schema_version !== RUN_LEDGER_VERSION) {
    throw new Error(`unexpected ledger schema ${base.schema_version}; expected ${RUN_LEDGER_VERSION}`);
  }
  const existing = new Map(base.records.map((row) => [row.key, row]));
  const added = [];
  const duplicates = [];
  const rejected = [];
  const requestedKeys = [];

  for (const record of records) {
    let row;
    try {
      row = normaliseRecord(record);
      requestedKeys.push(row.key);
    } catch (error) {
      rejected.push({ reason: error.message });
      continue;
    }
    if (existing.has(row.key)) {
      duplicates.push({
        key: row.key,
        kept_execution: existing.get(row.key).executions.parent.id,
        seen_execution: row.executions.parent.id
      });
      continue;
    }
    row.verification = verifyRecord(row, dataset || { sessions: [] });
    existing.set(row.key, row);
    added.push({ key: row.key, verified: row.verification.verified });
  }

  const executionId = records.length > 0 && records[0].n8n ? records[0].n8n.execution_id : null;
  const run = {
    // The id covers the parent execution and every key the capture asked for, so re-ingesting the same
    // capture is recognised as the same run. A genuinely new execution (a restart) gets its own row even
    // when every morning in it is a duplicate.
    run_id: runIdFor({ executionId, keys: requestedKeys }),
    label: label || null,
    captured_at: capturedAt,
    execution_id: executionId ? String(executionId) : null,
    validation_modes: Array.from(new Set(requestedKeys.map((key) => key.split("|")[0]))).sort(),
    requested_keys: requestedKeys,
    added_keys: added.map((entry) => entry.key),
    duplicate_keys: duplicates.map((entry) => entry.key),
    rejected: rejected.length
  };
  const runs = base.runs.some((entry) => entry.run_id === run.run_id) ? base.runs : base.runs.concat([run]);

  const merged = Object.assign({}, base, {
    dataset: dataset && dataset.sessions
      ? {
        path: base.dataset.path || null,
        run_version: (dataset.run && dataset.run.run_version) || base.dataset.run_version || null,
        generated_at: dataset.generated_at || base.dataset.generated_at || null
      }
      : base.dataset,
    records: sortRecords(Array.from(existing.values())),
    runs: sortRuns(runs)
  });
  if (added.length > 0) merged.updated_at = capturedAt;
  return { ledger: merged, added, duplicates, rejected, run };
}



/** All weekdays in an inclusive range, so a plan can name a morning the panel may not hold. */
function planRange({ from, to } = {}) {
  if (!isIsoDate(from) || !isIsoDate(to)) throw new Error("from and to must be YYYY-MM-DD");
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (end < start) throw new Error("to must not be before from");
  const dates = [];
  for (let ms = start; ms <= end; ms += 24 * 60 * 60 * 1000) {
    const day = new Date(ms).getUTCDay();
    if (day >= 1 && day <= 5) dates.push(new Date(ms).toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * The restart plan: what is already durable, what is still missing, and the next morning to run.
 * A captured record is complete only when its verification passed; a failed row is re-requested rather
 * than trusted.
 */
function resumePlan(ledger, { dates = [], validation_mode: validationMode = "structural" } = {}) {
  if (!VALIDATION_MODES.includes(validationMode)) throw new Error(`unknown validation mode ${validationMode}`);
  const wanted = dates.slice();
  for (const date of wanted) {
    if (!isIsoDate(date)) throw new Error(`plan date must be YYYY-MM-DD, received ${JSON.stringify(date)}`);
  }
  const rows = new Map((ledger && ledger.records ? ledger.records : [])
    .filter((row) => row.validation_mode === validationMode)
    .map((row) => [row.date, row]));
  const complete = [];
  const missing = [];
  const unverified = [];
  for (const date of wanted) {
    const row = rows.get(date);
    if (!row) missing.push(date);
    else if (!row.verification || row.verification.verified !== true) unverified.push(date);
    else complete.push(date);
  }
  const remaining = missing.concat(unverified).sort();
  return {
    validation_mode: validationMode,
    requested: wanted.length,
    complete,
    missing,
    unverified,
    remaining: remaining.length,
    next_date: remaining[0] || null
  };
}

function summarise(ledger) {
  const rows = (ledger && ledger.records) || [];
  const byMode = {};
  for (const mode of VALIDATION_MODES) {
    const selected = rows.filter((row) => row.validation_mode === mode);
    byMode[mode] = {
      records: selected.length,
      allowed: selected.filter((row) => row.outcome === "allowed").length,
      abstained: selected.filter((row) => row.outcome === "abstained").length,
      blocked: selected.filter((row) => row.outcome === "blocked").length,
      verified: selected.filter((row) => row.verification && row.verification.verified === true).length,
      failed_verification: selected.filter((row) => !row.verification || row.verification.verified !== true).length,
      scored: selected.filter((row) => row.calls.challenger.results
        && Object.values(row.calls.challenger.results).some((result) => ["hit", "miss", "flat"].includes(result))).length
    };
  }
  return {
    schema_version: (ledger && ledger.schema_version) || RUN_LEDGER_VERSION,
    records: rows.length,
    dates: Array.from(new Set(rows.map((row) => row.date))).sort(),
    earliest: rows.length ? rows.map((row) => row.date).sort()[0] : null,
    latest: rows.length ? rows.map((row) => row.date).sort().slice(-1)[0] : null,
    runs: ((ledger && ledger.runs) || []).length,
    duplicates_prevented: ((ledger && ledger.runs) || []).reduce((total, run) => total + (run.duplicate_keys || []).length, 0),
    by_validation_mode: byMode
  };
}

/** Rows in date order for a dashboard table; no second score is computed here. */
function rowsForView(ledger, validationMode = "structural") {
  return ((ledger && ledger.records) || [])
    .filter((row) => row.validation_mode === validationMode)
    .map((row) => ({
      key: row.key,
      date: row.date,
      outcome: row.outcome,
      verified: Boolean(row.verification && row.verification.verified),
      challenger: row.calls.challenger.direction,
      challenger_v1: row.calls.challenger_v1.direction,
      agreement: row.calls.challenger.direction === row.calls.challenger_v1.direction,
      hits: row.calls.challenger.results
        ? Object.values(row.calls.challenger.results).filter((result) => result === "hit").length
        : null,
      scored: row.calls.challenger.results
        ? Object.values(row.calls.challenger.results).filter((result) => ["hit", "miss", "flat"].includes(result)).length
        : 0,
      parent_execution: row.executions.parent
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

module.exports = {
  RUN_LEDGER_VERSION,
  RECORD_SCHEMA,
  MODEL_KEYS,
  VALIDATION_MODES,
  recordKey,
  normaliseRecord,
  verifyRecord,
  emptyLedger,
  mergeLedger,
  runIdFor,
  planRange,
  resumePlan,
  summarise,
  rowsForView
};
