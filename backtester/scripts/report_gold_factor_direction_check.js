const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { flattenReportCells } = require('../lib/gold_data_verifier');

// Scores the accepted single-variable report against the direction each factor is supposed to imply.
// One question only: when a factor reads a given way, did Gold end the session (and the week) that way?
// It re-cuts already-consumed intervals, selects nothing, ranks nothing and adds no measurement.
const VERSION = 'gold-factor-direction-check-v1';
const PRIMARY_HORIZON = 'h24_post_event';
const WEEK_HORIZON = 'd5_trading_days_post_event';
const COHORT = 'daily_snapshot_anchors';
const GROUP = 'all_computed';
const DEFAULT_EXPECTATIONS = path.join(__dirname, '..', 'registries', 'gold_factor_direction_expectations.v1.json');
const PROVENANCE_VALUES = new Set(['declared', 'interpreted', 'not_declared']);
const SCORED_DIRECTIONS = new Set(['BULLISH', 'BEARISH']);
const ALL_DIRECTIONS = new Set(['BULLISH', 'BEARISH', 'NEUTRAL']);

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) throw new Error(`Unknown argument: ${arg}`);
    const [name, inline] = arg.slice(2).split('=');
    const value = inline ?? args[index + 1];
    if (value === undefined) throw new Error(`Missing value for --${name}`);
    options[name] = value;
    if (inline === undefined) index += 1;
  }
  return options;
}

function share(numerator, denominator) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function subtract(left, right) {
  if (left === null || right === null) return null;
  return Math.round((left - right) * 100) / 100;
}

function assertExpectations(registry) {
  if (!registry || typeof registry !== 'object') throw new Error('A direction-expectations registry object is required.');
  if (!Array.isArray(registry.factors) || !Array.isArray(registry.states)) {
    throw new Error('Registry requires factors and states arrays.');
  }
  const factorKeys = new Set();
  for (const factor of registry.factors) {
    if (!factor || !/^F\d+$/.test(factor.key || '') || typeof factor.label !== 'string' || !Number.isFinite(factor.weight)) {
      throw new Error('Every factor requires a key, a label and a numeric weight.');
    }
    if (factorKeys.has(factor.key)) throw new Error(`Duplicate factor key ${factor.key}.`);
    factorKeys.add(factor.key);
  }
  const entries = [...registry.states, ...(registry.state_patterns || [])];
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.variable !== 'string' || !entry.variable.trim()) throw new Error('Every expectation requires a variable.');
    if (!factorKeys.has(entry.factor)) throw new Error(`Unknown factor ${entry.factor} on ${entry.variable}.`);
    if (!PROVENANCE_VALUES.has(entry.provenance)) throw new Error(`Unknown provenance on ${entry.variable}.`);
    const isPattern = typeof entry.state_suffix === 'string';
    if (isPattern === (typeof entry.state === 'string')) throw new Error(`Expectation on ${entry.variable} needs exactly one of state or state_suffix.`);
    const key = `${entry.variable}|${entry.state ?? entry.state_suffix}`;
    if (seen.has(key)) throw new Error(`Duplicate expectation ${key}.`);
    seen.add(key);
    if (entry.expected_direction !== null && !ALL_DIRECTIONS.has(entry.expected_direction)) {
      throw new Error(`Invalid expected_direction on ${key}.`);
    }
    if (SCORED_DIRECTIONS.has(entry.expected_direction)) {
      if (entry.provenance === 'not_declared') throw new Error(`A not_declared expectation cannot carry a direction (${key}).`);
      if (typeof entry.rule_ref !== 'string' || typeof entry.rule_text !== 'string') {
        throw new Error(`A scored expectation must quote its rule (${key}).`);
      }
    }
    if (entry.provenance === 'not_declared') {
      if (entry.expected_direction !== null) throw new Error(`A not_declared expectation must not carry a direction (${key}).`);
      if (typeof entry.reason !== 'string' || !entry.reason.trim()) throw new Error(`A not_declared expectation must state a reason (${key}).`);
    }
  }
  return true;
}

