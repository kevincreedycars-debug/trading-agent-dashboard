"use strict";

/**
 * Model identity and the validity gate (research only, 2026-11-13).
 *
 * The question this file answers is narrower than "how often was the call right". It is: which model made
 * each historical call, and did the morning actually carry the inputs that model's decision requires?
 *
 * Three answers are kept apart on purpose, because collapsing them is how a proxy book becomes "the agent":
 *
 *   1. The intended agent is the adjudication's candidate, `USD-L1-LONDON-PIT-CONDITIONAL`. Its rule is
 *      undefined: the 2026-11-04 adjudication validates no sign, weight or threshold and returns
 *      CONFIG_BLOCKED, so a morning can only be `undefined_rule` for that model. It is never a no-call.
 *   2. The implemented book is challenger v1, the shared-source weighting experiment. Its rules are fully
 *      specified (they are v0's, inherited unchanged), so its mornings can be classified one by one.
 *   3. Whether an input "existed at the cutoff" is a ladder, not a boolean: the value must be present, its
 *      print must be inside the freshness limit its own release implies, its clock must be verified, and it
 *      must be the instrument the research names. A value that fails any rung is insufficient data, even if
 *      a number was stored.
 *
 * Nothing here decides a rule, moves a threshold or scores a factor against an outcome. Research only: no
 * network, no warehouse, no production path.
 */

const VERSION = "usd-l1-model-identity-v1";

/** The four outcomes the panel reports, defined once so the count and the label cannot drift apart. */
const OUTCOME = Object.freeze({
  valid_directional: Object.freeze({
    label: "Valid directional call",
    meaning:
      "every input the decision requires was present, inside its freshness limit, on a verified clock and on " +
      "the instrument the research names, and the model chose a direction"
  }),
  valid_no_call: Object.freeze({
    label: "Valid no-call",
    meaning:
      "the same inputs were all valid and the model deliberately abstained, so the abstention is a decision " +
      "rather than a data failure"
  }),
  insufficient_data: Object.freeze({
    label: "Insufficient data",
    meaning:
      "at least one required input was missing, stale beyond its release limit, on an unverified clock or not " +
      "the instrument the research names; the call is withdrawn, not counted as a no-call"
  }),
  undefined_rule: Object.freeze({
    label: "Undefined rule",
    meaning:
      "the model has no validated sign, weight, threshold or gate, so the morning cannot be scored at all; " +
      "this is not a market abstention and never enters accuracy or coverage"
  })
});

const OUTCOME_ORDER = Object.freeze([
  "valid_directional",
  "valid_no_call",
  "insufficient_data",
  "undefined_rule"
]);

/** The roles a factor can hold in the intended decision. */
const ROLE = Object.freeze({
  required: Object.freeze({
    label: "Required",
    missing_action: "no call: an absent value cannot be filled from a later print, a proxy or a neighbouring session"
  }),
  conditional: Object.freeze({
    label: "Required when a release falls in the window",
    missing_action:
      "no call when the window contains a scheduled release or applicability cannot be established, which " +
      "without an archived calendar is every morning"
  }),
  gate: Object.freeze({
    label: "Data-quality gate",
    missing_action: "no call: the gate is non-directional and blocks the call rather than voting"
  }),
  shared: Object.freeze({
    label: "Shared source",
    missing_action: "no separate requirement: the factor is counted through a retained factor and adds no input"
  }),
  excluded: Object.freeze({
    label: "Excluded by the research",
    missing_action: "no requirement: the research deliberately removes the factor from the call"
  })
});

/**
 * The intended model, as the research defines it.
 *
 * `rule_defined` is false for the same reason `config_status` is CONFIG_BLOCKED: the candidate names the
 * fields it wants but nothing fixes their transformation, sign or combination. A reader should be able to see
 * that from the artefact alone rather than infer it from a paragraph.
 */
