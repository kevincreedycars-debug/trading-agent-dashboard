"use strict";

/**
 * Reusable USD Layer 1 backtest controller (research only).
 *
 * The controller owns the order of a historical run: validate the morning, hand the saved values to one
 * Layer 1 adapter, then score the returned call against the session outcome. A Layer 1 adapter is any
 * object with an id, a version and an `evaluate({ date, values })` function, so the same controller runs the
 * current model, challenger v0, challenger v1 or a future book without changing the scoring code.
 *
 * Validation is deliberately independent of the model. `structural` accepts a morning whose date, cutoff
 * and saved values are internally consistent and whose stamped prints do not sit after the cutoff.
 * `receipted` is the stricter label the run artefact publishes as its clocked rung: every input a model
 * reads must carry a full timestamp before the cutoff. The committed run is structural on 725 of 725
 * mornings and receipted on 0, because most macro prints are saved with a date only. Both facts are kept
 * beside the result so a reader cannot mistake the looser gate for a provenance claim.
 *
 * Nothing here reads the network, the warehouse, the dispatcher or a production path.
 */

const contracts = require("./contracts");
const registry = require("./model_registry");
const testModules = require("../../../lib/layer1_backtesting/test_modules");
const { resolveSession } = require("../usd_session_engine_interface");

const CONTROLLER_VERSION = "usd-l1-backtest-controller-v1";
const VALIDATION_MODES = Object.freeze(["structural", "receipted"]);

/** Every key the current model can read from a saved morning. */
const CURRENT_INPUT_KEYS = registry.CURRENT_INPUT_KEYS;