function buildExpectationIndex(registry) {
  assertExpectations(registry);
  const exact = new Map();
  for (const entry of registry.states) exact.set(`${entry.variable}|${entry.state}`, entry);
  return {
    factorOf: key => registry.factors.find(factor => factor.key === key) || null,
    lookup(variable, state) {
      const direct = exact.get(`${variable}|${state}`);
      if (direct) return { entry: direct, matched_by: 'state' };
      for (const entry of registry.state_patterns || []) {
        if (entry.variable === variable && state.endsWith(entry.state_suffix)) {
          return { entry, matched_by: 'state_suffix' };
        }
      }
      return { entry: null, matched_by: 'unmapped' };
    }
  };
}

function baselineFor(report, parameters, horizon) {
  const cohortBlock = (report.baselines || {})[parameters.cohort];
  const horizonBlock = cohortBlock ? cohortBlock[horizon] : null;
  const group = horizonBlock && horizonBlock.groups ? horizonBlock.groups[parameters.group] : null;
  if (!group) return null;
  const direction = group.direction || {};
  const positive = direction.positive || 0;
  const negative = direction.negative || 0;
  const resolved = positive + negative;
  const byYear = {};
  for (const year of group.year_breakdown || []) {
    const split = year.direction || {};
    const yearResolved = (split.positive || 0) + (split.negative || 0);
    if (yearResolved) {
      byYear[year.year] = {
        n: year.n,
        positive_rate_pct: share(split.positive || 0, yearResolved),
        negative_rate_pct: share(split.negative || 0, yearResolved)
      };
    }
  }
  return {
    horizon,
    group: parameters.group,
    n: group.n,
    positive,
    negative,
    exact_zero: direction.exact_zero || 0,
    resolved,
    positive_rate_pct: share(positive, resolved),
    negative_rate_pct: share(negative, resolved),
    by_year: byYear
  };
}

function rawCell(cell) {
  if (!cell) return null;
  const direction = cell.state.direction || {};
  const positive = direction.positive || 0;
  const negative = direction.negative || 0;
  const resolved = positive + negative;
  return {
    horizon: cell.horizon,
    n: cell.state.n || 0,
    positive,
    negative,
    exact_zero: direction.exact_zero || 0,
    resolved,
    up_rate_pct: share(positive, resolved),
    down_rate_pct: share(negative, resolved)
  };
}

// One state, one horizon, one expectation: did Gold go the way the factor's rule says it should?
function scoreHorizon(cell, expected, baseline, parameters) {
  const direction = cell.state.direction || {};
  const positive = direction.positive || 0;
  const negative = direction.negative || 0;
  const zero = direction.exact_zero || 0;
  const resolved = positive + negative;
  const n = cell.state.n || 0;
  const expectsUp = expected === 'BULLISH';
  const expected_count = expectsUp ? positive : negative;
  const other_count = expectsUp ? negative : positive;
  const hit_rate_pct = share(expected_count, resolved);
  const benchmark_pct = baseline ? (expectsUp ? baseline.positive_rate_pct : baseline.negative_rate_pct) : null;
  const years = (cell.state.year_breakdown || []).map(year => {
    const split = year.direction || {};
    const yearPositive = split.positive || 0;
    const yearNegative = split.negative || 0;
    const yearResolved = yearPositive + yearNegative;
    const yearBaseline = baseline && baseline.by_year ? baseline.by_year[year.year] : null;
    const yearBenchmark = yearBaseline ? (expectsUp ? yearBaseline.positive_rate_pct : yearBaseline.negative_rate_pct) : null;
    const yearHit = share(expectsUp ? yearPositive : yearNegative, yearResolved);
    return {
      year: year.year,
      n: year.n,
      resolved: yearResolved,
      hit_rate_pct: yearHit,
      benchmark_pct: yearBenchmark,
      drift_edge_pp: subtract(yearHit, yearBenchmark)
    };
  });
  const usable = years.filter(year => year.n >= parameters.min_year_n && year.resolved > 0 && year.drift_edge_pp !== null);
  const drift_edge_pp = subtract(hit_rate_pct, benchmark_pct);
  return {
    horizon: cell.horizon,
    n,
    positive,
    negative,
    exact_zero: zero,
    resolved,
    up_rate_pct: share(positive, resolved),
    down_rate_pct: share(negative, resolved),
    expected_side: expected,
    expected_count,
    other_count,
    hit_rate_pct,
    coin_edge_pp: subtract(hit_rate_pct, 50),
    benchmark_pct,
    drift_edge_pp,
    clears_majority_threshold: hit_rate_pct !== null && n >= parameters.min_n && hit_rate_pct >= parameters.threshold_pct,
    small_sample: cell.state.small_sample === true,
    years,
    years_observed: usable.length,
    years_same_edge_sign: drift_edge_pp !== null && usable.length >= 2 &&
      usable.every(year => Math.sign(year.drift_edge_pp) === Math.sign(drift_edge_pp))
  };
}

