"use strict";

/**
 * Candidate USD 24-hour rules.
 *
 * Exactly four precisely defined candidate rules per research family, as the research brief requires.
 * Each rule carries the feature it reads, the bullish and bearish trigger, a weight, an optional
 * condition, and a status. `status: "not_evaluable"` marks a rule whose input the dataset cannot
 * supply faithfully: such a rule never votes, and the blocked weight is reported as coverage loss
 * rather than silently redistributed.
 */

const RULES = Object.freeze([
  // F-A: DXY momentum
  {
    id: "usd_mom_1d_cont",
    family: "dxy_momentum",
    feature: "usd_ret_1d",
    bullish: { comparator: "gte", threshold: 0.15 },
    bearish: { comparator: "lte", threshold: -0.15 },
    weight: 6,
    condition: null,
    status: "candidate",
    rationale: "One-day dollar continuation, the lookback the live F5 already uses."
  },
  {
    id: "usd_mom_5d_cont",
    family: "dxy_momentum",
    feature: "usd_ret_5d",
    bullish: { comparator: "gte", threshold: 0.5 },
    bearish: { comparator: "lte", threshold: -0.5 },
    weight: 8,
    condition: null,
    status: "candidate",
    rationale: "Weekly dollar continuation, slower than the live one-day threshold."
  },
  {
    id: "usd_mom_5d_fade",
    family: "dxy_momentum",
    feature: "usd_ret_5d",
    bullish: { comparator: "lte", threshold: -0.5 },
    bearish: { comparator: "gte", threshold: 0.5 },
    weight: 8,
    condition: null,
    status: "candidate",
    rationale: "The counter-hypothesis: weekly dollar mean reversion. Kept so the registry contains the opposite bet."
  },
  {
    id: "usd_trend_ma20_cont",
    family: "dxy_momentum",
    feature: "usd_ma20_dist_pct",
    bullish: { comparator: "gte", threshold: 0.5 },
    bearish: { comparator: "lte", threshold: -0.5 },
    weight: 6,
    condition: null,
    status: "candidate",
    rationale: "Position relative to the 20-observation mean."
  },
  // F-B: VIX and risk conditions
  {
    id: "risk_vix_level_haven",
    family: "vix_risk",
    feature: "vix_level",
    bullish: { comparator: "gte", threshold: 25 },
    bearish: { comparator: "lte", threshold: 16 },
    weight: 8,
    condition: null,
    status: "candidate",
    rationale: "The live F1 regime mapping: high VIX is a dollar haven bid."
  },
  {
    id: "risk_vix_chg_5d",
    family: "vix_risk",
    feature: "vix_ret_5d",
    bullish: { comparator: "gte", threshold: 10 },
    bearish: { comparator: "lte", threshold: -10 },
    weight: 6,
    condition: null,
    status: "candidate",
    rationale: "Direction of the VIX move rather than its level."
  },
  {
    id: "risk_vix_pctile",
    family: "vix_risk",
    feature: "vix_pctile_252",
    bullish: { comparator: "gte", threshold: 80 },
    bearish: { comparator: "lte", threshold: 20 },
    weight: 4,
    condition: null,
    status: "candidate",
    rationale: "Relative rather than absolute risk level, so the rule travels across volatility regimes."
  },
  {
    id: "risk_credit_spread_chg",
    family: "vix_risk",
    feature: "credit_spread_chg_5d_bps",
    bullish: { comparator: "gte", threshold: 25 },
    bearish: { comparator: "lte", threshold: -25 },
    weight: 5,
    condition: null,
    status: "candidate",
    rationale: "Credit spreads widening is a stress signal independent of equity volatility."
  },
  // F-C: relative interest rates
  {
    id: "rel_us_2y_chg5d",
    family: "relative_rates",
    feature: "us_2y_chg_5d_bps",
    bullish: { comparator: "gte", threshold: 10 },
    bearish: { comparator: "lte", threshold: -10 },
    weight: 8,
    condition: null,
    status: "candidate",
    rationale: "Higher US front-end yields raise the dollar's carry; the live F2 threshold is 5bp and is treated as provisional."
  },
  {
    id: "rel_us_de_2y_spread_chg5d",
    family: "relative_rates",
    feature: "us_de_2y_spread_chg_5d_bps",
    bullish: { comparator: "gte", threshold: 10 },
    bearish: { comparator: "lte", threshold: -10 },
    weight: 10,
    condition: null,
    status: "candidate",
    rationale: "The engine's own F3 idea: the spread change is the relative-rate signal, not either leg alone."
  },
  {
    id: "rel_de_2y_chg5d",
    family: "relative_rates",
    feature: "de_2y_chg_5d_bps",
    bullish: { comparator: "lte", threshold: -10 },
    bearish: { comparator: "gte", threshold: 10 },
    weight: 6,
    condition: null,
    status: "candidate",
    rationale: "German front-end moves read through EUR weakness, which lifts the dollar index."
  },
  {
    id: "rel_us_10y_chg5d",
    family: "relative_rates",
    feature: "us_10y_chg_5d_bps",
    bullish: { comparator: "gte", threshold: 10 },
    bearish: { comparator: "lte", threshold: -10 },
    weight: 5,
    condition: null,
    status: "candidate",
    rationale: "Long-end US yield change as a lower-weight term-premium proxy."
  },
  // F-D: real yields
  {
    id: "real_10y_chg5d",
    family: "real_yields",
    feature: "us_10y_real_chg_5d_bps",
    bullish: { comparator: "gte", threshold: 10 },
    bearish: { comparator: "lte", threshold: -10 },
    weight: 8,
    condition: null,
    status: "candidate",
    rationale: "The live F4 idea with a wider provisional threshold."
  },
  {
    id: "real_10y_chg20d",
    family: "real_yields",
    feature: "us_10y_real_chg_20d_bps",
    bullish: { comparator: "gte", threshold: 15 },
    bearish: { comparator: "lte", threshold: -15 },
    weight: 6,
    condition: null,
    status: "candidate",
    rationale: "Slower real-yield trend, so the rule is not a duplicate of the five-day version."
  },
  {
    id: "real_5y_chg5d",
    family: "real_yields",
    feature: "us_5y_real_chg_5d_bps",
    bullish: { comparator: "gte", threshold: 10 },
    bearish: { comparator: "lte", threshold: -10 },
    weight: 5,
    condition: null,
    status: "candidate",
    rationale: "Belly of the real curve, closer to the policy path than the 10Y."
  },
  {
    id: "real_breakeven_chg5d",
    family: "real_yields",
    feature: "us_10y_breakeven_chg_5d_bps",
    bullish: { comparator: "lte", threshold: -10 },
    bearish: { comparator: "gte", threshold: 10 },
    weight: 3,
    condition: null,
    status: "candidate",
    rationale: "Inflation-compensation change, kept at low weight because its sign is genuinely ambiguous."
  },
  // F-E: Fed repricing
  {
    id: "fed_dovish_repricing_5d",
    family: "fed_repricing",
    feature: "policy_repricing_5d_bps",
    bullish: { comparator: "lte", threshold: -10 },
    bearish: { comparator: "gte", threshold: 10 },
    weight: 8,
    condition: null,
    status: "candidate",
    rationale: "Dovish repricing (falling 2Y) is expected to weaken the dollar; realised front-end change is the proxy for the priced path."
  },
  {
    id: "fed_repricing_20d",
    family: "fed_repricing",
    feature: "policy_repricing_20d_bps",
    bullish: { comparator: "lte", threshold: -15 },
    bearish: { comparator: "gte", threshold: 15 },
    weight: 6,
    condition: null,
    status: "candidate",
    rationale: "Monthly policy repricing, less sensitive to single data prints."
  },
  {
    id: "fed_effr_minus_3m",
    family: "fed_repricing",
    feature: "effr_minus_3m_bps",
    bullish: { comparator: "lte", threshold: -15 },
    bearish: { comparator: "gte", threshold: 15 },
    weight: 5,
    condition: null,
    status: "candidate",
    rationale: "The 3M bill trading above the effective rate is the market pricing hikes; below it, cuts."
  },
  {
    id: "fed_funding_stress",
    family: "fed_repricing",
    feature: "sofr_minus_effr_bps",
    bullish: { comparator: "gte", threshold: 10 },
    bearish: { comparator: "lte", threshold: -10 },
    weight: 3,
    condition: null,
    status: "candidate",
    rationale: "Repo funding pressure has historically produced a dollar bid; low weight because episodes are rare."
  },
  // F-F: economic surprises (requirements recorded; not evaluable from this dataset)
  {
    id: "surprise_event_signal",
    family: "economic_surprises",
    feature: "latest_us_event_surprise",
    bullish: { comparator: "eq", threshold: "positive" },
    bearish: { comparator: "eq", threshold: "negative" },
    weight: 0,
    condition: null,
    status: "not_evaluable",
    rationale: "Needs original-release actual, pre-release consensus and event age. No free vintage or consensus source exists locally, so the rule cannot vote."
  },
  {
    id: "surprise_event_age_gate",
    family: "economic_surprises",
    feature: "latest_us_event_age_hours",
    bullish: { comparator: "lte", threshold: 72 },
    bearish: { comparator: "lte", threshold: 72 },
    weight: 0,
    condition: null,
    status: "not_evaluable",
    rationale: "Ageing requirement for the surprise input; same missing source."
  },
  {
    id: "surprise_release_day_conditioning",
    family: "economic_surprises",
    feature: "is_us_macro_release_day",
    bullish: { comparator: "eq", threshold: true },
    bearish: { comparator: "eq", threshold: false },
    weight: 0,
    condition: null,
    status: "not_evaluable",
    rationale: "Release-day conditioning needs a scheduled-calendar source with publication timestamps, which is also missing."
  },
  {
    id: "surprise_context_only_policy",
    family: "economic_surprises",
    feature: "latest_us_event_surprise",
    bullish: { comparator: "eq", threshold: "positive" },
    bearish: { comparator: "eq", threshold: "negative" },
    weight: 0,
    condition: null,
    status: "policy",
    rationale: "Until consensus vintages exist, this family may inform commentary but must not consume directional budget."
  },
  // F-G: cross-asset relationships
  {
    id: "xasset_gold_5d_inverse",
    family: "cross_asset",
    feature: "gold_ret_5d",
    bullish: { comparator: "lte", threshold: -1.5 },
    bearish: { comparator: "gte", threshold: 1.5 },
    weight: 5,
    condition: null,
    status: "candidate",
    rationale: "The live F6 mapping: gold strength is read as dollar weakness."
  },
  {
    id: "xasset_equity_5d_regime",
    family: "cross_asset",
    feature: "nq_ret_5d",
    bullish: { comparator: "lte", threshold: -1.5 },
    bearish: { comparator: "gte", threshold: 1.5 },
    weight: 4,
    condition: null,
    status: "candidate",
    rationale: "Equity risk-on is expected to soften the dollar (the live F10 mapping at a longer lookback)."
  },
  {
    id: "xasset_eurusd_confirm",
    family: "cross_asset",
    feature: "eurusd_ret_5d",
    bullish: { comparator: "lte", threshold: -1 },
    bearish: { comparator: "gte", threshold: 1 },
    weight: 4,
    condition: null,
    status: "candidate",
    rationale: "EUR weakness is the dominant weight in the broad dollar index, so it is a confirmation input rather than new information."
  },
  {
    id: "xasset_wti_5d_growth",
    family: "cross_asset",
    feature: "wti_ret_5d",
    bullish: { comparator: "gte", threshold: 5 },
    bearish: { comparator: "lte", threshold: -5 },
    weight: 3,
    condition: null,
    status: "candidate",
    rationale: "Energy strength is treated as a global-growth signal, which is dollar supportive."
  }
]);

