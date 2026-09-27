'use strict';
// Shape the accepted Gold factor direction check into the payload that the self-contained
// direction-scorecard page (gold-direction-scorecard.html) renders. Nothing is measured here: the
// page only re-arranges the accepted single-variable report through the declaration registry, and
// the module fails closed when any accepted count drifts. It selects nothing, ranks nothing and
// makes no prediction, accuracy, timing or edge claim.
//
// The check itself is produced by backtester/scripts/report_gold_factor_direction_check.js; this
// module receives it already built, so the shaping stays pure and testable without the 95 MB report.

const SCHEMA = 'gold-direction-scorecard-v1';

// Counts that belong to the accepted 019 revision 2 report and to the direction check built from
// it. If any of these moves, the page must be re-derived rather than silently re-rendered.
const EXPECTED = Object.freeze({
  variables_declared: 28,
  daily_anchors: 965,
  daily_anchors_with_outcome: 964,
  event_rows: 5115,
  session_horizon: 'h24_post_event',
  week_horizon: 'd5_trading_days_post_event',
  session_n: 964,
  week_n: 960,
  session_up_rate_pct: 55.81,
  week_up_rate_pct: 58.23,
  rows_scored: 25,
  unscored_states: 26,
  factors_declared: 10,
  weights_total: 100
});

const REASON_NOTES = Object.freeze({
  level_band_not_declared: "The document's rule for this factor is a change rule. It says nothing about where a level sits relative to its own history, so the report's own-median split has no declared direction.",
  change_rule_absent: 'The document states no directional rule at all for a change in this variable, so there is no expectation to test.',
  threshold_is_absolute_band: "The document's rule uses absolute bands (VIX above 25, below 16). The report splits each level at the variable's own median, which is not that band and cannot be recovered from the report.",
  regime_label_not_reproduced: "The document's rule is written in categorical regime names (expansion, contraction, stress, calm). The report measures the level's own median split and does not reproduce the agent's categorical names.",
  neutral_declared: 'The logic document declares this state NEUTRAL, so there is no direction to test and no hit rate to quote.',
  state_not_measured: 'The document declares this state, but the accepted report never measured it on the weekday anchor grid, so there is no cell to score.',
  another_cohort: 'The variable is measured in the event-release cohort and not on the weekday anchor grid, so it is unscored in a daily-cohort table.',
  document_input_not_measured: 'The document input is not measured by the accepted report at all, so the rule that reads it cannot be tested here.'
});

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function shapeYears(years) {
  return (years || []).map(year => {
    requireValue(Number.isFinite(year.n), `Year ${year.year} needs a sample count.`);
    const noSample = year.n === 0 || !Number.isFinite(year.hit_rate_pct) || !Number.isFinite(year.drift_edge_pp);
    return {
      year: year.year,
      n: year.n,
      resolved: year.resolved,
      hit_rate_pct: noSample ? null : year.hit_rate_pct,
      benchmark_pct: noSample ? null : year.benchmark_pct,
      drift_edge_pp: noSample ? null : year.drift_edge_pp,
      small_sample: noSample || Boolean(year.small_sample),
      no_sample: noSample,
      wrong_way: noSample ? false : year.drift_edge_pp < 0
    };
  });
}


// One scored horizon block. A block shown as a hit rate must carry its own benchmark, because a
// rate without its drift floor is exactly the reading this page exists to prevent.
function shapeBlock(block) {
  if (!block) return null;
  requireValue(Number.isFinite(block.n) && Number.isFinite(block.resolved), 'A scored block needs numeric n and resolved counts.');
  requireValue(Number.isFinite(block.hit_rate_pct), 'A scored block needs a hit rate.');
  requireValue(Number.isFinite(block.benchmark_pct), 'A scored block needs the drift benchmark for the side it called.');
  requireValue(Number.isFinite(block.drift_edge_pp), 'A scored block needs a drift edge.');
  return {
    horizon: block.horizon,
    n: block.n,
    resolved: block.resolved,
    positive: block.positive,
    negative: block.negative,
    exact_zero: block.exact_zero,
    expected_side: block.expected_side,
    expected_count: block.expected_count,
    other_count: block.other_count,
    hit_rate_pct: block.hit_rate_pct,
    benchmark_pct: block.benchmark_pct,
    drift_edge_pp: block.drift_edge_pp,
    clears_majority_threshold: Boolean(block.clears_majority_threshold),
    small_sample: Boolean(block.small_sample),
    years_observed: block.years_observed,
    years_same_edge_sign: Boolean(block.years_same_edge_sign),
    years: shapeYears(block.years)
  };
}