// The verdict is about information, not about the size of the rate: a 60% bullish call tells you
// nothing when 60% is what the side scored with no conditioning at all.
function verdictFor(block, parameters) {
  if (!block) return 'not_measured_in_cohort';
  if (!block.resolved) return 'no_directional_outcomes';
  if (block.n < parameters.min_n) return 'small_sample';
  if (block.drift_edge_pp === null) return 'no_baseline';
  if (Math.abs(block.drift_edge_pp) < parameters.edge_pp) return 'no_information';
  if (!block.years_same_edge_sign) return 'unstable_across_years';
  return block.drift_edge_pp > 0 ? 'reliable' : 'inverted';
}

function buildDirectionCheck(report, registry, parameters) {
  const index = buildExpectationIndex(registry);
  const baselines = {};
  for (const horizon of parameters.horizons) baselines[horizon] = baselineFor(report, parameters, horizon);
  const cells = flattenReportCells(report).filter(cell =>
    cell.cohort === parameters.cohort && cell.group === parameters.group && parameters.horizons.includes(cell.horizon));
  const byState = new Map();
  for (const cell of cells) {
    const key = `${cell.variable}|${cell.state.state}`;
    if (!byState.has(key)) byState.set(key, { variable: cell.variable, state: cell.state.state, horizons: {} });
    byState.get(key).horizons[cell.horizon] = cell;
  }
  const cohortStatus = new Map();
  for (const variable of report.variables || []) {
    const block = (variable.cohorts || {})[parameters.cohort];
    cohortStatus.set(variable.id, block && typeof block === 'object' ? (block.status || 'unknown') : 'absent');
  }
  const rows = [];
  const unscored = [];
  const unmapped = [];
  const availability_labels = [];
  for (const entry of byState.values()) {
    const expected = index.lookup(entry.variable, entry.state);
    const sessionCell = entry.horizons[parameters.primary_horizon] || null;
    const weekCell = entry.horizons[parameters.week_horizon] || null;
    if (entry.state === 'unavailable') {
      availability_labels.push({
        variable: entry.variable,
        state: entry.state,
        note: 'Availability label rather than a factor output: the variable had no strictly-available value at the anchor.',
        session: rawCell(sessionCell),
        week: rawCell(weekCell)
      });
      continue;
    }
    if (!expected.entry) {
      unmapped.push({ variable: entry.variable, state: entry.state, session: rawCell(sessionCell), week: rawCell(weekCell) });
      continue;
    }
    const factor = index.factorOf(expected.entry.factor);
    const base = {
      factor_key: factor.key,
      factor_label: factor.label,
      factor_weight: factor.weight,
      variable: entry.variable,
      state: entry.state,
      expectation: expected.entry.expected_direction,
      provenance: expected.entry.provenance,
      matched_by: expected.matched_by,
      rule_ref: expected.entry.rule_ref ?? null,
      rule_text: expected.entry.rule_text ?? null,
      caveats: expected.entry.caveats || [],
      reason: expected.entry.reason ?? null,
      session_raw: rawCell(sessionCell),
      week_raw: rawCell(weekCell)
    };
    if (!SCORED_DIRECTIONS.has(expected.entry.expected_direction)) {
      unscored.push(base);
      continue;
    }
    const session = sessionCell
      ? scoreHorizon({ state: sessionCell.state, horizon: parameters.primary_horizon }, expected.entry.expected_direction, baselines[parameters.primary_horizon], parameters)
      : null;
    const week = weekCell
      ? scoreHorizon({ state: weekCell.state, horizon: parameters.week_horizon }, expected.entry.expected_direction, baselines[parameters.week_horizon], parameters)
      : null;
    rows.push({
      ...base, session, week,
      session_verdict: verdictFor(session, parameters),
      week_verdict: verdictFor(week, parameters)
    });
  }
  const observedKeys = new Set([...byState.values()].map(entry => `${entry.variable}|${entry.state}`));
  const declared_but_absent = [];
  const declared_in_another_cohort = [];
  for (const entry of [...registry.states, ...(registry.state_patterns || [])]) {
    const status = cohortStatus.get(entry.variable) ?? 'absent';
    const state = entry.state ?? entry.state_suffix;
    if (status !== 'measured') {
      declared_in_another_cohort.push({ variable: entry.variable, state, factor: entry.factor, expectation: entry.expected_direction, cohort_status: status, provenance: entry.provenance });
      continue;
    }
    if (entry.state && !observedKeys.has(`${entry.variable}|${entry.state}`)) {
      declared_but_absent.push({ variable: entry.variable, state: entry.state, factor: entry.factor, expectation: entry.expected_direction, note: 'declared_state_not_measured_in_this_cohort' });
    }
  }
  const order = (left, right) => right.factor_weight - left.factor_weight ||
    left.factor_key.localeCompare(right.factor_key) ||
    left.variable.localeCompare(right.variable) ||
    String(left.state).localeCompare(String(right.state));
  rows.sort(order);
  unscored.sort(order);
  unmapped.sort((left, right) => left.variable.localeCompare(right.variable) || left.state.localeCompare(right.state));
  return {
    rows,
    unscored,
    unmapped,
    availability_labels,
    declared_but_absent,
    declared_in_another_cohort,
    unmeasured_document_inputs: registry.unmeasured_document_inputs || [],
    rollup: buildRollup(rows, parameters),
    baselines
  };
}

