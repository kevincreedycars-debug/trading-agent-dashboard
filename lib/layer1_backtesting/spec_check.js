"use strict";

/**
 * Independent checks against the approved USD Layer 1 specification (research only).
 *
 * Replaying the model's own rules proves that the code is deterministic, not that the rules are implemented
 * as approved. This file therefore holds a second, hand transcription of the frozen specification and a
 * second interpreter written from that transcription. The two implementations must agree on:
 *   - hand-calculated examples, where the expected net, agreement, participation, direction and conviction
 *     are typed as literals with the arithmetic written out;
 *   - deliberately corrupted inputs (missing, non-numeric, post-cutoff, exactly on a threshold);
 *   - deliberately corrupted calculations (a flipped direction, an inflated conviction, a dropped vote, a
 *     moved threshold, a doubled family weight).
 *
 * The transcription is deliberately a different shape from the model's `vote_spec`: thresholds are declared
 * as `above`/`below` and the interpreter is written separately, so a copy-paste of the model's table would
 * not pass. If the model's constants drift, the examples fail; if a corrupted call is fed in, the call check
 * fails. Neither check reads the network or a production path.
 */

const challengerV1 = require("../../backtester/lib/usd_layer1_backtester/challenger_v1");
const controller = require("../../backtester/lib/usd_layer1_backtester/backtest_controller");
const votesLib = require("../usd_l1_votes");

const SPEC_VERSION = "usd-l1-spec-check-v1";

const SPEC = Object.freeze({
  id: "USD-L1-LONDON-PIT-CONDITIONAL",
  model: "usd-layer1-challenger-v1",
  frozen_on: "2026-11-10",
  sources: Object.freeze([
    "docs/research/usd-session/v1/PLATFORM_COMPLETION_CHECKLIST.md",
    "backtester/lib/usd_layer1_backtester/challenger_v1.js (frozen rules and blocked requirements)",
    "docs/research/usd-session/v1/macro_data_inventory.md (per-series publication timing)"
  ]),
  total_weight: 7,
  min_usable_mechanisms: 6,
  agreement_deadband: 0.2,
  conviction_bands: Object.freeze([
    Object.freeze({ min_agreement: 0.75, min_participation: 0.9, conviction: 5 }),
    Object.freeze({ min_agreement: 0.6, min_participation: 0.75, conviction: 4 }),
    Object.freeze({ min_agreement: 0.45, min_participation: 0.6, conviction: 3 }),
    Object.freeze({ min_agreement: 0.25, min_participation: 0.4, conviction: 2 }),
    Object.freeze({ min_agreement: 0, min_participation: 0, conviction: 1 })
  ]),
  mechanisms: Object.freeze([
    Object.freeze({ id: "vix_regime", input: "vix_level", weight: 0.5, rules: Object.freeze([{ above: 25, usd: 1 }, { below: 16, usd: -1 }]) }),
    Object.freeze({ id: "vix_momentum", input: "vix_d5_chg", weight: 0.5, rules: Object.freeze([{ above: 1, usd: 1 }, { below: -1, usd: -1 }]) }),
    Object.freeze({ id: "us_2y", input: "us_2y_d5_bps", weight: 1, rules: Object.freeze([{ above: 5, usd: 1 }, { below: -5, usd: -1 }]) }),
    Object.freeze({ id: "us_10y_real", input: "us_10y_real_d5_bps", weight: 1, rules: Object.freeze([{ above: 5, usd: 1 }, { below: -5, usd: -1 }]) }),
    Object.freeze({ id: "broad_dollar_momentum", input: "broad_dollar_d5_pct", weight: 1, rules: Object.freeze([{ above: 0.15, usd: 1 }, { below: -0.15, usd: -1 }]) }),
    Object.freeze({ id: "gold", input: "gold_d5_pct", weight: 1, rules: Object.freeze([{ above: 0.5, usd: -1 }, { below: -0.5, usd: 1 }]) }),
    Object.freeze({ id: "equities", input: "nasdaq100_d5_pct", weight: 1, rules: Object.freeze([{ above: 0.5, usd: -1 }, { below: -0.5, usd: 1 }]) }),
    Object.freeze({ id: "eurusd_mirror", input: "eurusd_d5_pct", weight: 0.5, rules: Object.freeze([{ above: 0.15, usd: -1 }, { below: -0.15, usd: 1 }]) }),
    Object.freeze({ id: "usdjpy_mirror", input: "usdjpy_d5_pct", weight: 0.5, rules: Object.freeze([{ above: 0.15, usd: 1 }, { below: -0.15, usd: -1 }]) })
  ])
});

