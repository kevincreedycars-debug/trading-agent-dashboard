const test = require('node:test');
const assert = require('node:assert/strict');
const { buildExperiments, extractSnapshotFeatures, testCondition } = require('../lib/gold_research_experiments');
function fixture() {
  const data = { calls: [], candles: [], config: { candle_interval_ms: 3600000, price_basis: 'mid', flat_threshold_pct: 0.3 } };
  const snapshots = [];
  for (let index = 0; index < 8; index++) {
    const start = Date.parse('2024-01-01T12:00:00Z') + index * 2 * 86400000;
    const iso = hour => new Date(start + hour * 3600000).toISOString();
    snapshots.push({ id: `s${index}`, created_at: iso(-1), dxy_d1: index % 2 ? 2 : -2, vix_level: 20 + index });
    data.calls.push({ prediction_id: `p${index}`, source_snapshot_id: `s${index}`, market: 'XAUUSD', direction: 'BULLISH',
      call_time: iso(0), inputs_available_at: iso(-1), horizon_end: iso(24),
      features: [{ name: 'F1', value: 'BULLISH', available_at: iso(-1) }] });
    for (let hour = 0; hour < 24; hour++) data.candles.push({ market: 'XAUUSD', open_time: iso(hour), close_time: iso(hour + 1),
      open: 100, high: 102, low: 98, close: hour === 23 ? index % 2 ? 99 : 101 : 100,
      source: 'synthetic', complete: true, price_basis: 'mid' });
  }
  return { data, snapshots };
}
const options = { split_at: '2024-01-09T00:00:00Z', embargo_ms: 0, minimum_training_samples: 2 };
test('changing validation prices cannot change trained conditions, directions or candidate selection', () => {
  const { data, snapshots } = fixture();
  const first = buildExperiments(data, snapshots, options);
  for (const candle of data.candles) if (candle.open_time >= options.split_at) candle.close = 102;
  const second = buildExperiments(data, snapshots, options);
  const training = report => report.experiments.map(row => ({ conditions: row.conditions, direction: row.expected_direction, stats: row.training }));
  assert.deepEqual(training(first), training(second));
  assert.equal(first.selected_by_training_only, second.selected_by_training_only);
  assert.equal(first.coverage.training, 4);
  assert.equal(first.coverage.validation, 4);
  assert.equal(first.greater_than_60pct_established, false);
});
test('source selection reserves a rejected earliest call instead of replacing it with a winning later call', () => {
  const { data, snapshots } = fixture();
  data.calls.push({ ...data.calls[0], prediction_id: 'later', call_time: '2024-01-01T13:00:00Z', horizon_end: '2024-01-02T13:00:00Z' });
  data.calls[0].features = [];
  const report = buildExperiments(data, snapshots, options);
  assert.equal(report.rows.some(row => row.prediction_id === 'later'), false);
  assert.equal(report.exclusions.length + report.rows.length, data.calls.length);
});
test('future event updates cannot be admitted under an earlier release time', () => {
  const snapshot = { created_at: '2024-01-01T00:00:00Z', latest_us_event: { raw: { raw_json: {
    dateUtc: '2024-01-01T00:00:00Z', lastUpdated: Date.parse('2024-01-03T00:00:00Z') / 1000, actual: 2, consensus: 1
  } } } };
  const result = extractSnapshotFeatures(snapshot, Date.parse('2024-01-02T00:00:00Z'));
  assert.equal(result.values.event_actual, undefined);
  assert.ok(result.issues.includes('event_vintage_unknown_or_future'));
  assert.equal(testCondition({ values: {} }, { feature: 'x', operator: 'lte', value: 0 }), null);
});