// Pooling is n-weighted and dependent, so it summarises the rows above rather than creating new trials.
function poolBlocks(blocks, horizon, parameters) {
  const usable = blocks.filter(Boolean);
  const resolved = usable.reduce((sum, block) => sum + block.resolved, 0);
  if (!resolved) return null;
  const expected_count = usable.reduce((sum, block) => sum + block.expected_count, 0);
  const benchmarked = usable.filter(block => block.benchmark_pct !== null);
  const benchmarkResolved = benchmarked.reduce((sum, block) => sum + block.resolved, 0);
  const benchmarkWeighted = benchmarked.reduce((sum, block) => sum + block.benchmark_pct * block.resolved, 0);
  const benchmark_pct = benchmarkResolved ? Math.round((benchmarkWeighted / benchmarkResolved) * 100) / 100 : null;
  const hit_rate_pct = share(expected_count, resolved);
  const pooledYears = new Map();
  for (const block of usable) {
    for (const year of block.years) {
      if (year.n < parameters.min_year_n || !year.resolved) continue;
      const acc = pooledYears.get(year.year) ||
        { year: year.year, n: 0, resolved: 0, expected_count: 0, benchmark_count: 0, benchmark_resolved: 0 };
      acc.n += year.n;
      acc.resolved += year.resolved;
      acc.expected_count += (year.hit_rate_pct / 100) * year.resolved;
      if (year.benchmark_pct !== null) {
        acc.benchmark_count += (year.benchmark_pct / 100) * year.resolved;
        acc.benchmark_resolved += year.resolved;
      }
      pooledYears.set(year.year, acc);
    }
  }
  const yearRows = [...pooledYears.values()].sort((left, right) => left.year - right.year).map(acc => {
    const yearHit = share(acc.expected_count, acc.resolved);
    const yearBenchmark = acc.benchmark_resolved
      ? Math.round((acc.benchmark_count / acc.benchmark_resolved) * 10000) / 100
      : null;
    return {
      year: acc.year,
      n: acc.n,
      resolved: acc.resolved,
      hit_rate_pct: yearHit,
      benchmark_pct: yearBenchmark,
      drift_edge_pp: subtract(yearHit, yearBenchmark)
    };
  });
  const drift_edge_pp = subtract(hit_rate_pct, benchmark_pct);
  return {
    horizon,
    n: usable.reduce((sum, block) => sum + block.n, 0),
    resolved,
    expected_count,
    hit_rate_pct,
    coin_edge_pp: subtract(hit_rate_pct, 50),
    benchmark_pct,
    drift_edge_pp,
    rows_pooled: usable.length,
    years: yearRows,
    years_observed: yearRows.length,
    years_same_edge_sign: drift_edge_pp !== null && yearRows.length >= 2 &&
      yearRows.every(year => Math.sign(year.drift_edge_pp) === Math.sign(drift_edge_pp)),
    clears_majority_threshold: hit_rate_pct !== null && resolved >= parameters.min_n && hit_rate_pct >= parameters.threshold_pct
  };
}

