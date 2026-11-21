"use strict";

/**
 * The USD Layer 1 model registry (research only).
 *
 * Every Layer 1 adapter the backtester can run is registered here and nowhere else. The controller, the
 * generated n8n Cloud workflows, the run ledger, the comparison artefacts and the dashboard map all read
 * this list; none of them names a model of its own. Adding a model is therefore a registration: append an
 * entry, rebuild the Cloud bundle, and the controller, the record schema, the ledger, the comparisons and
 * the map accept it without being edited.
 *
 * Two facts are recorded per entry and are never inferred later:
 *   - `role` - control, challenger or fixture. A fixture is a test double, not a research model, and it is
 *     labelled as a fixture in every artefact that carries it.
 *   - `input_contract` - the model-owned statement of what it reads and where those values come from. The
 *     n8n Cloud children replay the saved values in the committed panel; they do not retrieve history.
 *     Declaring that here keeps the claim with the model instead of in a dashboard caption.
 *
 * Nothing here reads the network, the filesystem, the warehouse or a production path.
 */

const contracts = require("./contracts");
const challenger = require("./challenger");
const challengerV1 = require("./challenger_v1");
const currentModel = require("./current_model");
const fixtureConstant = require("./fixture_constant");

const REGISTRY_VERSION = "usd-l1-model-registry-v1";
const INPUT_CONTRACT_VERSION = "usd-l1-model-input-contract-v2";
const SOURCE_CATALOGUE = "lib/layer1_backtesting/input_sources.js";
const MAX_SELECTED_MODELS = 4;

/** Every key the current model can read from a saved morning. */
const CURRENT_INPUT_KEYS = Object.freeze([
  "vix_level",
  "vix_d5_chg",
  "us_2y_d5_bps",
  "us_10y_real_d5_bps",
  "broad_dollar_d5_pct",
  "gold_d5_pct",
  "nasdaq100_d5_pct",
  "eurusd_d5_pct",
  "usdjpy_d5_pct",
  "usdjpy_d1_pct",
  "usdchf_d1_pct",
  "us_2y_yield",
  "de_2y_yield",
  "us_de_2y_spread",
  "us_de_2y_spread_d5_bps",
  "us_2y_d20_bps",
  "us_10y_real_yield",
  "us_10y_real_d20_bps",
  "us_10y_yield",
  "us_10y_d5_bps",
  "vix_d1_chg",
  "broad_dollar",
  "broad_dollar_d1_pct",
  "broad_dollar_d20_pct",
  "gold_price",
  "gold_d1_pct",
  "gold_d20_pct",
  "nasdaq100_price",
  "nasdaq100_d1_pct",
  "nasdaq100_d20_pct"
]);

/** The receipted gate is computed per adapter, so the keys each adapter declares are the keys that count. */
function contractKeys(keys, mechanisms) {
  const byInput = new Map((mechanisms || []).map((mechanism) => [mechanism.input, mechanism]));
  return Object.freeze(keys.map((key) => {
    const mechanism = byInput.get(key);
    return Object.freeze({
      key,
      factor: mechanism ? mechanism.factor || null : null,
      rule: mechanism ? mechanism.rule || null : null,
      threshold: mechanism ? mechanism.threshold || null : null
    });
  }));
}

function inputContract(keys, mechanisms) {
  return Object.freeze({
    contract_version: INPUT_CONTRACT_VERSION,
    retrieval: "declared_sources_with_reconstruction_disclosure",
    retrieval_statement:
      "This model reads the values saved in the committed morning panel. Each key is resolved through the declared source catalogue (provider, series, transform and publication lag) and every value carries either a contemporaneous capture with a receipt taken at or before the cutoff, or an explicit reconstruction digest. The n8n Cloud child replays the saved values; it does not fetch history, so a replay alone never establishes historical availability.",
    source_catalogue: SOURCE_CATALOGUE,
    source_clock_policy:
      "contemporaneous only when a capture at or before the cutoff matches the replayed value and carries a receipt id; otherwise reconstructed_panel with no receipt",
    missing_input_policy: "abstain_or_block",
    fill_policy: "the controller never fills a missing value and never estimates one",
    keys: contractKeys(keys, mechanisms)
  });
}

function entry(definition) {
  const keys = definition.input_keys;
  return Object.freeze(Object.assign({}, definition, {
    input_keys: Object.freeze(keys.slice()),
    input_contract: inputContract(keys, definition.mechanisms),
    fixtures: definition.kind === "fixture"
  }));
}