function clone(value) {
  return JSON.parse(JSON.stringify(value === undefined ? null : value));
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value, decimals = 4) {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * The adapter view of a registry entry.
 *
 * The controller only needs this shape: an id, a label, a version, the keys it reads and an `evaluate`
 * function. Everything model-specific - the frozen rules, the score field, the input contract and the
 * fixture label - is owned by the registry entry and carried through unchanged.
 */
function adapterFor(modelEntry) {
  return Object.freeze({
    id: modelEntry.key,
    identity: modelEntry.identity,
    label: modelEntry.label,
    role: modelEntry.role,
    kind: modelEntry.kind,
    version: modelEntry.version,
    source: modelEntry.source,
    score_field: modelEntry.score_field,
    score_basis: modelEntry.score_basis,
    minimumInputs: modelEntry.minimum_inputs,
    inputKeys: modelEntry.input_keys,
    input_contract: modelEntry.input_contract,
    cloud: modelEntry.cloud,
    fixtures: modelEntry.fixtures,
    evaluate: modelEntry.evaluate
  });
}

/** The registered adapters, keyed by registry key. Callers may still pass their own adapter object. */
const LAYER1_ADAPTERS = Object.freeze(Object.fromEntries(
  registry.ENTRIES.map((modelEntry) => [modelEntry.key, adapterFor(modelEntry)])
));

const MODEL_IDS = registry.MODEL_IDS;

function resolveLayer1(modelOrAdapter = "current") {
  if (modelOrAdapter && typeof modelOrAdapter === "object") {
    assertLayer1Adapter(modelOrAdapter);
    return modelOrAdapter;
  }
  const modelEntry = registry.requireModel(modelOrAdapter);
  return LAYER1_ADAPTERS[modelEntry.key];
}

/** A caller may pass its own adapter; the controller only needs this shape and never fills a value for it. */
function assertLayer1Adapter(adapter) {
  const missing = [];
  if (typeof adapter.id !== "string" || !adapter.id.trim()) missing.push("id");
  if (typeof adapter.label !== "string" || !adapter.label.trim()) missing.push("label");
  if (typeof adapter.version !== "string" || !adapter.version.trim()) missing.push("version");
  if (typeof adapter.evaluate !== "function") missing.push("evaluate()");
  if (!Array.isArray(adapter.inputKeys) || adapter.inputKeys.some((key) => typeof key !== "string")) missing.push("inputKeys[]");
  if (missing.length > 0) {
    throw new Error(`Layer 1 adapter is missing ${missing.join(", ")}`);
  }
  return adapter;
}



function clone(value) {
  return JSON.parse(JSON.stringify(value === undefined ? null : value));
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value, decimals = 4) {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * The registered Layer 1 adapters live in model_registry.js; nothing model-specific is defined here.
 * minimumInputs is descriptive only: the models themselves decide whether to abstain, and the controller
 * keeps that decision rather than duplicating it.
 */


function parseIsoDate(text) {
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const ms = Date.parse(`${text}T00:00:00Z`);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10) === text ? ms : null;
}

function isWeekday(ms) {
  const day = new Date(ms).getUTCDay();
  return day >= 1 && day <= 5;
}

function cutoffFor(date) {
  const ms = parseIsoDate(date);
  if (ms === null) return null;
  try {
    return resolveSession(ms);
  } catch (error) {
    return { error: error.message };
  }
}

/** The ordinary call record, with the raw score normalised across the three models. */
function normaliseCall(adapter, fresh) {
  const factorsLive = Array.isArray(fresh.factors)
    ? fresh.factors.filter((factor) => factor.signal && factor.signal !== "NEUTRAL").length
    : finite(fresh.factors_live)
      ? fresh.factors_live
      : null;
  const usesConviction = adapter.score_field === "conviction_raw"
    || (!adapter.score_field && adapter.id === "current");
  const rawScore = usesConviction
    ? (finite(fresh.conviction_raw) ? fresh.conviction_raw : null)
    : (finite(fresh.raw_score) ? fresh.raw_score : null);

  return {
    direction: fresh.direction === "BULLISH" || fresh.direction === "BEARISH" ? fresh.direction : "NO_CALL",
    direction_label: fresh.direction_label || fresh.direction || null,
    conviction: finite(fresh.conviction) ? fresh.conviction : null,
    raw_score: rawScore,
    score_basis: adapter.score_basis
      || (usesConviction ? "conviction_raw (0-100 model scale)" : "raw_score (net mechanism score)"),
    raw_score_detail: fresh.raw_score && typeof fresh.raw_score === "object" ? fresh.raw_score : null,
    factors_live: factorsLive,
    usable_mechanisms: finite(fresh.usable_mechanisms) ? fresh.usable_mechanisms : null,
    agreement: finite(fresh.agreement) ? fresh.agreement : null,
    participation: finite(fresh.participation) ? fresh.participation : null,
    missing_inputs: Array.isArray(fresh.missing_inputs) ? fresh.missing_inputs.slice() : [],
    reason: fresh.reason || null,
    model: fresh.model || adapter.id,
    version: fresh.version || adapter.version
  };
}

function issue(code, message, extra = {}) {
  return Object.assign({ code, message }, extra);
}


/**
 * Validate one morning without running a model.
 *
 * Hard reasons block the controller. Warnings describe what the model may have to abstain on and are kept
 * in the record. The receipted label is computed only from the inputs this adapter reads, so swapping the
 * adapter changes the label rather than the structural gate.
 */
function validateSnapshot({ date, cutoff_at_utc: cutoffAtUtc, values, input_meta: inputMeta, source_legend: sourceLegend } = {}, adapter) {
  const reasons = [];
  const warnings = [];
  const dateMs = parseIsoDate(date);
  if (dateMs === null) {
    reasons.push(issue("invalid_date", "date must be a real YYYY-MM-DD value"));
  } else if (!isWeekday(dateMs)) {
    reasons.push(issue("weekend_session", "date is not a Monday-to-Friday USD session"));
  }

  const resolved = dateMs === null ? null : cutoffFor(date);
  if (resolved && resolved.error) {
    reasons.push(issue("cutoff_unresolved", resolved.error));
  } else if (resolved) {
    if (!cutoffAtUtc) {
      reasons.push(issue("cutoff_missing", `session ${date} has no cutoff_at_utc`));
    } else {
      const declaredMs = Date.parse(cutoffAtUtc);
      if (!Number.isFinite(declaredMs)) {
        reasons.push(issue("cutoff_unparseable", `cutoff_at_utc is not a parseable instant: ${cutoffAtUtc}`));
      } else if (declaredMs !== Date.parse(resolved.cutoff_at_utc)) {
        reasons.push(issue(
          "cutoff_mismatch",
          `declared session cuts off at ${cutoffAtUtc}, the 05:00-London contract cuts off at ${resolved.cutoff_at_utc}`,
          { declared: cutoffAtUtc, resolved: resolved.cutoff_at_utc }
        ));
      }
    }
  }

  const saved = values && typeof values === "object" && !Array.isArray(values) ? values : null;
  if (!saved) {
    reasons.push(issue("snapshot_missing", "the morning has no saved_inputs/values object"));
  } else {
    const finiteKeys = Object.keys(saved).filter((key) => finite(saved[key]));
    if (finiteKeys.length === 0) {
      reasons.push(issue("snapshot_empty", "the morning has no finite saved value"));
    }
  }

  const metaEntries = Array.isArray(inputMeta) ? inputMeta : [];
  if (inputMeta !== undefined && inputMeta !== null && !Array.isArray(inputMeta)) {
    warnings.push(issue("input_meta_shape", "input_meta is not an array and was ignored"));
  }
  const meta = new Map();
  for (const entry of metaEntries) {
    if (!Array.isArray(entry) || typeof entry[0] !== "string") {
      warnings.push(issue("input_meta_entry", "an input_meta entry is not [key, print_date, staleness, source_index]"));
      continue;
    }
    const [key, observedAt, staleness, sourceIndex] = entry;
    const source = Array.isArray(sourceLegend) && Number.isInteger(sourceIndex) ? sourceLegend[sourceIndex] || null : null;
    meta.set(key, {
      key,
      observed_at: observedAt || null,
      staleness_business_days: finite(staleness) ? staleness : null,
      source_index: Number.isInteger(sourceIndex) ? sourceIndex : null,
      source
    });
  }

  const cutoffMs = cutoffAtUtc && Number.isFinite(Date.parse(cutoffAtUtc)) ? Date.parse(cutoffAtUtc) : null;
  for (const entry of meta.values()) {
    if (!entry.observed_at || typeof entry.observed_at !== "string") continue;
    if (entry.observed_at.includes("T") && cutoffMs !== null) {
      const observedMs = Date.parse(entry.observed_at);
      if (Number.isFinite(observedMs) && observedMs > cutoffMs) {
        reasons.push(issue(
          "input_after_cutoff",
          `${entry.key}: printed ${entry.observed_at}, after the ${cutoffAtUtc} cutoff`,
          { key: entry.key, observed_at: entry.observed_at }
        ));
      }
    }
    if (entry.source && /usable from the next day/i.test(entry.source) && date && entry.observed_at.slice(0, 10) >= date) {
      reasons.push(issue(
        "input_not_yet_usable",
        `${entry.key}: observation dated ${entry.observed_at.slice(0, 10)} is not usable until the next day`,
        { key: entry.key, observed_at: entry.observed_at }
      ));
    }
  }


  const consumedKeys = adapter.inputKeys.slice();
  const present = consumedKeys.filter((key) => saved && finite(saved[key]));
  const missing = consumedKeys.filter((key) => !present.includes(key));
  const unclocked = [];
  const stampedBeforeCutoff = [];
  for (const key of present) {
    const entry = meta.get(key);
    if (!entry || !entry.observed_at || !String(entry.observed_at).includes("T")) {
      unclocked.push(key);
      continue;
    }
    const observedMs = Date.parse(entry.observed_at);
    if (cutoffMs === null || !Number.isFinite(observedMs) || observedMs > cutoffMs) {
      unclocked.push(key);
    } else {
      stampedBeforeCutoff.push(key);
    }
  }
  if (present.length > 0 && unclocked.length > 0) {
    warnings.push(issue(
      "unclocked_inputs",
      `${unclocked.length} of ${present.length} consumed inputs carry no full timestamp before the cutoff`,
      { keys: unclocked.slice(0, 12) }
    ));
  }
  if (present.length === 0 && saved) {
    warnings.push(issue("no_consumed_inputs", `none of the ${consumedKeys.length} inputs ${adapter.id} reads has a saved value`));
  }

  return {
    mode: "structural",
    accepted: reasons.length === 0,
    structural_accepted: reasons.length === 0,
    reasons,
    warnings,
    cutoff_at_utc: cutoffAtUtc || null,
    contract_cutoff_at_utc: resolved && !resolved.error ? resolved.cutoff_at_utc : null,
    inputs: {
      declared: consumedKeys.length,
      present: present.length,
      missing: missing.length,
      missing_keys: missing.slice(0, 20),
      stamped_before_cutoff: stampedBeforeCutoff.length
    },
    receipted: {
      complete: reasons.length === 0 && present.length > 0 && stampedBeforeCutoff.length === present.length,
      complete_inputs: stampedBeforeCutoff.length,
      required_inputs: present.length,
      unclocked_keys: unclocked.slice(0, 20)
    }
  };
}

/**
 * Score one call against the four session outcomes.
 *
 * The contract is contrarian because a USD-bullish call predicts EUR/USD, gold and NAS100 lower. A flat
 * outcome is kept out of the denominator; a missing outcome is no_outcome; an abstention is no_call.
 *
 * `markets` is the set the caller asked to score. It defaults to all four committed markets so an
 * unqualified call behaves exactly as before; when a run selects fewer test modules, only the markets those
 * modules consume are scored, and the markets that were not asked for are absent rather than counted as
 * no_outcome.
 */
function scoreCall(direction, outcomes, markets = contracts.MARKETS) {
  const list = markets
    .map((market) => (typeof market === "string" ? contracts.MARKETS.find((entry) => entry.key === market) : market))
    .filter(Boolean);
  const results = {};
  for (const market of list) {
    const outcome = outcomes ? outcomes[market.key] : null;
    if (direction === "NO_CALL") results[market.key] = "no_call";
    else if (!outcome || !outcome.direction) results[market.key] = "no_outcome";
    else if (outcome.direction === "FLAT") results[market.key] = "flat";
    else {
      const predicted = direction === "BULLISH" ? market.usd_bullish_predicts : market.usd_bullish_predicts === "UP" ? "DOWN" : "UP";
      results[market.key] = outcome.direction === predicted ? "hit" : "miss";
    }
  }
  return results;
}

function emptyCall() {
  return {
    direction: "NO_CALL",
    direction_label: null,
    conviction: null,
    raw_score: null,
    score_basis: null,
    raw_score_detail: null,
    factors_live: null,
    usable_mechanisms: null,
    agreement: null,
    participation: null,
    missing_inputs: [],
    reason: null,
    model: null,
    version: null
  };
}

/**
 * The market definitions a dataset declares, or null when it carries no matrix.
 *
 * The published artefact now carries `market_matrix`, so the controller can score the configured additional
 * markets without a code change: the selection decides which of them run, and each entry carries its own
 * `usd_bullish_predicts` sign. The primary market is excluded here because its direction is the USD-call lane
 * itself, priced by the caller's own instrument, not a market the call is scored against.
 */
function marketDefinitionsFromDataset(dataset) {
  const matrix = dataset && dataset.market_matrix ? dataset.market_matrix : null;
  if (!matrix || !Array.isArray(matrix.markets)) return null;
  const markets = matrix.markets
    .filter((market) => market.role !== "primary")
    .map((market) => ({
      key: market.key,
      label: market.label,
      outcome_series: market.series_file,
      quote_convention: market.quote_convention,
      usd_bullish_predicts: market.usd_bullish_predicts,
      digits: market.digits
    }));
  return markets.length ? markets : null;
}

/**
 * Decide one morning: validate, evaluate, score. The model is never called on a morning the structural
 * gate refused, and a model exception is reported as a blocked decision rather than crashing a batch.
 *
 * `options.testModules` is the run's test selection. It decides which markets are scored and is recorded
 * per module, so a selection is an executed decision rather than a caption: asking for test 2 alone scores
 * the configured markets, asking for tests 3 and 4 alone scores no market outcome and records both modules
 * as blocked on their missing tape. `options.markets` is the dataset's own market list, so a matrix with more
 * markets is scored as configured rather than against a fixed four.
 */
function decideMorning(session, modelId = "current", options = {}) {
  const adapter = resolveLayer1(modelId);
  const selection = testModules.resolveModules(options.testModules);
  const definitions = Array.isArray(options.markets) && options.markets.length ? options.markets : contracts.MARKETS;
  const marketKeys = testModules.marketsFor(selection, definitions.map((market) => market.key));
  const scoredMarkets = definitions.filter((market) => marketKeys.includes(market.key));
  const date = session && session.date ? session.date : null;
  const values = session ? (session.saved_inputs || session.values || {}) : {};
  const snapshot = {
    date,
    cutoff_at_utc: session ? session.cutoff_at_utc : null,
    values,
    input_meta: session ? session.input_meta : undefined,
    source_legend: session ? session.source_legend : undefined
  };
  const validation = validateSnapshot(snapshot, adapter);
  const base = {
    date,
    model: adapter.id,
    model_label: adapter.label,
    model_version: adapter.version,
    status: "blocked",
    call: emptyCall(),
    validation,
    tests: {
      modules: testModules.idsOf(selection),
      scored_markets: marketKeys,
      states: testModules.moduleRunStates({ modules: selection, results: [], session })
    },
    results: null,
    outcomes: session && session.outcomes ? session.outcomes : null
  };
  if (!validation.accepted) {
    base.call = Object.assign(emptyCall(), {
      model: adapter.id,
      version: adapter.version,
      reason: validation.reasons.map((reason) => reason.message).join("; ")
    });
    return base;
  }
  try {
    const fresh = adapter.evaluate({ date, values });
    const call = normaliseCall(adapter, fresh);
    const results = scoreCall(call.direction, base.outcomes, scoredMarkets);
    base.tests.states = testModules.moduleRunStates({
      modules: selection,
      results: Object.keys(results).map((market) => ({ market, result: results[market] })),
      session
    });
    return Object.assign(base, {
      status: call.direction === "NO_CALL" ? "abstained" : "allowed",
      call,
      results
    });
  } catch (error) {
    base.call = Object.assign(emptyCall(), {
      model: adapter.id,
      version: adapter.version,
      reason: `layer1_error: ${error.message}`
    });
    validation.reasons.push(issue("layer1_error", error.message));
    return base;
  }
}


function wilsonLowerBound(hits, scored, z = 1.96) {
  if (scored === 0) return null;
  const p = hits / scored;
  const denominator = 1 + (z * z) / scored;
  const centre = p + (z * z) / (2 * scored);
  const margin = z * Math.sqrt((p * (1 - p)) / scored + (z * z) / (4 * scored * scored));
  return round((centre - margin) / denominator, 4);
}

function emptyMarketTally() {
  return { hit: 0, miss: 0, flat: 0, no_outcome: 0, no_call: 0, scored: 0, accuracy: null, wilson_lower_95: null };
}

function addResult(tally, result) {
  if (Object.prototype.hasOwnProperty.call(tally, result)) tally[result] += 1;
  else tally.no_outcome += 1;
}

function finishTally(tally) {
  tally.scored = tally.hit + tally.miss;
  tally.accuracy = tally.scored > 0 ? round(tally.hit / tally.scored, 4) : null;
  tally.wilson_lower_95 = wilsonLowerBound(tally.hit, tally.scored);
  return tally;
}

/** Aggregate a list of decisions without looking at a model or a file. */
/**
 * Aggregate a list of decisions without looking at a model or a file.
 *
 * `options.markets` restricts the per-market tallies to the markets the run actually scored. An unscored
 * market is omitted rather than reported as a zero, because "not asked" and "asked and empty" are different
 * facts about a run.
 */
function summarise(decisions, options = {}) {
  const statuses = { blocked: 0, allowed: 0, abstained: 0 };
  const validation = {
    structural_accepted: 0,
    structural_blocked: 0,
    receipted_complete: 0,
    receipted_incomplete: 0
  };
  const restricted = Array.isArray(options.markets);
  const catalog = Array.isArray(options.catalog) && options.catalog.length ? options.catalog : contracts.MARKETS;
  const scoredMarketKeys = restricted
    ? options.markets.map((market) => (typeof market === "string" ? market : market.key))
    : catalog.map((market) => market.key);
  const marketList = catalog.filter((market) => scoredMarketKeys.includes(market.key));
  const markets = {};
  for (const market of marketList) markets[market.key] = emptyMarketTally();
  const pooled = emptyMarketTally();
  const reasons = {};
  for (const decision of decisions) {
    if (Object.prototype.hasOwnProperty.call(statuses, decision.status)) statuses[decision.status] += 1;
    const structural = decision.validation
      ? (decision.validation.structural_accepted === undefined ? decision.validation.accepted : decision.validation.structural_accepted)
      : false;
    if (structural) validation.structural_accepted += 1;
    else validation.structural_blocked += 1;
    if (decision.validation && decision.validation.receipted && decision.validation.receipted.complete) {
      validation.receipted_complete += 1;
    } else {
      validation.receipted_incomplete += 1;
    }
    for (const reason of (decision.validation && decision.validation.reasons) || []) {
      reasons[reason.code] = (reasons[reason.code] || 0) + 1;
    }
    if (!decision.results) continue;
    for (const market of marketList) {
      const result = decision.results[market.key] || "no_outcome";
      addResult(markets[market.key], result);
      addResult(pooled, result);
    }
  }
  for (const market of marketList) finishTally(markets[market.key]);
  finishTally(pooled);
  return Object.assign({
    sessions: decisions.length,
    statuses,
    validation,
    blocked_reasons: reasons,
    markets,
    pooled,
    participation: round(statuses.allowed / Math.max(1, statuses.allowed + statuses.abstained), 4)
  }, marketList.length === catalog.length ? {} : { scored_markets: marketList.map((market) => market.key) });
}

function sessionWindow(decisions) {
  const dates = decisions.map((decision) => decision.date).filter(Boolean).sort();
  return {
    from: dates.length ? dates[0] : null,
    to: dates.length ? dates[dates.length - 1] : null,
    requested_dates: decisions.length
  };
}

function normaliseDataset(dataset, datasetPath = null) {
  if (!dataset || !Array.isArray(dataset.sessions)) {
    throw new Error("dataset has no sessions array");
  }
  const sourceLegend = dataset.input_source_legend || [];
  return {
    dataset: {
      path: datasetPath,
      schema_version: dataset.schema_version || null,
      run_version: dataset.run ? dataset.run.run_version || null : null,
      generated_at: dataset.generated_at || null,
      sessions: dataset.sessions.length
    },
    sessions: dataset.sessions.map((session) => Object.assign({}, session, { source_legend: sourceLegend }))
  };
}

function selectSessions(sessions, { dates, from, to } = {}) {
  if (Array.isArray(dates) && dates.length > 0) {
    const byDate = new Map(sessions.map((session) => [session.date, session]));
    return dates.map((date) => byDate.get(date) || null);
  }
  return sessions.filter((session) => {
    if (from && session.date < from) return false;
    if (to && session.date > to) return false;
    return true;
  });
}

function missingDateDecision(date, modelId) {
  const adapter = resolveLayer1(modelId);
  return {
    date,
    model: adapter.id,
    model_label: adapter.label,
    model_version: adapter.version,
    status: "blocked",
    call: Object.assign(emptyCall(), {
      model: adapter.id,
      version: adapter.version,
      reason: `no snapshot for ${date} in the dataset`
    }),
    validation: {
      mode: "structural",
      accepted: false,
      reasons: [issue("not_in_dataset", `no snapshot for ${date} in the dataset`)],
      warnings: [],
      receipted: { complete: false, complete_inputs: 0, required_inputs: 0, unclocked_keys: [] }
    },
    results: null,
    outcomes: null
  };
}


/**
 * Run one model over a dataset, a date range or an explicit date list.
 *
 * `validationMode` names the published label. `structural` runs every internally valid morning.
 * `receipted` refuses a morning whose consumed inputs are not all stamped before the cutoff, which is the
 * honest behaviour when the caller asked for provenance rather than presence.
 */
function runBacktest({
  dataset,
  datasetPath = null,
  model = "current",
  adapter = null,
  dates = null,
  from = null,
  to = null,
  validationMode = "structural",
  testModules: requestedTests = null,
  includeDecisions = true
} = {}) {
  if (!VALIDATION_MODES.includes(validationMode)) {
    throw new Error(`unknown validation mode "${validationMode}"; expected one of ${VALIDATION_MODES.join(", ")}`);
  }
  const layer1 = resolveLayer1(adapter || model);
  const selection = testModules.resolveModules(requestedTests);
  const matrix = dataset && dataset.market_matrix ? dataset.market_matrix : null;
  const marketDefinitions = marketDefinitionsFromDataset(dataset) || contracts.MARKETS;
  const scoredMarketKeys = testModules.marketsFor(selection, marketDefinitions.map((market) => market.key));
  const normalised = normaliseDataset(dataset, datasetPath);
  const selected = selectSessions(normalised.sessions, { dates, from, to });
  const decisions = selected.map((session) => {
    if (!session) return null;
    const decision = decideMorning(session, layer1, { testModules: selection, markets: marketDefinitions });
    if (validationMode === "receipted" && decision.validation.accepted && !decision.validation.receipted.complete) {
      decision.status = "blocked";
      decision.call.reason = "receipted gate: not every consumed input carries a full timestamp before the cutoff";
      decision.validation.mode = "receipted";
      decision.validation.accepted = false;
      decision.validation.reasons.push(issue(
        "receipted_incomplete",
        "receipted gate: not every consumed input carries a full timestamp before the cutoff"
      ));
      decision.results = null;
    }
    return decision;
  }).map((decision, index) => decision || missingDateDecision(dates[index], layer1));
  return {
    controller_version: CONTROLLER_VERSION,
    dataset: normalised.dataset,
    layer1: {
      id: layer1.id,
      identity: layer1.identity || layer1.version,
      label: layer1.label,
      version: layer1.version,
      role: layer1.role || null,
      kind: layer1.kind || null,
      fixture: layer1.fixtures === true,
      source: layer1.source || null,
      minimum_inputs: finite(layer1.minimumInputs) ? layer1.minimumInputs : null,
      input_contract: layer1.input_contract || null
    },
    validation_mode: validationMode,
    test_configuration: {
      modules: testModules.idsOf(selection),
      defaulted: requestedTests === undefined || requestedTests === null || requestedTests === "",
      scored_markets: scoredMarketKeys,
      simulations: testModules.simulationsFor(selection),
      market_matrix: matrix
        ? {
            id: matrix.id || null,
            fingerprint: matrix.fingerprint || null,
            primary_market: matrix.primary_market || null,
            additional_markets: Array.isArray(matrix.additional_markets) ? matrix.additional_markets.slice() : [],
            combination_count: matrix.combination_count === undefined ? null : matrix.combination_count,
            tests: Array.isArray(matrix.tests) ? matrix.tests.map((test) => test.id) : [],
            source: "dataset.market_matrix (the artefact the run fetched)"
          }
        : null
    },
    window: sessionWindow(decisions),
    summary: summarise(decisions, { markets: scoredMarketKeys, catalog: marketDefinitions }),
    decisions: includeDecisions ? decisions : undefined
  };
}

function accuracyDelta(candidate, baseline) {
  if (!candidate || !baseline || candidate.accuracy === null || baseline.accuracy === null) return null;
  return round(candidate.accuracy - baseline.accuracy, 4);
}

/** Run several adapters over exactly the same mornings and report per-market deltas against the first. */
function compareBacktests({
  dataset,
  datasetPath = null,
  models = registry.DEFAULT_SELECTION,
  dates = null,
  from = null,
  to = null,
  validationMode = "structural",
  includeDecisions = false
} = {}) {
  if (!Array.isArray(models) || models.length === 0) throw new Error("models must be a non-empty array");
  const reports = {};
  for (const model of models) {
    reports[model] = runBacktest({
      dataset,
      datasetPath,
      model,
      dates,
      from,
      to,
      validationMode,
      includeDecisions
    });
  }
  const baselineId = models[0];
  const baseline = reports[baselineId];
  const deltas = {};
  for (const model of models.slice(1)) {
    const candidate = reports[model];
    deltas[model] = { baseline: baselineId, markets: {}, pooled: accuracyDelta(candidate.summary.pooled, baseline.summary.pooled) };
    for (const market of contracts.MARKETS) {
      deltas[model].markets[market.key] = accuracyDelta(
        candidate.summary.markets[market.key],
        baseline.summary.markets[market.key]
      );
    }
  }
  return {
    controller_version: CONTROLLER_VERSION,
    dataset: baseline.dataset,
    models,
    baseline: baselineId,
    validation_mode: validationMode,
    window: baseline.window,
    reports,
    deltas,
    labels: {
      research_only: "Research only. Accuracy is gross of costs and is not an edge claim.",
      comparison: "A delta is candidate accuracy minus baseline accuracy over the same scored mornings; a null delta has no common denominator."
    }
  };
}


/**
 * Re-run every stored call from `saved_inputs` and compare it with the committed record.
 *
 * This is the seam's acceptance test: all three models must reproduce direction, conviction and raw score
 * exactly, and the controller's own scoring must reproduce the stored per-market results. A mismatch is
 * reported with the field names rather than thrown, so the CLI can publish the evidence and fail.
 */
function checkParity(dataset) {
  const normalised = normaliseDataset(dataset);
  const perModel = {};
  // A registered model the committed panel does not carry (for example a fixture) is reported as not
  // covered instead of being scored as a mismatch against a call that was never stored.
  const checkedModels = MODEL_IDS.filter((model) => normalised.sessions.some((session) => session.models && session.models[model]));
  const notCovered = MODEL_IDS.filter((model) => !checkedModels.includes(model));
  for (const model of checkedModels) {
    const adapter = resolveLayer1(model);
    const mismatches = [];
    const resultMismatches = [];
    let decisionMatches = 0;
    let resultChecks = 0;
    let resultMatches = 0;
    for (const session of normalised.sessions) {
      const stored = session.models ? session.models[model] : null;
      const decision = decideMorning(session, model);
      const fields = [];
      if (!stored) fields.push("missing_stored_call");
      else {
        if (stored.direction !== decision.call.direction) fields.push("direction");
        if (stored.conviction !== decision.call.conviction) fields.push("conviction");
        const raw = model === "current" ? stored.conviction_raw : stored.raw_score;
        if (raw !== decision.call.raw_score) fields.push(model === "current" ? "conviction_raw" : "raw_score");
        if (model === "current") {
          const netWeight = decision.call.raw_score_detail ? decision.call.raw_score_detail.net_weight : null;
          if ((stored.net_weight === undefined ? null : stored.net_weight) !== netWeight) fields.push("net_weight");
        }
      }
      if (fields.length === 0) decisionMatches += 1;
      else if (mismatches.length < 20) {
        mismatches.push({
          date: session.date,
          fields,
          stored_direction: stored ? stored.direction : null,
          fresh_direction: decision.call.direction,
          stored_conviction: stored ? stored.conviction : null,
          fresh_conviction: decision.call.conviction,
          stored_raw: stored ? (model === "current" ? stored.conviction_raw : stored.raw_score) : null,
          fresh_raw: decision.call.raw_score
        });
      }

      const storedResults = session.results ? session.results[model] : null;
      if (storedResults) {
        for (const market of contracts.MARKETS) {
          resultChecks += 1;
          if (storedResults[market.key] === decision.results[market.key]) resultMatches += 1;
          else if (resultMismatches.length < 20) {
            resultMismatches.push({
              date: session.date,
              market: market.key,
              stored: storedResults[market.key] || null,
              fresh: decision.results[market.key] || null
            });
          }
        }
      }
    }
    perModel[model] = {
      model,
      version: adapter.version,
      source: adapter.source,
      checked: normalised.sessions.length,
      decision_matches: decisionMatches,
      decision_mismatches: normalised.sessions.length - decisionMatches,
      mismatch_samples: mismatches,
      results_checked: resultChecks,
      result_matches: resultMatches,
      result_mismatches: resultChecks - resultMatches,
      result_mismatch_samples: resultMismatches,
      ok: mismatches.length === 0 && resultMismatches.length === 0
    };
  }
  const totalChecked = Object.values(perModel).reduce((sum, entry) => sum + entry.checked, 0);
  const totalDecisionMatches = Object.values(perModel).reduce((sum, entry) => sum + entry.decision_matches, 0);
  const totalResultChecks = Object.values(perModel).reduce((sum, entry) => sum + entry.results_checked, 0);
  const totalResultMatches = Object.values(perModel).reduce((sum, entry) => sum + entry.result_matches, 0);
  return {
    controller_version: CONTROLLER_VERSION,
    dataset: normalised.dataset,
    ok: Object.values(perModel).every((entry) => entry.ok),
    checked: totalChecked,
    decision_matches: totalDecisionMatches,
    decision_mismatches: totalChecked - totalDecisionMatches,
    results_checked: totalResultChecks,
    result_matches: totalResultMatches,
    result_mismatches: totalResultChecks - totalResultMatches,
    per_model: perModel,
    not_covered: notCovered
  };
}

function lookbackDates(dataset, { dates, from, to } = {}) {
  const normalised = normaliseDataset(dataset);
  return selectSessions(normalised.sessions, { dates, from, to })
    .filter(Boolean)
    .map((session) => session.date);
}

module.exports = {
  CONTROLLER_VERSION,
  VALIDATION_MODES,
  MODEL_IDS,
  LAYER1_ADAPTERS,
  CURRENT_INPUT_KEYS,
  TEST_MODULES: testModules.MODULES,
  DEFAULT_TEST_MODULES: testModules.DEFAULT_SELECTION,
  resolveTestModules: testModules.resolveModules,
  resolveLayer1,
  parseIsoDate,
  validateSnapshot,
  scoreCall,
  marketDefinitionsFromDataset,
  decideMorning,
  summarise,
  runBacktest,
  compareBacktests,
  checkParity,
  lookbackDates,
  wilsonLowerBound
};

