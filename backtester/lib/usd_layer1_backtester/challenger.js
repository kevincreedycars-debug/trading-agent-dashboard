"use strict";

/**
 * USD Layer 1 challenger, version 0 (research only, frozen 2026-11-08).
 *
 * The 25-factor programme has delivered the VIX chain's research and nothing further: twenty-four of
 * the twenty-five factor chains have no adjudication, so no combined 25-factor adjudication exists to
 * implement. Version 0 is therefore the honest null hypothesis that a future adjudication has to beat:
 * every mechanism whose USD direction is stated by the published rules carries exactly equal weight,
 * no parameter is fitted to any outcome, and the whole of it was fixed before a single date was scored.
 *
 * What makes it a challenger rather than a copy: it reads inputs the current model does not read
 * (broad-dollar momentum, EUR/USD and USD/JPY mirrors) and it gives every mechanism the same say,
 * instead of the current model's hand-weighted 100-point book. Anyone replacing this with the real
 * adjudication must bump the version string and refreeze; nothing here may be tuned against results.
 */

const VERSION = "usd-layer1-challenger-v0";
const FROZEN_ON = "2026-11-08";
const FROZEN_BEFORE = "the first date of the development window was scored";

/**
 * A mechanism is one input, one threshold and one declared USD direction. `vote` is +1 for bullish
 * USD, -1 for bearish, 0 for no signal. Every mechanism weighs 1.
 */
const MECHANISMS = Object.freeze([
  Object.freeze({
    id: "vix_regime",
    label: "VIX level and risk regime",
    factor: "live.f1-vix-level",
    input: "vix_level",
    rule: "VIX above 25 is safe-haven USD demand; below 16 is risk-on pressure",
    threshold: "25 / 16",
    vote: (value) => (value > 25 ? 1 : value < 16 ? -1 : 0)
  }),
  Object.freeze({
    id: "vix_momentum",
    label: "VIX 5-day change",
    factor: "live.f1-vix-level",
    input: "vix_d5_chg",
    rule: "a 5-day VIX rise of more than one index point bids USD; a fall of the same size releases it",
    threshold: "1 index point",
    vote: (value) => (value > 1 ? 1 : value < -1 ? -1 : 0)
  }),
  Object.freeze({
    id: "us_2y",
    label: "US 2-year yield 5-day change",
    factor: "live.f2-us-2y-yield-delta",
    input: "us_2y_d5_bps",
    rule: "front-end yields up more than 5bp support USD; down more than 5bp oppose it",
    threshold: "5 bp",
    vote: (value) => (value > 5 ? 1 : value < -5 ? -1 : 0)
  }),
  Object.freeze({
    id: "us_10y_real",
    label: "US 10-year real yield 5-day change",
    factor: "live.f4-us-10y-real-yield-delta",
    input: "us_10y_real_d5_bps",
    rule: "real yields up more than 5bp support USD; down more than 5bp oppose it",
    threshold: "5 bp",
    vote: (value) => (value > 5 ? 1 : value < -5 ? -1 : 0)
  }),
  Object.freeze({
    id: "broad_dollar_momentum",
    label: "Broad dollar 5-day momentum",
    factor: "live.f5-dxy-delta",
    input: "broad_dollar_d5_pct",
    rule:
      "the dollar's own 5-day move continues: a rise above 0.15% is read as USD strength and a fall as " +
      "weakness; FRED DTWEXBGS stands in for ICE DXY and is labelled as such everywhere",
    threshold: "0.15%",
    vote: (value) => (value > 0.15 ? 1 : value < -0.15 ? -1 : 0)
  }),
  Object.freeze({
    id: "gold",
    label: "Gold 5-day change",
    factor: "live.f6-gold-delta",
    input: "gold_d5_pct",
    rule: "gold up more than 0.5% is a hedge bid against USD; down more than 0.5% is the reverse",
    threshold: "0.5%",
    vote: (value) => (value > 0.5 ? -1 : value < -0.5 ? 1 : 0)
  }),
  Object.freeze({
    id: "equities",
    label: "NAS100 5-day change",
    factor: "live.f10-equity-regime",
    input: "nasdaq100_d5_pct",
    rule: "equities up more than 0.5% is risk-on and reads against USD; down more than 0.5% reads for it",
    threshold: "0.5%",
    vote: (value) => (value > 0.5 ? -1 : value < -0.5 ? 1 : 0)
  }),
  Object.freeze({
    id: "eurusd_mirror",
    label: "EUR/USD 5-day change",
    factor: "live.f3-us-de-2y-spread-delta (relative-rates read, expressed in the traded pair)",
    input: "eurusd_d5_pct",
    rule:
      "EUR/USD is USD inverted: a rise above 0.15% is read as USD weakness and a fall as USD strength; it " +
      "stands in for the German 2-year leg the current model cannot reconstruct, and says so",
    threshold: "0.15%",
    vote: (value) => (value > 0.15 ? -1 : value < -0.15 ? 1 : 0)
  }),
  Object.freeze({
    id: "usdjpy_mirror",
    label: "USD/JPY 5-day change",
    factor: "live.f9-dollar-smile (funding-currency read)",
    input: "usdjpy_d5_pct",
    rule: "USD/JPY is USD direct: a rise above 0.15% is read as USD strength and a fall as weakness",
    threshold: "0.15%",
    vote: (value) => (value > 0.15 ? 1 : value < -0.15 ? -1 : 0)
  })
]);