const COMPARATORS = Object.freeze({
  gt: (value, threshold) => value > threshold,
  gte: (value, threshold) => value >= threshold,
  lt: (value, threshold) => value < threshold,
  lte: (value, threshold) => value <= threshold,
  eq: (value, threshold) => value === threshold
});

const DEFAULT_GATES = Object.freeze({
  min_coverage_pct: 50,
  min_participation_pct: 20,
  min_absolute_score_points: 8,
  min_winning_families: 2,
  require_no_critical_conflict: true,
  conflict_ratio: 0.5
});

function compare(value, condition) {
  if (value === null || value === undefined || !condition) return false;
  const comparator = COMPARATORS[condition.comparator];
  if (!comparator) throw new Error(`Unknown comparator: ${condition.comparator}`);
  return comparator(value, condition.threshold);
}

/** One rule's vote on one row. A non-candidate rule, a failed condition or a missing input abstains. */
function ruleVote(rule, features) {
  if (rule.status !== "candidate") return { vote: null, reason: `status:${rule.status}` };
  if (rule.condition && !compare(features[rule.condition.feature], rule.condition)) {
    return { vote: null, reason: "condition_not_met" };
  }
  const value = features[rule.feature];
  if (value === null || value === undefined) return { vote: null, reason: "missing_input" };
  if (compare(value, rule.bullish)) return { vote: "BULLISH", reason: "bullish_trigger" };
  if (compare(value, rule.bearish)) return { vote: "BEARISH", reason: "bearish_trigger" };
  return { vote: "NEUTRAL", reason: "inside_thresholds" };
}

