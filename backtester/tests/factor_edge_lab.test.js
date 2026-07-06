const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildFactorProfile,
  buildStateStats,
  buildAlignmentStats,
  derivePairCallDirection,
  invertDirection
} = require("../lib/factor_edge_lab");

test("buildStateStats excludes flats from ex-flat win rate", () => {
  const stats = buildStateStats([
    { outcomeDirection: "BULLISH", realisedMovePct: 0.8 },
    { outcomeDirection: "BULLISH", realisedMovePct: 0.3 },
    { outcomeDirection: "BEARISH", realisedMovePct: -0.4 },
    { outcomeDirection: "FLAT", realisedMovePct: 0.02 }
  ], "BULLISH");

  assert.equal(stats.total_observations, 4);
  assert.equal(stats.price_moved_bullish_count, 2);
  assert.equal(stats.price_moved_bearish_count, 1);
  assert.equal(stats.flat_count, 1);
  assert.equal(stats.directional_sample, 3);
  assert.equal(stats.wins, 2);
  assert.equal(stats.losses, 1);
  assert.equal(stats.ex_flat_wr_pct, 66.7);
  assert.equal(stats.flat_rate_pct, 25);
  assert.equal(stats.sample_count, 4);
  assert.equal(stats.reliability_label, "strong_positive_evidence");
  assert.equal(stats.directional_reliability_label, "strong_positive_evidence");
});

test("buildAlignmentStats separates aligned and contradicting rows", () => {
  const stats = buildAlignmentStats([
    { alignment: "aligned", alignmentOutcome: "WIN", outcomeDirection: "BULLISH", realisedMovePct: 1.2 },
    { alignment: "aligned", alignmentOutcome: "LOSS", outcomeDirection: "BEARISH", realisedMovePct: -0.5 },
    { alignment: "aligned", alignmentOutcome: "FLAT", outcomeDirection: "FLAT", realisedMovePct: 0.01 },
    { alignment: "contradicted", alignmentOutcome: "WIN", outcomeDirection: "BULLISH", realisedMovePct: 0.7 },
    { alignment: "contradicted", alignmentOutcome: "LOSS", outcomeDirection: "BEARISH", realisedMovePct: -0.6 },
    { alignment: "unavailable", alignmentOutcome: "UNAVAILABLE", outcomeDirection: "BULLISH", realisedMovePct: 0.4 }
  ]);

  assert.equal(stats.times_factor_agreed_with_final_call, 3);
  assert.equal(stats.aligned_wins, 1);
  assert.equal(stats.aligned_losses, 1);
  assert.equal(stats.aligned_flats, 1);
  assert.equal(stats.aligned_ex_flat_wr_pct, 50);
  assert.equal(stats.agrees_with_final_call.sample_count, 3);
  assert.equal(stats.agrees_with_final_call.ex_flat_wr_pct, 50);
  assert.equal(stats.agrees_with_final_call.flat_count, 1);
  assert.equal(stats.agrees_with_final_call.flat_rate_pct, 33.3);
  assert.equal(stats.times_factor_contradicted_final_call, 2);
  assert.equal(stats.contradicting_wins, 1);
  assert.equal(stats.contradicting_losses, 1);
  assert.equal(stats.contradicting_flats, 0);
  assert.equal(stats.contradicting_ex_flat_wr_pct, 50);
  assert.equal(stats.contradicts_final_call.sample_count, 2);
  assert.equal(stats.contradicts_final_call.ex_flat_wr_pct, 50);
  assert.equal(stats.contradicts_final_call.flat_count, 0);
  assert.equal(stats.contradicts_final_call.flat_rate_pct, 0);
  assert.equal(stats.skipped_no_final_call_count, 1);
});

test("buildFactorProfile exposes explicit phase 2c metrics", () => {
  const bullishState = buildStateStats([
    { outcomeDirection: "BULLISH", realisedMovePct: 0.8 },
    { outcomeDirection: "BEARISH", realisedMovePct: -0.4 },
    { outcomeDirection: "FLAT", realisedMovePct: 0.02 }
  ], "BULLISH");
  const bearishState = buildStateStats([
    { outcomeDirection: "BEARISH", realisedMovePct: -0.6 },
    { outcomeDirection: "BEARISH", realisedMovePct: -0.2 },
    { outcomeDirection: "FLAT", realisedMovePct: 0.01 }
  ], "BEARISH");

  const profile = buildFactorProfile({
    bullishState,
    bearishState,
    neutralState: {
      total_observations: 5,
      neutral_no_signal_count: 5
    },
    suggestedInterpretation: "factor_supports_current_weighting"
  });

  assert.deepEqual(profile, {
    bullish_sample_count: 3,
    bearish_sample_count: 3,
    neutral_no_signal_count: 5,
    bullish_ex_flat_wr_pct: 50,
    bearish_ex_flat_wr_pct: 100,
    flat_count: 2,
    flat_rate_pct: 18.2,
    directional_sample_count: 4,
    reliability_label: "strong_positive_evidence",
    strongest_state_label: "bearish",
    suggested_interpretation: "factor_supports_current_weighting"
  });
});

test("pair direction mapping inverts USD-side expectations", () => {
  assert.equal(derivePairCallDirection("BULLISH", "BEARISH"), "BULLISH");
  assert.equal(derivePairCallDirection("BEARISH", "BULLISH"), "BEARISH");
  assert.equal(derivePairCallDirection("BULLISH", "BULLISH"), null);
  assert.equal(invertDirection("BULLISH"), "BEARISH");
  assert.equal(invertDirection("BEARISH"), "BULLISH");
});
