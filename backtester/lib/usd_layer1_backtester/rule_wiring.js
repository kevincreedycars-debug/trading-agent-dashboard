"use strict";

/**
 * Experimental rule wiring for the intended USD model (research only).
 *
 * Implements the four rules whose inputs are staged: RG-1 (front-end differential, joined to a German 2Y leg),
 * RG-3 (overnight range position), RG-4 (session volatility gate) and RG-5 (safe-haven demand). Every record
 * carries `experimental: true` and the rule id that produced it, because each of these rules was frozen by
 * judgement in `docs/research/usd-session/v1/rule_gap_ledger_20261113.md` rather than settled by the research.
 *
 * Nothing here votes in the published challenger. The module answers one question per factor, per morning: did
 * the rule fire, stay neutral, or abstain because the input was missing or non-finite - and it never fills a gap
 * from a neighbouring session or a later print.
 */

const VERSION = "usd-l1-rule-wiring-v1";
const FROZEN_ON = "2026-11-13";
const STATUS = "experimental";

const RULES = Object.freeze({
  RG1: {
    id: "RG-1",
    name: "front-end differential",
    factors: ["live.f3-us-de-2y-spread-delta", "rates.relative-front-end-delta"],
    inputs: ["us_2y_yield", "de_2y_yield"],
    frozen: "usd_signal = sign((US2Y - DE2Y)_t - (US2Y - DE2Y)_{t-5}); widening votes +1 USD, narrowing -1, unchanged 0"
  },
  RG3: {
    id: "RG-3",
    name: "overnight range position",
    factors: ["fx.usd-overnight-range-position"],
    inputs: ["fx_overnight_range_position", "fx_overnight_range_pips"],
    frozen: "pos >= 0.70 votes +1 USD, pos <= 0.30 votes -1, otherwise 0; a range below 10 pips is undefined"
  },
  RG4: {
    id: "RG-4",
    name: "volatility gate",
    factors: ["fx.usd-session-volatility-regime"],
    inputs: ["fx_eurusd_volatility_ratio_60s"],
    frozen: "the morning is tradeable only when the 60-session volatility ratio is at least 1.0"
  },
  RG5: {
    id: "RG-5",
    name: "safe-haven demand",
    factors: ["risk.usd-safe-haven-demand"],
    inputs: ["gold_d1_pct", "usdjpy_d1_pct", "usdchf_d1_pct"],
    frozen:
      "+1 USD when gold and JPY both weaken against USD by more than 0.25%, -1 when both strengthen, otherwise 0; " +
      "CHF is a confirmation only and never votes alone"
  }
});

const MIN_RANGE_PIPS = 10;
const RANGE_HIGH = 0.7;
const RANGE_LOW = 0.3;
const VOLATILITY_FLOOR = 1.0;
/** RG-5's magnitude threshold, in percent, applied to each of the two voting legs. */
const SAFE_HAVEN_PCT = 0.25;

