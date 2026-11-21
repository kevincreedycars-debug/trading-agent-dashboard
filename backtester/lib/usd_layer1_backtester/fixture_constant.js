"use strict";

/**
 * FIXTURE MODEL - not a research model.
 *
 * This adapter exists to prove that the registry, the controller, the n8n output schema, the ledger, the
 * comparisons and the map accept a third registered model without being edited. It is a deliberately
 * trivial constant: if the morning carries a saved VIX level it says BULLISH USD with conviction 1,
 * otherwise it abstains. It reads one input, has no mechanism, no threshold study and no adjudication,
 * and it must never be pooled into a research comparison or described as a book.
 *
 * The registry marks it `kind: "fixture"`, and every artefact that carries it also carries that label.
 */

const VERSION = "usd-layer1-fixture-constant-v0";
const IDENTITY = "usd-layer1-fixture-constant-v0";
const LABEL = "Fixture - constant USD bullish (not a research model)";

const INPUT_KEYS = Object.freeze(["vix_level"]);

function evaluate({ values } = {}) {
  const saved = values && typeof values === "object" ? values : {};
  const vix = saved.vix_level;
  const hasVix = typeof vix === "number" && Number.isFinite(vix);
  if (!hasVix) {
    return {
      direction: "NO_CALL",
      direction_label: "NO_CALL",
      conviction: null,
      raw_score: null,
      usable_mechanisms: 0,
      missing_inputs: ["vix_level"],
      reason: "fixture_constant: the morning carries no saved vix_level, so the fixture abstains instead of inventing a reading",
      model: IDENTITY,
      version: VERSION,
      fixture: true,
      note: "FIXTURE ONLY - this is not a research model and its calls must never be scored as one."
    };
  }
  return {
    direction: "BULLISH",
    direction_label: "Bullish USD",
    conviction: 1,
    raw_score: 1,
    usable_mechanisms: 1,
    missing_inputs: [],
    reason: "fixture_constant: a deliberately trivial constant used to prove the registry and the schema accept a third model",
    model: IDENTITY,
    version: VERSION,
    fixture: true,
    note: "FIXTURE ONLY - this is not a research model and its calls must never be scored as one."
  };
}

module.exports = {
  VERSION,
  IDENTITY,
  LABEL,
  INPUT_KEYS,
  MECHANISMS: Object.freeze([]),
  evaluate
};
