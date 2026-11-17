/**
 * The evaluation contract, frozen before any holdout outcome is read.
 *
 * The driver asked for flat bands, eligible dates, benchmark, execution rules and success measures to be fixed
 * before scoring, with common-date comparison and each model's coverage disclosed. This file writes those down
 * once, with a digest, so a later scoring run can be checked against it instead of re-defining it.
 *
 * Research only.
 */
"use strict";

const { sha256, stableStringify } = require("./engine");

const FROZEN_ON = "2026-11-17";
const STATUS = "FROZEN_BEFORE_SCORING";
const TARGET_ACCURACY_PCT = 60;

const EXECUTION_RULES = {
  entry: "strict five-minute close away and close back across the same level; exact touches and wicks excluded",
  costs: "spread and commission charged per fill, recorded per lane; no cost is estimated",
  sizing: "GBP 100,000 starting balance, 1 per cent of current balance risked per fill",
  exits: "frozen per lane before the first eligible fill; no discretionary exit",
  expiry: "a setup expires at the frozen session endpoint if it has not triggered",
  tape: "actionable bid/ask five-minute tape, archived before the setup; a one-hour close is never substituted",
  demo: "the existing demo uses live trade direction and cannot produce any of these tests",
};

const SUCCESS_MEASURES = {
  directional_target_pct: TARGET_ACCURACY_PCT,
  denominator: "mornings with a directional call, a readable outcome and a move outside the frozen flat band",
  flat_treatment: "a flat window is excluded from the denominator and counted separately",
  abstention: "an abstention is not a miss and is not a hit; it is its own status",
  blocked: "a blocked morning never enters a denominator",
  comparison: "models are compared only on common eligible dates, and each model's coverage is printed beside the result",
  uncertainty: "a lower bound is reported with every accuracy figure; no point estimate is published alone",
  no_aggregate: "no cross-market or blended accuracy figure is published",
};

/**
 * @param {object} options
 * @param {object} options.h1Review the adjudication review, for its discrepancy register
 * @param {object} options.h1Coverage the nine-input coverage audit
 * @param {object} options.flatBands the frozen flat-band artefact
 * @param {object} options.packageInfo the verified package identity
 */
function h1ScoringContract({ h1Review, h1Coverage, flatBands, packageInfo }) {
  const body = {
    frozen_on: FROZEN_ON,
    status: STATUS,
    model: {
      id: "usd_l1_25f_h1",
      version: packageInfo ? packageInfo.requested : "USD-L1-25F-H1-v0.1.0",
      rulebook_sha256: packageInfo ? packageInfo.declared_hashes.rulebook_sha256 : null,
      models_sha256: packageInfo ? packageInfo.declared_hashes.models_sha256 : null,
      inputs_sha256: packageInfo ? packageInfo.declared_hashes.inputs_sha256 : null,
    },
    session: "05:00 Europe/London to 05:00 the next local day (24 hours, DST following)",
    eligible_dates: {
      rule: "a morning is eligible only when every one of the nine declared inputs is present, original, fresh, identified and clocked at the 05:00 cutoff",
      scheduled: h1Coverage ? h1Coverage.scheduled : null,
      h1_ready: h1Coverage ? h1Coverage.ready : null,
      h1_blocked: h1Coverage ? h1Coverage.blocked : null,
      earliest_eligible: h1Coverage ? h1Coverage.earliest_eligible : null,
      legacy_counts_do_not_apply: true,
    },
    benchmarks: [
      { test: 1, id: "dxy_direction_broker_cfd", benchmark: "broker DXY.cash one-hour closes at the 05:00 boundaries" },
      { test: 2, id: "four_markets", benchmark: "EUR/USD, XAU/USD, BTC/USD and NAS100, each with its own denominator" },
      { test: 3, id: "l2l_full_5r", benchmark: "original Layer 2 levels, frozen 5R management" },
      { test: 4, id: "l2l_half_3r", benchmark: "original levels plus midpoints, frozen 3R management" },
    ],
    execution_rules: EXECUTION_RULES,
    success_measures: SUCCESS_MEASURES,
    flat_bands: flatBands
      ? { status: flatBands.status, digest: flatBands.digest, instruments: flatBands.instruments.map((item) => item.instrument) }
      : null,
    coverage_disclosure: {
      required: true,
      h1: h1Coverage ? { ready: h1Coverage.ready, blocked: h1Coverage.blocked, scheduled: h1Coverage.scheduled } : null,
      note: "every result prints its own coverage; two models are compared only on dates where both are eligible",
    },
    open_discrepancies: h1Review
      ? h1Review.discrepancies
          .filter((item) => item.status === "recorded_not_applied")
          .map((item) => ({ id: item.id, code: item.code, proposed_change: item.proposed_change }))
      : [],
    pair_combination: {
      status: "separate future test",
      note: "combining two independent Layer 1 calls is not test 2 and is not scored here",
    },
  };
  return { ...body, digest: sha256(stableStringify(body)) };
}

module.exports = { FROZEN_ON, STATUS, TARGET_ACCURACY_PCT, EXECUTION_RULES, SUCCESS_MEASURES, h1ScoringContract };
