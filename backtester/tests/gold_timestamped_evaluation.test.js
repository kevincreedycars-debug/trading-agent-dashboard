const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTimestamp, evaluateGoldTimestampedCall, buildGoldTimestampedReport } = require('../lib/gold_timestamped_evaluation');

function fixture() {
  return {
    config: { candle_interval_ms: 3600000, flat_threshold_pct: 0.3, price_basis: 'bid' },
    calls: [{ prediction_id: 'synthetic-contract-test', market: 'XAUUSD', direction: 'BULLISH',
      call_time: '2024-01-08T14:00:00Z', inputs_available_at: '2024-01-08T13:59:00Z',
      horizon_end: '2024-01-08T16:00:00Z',
      features: [{ name: 'F1', value: 'BULLISH', available_at: '2024-01-08T13:58:00Z' }] }],
    candles: [
      { market: 'XAUUSD', open_time: '2024-01-08T14:00:00Z', close_time: '2024-01-08T15:00:00Z',
        open: 2000, high: 2020, low: 1990, close: 2010, price_basis: 'bid', source: 'synthetic-test-only' },
      { market: 'XAUUSD', open_time: '2024-01-08T15:00:00Z', close_time: '2024-01-08T16:00:00Z',
        open: 2010, high: 2030, low: 2000, close: 2020, price_basis: 'bid', source: 'synthetic-test-only' }
    ]
  };
}
const evaluate = data => evaluateGoldTimestampedCall(data.calls[0], data.candles, data.config);

test('exact timestamped candles produce a directional result, never a trade claim', () => {
  const data = fixture(); data.candles.reverse();
  const result = evaluate(data);
  assert.equal(result.result, 'CORRECT');
  assert.equal(result.pct_change, 1);
  assert.equal(result.candle_count, 2);
  assert.equal(result.executable_trade_validated, false);
  assert.equal(data.candles[0].open, 2010, 'does not mutate input ordering');
});

test('timestamp parser requires real dates and explicit valid timezones', () => {
  for (const value of ['2024-02-30T12:00:00Z', '2024-01-08T24:00:00Z', '2024-01-08T12:00:00',
    '2024-01-08', '2024-01-08T12:60:00Z', '2024-01-08T12:00:00+14:30', null, 123]) {
    assert.equal(parseTimestamp(value), null, String(value));
  }
  assert.equal(parseTimestamp('2024-01-08T09:00:00-05:00'), parseTimestamp('2024-01-08T14:00:00Z'));
  assert.notEqual(parseTimestamp('2024-02-29T12:00:00Z'), null);
});

test('future inputs and entry inside a candle cannot use that candle open', () => {
  const data = fixture(); data.calls[0].inputs_available_at = '2024-01-08T14:00:01Z';
  assert.equal(evaluate(data).result_reason, 'inputs_available_after_call');
  data.calls[0].inputs_available_at = '2024-01-08T13:59:00Z';
  data.calls[0].call_time = '2024-01-08T14:30:00Z';
  assert.equal(evaluate(data).result_reason, 'exact_entry_candle_missing');
});

test('incomplete horizons, gaps and duplicate candles fail closed', () => {
  const data = fixture(); data.calls[0].horizon_end = '2024-01-08T16:30:00Z';
  assert.equal(evaluate(data).result_reason, 'exact_horizon_candle_missing');
  data.calls[0].horizon_end = '2024-01-08T17:00:00Z';
  data.candles[1].open_time = '2024-01-08T16:00:00Z';
  data.candles[1].close_time = '2024-01-08T17:00:00Z';
  assert.equal(evaluate(data).result_reason, 'candle_gap');
  const duplicate = fixture(); duplicate.candles.push({ ...duplicate.candles[0] });
  assert.equal(evaluate(duplicate).result_reason, 'duplicate_or_overlapping_candles');
});

test('invalid OHLC, basis, duration and missing provenance cannot produce scores', () => {
  for (const [change, reason] of [
    [{ open: true }, 'candle_ohlc_invalid'], [{ low: 2050 }, 'candle_ohlc_invalid'],
    [{ high: 1999 }, 'candle_ohlc_invalid'], [{ source: '' }, 'candle_source_missing'],
    [{ price_basis: 'ask' }, 'candle_price_basis_mismatch'],
    [{ close_time: '2024-01-08T14:30:00Z' }, 'candle_duration_mismatch']
  ]) {
    const data = fixture(); Object.assign(data.candles[0], change);
    assert.equal(evaluate(data).result_reason, reason);
    assert.equal(evaluate(data).pct_change, null);
  }
});

test('future candle prices cannot influence a completed evaluation', () => {
  const data = fixture();
  const expected = evaluate(data);
  data.candles.push({ ...data.candles[1], open_time: '2024-01-08T16:00:00Z',
    close_time: '2024-01-08T17:00:00Z', close: 999999 });
  assert.deepEqual(evaluate(data), expected);
});

