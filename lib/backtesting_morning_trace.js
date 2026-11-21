"use strict";

/**
 * One morning, explained from source to outcome (research only).
 *
 * A graph of every execution node shows that the pipeline ran. It does not show why a morning produced the
 * call it did. This module builds the explanation for one morning as an ordered chain:
 *
 *   sources -> input variables -> rules -> validation -> call -> execution -> outcome
 *
 * Every step carries the values it used and the evidence a reader can open: the model's declared source for
 * each key, the observation clock the panel carries, the per-mechanism vote and weight, the gate's own
 * reasons, the call's arithmetic, the parent and child execution ids and the four market outcomes.
 *
 * The trace is rebuilt from the committed panel and the local controller, and then checked against the
 * stored record: a trace whose call disagrees with the ledger is not published as an explanation.
 */

const registry = require("../backtester/lib/usd_layer1_backtester/model_registry");
const controller = require("../backtester/lib/usd_layer1_backtester/backtest_controller");
const sources = require("./layer1_backtesting/input_sources");
const retrieval = require("./layer1_backtesting/input_retrieval");

const TRACE_VERSION = "usd-l1-morning-trace-v1";

function metaFor(session) {
  const map = new Map();
  for (const entry of Array.isArray(session && session.input_meta) ? session.input_meta : []) {
    if (!Array.isArray(entry) || typeof entry[0] !== "string") continue;
    map.set(entry[0], { observed_at: entry[1] || null, staleness: entry[2], source_index: entry[3] });
  }
  return map;
}

