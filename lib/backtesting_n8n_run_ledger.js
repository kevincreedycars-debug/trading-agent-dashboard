"use strict";

/**
 * Durable run ledger for the USD Layer 1 n8n backtester (research only).
 *
 * The n8n Cloud controller returns one record per morning for whatever set of registered models the run
 * selected. This module turns those records into a restartable ledger. A record is keyed by the validation
 * mode and the morning, so replaying a range, re-ingesting a capture, or resuming after an interruption can
 * never produce a second result for the same morning **under the same experiment configuration**. A run
 * whose declared configuration differs (different models, model or bundle version, validation policy,
 * test configuration, cutoff or input snapshot) becomes a second, separately keyed row: identical retries
 * deduplicate, changed configurations coexist and are never silently merged.
 *
 * Verification separates four claims, because they rest on different evidence:
 *   - consistency   - the stored call reproduces in the local controller and the stored hit/miss arithmetic
 *                     recomputes from the committed panel. This is what `verified` means.
 *   - availability  - whether the child actually retrieved its historical inputs. A replay cannot establish
 *                     that, so it is reported as not established unless a retrieval receipt is present.
 *   - logic         - whether the model's rules are correct. There is no independent oracle, so parity with
 *                     the same code is not evidence of correct logic.
 *   - coverage      - whether the panel the child replayed is the panel a live morning would have offered.
 *
 * Nothing here reads the network, the warehouse or a production path, and nothing here scores an edge.
 */

const crypto = require("node:crypto");
const registry = require("../backtester/lib/usd_layer1_backtester/model_registry");

const RUN_LEDGER_VERSION = "usd-l1-n8n-run-ledger-v2";
const RECORD_SCHEMAS = Object.freeze(["usd-l1-n8n-cloud-execution-v1", "usd-l1-n8n-cloud-execution-v2"]);
const CONFIGURATION_SCHEMA = "usd-l1-experiment-configuration-v1";
/** The registry default, kept as an export so an older caller cannot run an unknown model by accident. */
const MODEL_KEYS = registry.DEFAULT_SELECTION;
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

function sameJson(left, right) {
  return canonical(left) === canonical(right);
}

