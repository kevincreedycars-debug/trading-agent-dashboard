const test = require('node:test');
const assert = require('node:assert/strict');
const { buildGoldTimestampedReport } = require('../lib/gold_timestamped_evaluation');
const { prepareGoldStoredCalls } = require('../lib/gold_stored_call_evidence');
const { buildGoldAsOfDataset } = require('../lib/gold_asof_dataset');

function dataset(direction = 'BULLISH', close = 101) {
  return { config: { candle_interval_ms: 3600000, price_basis: 'mid', flat_threshold_pct: 0.5 },
    calls: [{ prediction_id: 'review-synthetic', market: 'XAUUSD', direction,
      call_time: '2024-03-10T01:00:00-05:00', horizon_end: '2024-03-10T03:00:00-04:00',
      inputs_available_at: '2024-03-10T06:00:00Z',
      features: [{ name: 'F1', value: 'BULLISH', available_at: '2024-03-10T06:00:00Z' }] }],
    candles: [{ market: 'XAUUSD', open_time: '2024-03-10T06:00:00Z', close_time: '2024-03-10T07:00:00Z',
      open: 100, high: 102, low: 98, close, source: 'synthetic-review-only', price_basis: 'mid', complete: true }] };
}

test('review: hand-calculated direction and inclusive flat boundaries across DST', () => {
  for (const [direction, close, result, pct] of [
    ['BULLISH', 101, 'CORRECT', 1], ['BEARISH', 99, 'CORRECT', -1],
    ['BEARISH', 101, 'WRONG', 1], ['BULLISH', 100.5, 'FLAT', 0.5],
    ['BEARISH', 99.5, 'FLAT', -0.5], ['NO_CLEAR_BIAS', 101, 'NO_CALL', 1]
  ]) {
    const row = buildGoldTimestampedReport(dataset(direction, close)).rows[0];
    assert.equal(row.result, result); assert.equal(row.pct_change, pct);
    assert.equal(row.candle_count, 1); assert.equal(row.evaluable, true);
    assert.equal(row.executable_trade_validated, false);
  }
});

test('review: every input is reconciled, including rejected no-calls and duplicate ids', () => {
  const data = dataset();
  data.calls.push({ ...data.calls[0], prediction_id: 'no-call', direction: 'NO_CLEAR_BIAS', features: [] });
  data.calls.push({ ...data.calls[0], prediction_id: 'duplicate' }, { ...data.calls[0], prediction_id: 'duplicate' });
  const report = buildGoldTimestampedReport(data);
  assert.equal(report.calls, 4); assert.equal(report.evaluable_calls, 1);
  assert.deepEqual(report.result_counts, { CORRECT: 1, NOT_EVALUABLE: 3 });
  assert.equal(report.reason_counts.features_missing, 1);
  assert.equal(report.reason_counts.duplicate_prediction_id, 2);
  assert.equal(Object.values(report.reason_counts).reduce((a, b) => a + b, 0), 4);
});

test('review: weekend gaps remain rejected in strict mode and exposed in endpoint mode', () => {
  const data = dataset();
  Object.assign(data.calls[0], { call_time: '2024-03-08T21:00:00Z', inputs_available_at: '2024-03-08T21:00:00Z',
    horizon_end: '2024-03-10T23:00:00Z', features: [{ name: 'F1', value: 'BULLISH', available_at: '2024-03-08T21:00:00Z' }] });
  Object.assign(data.candles[0], { open_time: '2024-03-08T21:00:00Z', close_time: '2024-03-08T22:00:00Z' });
  data.candles.push({ ...data.candles[0], open_time: '2024-03-10T22:00:00Z', close_time: '2024-03-10T23:00:00Z' });
  assert.equal(buildGoldTimestampedReport(data).rows[0].result_reason, 'candle_gap');
  data.config.coverage_policy = 'exact_endpoints';
  const row = buildGoldTimestampedReport(data).rows[0];
  assert.equal(row.interior_missing_duration_ms, 48 * 3600000);
  assert.equal(row.observed_path_complete, false);
});

// These characterize reviewed gaps, not desired repaired behavior. Replace their
// expectations with fail-closed/versioned-contract assertions when repairing.
test('review gap G1: completion metadata other than literal false is accepted', () => {
  for (const flag of [undefined, null, 'false', 0]) {
    const data = dataset(); data.candles[0].complete = flag;
    assert.equal(buildGoldTimestampedReport(data).rows[0].evaluable, true);
  }
});

test('review gap G2: rounding across a minute delays entry beyond the raw next minute', () => {
  const protocol = { id: 'synthetic-review', frozen_at: '2024-01-01T00:00:00Z',
    entry_policy: 'next_minute_after_storage', horizon_ms: 86400000, flat_threshold_pct: 0.3 };
  const result = prepareGoldStoredCalls({ outputs: [{ id: 'review', agent_name: 'GOLD', layer: 1,
    snapshot_id: 'snapshot', created_at: '2024-01-08T13:59:59.999999Z', call_24h_direction: 'BULLISH',
    factor_breakdown: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`F${i + 1}`, { signal: 'BULLISH' }])) }],
    snapshots: [{ id: 'snapshot', created_at: '2024-01-08T13:00:00Z' }] }, protocol);
  const call = result.dataset.calls[0];
  assert.equal(call.call_time, '2024-01-08T14:00:00.000Z');
  assert.equal(call.entry_time, '2024-01-08T14:01:00.000Z');
  assert.notEqual(call.entry_time, '2024-01-08T14:00:00.000Z');
});

test('review gap G3: as-of selection drops the supplied protocol envelope', () => {
  const input = dataset(); input.protocol = { id: 'synthetic-review-protocol' };
  input.feature_contract = [{ name: 'F1', required: true, max_age_ms: 0 }];
  input.feature_records = [{ name: 'F1', value: 'BULLISH', observed_at: '2024-03-10T06:00:00Z',
    available_at: '2024-03-10T06:00:00Z', source: 'synthetic-review-only' }];
  const output = buildGoldAsOfDataset(input);
  assert.equal(output.protocol, undefined);
  assert.equal(buildGoldTimestampedReport(output).protocol, null);
  assert.equal(input.protocol.id, 'synthetic-review-protocol');
});
