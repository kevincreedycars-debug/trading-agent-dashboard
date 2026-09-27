'use strict';
// Invariants of the committed Gold direction scorecard that feeds the research page, plus the
// fail-closed behaviour of the shaping library. The committed-data tests never read the ignored
// report, so they run anywhere the data file is committed.
const test = require('node:test');
const assert = require('node:assert/strict');
const { shapeDirectionScorecard, EXPECTED } = require('../lib/gold_direction_scorecard');
const scorecard = require('../../data/gold-direction-scorecard-20260927.json');

const WEIGHTS = [22, 18, 14, 8, 8, 10, 6, 6, 6, 2];
const BLOCK = Object.freeze({
  horizon: 'h24_post_event', n: 100, resolved: 100, positive: 60, negative: 40, exact_zero: 0,
  expected_side: 'BULLISH', expected_count: 60, other_count: 40, hit_rate_pct: 60, benchmark_pct: 55.81,
  drift_edge_pp: 4.19, clears_majority_threshold: false, small_sample: false, years_observed: 1,
  years_same_edge_sign: false, years: [{ year: 2023, n: 100, resolved: 100, hit_rate_pct: 60, benchmark_pct: 51.54, drift_edge_pp: 4.46 }]
});

function syntheticRegistry() {
  return {
    version: 'synthetic-v1',
    written_after_report_acceptance: true,
    factors: WEIGHTS.map((weight, index) => ({ key: `F${index + 1}`, label: `Factor ${index + 1}`, weight, declared_rules: [], document_inputs: [] }))
  };
}

function syntheticCheck(overrides = {}) {
  const rows = Array.from({ length: EXPECTED.rows_scored }, (_, index) => ({
    factor_key: 'F1', factor_label: 'Factor 1', factor_weight: 22, variable: `variable_${index}`, state: 'positive',
    expectation: 'BULLISH', provenance: 'declared', rule_ref: 'rule', rule_text: 'text', caveats: [],
    session: { ...BLOCK }, week: { ...BLOCK, horizon: 'd5_trading_days_post_event' },
    session_verdict: 'no_information', week_verdict: 'no_information'
  }));
  const unscored = Array.from({ length: EXPECTED.unscored_states }, (_, index) => ({
    factor_key: 'F6', factor_label: 'Factor 6', factor_weight: 10, variable: `level_${index}`, state: 'above_own_median',
    expectation: null, provenance: 'not_declared', reason: 'level_band_not_declared', rule_ref: null, rule_text: null, caveats: [],
    session_raw: { horizon: 'h24_post_event', n: 10, resolved: 10, up_rate_pct: 50, down_rate_pct: 50 },
    week_raw: { horizon: 'd5_trading_days_post_event', n: 10, resolved: 10, up_rate_pct: 50, down_rate_pct: 50 }
  }));
  const rollup = [{
    factor_key: 'F1', factor_label: 'Factor 1', factor_weight: 22, variables: ['variable_0'], rows_scored: 1,
    declared_rows: 1, interpreted_rows: 0, session: { ...BLOCK }, week: { ...BLOCK, horizon: 'd5_trading_days_post_event' },
    session_verdict: 'no_information', week_verdict: 'no_information'
  }];
  return {
    rows,
    unscored,
    rollup,
    baselines: {
      h24_post_event: { horizon: 'h24_post_event', n: 964, positive: 538, negative: 426, exact_zero: 0, positive_rate_pct: 55.81, negative_rate_pct: 44.19, by_year: { 2023: { n: 260, positive_rate_pct: 51.54 } } },
      d5_trading_days_post_event: { horizon: 'd5_trading_days_post_event', n: 960, positive: 559, negative: 401, exact_zero: 0, positive_rate_pct: 58.23, negative_rate_pct: 41.77, by_year: { 2023: { n: 260, positive_rate_pct: 51.92 } } }
    },
    summary: {
      rows_scored: 25, rows_declared: 25, rows_interpreted: 0, rows_unscored_no_declared_direction: 26,
      session_verdicts: { no_information: 25 }, week_verdicts: { no_information: 25 },
      session_rows_at_or_above_threshold_pct: 0, week_rows_at_or_above_threshold_pct: 0,
      session_rows_hit_rate_at_least_50: 25, week_rows_hit_rate_at_least_50: 25
    },
    declared_but_absent: [{ variable: 'v', state: 'exact_zero', factor: 'F2', expectation: 'NEUTRAL', note: 'declared_state_not_measured_in_this_cohort' }],
    declared_in_another_cohort: [],
    unmeasured_document_inputs: [],
    availability_labels: [],
    parameters: { cohort: 'daily_snapshot_anchors', group: 'all_computed', primary_horizon: 'h24_post_event', week_horizon: 'd5_trading_days_post_event', min_n: 100, min_year_n: 20, edge_pp: 5, threshold_pct: 60 },
    ...overrides
  };
}