/** Every input deliberately left out of version 0, and the reason it cannot be used yet. */
const EXCLUDED_INPUTS = Object.freeze([
  Object.freeze({
    key: "us_de_2y_spread",
    reason: "no 05:00 cache of the German 2-year series exists in this checkout; EUR/USD momentum stands in"
  }),
  Object.freeze({
    key: "fed_bias",
    reason: "no historical Fed-bias snapshots exist; scoring it would mean inventing the input"
  }),
  Object.freeze({
    key: "latest_us_event",
    reason: "no committed event history reaches the cutoff with surprise scores"
  }),
  Object.freeze({
    key: "policy_rate_effr",
    reason: "a policy rate is a level that moves a handful of times a year, so its 5-day change is zero almost always"
  }),
  Object.freeze({
    key: "sofr",
    reason: "collinear with the effective policy rate; keeping both would double-count the same stance"
  }),
  Object.freeze({
    key: "us_3m_yield",
    reason: "collinear with the 2-year leg; the shorter point adds noise, not information"
  }),
  Object.freeze({ key: "us_5y_real_yield", reason: "collinear with the 10-year real yield already used" }),
  Object.freeze({
    key: "us_10y_yield",
    reason: "the real-yield leg is the cleaner signal; the nominal leg would double-count it"
  }),
  Object.freeze({
    key: "us_10y_breakeven",
    reason: "an inflation-expectations read with no single agreed USD sign, so it needs the adjudication first"
  }),
  Object.freeze({
    key: "credit_spread_hy",
    reason: "risk-appetite reading that overlaps VIX; its USD sign needs the adjudication"
  }),
  Object.freeze({ key: "sp500_level", reason: "overlaps NAS100, which the rules already name" }),
  Object.freeze({
    key: "wti_spot",
    reason: "an oil shock can move USD either way depending on the driver, so it needs the adjudication"
  }),
  Object.freeze({ key: "usdgbp", reason: "already inside the broad dollar index; adding it double-counts" }),
  Object.freeze({ key: "usdcad", reason: "already inside the broad dollar index; adding it double-counts" }),
  Object.freeze({ key: "usdchf", reason: "already inside the broad dollar index; adding it double-counts" }),
  Object.freeze({ key: "usdsek", reason: "already inside the broad dollar index; adding it double-counts" }),
  Object.freeze({ key: "afe_dollar", reason: "a regional subset of the broad index; the two would move together" })
]);

