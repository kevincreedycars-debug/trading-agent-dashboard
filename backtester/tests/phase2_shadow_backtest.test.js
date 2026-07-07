const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildShadowWeightPlan,
  buildComparisonStatus,
  classifyShadowDirection,
  classifyShadowResult,
  summarizeShadowRows
} = require("../lib/phase2_shadow_backtest");
const {
  buildCombinationSupportMap,
  buildPairSupportLookup
} = require("../scripts/build_phase2_shadow_backtest");

test("strong aligned factor increases while weak contradictory factor reduces", () => {
  const weightPlan = buildShadowWeightPlan({
    baselineExFlatWrPct: 55,
    factorRows: [
      {
        factor_id: "F1",
        factor_name: "Supportive Factor",
        original_weight: 20,
        review_label: "candidate_increase_weight",
        suggested_interpretation: "factor_supports_current_weighting",
        factor_profile: { flat_rate_pct: 18 },
        alignment_with_final_call: {
          agrees_with_final_call: { ex_flat_wr_pct: 68, sample_count: 52 },
          contradicts_final_call: { ex_flat_wr_pct: 40, sample_count: 18 }
        },
        weight_mismatch: {
          directional_sample: 52,
          combined_factor_reliability_pct: 66
        }
      },
      {
        factor_id: "F2",
        factor_name: "Weak Factor",
        original_weight: 20,
        review_label: "candidate_reduce_weight",
        suggested_interpretation: "factor_underperforms_historically",
        factor_profile: { flat_rate_pct: 48 },
        alignment_with_final_call: {
          agrees_with_final_call: { ex_flat_wr_pct: 44, sample_count: 47 },
          contradicts_final_call: { ex_flat_wr_pct: 58, sample_count: 21 }
        },
        weight_mismatch: {
          directional_sample: 47,
          combined_factor_reliability_pct: 45
        }
      }
    ]
  });

  const supportive = weightPlan.find((row) => row.factor_id === "F1");
  const weak = weightPlan.find((row) => row.factor_id === "F2");

  assert.equal(supportive.reason_label, "increase_candidate");
  assert.equal(weak.reason_label, "contradiction_edge");
  assert.ok(supportive.shadow_weight > supportive.original_weight);
  assert.ok(weak.shadow_weight < weak.original_weight);
});

test("insufficient evidence factors stay unchanged", () => {
  const [row] = buildShadowWeightPlan({
    baselineExFlatWrPct: 55,
    factorRows: [
      {
        factor_id: "F1",
        factor_name: "Thin Sample",
        original_weight: 12,
        review_label: "insufficient_evidence",
        suggested_interpretation: "insufficient_directional_sample",
        factor_profile: { flat_rate_pct: 20 },
        alignment_with_final_call: {
          agrees_with_final_call: { ex_flat_wr_pct: 61, sample_count: 8 },
          contradicts_final_call: { ex_flat_wr_pct: 49, sample_count: 2 }
        },
        weight_mismatch: {
          directional_sample: 8,
          combined_factor_reliability_pct: 61
        }
      }
    ]
  });

  assert.equal(row.reason_label, "insufficient_evidence");
  assert.equal(row.shadow_weight, row.original_weight);
  assert.equal(row.change_pct, 0);
});

test("shadow direction stays conservative when weight split is too close", () => {
  assert.equal(classifyShadowDirection({
    bullish_weight: 18,
    bearish_weight: 16,
    neutral_weight: 20
  }), null);

  assert.equal(classifyShadowDirection({
    bullish_weight: 32,
    bearish_weight: 12,
    neutral_weight: 28
  }), "BULLISH");
});

test("shadow summary and comparison metrics reconcile wins losses flats and no-calls", () => {
  const original = summarizeShadowRows([
    { result: "CORRECT" },
    { result: "WRONG" },
    { result: "FLAT" },
    { result: "NO_CALL" }
  ]);
  const shadow = summarizeShadowRows([
    { result: "CORRECT" },
    { result: "CORRECT" },
    { result: "FLAT" },
    { result: "NO_CALL" }
  ]);
  const comparison = buildComparisonStatus(original, shadow);

  assert.equal(original.ex_flat_wr_pct, 50);
  assert.equal(shadow.ex_flat_wr_pct, 100);
  assert.equal(comparison.status, "WARN");
  assert.equal(comparison.ex_flat_change_pct_points, 50);
  assert.equal(comparison.directional_wins_delta, 1);
  assert.equal(comparison.directional_losses_delta, -1);
});

test("pair and combination support maps aggregate usable evidence", () => {
  const pairSupport = buildPairSupportLookup({
    layer2: {
      "EUR/USD": {
        factors: [
          {
            source_asset: "EUR",
            factor_id: "F1",
            weight_mismatch: { combined_factor_reliability_pct: 60, directional_sample: 40 }
          },
          {
            source_asset: "EUR",
            factor_id: "F1",
            weight_mismatch: { combined_factor_reliability_pct: 50, directional_sample: 20 }
          }
        ]
      }
    }
  });
  const combinationSupport = buildCombinationSupportMap({
    factor_combinations: {
      two_factor: {
        combinations: [
          {
            review_label: "candidate_increase_weight",
            factors: [{ factor_id: "F1" }, { factor_id: "F2" }]
          },
          {
            review_label: "candidate_reduce_weight",
            factors: [{ factor_id: "F1" }, { factor_id: "F3" }]
          }
        ]
      },
      three_factor: { combinations: [] }
    }
  });

  assert.deepEqual(pairSupport.get("EUR__F1"), {
    average_reliability_pct: 56.7,
    directional_sample: 60
  });
  assert.deepEqual(combinationSupport.get("F1"), {
    positive_count: 1,
    negative_count: 1
  });
});

test("shadow result uses actual outcome direction rather than stored production result", () => {
  assert.equal(classifyShadowResult("BULLISH", "BULLISH"), "CORRECT");
  assert.equal(classifyShadowResult("BULLISH", "BEARISH"), "WRONG");
  assert.equal(classifyShadowResult("BULLISH", "FLAT"), "FLAT");
  assert.equal(classifyShadowResult(null, "BULLISH"), "NO_CALL");
});