function syntheticReport(overrides = {}) {
  return {
    observation_counts: { daily_anchors: 965, event_rows: 5115, distinct_event_identities: 5115 },
    inventory: { declared_variables: 28 },
    sources: { hourly: { meta: { first_open_time: '2023-01-02T23:00:00.000Z', last_open_time: '2026-09-11T20:00:00.000Z' } } },
    ...overrides
  };
}

function syntheticHashes() {
  return { reportPath: 'report.json', reportSha256: 'a'.repeat(64), expectationsPath: 'registry.json', expectationsSha256: 'b'.repeat(64), generatedAt: '2026-09-27T00:00:00.000Z' };
}


test('the published scorecard states the exploratory circuit and nothing more', () => {
  assert.equal(scorecard.schema_version, 'gold-direction-scorecard-v1');
  assert.equal(scorecard.research_only, true);
  assert.equal(scorecard.exploratory, true);
  assert.equal(scorecard.prediction_claimed, false);
  assert.equal(scorecard.accuracy_claimed, false);
  assert.equal(scorecard.trading_result_computed, false);
  assert.match(scorecard.source.sha256, /^[0-9a-f]{64}$/);
  assert.equal(scorecard.source.first_observation, '2023-01-02T23:00:00.000Z');
  assert.equal(scorecard.source.last_observation, '2026-09-11T20:00:00.000Z');
});

test('every state is either scored, neutral or printed with a reason, and the counts reconcile', () => {
  assert.equal(scorecard.rows.length, EXPECTED.rows_scored);
  assert.equal(scorecard.unscored.length, 20);
  assert.equal(scorecard.neutral_states.length, 6);
  assert.equal(scorecard.unscored.length + scorecard.neutral_states.length, EXPECTED.unscored_states);
  for (const row of scorecard.unscored) {
    assert.ok(row.reason && row.reason !== 'neutral_declared', `${row.variable}|${row.state} must carry a non-neutral reason`);
    assert.ok(row.reason_note && row.reason_note.length > 20, `${row.variable}|${row.state} must explain why nothing is testable`);
  }
  for (const row of scorecard.neutral_states) assert.equal(row.expectation, 'NEUTRAL');
  assert.equal(scorecard.coverage.variable_coverage.length, 22, 'the weekday cohort measures 22 variables');
  assert.equal(scorecard.coverage.availability_labels, 11);
});

test('a hit rate is never published without the drift floor it has to beat', () => {
  for (const row of scorecard.rows) {
    for (const block of [row.session, row.week]) {
      if (!block) continue;
      assert.ok(Number.isFinite(block.hit_rate_pct) && Number.isFinite(block.benchmark_pct),
        `${row.variable}|${row.state} must carry both a hit rate and a benchmark`);
      assert.equal(block.drift_edge_pp, Math.round((block.hit_rate_pct - block.benchmark_pct) * 100) / 100,
        `${row.variable}|${row.state} drift edge must be hit rate minus benchmark`);
      for (const year of block.years) {
        if (year.no_sample) assert.equal(year.drift_edge_pp, null);
        else assert.equal(year.drift_edge_pp, Math.round((year.hit_rate_pct - year.benchmark_pct) * 100) / 100);
      }
    }
  }
  for (const factor of scorecard.factors) {
    if (!factor.testable) { assert.equal(factor.session, null); assert.equal(factor.week, null); }
    else assert.ok(factor.session.benchmark_pct !== undefined);
  }
});