const ENTRIES = Object.freeze([
  entry({
    key: "current",
    identity: contracts.CURRENT_MODEL_VERSION,
    label: "Current USD model",
    role: "control",
    kind: "research",
    cloud: false,
    version: contracts.CURRENT_MODEL_VERSION,
    source: "backtester/lib/usd_layer1_backtester/current_model.js",
    score_field: "conviction_raw",
    score_basis: "conviction_raw (0-100 model scale)",
    minimum_inputs: 1,
    input_keys: CURRENT_INPUT_KEYS,
    mechanisms: null,
    cloud_note: "The production-control adapter reads local files and warehouse helpers, so it is deliberately not bundled into the n8n Cloud runtime.",
    evaluate: (payload) => currentModel.evaluate({
      date: payload.date,
      values: JSON.parse(JSON.stringify(payload.values || {}))
    })
  }),
  entry({
    key: "challenger",
    identity: challenger.VERSION,
    label: "Challenger v0",
    role: "challenger",
    kind: "research",
    cloud: true,
    version: challenger.VERSION,
    source: "backtester/lib/usd_layer1_backtester/challenger.js",
    score_field: "raw_score",
    score_basis: "raw_score (net mechanism score)",
    minimum_inputs: 6,
    input_keys: challenger.MECHANISMS.map((mechanism) => mechanism.input),
    mechanisms: challenger.MECHANISMS,
    evaluate: (payload) => challenger.evaluate({ values: JSON.parse(JSON.stringify(payload.values || {})) })
  }),
  entry({
    key: "challenger_v1",
    identity: challengerV1.VERSION,
    label: "Challenger v1",
    role: "challenger",
    kind: "research",
    cloud: true,
    version: challengerV1.VERSION,
    source: "backtester/lib/usd_layer1_backtester/challenger_v1.js",
    score_field: "raw_score",
    score_basis: "raw_score (net mechanism score)",
    minimum_inputs: 6,
    input_keys: challengerV1.MECHANISMS.map((mechanism) => mechanism.input),
    mechanisms: challengerV1.MECHANISMS,
    evaluate: (payload) => challengerV1.evaluate({ values: JSON.parse(JSON.stringify(payload.values || {})) })
  }),
  entry({
    key: "fixture_constant",
    identity: fixtureConstant.IDENTITY,
    label: fixtureConstant.LABEL,
    role: "fixture",
    kind: "fixture",
    cloud: true,
    version: fixtureConstant.VERSION,
    source: "backtester/lib/usd_layer1_backtester/fixture_constant.js",
    score_field: "raw_score",
    score_basis: "raw_score (fixture constant)",
    minimum_inputs: 1,
    input_keys: fixtureConstant.INPUT_KEYS,
    mechanisms: null,
    fixture_statement: "FIXTURE - a test double registered to prove arbitrary model sets work. It is not a research model, its calls are never pooled with a book, and no performance figure may include it.",
    evaluate: (payload) => fixtureConstant.evaluate({ values: JSON.parse(JSON.stringify(payload.values || {})) })
  })
]);

const BY_KEY = new Map(ENTRIES.map((item) => [item.key, item]));
const MODEL_IDS = Object.freeze(ENTRIES.map((item) => item.key));
/** Default selection: the frozen research challengers, in registry order, with no fixture. */
const DEFAULT_SELECTION = Object.freeze(ENTRIES
  .filter((item) => item.kind === "research" && item.cloud)
  .map((item) => item.key));
const CLOUD_SELECTION = Object.freeze(ENTRIES.filter((item) => item.cloud).map((item) => item.key));

function getModel(key) {
  return BY_KEY.get(key) || null;
}

function requireModel(key) {
  const found = BY_KEY.get(key);
  if (!found) {
    throw new Error(`unknown Layer 1 model ${JSON.stringify(key)}; registered models are ${MODEL_IDS.join(", ")}`);
  }
  return found;
}

/**
 * Turn a requested selection into an ordered, de-duplicated list of registry entries.
 *
 * A string is accepted so a webhook body or a query parameter can carry the selection. An unknown key is
 * an error, never a silent fallback: a run must never report a model it did not run.
 */
function resolveSelection(requested) {
  let keys;
  if (requested === undefined || requested === null || requested === "") keys = DEFAULT_SELECTION.slice();
  else if (Array.isArray(requested)) keys = requested;
  else keys = String(requested).split(",");
  const cleaned = [];
  for (const raw of keys) {
    const key = String(raw).trim();
    if (!key) continue;
    if (!cleaned.includes(key)) cleaned.push(key);
  }
  if (cleaned.length === 0) throw new Error("a run must select at least one Layer 1 model");
  if (cleaned.length > MAX_SELECTED_MODELS) {
    throw new Error(`at most ${MAX_SELECTED_MODELS} Layer 1 models can share one run, received ${cleaned.length}`);
  }
  return cleaned.map(requireModel);
}

/** The registry as plain data, for the n8n parent config, the evidence artefact and the dashboard. */
function publicRegistry() {
  return {
    schema_version: REGISTRY_VERSION,
    max_selection: MAX_SELECTED_MODELS,
    default_selection: DEFAULT_SELECTION.slice(),
    cloud_selection: CLOUD_SELECTION.slice(),
    models: ENTRIES.map((item) => ({
      key: item.key,
      identity: item.identity,
      label: item.label,
      role: item.role,
      kind: item.kind,
      version: item.version,
      source: item.source,
      cloud: item.cloud,
      score_field: item.score_field,
      minimum_inputs: item.minimum_inputs,
      input_keys: item.input_keys.slice(),
      input_contract: item.input_contract,
      fixture: item.fixtures,
      fixture_statement: item.fixture_statement || null,
      cloud_note: item.cloud_note || null
    }))
  };
}

module.exports = {
  REGISTRY_VERSION,
  INPUT_CONTRACT_VERSION,
  MAX_SELECTED_MODELS,
  CURRENT_INPUT_KEYS,
  ENTRIES,
  MODEL_IDS,
  DEFAULT_SELECTION,
  CLOUD_SELECTION,
  getModel,
  requireModel,
  resolveSelection,
  publicRegistry
};
