const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildFactorProfile,
  buildStateStats,
  buildAlignmentStats,
  classifyCombinationReliability,
  interpretCombinationReliability,
  LAYER2_CONFIGS,
  derivePairCallDirection,
  invertDirection
} = require("../lib/factor_edge_lab");
const {
  buildCombinationAnalysis,
  buildTopEvidenceSummary,
  classifyCombinationReviewLabel,
  classifyFactorReviewLabel
} = require("../scripts/build_factor_edge_lab");

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

test("layer 2 pair-side mappings are explicit for all supported pairs", () => {
  const pairConfigs = Object.fromEntries(LAYER2_CONFIGS.map((config) => [config.pairLabel, config]));

  for (const pairLabel of ["EUR/USD", "XAU/USD", "NQ/USD", "BTC/USD"]) {
    const config = pairConfigs[pairLabel];
    assert.ok(config, `missing config for ${pairLabel}`);
    assert.equal(config.pairSideMapping?.base_side?.mapping, "direct", `${pairLabel} base side should be explicit direct`);
    assert.equal(config.pairSideMapping?.quote_usd_side?.mapping, "inverse", `${pairLabel} USD side should be explicit inverse`);
    assert.ok(config.pairSideMapping?.base_side?.description, `${pairLabel} base side description missing`);
    assert.ok(config.pairSideMapping?.quote_usd_side?.description, `${pairLabel} USD side description missing`);
  }

  assert.match(
    pairConfigs["NQ/USD"].pairSideMapping.quote_usd_side.description,
    /inverse/i,
    "NQ/USD USD-side mapping must remain explicit rather than inferred"
  );
});

test("combination reliability applies exploratory and unavailable sample gating", () => {
  assert.equal(classifyCombinationReliability({
    exFlatWrPct: 70,
    directionalSample: 7,
    sampleCount: 7,
    minimumSampleCount: 12,
    exploratorySampleCount: 6
  }), "exploratory_positive_evidence");
  assert.equal(classifyCombinationReliability({
    exFlatWrPct: 70,
    directionalSample: 4,
    sampleCount: 4,
    minimumSampleCount: 12,
    exploratorySampleCount: 6
  }), "unavailable_low_sample");
  assert.equal(interpretCombinationReliability("exploratory_positive_evidence"), "exploratory_positive_edge_needs_more_sample");
});

test("buildCombinationAnalysis keeps layer 2 style scope separated and exposes alignment metrics", () => {
  const rows = [
    {
      snapshotDate: "2026-01-01",
      finalCallDirection: "BULLISH",
      outcomeDirection: "BULLISH",
      realisedMovePct: 1.1,
      factorItems: [
        { factorId: "F1", factorName: "Factor 1", sourceSide: "target_asset", sourceAsset: "EUR", originalWeight: 20, expectedDirection: "BULLISH" },
        { factorId: "F2", factorName: "Factor 2", sourceSide: "target_asset", sourceAsset: "EUR", originalWeight: 18, expectedDirection: "BULLISH" },
        { factorId: "F3", factorName: "Factor 3", sourceSide: "target_asset", sourceAsset: "EUR", originalWeight: 12, expectedDirection: "BULLISH" }
      ]
    },
    {
      snapshotDate: "2026-01-02",
      finalCallDirection: "BULLISH",
      outcomeDirection: "BULLISH",
      realisedMovePct: 0.9,
      factorItems: [
        { factorId: "F1", factorName: "Factor 1", sourceSide: "target_asset", sourceAsset: "EUR", originalWeight: 20, expectedDirection: "BULLISH" },
        { factorId: "F2", factorName: "Factor 2", sourceSide: "target_asset", sourceAsset: "EUR", originalWeight: 18, expectedDirection: "BULLISH" },
        { factorId: "F3", factorName: "Factor 3", sourceSide: "target_asset", sourceAsset: "EUR", originalWeight: 12, expectedDirection: "BULLISH" }
      ]
    },
    {
      snapshotDate: "2026-01-03",
      finalCallDirection: "BEARISH",
      outcomeDirection: "FLAT",
      realisedMovePct: 0.01,
      factorItems: [
        { factorId: "F1", factorName: "Factor 1", sourceSide: "target_asset", sourceAsset: "EUR", originalWeight: 20, expectedDirection: "BULLISH" },
        { factorId: "F2", factorName: "Factor 2", sourceSide: "target_asset", sourceAsset: "EUR", originalWeight: 18, expectedDirection: "BULLISH" }
      ]
    },
    {
      snapshotDate: "2026-01-04",
      finalCallDirection: null,
      outcomeDirection: "BEARISH",
      realisedMovePct: -0.6,
      factorItems: [
        { factorId: "F1", factorName: "Factor 1", sourceSide: "target_asset", sourceAsset: "EUR", originalWeight: 20, expectedDirection: "BULLISH" },
        { factorId: "F2", factorName: "Factor 2", sourceSide: "target_asset", sourceAsset: "EUR", originalWeight: 18, expectedDirection: "BULLISH" }
      ]
    },
    {
      snapshotDate: "2026-01-05",
      finalCallDirection: "BULLISH",
      outcomeDirection: "BULLISH",
      realisedMovePct: 0.8,
      factorItems: [
        { factorId: "F1", factorName: "Factor 1", sourceSide: "target_asset", sourceAsset: "EUR", originalWeight: 20, expectedDirection: "BULLISH" },
        { factorId: "F2", factorName: "Factor 2", sourceSide: "target_asset", sourceAsset: "EUR", originalWeight: 18, expectedDirection: "BULLISH" }
      ]
    },
    {
      snapshotDate: "2026-01-06",
      finalCallDirection: "BULLISH",
      outcomeDirection: "BULLISH",
      realisedMovePct: 0.7,
      factorItems: [
        { factorId: "F1", factorName: "Factor 1", sourceSide: "target_asset", sourceAsset: "EUR", originalWeight: 20, expectedDirection: "BULLISH" },
        { factorId: "F2", factorName: "Factor 2", sourceSide: "target_asset", sourceAsset: "EUR", originalWeight: 18, expectedDirection: "BULLISH" }
      ]
    }
  ];

  const analysis = buildCombinationAnalysis("layer2_pair_side", rows);
  const twoFactor = analysis.two_factor.combinations.find((entry) => entry.factor_ids.join("|") === "F1|F2");
  const threeFactor = analysis.three_factor.combinations.find((entry) => entry.factor_ids.join("|") === "F1|F2|F3");

  assert.ok(twoFactor, "expected F1/F2 two-factor combination");
  assert.equal(twoFactor.sample_count, 6);
  assert.equal(twoFactor.ex_flat_wr_pct, 80);
  assert.equal(twoFactor.flat_count, 1);
  assert.equal(twoFactor.reliability_label, "exploratory_positive_evidence");
  assert.equal(twoFactor.interpretation, "exploratory_positive_edge_needs_more_sample");
  assert.equal(twoFactor.agrees_with_final_call.sample_count, 4);
  assert.equal(twoFactor.contradicts_final_call.sample_count, 1);
  assert.equal(twoFactor.skipped_no_final_call_count, 1);
  assert.equal(twoFactor.adr_l2l_factor_join.available, false);

  assert.ok(threeFactor, "expected F1/F2/F3 three-factor combination");
  assert.equal(threeFactor.sample_count, 2);
  assert.equal(threeFactor.reliability_label, "unavailable_low_sample");
  assert.equal(analysis.two_factor.exploratory_combination_count >= 1, true);
});

