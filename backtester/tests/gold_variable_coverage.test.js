const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  CHECK_STATUSES,
  IMPLEMENTED_MACRO_SERIES,
  REQUIRED_HORIZON_IDS,
  buildCoverageAudit,
  changeObservationCount,
  checkResult,
  loadRegistry,
  priorObservationCount,
  priorObservationCountInclusive,
  readEventDirectory,
  readFredDirectory,
  readHourlyDirectory,
  renderMarkdown,
  validateRegistry,
  weekdayAnchors
} = require('../lib/gold_variable_coverage');
const { SERIES } = require('../lib/gold_macro_vintage_dataset');
const { GOLD_VARIABLES } = require('../lib/gold_source_readiness');
const {
  OUTPUT_FILES,
  assertOutputWritable,
  resolveSourceArgument,
  run: runCli
} = require('../scripts/audit_gold_variable_coverage');

const FIXTURES = path.resolve(__dirname, 'fixtures/gold-variable-coverage');
const FRED_FIXTURE = path.join(FIXTURES, 'fred');
const HOURLY_FIXTURE = path.join(FIXTURES, 'hourly');
const EVENTS_FIXTURE = path.join(FIXTURES, 'events');
const REGISTRY_PATH = path.resolve(__dirname, '../registries/gold_variable_horizon_context.v1.json');
const FIXED_NOW = '2026-09-19T00:00:00.000Z';

function auditFixtures(overrides = {}) {
  return buildCoverageAudit({
    registryPath: REGISTRY_PATH,
    fredDirectory: overrides.fredDirectory === undefined ? FRED_FIXTURE : overrides.fredDirectory,
    hourlyDirectory: overrides.hourlyDirectory === undefined ? HOURLY_FIXTURE : overrides.hourlyDirectory,
    eventsDirectory: overrides.eventsDirectory === undefined ? EVENTS_FIXTURE : overrides.eventsDirectory,
    outputDirectory: overrides.outputDirectory ?? null,
    command: overrides.command ?? 'gold_variable_coverage.test.js',
    now: FIXED_NOW
  });
}

function horizonOf(report, id, cohort) {
  return report.horizons.find(row => row.horizon_id === id && row.anchor_cohort === cohort);
}
function checkOf(owner, id) {
  return owner.checks.find(check => check.id === id);
}
function variableOf(report, id) {
  return report.variables.find(variable => variable.id === id);
}
function contextOf(report, id, cohort) {
  return report.prior_context.find(field => field.field_id === id && field.anchor_cohort === cohort);
}
function makeFixtureDirectory(files) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gold-variable-coverage-'));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(directory, name), typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`);
  }
  return directory;
}

test('registry declares exactly the existing 28-variable inventory, in order', () => {
  const { registry } = loadRegistry(REGISTRY_PATH);
  assert.equal(registry.variables.length, 28);
  assert.equal(GOLD_VARIABLES.length, 28);
  assert.deepEqual(registry.variables.map(variable => variable.id), [...GOLD_VARIABLES]);
  registry.variables.forEach((variable, index) => {
    assert.equal(variable.declared_inventory_index, index + 1);
    assert.ok(Array.isArray(variable.known_gaps));
  });
});

test('registry declares the five required horizons and marks unsupported ones explicitly', () => {
  const { registry } = loadRegistry(REGISTRY_PATH);
  assert.deepEqual(registry.horizons.map(row => row.id), [...REQUIRED_HORIZON_IDS]);
  const immediate = registry.horizons.find(row => row.id === 'immediate_event_window');
  assert.equal(immediate.end_offset.kind, 'sub_hourly_offset');
  assert.equal(immediate.end_offset.elapsed_ms, null);
  assert.equal(immediate.audit_status, 'unsupported_by_local_resolution');
  const fiveDay = registry.horizons.find(row => row.id === 'd5_trading_days_post_event');
  assert.equal(fiveDay.end_offset.kind, 'trading_day_offset');
  assert.equal(fiveDay.end_offset.elapsed_ms, null);
  assert.equal(fiveDay.end_offset.trading_days, 5);
  assert.equal(fiveDay.audit_status, 'pending_session_calendar_policy');
  const h24 = registry.horizons.find(row => row.id === 'h24_post_event');
  assert.equal(h24.end_offset.elapsed_ms, 86400000);
  assert.equal(h24.session_policy, 'none_declared_elapsed_clock');
});

