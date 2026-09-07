const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizePrimaryEvaluations } = require('../scripts/run_gold_prediction_outcome_evaluations');

test('Gold realised summary retains direction from the actual persisted row shape', () => {
  const summary = summarizePrimaryEvaluations([{ evaluation_mode: 'primary', evaluated_market: 'XAUUSD',
    result: 'CORRECT', pct_change: 1, open_price: 2000, close_price: 2020,
    evaluation_payload: { comparable_market_direction: 'BULLISH', evaluable: true } }]);
  assert.equal(summary.realised_direction, 'BULLISH');
  assert.equal(summary.entry_price, 2000);
  assert.equal(summary.realised_return_pct, 1);
});

test('missing direction remains absent and direct evaluation objects remain compatible', () => {
  assert.equal(summarizePrimaryEvaluations([]).realised_direction, null);
  assert.equal(summarizePrimaryEvaluations([{ evaluation_mode: 'primary', result: 'NOT_EVALUABLE',
    pct_change: null, evaluation_payload: { comparable_market_direction: null } }]).realised_direction, null);
  assert.equal(summarizePrimaryEvaluations([{ evaluation_mode: 'primary', result: 'CORRECT',
    pct_change: -1, comparable_market_direction: 'BEARISH' }]).realised_direction, 'BEARISH');
});