test('batch reports quarantine every duplicate call and preserve missing-data counts', () => {
  const data = fixture(); data.calls.push({ ...data.calls[0] });
  const result = buildGoldTimestampedReport(data);
  assert.equal(result.evaluable_calls, 0);
  assert.equal(result.reason_counts.duplicate_prediction_id, 2);
  assert.equal(buildGoldTimestampedReport({ ...data, calls: [] }).calls, 0);
});

test('invalid configs are rejected instead of silently choosing a threshold or basis', () => {
  for (const config of [null, {}, { candle_interval_ms: 0 },
    { candle_interval_ms: 3600000, price_basis: 'mid', flat_threshold_pct: -1 }]) {
    const data = fixture(); data.config = config;
    assert.equal(evaluate(data).evaluable, false);
  }
});

test('bearish, flat and no-call results preserve scoring semantics', () => {
  const data = fixture(); data.calls[0].direction = 'BEARISH_LEAN';
  assert.equal(evaluate(data).result, 'WRONG');
  data.candles[1].close = 2000;
  assert.equal(evaluate(data).result, 'FLAT');
  data.calls[0].direction = 'NO_CLEAR_BIAS';
  assert.equal(evaluate(data).result, 'NO_CALL');
});

test('per-feature availability prevents a backdated aggregate cutoff hiding future evidence', () => {
  const data = fixture();
  data.calls[0].features[0].available_at = '2024-01-08T14:01:00Z';
  assert.equal(evaluate(data).result_reason, 'feature_available_after_input_cutoff');
  delete data.calls[0].features[0].available_at;
  assert.equal(evaluate(data).result_reason, 'feature_availability_missing');
  data.calls[0].features = [];
  assert.equal(evaluate(data).result_reason, 'features_missing');
});

test('delayed entry preserves the decision cutoff and requires the declared next interval', () => {
  const data=fixture();
  data.calls[0].call_time='2024-01-08T13:59:30Z';
  data.calls[0].entry_time='2024-01-08T14:00:00Z';
  assert.equal(evaluate(data).result_reason,'delayed_entry_policy_required');
  data.config.entry_policy='next_interval_open_after_call';data.config.max_entry_delay_ms=3600000;
  assert.equal(evaluate(data).entry_delay_ms,30000);
  data.calls[0].features[0].available_at='2024-01-08T13:59:45Z';
  assert.equal(evaluate(data).result_reason,'feature_available_after_input_cutoff');
  data.calls[0].features[0].available_at='2024-01-08T13:58:00Z';
  data.calls[0].entry_time='2024-01-08T15:00:00Z';assert.equal(evaluate(data).result_reason,'delayed_entry_invalid');
});

test('endpoint-only policy reports gaps without pretending to validate an executable path', () => {
  const data=fixture();data.calls[0].horizon_end='2024-01-08T17:00:00Z';
  data.candles[1].open_time='2024-01-08T16:00:00Z';data.candles[1].close_time='2024-01-08T17:00:00Z';
  assert.equal(evaluate(data).result_reason,'candle_gap');
  data.config.coverage_policy='exact_endpoints';const result=evaluate(data);
  assert.equal(result.evaluable,true);assert.equal(result.observed_path_complete,false);
  assert.equal(result.interior_missing_duration_ms,3600000);assert.equal(result.executable_trade_validated,false);
  data.candles.push({...data.candles[0]});assert.equal(evaluate(data).result_reason,'duplicate_or_overlapping_candles');
});

test('mixed feeds and explicitly incomplete candles cannot produce directional scores', () => {
  const data=fixture();data.candles[1].source='another-feed';assert.equal(evaluate(data).result_reason,'mixed_candle_sources');
  data.candles[1].source=data.candles[0].source;data.candles[1].complete=false;
  assert.equal(evaluate(data).result_reason,'candle_incomplete');
});

test('indexed batch evaluation matches direct checks including malformed and overlapping archives', () => {
  const cases=[fixture(),fixture(),fixture(),fixture(),fixture()];
  cases[1].candles.push({...cases[1].candles[0],open_time:'2024-01-08T12:00:00Z',close_time:'2024-01-08T17:00:00Z'});
  cases[2].candles.push({...cases[2].candles[0],open_time:'bad'});
  cases[3].candles.push({...cases[3].candles[0],market:'EURUSD'});
  cases[4].candles.push({...cases[4].candles[0],open_time:'2024-01-08T12:00:00Z',close_time:'2024-01-08T13:00:00Z',high:null});
  for(const data of cases) {
    data.candles.reverse();
    assert.deepEqual(buildGoldTimestampedReport(data).rows[0],evaluate(data));
  }
});
