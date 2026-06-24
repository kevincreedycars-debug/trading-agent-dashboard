const test = require("node:test");
const assert = require("node:assert/strict");

const { evaluateSingleMarket } = require("../lib/outcome_evaluation");

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
