const test = require("node:test");
const assert = require("node:assert/strict");
const { buildReplayOutput, score24h } = require("../replay/gbp/gbp_replay_core");

test("GBP research baseline scores a coherent UK-positive snapshot bullish", () => {
  const result = score24h({
    boe_bias: "hawkish",
    uk_2y_d5_bps: 8,
    us_uk_2y_spread_d5_bps: -9,
    latest_uk_event: { surprise: "positive" },
    uk_composite_pmi: 51.2,
    uk_composite_pmi_direction: "improving",
    gbpusd_d1_pct: 0.4,
    dxy_d1_pct: -0.3,
    vix_level: 14,
    global_growth_regime: "expanding",
    uk_stress_flag: "inactive"
  });

  assert.equal(result.direction, "BULLISH");
  assert.equal(result.weighted_score.bullish_weight, 98);
  assert.equal(result.weighted_score.bearish_weight, 0);
  assert.equal(result.missing_inputs.length, 0);
});

test("GBP research baseline fails closed when no GBP inputs are present", () => {
  const result = buildReplayOutput({});
  assert.equal(result.direction_24h, "NO_CLEAR_BIAS");
  assert.equal(result.conviction_24h, 0);
  assert.equal(result.weighted_score.active_weight, 0);
  assert.equal(result.missing_inputs.length, 10);
});