function buildRollup(rows, parameters) {
  const byFactor = new Map();
  for (const row of rows) {
    if (!byFactor.has(row.factor_key)) byFactor.set(row.factor_key, []);
    byFactor.get(row.factor_key).push(row);
  }
  return [...byFactor.entries()].map(([factorKey, factorRows]) => {
    const session = poolBlocks(factorRows.map(row => row.session), parameters.primary_horizon, parameters);
    const week = poolBlocks(factorRows.map(row => row.week), parameters.week_horizon, parameters);
    return {
      factor_key: factorKey,
      factor_label: factorRows[0].factor_label,
      factor_weight: factorRows[0].factor_weight,
      variables: [...new Set(factorRows.map(row => row.variable))].sort(),
      rows_scored: factorRows.length,
      declared_rows: factorRows.filter(row => row.provenance === 'declared').length,
      interpreted_rows: factorRows.filter(row => row.provenance === 'interpreted').length,
      session,
      week,
      session_verdict: verdictFor(session, parameters),
      week_verdict: verdictFor(week, parameters)
    };
  }).sort((left, right) => right.factor_weight - left.factor_weight || left.factor_key.localeCompare(right.factor_key));
}

function countVerdicts(rows, key) {
  const counts = {};
  for (const row of rows) counts[row[key]] = (counts[row[key]] || 0) + 1;
  return counts;
}

function summarise(check, parameters) {
  return {
    baselines: Object.fromEntries(Object.entries(check.baselines).map(([horizon, value]) => [horizon, value ? {
      n: value.n,
      positive_rate_pct: value.positive_rate_pct,
      negative_rate_pct: value.negative_rate_pct
    } : null])),
    factors_scored: check.rollup.length,
    rows_scored: check.rows.length,
    rows_declared: check.rows.filter(row => row.provenance === 'declared').length,
    rows_interpreted: check.rows.filter(row => row.provenance === 'interpreted').length,
    rows_unscored_no_declared_direction: check.unscored.length,
    rows_availability_labels: check.availability_labels.length,
    rows_unmapped_in_expectations: check.unmapped.length,
    declared_states_absent_from_the_report: check.declared_but_absent.length,
    declared_variables_measured_in_another_cohort: check.declared_in_another_cohort.length,
    session_verdicts: countVerdicts(check.rows, 'session_verdict'),
    week_verdicts: countVerdicts(check.rows, 'week_verdict'),
    session_rows_at_or_above_threshold_pct: check.rows.filter(row => row.session && row.session.clears_majority_threshold).length,
    week_rows_at_or_above_threshold_pct: check.rows.filter(row => row.week && row.week.clears_majority_threshold).length,
    session_rows_hit_rate_at_least_50: check.rows.filter(row => row.session && row.session.hit_rate_pct >= 50).length,
    week_rows_hit_rate_at_least_50: check.rows.filter(row => row.week && row.week.hit_rate_pct >= 50).length
  };
}

function signed(value) {
  if (value === null || value === undefined) return 'n/a';
  return `${value >= 0 ? '+' : ''}${value}`;
}

function blockText(block) {
  if (!block) return 'not measured';
  return `hit ${block.hit_rate_pct}% (${block.expected_count}/${block.resolved}) | drift ${signed(block.drift_edge_pp)}pp | n ${block.n}`;
}

function formatRows(check, parameters) {
  const lines = [
    `Gold factor direction check ${VERSION} | cohort ${parameters.cohort} | group ${parameters.group} | session ${parameters.primary_horizon} | week ${parameters.week_horizon}`,
    `min n ${parameters.min_n} | min year n ${parameters.min_year_n} | edge band ${parameters.edge_pp}pp | rate threshold ${parameters.threshold_pct}%`,
    `baselines ${JSON.stringify(summarise(check, parameters).baselines)}`,
    `summary ${JSON.stringify(summarise(check, parameters))}`,
    '',
    'factor | w | variable | factor output (state) | expects | session | week | years | verdict session / week'
  ];
  for (const row of check.rows) {
    lines.push([
      row.factor_key, row.factor_weight, row.variable, row.state, row.expectation,
      blockText(row.session), blockText(row.week),
      row.session && row.week ? `${row.session.years_observed}/${row.session.years_same_edge_sign ? 'stable' : 'mixed'} - ${row.week.years_observed}/${row.week.years_same_edge_sign ? 'stable' : 'mixed'}` : 'n/a',
      `${row.session_verdict} / ${row.week_verdict}`
    ].join(' | '));
  }
  return lines;
}