test('every prior-context field requires a strictly-before cutoff and a leakage guard', () => {
  const { registry } = loadRegistry(REGISTRY_PATH);
  assert.ok(registry.prior_context.length >= 8);
  for (const field of registry.prior_context) {
    assert.equal(field.cutoff_rule, 'strictly_before_observation_time', field.id);
    assert.ok(field.leakage_guard.length > 20, field.id);
  }
  const classes = new Set(registry.prior_context.map(field => field.class));
  assert.ok(classes.has('price_trend'));
  assert.ok(classes.has('macro'));
  assert.ok(classes.has('macro_event'));
  assert.ok(registry.forbidden_context.some(field => field.id === 'same_week_realized_direction'));
});

test('declared transformation aliases agree with the implemented macro feature names', () => {
  assert.deepEqual({ ...IMPLEMENTED_MACRO_SERIES }, { ...SERIES });
  const { registry } = loadRegistry(REGISTRY_PATH);
  assert.deepEqual(registry.derived_name_aliases.map, {
    us_10y_real_yield_d5_bps: 'us_10y_real_yield_change_5_bps',
    us_10y_real_yield_d20_bps: 'us_10y_real_yield_change_20_bps',
    us_2y_d5_bps: 'us_2y_yield_change_5_bps',
    us_2y_d20_bps: 'us_2y_yield_change_20_bps',
    vix_d1: 'vix_level_change_1_pct',
    vix_d5: 'vix_level_change_5_pct'
  });
  assert.deepEqual([...registry.derived_name_aliases.declared_without_implementation].sort(),
    ['dxy_d1', 'dxy_d20', 'dxy_d5', 'gold_d1_pct', 'gold_d20_pct', 'gold_d5_pct'].sort());
});

test('registry validation rejects an incomplete, misindexed or relaxed declaration', () => {
  const { registry } = loadRegistry(REGISTRY_PATH);
  const clone = () => JSON.parse(JSON.stringify(registry));
  assert.equal(validateRegistry(clone()).version, registry.version);

  const dropped = clone();
  dropped.variables.pop();
  assert.throws(() => validateRegistry(dropped), /Registry must declare all 28 inventory variables/);

  const substituted = clone();
  substituted.variables[0].id = 'us_10y_real_yield_typo';
  assert.throws(() => validateRegistry(substituted), /must match the declared inventory exactly/);

  const misindexed = clone();
  misindexed.variables[3].declared_inventory_index = 99;
  assert.throws(() => validateRegistry(misindexed), /inconsistent declared_inventory_index/);

  const badHorizon = clone();
  badHorizon.variables[0].horizons = ['not_a_horizon'];
  assert.throws(() => validateRegistry(badHorizon), /references undeclared horizon/);

  const relaxed = clone();
  relaxed.prior_context[2].cutoff_rule = 'at_or_before_observation_time';
  assert.throws(() => validateRegistry(relaxed), /strictly-before cutoff rule/);

  const badStatus = clone();
  badStatus.variables[0].source_mapping.status = 'definitely_available';
  assert.throws(() => validateRegistry(badStatus), /undeclared coverage status/);

  const badAlias = clone();
  badAlias.derived_name_aliases.map.unknown_variable_id = 'x';
  assert.throws(() => validateRegistry(badAlias), /is not a declared variable/);

  const missingHorizon = clone();
  missingHorizon.horizons = missingHorizon.horizons.filter(row => row.id !== 'h4_post_event');
  missingHorizon.variables.forEach(variable => {
    variable.horizons = variable.horizons.filter(id => id !== 'h4_post_event');
  });
  assert.throws(() => validateRegistry(missingHorizon), /must declare the required horizon h4_post_event/);
});

test('a check can never be reported as passed without supporting evidence', () => {
  assert.deepEqual(CHECK_STATUSES, ['passed', 'failed', 'unknown', 'not_applicable']);
  const downgraded = checkResult('demo', 'passed', { reason: 'unsupported' });
  assert.equal(downgraded.status, 'unknown');
  assert.equal(downgraded.reason, 'no_supporting_evidence');
  assert.equal(downgraded.downgraded_from, 'passed');
  assert.equal(checkResult('demo', 'passed', { source_present: true }).status, 'passed');
  assert.equal(checkResult('demo', 'failed', { source_present: false }).status, 'failed');
  assert.throws(() => checkResult('demo', 'mostly_fine', {}), /Unknown check status/);
});