// Unscored cells keep only what they can honestly show: the raw up rate and its sample.
function shapeRaw(raw) {
  if (!raw) return null;
  requireValue(Number.isFinite(raw.n) && Number.isFinite(raw.up_rate_pct), 'An unscored cell needs a sample and an up rate.');
  return { horizon: raw.horizon, n: raw.n, resolved: raw.resolved, up_rate_pct: raw.up_rate_pct, down_rate_pct: raw.down_rate_pct };
}

function shapeScoredRow(row) {
  requireValue(typeof row.variable === 'string' && typeof row.state === 'string', 'A scored row needs a variable and a state.');
  requireValue(row.expectation === 'BULLISH' || row.expectation === 'BEARISH', `${row.variable}|${row.state} is not a directional row.`);
  requireValue(row.provenance === 'declared' || row.provenance === 'interpreted', `${row.variable}|${row.state} has an undeclared provenance.`);
  const session = shapeBlock(row.session);
  const week = shapeBlock(row.week);
  requireValue(session !== null || week !== null, `${row.variable}|${row.state} has no scored horizon.`);
  return {
    factor_key: row.factor_key,
    factor_label: row.factor_label,
    factor_weight: row.factor_weight,
    variable: row.variable,
    state: row.state,
    expectation: row.expectation,
    provenance: row.provenance,
    rule_ref: row.rule_ref || null,
    rule_text: row.rule_text || null,
    caveats: Array.isArray(row.caveats) ? row.caveats : [],
    session,
    week,
    session_verdict: row.session_verdict,
    week_verdict: row.week_verdict
  };
}

function shapeUnscoredRow(row) {
  const reason = row.reason || (row.expectation === 'NEUTRAL' ? 'neutral_declared' : 'state_not_measured');
  return {
    factor_key: row.factor_key,
    factor_label: row.factor_label,
    factor_weight: row.factor_weight,
    variable: row.variable,
    state: row.state,
    expectation: row.expectation,
    provenance: row.provenance,
    reason,
    reason_note: REASON_NOTES[reason] || 'No declared direction covers this state, so it is printed without a hit rate.',
    session_raw: shapeRaw(row.session_raw),
    week_raw: shapeRaw(row.week_raw)
  };
}
// Per-variable coverage is summed over the states the check actually reports for that variable, so
// the page can show how much of the archive each input really rests on.
function buildVariableCoverage(scored, unscored) {
  const byVariable = new Map();
  const touch = variable => {
    if (!byVariable.has(variable)) {
      byVariable.set(variable, { variable, states_reported: 0, scored_states: 0, session_observations: 0, week_observations: 0, years: new Set() });
    }
    return byVariable.get(variable);
  };
  for (const row of [...scored, ...unscored]) {
    const entry = touch(row.variable);
    entry.states_reported += 1;
    const session = row.session || row.session_raw;
    const week = row.week || row.week_raw;
    entry.session_observations += session ? session.n : 0;
    entry.week_observations += week ? week.n : 0;
    if (row.expectation === 'BULLISH' || row.expectation === 'BEARISH') entry.scored_states += 1;
    for (const year of (row.session && row.session.years) || []) entry.years.add(year.year);
  }
  return [...byVariable.values()]
    .map(entry => ({ ...entry, years: [...entry.years].sort((left, right) => left - right) }))
    .sort((left, right) => left.variable.localeCompare(right.variable));
}

// All ten declared factors are shown, including the three this archive cannot test at all, so the
// page can never read like a ten-factor result when only seven could be read.
function buildFactors(registryFactors, rollup, blocked) {
  const rollupByKey = new Map(rollup.map(entry => [entry.factor_key, entry]));
  return registryFactors.map(factor => {
    const pooled = rollupByKey.get(factor.key) || null;
    const blockers = blocked.filter(entry => entry.factor_key === factor.key);
    return {
      key: factor.key,
      label: factor.label,
      weight: factor.weight,
      declared_rules: Array.isArray(factor.declared_rules) ? factor.declared_rules : [],
      document_inputs: Array.isArray(factor.document_inputs) ? factor.document_inputs : [],
      testable: Boolean(pooled && pooled.rows_scored > 0),
      rows_scored: pooled ? pooled.rows_scored : 0,
      declared_rows: pooled ? pooled.declared_rows : 0,
      interpreted_rows: pooled ? pooled.interpreted_rows : 0,
      variables: pooled ? pooled.variables : [],
      session: pooled ? shapeBlock(pooled.session) : null,
      week: pooled ? shapeBlock(pooled.week) : null,
      session_verdict: pooled ? pooled.session_verdict : null,
      week_verdict: pooled ? pooled.week_verdict : null,
      blocked_states: blockers.length,
      blocked_reasons: [...new Set(blockers.map(entry => entry.reason))]
    };
  });
}