/** Build one morning's chain. `row` is the ledger row the run stored for this morning. */
function buildMorningTrace({ date, model, row = null, session, captures = null } = {}) {
  const entry = registry.requireModel(model);
  const adapter = controller.resolveLayer1(model);
  const meta = metaFor(session);
  const values = session ? (session.saved_inputs || session.values || {}) : {};
  const legend = Array.isArray(session && session.source_legend) ? session.source_legend : [];
  const retrieved = session
    ? retrieval.retrieveMorning({ date, session, contract: entry.input_contract, captures })
    : { keys: [], summary: { keys: 0, present: 0, missing: 0, contemporaneous: 0, reconstructed: 0, claim: "unavailable" } };
  const configuredModules = row && row.identity && row.identity.test_configuration
    ? (Array.isArray(row.identity.test_configuration.modules) ? row.identity.test_configuration.modules : null)
    : null;
  const decision = session
    ? controller.runBacktest({
      dataset: { sessions: [session], run: {}, generated_at: null, input_source_legend: legend },
      model: adapter,
      dates: [date],
      validationMode: row && row.validation_mode ? row.validation_mode : "structural",
      testModules: configuredModules,
      includeDecisions: true
    }).decisions[0]
    : null;
  let fresh = null;
  try {
    fresh = session ? adapter.evaluate({ date, values }) : null;
  } catch (error) {
    fresh = null;
  }
  const storedCall = row && row.calls && row.calls[model] ? row.calls[model] : null;
  const mechanisms = fresh && Array.isArray(fresh.mechanisms)
    ? fresh.mechanisms.map((mechanism) => ({
      id: mechanism.id,
      input: mechanism.input,
      factor: mechanism.factor,
      weight: mechanism.weight,
      value: mechanism.value,
      vote: mechanism.vote,
      state: mechanism.state,
      rule: mechanism.rule || null,
      threshold: mechanism.threshold === undefined ? null : mechanism.threshold
    }))
    : [];
  const sourceRows = (entry.input_keys || []).map((key) => {
    const declared = sources.sourceFor(key);
    const keyMeta = meta.get(key) || {};
    const evidence = retrieved.keys.find((item) => item.key === key) || null;
    return {
      key,
      value: Number.isFinite(values[key]) ? values[key] : null,
      present: Number.isFinite(values[key]),
      provider: declared.provider,
      series: declared.series,
      transform: declared.transform,
      parents: declared.parents.slice(),
      observed_at: keyMeta.observed_at || null,
      clock: keyMeta.observed_at ? (String(keyMeta.observed_at).includes("T") ? "timestamp" : "date_only") : "none",
      staleness_business_days: Number.isFinite(keyMeta.staleness) ? keyMeta.staleness : null,
      panel_source_legend: Number.isInteger(keyMeta.source_index) ? legend[keyMeta.source_index] || null : null,
      acquisition: evidence ? evidence.mode : "unavailable",
      receipt: evidence ? evidence.receipt : null,
      reconstruction_digest: evidence ? evidence.reconstruction_digest : null,
      publication: declared.publication
    };
  });
  const decisionResults = decision && decision.results ? decision.results : {};
  const steps = [];
  steps.push({
    id: "sources",
    title: "Declared sources",
    summary: `${sourceRows.filter((row) => row.present).length} of ${sourceRows.length} declared inputs have a saved value; ${sourceRows.filter((row) => row.acquisition === "contemporaneous_capture").length} carry a contemporaneous capture`,
    items: sourceRows
  });
  steps.push({
    id: "inputs",
    title: "Input variables at the cutoff",
    summary: decision
      ? `${decision.validation.inputs.present} of ${decision.validation.inputs.declared} inputs present, ${decision.validation.inputs.stamped_before_cutoff} stamped before the cutoff`
      : "no committed morning",
    items: sourceRows.filter((row) => row.present).map((row) => ({
      key: row.key,
      value: row.value,
      clock: row.clock,
      observed_at: row.observed_at,
      staleness_business_days: row.staleness_business_days
    }))
  });
  steps.push({
    id: "rules",
    title: "Rule evaluation",
    summary: fresh
      ? `net ${fresh.raw_score}, agreement ${fresh.agreement}, participation ${fresh.participation}, ${fresh.usable_mechanisms} of ${fresh.mechanism_count} mechanisms usable`
      : "the model did not evaluate this morning",
    items: mechanisms,
    totals: fresh
      ? { net: fresh.raw_score, agreement: fresh.agreement, participation: fresh.participation, usable: fresh.usable_mechanisms, total: fresh.mechanism_count }
      : null
  });
  steps.push({
    id: "validation",
    title: "Validation gate",
    summary: decision
      ? `structural ${decision.validation.accepted ? "accepted" : "refused"}; receipted ${decision.validation.receipted.complete ? "complete" : "incomplete"}`
      : "no gate",
    items: decision ? (decision.validation.reasons || []).concat(decision.validation.warnings || []) : [],
    receipted: decision ? decision.validation.receipted : null
  });
  steps.push({
    id: "call",
    title: "Call",
    summary: decision ? `${decision.status}: ${decision.call.direction}` : "no decision",
    items: decision ? [{
      direction: decision.call.direction,
      conviction: decision.call.conviction,
      raw_score: decision.call.raw_score,
      score_basis: decision.call.score_basis,
      agreement: decision.call.agreement,
      participation: decision.call.participation,
      missing_inputs: decision.call.missing_inputs,
      reason: decision.call.reason
    }] : []
  });
  steps.push({
    id: "execution",
    title: "Execution evidence",
    summary: row
      ? `parent ${row.executions.parent.id || "unrecorded"}, child ${row.executions[model] ? row.executions[model].id || "unrecorded" : "unrecorded"}`
      : "no stored execution for this morning",
    items: row ? [{
      parent: row.executions.parent,
      child: row.executions[model] || null,
      validation_mode: row.validation_mode,
      configuration: row.configuration ? row.configuration.fingerprint : null
    }] : []
  });
  steps.push({
    id: "outcome",
    title: "Outcome",
    summary: Object.keys(decisionResults).length
      ? Object.keys(decisionResults).map((market) => `${market} ${decisionResults[market]}`).join(", ")
      : "no market outcome was scored",
    items: Object.keys(decisionResults).map((market) => ({
      market,
      result: decisionResults[market],
      direction: session && session.outcomes && session.outcomes[market] ? session.outcomes[market].direction : null,
      move_pct: session && session.outcomes && session.outcomes[market] ? session.outcomes[market].move_pct : null,
      flat_band_pct: session && session.outcomes && session.outcomes[market] ? session.outcomes[market].flat_band_pct : null
    }))
  });
  if (row && row.verification) {
    steps.push({
      id: "verification",
      title: "Ingest verification",
      summary: row.verification.verified ? "the stored call reproduces in the local controller" : "verification failed",
      items: (row.verification.checks || []).map((check) => ({ name: check.name, ok: check.ok === true, detail: check.detail || null })),
      claims: row.verification.claims || null
    });
  }
  // __APPEND_STEPS__
  const reproduced = Boolean(row && storedCall && decision)
    ? (storedCall.status === decision.status && storedCall.direction === decision.call.direction)
    : null;
  return {
    version: TRACE_VERSION,
    date,
    model,
    model_entry: {
      key: entry.key,
      identity: entry.identity,
      label: entry.label,
      role: entry.role,
      kind: entry.kind,
      version: entry.version,
      input_contract: entry.input_contract
    },
    source_summary: retrieved.summary,
    reproduced,
    steps,
    evidence: [
      { label: "committed panel", path: "data/usd-layer1-backtester/run-v1.json", field: `sessions[date=${date}]` },
      { label: "run ledger", path: "data/usd-layer1-backtester/n8n/run-ledger-v1.json", field: row ? row.key : null },
      { label: "parent execution", url: row && row.executions.parent.url ? row.executions.parent.url : null },
      { label: "child execution", url: row && row.executions[model] ? row.executions[model].url : null }
    ],
    statement:
      "This chain explains one recorded morning. It is not a performance claim: it shows the source, the value, the vote, the gate, the call and the outcome that the stored record used."
  };
}