function isIsoDate(text) {
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const ms = Date.parse(`${text}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === text;
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

/** One model's call, with the registry-owned role so a fixture can never be read as a book. */
function callSummary(key, model) {
  const decision = model && model.decision;
  if (!decision) throw new Error(`a paired record is missing the ${key} child decision`);
  const call = decision.call || {};
  const entry = registry.getModel(key);
  return {
    key,
    identity: model.identity || (entry ? entry.identity : null),
    label: model.label || (entry ? entry.label : null),
    role: model.role || (entry ? entry.role : "challenger"),
    kind: model.kind || (entry ? entry.kind : (model.fixture ? "fixture" : "research")),
    fixture: model.fixture === true || (model.kind || (entry ? entry.kind : null)) === "fixture",
    model: decision.model || null,
    model_version: decision.model_version || (entry ? entry.version : null),
    status: decision.status || null,
    direction: call.direction || null,
    conviction: call.conviction === undefined ? null : call.conviction,
    reason: call.reason || null,
    ...(decision.tests ? { tests: clone(decision.tests) } : {}),
    results: decision.results ? clone(decision.results) : null,
    outcomes: decision.outcomes ? clone(decision.outcomes) : null
  };
}


function selectionOf(record) {
  const models = record.models || {};
  const declared = Array.isArray(record.selection) && record.selection.length > 0
    ? record.selection.slice()
    : Object.keys(models);
  if (declared.length === 0) throw new Error("a paired record must name at least one model");
  const duplicate = declared.find((key, index) => declared.indexOf(key) !== index);
  if (duplicate) throw new Error(`a paired record names the model ${duplicate} twice`);
  for (const key of declared) {
    if (!models[key]) throw new Error(`${record.date} declares the model ${key} but carries no decision for it`);
  }
  return declared;
}

/** The input snapshot digest: what the child actually replayed for these mornings. */
function inputSnapshotDigest(dataset, dates) {
  const sessions = Array.isArray(dataset && dataset.sessions) ? dataset.sessions : [];
  const byDate = new Map(sessions.map((session) => [session && session.date, session]));
  const snapshot = dates.map((date) => {
    const session = byDate.get(date);
    if (!session) return { date, present: false };
    return {
      date,
      present: true,
      cutoff: session.cutoff_at_utc || null,
      values: session.values || null,
      outcomes: session.outcomes || null
    };
  });
  return sha256(canonical({ dataset: dataset && dataset.run ? dataset.run.run_version : null, snapshot }));
}

/**
 * The experiment configuration: everything that must match for two records to be the same experiment.
 * Two records with the same declaration are the same experiment retried; anything that differs makes a
 * different experiment that is allowed to coexist.
 */
function configurationFor(row, { dataset = null } = {}) {
  const identity = row.identity || {};
  const identityInput = identity.input || {};
  const dates = Array.isArray(identityInput.dates) && identityInput.dates.length > 0 ? identityInput.dates : [row.date];
  const declared = {
    schema_version: CONFIGURATION_SCHEMA,
    selection: row.selection.slice(),
    models: row.selection.reduce((map, key) => {
      const call = row.calls[key];
      map[key] = {
        identity: call.identity,
        version: call.model_version,
        role: call.role,
        kind: call.kind
      };
      return map;
    }, {}),
    validation_mode: row.validation_mode,
    validation_policy: identity.validation_policy || { mode: row.validation_mode },
    // Only the code identity that can change a decision is fingerprinted; the per-file hash list is
    // manifest metadata and is deliberately excluded so a row stays verifiable after compaction.
    code: identity.code ? {
      bundle_version: identity.code.bundle_version || null,
      bundle_sha256: identity.code.bundle_sha256 || null,
      controller_version: identity.code.controller_version || null
    } : null,
    registry: row.registry ? { version: row.registry.version, fingerprint: row.registry.fingerprint } : null,
    input: {
      dataset_path: identityInput.dataset_path || row.dataset.path || null,
      dataset_run_version: identityInput.dataset_run_version || row.dataset.run_version || null,
      dates,
      snapshot_digest: dataset ? inputSnapshotDigest(dataset, dates) : (identityInput.snapshot_digest || row.input_snapshot_digest || null)
    },
    cutoff: identity.cutoff || null,
    test_configuration: identity.test_configuration || null
  };
  return { fingerprint: sha256(canonical(declared)).slice(0, 16), declared };
}


/**
 * Keep a persisted row lean without losing anything the ledger needs.
 *
 * The full decision (each model's written reason and per-market outcome objects) is already stored in the
 * per-request capture beside the ledger, and the per-file source hashes are in the checked-in manifest. The
 * row keeps what verification, reporting and the dashboard actually read: the call, its four results, the
 * gate, the experiment identity and its fingerprint. A 725-morning ledger stays reviewable instead of
 * growing past the point where a reader can open it.
 */
function compactRow(row) {
  const lean = clone(row);
  for (const key of Object.keys(lean.calls || {})) {
    delete lean.calls[key].reason;
    delete lean.calls[key].outcomes;
  }
  if (lean.identity) {
    if (lean.identity.code) delete lean.identity.code.source_files;
    if (lean.identity.input) delete lean.identity.input.batch_requested_dates;
  }
  if (lean.configuration) {
    // Recompute from the compacted row so the fingerprint is stable whether or not the panel is present.
    lean.configuration = {
      schema_version: CONFIGURATION_SCHEMA,
      fingerprint: configurationFor(lean).fingerprint
    };
  }
  if (lean.gate_by_model) {
    const same = Object.keys(lean.gate_by_model).every((key) => sameJson(lean.gate_by_model[key], lean.gate));
    if (same) delete lean.gate_by_model;
  }
  if (lean.comparison) {
    lean.comparison = {
      same_direction: lean.comparison.same_direction === undefined ? null : lean.comparison.same_direction,
      research_models: lean.comparison.research_models || [],
      fixture_models: lean.comparison.fixture_models || [],
      models: lean.comparison.models || null
    };
  }
  if (lean.verification && lean.verification.claims) {
    lean.verification.claims = Object.keys(lean.verification.claims).reduce((map, key) => {
      map[key] = {
        claim: lean.verification.claims[key].claim,
        status: lean.verification.claims[key].status
      };
      return map;
    }, {});
  }
  if (lean.verification) {
    lean.verification.checks = (lean.verification.checks || []).map((check) => (check.ok
      ? { name: check.name, ok: true }
      : check));
  }
  return lean;
}

/** Shape one n8n record into a ledger row, without deciding whether it is correct. */
function normaliseRecord(record, { dataset = null } = {}) {
  if (!record || typeof record !== "object") throw new Error("a paired record must be an object");
  if (record.schema_version && !RECORD_SCHEMAS.includes(record.schema_version)) {
    throw new Error(`unexpected paired record schema ${record.schema_version}; expected one of ${RECORD_SCHEMAS.join(", ")}`);
  }
  if (!VALIDATION_MODES.includes(record.validation_mode)) {
    throw new Error(`record validation_mode must be structural or receipted, received ${JSON.stringify(record.validation_mode)}`);
  }
  if (!isIsoDate(record.date)) throw new Error(`record date must be YYYY-MM-DD, received ${JSON.stringify(record.date)}`);
  const models = record.models || {};
  const selection = selectionOf(record);
  const calls = {};
  for (const key of selection) calls[key] = callSummary(key, models[key]);
  const modelOutcomes = selection.reduce((map, key) => {
    map[key] = calls[key].status;
    return map;
  }, {});
  const outcome = modelOutcomes[selection[0]];
  if (!OUTCOMES.includes(outcome)) throw new Error(`${record.date} carries an unknown outcome ${JSON.stringify(outcome)}`);
  const children = {};
  for (const key of selection) {
    const model = models[key];
    children[key] = {
      id: model.execution_id ? String(model.execution_id) : null,
      url: model.execution_url || null,
      workflow_id: model.workflow_id || null
    };
  }
  const identity = record.identity ? clone(record.identity) : null;
  if (identity && identity.models) {
    // The registry owns the input keys; the row keeps the declaration that matters for identity and
    // lets a reader resolve the full contract from the registry fingerprint.
    for (const key of Object.keys(identity.models)) delete identity.models[key].input_keys;
  }
  const row = {
    key: `${record.validation_mode}|${record.date}`,
    date: record.date,
    validation_mode: record.validation_mode,
    selection: selection.slice(),
    outcome,
    model_outcomes: modelOutcomes,
    calls,
    gate: gateSummary(record.input_availability),
    gate_by_model: record.input_availability_by_model
      ? Object.keys(record.input_availability_by_model).reduce((map, key) => {
        map[key] = gateSummary(record.input_availability_by_model[key]);
        return map;
      }, {})
      : null,
    comparison: record.comparison ? clone(record.comparison) : null,
    dataset: {
      path: record.dataset && record.dataset.path ? record.dataset.path : null,
      run_version: record.dataset ? record.dataset.run_version || null : null,
      generated_at: record.dataset ? record.dataset.generated_at || null : null
    },
    identity,
    registry: record.registry ? clone(record.registry) : null,
    executions: Object.assign({
      parent: {
        id: record.n8n && record.n8n.execution_id ? String(record.n8n.execution_id) : null,
        url: record.n8n && record.n8n.execution_url ? record.n8n.execution_url : null,
        workflow_id: record.n8n && record.n8n.workflow_id ? record.n8n.workflow_id : null
      },
      children
    }, children),
    duplicate_of: null,
    configuration_key: null
  };
  row.configuration = configurationFor(row, { dataset });
  // The digest is persisted with the row so the same fingerprint can be recomputed without the panel.
  row.input_snapshot_digest = row.configuration.declared.input.snapshot_digest || null;
  if (identity && identity.input && row.input_snapshot_digest) {
    row.identity.input.snapshot_digest = row.input_snapshot_digest;
  }
  return compactRow(row);
}

/**
 * The base key is the validation mode and the morning. A record whose configuration differs from the row
 * already held for that morning is stored under a suffixed key so both experiments stay visible.
 */
function recordKey({ date, validation_mode: validationMode } = {}) {
  if (!isIsoDate(date)) throw new Error(`record date must be YYYY-MM-DD, received ${JSON.stringify(date)}`);
  if (!VALIDATION_MODES.includes(validationMode)) {
    throw new Error(`record validation_mode must be structural or receipted, received ${JSON.stringify(validationMode)}`);
  }
  return `${validationMode}|${date}`;
}

function coexistenceKey(baseKey, fingerprint) {
  return `${baseKey}#${String(fingerprint || "unknown").slice(0, 8)}`;
}


/** The claims a row can and cannot support, kept apart so a badge cannot conflate them. */
function claimsFor(row, consistency) {
  const availability = row.gate || {};
  return {
    consistency: {
      claim: "replay_consistency",
      status: consistency ? "established" : "failed",
      statement: "The stored call reproduces in the local controller from the same saved morning, and the stored hit/miss/flat arithmetic recomputes from the stored call and the committed outcomes."
    },
    availability: {
      claim: "historical_input_availability",
      status: "not_established",
      reason: "The n8n child replayed the values saved in the committed panel. No source retrieval, receipt archive or provider response is recorded for this morning, so a replay cannot establish that the same values were available at the cutoff.",
      recorded_evidence: {
        gate_accepted: availability.accepted === true,
        structural_accepted: availability.structural_accepted === true,
        receipted_complete: availability.receipted_complete === true,
        present_inputs: availability.present_inputs === undefined ? null : availability.present_inputs,
        declared_inputs: availability.declared_inputs === undefined ? null : availability.declared_inputs,
        stamped_before_cutoff: availability.stamped_before_cutoff === undefined ? null : availability.stamped_before_cutoff,
        failure_codes: availability.reasons || []
      }
    },
    logic: {
      claim: "model_logic_correctness",
      status: "not_established",
      reason: "Parity compares the same frozen rules with themselves. There is no independent adjudication or outcome-blind oracle for these rules, so consistency is not evidence that the rules are correct."
    },
    coverage: {
      claim: "panel_matches_live_morning",
      status: "not_established",
      reason: "The committed panel is a research artefact. Nothing here proves it contains exactly what a live 05:00 run would have offered on this date."
    }
  };
}

/**
 * Verify a ledger row against the committed panel and the local controller.
 *
 * `dataset` is the same `run-v1.json` the n8n parent fetches. A row whose date is absent from the panel
 * is replayed as the controller's own missing-date decision, so an absent date is a recorded refusal
 * rather than an unexplained block. Only the consistency claim is decided here.
 */
function verifyRecord(row, dataset) {
  const controller = require("../backtester/lib/usd_layer1_backtester/backtest_controller");
  const sessions = Array.isArray(dataset && dataset.sessions) ? dataset.sessions : [];
  const session = sessions.find((entry) => entry && entry.date === row.date) || null;
  const checks = [];
  const mismatches = [];
  const models = Array.isArray(row.selection) && row.selection.length > 0 ? row.selection : Object.keys(row.calls);
  // The recorded experiment names the test modules it executed. Replaying without them would score all
  // four markets and report a false mismatch, so the selection travels with the row.
  const configured = row.identity && row.identity.test_configuration ? row.identity.test_configuration : null;
  const recordedModules = configured
    ? (Array.isArray(configured.modules) ? configured.modules : (Array.isArray(configured.tests) ? configured.tests : null))
    : null;
  /**
   * Replay against the selection the run declares, not against this checkout's default.
   *
   * A run may fetch a dataset whose matrix names a different set of markets. Verifying it against the
   * committed eight would report a mismatch for a faithful run, so the recorded matrix is rebuilt from the
   * committed definitions of exactly the markets it names. A market the record names that this checkout
   * does not define makes the rebuild fail, which fails the check: a run cannot assert a selection the
   * committed data cannot describe.
   */
  const replayDataset = (() => {
    const recorded = configured && configured.market_matrix ? configured.market_matrix : null;
    if (!recorded || !Array.isArray(recorded.additional_markets)) return dataset;
    const catalog = dataset && dataset.market_matrix && Array.isArray(dataset.market_matrix.markets)
      ? dataset.market_matrix.markets
      : [];
    const primary = catalog.find((market) => market.key === recorded.primary_market);
    const additional = recorded.additional_markets.map((key) => catalog.find((market) => market.key === key));
    if (!primary || additional.some((market) => !market)) return null;
    return {
      ...dataset,
      market_matrix: {
        ...dataset.market_matrix,
        id: recorded.id || dataset.market_matrix.id,
        fingerprint: recorded.fingerprint || dataset.market_matrix.fingerprint,
        primary_market: recorded.primary_market,
        additional_markets: recorded.additional_markets.slice(),
        markets: [primary, ...additional],
        combination_count: recorded.combination_count
          || (1 + additional.length) * (Array.isArray(recorded.tests) ? recorded.tests.length : 3)
      }
    };
  })();
  if (!replayDataset) {
    checks.push({
      name: "test_selection_configuration",
      ok: false,
      detail: `${row.date} names a market the committed panel does not define, so its selection cannot be verified`
    });
  }

  checks.push({
    name: "dataset_join",
    ok: true,
    detail: session
      ? `${row.date} is in the committed panel`
      : `${row.date} is absent from the committed panel; a not_in_dataset refusal is expected`
  });


  for (const model of models) {
    const recorded = row.calls[model];
    if (!recorded) {
      checks.push({ name: `local_replay_${model}`, ok: false, detail: `${row.date} has no recorded ${model} call` });
      mismatches.push({ check: `local_replay_${model}`, field: "call", recorded: null, local: "expected a recorded call" });
      continue;
    }
    const local = controller.runBacktest({
      dataset: replayDataset || dataset,
      datasetPath: row.dataset.path,
      model,
      dates: [row.date],
      validationMode: row.validation_mode,
      testModules: recordedModules,
      includeDecisions: true
    });
    const decision = local.decisions[0];
    const localCall = decision.call || {};
    const localReasons = (decision.validation.reasons || []).map((reason) => reason.code).sort();
    const recordedGate = (row.gate_by_model && row.gate_by_model[model]) || row.gate;
    const recordedReasons = ((recordedGate && recordedGate.reasons) || []).slice().sort();
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
      // Score exactly the markets the record carries. A restricted selection has fewer keys by design, and a
      // market added by the configuration is scored with the sign the dataset's matrix declares for it.
      const catalog =
        dataset && dataset.market_matrix && Array.isArray(dataset.market_matrix.markets)
          ? dataset.market_matrix.markets
              .filter((market) => market.role !== "primary")
              .map((market) => ({ key: market.key, usd_bullish_predicts: market.usd_bullish_predicts }))
          : [];
      const marketsToScore = Object.keys(recorded.results).map(
        (key) => catalog.find((market) => market.key === key) || key
      );
      const recomputed = controller.scoreCall(recorded.direction, session ? session.outcomes : null, marketsToScore);
      const ok = sameJson(recorded.results, recomputed);
      checks.push({
        name: `outcome_arithmetic_${model}`,
        ok,
        detail: ok
          ? `${row.date} ${model} hit/miss/flat recomputes for the ${Object.keys(recorded.results).length} scored market(s)`
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

    if (recorded.tests) {
      const localTests = decision.tests || {};
      const compactStates = (states) => (states || []).map((state) => [state.id, state.state]);
      const sameModules = sameJson(recorded.tests.modules || null, localTests.modules || null);
      const sameMarkets = sameJson(recorded.tests.scored_markets || null, localTests.scored_markets || null);
      const sameStates = sameJson(compactStates(recorded.tests.states), compactStates(localTests.states));
      const ok = sameModules && sameMarkets && sameStates;
      checks.push({
        name: `test_selection_${model}`,
        ok,
        detail: ok
          ? `${row.date} ${model} executed test modules ${(recorded.tests.modules || []).join(", ")} and recorded ${compactStates(recorded.tests.states)
            .map(([id, state]) => `${id}=${state}`).join(", ")}`
          : `${row.date} ${model} recorded test selection does not reproduce in the controller`
      });
      if (!ok) {
        mismatches.push({
          check: `test_selection_${model}`,
          field: "tests",
          recorded: { modules: recorded.tests.modules, scored_markets: recorded.tests.scored_markets, states: compactStates(recorded.tests.states) },
          local: { modules: localTests.modules, scored_markets: localTests.scored_markets, states: compactStates(localTests.states) }
        });
      }
    }
  }

  const childIds = models.map((model) => row.executions[model] && row.executions[model].id).filter(Boolean);
  const distinctChildren = new Set(childIds);
  const linksOk = Boolean(row.executions.parent.id) && childIds.length === models.length && distinctChildren.size === models.length;
  checks.push({
    name: "execution_links",
    ok: linksOk,
    detail: linksOk
      ? `parent ${row.executions.parent.id}, children ${models.map((model) => `${model} ${row.executions[model].id}`).join(", ")}`
      : `a record must carry a parent execution and one distinct child execution per selected model (${models.length} selected, ${childIds.length} linked, ${distinctChildren.size} distinct)`
  });
  if (!linksOk) {
    mismatches.push({ check: "execution_links", field: "executions", recorded: row.executions, local: `expected ${models.length + 1} ids` });
  }

  const gateOk = (row.gate.reasons || []).length > 0 || row.gate.declared_inputs !== null;
  checks.push({
    name: "gate_recorded",
    ok: gateOk,
    detail: gateOk
      ? `${row.date} ${row.validation_mode} gate: accepted=${row.gate.accepted}, ${row.gate.present_inputs}/${row.gate.declared_inputs} inputs present`
      : `${row.date} records no input-availability gate`
  });
  if (!gateOk) mismatches.push({ check: "gate_recorded", field: "gate", recorded: row.gate, local: "expected a recorded gate" });

  const research = models.filter((model) => !(row.calls[model] && row.calls[model].fixture));
  const agreement = research.length > 1
    ? new Set(research.map((model) => row.calls[model].direction)).size === 1
    : null;
  const recordedAgreement = row.comparison
    ? (row.comparison.same_direction !== undefined ? row.comparison.same_direction : row.comparison.research_same_direction)
    : undefined;
  if (recordedAgreement !== undefined && recordedAgreement !== null && research.length > 1) {
    const ok = recordedAgreement === agreement;
    checks.push({
      name: "comparison_consistency",
      ok,
      detail: ok
        ? `${row.date} same_direction=${agreement} matches the selected research models`
        : `${row.date} comparison.same_direction disagrees with the selected research models`
    });
    if (!ok) mismatches.push({ check: "comparison_consistency", field: "same_direction", recorded: recordedAgreement, local: agreement });
  }

  const verified = mismatches.length === 0;
  return {
    verified,
    consistency_verified: verified,
    checks,
    mismatches,
    claims: claimsFor(row, verified)
  };
}


function emptyLedger({ instance = null } = {}) {
  return {
    schema_version: RUN_LEDGER_VERSION,
    instance,
    dataset: { path: null, run_version: null, generated_at: null },
    updated_at: null,
    runs: [],
    attempts: [],
    records: []
  };
}

function sortRecords(records) {
  return records.slice().sort((left, right) => (left.date === right.date
    ? String(left.key).localeCompare(String(right.key))
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
 * An identical retry - same configuration, same morning - adds nothing. A record whose declared
 * configuration differs from the row already held for that morning is stored under a configuration
 * suffix, so a changed model set, version, validation policy or input snapshot coexists with the original
 * instead of overwriting it. `duplicates` is still the restart-recovery evidence.
 */
function mergeLedger(ledger, { records = [], dataset = null, capturedAt = null, label = null, evidence = null } = {}) {
  const base = ledger ? clone(ledger) : emptyLedger();
  if (base.schema_version !== RUN_LEDGER_VERSION) {
    throw new Error(`unexpected ledger schema ${base.schema_version}; expected ${RUN_LEDGER_VERSION}`);
  }
  const existing = new Map(base.records.map((row) => [row.key, row]));
  const byFingerprint = new Map();
  for (const row of base.records) {
    if (row.configuration && row.configuration.fingerprint) byFingerprint.set(row.configuration.fingerprint, row);
  }
  const added = [];
  const duplicates = [];
  const rejected = [];
  const requestedKeys = [];

  for (const record of records) {
    let row;
    try {
      row = normaliseRecord(record, { dataset });
      requestedKeys.push(row.key);
    } catch (error) {
      rejected.push({ reason: error.message });
      continue;
    }
    const baseKey = row.key;
    const held = existing.get(baseKey);
    const fingerprint = row.configuration.fingerprint;
    let targetKey = baseKey;
    if (held) {
      const heldFingerprint = held.configuration ? held.configuration.fingerprint : null;
      if (!heldFingerprint || heldFingerprint === fingerprint) {
        duplicates.push({
          key: baseKey,
          kept_execution: held.executions.parent.id,
          seen_execution: row.executions.parent.id,
          reason: "identical configuration"
        });
        continue;
      }
      targetKey = coexistenceKey(baseKey, fingerprint);
      const sameExperiment = byFingerprint.get(fingerprint);
      if (sameExperiment) {
        duplicates.push({
          key: sameExperiment.key,
          kept_execution: sameExperiment.executions.parent.id,
          seen_execution: row.executions.parent.id,
          reason: "identical configuration under an earlier key"
        });
        continue;
      }
      const coexist = existing.get(targetKey);
      if (coexist) {
        duplicates.push({
          key: targetKey,
          kept_execution: coexist.executions.parent.id,
          seen_execution: row.executions.parent.id,
          reason: "identical configuration"
        });
        continue;
      }
      row.duplicate_of = baseKey;
      row.configuration_key = targetKey;
    }
    row.key = targetKey;
    if (targetKey !== baseKey) row.coexistence = true;
    if (evidence) row.evidence = evidence;
    row.verification = verifyRecord(row, dataset || { sessions: [] });
    existing.set(targetKey, row);
    added.push({ key: targetKey, verified: row.verification.verified, configuration: fingerprint });
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


/**
 * Keep a failed execution request visible.
 *
 * A transport failure, an HTTP error or a rejected body is not a morning result, so it never becomes a
 * record. It is retained so a sweep report can say how many requests failed and why, and so a resumed run
 * does not pretend the morning was never attempted.
 */
function recordAttempt(ledger, attempt) {
  const base = ledger ? clone(ledger) : emptyLedger();
  if (base.schema_version !== RUN_LEDGER_VERSION) throw new Error(`unexpected ledger schema ${base.schema_version}`);
  const success = attempt && attempt.ok === true;
  const entry = {
    at: attempt && attempt.at ? attempt.at : new Date().toISOString(),
    ok: success,
    label: attempt && attempt.label ? attempt.label : null,
    requested: attempt && Array.isArray(attempt.requested) ? attempt.requested.slice() : [],
    http_status: attempt && attempt.http_status !== undefined ? attempt.http_status : null,
    execution_id: attempt && attempt.execution_id ? String(attempt.execution_id) : null,
    error: success ? null : String((attempt && attempt.error) || "unknown failure").slice(0, 600),
    response_bytes: attempt && attempt.response_bytes !== undefined ? attempt.response_bytes : null
  };
  const key = sha256(canonical(entry)).slice(0, 24);
  const attempts = Array.isArray(base.attempts) ? base.attempts : [];
  if (attempts.some((existing) => existing.attempt_id === key)) return { ledger: base, added: false };
  const next = Object.assign({}, base, {
    attempts: attempts.concat([Object.assign({ attempt_id: key }, entry)])
  });
  return { ledger: next, added: true };
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

function sameSelection(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  const a = left.slice().sort();
  const b = right.slice().sort();
  return a.every((key, index) => key === b[index]);
}

/**
 * The restart plan: what is already durable, what is still missing, and the next morning to run.
 *
 * A morning is complete only when a verified row from a compatible experiment covers it: the same
 * validation mode, the same selected models, and - when a fingerprint is supplied - the same declared
 * configuration. A row recorded under a different selection is a different experiment, so the morning is
 * requested again instead of being silently treated as done.
 */
function resumePlan(ledger, { dates = [], validation_mode: validationMode = "structural", configuration = null, selection = null } = {}) {
  if (!VALIDATION_MODES.includes(validationMode)) throw new Error(`unknown validation mode ${validationMode}`);
  const wanted = dates.slice();
  for (const date of wanted) {
    if (!isIsoDate(date)) throw new Error(`plan date must be YYYY-MM-DD, received ${JSON.stringify(date)}`);
  }
  const rowsByDate = new Map();
  for (const row of (ledger && ledger.records ? ledger.records : [])) {
    if (row.validation_mode !== validationMode) continue;
    if (configuration && (!row.configuration || row.configuration.fingerprint !== configuration)) continue;
    if (selection && !sameSelection(row.selection, selection)) continue;
    if (!rowsByDate.has(row.date)) rowsByDate.set(row.date, []);
    rowsByDate.get(row.date).push(row);
  }
  const complete = [];
  const missing = [];
  const unverified = [];
  const coexisting = [];
  for (const date of wanted) {
    const rows = rowsByDate.get(date) || [];
    if (rows.length === 0) {
      missing.push(date);
      continue;
    }
    if (rows.length > 1) coexisting.push(date);
    const verified = rows.some((row) => row.verification && row.verification.verified === true);
    if (verified) complete.push(date);
    else unverified.push(date);
  }
  const remaining = missing.concat(unverified).sort();
  return {
    validation_mode: validationMode,
    configuration,
    selection,
    requested: wanted.length,
    complete,
    missing,
    unverified,
    coexisting,
    remaining: remaining.length,
    next_date: remaining[0] || null
  };
}


function modelCallTally(records) {
  const tally = {};
  for (const row of records) {
    for (const key of Object.keys(row.calls || {})) {
      const call = row.calls[key];
      const entry = tally[key] || {
        model: key,
        identity: call.identity,
        role: call.role,
        kind: call.kind,
        calls: 0,
        allowed: 0,
        abstained: 0,
        blocked: 0
      };
      entry.calls += 1;
      if (entry[call.status] !== undefined) entry[call.status] += 1;
      tally[key] = entry;
    }
  }
  return tally;
}

function summarise(ledger) {
  const rows = (ledger && ledger.records) || [];
  const byMode = {};
  for (const mode of VALIDATION_MODES) {
    const selected = rows.filter((row) => row.validation_mode === mode);
    byMode[mode] = {
      records: selected.length,
      unique_dates: new Set(selected.map((row) => row.date)).size,
      configurations: new Set(selected.map((row) => (row.configuration ? row.configuration.fingerprint : null))).size,
      allowed: selected.filter((row) => row.outcome === "allowed").length,
      abstained: selected.filter((row) => row.outcome === "abstained").length,
      blocked: selected.filter((row) => row.outcome === "blocked").length,
      verified: selected.filter((row) => row.verification && row.verification.verified === true).length,
      failed_verification: selected.filter((row) => !row.verification || row.verification.verified !== true).length,
      coexisting: selected.filter((row) => row.coexistence === true).length,
      scored: selected.filter((row) => Object.keys(row.calls || {}).some((key) => row.calls[key].results
        && Object.values(row.calls[key].results).some((result) => ["hit", "miss", "flat"].includes(result)))).length,
      model_calls: selected.reduce((total, row) => total + Object.keys(row.calls || {}).length, 0)
    };
  }
  const attempts = (ledger && ledger.attempts) || [];
  return {
    schema_version: (ledger && ledger.schema_version) || RUN_LEDGER_VERSION,
    records: rows.length,
    unique_dates: new Set(rows.map((row) => row.date)).size,
    dates: Array.from(new Set(rows.map((row) => row.date))).sort(),
    earliest: rows.length ? rows.map((row) => row.date).sort()[0] : null,
    latest: rows.length ? rows.map((row) => row.date).sort().slice(-1)[0] : null,
    runs: ((ledger && ledger.runs) || []).length,
    duplicates_prevented: ((ledger && ledger.runs) || []).reduce((total, run) => total + (run.duplicate_keys || []).length, 0),
    failed_attempts: attempts.filter((entry) => entry.ok !== true).length,
    attempts: attempts.length,
    model_calls: rows.reduce((total, row) => total + Object.keys(row.calls || {}).length, 0),
    by_model: modelCallTally(rows),
    by_validation_mode: byMode
  };
}

/**
 * The sweep report: requested dates, unique dates, records, model calls and failures counted separately.
 * A record can outnumber a morning when two configurations ran on it; a model call can outnumber a record
 * when several models ran on it.
 */
function sweepReport(ledger, { dates = [], validation_mode: validationMode = "structural", configuration = null, selection = null } = {}) {
  const summary = summarise(ledger);
  const plan = dates.length > 0 ? resumePlan(ledger, { dates, validation_mode: validationMode, configuration, selection }) : null;
  const attempts = (ledger && ledger.attempts) || [];
  return {
    validation_mode: validationMode,
    configuration,
    requested_dates: dates.length,
    unique_dates: summary.unique_dates,
    records: summary.records,
    model_calls: summary.model_calls,
    runs: summary.runs,
    duplicates_prevented: summary.duplicates_prevented,
    failed_attempts: attempts.filter((entry) => entry.ok !== true).length,
    plan,
    outcomes: {
      allowed: summary.by_validation_mode[validationMode].allowed,
      abstained: summary.by_validation_mode[validationMode].abstained,
      blocked: summary.by_validation_mode[validationMode].blocked
    },
    by_model: summary.by_model
  };
}

/**
 * Per-model, per-validation-mode and per-configuration coverage.
 *
 * A morning counts as covered by a model only when the model actually executed on it: the morning is in the
 * committed panel, the gate accepted it, and the model produced a decision. A receipted refusal is a
 * successful refusal, not a completed structural run, so it is counted in its own mode and never folded into
 * the structural figure. Configurations are separated because two runs of different model sets, validation
 * policies or input snapshots on the same morning are two experiments, not one coverage point.
 */
function coverageReport(ledger, { panelDates = [], models = null } = {}) {
  const rows = Array.isArray(ledger && ledger.records) ? ledger.records : [];
  const panel = Array.from(new Set(panelDates));
  const panelSet = new Set(panel);
  const modelKeys = models || Array.from(new Set(rows.flatMap((row) => Object.keys(row.calls || {})))).sort();
  const isAbsent = (row, model) => {
    const gate = (row.gate_by_model && row.gate_by_model[model]) || row.gate || {};
    const reasons = gate.reasons || [];
    return reasons.includes("not_in_dataset") || reasons.includes("invalid_date") || reasons.includes("weekend_session");
  };
  const byModel = {};
  const signatureOf = (row) => sha256(canonical({
    validation_mode: row.validation_mode,
    selection: row.selection || Object.keys(row.calls || {}),
    versions: Object.keys(row.calls || {}).reduce((map, key) => {
      map[key] = row.calls[key].model_version || null;
      return map;
    }, {}),
    registry: row.registry ? row.registry.fingerprint || null : null,
    test_modules: row.identity && row.identity.test_configuration
      ? (row.identity.test_configuration.modules || row.identity.test_configuration.tests || null)
      : null
  })).slice(0, 12);
  for (const model of modelKeys) {
    const seen = [];
    for (const row of rows) {
      const call = row.calls && row.calls[model];
      if (!call) continue;
      const absent = isAbsent(row, model);
      const onPanel = panelSet.size === 0 ? !absent : panelSet.has(row.date);
      seen.push({
        date: row.date,
        mode: row.validation_mode,
        configuration: row.configuration ? row.configuration.fingerprint : null,
        signature: signatureOf(row),
        status: call.status,
        absent,
        onPanel,
        refused: call.status === "blocked",
        scored: call.results
          ? Object.values(call.results).filter((result) => ["hit", "miss", "flat"].includes(result)).length
          : 0
      });
    }
    const tally = (entries) => {
      const uniqueDates = new Set(entries.filter((entry) => entry.onPanel).map((entry) => entry.date));
      const completed = entries.filter((entry) => entry.onPanel && !entry.refused);
      return {
        records: entries.length,
        unique_dates: uniqueDates.size,
        panel_mornings: uniqueDates.size,
        panel_coverage_pct: panelSet.size === 0 ? null : Math.round((uniqueDates.size / panelSet.size) * 1000) / 10,
        completed: completed.length,
        completed_dates: new Set(completed.map((entry) => entry.date)).size,
        refused: entries.filter((entry) => entry.refused).length,
        refused_absent: entries.filter((entry) => entry.refused && entry.absent).length,
        receipted_refusals: entries.filter((entry) => entry.mode === "receipted" && entry.refused).length,
        scored_mornings: new Set(entries.filter((entry) => entry.scored > 0).map((entry) => entry.date)).size,
        scored_results: entries.reduce((total, entry) => total + entry.scored, 0)
      };
    };
    const byMode = {};
    for (const mode of VALIDATION_MODES) byMode[mode] = tally(seen.filter((entry) => entry.mode === mode));
    const configurations = {};
    for (const entry of seen) {
      const key = entry.signature;
      configurations[key] = configurations[key] || [];
      configurations[key].push(entry);
    }
    byModel[model] = {
      model,
      panel_mornings_available: panelSet.size,
      ...tally(seen),
      by_validation_mode: byMode,
      by_configuration: Object.keys(configurations).sort().reduce((map, key) => {
        const entries = configurations[key];
        map[key] = Object.assign({
          configuration: key,
          row_fingerprints: new Set(entries.map((entry) => entry.configuration)).size,
          date_from: entries.map((entry) => entry.date).sort()[0],
          date_to: entries.map((entry) => entry.date).sort().slice(-1)[0]
        }, tally(entries));
        return map;
      }, {}),
      statement:
        "a configuration is grouped by model set, version, validation mode, registry and test modules - the per-morning rows of one sweep share a signature, while the per-row fingerprint also carries the date it ran on"
    };
  }
  return {
    panel_mornings: panelSet.size,
    panel_first: panel.length ? panel.slice().sort()[0] : null,
    panel_last: panel.length ? panel.slice().sort().slice(-1)[0] : null,
    by_model: byModel,
    note:
      "A structural run on a receipted morning and a receipted refusal are different outcomes. This report keeps them apart per model, per validation mode and per configuration fingerprint."
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
      role_selection: row.selection || Object.keys(row.calls),
      verified: Boolean(row.verification && row.verification.verified),
      claims: row.verification ? row.verification.claims : null,
      configuration: row.configuration ? row.configuration.fingerprint : null,
      coexistence: row.coexistence === true,
      model_outcomes: row.model_outcomes || null,
      calls: Object.keys(row.calls || {}).map((key) => ({
        key,
        identity: row.calls[key].identity,
        label: row.calls[key].label,
        role: row.calls[key].role,
        fixture: row.calls[key].fixture === true,
        status: row.calls[key].status,
        direction: row.calls[key].direction,
        conviction: row.calls[key].conviction,
        hits: row.calls[key].results
          ? Object.values(row.calls[key].results).filter((result) => result === "hit").length
          : null,
        scored: row.calls[key].results
          ? Object.values(row.calls[key].results).filter((result) => ["hit", "miss", "flat"].includes(result)).length
          : 0
      })),
      parent_execution: row.executions.parent
    }))
    .sort((left, right) => (left.date === right.date ? left.key.localeCompare(right.key) : left.date.localeCompare(right.date)));
}

module.exports = {
  RUN_LEDGER_VERSION,
  RECORD_SCHEMAS,
  CONFIGURATION_SCHEMA,
  MODEL_KEYS,
  VALIDATION_MODES,
  recordKey,
  normaliseRecord,
  compactRow,
  configurationFor,
  inputSnapshotDigest,
  verifyRecord,
  claimsFor,
  emptyLedger,
  mergeLedger,
  recordAttempt,
  runIdFor,
  planRange,
  resumePlan,
  summarise,
  sweepReport,
  coverageReport,
  rowsForView
};