function formatRollup(check, parameters) {
  const lines = ['', 'factor | w | variables | rows | pooled session | pooled week | verdict session / week'];
  for (const factor of check.rollup) {
    lines.push([
      `${factor.factor_key} ${factor.factor_label}`, factor.factor_weight, factor.variables.length, factor.rows_scored,
      blockText(factor.session), blockText(factor.week),
      `${factor.session_verdict} / ${factor.week_verdict}`
    ].join(' | '));
  }
  return lines;
}

function formatUnscored(check) {
  const lines = ['', `unscored states (no declared direction to score): ${check.unscored.length}`];
  for (const row of check.unscored) {
    const session = row.session_raw ? `up ${row.session_raw.up_rate_pct}% (n ${row.session_raw.n})` : 'not measured';
    const week = row.week_raw ? `up ${row.week_raw.up_rate_pct}% (n ${row.week_raw.n})` : 'not measured';
    lines.push(`${row.factor_key} | ${row.variable} | ${row.state} | ${row.provenance} | ${row.reason || row.expectation} | session ${session} | week ${week}`);
  }
  for (const row of check.unmapped) {
    lines.push(`unmapped | ${row.variable} | ${row.state} | no expectation declared`);
  }
  for (const row of check.availability_labels) {
    lines.push(`availability label | ${row.variable} | ${row.state} | session n ${row.session ? row.session.n : 0} | week n ${row.week ? row.week.n : 0}`);
  }
  for (const row of check.declared_but_absent) {
    lines.push(`absent state | ${row.variable} | ${row.state} | ${row.note}`);
  }
  for (const row of check.declared_in_another_cohort) {
    lines.push(`other cohort | ${row.variable} | ${row.state} | cohort_status ${row.cohort_status}`);
  }
  for (const row of check.unmeasured_document_inputs) {
    lines.push(`document input not measured | ${row.factor} | ${row.document_input} | ${row.report_status}`);
  }
  return lines;
}

function cellText(block) {
  if (!block) return 'not measured';
  return `${block.up_rate_pct}% up / ${block.down_rate_pct}% down (n ${block.n})`;
}

function rateText(block) {
  if (!block) return 'n/a';
  return `${block.hit_rate_pct}% (${block.expected_count}/${block.resolved})`;
}

function edgeText(block) {
  if (!block) return 'n/a';
  return `${signed(block.drift_edge_pp)}pp vs ${block.benchmark_pct}%`;
}