const INTENDED_MODEL = Object.freeze({
  candidate_id: "USD-L1-LONDON-PIT-CONDITIONAL",
  specification_version: "0.1.0",
  name: "USD Layer 1, 05:00 London, point-in-time conditional candidate",
  cutoff: "05:00 Europe/London",
  horizon: "05:00 Europe/London on the next local date",
  research_status: "RESEARCH_FROZEN_NOT_VALIDATED",
  config_status: "CONFIG_BLOCKED",
  rule_defined: false,
  unresolved: Object.freeze([
    "the sign of every factor: no direction survives the adjudication as established",
    "the weight of every factor, and therefore any combined score",
    "every threshold, including the regime boundaries the implemented book inherits from v0",
    "the fallback for each input, and which inputs are optional rather than critical",
    "the conditional and abstention gates, including the release-window logic",
    "a registered sample, holdout, multiplicity and pass/fail plan"
  ]),
  required_input_policy: Object.freeze([
    "a factor the research retains needs its own named instrument at the cutoff; a declared substitute is a proxy, not the input",
    "a factor the research counts through another factor adds no requirement of its own",
    "a factor the research excludes is not required and must not block a call",
    "a release factor requires an archived consensus and first print before it can be required at all",
    "an unverified clock is insufficient data, because the value may not have existed at 05:00 London"
  ]),
  note:
    "CONFIG_BLOCKED is not a market abstention. It stops the candidate before any forecast is issued, so every " +
    "replayed morning is an undefined-rule morning for this model, whatever the implemented book did."
});

/**
 * Factors whose requirement depends on a scheduled release inside the session window. Without an archived
 * calendar their applicability is unknown every morning, so the conditional rule resolves to "required and
 * unverifiable" rather than "not applicable".
 */
const CONDITIONAL_FACTORS = Object.freeze([
  "live.f7-economic-surprise",
  "macro.release-surprise-at-first-print",
  "calendar.known-releases-between-cutoff-and-endpoint",
  "calendar.days-since-and-until-high-impact-events"
]);

/**
 * What the research names for each input the implemented book reads, against what the checkout stages.
 *
 * `same_instrument` is the identity rung: false means the number is a declared proxy. `clock_verified` is the
 * timing rung: false means no receipt evidence proves the print existed at the 05:00 London cutoff.
 */
const INPUT_IDENTITY = Object.freeze({
  vix_level: Object.freeze({
    research_instrument: "Cboe spot VIX, level and five-day delta",
    staged_instrument: "FRED VIXCLS",
    same_instrument: true,
    clock_verified: false,
    note: "the index is the right one; its receipt clock is not archived, so the one-business-day lag is an assumption"
  }),
  vix_d5_chg: Object.freeze({
    research_instrument: "Cboe spot VIX, level and five-day delta",
    staged_instrument: "FRED VIXCLS",
    same_instrument: true,
    clock_verified: false,
    note: "same lineage as the level; the change inherits the level's unverified clock"
  }),
  us_2y_d5_bps: Object.freeze({
    research_instrument: "FRED/H.15 DGS2, level and delta in bp",
    staged_instrument: "FRED DGS2",
    same_instrument: true,
    clock_verified: false,
    note: "H.15 publishes after the New York close; a 05:00 London read is the previous business day's print with no receipt evidence"
  }),
  de_2y_yield: Object.freeze({
    research_instrument: "a German 2Y series whose source, convention and calendar are unresolved",
    staged_instrument: "Bundesbank BBSIS daily 2.0-year zero-coupon spot (Svensson)",
    same_instrument: false,
    clock_verified: false,
    note:
      "the maturity matches DGS2 and the units are percent per annum, but a zero-coupon spot is not the constant-maturity " +
      "yield and not the Schatz yield-to-maturity the adjudication forbids equating; availability is a declared T-1 rule, " +
      "not a per-print receipt"
  }),
  us_de_2y_spread: Object.freeze({
    research_instrument: "DGS2 against a German 2Y series",
    staged_instrument: "FRED DGS2 minus Bundesbank BBSIS 2.0-year spot",
    same_instrument: false,
    clock_verified: false,
    note: "the spread inherits both legs' convention and clock caveats; no leg is filled when the other is absent"
  }),
  gold_d1_pct: Object.freeze({
    research_instrument: "a verified XAU/USD bullion stream or a declared contract",
    staged_instrument: "OANDA XAU/USD one-hour broker quote",
    same_instrument: false,
    clock_verified: true,
    note: "the 05:00 bar exists, but a broker CFD quote is neither a verified bullion stream nor a declared contract"
  }),
  usdjpy_d1_pct: Object.freeze({
    research_instrument: "an intraday JPY leg against USD at the cutoff",
    staged_instrument: "FRED DEXJPUS, weekly H.10 carry",
    same_instrument: false,
    clock_verified: false,
    note: "a weekly bilateral daily rate cannot express an overnight move; the one-print change is a declared proxy"
  }),
  us_10y_real_d5_bps: Object.freeze({
    research_instrument: "FRED DFII10, level and delta in bp",
    staged_instrument: "FRED DFII10",
    same_instrument: true,
    clock_verified: false,
    note: "same H.15 clock problem as the two-year leg"
  }),
  broad_dollar_d5_pct: Object.freeze({
    research_instrument: "FRED DTWEXBGS as an explicitly broad index",
    staged_instrument: "FRED DTWEXBGS, weekly H.10 carry",
    same_instrument: true,
    clock_verified: true,
    note:
      "the index is the one F5 names, but the weekly carry means the five-day change spans up to eleven " +
      "calendar days; F11 names official ICE DXY and does not accept this series"
  }),
  gold_d5_pct: Object.freeze({
    research_instrument: "a verified XAU/USD bullion stream or a declared contract",
    staged_instrument: "OANDA XAU/USD one-hour broker quote",
    same_instrument: false,
    clock_verified: true,
    note: "the bar opens at the cutoff, but a broker CFD quote is neither a verified bullion stream nor a declared contract"
  }),
  nasdaq100_d5_pct: Object.freeze({
    research_instrument: "a verified QQQ payload or a separately registered equity feature",
    staged_instrument: "OANDA NAS100 one-hour quote",
    same_instrument: false,
    clock_verified: true,
    note: "NAS100 is a cash index quote, not the QQQ payload the rulebook names"
  }),
  eurusd_d5_pct: Object.freeze({
    research_instrument: "the official DXY source at declared trailing endpoints",
    staged_instrument: "FRED DEXUSEU, weekly H.10 carry",
    same_instrument: false,
    clock_verified: true,
    note:
      "a weekly bilateral daily rate is not session momentum, and the family is attributed to F11 in v1 even " +
      "though the research reads no pair there"
  }),
  usdjpy_d5_pct: Object.freeze({
    research_instrument: "the official DXY source at declared trailing endpoints",
    staged_instrument: "FRED DEXJPUS, weekly H.10 carry",
    same_instrument: false,
    clock_verified: true,
    note: "as EUR/USD: a weekly bilateral rate standing in for a session-momentum factor"
  })
});