/** Pick a small, labelled set of mornings that show different outcomes. */
function selectTraceDates(ledger, { models = registry.DEFAULT_SELECTION, limit = 6 } = {}) {
  const rows = Array.isArray(ledger && ledger.records) ? ledger.records : [];
  const picked = [];
  const add = (predicate, why) => {
    const row = rows.find((entry) => !picked.some((chosen) => chosen.row.date === entry.date) && predicate(entry));
    if (row) picked.push({ row, why });
  };
  for (const model of models) {
    add((row) => row.calls && row.calls[model] && row.calls[model].status === "allowed", `an allowed ${model} call`);
    add((row) => row.calls && row.calls[model] && row.calls[model].status === "abstained", `an abstained ${model} call`);
  }
  add((row) => row.coexistence === true, "a morning two configurations share");
  add((row) => row.validation_mode === "receipted" && Object.keys(row.calls || {}).some((key) => row.calls[key].status === "blocked"), "a receipted-mode refusal");
  add((row) => row.calls && Object.keys(row.calls).length > 1, "a multi-model morning");
  add((row) => Object.keys(row.calls || {}).some((key) => row.calls[key].status === "blocked"), "a refused morning");
  return picked.slice(0, limit);
}

/** Build the publishable artefact: a few explained mornings plus the coverage each one sits inside. */
function buildTraceArtefact({ ledger, dataset, captures = null, models = registry.DEFAULT_SELECTION, generatedAt = null } = {}) {
  const sessions = new Map((dataset && dataset.sessions ? dataset.sessions : []).map((session) => [session.date, session]));
  const chosen = selectTraceDates(ledger, { models });
  const mornings = [];
  for (const { row, why } of chosen) {
    const model = Object.keys(row.calls || {}).find((key) => row.calls[key].status !== "blocked") || Object.keys(row.calls || {})[0];
    if (!model) continue;
    const trace = buildMorningTrace({
      date: row.date,
      model,
      row,
      session: sessions.get(row.date) || null,
      captures
    });
    mornings.push(Object.assign(trace, { why }));
  }
  return {
    schema_version: TRACE_VERSION,
    generated_at: generatedAt,
    dataset: {
      path: "data/usd-layer1-backtester/run-v1.json",
      run_version: dataset && dataset.run ? dataset.run.run_version : null,
      sessions: dataset && Array.isArray(dataset.sessions) ? dataset.sessions.length : 0
    },
    mornings,
    note:
      "Each morning is rebuilt from the committed panel and checked against the stored ledger row. The chain is the explanation of that morning only; it is not a performance figure and not a claim about other mornings."
  };
}

module.exports = {
  TRACE_VERSION,
  buildMorningTrace,
  buildTraceArtefact,
  selectTraceDates
};
