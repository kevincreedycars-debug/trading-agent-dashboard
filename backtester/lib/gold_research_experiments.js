const { buildGoldTimestampedReport, parseTimestamp } = require('./gold_timestamped_evaluation');
const { storageTimestamp } = require('./gold_stored_call_evidence');
const { GOLD_VARIABLES } = require('./gold_source_readiness');

const DAY = 86400000;
const numeric = value => typeof value === 'number' && Number.isFinite(value) ? value :
  typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : null;
const direction = value => ({ BULLISH: 1, BULLISH_LEAN: 1, BEARISH: -1, BEARISH_LEAN: -1 })[value] || 0;

function stats(rows, expected) {
  const wins = rows.filter(row => row.sign === expected).length;
  const losses = rows.filter(row => row.sign === -expected).length;
  const flat = rows.filter(row => row.sign === 0).length;
  const n = wins + losses;
  return { observations: rows.length, directional_observations: n, correct: wins, wrong: losses, flat,
    ex_flat_accuracy_pct: n ? 100 * wins / n : null,
    accuracy_including_flat_pct: rows.length ? 100 * wins / rows.length : null,
    mean_return_pct: rows.length ? rows.reduce((sum, row) => sum + row.return_pct, 0) / rows.length : null };
}

function extractSnapshotFeatures(snapshot, decision) {
  const values = {};
  const issues = [];
  const stored = storageTimestamp(snapshot?.created_at);
  if (stored === null || stored > decision) return { values, issues: ['snapshot_storage_not_before_decision'] };
  for (const name of GOLD_VARIABLES) {
    const value = snapshot[name];
    if (value !== undefined && value !== null && value !== '' && ['string', 'number', 'boolean'].includes(typeof value)) {
      values[name] = numeric(value) ?? value;
    }
  }
  // Preserve source names for aliases; do not silently equate different regime models.
  for (const name of ['global_growth_regime', 'geopolitical_risk_flag']) {
    if (snapshot[name] != null) values[name] = snapshot[name];
  }
  const event = snapshot.latest_us_event;
  const raw = event?.raw?.raw_json;
  const released = parseTimestamp(raw?.dateUtc ?? event?.time);
  const updated = typeof raw?.lastUpdated === 'number' ? raw.lastUpdated * 1000 : null;
  if (!event) issues.push('event_missing');
  else if (released === null || released > decision) issues.push('event_release_unknown_or_future');
  else if (updated === null || !Number.isSafeInteger(updated) || updated > decision) issues.push('event_vintage_unknown_or_future');
  else {
    values.event_type = raw?.name ?? event.event;
    values.event_age_hours = (decision - released) / 3600000;
    const actual = numeric(raw?.actual ?? event.actual), consensus = numeric(raw?.consensus ?? event.forecast);
    if (actual !== null) values.event_actual = actual;
    if (consensus !== null) values.event_consensus = consensus;
    // Differences only become comparable within an event family; not a cross-event numeric score.
    if (actual !== null && consensus !== null) values.event_surprise_direction = actual > consensus ? 'above_consensus' : actual < consensus ? 'below_consensus' : 'at_consensus';
    issues.push('event_consensus_pre_release_vintage_unverified');
  }
  return { values, issues };
}

function testCondition(row, condition) {
  if (!Object.prototype.hasOwnProperty.call(row.values, condition.feature)) return null;
  const value = row.values[condition.feature];
  if (condition.operator === 'eq') return value === condition.value;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return condition.operator === 'gt' ? value > condition.value : value <= condition.value;
}