/**
 * The freshness limit each implemented input inherits from its own release schedule. The values are the ones
 * `data_path.js` derives from the macro inventory; they are repeated here because the gate runs on a saved
 * session row and a saved row does not carry the spec.
 */
const INPUT_FRESHNESS_BUSINESS_DAYS = Object.freeze({
  vix_level: 1,
  vix_d5_chg: 1,
  us_2y_d5_bps: 1,
  us_10y_real_d5_bps: 1,
  broad_dollar_d5_pct: 6,
  gold_d5_pct: 0,
  nasdaq100_d5_pct: 0,
  eurusd_d5_pct: 6,
  usdjpy_d5_pct: 6
});

/** The nine inputs the implemented book reads, in mechanism order. */
const IMPLEMENTED_INPUTS = Object.freeze(Object.keys(INPUT_FRESHNESS_BUSINESS_DAYS));

/** A derived key inherits the base series' print date and age. Kept local so the gate needs no other module. */
const BASE_SERIES = Object.freeze({
  vix_level: "vix_level",
  vix_d5_chg: "vix_level",
  vix_d1_chg: "vix_level",
  vix_d20_chg: "vix_level",
  us_2y_d5_bps: "us_2y_yield",
  us_2y_d1_bps: "us_2y_yield",
  us_2y_d20_bps: "us_2y_yield",
  us_10y_real_d5_bps: "us_10y_real_yield",
  us_10y_real_d1_bps: "us_10y_real_yield",
  us_10y_real_d20_bps: "us_10y_real_yield",
  broad_dollar_d5_pct: "broad_dollar",
  broad_dollar_d1_pct: "broad_dollar",
  broad_dollar_d20_pct: "broad_dollar",
  gold_d5_pct: "gold_price",
  gold_d1_pct: "gold_price",
  gold_d20_pct: "gold_price",
  nasdaq100_d5_pct: "nasdaq100_price",
  nasdaq100_d1_pct: "nasdaq100_price",
  nasdaq100_d20_pct: "nasdaq100_price",
  eurusd_d5_pct: "eurusd",
  usdjpy_d5_pct: "usdjpy"
});

function baseKey(key) {
  return BASE_SERIES[key] || key;
}

/** Which of the four outcomes a factor's requirement produces. `treatment` is the adjudication's own field. */
function roleOf(factor) {
  if (!factor) return "required";
  if (CONDITIONAL_FACTORS.includes(factor.factor_id)) return "conditional";
  if (factor.treatment === "no_call") return "gate";
  if (factor.treatment === "excluded") return "excluded";
  if (factor.treatment === "counted_elsewhere") return "shared";
  return "required";
}

