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

const votes = require("../../../lib/usd_l1_votes");

const VERSION = "usd-layer1-challenger-v0";
const FROZEN_ON = "2026-11-08";
const FROZEN_BEFORE = "the first date of the development window was scored";

/**
 * A mechanism is one input, one threshold and one declared USD direction. `vote_spec` is an ordered list
 * of branches; the first branch an input satisfies decides the vote, +1 for bullish USD, -1 for bearish,
 * 0 for no reading. Every mechanism weighs 1. The spec is the rule, so the dashboard panel can re-run the
 * same rule on the values saved in the artefact through the same interpreter (`lib/usd_l1_votes.js`).
 */
const MECHANISM_SPECS = Object.freeze([
  Object.freeze({
    id: "vix_regime",
    label: "VIX level and risk regime",
    factor: "live.f1-vix-level",
    input: "vix_level",
    rule: "VIX above 25 is safe-haven USD demand; below 16 is risk-on pressure",
    threshold: "25 / 16",
    vote_spec: Object.freeze([{ when: "gt", value: 25, usd: 1 }, { when: "lt", value: 16, usd: -1 }])
  }),
  Object.freeze({
    id: "vix_momentum",
    label: "VIX 5-day change",
    factor: "live.f1-vix-level",
    input: "vix_d5_chg",
    rule: "a 5-day VIX rise of more than one index point bids USD; a fall of the same size releases it",
    threshold: "1 index point",
    vote_spec: Object.freeze([{ when: "gt", value: 1, usd: 1 }, { when: "lt", value: -1, usd: -1 }])
  }),
  Object.freeze({
    id: "us_2y",
    label: "US 2-year yield 5-day change",
    factor: "live.f2-us-2y-delta",
    input: "us_2y_d5_bps",
    rule: "front-end yields up more than 5bp support USD; down more than 5bp oppose it",
    threshold: "5 bp",
    vote_spec: Object.freeze([{ when: "gt", value: 5, usd: 1 }, { when: "lt", value: -5, usd: -1 }])
  }),
  Object.freeze({
    id: "us_10y_real",
    label: "US 10-year real yield 5-day change",
    factor: "live.f4-real-yield-delta",
    input: "us_10y_real_d5_bps",
    rule: "real yields up more than 5bp support USD; down more than 5bp oppose it",
    threshold: "5 bp",
    vote_spec: Object.freeze([{ when: "gt", value: 5, usd: 1 }, { when: "lt", value: -5, usd: -1 }])
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
    vote_spec: Object.freeze([{ when: "gt", value: 0.15, usd: 1 }, { when: "lt", value: -0.15, usd: -1 }])
  }),
  Object.freeze({
    id: "gold",
    label: "Gold 5-day change",
    factor: "live.f6-gold-delta",
    input: "gold_d5_pct",
    rule: "gold up more than 0.5% is a hedge bid against USD; down more than 0.5% is the reverse",
    threshold: "0.5%",
    vote_spec: Object.freeze([{ when: "gt", value: 0.5, usd: -1 }, { when: "lt", value: -0.5, usd: 1 }])
  }),
  Object.freeze({
    id: "equities",
    label: "NAS100 5-day change",
    factor: "live.f10-equity-versus-usd",
    input: "nasdaq100_d5_pct",
    rule: "equities up more than 0.5% is risk-on and reads against USD; down more than 0.5% reads for it",
    threshold: "0.5%",
    vote_spec: Object.freeze([{ when: "gt", value: 0.5, usd: -1 }, { when: "lt", value: -0.5, usd: 1 }])
  }),
  Object.freeze({
    id: "eurusd_mirror",
    label: "EUR/USD 5-day change",
    factor: "live.f3-us-de-2y-spread-delta",
    input: "eurusd_d5_pct",
    rule:
      "EUR/USD is USD inverted: a rise above 0.15% is read as USD weakness and a fall as USD strength; it " +
      "stands in for the German 2-year leg the current model cannot reconstruct, and says so",
    threshold: "0.15%",
    vote_spec: Object.freeze([{ when: "gt", value: 0.15, usd: -1 }, { when: "lt", value: -0.15, usd: 1 }])
  }),
  Object.freeze({
    id: "usdjpy_mirror",
    label: "USD/JPY 5-day change",
    factor: "live.f9-dollar-smile",
    input: "usdjpy_d5_pct",
    rule: "USD/JPY is USD direct: a rise above 0.15% is read as USD strength and a fall as weakness",
    threshold: "0.15%",
    vote_spec: Object.freeze([{ when: "gt", value: 0.15, usd: 1 }, { when: "lt", value: -0.15, usd: -1 }])
  })
]);

/** The frozen mechanism list, each with its vote rule attached as a function for the engine's own use. */
const MECHANISMS = Object.freeze(
  MECHANISM_SPECS.map((mechanism) =>
    Object.freeze({ ...mechanism, vote: (value) => votes.interpretVote(mechanism.vote_spec, value) })
  )
);

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
  return votes.convictionFor(RULES, agreement, participation);
}

/**
 * Score one 05:00 snapshot.
 *
 * The rules are declarative (`vote_spec`) and the interpreter is shared with the dashboard panel, so the
 * panel re-runs this same rule on the values saved in the artefact instead of re-implementing it.
 *
 * @param {object} snapshot a snapshot from `snapshots.buildSnapshots`.
 * @returns {object} the challenger's call record: direction, raw equal-weight score, conviction 1-5,
 *   the mechanism-by-mechanism votes, and an explicit reason whenever no call is made.
 */
function evaluate(snapshot) {
  const values = (snapshot && snapshot.values) || {};
  const record = votes.evaluateFromSpecs({ mechanisms: MECHANISMS, rules: RULES, values });
  return {
    model: VERSION,
    frozen_on: FROZEN_ON,
    excluded_inputs: EXCLUDED_INPUTS,
    ...record
  };
}

module.exports = {
  VERSION,
  FROZEN_ON,
  FROZEN_BEFORE,
  MECHANISMS,
  MECHANISM_SPECS,
  EXCLUDED_INPUTS,
  RULES,
  convictionFor,
  evaluate
};


