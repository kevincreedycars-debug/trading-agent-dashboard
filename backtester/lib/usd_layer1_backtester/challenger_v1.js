"use strict";

/**
 * USD Layer 1 challenger, version 1 (research only, frozen 2026-11-10).
 *
 * Version 0 was frozen on 2026-11-08 as the equal-weight null hypothesis, on the recorded premise that only
 * one of the twenty-five factor chains had delivered research. That premise was about the registry, not the
 * research: the 2026-11-04 final adjudication had already returned twenty-five factor adjudications, a final
 * analysis, a final red-team and this final adjudication, and it says two things version 0 cannot ignore.
 *
 *  1. No factor's direction, weight, sign or threshold is validated. The adjudication's own candidate,
 *     `USD-L1-LONDON-PIT-CONDITIONAL`, returns CONFIG_BLOCKED, and it explicitly rejects filling unknown
 *     weights or thresholds with plausible numbers to make a specification run.
 *  2. Counting one source twice is a structural error. Matched duplicate inputs add no raw information, so a
 *     factor measured through two transformations of the same series must not outweigh a factor measured once.
 *
 * Version 1 therefore changes exactly one thing about the book: a shared-source family now holds one unit of
 * say between its members, so VIX's level and its five-day change contribute half each, and the EUR/USD and
 * USD/JPY mirrors contribute half each. Nothing else moves. Every threshold, the 0.2 agreement deadband, the
 * six-mechanism minimum, the conviction bands and the nine inputs are inherited from version 0 unchanged, so
 * no number is invented and no parameter is fitted. Version 0 stays frozen and stays the benchmark: a version
 * 1 that scores differently is a different rule, not a better one, until a pre-registered test says otherwise.
 *
 * The adjudication's blockers are carried here as data, not hidden: official ICE DXY is unlicensed (so the
 * target of test â‘  is unverified), no historical release/consensus archive exists (so the calendar factors
 * cannot gate a call), and no coefficient has been estimated (so `config_status` is CONFIG_BLOCKED for the
 * adjudication's own candidate). The four-market direction arm is still scored, under a label that says what
 * it is: a research proxy built on a declared substitute for the dollar index.
 */

const votes = require("../../../lib/usd_l1_votes");

const VERSION = "usd-layer1-challenger-v1";
const NAME = "Shared-source weighting experiment";
const FROZEN_ON = "2026-11-10";
const FROZEN_BEFORE = "the first date of the development window was scored";
const PARENT_VERSION = "usd-layer1-challenger-v0";

/**
 * One family, one unit of say.
 *
 * `weight` is 1 divided by the number of mechanisms in the family, so a family's total say is always 1 and
 * the whole book adds to seven. The weight is a consequence of the family size, not a fitted number.
 */
const FAMILIES = Object.freeze([
  Object.freeze({
    id: "risk",
    label: "Risk regime (VIX level and its five-day change)",
    factor: "live.f1-vix-level",
    members: Object.freeze(["vix_regime", "vix_momentum"]),
    weight: 1,
    why:
      "Both members read the same VIXCLS series, so the family holds one unit of say: the level and the change " +
      "split it rather than each carrying a full vote."
  }),
  Object.freeze({
    id: "front_end",
    label: "US front end (2-year yield)",
    factor: "live.f2-us-2y-delta",
    members: Object.freeze(["us_2y"]),
    weight: 1,
    why: "One series, one transformation, one vote."
  }),
  Object.freeze({
    id: "real_yield",
    label: "US real yield (10-year)",
    factor: "live.f4-real-yield-delta",
    members: Object.freeze(["us_10y_real"]),
    weight: 1,
    why: "One series, one transformation, one vote; the 5-year leg is collinear and stays out."
  }),
  Object.freeze({
    id: "dollar_path",
    label: "Broad dollar momentum",
    factor: "live.f5-dxy-delta",
    members: Object.freeze(["broad_dollar_momentum"]),
    weight: 1,
    why: "The only place the dollar's own path is read, through a declared stand-in for ICE DXY."
  }),
  Object.freeze({
    id: "gold",
    label: "Gold",
    factor: "live.f6-gold-delta",
    members: Object.freeze(["gold"]),
    weight: 1,
    why: "One instrument, one vote, labelled as the Coinbase XAU/USD quote the cache holds."
  }),
  Object.freeze({
    id: "equities",
    label: "Equities",
    factor: "live.f10-equity-versus-usd",
    members: Object.freeze(["equities"]),
    weight: 1,
    why: "One instrument, one vote, labelled as NAS100 where the published rule names QQQ."
  }),
  Object.freeze({
    id: "fx_mirrors",
    label: "FX mirrors (EUR/USD and USD/JPY)",
    factor: "fx.usd-session-momentum",
    members: Object.freeze(["eurusd_mirror", "usdjpy_mirror"]),
    weight: 1,
    why:
      "Two pairs quoting the same dollar, so the family holds one unit of say; both are declared proxies for " +
      "the session-momentum factor, which needs the official DXY path."
  })
]);

/** Version 0 is imported, not copied: v1 may place a mechanism in a family but may not move its threshold. */
const v0 = require("./challenger");

/** Which family carries each mechanism. A mechanism in no family is a build error, not a default. */
const FAMILY_OF = Object.freeze({
  vix_regime: "risk",
  vix_momentum: "risk",
  us_2y: "front_end",
  us_10y_real: "real_yield",
  broad_dollar_momentum: "dollar_path",
  gold: "gold",
  equities: "equities",
  eurusd_mirror: "fx_mirrors",
  usdjpy_mirror: "fx_mirrors"
});

