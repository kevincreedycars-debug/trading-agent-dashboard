'use strict';
// Invariants of the committed Gold 28-factor outcome summary that feeds the research page.
// This test never reads ignored run artifacts, so it runs anywhere the data file is committed.
const test = require('node:test');
const assert = require('node:assert/strict');
const outcomes = require('../../data/gold-28-factor-outcomes-20260925.json');

test('the published outcome summary states the accepted exploratory circuit and nothing more', () => {
  assert.equal(outcomes.schema_version, 'gold-28-factor-outcomes-v1');
  assert.equal(outcomes.research_only, true);
  assert.equal(outcomes.exploratory, true);
  assert.equal(outcomes.prediction_claimed, false);
  assert.equal(outcomes.accuracy_claimed, false);
  assert.equal(outcomes.trading_result_computed, false);
  assert.equal(outcomes.run_id, 'gold-combination-run-024-20260926-rev3');
});

test('candidate, attempt and denominator totals reconcile and cannot drift silently', () => {
  const status = outcomes.coverage.status_totals;
  const total = status.reported + status.ineligible + status.empty + status.unavailable;
  assert.equal(outcomes.coverage.candidates_declared, 4956);
  assert.equal(outcomes.coverage.candidates_evaluated, 4956);
  assert.equal(total, 4956, 'status totals must account for every declared candidate');
  assert.deepEqual(status, { reported: 2745, ineligible: 704, empty: 1507, unavailable: 0 });
  assert.equal(outcomes.coverage.attempts, 4782540);
  assert.equal(outcomes.coverage.matched_anchors, 441781);
  assert.equal(outcomes.coverage.observations, 441319);
  assert.equal(outcomes.denominators.exact_offset_elapsed + outcomes.denominators.delayed_offset_endpoint
    + outcomes.denominators.session_close_endpoint, outcomes.denominators.all_computed);
  assert.equal(outcomes.denominators.reconciled, true);
  assert.equal(outcomes.denominators.all_computed, 441319);
});

test('the page cannot show a bare number without its evidence and its limits', () => {
  assert.ok(outcomes.exclusions.length >= 4, 'every exclusion row is published with a count');
  for (const item of outcomes.exclusions) assert.ok(Number.isFinite(item.count) && typeof item.label === 'string' && item.label.length > 0);
  assert.equal(outcomes.candidate_n.median, 74);
  assert.equal(outcomes.candidate_n.q1, 0);
  assert.equal(outcomes.verdict.quotes.length, 4, 'the verdict is quoted, not paraphrased');
  assert.match(outcomes.verdict.sha256, /^[0-9a-f]{64}$/);
  assert.ok(outcomes.limits.length >= 3);
  assert.match(outcomes.dependence.statement, /dependent/i);
  assert.ok(outcomes.what_would_change_it.some(line => line.includes('2027-03-25T15:00:00Z')));
  for (const source of outcomes.sources) assert.ok(source.path && (source.sha256 === null || /^[0-9a-f]{64}$/.test(source.sha256)));
});