function formatMarkdown(check, parameters) {
  const lines = [
    `### Every scored factor state, session and week (cohort ${parameters.cohort}, ${parameters.group})`,
    '',
    '| Factor | W | Variable | Factor output | Expects Gold | Session up/down | Session hit | Session edge vs drift | Week up/down | Week hit | Week edge vs drift | Years stable | Verdict session / week |',
    '| --- | ---: | --- | --- | --- | --- | --- | ---: | --- | --- | ---: | --- | --- |'
  ];
  for (const row of check.rows) {
    const years = row.session && row.week
      ? `${row.session.years_observed}/${row.session.years_same_edge_sign ? 'yes' : 'no'} - ${row.week.years_observed}/${row.week.years_same_edge_sign ? 'yes' : 'no'}`
      : 'n/a';
    lines.push(`| ${row.factor_key} ${row.factor_label} | ${row.factor_weight} | ${row.variable} | ${row.state} | ${row.expectation} | ${cellText(row.session)} | ${rateText(row.session)} | ${edgeText(row.session)} | ${cellText(row.week)} | ${rateText(row.week)} | ${edgeText(row.week)} | ${years} | ${row.session_verdict} / ${row.week_verdict} |`);
  }
  lines.push('', "### Factor rollup, n-weighted across that factor's scored states", '',
    '| Factor | W | Variables | Rows | Pooled session hit | Pooled session edge vs drift | Pooled week hit | Pooled week edge vs drift | Verdict session / week |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
  for (const factor of check.rollup) {
    lines.push(`| ${factor.factor_key} ${factor.factor_label} | ${factor.factor_weight} | ${factor.variables.length} | ${factor.rows_scored} | ${rateText(factor.session)} | ${edgeText(factor.session)} | ${rateText(factor.week)} | ${edgeText(factor.week)} | ${factor.session_verdict} / ${factor.week_verdict} |`);
  }
  lines.push('', `### States printed unscored (${check.unscored.length}), because the logic document declares no direction for them`, '',
    '| Factor | Variable | Factor output | Provenance | Why unscored | Session up/down | Week up/down |',
    '| --- | --- | --- | --- | --- | --- | --- |');
  for (const row of check.unscored) {
    lines.push(`| ${row.factor_key} | ${row.variable} | ${row.state} | ${row.provenance} | ${row.reason || row.expectation} | ${cellText(row.session_raw)} | ${cellText(row.week_raw)} |`);
  }
  return lines;
}

function run(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (!options.report) {
    throw new Error('Usage: node backtester/scripts/report_gold_factor_direction_check.js --report <individual-variable-report.json> [--expectations file] [--cohort name] [--out file] [--markdown file]');
  }
  const raw = fs.readFileSync(options.report);
  const report = JSON.parse(raw.toString('utf8'));
  const expectationsPath = options.expectations || DEFAULT_EXPECTATIONS;
  const expectationsRaw = fs.readFileSync(expectationsPath);
  const registry = JSON.parse(expectationsRaw.toString('utf8'));
  const parameters = {
    cohort: options.cohort || COHORT,
    group: options.group || GROUP,
    primary_horizon: options.session || PRIMARY_HORIZON,
    week_horizon: options.week || WEEK_HORIZON,
    horizons: [options.session || PRIMARY_HORIZON, options.week || WEEK_HORIZON],
    min_n: Number(options['min-n'] || 100),
    min_year_n: Number(options['min-year-n'] || 20),
    edge_pp: Number(options.edge || 5),
    threshold_pct: Number(options.threshold || 60)
  };
  const check = buildDirectionCheck(report, registry, parameters);
  const output = {
    version: VERSION,
    research_only: true,
    exploratory: true,
    prediction_claimed: false,
    accuracy_claimed: false,
    trading_result_computed: false,
    generated_at: new Date().toISOString(),
    source: { path: options.report, sha256: crypto.createHash('sha256').update(raw).digest('hex'), bytes: raw.length },
    expectations_source: {
      path: expectationsPath,
      version: registry.version,
      sha256: crypto.createHash('sha256').update(expectationsRaw).digest('hex'),
      bytes: expectationsRaw.length
    },
    parameters,
    limitations: [
      'Descriptive re-cut of the accepted single-variable report on already-consumed intervals. It describes this space; it cannot support choosing from it.',
      "The expectations file maps the Layer 1 logic document onto the report's states and was written after the report was accepted, so this is a declared reading rather than a pre-registration.",
      "The hit rate is the expected side's share of the directional outcomes for that state, and its benchmark is the same side's unconditioned rate, so an edge is information rather than merely a high rate.",
      'Observations are dependent: states share anchors, one instant can feed several variables, and the two halves of a split are complements rather than independent trials.',
      'No significance, prediction, timing, profitability or trading edge claim is made or implied. No new data was gathered, no Layer 1 logic changed and the sealed prospective window was not read.'
    ],
    summary: summarise(check, parameters),
    baselines: check.baselines,
    rollup: check.rollup,
    rows: check.rows,
    unscored: check.unscored,
    unmapped: check.unmapped,
    availability_labels: check.availability_labels,
    declared_but_absent: check.declared_but_absent,
    declared_in_another_cohort: check.declared_in_another_cohort,
    unmeasured_document_inputs: check.unmeasured_document_inputs
  };
  if (options.out) fs.writeFileSync(options.out, `${JSON.stringify(output, null, 2)}\n`, { flag: 'wx' });
  if (options.markdown) fs.writeFileSync(options.markdown, `${formatMarkdown(check, parameters).join('\n')}\n`, { flag: 'wx' });
  console.log([...formatRows(check, parameters), ...formatRollup(check, parameters), ...formatUnscored(check)].join('\n'));
  if (options.out) console.log(`\nReport written: ${options.out}`);
  if (options.markdown) console.log(`Markdown written: ${options.markdown}`);
  return output;
}

if (require.main === module) run();
module.exports = {
  VERSION,
  parseArgs,
  share,
  subtract,
  assertExpectations,
  buildExpectationIndex,
  baselineFor,
  rawCell,
  scoreHorizon,
  verdictFor,
  poolBlocks,
  buildRollup,
  buildDirectionCheck,
  summarise,
  formatRows,
  formatRollup,
  formatUnscored,
  formatMarkdown,
  run
};