test('FRED reader counts missing values, revisions and invalid rows without coercing them', () => {
  const fred = readFredDirectory(FRED_FIXTURE);
  const dfii = fred.series_meta.DFII10;
  assert.equal(dfii.raw_observation_rows, 8);
  assert.equal(dfii.usable_rows, 8);
  assert.equal(dfii.observation_dates, 7);
  assert.equal(dfii.missing_values, 1);
  assert.equal(dfii.revision_rows, 1);
  assert.equal(dfii.invalid_rows, 0);
  assert.equal(dfii.availability_lag_hours, 36);
  assert.equal(dfii.first_observation_date, '2024-01-01');
  assert.equal(dfii.last_observation_date, '2024-01-09');
  assert.equal(fred.series_meta.DGS2.observation_dates, 40);

  const broken = makeFixtureDirectory({
    'DFII10.json': {
      series_id: 'DFII10',
      observations: [
        { date: '2024-02-30', realtime_start: '2024-03-01', value: '1' },
        { date: '2024-03-01', realtime_start: '2024-02-01', value: '1' },
        { date: '2024-03-04', realtime_start: '2024-03-05', value: 'not-a-number' },
        { date: '2024-03-05', realtime_start: '2024-03-06', value: '2' }
      ]
    }
  });
  const malformed = readFredDirectory(broken).series_meta.DFII10;
  assert.equal(malformed.raw_observation_rows, 4);
  assert.equal(malformed.invalid_rows, 2);
  assert.equal(malformed.invalid_observation_dates, 1);
  assert.equal(malformed.usable_rows, 2);
});

test('prior observation selection excludes a value whose availability equals the cutoff', () => {
  const dfii = readFredDirectory(FRED_FIXTURE).series_index.DFII10;
  // First usable publication instants: 2024-01-01 -> 2024-01-03T12:00Z, 01-02 -> 01-04T12:00Z,
  // 01-04 -> 01-06T12:00Z, 01-05 -> 01-09T12:00Z, 01-08 -> 01-10T12:00Z, 01-09 -> 01-11T12:00Z.
  // The 2024-01-03 observation is published only as a withdrawal, so it never counts.
  const boundaries = [
    ['2024-01-03T11:59:59Z', 0, 0],
    ['2024-01-03T12:00:00Z', 0, 1],
    ['2024-01-03T12:00:00.001Z', 1, 1],
    ['2024-01-04T12:00:00Z', 1, 2],
    ['2024-01-06T12:00:00Z', 2, 3],
    ['2024-01-09T12:01:00Z', 4, 4],
    ['2024-05-01T00:00:00Z', 6, 6]
  ];
  for (const [cutoff, strict, inclusive] of boundaries) {
    assert.equal(priorObservationCount(dfii, Date.parse(cutoff)), strict, `strict at ${cutoff}`);
    assert.equal(priorObservationCountInclusive(dfii, Date.parse(cutoff)), inclusive, `inclusive at ${cutoff}`);
  }
  assert.equal(changeObservationCount(dfii, 5, Date.parse('2024-01-06T12:00:00Z')), 0);
  assert.equal(changeObservationCount(dfii, 2, Date.parse('2024-01-09T12:01:00Z')), 2);
});

test('hourly reader separates unusable rows from gaps and duplicates', () => {
  const hourly = readHourlyDirectory(HOURLY_FIXTURE);
  const meta = hourly.meta;
  assert.equal(meta.instrument, 'XAU_USD');
  assert.equal(meta.granularity, 'H1');
  assert.equal(meta.raw_candle_rows, 121);
  assert.equal(meta.usable_candle_rows, 119);
  assert.equal(meta.incomplete_flag_rows, 1);
  assert.equal(meta.invalid_time_rows, 1);
  assert.equal(meta.duplicate_open_times, 1);
  assert.equal(meta.intra_span_gaps_over_one_hour, 1);
  assert.equal(meta.largest_gap_hours, 2);
  assert.equal(meta.gaps_crossing_weekend_boundary, 0);
  assert.equal(meta.first_open_time, '2024-01-01T00:00:00.000Z');
  assert.equal(meta.last_open_time, '2024-01-05T23:00:00.000Z');
});

test('weekday anchors are the five hand-counted 14:00Z boundaries of the fixture', () => {
  const anchors = weekdayAnchors(readHourlyDirectory(HOURLY_FIXTURE).meta, 14);
  assert.deepEqual(anchors.map(time => new Date(time).toISOString()), [
    '2024-01-01T14:00:00.000Z',
    '2024-01-02T14:00:00.000Z',
    '2024-01-03T14:00:00.000Z',
    '2024-01-04T14:00:00.000Z',
    '2024-01-05T14:00:00.000Z'
  ]);
});