function finite(value) {
  // `null` and `undefined` are missing, not zero: Number(null) is 0, and letting that through would turn an
  // absent gold leg into a 0.00% move that votes neutral, which is a claim the cutoff cannot support.
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function indexInputs(snapshot) {
  const byKey = new Map();
  const inputs = snapshot && snapshot.inputs;
  if (Array.isArray(inputs)) {
    for (const entry of inputs) if (entry && entry.key) byKey.set(entry.key, { ...entry });
  } else if (inputs && typeof inputs === "object") {
    for (const [key, value] of Object.entries(inputs)) byKey.set(key, { key, value });
  }
  for (const entry of Array.isArray(snapshot && snapshot.input_meta) ? snapshot.input_meta : []) {
    if (!Array.isArray(entry) || !entry[0]) continue;
    const merged = byKey.get(entry[0]) || { key: entry[0] };
    merged.print_date = entry[1];
    merged.staleness_business_days = entry[2];
    byKey.set(entry[0], merged);
  }
  return byKey;
}

function readInput(snapshot, key) {
  const values = (snapshot && snapshot.values) || {};
  const entry = indexInputs(snapshot).get(key) || {};
  const value = finite(values[key] !== undefined ? values[key] : entry.value);
  const staleness = finite(entry.staleness_business_days);
  return {
    key,
    value,
    staleness,
    print_date: entry.print_date !== undefined ? entry.print_date : null,
    source: entry.source || null
  };
}

function record(rule, factorId, status, extra = {}) {
  return { rule: rule.id, rule_name: rule.name, factor_id: factorId, status, experimental: true, ...extra };
}

function overnightRangePosition(snapshot) {
  const rule = RULES.RG3;
  const factorId = rule.factors[0];
  const position = readInput(snapshot, "fx_overnight_range_position");
  const pips = readInput(snapshot, "fx_overnight_range_pips");
  if (position.value === null || pips.value === null) {
    const missing = [position, pips].filter((input) => input.value === null).map((input) => input.key);
    return record(rule, factorId, "undefined", { vote: null, missing_inputs: missing, why: "no value at the cutoff" });
  }
  if (pips.value < MIN_RANGE_PIPS) {
    return record(rule, factorId, "undefined", { vote: null, value: position.value, why: `the range spans ${pips.value} pips, below the frozen ${MIN_RANGE_PIPS}` });
  }
  const vote = position.value >= RANGE_HIGH ? 1 : position.value <= RANGE_LOW ? -1 : 0;
  return record(rule, factorId, vote === 0 ? "neutral" : "fired", { vote, value: position.value, range_pips: pips.value });
}

function volatilityGate(snapshot) {
  const rule = RULES.RG4;
  const factorId = rule.factors[0];
  const ratio = readInput(snapshot, "fx_eurusd_volatility_ratio_60s");
  if (ratio.value === null) {
    return record(rule, factorId, "undefined", { tradeable: null, vote: null, missing_inputs: [ratio.key], why: "no value at the cutoff" });
  }
  const tradeable = ratio.value >= VOLATILITY_FLOOR;
  return record(rule, factorId, tradeable ? "open" : "closed", { tradeable, vote: 0, value: ratio.value });
}

function frontEndDifferential(snapshot) {
  const rule = RULES.RG1;
  const spread = readInput(snapshot, "us_de_2y_spread_d5_bps");
  const us = readInput(snapshot, "us_2y_yield");
  const de = readInput(snapshot, "de_2y_yield");
  if (spread.value !== null) {
    const vote = spread.value > 0 ? 1 : spread.value < 0 ? -1 : 0;
    // The evidence travels with the vote: both legs, the observation date each cutoff could see, the level
    // the spread stood at and the frozen five-session change it is judged on.
    const evidence = {
      vote,
      value: spread.value,
      units: "bps",
      lookback: "five business days",
      spread_now_pct_points: finite((snapshot.values || {}).us_de_2y_spread),
      us_2y_yield: us.value,
      de_2y_yield: de.value,
      legs: [
        { key: us.key, value: us.value, print_date: us.print_date, staleness_business_days: us.staleness },
        { key: de.key, value: de.value, print_date: de.print_date, staleness_business_days: de.staleness }
      ]
    };
    return [
      record(rule, rule.factors[0], vote === 0 ? "neutral" : "fired", evidence),
      record(rule, rule.factors[1], vote === 0 ? "neutral" : "fired", Object.assign({}, evidence, {
        shared_source: rule.factors[0]
      }))
    ];
  }
  const missing = [us, de].filter((input) => input.value === null).map((input) => input.key);
  return rule.factors.map((factorId) =>
    record(rule, factorId, "undefined", {
      vote: null,
      missing_inputs: missing,
      why: missing.length
        ? "a leg of the differential is absent at the cutoff"
        : "the five-day differential change needs a stored spread, which this replay does not carry"
    })
  );
}

/**
 * RG-5, safe-haven demand.
 *
 * Two legs must agree before the rule votes: gold in USD and USD/JPY. "Weakening against the dollar" means the
 * gold price falls and USD/JPY rises, each by more than the frozen 0.25%; both strengthening gives the opposite
 * vote. One leg moving hard cannot carry the vote on its own, and CHF is read only as a confirmation flag that
 * never changes the number.
 *
 * Double-counting is handled structurally rather than statistically: the two legs are different series, the
 * factor emits at most one vote, and that vote belongs to the risk family's single unit of say. The nine-input
 * book's `gold_d5_pct` and `usdjpy_d5_pct` are different windows of the same series and are explicitly named in
 * the record, so a reader can see that the same print is not being counted twice.
 *
 * Both legs are declared proxies for the overnight window the research names: `gold_d1_pct` compares the 05:00
 * bar with the previous session's 05:00 bar from the cached one-hour tape, and `usdjpy_d1_pct` compares the last
 * H.10 print before the cutoff with the one before it. Neither is an intraday overnight return.
 */
function safeHavenDemand(snapshot) {
  const rule = RULES.RG5;
  const factorId = rule.factors[0];
  const gold = readInput(snapshot, "gold_d1_pct");
  const jpy = readInput(snapshot, "usdjpy_d1_pct");
  const chf = readInput(snapshot, "usdchf_d1_pct");
  const missing = [gold, jpy].filter((input) => input.value === null).map((input) => input.key);
  if (missing.length) {
    return record(rule, factorId, "undefined", {
      vote: null,
      missing_inputs: missing,
      why: "a voting leg of the safe-haven rule is absent at the cutoff"
    });
  }
  const goldWeakening = gold.value <= -SAFE_HAVEN_PCT;
  const goldStrengthening = gold.value >= SAFE_HAVEN_PCT;
  const jpyWeakening = jpy.value >= SAFE_HAVEN_PCT;
  const jpyStrengthening = jpy.value <= -SAFE_HAVEN_PCT;
  let vote = 0;
  if (goldWeakening && jpyWeakening) vote = 1;
  else if (goldStrengthening && jpyStrengthening) vote = -1;
  const confirmation = chf.value === null || vote === 0 ? null : vote === 1 ? chf.value >= SAFE_HAVEN_PCT : chf.value <= -SAFE_HAVEN_PCT;
  return record(rule, factorId, vote === 0 ? "neutral" : "fired", {
    vote,
    gold_d1_pct: gold.value,
    usdjpy_d1_pct: jpy.value,
    threshold_pct: SAFE_HAVEN_PCT,
    chf_confirmation: confirmation,
    window: "one session between cutoffs on both legs, not an intraday overnight return",
    contributes_once: true,
    shares_series_with: ["gold_d5_pct", "usdjpy_d5_pct"]
  });
}

function evaluate(snapshot) {
  const factors = [
    overnightRangePosition(snapshot),
    volatilityGate(snapshot),
    ...frontEndDifferential(snapshot),
    safeHavenDemand(snapshot)
  ];
  const gate = factors.find((item) => item.rule === RULES.RG4.id);
  return {
    version: VERSION,
    status: STATUS,
    frozen_on: FROZEN_ON,
    experimental: true,
    date: (snapshot && snapshot.date) || null,
    factors,
    gate: { tradeable: gate ? gate.tradeable : null, status: gate ? gate.status : "undefined" },
    fired: factors.filter((item) => ["fired", "open", "closed"].includes(item.status)).map((item) => item.factor_id),
    undefined: factors.filter((item) => item.status === "undefined").map((item) => item.factor_id)
  };
}

/**
 * One pass over every replayed morning. The first morning whose wired rules all resolve and whose volatility
 * gate is open is the first candidate for a traceable decision; a morning with an undefined rule is never
 * promoted to a decision, which is what keeps an abstention honest.
 */
function summarise(snapshots = []) {
  const rows = [];
  for (const snapshot of snapshots) {
    const result = evaluate(snapshot);
    rows.push({
      date: result.date,
      gate: result.gate.status,
      rules: result.factors.map((item) => ({ factor_id: item.factor_id, rule: item.rule, status: item.status, vote: item.vote }))
    });
  }
  const ruleCounts = {};
  for (const row of rows) {
    for (const item of row.rules) {
      ruleCounts[item.rule] = ruleCounts[item.rule] || { fired: 0, neutral: 0, open: 0, closed: 0, undefined: 0 };
      ruleCounts[item.rule][item.status] = (ruleCounts[item.rule][item.status] || 0) + 1;
    }
  }
  const allDefined = (row) => row.rules.every((item) => item.status !== "undefined");
  const eligible = rows.filter((row) => allDefined(row) && row.gate === "open");
  const blockerCounts = {};
  for (const row of rows) {
    for (const item of row.rules) {
      if (item.status === "undefined") blockerCounts[item.factor_id] = (blockerCounts[item.factor_id] || 0) + 1;
    }
  }
  const first = eligible[0] || null;
  return {
    version: VERSION,
    status: STATUS,
    frozen_on: FROZEN_ON,
    experimental: true,
    rules: Object.values(RULES).map((rule) => ({ id: rule.id, name: rule.name, factors: rule.factors, inputs: rule.inputs, frozen: rule.frozen })),
    factors_wired: 5,
    factor_ids_wired: [
      ...RULES.RG1.factors,
      ...RULES.RG3.factors,
      ...RULES.RG4.factors,
      ...RULES.RG5.factors
    ],
    previously_unread_total: 6,
    factors_still_unread: 1,
    never_read: ["live.f8-fed-bias"],
    sessions: rows.length,
    rule_counts: ruleCounts,
    undefined_by_factor: blockerCounts,
    mornings_with_every_wired_rule_defined: rows.filter(allDefined).length,
    mornings_tradeable: rows.filter((row) => row.gate === "open").length,
    eligible_mornings: eligible.length,
    first_qualifying_morning: first,
    first_qualifying_note: first
      ? "every wired rule resolved and the volatility gate was open; historical timing is still unverified unless the session carries a collection receipt"
      : "no replayed morning resolves every wired rule with an open gate; see undefined_by_factor",
    per_session: rows
  };
}

module.exports = {
  VERSION,
  FROZEN_ON,
  STATUS,
  RULES,
  MIN_RANGE_PIPS,
  RANGE_HIGH,
  RANGE_LOW,
  VOLATILITY_FLOOR,
  SAFE_HAVEN_PCT,
  evaluate,
  overnightRangePosition,
  volatilityGate,
  frontEndDifferential,
  safeHavenDemand,
  summarise
};
