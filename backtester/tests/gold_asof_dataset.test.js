const test = require('node:test');
const assert = require('node:assert/strict');
const { buildGoldAsOfDataset } = require('../lib/gold_asof_dataset');
const { buildGoldTimestampedReport } = require('../lib/gold_timestamped_evaluation');

function fixture() {
  const base = structuredClone(require('../fixtures/gold_timestamped.synthetic.json'));
  return { ...base, calls: [base.calls[0]],
    feature_contract: [{ name: 'F1', required: true, max_age_ms: 7200000 }],
    feature_records: [{ name: 'F1', value: 'BULLISH', observed_at: '2024-01-08T13:00:00Z',
      available_at: '2024-01-08T13:30:00Z', source: 'synthetic-only' }] };
}

test('as-of builder feeds the timestamped evaluator with provenance', () => {
  const dataset = buildGoldAsOfDataset(fixture());
  assert.equal(dataset.calls[0].features[0].source, 'synthetic-only');
  assert.equal(dataset.calls[0].inputs_available_at, '2024-01-08T13:30:00.000Z');
  assert.equal(buildGoldTimestampedReport(dataset).evaluable_calls, 1);
});

test('later same-day features and revisions cannot alter an earlier call', () => {
  const data = fixture();
  const before = buildGoldAsOfDataset(data).calls;
  data.feature_records.push({ ...data.feature_records[0], value: 'BEARISH', available_at: '2024-01-08T15:00:00Z' });
  data.feature_records.push({ ...data.feature_records[0], value: 'BEARISH', observed_at: '2024-01-08T20:00:00Z', available_at: '2024-01-08T20:00:00Z' });
  assert.deepEqual(buildGoldAsOfDataset(data).calls, before);
});

test('latest available revision is selected deterministically', () => {
  const data = fixture();
  data.feature_records.unshift({ ...data.feature_records[0], value: 'BEARISH', available_at: '2024-01-08T13:45:00Z' });
  assert.equal(buildGoldAsOfDataset(data).calls[0].features[0].value, 'BEARISH');
});

test('stale required inputs fail evaluation instead of reverting to prefilled features', () => {
  const data = fixture(); data.feature_contract[0].max_age_ms = 1;
  const result = buildGoldAsOfDataset(data);
  assert.deepEqual(result.calls[0].features, []);
  assert.equal(result.calls[0].missing_features[0].reason, 'stale_at_call');
  assert.equal(buildGoldTimestampedReport(result).reason_counts.input_contract_incomplete, 1);
});

test('ambiguous records fail closed and optional missing features remain missing', () => {
  const data = fixture();
  data.feature_records.push({ ...data.feature_records[0] });
  assert.equal(buildGoldAsOfDataset(data).calls[0].input_rejections[0].reason, 'ambiguous_record');
  data.feature_records.pop();
  data.feature_contract.push({ name: 'F2', required: false, max_age_ms: 1 });
  const result = buildGoldAsOfDataset(data);
  assert.equal(result.calls[0].features.length, 1);
  assert.equal(result.calls[0].missing_features[0].name, 'F2');
  assert.equal(result.calls[0].input_rejections.length, 0);
});

test('bad availability records cannot be treated as absent valid data', () => {
  const data = fixture(); data.feature_records[0].available_at = '2024-01-08';
  assert.throws(() => buildGoldAsOfDataset(data), /Invalid feature/);
  data.feature_records = [];
  assert.equal(buildGoldAsOfDataset(data).calls[0].input_rejections[0].reason, 'unavailable_at_call');
});

test('other markets cannot be silently relabelled as Gold', () => {
  const data = fixture(); data.calls[0].market = 'EURUSD';
  assert.throws(() => buildGoldAsOfDataset(data), /XAUUSD/);
});

test('an explicit earlier input cutoff cannot be advanced by the builder', () => {
  const data=fixture();data.calls[0].inputs_available_at='2024-01-08T13:40:00Z';
  data.feature_records.push({...data.feature_records[0],value:'BEARISH',available_at:'2024-01-08T13:45:00Z'});
  assert.equal(buildGoldAsOfDataset(data).calls[0].features[0].value,'BULLISH');
  data.calls[0].inputs_available_at='invalid';assert.throws(()=>buildGoldAsOfDataset(data),/cutoff/);
});

test('upstream rejections survive feature selection', () => {
  const data=fixture();data.calls[0].input_rejections=[{reason:'snapshot_lineage_unverified'}];
  const result=buildGoldAsOfDataset(data);
  assert.equal(buildGoldTimestampedReport(result).evaluable_calls,0);
  assert.equal(result.calls[0].input_rejections[0].reason,'snapshot_lineage_unverified');
});
