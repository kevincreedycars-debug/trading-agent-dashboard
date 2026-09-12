const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVariableEventResearchReport, parseTimestamp } = require('../lib/variable_event_research');
const { auditGoldSourceReadiness } = require('../lib/gold_source_readiness');
const { buildGoldVariableEventResearchReport } = require('../lib/gold_variable_event_research');
const registry = { features: [{ key: 'x' }], hypotheses: [
  { id: 'x', feature_key: 'x', cohort: { operator: 'gte', value: 0 }, expected_outcome_direction: 'BULLISH' }
] };
const options = { split_at: '2024-02-01T00:00:00Z', embargo_ms: 0 };
function row(value = 1) {
  return { observation_id: 'a', decision_time: '2024-01-01T00:00:00Z',
    outcome_end_time: '2024-01-02T00:00:00Z', outcome_direction: 'BULLISH',
    features: { x: { value, available_at: '2024-01-01T00:00:00Z' } } };
}
test('24-hour enforcement rejects shorter, longer and ambiguous timestamp windows', () => {
  for (const end of ['2024-01-01T01:00:00Z', '2024-01-03T00:00:00Z', '2024-01-02']) {
    const observation = row(); observation.outcome_end_time = end;
    const report = buildVariableEventResearchReport({ observations: [observation] }, registry, options);
    assert.equal(report.coverage.accepted_observations, 0);
  }
  assert.equal(parseTimestamp('2024-02-30T00:00:00Z'), null);
  assert.equal(parseTimestamp('2024-01-01T00:00:00'), null);
});
test('null, empty and coercible values never become zero-valued numeric evidence', () => {
  for (const value of [null, '', true, '1', [], {}]) {
    const report = buildVariableEventResearchReport({ observations: [row(value)] }, registry, options);
    assert.equal(report.hypotheses[0].results.training.feature_usable_observations, 0);
  }
});

test('raw numeric association uses returns and leaves constant features undefined', () => {
  const observations = [1, 2, 3].map(value => ({ ...row(value), observation_id: String(value), return_pct: value * 2 }));
  let result = buildVariableEventResearchReport({ observations }, registry, options).hypotheses[0].results.training;
  assert.equal(result.numeric_return_association.pearson_r, 1);
  assert.equal(result.cohort.mean_return_pct, 4);
  for (const observation of observations) observation.features.x.value = 1;
  result = buildVariableEventResearchReport({ observations }, registry, options).hypotheses[0].results.training;
  assert.equal(result.numeric_return_association.pearson_r, null);
});
test('delayed entry measures exactly 24 hours from entry and keeps original decision cutoff', () => {
  const observation = row(); observation.entry_time = '2024-01-01T00:01:00Z';
  observation.outcome_end_time = '2024-01-02T00:01:00Z';
  let report = buildVariableEventResearchReport({ observations: [observation] }, registry, options);
  assert.equal(report.coverage.accepted_observations, 1);
  observation.features.x.available_at = observation.entry_time;
  report = buildVariableEventResearchReport({ observations: [observation] }, registry, options);
  assert.equal(report.hypotheses[0].results.training.feature_exclusions.late_feature, 1);
});
test('readiness refuses to qualify missing or storage-proxy evidence', () => {
  const report = auditGoldSourceReadiness({ feature_records: [{ name: 'gold_price', value: 2000,
    observed_at: '2024-01-01T00:00:00Z', available_at: '2024-01-01T00:01:00Z', timing_basis: 'storage_proxy' }] });
  const price = report.variables.find(item => item.name === 'gold_price');
  assert.equal(price.metadata_eligible_records, 0);
  assert.equal(price.issue_counts.publication_timing_unverified, 1);
  assert.equal(report.trustworthy_dataset_established, false);
  assert.equal(report.missing_variables, report.variable_count - 1);
});

test('a complete 24-hour Gold path produces the hand-calculated bullish cohort', () => {
  const start = Date.parse('2024-01-01T00:00:00Z');
  const iso = hour => new Date(start + hour * 3600000).toISOString();
  const dataset = { data_kind: 'synthetic', config: { candle_interval_ms: 3600000, price_basis: 'mid', flat_threshold_pct: 0.3 },
    calls: [{ prediction_id: 'full-day', market: 'XAUUSD', direction: 'BULLISH', call_time: iso(0),
      inputs_available_at: iso(0), horizon_end: iso(24), features: [{ name: 'x', value: 1, available_at: iso(0) }] }],
    candles: Array.from({ length: 24 }, (_, hour) => ({ market: 'XAUUSD', open_time: iso(hour), close_time: iso(hour + 1),
      open: 100, high: 101, low: 100, close: hour === 23 ? 101 : 100, price_basis: 'mid', source: 'synthetic', complete: true })) };
  const report = buildGoldVariableEventResearchReport(dataset, registry, options);
  assert.equal(report.coverage.accepted_observations, 1);
  assert.equal(report.hypotheses[0].results.training.cohort.bullish_count, 1);
  dataset.candles.splice(12, 1);
  const gapped = buildGoldVariableEventResearchReport(dataset, registry, options);
  assert.equal(gapped.upstream_evaluation.exclusions[0].reason, 'candle_gap');
});

test('Gold command refuses existing output and preserves report bytes', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { run } = require('../scripts/build_gold_variable_event_research');
  const directory = fs.mkdtempSync(path.resolve(__dirname, '../../tmp/gold-framework-preserve-'));
  const output = path.join(directory, 'report.json');
  const args = [path.resolve(__dirname, '../fixtures/gold_timestamped.synthetic.json'),
    path.resolve(__dirname, '../registries/gold_24h_factor_hypotheses.v1.json'), output, options.split_at, '0'];
  run(args);
  const bytes = fs.readFileSync(output);
  assert.throws(() => run(args), /EEXIST/);
  assert.deepEqual(fs.readFileSync(output), bytes);
});