function weightOf(weights, rule) {
  if (weights && Object.prototype.hasOwnProperty.call(weights, rule.id)) return weights[rule.id];
  return rule.weight;
}

/**
 * Applies a rule set to one row: weighted votes, coverage, family participation and the voting gates.
 * Weight is never renormalised over available rules, so a missing input shows up as lost coverage.
 */
function evaluateRuleSet(ruleSet, features) {
  const gates = { ...DEFAULT_GATES, ...(ruleSet.gates || {}) };
  let bullWeight = 0;
  let bearWeight = 0;
  let neutralWeight = 0;
  let blockedWeight = 0;
  let totalWeight = 0;
  const familyVotes = new Map();
  const contributions = [];

  for (const rule of ruleSet.rules) {
    const weight = weightOf(ruleSet.weights, rule);
    totalWeight += weight;
    const outcome = ruleVote(rule, features);
    contributions.push({ rule_id: rule.id, weight, vote: outcome.vote, reason: outcome.reason });
    if (outcome.vote === "BULLISH") {
      bullWeight += weight;
      familyVotes.set(rule.family, (familyVotes.get(rule.family) || 0) + 1);
    } else if (outcome.vote === "BEARISH") {
      bearWeight += weight;
      familyVotes.set(rule.family, (familyVotes.get(rule.family) || 0) + 1);
    } else if (outcome.vote === "NEUTRAL") {
      neutralWeight += weight;
    } else {
      blockedWeight += weight;
    }
  }

  const activeWeight = bullWeight + bearWeight;
  // Two different quantities, kept apart: coverage is how much of the declared budget had usable
  // data at the cutoff, participation is how much of that budget triggered a directional vote.
  const coveragePct = totalWeight ? ((totalWeight - blockedWeight) / totalWeight) * 100 : 0;
  const participationPct = totalWeight ? (activeWeight / totalWeight) * 100 : 0;
  const margin = Math.abs(bullWeight - bearWeight);
  const netEdgePct = activeWeight ? (margin / activeWeight) * 100 : 0;
  const conflict = bullWeight > 0 && bearWeight > 0 && Math.min(bullWeight, bearWeight) >= gates.conflict_ratio * Math.max(bullWeight, bearWeight);
  const winningFamilies = new Set(
    contributions
      .filter((entry) => entry.vote === (bullWeight >= bearWeight ? "BULLISH" : "BEARISH"))
      .map((entry) => ruleSet.rules.find((rule) => rule.id === entry.rule_id).family)
  ).size;

  let direction = "NO_CLEAR_BIAS";
  let reason = "no_directional_weight";
  if (coveragePct < gates.min_coverage_pct) {
    reason = "insufficient_input_coverage";
  } else if (participationPct < gates.min_participation_pct) {
    reason = "insufficient_participation";
  } else if (margin < gates.min_absolute_score_points) {
    reason = "score_below_minimum_margin";
  } else if (winningFamilies < gates.min_winning_families) {
    reason = "too_few_winning_families";
  } else if (gates.require_no_critical_conflict && conflict) {
    reason = "critical_conflict";
  } else {
    direction = bullWeight > bearWeight ? "BULLISH" : "BEARISH";
    reason = "gates_passed";
  }

  return {
    direction,
    direction_reason: reason,
    bull_weight: bullWeight,
    bear_weight: bearWeight,
    neutral_weight: neutralWeight,
    blocked_weight: blockedWeight,
    active_weight: activeWeight,
    total_weight: totalWeight,
    coverage_pct: Number(coveragePct.toFixed(2)),
    participation_pct: Number(participationPct.toFixed(2)),
    net_edge_pct: Number(netEdgePct.toFixed(2)),
    winning_families: winningFamilies,
    contributions
  };
}

module.exports = {
  COMPARATORS,
  DEFAULT_GATES,
  RULES,
  compare,
  evaluateRuleSet,
  ruleVote,
  weightOf
};