/** The lookback a factor's rule reads, said in words rather than guessed from a key name. */
function lookbackOf(factor) {
  const keys = (factor.inputs || []).map((entry) => entry.key);
  const windows = new Set();
  for (const key of keys) {
    if (/_d1_/.test(key)) windows.add("one business day");
    if (/_d5_/.test(key)) windows.add("five business days");
    if (/_d20_/.test(key)) windows.add("twenty business days");
    if (/momentum_\d+s/.test(key)) windows.add("intraday seconds");
    if (/overnight_range/.test(key)) windows.add("the overnight range before the cutoff");
    if (/volatility_/.test(key)) windows.add("a rolling 60-120 hour window");
  }
  if (!keys.length) return "not defined: the research names a field but no series is staged";
  return [...windows].join(", ") || "the level at the cutoff";
}

/**
 * The per-factor requirement table over the frozen twenty-five rows.
 *
 * Every row carries its role, the source the checkout would read, the fields, the lookback, the freshness
 * limit, whether the clock is verified, whether the staged instrument is the one the research names, how
 * often a value existed, and what a missing value does to the decision.
 */
function buildRequirementTable({ factors } = {}) {
  if (!Array.isArray(factors) || !factors.length) throw new Error("the requirement table needs the factor spec");
  const rows = factors.map((factor) => {
    const role = roleOf(factor);
    const inputs = Array.isArray(factor.inputs) ? factor.inputs : [];
    const providers = [...new Set(inputs.map((entry) => entry.source).filter(Boolean))];
    const timingVerified = inputs.length > 0 && inputs.every((entry) => entry.timing_verified);
    const identityChecked = inputs.map((entry) => INPUT_IDENTITY[entry.key]).filter(Boolean);
    const sessionsPresent = inputs.length
      ? Math.min(...inputs.map((entry) => (Number.isFinite(entry.sessions_present) ? entry.sessions_present : 0)))
      : 0;
    const freshness = [
      ...new Set(inputs.map((entry) => entry.fresh_business_days).filter((value) => Number.isFinite(value)))
    ];
    const fields = inputs.map((entry) => entry.key);
    // Whether the implemented book reads any of this factor's inputs. A required factor that no implemented
    // mechanism reads cannot withhold a morning: its absence is an identity gap, not a missing value.
    const enforced = fields.some((key) => IMPLEMENTED_INPUTS.includes(key));
    return {
      factor_id: factor.factor_id,
      label: factor.label,
      role,
      role_label: ROLE[role].label,
      treatment: factor.treatment,
      source: providers.join("; ") || "none staged",
      fields,
      enforced_by_implemented_book: enforced,
      lookback: lookbackOf(factor),
      freshness_business_days: freshness.length ? freshness : null,
      timing_verified: timingVerified,
      identity_verified:
        inputs.length > 0 && identityChecked.length > 0 && identityChecked.every((entry) => entry.same_instrument),
      sessions_with_a_value: sessionsPresent,
      missing_action:
        role === "required" && !enforced
          ? "the intended model withholds; the implemented book reads none of this factor's inputs, so the gap is an identity gap, not a data gap"
          : ROLE[role].missing_action,
      disposition: factor.disposition || null,
      verdict: factor.verdict || null,
      candidate: factor.candidate || null
    };
  });
  const required = rows.filter((row) => row.role === "required" || row.role === "conditional");
  const gate = rows.filter((row) => row.role === "gate");
  const shared = rows.filter((row) => row.role === "shared");
  const excluded = rows.filter((row) => row.role === "excluded");
  const keysFor = (list) => [...new Set(list.flatMap((row) => row.fields))];
  return {
    version: VERSION,
    rows,
    counts: {
      factors: rows.length,
      required: rows.filter((row) => row.role === "required").length,
      conditional: rows.filter((row) => row.role === "conditional").length,
      gate: gate.length,
      shared: shared.length,
      excluded: excluded.length
    },
    required_keys: keysFor(required),
    gate_keys: keysFor(gate),
    conditional_keys: keysFor(rows.filter((row) => row.role === "conditional")),
    shared_keys: keysFor(shared),
    excluded_keys: keysFor(excluded),
    required_factors_without_a_staged_input: required.filter((row) => !row.fields.length).map((row) => row.factor_id),
    required_factors_the_implemented_book_never_reads: rows
      .filter((row) => row.role === "required" && !row.enforced_by_implemented_book)
      .map((row) => row.factor_id),
    factors_without_a_staged_input: rows.filter((row) => !row.fields.length).map((row) => row.factor_id)
  };
}