test('horizon endpoint and continuity counts match the hand-counted fixture geometry', () => {
  const report = auditFixtures();
  const h1 = checkOf(horizonOf(report, 'h1_post_event', 'daily_snapshot_anchors'), 'anchor_to_candle_alignment');
  assert.deepEqual(h1.counts, {
    anchors_total: 5, outside_coverage_window: 0, entry_candle_exact: 5, endpoint_candle_exact: 4,
    both_exact: 4, both_exact_and_contiguous: 4, both_exact_with_gaps: 0, entry_missing: 0, endpoint_missing: 1,
    matching_rule: 'exact_candle_open_time_equality'
  });
  const h4 = checkOf(horizonOf(report, 'h4_post_event', 'daily_snapshot_anchors'), 'anchor_to_candle_alignment');
  assert.deepEqual([h4.counts.anchors_total, h4.counts.both_exact, h4.counts.both_exact_and_contiguous, h4.counts.both_exact_with_gaps],
    [5, 4, 3, 1]);
  const h24 = checkOf(horizonOf(report, 'h24_post_event', 'daily_snapshot_anchors'), 'anchor_to_candle_alignment');
  assert.deepEqual([h24.counts.anchors_total, h24.counts.outside_coverage_window, h24.counts.entry_candle_exact,
    h24.counts.endpoint_candle_exact, h24.counts.both_exact, h24.counts.both_exact_and_contiguous, h24.counts.both_exact_with_gaps],
    [5, 1, 4, 4, 4, 2, 2], 'the Saturday endpoint falls outside coverage; two windows contain the omitted or incomplete bar');

  const h24Continuity = checkOf(horizonOf(report, 'h24_post_event', 'daily_snapshot_anchors'), 'continuity_between_entry_and_endpoint');
  assert.equal(h24Continuity.status, 'failed');
  assert.equal(h24Continuity.reason, 'gapped_or_missing_bars_between_endpoints');
  assert.equal(checkOf(horizonOf(report, 'h24_post_event', 'daily_snapshot_anchors'), 'endpoint_available_for_every_in_window_anchor').status, 'passed');
  const h1Endpoint = checkOf(horizonOf(report, 'h1_post_event', 'daily_snapshot_anchors'), 'endpoint_available_for_every_in_window_anchor');
  assert.equal(h1Endpoint.status, 'failed');
  assert.equal(h1Endpoint.reason, 'endpoint_not_available_for_some_anchors');
});

test('event cohort is audited separately and exposes the release-to-candle alignment gap', () => {
  const report = auditFixtures();
  assert.equal(report.daily_snapshot_audit.anchor_count, 5);
  assert.equal(report.event_release_audit.anchor_count, 9);
  const h1 = checkOf(horizonOf(report, 'h1_post_event', 'event_releases'), 'anchor_to_candle_alignment');
  assert.deepEqual([h1.counts.anchors_total, h1.counts.outside_coverage_window, h1.counts.entry_candle_exact, h1.counts.endpoint_candle_exact],
    [9, 2, 1, 1], 'only the 15:00Z release coincides with an hourly boundary');
  const h4 = checkOf(horizonOf(report, 'h4_post_event', 'event_releases'), 'anchor_to_candle_alignment');
  assert.deepEqual([h4.counts.anchors_total, h4.counts.outside_coverage_window, h4.counts.both_exact, h4.counts.both_exact_and_contiguous],
    [9, 2, 1, 1]);
  const h24 = checkOf(horizonOf(report, 'h24_post_event', 'event_releases'), 'anchor_to_candle_alignment');
  assert.deepEqual([h24.counts.anchors_total, h24.counts.outside_coverage_window, h24.counts.both_exact], [9, 3, 1]);
  assert.equal(horizonOf(report, 'h1_post_event', 'event_releases').registry_audit_status, 'pending_anchor_to_candle_alignment_policy');
});

test('unsupported and unresolved horizons are never reported as passed or measured', () => {
  const report = auditFixtures();
  const immediate = horizonOf(report, 'immediate_event_window', 'event_releases');
  const resolution = checkOf(immediate, 'resolution_supports_horizon');
  assert.equal(resolution.status, 'not_applicable');
  assert.equal(resolution.reason, 'sub_hourly_window_not_measurable_from_h1_bars');
  assert.equal(resolution.invented_offsets, 0);
  assert.equal(report.horizons.some(row => row.horizon_id === 'immediate_event_window' && row.checks.some(check => check.counts)),
    false, 'no sub-hourly endpoint counts may be produced from hourly bars');
  assert.equal(immediate.checks.some(check => check.status === 'passed'), false);
  for (const cohort of ['daily_snapshot_anchors', 'event_releases']) {
    const fiveDay = checkOf(horizonOf(report, 'd5_trading_days_post_event', cohort), 'session_calendar_declared');
    assert.equal(fiveDay.status, 'unknown');
    assert.equal(fiveDay.reason, 'session_calendar_policy_pending');
  }
});