function round(value, decimals = 4) {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** The independent interpreter: `above` is strict, `below` is strict, order is declaration order. */
function voteFor(mechanism, value) {
  if (!Number.isFinite(value)) return null;
  for (const rule of mechanism.rules) {
    if (rule.above !== undefined && value > rule.above) return rule.usd;
    if (rule.below !== undefined && value < rule.below) return rule.usd;
  }
  return 0;
}

function convictionFor(agreement, participation, bands = SPEC.conviction_bands) {
  for (const band of bands) {
    if (agreement >= band.min_agreement && participation >= band.min_participation) return band.conviction;
  }
  return 1;
}

/** Score a value set from the hand transcription alone. */
function independentTally(values, spec = SPEC) {
  const votes = spec.mechanisms.map((mechanism) => ({
    id: mechanism.id,
    input: mechanism.input,
    weight: mechanism.weight,
    value: Number.isFinite(values[mechanism.input]) ? values[mechanism.input] : null,
    vote: voteFor(mechanism, values[mechanism.input])
  }));
  const usable = votes.filter((entry) => entry.vote !== null);
  const missing = votes.filter((entry) => entry.vote === null).map((entry) => entry.input);
  const totalWeight = votes.reduce((total, entry) => total + entry.weight, 0);
  const usableWeight = usable.reduce((total, entry) => total + entry.weight, 0);
  const net = round(usable.reduce((total, entry) => total + entry.vote * entry.weight, 0), 4);
  const agreement = usableWeight > 0 ? round(Math.abs(net) / usableWeight, 4) : 0;
  const participation = totalWeight > 0 ? round(usableWeight / totalWeight, 4) : 0;
  const result = {
    votes: votes.map((entry) => [entry.id, entry.vote, entry.weight]),
    usable: usable.length,
    missing,
    weight: round(totalWeight, 4),
    usable_weight: round(usableWeight, 4),
    net,
    agreement,
    participation
  };
  if (usable.length < spec.min_usable_mechanisms) {
    return Object.assign(result, { direction: "NO_CALL", conviction: null, reason_code: "below_minimum_mechanisms" });
  }
  if (agreement < spec.agreement_deadband) {
    return Object.assign(result, { direction: "NO_CALL", conviction: null, reason_code: "inside_agreement_deadband" });
  }
  return Object.assign(result, {
    direction: net > 0 ? "BULLISH" : "BEARISH",
    conviction: convictionFor(agreement, participation),
    reason_code: "call"
  });
}

/**
 * Hand-calculated examples.
 *
 * Every expected number below is arithmetic over the frozen table, written out beside the case. The model is
 * not consulted to produce them; it is asked to match them.
 */
const HAND_EXAMPLES = Object.freeze([
  Object.freeze({
    id: "all_nine_bullish_usd",
    values: Object.freeze({
      vix_level: 30, vix_d5_chg: 2, us_2y_d5_bps: 10, us_10y_real_d5_bps: 8,
      broad_dollar_d5_pct: 0.4, gold_d5_pct: -1.2, nasdaq100_d5_pct: -1.0,
      eurusd_d5_pct: -0.4, usdjpy_d5_pct: 0.4
    }),
    arithmetic:
      "vix +0.5, vix5 +0.5, 2y +1, real +1, broad +1, gold +1, equities +1, eurusd +0.5, usdjpy +0.5 = 7.00 over 7.00 usable weight; agreement 1.00, participation 1.00 -> conviction 5",
    expected: Object.freeze({ usable: 9, net: 7, agreement: 1, participation: 1, direction: "BULLISH", conviction: 5 })
  }),
  Object.freeze({
    id: "mixed_with_usdjpy_missing",
    values: Object.freeze({
      vix_level: 20, vix_d5_chg: 1.5, us_2y_d5_bps: 8, us_10y_real_d5_bps: 6,
      broad_dollar_d5_pct: 0, gold_d5_pct: -1.2, nasdaq100_d5_pct: 1.0,
      eurusd_d5_pct: 0.3, usdjpy_d5_pct: Number.NaN
    }),
    arithmetic:
      "0 + 0.5 + 1 + 1 + 0 + 1 - 1 - 0.5 = 2.00 over 6.50 usable weight (usdjpy missing, weight 0.5); agreement 0.3077, participation 0.9286 -> conviction 2",
    expected: Object.freeze({ usable: 8, net: 2, agreement: 0.3077, participation: 0.9286, direction: "BULLISH", conviction: 2 })
  }),
  Object.freeze({
    id: "split_inside_deadband",
    values: Object.freeze({
      vix_level: 20, vix_d5_chg: 1.5, us_2y_d5_bps: 8, us_10y_real_d5_bps: 6,
      broad_dollar_d5_pct: 0, gold_d5_pct: 1.2, nasdaq100_d5_pct: 1.0,
      eurusd_d5_pct: 0, usdjpy_d5_pct: 0
    }),
    arithmetic:
      "0 + 0.5 + 1 + 1 + 0 - 1 - 1 + 0 + 0 = 0.50 of 7.00 usable weight; agreement 0.0714 < 0.20 deadband -> NO_CALL",
    expected: Object.freeze({ usable: 9, net: 0.5, agreement: 0.0714, participation: 1, direction: "NO_CALL", conviction: null })
  }),
  Object.freeze({
    id: "five_usable_below_minimum",
    values: Object.freeze({
      vix_level: 30, vix_d5_chg: 2, us_2y_d5_bps: 10, us_10y_real_d5_bps: 8,
      broad_dollar_d5_pct: 0.4
    }),
    arithmetic: "five usable mechanisms against a frozen minimum of six -> NO_CALL, whatever the net would be",
    expected: Object.freeze({ usable: 5, net: 4, agreement: 1, participation: 0.5714, direction: "NO_CALL", conviction: null })
  }),
  Object.freeze({
    id: "one_full_weight_vote_missing",
    values: Object.freeze({
      vix_level: 30, vix_d5_chg: 2, us_10y_real_d5_bps: 8,
      broad_dollar_d5_pct: 0.4, gold_d5_pct: -1.2, nasdaq100_d5_pct: -1.0,
      eurusd_d5_pct: -0.4, usdjpy_d5_pct: 0.4
    }),
    arithmetic:
      "all bullish but us_2y missing: 6.00 over 6.00 usable weight; agreement 1.00, participation 0.8571 -> conviction 4, because band 5 needs 0.90 participation",
    expected: Object.freeze({ usable: 8, net: 6, agreement: 1, participation: 0.8571, direction: "BULLISH", conviction: 4 })
  })
]);

/** Call the frozen model with one value set. */
function modelCall(values) {
  return challengerV1.evaluate({ values: Object.assign({}, values) });
}

function closeEnough(left, right, tolerance = 1e-9) {
  if (typeof left !== "number" || typeof right !== "number") return left === right;
  return Math.abs(left - right) <= tolerance;
}

function compareCall(values, call) {
  const expected = independentTally(values);
  const differences = [];
  const fields = [
    ["usable_mechanisms", expected.usable, call.usable_mechanisms],
    ["raw_score", expected.net, call.raw_score],
    ["agreement", expected.agreement, call.agreement],
    ["participation", expected.participation, call.participation],
    ["direction", expected.direction, call.direction],
    ["conviction", expected.conviction, call.conviction]
  ];
  for (const [field, want, got] of fields) {
    if (!closeEnough(want, got)) differences.push({ field, expected: want, actual: got === undefined ? null : got });
  }
  return { expected, differences, ok: differences.length === 0 };
}

/** Compare one call with the independent tally. Public so a test can feed it a corrupted call. */
function verifyCall(values, call) {
  return compareCall(values, call);
}

function runHandExamples() {
  const cases = HAND_EXAMPLES.map((example) => {
    const call = modelCall(example.values);
    const comparison = compareCall(example.values, call);
    const mismatches = [];
    for (const [field, want] of Object.entries(example.expected)) {
      const key = field === "usable" ? "usable_mechanisms" : (field === "net" ? "raw_score" : field);
      const got = call[key];
      if (!closeEnough(want, got === undefined ? null : got)) {
        mismatches.push({ field, hand: want, model: got === undefined ? null : got });
      }
    }
    for (const difference of comparison.differences) {
      if (!mismatches.some((entry) => entry.field === difference.field)) mismatches.push(difference);
    }
    return { id: example.id, arithmetic: example.arithmetic, ok: mismatches.length === 0, mismatches };
  });
  return {
    cases: cases.length,
    passed: cases.filter((entry) => entry.ok).length,
    failures: cases.filter((entry) => !entry.ok)
  };
}

/** Corrupted calculations: each mutation must be caught by the independent check. */
function runCallCorruptions() {
  const values = HAND_EXAMPLES[0].values;
  const reference = modelCall(values);
  const mutations = [
    { id: "direction_flipped", mutate: (call) => Object.assign(call, { direction: call.direction === "BULLISH" ? "BEARISH" : "BULLISH" }) },
    { id: "conviction_inflated", mutate: (call) => Object.assign(call, { conviction: (call.conviction || 0) + 1 }) },
    { id: "one_vote_dropped", mutate: (call) => Object.assign(call, { raw_score: round(call.raw_score - 1, 4), agreement: round(call.agreement - 1 / 7, 4) }) },
    { id: "usable_mechanisms_inflated", mutate: (call) => Object.assign(call, { usable_mechanisms: call.usable_mechanisms + 1 }) },
    { id: "abstention_removed", mutate: (call) => Object.assign(call, { direction: "BULLISH", conviction: 1 }) }
  ];
  const cases = mutations.map(({ id, mutate }) => {
    const corrupted = mutate(JSON.parse(JSON.stringify(reference)));
    const comparison = verifyCall(values, corrupted);
    return { id, detected: !comparison.ok, differences: comparison.differences };
  });
  return {
    cases: cases.length,
    detected: cases.filter((entry) => entry.detected).length,
    failures: cases.filter((entry) => !entry.detected)
  };
}

/** Corrupted rule tables: a moved threshold or a double-counted family must not look like the same rule. */
function runTableCorruptions() {
  const values = Object.assign({}, HAND_EXAMPLES[0].values, { vix_level: 22 });
  const moved = challengerV1.MECHANISMS.map((mechanism) => (mechanism.id === "vix_regime"
    ? Object.assign({}, mechanism, { vote_spec: [{ when: "gt", value: 20, usd: 1 }, { when: "lt", value: 16, usd: -1 }] })
    : mechanism));
  const doubled = challengerV1.MECHANISMS.map((mechanism) => (mechanism.id.indexOf("vix_") === 0
    ? Object.assign({}, mechanism, { weight: 1 })
    : mechanism));
  const movedCall = votesLib.evaluateFromSpecs({ mechanisms: moved, rules: challengerV1.RULES, values });
  const doubledCall = votesLib.evaluateFromSpecs({ mechanisms: doubled, rules: challengerV1.RULES, values: HAND_EXAMPLES[0].values });
  const totalWeight = round(challengerV1.MECHANISMS.reduce(
    (total, mechanism) => total + (Number.isFinite(mechanism.weight) ? mechanism.weight : 1),
    0
  ), 4);
  const cases = [
    {
      id: "threshold_moved_25_to_20",
      detected: !verifyCall(values, movedCall).ok,
      detail:
        `at vix 22 the approved threshold gives 0 and the moved threshold gives +1; approved net ${independentTally(values).net}, corrupted net ${movedCall.raw_score}`
    },
    {
      id: "vix_family_double_counted",
      detected: !verifyCall(HAND_EXAMPLES[0].values, doubledCall).ok,
      detail: `two half-weight mechanisms raised to full weight add one unit: approved net 7, corrupted net ${doubledCall.raw_score}`
    },
    {
      id: "weight_sum_is_seven",
      detected: totalWeight === SPEC.total_weight,
      detail: `the nine mechanisms sum to ${totalWeight}; the approved total is ${SPEC.total_weight}`
    }
  ];
  return {
    cases: cases.length,
    detected: cases.filter((entry) => entry.detected).length,
    failures: cases.filter((entry) => !entry.detected)
  };
}

/** Corrupted inputs: the model must treat them as declared, not coerce them into a number. */
function runInputCorruptions() {
  const base = Object.assign({}, HAND_EXAMPLES[0].values);
  const cases = [];
  const nanValues = Object.assign({}, base, { vix_level: Number.NaN });
  const nanCall = modelCall(nanValues);
  const nanCheck = verifyCall(nanValues, nanCall);
  cases.push({
    id: "nan_input_is_missing_not_zero",
    detected: nanCall.mechanisms.find((entry) => entry.id === "vix_regime").state === "missing" && nanCheck.ok,
    detail: `NaN is recorded as a missing mechanism with vote null; usable ${nanCall.usable_mechanisms} of 9`
  });
  const stringValues = Object.assign({}, base, { vix_level: "30" });
  const stringCall = modelCall(stringValues);
  const stringCheck = verifyCall(stringValues, stringCall);
  cases.push({
    id: "numeric_string_is_not_coerced",
    detected: stringCall.mechanisms.find((entry) => entry.id === "vix_regime").state === "missing" && stringCheck.ok,
    detail: "a JSON string \"30\" is treated as missing rather than parsed into the model"
  });
  const edgeValues = {
    vix_level: 25, vix_d5_chg: 1, us_2y_d5_bps: 5, us_10y_real_d5_bps: 5,
    broad_dollar_d5_pct: 0.15, gold_d5_pct: 0.5, nasdaq100_d5_pct: 0.5,
    eurusd_d5_pct: 0.15, usdjpy_d5_pct: 0.15
  };
  const edgeCall = modelCall(edgeValues);
  const edgeCheck = verifyCall(edgeValues, edgeCall);
  cases.push({
    id: "thresholds_are_strict",
    detected: edgeCall.raw_score === 0 && edgeCheck.ok && edgeCall.direction === "NO_CALL",
    detail: "a value exactly on every threshold casts no vote, so the morning abstains inside the deadband"
  });
  return {
    cases: cases.length,
    detected: cases.filter((entry) => entry.detected).length,
    failures: cases.filter((entry) => !entry.detected)
  };
}

/**
 * Gate corruptions against one real morning.
 *
 * These are about what the controller does with a bad clock or a missing value, so they need a session from
 * the committed panel. A caller that has no session gets an explicit skip rather than a fabricated pass.
 */
function runGateCorruptions(session) {
  if (!session) return { cases: 0, detected: 0, failures: [], skipped: "no committed session supplied" };
  const adapter = controller.resolveLayer1("challenger_v1");
  const values = session.saved_inputs || session.values || {};
  const meta = Array.isArray(session.input_meta) ? JSON.parse(JSON.stringify(session.input_meta)) : [];
  const cutoffMs = Date.parse(session.cutoff_at_utc);
  const present = adapter.inputKeys.filter((key) => Number.isFinite(values[key]));
  if (present.length === 0) return { cases: 0, detected: 0, failures: [], skipped: "the supplied morning has none of the model's inputs" };
  const snapshot = (inputMeta, valueSet = values) => ({
    date: session.date,
    cutoff_at_utc: session.cutoff_at_utc,
    values: valueSet,
    input_meta: inputMeta,
    source_legend: session.source_legend || []
  });
  const cases = [];
  const future = meta.map((entry) => (entry[0] === present[0]
    ? [entry[0], new Date(cutoffMs + 3600000).toISOString(), entry[2], entry[3]]
    : entry));
  const futureValidation = controller.validateSnapshot(snapshot(future), adapter);
  cases.push({
    id: "post_cutoff_print_blocks",
    detected: futureValidation.reasons.some((reason) => reason.code === "input_after_cutoff"),
    detail: `${present[0]} stamped one hour after the cutoff is refused by the structural gate`
  });
  const dateOnly = meta.map((entry) => (present.includes(entry[0]) ? [entry[0], session.date, entry[2], entry[3]] : entry));
  const dateOnlyValidation = controller.validateSnapshot(snapshot(dateOnly), adapter);
  cases.push({
    id: "date_only_clock_is_not_receipted",
    detected: dateOnlyValidation.accepted === true && dateOnlyValidation.receipted.complete === false,
    detail: "a date-only print is structurally usable and explicitly not receipted"
  });
  const missingOne = meta.filter((entry) => entry[0] !== present[0]);
  const withoutValue = Object.assign({}, values);
  delete withoutValue[present[0]];
  const missingValidation = controller.validateSnapshot(snapshot(missingOne, withoutValue), adapter);
  cases.push({
    id: "dropped_input_is_named",
    detected: missingValidation.inputs.missing_keys.includes(present[0]),
    detail: `${present[0]} removed from the saved values is recorded as missing rather than filled`
  });
  return {
    cases: cases.length,
    detected: cases.filter((entry) => entry.detected).length,
    failures: cases.filter((entry) => !entry.detected)
  };
}

/** Does the model's declared table match the hand transcription? */
function compareModelTable() {
  const differences = [];
  for (const expected of SPEC.mechanisms) {
    const actual = challengerV1.MECHANISMS.find((mechanism) => mechanism.id === expected.id);
    if (!actual) {
      differences.push({ mechanism: expected.id, field: "presence", expected: "declared", actual: "absent" });
      continue;
    }
    if (actual.input !== expected.input) {
      differences.push({ mechanism: expected.id, field: "input", expected: expected.input, actual: actual.input });
    }
    const weight = Number.isFinite(actual.weight) ? actual.weight : 1;
    if (weight !== expected.weight) {
      differences.push({ mechanism: expected.id, field: "weight", expected: expected.weight, actual: weight });
    }
    const declaredRules = (actual.vote_spec || []).map((branch) => ({
      above: branch.when === "gt" ? branch.value : undefined,
      below: branch.when === "lt" ? branch.value : undefined,
      usd: branch.usd
    }));
    const normalise = (rules) => rules
      .map((rule) => `${rule.above === undefined ? "" : `>${rule.above}`}${rule.below === undefined ? "" : `<${rule.below}`}:${rule.usd}`)
      .sort();
    if (normalise(declaredRules).join("|") !== normalise(expected.rules).join("|")) {
      differences.push({
        mechanism: expected.id,
        field: "thresholds",
        expected: normalise(expected.rules),
        actual: normalise(declaredRules)
      });
    }
  }
  if (challengerV1.RULES.min_usable_mechanisms !== SPEC.min_usable_mechanisms) {
    differences.push({ field: "min_usable_mechanisms", expected: SPEC.min_usable_mechanisms, actual: challengerV1.RULES.min_usable_mechanisms });
  }
  if (challengerV1.RULES.agreement_deadband !== SPEC.agreement_deadband) {
    differences.push({ field: "agreement_deadband", expected: SPEC.agreement_deadband, actual: challengerV1.RULES.agreement_deadband });
  }
  const bands = (challengerV1.RULES.conviction_bands || [])
    .map((band) => `${band.min_agreement}/${band.min_participation}:${band.conviction}`).join("|");
  const specBands = SPEC.conviction_bands
    .map((band) => `${band.min_agreement}/${band.min_participation}:${band.conviction}`).join("|");
  if (bands !== specBands) differences.push({ field: "conviction_bands", expected: specBands, actual: bands });
  return { matches: differences.length === 0, differences };
}

/** The whole independent check, ready to publish as an artefact. */
function runSpecCheck({ session = null, generatedAt = null } = {}) {
  const table = compareModelTable();
  const hand = runHandExamples();
  const calls = runCallCorruptions();
  const tables = runTableCorruptions();
  const inputs = runInputCorruptions();
  const gate = runGateCorruptions(session);
  const all = [
    table.matches,
    hand.passed === hand.cases,
    calls.detected === calls.cases,
    tables.detected === tables.cases,
    inputs.detected === inputs.cases,
    gate.cases === 0 || gate.detected === gate.cases
  ];
  return {
    schema_version: SPEC_VERSION,
    generated_at: generatedAt,
    spec: {
      id: SPEC.id,
      model: SPEC.model,
      frozen_on: SPEC.frozen_on,
      total_weight: SPEC.total_weight,
      mechanisms: SPEC.mechanisms.length,
      min_usable_mechanisms: SPEC.min_usable_mechanisms,
      agreement_deadband: SPEC.agreement_deadband,
      sources: SPEC.sources.slice()
    },
    model_table: table,
    hand_examples: hand,
    corrupted_calls: calls,
    corrupted_tables: tables,
    corrupted_inputs: inputs,
    gate,
    verdict: all.every(Boolean) ? "pass" : "fail",
    statement:
      "The model is checked against a second, hand transcription of the approved specification and against deliberately corrupted inputs and calculations. Agreement here means the implementation matches the written rules on these cases; it does not validate the rules as profitable."
  };
}

module.exports = {
  SPEC_VERSION,
  SPEC,
  HAND_EXAMPLES,
  independentTally,
  voteFor,
  convictionFor,
  modelCall,
  verifyCall,
  compareModelTable,
  runHandExamples,
  runCallCorruptions,
  runTableCorruptions,
  runInputCorruptions,
  runGateCorruptions,
  runSpecCheck
};