/** Present values and their print age for one saved session row, by key. Thin wrapper on `input_meta`. */
function inputIndex(session) {
  const index = new Map();
  const meta = Array.isArray(session && session.input_meta) ? session.input_meta : [];
  for (const entry of meta) {
    if (!Array.isArray(entry) || !entry[0]) continue;
    index.set(entry[0], { print_date: entry[1] || null, staleness: Number.isFinite(entry[2]) ? entry[2] : null });
  }
  const values = Object.assign({}, (session && session.saved_inputs) || {}, (session && session.audit_values) || {});
  return { index, values };
}

function hasValue(state, key) {
  if (Number.isFinite(state.values[key])) return true;
  return state.index.has(key);
}

function stalenessOf(state, key) {
  const direct = state.index.get(key);
  if (direct && Number.isFinite(direct.staleness)) return direct.staleness;
  const base = state.index.get(baseKey(key));
  return base && Number.isFinite(base.staleness) ? base.staleness : null;
}

/**
 * The four-rung ladder for one morning, over one input set.
 *
 * Each rung is a separate boolean so a reader can see where a morning stopped: a value can be present and
 * still be stale, and it can be present and fresh and still be the wrong instrument.
 */
function ladderFor({ session, keys, limits = {}, identity = {} }) {
  const state = inputIndex(session);
  const missing = keys.filter((key) => !hasValue(state, key));
  const present = missing.length === 0;
  const stale = [];
  const unclocked = [];
  const wrongInstrument = [];
  for (const key of keys) {
    if (!hasValue(state, key)) continue;
    const limit = Number.isFinite(limits[key]) ? limits[key] : null;
    const age = stalenessOf(state, key);
    if (limit !== null && Number.isFinite(age) && age > limit) stale.push({ key, age, limit });
    const record = identity[key];
    if (record && record.clock_verified === false) unclocked.push(key);
    if (record && record.same_instrument === false) wrongInstrument.push(key);
  }
  const fresh = present && stale.length === 0;
  const clocked = fresh && unclocked.length === 0;
  const identified = clocked && wrongInstrument.length === 0;
  return {
    present,
    fresh,
    clocked,
    identified,
    missing,
    stale,
    unclocked,
    wrong_instrument: wrongInstrument
  };
}

/**
 * Classify one morning for one model.
 *
 * `mode: "intended"` is rule-first: a candidate whose configuration is blocked cannot issue a forecast, so the
 * morning is `undefined_rule` whatever the data says. The ladder is still returned, because the count of
 * mornings that could have carried the decision is the number the audit has to report.
 *
 * `mode: "implemented"` is gate-first: the book's rules are fully specified, so the question is only whether
 * the inputs were valid. An invalid morning is `insufficient_data`, never a no-call, and a directional call on
 * such a morning is listed as withdrawn rather than scored.
 */
function classifySession({ session, requirements, mode = "implemented" }) {
  if (!session) throw new Error("the validity gate needs one session");
  if (!requirements) throw new Error("the validity gate needs the requirement table");
  const call = session.models && session.models.challenger_v1 ? session.models.challenger_v1 : null;
  if (mode === "intended") {
    const keys = [...new Set([...requirements.required_keys, ...requirements.gate_keys])];
    const ladder = ladderFor({ session, keys, identity: INPUT_IDENTITY });
    return {
      model: "intended",
      date: session.date,
      outcome: !INTENDED_MODEL.rule_defined
        ? "undefined_rule"
        : ladder.identified
          ? "valid_no_call"
          : "insufficient_data",
      reason: INTENDED_MODEL.rule_defined
        ? null
        : "the adjudication's candidate returns CONFIG_BLOCKED: no sign, weight, threshold or gate is validated, so no forecast can be issued",
      inputs_required: keys.length,
      inputs_missing: ladder.missing.length,
      ladder,
      call_direction: null,
      withdrawn: false
    };
  }
  const ladder = ladderFor({
    session,
    keys: IMPLEMENTED_INPUTS,
    limits: INPUT_FRESHNESS_BUSINESS_DAYS,
    identity: INPUT_IDENTITY
  });
  const direction = call && call.direction ? call.direction : null;
  const dataGate = ladder.present && ladder.fresh;
  const researchGate = ladder.identified;
  const outcomeFor = (pass) => {
    if (!pass) return "insufficient_data";
    if (!direction || direction === "NO_CALL") return "valid_no_call";
    return "valid_directional";
  };
  const gate = researchGate ? "research" : dataGate ? "data" : "none";
  return {
    model: "challenger_v1",
    date: session.date,
    outcome: outcomeFor(researchGate),
    data_gate_outcome: outcomeFor(dataGate),
    gate,
    reason: researchGate
      ? null
      : !dataGate
        ? "a required input was missing or older than the freshness limit its release allows"
        : ladder.unclocked.length
          ? `no receipt evidence puts ${ladder.unclocked.join(", ")} at the 05:00 cutoff`
          : `${ladder.wrong_instrument.join(", ")} is a declared proxy, not the instrument the research names`,
    inputs_required: IMPLEMENTED_INPUTS.length,
    inputs_missing: ladder.missing.length,
    ladder,
    call_direction: direction,
    conviction: call ? call.conviction : null,
    usable_mechanisms: call ? call.usable_mechanisms : null,
    withdrawn: dataGate && !researchGate && direction !== "NO_CALL",
    withdrawn_by_data_gate: !dataGate && direction !== "NO_CALL"
  };
}