function weightFor(mechanismId) {
  const family = FAMILIES.find((entry) => entry.members.includes(mechanismId));
  if (!family) throw new Error(`challenger v1 has no family for mechanism ${mechanismId}`);
  return Math.round((family.weight / family.members.length) * 10000) / 10000;
}

/**
 * The nine mechanisms, unchanged in every respect except the family each one belongs to and the weight that
 * family gives it. `factor` is re-attributed where the adjudication reads a different chain than version 0
 * did: the USD/JPY mirror is FX momentum (F11), not the dollar smile (F9).
 */
const FACTOR_OVERRIDES = Object.freeze({
  eurusd_mirror: "fx.usd-session-momentum",
  usdjpy_mirror: "fx.usd-session-momentum"
});

const MECHANISM_SPECS = Object.freeze(
  v0.MECHANISM_SPECS.map((spec) =>
    Object.freeze({
      ...spec,
      factor: FACTOR_OVERRIDES[spec.id] || spec.factor,
      family: FAMILY_OF[spec.id],
      weight: weightFor(spec.id)
    })
  )
);

const MECHANISMS = Object.freeze(
  MECHANISM_SPECS.map((mechanism) =>
    Object.freeze({ ...mechanism, vote: (value) => votes.interpretVote(mechanism.vote_spec, value) })
  )
);

/** Every rule value is inherited from version 0. The only addition is the family weighting. */
const RULES = Object.freeze({
  equal_weight: v0.RULES.equal_weight,
  min_usable_mechanisms: v0.RULES.min_usable_mechanisms,
  agreement_deadband: v0.RULES.agreement_deadband,
  conviction_bands: v0.RULES.conviction_bands,
  family_weighting: true,
  weight_rule:
    "each shared-source family holds one unit of say, split evenly between its members; no weight is fitted",
  total_weight: Math.round(MECHANISMS.reduce((total, entry) => total + entry.weight, 0) * 10000) / 10000
});


/** The adjudication's own status, carried into the model rather than summarised away. */
const STATUS = Object.freeze({
  candidate_id: "USD-L1-LONDON-PIT-CONDITIONAL",
  specification_version: "0.1.0",
  research_status: "RESEARCH_FROZEN_NOT_VALIDATED",
  config_status: "CONFIG_BLOCKED",
  name: NAME,
  label:
    "Shared-source weighting experiment (challenger v1): the 2026-11-04 adjudication applied to the book, with " +
    "one unit of say per shared source. Research only. The adjudication validates no sign, weight or threshold, " +
    "and its own candidate returns CONFIG_BLOCKED until the requirements below are met.",
  what_changed_label:
    "Related inputs share one vote; v0's directional rules and thresholds are inherited unchanged",
  config_blocked_meaning:
    "CONFIG_BLOCKED is not a market abstention and must never be counted in accuracy or coverage. It stops " +
    "the adjudication's candidate before any forecast is issued.",
  what_changed: Object.freeze([
    "one unit of say per shared-source family: VIX level and change now split one vote, and so do the EUR/USD and USD/JPY mirrors",
    "F3 (US-DE 2Y spread) is no longer 'read through EUR/USD': the spread is missing data and the pairs are accounted under F11",
    "the USD/JPY mirror is attributed to FX session momentum (F11) rather than the dollar smile (F9)",
    "every factor now carries its adjudication verdict, its data class and the gap between it and a validated place"
  ]),
  what_did_not_change: Object.freeze([
    "all nine inputs, and every threshold and vote direction, are inherited byte for byte from version 0",
    "the 0.2 agreement deadband, the six-mechanism minimum and the five conviction bands are unchanged",
    "no parameter was fitted, and version 0 stays frozen as the benchmark this version is measured against",
    "the target of test 1 is still official ICE cash DXY, which this checkout cannot price"
  ]),
  blocked_requirements: Object.freeze([
    "independent fresh-session review (the 2026-11-04 package adjudicates a same-session review)",
    "verified official ICE DXY methodology, source and exact 05:00 and next-05:00 endpoint coverage",
    "source clocks, vintages and system-receipt evidence for every selected input",
    "archived consensus, first actuals, prior revisions and positioning where a release factor is selected",
    "verified gold, equity, foreign-rate and funding instrument identity",
    "learned-model information bounds, and the actual duplicate and identity audit",
    "resolved model, fallback and optional-gate artefacts, with every coefficient estimated on development data",
    "a registered sample, holdout, multiplicity and pass/fail plan"
  ]),
  not_claimed: Object.freeze([
    "no directional edge, optimal weight, calibrated confidence or call-coverage gain is claimed",
    "the equal-weight book is a transparent design choice, not an empirical conclusion",
    "the four-market arm is a research proxy: its dollar leg is FRED DTWEXBGS, not ICE DXY",
    "no live rule, workflow, threshold or published call changes because this file exists"
  ])
});

/**
 * Score one snapshot with the family-equalised book.
 *
 * @param {object} snapshot a snapshot from `snapshots.buildSnapshots`.
 * @returns {object} the call record, with the family each vote came from and the weight it carried.
 */
function evaluate(snapshot) {
  const values = (snapshot && snapshot.values) || {};
  const record = votes.evaluateFromSpecs({ mechanisms: MECHANISMS, rules: RULES, values });
  return {
    model: VERSION,
    parent: PARENT_VERSION,
    frozen_on: FROZEN_ON,
    config_status: STATUS.config_status,
    family_weighting: true,
    ...record
  };
}

module.exports = {
  VERSION,
  NAME,
  PARENT_VERSION,
  FROZEN_ON,
  FROZEN_BEFORE,
  FAMILIES,
  FAMILY_OF,
  MECHANISMS,
  MECHANISM_SPECS,
  RULES,
  STATUS,
  weightFor,
  evaluate
};

