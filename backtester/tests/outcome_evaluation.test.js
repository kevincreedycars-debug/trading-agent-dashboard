const test = require("node:test");
const assert = require("node:assert/strict");

const { evaluateSingleMarket, computePctChange } = require("../lib/outcome_evaluation");

function buildEvaluation(overrides = {}) {
  return evaluateSingleMarket({
    assetCode: "USD",
    timeframe: "following 24hrs",
    callDate: "2024-01-08",
    callTimeEt: "09:30:00",
    agentDirection: "BULLISH",
    agentConviction: 72,
    evaluatedMarket: "DXY",
    openPrice: 100,
    closePrice: 101,
    evaluationVersion: "test_eval_v1",
    ...overrides
  });
}

test("missing market prices become NOT_EVALUABLE instead of a scored result", () => {
  const evaluation = buildEvaluation({
    openPrice: null,
    closePrice: 101
  });

  assert.equal(evaluation.result, "NOT_EVALUABLE");
  assert.equal(evaluation.result_reason, "market_price_missing");
  assert.equal(evaluation.evaluable, false);
  assert.equal(evaluation.open_price, null);
  assert.equal(evaluation.close_price, 101);
  assert.equal(evaluation.pct_change, null);
  assert.equal(evaluation.abs_pct_change, null);
  assert.equal(evaluation.market_outcome_direction, null);
  assert.equal(evaluation.comparable_market_direction, null);
  assert.equal(evaluation.evaluation_quality, "NOT_EVALUABLE");
  assert.notEqual(evaluation.result, "CORRECT");
  assert.notEqual(evaluation.result, "WRONG");
});

test("zero close prices become NOT_EVALUABLE and are not treated as false wins or losses", () => {
  const evaluation = buildEvaluation({
    closePrice: 0
  });

  assert.equal(evaluation.result, "NOT_EVALUABLE");
  assert.equal(evaluation.result_reason, "market_price_missing");
  assert.equal(evaluation.close_price, null);
  assert.equal(evaluation.pct_change, null);
  assert.equal(evaluation.abs_pct_change, null);
  assert.equal(evaluation.market_outcome_direction, null);
  assert.equal(evaluation.comparable_market_direction, null);
  assert.equal(evaluation.evaluation_quality, "NOT_EVALUABLE");
  assert.notEqual(evaluation.result, "CORRECT");
  assert.notEqual(evaluation.result, "WRONG");
});

test("invalid non-numeric prices become NOT_EVALUABLE", () => {
  const evaluation = buildEvaluation({
    openPrice: "bad-open",
    closePrice: "not-a-number"
  });

  assert.equal(evaluation.result, "NOT_EVALUABLE");
  assert.equal(evaluation.result_reason, "market_price_missing");
  assert.equal(evaluation.open_price, null);
  assert.equal(evaluation.close_price, null);
  assert.equal(evaluation.pct_change, null);
  assert.equal(evaluation.abs_pct_change, null);
  assert.equal(evaluation.market_outcome_direction, null);
  assert.equal(evaluation.comparable_market_direction, null);
  assert.equal(evaluation.evaluation_quality, "NOT_EVALUABLE");
});

test("existing window-based NOT_EVALUABLE reasons still take precedence", () => {
  const evaluation = buildEvaluation({
    callDate: "2024-01-06",
    closePrice: "not-a-number"
  });

  assert.equal(evaluation.result, "NOT_EVALUABLE");
  assert.equal(evaluation.result_reason, "call_date_not_valid_trading_session_day");
  assert.equal(evaluation.evaluable, false);
});

test("valid bullish prices still evaluate normally", () => {
  const evaluation = buildEvaluation({
    openPrice: 100,
    closePrice: 101
  });

  assert.equal(evaluation.result, "CORRECT");
  assert.equal(evaluation.result_reason, "agent_direction_matches_market_outcome");
  assert.equal(evaluation.pct_change, 1);
  assert.equal(evaluation.market_outcome_direction, "BULLISH");
  assert.equal(evaluation.comparable_market_direction, "BULLISH");
  assert.equal(evaluation.evaluation_quality, "EXCELLENT");
});

test("valid bearish prices still evaluate normally", () => {
  const evaluation = buildEvaluation({
    openPrice: 100,
    closePrice: 99
  });

  assert.equal(evaluation.result, "WRONG");
  assert.equal(evaluation.result_reason, "agent_direction_opposes_market_outcome");
  assert.equal(evaluation.pct_change, -1);
  assert.equal(evaluation.market_outcome_direction, "BEARISH");
  assert.equal(evaluation.comparable_market_direction, "BEARISH");
  assert.equal(evaluation.evaluation_quality, "WRONG");
});

test("Gold rejects missing, non-positive, and coercible non-price values on either side", () => {
  const invalidPrices = [null, undefined, "", "  ", true, false, [], [2000], {}, 0, -1, NaN, Infinity, "Infinity"];
  for (const invalid of invalidPrices) {
    for (const side of ["openPrice", "closePrice"]) {
      const evaluation = buildEvaluation({
        assetCode: "GOLD", evaluatedMarket: "XAUUSD",
        openPrice: 2000, closePrice: 2020, [side]: invalid
      });
      assert.equal(evaluation.result, "NOT_EVALUABLE", `${side}: ${String(invalid)}`);
      assert.equal(evaluation.evaluable, false);
      assert.equal(evaluation.pct_change, null);
      assert.equal(evaluation.market_outcome_direction, null);
      assert.equal(computePctChange(side === "openPrice" ? invalid : 2000,
        side === "closePrice" ? invalid : 2020), null);
    }
  }
});

test("Gold preserves numeric string prices and bullish, bearish, flat and no-call outcomes", () => {
  for (const [closePrice, agentDirection, expected] of [
    ["2020", "BULLISH", "CORRECT"], ["1980", "BEARISH", "CORRECT"],
    ["1980", "BULLISH", "WRONG"], ["2000", "BULLISH", "FLAT"],
    ["2020", "NO_CLEAR_BIAS", "NO_CALL"]
  ]) {
    const evaluation = buildEvaluation({
      assetCode: "GOLD", evaluatedMarket: "XAUUSD",
      openPrice: "2000", closePrice, agentDirection
    });
    assert.equal(evaluation.result, expected);
    assert.equal(evaluation.evaluable, true);
    assert.equal(evaluation.open_price, 2000);
  }
});

test("Gold rejects a non-finite return even when both supplied prices are finite", () => {
  const evaluation = buildEvaluation({
    assetCode: "GOLD", evaluatedMarket: "XAUUSD",
    openPrice: Number.MIN_VALUE, closePrice: Number.MAX_VALUE
  });
  assert.equal(evaluation.result, "NOT_EVALUABLE");
  assert.equal(evaluation.result_reason, "market_return_invalid");
  assert.equal(evaluation.evaluable, false);
  assert.equal(evaluation.pct_change, null);
  assert.equal(computePctChange(Number.MIN_VALUE, Number.MAX_VALUE), null);
});
