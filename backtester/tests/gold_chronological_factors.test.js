const test = require('node:test');
const assert = require('node:assert/strict');
const { buildGoldChronologicalFactors } = require('../lib/gold_chronological_factors');

function fixture() {
  const time = h => `2024-01-08T${h}:00:00Z`;
  return { config: { candle_interval_ms: 3600000, price_basis: 'mid', flat_threshold_pct: 0.3 },
    calls: [10, 11, 12, 13].map(hour => ({ prediction_id: `synthetic-${hour}`, market: 'XAUUSD', direction: 'BULLISH',
      call_time: time(hour), horizon_end: time(hour + 2), inputs_available_at: time(hour),
      features: [{ name: 'F1', value: 'BULLISH', available_at: time(hour) },
        { name: 'F2', value: 'BULLISH', available_at: time(hour) }] })),
    candles: [10, 11, 12, 13, 14].map(hour => ({ market: 'XAUUSD', open_time: time(hour), close_time: time(hour + 1),
      open: 2000, high: 2020, low: 2000, close: 2020, price_basis: 'mid', source: 'synthetic-test-only' })) };
}
const options = { split_at: '2024-01-08T12:00:00Z', embargo_ms: 3600000 };

test('purges crossing horizons and embargo calls from both partitions', () => {
  const report = buildGoldChronologicalFactors(fixture(), options);
  assert.deepEqual(report.coverage, { source_calls: 4, training_calls: 1, validation_calls: 1, excluded_calls: 2 });
  assert.equal(report.factors[0].training.correct, 1);
  assert.equal(report.factors[0].validation.correct, 1);
  assert.equal(report.pairs[0].validation.agreement_pct, 100);
  assert.equal(report.untouched_holdout_claimed, false);
});

test('missing factors have explicit coverage and never become neutral evidence', () => {
  const report = buildGoldChronologicalFactors(fixture(), options);
  assert.equal(report.factors[2].validation.missing_calls, 1);
  assert.equal(report.factors[2].validation.neutral_calls, 0);
  assert.equal(report.factors[2].validation.ex_flat_accuracy_pct, null);
});

test('changing validation outcomes leaves training statistics unchanged', () => {
  const data = fixture();
  const first = buildGoldChronologicalFactors(data, options);
  data.candles.at(-1).close = 1980;
  data.candles.at(-1).low = 1980;
  const second = buildGoldChronologicalFactors(data, options);
  assert.deepEqual(first.factors.map(row => row.training), second.factors.map(row => row.training));
  assert.equal(second.factors[0].validation.wrong, 1);
});

test('invalid timestamps and duplicated calls cannot enter a partition', () => {
  const data = fixture();
  data.calls[0].features[0].available_at = '2024-01-09T00:00:00Z';
  data.calls.push({ ...data.calls.at(-1) });
  const report = buildGoldChronologicalFactors(data, options);
  assert.equal(report.coverage.training_calls, 0);
  assert.equal(report.coverage.validation_calls, 0);
  assert.equal(report.excluded.filter(row => row.reason === 'duplicate_prediction_id').length, 2);
});

test('explicit valid split and embargo are required', () => {
  assert.throws(() => buildGoldChronologicalFactors(fixture(), {}), /split_at/);
  assert.throws(() => buildGoldChronologicalFactors(fixture(), { ...options, embargo_ms: -1 }), /embargo_ms/);
});

test('factor correlation handles changing votes and constant factors separately', () => {
  const data=fixture();data.calls[0].features[0].value='BEARISH';data.calls[0].features[1].value='BEARISH';
  let report=buildGoldChronologicalFactors(data,{split_at:'2024-01-09T00:00:00Z',embargo_ms:0});
  assert.equal(report.pairs[0].training.signal_correlation,1);
  for(const call of data.calls) call.features[1].value='BULLISH';
  report=buildGoldChronologicalFactors(data,{split_at:'2024-01-09T00:00:00Z',embargo_ms:0});
  assert.equal(report.pairs[0].training.signal_correlation,null);
  assert.equal(report.pairs[0].training.jointly_available_calls,4);
  assert.equal(report.pairs[1].training.jointly_available_calls,0);
});