test('prior-context coverage separates unmeasurable, insufficient and covered fields', () => {
  const report = auditFixtures();

  const priceTrend = contextOf(report, 'gold_trailing_5d_return_pct', 'daily_snapshot_anchors');
  assert.equal(checkOf(priceTrend, 'prior_context_measurable').status, 'unknown');
  assert.equal(checkOf(priceTrend, 'prior_context_measurable').reason, 'session_calendar_or_estimator_policy_pending');

  const shortHistory = contextOf(report, 'us_10y_real_yield_prior_5obs_change_bps', 'daily_snapshot_anchors');
  const shortCheck = checkOf(shortHistory, 'prior_context_measurable');
  assert.equal(shortCheck.status, 'failed');
  assert.equal(shortCheck.reason, 'no_anchor_has_enough_prior_observations');
  assert.equal(shortCheck.covered_anchors, 0);
  assert.equal(shortCheck.anchors, 5);
  assert.equal(shortCheck.insufficient_history_anchors, 5);
  assert.equal(shortCheck.lookback_basis, 'observation_index_based_not_calendar_trading_days');

  const sufficient = contextOf(report, 'us_2y_yield_prior_5obs_change_bps', 'daily_snapshot_anchors');
  assert.equal(checkOf(sufficient, 'prior_context_measurable').status, 'passed');
  assert.equal(checkOf(sufficient, 'prior_context_measurable').covered_anchors, 5);
  assert.equal(contextOf(report, 'us_2y_yield_prior_5obs_change_bps', 'event_releases').checks[0].covered_anchors, 9);

  for (const field of ['us_10y_yield_prior_5obs_change_bps', 'broad_usd_index_prior_5obs_change_pct']) {
    const missingSeries = checkOf(contextOf(report, field, 'daily_snapshot_anchors'), 'prior_context_measurable');
    assert.equal(missingSeries.status, 'unknown', field);
    assert.equal(missingSeries.reason, 'source_not_supplied', field);
  }

  const eventDaily = checkOf(contextOf(report, 'recent_event_surprise_state', 'daily_snapshot_anchors'), 'prior_context_measurable');
  assert.equal(eventDaily.status, 'passed');
  assert.equal(eventDaily.covered_anchors, 4);
  assert.equal(eventDaily.anchors_before_first_release, 1);
  const eventCohort = checkOf(contextOf(report, 'hours_since_last_release', 'event_releases'), 'prior_context_measurable');
  assert.equal(eventCohort.covered_anchors, 6);
  assert.equal(eventCohort.anchors_before_first_release, 3);
  assert.equal(eventCohort.strictness, 'A release exactly at the cutoff is excluded.');
});

test('every prior-context field refuses to claim an authenticated release time', () => {
  const report = auditFixtures();
  const checks = report.prior_context.flatMap(field => field.checks);
  assert.ok(checks.some(check => check.id === 'authenticated_observation_timing' && check.status === 'unknown'));
  assert.ok(checks.some(check => check.id === 'authenticated_consensus_vintage' && check.status === 'unknown'));
  assert.equal(checks.filter(check => check.id.startsWith('authenticated_') && check.status === 'passed').length, 0);
});

