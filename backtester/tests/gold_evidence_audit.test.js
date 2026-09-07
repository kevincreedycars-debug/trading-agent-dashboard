const test = require('node:test');
const assert = require('node:assert/strict');
const { buildGoldEvidenceAudit } = require('../lib/gold_evidence_audit');

function row(id = 'a', overrides = {}) {
  return { prediction_id: id, snapshot_date: '2024-01-08', timeframe: 'following 24hrs',
    stored: { direction: 'BULLISH', flat_threshold_used: 0.3, evaluation_result: 'CORRECT' },
    evaluation_inputs: { open_price: 2000, close_price: 2020, close_date: '2024-01-09' },
    factor_comparisons: Array.from({ length: 10 }, (_, i) => ({ factor_key: `F${i + 1}`,
      signal: { stored: 'BULLISH', rerun: 'BEARISH' } })), ...overrides };
}
const audit = rows => buildGoldEvidenceAudit({ meta: { asset: 'GOLD' }, rows });

test('numeric agreement does not qualify legacy Gold timing', () => {
  const report = audit([row()]);
  assert.equal(report.coverage.recomputed_rows, 1);
  assert.deepEqual(report.issue_counts, {});
  assert.equal(report.timing_gate.qualified, false);
  assert.equal(report.factors[0].correct, 1);
  assert.equal(report.factor_pairs.length, 45);
  assert.equal(report.factor_pairs[0].agreement_pct, 100);
});

test('duplicate IDs are all excluded, not counted twice or arbitrarily selected', () => {
  const report = audit([row(), row(), row('b')]);
  assert.equal(report.coverage.duplicated_prediction_ids, 1);
  assert.equal(report.coverage.factor_outcome_rows, 1);
  assert.equal(report.issue_counts.duplicate_prediction_id, 2);
});

test('bad dates, mismatched horizons and invalid prices are excluded', () => {
  const report = audit([row('a', { snapshot_date: '2024-02-30' }),
    row('b', { evaluation_inputs: { open_price: 2000, close_price: 2020, close_date: '2024-01-10' } }),
    row('c', { evaluation_inputs: { open_price: true, close_price: 2020, close_date: '2024-01-09' } })]);
  assert.equal(report.coverage.factor_outcome_rows, 0);
  assert.equal(report.issue_counts.invalid_snapshot_date, 1);
  assert.equal(report.issue_counts.close_date_mismatch, 1);
  assert.equal(report.issue_counts.market_price_missing, 1);
});

test('missing stored factors never inherit rerun signals and mismatches are reported', () => {
  const sample = row();
  delete sample.factor_comparisons[0].signal.stored;
  sample.stored.evaluation_result = 'WRONG';
  const report = audit([sample]);
  assert.equal(report.factors[0].available_rows, 0);
  assert.equal(report.issue_counts.invalid_or_missing_factor_F1, 1);
  assert.equal(report.issue_counts.stored_result_mismatch, 1);
});

test('flats are exposed and excluded from directional accuracy denominator', () => {
  const sample = row();
  sample.evaluation_inputs.close_price = 2000;
  sample.stored.evaluation_result = 'FLAT';
  const report = audit([sample]);
  assert.equal(report.factors[0].flat, 1);
  assert.equal(report.factors[0].ex_flat_accuracy_pct, null);
});

test('empty valid artifacts yield empty coverage and no invented rates', () => {
  const report = audit([]);
  assert.equal(report.coverage.recomputed_rows, 0);
  assert.equal(report.factor_pairs[0].agreement_pct, null);
  assert.throws(() => buildGoldEvidenceAudit({ rows: [] }), /GOLD/);
});

test('stored lean calls retain the established directional evaluation semantics', () => {
  const sample = row();
  sample.stored.direction = 'BULLISH_LEAN';
  const report = audit([sample]);
  assert.equal(report.result_counts.CORRECT, 1);
  assert.deepEqual(report.issue_counts, {});
});