/** Frozen decision rules. Changing any of them means a new challenger version. */
const RULES = Object.freeze({
  equal_weight: 1,
  min_usable_mechanisms: 6,
  agreement_deadband: 0.2,
  conviction_bands: Object.freeze([
    Object.freeze({ min_agreement: 0.75, min_participation: 0.9, conviction: 5 }),
    Object.freeze({ min_agreement: 0.6, min_participation: 0.75, conviction: 4 }),
    Object.freeze({ min_agreement: 0.45, min_participation: 0.6, conviction: 3 }),
    Object.freeze({ min_agreement: 0.25, min_participation: 0.4, conviction: 2 }),
    Object.freeze({ min_agreement: 0, min_participation: 0, conviction: 1 })
  ])
});

function convictionFor(agreement, participation) {
  for (const band of RULES.conviction_bands) {
    if (agreement >= band.min_agreement && participation >= band.min_participation) return band.conviction;
  }
  return 1;
}

/**
 * Score one 05:00 snapshot.
 *
 * @param {object} snapshot a snapshot from `snapshots.buildSnapshots`.
 * @returns {object} the challenger's call record: direction, raw equal-weight score, conviction 1-5,
 *   the mechanism-by-mechanism votes, and an explicit reason whenever no call is made.
 */
function evaluate(snapshot) {
  const values = (snapshot && snapshot.values) || {};
  const votes = MECHANISMS.map((mechanism) => {
    const raw = values[mechanism.input];
    const hasValue = Number.isFinite(raw);
    return {
      id: mechanism.id,
      label: mechanism.label,
      factor: mechanism.factor,
      input: mechanism.input,
      rule: mechanism.rule,
      threshold: mechanism.threshold,
      weight: RULES.equal_weight,
      value: hasValue ? raw : null,
      vote: hasValue ? mechanism.vote(raw) : null,
      state: hasValue ? "usable" : "missing"
    };
  });

  const usable = votes.filter((entry) => entry.state === "usable");
  const missing = votes.filter((entry) => entry.state === "missing").map((entry) => entry.input);
  const participation = usable.length / MECHANISMS.length;
  const net = usable.reduce((total, entry) => total + entry.vote, 0);
  const agreement = usable.length ? Math.abs(net) / usable.length : 0;

  const base = {
    model: VERSION,
    frozen_on: FROZEN_ON,
    mechanisms: votes,
    excluded_inputs: EXCLUDED_INPUTS,
    usable_mechanisms: usable.length,
    mechanism_count: MECHANISMS.length,
    participation: Math.round(participation * 10000) / 10000,
    agreement: Math.round(agreement * 10000) / 10000,
    raw_score: net,
    missing_inputs: missing,
    inputs_used: usable.map((entry) => entry.input)
  };

  if (usable.length < RULES.min_usable_mechanisms) {
    return {
      ...base,
      direction: "NO_CALL",
      conviction: null,
      reason:
        `only ${usable.length} of ${MECHANISMS.length} mechanisms had a value at this cutoff and the frozen ` +
        `minimum is ${RULES.min_usable_mechanisms}, so no call is made and the missing inputs are named`
    };
  }

  if (agreement < RULES.agreement_deadband) {
    return {
      ...base,
      direction: "NO_CALL",
      conviction: null,
      reason:
        `the mechanisms split ${net > 0 ? "+" : ""}${net} across ${usable.length} live inputs, inside the frozen ` +
        `${RULES.agreement_deadband} agreement deadband, so the day is recorded as no call rather than a coin toss`
    };
  }

  return {
    ...base,
    direction: net > 0 ? "BULLISH" : "BEARISH",
    conviction: convictionFor(agreement, participation),
    reason:
      `${usable.length} of ${MECHANISMS.length} mechanisms live, net ${net > 0 ? "+" : ""}${net} ` +
      `(${Math.round(agreement * 100)}% agreement, ${Math.round(participation * 100)}% participation)`
  };
}

module.exports = {
  VERSION,
  FROZEN_ON,
  FROZEN_BEFORE,
  MECHANISMS,
  EXCLUDED_INPUTS,
  RULES,
  convictionFor,
  evaluate
};