test('event release audit reconciles rows, duplicates and overlap flags without dropping data', () => {
  const events = readEventDirectory(EVENTS_FIXTURE);
  const meta = events.meta;
  assert.equal(meta.raw_rows, 10);
  assert.equal(meta.usable_release_rows, 9);
  assert.equal(meta.invalid_release_time_rows, 1);
  assert.equal(meta.raw_rows, meta.usable_release_rows + meta.invalid_release_time_rows);
  assert.equal(meta.unique_release_rows, 8);
  assert.equal(meta.duplicate_rows_under_primary_key, 1);
  assert.equal(meta.usable_release_rows, meta.unique_release_rows + meta.duplicate_rows_under_primary_key);
  assert.equal(meta.overlapping_groups_under_overlap_key, 1);
  assert.equal(meta.missing_actual, 2);
  assert.equal(meta.missing_consensus, 2);
  assert.equal(meta.missing_previous, 5);
  assert.equal(meta.revision_present_in_archive, 1);
  assert.equal(meta.missing_last_updated, 6);
  assert.equal(meta.invalid_last_updated, 0);
  assert.equal(meta.all_day_rows, 1);
  assert.equal(meta.unusable_for_event_study, 4);
  assert.equal(meta.event_family_count, 7);
  assert.deepEqual(meta.country_counts, { CA: 1, US: 8 });
  assert.deepEqual(meta.impact_counts, { HIGH: 5, MEDIUM: 3, ZERO: 1 });
  assert.ok(meta.overlap_flag_counts.revision_present_in_archive >= 1);
  assert.ok(meta.overlap_flag_counts.non_us_event >= 1);
  assert.ok(meta.overlap_flag_counts.all_day_event >= 1);
  assert.match(meta.release_time_basis, /never used as a release or consensus vintage/);
  assert.equal(meta.dedup_policy.primary_key, 'eventId|dateUtc|name');

  const duplicateReleases = checkOf(variableOf(auditFixtures(), 'event_type'), 'duplicate_release_rows');
  assert.equal(duplicateReleases.status, 'failed');
  assert.equal(duplicateReleases.reason, 'duplicate_release_under_declared_primary_key');
  assert.equal(duplicateReleases.duplicate_rows, 1);
  assert.equal(duplicateReleases.unique_release_rows, 8);
});

test('event variables report field-level missing values and unverifiable provenance', () => {
  const report = auditFixtures();
  assert.equal(checkOf(variableOf(report, 'event_actual'), 'actual_value_present').failing_rows, 2);
  assert.equal(checkOf(variableOf(report, 'event_consensus'), 'consensus_value_present').failing_rows, 2);
  assert.equal(checkOf(variableOf(report, 'event_previous_as_released'), 'archive_previous_value_present').failing_rows, 5);
  assert.equal(checkOf(variableOf(report, 'event_surprise'), 'actual_and_consensus_present').failing_rows, 4);
  assert.equal(checkOf(variableOf(report, 'event_surprise'), 'archive_surprise_fields_documented').status, 'unknown');
  assert.equal(checkOf(variableOf(report, 'event_consensus'), 'pre_release_consensus_vintage').status, 'unknown');
  assert.equal(checkOf(variableOf(report, 'event_previous_as_released'), 'as_released_previous_history').status, 'unknown');
  assert.equal(checkOf(variableOf(report, 'event_age_hours'), 'release_timestamp_quality').failing_rows, 1);
  assert.equal(
    variableOf(report, 'event_age_hours').checks.filter(check => check.status === 'failed').map(check => check.id).join(','),
    'release_timestamp_quality'
  );
});

test('variable audit distinguishes verified, unmapped and unavailable declarations', () => {
  const report = auditFixtures();
  assert.deepEqual(report.reconciliation.variables_by_source_backing, {
    derived_macro: 6, event_calendar: 6, fred_series: 3, hourly_candles: 1, none: 6, unmapped_transformation: 6
  });
  assert.equal(report.reconciliation.variables_with_verified_local_source, 13,
    'VIXCLS, DGS10 and DTWEXBGS are intentionally absent from the FRED fixture, so their variables stay unsupported');

  assert.equal(checkOf(variableOf(report, 'us_10y_real_yield'), 'timestamp_quality').status, 'passed');
  assert.equal(checkOf(variableOf(report, 'us_10y_real_yield'), 'revision_rows_retained_separately').revision_rows, 1);
  const vix = checkOf(variableOf(report, 'vix_level'), 'local_source_present');
  assert.equal(vix.status, 'unknown');
  assert.equal(vix.reason, 'series_not_found_in_supplied_source');

  const unmapped = checkOf(variableOf(report, 'gold_d5_pct'), 'transformation_implemented');
  assert.equal(unmapped.status, 'unknown');
  assert.equal(unmapped.reason, 'declared_transformation_has_no_local_implementation');
  assert.equal(checkOf(variableOf(report, 'vix_d5'), 'transformation_implemented').implemented_name, 'vix_level_change_5_pct');
  const derivedShort = checkOf(variableOf(report, 'us_10y_real_yield_d5_bps'), 'derived_values_available');
  assert.equal(derivedShort.status, 'failed');
  assert.equal(derivedShort.reason, 'insufficient_source_history_for_lookback');
  assert.equal(checkOf(variableOf(report, 'us_2y_d5_bps'), 'derived_values_available').anchors_with_usable_change, 5);

  assert.equal(variableOf(report, 'fed_bias').registry_coverage_status, 'unavailable_no_local_source');
  assert.equal(checkOf(variableOf(report, 'fed_bias'), 'local_source_present').status, 'unknown');
  assert.equal(checkOf(variableOf(report, 'fed_bias'), 'local_source_present').reason, 'source_not_available_locally');

  assert.equal(checkOf(variableOf(report, 'gold_price'), 'continuity').status, 'failed');
  assert.equal(checkOf(variableOf(report, 'gold_price'), 'session_calendar_declared').status, 'unknown');
  assert.equal(checkOf(variableOf(report, 'gold_price'), 'authenticated_publication_timing').status, 'passed');
  assert.equal(checkOf(variableOf(report, 'us_10y_real_yield'), 'authenticated_publication_timing').status, 'unknown');
  assert.equal(checkOf(variableOf(report, 'us_10y_real_yield'), 'authenticated_publication_timing').reason, 'authenticated_timing_unavailable');

  const goldTransforms = variableOf(report, 'gold_price').checks.find(check => check.id === 'declared_transformations_resolvable');
  assert.equal(goldTransforms.status, 'unknown');
  assert.equal(goldTransforms.resolvable_count, 0);
  const vixTransforms = variableOf(report, 'vix_level').checks.find(check => check.id === 'declared_transformations_resolvable');
  assert.equal(vixTransforms.status, 'unknown');
  assert.equal(vixTransforms.downgraded_from, 'passed', 'a resolvable transformation still cannot pass without the backing series');
  assert.equal(vixTransforms.resolvable_count, 2);
});