/** Tally a list of classifications into the four named outcomes, keeping every morning in exactly one. */
function tally(rows) {
  const counts = {};
  for (const key of OUTCOME_ORDER) counts[key] = 0;
  const withdrawals = { directional_calls: 0, no_calls: 0 };
  for (const row of rows) {
    const key = row.outcome;
    counts[key] = (counts[key] || 0) + 1;
    const directional = row.call_direction && row.call_direction !== "NO_CALL";
    if (row.outcome === "insufficient_data" && directional) withdrawals.directional_calls += 1;
    if (row.outcome === "insufficient_data" && !directional) withdrawals.no_calls += 1;
  }
  return {
    counts,
    sessions: rows.length,
    accounted_for: OUTCOME_ORDER.reduce((total, key) => total + counts[key], 0),
    withdrawals
  };
}

/** One rung of the ladder over the whole run: how many mornings and how many directional calls reach it. */
function ladderTotals(rows, rung, directionalOnly = false) {
  const subset = rows.filter((row) =>
    directionalOnly ? row.call_direction && row.call_direction !== "NO_CALL" : true
  );
  return {
    rung,
    scope: directionalOnly ? "directional_calls" : "sessions",
    sessions_passing: subset.filter((row) => row.ladder && row.ladder[rung]).length,
    sessions: subset.length
  };
}

/**
 * Score test 2 on the calls a gate accepts.
 *
 * The published numbers are recomputed from the same rows rather than copied, so the two denominators cannot
 * be confused: one is every directional call the book made, the other is every directional call that used
 * valid inputs. A gate that accepts nothing reports null accuracy rather than a number with no denominator.
 */
function scoreFourMarkets({ rows, model = "challenger_v1", markets } = {}) {
  if (!Array.isArray(rows) || !rows.length) throw new Error("the market score needs the session rows");
  const keys = Array.isArray(markets) && markets.length ? markets : Object.keys(rows[0].outcomes || {});
  const called = (row) =>
    keys.some((key) => row.results && row.results[model] && row.results[model][key] !== "no_call");
  const tallyFor = (filter) => {
    const byMarket = {};
    for (const key of keys) byMarket[key] = { scored: 0, hits: 0, misses: 0, flat: 0 };
    for (const row of rows) {
      if (!filter(row)) continue;
      for (const key of keys) {
        const result = row.results && row.results[model] ? row.results[model][key] : null;
        if (result === "hit") {
          byMarket[key].hits += 1;
          byMarket[key].scored += 1;
        } else if (result === "miss") {
          byMarket[key].misses += 1;
          byMarket[key].scored += 1;
        } else if (result === "flat") {
          byMarket[key].flat += 1;
        }
      }
    }
    for (const entry of Object.values(byMarket)) {
      entry.accuracy_pct = entry.scored ? Math.round((entry.hits / entry.scored) * 10000) / 100 : null;
    }
    return byMarket;
  };
  return {
    model,
    // `all_calls` is every directional call this model made, whatever the gate thinks of its inputs; it is the
    // denominator the artefact already publishes for the same-day tests, recomputed from the rows.
    all_calls: tallyFor(called),
    data_gate: tallyFor((row) => called(row) && row.data_gate_outcome === "valid_directional"),
    research_gate: tallyFor((row) => called(row) && row.outcome === "valid_directional")
  };
}

/**
 * The whole gate block: the intended ledger, the implemented ledger, the ladder and the recomputed test 2.
 *
 * The two ledgers answer different questions and are never added together. The intended ledger is rule-first,
 * so it is one number repeated 725 times until the configuration is fixed. The implemented ledger classifies
 * each morning, and every morning lands in exactly one of the four outcomes.
 */