function shapeDirectionScorecard({ check, registry, report, hashes }) {
  requireValue(check && Array.isArray(check.rows) && Array.isArray(check.unscored), 'A built direction check is required.');
  requireValue(registry && Array.isArray(registry.factors), 'The declaration registry is required.');
  requireValue(report && report.observation_counts, 'The accepted report is required.');
  requireValue(hashes && typeof hashes.reportSha256 === 'string' && typeof hashes.expectationsSha256 === 'string',
    'Source hashes are required so the page can name its evidence.');
  const counts = report.observation_counts;
  requireValue(Number(counts.daily_anchors) === EXPECTED.daily_anchors, `Daily anchor count drifted from the accepted ${EXPECTED.daily_anchors}.`);
  requireValue(Number(counts.event_rows) === EXPECTED.event_rows, `Event row count drifted from the accepted ${EXPECTED.event_rows}.`);
  requireValue(Number(report.inventory && report.inventory.declared_variables) === EXPECTED.variables_declared,
    `The report must declare ${EXPECTED.variables_declared} measured variables.`);
  requireValue(check.rows.length === EXPECTED.rows_scored, `Scored row count drifted from the accepted ${EXPECTED.rows_scored}.`);
  requireValue(check.unscored.length === EXPECTED.unscored_states, `Unscored state count drifted from the accepted ${EXPECTED.unscored_states}.`);
  requireValue(registry.factors.length === EXPECTED.factors_declared, `The registry must declare ${EXPECTED.factors_declared} factors.`);
  const weightsTotal = registry.factors.reduce((sum, factor) => sum + Number(factor.weight), 0);
  requireValue(weightsTotal === EXPECTED.weights_total, `Factor weights must sum to ${EXPECTED.weights_total}; they sum to ${weightsTotal}.`);
  const baselines = check.baselines || {};
  const sessionBaseline = baselines[EXPECTED.session_horizon];
  const weekBaseline = baselines[EXPECTED.week_horizon];
  requireValue(sessionBaseline && sessionBaseline.n === EXPECTED.session_n, `The session baseline must hold ${EXPECTED.session_n} anchors.`);
  requireValue(weekBaseline && weekBaseline.n === EXPECTED.week_n, `The week baseline must hold ${EXPECTED.week_n} anchors.`);
  requireValue(sessionBaseline.positive_rate_pct === EXPECTED.session_up_rate_pct && weekBaseline.positive_rate_pct === EXPECTED.week_up_rate_pct,
    'The published drift baselines drifted from the accepted report.');

  const scored = check.rows.map(shapeScoredRow);
  const unscored = check.unscored.map(shapeUnscoredRow);
  const neutral = unscored.filter(row => row.reason === 'neutral_declared');
  const printedUnscored = unscored.filter(row => row.reason !== 'neutral_declared');

  const blocked = [
    ...check.declared_but_absent.map(entry => ({ factor_key: entry.factor, variable: entry.variable, state: entry.state, reason: 'state_not_measured', note: entry.note })),
    ...check.declared_in_another_cohort.map(entry => ({ factor_key: entry.factor, variable: entry.variable, state: entry.state, reason: 'another_cohort', note: entry.cohort_status })),
    ...check.unmeasured_document_inputs.map(entry => ({ factor_key: entry.factor, variable: entry.document_input, state: entry.report_status, reason: 'document_input_not_measured', note: entry.reason })),
    ...printedUnscored.map(row => ({ factor_key: row.factor_key, variable: row.variable, state: row.state, reason: row.reason, note: row.reason_note }))
  ].map(entry => ({ ...entry, reason_note: entry.note || REASON_NOTES[entry.reason] || null }));

  const summary = check.summary || {};
  const meta = ((report.sources || {}).hourly || {}).meta || {};

  return {
    schema_version: SCHEMA,
    research_only: true,
    exploratory: true,
    prediction_claimed: false,
    accuracy_claimed: false,
    trading_result_computed: false,
    headline: 'Every declared Gold factor rule scored against the direction Gold actually moved, next to the drift floor it has to beat. No state clears the band on the spent archive.',
    source: {
      path: hashes.reportPath,
      sha256: hashes.reportSha256,
      bytes: hashes.reportBytes,
      first_observation: meta.first_open_time || null,
      last_observation: meta.last_open_time || null
    },
    expectations_source: {
      path: hashes.expectationsPath,
      version: registry.version,
      file_version: hashes.expectationsFileVersion || registry.version,
      sha256: hashes.expectationsSha256,
      written_after_report_acceptance: registry.written_after_report_acceptance === true
    },
    parameters: check.parameters || null,
    coverage: {
      variables_declared: EXPECTED.variables_declared,
      variables_measured: Number(report.inventory.declared_variables),
      daily_anchors: counts.daily_anchors,
      daily_anchors_with_outcome: sessionBaseline.n,
      event_rows: counts.event_rows,
      states_scored: scored.length,
      states_printed_unscored: printedUnscored.length,
      states_declared_neutral: neutral.length,
      availability_labels: check.availability_labels.length,
      factors_scored: check.rollup.length,
      variable_coverage: buildVariableCoverage(scored, unscored)
    },
    baselines: {
      session: {
        horizon: sessionBaseline.horizon,
        n: sessionBaseline.n,
        positive_rate_pct: sessionBaseline.positive_rate_pct,
        negative_rate_pct: sessionBaseline.negative_rate_pct,
        by_year: sessionBaseline.by_year
      },
      week: {
        horizon: weekBaseline.horizon,
        n: weekBaseline.n,
        positive_rate_pct: weekBaseline.positive_rate_pct,
        negative_rate_pct: weekBaseline.negative_rate_pct,
        by_year: weekBaseline.by_year
      }
    },
    summary: {
      rows_scored: summary.rows_scored,
      rows_declared: summary.rows_declared,
      rows_interpreted: summary.rows_interpreted,
      rows_unscored_no_declared_direction: summary.rows_unscored_no_declared_direction,
      session_verdicts: summary.session_verdicts,
      week_verdicts: summary.week_verdicts,
      session_rows_at_or_above_threshold_pct: summary.session_rows_at_or_above_threshold_pct,
      week_rows_at_or_above_threshold_pct: summary.week_rows_at_or_above_threshold_pct,
      session_rows_hit_rate_at_least_50: summary.session_rows_hit_rate_at_least_50,
      week_rows_hit_rate_at_least_50: summary.week_rows_hit_rate_at_least_50,
      states_right_side_of_their_own_drift: scored.filter(row => row.session && row.session.drift_edge_pp > 0).length,
      states_wrong_side_of_their_own_drift: scored.filter(row => row.session && row.session.drift_edge_pp < 0).length
    },
    factors: buildFactors(registry.factors, check.rollup, blocked),
    rows: scored,
    unscored: printedUnscored,
    neutral_states: neutral,
    blocked,
    availability_labels: check.availability_labels,
    limits: [
      'Descriptive re-cut of the accepted single-variable report on already-consumed intervals. It describes this space; it cannot support choosing from it.',
      "The declaration file maps the Layer 1 logic document onto the report's states and was written after the report was accepted, so this is a declared reading, not a pre-registration.",
      "A hit rate is the called side's share of the directional outcomes for that state, and its benchmark is that same side's unconditioned rate, so the edge shown is information rather than a high rate.",
      'Observations are dependent: states share anchors, one instant can feed several variables, and the two halves of a split are complements rather than independent trials.',
      'No significance, prediction, timing, profitability or trading edge claim is made or implied. No new data was gathered, no Layer 1 logic changed and the sealed prospective window was not read.',
      'Three of the ten declared factors cannot be tested against this report at all, and three of the twenty-five scored states are readings rather than verbatim rules.'
    ],
    what_would_change_it: [
      'The sealed prospective window, whose evaluation stays sealed until 2027-03-25T15:00:00Z.',
      'A new licensed dataset with declared release vintages and enough untouched intervals to test a direction twice.',
      'Nothing on this page authorises either path; both need their own bounded assignment.'
    ],
    sources: [
      { label: 'Direction check method', path: hashes.methodPath || 'backtester/scripts/report_gold_factor_direction_check.js', sha256: hashes.methodSha256 || null },
      ...(hashes.checkPath ? [{ label: 'Direction check artifact', path: hashes.checkPath, sha256: hashes.checkSha256 }] : []),
      { label: 'Accepted single-variable report', path: hashes.reportPath, sha256: hashes.reportSha256 },
      { label: 'Direction expectations registry', path: hashes.expectationsPath, sha256: hashes.expectationsSha256 },
      { label: 'Write-up', path: hashes.writeUpPath || 'docs/GOLD_FACTOR_DIRECTION_CHECK_20260927.md', sha256: hashes.writeUpSha256 || null }
    ],
    generated_at: hashes.generatedAt || null
  };
}

module.exports = { SCHEMA, EXPECTED, REASON_NOTES, shapeDirectionScorecard, shapeBlock, buildVariableCoverage, buildFactors };