test('an absent source can never yield a passed check or a populated denominator', () => {
  const report = buildCoverageAudit({
    registryPath: REGISTRY_PATH, fredDirectory: null, hourlyDirectory: null, eventsDirectory: null,
    command: 'absent-source test', now: FIXED_NOW
  });
  assert.deepEqual(report.sources_supplied, { fred: false, hourly: false, events: false });
  assert.equal(report.reconciliation.checks_by_status.passed, undefined);
  assert.equal(report.reconciliation.variables_with_verified_local_source, 0);
  assert.equal(report.event_release_audit.status, 'unknown');
  assert.equal(report.daily_snapshot_audit.status, 'unknown');
  assert.equal(report.reconciliation.variables_by_coverage_status.unavailable_no_local_source, 9);
  assert.equal(report.horizons.every(row => row.checks.every(check => check.status !== 'passed')), true);
  assert.equal(report.prior_context.every(field => field.checks.every(check => check.status !== 'passed')), true);
  assert.ok(report.exclusion_reasons.source_not_supplied > 0);
});

test('denominators reconcile for the fixture run', () => {
  const report = auditFixtures();
  const statusSum = Object.values(report.reconciliation.variables_by_coverage_status).reduce((a, b) => a + b, 0);
  assert.equal(statusSum, report.reconciliation.declared_inventory_total);
  assert.equal(report.reconciliation.declared_inventory_total, 28);
  assert.equal(report.registry_summary.declared_inventory_count, report.variables.length);
  const backingSum = Object.values(report.reconciliation.variables_by_source_backing).reduce((a, b) => a + b, 0);
  assert.equal(backingSum, 28);
  const checkSum = Object.values(report.reconciliation.checks_by_status).reduce((a, b) => a + b, 0);
  assert.equal(checkSum, report.reconciliation.checks_total);
  const events = report.reconciliation.event_rows_reconcile;
  assert.equal(events.unique_plus_duplicates, events.usable_release_rows);
  assert.equal(events.raw_minus_usable, events.invalid_release_time_rows);
  assert.match(events.policy.overlap_key_meaning, /flagged as overlapping rather than dropped/);
  assert.equal(report.reconciliation.daily_anchor_reconcile.anchor_count, 5);
  assert.equal(report.reconciliation.daily_anchor_reconcile.event_anchor_count, 9);
});

test('output is deterministic for identical inputs and changes when the inputs change', () => {
  const first = auditFixtures();
  const second = auditFixtures({ command: 'a different command string', outputDirectory: 'C:/elsewhere' });
  assert.equal(first.content_sha256, second.content_sha256);
  assert.equal(first.run.generated_at, FIXED_NOW);
  assert.equal(first.run.registry_sha256, second.run.registry_sha256);

  const emptyEvents = makeFixtureDirectory({ 'events.json': [] });
  const changed = auditFixtures({ eventsDirectory: emptyEvents });
  assert.notEqual(first.content_sha256, changed.content_sha256);
  assert.equal(changed.event_release_audit.anchor_count, 0);
  assert.equal(changed.reconciliation.daily_anchor_reconcile.event_anchor_count, 0);
});