function buildValidityGate({ sessions, factors, markets } = {}) {
  if (!Array.isArray(sessions) || !sessions.length) throw new Error("the validity gate needs the sessions");
  const requirements = buildRequirementTable({ factors });
  const intended = sessions.map((session) => classifySession({ session, requirements, mode: "intended" }));
  const implemented = sessions.map((session) => classifySession({ session, requirements, mode: "implemented" }));
  const intendedTally = tally(intended);
  const implementedTally = tally(implemented);
  const dataGateTally = tally(implemented.map((row) => ({ ...row, outcome: row.data_gate_outcome })));
  const requiredKeys = [...new Set([...requirements.required_keys, ...requirements.gate_keys])];
  const requiredLadders = sessions.map((session) => ladderFor({ session, keys: requiredKeys, identity: INPUT_IDENTITY }));
  const requiredWithoutInput = requirements.rows.filter((row) => row.role === "required" && !(row.fields || []).length);
  const valueOf = (session, key) => {
    const values = { ...(session.saved_inputs || {}), ...(session.audit_values || {}), ...(session.values || {}) };
    return Number.isFinite(values[key]);
  };
  const stagedRows = requirements.rows.filter((row) => (row.fields || []).length);
  const factorLevelPresent = sessions.filter((session) =>
    stagedRows.every((row) => row.fields.some((key) => valueOf(session, key)))
  ).length;
  const merged = implemented.map((row, index) => ({
    ...sessions[index],
    outcome: row.outcome,
    data_gate_outcome: row.data_gate_outcome
  }));
  return {
    version: VERSION,
    cutoff: INTENDED_MODEL.cutoff,
    intended_model: INTENDED_MODEL,
    requirement_counts: requirements.counts,
    requirement_table: requirements.rows,
    required_inputs: requiredKeys,
    required_inputs_declared: requiredKeys.length,
    required_inputs_never_present: requiredKeys.filter((key) => requiredLadders.every((ladder) => ladder.missing.includes(key))),
    sessions_with_every_required_input: requiredLadders.filter((ladder) => ladder.present).length,
    sessions_with_every_required_input_valid: requiredLadders.filter((ladder) => ladder.identified).length,
    sessions_with_every_implemented_input: implemented.filter((row) => row.ladder.present).length,
    // The number this audit exists to answer. A morning can only count when every required factor has both an
    // input at the cutoff and a rule that reads it. Four required factors have no staged field at all, so this
    // is 0 by construction until a source and a rule exist for them; it is not a marginal shortfall.
    sessions_meeting_intended_requirements: requiredWithoutInput.length ? 0 : requiredLadders.filter((ladder) => ladder.present).length,
    intended_requirement_blockers: requiredWithoutInput.map((row) => ({
      factor_id: row.factor_id,
      label: row.label,
      why: "a required factor with no staged input: no value can be present at any cutoff until a source is acquired"
    })),
    presence_counts: {
      key_level_all_required_inputs_present: requiredLadders.filter((ladder) => ladder.present).length,
      factor_level_every_staged_factor_has_some_value: factorLevelPresent,
      intended_requirements_met: requiredWithoutInput.length ? 0 : requiredLadders.filter((ladder) => ladder.present).length,
      note:
        "three different denominators: per required key (the strict one used by the ladder), per staged factor " +
        "(what the 2026-11-11 data-path audit reported at factor level), and per intended requirement (zero " +
        "while a required factor has no source)"
    },
    intended: {
      ...intendedTally,
      outcome: "undefined_rule",
      why:
        "the candidate is CONFIG_BLOCKED, so no morning is a valid directional call or a valid no-call for the " +
        "intended agent; the abstentions recorded in this artefact belong to the implemented book"
    },
    implemented: {
      ...implementedTally,
      model: "challenger_v1 (shared-source weighting experiment)"
    },
    data_gate: {
      ...dataGateTally,
      note:
        "presence and freshness only: these are the calls a data-completeness gate accepts, and they are what " +
        "the published provisional numbers rest on; they are not calls on the research's inputs"
    },
    research_gate: {
      accepted: implementedTally.counts.valid_directional + implementedTally.counts.valid_no_call,
      note:
        "presence, freshness, a verified clock and the named instrument: no replayed morning passes all four " +
        "rungs, so the strict gate accepts no call and no accuracy denominator survives unqualified"
    },
    ladder: [
      ladderTotals(implemented, "present"),
      ladderTotals(implemented, "fresh"),
      ladderTotals(implemented, "clocked"),
      ladderTotals(implemented, "identified"),
      ladderTotals(implemented, "present", true),
      ladderTotals(implemented, "fresh", true),
      ladderTotals(implemented, "clocked", true),
      ladderTotals(implemented, "identified", true)
    ],
    four_markets: scoreFourMarkets({ rows: merged, model: "challenger_v1", markets }),
    days: implemented.map((row, index) => ({
      date: row.date,
      intended: intended[index].outcome,
      implemented: row.outcome,
      data_gate: row.data_gate_outcome,
      gate: row.gate,
      withdrawn: Boolean(row.withdrawn || row.withdrawn_by_data_gate),
      reason: row.reason,
      missing: row.ladder.missing,
      stale: row.ladder.stale,
      unclocked: row.ladder.unclocked,
      wrong_instrument: row.ladder.wrong_instrument
    })),
    notes: [
      "the intended agent is the adjudication's candidate, not the implemented book; its rule is undefined, so its only possible outcome is undefined-rule",
      "insufficient data is a data failure, not an abstention; a directional call on such a morning is withdrawn and never enters an accuracy denominator",
      "a proxy that is present and fresh still fails the identity requirement: presence is not identity",
      "no weight, threshold or vote direction is changed by this gate, and no call is re-issued"
    ]
  };
}