test('the drift baseline and verdict tallies cannot drift silently', () => {
  assert.equal(scorecard.baselines.session.n, 964);
  assert.equal(scorecard.baselines.session.positive_rate_pct, 55.81);
  assert.equal(scorecard.baselines.week.n, 960);
  assert.equal(scorecard.baselines.week.positive_rate_pct, 58.23);
  assert.deepEqual(scorecard.summary.session_verdicts, { no_information: 25 });
  assert.deepEqual(scorecard.summary.week_verdicts, { no_information: 24, unstable_across_years: 1 });
  assert.equal(scorecard.summary.states_right_side_of_their_own_drift + scorecard.summary.states_wrong_side_of_their_own_drift, 25);
  assert.equal(scorecard.summary.rows_declared + scorecard.summary.rows_interpreted, 25);
});

test('all ten factors are published, including the three this archive cannot read', () => {
  assert.equal(scorecard.factors.length, 10);
  assert.equal(scorecard.factors.reduce((sum, factor) => sum + factor.weight, 0), 100);
  assert.deepEqual(scorecard.factors.filter(factor => !factor.testable).map(factor => factor.key), ['F6', 'F7', 'F10']);
  assert.equal(scorecard.coverage.factors_scored, 7);
  assert.ok(scorecard.blocked.length > 0);
  for (const entry of scorecard.blocked) assert.ok(entry.reason && entry.reason_note, `${entry.variable} must carry a reason and a note`);
});

test('the page states its limits, its evidence and what would change the answer', () => {
  assert.ok(scorecard.limits.length >= 5);
  assert.match(scorecard.limits.join(' '), /already-consumed|describes this space/);
  assert.ok(scorecard.what_would_change_it.some(line => line.includes('2027-03-25T15:00:00Z')));
  assert.equal(scorecard.sources.length, 4);
  for (const source of scorecard.sources) assert.ok(source.path && (source.sha256 === null || /^[0-9a-f]{64}$/.test(source.sha256)));
  assert.equal(scorecard.expectations_source.written_after_report_acceptance, true);
});

test('the shaping library refuses a drifted report, a drifted check and a broken registry', () => {
  assert.throws(() => shape(syntheticCheck(), syntheticRegistry(), syntheticReport({ observation_counts: { daily_anchors: 966, event_rows: 5115 } })), /Daily anchor count drifted/);
  assert.throws(() => shape(syntheticCheck(), syntheticRegistry(), syntheticReport({ inventory: { declared_variables: 27 } })), /must declare 28 measured variables/);
  assert.throws(() => shape(syntheticCheck({ rows: syntheticCheck().rows.slice(0, 24) })), /Scored row count drifted/);
  assert.throws(() => shape(syntheticCheck({ unscored: syntheticCheck().unscored.slice(0, 25) })), /Unscored state count drifted/);
  const weakRegistry = syntheticRegistry();
  weakRegistry.factors[0].weight = 12;
  assert.throws(() => shape(syntheticCheck(), weakRegistry), /weights must sum to 100/);
  const weakBaselines = syntheticCheck();
  weakBaselines.baselines.h24_post_event.n = 963;
  assert.throws(() => shape(weakBaselines), /session baseline must hold 964/);
});

test('a neutral state is separated from a state with no declared direction', () => {
  const check = syntheticCheck();
  check.unscored[0] = { ...check.unscored[0], reason: null, expectation: 'NEUTRAL', provenance: 'declared' };
  const shaped = shape(check);
  assert.equal(shaped.neutral_states.length, 1);
  assert.equal(shaped.unscored.length, EXPECTED.unscored_states - 1);
  assert.equal(shaped.neutral_states[0].reason, 'neutral_declared');
});

test('a horizon block without a benchmark is refused rather than rendered', () => {
  const check = syntheticCheck();
  check.rows[0] = { ...check.rows[0], session: { ...BLOCK, benchmark_pct: undefined } };
  assert.throws(() => shape(check), /needs the drift benchmark/);
});

function shape(check = syntheticCheck(), registry = syntheticRegistry(), report = syntheticReport()) {
  return shapeDirectionScorecard({ check, registry, report, hashes: syntheticHashes() });
}
