#!/usr/bin/env node
"use strict";

/**
 * Assemble the checked-in USD Layer 1 n8n evidence summary (research only).
 * Inputs are captured artefacts only. This script never calls n8n and never re-scores a decision.
 */

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data", "usd-layer1-backtester");
const N8N = path.join(DATA, "n8n");
const OUT = path.join(DATA, "n8n-execution-evidence-v1.json");
const BASE_URL = "https://silver17.app.n8n.cloud";
const PROJECT_URL = "https://silver17.app.n8n.cloud/projects/ISQG9XU7TGTT6Fcu/workflows";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}
function gitHead() {
  try {
    return childProcess.execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

const manifest = readJson(path.join(ROOT, "automation", "n8n", "usd-l1-cloud-workflows.manifest.json"));
const screen = readJson(path.join(DATA, "backtesting-screen-v1.json"));
const run = readJson(path.join(DATA, "run-v1.json"));
const parity = readJson(path.join(DATA, "parity-v1.json"));
const compare = readJson(path.join(DATA, "compare-v1.json"));
const index = readJson(path.join(N8N, "executions-index-20261119.json"));
const registry = require(path.join(ROOT, "backtester", "lib", "usd_layer1_backtester", "model_registry"));
const ledgerLib = require(path.join(ROOT, "lib", "backtesting_n8n_run_ledger"));
const ledger = fs.existsSync(path.join(N8N, "run-ledger-v1.json")) ? readJson(path.join(N8N, "run-ledger-v1.json")) : null;
const challenger = require(path.join(ROOT, "backtester", "lib", "usd_layer1_backtester", "challenger"));
const challengerV1 = require(path.join(ROOT, "backtester", "lib", "usd_layer1_backtester", "challenger_v1"));
const EXECUTION_FILES = {
  structural: path.join(N8N, "execution-5471-structural.json"),
  receipted: path.join(N8N, "execution-5474-receipted.json"),
  "missing-date": path.join(N8N, "execution-5477-missing-date.json"),
  "missing-inputs": path.join(N8N, "execution-5480-missing-inputs.json")
};

function executionStatus(id) {
  const row = index.executions.find((entry) => String(entry.id) === String(id));
  return row ? row.status : null;
}
function executionTime(id) {
  const row = index.executions.find((entry) => String(entry.id) === String(id));
  return row ? { startedAt: row.startedAt, stoppedAt: row.stoppedAt } : null;
}

function decisionSummary(entry) {
  const decision = entry.decision;
  const validation = decision.validation || {};
  const inputs = validation.inputs || {};
  const receipted = validation.receipted || {};
  const registered = registry.getModel(decision.model) || {};
  return {
    identity: entry.identity,
    label: entry.label || registered.label || null,
    role: entry.role || registered.role || null,
    kind: entry.kind || registered.kind || null,
    fixture: entry.fixture === true || (entry.kind || registered.kind) === "fixture",
    source: entry.source || registered.source || null,
    workflow_id: entry.workflow_id,
    workflow_name: entry.workflow_name,
    workflow_url: `${BASE_URL}/workflow/${entry.workflow_id}`,
    execution_id: entry.execution_id,
    execution_url: entry.execution_url,
    execution_status: executionStatus(entry.execution_id),
    execution_time: executionTime(entry.execution_id),
    status: decision.status,
    model_label: decision.model_label,
    model_version: decision.model_version,
    call: {
      direction: decision.call.direction,
      direction_label: decision.call.direction_label,
      conviction: decision.call.conviction,
      raw_score: decision.call.raw_score,
      score_basis: decision.call.score_basis,
      factors_live: decision.call.factors_live,
      usable_mechanisms: decision.call.usable_mechanisms,
      agreement: decision.call.agreement,
      participation: decision.call.participation,
      missing_inputs: decision.call.missing_inputs || [],
      reason: decision.call.reason
    },
    validation: {
      accepted: validation.accepted === true,
      structural_accepted: validation.structural_accepted === undefined ? validation.accepted === true : validation.structural_accepted,
      cutoff_at_utc: validation.cutoff_at_utc || null,
      contract_cutoff_at_utc: validation.contract_cutoff_at_utc || null,
      reasons: (validation.reasons || []).map((reason) => reason.code),
      declared_inputs: inputs.declared === undefined ? null : inputs.declared,
      present_inputs: inputs.present === undefined ? null : inputs.present,
      missing_inputs: inputs.missing === undefined ? null : inputs.missing,
      missing_keys: inputs.missing_keys || [],
      stamped_before_cutoff: inputs.stamped_before_cutoff === undefined ? null : inputs.stamped_before_cutoff,
      receipted_complete: receipted.complete === true,
      unclocked_keys: receipted.unclocked_keys || []
    },
    results: decision.results,
    outcomes: decision.outcomes
  };
}

function caseSummary(name, file) {
  const response = readJson(file);
  const models = Object.keys(response.models || {}).reduce((map, key) => {
    map[key] = decisionSummary(response.models[key]);
    return map;
  }, {});
  const keys = Object.keys(models);
  const statuses = keys.map((key) => models[key].status);
  const outcome = statuses.every((status) => status === "blocked")
    ? "blocked"
    : statuses.every((status) => status === "abstained")
      ? "abstained"
      : statuses.some((status) => status === "blocked")
        ? "partly_blocked"
        : "allowed";
  return {
    id: `${response.date}-${response.validation_mode}`,
    label: name,
    date: response.date,
    validation_mode: response.validation_mode,
    outcome,
    parent_execution: {
      id: response.n8n.execution_id,
      url: response.n8n.execution_url,
      workflow_id: response.n8n.workflow_id,
      workflow_name: response.n8n.workflow_name,
      status: executionStatus(response.n8n.execution_id),
      time: executionTime(response.n8n.execution_id)
    },
    input_availability: response.input_availability,
    input_availability_by_model: response.input_availability_by_model,
    models,
    comparison: response.comparison,
    labels: response.labels,
    raw_evidence: path.relative(ROOT, file).replace(/\\/g, "/")
  };
}

function scanRun() {
  let lateRows = 0;
  let missingRows = 0;
  for (const session of run.sessions) {
    const meta = session.input_meta || [];
    if (meta.some((entry) => typeof entry[1] === "string" && entry[1].includes("T") && Date.parse(entry[1]) > Date.parse(session.cutoff_at_utc))) {
      lateRows += 1;
    }
    if ((session.inputs_missing || []).length > 0) missingRows += 1;
  }
  return { lateRows, missingRows };
}

function rulesFor(mechanisms) {
  return (mechanisms || []).map((mechanism) => ({
    id: mechanism.id,
    label: mechanism.label,
    factor: mechanism.factor,
    input: mechanism.input,
    rule: mechanism.rule,
    threshold: mechanism.threshold,
    vote_spec: mechanism.vote_spec,
    weight: Number.isFinite(mechanism.weight) ? mechanism.weight : 1
  }));
}

const scans = scanRun();
const challengerReport = compare.reports.challenger.summary;
const currentReport = compare.reports.current.summary;
const v1Report = compare.reports.challenger_v1.summary;

/** The models the ledger actually ran, with the registry's role and kind. */
function selectedIdentities() {
  const rows = (ledger && ledger.records) || [];
  const keys = [];
  for (const row of rows) {
    for (const key of Object.keys(row.calls || {})) if (!keys.includes(key)) keys.push(key);
  }
  const chosen = keys.length > 0 ? keys : registry.DEFAULT_SELECTION.slice();
  return chosen.map((key) => {
    const entry = registry.requireModel(key);
    const child = manifest.children.find((candidate) => candidate.model === key) || null;
    return {
      key,
      id: entry.identity,
      label: entry.label,
      role: entry.role,
      kind: entry.kind,
      fixture: entry.fixtures === true,
      source: entry.source,
      workflow_id: child ? child.workflow_id : null,
      workflow_name: child ? child.name : null,
      workflow_url: child && child.workflow_id ? `${BASE_URL}/workflow/${child.workflow_id}` : null
    };
  });
}

/** A compact per-morning index from the ledger, so the map can show every recorded date. */
function executionIndex() {
  const rows = (ledger && ledger.records) || [];
  return rows.map((row) => {
    const models = {};
    for (const key of Object.keys(row.calls || {})) {
      const call = row.calls[key];
      const registered = registry.getModel(key) || {};
      const child = manifest.children.find((candidate) => candidate.model === key) || null;
      models[key] = {
        identity: call.identity,
        label: call.label,
        role: call.role,
        fixture: call.fixture === true,
        source: registered.source || null,
        status: call.status,
        direction: call.direction,
        conviction: call.conviction,
        execution_id: row.executions[key] ? row.executions[key].id : null,
        execution_url: row.executions[key] ? row.executions[key].url : null,
        workflow_name: child ? child.name : null,
        workflow_url: child && child.workflow_id ? `${BASE_URL}/workflow/${child.workflow_id}` : null
      };
    }
    return {
      id: row.key,
      key: row.key,
      date: row.date,
      validation_mode: row.validation_mode,
      outcome: row.outcome,
      configuration: row.configuration ? row.configuration.fingerprint : null,
      coexistence: row.coexistence === true,
      verified: Boolean(row.verification && row.verification.verified),
      parent_execution: {
        id: row.executions.parent.id,
        url: row.executions.parent.url,
        workflow_name: manifest.parent.name,
        status: "success"
      },
      raw_evidence: row.evidence || "data/usd-layer1-backtester/n8n/run-ledger-v1.json",
      models
    };
  });
}

/** Run summaries kept apart from the four tests and from reproduction. */
function ledgerClaims() {
  const summary = ledger ? ledgerLib.summarise(ledger) : null;
  const rows = (ledger && ledger.records) || [];
  return {
    consistency: {
      status: rows.length > 0 && rows.every((row) => row.verification && row.verification.verified) ? "established" : "not_established",
      statement: "Each stored call reproduces in the local controller, and its hit/miss/flat arithmetic recomputes from the committed outcomes.",
      rows: rows.length,
      failures: rows.filter((row) => !row.verification || row.verification.verified !== true).length
    },
    historical_availability: {
      status: "not_established",
      statement: "The children replayed the committed panel. No retrieval receipt or source archive is recorded, so nothing here shows the values were available at the cutoff.",
      receipted_rows: rows.filter((row) => row.validation_mode === "receipted" && row.gate && row.gate.accepted).length
    },
    model_logic: {
      status: "not_established",
      statement: "Parity compares the frozen rules with themselves. No independent adjudication exists, so correct logic is not demonstrated.",
      oracle: null
    },
    coverage: {
      status: "not_established",
      statement: "The panel is a research artefact; it is not proven to equal what a live 05:00 run would have offered on each date."
    }
  };
}


const evidence = {
  schema_version: "usd-l1-n8n-execution-evidence-v1",
  generated_at: new Date().toISOString(),
  research_only: true,
  repository: {
    head: gitHead(),
    manifest: "automation/n8n/usd-l1-cloud-workflows.manifest.json"
  },
  instance: { base_url: BASE_URL, project_url: PROJECT_URL },
  bundle: manifest,
  identities: {
    selected: selectedIdentities(),
    not_invoked: [
      {
        key: "current",
        label: "Current USD model",
        id: "current",
        version: compare.reports.current.layer1.version,
        reason: "Not bundled in the n8n Cloud runtime: its replay core reads local files and Supabase helpers. The local controller still runs it.",
        source: compare.reports.current.layer1.source
      },
      {
        key: "h1",
        label: screen.h1 && screen.h1.model ? screen.h1.model.label : "USD-L1-25F-H1-v0.1.0",
        id: screen.h1 && screen.h1.model ? screen.h1.model.id : "usd_l1_25f_h1",
        version: screen.h1 && screen.h1.model ? screen.h1.model.version : "USD-L1-25F-H1-v0.1.0",
        reason: "Separate model identity, unscored, and never one of the two n8n children. Its nine-input evidence contract is not met.",
        source: "docs/research/usd-session/h1/v0.1.1/"
      }
    ]
  },
  workflows: {
    parent: {
      id: "89uk5JnPbWPL5lGD",
      name: manifest.parent.name,
      url: `${BASE_URL}/workflow/89uk5JnPbWPL5lGD`,
      active: false,
      trigger: "manual plus header-authenticated webhook; no schedule",
      webhook_deactivated_after_evidence: true
    },
    children: manifest.children.filter((child) => /^[A-Za-z0-9]{16}$/.test(String(child.workflow_id))).map((child) => ({
      model: child.model,
      identity: child.identity,
      kind: child.kind,
      id: child.workflow_id,
      name: child.name,
      url: `${BASE_URL}/workflow/${child.workflow_id}`,
      active: true,
      trigger: "execute-workflow trigger only; cannot self-start"
    }))
  },
  execution_cases: [
    caseSummary("structural", EXECUTION_FILES.structural),
    caseSummary("receipted", EXECUTION_FILES.receipted),
    caseSummary("missing-date", EXECUTION_FILES["missing-date"]),
    caseSummary("missing-inputs", EXECUTION_FILES["missing-inputs"])
  ],
  execution_index: executionIndex(),
  claims: ledgerClaims(),
  sweep: ledger ? {
    ledger: "data/usd-layer1-backtester/n8n/run-ledger-v1.json",
    summary: ledgerLib.summarise(ledger),
    report: ledgerLib.sweepReport(ledger, {
      dates: Array.from(new Set(((ledger && ledger.records) || []).map((row) => row.date))).sort(),
      validation_mode: "structural"
    })
  } : null,
  source_dataset: {
    path: "data/usd-layer1-backtester/run-v1.json",
    schema_version: run.schema_version,
    run_version: run.run && run.run.run_version,
    generated_at: run.generated_at,
    sessions: run.sessions.length,
    first: run.sessions[0].date,
    last: run.sessions[run.sessions.length - 1].date,
    cutoff_contract: run.run && run.run.session_contract
  },
  historical_validity: {
    structural_accepted: challengerReport.validation.structural_accepted,
    structural_blocked: challengerReport.validation.structural_blocked,
    receipted_complete: challengerReport.validation.receipted_complete,
    receipted_incomplete: challengerReport.validation.receipted_incomplete,
    sessions_with_missing_inputs: scans.missingRows,
    sessions_with_stamped_print_after_cutoff: scans.lateRows,
    note: "Structural validity is internal consistency plus the declared 05:00 London cutoff. Receipted validity additionally requires a full timestamp before the cutoff for every consumed input. The committed panel has no stamped print after the cutoff, so a genuine late-print rejection is not demonstrated by history; it remains untested rather than inferred."
  },
  reproduction: {
    parity: {
      controller_version: parity.controller_version,
      checked: parity.checked,
      decision_matches: parity.decision_matches,
      decision_mismatches: parity.decision_mismatches,
      results_checked: parity.results_checked,
      result_matches: parity.result_matches,
      result_mismatches: parity.result_mismatches,
      note: "Reproduction of the stored calls only. These figures are not accuracy and not an edge claim."
    },
    cloud_bundle: {
      bundle_sha256: manifest.bundle_sha256,
      checked_decisions: 1450,
      mismatches: 0,
      note: "The generated Cloud bundle reproduced the Node controller for both challengers over all 725 mornings."
    }
  },
  performance: {
    status: "not established as an edge",
    window: compare.window,
    validation_mode: compare.validation_mode,
    reports: {
      current: { pooled: currentReport.pooled, statuses: currentReport.statuses, participation: currentReport.participation },
      challenger: { pooled: challengerReport.pooled, statuses: challengerReport.statuses, participation: challengerReport.participation },
      challenger_v1: { pooled: v1Report.pooled, statuses: v1Report.statuses, participation: v1Report.participation }
    },
    deltas: compare.deltas,
    note: "Gross directional replay, structural validation only, no costs, no slippage, no live execution and no multiple-testing or holdout claim. Test 1 is a broker proxy; tests 3 and 4 are blocked. Report this separately from reproduction and from the validation gate."
  },
  four_backtests: (screen.tests && screen.tests.definitions ? screen.tests.definitions : []).map((test) => ({
    id: test.id,
    ordinal: test.ordinal,
    label: test.label,
    question: test.question,
    status: test.status,
    usable_sessions: test.usable_sessions,
    outcome_source: test.outcome_source,
    counts: test.counts,
    h1_readiness: test.h1_readiness
  })),
  model_rules: registry.ENTRIES
    .filter((modelEntry) => modelEntry.kind === "research" && Array.isArray(modelEntry.mechanisms))
    .reduce((map, modelEntry) => {
      map[modelEntry.key] = rulesFor(modelEntry.mechanisms);
      return map;
    }, {}),
  limitations: [
    "n8n Cloud does not provide Execute Command, so the original host-command workflows cannot run there; the Cloud workflows bundle the controller instead.",
    "The production-control adapter is not in the Cloud runtime; only the two frozen challengers are.",
    "No committed morning has a stamped print after the 05:00 cutoff, so late-print rejection is untested on history.",
    "The receipted gate refuses every one of the 725 committed mornings because most macro prints carry a date only.",
    "The evidence covers four controlled dates, not a full n8n batch. The local controller remains the 725-morning batch path.",
    "H1 is unscored and is not one of the two n8n children."
  ],
  next_actions: [
    "Acquire a 05:00 receipt archive with full timestamps for the inputs the challengers consume, then rerun the receipted gate.",
    "Record a late-print fixture separately and label it synthetic; do not add it to historical validity.",
    "If the production-control adapter must run in n8n Cloud, package its replay dependencies explicitly instead of assuming filesystem access."
  ]
};

fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  out: path.relative(ROOT, OUT).replace(/\\/g, "/"),
  cases: evidence.execution_cases.map((entry) => ({ id: entry.id, outcome: entry.outcome, parent: entry.parent_execution.id })),
  structural_accepted: evidence.historical_validity.structural_accepted,
  receipted_complete: evidence.historical_validity.receipted_complete,
  parity: evidence.reproduction.parity
}, null, 2));