function buildExperiments(dataset, snapshots, options) {
  const split = parseTimestamp(options?.split_at);
  if (split === null || !Number.isSafeInteger(options.embargo_ms) || options.embargo_ms < 0) throw new Error('Explicit split and embargo required');
  if (!Number.isInteger(options.minimum_training_samples) || options.minimum_training_samples < 1) throw new Error('minimum_training_samples required');
  const byId = new Map();
  for (const snapshot of snapshots) {
    if (!snapshot?.id || byId.has(snapshot.id)) throw new Error('Unique snapshot IDs required');
    byId.set(snapshot.id, snapshot);
  }
  const strict = buildGoldTimestampedReport({ ...dataset, config: { ...dataset.config, coverage_policy: 'contiguous' } });
  const endpoint = buildGoldTimestampedReport({ ...dataset, config: { ...dataset.config, coverage_policy: 'exact_endpoints' } });
  // Freeze source schedule before inspecting availability/outcomes; rejected decisions reserve their window.
  const source = dataset.calls.map((call, index) => ({ call, index, time: parseTimestamp(call.call_time) }));
  const ordered = source.filter(row => row.time !== null).sort((a, b) => a.time - b.time || a.index - b.index);
  let occupiedUntil = -Infinity;
  const selected = new Set();
  const dates = new Set();
  for (const row of ordered) {
    const date = new Date(row.time).toISOString().slice(0, 10);
    if (dates.has(date)) continue;
    dates.add(date);
    const entry = parseTimestamp(row.call.entry_time ?? row.call.call_time);
    const end = parseTimestamp(row.call.horizon_end);
    if (entry === null || end === null || end - entry !== DAY || row.time < occupiedUntil) continue;
    selected.add(row.index); occupiedUntil = end;
  }
  const rows = [], exclusions = [];
  for (const item of source) {
    const { call, index, time } = item;
    const result = endpoint.rows[index];
    const exclude = reason => exclusions.push({ source_index: index, prediction_id: call.prediction_id, reason });
    if (!selected.has(index)) { exclude('not_in_fixed_source_schedule'); continue; }
    if (!result.evaluable) { exclude(result.result_reason); continue; }
    const end = parseTimestamp(result.horizon_end);
    const partition = end <= split ? 'training' : time >= split + options.embargo_ms ? 'validation' : null;
    if (!partition) { exclude('split_overlap_or_embargo'); continue; }
    const snapshot = byId.get(call.source_snapshot_id);
    if (!snapshot) { exclude('snapshot_missing'); continue; }
    const extracted = extractSnapshotFeatures(snapshot, time);
    if (extracted.issues.includes('snapshot_storage_not_before_decision')) { exclude(extracted.issues[0]); continue; }
    // The timestamped evaluator has already validated every supplied feature cutoff.
    for (const feature of call.features || []) extracted.values[feature.name] = feature.value;
    if (call.retrospective_event_features?.length) {
      if (dataset.event_vintage_audit?.mode !== 'retrospective') throw new Error('Retrospective event values require explicit evidence mode');
      for (const feature of call.retrospective_event_features) extracted.values[feature.name] = feature.value;
      extracted.issues.push('retrospective_event_values_not_verified_at_decision');
    }
    rows.push({ prediction_id: call.prediction_id, source_snapshot_id: snapshot.id, decision_time: call.call_time,
      partition, values: extracted.values, source_issues: extracted.issues,
      sign: result.market_outcome_direction === 'BULLISH' ? 1 : result.market_outcome_direction === 'BEARISH' ? -1 : 0,
      call_sign: direction(call.direction), return_pct: result.pct_change });
  }
  const training = rows.filter(row => row.partition === 'training');
  const validation = rows.filter(row => row.partition === 'validation');
  const featureNames = [...new Set(training.flatMap(row => Object.keys(row.values)))].sort();
  const conditions = [];
  for (const feature of featureNames) {
    // Event levels have incompatible units across releases. Study event family and surprise state instead.
    if (['event_actual', 'event_consensus'].includes(feature)) continue;
    const values = training.map(row => row.values[feature]).filter(value => value != null);
    if (values.length && values.every(value => typeof value === 'number' && Number.isFinite(value))) {
      const sorted = [...values].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      conditions.push({ feature, operator: 'gt', value: median }, { feature, operator: 'lte', value: median });
    } else {
      for (const value of [...new Set(values)].sort()) conditions.push({ feature, operator: 'eq', value });
    }
  }
  const candidates = conditions.map(condition => [condition]);
  for (let a = 0; a < conditions.length; a++) for (let b = a + 1; b < conditions.length; b++) {
    if (conditions[a].feature !== conditions[b].feature) candidates.push([conditions[a], conditions[b]]);
  }
  const experiments = candidates.map((conditions, index) => {
    const filter = set => set.filter(row => conditions.every(condition => testCondition(row, condition) === true));
    const train = filter(training), valid = filter(validation);
    const bullish = stats(train, 1), bearish = stats(train, -1);
    const sign = bullish.correct >= bearish.correct ? 1 : -1;
    const coverage = set => {
      const usable = set.filter(row => conditions.every(condition => testCondition(row, condition) !== null));
      const matched = filter(usable);
      return { source_observations: set.length, feature_usable: usable.length, missing_feature: set.length - usable.length,
        matched: matched.length, unmatched: usable.length - matched.length,
        comparable_constant_direction: stats(usable, sign), complement: stats(usable.filter(row => !matched.includes(row)), sign) };
    };
    return { id: `candidate-${index + 1}`, conditions, expected_direction: sign === 1 ? 'BULLISH' : 'BEARISH',
      training: stats(train, sign), validation: stats(valid, sign),
      feature_coverage: { training: coverage(training), validation: coverage(validation) },
      validation_ids: valid.map(row => row.prediction_id),
      training_eligible: train.filter(row => row.sign !== 0).length >= options.minimum_training_samples,
      event_conditioned: conditions.some(condition => condition.feature.startsWith('event_')) };
  });
  const ranked = experiments.filter(row => row.training_eligible).sort((a, b) =>
    b.training.ex_flat_accuracy_pct - a.training.ex_flat_accuracy_pct || b.training.directional_observations - a.training.directional_observations || a.id.localeCompare(b.id));
  const selectedByClass = {};
  for (const [name, predicate] of Object.entries({ single_variable: row => row.conditions.length === 1,
    cross_variable: row => row.conditions.length === 2, event_conditioned: row => row.event_conditioned })) {
    selectedByClass[name] = ranked.find(predicate)?.id ?? null;
  }
  const scoreCalls = set => {
    const called = set.filter(row => row.call_sign !== 0);
    return { scheduled_evaluable: set.length, no_calls: set.length - called.length,
      ...stats(called.map(row => ({ ...row, sign: row.sign * row.call_sign })), 1),
      always_bullish: stats(called, 1), always_bearish: stats(called, -1) };
  };
  const admittedById = new Map(rows.map(row => [row.prediction_id, row]));
  const excludedByIndex = new Map(exclusions.map(row => [row.source_index, row.reason]));
  const eventCoverage = new Map();
  for (const { call, index } of source) {
    for (const feature of [...(call.features || []), ...(call.retrospective_event_features || [])]) {
      if (!feature.name.startsWith('event_') || !feature.name.endsWith('_surprise')) continue;
      if (!eventCoverage.has(feature.name)) eventCoverage.set(feature.name, { feature: feature.name,
        event_name: feature.event_name ?? feature.name, source_decisions: 0, training: 0, validation: 0, exclusions: {} });
      const group = eventCoverage.get(feature.name);
      group.source_decisions++;
      const admitted = admittedById.get(call.prediction_id);
      if (admitted) group[admitted.partition]++;
      else {
        const reason = excludedByIndex.get(index) ?? 'unclassified';
        group.exclusions[reason] = (group.exclusions[reason] || 0) + 1;
      }
    }
  }
  return { version: 'gold-experiments-v1', research_only: true, data_kind: dataset.data_kind, options,
    source_schedule: 'Earliest UTC-day decision then nonoverlapping 24h windows; selected before outcome filtering. Descriptive schedule, not verified daily production schedule.',
    qualified_for_live_calls: false, greater_than_60pct_established: false,
    qualification_blockers: ['raw_publication_and_consensus_vintages_unverified', 'no_untouched_final_holdout',
      'endpoint_coverage_not_contiguous', 'multiple_testing_and_serial_dependence_not_qualified', 'layer2_timestamped_output_history_not_evaluated'],
    strict: { evaluable: strict.evaluable_calls, reasons: strict.reason_counts },
    coverage: { source_calls: source.length, scheduled_calls: selected.size, training: training.length, validation: validation.length, excluded: exclusions.length },
    stored_call_baseline: { training: scoreCalls(training), validation: scoreCalls(validation) },
    unconditional_market_baseline: { training: { bullish: stats(training, 1), bearish: stats(training, -1) },
      validation: { bullish: stats(validation, 1), bearish: stats(validation, -1) } },
    event_vintage_audit: dataset.event_vintage_audit ?? null,
    event_family_coverage: [...eventCoverage.values()],
    candidate_count: experiments.length, eligible_training_candidates: ranked.length,
    selected_by_training_only: ranked[0]?.id ?? null,
    selected_by_class_training_only: selectedByClass,
    conditions_learned_from: 'training only; median thresholds, categorical states and majority directions',
    experiments, rows, exclusions };
}
module.exports = { buildExperiments, extractSnapshotFeatures, testCondition };