test('markdown report states its limits and carries the same content hash', () => {
  const report = auditFixtures();
  const markdown = renderMarkdown(report);
  assert.match(markdown, new RegExp(report.content_sha256));
  assert.match(markdown, /Live-call qualification is NOT established/);
  assert.match(markdown, /## Horizon availability by anchor cohort/);
  assert.match(markdown, /Event releases and daily snapshot anchors are separate cohorts and are never summed/);
  const absentSource = buildCoverageAudit({
    registryPath: REGISTRY_PATH, fredDirectory: FRED_FIXTURE, hourlyDirectory: null, eventsDirectory: null,
    command: 'absent source markdown', now: FIXED_NOW
  });
  assert.match(renderMarkdown(absentSource), /not supplied \(source_not_supplied\)/);
  assert.match(markdown, /## Unknown and failed reasons/);
  assert.match(markdown, /## Unresolved policies/);
  assert.match(markdown, /## Proposed next actions/);
  assert.ok(markdown.endsWith('\n'));
});

test('CLI refuses to overwrite, writes both artifacts and matches the library hash', () => {
  assert.equal(resolveSourceArgument('none'), null);
  assert.equal(resolveSourceArgument('NONE'), null);
  assert.equal(resolveSourceArgument(undefined), null);
  assert.ok(resolveSourceArgument('backtester/tmp').endsWith(path.join('backtester', 'tmp')));
  assert.deepEqual(OUTPUT_FILES, ['coverage.json', 'COVERAGE.md']);

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gold-variable-coverage-cli-'));
  const report = runCli([FRED_FIXTURE, HOURLY_FIXTURE, EVENTS_FIXTURE, directory, REGISTRY_PATH]);
  const jsonPath = path.join(directory, 'coverage.json');
  const markdownPath = path.join(directory, 'COVERAGE.md');
  assert.equal(fs.existsSync(jsonPath), true);
  assert.equal(fs.existsSync(markdownPath), true);
  const written = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  assert.equal(written.content_sha256, report.content_sha256);
  const expected = buildCoverageAudit({
    registryPath: REGISTRY_PATH, fredDirectory: FRED_FIXTURE, hourlyDirectory: HOURLY_FIXTURE,
    eventsDirectory: EVENTS_FIXTURE, now: report.run.generated_at, command: 'library comparison'
  });
  assert.equal(written.content_sha256, expected.content_sha256);
  assert.match(fs.readFileSync(markdownPath, 'utf8'), /Gold variable, horizon and prior-context coverage audit/);
  assert.throws(() => assertOutputWritable(directory), /Refusing to overwrite completed report files/);
  assert.throws(() => runCli([FRED_FIXTURE, HOURLY_FIXTURE, EVENTS_FIXTURE, directory, REGISTRY_PATH]),
    /Refusing to overwrite completed report files/);
  assert.throws(() => runCli(['a', 'b', 'c']), /Usage: node backtester\/scripts\/audit_gold_variable_coverage\.js/);

  const noneDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'gold-variable-coverage-cli-none-'));
  const partial = runCli([FRED_FIXTURE, 'none', 'none', noneDirectory, REGISTRY_PATH]);
  assert.deepEqual(partial.sources_supplied, { fred: true, hourly: false, events: false });
  assert.equal(partial.horizons.every(row => row.checks.every(check => check.status !== 'passed')), true);
  assert.equal(partial.event_release_audit.reason, 'source_not_supplied');
});

test('the audit reports no relationship, accuracy or trading result', () => {
  const report = auditFixtures();
  assert.equal(report.research_only, true);
  assert.equal(report.executable_trade_validated, false);
  assert.equal(report.qualified_for_live_calls, false);
  const serialized = JSON.stringify(report);
  for (const forbidden of ['"accuracy"', '"win_rate"', '"pnl"', '"expectancy"', '"sharpe"']) {
    assert.equal(serialized.includes(forbidden), false, `${forbidden} must not appear in a coverage audit`);
  }
  assert.match(report.limitations.join(' '), /cannot establish that a variable is related to Gold price/);
  assert.match(report.limitations.join(' '), /exact-24-hour evaluator is unchanged/);
  assert.ok(report.next_actions.length >= 5);
  assert.ok(report.next_actions.some(action => /session calendar/.test(action)));
  assert.ok(report.next_actions.some(action => /no verified local source/.test(action)));
  assert.ok(report.next_actions.some(action => /anchor-to-candle alignment rule/.test(action)));
});