/**
 * Which of the twenty-five research factors the implemented book actually carries, and under what verdict.
 *
 * `implemented` means a mechanism reads the factor's own named input, `proxy_only` means every mechanism that
 * claims the factor reads a declared substitute, `shared_only` means the factor is counted through another and
 * so has no mechanism of its own, `not_implemented` means nothing reads it at all.
 */
function buildIdentityCheck({ factors, mechanisms } = {}) {
  if (!Array.isArray(factors) || !factors.length) throw new Error("the identity check needs the factor spec");
  const list = Array.isArray(mechanisms) ? mechanisms : [];
  const rows = factors.map((factor) => {
    const byFactor = list.filter((mechanism) => mechanism.factor === factor.factor_id);
    const ownKeys = new Set((factor.inputs || []).map((entry) => entry.key));
    const direct = byFactor.filter((mechanism) => ownKeys.has(mechanism.input));
    const proxies = byFactor.filter((mechanism) => !ownKeys.has(mechanism.input));
    const role = roleOf(factor);
    const directAllNamed = direct.length > 0 && direct.every(
      (mechanism) => (INPUT_IDENTITY[mechanism.input] || {}).same_instrument !== false
    );
    const match = byFactor.length
      ? directAllNamed
        ? "implemented"
        : "proxy_only"
      : role === "shared"
        ? "shared_only"
        : role === "excluded"
          ? "excluded"
          : role === "gate"
            ? "gate_only"
            : "not_implemented";
    return {
      factor_id: factor.factor_id,
      label: factor.label,
      role,
      treatment: factor.treatment,
      mechanisms: byFactor.map((mechanism) => mechanism.id),
      direct_inputs: direct.map((mechanism) => mechanism.input),
      proxy_inputs: proxies.map((mechanism) => mechanism.input),
      match,
      note: byFactor.length
        ? null
        : role === "gate"
          ? "a non-directional data-quality gate: it has no mechanism of its own and blocks the call instead"
          : (factor.inputs || []).length
            ? "no mechanism is attributed to this factor, so its input is read by no rule"
            : "the research names a field but the checkout stages no series for it"
    };
  });
  const counts = {};
  for (const row of rows) counts[row.match] = (counts[row.match] || 0) + 1;
  return {
    version: VERSION,
    rows,
    counts,
    implemented_factors: rows.filter((row) => row.match === "implemented").map((row) => row.factor_id),
    proxy_factors: rows.filter((row) => row.match === "proxy_only").map((row) => row.factor_id),
    unread_factors: rows.filter((row) => row.match === "not_implemented").map((row) => row.factor_id)
  };
}

module.exports = {
  VERSION,
  OUTCOME,
  OUTCOME_ORDER,
  ROLE,
  INTENDED_MODEL,
  CONDITIONAL_FACTORS,
  INPUT_IDENTITY,
  INPUT_FRESHNESS_BUSINESS_DAYS,
  IMPLEMENTED_INPUTS,
  baseKey,
  roleOf,
  lookbackOf,
  buildRequirementTable,
  inputIndex,
  ladderFor,
  classifySession,
  tally,
  ladderTotals,
  scoreFourMarkets,
  buildValidityGate,
  buildIdentityCheck
};