test("review labels promote strong low-weight factors and demote failing high-weight factors", () => {
  assert.equal(classifyFactorReviewLabel({
    original_weight: 6,
    suggested_interpretation: "factor_supports_current_weighting",
    weight_mismatch: {
      directional_sample: 48,
      combined_factor_reliability_pct: 66.4,
      suggested_interpretation: "low_weight_but_strong_realised_evidence"
    }
  }), "contradiction_edge_possible_hidden_predictor");

  assert.equal(classifyFactorReviewLabel({
    original_weight: 18,
    suggested_interpretation: "factor_underperforms_historically",
    weight_mismatch: {
      directional_sample: 61,
      combined_factor_reliability_pct: 44.2,
      suggested_interpretation: "high_weight_but_negative_realised_evidence"
    }
  }), "candidate_reduce_weight");

  assert.equal(classifyCombinationReviewLabel({
    sample_count: 22,
    reliability_label: "strong_positive_evidence",
    ex_flat_wr_pct: 72.1
  }), "candidate_increase_weight");
});

test("top evidence summary ranks reliable factors, combinations, and layer 2 edge balance", () => {
  const factors = [
    {
      factor_id: "F1",
      factor_name: "Factor One",
      review_label: "candidate_increase_weight",
      weight_mismatch: { combined_factor_reliability_pct: 68.2, directional_sample: 52 }
    },
    {
      factor_id: "F2",
      factor_name: "Factor Two",
      review_label: "candidate_reduce_weight",
      weight_mismatch: { combined_factor_reliability_pct: 43.5, directional_sample: 49 }
    },
    {
      factor_id: "F3",
      factor_name: "Factor Three",
      review_label: "insufficient_evidence",
      weight_mismatch: { combined_factor_reliability_pct: 59.3, directional_sample: 8 }
    }
  ];
  const baseSideCombinations = {
    two_factor: {
      exploratory_combination_count: 1,
      unavailable_low_sample_count: 2,
      combinations: [
        {
          factor_ids: ["F1", "F4"],
          factor_names: ["Factor One", "Factor Four"],
          ex_flat_wr_pct: 69.5,
          review_label: "candidate_increase_weight"
        }
      ]
    },
    three_factor: {
      exploratory_combination_count: 0,
      unavailable_low_sample_count: 1,
      combinations: []
    }
  };
  const usdSideCombinations = {
    two_factor: {
      exploratory_combination_count: 0,
      unavailable_low_sample_count: 0,
      combinations: []
    },
    three_factor: {
      exploratory_combination_count: 0,
      unavailable_low_sample_count: 0,
      combinations: []
    }
  };

  const summary = buildTopEvidenceSummary({
    factors,
    pairSideAnalysis: {
      base_side: { summary: { average_combined_factor_reliability_pct: 63 } },
      quote_usd_side: { summary: { average_combined_factor_reliability_pct: 54 } }
    },
    baseSideCombinations,
    usdSideCombinations
  });

  assert.equal(summary.strongest_reliable_single_factors[0].factor_id, "F1");
  assert.equal(summary.weakest_failing_factors[0].factor_id, "F2");
  assert.equal(summary.strongest_reliable_combinations[0].factor_ids.join("|"), "F1|F4");
  assert.equal(summary.low_sample_warning.label, "low_sample_review_caution");
  assert.equal(summary.layer2_edge_balance, "mostly_base_side");
});
